#!/usr/bin/env node
// worldbake — bake one compact real-world region into a profile-agnostic
// world.json (schema bodyarcade-world/1). Offline-first: `--fetch` fills
// the committed cache; the bake itself never touches the network.
//
//   node worldbake.mjs configs/isafjordur.json [--fetch] [--force-fetch]
//                      [--render] [--out <path>] [--profile-agnostic]
//   node worldbake.mjs --bbox "S,W,N,E" --name <slug> [--seed "lat,lon"]
//   node worldbake.mjs --place "Some Harbor Town" --name <slug>
//
// --bbox/--place write configs/<slug>.json (with defaults you should
// review — especially the water seed and check probes) and then proceed.
// --profile-agnostic is the only mode that exists; the flag is accepted
// and asserted. There is no --profile: styling never enters this tool.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  acquire, bake, writeWorld, WORLDBAKE_ROOT, worldOutPath,
} from './lib/bake.mjs';
import { serializeStable } from './lib/util.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

if (args.some((a) => a === '--profile' || a.startsWith('--profile='))) {
  console.error('worldbake bakes geography, not style. Profiles are a consumer concern (V4); there is no --profile.');
  process.exit(2);
}

const optionValues = new Set(
  ['--bbox', '--place', '--name', '--seed', '--out'].map(opt).filter(Boolean),
);
const positional = args.filter((a) => !a.startsWith('--') && !optionValues.has(a));

async function resolveConfigPath() {
  if (positional[0]) return resolve(positional[0]);
  const name = opt('--name');
  const bbox = opt('--bbox');
  const place = opt('--place');
  if (!bbox && !place) {
    console.error('usage: worldbake <configs/region.json> | --bbox "S,W,N,E" --name slug | --place "Name" --name slug');
    process.exit(2);
  }
  if (!name) {
    console.error('--bbox/--place mode needs --name <slug> for the config and artifact');
    process.exit(2);
  }
  let bboxArr;
  let displayName = name;
  if (bbox) {
    bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(Number.isNaN)) {
      console.error(`--bbox must be "S,W,N,E", got "${bbox}"`);
      process.exit(2);
    }
  } else {
    // Nominatim geocoding, config-creation time only (never at bake time);
    // the resulting bbox is frozen into the config (DATA_SOURCES.md §6)
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'bodyarcade-worldbake/1 (offline bake tool)' } });
    if (!res.ok) throw new Error(`nominatim: HTTP ${res.status}`);
    const hits = await res.json();
    if (!hits.length) throw new Error(`nominatim: no result for "${place}"`);
    displayName = hits[0].display_name.split(',')[0];
    const lat = Number(hits[0].lat);
    const lon = Number(hits[0].lon);
    // clamp to a compact region around the centre (city-sized max is a
    // non-negotiable: ~2.2 km half-extent)
    const dLat = 2200 / 111320;
    const dLon = 2200 / (111320 * Math.cos((lat * Math.PI) / 180));
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    bboxArr = [r4(lat - dLat), r4(lon - dLon), r4(lat + dLat), r4(lon + dLon)];
    console.log(`"${place}" → ${displayName} @ ${lat},${lon} → bbox ${bboxArr.join(',')}`);
  }
  const seedOpt = opt('--seed');
  const config = {
    name,
    displayName,
    bbox: bboxArr,
    terrain: { zoom: 13, cellSizeM: 12 },
    water: {
      ...(seedOpt
        ? { seed: { lat: Number(seedOpt.split(',')[0]), lon: Number(seedOpt.split(',')[1]) } }
        : {}),
      cuts: [],
      islandMinAreaM2: 200,
      simplify: { radialPreSpacingM: 5, minTriangleAreaM2: 30, minRingVerts: 12, maxPasses: 8 },
    },
    simplify: { lineToleranceM2: 1.5, landuse: { radialPreSpacingM: 4, minTriangleAreaM2: 20, minRingVerts: 8 } },
    nav: { rowSpacingM: 40, rowMinShoreClearM: 12 },
    checks: { maxWaterAreaDeltaPct: 1.0, probes: [], settlementProbes: [], settlementCoverM: 60, terrainProbes: [] },
  };
  const path = join(WORLDBAKE_ROOT, 'configs', `${name}.json`);
  if (existsSync(path)) {
    console.error(`${path} already exists — edit it or pass it directly`);
    process.exit(2);
  }
  writeFileSync(path, serializeStable(config));
  console.log(`wrote ${path} — review it (water seed! check probes!) and re-run checks after baking`);
  return path;
}

const configPath = await resolveConfigPath();
const config = JSON.parse(readFileSync(configPath, 'utf8'));

if (flag('--fetch') || flag('--force-fetch')) {
  await acquire(config, { force: flag('--force-fetch') });
  if (flag('--fetch-only')) process.exit(0);
} else {
  // cold cache + network available is still a usable first-run path:
  // fetch iff the cache is missing, loudly
  try {
    await acquire(config, { force: false });
  } catch (err) {
    console.error(`acquire failed (offline? ${err.message}) — proceeding if the cache is warm`);
  }
}

const t0 = Date.now();
const { world, serialized } = bake(config, { render: flag('--render') });
const customOut = opt('--out');
if (customOut) writeFileSync(customOut, serialized);
else writeWorld(config, serialized);

const s = world.stats;
console.log(
  `${world.name}: baked in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${opt('--out') ?? worldOutPath(config)}\n` +
  `  layers: ${Object.entries(s.layerCounts).map(([k, v]) => `${k} ${v}`).join(', ')}\n` +
  `  water: ${s.waterPolygons} polygons${s.water ? ` (area delta ${s.water.areaDeltaPct}%, ${s.water.islands} islands)` : ''}\n` +
  `  nav: walk ${world.nav.walk.stats.nodes}n/${world.nav.walk.stats.edges}e (${world.nav.walk.stats.components} comp), ` +
  `row ${world.nav.row.stats.nodes}n/${world.nav.row.stats.edges}e\n` +
  `  terrain: ${world.terrain.width}x${world.terrain.height} @ ${world.terrain.cellSizeM}m, ` +
  `${world.terrain.minElevationM}..${world.terrain.maxElevationM}m\n` +
  `  spawns: ${world.spawns.map((sp) => sp.kind).join(', ') || 'none'}; transitions: ${world.transitions.length}` +
  (s.notes.length ? `\n  notes: ${s.notes.join('; ')}` : ''),
);
console.log(`  artifact: ${customOut ?? worldOutPath(config)} (${(serialized.length / 1024).toFixed(0)} KiB)`);
