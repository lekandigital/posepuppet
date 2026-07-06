// Hand-only mode: landmarks → puppet rig on the hand fixtures. Launches
// its own browser so the fake webcam can stream a hand clip instead of
// the default body fixture. Skips when local fixtures are absent
// (footage is never committed).
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const handClip = resolve(root, 'fixtures', 'hand_open_close.y4m');

async function launchWithClip(clip: string): Promise<Browser> {
  return chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${clip}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

async function bootHandMode(browser: Browser, puppet: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:5173/?mode=hand&puppet=${puppet}`);
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 45_000 });
  return page;
}

test.describe('hand-only mode', () => {
  test.skip(!existsSync(handClip), 'hand_open_close.y4m missing (local fixture)');

  for (const puppet of ['beaky', 'hand', 'xray'] as const) {
    test(`${puppet}: hand landmarks drive the puppet without errors`, async () => {
      const browser = await launchWithClip(handClip);
      const errors: string[] = [];
      try {
        const page = await bootHandMode(browser, puppet);
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

        // hand detections flow (counter is fed by the hand detector here)
        await page.waitForFunction(() => window.__PP.detectionCount > 20, undefined, { timeout: 30_000 });

        // the mode is visibly active: selector pressed, stage label says so
        await expect(page.locator('#mode-hand')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#stage-label')).toContainText('HAND-ONLY');

        // hand roster cards replaced the avatar cards
        await expect(page.locator(`#avatar-cards .card[data-puppet="${puppet}"]`)).toBeVisible();

        // render loop alive
        const fps = await page.evaluate(() => window.__PP.renderFps());
        expect(fps).toBeGreaterThan(5);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }

  test('mode switch back to character restarts pose tracking', async () => {
    const browser = await launchWithClip(resolve(root, 'fixtures', 'arms.y4m'));
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto('http://localhost:5173/?mode=hand&puppet=beaky');
      // wait for the mode system to be live (boot applyMode sets this),
      // not just the video — clicking earlier hits unbound buttons
      await expect(page.locator('#mode-hand')).toHaveAttribute('aria-pressed', 'true', { timeout: 45_000 });
      await page.click('#mode-character');
      // pose detections resume on a body clip
      const before = await page.evaluate(() => window.__PP.detectionCount);
      await page.waitForFunction(
        (b) => window.__PP.detectionCount > b + 10,
        before,
        { timeout: 30_000 },
      );
      await expect(page.locator('#mode-character')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#stage-label')).toContainText('CHARACTER');
    } finally {
      await browser.close();
    }
  });
});
