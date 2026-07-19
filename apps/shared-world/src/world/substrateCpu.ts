// substrateCpu — Checkpoint 05A CPU twin of the shared substrate
// classification (RegionSubstrate.glsl), per addendum §4.7: the same
// classification consumed by "debug and baked color outputs used to
// validate classification". Consumers: the region-preview vertex colors
// (the engineering view renders the real classification) and the
// region-substrate spec's probe comparisons against the GPU albedo-debug
// render.
//
// Parity contract with RegionSubstrate.glsl:
//  - the lattice hash is fp32-exact on both sides (permutation polynomial,
//    intermediates < 2^23; Math.fround emulates the GPU's fp32 multiply);
//  - heights/SDF/biome come from the same decoded artifacts (JS f64
//    bilinear vs GPU fp32 texture filtering — small tolerance);
//  - the close-range detail layer is EXCLUDED here by design: it fades to
//    zero beyond 55 m and the probe comparisons run at classification
//    level (uAlbedoDebug renders substrateAlbedo, not substrateColor).
//
// Every constant below mirrors RegionSubstrate.glsl; change them together.

import type { WorldData } from './WorldData';

const F = Math.fround;

/* palette — must match RegionSubstrate.glsl (source labels there) */
const SUB_DRY_SAND: V3 = [0.823529, 0.780392, 0.662745];
const SUB_WET_SAND: V3 = [0.717647, 0.658824, 0.541176];
const SUB_LOW_SOIL: V3 = [0.639216, 0.564706, 0.419608];
const SUB_DRY_EARTH: V3 = [0.690196, 0.541176, 0.360784];
const SUB_VEG_SOIL: V3 = [0.513725, 0.505882, 0.352941];
const SUB_ROCK: V3 = [0.662745, 0.560784, 0.423529];
const SUB_CLIFF_ROCK: V3 = [0.552941, 0.462745, 0.341176];
const SUB_HIGH_ROCK: V3 = [0.611765, 0.580392, 0.541176];
const SUB_SHAL_SAND: V3 = [0.847059, 0.823529, 0.635294];
const SUB_SHORE_STONE: V3 = [0.486275, 0.517647, 0.407843];
const SUB_REEF_LIME: V3 = [0.709804, 0.631373, 0.498039];
const SUB_KELP_STONE: V3 = [0.607843, 0.541176, 0.372549];
const SUB_MID_STONE: V3 = [0.560784, 0.494118, 0.388235];
const SUB_UW_CLIFF: V3 = [0.435294, 0.411765, 0.360784];
const SUB_SILT: V3 = [0.662745, 0.698039, 0.713725];
const SUB_TRENCH_ROCK: V3 = [0.243137, 0.290196, 0.337255];
const SUB_TRENCH_SED: V3 = [0.556863, 0.576471, 0.498039];
const SUB_CAVE_ROCK: V3 = [0.333333, 0.286275, 0.113725];

const CAVES: [number, number][] = [[-420, 30], [-430, -150], [450, -30]];

type V3 = [number, number, number];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: V3, b: V3, t: number): V3 => [
  mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t),
];
function sstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/* fp32-exact lattice hash (mirrors subHash) */
const HASH_C = F(0.024390243);
function glslMod(x: number, m: number): number {
  return x - m * Math.floor(x / m);
}
function subHash(ipx: number, ipy: number, seed: number): number {
  let n = glslMod(ipx + ipy * 57 + seed, 289);
  n = glslMod(n * (n * 34 + 1), 289);
  const t = F(n * HASH_C);
  return t - Math.floor(t);
}

function subNoise(px: number, py: number, seed: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = subHash(ix, iy, seed);
  const b = subHash(ix + 1, iy, seed);
  const c = subHash(ix, iy + 1, seed);
  const d = subHash(ix + 1, iy + 1, seed);
  return mixN(mixN(a, b, ux), mixN(c, d, ux), uy);
}

function subFbm(px: number, py: number, seed: number): number {
  return subNoise(px, py, seed) * 0.65 + subNoise(px * 2.13 + 31, py * 2.13 + 31, seed + 7) * 0.35;
}

/** heightfield normal — the same central-difference law as seabedNormal() */
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

function concavityCpu(data: WorldData, x: number, z: number, h: number): number {
  const n = data.header.artifacts['height.r16']!.resolution!;
  const e = 4 * (data.header.sizeMeters[0] / (n - 1));
  const hAvg = 0.25 * (
    data.terrainHeight(x + e, z) + data.terrainHeight(x - e, z) +
    data.terrainHeight(x, z + e) + data.terrainHeight(x, z - e));
  return clamp((hAvg - h) / 3, 0, 1);
}

export interface SubstrateSample {
  albedo: V3;
  /** dominant substrate family label (diagnostic; from the branch weights) */
  family: string;
  h: number;
  slope: number;
  depth: number;
  shoreDist: number;
}

/** The classification twin of substrateAlbedo() — same blend order. */
export function substrateSampleCpu(data: WorldData, x: number, z: number): SubstrateSample {
  const h = data.terrainHeight(x, z);
  const normal = seabedNormalCpu(data, x, z);
  const slope = 1 - clamp(normal[1], 0, 1);
  const sd = data.shoreDistance(x, z);
  const [biomeR, biomeG, biomeB] = data.biomeAt(x, z);
  const conc = concavityCpu(data, x, z, h);

  const bBroad = subFbm(x * 0.0058824, z * 0.0058824, 11);
  const bMoist = subFbm(x * 0.0111111, z * 0.0111111, 23);
  const bMed = subFbm(x * 0.0454545, z * 0.0454545, 37);

  let ground: V3;
  let family = 'rock';
  let best = 0;
  const consider = (name: string, w: number) => {
    if (w > best) {
      best = w;
      family = name;
    }
  };

  if (h < 0) {
    const depth = -h;
    const sediment = mixV(SUB_SHAL_SAND, SUB_SILT, sstep(10, 42, depth));
    const shallowStone = mixV(SUB_REEF_LIME, SUB_KELP_STONE, biomeG * 0.75);
    let stone = mixV(shallowStone, SUB_MID_STONE, sstep(8, 30, depth));
    stone = mixV(stone, SUB_TRENCH_ROCK, sstep(45, 65, depth));

    const rockW = sstep(0.16, 0.42, slope + (bMed - 0.5) * 0.35);
    ground = mixV(sediment, stone, rockW);
    consider(depth < 12 ? 'shallow-sand' : 'deep-sediment', (1 - rockW) * 0.9);
    consider(depth > 50 ? 'trench-rock' : depth > 22 ? 'mid-stone' : 'reef-stone', rockW);

    const siltW = (1 - sstep(0.06, 0.16, slope)) * sstep(0.15, 0.6, conc) * sstep(6, 16, depth);
    ground = mixV(ground, mixV(SUB_SILT, SUB_TRENCH_SED, sstep(45, 65, depth)), siltW * 0.8);
    consider('silt-pocket', siltW * 0.8);

    const cliffW = sstep(0.45, 0.72, slope);
    ground = mixV(ground, mixV(SUB_UW_CLIFF, SUB_TRENCH_ROCK, sstep(40, 62, depth)), cliffW);
    consider('uw-cliff-stone', cliffW);

    const shoreW = (1 - sstep(4, 14, sd)) * sstep(0.12, 0.35, slope + (bMed - 0.5) * 0.2);
    ground = mixV(ground, SUB_SHORE_STONE, shoreW * 0.7);
    consider('shore-stone', shoreW * 0.7);

    let dCave = Infinity;
    for (const [cx, cz] of CAVES) dCave = Math.min(dCave, Math.hypot(x - cx, z - cz));
    const caveW = 1 - sstep(8, 24, dCave);
    ground = mixV(ground, SUB_CAVE_ROCK, caveW * 0.75);
    consider('cave-mouth-rock', caveW * 0.75);

    ground = mixV(ground, mixV(ground, SUB_SILT, 0.35), biomeB * 0.6);
    ground = mixV(ground, [ground[0] * 1.06, ground[1] * 1.06, ground[2] * 1.06], biomeR * 0.5);
  } else {
    const inland = -sd;
    let soil = mixV(SUB_LOW_SOIL, SUB_DRY_EARTH, sstep(0.35, 0.7, bMoist));
    soil = mixV(soil, SUB_VEG_SOIL, sstep(0.55, 0.8, 1 - bMoist) * 0.7);

    const beachW = (1 - sstep(3.5, 7, h)) * (1 - sstep(0.14, 0.32, slope)) * (1 - sstep(28, 60, inland));
    ground = mixV(soil, SUB_DRY_SAND, beachW);
    consider('beach-sand', beachW);
    consider('soil', (1 - beachW) * 0.5);

    const rockW = sstep(0.22, 0.45, slope + (bMed - 0.5) * 0.25);
    let rockCol = mixV(SUB_ROCK, SUB_HIGH_ROCK, sstep(60, 130, h));
    const cliffW = sstep(0.5, 0.72, slope);
    rockCol = mixV(rockCol, SUB_CLIFF_ROCK, cliffW);
    const strata = Math.sin(h * 0.55 + bMed * 6);
    const sMul = 1 + strata * 0.05 * cliffW;
    rockCol = [rockCol[0] * sMul, rockCol[1] * sMul, rockCol[2] * sMul];
    ground = mixV(ground, rockCol, rockW);
    consider(h > 90 ? 'high-rock' : cliffW > 0.5 ? 'cliff-rock' : 'exposed-rock', rockW);

    const wetW = Math.max(1 - sstep(0.3, 1.4, h), 1 - sstep(2, 6, inland));
    ground = mixV(ground, mixV(SUB_WET_SAND, SUB_SHORE_STONE, sstep(0.25, 0.5, slope)), wetW * 0.65);
    consider('wet-shoreline', wetW * 0.65);
  }

  ground = [
    ground[0] * (1 + (bBroad - 0.5) * 0.06),
    ground[1],
    ground[2] * (1 - (bBroad - 0.5) * 0.05),
  ];
  const drift = 1 + (bBroad - 0.5) * 0.08;
  ground = [ground[0] * drift, ground[1] * drift, ground[2] * drift];

  return { albedo: ground, family, h, slope, depth: Math.max(0, -h), shoreDist: sd };
}
