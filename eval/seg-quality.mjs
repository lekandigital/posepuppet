// Mask-quality eval driver (V7): /seg-eval.html per fixture → IoU vs
// hand-labeled polygons + smoothed edge flicker → eval/seg-quality.json.
// Gates (calibrated for hand-drawn label roughness, see seg-labels/*.json):
//   per-frame IoU ≥ 0.45 · mean IoU ≥ 0.55 · smoothed flicker mean < 0.02
//
//   node eval/seg-quality.mjs            # all labeled fixtures
//   node eval/seg-quality.mjs fullbody   # one fixture
import { chromium } from 'playwright';
import { writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const argv = process.argv.slice(2);
const names = argv.filter((a) => !a.startsWith('--'));
const fixtures = names.length
  ? names
  : readdirSync(resolve(here, 'seg-labels')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const BASE = `http://localhost:${process.env.PP_PORT ?? '5179'}`;

const GATE_FRAME_IOU = 0.45;
const GATE_MEAN_IOU = 0.55;
const GATE_FLICKER = 0.02;

const browser = await chromium.launch({
  headless: true,
  args: process.env.USE_SWIFTSHADER
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : [],
});

const all = [];
let failed = false;
for (const fixture of fixtures) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`[page] ${m.text()}`);
  });
  await page.goto(`${BASE}/seg-eval.html?fixture=${fixture}`);
  const handle = await page.waitForFunction(() => window.__SEG_EVAL?.done && window.__SEG_EVAL, undefined, {
    timeout: 120_000,
  });
  const r = await handle.jsonValue();
  await page.close();
  if (r.error) {
    console.error(`${fixture}: FATAL ${r.error}`);
    failed = true;
    continue;
  }
  const { vizPng, ...rest } = r;
  if (vizPng) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(resolve(root, '.local', 'shots', 'v7'), { recursive: true });
    writeFileSync(
      resolve(root, '.local', 'shots', 'v7', `seg-iou-${fixture}.png`),
      Buffer.from(vizPng.split(',')[1], 'base64'),
    );
  }
  all.push(rest);
  console.log(`\n${fixture}: mean IoU ${r.meanIoU}, flicker ${r.flickerMean} (${r.flickerSamples} masks)`);
  for (const f of r.frames) {
    const ok = f.iou >= GATE_FRAME_IOU;
    if (!ok) failed = true;
    console.log(`  t=${f.tMs}ms IoU ${f.iou} ${ok ? 'PASS' : `FAIL (< ${GATE_FRAME_IOU})`}`);
  }
  if (r.meanIoU < GATE_MEAN_IOU) {
    failed = true;
    console.log(`  mean IoU ${r.meanIoU} FAIL (< ${GATE_MEAN_IOU})`);
  }
  if (r.flickerMean >= GATE_FLICKER) {
    failed = true;
    console.log(`  flicker ${r.flickerMean} FAIL (>= ${GATE_FLICKER})`);
  }
}
await browser.close();

writeFileSync(
  resolve(root, 'eval', 'seg-quality.json'),
  JSON.stringify(
    {
      when: new Date().toISOString(),
      gates: { frameIoU: GATE_FRAME_IOU, meanIoU: GATE_MEAN_IOU, flickerMean: GATE_FLICKER },
      model: 'selfie_segmenter_landscape f16, CPU/XNNPACK, 256px working width',
      fixtures: all,
    },
    null,
    2,
  ),
);
console.log(`\nwrote eval/seg-quality.json — ${failed ? 'GATES FAILED' : 'all gates pass'}`);
process.exit(failed ? 1 : 0);
