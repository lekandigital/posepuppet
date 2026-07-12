// Post-extraction contract on the Full App: the runtime is the page's ONLY
// getUserMedia consumer, it holds the origin's producer lock while
// capturing, and camera denial degrades to the honest status line.
import { test, expect, chromium } from '@playwright/test';

const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;

test('runtime owns capture: exactly one getUserMedia call; producer lock held', async ({ page }) => {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    (window as unknown as { __gumCalls: number }).__gumCalls = 0;
    md.getUserMedia = (c?: MediaStreamConstraints) => {
      (window as unknown as { __gumCalls: number }).__gumCalls++;
      return orig(c);
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

  expect(await page.evaluate(() => (window as unknown as { __gumCalls: number }).__gumCalls)).toBe(1);

  const held = await page.evaluate(async () => {
    const q = await navigator.locks.query();
    return (q.held ?? []).map((l) => l.name);
  });
  expect(held).toContain('bodyarcade-pose-producer');
});

test('camera denied: app reports it and never crashes', async () => {
  // dedicated launch: the suite browser force-grants via fake-UI flags, and
  // even a flagless Playwright launch grants a fake camera — real denial
  // needs Chromium's explicit deny switch
  const browser = await chromium.launch({ args: ['--deny-permission-prompts'] });
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${PP}/`);
  await page.waitForFunction(() => window.__PP?.cameraError !== null, undefined, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-testid="camera-status"]')).toContainText('camera unavailable');
  expect(errors).toEqual([]);
  await browser.close();
});
