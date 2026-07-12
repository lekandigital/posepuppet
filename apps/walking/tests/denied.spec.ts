// Camera-denied law: the graybox in LIVE mode (real pose-runtime boot)
// must remain fully playable on the keyboard when the camera is refused.
import { test, expect } from '@playwright/test';

test.use({
  launchOptions: { args: ['--deny-permission-prompts'] },
});

test('camera denied → keyboard walk still works; coach says so', async ({ page }) => {
  await page.goto('/walking/');
  // headless auto-deny can surface as 'error' rather than 'denied' — the
  // documented tolerance from the Dolphin suite; both mean "no camera"
  await page.waitForFunction(
    () => {
      const s = (window as never as { __WALK?: { runtimeState(): string } }).__WALK?.runtimeState();
      return s === 'denied' || s === 'error';
    },
    undefined, { timeout: 30_000 },
  );
  // coach line points at the keyboard
  await expect(page.getByTestId('walk-coach')).toContainText('W A S D', { timeout: 10_000 });

  await page.keyboard.down('w');
  await page.waitForTimeout(2000);
  const speed = await page.evaluate(
    () => (window as never as { __WALK: { pose(): { speed: number } } }).__WALK.pose().speed,
  );
  await expect(page.getByTestId('walk-status')).toHaveText('KEYBOARD'); // while held
  await page.keyboard.up('w');
  expect(speed).toBeGreaterThan(1.0);
});
