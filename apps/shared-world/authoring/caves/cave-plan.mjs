// cave-plan.mjs — Checkpoint 09 hand-authored cave/arch module plan.
//
// This file IS the authored geometry (Track B Table 8: authored/kitbashed
// modular meshes; the Ecco tradition of hand-modeled caves). Every station,
// profile value, kit-piece placement, seam stamp, and clearance number below
// is an explicit human-authored decision derived from the CP09 seam analysis
// of the committed CP05A heightfield — nothing here is generated. The
// deterministic build pipeline (build-cave-modules.py under Blender +
// bake-caves.mjs) merely REALIZES this plan as committed mesh artifacts, the
// way bake-region.mjs realizes the approved Twin Bay layout.
//
// Approved transforms (cp03/cp04A, X/Z immutable without user approval):
//   headland cave  S mouth (-420,  30)  ·  N mouth (-430, -150)
//   trench-W cave    mouth ( 450, -30)
//   arch-islet-gap  center ( -40, -70)  ·  opening 5 m (approved)
// CP09 adjusted only Y (mouth sills seated by seam stamps) — addendum §9.1.
//
// Module architecture: each cave is one watertight double-walled "pipe"
// solid — inner surface = the navigable interior, outer surface = the rock
// exterior, welded by flush collar rings at the apertures. The trimesh is
// authoritative wherever the pipe undercuts (Track B Q19). The arch is the
// same solid bent into an arc.
//
// MOUTH TOPOLOGY (the load-bearing seam decision, recorded as a CP09
// deviation-report item): a bilinear heightfield sheet is single-valued, so
// it cannot rise from below the tunnel floor to above the tunnel ceiling
// anywhere inside the bore footprint without slicing visibly through the
// interior void. Each approved mouth anchor therefore keeps its X/Z as the
// PORTAL of an open-top approach NOTCH — a stamped channel cut into the
// natural face ("locally lower", addendum §9.1) — and the enclosed bore
// begins at the notch's back wall (the APERTURE), where the natural terrain
// already stands above ceiling + margin. Inside the bore the stamped sheet
// stays below the floor; outside it forms the notch walls in open water.
// The terrain sheet therefore NEVER crosses the interior (asserted per-bake
// by cp09-throat checks). Aperture stand-off from the anchors: headland
// S 15 m, N 34 m; trench 20 m.
//
// Kenney Modular Cave Kit (CC0 — see
// ../assets/kenney-modular-cave-kit/BODYARCADE_SOURCE_RECORD.md) pieces are
// kitbashed onto the shells: portal crowns, hood ridge rocks, sill boulders,
// interior stalagmite clusters. Geometry only; materials come from the
// shared substrate rock classification at runtime (Q19 seam rule).

// ---------------------------------------------------------------------------
// Deterministic seeds (fixed offsets from the approved layout seed)
// ---------------------------------------------------------------------------

export const CAVE_SEED_BASE = 60418003 + 91000;
export const SEEDS = {
  shellNoise: CAVE_SEED_BASE + 1, // inner-wall rock displacement
  outerNoise: CAVE_SEED_BASE + 2, // outer-shell rock displacement
  ringJitter: CAVE_SEED_BASE + 3, // per-ring radial phase jitter
};

// ---------------------------------------------------------------------------
// Global shell constants (meters)
// ---------------------------------------------------------------------------

export const SHELL = {
  /** rock thickness between inner and outer surfaces */
  THICKNESS: 2.2,
  /** pipe overhang past each OPEN mouth ring, m — the lip stands proud of
   *  the stamped sill so the skirt/sill seam always overlaps (2.6 recovered
   *  against the committed GLB bytes after a plan edit dropped the key) */
  LIP_OVERHANG: 2.6,
  /** collar flare at aperture rings: outer rim bulge that frames the
   *  aperture and embeds into the notch back wall */
  COLLAR_FLARE: 1.2,
  /** collision/render skirt dropped below the outer bottom at apertures so
   *  the pipe⇄heightfield seam always overlaps (no escape gap) */
  SKIRT_DROP: 2.5,
  /** radial vertices per ring (inner and outer each) */
  RADIAL: 28,
  /** loft sampling step along the centerline, m */
  STEP: 2.4,
  /** inner-wall displacement noise amplitude / wavelength, m */
  NOISE_AMP_IN: 0.5,
  NOISE_WAVELEN_IN: 7.0,
  /** outer-shell displacement (rockier), m */
  NOISE_AMP_OUT: 1.1,
  NOISE_WAVELEN_OUT: 11.0,
  /** cross-section shape: ceiling dome fraction of interior height (the
   *  floor sits lower and flatter than a pure ellipse) */
  DOME_UP_FRAC: 0.62,
  /** floor flattening: ring points whose unit-Y is below this are pulled to
   *  the flat floor line (rounded floor corners survive) */
  FLOOR_FLAT_SIN: -0.55,
};

// ---------------------------------------------------------------------------
// Station tables — the authored bores
// ---------------------------------------------------------------------------
// s        distance along the module axis from the FIRST mouth ring, m
// lat      lateral offset from the straight mouth-to-mouth line, m
//          (positive = toward the axis-left perpendicular; see resolve())
// floorY   interior floor elevation, m
// halfW    interior half-width at the widest point of the section, m
// height   interior floor→ceiling height, m
// hood     true where the outer shell is expected to emerge from terrain
//          (rockier outer noise + kit crowning; audits allow exposure here)

/** Headland cave — the primary bay-to-bay shortcut (family D). */
export const HEADLAND = {
  id: 'cave-headland',
  mouths: [
    { name: 'south', x: -420, z: 30 },
    { name: 'north', x: -430, z: -150 },
  ],
  stations: [
    { s: 0.0,   lat: 0.0,  floorY: -34.0, halfW: 6.5, height: 8.5, hood: true },
    { s: 6.0,   lat: 1.9,  floorY: -34.8, halfW: 6.0, height: 8.0, hood: true },
    { s: 12.0,  lat: 3.6,  floorY: -35.9, halfW: 5.6, height: 7.6, hood: true },
    { s: 20.0,  lat: 5.6,  floorY: -37.2, halfW: 5.4, height: 7.3, hood: false },
    { s: 30.0,  lat: 7.6,  floorY: -38.1, halfW: 5.5, height: 7.4, hood: false },
    { s: 45.0,  lat: 9.0,  floorY: -38.7, halfW: 5.6, height: 7.5, hood: false },
    { s: 60.0,  lat: 8.0,  floorY: -39.1, halfW: 4.5, height: 6.8, hood: false }, // pinch 1
    { s: 75.0,  lat: 5.4,  floorY: -39.5, halfW: 5.2, height: 7.4, hood: false },
    { s: 90.0,  lat: 1.6,  floorY: -39.9, halfW: 5.8, height: 7.7, hood: false }, // mid gallery
    { s: 100.0, lat: -1.0, floorY: -40.1, halfW: 4.8, height: 6.6, hood: false }, // pinch 2
    { s: 110.0, lat: -4.4, floorY: -40.7, halfW: 5.5, height: 7.4, hood: false },
    { s: 125.0, lat: -7.5, floorY: -41.2, halfW: 5.7, height: 7.6, hood: false },
    { s: 140.0, lat: -8.9, floorY: -42.2, halfW: 5.5, height: 7.4, hood: false },
    { s: 152.0, lat: -7.7, floorY: -43.2, halfW: 5.3, height: 7.2, hood: true },
    { s: 163.0, lat: -5.3, floorY: -44.1, halfW: 5.6, height: 7.6, hood: true },
    { s: 172.0, lat: -2.9, floorY: -45.2, halfW: 6.0, height: 8.0, hood: true },
    { s: 180.278, lat: 0.0, floorY: -46.3, halfW: 6.5, height: 8.5, hood: true },
  ],
  /** interior darkness saturates this many meters inside each mouth */
  darkFullM: 22,
  /** kit-piece dressing (station-local frame: s along axis, lat across,
   *  dy above local interior floor; yawDeg relative to the local heading;
   *  pieces at |lat| ≥ halfW are embedded in / mounted on the wall or the
   *  outer shell — interior protrusion is capped by the clearance audit) */
  kit: [
    // south portal
    { piece: 'gate-rock',            s: 1.5,   lat: 0.0,  dy: 8.8,  yawDeg: 0,   scale: 2.6 },
    { piece: 'template-wall',        s: 2.0,   lat: -8.2, dy: -0.6, yawDeg: 20,  scale: 2.6 },
    { piece: 'template-wall',        s: 2.0,   lat: 8.2,  dy: -0.6, yawDeg: -20, scale: 2.6 },
    { piece: 'template-detail',      s: 4.0,   lat: -6.6, dy: -0.4, yawDeg: 70,  scale: 2.1 },
    { piece: 'template-detail',      s: 6.0,   lat: 7.0,  dy: -0.3, yawDeg: 160, scale: 1.7 },
    { piece: 'template-wall-half',   s: 5.0,   lat: 2.0,  dy: 9.6,  yawDeg: 35,  scale: 2.5 },
    // interior stalagmite clusters (wall-hugging; embedded into the wall)
    { piece: 'template-detail',      s: 28.0,  lat: 6.2,  dy: -0.2, yawDeg: 15,  scale: 1.9 },
    { piece: 'template-detail',      s: 52.0,  lat: -6.3, dy: -0.2, yawDeg: 200, scale: 2.2 },
    { piece: 'template-detail',      s: 87.0,  lat: 6.5,  dy: -0.2, yawDeg: 95,  scale: 2.4 },
    { piece: 'template-detail',      s: 118.0, lat: -6.1, dy: -0.2, yawDeg: 310, scale: 1.8 },
    { piece: 'template-detail',      s: 133.0, lat: 6.0,  dy: -0.2, yawDeg: 45,  scale: 1.6 },
    // north hood spine (rocky buttress crown descending to the plain)
    { piece: 'template-wall',        s: 154.0, lat: 3.0,  dy: 8.6,  yawDeg: 15,  scale: 2.7 },
    { piece: 'corridor-corner',      s: 162.0, lat: -2.0, dy: 8.0,  yawDeg: 40,  scale: 2.4 },
    { piece: 'template-wall-detail-a', s: 170.0, lat: 1.0, dy: 7.4, yawDeg: -25, scale: 2.6 },
    { piece: 'template-detail',      s: 176.0, lat: -5.5, dy: 3.0,  yawDeg: 120, scale: 2.4 },
    // north portal
    { piece: 'gate-rock',            s: 178.8, lat: 0.0,  dy: 8.8,  yawDeg: 180, scale: 2.8 },
    { piece: 'template-wall',        s: 178.0, lat: -8.4, dy: -0.4, yawDeg: 205, scale: 2.8 },
    { piece: 'template-wall',        s: 178.0, lat: 8.4,  dy: -0.4, yawDeg: 155, scale: 2.8 },
    { piece: 'template-detail',      s: 176.5, lat: 6.8,  dy: -0.3, yawDeg: 260, scale: 2.0 },
  ],
};

/** Trench-W-wall cave — smaller optional discovery (family D). */
export const TRENCH = {
  id: 'cave-trench-wall',
  mouths: [{ name: 'west', x: 450, z: -30 }],
  /** interior heading: into the trench W wall (outward yaw 1.642104 + π) */
  intoYaw: 1.642104 + Math.PI,
  stations: [
    { s: 0.0,  lat: 0.0,  floorY: -79.2, halfW: 4.0, height: 5.5, hood: true },
    { s: 8.0,  lat: -1.0, floorY: -78.9, halfW: 3.4, height: 4.8, hood: true },
    { s: 14.0, lat: -2.4, floorY: -78.6, halfW: 3.2, height: 4.6, hood: true },
    { s: 20.0, lat: -4.2, floorY: -78.2, halfW: 3.4, height: 4.7, hood: true },
    // s ≥ 24: the trench W wall rises too gently to bury the chamber roof —
    // its crest stands ~0.5–1.3 m proud of the slope (measured CP09 seam
    // analysis). hood: true = rockier outer noise; the crest reads as a low
    // rock mound on the wall (recorded CP09 deviation-report item).
    { s: 26.0, lat: -6.6, floorY: -77.9, halfW: 5.0, height: 5.2, hood: true },
    { s: 32.0, lat: -8.5, floorY: -77.6, halfW: 5.5, height: 5.4, hood: true }, // end chamber
  ],
  /** closed far end (dome cap) */
  endCap: true,
  darkFullM: 14,
  kit: [
    { piece: 'gate-rock',       s: 1.2,  lat: 0.0,  dy: 5.8,  yawDeg: 0,   scale: 2.0 },
    { piece: 'template-wall',   s: 8.0,  lat: 1.5,  dy: 5.4,  yawDeg: 25,  scale: 1.8 },
    { piece: 'template-detail', s: 15.0, lat: -2.0, dy: 4.8,  yawDeg: 190, scale: 1.5 },
    { piece: 'template-detail', s: 27.0, lat: 5.6,  dy: -0.1, yawDeg: 80,  scale: 1.4 },
    { piece: 'template-detail', s: 30.0, lat: -6.0, dy: 0.0,  yawDeg: 300, scale: 1.1 },
  ],
};

/** Arch in the islet gap — approved opening 5 m; free-standing arc. */
export const ARCH = {
  id: 'arch-islet-gap',
  center: { x: -40, z: -70 },
  /** swim-through direction (approved transform yaw) */
  yaw: 1.951303,
  /** legs stand on the perpendicular of yaw at ±legOffset */
  legOffset: 4.4,
  /** inner faces at ±2.5 m → the approved 5 m opening */
  openingHalfW: 2.5,
  /** intrados (underside) crown elevation */
  crownY: -21.3,
  /** footing tops sink to local terrain − embed (legA ≈ −29.5, legB ≈ −26.3
   *  measured; authored explicit) */
  footTopYA: -29.8,
  footTopYB: -26.6,
  /** footing bottoms (embedded below terrain — no stamps needed) */
  footBottomYA: -32.4,
  footBottomYB: -29.2,
  /** arc ring cross-section: width across the arc × depth along yaw, m */
  ringW: 3.6,
  ringD: 4.5,
  /** loft stations along the arc (θ 0 → π), count */
  arcSteps: 13,
  kit: [
    // outer-leg dressing — kept outside the 5 m swim-through (shell is the
    // navigable opening; Kenney must not sit in the void)
    { piece: 'gate-rock',       arcT: 0.06, dy: -0.5, yawDeg: 15,  scale: 1.0, outward: 2.8 },
    { piece: 'gate-rock',       arcT: 0.94, dy: -0.4, yawDeg: 200, scale: 0.9, outward: 2.8 },
    { piece: 'template-detail', arcT: 0.03, dy: -0.2, yawDeg: 120, scale: 0.9, outward: 2.2 },
  ],
};

// ---------------------------------------------------------------------------
// Clearance contract (CP09 §6 — proposed values, flagged for user ruling;
// asserted by the region-caves spec against the final trimesh)
// ---------------------------------------------------------------------------

export const CLEARANCE = {
  headlandMouthW: 13.0, headlandMouthH: 8.5,
  /** narrowest primary-cave cross-section (pinch stations; includes the
   *  dressing audit margin) */
  headlandMinW: 9.0, headlandMinH: 6.6,
  trenchMouthW: 8.0, trenchMouthH: 5.5,
  trenchMinW: 6.4, trenchMinH: 4.6,
  archOpeningW: 5.0, archClearH: 6.5,
  /** max interior protrusion of wall-mounted kit dressing, m */
  dressingIntrusionMax: 1.2,
};

// ---------------------------------------------------------------------------
// Frame resolution (shared by the bake, the Blender build, and — via the
// baked caves.json — the runtime CaveField; piecewise-linear between
// stations so every consumer agrees exactly)
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Unit axis + perpendicular of a two-mouth module's straight line. */
export function axisFrame(m) {
  const [A, B] = [m.mouths[0], m.mouths[1] ?? null];
  let ux;
  let uz;
  let len;
  if (B) {
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    len = Math.hypot(dx, dz);
    ux = dx / len;
    uz = dz / len;
  } else {
    ux = Math.sin(m.intoYaw);
    uz = Math.cos(m.intoYaw);
    len = m.stations[m.stations.length - 1].s;
  }
  // axis-left perpendicular (right-handed XZ ground plane, y-up)
  return { ax: A.x, az: A.z, ux, uz, px: -uz, pz: ux, len };
}

/** Interpolated station values at arc-length s (piecewise-linear). */
export function stationAt(m, s) {
  const st = m.stations;
  const sc = clamp(s, st[0].s, st[st.length - 1].s);
  let i = 0;
  while (i < st.length - 2 && st[i + 1].s < sc) i++;
  const a = st[i];
  const b = st[i + 1];
  const t = b.s === a.s ? 0 : (sc - a.s) / (b.s - a.s);
  return {
    lat: lerp(a.lat, b.lat, t),
    floorY: lerp(a.floorY, b.floorY, t),
    halfW: lerp(a.halfW, b.halfW, t),
    height: lerp(a.height, b.height, t),
    hood: t < 0.5 ? a.hood : b.hood,
  };
}

/** World-space centerline point + local heading at arc-length s. */
export function centerAt(m, s) {
  const f = axisFrame(m);
  const v = stationAt(m, s);
  const x = f.ax + f.ux * s + f.px * v.lat;
  const z = f.az + f.uz * s + f.pz * v.lat;
  // heading from the lateral derivative (finite difference, deterministic)
  const e = 0.5;
  const v2 = stationAt(m, s + e);
  const v1 = stationAt(m, s - e);
  const dLat = (v2.lat - v1.lat) / (2 * e);
  let hx = f.ux + f.px * dLat;
  let hz = f.uz + f.pz * dLat;
  const hl = Math.hypot(hx, hz) || 1;
  hx /= hl;
  hz /= hl;
  return { x, z, hx, hz, ...v };
}

// ---------------------------------------------------------------------------
// Seam stamps (CP09 §5 / addendum §9.1) — authoring-time, deterministic,
// lower-only. Consumed by bake-region.mjs as pass 4. Each stamp lowers the
// heightfield toward a target surface tied to the module floor line:
//   • "throat" spans keep the terrain sheet out of the interior where it
//     would otherwise cross the bore near a mouth;
//   • "seat" aprons let the outer shell / hood base tuck under the terrain
//     with no floating lip and no visible gap.
// ---------------------------------------------------------------------------

export const STAMPS = [
  {
    id: 'stamp-headland-s-throat',
    module: 'cave-headland',
    /** span along the module axis, m (s < 0 = outward past the ring) */
    s0: -8, s1: 20,
    /** full-strength lateral half-width / fade-out half-width, m */
    latIn: 8.5, latOut: 14,
    /** target = floorLine(s) − margin inside the span; outward apron rises
     *  at apronSlope m per m so the bowl merges into the natural seabed */
    margin: 1.0, apronSlope: 0.35,
    /** longitudinal fade lengths at each end of the span, m */
    fade0: 6, fade1: 5,
  },
  {
    id: 'stamp-headland-n-throat',
    module: 'cave-headland',
    s0: 149, s1: 188,
    latIn: 8.5, latOut: 14,
    margin: 1.0, apronSlope: 0.35,
    fade0: 5, fade1: 6,
  },
  {
    id: 'stamp-headland-n-hoodseat',
    module: 'cave-headland',
    s0: 150, s1: 181,
    latIn: 9, latOut: 15,
    /** pure seat: lower at most seatMax below current terrain (no floor
     *  target) so the buttress base beds in */
    seatMax: 0.9,
    fade0: 6, fade1: 4,
  },
  {
    id: 'stamp-trench-throat',
    module: 'cave-trench-wall',
    s0: -6, s1: 21,
    latIn: 6.5, latOut: 11,
    margin: 0.8, apronSlope: 0.35,
    fade0: 5, fade1: 4,
  },
];

/**
 * Stamp delta at world (x, z): ≤ 0 meters (lower-only). h = current height.
 * Deterministic pure function; used by bake-region pass 4 and its audit.
 */
export function stampDelta(x, z, h) {
  let d = 0;
  for (const sp of STAMPS) {
    const m = sp.module === 'cave-headland' ? HEADLAND : TRENCH;
    const f = axisFrame(m);
    // project into the module's straight-axis frame
    const rx = x - f.ax;
    const rz = z - f.az;
    const s = rx * f.ux + rz * f.uz;
    if (s < sp.s0 - 0.01 || s > sp.s1 + 0.01) continue;
    const v = stationAt(m, s);
    const latHere = rx * f.px + rz * f.pz - v.lat; // lateral offset from bore center
    const al = Math.abs(latHere);
    if (al >= sp.latOut) continue;
    const wLat = 1 - sstep(sp.latIn, sp.latOut, al);
    const wS =
      sstep(sp.s0, sp.s0 + sp.fade0, s) * (1 - sstep(sp.s1 - sp.fade1, sp.s1, s));
    const w = wLat * wS;
    if (w <= 0) continue;
    let target;
    if (sp.seatMax !== undefined) {
      target = h - sp.seatMax; // pure seat: bounded lowering
    } else {
      // floor-line target with outward apron past the physical span
      const sClamped = clamp(s, m.stations[0].s, m.stations[m.stations.length - 1].s);
      const apron = Math.max(0, Math.max(sp.s0, m.stations[0].s) - s, s - Math.min(sp.s1, m.stations[m.stations.length - 1].s));
      target = stationAt(m, sClamped).floorY - sp.margin + apron * sp.apronSlope;
    }
    const want = Math.min(0, (target - h)) * w;
    if (want < d) d = want;
  }
  return d;
}

function sstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Conservative world-space AABBs of every stamp footprint (audit bounds). */
export function stampBounds() {
  return STAMPS.map((sp) => {
    const m = sp.module === 'cave-headland' ? HEADLAND : TRENCH;
    const f = axisFrame(m);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let s = sp.s0; s <= sp.s1; s += 1) {
      const v = stationAt(m, clamp(s, m.stations[0].s, m.stations[m.stations.length - 1].s));
      for (const lat of [v.lat - sp.latOut, v.lat + sp.latOut]) {
        const x = f.ax + f.ux * s + f.px * lat;
        const z = f.az + f.uz * s + f.pz * lat;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    return { id: sp.id, minX, maxX, minZ, maxZ };
  });
}

// ---------------------------------------------------------------------------
// The runtime containment/darkness record written into caves.json by the
// bake (single committed source for the sim's CaveField).
// ---------------------------------------------------------------------------

export function runtimeCaveRecord() {
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const modRecord = (m) => {
    const f = axisFrame(m);
    return {
      stations: m.stations.map((st) => {
        const x = f.ax + f.ux * st.s + f.px * st.lat;
        const z = f.az + f.uz * st.s + f.pz * st.lat;
        return {
          s: r6(st.s), x: r6(x), z: r6(z),
          floorY: r6(st.floorY), halfW: r6(st.halfW), height: r6(st.height),
        };
      }),
      darkFullM: m.darkFullM,
      endCap: m.endCap ?? false,
    };
  };
  return {
    'cave-headland': modRecord(HEADLAND),
    'cave-trench-wall': modRecord(TRENCH),
    'arch-islet-gap': {
      // the arch has no enclosed interior: no containment field, no darkness
      stations: [],
      darkFullM: 0,
      endCap: false,
      opening: {
        x: ARCH.center.x, z: ARCH.center.z, yaw: ARCH.yaw,
        halfW: ARCH.openingHalfW, crownY: ARCH.crownY,
      },
    },
  };
}

export function clearanceRecord() {
  return { ...CLEARANCE };
}

export function stampRecord() {
  return STAMPS.map((sp) => ({ ...sp }));
}
