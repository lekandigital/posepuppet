// boundary.json builder: cached raw OSM data → water polygon → Visvalingam
// simplification (halve-epsilon retry if simplification ever introduces an
// intersection) → deterministic JSON artifact with provenance + stats.
// Offline prep tool — the game ships the emitted JSON and never fetches.
//
// Two source modes (config.mode):
//  - "relation":        a curated natural=bay/water multipolygon relation.
//    Right for enclosed shapes whose relation already contains everything
//    (a lake, the Bay of Kotor). For SF Bay it was measured insufficient:
//    OSM delineates Golden Gate and Raccoon Strait as separate named
//    features, so the relation has no Golden Gate opening and fuses Angel
//    Island to Tiburon (see DECISIONS.md 2026-07-11).
//  - "coastline-clip":  assemble the water polygon from natural=coastline
//    ways clipped to a convex play region (bbox ∩ named cut-line
//    half-planes — the play-space "gates"). Recovers every real channel
//    and island uniformly; this is the future pipeline's general path.
//
// Usage: node tools/build-boundary.mjs [configs/san-francisco-bay.json] [--out path] [--sweep]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  stitchRings, makeProjection, shoelaceSigned, visvalingam, simplifyRadial,
  ringSelfIntersects, ringsCross, pointInRing, ringsBbox,
  halfPlaneClipPolygon, insideConvex, clipPolylineToConvex, makePerimeter,
  walkWaterRings,
} from './geometry.mjs';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const round2 = (v) => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

function readRaw(relPath) {
  // absolute paths pass through — the worldbake pipeline (tools/worldbake)
  // feeds this builder coastline caches living outside the package
  const buf = readFileSync(isAbsolute(relPath) ? relPath : join(PKG_ROOT, relPath));
  return JSON.parse(relPath.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8'));
}

const ringArea = (ring) => Math.abs(shoelaceSigned(ring));

/** Deterministic projection origin: bbox centre of the config's stated
 *  extent (coastline-clip) or of the raw geometry (relation mode). */
function projectionFor(config, raw) {
  let minLat, maxLat, minLon, maxLon;
  if (config.mode === 'coastline-clip') {
    [minLat, minLon, maxLat, maxLon] = config.bbox;
  } else {
    minLat = Infinity; maxLat = -Infinity; minLon = Infinity; maxLon = -Infinity;
    const rel = raw.elements.find((e) => e.type === 'relation');
    for (const m of rel.members) {
      for (const g of m.geometry ?? []) {
        if (g.lat < minLat) minLat = g.lat;
        if (g.lat > maxLat) maxLat = g.lat;
        if (g.lon < minLon) minLon = g.lon;
        if (g.lon > maxLon) maxLon = g.lon;
      }
    }
  }
  const lat0 = Math.round(((minLat + maxLat) / 2) * 1e4) / 1e4;
  const lon0 = Math.round(((minLon + maxLon) / 2) * 1e4) / 1e4;
  return makeProjection(lat0, lon0);
}

// ---------- mode: relation ----------

function assembleRelation(config, raw, proj) {
  const rel = raw.elements.find((e) => e.type === 'relation');
  if (!rel) throw new Error(`${config.raw}: no relation element`);
  if (rel.id !== config.source.osmRelation) {
    throw new Error(`${config.raw}: relation ${rel.id} != config ${config.source.osmRelation}`);
  }
  const toWays = (role) =>
    rel.members
      .filter((m) => m.type === 'way' && m.role === role)
      .map((m) => ({ id: m.ref, pts: m.geometry.map((g) => ({ lat: g.lat, lon: g.lon })) }));
  const project = (r) => r.pts.map((p) => proj.toXY(p.lat, p.lon));
  const orient = (ring, ccw) => ((shoelaceSigned(ring) > 0) === ccw ? ring : ring.slice().reverse());
  const outers = stitchRings(toWays('outer')).map((r) => ({ wayIds: r.wayIds, ring: orient(project(r), true) }));
  const inners = stitchRings(toWays('inner')).map((r) => ({ wayIds: r.wayIds, ring: orient(project(r), false) }));
  const polygons = outers.map((o) => ({ outer: o.ring, holes: [] }));
  for (const inner of inners) {
    const host = polygons.find((p) => pointInRing(inner.ring[0], p.outer));
    if (!host) throw new Error(`inner ring (ways ${inner.wayIds.join(',')}) not inside any outer ring`);
    host.holes.push({ wayIds: inner.wayIds, ring: inner.ring });
  }
  return { polygons, meta: {} };
}

// ---------- mode: coastline-clip ----------

function assembleCoastlineClip(config, raw, proj) {
  // convex play region: projected bbox rect ∩ cut half-planes (keep the
  // side containing the seed — no orientation folklore in the config)
  const [minLat, minLon, maxLat, maxLon] = config.bbox;
  const c1 = proj.toXY(minLat, minLon);
  const c2 = proj.toXY(maxLat, maxLon);
  const seed = proj.toXY(config.seed.lat, config.seed.lon);
  let region = [
    [c1[0], c1[1]], [c2[0], c1[1]], [c2[0], c2[1]], [c1[0], c2[1]],
  ]; // CCW rect
  for (const cut of config.cuts ?? []) {
    region = halfPlaneClipPolygon(region, proj.toXY(cut.a[0], cut.a[1]), proj.toXY(cut.b[0], cut.b[1]), seed);
    if (region.length < 3) throw new Error(`cut "${cut.name}" removed the whole region`);
  }
  if (shoelaceSigned(region) < 0) region.reverse();

  // stitch coastline ways into chains; a chain either closes (island) or
  // dead-ends outside the region (its continuation was not fetched)
  const ways = raw.elements
    .filter((e) => e.type === 'way')
    .map((w) => ({ id: w.id, pts: w.geometry.map((g) => ({ lat: g.lat, lon: g.lon })) }));
  // Stitch ways into maximal chains. Coastline is directed (land left), so
  // each endpoint has at most one incoming and one outgoing way; a chain
  // must START at a true head (no incoming way in the fetched set) —
  // starting mid-sequence would leave a predecessor fragment that breaks
  // INSIDE the region, off the boundary, and corrupt the closure walk.
  // Ways left after head-chaining are pure cycles (closed coastlines).
  const chains = [];
  const closed = [];
  {
    const open = [];
    for (const w of ways.slice().sort((a, b) => a.id - b.id)) {
      if (w.pts[0].lat === w.pts[w.pts.length - 1].lat && w.pts[0].lon === w.pts[w.pts.length - 1].lon) {
        closed.push(w.pts.slice(0, -1));
      } else {
        open.push(w);
      }
    }
    const key = (p) => `${p.lat},${p.lon}`;
    const byStart = new Map();
    const endKeys = new Set();
    for (const w of open) {
      const k = key(w.pts[0]);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(w);
      endKeys.add(key(w.pts[w.pts.length - 1]));
    }
    const used = new Set();
    const follow = (head) => {
      used.add(head);
      let chain = head.pts.slice();
      for (;;) {
        const nexts = (byStart.get(key(chain[chain.length - 1])) ?? []).filter((n) => !used.has(n));
        if (nexts.length === 0) return chain;
        const n = nexts[0];
        used.add(n);
        chain = chain.concat(n.pts.slice(1));
        if (key(chain[0]) === key(chain[chain.length - 1])) {
          closed.push(chain.slice(0, -1));
          return null;
        }
      }
    };
    for (const w of open) {
      if (used.has(w) || endKeys.has(key(w.pts[0]))) continue; // not a head
      const chain = follow(w);
      if (chain) chains.push(chain);
    }
    for (const w of open) {
      if (used.has(w)) continue; // leftover = cycle through fetched ways
      const chain = follow(w);
      if (chain) chains.push(chain); // data seam mid-cycle: keep as open chain
    }
  }

  const toXY = (pts) => pts.map((p) => proj.toXY(p.lat, p.lon));

  // clip open chains and boundary-crossing closed rings to the region
  const clipped = [];
  for (const chain of chains) {
    clipped.push(...clipPolylineToConvex(toXY(chain), region));
  }
  const islandRings = [];
  let droppedWaterSideRings = 0;
  for (const ring of closed) {
    const xy = toXY(ring);
    const outsideIdx = xy.findIndex((p) => !insideConvex(p, region));
    if (outsideIdx === -1) {
      // OSM coastline runs with land on the LEFT, so a closed ring that
      // is an island traverses CCW (positive shoelace) in this frame. A
      // CW ring encloses WATER (a harbour basin / lagoon seam) — inside
      // open water it carries no boundary and must not become an island
      // (measured on Friday Harbor: a CW basin ring swallowed the whole
      // harbour as a fake island).
      if (shoelaceSigned(xy) > 0) islandRings.push(xy);
      else droppedWaterSideRings++;
    } else {
      const rolled = [...xy.slice(outsideIdx), ...xy.slice(0, outsideIdx), xy[outsideIdx]];
      clipped.push(...clipPolylineToConvex(rolled, region));
    }
  }

  // walk the region boundary to close water rings; the seed picks the
  // walking direction and the outer ring, both self-validating
  const perimeter = makePerimeter(region);
  let outer = null;
  let waterRings = null;
  let walkDir = 0;
  for (const dir of [1, -1]) {
    const rings = walkWaterRings(clipped.map((c) => c.slice()), perimeter, dir);
    const hit = rings.find((r) => pointInRing(seed, r));
    if (hit && !ringSelfIntersects(hit)) { outer = hit; waterRings = rings; walkDir = dir; break; }
  }
  if (!outer) throw new Error('no assembled water ring contains the seed (both walk directions tried)');

  const droppedWaterRings = waterRings.length - 1;
  const holes = islandRings
    .filter((r) => pointInRing(r[0], outer))
    .filter((r) => ringArea(r) >= config.islandMinAreaM2)
    .map((r) => ({ wayIds: [], ring: r }));

  const orient = (ring, ccw) => ((shoelaceSigned(ring) > 0) === ccw ? ring : ring.slice().reverse());
  const polygons = [{
    outer: orient(outer, true),
    holes: holes.map((h) => ({ wayIds: h.wayIds, ring: orient(h.ring, false) })),
  }];
  return {
    polygons,
    meta: {
      walkDir,
      droppedWaterRings,
      droppedIslets: islandRings.filter((r) => pointInRing(r[0], outer)).length - holes.length,
      droppedWaterSideRings,
      regionCorners: region.length,
    },
  };
}

// ---------- shared post-pipeline ----------

/** Raw (unsimplified) assembled polygons — exported for the check and
 *  render tools so ground truth and artifact share one code path. */
export function assembleRawPolygons(config) {
  const raw = readRaw(config.raw);
  const proj = projectionFor(config, raw);
  const { polygons, meta } =
    config.mode === 'coastline-clip'
      ? assembleCoastlineClip(config, raw, proj)
      : assembleRelation(config, raw, proj);
  return { polygons, meta, proj, osmBase: raw.osm3s?.timestamp_osm_base ?? null };
}

export function buildBoundary(config, { sweep = false } = {}) {
  const { polygons: polygonsRaw, meta, proj, osmBase } = assembleRawPolygons(config);

  const polyArea = (p) => ringArea(p.outer) - p.holes.reduce((s, h) => s + ringArea(h.ring), 0);
  const areaRawM2 = polygonsRaw.reduce((s, p) => s + polyArea(p), 0);
  const rawVertices = polygonsRaw.reduce(
    (s, p) => s + p.outer.length + p.holes.reduce((t, h) => t + h.ring.length, 0), 0);

  const preSpacing = config.simplify.radialPreSpacingM ?? 0;
  const pre = (ring) => (preSpacing > 0 ? simplifyRadial(ring, preSpacing) : ring);

  if (sweep) {
    for (const eps of [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000]) {
      const counts = polygonsRaw.map((p) => {
        const o = visvalingam(pre(p.outer), { minTriangleAreaM2: eps, minRingVerts: config.simplify.minRingVerts });
        const hs = p.holes.reduce((s, h) =>
          s + visvalingam(pre(h.ring), { minTriangleAreaM2: eps, minRingVerts: config.simplify.minRingVerts }).length, 0);
        return `outer=${o.length} holeVerts=${hs} (${p.holes.length} holes)`;
      });
      console.log(`eps=${eps} m² → ${counts.join(' | ')}`);
    }
    return null;
  }

  // simplify with a halve-epsilon retry ladder: if an epsilon ever
  // produces a self-intersection, a ring crossing, or a hole escaping its
  // outer, halve it and rebuild — narrow straits are the risk case
  let passes = 0;
  let eps = config.simplify.minTriangleAreaM2;
  let polygons = null;
  let holesSealed = 0;
  for (; passes < config.simplify.maxPasses; passes++, eps /= 2) {
    holesSealed = 0;
    const candidate = polygonsRaw.map((p) => {
      const outer = visvalingam(pre(p.outer), { minTriangleAreaM2: eps, minRingVerts: config.simplify.minRingVerts });
      const holes = p.holes
        .map((h) => ({
          wayIds: h.wayIds,
          ring: visvalingam(pre(h.ring), { minTriangleAreaM2: eps, minRingVerts: config.simplify.minRingVerts }),
        }))
        // an islet whose narrow surrounding water the smoothed shoreline
        // legitimately sealed is dropped (counted in stats); the check
        // tool separately asserts every REQUIRED island survived
        .filter((h) => {
          const kept = pointInRing(h.ring[0], outer) && !ringsCross(outer, h.ring);
          if (!kept) holesSealed++;
          return kept;
        });
      return { outer, holes };
    });
    const rings = candidate.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]);
    const bad =
      rings.some((r) => ringSelfIntersects(r)) ||
      candidate.some((p) =>
        p.holes.some((a, i) => p.holes.some((b, j) => j > i && ringsCross(a.ring, b.ring))));
    if (!bad) { polygons = candidate; break; }
  }
  if (!polygons) throw new Error(`simplification failed after ${passes} passes (last eps=${eps * 2})`);

  const roundRing = (ring) => ring.map(([x, y]) => [round2(x), round2(y)]);

  // name holes by containment of config-declared points (islands from
  // coastline mode carry no single way id) or by way id (relation mode)
  const nameFor = (h) => {
    if (h.wayIds.length === 1 && config.holeNames?.[String(h.wayIds[0])]) {
      return config.holeNames[String(h.wayIds[0])];
    }
    for (const isl of config.islandNames ?? []) {
      if (pointInRing(proj.toXY(isl.lat, isl.lon), h.ring)) return isl.name;
    }
    return null;
  };

  const polygonsOut = polygons.map((p) => ({
    outer: roundRing(p.outer),
    holes: p.holes
      .map((h) => ({ name: nameFor(h), ring: roundRing(h.ring) }))
      .sort((a, b) => ringArea(b.ring) - ringArea(a.ring)),
  }));

  const areaM2 = polygonsOut.reduce(
    (s, p) => s + ringArea(p.outer) - p.holes.reduce((t, h) => t + ringArea(h.ring), 0), 0);
  const vertices = polygonsOut.reduce(
    (s, p) => s + p.outer.length + p.holes.reduce((t, h) => t + h.ring.length, 0), 0);
  const outerVertices = polygonsOut.reduce((s, p) => s + p.outer.length, 0);
  const bbox = ringsBbox(polygonsOut.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]))
    .map(round2);

  return {
    format: 'bodyarcade-boundary/1',
    name: config.name,
    displayName: config.displayName,
    source: {
      provider: config.source.provider,
      mode: config.mode,
      ...(config.source.osmRelation ? { osmRelation: config.source.osmRelation } : {}),
      url: config.source.url,
      license: config.source.license,
      attribution: config.source.attribution,
      osmBaseTimestamp: osmBase,
      ...(config.mode === 'coastline-clip'
        ? { bbox: config.bbox, cuts: (config.cuts ?? []).map((c) => ({ name: c.name, a: c.a, b: c.b })) }
        : {}),
    },
    projection: { type: 'local-tangent-equirect', lat0: proj.lat0, lon0: proj.lon0, earthRadiusM: proj.earthRadiusM },
    units: 'm',
    bbox,
    polygons: polygonsOut,
    stats: {
      rawVertices,
      vertices,
      outerVertices,
      holes: polygonsOut.reduce((s, p) => s + p.holes.length, 0),
      ...(config.mode === 'coastline-clip'
        ? { droppedIslets: meta.droppedIslets, droppedWaterRings: meta.droppedWaterRings, holesSealedBySimplification: holesSealed }
        : {}),
      // conditional so pre-existing artifacts (SF Bay) stay byte-identical
      ...(meta.droppedWaterSideRings ? { droppedWaterSideRings: meta.droppedWaterSideRings } : {}),
      areaRawM2: Math.round(areaRawM2),
      areaM2: Math.round(areaM2),
      areaDeltaPct: Math.round(((areaM2 - areaRawM2) / areaRawM2) * 1e6) / 1e4,
      simplify: {
        method: 'visvalingam-whyatt',
        radialPreSpacingM: preSpacing,
        minTriangleAreaM2: eps, // effective epsilon of the accepted pass
        requestedMinTriangleAreaM2: config.simplify.minTriangleAreaM2,
        minRingVerts: config.simplify.minRingVerts,
        passes: passes + 1,
      },
    },
  };
}

export function serializeBoundary(artifact) {
  return JSON.stringify(artifact, null, 1) + '\n';
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const sweep = args.includes('--sweep');
  const outIdx = args.indexOf('--out');
  const positional = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
  const configPath = positional[0] ?? join(PKG_ROOT, 'configs/san-francisco-bay.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const artifact = buildBoundary(config, { sweep });
  if (artifact) {
    const outPath = outIdx >= 0 ? args[outIdx + 1] : join(PKG_ROOT, config.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, serializeBoundary(artifact));
    const s = artifact.stats;
    console.log(
      `${artifact.name}: ${s.rawVertices} → ${s.vertices} verts ` +
      `(outer ${s.outerVertices}, ${s.holes} islands), area delta ${s.areaDeltaPct}%, ` +
      `eps ${s.simplify.minTriangleAreaM2} m², → ${outPath}`,
    );
  }
}
