// Geometry core for the boundary pipeline: ring stitching, tangent-plane
// projection, shoelace area, Visvalingam–Whyatt simplification, intersection
// checks, point-in-polygon, distance-to-shore. Pure functions, no deps,
// deterministic (stable tie-breaks) — the check tool asserts byte-identical
// rebuilds. Offline tooling only; the small runtime subset (PIP + distance)
// is mirrored in ../src/index.ts with a cross-reference comment.

export const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

const samePt = (a, b) => a.lat === b.lat && a.lon === b.lon;

/**
 * Stitch OSM member ways (same role) into closed rings. Closed ways are
 * rings already; open ways are chained end-to-end by exact coordinate
 * match (shared OSM nodes print identical coordinates). Returns rings as
 * arrays of {lat, lon} WITHOUT the duplicate closing point, each with the
 * contributing way ids attached.
 */
export function stitchRings(ways) {
  const rings = [];
  const open = [];
  for (const w of ways) {
    const pts = w.pts;
    if (pts.length < 2) throw new Error(`way ${w.id}: degenerate (${pts.length} pts)`);
    if (samePt(pts[0], pts[pts.length - 1])) {
      rings.push({ pts: pts.slice(0, -1), wayIds: [w.id] });
    } else {
      open.push({ pts: pts.slice(), wayIds: [w.id] });
    }
  }
  while (open.length > 0) {
    const ring = open.shift();
    while (!samePt(ring.pts[0], ring.pts[ring.pts.length - 1])) {
      const end = ring.pts[ring.pts.length - 1];
      let found = -1;
      let reversed = false;
      for (let i = 0; i < open.length; i++) {
        if (samePt(open[i].pts[0], end)) { found = i; reversed = false; break; }
        if (samePt(open[i].pts[open[i].pts.length - 1], end)) { found = i; reversed = true; break; }
      }
      if (found < 0) {
        throw new Error(`unclosed ring: no continuation at ${end.lat},${end.lon} (ways so far: ${ring.wayIds.join(',')})`);
      }
      const seg = open.splice(found, 1)[0];
      if (reversed) seg.pts.reverse();
      ring.pts = ring.pts.concat(seg.pts.slice(1));
      ring.wayIds.push(...seg.wayIds);
    }
    ring.pts = ring.pts.slice(0, -1);
    rings.push(ring);
  }
  return rings;
}

/** Local tangent-plane (equirectangular) projection: meters east/north of
 *  (lat0, lon0). Exact enough at bay scale (<0.1% distortion over 60 km). */
export function makeProjection(lat0, lon0) {
  const cosLat0 = Math.cos(lat0 * DEG);
  return {
    lat0,
    lon0,
    earthRadiusM: EARTH_RADIUS_M,
    toXY: (lat, lon) => [
      (lon - lon0) * DEG * EARTH_RADIUS_M * cosLat0,
      (lat - lat0) * DEG * EARTH_RADIUS_M,
    ],
  };
}

/** Signed shoelace area of a ring ([[x,y],...], no closing duplicate).
 *  Positive = counter-clockwise. */
export function shoelaceSigned(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/**
 * Visvalingam–Whyatt: repeatedly remove the vertex whose triangle with its
 * neighbours has the smallest area, until every remaining vertex's
 * effective area is >= minTriangleAreaM2 or the ring is down to
 * minRingVerts. O(n^2) scan per removal — fine at this scale, and trivially
 * deterministic (ties broken by lowest index).
 */
export function visvalingam(ring, { minTriangleAreaM2, minRingVerts }) {
  const n = ring.length;
  if (n <= minRingVerts) return ring.slice();
  const prev = new Array(n);
  const next = new Array(n);
  const alive = new Array(n).fill(true);
  for (let i = 0; i < n; i++) {
    prev[i] = (i - 1 + n) % n;
    next[i] = (i + 1) % n;
  }
  const tri = (a, b, c) =>
    Math.abs(
      (ring[b][0] - ring[a][0]) * (ring[c][1] - ring[a][1]) -
      (ring[c][0] - ring[a][0]) * (ring[b][1] - ring[a][1]),
    ) / 2;
  let count = n;
  while (count > minRingVerts) {
    let minA = Infinity;
    let minI = -1;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const a = tri(prev[i], i, next[i]);
      if (a < minA) { minA = a; minI = i; }
    }
    if (minA >= minTriangleAreaM2) break;
    alive[minI] = false;
    next[prev[minI]] = next[minI];
    prev[next[minI]] = prev[minI];
    count--;
  }
  const out = [];
  let i = 0;
  while (!alive[i]) i++;
  let j = i;
  do {
    out.push(ring[j]);
    j = next[j];
  } while (j !== i);
  return out;
}

function segsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** True if a ring properly self-intersects (adjacent segments excluded). */
export function ringSelfIntersects(ring) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segsCross(a1, a2, ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** True if any segment of ring A properly crosses any segment of ring B. */
export function ringsCross(a, b) {
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

/** Even-odd point-in-ring test ([x,y], ring without closing duplicate). */
export function pointInRing(pt, ring) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Point in water: inside the outer ring, outside every hole (even-odd). */
export function pointInWater(pt, polygon) {
  if (!pointInRing(pt, polygon.outer)) return false;
  for (const hole of polygon.holes) {
    if (pointInRing(pt, hole.ring)) return false;
  }
  return true;
}

function segDist(pt, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + t * dx - pt[0];
  const py = a[1] + t * dy - pt[1];
  return Math.hypot(px, py);
}

/** Unsigned distance from a point to the nearest shore segment (outer or
 *  hole). Combine with pointInWater for the sign. */
export function distanceToShore(pt, polygon) {
  let min = Infinity;
  const rings = [polygon.outer, ...polygon.holes.map((h) => h.ring)];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const d = segDist(pt, ring[i], ring[(i + 1) % ring.length]);
      if (d < min) min = d;
    }
  }
  return min;
}

/** bbox of a list of rings: [minx, miny, maxx, maxy]. */
export function ringsBbox(rings) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
    }
  }
  return [minx, miny, maxx, maxy];
}

// ---------- coastline-clip mode primitives ----------
//
// A play region is a CONVEX polygon: the config bbox intersected with
// named half-plane "cut" lines (the play-space gates — e.g. the Pacific
// side of the Golden Gate). Convexity keeps polyline clipping exact and
// the boundary walk unambiguous; the build tool asserts it.

/** Clip a convex CCW polygon by the half-plane of line a→b containing
 *  keepPt (Sutherland–Hodgman, one edge). */
export function halfPlaneClipPolygon(poly, a, b, keepPt) {
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const keepSign = Math.sign(side(keepPt));
  if (keepSign === 0) throw new Error('half-plane keep point lies on the cut line');
  const inside = (p) => side(p) * keepSign >= 0;
  const intersect = (p, q) => {
    const sp = side(p);
    const sq = side(q);
    const t = sp / (sp - sq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if (inside(p)) {
      out.push(p);
      if (!inside(q)) out.push(intersect(p, q));
    } else if (inside(q)) {
      out.push(intersect(p, q));
    }
  }
  return out;
}

/** True if pt is inside a convex CCW polygon (edge-inclusive). */
export function insideConvex(pt, region, eps = 1e-9) {
  for (let i = 0; i < region.length; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    if ((b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]) < -eps) return false;
  }
  return true;
}

/** Clip an open polyline to a convex region. Returns sub-polylines whose
 *  interior endpoints lie exactly on the region boundary. */
export function clipPolylineToConvex(pts, region) {
  const out = [];
  let cur = null;
  const clipSeg = (p, q) => {
    // parametric clip of segment p→q against every region edge
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < region.length; i++) {
      const a = region[i];
      const b = region[(i + 1) % region.length];
      const nx = -(b[1] - a[1]);
      const ny = b[0] - a[0]; // inward normal of a CCW edge
      const dp = (p[0] - a[0]) * nx + (p[1] - a[1]) * ny;
      const dq = (q[0] - a[0]) * nx + (q[1] - a[1]) * ny;
      const denom = dq - dp;
      if (Math.abs(denom) < 1e-12) {
        if (dp < 0) return null; // parallel and outside
        continue;
      }
      const t = -dp / denom;
      if (denom > 0) { if (t > t0) t0 = t; } else { if (t < t1) t1 = t; }
      if (t0 > t1) return null;
    }
    const lerp = (t) => [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
    return [t0, t1, lerp(t0), lerp(t1)];
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    const clipped = clipSeg(pts[i], pts[i + 1]);
    if (!clipped) {
      if (cur) { out.push(cur); cur = null; }
      continue;
    }
    const [t0, t1, a, b] = clipped;
    if (!cur || t0 > 0) {
      if (cur) out.push(cur);
      cur = [a];
    }
    cur.push(b);
    if (t1 < 1) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.length >= 2);
}

/** Perimeter parametrization of a convex CCW region. */
export function makePerimeter(region) {
  const cum = [0];
  for (let i = 0; i < region.length; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[region.length];
  const paramOf = (pt) => {
    let best = Infinity;
    let bestT = 0;
    for (let i = 0; i < region.length; i++) {
      const a = region[i];
      const b = region[(i + 1) % region.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + t * dx - pt[0];
      const py = a[1] + t * dy - pt[1];
      const d = px * px + py * py;
      if (d < best) { best = d; bestT = cum[i] + Math.sqrt(len2) * t; }
    }
    return bestT % total;
  };
  /** corner params strictly between t0 and t1 travelling in dir (+1 = CCW). */
  const cornersBetween = (t0, t1, dir) => {
    const ahead = (t) => {
      const d = dir > 0 ? t - t0 : t0 - t;
      return ((d % total) + total) % total;
    };
    const span = ahead(t1) === 0 ? total : ahead(t1);
    const out = [];
    for (let i = 0; i < region.length; i++) {
      const a = ahead(cum[i]);
      if (a > 1e-9 && a < span - 1e-9) out.push({ t: cum[i], ahead: a, pt: region[i] });
    }
    out.sort((p, q) => p.ahead - q.ahead);
    return out.map((c) => c.pt);
  };
  return { total, paramOf, cornersBetween };
}

/**
 * Assemble water rings from clipped coastline chains (OSM convention:
 * water on the RIGHT of way direction) + the region boundary. Chains are
 * traversed forward; at each exit point the walk continues along the
 * region boundary in `dir` to the next entry point. The caller tries
 * dir=+1 then dir=-1 and keeps whichever produces a ring containing the
 * seed — self-validating, no orientation folklore baked in.
 */
export function walkWaterRings(chains, perimeter, dir) {
  const items = chains.map((pts) => ({
    pts,
    tStart: perimeter.paramOf(pts[0]),
    tEnd: perimeter.paramOf(pts[pts.length - 1]),
    used: false,
  }));
  const ahead = (from, to) => {
    const d = dir > 0 ? to - from : from - to;
    return ((d % perimeter.total) + perimeter.total) % perimeter.total;
  };
  const rings = [];
  for (const start of items) {
    if (start.used) continue;
    start.used = true;
    const ring = [...start.pts];
    let t = start.tEnd;
    for (let guard = 0; guard <= items.length; guard++) {
      // nearest event ahead: another chain's entry, or closing on our own start
      let next = null;
      let nextDist = ahead(t, start.tStart);
      if (nextDist === 0) nextDist = perimeter.total;
      for (const it of items) {
        if (it.used) continue;
        const d = ahead(t, it.tStart);
        if (d < nextDist) { nextDist = d; next = it; }
      }
      if (!next) {
        ring.push(...perimeter.cornersBetween(t, start.tStart, dir));
        break;
      }
      ring.push(...perimeter.cornersBetween(t, next.tStart, dir));
      ring.push(...next.pts);
      next.used = true;
      t = next.tEnd;
      if (guard === items.length) throw new Error('boundary walk failed to close a ring');
    }
    rings.push(ring);
  }
  return rings;
}

/** Drop vertices closer than `spacing` metres to the last kept vertex —
 *  a cheap O(n) pre-pass so Visvalingam's O(n²) stays fast on detailed
 *  coastline input. */
export function simplifyRadial(ring, spacing) {
  if (ring.length < 4) return ring.slice();
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(ring[i][0] - last[0], ring[i][1] - last[1]) >= spacing) out.push(ring[i]);
  }
  return out.length >= 4 ? out : ring.slice();
}
