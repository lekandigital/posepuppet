// Vision-review captures + recording for EVAL_NOTES (media/walking-v3/,
// gitignored like all media/). Run headed on DISPLAY=:2 under the display
// lock, against the walking dev server:
//   flock /tmp/bodyarcade-display2.lock -c 'DISPLAY=:2 node shots.mjs'
// Captures: spawn, mid-path walking, a curve under assist, dropout
// (SIGNAL LOST + vignette), weight-shift sway, seated glide, plus a webm
// of the full march run for the self-review.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const PAGE = process.env.WALKING_URL ?? 'http://localhost:5175/walking/';
const OUT = new URL('../../media/walking-v3/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });

// --- still board ---------------------------------------------------------
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${PAGE}?drive=march&hz=0.9`);
await page.waitForFunction(() => window.__WALK !== undefined, undefined, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}01-spawn.png` });

await page.waitForFunction(() => window.__WALK.traveled() > 14, undefined, { timeout: 60000 });
await page.screenshot({ path: `${OUT}02-walking-mid-path.png` });
await page.waitForFunction(() => window.__WALK.traveled() > 34, undefined, { timeout: 60000 });
await page.screenshot({ path: `${OUT}03-first-curve-assist.png` });

await page.goto(`${PAGE}?drive=march&hz=0.9&loss=6,4`);
await page.waitForFunction(
  () => window.__WALK?.pose().mode === 'autopilot',
  undefined, { timeout: 40000 },
);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}04-dropout-autopilot.png` });

await page.goto(`${PAGE}?drive=sway&hz=0.55`);
await page.waitForFunction(
  () => window.__WALK?.pose().speed > 0.3 && window.__WALK.hud().source === 'sway',
  undefined, { timeout: 60000 },
);
await page.screenshot({ path: `${OUT}05-weight-shift-sway.png` });

await page.goto(`${PAGE}?drive=glide`);
await page.waitForFunction(
  () => window.__WALK?.pose().mode === 'glide' && window.__WALK.pose().speed > 0.7,
  undefined, { timeout: 60000 },
);
await page.screenshot({ path: `${OUT}06-seated-glide.png` });

await page.goto(`${PAGE}?drive=march&hz=0.9&lean=10`);
// wait past the startup transient: walking established AND vignette up
await page.waitForFunction(
  () => window.__WALK?.traveled() > 6 && window.__WALK.pose().vignette > 0.05,
  undefined, { timeout: 60000 },
).catch(() => {});
await page.screenshot({ path: `${OUT}07-lean-turn-vignette.png` });
await page.close();

// --- recording: one full march run with a dropout ------------------------
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const rec = await ctx.newPage();
await rec.goto(`${PAGE}?drive=march&hz=0.9&loss=14,3`);
await rec.waitForFunction(() => window.__WALK !== undefined, undefined, { timeout: 20000 });
await rec.waitForTimeout(26000); // lead-in, walk, dropout, recovery
await ctx.close();

await browser.close();
console.log('walking graybox media written to', OUT);
