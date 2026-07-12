// Segmentation spike driver: fake-webcam fixture → /seg-spike.html →
// window.__SEG_SPIKE → .local/seg-spike-<tag>.json (+ cutout snapshot
// PNG for visual sanity). Perf numbers are only floor evidence from a
// headed GPU run (DISPLAY=:2, flock — same rules as eval/run.mjs).
//
//   node eval/seg-spike.mjs [fixture] [--headless] [--tag=gpu]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const tag = (argv.find((a) => a.startsWith('--tag=')) ?? `--tag=${headless ? 'headless' : 'gpu'}`).split('=')[1];
const fixture = argv.find((a) => !a.startsWith('--')) ?? 'fullbody';
const BASE = `http://localhost:${process.env.PP_PORT ?? '5179'}`;

const y4mCandidates = [
  resolve(root, '.local', 'cache', 'fake-camera', `${fixture}.y4m`),
  resolve(root, 'fixtures', `${fixture}.y4m`),
];
const { existsSync } = await import('node:fs');
const y4m = y4mCandidates.find((p) => existsSync(p));
if (!y4m) {
  console.error(`no y4m for fixture "${fixture}" (tried ${y4mCandidates.join(', ')})`);
  process.exit(1);
}

const swiftShaderArgs = process.env.USE_SWIFTSHADER
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : [];

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
    ...(headless ? swiftShaderArgs : ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']),
  ],
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page] ${m.text()}`);
});
await page.goto(`${BASE}/seg-spike.html`);
const handle = await page.waitForFunction(() => window.__SEG_SPIKE?.done && window.__SEG_SPIKE, undefined, {
  timeout: 180_000,
});
const spike = await handle.jsonValue();
await browser.close();

if (spike.error) {
  console.error(`spike failed: ${spike.error}`);
  process.exit(1);
}

mkdirSync(resolve(root, '.local'), { recursive: true });
const outJson = resolve(root, '.local', `seg-spike-${tag}.json`);
const { cutoutPng, ...rest } = spike;
writeFileSync(outJson, JSON.stringify({ fixture, tag, headless, when: new Date().toISOString(), ...rest }, null, 2));
if (cutoutPng) {
  const png = Buffer.from(cutoutPng.split(',')[1], 'base64');
  writeFileSync(resolve(root, '.local', `seg-spike-${tag}-cutout.png`), png);
}

console.log(`\nsegmentation spike — fixture=${fixture} tag=${tag} headless=${headless}`);
console.log('model      width  del(req)  frames  avg ms  p95 ms  rate/s  cover  flicker');
for (const r of spike.results) {
  console.log(
    `${r.model.padEnd(10)} ${String(r.workingWidth).padEnd(6)} ${r.delegate}(${r.requestedDelegate})`.padEnd(30) +
      ` ${String(r.frames).padEnd(6)} ${String(r.avgLatencyMs).padEnd(7)} ${String(r.p95LatencyMs).padEnd(7)} ` +
      `${String(r.segFps).padEnd(7)} ${String(r.coverageMean).padEnd(6)} ${r.flickerMean}`,
  );
}
console.log(`\nwrote ${outJson}`);
