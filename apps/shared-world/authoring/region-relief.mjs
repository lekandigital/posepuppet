// region-relief.mjs — Checkpoint 05A deterministic relief layers.
//
// ZyFou/ProceduralTerrains-adapted geological relief added ON TOP of the
// approved CP05 Twin Bay heightfield (base fieldC + the cp04A bounded
// variation), per the post-CP05 addendum §4.3–§4.5 composition hierarchy:
//
//   approved Twin Bay macro field            (bake-region.mjs — untouched)
//   + broad domain-warped variation          (L1)
//   + ridged multifractal formations         (L2, spectral weighting)
//   + authored ridge/peak/trench/cliff emphasis (L3)
//   + restrained medium/high-frequency breakup  (L4)
//   × protected-flatness and protected-coast masks
//   = revised deterministic heightfield
//
// Techniques adapted from the pinned read-only reference snapshot
// docs/bodyarcade-stage3/references/zyfou-procedural-terrains/ (MIT, ZyFou,
// commit 8b396f9c784676d46f6a147d310d9f547bf41403) — specifically the
// ridged-multifractal spectral weighting (`carry` follows ridges), the
// fbm4-pair domain warp, the chain mask that places formations, and the
// ridge-needle exponent (terrainGLSL.js legacyShape2D / ridgedFBM). All
// code here is app-owned BodyArcade authoring code; the snapshot is never
// imported.
//
// COASTLINE LAW (addendum §4.5): every relief contribution is multiplied by
// a vertical shore taper that is EXACTLY zero where |h05| ≤ SHORE_V0, and
// the final delta is clamped so it can never remove more than
// SIGN_KEEP·|h05| of the approved height — the land/water sign of every
// texel is therefore immovable and shore.png stays byte-identical (proved
// per-texel in bake-region.mjs composeHeights and by --check).
//
// Determinism: fixed integer seeds derived from the approved layout seed;
// no Math.random, no Date; pure functions of (x, z, h05, shoreDist).

// ---------------------------------------------------------------------------
// Fixed seeds (committed; deterministic offsets from the approved SEED)
// ---------------------------------------------------------------------------

/** The approved layout seed (Sketch C). Relief layers derive fixed offsets. */
export const RELIEF_SEED_BASE = 60418003;

const S_WARP_X = RELIEF_SEED_BASE + 51001;
const S_WARP_Z = RELIEF_SEED_BASE + 51002;
const S_BROAD = RELIEF_SEED_BASE + 51010;
const S_RIDGE = RELIEF_SEED_BASE + 51020;
const S_CHAIN = RELIEF_SEED_BASE + 51021;
const S_CARVE = RELIEF_SEED_BASE + 51030;
const S_CARVE_CHAIN = RELIEF_SEED_BASE + 51031;
const S_EMPH = RELIEF_SEED_BASE + 51040;
const S_MED = RELIEF_SEED_BASE + 51050;
const S_FINE = RELIEF_SEED_BASE + 51060;
const S_WALL = RELIEF_SEED_BASE + 51070;

// ---------------------------------------------------------------------------
// Relief parameters — every value [DERIVED, flagged for the §9 manual review]
// ---------------------------------------------------------------------------

export const RELIEF = {
  /** vertical shore taper: relief is exactly 0 at |h05| ≤ V0, full at ≥ V1 (m) */
  SHORE_V0: 0.5,
  SHORE_V1: 6.0,
  /** max fraction of |h05| the delta may remove (sign-preservation clamp) */
  SIGN_KEEP: 0.85,
  /** top taper — raising fades 150→195 m so the +200 cap is never crowded;
   *  carving (negative delta) stays live to 185→196 m so high flanks cut
   *  away and the summit reads NARROWER (peak value/position untouched) */
  TOP_T0: 150,
  TOP_T1: 195,
  TOP_NEG_T0: 185,
  TOP_NEG_T1: 196,
  /** bottom taper — raising fades −60→−75 m so the −80 trench floor holds
   *  ≤ −70; deepening stays live everywhere (the −80 clamp is the floor) */
  BOT_T0: 60,
  BOT_T1: 75,

  /** domain warp: amplitude (m) and field wavelength (m) [ZyFou warp layer] */
  WARP_AMP_M: 40,
  WARP_WAVELEN_M: 350,

  /** L1 broad domain-warped variation: amplitude (m), wavelength (m) */
  BROAD_AMP_M: 7,
  BROAD_WAVELEN_M: 240,

  /** L2 ridged multifractal: base amplitude (m), wavelength (m), needle
   *  exponent [ZyFou ridgeNeedle 1.35], chain-mask wavelength + band */
  RIDGE_AMP_M: 14,
  RIDGE_WAVELEN_M: 95,
  RIDGE_NEEDLE: 1.35,
  CHAIN_WAVELEN_M: 380,
  CHAIN_LO: 0.35,
  CHAIN_HI: 0.62,
  /** decorrelated negative (carving) field weight and wavelength */
  CARVE_FRAC: 0.7,
  CARVE_WAVELEN_M: 130,

  /** L3 authored emphasis amplitudes (m) by zone */
  ZONE_RIDGE_AMP_M: 22, // authored ridge/summit/island interiors
  ZONE_WALL_AMP_M: 16,  // trench/canyon walls
  ZONE_SHELF_AMP_M: 7,  // south-bay reef shelf ridges
  ZONE_CLIFF_AMP_M: 14, // coastal cliffs away from approved beaches
  EMPH_AMP_M: 12,       // fine ridged emphasis following authored forms
  EMPH_WAVELEN_M: 60,
  WALL_WAVELEN_M: 55,   // trench-wall irregularity field

  /** authored zone geometry (meters) */
  RIDGE_NEAR_M: 60,     // full ridge emphasis within this distance of a ridge line
  RIDGE_FAR_M: 200,     // fading to zero here
  TRENCH_WALL_IN_M: 40, // wall band: [IN..IN2] rising, [OUT..OUT2] falling
  TRENCH_WALL_IN2_M: 80,
  TRENCH_WALL_OUT_M: 160,
  TRENCH_WALL_OUT2_M: 230,
  CLIFF_COAST_M: 15,    // coastal-cliff emphasis fades 15→80 m from shore
  CLIFF_COAST_FAR_M: 80,

  /** L4 restrained breakup: amplitudes (m), wavelengths (m) */
  MED_AMP_M: 3.2,
  MED_WAVELEN_M: 28,
  FINE_AMP_M: 0.8,
  FINE_WAVELEN_M: 9,

  /** protected-coast horizontal taper (beach band): relief scales up
   *  8→45 m from the shoreline, except in authored cliff-coast zones */
  COAST_NEAR_M: 8,
  COAST_FAR_M: 45,
  CLIFF_COAST_NEAR_M: 4,
  CLIFF_COAST_FULL_M: 12,

  /** protected-flatness residual relief fractions (restrained ≠ featureless) */
  LAGOON_RESIDUAL: 0.12,
  LOOP_RESIDUAL: 0.30,
  BREACH_RESIDUAL: 0.25,
  CAVE_RESIDUAL: 0.15,
  ARCH_RESIDUAL: 0.20,
  SITE_RESIDUAL: 0.20,
  PLAIN_RESIDUAL: 0.50, // family-E desaturated plain keeps its flat character

  /** corridor swim-depth guard: in water on the approved loop, shallowing
   *  is capped so new depth ≥ (1 − LOOP_SHALLOW_FRAC)·depth − nothing */
  LOOP_SHALLOW_FRAC: 0.4,
};

// ---------------------------------------------------------------------------
// Approved geometry the masks are built from (REGION_SKETCHES § APPROVED
// LAYOUT / world.json ridgeLines — coordinates are the approved sites; the
// masks must not move them)
// ---------------------------------------------------------------------------

/** the authored ridge lines (world.json ridgeLines, cp04A) */
const RIDGE_LINES = [
  [[-650, -520], [-780, -80], [-620, 420]], // crescent-spine
  [[-760, -100]],                            // crescent-summit
  [[-600, -40], [-280, -60]],                // headland-spine
  [[480, -560]],                             // ne-island
  [[-380, 640]],                             // s-island
];

/** trench spine (fieldC) */
const TRENCH = [560, -250, 520, 180];

/** south-bay kelp-reef shelf stamp center/radii (fieldC) */
const SHELF = { x: -180, z: 300, r0: 230, r1: 330 };

/** family-E desaturated plain stamp (fieldC) */
const PLAIN = { x: 140, z: 660, r0: 100, r1: 240 };

/** north-bay lagoon (approved spawn area lives inside it) */
const LAGOON = { x: -180, z: -380, r0: 230, r1: 320 };

/** approved swim loop (placement.json route; closed) */
const LOOP = [
  [-180, -380], [-30, -260], [10, -90], [280, -210], [430, -300], [500, -120],
  [465, 90], [420, 200], [390, 290], [200, 470], [-120, 260], [-420, 30],
  [-430, -150], [-180, -380],
];

/** breach sightline sites (B1–B3) */
const BREACH = [[-280, -300], [-100, 420], [430, -300]];

/** cave mouths + the headland passage (seam-protection band) */
const CAVE_MOUTHS = [[-420, 30], [-430, -150], [450, -30]];
const CAVE_PASSAGE = [-430, -150, -420, 30];

/** arch seam zone */
const ARCH = [-40, -70];

/** future ruin/structure/discovery footprints (placement.json sites) */
const SITES = [
  [-470, -300], // shoreline-settlement ruin
  [-120, 260],  // submerged-column-field ruin
  [440, 160],   // trench-w-rim wreck
  [390, 290],   // monolith-ring discovery (ring r 12 → protected r covers it)
  [-300, 420],  // spire 1
  [100, 330],   // spire 2
  [250, 570],   // plain silhouette
];

// ---------------------------------------------------------------------------
// Math helpers (self-contained; identical formulations to bake-region.mjs)
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function sstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
const hyp = Math.hypot;

function dSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  return hyp(px - (ax + t * dx), pz - (az + t * dz));
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/** per-octave domain rotation [ZyFou ROT2 = [0.8,−0.6;0.6,0.8]] */
const R_C = 0.8;
const R_S = 0.6;

/** normalized FBM with per-octave rotation (gain 0.5, lacunarity 2.05 —
 *  the ZyFou Highlands defaults) */
function fbmR(x, z, seed, octaves) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(px, pz, seed + i * 131);
    norm += amp;
    amp *= 0.5;
    const nx = R_C * px - R_S * pz;
    const nz = R_S * px + R_C * pz;
    px = nx * 2.05;
    pz = nz * 2.05;
  }
  return sum / norm;
}

/** ridged multifractal with spectral weighting — detail follows ridges
 *  [ZyFou ridgedFBM: v = (1−|2n−1|)², carry = clamp(v·1.4, 0, 1)] */
function ridgedR(x, z, seed, octaves) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let carry = 1;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    const n = vnoise(px, pz, seed + i * 131);
    let v = 1 - Math.abs(n * 2 - 1);
    v *= v;
    sum += amp * v * carry;
    carry = clamp(v * 1.4, 0, 1);
    norm += amp;
    amp *= 0.5;
    const nx = R_C * px - R_S * pz;
    const nz = R_S * px + R_C * pz;
    px = nx * 2.05;
    pz = nz * 2.05;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Zone weights (authored geometry → smooth 0..1 fields)
// ---------------------------------------------------------------------------

function ridgeProximity(x, z) {
  let d = Infinity;
  for (const line of RIDGE_LINES) {
    if (line.length === 1) {
      d = Math.min(d, hyp(x - line[0][0], z - line[0][1]));
    } else {
      for (let s = 0; s < line.length - 1; s++) {
        d = Math.min(d, dSeg(x, z, line[s][0], line[s][1], line[s + 1][0], line[s + 1][1]));
      }
    }
  }
  return 1 - sstep(RELIEF.RIDGE_NEAR_M, RELIEF.RIDGE_FAR_M, d);
}

function trenchWallBand(x, z) {
  const dt = dSeg(x, z, TRENCH[0], TRENCH[1], TRENCH[2], TRENCH[3]);
  return sstep(RELIEF.TRENCH_WALL_IN_M, RELIEF.TRENCH_WALL_IN2_M, dt) *
    (1 - sstep(RELIEF.TRENCH_WALL_OUT_M, RELIEF.TRENCH_WALL_OUT2_M, dt));
}

function shelfWeight(x, z) {
  return 1 - sstep(SHELF.r0, SHELF.r1, hyp(x - SHELF.x, z - SHELF.z));
}

function plainWeight(x, z) {
  return 1 - sstep(PLAIN.r0, PLAIN.r1, hyp(x - PLAIN.x, z - PLAIN.z));
}

/** minimum distance to the approved loop polyline */
function loopDistance(x, z) {
  let d = Infinity;
  for (let s = 0; s < LOOP.length - 1; s++) {
    d = Math.min(d, dSeg(x, z, LOOP[s][0], LOOP[s][1], LOOP[s + 1][0], LOOP[s + 1][1]));
  }
  return d;
}

/**
 * Protected-flatness factor ∈ (0, 1]: the product of per-zone residuals.
 * 1 = full relief; each protected zone scales relief down toward its
 * residual fraction (restrained, not featureless — addendum §4.4).
 */
export function protectionFactor(x, z) {
  let f = 1;
  // lagoon + spawn
  const lag = 1 - sstep(LAGOON.r0, LAGOON.r1, hyp(x - LAGOON.x, z - LAGOON.z));
  f *= 1 - lag * (1 - RELIEF.LAGOON_RESIDUAL);
  // navigation corridors (the approved loop)
  const loop = 1 - sstep(35, 75, loopDistance(x, z));
  f *= 1 - loop * (1 - RELIEF.LOOP_RESIDUAL);
  // breach takeoff/re-entry zones
  let breach = 0;
  for (const [bx, bz] of BREACH) breach = Math.max(breach, 1 - sstep(40, 90, hyp(x - bx, z - bz)));
  f *= 1 - breach * (1 - RELIEF.BREACH_RESIDUAL);
  // cave-mouth + passage seam zones
  let cave = 0;
  for (const [cx, cz] of CAVE_MOUTHS) cave = Math.max(cave, 1 - sstep(30, 70, hyp(x - cx, z - cz)));
  cave = Math.max(cave, 1 - sstep(30, 70, dSeg(x, z, CAVE_PASSAGE[0], CAVE_PASSAGE[1], CAVE_PASSAGE[2], CAVE_PASSAGE[3])));
  f *= 1 - cave * (1 - RELIEF.CAVE_RESIDUAL);
  // arch seam zone
  const arch = 1 - sstep(25, 55, hyp(x - ARCH[0], z - ARCH[1]));
  f *= 1 - arch * (1 - RELIEF.ARCH_RESIDUAL);
  // future ruin/structure/discovery footprints
  let site = 0;
  for (const [sx, sz] of SITES) site = Math.max(site, 1 - sstep(25, 55, hyp(x - sx, z - sz)));
  f *= 1 - site * (1 - RELIEF.SITE_RESIDUAL);
  // family-E plain keeps its sparse flat composition (moderate residual)
  f *= 1 - plainWeight(x, z) * (1 - RELIEF.PLAIN_RESIDUAL);
  return f;
}

// ---------------------------------------------------------------------------
// The relief delta
// ---------------------------------------------------------------------------

/**
 * reliefAt(x, z, h05, shoreDistM) → delta meters.
 *
 * h05        — the approved CP05 height at (x, z), meters.
 * shoreDistM — signed shore distance of the CP05 mask, meters, + = water.
 *
 * The returned delta is EXACTLY 0 where |h05| ≤ SHORE_V0 and never removes
 * more than SIGN_KEEP·|h05|, so the coastline sign is immovable. On the
 * approved loop in water, shallowing is additionally capped so the route
 * stays swimmable.
 */
export function reliefAt(x, z, h05, shoreDistM) {
  const R = RELIEF;

  // vertical shore taper (coastline-preserving formulation, addendum §4.5)
  const ah = Math.abs(h05);
  const sv = sstep(R.SHORE_V0, R.SHORE_V1, ah);
  if (sv <= 0) return 0;

  // extreme tapers (sign-split): raising fades near the +200 cap and the
  // trench floor; carving stays live longer near the summit so high flanks
  // cut away (narrower peaks) and stays fully live at depth (the −80 clamp
  // is the floor). Above TOP_NEG_T1 both signs are zero — the authored
  // summit cap is untouched.
  const topPos = 1 - sstep(R.TOP_T0, R.TOP_T1, h05);
  const topNeg = 1 - sstep(R.TOP_NEG_T0, R.TOP_NEG_T1, h05);
  const botPos = 1 - sstep(R.BOT_T0, R.BOT_T1, -h05);
  if (topNeg <= 0) return 0;

  // authored zone weights
  const ridgeW = ridgeProximity(x, z);
  const wallW = trenchWallBand(x, z);
  const shelfW = shelfWeight(x, z);
  const asd = Math.abs(shoreDistM);

  // protected-coast taper: beach band restrained; authored cliff coasts
  // (near an authored ridge line) keep relief close to the waterline
  const beachTaper = sstep(R.COAST_NEAR_M, R.COAST_FAR_M, asd);
  const cliffCoastW = ridgeW * (1 - sstep(R.CLIFF_COAST_M, R.CLIFF_COAST_FAR_M, asd));
  const cliffTaper = sstep(R.CLIFF_COAST_NEAR_M, R.CLIFF_COAST_FULL_M, asd) * cliffCoastW;
  const coast = Math.max(beachTaper, cliffTaper);
  if (coast <= 0) return 0;

  // domain warp [ZyFou legacyShape2D layer 1]
  const wf = 1 / R.WARP_WAVELEN_M;
  const wx = (fbmR(x * wf, z * wf, S_WARP_X, 4) - 0.5) * R.WARP_AMP_M;
  const wz = (fbmR(x * wf, z * wf, S_WARP_Z, 4) - 0.5) * R.WARP_AMP_M;
  const qx = x + wx;
  const qz = z + wz;

  // L1 — broad domain-warped variation
  const bf = 1 / R.BROAD_WAVELEN_M;
  const broad = (fbmR(qx * bf, qz * bf, S_BROAD, 5) - 0.5) * 2;

  // L2 — ridged multifractal formations, chain-masked [ZyFou layer 4]
  const rf = 1 / R.RIDGE_WAVELEN_M;
  const ridge = Math.pow(ridgedR(qx * rf, qz * rf, S_RIDGE, 6), R.RIDGE_NEEDLE);
  const cf = 1 / R.CHAIN_WAVELEN_M;
  const chain = sstep(R.CHAIN_LO, R.CHAIN_HI, fbmR(qx * cf, qz * cf, S_CHAIN, 4));
  const kf = 1 / R.CARVE_WAVELEN_M;
  const carve = Math.pow(ridgedR(qx * kf + 37.7, qz * kf - 11.3, S_CARVE, 5), 1.5);
  const chainC = sstep(R.CHAIN_LO, R.CHAIN_HI, fbmR(qx * cf + 9.1, qz * cf + 4.7, S_CARVE_CHAIN, 4));
  const ridgeSigned = ridge * chain - R.CARVE_FRAC * carve * chainC;

  // L3 — authored emphasis: detail follows the authored forms
  const ef = 1 / R.EMPH_WAVELEN_M;
  const emph = Math.pow(ridgedR(qx * ef, qz * ef, S_EMPH, 5), 1.2);
  const lf = 1 / R.WALL_WAVELEN_M;
  const wallNoise = (fbmR(qx * lf, qz * lf, S_WALL, 4) - 0.5) * 2;

  // L4 — restrained medium/high-frequency breakup (unwarped domain);
  // medium breakup carries a ridge-following spectral flavor
  const mf = 1 / R.MED_WAVELEN_M;
  const med = (fbmR(x * mf, z * mf, S_MED, 4) - 0.5) * 2;
  const ff = 1 / R.FINE_WAVELEN_M;
  const fine = (vnoise(x * ff, z * ff, S_FINE) - 0.5) * 2;

  // zone-scaled formation amplitude
  const zoneAmp =
    R.RIDGE_AMP_M +
    R.ZONE_RIDGE_AMP_M * ridgeW +
    R.ZONE_WALL_AMP_M * wallW +
    R.ZONE_SHELF_AMP_M * shelfW +
    R.ZONE_CLIFF_AMP_M * cliffCoastW;

  let delta =
    broad * R.BROAD_AMP_M +
    ridgeSigned * zoneAmp +
    emph * R.EMPH_AMP_M * Math.max(ridgeW, wallW) +
    wallNoise * R.ZONE_WALL_AMP_M * 0.5 * wallW +
    med * R.MED_AMP_M * (0.5 + 0.5 * ridge) +
    fine * R.FINE_AMP_M;

  delta *= protectionFactor(x, z) * sv * coast;
  delta *= delta > 0 ? topPos * botPos : topNeg;

  // sign-preservation clamp: never remove more than SIGN_KEEP·|h05|
  if (h05 > 0) {
    if (delta < -R.SIGN_KEEP * h05) delta = -R.SIGN_KEEP * h05;
  } else {
    if (delta > R.SIGN_KEEP * -h05) delta = R.SIGN_KEEP * -h05;
  }

  // corridor swim-depth guard: on the approved loop in water, shallowing is
  // capped to LOOP_SHALLOW_FRAC of the local depth beyond a 2 m floor
  if (h05 < -2 && delta > 0) {
    const loop = 1 - sstep(35, 75, loopDistance(x, z));
    if (loop > 0.3) {
      const cap = R.LOOP_SHALLOW_FRAC * (-h05 - 2);
      if (delta > cap) delta = cap;
    }
  }

  return delta;
}

/** authored-ridge-zone weight (exported for the bake's --check metrics) */
export function ridgeZoneWeight(x, z) {
  return ridgeProximity(x, z);
}

/** approved-loop distance (exported for the bake's --check navigability metric) */
export function loopDistanceM(x, z) {
  return loopDistance(x, z);
}

/** the approved loop waypoints (closed) — exported for checks */
export function loopWaypoints() {
  return LOOP.map((p) => [...p]);
}

/** metadata block recorded into world.json (self-documenting artifact) */
export function reliefMetadata() {
  return {
    checkpoint: '05A',
    technique:
      'ZyFou/ProceduralTerrains-adapted (MIT, pinned 8b396f9c) domain-warp + ' +
      'ridged-multifractal (spectral weighting) + authored emphasis + restrained ' +
      'breakup over the approved Twin Bay macro field; protected-flatness and ' +
      'protected-coast masks; coastline-preserving vertical shore taper',
    seeds: {
      base: RELIEF_SEED_BASE,
      warpX: S_WARP_X, warpZ: S_WARP_Z, broad: S_BROAD, ridge: S_RIDGE,
      chain: S_CHAIN, carve: S_CARVE, carveChain: S_CARVE_CHAIN,
      emphasis: S_EMPH, medium: S_MED, fine: S_FINE, wall: S_WALL,
    },
    params: RELIEF,
  };
}
