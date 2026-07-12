// Spawn + mode-transition stage. Candidates come from the data, not
// hand placement: runways from aeroways, docks from piers/quays reaching
// water, dive points from open water depth proxies (distance to shore),
// the walk spawn from the settlement's building-density centroid.
// Transitions pair spawns with the nav graphs so V4 can hand a player
// from plane to feet to boat to dolphin without inventing geometry.

import {
  pointInWater, distanceToShore,
} from '../../../packages/world-data/tools/geometry.mjs';
import { roundCm, roundDm, nearestPointIndex } from './util.mjs';
import { heightAt } from './terrain.mjs';

const lineLength = (pts) => {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return s;
};

/** Degrees clockwise from +Y (north). */
const headingDeg = (a, b) => {
  const d = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return Math.round(((d % 360) + 360) % 360);
};

const anyWater = (waterPolygons, pt) => waterPolygons.some((p) => pointInWater(pt, p));

export function buildSpawnsAndTransitions({
  config, layers, pierWays, waterPolygons, walkGraph, walkInLargest, rowGraph, rowInLargest, heightmap,
}) {
  const spawns = [];
  const transitions = [];
  const notes = [];

  // -- airfield: longest runway centreline --
  const runways = layers.aeroways.filter((a) => a.class === 'runway');
  let airfieldEnd = null;
  if (runways.length > 0) {
    const longest = runways.reduce((a, b) => (lineLength(b.pts) > lineLength(a.pts) ? b : a));
    const pts = longest.pts;
    const mid = pts[Math.floor(pts.length / 2)];
    spawns.push({
      kind: 'airfield',
      name: longest.name ?? 'runway',
      pos: [roundCm(mid[0]), roundCm(mid[1])],
      headingDeg: headingDeg(pts[0], pts[pts.length - 1]),
      elevM: roundDm(heightAt(heightmap, mid[0], mid[1])),
    });
    airfieldEnd = pts[0];
  } else {
    notes.push('no runway in extract — airfield spawn omitted');
  }

  // -- walk spawn: nav node (largest component) nearest building centroid --
  let walkNodeIdx = -1;
  if (layers.buildings.length > 0 && walkGraph.nodes.length > 0) {
    let cx = 0;
    let cy = 0;
    for (const b of layers.buildings) { cx += b.outer[0][0]; cy += b.outer[0][1]; }
    cx /= layers.buildings.length;
    cy /= layers.buildings.length;
    let best = Infinity;
    for (let i = 0; i < walkGraph.nodes.length; i++) {
      if (!walkInLargest(i)) continue;
      const d = (walkGraph.nodes[i][0] - cx) ** 2 + (walkGraph.nodes[i][1] - cy) ** 2;
      if (d < best) { best = d; walkNodeIdx = i; }
    }
    if (walkNodeIdx >= 0) {
      const p = walkGraph.nodes[walkNodeIdx];
      spawns.push({
        kind: 'walk', name: 'settlement', pos: [p[0], p[1]],
        elevM: roundDm(heightAt(heightmap, p[0], p[1])), node: walkNodeIdx,
      });
    }
  }

  // -- docks: pier/quay ways whose seaward end touches rowable water --
  const dockCandidates = [];
  for (const pier of pierWays ?? []) {
    const xy = pier.xy;
    if (xy.length < 2) continue;
    const ends = [xy[0], xy[xy.length - 1]];
    const wet = ends
      .map((e) => ({ e, d: waterPolygons.length ? Math.max(...waterPolygons.map((p) => (pointInWater(e, p) ? distanceToShore(e, p) : -distanceToShore(e, p)))) : -Infinity }))
      .sort((a, b) => b.d - a.d)[0];
    if (wet && wet.d > -30) dockCandidates.push({ id: pier.id, name: pier.tags?.name ?? null, pos: wet.e, score: wet.d });
  }
  dockCandidates.sort((a, b) => b.score - a.score || a.id - b.id);
  const docks = [];
  for (const c of dockCandidates) {
    if (docks.some((d) => Math.hypot(d.pos[0] - c.pos[0], d.pos[1] - c.pos[1]) < 150)) continue;
    docks.push(c);
    if (docks.length === 3) break;
  }
  for (const [i, d] of docks.entries()) {
    const rowNode = nearestRowNode(rowGraph, rowInLargest, d.pos);
    spawns.push({
      kind: 'dock', name: d.name ?? `dock ${i + 1}`,
      pos: [roundCm(d.pos[0]), roundCm(d.pos[1])],
      node: rowNode,
    });
  }
  if (docks.length === 0) notes.push('no pier/quay reaching water — dock spawns omitted');

  // -- dive points: the most open water on the row network --
  const diveCount = config.spawns?.divePoints ?? 2;
  const scored = [];
  for (let i = 0; i < rowGraph.nodes.length; i++) {
    if (!rowInLargest(i)) continue;
    const p = rowGraph.nodes[i];
    let d = 0;
    for (const poly of waterPolygons) if (pointInWater(p, poly)) d = Math.max(d, distanceToShore(p, poly));
    if (d > 0) scored.push({ i, d });
  }
  scored.sort((a, b) => b.d - a.d || a.i - b.i);
  const dives = [];
  for (const s of scored) {
    const p = rowGraph.nodes[s.i];
    if (dives.some((q) => Math.hypot(q.pos[0] - p[0], q.pos[1] - p[1]) < 300)) continue;
    dives.push({ pos: p, node: s.i, clearM: roundDm(s.d) });
    if (dives.length === diveCount) break;
  }
  for (const [i, d] of dives.entries()) {
    spawns.push({ kind: 'dive', name: `open water ${i + 1}`, pos: [d.pos[0], d.pos[1]], node: d.node, shoreClearM: d.clearM });
  }

  // -- transitions: pair the spawns with the graphs --
  if (airfieldEnd && walkGraph.nodes.length > 0) {
    const n = nearestWalkNode(walkGraph, walkInLargest, airfieldEnd);
    if (n >= 0) {
      transitions.push({
        kind: 'land-to-walk', name: 'airfield apron',
        pos: [roundCm(airfieldEnd[0]), roundCm(airfieldEnd[1])], radiusM: 40, walkNode: n,
      });
    }
  }
  for (const s of spawns.filter((s) => s.kind === 'dock')) {
    if (s.node !== null && s.node >= 0) {
      transitions.push({ kind: 'dock-to-row', name: s.name, pos: s.pos, radiusM: 20, rowNode: s.node });
    }
  }
  for (const s of spawns.filter((s) => s.kind === 'dive')) {
    transitions.push({ kind: 'row-to-dive', name: s.name, pos: s.pos, radiusM: 60, rowNode: s.node });
  }

  return { spawns, transitions, notes };
}

function nearestRowNode(rowGraph, inLargest, pos) {
  let best = Infinity;
  let bestI = -1;
  for (let i = 0; i < rowGraph.nodes.length; i++) {
    if (!inLargest(i)) continue;
    const d = (rowGraph.nodes[i][0] - pos[0]) ** 2 + (rowGraph.nodes[i][1] - pos[1]) ** 2;
    if (d < best) { best = d; bestI = i; }
  }
  return bestI >= 0 ? bestI : null;
}

const nearestWalkNode = (walkGraph, inLargest, pos) => {
  let best = Infinity;
  let bestI = -1;
  for (let i = 0; i < walkGraph.nodes.length; i++) {
    if (!inLargest(i)) continue;
    const d = (walkGraph.nodes[i][0] - pos[0]) ** 2 + (walkGraph.nodes[i][1] - pos[1]) ** 2;
    if (d < best) { best = d; bestI = i; }
  }
  return bestI;
};
