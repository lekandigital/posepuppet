import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * BodyArcade Dolphin P2: body swimming drives the dolphin.
 *
 * Headed like the other game suites (headless WebGL is compositor-
 * throttled). Signals are injected via the postMessage envelope with a
 * synthetic `swim` block — deterministic kick/pitch/roll/burst/autopilot
 * tests — plus the containment battery (8-direction escape attempts
 * never exit the real-bay polygon and never hard-wall), the breach
 * trigger, and sim replay determinism. Key numbers land in
 * eval/dolphin-results.json.
 */

const DOLPHIN = `http://localhost:${process.env.DOLPHIN_PORT ?? '5197'}/dolphin/`;

const results: Record<string, unknown> = { generatedAt: new Date().toISOString() };

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ headless: false });
  page = await browser.newPage();
});
test.afterAll(async () => {
  mkdirSync(resolve(HERE, '../../../eval'), { recursive: true });
  writeFileSync(
    resolve(HERE, '../../../eval/dolphin-results.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
  await browser.close();
});

async function boot(qs = ''): Promise<void> {
  await page.goto(`${DOLPHIN}${qs}`);
  await page.waitForFunction(() => {
    const d = (window as any).__DOLPHIN;
    return !!d && d.state().inWater === true;
  }, undefined, { timeout: 30_000 });
}

const state = () => page.evaluate(() => (window as any).__DOLPHIN.state());

/** rAF synthetic BodySignal pump with a swim block (postMessage envelope —
 *  the same relay path PosePuppet uses). Kicks advance `count` on a
 *  schedule from rateHz; the game consumes count increments. */
async function startSwimPump(): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__swim = { rateHz: 0, amp: 0.6, leanX: 0, leanY: 0, crouch: 0, tallness: 0, handsForward: 0, count: 0, nextAt: 0, dead: false };
    const emit = () => {
      requestAnimationFrame(emit);
      const r = w.__swim;
      if (r.dead) return;
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
      const signal = {
        v: 1, ts: now, confidence: 1, seated: false, stillness: 0.2, neutralConfidence: 1,
        axes: {
          leanX: r.leanX, leanY: r.leanY, crouch: r.crouch, tallness: r.tallness,
          armsOut: 0, armsRaised: 0, handsForward: r.handsForward, handPoint: 0,
        },
        events: [],
        swim: { active: r.rateHz > 0, count: r.count, rate: r.rateHz, phase: 0.5, amp: r.amp },
      };
      window.postMessage({ t: 'bodyarcade.body-input.v1', signal }, '*');
    };
    requestAnimationFrame(emit);
  });
}

const setSwim = (patch: Record<string, unknown>) =>
  page.evaluate((p) => Object.assign((window as any).__swim, p), patch);
const testHook = (expr: string) => page.evaluate(`(window).__DOLPHIN.test.${expr}`);

test.describe('body swimming drives the dolphin', () => {
  test('boots in the bay: in water, minimap drawn, attribution shown', async () => {
    await boot();
    const s = await state();
    expect(s.inWater).toBe(true);
    expect(s.shoreDist).toBeGreaterThan(0);
    expect(s.depthHere).toBeGreaterThan(2);
    const attrib = await page.textContent('#hud-attrib');
    expect(attrib).toContain('OpenStreetMap');
    // minimap actually rendered pixels
    const painted = await page.evaluate(() => {
      const c = document.getElementById('minimap') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(500);
  });

  test('keyboard fallback: Shift kicks accelerate, W dives, D turns right', async () => {
    await boot();
    const s0 = await state();
    await page.keyboard.down('Shift');
    await page.waitForTimeout(3000);
    await page.keyboard.up('Shift');
    const s1 = await state();
    expect(s1.speed).toBeGreaterThan(s0.speed + 1);
    expect(s1.kickCount).toBeGreaterThanOrEqual(s0.kickCount + 3);
    // W = pitch down = deeper (y more negative)
    await page.keyboard.down('w');
    await page.waitForTimeout(2000);
    await page.keyboard.up('w');
    const s2 = await state();
    expect(s2.y).toBeLessThan(s1.y - 0.5);
    // D = bank right = yaw increases
    await page.keyboard.down('d');
    await page.waitForTimeout(1500);
    await page.keyboard.up('d');
    const s3 = await state();
    expect(s3.yaw).toBeGreaterThan(s2.yaw + 0.15);
  });

  test('impulse-and-glide: cadence sets settled speed; stopping glides, never stops dead', async () => {
    test.setTimeout(150_000);
    await boot();
    await startSwimPump();
    await page.waitForTimeout(2500); // keyboard-priority window from previous test is per-page anyway
    const settled: { rateHz: number; speed: number }[] = [];
    for (const rateHz of [0.4, 0.9]) {
      await setSwim({ rateHz });
      await page.waitForTimeout(14_000); // ~2τ settle
      const speeds: number[] = [];
      for (let i = 0; i < 12; i++) {
        speeds.push((await state()).speed);
        await page.waitForTimeout(400);
      }
      settled.push({ rateHz, speed: speeds.reduce((a, b) => a + b, 0) / speeds.length });
    }
    results.cadenceCoupling = settled;
    expect(settled[1].speed).toBeGreaterThan(settled[0].speed * 1.25); // faster rhythm = faster dolphin
    // glide: stop kicking — 3 s later still carrying real momentum
    await setSwim({ rateHz: 0 });
    await page.waitForTimeout(3000);
    const glide = await state();
    results.glideSpeedAfter3s = glide.speed;
    expect(glide.speed).toBeGreaterThan(settled[1].speed * 0.35);
  });

  test('lean pitch is signed: forward dives, back surfaces', async () => {
    await boot();
    await startSwimPump();
    await setSwim({ rateHz: 0.8, leanY: 0.7 });
    await page.waitForTimeout(4000);
    const deep = await state();
    expect(deep.y).toBeLessThan(-8);
    await setSwim({ leanY: -0.7 });
    await page.waitForTimeout(4500);
    const shallow = await state();
    expect(shallow.y).toBeGreaterThan(deep.y + 2);
  });

  test('lean roll is signed: banked turns follow the lean', async () => {
    await boot();
    await startSwimPump();
    await setSwim({ rateHz: 0.8 });
    await page.waitForTimeout(2500);
    const a = await state();
    await setSwim({ leanX: 0.6 });
    await page.waitForTimeout(2000);
    const b = await state();
    expect(b.yaw).toBeGreaterThan(a.yaw + 0.2);
    await setSwim({ leanX: -0.6 });
    await page.waitForTimeout(3000);
    const c = await state();
    expect(c.yaw).toBeLessThan(b.yaw - 0.2);
  });

  test('burst: hands forward sprints past cruise, with refractory', async () => {
    await boot();
    await startSwimPump();
    await setSwim({ rateHz: 0.9 });
    await page.waitForTimeout(6000);
    await setSwim({ handsForward: 0.9 });
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().speed > 17,
      undefined, { timeout: 6000 },
    );
    const burst = await state();
    results.burstPeakSpeed = burst.speed;
    expect(burst.speed).toBeGreaterThan(17);
  });

  test('containment: 8-direction escape attempts never exit the bay, never hard-wall', async () => {
    test.setTimeout(240_000);
    await boot();
    // self-locating: burst west from spawn until we are near a real shore
    await testHook('setIntent({ burst: true, kicks: 0 })');
    await testHook('setYaw(' + (-Math.PI / 2) + ')');
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().shoreDist < 130,
      undefined, { timeout: 60_000 },
    );
    await testHook('setIntent(null)');
    const base = await state();
    let minShore = Infinity;
    let minSpeed = Infinity;
    let maxDecel = 0;
    for (let k = 0; k < 8; k++) {
      const yaw = (k / 8) * Math.PI * 2;
      await testHook(`teleport(${base.x}, ${base.z}, -5)`);
      await testHook(`setYaw(${yaw})`);
      await testHook('setIntent({ burst: true })');
      let prevSpeed: number | null = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 11_000) {
        const s = await state();
        expect(s.inWater).toBe(true); // NEVER outside the polygon
        minShore = Math.min(minShore, s.shoreDist);
        if (Date.now() - t0 > 2500) {
          minSpeed = Math.min(minSpeed, s.speed);
          if (prevSpeed !== null) maxDecel = Math.max(maxDecel, prevSpeed - s.speed);
        }
        prevSpeed = s.speed;
        await page.waitForTimeout(200);
      }
    }
    await testHook('setIntent(null)');
    results.containment = { minShoreDist: minShore, minSpeedWhileBursting: minSpeed, maxDecelPer200ms: maxDecel };
    expect(minShore).toBeGreaterThan(-0.5); // soft field held (slide fallback tolerance)
    expect(minSpeed).toBeGreaterThan(1.2);  // redirected, not pinned
    expect(maxDecel).toBeLessThan(6);       // no wall-hit discontinuity
  });

  test('breach: speed + pitch-up at the surface leaps and splashes; low speed does not', async () => {
    test.setTimeout(120_000);
    await boot();
    await startSwimPump();
    // wind up: dive then sprint
    await setSwim({ rateHz: 1.0, leanY: 0.6, handsForward: 0.9 });
    await page.waitForTimeout(4000);
    await setSwim({ leanY: -0.9 });
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().breachCount >= 1,
      undefined, { timeout: 10_000 },
    );
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().splashes >= 1 && (window as any).__DOLPHIN.state().phase === 'swim',
      undefined, { timeout: 8_000 },
    );
    const b = await state();
    results.breach = { breaches: b.breachCount, splashes: b.splashes };
    // negative: FIRST bleed the re-entry momentum below breach speed
    // (a glide after a breach is legitimately breach-capable for ~2 s),
    // THEN hold the pitch-up — the surface spring must hold
    await setSwim({ rateHz: 0, handsForward: 0, leanY: 0 });
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().speed < 6,
      undefined, { timeout: 15_000 },
    );
    const calm = await state();
    await setSwim({ leanY: -0.9 });
    await page.waitForTimeout(6000);
    const after = await state();
    expect(after.breachCount).toBe(calm.breachCount);
    expect(after.phase).toBe('swim');
  });

  test('tracking loss: glide + level, no snap; smooth recovery; count never spikes', async () => {
    test.setTimeout(120_000);
    await boot();
    await startSwimPump();
    await setSwim({ rateHz: 0.8, leanY: 0.5, leanX: 0.4 });
    await page.waitForTimeout(5000);
    const before = await state();
    await setSwim({ dead: true });
    // pitch decays smoothly — sample the attitude every 100 ms
    let prev = before.pitch;
    let maxStep = 0;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(100);
      const s = await state();
      maxStep = Math.max(maxStep, Math.abs(s.pitch - prev));
      prev = s.pitch;
    }
    const lost = await state();
    results.dropout = { maxPitchStepRad: maxStep, trackingDuringLoss: lost.tracking };
    // "never snaps": a snap would be ~a full pitch swing (~1 rad) in one
    // sample; the smooth decay measures ~0.089 rad/100 ms peak (recorded
    // in results), so 0.12 asserts smoothness with real headroom instead
    // of riding a 0.7% margin
    expect(maxStep).toBeLessThan(0.12);
    expect(['none', 'stale', 'autopilot', 'low-confidence']).toContain(lost.tracking);
    expect(lost.speed).toBeGreaterThan(0.4); // gliding, not parked
    // recovery
    await setSwim({ dead: false, leanY: 0, leanX: 0 });
    await page.waitForFunction(
      () => (window as any).__DOLPHIN.state().tracking === 'live',
      undefined, { timeout: 5_000 },
    );
    const rec = await state();
    expect(rec.kickCount - lost.kickCount).toBeLessThanOrEqual(2); // no stacked-kick spike
  });

  test('replay determinism: identical scripts → identical trajectories, across reloads', async () => {
    await boot();
    const script = JSON.stringify([
      { steps: 240, intent: { kicks: 1, kickAmp: 0.8 } },
      { steps: 480, intent: { pitch: 0.5, roll: 0.3 } },
      { steps: 480, intent: { burst: true } },
      { steps: 240, intent: { autopilot: true } },
    ]);
    const a = await testHook(`runScript(${script})`);
    const b = await testHook(`runScript(${script})`);
    expect(a).toBe(b);
    await boot(); // fresh page — the sim must not depend on ambient state
    const c = await testHook(`runScript(${script})`);
    expect(c).toBe(a);
    results.replayDigest = String(a).slice(0, 64);
  });

  test('performance: fps recorded; asserted on GPU runs', async () => {
    test.setTimeout(120_000);
    await boot();
    await startSwimPump();
    await setSwim({ rateHz: 0.9, handsForward: 0.9 });
    await page.waitForTimeout(12_000); // fps counter integrates over 1 s windows
    const s = await state();
    results.perf = { fps: s.fps, simHz: s.simHz, gpuRun: !!process.env.DOLPHIN_GPU };
    expect(s.simHz).toBeGreaterThan(100); // fixed-step sim keeps up regardless of GPU
    if (process.env.DOLPHIN_GPU) {
      expect(s.fps).toBeGreaterThan(45); // the floor, on real GPU only
    } else {
      console.log(`  fps ${s.fps.toFixed(1)} under software GL (recorded; floor asserted on GPU runs)`);
    }
  });
});
