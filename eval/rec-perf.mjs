// Recording perf: segmentation OFF (raw) vs ON (cutout), both aspect
// presets, while the composite recorder is actually rolling — the exact
// configuration a take runs in. Floors (render ≥ 45 fps, pose ≥ 15 Hz)
// are only asserted on headed GPU runs (DISPLAY=:2 under the display
// lock); SwiftShader runs record numbers without asserting, same policy
// as eval/run.mjs.
//
//   flock /tmp/bodyarcade-display2.lock -c "DISPLAY=:2 PP_PORT=5179 node eval/rec-perf.mjs"
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const BASE = `http://localhost:${process.env.PP_PORT ?? '5179'}`;

const FLOOR_RENDER = 45;
const FLOOR_POSE = 15;
const SAMPLE_SEC = 12;

const y4m = [
  resolve(root, '.local', 'cache', 'fake-camera', 'fullbody.y4m'),
  resolve(root, 'fixtures', 'fullbody.y4m'),
].find((p) => existsSync(p));
if (!y4m) {
  console.error('no fullbody y4m fixture');
  process.exit(1);
}

// environment sanity (same rationale as eval/run.mjs): a throttled display
// makes every FPS number a lie
if (!headless) {
  const probe = await chromium.launch({ headless: false, args: ['--disable-backgrounding-occluded-windows'] });
  const p = await (await probe.newPage());
  await p.goto('about:blank');
  const rafFps = await p.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const loop = () => {
          n++;
          if (performance.now() - t0 < 1000) requestAnimationFrame(loop);
          else res(n);
        };
        requestAnimationFrame(loop);
      }),
  );
  await probe.close();
  if (rafFps < 50) {
    console.error(`!! environment throttled (blank rAF ${rafFps}/s) — aborting, numbers would be lies`);
    process.exit(1);
  }
}

const rows = [];
let failed = false;
for (const aspect of ['16:9', '9:16']) {
  for (const mode of ['raw', 'cutout']) {
    const browser = await chromium.launch({
      headless,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${y4m}`,
        '--autoplay-policy=no-user-gesture-required',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        ...(headless
          ? process.env.USE_SWIFTSHADER
            ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
            : []
          : ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']),
      ],
    });
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.evaluate(
      ([m, a]) => {
        localStorage.setItem(
          'posepuppet-config-v3',
          JSON.stringify({
            ...JSON.parse(localStorage.getItem('posepuppet-config-v3') ?? '{}'),
            presentMode: m,
            presentAutoTier: false,
            recAspect: a,
            recPackage: false,
          }),
        );
      },
      [mode, aspect],
    );
    await page.reload();
    await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
    await page.waitForFunction(() => window.__PP.detectionCount > 10, undefined, { timeout: 30_000 });
    if (mode !== 'raw') {
      await page.waitForFunction((m) => window.__PP.present?.().effective === m, mode, { timeout: 30_000 });
    }
    // roll the recorder and sample fps while it runs
    await page.locator('#record-btn').click();
    await page.waitForTimeout(1500); // let rates settle with the recorder on
    const render = [];
    const pose = [];
    const t0 = Date.now();
    while (Date.now() - t0 < SAMPLE_SEC * 1000) {
      const s = await page.evaluate(() => ({
        render: window.__PP.renderFps(),
        pose: window.__PP.poseFps(),
        present: window.__PP.present?.(),
      }));
      render.push(s.render);
      pose.push(s.pose);
      await page.waitForTimeout(500);
    }
    const seg = await page.evaluate(() => window.__PP.present?.());
    await page.locator('#record-btn').click();
    await page
      .waitForFunction(() => window.__PP.lastRecording && window.__PP.lastRecording.size > 0, undefined, {
        timeout: 15_000,
      })
      .catch(() => {});
    const rec = await page.evaluate(() => window.__PP.lastRecording);
    await browser.close();

    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const min = (a) => Math.min(...a);
    const row = {
      aspect,
      mode,
      renderAvg: +avg(render).toFixed(1),
      renderMin: +min(render).toFixed(1),
      poseAvg: +avg(pose).toFixed(1),
      segFps: seg?.segFps ?? 0,
      segLatencyMs: seg?.segLatencyMs ?? 0,
      tier: seg?.tier ?? 0,
      fileBytes: rec?.size ?? 0,
      floorsAsserted: !headless,
      renderFloorOk: avg(render) >= FLOOR_RENDER,
      poseFloorOk: avg(pose) >= FLOOR_POSE,
    };
    rows.push(row);
    const verdict = !headless && (!row.renderFloorOk || !row.poseFloorOk) ? 'FLOOR MISS' : 'ok';
    if (verdict !== 'ok') failed = true;
    console.log(
      `${aspect} ${mode.padEnd(6)} render ${row.renderAvg} (min ${row.renderMin})  pose ${row.poseAvg}  ` +
        `seg ${row.segFps}/s @${row.segLatencyMs}ms  file ${(row.fileBytes / 1024).toFixed(0)}KB  ${verdict}`,
    );
  }
}

writeFileSync(
  resolve(root, '.local', `rec-perf${headless ? '-headless' : ''}.json`),
  JSON.stringify(
    { when: new Date().toISOString(), headless, floors: { render: FLOOR_RENDER, pose: FLOOR_POSE }, sampleSec: SAMPLE_SEC, rows },
    null,
    2,
  ),
);
console.log(`\nwrote .local/rec-perf${headless ? '-headless' : ''}.json — ${failed ? 'FLOORS FAILED' : 'floors hold'}`);
process.exit(failed ? 1 : 0);
