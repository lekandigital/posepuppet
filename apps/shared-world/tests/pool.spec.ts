import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checkpoint 01 — dolphin in the pool. Ports the dolphin-suite assertions
 * against __SHARED_WORLD (Checkpoint 01 §8): boot + model measurement,
 * keyboard fallback incl. the X brake, impulse-and-glide cadence coupling,
 * signed pitch/roll via the synthetic BodySignal pump, burst, speed caps,
 * speed-shaped turn authority, dropout autopilot, replay determinism, the
 * frame-1 animation guard, and performance (simHz > 100, median fps ≥ 58,
 * asserted unconditionally — native macOS GPU, headed Chrome).
 *
 * The 8-direction containment battery is NOT ported at pool scale (the
 * walls are the vendored demo's; the battery returns re-pointed at cp04B)
 * — recorded in the results artifact.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');

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
        // suite-current checkpoint stamp (assertions below are cp01's,
        // unchanged; the cp02 camera suite lives in camera.spec.ts)
        checkpoint: '02-pool-camera',
        generatedAt: new Date().toISOString(),
        pool: { ...(existing.pool as object | undefined), ...results },
        containmentBatteryNote:
          'NOT ported at pool scale (walls are the vendored demo pool); returns re-pointed at cp04B',
      },
      null,
      2,
    ) + '\n',
  );
});

async function boot(page: import('@playwright/test').Page, qs = ''): Promise<void> {
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

const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__SHARED_WORLD.state());
const testHook = (page: import('@playwright/test').Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);

/** rAF synthetic BodySignal pump with a swim block (postMessage envelope —
 *  ported as-is from the dolphin suite). */
async function startSwimPump(page: import('@playwright/test').Page): Promise<void> {
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

const setSwim = (page: import('@playwright/test').Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => Object.assign((window as any).__swim, p), patch);

/** Unwrapped yaw rate (rad/s) over windowMs of ~100 ms samples. */
async function yawRate(page: import('@playwright/test').Page, windowMs: number): Promise<number> {
  let prev = (await state(page)).yaw as number;
  let total = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < windowMs) {
    await page.waitForTimeout(100);
    const y = (await state(page)).yaw as number;
    let d = (y - prev) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = y;
  }
  return total / ((Date.now() - t0) / 1000);
}

test.describe('checkpoint 01 — dolphin in the pool', () => {
  test('1. boots in the pool: depth 7.5, model length 2.89 ± 0.06 m, credits reachable, no console errors', async ({ page }) => {
    const isFaviconProbe = (s: string) => s.includes('/favicon.ico');
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const loc = msg.location();
        const text = `${msg.text()}${loc.url ? ` [${loc.url}]` : ''}`;
        if (!isFaviconProbe(text)) consoleErrors.push(text);
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('response', (res) => {
      if (res.status() >= 400 && !isFaviconProbe(res.url())) {
        consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
      }
    });

    await boot(page);
    const s = await state(page);
    expect(s.inWater).toBe(true);
    expect(s.depthHere).toBeCloseTo(7.5, 3);
    expect(s.shoreDist).toBeGreaterThan(0);

    // BL policy (Master §7.1): measured, never rescaled
    expect(s.modelLengthM).toBeGreaterThanOrEqual(2.89 - 0.06);
    expect(s.modelLengthM).toBeLessThanOrEqual(2.89 + 0.06);
    results.modelLengthM = s.modelLengthM;

    // credits reachable: from the eval handle AND on the credits view
    const credits = await page.evaluate(() => (window as any).__SHARED_WORLD.credits);
    expect(credits).toContain('GAMICO');
    expect(credits).toContain('CC-BY 4.0');
    await page.goto('/shared-world/?view=credits');
    await expect(page.locator('#credits')).toContainText('GAMICO');
    await expect(page.locator('#credits')).toContainText('CC-BY');

    await page.waitForTimeout(500);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    results.bootConsoleErrors = consoleErrors.length;
  });

  test('2. keyboard fallback: Shift kicks accelerate, W dives, D turns right, X brakes to < 0.5 within 1.2 s', async ({ page }) => {
    await boot(page);
    const s0 = await state(page);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(3000);
    await page.keyboard.up('Shift');
    const s1 = await state(page);
    expect(s1.speed).toBeGreaterThan(s0.speed + 1);
    expect(s1.kickCount).toBeGreaterThanOrEqual(s0.kickCount + 3);
    // W = pitch down = deeper (y more negative)
    await page.keyboard.down('w');
    await page.waitForTimeout(2000);
    await page.keyboard.up('w');
    const s2 = await state(page);
    expect(s2.y).toBeLessThan(s1.y - 0.5);
    // D = bank right = yaw increases
    await page.keyboard.down('d');
    await page.waitForTimeout(1500);
    await page.keyboard.up('d');
    const s3 = await state(page);
    expect(s3.yaw).toBeGreaterThan(s2.yaw + 0.15);
    // X = brake: reach cruise first (Space burst), then brake
    await page.keyboard.down(' ');
    await page.waitForFunction(
      () => (window as any).__SHARED_WORLD.state().speed >= 4.8,
      undefined, { timeout: 6000 },
    );
    await page.keyboard.up(' ');
    const cruise = await state(page);
    await page.keyboard.down('x');
    await page.waitForTimeout(1200);
    const braked = await state(page);
    await page.keyboard.up('x');
    results.brake = { fromSpeed: cruise.speed, speedAfter1200ms: braked.speed };
    expect(braked.speed).toBeLessThan(0.5);
  });

  test('3. impulse-and-glide: cadence sets settled speed; stopping glides, never stops dead', async ({ page }) => {
    test.setTimeout(150_000);
    await boot(page);
    await startSwimPump(page);
    await page.waitForTimeout(2500);
    const settled: { rateHz: number; speed: number }[] = [];
    for (const rateHz of [0.4, 0.9]) {
      await setSwim(page, { rateHz });
      await page.waitForTimeout(14_000); // ~2τ settle
      const speeds: number[] = [];
      for (let i = 0; i < 12; i++) {
        speeds.push((await state(page)).speed);
        await page.waitForTimeout(400);
      }
      settled.push({ rateHz, speed: speeds.reduce((a, b) => a + b, 0) / speeds.length });
    }
    results.cadenceCoupling = settled;
    expect(settled[1]!.speed).toBeGreaterThan(settled[0]!.speed * 1.25); // faster rhythm = faster dolphin
    // glide: stop kicking — 3 s later still carrying real momentum
    await setSwim(page, { rateHz: 0 });
    await page.waitForTimeout(3000);
    const glide = await state(page);
    results.glideSpeedAfter3s = glide.speed;
    expect(glide.speed).toBeGreaterThan(settled[1]!.speed * 0.35);
  });

  // Pool-scale drive adaptation (assertions unchanged): standard assist
  // removes the full-assist shore yaw bias that fights the roll-sign
  // measurement inside a 15 m pool, and the 0.4 Hz cadence keeps speed
  // ~2.6 m/s < BREACH_MIN_SPEED 3.75 so surfacing does not (correctly!)
  // breach mid-measurement — cruise now exceeds the breach threshold by
  // design in the governed 5/9 family.
  test('4. signed pitch/roll via the BodySignal pump: forward dives, back surfaces; banked turns follow the lean', async ({ page }) => {
    await boot(page, '?assist=standard');
    await startSwimPump(page);
    await setSwim(page, { rateHz: 0.4, leanY: 0.7 });
    await page.waitForTimeout(4000);
    const deep = await state(page);
    expect(deep.y).toBeLessThan(-4); // pool-scaled bound (floor −6.3 in 7.5 m water)
    await setSwim(page, { leanY: -0.7 });
    await page.waitForTimeout(4500);
    const shallow = await state(page);
    expect(shallow.y).toBeGreaterThan(deep.y + 2);
    // roll signs
    await setSwim(page, { leanY: 0 });
    await page.waitForTimeout(1000);
    const a = await state(page);
    await setSwim(page, { leanX: 0.6 });
    await page.waitForTimeout(2000);
    const b = await state(page);
    expect(b.yaw).toBeGreaterThan(a.yaw + 0.2);
    await setSwim(page, { leanX: -0.6 });
    await page.waitForTimeout(3000);
    const c = await state(page);
    expect(c.yaw).toBeLessThan(b.yaw - 0.2);
  });

  test('5. burst: reaches > 8 m/s within 6 s and never exceeds 9.05', async ({ page }) => {
    await boot(page);
    await testHook(page, 'setIntent({ burst: true })');
    let peak = 0;
    const t0 = Date.now();
    let reachedAt: number | null = null;
    while (Date.now() - t0 < 8000) {
      const s = await state(page);
      peak = Math.max(peak, s.speed);
      expect(s.speed).toBeLessThanOrEqual(9.05);
      if (reachedAt === null && s.speed > 8) reachedAt = Date.now() - t0;
      await page.waitForTimeout(100);
    }
    await testHook(page, 'setIntent(null)');
    results.burst = { peakSpeed: peak, msToExceed8: reachedAt };
    expect(reachedAt, 'burst must exceed 8 m/s within 6 s').not.toBeNull();
    expect(reachedAt!).toBeLessThanOrEqual(6000);
  });

  test('6. speed caps: sustained max ≤ 5.05 without burst', async ({ page }) => {
    await boot(page);
    await startSwimPump(page);
    await setSwim(page, { rateHz: 1.6, amp: 1 });
    await page.waitForTimeout(8000);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      peak = Math.max(peak, (await state(page)).speed);
      await page.waitForTimeout(100);
    }
    results.sustainedMaxSpeed = peak;
    expect(peak).toBeLessThanOrEqual(5.05);
    expect(peak).toBeGreaterThan(4.5); // and the cadence really was driving at the cap
  });

  // Pool-scale drive adaptation (assertions unchanged): a 9 m/s full-bank
  // turn circle (~11.5 m across) does not fit a 15 m pool, so the fast
  // phase recentres the dolphin each sample — teleporting never touches
  // yaw, which is what is being measured. The slow phase holds brake+roll
  // and turns in place (hover retains full rotation authority — Track E).
  test('7. turn shaping: full-deflection yaw rate slow vs cruise-speed ratio ≥ 1.3', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    // expert assist: no drift floor, no shore yaw bias
    await testHook(page, "setAssist('expert')");
    await testHook(page, 'teleport(0, 0, -4)');
    await testHook(page, 'setIntent({ roll: 1, brake: true, autopilot: false })');
    await page.waitForTimeout(1500); // bank settles (~4τ); brake reaches hover
    const slowSpeed = (await state(page)).speed;
    const slow = await yawRate(page, 1500);
    // fast: burst to > 8; recentre every sample so walls never interfere
    await testHook(page, 'setIntent({ roll: 1, burst: true, autopilot: false })');
    await page.waitForFunction(
      () => (window as any).__SHARED_WORLD.state().speed > 8,
      undefined, { timeout: 8000 },
    );
    let prev = (await state(page)).yaw as number;
    let total = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 1500) {
      await testHook(page, 'teleport(0, 0, -4)');
      await page.waitForTimeout(100);
      const y = (await state(page)).yaw as number;
      let d = (y - prev) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      total += d;
      prev = y;
    }
    const fast = total / ((Date.now() - t0) / 1000);
    const fastSpeed = (await state(page)).speed;
    await testHook(page, 'setIntent(null)');
    results.turnShaping = { slowYawRateRadS: slow, slowSpeed, fastYawRateRadS: fast, fastSpeed };
    expect(slow).toBeGreaterThan(0.5);
    expect(fast).toBeGreaterThan(0.5);
    expect(slow / fast).toBeGreaterThanOrEqual(1.3);
  });

  test('8. tracking loss: autopilot glides level — pitch decay max step < 0.12 rad/100 ms; recovery ≤ 5 s', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await startSwimPump(page);
    await setSwim(page, { rateHz: 0.8, leanY: 0.5, leanX: 0.4 });
    await page.waitForTimeout(5000);
    const before = await state(page);
    await setSwim(page, { dead: true });
    let prev = before.pitch;
    let maxStep = 0;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(100);
      const s = await state(page);
      maxStep = Math.max(maxStep, Math.abs(s.pitch - prev));
      prev = s.pitch;
    }
    const lost = await state(page);
    results.dropout = { maxPitchStepRad: maxStep, trackingDuringLoss: lost.tracking };
    expect(maxStep).toBeLessThan(0.12);
    expect(['none', 'stale', 'autopilot', 'low-confidence']).toContain(lost.tracking);
    expect(lost.speed).toBeGreaterThan(0.4); // gliding, not parked
    // recovery
    await setSwim(page, { dead: false, leanY: 0, leanX: 0 });
    await page.waitForFunction(
      () => (window as any).__SHARED_WORLD.state().tracking === 'live',
      undefined, { timeout: 5_000 },
    );
    const rec = await state(page);
    expect(rec.kickCount - lost.kickCount).toBeLessThanOrEqual(2); // no stacked-kick spike
  });

  test('9. replay determinism: identical scripts → identical digests, across reloads', async ({ page }) => {
    await boot(page);
    const script = JSON.stringify([
      { steps: 240, intent: { kicks: 1, kickAmp: 0.8 } },
      { steps: 480, intent: { pitch: 0.5, roll: 0.3 } },
      { steps: 480, intent: { burst: true } },
      { steps: 240, intent: { autopilot: true } },
    ]);
    const a = await testHook(page, `runScript(${script})`);
    const b = await testHook(page, `runScript(${script})`);
    expect(a).toBe(b);
    await boot(page); // fresh page load — the sim must not depend on ambient state
    const c = await testHook(page, `runScript(${script})`);
    expect(c).toBe(a);
    results.replayDigest = String(a).slice(0, 64);
  });

  test('10. animation guard: an AnimationAction is running on frame 1 — no rest-pose frame ever renders', async ({ page }) => {
    await boot(page);
    const ff = await page.evaluate(() => (window as any).__SHARED_WORLD.firstFrame());
    expect(ff).not.toBeNull();
    expect(ff.actionRunning).toBe(true);
    expect(ff.base).toBe('SwimForward');
    const s = await state(page);
    expect(s.animation.running).toBe(true);
    results.firstFrameAnimation = ff;
  });

  test('11. performance: simHz > 100 always; sustained median fps ≥ 58 over a 10 s scripted swim', async ({ page, browser }) => {
    test.setTimeout(120_000);
    await boot(page);
    await startSwimPump(page);
    await setSwim(page, { rateHz: 0.9, handsForward: 0.9, leanX: 0.3 });
    await page.waitForTimeout(4000); // warm up: swimming, bursting, turning

    // 10 × 1 s rAF buckets while sampling simHz each second
    const perf = await page.evaluate(
      () =>
        new Promise<{ fpsBuckets: number[]; simHzSamples: number[] }>((done) => {
          const fpsBuckets: number[] = [];
          const simHzSamples: number[] = [];
          let frames = 0;
          const bucket = () => {
            fpsBuckets.push(frames);
            frames = 0;
            simHzSamples.push((window as any).__SHARED_WORLD.state().simHz);
            if (fpsBuckets.length >= 10) done({ fpsBuckets, simHzSamples });
            else setTimeout(bucket, 1000);
          };
          const tick = () => {
            frames++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(bucket, 1000);
        }),
    );
    const sorted = [...perf.fpsBuckets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const min = sorted[0]!;
    const canvasSize = await page.evaluate(() => {
      const c = document.querySelector('#app canvas') as HTMLCanvasElement;
      return { width: c.width, height: c.height };
    });
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const mem = await page.evaluate(
      () => (performance as any).memory?.usedJSHeapSize ?? null,
    );
    results.perf = {
      fps: { buckets: perf.fpsBuckets, median, min, windowSeconds: 10 },
      simHzSamples: perf.simHzSamples,
      viewport: { width: 1728, height: 1080 },
      devicePixelRatio: dpr,
      renderResolution: canvasSize,
      chromeVersion: browser.version(),
      usedJSHeapBytes: mem,
    };
    for (const hz of perf.simHzSamples) expect(hz).toBeGreaterThan(100);
    expect(median, `median fps ${median} (buckets: ${perf.fpsBuckets.join(',')})`).toBeGreaterThanOrEqual(58);
  });
});
