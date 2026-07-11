// Offline prep fetch: OSM relation geometry via Overpass → data/raw/ cache.
// Runs at development time only — the game ships bundled boundary.json and
// NEVER fetches at runtime (non-negotiable). The cached raw response is
// committed so the build is reproducible without network.
//
// Usage: node tools/fetch-boundary.mjs [configs/san-francisco-bay.json] [--force]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const args = process.argv.slice(2);
const force = args.includes('--force');
const configPath = args.filter((a) => !a.startsWith('--'))[0] ?? join(PKG_ROOT, 'configs/san-francisco-bay.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const rawPath = join(PKG_ROOT, config.raw);

if (existsSync(rawPath) && !force) {
  console.log(`${config.raw} exists — using cache (pass --force to refetch)`);
  process.exit(0);
}

const query =
  config.mode === 'coastline-clip'
    ? `[out:json][timeout:90];way["natural"="coastline"](${config.bbox.join(',')});out geom;`
    : `[out:json][timeout:90];rel(${config.source.osmRelation});out geom;`;
console.log(`fetching (${config.mode}) from Overpass…`);
const res = await fetch(OVERPASS, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `data=${encodeURIComponent(query)}`,
});
if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
const json = await res.json();
if (!json.elements?.length) throw new Error('empty Overpass response');
mkdirSync(dirname(rawPath), { recursive: true });
const body = JSON.stringify(json);
writeFileSync(rawPath, rawPath.endsWith('.gz') ? gzipSync(body, { level: 9 }) : body);
console.log(`saved ${config.raw} (${json.elements.length} elements, osm base ${json.osm3s?.timestamp_osm_base})`);
