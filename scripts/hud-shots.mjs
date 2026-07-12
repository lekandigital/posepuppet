// V1 screenshot board: HUD states across all three games + the Full App,
// for the vision self-review against the frozen visual language.
//
//   DISPLAY=:2 PP_PORT=5184 node scripts/hud-shots.mjs
//
// Writes .local/shots/v1/*.png (gitignored — some frames show fixture
// footage of the user).

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;
const OUT = resolve(ROOT, '.local/shots/v1');
mkdirSync(OUT, { recursive: true });

const clip = resolve(ROOT, 'fixtures', 'fullbody.y4m');
if (!existsSync(clip)) {
  console.error(`fixture missing: ${clip}`);
  process.exit(1);
}

const camArgs = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${clip}`,
  '--autoplay-policy=no-user-gesture-required',
];

const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.png`) });

async function hudReady(page) {
  await page.waitForSelector('[data-testid="pp-hud"]');
  await page
    .waitForFunction(
      () => document.querySelector('[data-testid="pp-hud"]')?.getAttribute('data-state') === 'running',
      undefined,
      { timeout: 60_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
}

// ── live-camera states across the three games ─────────────────────────
{
  const browser = await chromium.launch({ headless: false, args: camArgs });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // flight
  await page.goto(`${PP}/flight/?autostart=1`);
  await hudReady(page);
  await shot(page, 'flight-hud-live');
  await page.locator('[data-testid="pp-hud"]').hover();
  await page.waitForTimeout(400);
  await shot(page, 'flight-hud-expanded');
  await page.keyboard.press('c'); // needs focus — hover only expands
  await page.locator('[data-testid="pp-hud"]').focus();
  await page.keyboard.press('c');
  await page.waitForTimeout(400);
  await shot(page, 'flight-hud-camera-feed');
  await page.locator('[data-testid="pp-hud-toggle"]').click();
  await page.mouse.move(640, 300);
  await page.waitForTimeout(400);
  await shot(page, 'flight-hud-collapsed');

  // rowing (safe-area over the rowing strip)
  await page.goto(`${PP}/flight/?autostart=1&row`);
  await hudReady(page);
  await page.waitForTimeout(3000);
  await shot(page, 'rowing-hud-live');

  // dolphin
  await page.goto(`${PP}/dolphin/`);
  await hudReady(page);
  await shot(page, 'dolphin-hud-live');
  await page.locator('[data-testid="pp-hud"]').focus();
  await page.waitForTimeout(400);
  await shot(page, 'dolphin-hud-expanded');

  // the Full App, post-extraction (visual regression reference)
  await page.goto(`${PP}/`);
  await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await shot(page, 'app-post-extraction-dark');
  await page.keyboard.press('t');
  await page.waitForTimeout(600);
  await shot(page, 'app-post-extraction-light');

  await browser.close();
}

// ── camera-denied states ──────────────────────────────────────────────
{
  const browser = await chromium.launch({
    headless: false,
    args: ['--deny-permission-prompts'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${PP}/flight/?autostart=1`);
  await page.waitForFunction(
    () => /denied|error/.test(document.querySelector('[data-testid="pp-hud"]')?.getAttribute('data-state') ?? ''),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(500);
  await shot(page, 'flight-hud-denied');

  await page.goto(`${PP}/dolphin/`);
  await page.waitForFunction(
    () => /denied|error/.test(document.querySelector('[data-testid="pp-hud"]')?.getAttribute('data-state') ?? ''),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(500);
  await shot(page, 'dolphin-hud-denied');
  await browser.close();
}

console.log(`wrote screenshots to ${OUT}`);
