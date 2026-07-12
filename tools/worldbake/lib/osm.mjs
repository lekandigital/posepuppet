// Acquire stage, vector half: one Overpass extract per region covering
// every layer the schema emits, cached gzipped + checksummed under
// cache/<region>/. The bake itself NEVER touches the network — fetch is
// a separate explicit step, and re-bakes are offline (non-negotiable).
//
// Endpoint reality, verified live 2026-07-11 (see DATA_SOURCES.md):
// overpass-api.de 406s on undescriptive User-Agents and has publicized
// instability; the kumi.systems mirror throws occasional transient
// dispatcher errors. So: descriptive UA always, mirrors in rotation,
// retries with backoff — single-shot fetching is treated as broken by
// design.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonGz, writeJsonGz } from './util.mjs';

export const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const USER_AGENT = 'bodyarcade-worldbake/1 (offline bake tool; github.com/bodyarcade)';

/** The one extract query: every tag family the normalize stage consumes. */
export function extractQuery(bboxLatLon) {
  const b = bboxLatLon.join(',');
  return `[out:json][timeout:180];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"](${b});
  way["natural"="coastline"](${b});
  way["waterway"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["natural"~"^(wood|scrub|heath|grassland|beach|sand|bare_rock|scree|wetland|glacier)$"](${b});
  way["landuse"](${b});
  way["leisure"~"^(park|pitch|marina|garden|playground|golf_course|nature_reserve)$"](${b});
  way["aeroway"](${b});
  node["aeroway"](${b});
  way["man_made"~"^(pier|breakwater|quay)$"](${b});
  way["boundary"="administrative"](${b});
  relation["boundary"="administrative"](${b});
);
out geom;`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpassFetch(query) {
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error(`${endpoint} → no elements array`);
      return json;
    } catch (err) {
      lastErr = err;
      const wait = 5000 * (attempt + 1);
      console.warn(`  overpass attempt ${attempt + 1} failed (${err.message}); retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw new Error(`overpass: all attempts failed: ${lastErr?.message}`);
}

export const osmCachePath = (cacheDir) => join(cacheDir, 'osm-extract.json.gz');

/** Fetch the extract into the cache (no-op when cached, --force-fetch to
 *  refresh). Returns { path, fetched }. */
export async function acquireOsm(config, cacheDir, { force = false } = {}) {
  const path = osmCachePath(cacheDir);
  if (existsSync(path) && !force) return { path, fetched: false };
  console.log(`fetching OSM extract for ${config.name}…`);
  const json = await overpassFetch(extractQuery(config.bbox));
  if (json.elements.length === 0) throw new Error('overpass: empty extract — check the bbox');
  writeJsonGz(path, json);
  console.log(`  saved ${path} (${json.elements.length} elements, osm base ${json.osm3s?.timestamp_osm_base})`);
  return { path, fetched: true };
}

export function readOsmExtract(cacheDir) {
  return readJsonGz(osmCachePath(cacheDir));
}

/** Gzip just the coastline ways of the extract into a standalone raw file —
 *  the exact input shape the absorbed boundary pipeline's coastline-clip
 *  mode consumes (packages/world-data/tools/build-boundary.mjs). */
export function writeCoastlineRaw(extract, path) {
  const coastline = {
    version: extract.version,
    generator: extract.generator,
    osm3s: extract.osm3s,
    elements: extract.elements.filter(
      (e) => e.type === 'way' && e.tags?.natural === 'coastline',
    ),
  };
  writeJsonGz(path, coastline);
  return coastline.elements.length;
}
