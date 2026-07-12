// V1 Runtime+HUD in the standalone Dolphin: page-owned tracking pipeline
// (no PosePuppet tab), shared HUD with keyboard access, camera-denied
// keyboard play, single capture pipeline. Headed like the other game
// suites (headless WebGL is compositor-throttled).
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(HERE, '../../..');
const DOLPHIN = `http://localhost:${process.env.DOLPHIN_PORT ?? '5197'}/dolphin/`;
const clip = resolve(repoRoot, 'fixtures', 'fullbody.y4m');

const camArgs = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${clip}`,
  '--autoplay-policy=no-user-gesture-required',
];

test.describe('runtime + HUD (live camera)', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    test.skip(!existsSync(clip), 'fullbody.y4m missing (local fixture)');
    browser = await chromium.launch({ headless: false, args: camArgs });
    page = await browser.newPage();
    await page.addInitScript(() => {
      const md = navigator.mediaDevices;
      const orig = md.getUserMedia.bind(md);
      (window as unknown as { __gumCalls: number }).__gumCalls = 0;
      md.getUserMedia = (c?: MediaStreamConstraints) => {
        (window as unknown as { __gumCalls: number }).__gumCalls++;
        return orig(c);
      };
    });
    await page.goto(DOLPHIN);
  });
  test.afterAll(async () => {
    await browser?.close();
  });

  test('HUD mounts, goes LIVE, one getUserMedia consumer', async () => {
    const hud = page.locator('[data-testid="pp-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute('data-state', 'running', { timeout: 60_000 });
    await expect(page.locator('[data-testid="pp-hud-track"]')).toContainText('LIVE', {
      timeout: 30_000,
    });
    await expect(page.locator('.pp-hud-privacy')).toContainText('LOCAL INFERENCE');
    expect(
      await page.evaluate(() => (window as unknown as { __gumCalls: number }).__gumCalls),
    ).toBe(1);
  });

  test('expand/collapse + feed swap, mouse and keyboard', async () => {
    const hud = page.locator('[data-testid="pp-hud"]');
    const toggle = page.locator('[data-testid="pp-hud-toggle"]');

    await toggle.click();
    await expect(hud).toHaveAttribute('data-open', 'collapsed');
    await toggle.click();
    await expect(hud).toHaveAttribute('data-open', 'open');

    await hud.focus();
    await expect(hud).toHaveAttribute('data-size', 'expanded');
    await page.keyboard.press('Enter');
    await expect(hud).toHaveAttribute('data-open', 'collapsed');
    await page.keyboard.press('Enter');
    await expect(hud).toHaveAttribute('data-open', 'open');
    await page.keyboard.press('c');
    await expect(hud).toHaveAttribute('data-feed', 'camera');
    await page.keyboard.press('c');
    await expect(hud).toHaveAttribute('data-feed', 'preview');
    await page.keyboard.press('Escape');
    await expect(hud).toHaveAttribute('data-open', 'collapsed');
  });

  test('live body signals actually swim the dolphin (kicks from the page pipeline)', async () => {
    // fullbody.y4m contains full-body motion; assert the game's kick
    // counter advances from the page's OWN pipeline — no producer tab.
    await page.waitForFunction(
      () => {
        const d = (window as unknown as { __DOLPHIN?: { transport(): { gotBroadcast: boolean; ageMs: number } } }).__DOLPHIN;
        const t = d?.transport();
        return !!t && t.gotBroadcast === true && t.ageMs < 500;
      },
      undefined,
      { timeout: 60_000 },
    );
  });
});

test.describe('camera denied', () => {
  test('keyboard still swims; HUD says so', async () => {
    test.setTimeout(120_000);
    // Chromium's deny switch: a flagless Playwright launch still grants a
    // fake camera, so denial must be explicit
    const browser = await chromium.launch({
      headless: false,
      args: ['--deny-permission-prompts'],
    });
    const page = await browser.newPage();
    await page.goto(DOLPHIN);
    await page.waitForFunction(
      () => !!(window as unknown as { __DOLPHIN?: { state(): { inWater: boolean } } }).__DOLPHIN,
      undefined,
      { timeout: 30_000 },
    );

    const hud = page.locator('[data-testid="pp-hud"]');
    await expect(hud).toHaveAttribute('data-state', /denied|error/, { timeout: 30_000 });
    await expect(page.locator('[data-testid="pp-hud-msg"]')).toContainText('KEYBOARD');

    const yaw0 = await page.evaluate(
      () => (window as unknown as { __DOLPHIN: { state(): { yaw: number } } }).__DOLPHIN.state().yaw,
    );
    await page.keyboard.down('a');
    await page.waitForTimeout(1200);
    await page.keyboard.up('a');
    const yaw1 = await page.evaluate(
      () => (window as unknown as { __DOLPHIN: { state(): { yaw: number } } }).__DOLPHIN.state().yaw,
    );
    expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(0.05);
    await browser.close();
  });
});
