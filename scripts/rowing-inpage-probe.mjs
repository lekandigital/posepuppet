// V1 rowing validation: the IN-PAGE pipeline (640×360 capture, worker
// detection, FULL model at a given Hz) must still read real strokes from
// the rowing fixture and sustain boat way — the same claim the old
// producer-tab closed-loop spec makes, now with no PosePuppet tab at all.
// Also samples game fps at each detection rate for the tradeoff curve.
//
//   DISPLAY=:2 PP_PORT=5184 node scripts/rowing-inpage-probe.mjs
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PP = `http://localhost:${process.env.PP_PORT ?? '5173'}`;
const cached = resolve(ROOT, '.local/cache/fake-camera/rowing_slow.y4m');
const clip = existsSync(cached) ? cached : resolve(ROOT, 'fixtures/rowing/rowing_slow.y4m');
if (!existsSync(clip)) throw new Error(`fixture missing: ${clip}`);

const rafSample = (seconds) =>
  new Promise((resolveP) => {
    let frames = 0;
    let longFrames = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now) => {
      frames++;
      if (now - last > 25) longFrames++;
      last = now;
      if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
      else
        resolveP({
          fps: Math.round((frames / ((now - t0) / 1000)) * 10) / 10,
          longFramePct: Math.round(((100 * longFrames) / frames) * 10) / 10,
        });
    };
    requestAnimationFrame(tick);
  });

for (const hz of [15, 12]) {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${clip}`,
      '--autoplay-policy=no-user-gesture-required',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${PP}/flight/?autostart=1&row&seed=31415&spawn=137&calm&dethz=${hz}`);
  await page.waitForFunction(
    () => {
      const f = window.__FLIGHT;
      const s = f?.state?.();
      return !!s && window.__POSE_RT?.state() === 'running' && window.__POSE_RT.poseFps() > 5;
    },
    undefined,
    { timeout: 90_000 },
  );
  await page.evaluate(() => window.__FLIGHT.setRowAssist('standard'));
  await page.waitForTimeout(3000);

  // 60 s: the old closed-loop spec's telemetry, through the in-page chain
  const speeds = [];
  const nearShore = [];
  let strokes0 = null;
  let strokes1 = 0;
  let onWaterAll = true;
  const t0 = Date.now();
  const fpsPromise = page.evaluate(rafSample, 55);
  while (Date.now() - t0 < 60_000) {
    const s = await page.evaluate(() => {
      const f = window.__FLIGHT;
      return {
        speed: f.state()?.speed ?? 0,
        count: f.row()?.signal?.stroke?.count ?? 0,
        onWater: f.rowSample()?.onWater ?? true,
        bowClear: f.landProbe?.(0, 1.0) ?? 1,
      };
    });
    if (strokes0 === null && s.count > 0) strokes0 = s.count;
    strokes1 = s.count;
    speeds.push(s.speed);
    nearShore.push(s.bowClear < 1 ? 1 : 0);
    onWaterAll &&= s.onWater;
    await page.waitForTimeout(400);
  }
  const fps = await fpsPromise;
  const open = speeds.filter((_, i) => nearShore[i] === 0);
  const p75 = [...open].sort((a, b) => a - b)[Math.floor(open.length * 0.75)] ?? 0;
  const poseHz = await page.evaluate(() => Math.round(window.__POSE_RT.poseFps() * 10) / 10);
  console.log(
    JSON.stringify({
      detHz: hz,
      poseHz,
      fps,
      openWaterP75: Math.round(p75 * 1000) / 1000,
      openSamples: open.length,
      strokes: strokes1 - (strokes0 ?? 0),
      onWaterAll,
    }),
  );
  await browser.close();
}
