// Jitter-at-rest check: pipes a fixture in as the fake webcam and captures a
// burst of stage-only screenshots over ~10 s. Consecutive frames during the
// person's hold segments must show an identical robot — visible limb-angle
// differences between neighboring frames = jitter the sync metric averages away.
//
//   node scripts/jitter-check.mjs          # arms fixture (default)
//   node scripts/jitter-check.mjs torso
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'media', 'review', 'jitter');
mkdirSync(outDir, { recursive: true });

const fixture = process.argv[2] ?? 'arms';
const SHOTS = 12;
const INTERVAL_MS = 900; // 12 × 0.9 s ≈ 10 s span
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

  const stageClip = { x: 722, y: 28, width: 716, height: 754 }; // right pane only
  for (let i = 0; i < SHOTS; i++) {
    await page.screenshot({
      path: resolve(outDir, `${fixture}-${String(i).padStart(2, '0')}.png`),
      clip: stageClip,
    });
    await page.waitForTimeout(INTERVAL_MS);
  }
  await browser.close();
  console.log(`captured ${SHOTS} stage frames over ${((SHOTS - 1) * INTERVAL_MS) / 1000}s → media/review/jitter/`);
} finally {
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}
