// Vision self-review capture: pipes a fixture in as the fake webcam and
// screenshots the full split screen at several timestamps, so paired
// video-frame + avatar poses land in media/review/ for honest eyeballing.
//
//   node scripts/capture-review.mjs            # all fixtures
//   node scripts/capture-review.mjs arms fast  # subset
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'media', 'review');
mkdirSync(outDir, { recursive: true });

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fixtures = names.length ? names : ['arms', 'torso', 'fast'];
// seconds after detection starts; override: --times=1,2.5,4,...
const timesArg = process.argv.find((a) => a.startsWith('--times='));
const SNAP_TIMES = timesArg
  ? timesArg.slice('--times='.length).split(',').map(Number)
  : [2, 4.5, 7, 9.5, 12];
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
  devServer = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

try {
  for (const fixture of fixtures) {
    const y4m = resolve(root, 'fixtures', `${fixture}.y4m`);
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${y4m}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    await page.goto(BASE);
    await page.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

    let last = 0;
    for (const t of SNAP_TIMES) {
      await page.waitForTimeout((t - last) * 1000);
      last = t;
      await page.screenshot({ path: resolve(outDir, `${fixture}-t${String(t).replace('.', '_')}.png`) });
    }
    await browser.close();
    console.log(`captured ${SNAP_TIMES.length} frames for ${fixture}`);
  }
} finally {
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}
