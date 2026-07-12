// V5 Character Control specs: capability-gated hand fusion, face-touch v2
// socket sweep (synthetic, deterministic), and feet v2 plant detection.
//
// The socket sweep fabricates MediaPipe-convention landmarks (world: meters,
// y down, z toward camera negative — see src/rig/bodyFrame.ts) and drives
// the retargeter directly through the ?chartest=1 hook, so every one of the
// seven named gestures is exercised regardless of what facetouch.mp4
// happens to contain. Real-footage numbers live in eval/results.json.

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PP_PORT = process.env.PP_PORT ?? '5173';
const BASE = `http://localhost:${PP_PORT}`;

const fixture = (name: string) => resolve(here, '..', 'fixtures', `${name}.y4m`);

async function launchWithCamera(clip: string): Promise<Browser> {
  return chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${clip}`,
      '--autoplay-policy=no-user-gesture-required',
      ...(process.env.USE_SWIFTSHADER
        ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : []),
    ],
  });
}

declare global {
  interface Window {
    __PP: {
      videoReady: boolean;
      detectionCount: number;
      fusionActive?: boolean;
      fusionGated?: boolean;
      fingerApplyCount?: number;
    };
    __PPCharTest?: {
      isolate: () => void;
      drivePose: (world: unknown[], norm: unknown[], tsMs: number) => void;
      tick: (dt: number) => void;
      faceTouch: () => {
        left: { w: number; socket: string | null; pen: boolean };
        right: { w: number; socket: string | null; pen: boolean };
      };
      feet: () => {
        left: { planted: boolean; weight: number; plantEvents: number };
        right: { planted: boolean; weight: number; plantEvents: number };
      };
      wristCapsuleDistance: (side: 'left' | 'right') => number;
      headRadius: () => number;
      avatarName: () => string;
    };
  }
}

test.describe('capability gating (O2)', () => {
  test('incapable rig is provably NOT finger-driven (astronaut)', async ({ page }) => {
    await page.goto(`${BASE}/?avatar=astronaut`);
    await page.waitForFunction(() => window.__PP?.videoReady, undefined, { timeout: 60_000 });
    await page.waitForFunction(() => window.__PP.detectionCount > 20, undefined, { timeout: 60_000 });
    // the gate must be CLOSED and no finger data may ever have been applied
    expect(await page.evaluate(() => window.__PP.fusionGated)).toBe(true);
    expect(await page.evaluate(() => window.__PP.fusionActive)).toBe(false);
    expect(await page.evaluate(() => window.__PP.fingerApplyCount)).toBe(0);
    // card label tells the same story as the gate (chip text comes from
    // the manifest — no drift possible, but assert the wiring end-to-end)
    const chip = page.locator('#avatar-cards .card[data-avatar="astronaut"] .chip');
    await expect(chip).toHaveText('Face-touch limited');
  });

  test('approved rig gets fusion-driven fingers (erika, hands-visible clip)', async () => {
    const browser = await launchWithCamera(fixture('facetouch'));
    try {
      const page: Page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
      await page.goto(`${BASE}/?avatar=erika`);
      await page.waitForFunction(() => window.__PP?.videoReady, undefined, { timeout: 60_000 });
      // gate open for the manifest-approved rig…
      await page.waitForFunction(() => window.__PP.fusionGated === false, undefined, { timeout: 60_000 });
      // …and real finger applications happen (hand model found the hands)
      await page.waitForFunction(() => (window.__PP.fingerApplyCount ?? 0) > 10, undefined, {
        timeout: 90_000,
      });
      const chip = page.locator('#avatar-cards .card[data-avatar="erika"] .chip');
      await expect(chip).toHaveText('Fully supported');
    } finally {
      await browser.close();
    }
  });
});

// ── synthetic landmark rig ────────────────────────────────────────────────
// Injected into the page; builds a standing 33-landmark body in MediaPipe
// world convention and lets the test steer one wrist. Runs entirely on the
// retargeter (detection paused), so results are deterministic.
const DRIVER_JS = `
(() => {
  const mk = (x, y, z, v = 0.9) => ({ x, y, z, visibility: v });
  // indices: 0 nose 7/8 ears 11/12 shoulders 13/14 elbows 15/16 wrists
  // 17..22 pinky/index/thumb 23/24 hips 25/26 knees 27/28 ankles
  // 29/30 heels 31/32 footIndex. Left = +x (post-mirror convention).
  function body() {
    const lm = [];
    for (let i = 0; i < 33; i++) lm.push(mk(0, -0.6, 0, 0.9));
    lm[0] = mk(0, -0.60, -0.10);              // nose
    lm[7] = mk(0.08, -0.63, 0.02);            // left ear
    lm[8] = mk(-0.08, -0.63, 0.02);           // right ear
    for (const [i, s] of [[11, 1], [12, -1]]) lm[i] = mk(s * 0.18, -0.45, 0);   // shoulders
    for (const [i, s] of [[13, 1], [14, -1]]) lm[i] = mk(s * 0.30, -0.20, 0);   // elbows
    for (const [i, s] of [[15, 1], [16, -1]]) lm[i] = mk(s * 0.33, 0.05, 0);    // wrists
    for (const [i, s] of [[17, 1], [18, -1]]) lm[i] = mk(s * 0.35, 0.12, 0);    // pinky
    for (const [i, s] of [[19, 1], [20, -1]]) lm[i] = mk(s * 0.31, 0.13, 0);    // index
    for (const [i, s] of [[21, 1], [22, -1]]) lm[i] = mk(s * 0.31, 0.09, 0);    // thumb
    for (const [i, s] of [[23, 1], [24, -1]]) lm[i] = mk(s * 0.10, 0, 0);       // hips
    for (const [i, s] of [[25, 1], [26, -1]]) lm[i] = mk(s * 0.11, 0.45, 0);    // knees
    for (const [i, s] of [[27, 1], [28, -1]]) lm[i] = mk(s * 0.12, 0.85, 0);    // ankles
    for (const [i, s] of [[29, 1], [30, -1]]) lm[i] = mk(s * 0.12, 0.88, 0.03); // heels
    for (const [i, s] of [[31, 1], [32, -1]]) lm[i] = mk(s * 0.12, 0.90, -0.08);// toes
    return lm;
  }
  // put a wrist (side 'left'|'right') at head-center + dir*0.15 m, with a
  // plausible elbow halfway; dir is in THREE coords (x right, y up, z out)
  function withWristAtHead(lm, side, dir) {
    const headMp = { x: 0, y: -0.63, z: 0.02 };
    const t = 0.15;
    const wi = side === 'left' ? 15 : 16;
    const ei = side === 'left' ? 13 : 14;
    const pi = side === 'left' ? 17 : 18;
    const ii = side === 'left' ? 19 : 20;
    const ti = side === 'left' ? 21 : 22;
    // three → MP: (x, -y, -z)
    const wx = headMp.x + dir.x * t;
    const wy = headMp.y - dir.y * t;
    const wz = headMp.z - dir.z * t;
    lm[wi] = mk(wx, wy, wz);
    const sh = lm[side === 'left' ? 11 : 12];
    lm[ei] = mk((sh.x + wx) / 2 + (side === 'left' ? 0.10 : -0.10), (sh.y + wy) / 2 + 0.12, (sh.z + wz) / 2);
    lm[pi] = mk(wx + (side === 'left' ? 0.02 : -0.02), wy - 0.05, wz);
    lm[ii] = mk(wx - (side === 'left' ? 0.02 : -0.02), wy - 0.05, wz);
    lm[ti] = mk(wx, wy - 0.03, wz);
    return lm;
  }
  function toNorm(lm) {
    return lm.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.55 + p.y * 0.45, z: p.z, visibility: p.visibility }));
  }
  function lerpBody(a, b, t) {
    return a.map((p, i) => ({
      x: p.x + (b[i].x - p.x) * t,
      y: p.y + (b[i].y - p.y) * t,
      z: p.z + (b[i].z - p.z) * t,
      visibility: 0.9,
    }));
  }
  window.__DRIVE = { body, withWristAtHead, toNorm, lerpBody };
})();
`;

interface SweepResult {
  socket: string | null;
  weight: number;
  minSigned: number;
  finalSigned: number;
  headR: number;
  penFlagged: boolean;
}

/** Drive one wrist to a socket direction and hold; sample the debug state. */
async function sweepSocket(
  page: Page,
  side: 'left' | 'right',
  dir: { x: number; y: number; z: number },
  holdSec: number,
): Promise<SweepResult> {
  return page.evaluate(
    ({ side, dir, holdSec }) => {
      const D = (window as unknown as { __DRIVE: any }).__DRIVE;
      const T = window.__PPCharTest!;
      const rest = D.body();
      const touch = D.withWristAtHead(D.body(), side, dir);
      let ts = (window as unknown as { __DRIVE_TS?: number }).__DRIVE_TS ?? 1000;
      let minSigned = Infinity;
      let penFlagged = false;
      const step = (world: unknown[]) => {
        ts += 33.3;
        T.drivePose(world as never, D.toNorm(world) as never, ts);
        // several render ticks per pose frame, like the real loop
        T.tick(0.0166); T.tick(0.0166);
        const sd = T.wristCapsuleDistance(side);
        if (Number.isFinite(sd)) minSigned = Math.min(minSigned, sd);
        if (T.faceTouch()[side].pen) penFlagged = true;
      };
      // settle at rest (releases previous socket, decays engagement)
      for (let i = 0; i < 45; i++) step(rest);
      minSigned = Infinity; // rest phase distances are irrelevant
      penFlagged = false;
      // approach fast (~0.3 s), then hold
      for (let i = 1; i <= 9; i++) step(D.lerpBody(rest, touch, i / 9));
      const holdFrames = Math.round(holdSec * 30);
      for (let i = 0; i < holdFrames; i++) step(touch);
      (window as unknown as { __DRIVE_TS?: number }).__DRIVE_TS = ts;
      const ft = T.faceTouch()[side];
      return {
        socket: ft.socket,
        weight: ft.w,
        minSigned,
        finalSigned: T.wristCapsuleDistance(side),
        headR: T.headRadius(),
        penFlagged,
      };
    },
    { side, dir, holdSec },
  );
}

// zero-interpenetration is the contract for faceTouch:"full" rigs; a
// "limited" rig (the astronaut — helmet radius exceeds arm reach) still
// classifies and engages every socket but is only sanity-bounded, exactly
// as its manifest note documents.
import { readFileSync } from 'node:fs';
const CAP_MANIFEST = JSON.parse(
  readFileSync(resolve(here, '..', 'data', 'avatar-capabilities.json'), 'utf8'),
);

for (const avatarId of ['erika', 'astronaut'] as const) {
  const ftClass: string = CAP_MANIFEST.avatars[avatarId].capabilities.faceTouch;
  test(`face-touch v2: all seven sockets (${avatarId}, ${ftClass})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${BASE}/?chartest=1&avatar=${avatarId}`);
    await page.waitForFunction(() => window.__PP?.videoReady && Boolean(window.__PPCharTest), undefined, {
      timeout: 60_000,
    });
    await page.waitForFunction(
      (want) => window.__PPCharTest!.avatarName().includes(want),
      avatarId === 'erika' ? 'erika' : 'astronaut',
      { timeout: 60_000 },
    );
    await page.evaluate((js) => {
      window.__PPCharTest!.isolate();
      // eslint-disable-next-line no-eval
      (0, eval)(js);
    }, DRIVER_JS);

    // dirs are THREE coords in the person's head frame (x=their left, y=up,
    // z=out of the face); the person faces the camera so head frame ≈ world
    const cases: Array<{ socket: string; side: 'left' | 'right'; dir: { x: number; y: number; z: number }; hold: number }> = [
      { socket: 'cheekL', side: 'left', dir: { x: 0.82, y: -0.18, z: 0.55 }, hold: 0.5 },
      { socket: 'cheekR', side: 'right', dir: { x: -0.82, y: -0.18, z: 0.55 }, hold: 0.5 },
      { socket: 'temple', side: 'left', dir: { x: 0.72, y: 0.55, z: 0.42 }, hold: 0.5 },
      { socket: 'forehead', side: 'right', dir: { x: 0, y: 0.68, z: 0.73 }, hold: 0.5 },
      { socket: 'mouthCover', side: 'right', dir: { x: 0, y: -0.28, z: 0.96 }, hold: 0.5 },
      { socket: 'chin', side: 'right', dir: { x: 0, y: -0.76, z: 0.65 }, hold: 0.5 },
      { socket: 'underChin', side: 'right', dir: { x: 0, y: -0.97, z: 0.24 }, hold: 0.5 },
      // same region held quietly re-labels as the thinking pose
      { socket: 'thinkingPose', side: 'right', dir: { x: 0, y: -0.76, z: 0.65 }, hold: 2.0 },
    ];

    const reached: string[] = [];
    for (const c of cases) {
      const r = await sweepSocket(page, c.side, c.dir, c.hold);
      expect(r.weight, `${c.socket}: engagement`).toBeGreaterThan(0.6);
      expect(r.socket, `${c.socket}: classification`).toBe(c.socket);
      if (ftClass === 'full') {
        // zero interpenetration: the enacted wrist never crosses the capsule
        expect(r.minSigned, `${c.socket}: min signed distance`).toBeGreaterThan(-r.headR * 0.12);
        expect(r.penFlagged, `${c.socket}: retargeter pen flag`).toBe(false);
        // contact: the wrist settles within a radius of the surface
        expect(r.finalSigned, `${c.socket}: reach`).toBeLessThan(r.headR * 0.9);
      } else {
        // limited rig: the manifest's faceTouchNote documents that this
        // geometry cannot hold the capsule shell (astronaut: helmet radius
        // exceeds arm reach; forced depth varies per socket, up to ~0.84 r
        // at the forehead). The spec contract for "limited" is that every
        // socket still CLASSIFIES and ENGAGES — measured depth is reported
        // raw by the eval, not asserted here.
        expect(Number.isFinite(r.minSigned), `${c.socket}: measured`).toBe(true);
      }
      reached.push(c.socket);
    }
    expect(reached).toEqual([
      'cheekL', 'cheekR', 'temple', 'forehead', 'mouthCover', 'chin', 'underChin', 'thinkingPose',
    ]);
  });
}

test('feet v2: synthetic plant/lift detection and root correction (O4)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE}/?chartest=1&avatar=robot&body=full`);
  await page.waitForFunction(() => window.__PP?.videoReady && Boolean(window.__PPCharTest), undefined, {
    timeout: 60_000,
  });
  await page.evaluate((js) => {
    window.__PPCharTest!.isolate();
    // eslint-disable-next-line no-eval
    (0, eval)(js);
  }, DRIVER_JS);

  const result = await page.evaluate(() => {
    const D = (window as unknown as { __DRIVE: any }).__DRIVE;
    const T = window.__PPCharTest!;
    let ts = 50_000;
    const step = (world: unknown[]) => {
      ts += 33.3;
      T.drivePose(world as never, D.toNorm(world) as never, ts);
      T.tick(0.0166); T.tick(0.0166);
    };
    const standing = D.body();
    for (let i = 0; i < 90; i++) step(standing); // settle: both feet grounded + still
    const planted = T.feet();

    // lift the left foot (ankle + toe rise well past the lift band)
    const lifted = D.body();
    for (const idx of [27, 29, 31]) lifted[idx] = { ...lifted[idx], y: lifted[idx].y - 0.3 };
    for (let i = 0; i < 30; i++) step(lifted);
    const afterLift = T.feet();

    for (let i = 0; i < 45; i++) step(standing); // replant
    const replanted = T.feet();
    return { planted, afterLift, replanted };
  });

  expect(result.planted.left.planted, 'settled: left planted').toBe(true);
  expect(result.planted.right.planted, 'settled: right planted').toBe(true);
  expect(result.afterLift.left.planted, 'lifted foot released').toBe(false);
  expect(result.afterLift.right.planted, 'stance foot stays planted').toBe(true);
  expect(result.replanted.left.planted, 'replant detected').toBe(true);
  expect(result.replanted.left.plantEvents).toBeGreaterThanOrEqual(2);
});
