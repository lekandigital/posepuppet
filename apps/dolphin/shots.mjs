// One-off vision-review captures for EVAL_NOTES (media/dolphin-p3/,
// gitignored like all media/). Run with DISPLAY=:2 against the dolphin
// dev server; drives the game with the same postMessage pump the suite
// uses and screenshots four moments: spawn, cruise among fish/kelp,
// deep dive near the seabed, and the surface from below.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const PAGE_URL = process.env.DOLPHIN_URL ?? 'http://localhost:5197/dolphin/';
const OUT = new URL('../../media/dolphin-p3/', import.meta.url).pathname; // script lives in apps/dolphin/
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL);
await page.waitForFunction(() => window.__DOLPHIN?.state().inWater === true, undefined, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}spawn.png` });

await page.evaluate(() => {
  const w = window;
  w.__swim = { rateHz: 0.9, amp: 0.7, leanX: 0, leanY: 0, crouch: 0, tallness: 0, handsForward: 0, count: 0, nextAt: 0 };
  const emit = () => {
    requestAnimationFrame(emit);
    const r = w.__swim;
    const now = performance.now();
    if (r.rateHz > 0) {
      if (r.nextAt === 0) r.nextAt = now + 1000 / r.rateHz;
      if (now >= r.nextAt) { r.count++; r.nextAt += 1000 / r.rateHz; }
    }
    window.postMessage({ t: 'bodyarcade.body-input.v1', signal: {
      v: 1, ts: now, confidence: 1, seated: false, stillness: 0.2, neutralConfidence: 1,
      axes: { leanX: r.leanX, leanY: r.leanY, crouch: r.crouch, tallness: r.tallness, armsOut: 0, armsRaised: 0, handsForward: r.handsForward, handPoint: 0 },
      events: [],
      swim: { active: r.rateHz > 0, count: r.count, rate: r.rateHz, phase: 0.5, amp: r.amp },
    } }, '*');
  };
  requestAnimationFrame(emit);
});
await page.waitForTimeout(9000);
await page.screenshot({ path: `${OUT}cruise.png` });

await page.evaluate(() => Object.assign(window.__swim, { leanY: 0.8 }));
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}deep.png` });

await page.evaluate(() => Object.assign(window.__swim, { leanY: -0.6 }));
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}surface.png` });

await browser.close();
console.log('shots written to', OUT);
