// body-input in the real app: the adapter publishes schema-valid signals
// while the pose loop runs, the BroadcastChannel transport carries no
// landmarks, and the tuner overlay mounts/unmounts via its shortcut.
import { test, expect } from '@playwright/test';
import { assertSignalShape, type BodySignal } from '../packages/body-input/src/index';

test('adapter emits live signals; broadcast is landmark-free; tuner mounts', async ({ page }) => {
  await page.goto('/?avatar=robot');
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

  // signals flow and advance with the pose stream
  const s1 = (await page.evaluate(
    () => (window as unknown as { __BI: { lastSignal(): unknown } }).__BI.lastSignal(),
  )) as BodySignal;
  assertSignalShape(s1);
  await page.waitForTimeout(500);
  const s2 = (await page.evaluate(
    () => (window as unknown as { __BI: { lastSignal(): unknown } }).__BI.lastSignal(),
  )) as BodySignal;
  expect(s2.ts).toBeGreaterThan(s1.ts);

  // a message straight off the cross-page transport is exactly schema-shaped
  const wire = await page.evaluate(
    () =>
      new Promise((res) => {
        const bc = new BroadcastChannel('bodyarcade.body-input.v1');
        bc.onmessage = (ev) => {
          bc.close();
          res(ev.data);
        };
      }),
  );
  assertSignalShape(wire); // throws on any landmark-shaped content

  // tuner overlay: shortcut mounts it with all 8 axis rows, toggles off
  await page.keyboard.press('b');
  await expect(page.locator('.bi-tuner')).toBeVisible();
  await expect(page.locator('.bi-row')).toHaveCount(8);
  await page.keyboard.press('b');
  await expect(page.locator('.bi-tuner')).toHaveCount(0);
});
