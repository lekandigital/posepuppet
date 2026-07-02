// Recording director + gesture seed verification:
// - intent detector unit tests (synthetic landmark sequences: raise-both-
//   arms starts, crossed wrists stop, stillness reads)
// - browser take flow: a guided script runs shot-by-shot and the recorder
//   produces a nonzero file; both aspect presets record nonzero files
import { test, expect } from '@playwright/test';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { createIntentDetector } from '../src/gesture/intent';

const lm = (x: number, y: number, z: number, visibility = 1): LandmarkPoint => ({ x, y, z, visibility });
const blank = () => Array.from({ length: 33 }, () => lm(0.5, 0.5, 0, 1));

/** normalized-space person: nose at (0.5, 0.3), shoulders at y 0.42 */
function person(leftWrist: [number, number], rightWrist: [number, number]): LandmarkPoint[] {
  const n = blank();
  n[LM.nose] = lm(0.5, 0.3, 0);
  n[LM.leftShoulder] = lm(0.62, 0.42, 0);
  n[LM.rightShoulder] = lm(0.38, 0.42, 0);
  n[LM.leftWrist] = lm(leftWrist[0], leftWrist[1], 0);
  n[LM.rightWrist] = lm(rightWrist[0], rightWrist[1], 0);
  return n;
}

test('intent: both wrists above the head for ~1 s fires take:start once', () => {
  const det = createIntentDetector();
  const fired: string[] = [];
  det.onIntent((i) => fired.push(i));

  // arms up (above nose y=0.3 − 0.06 margin) for 1.2 s at 30 fps
  for (let i = 0; i < 36; i++) {
    det.onLandmarks(person([0.6, 0.18], [0.4, 0.18]), i * 33);
  }
  expect(fired).toEqual(['take:start']);

  // holding longer does NOT refire within the cooldown
  for (let i = 36; i < 60; i++) {
    det.onLandmarks(person([0.6, 0.18], [0.4, 0.18]), i * 33);
  }
  expect(fired).toEqual(['take:start']);
});

test('intent: crossed wrists at chest fires take:stop; arms down fires nothing', () => {
  const det = createIntentDetector();
  const fired: string[] = [];
  det.onIntent((i) => fired.push(i));

  // arms hanging: nothing
  for (let i = 0; i < 40; i++) det.onLandmarks(person([0.64, 0.7], [0.36, 0.7]), i * 33);
  expect(fired).toEqual([]);

  // crossed at the chest: left wrist right of midline, right wrist left of it
  for (let i = 40; i < 80; i++) det.onLandmarks(person([0.46, 0.44], [0.54, 0.44]), i * 33);
  expect(fired).toEqual(['take:stop']);
});

test('intent: stillness detector reads a held pose', () => {
  const det = createIntentDetector();
  for (let i = 0; i < 50; i++) {
    det.onLandmarks(person([0.6, 0.5 + Math.sin(i) * 0.002], [0.4, 0.5]), i * 33);
  }
  expect(det.holdingStill()).toBe(true);
  // now wave
  for (let i = 50; i < 90; i++) {
    det.onLandmarks(person([0.6, 0.5 + Math.sin(i * 0.5) * 0.1], [0.4, 0.5]), i * 33);
  }
  expect(det.holdingStill()).toBe(false);
});

for (const aspect of ['16:9', '9:16'] as const) {
  test(`aspect ${aspect}: recording produces a nonzero playable file`, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
    // set the preset through the same config the palette toggles
    await page.evaluate((a) => {
      localStorage.setItem(
        'posepuppet-config-v3',
        JSON.stringify({ ...JSON.parse(localStorage.getItem('posepuppet-config-v3') ?? '{}'), recAspect: a }),
      );
    }, aspect);
    await page.reload();
    await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });

    const btn = page.locator('#record-btn');
    const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
    await btn.click();
    await page.waitForTimeout(3200);
    await btn.click(); // stop early → end card plays, then the file saves

    const download = await downloadPromise;
    const expectTag = aspect === '9:16' ? /posepuppet-vertical-.*\.webm$/ : /posepuppet-((?!vertical).)*\.webm$/;
    expect(download.suggestedFilename()).toMatch(expectTag);
    const rec = await page.waitForFunction(
      () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
      undefined,
      { timeout: 15_000 },
    );
    const { size } = (await rec.jsonValue()) as { size: number };
    expect(size).toBeGreaterThan(10_000);
  });
}

test('guided take: script runs shot-by-shot and records a nonzero file', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
  // wait until detection flows (framing check needs landmarks)
  await page.waitForFunction(() => window.__PP.detectionCount > 20, undefined, { timeout: 30_000 });

  // launch the character take via the palette
  await page.keyboard.press('Meta+k');
  await page.fill('.palette-input', 'character take');
  await page.keyboard.press('Enter');

  // countdown (3 s) then shot 1 overlay appears
  await expect(page.locator('#shot-overlay')).toBeVisible();
  await page.waitForFunction(
    () => document.getElementById('so-eyebrow')?.textContent?.startsWith('Shot 1'),
    undefined,
    { timeout: 10_000 },
  );

  // space advances the shots
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  // script finished → recorder stopped → file saved
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
  const rec = await page.waitForFunction(
    () => window.__PP.lastRecording && window.__PP.lastRecording.size > 0 && window.__PP.lastRecording,
    undefined,
    { timeout: 15_000 },
  );
  const { size } = (await rec.jsonValue()) as { size: number };
  expect(size).toBeGreaterThan(10_000);
  await expect(page.locator('#shot-overlay')).toBeHidden();
});
