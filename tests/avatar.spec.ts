// Live avatar switcher: robot ↔ VRM. Skips if the (gitignored, license-gated)
// VRM file hasn't been downloaded — see ASSETS.md.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const vrmPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'avatars', 'astronaut.vrm');

test('avatar switcher loads the VRM and switches back, no errors', async ({ page }) => {
  test.skip(!existsSync(vrmPath), 'astronaut.vrm not downloaded (see ASSETS.md)');

  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

  const btn = page.locator('#avatar-btn');
  await expect(btn).toHaveText('avatar: robot');
  await btn.click();
  await expect(btn).toHaveText('avatar: astronaut');
  // VRM finished loading and is being driven (detection keeps flowing)
  await page.waitForTimeout(2000);
  const count1 = await page.evaluate(() => window.__PP.detectionCount);
  await page.waitForTimeout(1000);
  const count2 = await page.evaluate(() => window.__PP.detectionCount);
  expect(count2).toBeGreaterThan(count1);

  await btn.click();
  await expect(btn).toHaveText('avatar: robot');
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
