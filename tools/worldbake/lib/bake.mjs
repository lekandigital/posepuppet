// The bake orchestrator: cached inputs → world.json. Stage order is the
// schema order; everything downstream of the cache is pure and
// deterministic (golden tests byte-compare a full re-bake against the
// committed artifact). Network happens only in the acquire stage and
// only when the cache is cold.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireOsm, readOsmExtract, osmCachePath } from './osm.mjs';
import { acquireTerrain, buildHeightmap, tilesForBbox } from './terrain.mjs';
import { normalizeLayers } from './layers.mjs';
import { buildSeaPolygons, coastlineRawPath } from './water.mjs';
import { buildCollision } from './collision.mjs';
import { buildWalkGraph, buildRowGraph } from './nav.mjs';
import { buildSpawnsAndTransitions } from './spawns.mjs';
import { buildMinimap, renderMinimapSvg } from './minimap.mjs';
import { sha256, serializeStable, encodeHeights, roundCm } from './util.mjs';

export const WORLDBAKE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(WORLDBAKE_ROOT, '../..');
export const WORLDS_DIR = join(REPO_ROOT, 'packages/world-data/data/worlds');

export const SCHEMA_FORMAT = 'bodyarcade-world/1';

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
const TERRAIN_ATTRIBUTION =
  'Elevation data from Mapzen/AWS Terrain Tiles (SRTM ©NASA; GMTED2010 ©USGS; ETOPO1 ©NOAA; and other open sources)';

export function cacheDirFor(config) {
  return join(WORLDBAKE_ROOT, 'cache', config.name);
}

export function worldOutPath(config) {
  return join(WORLDS_DIR, config.name, 'world.json');
}

/** Acquire stage — the only networked step; no-op on a warm cache. */
export async function acquire(config, { force = false } = {}) {
  const cacheDir = cacheDirFor(config);
  const osm = await acquireOsm(config, cacheDir, { force });
  const terrain = await acquireTerrain(config, cacheDir, { force });
  return { cacheDir, osm, terrain };
}

/** Offline bake from the cache. Returns { world, serialized, extras }. */
export function bake(config, { render = false } = {}) {
  const cacheDir = cacheDirFor(config);
  if (!existsSync(osmCachePath(cacheDir))) {
    throw new Error(`${config.name}: no cached extract — run the fetch step first (worldbake <config> --fetch)`);
  }
  const extract = readOsmExtract(cacheDir);

  // normalize + simplify all vector layers
  const norm = normalizeLayers(config, extract);
  const { proj, bboxM, layers } = norm;

  // water polygons: sea via the absorbed boundary pipeline + lakes
  const sea = buildSeaPolygons(config, extract, cacheDir);
  const waterPolygons = [...(sea?.polygons ?? []), ...norm.lakes];

  // terrain heightfield from cached tiles (tile list is derived from the
  // config, so a cold tile cache fails loudly here, not silently)
  const terrainAcqSync = terrainTilesFromCache(config, cacheDir);
  const heightmap = buildHeightmap(config, cacheDir, proj, bboxM, terrainAcqSync);

  // navigation
  const walk = buildWalkGraph(layers);
  const row = buildRowGraph(config, bboxM, waterPolygons);

  // spawns + transitions
  const spawnsOut = buildSpawnsAndTransitions({
    config, layers, pierWays: norm.pierWays, waterPolygons,
    walkGraph: walk.graph, walkInLargest: walk.inLargest,
    rowGraph: row.graph, rowInLargest: row.inLargest, heightmap,
  });

  // collision + minimap
  const coll = buildCollision(layers, waterPolygons);
  const minimap = buildMinimap(config, bboxM, layers, waterPolygons, spawnsOut.spawns);

  // provenance: checksum every cached input the bake consumed
  const inputs = [
    { file: relative(WORLDBAKE_ROOT, osmCachePath(cacheDir)), sha256: sha256(readFileSync(osmCachePath(cacheDir))) },
    ...(sea
      ? [{ file: relative(WORLDBAKE_ROOT, coastlineRawPath(cacheDir)), sha256: sha256(readFileSync(coastlineRawPath(cacheDir))) }]
      : []),
    ...terrainAcqSync.paths.map((p) => ({ file: relative(WORLDBAKE_ROOT, p), sha256: sha256(readFileSync(p)) })),
  ];

  const heightsEnc = encodeHeights(heightmap.heights, heightmap.minElevationM, heightmap.maxElevationM);

  const world = {
    format: SCHEMA_FORMAT,
    name: config.name,
    displayName: config.displayName,
    source: {
      providers: [
        {
          name: 'OpenStreetMap',
          detail: 'Overpass API bbox extract (buildings, highways, coastline, water, waterways, landuse, aeroways, piers, boundaries)',
          license: 'ODbL-1.0',
          attribution: OSM_ATTRIBUTION,
        },
        {
          name: 'AWS Terrain Tiles (Mapzen terrarium)',
          detail: `terrarium tiles, zoom ${terrainAcqSync.zoom}`,
          license: 'mixed open sources (see DATA_SOURCES.md §2)',
          attribution: TERRAIN_ATTRIBUTION,
        },
      ],
      attributionLines: [`Map data ${OSM_ATTRIBUTION} (ODbL)`, TERRAIN_ATTRIBUTION],
      osmBaseTimestamp: extract.osm3s?.timestamp_osm_base ?? null,
      bboxLatLon: config.bbox,
      inputs,
      bakedWith: 'worldbake/1',
    },
    projection: { type: 'local-tangent-equirect', lat0: proj.lat0, lon0: proj.lon0, earthRadiusM: proj.earthRadiusM },
    units: 'm',
    bbox: bboxM.map(roundCm),
    terrain: {
      width: heightmap.width,
      height: heightmap.height,
      cellSizeM: heightmap.cellSizeM,
      originX: heightmap.originX,
      originY: heightmap.originY,
      minElevationM: heightmap.minElevationM,
      maxElevationM: heightmap.maxElevationM,
      seaLevelM: 0,
      sourceZoom: heightmap.sourceZoom,
      // present only when the config asked for a bathymetry floor —
      // absent means untouched source elevations
      clampMinM: heightmap.clampMinM ?? undefined,
      clampedCells: heightmap.clampMinM !== null ? heightmap.clampedCells : undefined,
      encoding: heightsEnc.encoding,
      offsetM: heightsEnc.offsetM,
      scaleM: heightsEnc.scaleM,
      heights: heightsEnc.data,
    },
    layers: {
      coastline: layers.coastline,
      water: {
        polygons: waterPolygons.map((p) => ({
          class: p.class,
          name: p.name ?? null,
          outer: p.outer,
          holes: (p.holes ?? []).map((h) => ({ name: h.name ?? null, ring: h.ring })),
        })),
      },
      waterways: layers.waterways,
      roads: layers.roads,
      paths: layers.paths,
      buildings: layers.buildings,
      landuse: layers.landuse,
      boundaries: layers.boundaries,
      aeroways: layers.aeroways,
    },
    collision: coll.collision,
    nav: { walk: walk.graph, row: row.graph },
    minimap,
    spawns: spawnsOut.spawns,
    transitions: spawnsOut.transitions,
    stats: {
      layerCounts: Object.fromEntries(
        Object.entries(layers).map(([k, v]) => [k, v.length]),
      ),
      waterPolygons: waterPolygons.length,
      water: sea
        ? {
            rawVertices: sea.stats.rawVertices,
            vertices: sea.stats.vertices,
            areaDeltaPct: sea.stats.areaDeltaPct,
            islands: sea.stats.holes,
          }
        : null,
      collision: coll.stats,
      normalize: norm.diagnostics,
      notes: spawnsOut.notes,
    },
  };

  const serialized = serializeStable(world);

  if (render) {
    renderMinimapSvg(minimap, join(REPO_ROOT, 'packages/world-data/data/render', `${config.name}-minimap.svg`));
  }

  return { world, serialized, extras: { heightmap, walk, row, sea, waterPolygons } };
}

/** Tile list + paths for a warm cache (no network). tilesForBbox is
 *  deterministic from the config, so the list is re-derived rather than
 *  trusted from a stored manifest; a cold cache fails loudly. */
function terrainTilesFromCache(config, cacheDir) {
  const zoom = config.terrain?.zoom ?? 13;
  const tiles = tilesForBbox(config.bbox, zoom);
  const paths = tiles.map((t) => join(cacheDir, 'tiles', `terrarium-${t.z}-${t.x}-${t.y}.png`));
  for (const p of paths) {
    if (!existsSync(p)) throw new Error(`${config.name}: missing cached terrain tile ${p} — run the fetch step`);
  }
  return { zoom, tiles, paths };
}

export function writeWorld(config, serialized) {
  const out = worldOutPath(config);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serialized);
  return out;
}
