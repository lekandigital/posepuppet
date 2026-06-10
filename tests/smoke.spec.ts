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

test('app boots, fake webcam streams, stage renders, no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  // Fake camera permission auto-granted; video should start streaming.
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, {
    timeout: 20_000,
  });
  const dims = await page.evaluate(() => {
    const v = document.getElementById('video') as HTMLVideoElement;
    return { w: v.videoWidth, h: v.videoHeight, ready: v.readyState };
  });
  expect(dims.w).toBeGreaterThan(0);
  expect(dims.h).toBeGreaterThan(0);
  expect(dims.ready).toBeGreaterThanOrEqual(2);

  // Three.js stage canvas is live and sized.
  const stage = page.locator('#stage');
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Render loop is actually producing frames.
  await page.waitForFunction(() => window.__PP.renderFps() > 10, undefined, {
    timeout: 10_000,
  });

  // Overlay canvas aligns with the video content rect.
  const align = await page.evaluate(() => {
    const v = document.getElementById('video')!.getBoundingClientRect();
    const o = document.getElementById('overlay')!.getBoundingClientRect();
    return {
      dx: Math.abs(v.x - o.x),
      dy: Math.abs(v.y - o.y),
      dw: Math.abs(v.width - o.width),
      dh: Math.abs(v.height - o.height),
    };
  });
  expect(align.dx).toBeLessThan(2);
  expect(align.dy).toBeLessThan(2);
  expect(align.dw).toBeLessThan(2);
  expect(align.dh).toBeLessThan(2);

  await snap(page, 'm0-smoke');
  expect(errors).toEqual([]);
});
