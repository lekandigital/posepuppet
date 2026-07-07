// PPC masked-fixture eval: each mask spec runs twice — PPC on and off
// (legacy) — against the same synthetic occlusion windows. Writes
// eval/ppc-results.json (NEVER eval/results.json: that file is the
// fully-visible baseline).
//
//   node eval/run-ppc.mjs                 # all mask specs, 60 s each, headed
//   node eval/run-ppc.mjs arms_hand_exit --dur=30
//   node eval/run-ppc.mjs --headless      # sync/error metrics only

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// mask → fixture map (window definitions live in src/eval/masks.ts)
const SPECS = {
  arms_hand_exit: 'arms',
  facetouch_face_cross: 'facetouch',
  fullbody_foot_out: 'fullbody',
  fast_dropout: 'fast',
};

const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const dur = Number((argv.find((a) => a.startsWith('--dur=')) ?? '--dur=60').split('=')[1]);
const names = argv.filter((a) => !a.startsWith('--'));
const masks = names.length ? names : Object.keys(SPECS);
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

async function runOne(mask, fixture, ppc) {
  const y4m = resolve(root, 'fixtures', `${fixture}.y4m`);
  const browser = await chromium.launch({
    headless,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  const extra = fixture === 'fullbody' ? '&body=full' : '';
  await page.goto(
    `${BASE}/?eval=${fixture}&dur=${dur}&avatar=robot&mask=${mask}&ppc=${ppc ? 1 : 0}${extra}`,
  );
  const handle = await page.waitForFunction(() => window.__EVAL_RESULT, undefined, {
    timeout: (dur + 120) * 1000,
  });
  const result = await handle.jsonValue();
  result.consoleErrors = consoleErrors;
  await browser.close();
  return result;
}

const results = [];
try {
  for (const mask of masks) {
    const fixture = SPECS[mask];
    if (!fixture) {
      console.error(`unknown mask spec: ${mask}`);
      continue;
    }
    for (const ppc of [true, false]) {
      const label = `${mask} ppc=${ppc ? 1 : 0}`;
      console.log(`ppc-eval: ${label} (${fixture}, ${dur}s, ${headless ? 'headless' : 'headed'})`);
      const r = await runOne(mask, fixture, ppc);
      const e = r.ppc?.posErr;
      console.log(
        `  maskedFrames ${r.ppc?.maskedFrames ?? 0}  predSamples ${r.ppc?.predictedSamples ?? 0}` +
          (e ? `  posErr ppc ${e.ppcMean}m/p95 ${e.ppcP95}m vs hold ${e.holdMean}m/p95 ${e.holdP95}m` : '') +
          `  reentryMax ${r.ppc?.reentryMaxDelta ?? '—'}m  horizon ${r.ppc?.horizonMaxMs ?? '—'}ms` +
          `  NaN ${r.ppc?.nanCount ?? '—'}  syncMaskedUpper ${r.ppc?.syncMasked?.upperLimbsMean ?? '—'}°` +
          `  syncMaskedLegs ${r.ppc?.syncMasked?.legsMean ?? '—'}°  errors ${r.consoleErrors.length}`,
      );
      results.push(r);
    }
  }

  const out = {
    meta: {
      date: new Date().toISOString(),
      machine: `${os.platform()} ${os.arch()}`,
      mode: headless ? 'headless (not representative for FPS)' : 'headed',
      durationSecPerRun: dur,
      note:
        'PPC masked-fixture eval: synthetic occlusion windows over real fixtures; ' +
        'sync sampled against the pre-mask truth stream; posErr during PREDICTED vs ' +
        'same-frame truth, legacy comparator = hold-last-visible.',
    },
    results,
  };
  writeFileSync(resolve(here, 'ppc-results.json'), JSON.stringify(out, null, 2));
  console.log(`wrote eval/ppc-results.json (${results.length} runs)`);
} finally {
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}
