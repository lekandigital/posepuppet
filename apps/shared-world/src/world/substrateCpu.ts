// substrateCpu — CP05A-correction CPU twin of the shared ZyFou-Blank
// substrate color (src/terrain/shaders.ts SUBSTRATE chunk). Mirrors the
// CLASSIFICATION (substrateAlbedo: climate → biome weights →
// computeTerrainAlbedo → palette post); the close-range detail layer is
// excluded by design (it fades with camera distance; the probe comparisons
// run against the pre-detail albedo-debug render).
//
// CP05C revision (ocean-replacement addendum §2.4): LINEAR albedo (the
// ZyFou display encode is removed — the post composite is the one encode);
// ONE palette across the waterline (the Fantasy roles everywhere; the Earth
// underwater arm, the Z_COL_DEEP navy ramp, and the waterline palette split
// are deleted); sandy WaterThreeJS dune blend on the seafloor.
//
// Parity contract: the lattice hash is fp32-exact on both sides (mod-289
// permutation polynomial; Math.fround emulates the GPU's single fp32
// multiply). All constants mirror RegionSubstrate.glsl — change them
// together. Sources: ZyFou/ProceduralTerrains pinned 8b396f9c —
// ColorPalette.js EARTH_PALETTE, PlanetStyleConfig.js DEFAULT_PLANET_STYLE,
// terrainColor.glsl.js computeTerrainAlbedo, biomeGLSL.js climate system,
// Engine.js uniform wiring (seed 1337, noiseScale 45, board 2048).

import type { WorldData } from './WorldData';

type V3 = [number, number, number];

const F = Math.fround;

/* Blank constants (mirror RegionSubstrate.glsl) */
const Z_SEED_OFFSET: [number, number] = [-646.3245668411255, -634.9020133018494];
const Z_FREQ = 0.002197265625;
const Z_HEIGHT_SCALE = 560;
const Z_SEA = 160;
const Z_ROCK_SLOPE_LO = 0.42;
const Z_ROCK_SLOPE_HI = 0.72;
const Z_SNOW_SLOPE_MIN = 0.30;
const Z_SNOW_SLOPE_MAX = 0.62;
const Z_BIOME_SCALE = 1.0;
const Z_TEMP_BIAS = 0.0;
const Z_MOIST_SCALE = 1.0;
const Z_MOIST_BIAS = 0.0;
const Z_PAL_SATURATION = 1.0;
const Z_PAL_CONTRAST = 1.0;
const Z_PAL_TINT: V3 = [1, 1, 1];

/* CP05C: ONE palette across the waterline — the Fantasy 'Cartoon Terrain'
 * roles + frost/tundra confinement everywhere (mirror the SUBSTRATE chunk).
 * The Earth palette arm and COL_DEEP are deleted with the navy ramp. */
const COL_F = {
  sand: [1.0, 0.86, 0.32] as V3,
  dune: [1.0, 0.68, 0.24] as V3,
  dryGrass: [0.78, 0.86, 0.2] as V3,
  grass: [0.18, 0.78, 0.18] as V3,
  forest: [0.02, 0.5, 0.16] as V3,
  jungle: [0.0, 0.4, 0.18] as V3,
  swamp: [0.1, 0.44, 0.26] as V3,
  tundra: [0.62, 0.86, 0.82] as V3,
  redRock: [0.9, 0.3, 0.18] as V3,
  redRock2: [1.0, 0.48, 0.22] as V3,
  rock: [0.44, 0.42, 0.48] as V3,
  rockHi: [0.64, 0.62, 0.7] as V3,
  snow: [0.98, 0.98, 0.92] as V3,
};
/** CP05C fixed laws (Fantasy frost/tundra confinement, everywhere) */
const LAWS = {
  snowLine: 0.82,
  frostMinH01: 0.86,
  frostStrength: 0.85,
  seaFrost: 0,
  tundraLo: 0.55,
  tundraHi: 0.75,
} as const;
/** CP05C sandy seafloor (WaterThreeJS Floor.js sand values) */
const DUNE_SAND: V3 = [0.66, 0.58, 0.44];
const DUNE_SAND2: V3 = [0.46, 0.41, 0.31];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: V3, b: V3, t: number): V3 => [
  mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t),
];
const mulV = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
function sstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
const fractN = (x: number) => x - Math.floor(x);

/* fp32-exact lattice hash (mirror subHash: nested permutation polynomial —
 * perm(perm(x) + y) — no 1-D linear-projection degeneracy) */
const HASH_C = F(0.024390243);
const glslMod = (x: number, m: number) => x - m * Math.floor(x / m);
const zPerm = (v: number) => glslMod(v * (v * 34 + 1), 289);
function subHash(ipx: number, ipy: number, seed: number): number {
  const n = zPerm(glslMod(zPerm(glslMod(ipx + seed, 289)) + ipy, 289));
  const t = F(n * HASH_C);
  return t - Math.floor(t);
}

/** quintic value noise (ZyFou fade) over the parity hash */
function vnoiseQ(px: number, py: number, seed: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = subHash(ix, iy, seed);
  const b = subHash(ix + 1, iy, seed);
  const c = subHash(ix, iy + 1, seed);
  const d = subHash(ix + 1, iy + 1, seed);
  return mixN(mixN(a, b, ux), mixN(c, d, ux), uy);
}

/* ROT2 = [0.80 −0.60; 0.60 0.80] — column-major GLSL mat2 multiply */
function rot2(px: number, py: number): [number, number] {
  return [0.8 * px + 0.6 * py, -0.6 * px + 0.8 * py];
}

function zFbm3(px: number, py: number): number {
  let v = vnoiseQ(px, py, 0) * 0.55;
  [px, py] = rot2(px, py);
  px *= 2.13; py *= 2.13;
  v += vnoiseQ(px, py, 0) * 0.30;
  [px, py] = rot2(px, py);
  px *= 2.13; py *= 2.13;
  v += vnoiseQ(px, py, 0) * 0.15;
  return v;
}

interface ZClimate { temp: number; moist: number; cont: number; erosion: number; region: number }
interface ZBiome { desert: number; canyon: number; wetland: number; mountains: number }

function zClimateAt(px: number, py: number): ZClimate {
  const bx = px * Z_BIOME_SCALE;
  const by = py * Z_BIOME_SCALE;
  return {
    cont: zFbm3(bx * 0.085 + 211.3, by * 0.085 + 57.9),
    temp: clamp(zFbm3(bx * 0.15 + 71.7, by * 0.15 + 313.1) * 1.5 - 0.25 + Z_TEMP_BIAS, 0, 1),
    moist: clamp(zFbm3(bx * 0.13 * Z_MOIST_SCALE + 91.7, by * 0.13 * Z_MOIST_SCALE + 53.9) * 1.5 - 0.25 + Z_MOIST_BIAS, 0, 1),
    erosion: zFbm3(bx * 0.19 + 157.1, by * 0.19 + 423.7),
    region: zFbm3(px * 0.7 + 631.4, py * 0.7 + 199.2),
  };
}

function zBiomeWeightsAt(c: ZClimate): ZBiome {
  const j = (c.region - 0.5) * 0.16;
  const hot = sstep(0.52, 0.74, c.temp + j);
  const dry = sstep(0.55, 0.30, c.moist - j);
  const wet = sstep(0.55, 0.78, c.moist + j);
  const lowC = sstep(0.55, 0.32, c.cont);
  const eroded = sstep(0.40, 0.70, c.erosion + j * 0.5);
  return {
    desert: hot * dry * (1 - eroded * 0.55),
    canyon: dry * eroded * sstep(0.30, 0.55, c.cont),
    wetland: wet * lowC * (1 - hot * 0.4),
    mountains: sstep(0.38, 0.62, c.cont) * (1 - eroded * 0.7),
  };
}

function zVegetationDensity(c: ZClimate, h01: number, slope: number): number {
  const tempEff = c.temp - h01 * 0.55;
  const warmEnough = sstep(0.18, 0.34, tempEff) * sstep(0.92, 0.70, tempEff);
  const wetEnough = sstep(0.34, 0.62, c.moist);
  const flatGround = sstep(0.55, 0.25, slope);
  return warmEnough * wetEnough * flatGround;
}

function zApplyPalettePost(col: V3): V3 {
  const luma = col[0] * 0.299 + col[1] * 0.587 + col[2] * 0.114;
  let out: V3 = [
    mixN(luma, col[0], Z_PAL_SATURATION),
    mixN(luma, col[1], Z_PAL_SATURATION),
    mixN(luma, col[2], Z_PAL_SATURATION),
  ];
  out = [
    (out[0] - 0.5) * Z_PAL_CONTRAST + 0.5,
    (out[1] - 0.5) * Z_PAL_CONTRAST + 0.5,
    (out[2] - 0.5) * Z_PAL_CONTRAST + 0.5,
  ];
  out = [out[0] * Z_PAL_TINT[0], out[1] * Z_PAL_TINT[1], out[2] * Z_PAL_TINT[2]];
  return [Math.max(out[0], 0), Math.max(out[1], 0), Math.max(out[2], 0)];
}

/** analytic climate at world (x,z) — the CPU baker for the GPU climate LUT
 *  (adaptation A8: the five ZyFou climate fields vary over 143 m – 10 km
 *  wavelengths, so per-fragment evaluation of 15 noise octaves is pure
 *  waste; the same math bakes to a 256² LUT at load, deterministic). */
export function climateAtCpu(x: number, z: number): ZClimate {
  const px = x * Z_FREQ + Z_SEED_OFFSET[0];
  const py = z * Z_FREQ + Z_SEED_OFFSET[1];
  return zClimateAt(px, py);
}

/** bake the climate LUT: n² texels over the region, 8 floats per texel in
 *  two RGBA planes: A = (temp, moist, cont, erosion), B = (region,0,0,0) */
export function bakeClimateLut(n: number, regionSize: number): { a: Float32Array; b: Float32Array } {
  const a = new Float32Array(n * n * 4);
  const b = new Float32Array(n * n * 4);
  const step = regionSize / (n - 1);
  const half = regionSize / 2;
  for (let j = 0; j < n; j++) {
    const z = -half + j * step;
    for (let i = 0; i < n; i++) {
      const c = climateAtCpu(-half + i * step, z);
      const o = (j * n + i) * 4;
      a[o] = c.temp;
      a[o + 1] = c.moist;
      a[o + 2] = c.cont;
      a[o + 3] = c.erosion;
      b[o] = c.region;
      b[o + 3] = 1;
    }
  }
  return { a, b };
}

export function seabedNormalCpu(data: WorldData, x: number, z: number): V3 {
  const n = data.header.artifacts['height.r16']!.resolution!;
  const e = data.header.sizeMeters[0] / (n - 1);
  const hx1 = data.terrainHeight(x + e, z);
  const hx0 = data.terrainHeight(x - e, z);
  const hz1 = data.terrainHeight(x, z + e);
  const hz0 = data.terrainHeight(x, z - e);
  const vx = hx0 - hx1;
  const vy = 2 * e;
  const vz = hz0 - hz1;
  const len = Math.hypot(vx, vy, vz);
  return [vx / len, vy / len, vz / len];
}

export interface SubstrateSample {
  /** LINEAR classification albedo (matches the uAlbedoDebug render, CP05C) */
  albedo: V3;
  /** dominant coloration family (diagnostic; from the ZyFou blend weights) */
  family: string;
  h: number;
  slope: number;
  depth: number;
  /** ZyFou intermediate diagnostics */
  snow: number;
  rockBlend: number;
  weights: ZBiome;
  climate: ZClimate;
}

/** Twin of substrateAlbedo(): the ZyFou Blank classification. */
export function substrateSampleCpu(data: WorldData, x: number, z: number): SubstrateSample {
  const h = data.terrainHeight(x, z);
  const normal = seabedNormalCpu(data, x, z);
  const slope = 1 - clamp(normal[1], 0, 1);
  const hZ = h * 2 + Z_SEA;
  const hRel = hZ - Z_SEA;
  const h01 = hZ / Z_HEIGHT_SCALE;

  // CP05C: one palette + one set of laws everywhere
  const P = COL_F;
  const L = LAWS;

  const px = x * Z_FREQ + Z_SEED_OFFSET[0];
  const py = z * Z_FREQ + Z_SEED_OFFSET[1];
  const cl = zClimateAt(px, py);
  const bw = zBiomeWeightsAt(cl);
  const jitter = (cl.region - 0.5) * 0.8 +
    (vnoiseQ(x * 0.045 + Z_SEED_OFFSET[0], z * 0.045 + Z_SEED_OFFSET[1], 0) - 0.5) * 0.6;
  const detail = vnoiseQ(x * 0.35 + Z_SEED_OFFSET[1], z * 0.35 + Z_SEED_OFFSET[0], 0);
  const microN = vnoiseQ(x * 0.9, z * 0.9, 0);
  // CP05C sandy-seafloor mottle (mirror zColorInputs duneM)
  const duneM = vnoiseQ(x * 0.06 + Z_SEED_OFFSET[0], z * 0.06 + Z_SEED_OFFSET[1], 0);

  // ---- computeTerrainAlbedo (terrainColor.glsl.js), verbatim structure ----
  const tempEff = clamp(cl.temp - h01 * 0.55, 0, 1);
  const veg = zVegetationDensity(cl, h01, slope);
  const jt = jitter * 0.06;

  const hotBand = mixV(P.dune,
    mixV(P.dryGrass, P.jungle, sstep(0.45, 0.75, cl.moist)),
    sstep(0.20, 0.50, cl.moist));
  const midBand = mixV(P.dryGrass,
    mixV(P.grass, P.forest, veg * (0.5 + 0.5 * sstep(0.35, 0.65, detail))),
    sstep(0.22, 0.52, cl.moist));
  let coldBand = mixV(P.tundra, mixV(P.tundra, mulV(P.forest, 0.85), veg),
    sstep(0.30, 0.60, cl.moist));
  // tundra gate: submerged (−1,−0.5) → weight 1 = the original code path
  coldBand = mixV(midBand, coldBand, sstep(L.tundraLo, L.tundraHi, h01));

  let lowland = mixV(coldBand, midBand, sstep(0.20, 0.38, tempEff + jt));
  lowland = mixV(lowland, hotBand, sstep(0.55, 0.72, tempEff + jt));
  lowland = mixV(lowland, P.swamp, bw.wetland * 0.8);

  const sandBand = (mixN(3, 9, sstep(0.30, 0.70, tempEff)) + jitter * 4) * (1 - bw.wetland * 0.85);
  let albedo = mixV(P.sand, lowland, sstep(sandBand * 0.4, Math.max(sandBand, 0.3), hRel));

  const band = fractN(h01 * 14 + detail * 0.15);
  const canyonCol = mixV(P.redRock, P.redRock2, sstep(0.25, 0.75, band));
  albedo = mixV(albedo, canyonCol, bw.canyon * sstep(1, 6, hRel));

  const highBlend = sstep(0.30, 0.62, h01 + jitter * 0.08);
  albedo = mixV(albedo, P.rockHi, highBlend * 0.65 * (1 - bw.desert * 0.7));

  const rockBlend = sstep(Z_ROCK_SLOPE_LO, Z_ROCK_SLOPE_HI, slope + jitter * 0.06);
  const slopeRock = mixV(mixV(P.rock, P.rockHi, detail), P.redRock, bw.canyon * 0.8);
  albedo = mixV(albedo, slopeRock, rockBlend);

  // snow law, waterline-split: submerged parameterization reproduces the
  // approved 6274982 code exactly (floor 0 → max identity; seaFrost 1
  // restores the original term; strength 1); exposed = Fantasy confinement
  const snowLine01 = Math.max(L.snowLine * (0.40 + 1.20 * cl.temp), L.frostMinH01);
  const flatness = sstep(Z_SNOW_SLOPE_MAX, Z_SNOW_SLOPE_MIN, slope);
  let snow = sstep(snowLine01 - 0.03, snowLine01 + 0.05, h01 + jitter * 0.04) * flatness;
  snow = Math.max(snow, sstep(0.10, 0.02, tempEff) * sstep(0.50, 0.25, slope) * L.seaFrost);
  snow *= 1 - bw.desert;
  snow *= L.frostStrength;
  albedo = mixV(albedo, P.snow, snow);

  let sandW = 0;
  if (hRel < 0) {
    // CP05C sandy seafloor (ocean-replacement addendum §2.4): WaterThreeJS
    // dune sand blends over the classification with depth; steep rock and
    // wetland silt retain more class identity; NO depth darkening.
    const dune = mulV(
      mixV(DUNE_SAND2, DUNE_SAND, sstep(0.30, 0.75, duneM)),
      0.90 + 0.20 * microN,
    );
    sandW = sstep(0, 8, -h) * 0.85 * (1 - rockBlend * 0.6) * (1 - bw.wetland * 0.45);
    albedo = mixV(albedo, dune, sandW);
  }

  let micro = mixN(0.20, 0.06, Math.max(bw.desert * (1 - rockBlend), bw.wetland * 0.8));
  micro = mixN(micro, 0.30, Math.max(rockBlend * 0.6, bw.canyon * 0.4));
  const microMul = (1 - micro * 0.5) + micro * microN;
  albedo = mulV(albedo, microMul);

  // CP05C: LINEAR albedo — no display encode (the post composite encodes)
  const encoded = zApplyPalettePost(albedo);

  // dominant-family diagnostic (from the same blend weights; substrate/
  // ground-coloration labels only)
  let family: string;
  if (hRel < 0) {
    family = sandW > 0.5 ? 'sandy-floor' : 'shallow-floor';
    if (rockBlend > 0.5) family = 'rocky-floor';
    else if (bw.wetland > 0.5) family = 'silt-floor';
  } else if (snow > 0.5) {
    family = 'snow';
  } else if (rockBlend > 0.5) {
    family = bw.canyon > 0.5 ? 'canyon-rock' : 'slope-rock';
  } else if (hRel < Math.max(sandBand, 0.3) * 0.7) {
    family = 'shore-sand';
  } else if (highBlend * 0.65 > 0.35) {
    family = 'high-rock';
  } else if (bw.wetland > 0.5) {
    family = 'swamp-soil';
  } else {
    const tE = tempEff + jt;
    family = tE > 0.6 ? 'dry-lowland' : tE > 0.25 ? 'grassland' : 'tundra';
  }

  return {
    albedo: encoded,
    family,
    h,
    slope,
    depth: Math.max(0, -h),
    snow,
    rockBlend,
    weights: bw,
    climate: cl,
  };
}
