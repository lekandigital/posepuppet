// Collision stage: triangulated building footprints (ear clipping) +
// water-edge polylines. Terrain collision is the heightfield itself —
// consumers sample heightAt; no separate mesh is baked for it (stated in
// WORLD_SCHEMA.md). Triangles index into the building's own outer ring,
// so no vertex data is duplicated in the artifact.

import { shoelaceSigned } from '../../../packages/world-data/tools/geometry.mjs';

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function pointInTri(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Ear-clip a simple polygon ring ([[x,y],...], no closing duplicate) into
 * triangle index triples (CCW). Deterministic: first valid ear wins.
 * Returns null when the polygon resists (degenerate input) — callers
 * count and skip rather than ship a bad mesh.
 */
export function triangulateRing(ring) {
  const n = ring.length;
  if (n < 3) return null;
  const idx = [...Array(n).keys()];
  if (shoelaceSigned(ring) < 0) idx.reverse();
  const tris = [];
  let remaining = idx.slice();
  let stall = 0;
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const ia = remaining[(i - 1 + remaining.length) % remaining.length];
      const ib = remaining[i];
      const ic = remaining[(i + 1) % remaining.length];
      if (cross(ring[ia], ring[ib], ring[ic]) <= 0) continue; // reflex/collinear
      let blocked = false;
      for (const j of remaining) {
        if (j === ia || j === ib || j === ic) continue;
        if (pointInTri(ring[j], ring[ia], ring[ib], ring[ic])) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push(ia, ib, ic);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      if (++stall > 1) return null;
      // one lenient pass: allow collinear ears to break exact-degenerate rings
      const i = remaining.findIndex((_, k) => {
        const ia = remaining[(k - 1 + remaining.length) % remaining.length];
        const ic = remaining[(k + 1) % remaining.length];
        return cross(ring[ia], ring[remaining[k]], ring[ic]) === 0;
      });
      if (i < 0) return null;
      remaining.splice(i, 1);
    }
  }
  if (remaining.length === 3) tris.push(remaining[0], remaining[1], remaining[2]);
  return tris;
}

/** Build the collision section from baked layers + water polygons. */
export function buildCollision(layers, waterPolygons) {
  const buildings = [];
  let failed = 0;
  for (let i = 0; i < layers.buildings.length; i++) {
    const tris = triangulateRing(layers.buildings[i].outer);
    if (tris) buildings.push({ building: i, indices: tris });
    else failed++;
  }
  const waterEdges = [];
  for (const p of waterPolygons) {
    waterEdges.push({ pts: p.outer, closed: true });
    for (const h of p.holes) waterEdges.push({ pts: h.ring, closed: true });
  }
  return {
    collision: { terrain: 'heightfield', buildings, waterEdges },
    stats: { buildingMeshes: buildings.length, buildingMeshFailures: failed, waterEdgeRings: waterEdges.length },
  };
}
