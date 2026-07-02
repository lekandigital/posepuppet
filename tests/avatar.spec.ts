// Live avatar switcher: robot → astronaut → woody → robot.
// astronaut.vrm (CC0) ships with the repo; woody.vrm is a local-only,
// non-redistributable file (Gate 1) — the registry probes for it at boot
// and removes it from the cycle when absent.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const astronautVrm = resolve(root, 'public', 'avatars', 'astronaut.vrm');
const woodyVrm = resolve(root, 'public', 'avatars', 'woody.vrm');

test('defaults to astronaut on a fresh visit', async ({ page }) => {
  test.skip(!existsSync(astronautVrm), 'astronaut.vrm missing');

  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });
  await expect(page.locator('#avatar-btn')).toHaveText('avatar: astronaut');
});

test('avatar switcher cycles through available avatars and back to robot', async ({ page }) => {
  test.skip(!existsSync(astronautVrm), 'astronaut.vrm missing');
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

  // --- Step 2: click → astronaut, detection keeps flowing ---
  await btn.click();
  await expect(btn).toHaveText('avatar: astronaut');
  await page.waitForTimeout(2000);
  const count1 = await page.evaluate(() => window.__PP.detectionCount);
  await page.waitForTimeout(1000);
  const count2 = await page.evaluate(() => window.__PP.detectionCount);
  expect(count2).toBeGreaterThan(count1);

  // --- Step 3: click → erika (CC0, committed — always present) ---
  await btn.click();
  await expect(btn).toHaveText('avatar: erika');
  await page.waitForTimeout(1500);

  // --- Step 4: click → woody when its local file exists, else the cycle
  // skips straight back to robot (auto-hidden, no failed load) ---
  await btn.click();
  if (hasWoody) {
    await expect(btn).toHaveText('avatar: woody');
    await page.waitForTimeout(2000);
    const count3 = await page.evaluate(() => window.__PP.detectionCount);
    await page.waitForTimeout(1000);
    const count4 = await page.evaluate(() => window.__PP.detectionCount);
    expect(count4).toBeGreaterThan(count3);

    // --- Step 5: click → back to robot ---
    await btn.click();
    await page.waitForTimeout(1000);
  }
  await expect(btn).toHaveText('avatar: robot');

  expect(errors).toEqual([]);
});
