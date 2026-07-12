// Normalize + simplify stage: raw OSM extract → projected, classified,
// clipped, simplified layer features in local metres. The class
// vocabularies here are the style-separation contract — semantic only
// (what a thing IS), never how a profile draws it. Adding a profile must
// never require touching this file (non-negotiable).

import {
  makeProjection, shoelaceSigned, visvalingam, simplifyRadial,
  ringSelfIntersects, clipPolylineToConvex, insideConvex, stitchRings,
} from '../../../packages/world-data/tools/geometry.mjs';
import { roundCm, roundDm, roundRing } from './util.mjs';

// ---- class vocabularies (documented in WORLD_SCHEMA.md) ----

const ROAD_CLASS = {
  motorway: 'major', trunk: 'major', primary: 'major', secondary: 'major',
  tertiary: 'major', motorway_link: 'major', trunk_link: 'major',
  primary_link: 'major', secondary_link: 'major', tertiary_link: 'major',
  residential: 'street', unclassified: 'street', living_street: 'street',
  pedestrian: 'street', service: 'service', track: 'track',
};
const ROAD_WIDTH_M = { major: 7, street: 5, service: 3.5, track: 3 };

const PATH_CLASS = {
  footway: 'footway', path: 'path', steps: 'steps', cycleway: 'cycleway',
  bridleway: 'path',
};

const WATERWAY_CLASS = { river: 'river', stream: 'stream', canal: 'canal', ditch: 'ditch', drain: 'ditch' };

const LANDUSE_CLASS = [
  // [match(tags) predicate, class] — first hit wins; order is the contract
  [(t) => t.natural === 'wood' || t.landuse === 'forest', 'forest'],
  [(t) => t.natural === 'wetland', 'wetland'],
  [(t) => t.natural === 'beach' || t.natural === 'sand', 'beach'],
  [(t) => t.natural === 'bare_rock' || t.natural === 'scree' || t.landuse === 'quarry', 'rock'],
  [(t) => t.natural === 'glacier', 'glacier'],
  [(t) => t.natural === 'heath' || t.natural === 'scrub', 'heath'],
  [(t) => t.natural === 'grassland' || t.landuse === 'grass' || t.landuse === 'meadow'
       || t.landuse === 'village_green' || t.leisure === 'park' || t.leisure === 'garden'
       || t.leisure === 'pitch' || t.leisure === 'playground' || t.leisure === 'golf_course'
       || t.leisure === 'nature_reserve' || t.landuse === 'recreation_ground', 'grass'],
  [(t) => t.landuse === 'farmland' || t.landuse === 'orchard' || t.landuse === 'allotments'
       || t.landuse === 'farmyard' || t.landuse === 'vineyard', 'farmland'],
  [(t) => t.landuse === 'residential', 'residential'],
  [(t) => t.landuse === 'industrial' || t.landuse === 'harbour' || t.landuse === 'port'
       || t.landuse === 'railway', 'industrial'],
  [(t) => t.landuse === 'commercial' || t.landuse === 'retail', 'commercial'],
  [(t) => t.landuse === 'cemetery', 'cemetery'],
];

const AEROWAY_LINE = { runway: 'runway', taxiway: 'taxiway' };

const BUILDING_DEFAULT_HEIGHT = { church: 12, cathedral: 15, industrial: 6, warehouse: 6, hangar: 7 };

// ---- helpers ----

/** Open-polyline Visvalingam: endpoints pinned, interior vertices removed
 *  smallest-triangle-first until every survivor spans >= minTriangleAreaM2. */
export function visvalingamLine(pts, minTriangleAreaM2) {
  if (pts.length <= 2) return pts.slice();
  const alive = pts.map(() => true);
  const tri = (a, b, c) =>
    Math.abs(
      (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) -
      (pts[c][0] - pts[a][0]) * (pts[b][1] - pts[a][1]),
    ) / 2;
  for (;;) {
    let minA = Infinity;
    let minI = -1;
    let prev = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      if (!alive[i]) continue;
      let next = i + 1;
      while (next < pts.length - 1 && !alive[next]) next++;
      const a = tri(prev, i, next);
      if (a < minA) { minA = a; minI = i; }
      prev = i;
    }
    if (minI < 0 || minA >= minTriangleAreaM2) break;
    alive[minI] = false;
  }
  return pts.filter((_, i) => alive[i]);
}

/** Sutherland–Hodgman clip of an arbitrary ring against the convex bbox
 *  region (4 half-plane passes). Non-convex subjects may gain boundary-
 *  running bridges — acceptable for area layers, counted in stats. */
export function clipRingToRegion(ring, region) {
  let out = ring.slice();
  for (let i = 0; i < region.length && out.length >= 3; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) {
        next.push(p);
        if (sq < 0) next.push(lerpAt(p, q, sp, sq));
      } else if (sq >= 0) {
        next.push(lerpAt(p, q, sp, sq));
      }
    }
    out = next;
  }
  return out.length >= 3 ? out : null;
}

const lerpAt = (p, q, sp, sq) => {
  const t = sp / (sp - sq);
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
};

const parseNum = (v) => {
  if (typeof v !== 'string') return null;
  const m = v.match(/^\s*(-?\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

function buildingHeight(tags) {
  const h = parseNum(tags.height) ?? parseNum(tags['building:height']);
  if (h !== null && h > 0) return roundDm(h);
  const levels = parseNum(tags['building:levels']);
  if (levels !== null && levels > 0) return roundDm(levels * 3 + 2);
  return BUILDING_DEFAULT_HEIGHT[tags.building] ?? 5;
}

/** Rings from a way or multipolygon relation (outer members stitched). */
function outerRingsOf(el) {
  if (el.type === 'way') {
    const pts = el.geometry ?? [];
    if (pts.length < 4) return [];
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.lat !== last.lat || first.lon !== last.lon) return [];
    return [pts.slice(0, -1)];
  }
  if (el.type === 'relation') {
    const ways = (el.members ?? [])
      .filter((m) => m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry))
      .map((m) => ({ id: m.ref, pts: m.geometry.map((g) => ({ lat: g.lat, lon: g.lon })) }));
    try {
      return stitchRings(ways).map((r) => r.pts);
    } catch {
      return []; // seam outside the bbox — counted by the caller
    }
  }
  return [];
}

// ---- the stage ----

/**
 * Raw extract → { proj, region, bboxM, layers, diagnostics }. Layers hold
 * projected, clipped, simplified, cm-rounded features sorted by OSM id.
 */
export function normalizeLayers(config, extract) {
  const [minLat, minLon, maxLat, maxLon] = [
    config.bbox[0], config.bbox[1], config.bbox[2], config.bbox[3],
  ];
  const lat0 = Math.round(((minLat + maxLat) / 2) * 1e4) / 1e4;
  const lon0 = Math.round(((minLon + maxLon) / 2) * 1e4) / 1e4;
  const proj = makeProjection(lat0, lon0);
  const c1 = proj.toXY(minLat, minLon);
  const c2 = proj.toXY(maxLat, maxLon);
  const region = [[c1[0], c1[1]], [c2[0], c1[1]], [c2[0], c2[1]], [c1[0], c2[1]]]; // CCW
  const bboxM = [c1[0], c1[1], c2[0], c2[1]];

  const lineEps = config.simplify?.lineToleranceM2 ?? 1.5;
  const toXY = (pts) => pts.map((g) => proj.toXY(g.lat, g.lon));

  const roads = [];
  const paths = [];
  const waterways = [];
  const buildings = [];
  const landuse = [];
  const boundaries = [];
  const aeroways = [];
  const lakes = [];
  const coastlineWays = [];
  const pierWays = [];
  const aerowayNodes = [];
  const diagnostics = { droppedDegenerate: 0, droppedRelationSeam: 0, droppedSelfIntersecting: 0, clippedAway: 0 };

  /** clip → simplify → round; returns polyline pieces (>=2 pts). */
  const linePieces = (el) => {
    if (!Array.isArray(el.geometry) || el.geometry.length < 2) { diagnostics.droppedDegenerate++; return []; }
    const pieces = clipPolylineToConvex(toXY(el.geometry), region);
    if (pieces.length === 0) diagnostics.clippedAway++;
    return pieces
      .map((p) => roundRing(visvalingamLine(p, lineEps)))
      .filter((p) => p.length >= 2);
  };

  /** clip → simplify → round a closed area ring; null when gone. */
  const luSimplify = config.simplify?.landuse ?? { radialPreSpacingM: 4, minTriangleAreaM2: 20, minRingVerts: 8 };
  const areaRing = (ptsLatLon, eps = luSimplify) => {
    const clipped = clipRingToRegion(toXY(ptsLatLon), region);
    if (!clipped) { diagnostics.clippedAway++; return null; }
    const pre = eps.radialPreSpacingM > 0 ? simplifyRadial(clipped, eps.radialPreSpacingM) : clipped;
    let ring = null;
    for (let e = eps.minTriangleAreaM2; e >= eps.minTriangleAreaM2 / 64; e /= 2) {
      const cand = visvalingam(pre, { minTriangleAreaM2: e, minRingVerts: eps.minRingVerts });
      if (!ringSelfIntersects(cand)) { ring = cand; break; }
    }
    if (!ring) {
      // ladder exhausted; the clipped ring itself may self-intersect
      // (Sutherland–Hodgman on a non-convex subject can bowtie) — never
      // ship a bad ring, drop and count instead
      if (ringSelfIntersects(pre)) { diagnostics.droppedSelfIntersecting++; return null; }
      ring = pre;
    }
    if (Math.abs(shoelaceSigned(ring)) < 1) { diagnostics.droppedDegenerate++; return null; }
    return roundRing(shoelaceSigned(ring) > 0 ? ring : ring.slice().reverse()); // outward CCW
  };

  const elements = extract.elements.slice().sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.id - b.id));

  for (const el of elements) {
    const t = el.tags ?? {};

    if (el.type === 'node') {
      if (t.aeroway) {
        const [x, y] = proj.toXY(el.lat, el.lon);
        if (insideConvex([x, y], region)) {
          aerowayNodes.push({ id: el.id, class: t.aeroway, name: t.name ?? null, pos: [roundCm(x), roundCm(y)] });
        }
      }
      continue;
    }

    if (t.natural === 'coastline' && el.type === 'way') {
      coastlineWays.push(el);
      continue;
    }

    if (t.building && (el.type === 'way' || el.type === 'relation')) {
      const rings = outerRingsOf(el);
      if (rings.length === 0 && el.type === 'relation') diagnostics.droppedRelationSeam++;
      for (const ringLatLon of rings) {
        const xy = toXY(ringLatLon);
        // keep whole footprints; membership by first vertex (footprints are
        // tiny next to the bbox — clipping would make slivers of homes)
        if (!insideConvex(xy[0], region)) { diagnostics.clippedAway++; continue; }
        if (ringSelfIntersects(xy) || Math.abs(shoelaceSigned(xy)) < 4) { diagnostics.droppedDegenerate++; continue; }
        buildings.push({
          id: el.id,
          outer: roundRing(shoelaceSigned(xy) > 0 ? xy : xy.slice().reverse()),
          heightM: buildingHeight(t),
          name: t.name ?? null,
        });
      }
      continue;
    }

    if (t.natural === 'water' && (el.type === 'way' || el.type === 'relation')) {
      for (const ringLatLon of outerRingsOf(el)) {
        const ring = areaRing(ringLatLon, config.water?.simplify ?? luSimplify);
        if (!ring) continue;
        const cls = t.water === 'pond' ? 'pond' : t.water === 'reservoir' ? 'reservoir' : 'lake';
        lakes.push({ id: el.id, class: cls, name: t.name ?? null, outer: ring, holes: [] });
      }
      continue;
    }

    if (el.type !== 'way') continue;

    if (t.highway && ROAD_CLASS[t.highway]) {
      const cls = ROAD_CLASS[t.highway];
      for (const pts of linePieces(el)) {
        roads.push({
          id: el.id, class: cls, name: t.name ?? null, pts,
          widthM: roundDm(parseNum(t.width) ?? ROAD_WIDTH_M[cls]),
          bridge: t.bridge === 'yes' || undefined,
          tunnel: t.tunnel === 'yes' || undefined,
        });
      }
    } else if (t.highway && PATH_CLASS[t.highway]) {
      for (const pts of linePieces(el)) {
        paths.push({ id: el.id, class: PATH_CLASS[t.highway], pts });
      }
    } else if (t.man_made === 'pier' || t.man_made === 'breakwater' || t.man_made === 'quay') {
      pierWays.push(el);
      if (t.man_made === 'pier') {
        for (const pts of linePieces(el)) paths.push({ id: el.id, class: 'pier', pts });
      }
    } else if (t.waterway && WATERWAY_CLASS[t.waterway]) {
      for (const pts of linePieces(el)) {
        waterways.push({
          id: el.id, class: WATERWAY_CLASS[t.waterway], name: t.name ?? null, pts,
          widthM: roundDm(parseNum(t.width) ?? (WATERWAY_CLASS[t.waterway] === 'river' ? 8 : 2)),
        });
      }
    } else if (t.aeroway && AEROWAY_LINE[t.aeroway]) {
      for (const pts of linePieces(el)) {
        aeroways.push({ id: el.id, class: AEROWAY_LINE[t.aeroway], name: t.ref ?? t.name ?? null, pts });
      }
    } else if (t.boundary === 'administrative') {
      for (const pts of linePieces(el)) {
        boundaries.push({
          id: el.id, class: 'administrative',
          adminLevel: parseNum(t.admin_level) ?? null, name: t.name ?? null, pts,
        });
      }
    } else {
      const luMatch = LANDUSE_CLASS.find(([pred]) => pred(t));
      if (luMatch) {
        for (const ringLatLon of outerRingsOf(el)) {
          const ring = areaRing(ringLatLon);
          if (ring) landuse.push({ id: el.id, class: luMatch[1], name: t.name ?? null, outer: ring });
        }
      }
    }
  }

  // coastline as a display/collision layer: clipped, lightly simplified
  const coastline = [];
  for (const el of coastlineWays) {
    for (const pts of clipPolylineToConvex(toXY(el.geometry), region)) {
      const simp = roundRing(visvalingamLine(pts, config.water?.simplify?.minTriangleAreaM2 ?? 30));
      if (simp.length >= 2) coastline.push({ id: el.id, pts: simp });
    }
  }

  return {
    proj, region, bboxM,
    layers: { coastline, waterways, roads, paths, buildings, landuse, boundaries, aeroways },
    aerowayNodes,
    pierWays: pierWays.map((el) => ({ id: el.id, tags: el.tags, xy: toXY(el.geometry) })),
    lakes,
    coastlineWayCount: coastlineWays.length,
    diagnostics,
  };
}
