// worldbake verification suite (no Playwright — golden files):
//   determinism   re-bake from the committed cache → byte-identical to the
//                 committed artifact; sha256 matches golden/checksums.json
//   round-trip    parse + re-serialize the committed artifact → identical
//   schema        validator (mjs mirror of loadWorld) accepts the artifact
//                 and REFUSES it without attribution
//   geometry      no self-intersecting rings anywhere; water area delta
//                 within config tolerance; water/land probes hold
//   terrain       grid dims match encoding; elevation probes in bounds
//   nav           walk components match stats; largest component covers
//                 the settlement probes; row network reaches the bay from
//                 every dock and dive transition
//   collision     triangle indices valid; per-building mesh area matches
//                 its footprint within 0.5%
//   absorption    the standalone boundary pipeline (Dolphin's) still
//                 passes its own full check suite
//
// Usage: node test/checks.mjs [configs/…json …] [--update-golden]
// Writes eval/worldbake-results.json. Exit 1 on any FAIL.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  makeProjection, shoelaceSigned, ringSelfIntersects,
} from '../../../packages/world-data/tools/geometry.mjs';
import { bake, worldOutPath, WORLDBAKE_ROOT, REPO_ROOT, SCHEMA_FORMAT } from '../lib/bake.mjs';
import { serializeStable, sha256, nearestPointIndex } from '../lib/util.mjs';
import { reachable } from '../lib/nav.mjs';

const args = process.argv.slice(2);
const updateGolden = args.includes('--update-golden');
const configPaths = args.filter((a) => !a.startsWith('--'));
const defaultConfigs = ['configs/isafjordur.json', 'configs/friday-harbor.json']
  .map((p) => join(WORLDBAKE_ROOT, p))
  .filter((p) => existsSync(p));
const configs = (configPaths.length ? configPaths : defaultConfigs).map((p) =>
  JSON.parse(readFileSync(p, 'utf8')),
);

const GOLDEN_PATH = join(WORLDBAKE_ROOT, 'golden/checksums.json');

let failures = 0;
const results = [];
const check = (region, name, ok, detail = '') => {
  results.push({ region, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${region}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// ---- mjs mirror of loadWorld (the TS loader can't run without a build;
// the two validators assert the same contract and this one also asserts
// the refusal path) ----
function validateWorld(w) {
  if (w?.format !== SCHEMA_FORMAT) throw new Error(`unknown format ${w?.format}`);
  const lines = w.source?.attributionLines;
  if (!Array.isArray(lines) || !lines.some((l) => typeof l === 'string' && l.includes('OpenStreetMap contributors'))) {
    throw new Error('missing OpenStreetMap attribution');
  }
  if (w.terrain?.encoding !== 'u16-le-base64') throw new Error('bad terrain encoding');
  const bytes = Buffer.from(w.terrain.heights, 'base64').length;
  if (bytes !== w.terrain.width * w.terrain.height * 2) throw new Error('terrain grid/encoding mismatch');
  for (const layer of ['coastline', 'waterways', 'roads', 'paths', 'buildings', 'landuse', 'boundaries', 'aeroways']) {
    if (!Array.isArray(w.layers?.[layer])) throw new Error(`missing layer ${layer}`);
  }
  if (!Array.isArray(w.layers.water?.polygons)) throw new Error('missing water polygons');
  if (!Array.isArray(w.nav?.walk?.nodes) || !Array.isArray(w.nav?.row?.nodes)) throw new Error('missing nav graphs');
  return w;
}

const pointInRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inWater = (w, x, y) =>
  w.layers.water.polygons.some(
    (p) => pointInRing(x, y, p.outer) && !p.holes.some((h) => pointInRing(x, y, h.ring)),
  );

const decodeHeights = (w) => {
  const raw = Buffer.from(w.terrain.heights, 'base64');
  const n = w.terrain.width * w.terrain.height;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = w.terrain.offsetM + raw.readUInt16LE(2 * i) * w.terrain.scaleM;
  return out;
};
const heightAtArtifact = (w, hts, x, y) => {
  const t = w.terrain;
  const gx = Math.min(Math.max((x - t.originX) / t.cellSizeM, 0), t.width - 1);
  const gy = Math.min(Math.max((y - t.originY) / t.cellSizeM, 0), t.height - 1);
  const x0 = Math.min(Math.floor(gx), t.width - 2);
  const y0 = Math.min(Math.floor(gy), t.height - 2);
  const fx = gx - x0;
  const fy = gy - y0;
  return (
    (hts[y0 * t.width + x0] * (1 - fx) + hts[y0 * t.width + x0 + 1] * fx) * (1 - fy) +
    (hts[(y0 + 1) * t.width + x0] * (1 - fx) + hts[(y0 + 1) * t.width + x0 + 1] * fx) * fy
  );
};

const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : {};

for (const config of configs) {
  const region = config.name;
  const outPath = worldOutPath(config);

  // determinism: full re-bake from cache vs committed artifact
  let rebaked = null;
  try {
    rebaked = bake(config);
  } catch (err) {
    check(region, 'bake from cache', false, err.message);
    continue;
  }
  const committed = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
  check(region, 'committed artifact exists', committed !== null, outPath);
  if (committed !== null) {
    check(region, 'determinism — re-bake byte-identical to committed artifact',
      rebaked.serialized === committed, `${rebaked.serialized.length} bytes`);
  }
  const hash = sha256(rebaked.serialized);
  if (updateGolden) {
    golden[region] = hash;
  } else {
    check(region, 'golden checksum', golden[region] === hash,
      golden[region] ? `${hash.slice(0, 12)}…` : 'no golden recorded — run --update-golden');
  }

  const w = JSON.parse(rebaked.serialized);

  // round-trip: parse → stable re-serialize → identical
  check(region, 'schema round-trip (parse → re-serialize byte-identical)',
    serializeStable(w) === rebaked.serialized);

  // schema validation + refusal path
  try {
    validateWorld(w);
    check(region, 'schema validates', true);
  } catch (err) {
    check(region, 'schema validates', false, err.message);
  }
  try {
    validateWorld({ ...w, source: { ...w.source, attributionLines: [] } });
    check(region, 'validator refuses missing attribution', false, 'did not throw');
  } catch {
    check(region, 'validator refuses missing attribution', true);
  }
  check(region, 'ODbL attribution line present',
    w.source.attributionLines.some((l) => l.includes('OpenStreetMap contributors')));
  check(region, 'both providers carry licenses',
    Array.isArray(w.source.providers) && w.source.providers.length >= 2 &&
    w.source.providers.every((p) => p.license && p.attribution));
  check(region, 'input checksums recorded', w.source.inputs.length >= 2 &&
    w.source.inputs.every((i) => /^[0-9a-f]{64}$/.test(i.sha256)));

  // geometry sanity
  const rings = [
    ...w.layers.water.polygons.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]),
    ...w.layers.buildings.map((b) => b.outer),
    ...w.layers.landuse.map((l) => l.outer),
  ];
  const selfX = rings.filter((r) => ringSelfIntersects(r)).length;
  check(region, 'no self-intersecting rings (water, buildings, landuse)', selfX === 0,
    `${rings.length} rings${selfX ? `, ${selfX} bad` : ''}`);
  if (w.stats.water) {
    const tol = config.checks?.maxWaterAreaDeltaPct ?? 1.0;
    check(region, 'water area delta within tolerance',
      Math.abs(w.stats.water.areaDeltaPct) <= tol,
      `${w.stats.water.areaDeltaPct}% (tolerance ±${tol}%)`);
  }
  const proj = makeProjection(w.projection.lat0, w.projection.lon0);
  for (const probe of config.checks?.probes ?? []) {
    const [x, y] = proj.toXY(probe.lat, probe.lon);
    const wet = inWater(w, x, y);
    check(region, `probe ${probe.name} (${probe.expect})`,
      wet === (probe.expect === 'water'), `(${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  // terrain
  const hts = decodeHeights(w);
  check(region, 'terrain grid matches encoding', hts.length === w.terrain.width * w.terrain.height);
  check(region, 'terrain min/max consistent',
    w.terrain.minElevationM <= w.terrain.maxElevationM &&
    w.terrain.maxElevationM - w.terrain.minElevationM < 4000);
  for (const probe of config.checks?.terrainProbes ?? []) {
    const [x, y] = proj.toXY(probe.lat, probe.lon);
    const e = heightAtArtifact(w, hts, x, y);
    check(region, `terrain probe ${probe.name}`,
      e >= probe.minElevM && e <= probe.maxElevM,
      `${e.toFixed(1)} m (want ${probe.minElevM}..${probe.maxElevM})`);
  }

  // nav validity
  const walk = w.nav.walk;
  {
    // recompute components to confirm the artifact's own stats
    const parent = [...walk.nodes.keys()];
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (const [a, b] of walk.edges) { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; }
    const sizes = new Map();
    for (let i = 0; i < walk.nodes.length; i++) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
    const largest = Math.max(...sizes.values());
    check(region, 'walk graph stats truthful',
      sizes.size === walk.stats.components && largest === walk.stats.largestComponent,
      `${walk.stats.nodes} nodes, ${sizes.size} components, largest ${largest}`);
    let largestRoot = -1;
    for (const [r, s] of sizes) if (s === largest) { largestRoot = r; break; }
    for (const probe of config.checks?.settlementProbes ?? []) {
      const [x, y] = proj.toXY(probe.lat, probe.lon);
      let best = Infinity;
      for (let i = 0; i < walk.nodes.length; i++) {
        if (find(i) !== largestRoot) continue;
        const d = Math.hypot(walk.nodes[i][0] - x, walk.nodes[i][1] - y);
        if (d < best) best = d;
      }
      const cover = config.checks?.settlementCoverM ?? 60;
      check(region, `walkable component covers ${probe.name}`, best <= cover,
        `nearest largest-component node ${best.toFixed(0)} m (max ${cover})`);
    }
  }
  {
    const row = w.nav.row;
    const bay = config.checks?.bayProbe;
    if (bay && row.nodes.length > 0) {
      const [bx, by] = proj.toXY(bay.lat, bay.lon);
      const bayNode = nearestPointIndex(row.nodes, bx, by);
      for (const tr of w.transitions.filter((t) => t.rowNode !== undefined && t.rowNode !== null)) {
        check(region, `row network: ${tr.kind} "${tr.name}" reaches the bay`,
          reachable(row, tr.rowNode, bayNode));
      }
    }
    check(region, 'row network exists over water', row.nodes.length > 0,
      `${row.nodes.length} nodes / ${row.edges.length} edges`);
  }

  // collision meshes
  {
    let bad = 0;
    let areaBad = 0;
    for (const c of w.collision.buildings) {
      const b = w.layers.buildings[c.building];
      if (!b || c.indices.length % 3 !== 0 || c.indices.some((i) => i < 0 || i >= b.outer.length)) { bad++; continue; }
      let triArea = 0;
      for (let i = 0; i < c.indices.length; i += 3) {
        const [pa, pb, pc] = [b.outer[c.indices[i]], b.outer[c.indices[i + 1]], b.outer[c.indices[i + 2]]];
        triArea += Math.abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1])) / 2;
      }
      const footprint = Math.abs(shoelaceSigned(b.outer));
      if (footprint > 0 && Math.abs(triArea - footprint) / footprint > 0.005) areaBad++;
    }
    check(region, 'collision meshes valid (indices + area match footprints)',
      bad === 0 && areaBad === 0,
      `${w.collision.buildings.length} meshes, ${w.stats.collision.buildingMeshFailures} skipped by bake${bad ? `, ${bad} invalid` : ''}${areaBad ? `, ${areaBad} area-mismatched` : ''}`);
    check(region, 'spawns include the modes', w.spawns.length >= 2,
      w.spawns.map((s) => s.kind).join(', '));
    check(region, 'transitions present', w.transitions.length >= 1,
      w.transitions.map((t) => t.kind).join(', '));
  }
}

// ---- absorption regression: the standalone boundary pipeline still passes ----
try {
  execFileSync(process.execPath, ['tools/check-boundary.mjs'], {
    cwd: join(REPO_ROOT, 'packages/world-data'),
    stdio: 'pipe',
  });
  check('dolphin', 'absorbed boundary module: full check suite green', true);
} catch (err) {
  check('dolphin', 'absorbed boundary module: full check suite green', false,
    String(err.stdout ?? err.message).split('\n').filter((l) => l.startsWith('FAIL')).join('; ') || err.message);
}

if (updateGolden) {
  mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
  writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n');
  console.log(`golden checksums updated → ${GOLDEN_PATH}`);
}

const evalPath = join(REPO_ROOT, 'eval/worldbake-results.json');
mkdirSync(dirname(evalPath), { recursive: true });
writeFileSync(evalPath, JSON.stringify({
  generated: new Date().toISOString(),
  module: '@bodyarcade/worldbake',
  regions: configs.map((c) => c.name),
  checks: results.length,
  failures,
  results,
}, null, 2) + '\n');
console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURES`} — eval/worldbake-results.json written (${results.length} checks)`);
process.exit(failures === 0 ? 0 : 1);
