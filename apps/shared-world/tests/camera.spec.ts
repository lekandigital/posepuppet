import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checkpoint 02 — pool camera (Track E rig). Automated verification per
 * CHECKPOINT_02_POOL_CAMERA.md §8:
 *  1. coverage bands (Track D §13) at cruise; state-relaxed at burst/hover
 *  2. step-turn: 90° yaw step at cruise — monotonic aim-error decay,
 *     t90 within 0.15–0.40 s, dolphin never leaves frame
 *  3. stop test: burst → brake — no positional overshoot > 0.5 m,
 *     settle within 1.2 s
 *  4. wall test: corner push — camera ≥ 0.6 m from every wall plane,
 *     LOS never lost > 0.3 s, Obstructed observed
 *  5. waterline: porpoise script across y 0 — continuous camera path
 *     (no frame step > 1.2 m), anti-shimmer hold engages, Airborne /
 *     SurfaceTransition / ReEntryRecovery observed; doubles as the §10
 *     perf script (two+ waterline crossings): simHz > 100, median fps ≥ 58
 *  6. fidelity shots (c) half-submerged and (d) Snell window, pool vs
 *     stock at matched transforms (the shots.mjs screenshot-driver
 *     pattern, re-pointed into this spec) — both nonzero PNGs
 *  7. replay determinism unchanged — digest identical to cp01's committed
 *     value (camera is presentation)
 *  8. R recenter binding eases the camera behind facing
 *
 * Screenshots land in media/shared-world-cp02/ (gitignored, like all
 * media/); measurements land in eval/shared-world-results.json under
 * `camera02` (committed-artifact convention).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');
const MEDIA_DIR = join(REPO_ROOT, 'media', 'shared-world-cp02');

/** cp01's committed replay digest (first 64 chars) — read before any spec
 *  in this run rewrites the artifact (this file sorts before pool.spec). */
const CP01_DIGEST = (
  JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as {
    pool: { replayDigest: string };
  }
).pool.replayDigest;

const results: Record<string, unknown> = {};

test.afterAll(async () => {
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  const existing = existsSync(RESULTS_PATH)
    ? (JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as Record<string, unknown>)
    : {};
  writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        ...existing,
        camera02: { ...(existing.camera02 as object | undefined), ...results },
      },
      null,
      2,
    ) + '\n',
  );
});

type Pg = import('@playwright/test').Page;

async function boot(page: Pg, qs = ''): Promise<void> {
  await page.goto(`/shared-world/${qs}`);
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && h.state().inWater === true;
    },
    undefined,
    { timeout: 30_000 },
  );
}

const state = (page: Pg) => page.evaluate(() => (window as any).__SHARED_WORLD.state());
const camera = (page: Pg) => page.evaluate(() => (window as any).__SHARED_WORLD.camera());
const coverage = (page: Pg) => page.evaluate(() => (window as any).__SHARED_WORLD.coverage());
const testHook = (page: Pg, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);

/** rAF synthetic BodySignal pump (the dolphin-suite pattern). */
async function startSwimPump(page: Pg): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__swim = { rateHz: 0, amp: 1, leanX: 0, leanY: 0, count: 0, nextAt: 0 };
    const emit = () => {
      requestAnimationFrame(emit);
      const r = w.__swim;
      const now = performance.now();
      if (r.rateHz > 0) {
        if (r.nextAt === 0) r.nextAt = now + 1000 / r.rateHz;
        if (now >= r.nextAt) {
          r.count++;
          r.nextAt += 1000 / r.rateHz;
        }
      } else {
        r.nextAt = 0;
      }
      window.postMessage(
        {
          t: 'bodyarcade.body-input.v1',
          signal: {
            v: 1, ts: now, confidence: 1, seated: false, stillness: 0.2, neutralConfidence: 1,
            axes: {
              leanX: r.leanX, leanY: r.leanY, crouch: 0, tallness: 0,
              armsOut: 0, armsRaised: 0, handsForward: 0, handPoint: 0,
            },
            events: [],
            swim: { active: r.rateHz > 0, count: r.count, rate: r.rateHz, phase: 0.5, amp: r.amp },
          },
        },
        '*',
      );
    };
    requestAnimationFrame(emit);
  });
}

const setSwim = (page: Pg, patch: Record<string, unknown>) =>
  page.evaluate((p) => Object.assign((window as any).__swim, p), patch);

test.describe('checkpoint 02 — pool camera', () => {
  test('1. coverage bands: cruise NormalFollow width 8–18 % / height 40–60 %; FastTravel at burst; SlowHover eases in', async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, '?assist=standard');
    await startSwimPump(page);
    await setSwim(page, { rateHz: 1.6 });
    await page.waitForTimeout(4000); // reach cruise

    // cruise: repeated straight-line passes down the +X runway; only
    // NormalFollow samples count against the bands (band law, cp02 §8.1)
    const cruise: { w: number; h: number; d: number }[] = [];
    const statesSeen = new Set<string>();
    for (let pass = 0; pass < 4; pass++) {
      await testHook(page, 'teleport(-1.5, 0, -3.5)');
      await testHook(page, 'setYaw(Math.PI/2)');
      await page.waitForTimeout(1000); // teleport recovery (EmergencyRecenter)
      const t0 = Date.now();
      while (Date.now() - t0 < 1100) {
        const c = await camera(page);
        statesSeen.add(c.state);
        if (c.state === 'NormalFollow' && c.stateTimeS > 0.3) {
          const cov = await coverage(page);
          cruise.push({ w: cov.widthFrac, h: cov.centerHeightFrac, d: c.followDistM });
        }
        await page.waitForTimeout(100);
      }
    }
    expect(cruise.length, 'need ≥ 3 s of NormalFollow cruise samples').toBeGreaterThanOrEqual(30);
    for (const s of cruise) {
      expect(s.w).toBeGreaterThanOrEqual(0.08);
      expect(s.w).toBeLessThanOrEqual(0.18);
      expect(s.h).toBeGreaterThanOrEqual(0.4);
      expect(s.h).toBeLessThanOrEqual(0.6);
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
    results.cruiseCoverage = {
      samples: cruise.length,
      widthFrac: { median: med(cruise.map((s) => s.w)), min: Math.min(...cruise.map((s) => s.w)), max: Math.max(...cruise.map((s) => s.w)) },
      centerHeightFrac: { median: med(cruise.map((s) => s.h)), min: Math.min(...cruise.map((s) => s.h)), max: Math.max(...cruise.map((s) => s.h)) },
      followDistM: med(cruise.map((s) => s.d)),
    };

    // burst: bands relax in non-NormalFollow states — assert the state
    await setSwim(page, { rateHz: 0 });
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(2000);
    const burst: { w: number; state: string; d: number }[] = [];
    for (let pass = 0; pass < 3; pass++) {
      await testHook(page, 'teleport(-4, 0, -3.5)');
      await testHook(page, 'setYaw(Math.PI/2)');
      await page.waitForTimeout(700);
      const t0 = Date.now();
      while (Date.now() - t0 < 700) {
        const [c, s] = [await camera(page), await state(page)];
        if (s.speed > 5.5) {
          const cov = await coverage(page);
          burst.push({ w: cov.widthFrac, state: c.state, d: c.followDistM });
        }
        await page.waitForTimeout(100);
      }
    }
    await testHook(page, 'setIntent(null)');
    expect(burst.length).toBeGreaterThanOrEqual(10);
    for (const s of burst) expect(s.state).toBe('FastTravel');
    results.burstCoverage = {
      samples: burst.length,
      state: 'FastTravel (bands relaxed per cp02 §8.1)',
      widthFrac: { median: med(burst.map((s) => s.w)) },
      followDistM: med(burst.map((s) => s.d)),
    };

    // hover: SlowHover state asserted; distance eases toward the intimate
    // hover offset (flagged review item — measured value recorded)
    await testHook(page, 'teleport(0, 0, -3.5)');
    await testHook(page, 'setIntent({ brake: true })');
    await page.waitForTimeout(3000);
    const hover: { state: string; d: number; w: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const c = await camera(page);
      const cov = await coverage(page);
      hover.push({ state: c.state, d: c.followDistM, w: cov.widthFrac });
      await page.waitForTimeout(100);
    }
    await testHook(page, 'setIntent(null)');
    for (const s of hover) expect(s.state).toBe('SlowHover');
    const hoverFinal = hover[hover.length - 1]!;
    expect(hoverFinal.d).toBeLessThan(4.6); // eased in from the cruise offset
    results.hoverCoverage = {
      state: 'SlowHover (bands relaxed per cp02 §8.1)',
      followDistM: hoverFinal.d,
      widthFrac: { median: med(hover.map((s) => s.w)) },
    };
    results.bandStatesSeen = [...statesSeen];
  });

  test('2. step-turn: 90° yaw step at cruise — monotonic azimuth-error decay, t90 in 0.15–0.40 s, dolphin stays in frame', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, '?assist=standard');
    await startSwimPump(page);
    await setSwim(page, { rateHz: 1.6 });
    await page.waitForTimeout(4000);
    // runway: settle behind the dolphin heading +X, then step 90° to −Z —
    // chosen so the post-step desired camera point (≈ 6.3 m behind at
    // cruise) stays inside the pool for the whole trace
    await testHook(page, 'teleport(-4, 0, -3.5)');
    await testHook(page, 'setYaw(Math.PI/2)');
    await page.waitForTimeout(1200);

    // command the 90° step and trace the camera azimuth error each ~50 ms
    await testHook(page, 'setYaw(Math.PI)'); // (sin π, cos π) = (0, −1) → heading −Z
    const trace: { t: number; az: number; inFrame: boolean }[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 1600) {
      const c = await camera(page);
      const cov = await coverage(page);
      const inFrame =
        !cov.behindCamera &&
        cov.centerXFrac > 0 && cov.centerXFrac < 1 &&
        cov.centerHeightFrac > 0 && cov.centerHeightFrac < 1;
      trace.push({ t: Date.now() - t0, az: c.azimuthErrorRad, inFrame });
      await page.waitForTimeout(50);
    }
    for (const s of trace) expect(s.inFrame, `dolphin left frame at t=${s.t}`).toBe(true);

    // peak within the first 300 ms, then monotonic decay (small jitter allowed)
    const peakIdx = trace.reduce((bi, s, i) => (s.az > trace[bi]!.az ? i : bi), 0);
    const peak = trace[peakIdx]!;
    expect(peak.az).toBeGreaterThan(0.6); // a real ~90° step registered
    expect(peak.t).toBeLessThan(300);
    let prev = peak.az;
    for (const s of trace.slice(peakIdx + 1)) {
      expect(s.az).toBeLessThanOrEqual(prev + 0.05);
      prev = Math.min(prev, s.az);
    }
    // t90: time from the step to the error dropping to ≤ 10 % of peak
    const t90row = trace.slice(peakIdx).find((s) => s.az <= peak.az * 0.1);
    expect(t90row, 'azimuth error never reached 10 % of peak').toBeTruthy();
    const t90 = (t90row!.t - trace[Math.max(0, peakIdx - 1)]!.t) / 1000;
    expect(t90).toBeGreaterThanOrEqual(0.15);
    expect(t90).toBeLessThanOrEqual(0.4);
    results.stepTurn = { peakAzimuthErrorRad: peak.az, t90S: t90 };
  });

  test('3. stop test: burst → brake — no positional overshoot > 0.5 m, settled within 1.2 s of the stop', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await testHook(page, "setAssist('expert')");
    await testHook(page, 'teleport(-5, 0, -3.5)');
    await testHook(page, 'setYaw(Math.PI/2)');
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(1500);
    await testHook(page, 'setIntent({ brake: true })');

    const rows: { t: number; d: number }[] = [];
    let stopAt: number | null = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      const [c, s] = [await camera(page), await state(page)];
      if (stopAt === null && s.speed < 0.75) stopAt = Date.now() - t0;
      rows.push({ t: Date.now() - t0, d: c.followDistM });
      await page.waitForTimeout(100);
    }
    await testHook(page, 'setIntent(null)');
    expect(stopAt, 'the brake must actually stop the dolphin').not.toBeNull();
    const finalD = rows[rows.length - 1]!.d;
    const afterStop = rows.filter((r) => r.t > stopAt!);
    const minD = Math.min(...afterStop.map((r) => r.d));
    // critically damped: the camera never dips past its resting distance
    expect(minD).toBeGreaterThanOrEqual(finalD - 0.5);
    // settle: within 0.6 m of the resting distance by stop + 1.2 s
    const settleRow = afterStop.find((r) => r.t >= stopAt! + 1200);
    expect(settleRow).toBeTruthy();
    expect(Math.abs(settleRow!.d - finalD)).toBeLessThanOrEqual(0.6);
    results.stopTest = {
      dolphinStoppedAtMs: stopAt,
      finalFollowDistM: finalD,
      minFollowDistAfterStopM: minD,
      distErrorAtStopPlus1200msM: Math.abs(settleRow!.d - finalD),
    };
  });

  test('4. wall test: corner push — camera ≥ 0.6 m from every wall plane, LOS never lost > 0.3 s, Obstructed observed', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await testHook(page, 'teleport(0, 0, -3.5)');
    await testHook(page, 'setYaw(Math.PI/4)'); // toward the +X/+Z corner
    await testHook(page, 'setIntent({ burst: true })');
    const seen = new Set<string>();
    let minWallClear = Infinity;
    let maxLos = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const c = await camera(page);
      seen.add(c.state);
      const clear = Math.min(7.5 - Math.abs(c.x), 7.5 - Math.abs(c.z), c.y - -7.5);
      minWallClear = Math.min(minWallClear, clear);
      maxLos = Math.max(maxLos, c.losBlockedS);
      await page.waitForTimeout(100);
    }
    await testHook(page, 'setIntent(null)');
    expect(minWallClear).toBeGreaterThanOrEqual(0.6);
    expect(maxLos).toBeLessThanOrEqual(0.3);
    expect([...seen]).toContain('Obstructed');
    results.wallTest = { minWallClearanceM: minWallClear, maxLosBlockedS: maxLos, statesSeen: [...seen] };
  });

  test('5. waterline + performance: porpoise across y 0 — continuous camera path, anti-shimmer engages, fps/simHz floors', async ({ page, browser }) => {
    test.setTimeout(180_000);
    await boot(page);
    // per-frame camera-path sampler + fps buckets (in-page, rAF)
    await page.evaluate(() => {
      const w = window as any;
      w.__camTrace = { maxStep: 0, prev: null as null | { x: number; y: number; z: number }, fpsBuckets: [] as number[], simHz: [] as number[], states: {} as Record<string, number>, frames: 0, lastBucket: performance.now() };
      const tick = () => {
        requestAnimationFrame(tick);
        const t = w.__camTrace;
        const c = w.__SHARED_WORLD.camera();
        if (t.prev) {
          const step = Math.hypot(c.x - t.prev.x, c.y - t.prev.y, c.z - t.prev.z);
          if (step > t.maxStep) t.maxStep = step;
        }
        t.prev = { x: c.x, y: c.y, z: c.z };
        t.states[c.state] = (t.states[c.state] ?? 0) + 1;
        t.frames++;
        const now = performance.now();
        if (now - t.lastBucket >= 1000) {
          t.fpsBuckets.push(t.frames);
          t.frames = 0;
          t.lastBucket = now;
          t.simHz.push(w.__SHARED_WORLD.state().simHz);
        }
      };
      requestAnimationFrame(tick);
    });

    // scripted porpoising: cruise-cadence kicks + sustained nose-up →
    // repeated breach hops across y 0. Cruise speed (not burst) bounds each
    // hop to ~3 m of horizontal travel, and the heading flips after every
    // splash, so the cycle stays around the pool centre. (Burst porpoising
    // can carry the dolphin over the pool rim — a discovered cp01 sim
    // defect recorded in the checkpoint report, out of cp02 scope.)
    await startSwimPump(page);
    await setSwim(page, { rateHz: 1.6 });
    await testHook(page, "setAssist('standard')");
    await testHook(page, 'teleport(0, 0, -4.5)');
    await testHook(page, 'setYaw(Math.PI/2)');
    await testHook(page, 'setIntent({ pitch: -1 })');
    let lastSplashes = 0;
    let dir = 1;
    const t0 = Date.now();
    while (Date.now() - t0 < 16_000) {
      const s = await state(page);
      if (s.splashes > lastSplashes) {
        lastSplashes = s.splashes;
        dir = -dir;
        await testHook(page, `setYaw(${dir > 0 ? 'Math.PI/2' : '-Math.PI/2'})`);
      }
      await page.waitForTimeout(150);
    }
    await testHook(page, 'setIntent(null)');
    await setSwim(page, { rateHz: 0 });

    const s = await state(page);
    const c = await camera(page);
    const trace = await page.evaluate(() => {
      const t = (window as any).__camTrace;
      return { maxStep: t.maxStep, fpsBuckets: t.fpsBuckets, simHz: t.simHz, states: t.states };
    });
    expect(s.splashes, 'need ≥ 2 breach re-entries (≥ 4 waterline crossings)').toBeGreaterThanOrEqual(2);
    expect(trace.maxStep, 'camera path must stay continuous').toBeLessThanOrEqual(1.2);
    expect(c.surfaceCrossings).toBeGreaterThanOrEqual(2);
    expect(c.antiShimmerEngagements, 'the anti-shimmer hold must engage').toBeGreaterThanOrEqual(1);
    const stateNames = Object.keys(trace.states);
    expect(stateNames).toContain('Airborne');
    expect(stateNames).toContain('SurfaceTransition');
    expect(stateNames).toContain('ReEntryRecovery');

    // §10 performance: the scripted swim including the waterline crossings
    const buckets = trace.fpsBuckets.slice(1, 11) as number[]; // 10 full seconds
    const sorted = [...buckets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    for (const hz of trace.simHz as number[]) expect(hz).toBeGreaterThan(100);
    expect(median, `median fps ${median} (buckets ${buckets.join(',')})`).toBeGreaterThanOrEqual(58);
    const mem = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
    results.waterline = {
      breachReEntries: s.splashes,
      cameraSurfaceCrossings: c.surfaceCrossings,
      antiShimmerEngagements: c.antiShimmerEngagements,
      maxFrameStepM: trace.maxStep,
      statesSeen: trace.states,
    };
    results.perf = {
      script: 'porpoise 16 s (cruise cadence + nose-up breach cycles, ≥ 2 waterline crossing pairs)',
      fps: { buckets, median, min: sorted[0], windowSeconds: buckets.length },
      simHzSamples: trace.simHz,
      cameraUpdateUsAvg: c.updateUsAvg,
      viewport: { width: 1728, height: 1080 },
      chromeVersion: browser.version(),
      usedJSHeapBytes: mem,
    };
  });

  test('6. fidelity shots (c) half-submerged and (d) Snell window: pool vs stock at matched transforms', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    const K = 7.5;

    // --- stock orbit-pose math (mirrors vendored CameraController.apply) ---
    const pose = (axDeg: number, ayDeg: number, dist: number) => {
      const ax = (axDeg * Math.PI) / 180;
      const ay = (ayDeg * Math.PI) / 180;
      let v: [number, number, number] = [0, 0, dist];
      v = [v[0], v[1] * Math.cos(ax) - v[2] * Math.sin(ax), v[1] * Math.sin(ax) + v[2] * Math.cos(ax)];
      v = [v[0] * Math.cos(ay) + v[2] * Math.sin(ay), v[1], -v[0] * Math.sin(ay) + v[2] * Math.cos(ay)];
      return { eye: [v[0], -0.5 + v[1], v[2]] as const, target: [0, -0.5, 0] as const };
    };
    // pick-ray test replicating InteractionController.startDrag: a canvas
    // point orbits (rather than adding drops) iff its y=0-plane hit falls
    // outside the pool footprint |x|,|z| < 1
    const orbits = (p: ReturnType<typeof pose>, w: number, h: number, px: number, py: number) => {
      const sub = (a: readonly number[], b: readonly number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
      const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
      const norm = (a: number[]) => { const l = Math.hypot(a[0]!, a[1]!, a[2]!); return [a[0]! / l, a[1]! / l, a[2]! / l]; };
      const f = norm(sub(p.target, p.eye));
      const r = norm(cross(f, [0, 1, 0]));
      const u = cross(r, f);
      const tanV = Math.tan((45 / 2) * (Math.PI / 180));
      const a = w / h;
      const nx = (px / w) * 2 - 1;
      const ny = -((py / h) * 2 - 1);
      const d = norm([
        r[0]! * nx * tanV * a + u[0]! * ny * tanV + f[0]!,
        r[1]! * nx * tanV * a + u[1]! * ny * tanV + f[1]!,
        r[2]! * nx * tanV * a + u[2]! * ny * tanV + f[2]!,
      ]);
      if (Math.abs(d[1]!) < 1e-9) return true;
      const t = -p.eye[1]! / d[1]!;
      const hit = [p.eye[0]! + d[0]! * t, 0, p.eye[2]! + d[2]! * t];
      return !(Math.abs(hit[0]!) < 1 && Math.abs(hit[2]!) < 1);
    };
    // candidates avoid the lil-gui panel (top-left overlay) and leave room
    // for upward drags; each must also actually hit the canvas element
    const findOrbitPoint = async (p: ReturnType<typeof pose>, w: number, h: number) => {
      const candidates: [number, number][] = [
        [w - 40, 150], [w - 40, 40], [w / 2, 130], [w - 200, 150],
        [w - 40, h / 2], [w / 2, h - 30],
      ];
      const valid = candidates.filter(([x, y]) => orbits(p, w, h, x, y));
      const rect = (await page.locator('#app canvas').boundingBox())!;
      for (const [x, y] of valid) {
        const onCanvas = await page.evaluate(
          ([px, py]) => document.elementFromPoint(px!, py!)?.tagName === 'CANVAS',
          [rect.x + x, rect.y + y],
        );
        if (onCanvas) return [x, y] as const;
      }
      throw new Error('no orbit-safe canvas point found');
    };

    interface ShotDef {
      name: string;
      angleXDeg: number; // integer-degree orbit target (1 px = 1°)
      wheelDelta: number;
    }
    // (c) half-submerged: the vendored orbit camera always looks AT the
    //     sunken target, so an in-pool eye exactly at y 0 is pitched ~25°
    //     down and the classic split-frame waterline cannot appear in
    //     stock (and eye heights inside the ambient-ripple amplitude
    //     render nondeterministically). The crossing is instead captured
    //     as a matched pair at y ±0.35 m — the rig's own anti-shimmer
    //     hold offset, i.e. the exact eye heights the camera occupies on
    //     each side of a live crossing (deviation noted in the report).
    // (d) Snell window: orbit to +70° (camera under the target looking up),
    //     zoom inside the water — Snell cone fills the frame, TIR at edges
    // (c) poses pitch to −35° so the eye sits INSIDE the pool footprint
    // (at −25° the ±0.35 m orbit heights land just outside the rim — an
    // edge configuration that reads differently in the two pipelines)
    const shots: ShotDef[] = [
      { name: 'c-above-lip', angleXDeg: -35, wheelDelta: -1434 }, // eye y ≈ +0.0465 (+0.35 m)
      { name: 'c-below-lip', angleXDeg: -35, wheelDelta: -1622 }, // eye y ≈ −0.0468 (−0.35 m)
      { name: 'd-snell-window', angleXDeg: 70, wheelDelta: -2079 },
    ];

    const captured: Record<string, unknown> = {};
    for (const def of shots) {
      // ---- stock capture ----
      await page.goto('/shared-world/?view=stock');
      await page.waitForSelector('#loading', { state: 'hidden', timeout: 30_000 });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        // active object → None (the pool view has no demo obstacle either)
        const sel = [...document.querySelectorAll('select')].find((el) =>
          [...(el as HTMLSelectElement).options].some((o) => o.value === 'None'),
        ) as HTMLSelectElement | undefined;
        if (!sel) throw new Error('object selector not found');
        sel.value = 'None';
        sel.dispatchEvent(new Event('change'));
      });
      await page.waitForTimeout(300);
      // hide the GUI overlay for clean captures (page styling only)
      await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
      const rect = (await page.locator('#app canvas').boundingBox())!;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      const deltaY = -25 - def.angleXDeg; // orbitTo: angleX -= deltaPx
      if (deltaY !== 0) {
        const p0 = pose(-25, -200.5, 4);
        const [sx, sy] = await findOrbitPoint(p0, w, h);
        await page.mouse.move(rect.x + sx, rect.y + sy);
        await page.mouse.down();
        await page.mouse.move(rect.x + sx, rect.y + sy + deltaY, { steps: 25 });
        await page.waitForTimeout(1500); // inertia decays before release
        await page.mouse.up();
        // settle-click at an orbit-safe point of the NEW pose: kills any
        // residual angular velocity (beginOrbit zeroes it), no movement
        const p1 = pose(def.angleXDeg, -200.5, 4);
        const [cx, cy] = await findOrbitPoint(p1, w, h);
        await page.mouse.move(rect.x + cx, rect.y + cy);
        await page.mouse.down();
        await page.waitForTimeout(60);
        await page.mouse.up();
      }
      await page.mouse.move(rect.x + w / 2, rect.y + 20);
      await page.mouse.wheel(0, def.wheelDelta);
      // let the seeded ripples damp so both captures compare near-calm water
      await page.waitForTimeout(9000);

      const dist = Math.max(0.5, 4 * Math.exp(def.wheelDelta * 0.001));
      const p = pose(def.angleXDeg, -200.5, dist);
      await page.locator('#app canvas').screenshot({ path: join(MEDIA_DIR, `stock-${def.name}.png`) });

      // ---- pool capture at the matched transform (×K, fov 45, same size) ----
      await boot(page, '?hud=0');
      await page.addStyleTag({ content: '#pool-overlay { display: none !important; }' });
      await testHook(page, 'setIntent({ brake: true })');
      await page.waitForTimeout(1200);
      await testHook(page, 'setIntent(null)');
      await testHook(page, 'teleport(5, -6, -6)'); // park out of frame
      await testHook(
        page,
        `shotMode({ pos: [${p.eye[0]! * K}, ${p.eye[1]! * K}, ${p.eye[2]! * K}], ` +
          `look: [0, ${-0.5 * K}, 0], fov: 45, size: [${w}, ${h}] })`,
      );
      // sim frozen, displacement emitter off — let the dolphin's boot-time
      // slosh damp so the water state matches the near-calm stock capture
      await page.waitForTimeout(9000);
      await page.locator('#app canvas').screenshot({ path: join(MEDIA_DIR, `pool-${def.name}.png`) });
      await testHook(page, 'shotMode(null)');

      const stockSize = statSync(join(MEDIA_DIR, `stock-${def.name}.png`)).size;
      const poolSize = statSync(join(MEDIA_DIR, `pool-${def.name}.png`)).size;
      expect(stockSize).toBeGreaterThan(1000);
      expect(poolSize).toBeGreaterThan(1000);
      captured[def.name] = {
        eyeDemo: p.eye,
        eyeMetres: p.eye.map((v) => v * K),
        fov: 45,
        canvas: { w, h },
        stockBytes: stockSize,
        poolBytes: poolSize,
      };
    }
    results.fidelityShots = {
      dir: 'media/shared-world-cp02/',
      note: 'visual A/B is manual (cp02 §9); automated check = files exist and are nonzero',
      shots: captured,
    };
  });

  test('7. replay determinism unchanged: digest identical to cp01 committed value (camera is presentation)', async ({ page }) => {
    await boot(page);
    const script = JSON.stringify([
      { steps: 240, intent: { kicks: 1, kickAmp: 0.8 } },
      { steps: 480, intent: { pitch: 0.5, roll: 0.3 } },
      { steps: 480, intent: { burst: true } },
      { steps: 240, intent: { autopilot: true } },
    ]);
    const digest = (await testHook(page, `runScript(${script})`)) as string;
    expect(digest.slice(0, 64)).toBe(CP01_DIGEST);
    results.replayDigestVsCp01 = 'identical (first 64 chars compared against committed artifact)';
  });

  test('8. R recenter: the key eases the camera behind facing during a sustained turn', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await testHook(page, "setAssist('expert')");
    await startSwimPump(page);
    await setSwim(page, { rateHz: 1.6 });
    await testHook(page, 'teleport(0, 0, -3.5)');
    await testHook(page, 'setIntent({ roll: 0.65 })');
    await page.waitForTimeout(4000); // settle into the turning circle
    const before = await camera(page);
    await page.keyboard.press('r');
    const during = await camera(page);
    expect(during.recenterActiveS, 'R must arm the recenter window').toBeGreaterThan(0);
    await page.waitForTimeout(700);
    const after = await camera(page);
    await testHook(page, 'setIntent(null)');
    expect(after.azimuthErrorRad).toBeLessThanOrEqual(Math.max(0.15, before.azimuthErrorRad));
    results.recenter = {
      azimuthErrorBeforeRad: before.azimuthErrorRad,
      azimuthErrorAfterRad: after.azimuthErrorRad,
    };
  });
});
