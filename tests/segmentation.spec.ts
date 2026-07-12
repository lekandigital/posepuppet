// V7 presentation-layer verification:
// - TierController unit tests (drop timing, cooldown, no oscillation)
// - MaskBuffer browser tests (EMA beats raw flicker, band mapping, bbox)
// - e2e: every presentation mode records a nonzero playable file; the
//   effective mode is the requested one with a fresh mask; per-shot
//   presets flow through a scripted take; the replay shot drives ghosts.
// Auto-tiering is disabled in the e2e runs (SwiftShader can't hold the
// GPU floor by design — the controller has its own unit coverage).
import { test, expect, type Page } from '@playwright/test';
import { TierController } from '../src/record/presentation';

// ── TierController ──────────────────────────────────────────────────

test('tier: sustained low fps drops one tier after dropAfterMs, not before', () => {
  const c = new TierController({ floorFps: 45, dropAfterMs: 2000, cooldownMs: 20_000, recoverFps: 52, recoverAfterMs: 4000 });
  expect(c.sample(30, 0)).toBe(0);
  expect(c.sample(30, 1900)).toBe(0); // not yet
  expect(c.sample(30, 2100)).toBe(1); // dropped
  // second sustained window drops again
  expect(c.sample(30, 2500)).toBe(1);
  expect(c.sample(30, 4700)).toBe(2);
  // never past 2
  expect(c.sample(10, 30_000)).toBe(2);
});

test('tier: a brief dip does not drop; the window resets on recovery', () => {
  const c = new TierController({ floorFps: 45, dropAfterMs: 2000, cooldownMs: 20_000, recoverFps: 52, recoverAfterMs: 4000 });
  c.sample(30, 0);
  c.sample(60, 1500); // dip ended before 2 s
  expect(c.sample(30, 1600)).toBe(0);
  expect(c.sample(30, 3500)).toBe(0); // new window started at 1600
  expect(c.sample(30, 3700)).toBe(1);
});

test('tier: recovery is slow — cooldown + sustained headroom, one tier at a time', () => {
  const c = new TierController({ floorFps: 45, dropAfterMs: 2000, cooldownMs: 20_000, recoverFps: 52, recoverAfterMs: 4000 });
  c.sample(30, 0);
  c.sample(30, 2100); // tier 1 at t=2100
  // high fps immediately after: inside the cooldown, no recovery
  c.sample(60, 3000);
  expect(c.sample(60, 8000)).toBe(1);
  // headroom has been sustained since t=3000, so the moment the cooldown
  // expires the controller recovers
  expect(c.sample(60, 23_000)).toBe(0);
  // fps between floor and recoverFps never recovers
  c.sample(30, 30_000);
  c.sample(30, 32_100); // tier 1 again
  expect(c.sample(48, 60_000)).toBe(1);
  expect(c.sample(48, 90_000)).toBe(1);
});

// ── MaskBuffer (browser: canvas + ImageData) ────────────────────────

async function maskBufferHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__PP !== undefined, undefined, { timeout: 20_000 });
}

test('maskbuffer: EMA smoothing reduces edge flicker vs raw masks', async ({ page }) => {
  await maskBufferHarness(page);
  const r = await page.evaluate(async () => {
    const { MaskBuffer } = await import('/packages/segmentation/src/maskBuffer.ts');
    const w = 64, h = 64;
    // a square "person" whose edge confidence jitters frame to frame
    const frame = (seed: number) => {
      const c = new Float32Array(w * h);
      let s = seed;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const inside = x >= 16 && x < 48 && y >= 16 && y < 48;
          const edge = inside && (x < 20 || x >= 44 || y < 20 || y >= 44);
          c[y * w + x] = edge ? 0.3 + rnd() * 0.6 : inside ? 0.95 : 0.03;
        }
      return c;
    };
    const smoothed = new MaskBuffer();
    const raw = new MaskBuffer(1); // alpha 1 = no temporal smoothing
    let smSum = 0, rawSum = 0, n = 0;
    for (let i = 0; i < 24; i++) {
      smoothed.ingest(frame(i * 7 + 1), w, h);
      raw.ingest(frame(i * 7 + 1), w, h);
      if (i > 2) {
        smSum += smoothed.stats().flicker;
        rawSum += raw.stats().flicker;
        n++;
      }
    }
    return { smoothed: smSum / n, raw: rawSum / n, bbox: smoothed.stats().bbox, coverage: smoothed.stats().coverage };
  });
  expect(r.smoothed).toBeLessThan(r.raw * 0.6); // EMA at least ~halves edge flicker
  expect(r.raw).toBeGreaterThan(0.001); // the synthetic edge does flicker
  // bbox finds the square (16..48 of 64 = 0.25..0.75, ± the noisy edge band)
  expect(r.bbox!.x0).toBeGreaterThan(0.15);
  expect(r.bbox!.x1).toBeLessThan(0.85);
  expect(r.coverage).toBeGreaterThan(0.15);
  expect(r.coverage).toBeLessThan(0.4);
});

test('maskbuffer: confidence band maps to clean alpha (0 → 0, 1 → 255)', async ({ page }) => {
  await maskBufferHarness(page);
  const r = await page.evaluate(async () => {
    const { MaskBuffer } = await import('/packages/segmentation/src/maskBuffer.ts');
    const w = 4, h = 1;
    const buf = new MaskBuffer(1);
    buf.ingest(new Float32Array([0, 0.34, 0.76, 1]), w, h);
    const d = buf.canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    return [d[3], d[7], d[11], d[15]];
  });
  expect(r[0]).toBe(0); // conf 0 → transparent
  expect(r[1]).toBe(0); // below the LO band edge → transparent
  expect(r[2]).toBe(255); // above the HI band edge → opaque
  expect(r[3]).toBe(255);
});

// ── e2e: presentation modes record playable files ───────────────────

const PRESENT_CONFIG = (mode: string, aspect: string) => ({
  presentMode: mode,
  presentAutoTier: false,
  recAspect: aspect,
  recPackage: false, // no stinger/endcard: the whole clip exercises the mode
});

async function bootWithConfig(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.goto('/');
  await page.evaluate((p) => {
    localStorage.setItem(
      'posepuppet-config-v3',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('posepuppet-config-v3') ?? '{}'), ...p }),
    );
  }, patch);
  await page.reload();
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
}

const MODES = ['blur', 'cutout', 'silhouette', 'chip', 'stage'] as const;

for (const mode of MODES) {
  test(`present ${mode} @16:9: effective mode holds and the take records`, async ({ page }) => {
    await bootWithConfig(page, PRESENT_CONFIG(mode, '16:9'));
    // the worker segmenter boots lazily; effective flips once the mask
    // passes the adaptive freshness gate and the debounce settles (the
    // gate widens with the measured mask interval on slow environments,
    // so effective === mode IS the freshness assertion)
    await page.waitForFunction(
      (m) => {
        const p = window.__PP.present?.();
        return p && p.effective === m && p.maskAgeMs >= 0;
      },
      mode,
      { timeout: 30_000 },
    );
    const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
    await page.locator('#record-btn').click();
    await page.waitForTimeout(2600);
    await page.locator('#record-btn').click();
    await downloadPromise;
    const rec = await page.waitForFunction(
      () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
      undefined,
      { timeout: 15_000 },
    );
    const { size } = (await rec.jsonValue()) as { size: number };
    expect(size).toBeGreaterThan(10_000);
    // the mode stayed effective through the take (no silent raw fallback)
    const p = (await page.evaluate(() => window.__PP.present!())) as { effective: string; tier: number };
    expect(p.effective).toBe(mode);
    expect(p.tier).toBe(0);
  });
}

for (const mode of ['cutout', 'stage'] as const) {
  test(`present ${mode} @9:16 vertical records`, async ({ page }) => {
    await bootWithConfig(page, PRESENT_CONFIG(mode, '9:16'));
    await page.waitForFunction(
      (m) => window.__PP.present?.().effective === m,
      mode,
      { timeout: 30_000 },
    );
    const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
    await page.locator('#record-btn').click();
    await page.waitForTimeout(2600);
    await page.locator('#record-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/posepuppet-vertical-.*\.webm$/);
    const rec = await page.waitForFunction(
      () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
      undefined,
      { timeout: 15_000 },
    );
    expect(((await rec.jsonValue()) as { size: number }).size).toBeGreaterThan(10_000);
  });
}

// ── e2e: per-shot presets + the replay shot ─────────────────────────

test('presentation reel: per-shot presets apply and restore', async ({ page }) => {
  await bootWithConfig(page, { presentMode: 'raw', presentAutoTier: false, recPackage: false });
  await page.waitForFunction(() => window.__PP.detectionCount > 20, undefined, { timeout: 30_000 });

  await page.keyboard.press('Meta+k');
  await page.fill('.palette-input', 'presentation reel');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.getElementById('so-eyebrow')?.textContent?.startsWith('Shot 1'),
    undefined,
    { timeout: 12_000 },
  );

  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    const req = (await page.evaluate(() => window.__PP.present!().requested)) as string;
    seen.push(req);
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
  }
  await downloadPromise;
  expect(seen).toEqual(['raw', 'blur', 'cutout', 'silhouette', 'stage']);
  // the take's presets end with the take: back to the user's raw
  const after = (await page.evaluate(() => window.__PP.present!().requested)) as string;
  expect(after).toBe('raw');
});

test('character take: the replay shot plays ghosts inside the take', async ({ page }) => {
  await bootWithConfig(page, { presentMode: 'raw', recPackage: false });
  await page.waitForFunction(() => window.__PP.detectionCount > 30, undefined, { timeout: 30_000 });

  await page.keyboard.press('Meta+k');
  await page.fill('.palette-input', 'character take');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.getElementById('so-eyebrow')?.textContent?.startsWith('Shot 1'),
    undefined,
    { timeout: 12_000 },
  );
  // advance to the final replay shot (8 shots; 7 advances)
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
  }
  await page.waitForFunction(
    () => document.getElementById('so-line')?.textContent?.includes('replay'),
    undefined,
    { timeout: 10_000 },
  );
  // the replay consumes Motion Memory: ghosts go active during the shot
  await page.waitForFunction(() => window.__PP.ghostActive?.() === true, undefined, {
    timeout: 8000,
  });
  await downloadPromise;
  const rec = await page.waitForFunction(
    () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
    undefined,
    { timeout: 15_000 },
  );
  expect(((await rec.jsonValue()) as { size: number }).size).toBeGreaterThan(10_000);
});
