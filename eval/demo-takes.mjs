// Automated evidence takes (V7): records one clip per presentation mode
// (plain 6 s recordings) plus two full scripted takes — the Presentation
// reel and the Cutout duet (the cutout-on-stage signature) — into
// .local/takes/v7/*.webm, with a mid-take poster frame extracted to
// .local/shots/v7/ for the screenshot board / vision self-review.
// Run headed on :2 (real GPU rendering) under the display lock.
//
//   flock /tmp/bodyarcade-display2.lock -c "DISPLAY=:2 PP_PORT=5179 node eval/demo-takes.mjs"
import { chromium } from 'playwright';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const headless = process.argv.includes('--headless');
const BASE = `http://localhost:${process.env.PP_PORT ?? '5179'}`;
const takesDir = resolve(root, '.local', 'takes', 'v7');
const shotsDir = resolve(root, '.local', 'shots', 'v7');
mkdirSync(takesDir, { recursive: true });
mkdirSync(shotsDir, { recursive: true });

const y4m = [
  resolve(root, '.local', 'cache', 'fake-camera', 'fullbody.y4m'),
  resolve(root, 'fixtures', 'fullbody.y4m'),
].find((p) => existsSync(p));

async function boot(patch) {
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
  await page.evaluate((p) => {
    localStorage.setItem(
      'posepuppet-config-v3',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('posepuppet-config-v3') ?? '{}'), ...p }),
    );
  }, patch);
  await page.reload();
  await page.waitForFunction(() => window.__PP?.videoReady === true, undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.__PP.detectionCount > 10, undefined, { timeout: 30_000 });
  return { browser, page };
}

async function saveDownload(page, action, dest, timeout = 120_000) {
  const downloadPromise = page.waitForEvent('download', { timeout });
  await action();
  const download = await downloadPromise;
  await download.saveAs(dest);
  return statSync(dest).size;
}

function poster(webm, png, atSec) {
  try {
    execFileSync('/usr/bin/ffmpeg', ['-loglevel', 'error', '-ss', String(atSec), '-i', webm, '-frames:v', '1', '-y', png]);
  } catch (e) {
    console.warn(`poster extraction failed for ${webm}: ${e.message}`);
  }
}

const evidence = [];

// ── one plain recording per presentation mode ──
for (const mode of ['raw', 'blur', 'cutout', 'silhouette', 'chip', 'stage']) {
  const { browser, page } = await boot({
    presentMode: mode,
    presentAutoTier: false,
    recAspect: '16:9',
    recPackage: true,
    recBadge: true,
    recGrade: true,
  });
  if (mode !== 'raw') {
    await page.waitForFunction((m) => window.__PP.present?.().effective === m, mode, { timeout: 30_000 });
  }
  const dest = resolve(takesDir, `mode-${mode}.webm`);
  const size = await saveDownload(page, async () => {
    await page.locator('#record-btn').click();
    await page.waitForTimeout(6000);
    await page.locator('#record-btn').click();
  }, dest);
  await browser.close();
  poster(dest, resolve(shotsDir, `mode-${mode}.png`), 3.5);
  evidence.push({ name: `mode-${mode}`, size });
  console.log(`mode-${mode}.webm  ${(size / 1024).toFixed(0)}KB`);
}

// ── scripted takes: presentation reel + cutout duet (the signature) ──
for (const [scriptQuery, file, midSec] of [
  ['presentation reel', 'take-presentation-reel', 10],
  ['cutout duet', 'take-cutout-duet', 12],
]) {
  const { browser, page } = await boot({
    presentMode: 'raw',
    presentAutoTier: false,
    recAspect: '16:9',
    recPackage: true,
  });
  await page.waitForFunction(() => window.__PP.detectionCount > 30, undefined, { timeout: 30_000 });
  const dest = resolve(takesDir, `${file}.webm`);
  const size = await saveDownload(page, async () => {
    // the looping fixture sometimes wraps with the person half out of
    // frame — the pre-take framing check rightly rejects that moment, so
    // arm-and-retry until the shot overlay confirms the take started
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.keyboard.press('Meta+k');
      await page.fill('.palette-input', scriptQuery);
      await page.keyboard.press('Enter');
      const armed = await page
        .waitForFunction(
          () => !!document.getElementById('so-eyebrow')?.textContent,
          undefined,
          { timeout: 6000 },
        )
        .then(() => true)
        .catch(() => false);
      if (armed) return;
      await page.waitForTimeout(3000);
    }
    throw new Error(`take never armed: ${scriptQuery}`);
    // the script then runs its natural course (countdown + all shots)
  }, dest, 120_000);
  await browser.close();
  poster(dest, resolve(shotsDir, `${file}.png`), midSec);
  evidence.push({ name: file, size });
  console.log(`${file}.webm  ${(size / 1024).toFixed(0)}KB`);
}

// one vertical signature clip: cutout-on-stage at 9:16
{
  const { browser, page } = await boot({
    presentMode: 'stage',
    presentAutoTier: false,
    recAspect: '9:16',
    recPackage: true,
  });
  await page.waitForFunction(() => window.__PP.present?.().effective === 'stage', undefined, { timeout: 30_000 });
  const dest = resolve(takesDir, 'mode-stage-vertical.webm');
  const size = await saveDownload(page, async () => {
    await page.locator('#record-btn').click();
    await page.waitForTimeout(6000);
    await page.locator('#record-btn').click();
  }, dest);
  await browser.close();
  poster(dest, resolve(shotsDir, 'mode-stage-vertical.png'), 3.5);
  evidence.push({ name: 'mode-stage-vertical', size });
  console.log(`mode-stage-vertical.webm  ${(size / 1024).toFixed(0)}KB`);
}

const zero = evidence.filter((e) => e.size < 10_000);
if (zero.length) {
  console.error(`EMPTY TAKES: ${zero.map((z) => z.name).join(', ')}`);
  process.exit(1);
}
console.log(`\nall ${evidence.length} evidence takes nonzero → ${takesDir}`);
