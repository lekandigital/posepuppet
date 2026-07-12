// Closed-loop graybox runs: synthetic landmark streams drive the FULL
// production chain in-page (frames → gait detection → BodySignal →
// controller → locomotion → camera). These are the V3 acceptance specs:
// the walk follows the path, dropout stops gently and recovers without a
// snap, comfort envelopes hold at the OUTPUT (the S8 automated proxy),
// keyboard always wins, seated glide works, T-pose recenters.
import { test, expect, type Page } from '@playwright/test';

interface WalkProbe {
  pose: { speed: number; yawRateDps: number; mode: string; x: number; z: number; vignette: number };
  env: {
    maxSpeed: number; maxAccel: number; maxYawRateDps: number;
    maxYawAccelDps2: number; maxEyeSlewPerS: number;
  };
  caps: {
    maxSpeed: number; maxAccel: number; maxDecel: number;
    maxYawRateDps: number; maxYawAccelDps2: number; eyeSlewPerS: number;
    vignetteMax: number;
  };
  lateral: number | null;
  traveled: number;
  fovOk: boolean;
  tilt: [number, number];
  source: string;
}

async function probe(page: Page): Promise<WalkProbe> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = (window as never as { __WALK: any }).__WALK;
    const cfg = w.config();
    return {
      pose: w.pose(),
      env: w.envelope(),
      caps: {
        maxSpeed: cfg.comfort.maxSpeed,
        maxAccel: cfg.comfort.maxAccel,
        maxDecel: cfg.comfort.maxDecel,
        maxYawRateDps: cfg.comfort.maxYawRateDps,
        maxYawAccelDps2: cfg.comfort.maxYawAccelDps2,
        eyeSlewPerS: cfg.comfort.eyeSlewPerS,
        vignetteMax: cfg.comfort.vignette.max,
      },
      lateral: w.lateral(),
      traveled: w.traveled(),
      fovOk: w.fov() === w.fovAtBoot(),
      tilt: w.camTilt(),
      source: w.hud().source,
    };
  });
}

function expectEnvelopeWithin(p: WalkProbe): void {
  const eps = 1e-6;
  expect(p.env.maxSpeed).toBeLessThanOrEqual(p.caps.maxSpeed + eps);
  expect(p.env.maxAccel).toBeLessThanOrEqual(Math.max(p.caps.maxAccel, p.caps.maxDecel) + eps);
  expect(p.env.maxYawRateDps).toBeLessThanOrEqual(p.caps.maxYawRateDps + eps);
  expect(p.env.maxYawAccelDps2).toBeLessThanOrEqual(p.caps.maxYawAccelDps2 + eps);
  expect(p.env.maxEyeSlewPerS).toBeLessThanOrEqual(p.caps.eyeSlewPerS + eps);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('march drive: walks the path ribbon, horizon stable, envelope holds', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/walking/?drive=march&hz=0.9');
  await expect(page.getByTestId('walk-strip')).toBeVisible();
  await page.waitForFunction(
    () => (window as never as { __WALK: { traveled(): number } }).__WALK?.traveled() > 12,
    undefined, { timeout: 60_000 },
  );
  const p = await probe(page);
  expect(p.pose.mode).toBe('walk');
  expect(p.pose.speed).toBeGreaterThan(0.6);
  expect(p.source).toBe('legs');
  // path-following: the assist keeps the walk inside the ribbon + shoulder
  expect(p.lateral).not.toBeNull();
  expect(Math.abs(p.lateral!)).toBeLessThan(1.8);
  // comfort at the output: stable horizon (no tilt), fixed FOV, caps hold
  expect(p.tilt[0]).toBe(0);
  expect(p.tilt[1]).toBe(0);
  expect(p.fovOk).toBe(true);
  expectEnvelopeWithin(p);
  await expect(page.getByTestId('walk-status')).toHaveText('WALKING');
  expect(errors).toEqual([]);
});

test('dropout: eases to a stop, then recovers without a snap', async ({ page }) => {
  await page.goto('/walking/?drive=march&hz=0.9&loss=6,3');
  // walking before the loss
  await page.waitForFunction(
    () => (window as never as { __WALK: { pose(): { speed: number } } }).__WALK?.pose().speed > 0.8,
    undefined, { timeout: 30_000 },
  );
  // the loss window (t=6..9 s of stream time) → autopilot easing to a stop
  await page.waitForFunction(
    () => {
      const w = (window as never as { __WALK: { pose(): { mode: string; speed: number } } }).__WALK;
      return w.pose().mode === 'autopilot' || w.pose().speed < 0.05;
    },
    undefined, { timeout: 30_000 },
  );
  await page.waitForFunction(
    () => (window as never as { __WALK: { pose(): { speed: number } } }).__WALK?.pose().speed < 0.05,
    undefined, { timeout: 20_000 },
  );
  // recovery: walking again, and the whole run stayed inside the envelope —
  // maxYawAccel/maxAccel maxima bound the re-entry (no snap by definition)
  await page.waitForFunction(
    () => (window as never as { __WALK: { pose(): { speed: number; mode: string } } }).__WALK?.pose().speed > 0.7,
    undefined, { timeout: 30_000 },
  );
  const p = await probe(page);
  expectEnvelopeWithin(p);
});

test('sway drive: weight-shift walking with no legs in frame', async ({ page }) => {
  await page.goto('/walking/?drive=sway&hz=0.55');
  await page.waitForFunction(
    () => {
      const w = (window as never as { __WALK: { pose(): { speed: number }; hud(): { source: string } } }).__WALK;
      return w && w.pose().speed > 0.3 && w.hud().source === 'sway';
    },
    undefined, { timeout: 60_000 },
  );
  const p = await probe(page);
  expect(p.pose.mode).toBe('walk');
  expectEnvelopeWithin(p);
  await expect(page.getByTestId('walk-source')).toHaveText('SWAY');
});

test('seated glide: forward lean drives, status reads GLIDING', async ({ page }) => {
  await page.goto('/walking/?drive=glide');
  await page.waitForFunction(
    () => {
      const w = (window as never as { __WALK: { pose(): { mode: string; speed: number } } }).__WALK;
      return w && w.pose().mode === 'glide' && w.pose().speed > 0.7;
    },
    undefined, { timeout: 60_000 },
  );
  const p = await probe(page);
  expect(p.pose.speed).toBeLessThanOrEqual(2.0 + 1e-6);
  expectEnvelopeWithin(p);
  await expect(page.getByTestId('walk-status')).toHaveText('GLIDING');
});

test('T-pose recenter: toast fires mid-run', async ({ page }) => {
  await page.goto('/walking/?drive=march&hz=0.9&tpose=8');
  await expect(page.getByTestId('walk-toast')).toBeVisible({ timeout: 45_000 });
});

test('keyboard always wins: W drives, D turns, caps hold', async ({ page }) => {
  await page.goto('/walking/?drive=march&hz=0.9');
  await page.waitForFunction(
    () => (window as never as { __WALK: unknown }).__WALK !== undefined,
    undefined, { timeout: 15_000 },
  );
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(2500);
  const p = await probe(page);
  expect(p.pose.mode).toBe('keyboard');
  expect(p.pose.speed).toBeGreaterThan(1.5);
  expect(p.pose.yawRateDps).toBeGreaterThan(20);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  expectEnvelopeWithin(p);
  await expect(page.getByTestId('walk-status')).toHaveText('KEYBOARD');
});

test('lean steers within the yaw cap; vignette stays bounded', async ({ page }) => {
  await page.goto('/walking/?drive=march&hz=0.9&lean=10');
  await page.waitForFunction(
    () => (window as never as { __WALK: { traveled(): number } }).__WALK?.traveled() > 8,
    undefined, { timeout: 60_000 },
  );
  const p = await probe(page);
  expect(p.pose.vignette).toBeGreaterThanOrEqual(0);
  expect(p.pose.vignette).toBeLessThanOrEqual(p.caps.vignetteMax + 1e-6);
  expectEnvelopeWithin(p);
});
