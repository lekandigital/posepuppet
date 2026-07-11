// @bodyarcade/world-data — runtime surface for bundled boundary artifacts.
//
// The offline pipeline (tools/*.mjs) fetches a real water polygon from
// OpenStreetMap, simplifies and projects it, and emits boundary.json with
// full provenance. This module is what a game imports: typed access,
// point-in-water containment, and distance-to-shore — the primitives
// behind the soft containment current, the SDF depth field, and the
// minimap. No network, no DOM; pure functions over the bundled JSON.
//
// pointInRing / distanceToShore mirror tools/geometry.mjs (the tools are
// plain node scripts and cannot import TS); any change here must be made
// there too — the check tool's probes catch divergence.
//
// Designed as the future open-data pipeline's water-polygon component:
// one artifact format, N shapes, each a config away (see README).

export interface BoundarySource {
  provider: string;
  osmRelation: number;
  url: string;
  /** SPDX-style id, e.g. "ODbL-1.0" — attribution is a shipping requirement. */
  license: string;
  /** Human-readable credit line; the consuming game must display it. */
  attribution: string;
  osmBaseTimestamp: string | null;
}

export interface BoundaryProjection {
  type: 'local-tangent-equirect';
  lat0: number;
  lon0: number;
  earthRadiusM: number;
}

export interface BoundaryHole {
  name: string | null;
  wayIds: number[];
  /** [x, y] metres, no closing duplicate, clockwise. */
  ring: [number, number][];
}

export interface BoundaryPolygon {
  /** [x, y] metres, no closing duplicate, counter-clockwise. */
  outer: [number, number][];
  holes: BoundaryHole[];
}

export interface BoundaryData {
  format: 'bodyarcade-boundary/1';
  name: string;
  displayName: string;
  source: BoundarySource;
  projection: BoundaryProjection;
  units: 'm';
  /** [minx, miny, maxx, maxy] metres. */
  bbox: [number, number, number, number];
  polygons: BoundaryPolygon[];
  stats: {
    rawVertices: number;
    vertices: number;
    outerVertices: number;
    areaRawM2: number;
    areaM2: number;
    areaDeltaPct: number;
    simplify: {
      method: string;
      minTriangleAreaM2: number;
      requestedMinTriangleAreaM2: number;
      minRingVerts: number;
      passes: number;
    };
  };
}

/** Parse + validate a bundled boundary artifact. Throws on shape drift. */
export function loadBoundary(json: unknown): BoundaryData {
  const b = json as BoundaryData;
  if (b?.format !== 'bodyarcade-boundary/1') {
    throw new Error(`world-data: unknown boundary format ${String(b?.format)}`);
  }
  if (!Array.isArray(b.polygons) || b.polygons.length === 0) {
    throw new Error('world-data: boundary has no polygons');
  }
  if (typeof b.source?.attribution !== 'string' || b.source.attribution.length === 0) {
    throw new Error('world-data: boundary is missing attribution (shipping requirement)');
  }
  return b;
}

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** True if (x, y) metres is navigable water. */
export function pointInWater(b: BoundaryData, x: number, y: number): boolean {
  for (const p of b.polygons) {
    if (!pointInRing(x, y, p.outer)) continue;
    let inHole = false;
    for (const h of p.holes) {
      if (pointInRing(x, y, h.ring)) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

function segDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
}

/**
 * Signed distance to the nearest shore: positive in water, negative on
 * land. This is the containment current's input (push strength near the
 * edge) and the SDF depth field's substrate (deeper toward the middle).
 * O(total vertices) per query — ~1k segments is fine per-frame for one
 * dolphin; grid-bake if a future consumer needs thousands of queries.
 */
export function signedDistanceToShore(b: BoundaryData, x: number, y: number): number {
  let min = Infinity;
  for (const p of b.polygons) {
    for (let i = 0; i < p.outer.length; i++) {
      const d = segDist(x, y, p.outer[i], p.outer[(i + 1) % p.outer.length]);
      if (d < min) min = d;
    }
    for (const h of p.holes) {
      for (let i = 0; i < h.ring.length; i++) {
        const d = segDist(x, y, h.ring[i], h.ring[(i + 1) % h.ring.length]);
        if (d < min) min = d;
      }
    }
  }
  return pointInWater(b, x, y) ? min : -min;
}

/** Project (lat, lon) into the artifact's local metre frame. */
export function projectLatLon(
  proj: BoundaryProjection, lat: number, lon: number,
): [number, number] {
  const DEG = Math.PI / 180;
  return [
    (lon - proj.lon0) * DEG * proj.earthRadiusM * Math.cos(proj.lat0 * DEG),
    (lat - proj.lat0) * DEG * proj.earthRadiusM,
  ];
}
