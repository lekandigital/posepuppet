// Boundary verification: every claim about the artifact, asserted and
// written to eval/worlddata-results.json (repo convention: numbers that
// could appear in a post come from eval files, reproducibly).
//
//  1. structure: format tag, polygon count, required named islands present
//  2. geometry: no self-intersections, no ring crossings, holes contained
//  3. fidelity: area delta vs raw within tolerance; vertex budgets held
//  4. probes: named lat/lon points classify identically on the RAW
//     assembled polygon and the simplified artifact (a probe that fails
//     on raw is a bad probe, and the run says so rather than blaming the
//     pipeline)
//  5. channels: named straits stay open — shore clearance >= per-channel
//     floor and >= ratio × the raw clearance (the "important channels"
//     guarantee: Golden Gate, Raccoon Strait, Oakland estuary)
//  6. determinism: two in-process rebuilds serialize byte-identically AND
//     match the committed artifact (drift check)
//
// Usage: node tools/check-boundary.mjs [configs/san-francisco-bay.json]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeProjection, ringSelfIntersects, ringsCross,
  pointInRing, pointInWater, distanceToShore,
} from './geometry.mjs';
import { assembleRawPolygons, buildBoundary, serializeBoundary } from './build-boundary.mjs';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PKG_ROOT, '../..');

const configPath = process.argv[2] ?? join(PKG_ROOT, 'configs/san-francisco-bay.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const artifact = JSON.parse(readFileSync(join(PKG_ROOT, config.out), 'utf8'));

const checks = [];
const check = (name, pass, value) => {
  checks.push({ name, pass: !!pass, value });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${value !== undefined ? ` — ${value}` : ''}`);
};

// --- 1. structure ---
check('format tag', artifact.format === 'bodyarcade-boundary/1', artifact.format);
check('polygon count', artifact.polygons.length === config.expect.polygons,
  `${artifact.polygons.length} (expect ${config.expect.polygons})`);
const holeNames = artifact.polygons.flatMap((p) => p.holes.map((h) => h.name).filter(Boolean));
for (const required of config.expect.requiredIslands ?? []) {
  check(`island present: ${required}`, holeNames.includes(required));
}
const holeCount = artifact.polygons.reduce((s, p) => s + p.holes.length, 0);
check('island count sane', holeCount >= (config.expect.minHoles ?? 0) && holeCount <= (config.expect.maxHoles ?? Infinity),
  `${holeCount} islands (${config.expect.minHoles ?? 0}..${config.expect.maxHoles ?? '∞'}), named: ${holeNames.join('; ')}`);

// --- 2. geometry ---
const allRings = artifact.polygons.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]);
check('no self-intersections', !allRings.some((r) => ringSelfIntersects(r)), `${allRings.length} rings`);
check('no ring crossings / holes contained', artifact.polygons.every((p) =>
  p.holes.every((h) =>
    !ringsCross(p.outer, h.ring) && pointInRing(h.ring[0], p.outer)) &&
  p.holes.every((a, i) => p.holes.every((b, j) => j <= i || !ringsCross(a.ring, b.ring)))));

// --- 3. fidelity ---
const s = artifact.stats;
check('area delta within tolerance', Math.abs(s.areaDeltaPct) <= config.checks.maxAreaDeltaPct,
  `${s.areaDeltaPct}% (tolerance ±${config.checks.maxAreaDeltaPct}%)`);
check('outer vertex budget', s.outerVertices <= config.budget.outerMax,
  `${s.outerVertices} <= ${config.budget.outerMax}`);
check('total vertex budget', s.vertices <= config.budget.totalMax,
  `${s.vertices} <= ${config.budget.totalMax} (raw ${s.rawVertices})`);

// --- raw assembled polygons: the probe/channel ground truth ---
const { polygons: rawPolygons } = assembleRawPolygons(config);
const proj = makeProjection(artifact.projection.lat0, artifact.projection.lon0);
const inWaterRaw = (pt) => rawPolygons.some((p) => pointInWater(pt, p));
const inWaterSimplified = (pt) => artifact.polygons.some((p) => pointInWater(pt, p));

// --- 4. probes ---
for (const probe of config.probes) {
  const pt = proj.toXY(probe.lat, probe.lon);
  const wantWater = probe.expect === 'water';
  const rawOk = inWaterRaw(pt) === wantWater;
  const simpOk = inWaterSimplified(pt) === wantWater;
  check(`probe ${probe.name} (${probe.expect})`, rawOk && simpOk,
    rawOk ? (simpOk ? 'raw+simplified agree' : 'raw ok, SIMPLIFIED WRONG') : 'BAD PROBE (fails on raw)');
}
// island interiors are land — derived from the artifact, no hardcoded coords
for (const p of artifact.polygons) {
  for (const h of p.holes) {
    let cx = 0, cy = 0;
    for (const [x, y] of h.ring) { cx += x; cy += y; }
    cx /= h.ring.length; cy /= h.ring.length;
    if (!pointInRing([cx, cy], h.ring)) continue; // concave hole, centroid outside — skip
    if (!h.name) continue; // only assert the named (load-bearing) islands
    check(`island interior is land: ${h.name}`, !inWaterSimplified([cx, cy]));
  }
}

// --- 5. channels ---
for (const ch of config.channels) {
  const pt = proj.toXY(ch.lat, ch.lon);
  const floor = ch.minClearanceM ?? config.checks.channelMinClearanceM;
  const rawClear = Math.min(...rawPolygons.map((p) => distanceToShore(pt, p)));
  const simpClear = Math.min(...artifact.polygons.map((p) => distanceToShore(pt, p)));
  const ok = inWaterSimplified(pt) && inWaterRaw(pt) && simpClear >= floor &&
    simpClear >= config.checks.channelKeepRatio * rawClear;
  check(`channel open: ${ch.name}`, ok,
    `clearance ${simpClear.toFixed(0)} m (raw ${rawClear.toFixed(0)} m, floor ${floor} m, keep ≥${config.checks.channelKeepRatio}×)`);
}

// --- 6. determinism + drift ---
const a = serializeBoundary(buildBoundary(config));
const b = serializeBoundary(buildBoundary(config));
check('rebuild determinism', a === b, `${a.length} bytes`);
check('committed artifact matches rebuild', a === readFileSync(join(PKG_ROOT, config.out), 'utf8'));

// --- results ---
const allPass = checks.every((c) => c.pass);
const results = {
  generated: new Date().toISOString(),
  module: '@bodyarcade/world-data',
  config: config.name,
  mode: config.mode,
  stats: artifact.stats,
  source: artifact.source,
  checks,
  allPass,
};
mkdirSync(join(REPO_ROOT, 'eval'), { recursive: true });
writeFileSync(join(REPO_ROOT, 'eval/worlddata-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${allPass ? 'ALL GREEN' : 'FAILURES PRESENT'} — eval/worlddata-results.json written (${checks.length} checks)`);
process.exit(allPass ? 0 : 1);
