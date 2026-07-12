// Capability report (V5) — report-only, never a rigging tool.
//
// Loads each curated roster avatar through the REAL app (real loaders, real
// retarget-layer geometry) and reads Avatar.describeCapabilities() off the
// page, then:
//
//   node scripts/capability-report.mjs           # check mode: diff live
//       inspection against data/avatar-capabilities.json; exit 1 on drift
//       or on a capabilities gate that contradicts the rig (mislabel)
//   node scripts/capability-report.mjs --write   # emit
//       data/avatar-capabilities.draft.json for HUMAN review — this script
//       never edits the reviewed manifest itself
//
// localOnly avatars whose file is absent on this machine are skipped with a
// note. Requires the dev server deps (Playwright, vite) — same rig as eval.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInspection, checkManifest, fingersCapable } from './capability-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const manifestPath = resolve(root, 'data', 'avatar-capabilities.json');
const draftPath = resolve(root, 'data', 'avatar-capabilities.draft.json');

const write = process.argv.includes('--write');
const BASE = `http://localhost:${process.env.PP_PORT ?? '5173'}`;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const roster = Object.keys(manifest.avatars);

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
  devServer = spawn('npm', ['run', 'dev', '--', '--port', process.env.PP_PORT ?? '5173', '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await serverUp())) {
    console.error('dev server failed to start');
    process.exit(1);
  }
}

const liveById = {};
try {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${resolve(root, 'fixtures', 'arms.y4m')}`,
      '--autoplay-policy=no-user-gesture-required',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  const page = await browser.newPage();
  for (const id of roster) {
    await page.goto(`${BASE}/?avatar=${id}`);
    try {
      await page.waitForFunction(
        (want) => {
          const caps = window.__PPCaps?.();
          return Boolean(caps && caps.report && caps.id === want);
        },
        id,
        { timeout: 45_000 },
      );
      const caps = await page.evaluate(() => window.__PPCaps());
      liveById[id] = buildInspection(caps.report);
      console.log(
        `inspected ${id}: fingers ${fingersCapable(liveById[id]) ? 'CAPABLE' : 'not capable'}, ` +
          `chains ${JSON.stringify(liveById[id].fingerChains?.left ?? null)}, ` +
          `head ${JSON.stringify(liveById[id].headCollider)}, feet ${liveById[id].feet}`,
      );
    } catch {
      // the app falls back to another avatar when the file is absent —
      // that is "not inspectable here", not an error, for localOnly entries
      liveById[id] = null;
      console.log(`inspected ${id}: NOT LOADABLE on this machine`);
    }
  }
  await browser.close();
} finally {
  if (devServer) process.kill(-devServer.pid, 'SIGTERM');
}

if (write) {
  const draft = JSON.parse(JSON.stringify(manifest));
  for (const id of roster) {
    if (liveById[id]) {
      draft.avatars[id].inspection = liveById[id];
      const caps = draft.avatars[id].capabilities;
      const capable = fingersCapable(liveById[id]);
      // suggest the derived gate, but never clobber a documented demotion
      if (!(caps.fingers === false && capable && caps.fingersNote)) caps.fingers = capable;
      caps.feet = liveById[id].feet;
    }
  }
  writeFileSync(draftPath, JSON.stringify(draft, null, 2) + '\n');
  console.log(`\nwrote ${draftPath} — review it, then copy over the manifest by hand.`);
}

const { issues, checked, skipped } = checkManifest(manifest, liveById);
console.log(`\nchecked: ${checked.join(', ') || '(none)'}`);
if (skipped.length) console.log(`skipped (localOnly, file absent): ${skipped.join(', ')}`);
if (issues.length) {
  console.error(`\nMANIFEST DRIFT (${issues.length}):`);
  for (const i of issues) console.error(`  · ${i}`);
  process.exitCode = write ? 0 : 1; // --write is for producing the fix
} else {
  console.log('manifest matches the live roster — no drift.');
}
