// One-off: measure in-page detectForVideo cost per model on the rowing page.
//   DISPLAY=:2 PP_PORT=5184 node scripts/detect-cost-probe.mjs
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;
const clip = resolve(ROOT, 'fixtures', 'fullbody.y4m');
if (!existsSync(clip)) throw new Error('fixture missing');

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${clip}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${PP}/flight/?autostart=1&row`);
await page.waitForFunction(
  () => window.__POSE_RT?.state() === 'running' && window.__POSE_RT.poseFps() > 5,
  undefined,
  { timeout: 60_000 },
);
const info = await page.evaluate(async () => {
  const rt = window.__POSE_RT;
  const det = rt.detector();
  // sample runtime frame-to-frame cost via a wrapped onFrame handler
  const costs = [];
  let last = 0;
  const unsub = rt.onFrame(() => {
    const now = performance.now();
    if (last) costs.push(now - last);
    last = now;
  });
  // measure long-task pressure while detecting
  const longTasks = [];
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longTasks.push(Math.round(e.duration));
  });
  obs.observe({ entryTypes: ['longtask'] });
  await new Promise((r) => setTimeout(r, 8000));
  unsub();
  obs.disconnect();
  return {
    delegate: det.delegate(),
    poseFps: rt.poseFps(),
    interFrameMsP50: costs.sort((a, b) => a - b)[Math.floor(costs.length / 2)],
    longTaskCount: longTasks.length,
    longTaskTotalMs: longTasks.reduce((s, v) => s + v, 0),
    longTasksTop: longTasks.sort((a, b) => b - a).slice(0, 5),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
