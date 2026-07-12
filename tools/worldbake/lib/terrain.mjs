// Acquire stage, raster half: terrarium elevation tiles → cached PNGs →
// a regular local-metre heightfield. Terrarium encoding:
// elevM = (R·256 + G + B/256) − 32768 (DATA_SOURCES.md §2).
//
// The heightfield is sampled at grid NODES (row-major, row 0 = south),
// bilinearly interpolated from the tile mosaic in Web-Mercator pixel
// space. Everything is pure float math over cached bytes — byte-stable.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './png.mjs';
import { roundDm } from './util.mjs';

const DEG = Math.PI / 180;
const TILE = 256;

export const TERRAIN_URL = (z, x, y) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const mercX = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z;
const mercY = (lat, z) =>
  ((1 - Math.asinh(Math.tan(lat * DEG)) / Math.PI) / 2) * TILE * 2 ** z;

/** Tile list covering a lat/lon bbox [S, W, N, E] at zoom z. */
export function tilesForBbox(bboxLatLon, z) {
  const [s, w, n, e] = bboxLatLon;
  const x0 = Math.floor(mercX(w, z) / TILE);
  const x1 = Math.floor(mercX(e, z) / TILE);
  const y0 = Math.floor(mercY(n, z) / TILE); // north = smaller y
  const y1 = Math.floor(mercY(s, z) / TILE);
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ z, x, y });
  return tiles;
}

const tilePath = (cacheDir, t) => join(cacheDir, 'tiles', `terrarium-${t.z}-${t.x}-${t.y}.png`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch missing tiles into the cache. Returns the tile paths. */
export async function acquireTerrain(config, cacheDir, { force = false } = {}) {
  const z = config.terrain?.zoom ?? 13;
  const tiles = tilesForBbox(config.bbox, z);
  const paths = [];
  let fetched = 0;
  for (const t of tiles) {
    const path = tilePath(cacheDir, t);
    paths.push(path);
    if (existsSync(path) && !force) continue;
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        const res = await fetch(TERRAIN_URL(t.z, t.x, t.y));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        decodePng(buf); // validate before caching
        mkdirSync(join(cacheDir, 'tiles'), { recursive: true });
        writeFileSync(path, buf);
        ok = true;
        fetched++;
      } catch (err) {
        if (attempt === 3) throw new Error(`terrain tile ${t.z}/${t.x}/${t.y}: ${err.message}`);
        await sleep(3000 * (attempt + 1));
      }
    }
  }
  if (fetched > 0) console.log(`  fetched ${fetched}/${tiles.length} terrain tiles (z${z})`);
  return { zoom: z, tiles, paths };
}

/** Mosaic of decoded tiles addressable by global mercator pixel. */
function loadMosaic(cacheDir, tiles) {
  const byKey = new Map();
  for (const t of tiles) {
    const png = decodePng(readFileSync(tilePath(cacheDir, t)));
    if (png.width !== TILE || png.height !== TILE || png.channels < 3) {
      throw new Error(`terrain tile ${t.z}/${t.x}/${t.y}: unexpected shape ${png.width}x${png.height}x${png.channels}`);
    }
    byKey.set(`${t.x},${t.y}`, png);
  }
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const elevAtPixel = (pxIn, pyIn) => {
    // clamp to the mosaic's pixel extent, then look up the owning tile
    const px = Math.min(Math.max(pxIn, x0 * TILE), (x1 + 1) * TILE - 1);
    const py = Math.min(Math.max(pyIn, y0 * TILE), (y1 + 1) * TILE - 1);
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const png = byKey.get(`${tx},${ty}`);
    const i = ((py - ty * TILE) * TILE + (px - tx * TILE)) * png.channels;
    return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
  };
  return { elevAtPixel };
}

/**
 * Sample the heightfield: grid nodes every cellSizeM across the projected
 * bbox, bilinear in mercator pixel space. proj must expose lat0/lon0 (the
 * shared world projection) — the inverse tangent-plane math mirrors
 * packages/world-data makeProjection.
 */
export function buildHeightmap(config, cacheDir, proj, bboxM, acquired) {
  const cell = config.terrain?.cellSizeM ?? 10;
  // optional floor for coarse offshore bathymetry (ETOPO1-class sources
  // can report kilometre-deep cells inside a harbour) — a documented,
  // stated transform, never silent: count lands in the artifact stats
  const clampMin = config.terrain?.clampMinM ?? null;
  let clampedCells = 0;
  const [minx, miny, maxx, maxy] = bboxM;
  const width = Math.floor((maxx - minx) / cell) + 1;
  const height = Math.floor((maxy - miny) / cell) + 1;
  const mosaic = loadMosaic(cacheDir, acquired.tiles);
  const z = acquired.zoom;
  const cosLat0 = Math.cos(proj.lat0 * DEG);
  const R = proj.earthRadiusM;
  const heights = new Float64Array(width * height);
  let minE = Infinity;
  let maxE = -Infinity;
  for (let j = 0; j < height; j++) {
    const y = miny + j * cell;
    const lat = y / (R * DEG) + proj.lat0;
    for (let i = 0; i < width; i++) {
      const x = minx + i * cell;
      const lon = x / (R * DEG * cosLat0) + proj.lon0;
      // bilinear between pixel centres
      const px = mercX(lon, z) - 0.5;
      const py = mercY(lat, z) - 0.5;
      const px0 = Math.floor(px);
      const py0 = Math.floor(py);
      const fx = px - px0;
      const fy = py - py0;
      const e00 = mosaic.elevAtPixel(px0, py0);
      const e10 = mosaic.elevAtPixel(px0 + 1, py0);
      const e01 = mosaic.elevAtPixel(px0, py0 + 1);
      const e11 = mosaic.elevAtPixel(px0 + 1, py0 + 1);
      let e = (e00 * (1 - fx) + e10 * fx) * (1 - fy) + (e01 * (1 - fx) + e11 * fx) * fy;
      if (clampMin !== null && e < clampMin) { e = clampMin; clampedCells++; }
      const rounded = roundDm(e);
      heights[j * width + i] = rounded;
      if (rounded < minE) minE = rounded;
      if (rounded > maxE) maxE = rounded;
    }
  }
  return {
    width,
    height,
    cellSizeM: cell,
    originX: roundDm(minx),
    originY: roundDm(miny),
    minElevationM: minE,
    maxElevationM: maxE,
    sourceZoom: z,
    clampMinM: clampMin,
    clampedCells,
    heights,
  };
}

/** Bilinear height lookup on the built (unquantized) grid — used by the
 *  spawn stage and checks. Mirrors the runtime heightAt in src/world.ts. */
export function heightAt(hm, x, y) {
  const gx = (x - hm.originX) / hm.cellSizeM;
  const gy = (y - hm.originY) / hm.cellSizeM;
  const cx = Math.min(Math.max(gx, 0), hm.width - 1);
  const cy = Math.min(Math.max(gy, 0), hm.height - 1);
  const x0 = Math.min(Math.floor(cx), hm.width - 2);
  const y0 = Math.min(Math.floor(cy), hm.height - 2);
  const fx = cx - x0;
  const fy = cy - y0;
  const h = hm.heights;
  const w = hm.width;
  return (
    (h[y0 * w + x0] * (1 - fx) + h[y0 * w + x0 + 1] * fx) * (1 - fy) +
    (h[(y0 + 1) * w + x0] * (1 - fx) + h[(y0 + 1) * w + x0 + 1] * fx) * fy
  );
}
