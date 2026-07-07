// Jitter-floor measurement: drives fixtures/flight/still.y4m through the
// app as a fake webcam, samples the RAW (pre-shaping) axis values after
// neutral capture, and rewrites the MEASURED_DEAD_ZONES block in
// src/defaults.ts with p95 |raw| × 1.2 and provenance. Honesty rule: the
// committed dead zones must be reproducible from this tool + the fixture.
//
//   node packages/body-input/tools/jitter-floor.mjs [--dur=15] [--dry]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const y4m = resolve(root, 'fixtures', 'flight', 'still.y4m');
const defaultsTs = resolve(here, '..', 'src', 'defaults.ts');
const BASE = 'http://localhost:5173';

const argv = process.argv.slice(2);
const dur = Number((argv.find((a) => a.startsWith('--dur=')) ?? '--dur=15').split('=')[1]);
const dry = argv.includes('--dry');

if (!existsSync(y4m)) {
  console.error(`missing ${y4m} — run: npm run prepare-fixtures`);
  process.exit(1);
}

async function serverUp() {
  try {
    await fetch(BASE);
    return true;
  } catch {
    return false;
  }
}

let devServer = null;
if (!(await serverUp())) {
  console.log('starting dev server…');
  devServer = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await serverUp()); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await serverUp())) {
    console.error('dev server failed to start');
    process.exit(1);
  }
}

// headed like eval/run.mjs: headless pose detection runs ~8 Hz (CPU path)
// and would understate the per-frame sample count
const browser = await chromium.launch({
  headless: argv.includes('--headless'),
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${y4m}`,
    '--autoplay-policy=no-user-gesture-required',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});

try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/?avatar=robot`);
  console.log('waiting for tracking + neutral capture…');
  await page.waitForFunction(
    () => window.__BI?.core.getNeutral() !== null && window.__PP?.detectionCount > 10,
    undefined,
    { timeout: 60_000 },
  );

  console.log(`sampling raw axes for ${dur}s…`);
  const samples = await page.evaluate(
    (seconds) =>
      new Promise((resolveSamples) => {
        const rows = [];
        const unsub = window.__BI.source.subscribe(() => {
          const d = window.__BI.core.getDebug();
          const row = {};
          for (const k of Object.keys(d)) row[k] = d[k].raw;
          rows.push(row);
        });
        setTimeout(() => {
          unsub();
          resolveSamples(rows);
        }, seconds * 1000);
      }),
    dur,
  );

  if (samples.length < dur * 15) {
    console.error(`only ${samples.length} samples — tracking too slow, not trusting this run`);
    process.exit(1);
  }

  const axes = Object.keys(samples[0]);
  const stats = {};
  for (const axis of axes) {
    const vals = samples.map((s) => s[axis]).filter((v) => v !== null).map(Math.abs);
    vals.sort((a, b) => a - b);
    const p95 = vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))] : 0;
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const deadZone = Math.min(Math.max(Math.round(p95 * 1.2 * 1000) / 1000, 0.01), 0.2);
    stats[axis] = { n: vals.length, mean, p95, deadZone };
    console.log(
      `${axis.padEnd(13)} n=${String(vals.length).padStart(4)} mean=${mean.toFixed(4)} ` +
        `p95=${p95.toFixed(4)} → deadZone=${deadZone}`,
    );
  }

  if (dry) {
    console.log('(dry run — defaults.ts untouched)');
  } else {
    const date = new Date().toISOString().slice(0, 10);
    const lines = axes.map((a) => `  ${a}: ${stats[a].deadZone},`).join('\n');
    const block =
      `// [jitter-floor:begin] measured from fixtures/flight/still.mp4 by\n` +
      `// tools/jitter-floor.mjs on ${date} (${samples.length} samples over ${dur}s,\n` +
      `// p95 |raw| noise × 1.2, clamped to [0.01, 0.2]). Do not hand-tune —\n` +
      `// re-run the tool instead.\n` +
      `export const MEASURED_DEAD_ZONES: Record<AxisName, number> = {\n${lines}\n};\n` +
      `// [jitter-floor:end]`;
    const src = readFileSync(defaultsTs, 'utf8');
    const re = /\/\/ \[jitter-floor:begin\][\s\S]*?\/\/ \[jitter-floor:end\]/;
    if (!re.test(src)) {
      console.error('marker block not found in defaults.ts');
      process.exit(1);
    }
    writeFileSync(defaultsTs, src.replace(re, block));
    console.log(`wrote measured dead zones into ${defaultsTs}`);
  }
} finally {
  await browser.close();
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}
