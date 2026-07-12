// Navigation stage: the walkable graph (roads + paths welded at shared
// vertices) and the rowable graph (a water-interior lattice + dock
// reach). Both are plain node/edge lists — pathfinding lives in
// consumers; validity (connectivity over the settlement, rowable water
// reaching the bay) is asserted by the check suite, not assumed.

import {
  pointInWater, distanceToShore,
} from '../../../packages/world-data/tools/geometry.mjs';
import { roundCm } from './util.mjs';

const EDGE_CLASS = ['major', 'street', 'service', 'track', 'footway', 'path', 'steps', 'cycleway', 'pier'];

/** Union-find over n nodes. */
function components(n, edges) {
  const parent = [...Array(n).keys()];
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  const sizes = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    sizes.set(r, (sizes.get(r) ?? 0) + 1);
  }
  let largestRoot = -1;
  let largestSize = 0;
  for (const [r, s] of sizes) {
    if (s > largestSize || (s === largestSize && r < largestRoot)) { largestRoot = r; largestSize = s; }
  }
  return { count: sizes.size, largestSize, inLargest: (i) => find(i) === largestRoot };
}

/**
 * Walk graph: node per unique cm-rounded vertex of every road/path/pier
 * polyline, edge per segment (cost = length in cm, class code attached).
 * Shared endpoints weld automatically via the coordinate key.
 */
export function buildWalkGraph(layers) {
  const nodes = [];
  const byKey = new Map();
  const nodeOf = (p) => {
    const key = `${p[0]},${p[1]}`;
    let i = byKey.get(key);
    if (i === undefined) {
      i = nodes.length;
      byKey.set(key, i);
      nodes.push([p[0], p[1]]);
    }
    return i;
  };
  const edges = [];
  const seen = new Set();
  const addLine = (pts, cls) => {
    const code = EDGE_CLASS.indexOf(cls);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = nodeOf(pts[i]);
      const b = nodeOf(pts[i + 1]);
      if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cost = Math.round(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) * 100);
      edges.push([a, b, cost, code]);
    }
  };
  for (const r of layers.roads) addLine(r.pts, r.class);
  for (const p of layers.paths) addLine(p.pts, p.class);
  const comp = components(nodes.length, edges);
  return {
    graph: {
      nodes,
      edges,
      edgeClasses: EDGE_CLASS,
      stats: { nodes: nodes.length, edges: edges.length, components: comp.count, largestComponent: comp.largestSize },
    },
    inLargest: comp.inLargest,
  };
}

/**
 * Row graph: lattice nodes every spacingM across the bbox wherever the
 * point sits in sea/lake water with >= minShoreClearM of shore clearance;
 * 8-neighbour edges whose midpoint is also wet. Lakes join the network
 * only if large enough to hold nodes.
 */
export function buildRowGraph(config, bboxM, waterPolygons) {
  const spacing = config.nav?.rowSpacingM ?? 40;
  const clear = config.nav?.rowMinShoreClearM ?? 12;
  const [minx, miny, maxx, maxy] = bboxM;
  const isRowable = (x, y) => {
    for (const p of waterPolygons) {
      if (pointInWater([x, y], p) && distanceToShore([x, y], p) >= clear) return true;
    }
    return false;
  };
  const cols = Math.floor((maxx - minx) / spacing);
  const rows = Math.floor((maxy - miny) / spacing);
  const nodes = [];
  const gridIdx = new Map();
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = roundCm(minx + i * spacing);
      const y = roundCm(miny + j * spacing);
      if (!isRowable(x, y)) continue;
      gridIdx.set(`${i},${j}`, nodes.length);
      nodes.push([x, y]);
    }
  }
  const edges = [];
  const neigh = [[1, 0], [0, 1], [1, 1], [1, -1]]; // forward-only: no dupes
  for (const [key, a] of gridIdx) {
    const [i, j] = key.split(',').map(Number);
    for (const [di, dj] of neigh) {
      const b = gridIdx.get(`${i + di},${j + dj}`);
      if (b === undefined) continue;
      const [ax, ay] = nodes[a];
      const [bx, by] = nodes[b];
      if (!isRowable((ax + bx) / 2, (ay + by) / 2)) continue;
      edges.push([a, b, Math.round(Math.hypot(bx - ax, by - ay) * 100)]);
    }
  }
  const comp = components(nodes.length, edges);
  return {
    graph: {
      nodes,
      edges,
      spacingM: spacing,
      minShoreClearM: clear,
      stats: { nodes: nodes.length, edges: edges.length, components: comp.count, largestComponent: comp.largestSize },
    },
    inLargest: comp.inLargest,
  };
}

/** BFS reachability between two node indices — used by spawns + checks. */
export function reachable(graph, from, to) {
  if (from < 0 || to < 0) return false;
  const adj = new Map();
  for (const [a, b] of graph.edges) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift();
    if (n === to) return true;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) { seen.add(m); queue.push(m); }
    }
  }
  return false;
}
