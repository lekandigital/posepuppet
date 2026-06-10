import { test, expect, type Page } from '@playwright/test';
import { snap } from './screenshot.helper';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test('pose landmarks stream and skeleton overlay draws', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, {
    timeout: 20_000,
  });

  // Detections arrive (model load can take a few seconds on first hit).
  await page.waitForFunction(() => window.__PP.detectionCount > 10, undefined, {
    timeout: 45_000,
  });

  // Pose loop is running at a usable rate even in this environment.
  await page.waitForFunction(() => window.__PP.poseFps() > 5, undefined, {
    timeout: 15_000,
  });

  // Overlay canvas actually has skeleton pixels on it.
  const drawn = await page.evaluate(() => {
    const c = document.getElementById('overlay') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonBlank = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonBlank++;
    return { nonBlank, total: data.length / 4 };
  });
  expect(drawn.nonBlank).toBeGreaterThan(drawn.total * 0.001);

  await snap(page, 'm1-detect');
  expect(errors).toEqual([]);
});

test('eval mode produces metrics over a short run', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?eval=arms&dur=10');

  const result = await page
    .waitForFunction(() => window.__EVAL_RESULT, undefined, { timeout: 90_000 })
    .then((h) => h.jsonValue());

  // Headless SwiftShader is slow; these are correctness floors, not perf
  // numbers. Real FPS is measured by `npm run eval` headed on this machine.
  expect(result.videoFrames).toBeGreaterThan(20);
  expect(result.detectionRate).toBeGreaterThan(0.9);
  expect(result.poseFps).toBeGreaterThan(2);
  expect(result.renderFps).toBeGreaterThan(10);
  // Sync metric scaffolding present (value will be bad until M2 retargeting).
  expect(result.sync.upperLimbsMean).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
