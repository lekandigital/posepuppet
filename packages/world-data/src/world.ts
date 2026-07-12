// @bodyarcade/world-data — runtime surface for baked world artifacts
// (schema bodyarcade-world/1, produced offline by tools/worldbake).
//
// Same philosophy as the boundary surface below/alongside: typed access,
// validation that refuses unattributed data, and the handful of pure
// queries every consumer needs (height lookup, water containment, nav
// access). No network, no DOM. V4 (Open World) consumes this read-only;
// profiles layer style on top and never touch geographic code.

import { pointInRing } from './index';

export const WORLD_SCHEMA_FORMAT = 'bodyarcade-world/1';

export interface WorldProvider {
  name: string;
  detail: string;
  license: string;
  attribution: string;
}

export interface WorldSource {
  providers: WorldProvider[];
  /** Exact strings a consumer must render on-screen (ODbL requirement). */
  attributionLines: string[];
  osmBaseTimestamp: string | null;
  /** [S, W, N, E] degrees. */
  bboxLatLon: [number, number, number, number];
  inputs: { file: string; sha256: string }[];
  bakedWith: string;
}

export interface WorldTerrain {
  width: number;
  height: number;
  cellSizeM: number;
  originX: number;
  originY: number;
  minElevationM: number;
  maxElevationM: number;
  seaLevelM: number;
  sourceZoom: number;
  encoding: 'u16-le-base64';
  offsetM: number;
  scaleM: number;
  heights: string;
}

export interface WorldPolyline {
  id: number;
  class: string;
  name?: string | null;
  pts: [number, number][];
  widthM?: number;
  bridge?: boolean;
  tunnel?: boolean;
  adminLevel?: number | null;
}

export interface WorldBuilding {
  id: number;
  outer: [number, number][];
  heightM: number;
  name: string | null;
}

export interface WorldArea {
  id: number;
  class: string;
  name: string | null;
  outer: [number, number][];
}

export interface WorldWaterPolygon {
  class: string;
  name: string | null;
  outer: [number, number][];
  holes: { name: string | null; ring: [number, number][] }[];
}

export interface WorldNavGraph {
  nodes: [number, number][];
  /** [a, b, costCm] (+ classCode for walk). */
  edges: number[][];
  edgeClasses?: string[];
  spacingM?: number;
  minShoreClearM?: number;
  stats: { nodes: number; edges: number; components: number; largestComponent: number };
}

export interface WorldSpawn {
  kind: 'airfield' | 'dock' | 'dive' | 'walk';
  name: string;
  pos: [number, number];
  headingDeg?: number;
  elevM?: number;
  node?: number | null;
  shoreClearM?: number;
}

export interface WorldTransition {
  kind: 'land-to-walk' | 'dock-to-row' | 'row-to-dive';
  name: string;
  pos: [number, number];
  radiusM: number;
  walkNode?: number;
  rowNode?: number | null;
}

export interface WorldData {
  format: typeof WORLD_SCHEMA_FORMAT;
  name: string;
  displayName: string;
  source: WorldSource;
  projection: { type: 'local-tangent-equirect'; lat0: number; lon0: number; earthRadiusM: number };
  units: 'm';
  bbox: [number, number, number, number];
  terrain: WorldTerrain;
  layers: {
    coastline: { id: number; pts: [number, number][] }[];
    water: { polygons: WorldWaterPolygon[] };
    waterways: WorldPolyline[];
    roads: WorldPolyline[];
    paths: WorldPolyline[];
    buildings: WorldBuilding[];
    landuse: WorldArea[];
    boundaries: WorldPolyline[];
    aeroways: WorldPolyline[];
  };
  collision: {
    terrain: 'heightfield';
    buildings: { building: number; indices: number[] }[];
    waterEdges: { pts: [number, number][]; closed: boolean }[];
  };
  nav: { walk: WorldNavGraph; row: WorldNavGraph };
  minimap: {
    viewBox: [number, number, number, number];
    water: { outer: [number, number][]; holes: [number, number][][] }[];
    roads: { class: string; pts: [number, number][] }[];
    runways: { pts: [number, number][] }[];
    spawns: { kind: string; pos: [number, number] }[];
  };
  spawns: WorldSpawn[];
  transitions: WorldTransition[];
  stats: Record<string, unknown>;
}

/** Parse + validate a bundled world artifact. Throws on schema drift and
 *  on missing attribution (shipping requirement, same as loadBoundary). */
export function loadWorld(json: unknown): WorldData {
  const w = json as WorldData;
  if (w?.format !== WORLD_SCHEMA_FORMAT) {
    throw new Error(`world-data: unknown world format ${String((w as { format?: unknown })?.format)}`);
  }
  const lines = w.source?.attributionLines;
  if (!Array.isArray(lines) || !lines.some((l) => typeof l === 'string' && l.includes('OpenStreetMap contributors'))) {
    throw new Error('world-data: world is missing OpenStreetMap attribution (shipping requirement)');
  }
  if (!w.terrain || w.terrain.encoding !== 'u16-le-base64') {
    throw new Error(`world-data: unsupported terrain encoding ${String(w.terrain?.encoding)}`);
  }
  if (w.terrain.width * w.terrain.height * 2 !== base64Bytes(w.terrain.heights)) {
    throw new Error('world-data: terrain heights length does not match grid dimensions');
  }
  for (const layer of ['coastline', 'waterways', 'roads', 'paths', 'buildings', 'landuse', 'boundaries', 'aeroways'] as const) {
    if (!Array.isArray(w.layers?.[layer])) throw new Error(`world-data: missing layer ${layer}`);
  }
  if (!Array.isArray(w.layers.water?.polygons)) throw new Error('world-data: missing water polygons');
  if (!Array.isArray(w.nav?.walk?.nodes) || !Array.isArray(w.nav?.row?.nodes)) {
    throw new Error('world-data: missing nav graphs');
  }
  return w;
}

function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/** The attribution strings a consumer must show. */
export function worldAttributionLines(w: WorldData): string[] {
  return w.source.attributionLines.slice();
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Environment-free base64 → bytes (no atob/Buffer dependency). */
function decodeBase64(b64: string): Uint8Array {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((b64.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const n =
      (B64_LOOKUP[b64.charCodeAt(i)] << 18) |
      (B64_LOOKUP[b64.charCodeAt(i + 1)] << 12) |
      (B64_LOOKUP[b64.charCodeAt(i + 2)] << 6) |
      B64_LOOKUP[b64.charCodeAt(i + 3)];
    out[o++] = (n >> 16) & 0xff;
    if (o < out.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

/** Decode the quantized heightfield once; reuse the returned buffer. */
export function decodeHeights(w: WorldData): Float32Array {
  const raw = decodeBase64(w.terrain.heights);
  const n = w.terrain.width * w.terrain.height;
  const out = new Float32Array(n);
  const { offsetM, scaleM } = w.terrain;
  for (let i = 0; i < n; i++) {
    out[i] = offsetM + (raw[2 * i] | (raw[2 * i + 1] << 8)) * scaleM;
  }
  return out;
}

/** Bilinear terrain height at (x, y) metres. Pass the decoded buffer. */
export function heightAt(w: WorldData, heights: Float32Array, x: number, y: number): number {
  const t = w.terrain;
  const gx = Math.min(Math.max((x - t.originX) / t.cellSizeM, 0), t.width - 1);
  const gy = Math.min(Math.max((y - t.originY) / t.cellSizeM, 0), t.height - 1);
  const x0 = Math.min(Math.floor(gx), t.width - 2);
  const y0 = Math.min(Math.floor(gy), t.height - 2);
  const fx = gx - x0;
  const fy = gy - y0;
  const wdt = t.width;
  return (
    (heights[y0 * wdt + x0] * (1 - fx) + heights[y0 * wdt + x0 + 1] * fx) * (1 - fy) +
    (heights[(y0 + 1) * wdt + x0] * (1 - fx) + heights[(y0 + 1) * wdt + x0 + 1] * fx) * fy
  );
}

/** True if (x, y) is in any water polygon (sea or lake). Reuses the
 *  boundary containment primitive — the ring convention is shared. */
export function worldPointInWater(w: WorldData, x: number, y: number): boolean {
  for (const p of w.layers.water.polygons) {
    if (!pointInRing(x, y, p.outer)) continue;
    let inHole = false;
    for (const h of p.holes) {
      if (pointInRing(x, y, h.ring)) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

/** Nearest nav node index to (x, y); -1 on an empty graph. */
export function nearestNavNode(graph: WorldNavGraph, x: number, y: number): number {
  let best = Infinity;
  let bestI = -1;
  for (let i = 0; i < graph.nodes.length; i++) {
    const dx = graph.nodes[i][0] - x;
    const dy = graph.nodes[i][1] - y;
    const d = dx * dx + dy * dy;
    if (d < best) { best = d; bestI = i; }
  }
  return bestI;
}
