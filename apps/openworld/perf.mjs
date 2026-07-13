// Headed perf + screenshot board driver — DISPLAY=:2 under the display
// lock (perf numbers only come from headed runs; headless SwiftWebGL is
// compositor-throttled). Writes eval/openworld-results.json (repo root)
// and .shots/board/<profile>-<mode>.png.
//
// Usage: DISPLAY=:2 node perf.mjs [profile]

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const profile = process.argv[2] ?? 'low-poly';
const PORT = process.env.OPENWORLD_PORT ?? '5176';
const RESULTS = new URL('../../eval/openworld-results.json', import.meta.url).pathname;

const MODES = [
  { mode: 'flight', drive: 'flylap' },
  { mode: 'walk', drive: 'walkroute' },
  { mode: 'row', drive: 'rowcircuit' },
  { mode: 'dolphin', drive: 'swim' },
  { mode: 'flyover', drive: null },
];

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
mkdirSync('.shots/board', { recursive: true });

const rows = [];
for (const { mode, drive } of MODES) {
  const url = `http://localhost:${PORT}/openworld/?profile=${profile}&mode=${mode}${drive ? `&drive=${drive}` : ''}&hud=0`;
  await page.goto(url);
  await page.waitForFunction(() => window.__OW !== undefined);
  const active = await page.evaluate(() => window.__OW.profile());
  const activeMode = await page.evaluate(() => window.__OW.mode());
  if (active !== profile || (activeMode !== mode)) continue; // unregistered / fallthrough
  await page.waitForTimeout(8000); // warmup (takeoff, drive lead-in)
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => window.__OW.fps()));
  }
  const tris = await page.evaluate(() => window.__OW.triangles());
  const calls = await page.evaluate(() => window.__OW.drawCalls());
  samples.sort((a, b) => a - b);
  const row = {
    profile, mode,
    fpsMedian: samples[5], fpsMin: samples[0], fpsMax: samples[9],
    triangles: tris, drawCalls: calls,
    driven: drive ?? 'none',
  };
  rows.push(row);
  console.log(JSON.stringify(row));
  await page.screenshot({ path: `.shots/board/${profile}-${mode}.png` });
}
await browser.close();

let all = { generated: '', note: '', runs: [] };
if (existsSync(RESULTS)) {
  try { all = JSON.parse(readFileSync(RESULTS, 'utf8')); } catch { /* fresh */ }
}
all.generated = new Date().toISOString();
all.note = 'Headed DISPLAY=:2 (RTX box) under the display lock; synthetic closed-loop drives; pose runtime OFF in these rows (its measured cost lives in eval/runtime-hud-perf.json — V1). Floors: 45 fps game.';
all.runs = [...(all.runs ?? []).filter((r) => r.profile !== profile), ...rows];
writeFileSync(RESULTS, JSON.stringify(all, null, 2) + '\n');
console.log('wrote', RESULTS);
