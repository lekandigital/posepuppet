// Record button → nonzero playable .webm. Runs against the fake webcam;
// stops early via the button (no need to sit out the 15 s preset).
import { test, expect } from '@playwright/test';

test('record button yields a nonzero .webm download', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, {
    timeout: 20_000,
  });

  const btn = page.locator('#record-btn');
  await expect(btn).toBeVisible();

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await btn.click();
  await expect(btn).toHaveClass(/recording/);
  await page.waitForTimeout(2500);
  await btn.click(); // stop early

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/posepuppet-.*\.webm$/);

  const blob = await page.waitForFunction(
    () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
    undefined,
    { timeout: 10_000 },
  );
  const { size, type } = (await blob.jsonValue()) as { size: number; type: string };
  expect(size).toBeGreaterThan(10_000); // ~2.5 s of 1600×720 video is far beyond headers
  expect(type).toContain('webm');
  await expect(btn).not.toHaveClass(/recording/);
});
