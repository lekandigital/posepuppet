// Live avatar switcher: robot → astronaut → woody → robot.
// Skips VRM steps if the (gitignored, license-gated) VRM files haven't been
// downloaded — see ASSETS.md.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const astronautVrm = resolve(root, 'public', 'avatars', 'astronaut.vrm');
const woodyVrm = resolve(root, 'public', 'avatars', 'woody.vrm');

test('avatar switcher cycles robot → astronaut → woody → robot', async ({ page }) => {
  const hasAstronaut = existsSync(astronautVrm);
  const hasWoody = existsSync(woodyVrm);

  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  // Force robot so the cycle test is independent of the default avatar.
  await page.goto('/?avatar=robot');
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

  const btn = page.locator('#avatar-btn');

  // --- Step 1: starts as robot ---
  await expect(btn).toHaveText('avatar: robot');

  // --- Step 2: click → astronaut ---
  await btn.click();
  if (hasAstronaut) {
    await expect(btn).toHaveText('avatar: astronaut');
    await page.waitForTimeout(2000);
    const count1 = await page.evaluate(() => window.__PP.detectionCount);
    await page.waitForTimeout(1000);
    const count2 = await page.evaluate(() => window.__PP.detectionCount);
    expect(count2).toBeGreaterThan(count1);
  } else {
    // VRM missing — button reverts to robot after failed load
    await page.waitForTimeout(1500);
    await expect(btn).toHaveText('avatar: robot');
  }

  // --- Step 3: click → woody ---
  await btn.click();
  if (hasWoody) {
    await expect(btn).toHaveText('avatar: woody');
    await page.waitForTimeout(2000);
    const count3 = await page.evaluate(() => window.__PP.detectionCount);
    await page.waitForTimeout(1000);
    const count4 = await page.evaluate(() => window.__PP.detectionCount);
    expect(count4).toBeGreaterThan(count3);
  } else {
    // VRM missing — falls back gracefully
    await page.waitForTimeout(1500);
  }

  // --- Step 4: click → back to robot ---
  await btn.click();
  await page.waitForTimeout(1000);
  await expect(btn).toHaveText('avatar: robot');

  expect(errors).toEqual([]);
});
