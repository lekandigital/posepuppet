// Eval runner: pipes each fixture into Chrome as a fake webcam, runs the
// in-page eval collector, and writes eval/results.json.
//
//   npm run eval                      # all fixtures, headed (real perf), 60s each
//   npm run eval -- arms --dur=20     # one fixture, shorter run
//   npm run eval -- --headless       # CI-ish; perf numbers labeled headless
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const dur = Number((argv.find((a) => a.startsWith('--dur=')) ?? '--dur=60').split('=')[1]);
const names = argv.filter((a) => !a.startsWith('--'));
const fixtures = names.length ? names : ['arms', 'torso', 'fast'];
const BASE = 'http://localhost:5173';

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

const results = [];
try {
  for (const fixture of fixtures) {
    const y4m = resolve(root, 'fixtures', `${fixture}.y4m`);
    console.log(`eval: ${fixture} (${dur}s, ${headless ? 'headless' : 'headed'})`);
    const browser = await chromium.launch({
      headless,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${y4m}`,
        '--autoplay-policy=no-user-gesture-required',
        '--enable-precise-memory-info',
      ],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/?eval=${fixture}&dur=${dur}`);
    const handle = await page.waitForFunction(() => window.__EVAL_RESULT, undefined, {
      timeout: (dur + 120) * 1000,
    });
    const result = await handle.jsonValue();
    result.consoleErrors = consoleErrors;
    result.mode = headless ? 'headless (not representative for FPS)' : 'headed';
    results.push(result);
    console.log(
      `  detection ${(result.detectionRate * 100).toFixed(1)}%  pose ${result.poseFps}fps  ` +
        `render ${result.renderFps}fps  upperLimbs ${result.sync.upperLimbsMean ?? '—'}°  ` +
        `errors ${consoleErrors.length}`,
    );
    await browser.close();
  }
} finally {
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}

const out = {
  meta: {
    date: new Date().toISOString(),
    machine: `${os.platform()} ${os.arch()} — ${os.cpus()[0]?.model ?? 'unknown'}`,
    mode: headless ? 'headless' : 'headed',
    durationSecPerFixture: dur,
    note: headless
      ? 'headless run: FPS numbers are NOT representative of real hardware'
      : 'headed run on real hardware; FPS numbers are representative',
  },
  results,
};
mkdirSync(here, { recursive: true });
writeFileSync(resolve(here, 'results.json'), JSON.stringify(out, null, 2));
console.log(`wrote eval/results.json (${results.length} fixtures)`);
