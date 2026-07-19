// bake-region.mjs — Checkpoint 04A deterministic offline region bake,
// extended at Checkpoint 05A with the ZyFou-adapted relief stage
// (region-relief.mjs) per the post-CP05 addendum §4:
//
//   pass 1: the approved CP05 field (fieldC base + cp04A bounded variation)
//           — code below UNTOUCHED, reproduced bit-exactly;
//   pass 2: shore mask + exact EDT of the CP05 field (the coastline that
//           must be preserved);
//   pass 3: + reliefAt(x, z, h05, shoreDist) — domain-warped ridged
//           formations gated by protected masks, tapering to EXACTLY zero
//           near the height = 0 contour, so shore.png stays byte-identical
//           (asserted per-texel below and by --check).
//
// Turns the APPROVED LAYOUT (REGION_SKETCHES.md § "APPROVED LAYOUT":
// Sketch C — Twin Bay, seed 60418003, no redlines, both caves, no E2 shaft,
// monolith-ring discovery, spawn at the north-bay lagoon center) into the
// seven committed world artifacts of Implementation Master §2.3 at
// apps/shared-world/public/world/:
//
//   height.r16     2049² uint16-LE   heights, y = -80 + v/65535*280
//   shore.png      2049² 8-bit gray  mask: 255 = land (terrainHeight >= 0)
//   shore_sdf.r16  2049² uint16-LE   signed shore distance, meters,
//                                    d = -500 + v/65535*1000, + = water (R13)
//   biome.png      1025² 8-bit RGBA  zone-family masks (channels in world.json)
//   placement.json                   every approved site {category,type,x,z,yaw,scale}
//   caves.json                       cave/arch module sites + seam metadata
//   world.json                       header: origin/size/seaLevel/heightRange/
//                                    spawn/zones/ridge flags/attribution/probes
//
// Layout law (cp04A §6.1 + §13): the approved sketch is the single layout
// authority — this bake REPRODUCES it, it does not improve it. The height
// composition therefore starts from fieldC() copied VERBATIM from
// region-sketches.mjs (the function that drew the approved sketch), then adds
// bounded THREE.Terrain noise passes for natural variation. The variation
// amplitude is proportional to |base height| (10 % of local relief, inside
// the ≤ 15 % [DERIVED] bound) and tapers to zero at the summit and trench
// extremes, so:
//   - the shoreline SIGN can never flip (|variation| < |base|): the baked
//     coastline is the sketch coastline exactly (deviation 0 m ≤ 25 m bound,
//     asserted below per §6.1);
//   - the +200 summit and -80 trench floor are preserved.
//
// Determinism (cp04A §6.1): fixed integer seed; no Date; no unseeded
// randomness. THREE.Terrain 2.0.0's generators call Math.random internally,
// so the bake substitutes a seeded mulberry32 PRNG for Math.random strictly
// around those calls (saved/restored in finally) — two runs are
// byte-identical (--verify proves it, artifact by artifact, vs memory and
// disk).
//
// Usage:
//   node apps/shared-world/authoring/bake-region.mjs            # write artifacts
//   node apps/shared-world/authoring/bake-region.mjs --verify   # determinism check
//   node apps/shared-world/authoring/bake-region.mjs --check    # schema/layout/SDF checks (JSON report)
//
// Dependencies (authoring scope only): three.terrain.js@2.0.0 (MIT,
// IceCreamYou/THREE.Terrain — the cp04A §5 pinned authoring dependency),
// three (already an app dependency; supplies MathUtils for the shim).
// The optional ProceduralTerrains PNG seed input (cp04A §3.1) is NOT used —
// the approved analytic field is a better seed than any hand-export.

import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MathUtils } from 'three';
import {
  reliefAt,
  reliefMetadata,
  protectionFactor,
  ridgeZoneWeight,
  loopWaypoints,
  isletSpecs,
} from './region-relief.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'world');

// ---------------------------------------------------------------------------
// World contract constants (Implementation Master §2.1 / Track B Table 10)
// ---------------------------------------------------------------------------

/** The approved layout's seed (Sketch C). Changing it is a layout change
 *  requiring re-approval (cp04A §6.1). */
const SEED = 60418003;

const N = 2049;                 // heightmap resolution (2049², ~0.98 m/texel)
const NB = 1025;                // biome resolution
const REGION = 2000;            // meters across
const TEXEL = REGION / (N - 1); // 2000/2048 m per texel
const H_MIN = -80;
const H_MAX = 200;
const H_RANGE = H_MAX - H_MIN;  // 280
const SDF_CLAMP = 500;          // meters, ± clamp for shore_sdf.r16

/** Texel (i,j) → world meters (Track B Table 10). */
const texX = (i) => -1000 + i * TEXEL;
const texZ = (j) => -1000 + j * TEXEL;

// Variation bounds [DERIVED, cp04A §6.1]: fraction of local relief added by
// the THREE.Terrain passes (≤ 0.15 allowed; 0.10 chosen so the -80 trench
// floor keeps ≥ 8 m of margin against the ≤ -70 m fidelity assertion even
// before the extreme tapers).
const VARIATION_FRACTION = 0.10;

// ---------------------------------------------------------------------------
// Math helpers — copied verbatim from region-sketches.mjs (cp03) so the base
// field is bit-comparable with the approved sketch's.
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

function eNorm(px, pz, cx, cz, rx, rz, rot) {
  const c = Math.cos(-rot), s = Math.sin(-rot);
  const u = (px - cx) * c - (pz - cz) * s;
  const v = (px - cx) * s + (pz - cz) * c;
  return hyp(u / rx, v / rz);
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

function fbm(x, z, seed) {
  return (
    vnoise(x, z, seed) * 0.55 +
    vnoise(x * 2.13, z * 2.13, seed + 101) * 0.30 +
    vnoise(x * 4.31, z * 4.31, seed + 202) * 0.15
  );
}

function islandDisc(h, d, r, height, p = 1.6) {
  const m = 1 - sstep(0, r, d);
  return lerp(h, height, Math.pow(m, p));
}

function islandSeg(h, d, r, height, p = 1.6) {
  const m = 1 - sstep(0, r, d);
  return lerp(h, height, Math.pow(m, p));
}

// ---------------------------------------------------------------------------
// SKETCH C — TWIN BAY base field, copied VERBATIM from region-sketches.mjs
// (the approved layout authority). Do not edit: edits here are layout changes.
// ---------------------------------------------------------------------------

function fieldC(x, z, n1, n2) {
  const wob = (n1 - 0.5) * 150;
  const wob2 = (n2 - 0.5) * 26;
  let h = -46;

  // Enclosure: N + S deep hazard; E reef wall; W is the crescent's cliff back.
  h = lerp(h, -76, sstep(830, 980, Math.abs(z)));
  h = lerp(h, -6 + wob2 * 0.15, sstep(855, 945, x) * (1 - sstep(680, 820, Math.abs(z))));

  // North bay lagoon.
  const dlag = hyp(x + 180, z + 380);
  h = lerp(h, -6 - 2 * (1 - sstep(60, 200, dlag)), 1 - sstep(230 + wob * 0.25, 300 + wob * 0.25, dlag));

  // South bay kelp reef shelf (family C).
  h = lerp(h, -20 + wob2 * 0.5, 1 - sstep(230, 330, hyp(x + 180, z - 300) + wob * 0.4));

  // Desaturated plain SE (family E).
  h = lerp(h, -44 + wob2 * 0.3, (1 - sstep(100, 240, hyp(x - 140, z - 660))) * 0.92);

  // Trench running N–S in the E (floor −80).
  const dt = dSeg(x, z, 560, -250, 520, 180);
  h = lerp(h, -80, 1 - sstep(70, 170, dt + wob * 0.3));

  // Crescent island W (+200 summit), capsule arc, cliffs to the W edge.
  const dcres = Math.min(
    dSeg(x, z, -650, -520, -780, -80),
    dSeg(x, z, -780, -80, -620, 420),
  ) + wob;
  h = islandSeg(h, dcres, 230, 170, 1.5);
  h = islandDisc(h, hyp(x + 760, z + 100) + wob * 0.5, 215, 200, 1.7); // summit
  // Headland peninsula + islet chain (corridor).
  h = islandSeg(h, dSeg(x, z, -600, -40, -280, -60) + wob * 0.5, 120, 25, 1.4);
  h = islandDisc(h, hyp(x + 80, z + 70) + wob * 0.3, 55, 6, 1.2);
  h = islandDisc(h, hyp(x - 90, z + 80) + wob * 0.3, 46, 4, 1.2);
  h = islandDisc(h, hyp(x - 230, z + 90) + wob * 0.3, 42, 3, 1.2);
  // NE island and S bay-mouth island.
  h = islandDisc(h, hyp(x - 480, z + 560) + wob * 0.6, 190, 70, 1.5);
  h = islandDisc(h, hyp(x + 380, z - 640) + wob * 0.6, 125, 45, 1.5);
  // E-edge wall rocks.
  h = islandDisc(h, hyp(x - 900, z + 480) + wob * 0.2, 40, 4, 1.1);
  h = islandDisc(h, hyp(x - 905, z - 620) + wob * 0.2, 42, 4, 1.1);

  h += (n2 - 0.5) * 4;
  return clamp(h, -80, 200);
}

function baseHeight(x, z) {
  const n1 = fbm(x * 0.006, z * 0.006, SEED);
  const n2 = fbm(x * 0.02, z * 0.02, SEED + 7);
  return fieldC(x, z, n1, n2);
}

// ---------------------------------------------------------------------------
// THREE.Terrain variation pass (authoring dependency, cp04A §3.1/§5).
// The 2.0.0 build is a plain browser script attaching to a passed `THREE`;
// load it with a Function wrapper and shim THREE.Math.ceilPowerOfTwo (three
// 0.184 moved it to MathUtils). Its generators call Math.random — replaced
// by seeded mulberry32 for the duration of the calls (restored in finally).
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VAR_SEG = 256; // variation grid: 257² (DiamondSquare-friendly 2^n+1)

function buildVariationGrid() {
  const shimTHREE = { Math: { ceilPowerOfTwo: MathUtils.ceilPowerOfTwo } };
  const src = readFileSync(
    join(HERE, '..', 'node_modules', 'three.terrain.js', 'build', 'THREE.Terrain.js'),
    'utf8',
  );
  // sloppy-mode Function so the script's `(function(global){...})(this)`
  // receives globalThis (its noise module must be a real global — the
  // generators reference the bare identifier `noise`)
  const load = new Function('THREE', src);
  load.call(globalThis, shimTHREE);
  const Terrain = shimTHREE.Terrain;
  if (typeof Terrain?.Perlin !== 'function' || typeof Terrain?.DiamondSquare !== 'function') {
    throw new Error('three.terrain.js did not load (Perlin/DiamondSquare missing)');
  }

  const xl = VAR_SEG + 1;
  const g = new Float64Array(xl * xl);
  const options = { xSegments: VAR_SEG, ySegments: VAR_SEG, maxHeight: 1, minHeight: -1, frequency: 2.5 };

  const realRandom = Math.random;
  try {
    Math.random = mulberry32(SEED ^ 0x5eed04a);
    Terrain.Perlin(g, options);                          // broad organic base
    Terrain.DiamondSquare(g, { ...options, maxHeight: 0.5, minHeight: -0.5 }); // fractal detail
  } finally {
    Math.random = realRandom;
  }

  // normalize to zero mean, max |v| = 1 (amplitude is applied per-texel)
  let mean = 0;
  for (let i = 0; i < g.length; i++) mean += g[i];
  mean /= g.length;
  let maxAbs = 0;
  for (let i = 0; i < g.length; i++) {
    g[i] -= mean;
    const a = Math.abs(g[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs > 0) for (let i = 0; i < g.length; i++) g[i] /= maxAbs;
  return g;
}

/** Bilinear sample of the 257² variation grid at world (x, z). */
function sampleVariation(g, x, z) {
  const u = ((x + 1000) / REGION) * VAR_SEG;
  const v = ((z + 1000) / REGION) * VAR_SEG;
  const i0 = clamp(Math.floor(u), 0, VAR_SEG - 1);
  const j0 = clamp(Math.floor(v), 0, VAR_SEG - 1);
  const fu = u - i0, fv = v - j0;
  const xl = VAR_SEG + 1;
  const a = g[j0 * xl + i0], b = g[j0 * xl + i0 + 1];
  const c = g[(j0 + 1) * xl + i0], d = g[(j0 + 1) * xl + i0 + 1];
  return lerp(lerp(a, b, fu), lerp(c, d, fu), fv);
}

/** Variation amplitude at base height h: 10 % of |h| (local relief), tapered
 *  to zero at the summit/trench extremes so +200 / −80 are preserved, and
 *  inherently zero at the coastline (|amp| < |h| ⇒ no sign flips). */
function variationAmp(h) {
  const relief = Math.abs(h);
  const topTaper = 1 - sstep(150, 195, h);
  const bottomTaper = 1 - sstep(60, 78, -h);
  return VARIATION_FRACTION * relief * topTaper * bottomTaper;
}

// ---------------------------------------------------------------------------
// Height compose + quantize
// ---------------------------------------------------------------------------

const qEncode = (h) => Math.round(((clamp(h, H_MIN, H_MAX) - H_MIN) / H_RANGE) * 65535);
const qDecode = (v) => H_MIN + (v / 65535) * H_RANGE;

function composeHeights() {
  const variation = buildVariationGrid();
  const h16 = new Uint16Array(N * N);
  const base = new Float64Array(N * N);
  /** the approved CP05 field (base + cp04A variation) — the relief macro authority */
  const h05 = new Float64Array(N * N);
  let signFlips = 0;

  // --- pass 1: the approved CP05 field, bit-exact (cp04A compose, untouched) ---
  for (let j = 0; j < N; j++) {
    const z = texZ(j);
    for (let i = 0; i < N; i++) {
      const x = texX(i);
      const hb = baseHeight(x, z);
      const h = clamp(hb + sampleVariation(variation, x, z) * variationAmp(hb), H_MIN, H_MAX);
      // §6.1 coastline law: variation must never move the coastline off the
      // approved layout (> 25 m). |variation| < |base| makes the sign
      // immovable — assert it texel by texel (deviation is exactly 0 m).
      if (hb >= 0 !== h >= 0) signFlips++;
      base[j * N + i] = hb;
      h05[j * N + i] = h;
    }
  }
  if (signFlips > 0) {
    throw new Error(`coastline moved: ${signFlips} texels changed land/water sign vs the approved sketch field`);
  }

  // --- pass 2: the CP05 shore mask (quantized-sign law — the exact rule the
  // committed cp05 shore.png used) + float EDT for the relief's coast taper ---
  const mask05 = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) mask05[k] = qDecode(qEncode(h05[k])) >= 0 ? 1 : 0;
  const sdfM = shoreSdfMeters(mask05);

  // --- pass 3: CP05A relief (region-relief.mjs), coastline-preserving ---
  let maskFlips = 0;
  let deltaMax = 0;
  let deltaMin = 0;
  for (let j = 0; j < N; j++) {
    const z = texZ(j);
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = texX(i);
      const d = reliefAt(x, z, h05[k], sdfM[k]);
      if (d > deltaMax) deltaMax = d;
      if (d < deltaMin) deltaMin = d;
      const q = qEncode(clamp(h05[k] + d, H_MIN, H_MAX));
      // coastline law (addendum §4.5): the quantized land/water bit of every
      // texel must match the CP05 mask — shore.png byte-identical.
      if ((qDecode(q) >= 0 ? 1 : 0) !== mask05[k]) maskFlips++;
      h16[k] = q;
    }
  }
  if (maskFlips > 0) {
    throw new Error(`CP05A relief moved the coastline: ${maskFlips} texels changed the quantized land/water bit`);
  }
  return { h16, base, h05, sdfM, reliefRange: { min: deltaMin, max: deltaMax } };
}

// ---------------------------------------------------------------------------
// Shore mask + signed Euclidean distance transform (Felzenszwalb 1-D×2, exact)
// ---------------------------------------------------------------------------

/** mask[k] = 1 where dequantized height >= 0 (land) — the artifact truth. */
function shoreMask(h16) {
  const mask = new Uint8Array(N * N);
  for (let k = 0; k < h16.length; k++) mask[k] = qDecode(h16[k]) >= 0 ? 1 : 0;
  return mask;
}

/** 1-D squared distance transform (Felzenszwalb & Huttenlocher). */
function dt1d(f, n, d, v, zz) {
  let k = 0;
  v[0] = 0;
  zz[0] = -Infinity;
  zz[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= zz[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    zz[k] = s;
    zz[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (zz[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Exact squared EDT of `inside` (distance to nearest inside==1 texel). */
function edt2d(inside) {
  const INF = 1e20;
  const g = new Float64Array(N * N);
  for (let k = 0; k < N * N; k++) g[k] = inside[k] ? 0 : INF;
  const f = new Float64Array(N);
  const d = new Float64Array(N);
  const v = new Int32Array(N);
  const zz = new Float64Array(N + 1);
  // columns
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) f[j] = g[j * N + i];
    dt1d(f, N, d, v, zz);
    for (let j = 0; j < N; j++) g[j * N + i] = d[j];
  }
  // rows
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) f[i] = g[j * N + i];
    dt1d(f, N, d, v, zz);
    for (let i = 0; i < N; i++) g[j * N + i] = d[i];
  }
  return g;
}

/** Signed shore distance in float meters (+ = water), half-texel-centered so
 *  the bilinear zero level sits on the mask boundary; clamped ±SDF_CLAMP.
 *  (cp05A refactor: the float field feeds both the relief stage's coast
 *  taper and the quantized artifact — one EDT, one truth.) */
function shoreSdfMeters(mask) {
  const water = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) water[k] = mask[k] ? 0 : 1;
  const dLand = edt2d(mask);   // squared texel distance to nearest land
  const dWater = edt2d(water); // squared texel distance to nearest water
  const sdfM = new Float64Array(N * N);
  for (let k = 0; k < N * N; k++) {
    let d;
    if (mask[k]) d = -(Math.sqrt(dWater[k]) - 0.5) * TEXEL; // land: negative
    else d = (Math.sqrt(dLand[k]) - 0.5) * TEXEL;           // water: positive
    sdfM[k] = clamp(d, -SDF_CLAMP, SDF_CLAMP);
  }
  return sdfM;
}

/** Quantize the float SDF to the uint16 artifact encoding. */
function signedShoreDistance(sdfM) {
  const sdf16 = new Uint16Array(N * N);
  for (let k = 0; k < N * N; k++) {
    sdf16[k] = Math.round(((sdfM[k] + SDF_CLAMP) / (2 * SDF_CLAMP)) * 65535);
  }
  return sdf16;
}

const sdfDecode = (v) => -SDF_CLAMP + (v / 65535) * (2 * SDF_CLAMP);

// ---------------------------------------------------------------------------
// Minimal PNG writer (from region-sketches.mjs; grayscale + RGBA variants)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** colorType 0 = grayscale (1 B/px), 6 = RGBA (4 B/px); 8-bit; filter 0. */
function encodePNG(width, height, pixels, colorType) {
  const bpp = colorType === 0 ? 1 : 4;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const raw = Buffer.alloc(height * (1 + width * bpp));
  for (let y = 0; y < height; y++) {
    const ro = y * (1 + width * bpp);
    raw[ro] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * bpp, width * bpp).copy(raw, ro + 1);
  }
  const idat = deflateSync(raw, { level: 9, memLevel: 9, strategy: 0 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Biome masks (approved zone families of Sketch C, rasterized analytically
// at 1025²). Channel table is written into world.json. The dark cave family
// D is interior volume (caves.json sites), not a top-down area — recorded in
// the zone table, not a raster channel.
// ---------------------------------------------------------------------------

function biomePixels() {
  const px = new Uint8Array(NB * NB * 4);
  const step = REGION / (NB - 1);
  for (let j = 0; j < NB; j++) {
    const z = -1000 + j * step;
    for (let i = 0; i < NB; i++) {
      const x = -1000 + i * step;
      const n1 = fbm(x * 0.006, z * 0.006, SEED);
      const wob = (n1 - 0.5) * 150;
      // R: bright shallow band — north-bay lagoon stamp + beach fringe
      const dlag = hyp(x + 180, z + 380);
      const lagoon = 1 - sstep(230 + wob * 0.25, 300 + wob * 0.25, dlag);
      const hb = baseHeight(x, z);
      const fringe = hb < 0 ? 1 - sstep(-2, 0, -hb - 8) : 0; // water shallower than ~8–10 m
      const bright = Math.max(lagoon, Math.min(fringe, hb < 0 ? 1 : 0));
      // G: family C kelp reef — south-bay shelf stamp
      const kelp = 1 - sstep(230, 330, hyp(x + 180, z - 300) + wob * 0.4);
      // B: family E desaturated plain — SE plain stamp
      const plain = (1 - sstep(100, 240, hyp(x - 140, z - 660))) * 0.92;
      const o = (j * NB + i) * 4;
      px[o] = Math.round(clamp(bright, 0, 1) * 255);
      px[o + 1] = Math.round(clamp(kelp, 0, 1) * 255);
      px[o + 2] = Math.round(clamp(plain, 0, 1) * 255);
      px[o + 3] = 255; // reserved (opaque so canvas decode is lossless)
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Approved sites (REGION_SKETCHES.md Sketch C §6 checklist + APPROVED LAYOUT)
// ---------------------------------------------------------------------------

const SPAWN = { x: -180, z: -380 };
/** Spawn heading: along the approved loop's first leg, toward (−30, −260). */
const SPAWN_YAW = Math.atan2(-30 - SPAWN.x, -260 - SPAWN.z);

/** The approved swim loop (route from SKETCH_C, closing duplicate dropped). */
const LOOP = [
  [-180, -380], [-30, -260], [10, -90], [280, -210], [430, -300], [500, -120],
  [465, 90], [420, 200], [390, 290], [200, 470], [-120, 260], [-420, 30],
  [-430, -150],
];

const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

function buildPlacement() {
  const inst = [];
  const add = (category, type, x, z, yaw = 0, scale = 1) =>
    inst.push({ category, type, x: r6(x), z: r6(z), yaw: r6(yaw), scale });

  add('spawn', 'spawn-north-bay-lagoon', SPAWN.x, SPAWN.z, SPAWN_YAW);
  // breach sightlines (yaw = the annotated view direction)
  add('breach', 'b1-crescent-summit-ne-island', -280, -300, yawTo(-280, -300, -760, -100));
  add('breach', 'b2-crescent-ridge-s-island', -100, 420, yawTo(-100, 420, -700, 170));
  add('breach', 'b3-both-e-islands-open-horizon', 430, -300, yawTo(430, -300, 480, -560));
  // arch + cave mouths (transforms fixed now; module IDs at cp09)
  add('arch', 'islet-gap-arch-5m', -40, -70, yawTo(-40, -70, 10, -90));
  add('cave-mouth', 'headland-cave-south-mouth', -420, 30, yawTo(-420, 30, -430, -150));
  add('cave-mouth', 'headland-cave-north-mouth', -430, -150, yawTo(-430, -150, -420, 30));
  add('cave-mouth', 'trench-wall-cave-optional', 450, -30, yawTo(450, -30, 520, -35));
  // ruins (≥1 shoreline, ≥1 submerged) + wreck
  add('ruin', 'shoreline-settlement', -470, -300, 0.6);
  add('ruin', 'submerged-column-field', -120, 260, 0);
  add('wreck', 'trench-w-rim-wreck', 440, 160, yawTo(440, 160, 520, 180));
  // landmarks: corridor masses (the islet-chain corridor), spires, silhouette
  add('corridor-mass', 'islet-1', -80, -70);
  add('corridor-mass', 'islet-2', 90, -80);
  add('corridor-mass', 'islet-3', 230, -90);
  add('spire', 'south-bay-spire-1', -300, 420);
  add('spire', 'south-bay-spire-2', 100, 330);
  add('silhouette', 'plain-silhouette', 250, 570);
  // current funnel (direction (0.83, −0.55) toward the trench)
  add('current', 'corridor-trench-funnel', 260, -200, Math.atan2(0.83, -0.55));
  // approved discovery: ring of ambiguous monolith stones on the trench rim
  const MONOLITHS = 7;
  const RING_R = 12;
  for (let k = 0; k < MONOLITHS; k++) {
    const a = (k / MONOLITHS) * Math.PI * 2;
    add(
      'discovery', `monolith-${k + 1}-of-${MONOLITHS}`,
      390 + Math.sin(a) * RING_R, 290 + Math.cos(a) * RING_R,
      a + Math.PI, // each stone faces the ring center
      1,
    );
  }
  // the approved loop as ordered route waypoints (closed loop)
  LOOP.forEach(([x, z], k) => add('route', `loop-${String(k).padStart(2, '0')}`, x, z));
  return {
    magic: 'bodyarcade-region-placement/1',
    layout: 'Sketch C — Twin Bay (APPROVED LAYOUT, 2026-07-18)',
    routeClosed: true,
    instances: inst,
  };
}

function buildCaves(sampleH) {
  const lip = (x, z) => r6(sampleH(x, z));
  return {
    magic: 'bodyarcade-region-caves/1',
    note: 'Sites + transforms fixed at cp04A; module IDs assigned at cp09 (Kenney kit + Blender). Seam rule per Master §5.2.',
    modules: [
      {
        id: 'cave-headland',
        family: 'D',
        role: 'primary bay-to-bay loop shortcut (approved: the main route)',
        moduleId: null,
        transform: { x: -425, z: -60, yaw: r6(yawTo(-430, -150, -420, 30)), scale: 1 },
        mouths: [
          { name: 'south', x: -420, z: 30, yaw: r6(yawTo(-420, 30, -430, -150)), lipY: lip(-420, 30) },
          { name: 'north', x: -430, z: -150, yaw: r6(yawTo(-430, -150, -420, 30)), lipY: lip(-430, -150) },
        ],
        passage: [[-430, -150], [-420, 30]],
        seam: {
          policy: 'heightmap locally lowered to meet each module lip at cp09; shared triplanar rock across the seam; trimesh authoritative where the module undercuts',
        },
      },
      {
        id: 'cave-trench-wall',
        family: 'D',
        role: 'smaller optional trench-wall discovery — NOT another major route (approved)',
        moduleId: null,
        transform: { x: 450, z: -30, yaw: r6(yawTo(450, -30, 520, -35)), scale: 0.6 },
        mouths: [{ name: 'west', x: 450, z: -30, yaw: r6(yawTo(450, -30, 520, -35)), lipY: lip(450, -30) }],
        passage: [[450, -30]],
        seam: {
          policy: 'single-mouth pocket in the trench W wall; heightmap lip lowered at cp09; trimesh authoritative inside',
        },
      },
      {
        id: 'arch-islet-gap',
        family: 'arch',
        role: 'the approved arch in the islet gap (opening 5 m)',
        moduleId: null,
        openingMeters: 5,
        transform: { x: -40, z: -70, yaw: r6(yawTo(-40, -70, 10, -90)), scale: 1 },
        mouths: [],
        seam: { policy: 'free-standing arch; footings meet terrain; trimesh at cp09' },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// world.json header
// ---------------------------------------------------------------------------

/** 20 fixed loader round-trip probes across the approved features (§8.6). */
const PROBES_XZ = [
  [-180, -380],  // spawn / lagoon center
  [-100, -300],  // lagoon
  [-180, 300],   // south-bay kelp shelf
  [-120, 260],   // column-field ruin
  [140, 660],    // plain E
  [560, -250],   // trench spine N
  [520, 180],    // trench spine S
  [540, -35],    // trench mid
  [-760, -100],  // summit
  [-700, -300],  // crescent flank
  [-420, 30],    // headland cave S mouth
  [-430, -150],  // headland cave N mouth
  [450, -30],    // trench-wall cave mouth
  [-40, -70],    // arch
  [390, 290],    // monolith-ring discovery
  [480, -560],   // NE island
  [-380, 640],   // S island
  [90, -80],     // islet 2
  [900, -480],   // E-wall rock
  [0, -900],     // N deep hazard water
];

function bilinearH(h16, x, z) {
  const u = clamp((x + 1000) / TEXEL, 0, N - 1);
  const v = clamp((z + 1000) / TEXEL, 0, N - 1);
  const i0 = Math.min(Math.floor(u), N - 2);
  const j0 = Math.min(Math.floor(v), N - 2);
  const fu = u - i0, fv = v - j0;
  const a = qDecode(h16[j0 * N + i0]);
  const b = qDecode(h16[j0 * N + i0 + 1]);
  const c = qDecode(h16[(j0 + 1) * N + i0]);
  const d = qDecode(h16[(j0 + 1) * N + i0 + 1]);
  return lerp(lerp(a, b, fu), lerp(c, d, fu), fv);
}

/** Bilinear over a Float64 height grid (cp05A check helper). */
function bilinearF(g, x, z) {
  const u = clamp((x + 1000) / TEXEL, 0, N - 1);
  const v = clamp((z + 1000) / TEXEL, 0, N - 1);
  const i0 = Math.min(Math.floor(u), N - 2);
  const j0 = Math.min(Math.floor(v), N - 2);
  const fu = u - i0, fv = v - j0;
  const a = g[j0 * N + i0];
  const b = g[j0 * N + i0 + 1];
  const c = g[(j0 + 1) * N + i0];
  const d = g[(j0 + 1) * N + i0 + 1];
  return lerp(lerp(a, b, fu), lerp(c, d, fu), fv);
}

function bilinearSdf(sdf16, x, z) {
  const u = clamp((x + 1000) / TEXEL, 0, N - 1);
  const v = clamp((z + 1000) / TEXEL, 0, N - 1);
  const i0 = Math.min(Math.floor(u), N - 2);
  const j0 = Math.min(Math.floor(v), N - 2);
  const fu = u - i0, fv = v - j0;
  const a = sdfDecode(sdf16[j0 * N + i0]);
  const b = sdfDecode(sdf16[j0 * N + i0 + 1]);
  const c = sdfDecode(sdf16[(j0 + 1) * N + i0]);
  const d = sdfDecode(sdf16[(j0 + 1) * N + i0 + 1]);
  return lerp(lerp(a, b, fu), lerp(c, d, fu), fv);
}

function buildWorldJson(h16, byteSizes) {
  return {
    magic: 'bodyarcade-region-world/1',
    generator: 'apps/shared-world/authoring/bake-region.mjs',
    seed: SEED,
    layout: 'REGION_SKETCHES.md § APPROVED LAYOUT — Sketch C (Twin Bay), approved 2026-07-18: no redlines; both caves (headland primary shortcut, trench-wall optional); no E2 shaft; monolith-ring discovery; spawn north-bay lagoon center',
    axis: 'right-handed, y-up, meters; ground plane XZ; north = -Z',
    origin: [0, 0],
    sizeMeters: [REGION, REGION],
    seaLevel: 0,
    heightRange: [H_MIN, H_MAX],
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw: r6(SPAWN_YAW), note: 'north-bay lagoon center (approved default)' },
    artifacts: {
      'height.r16': {
        resolution: N, encoding: 'uint16-le', bytes: byteSizes['height.r16'],
        valueToMeters: 'y = -80 + v/65535*280',
        texelToWorld: 'x = -1000 + i*(2000/2048); z = -1000 + j*(2000/2048)',
      },
      'shore.png': {
        resolution: N, encoding: 'png-gray8', bytes: byteSizes['shore.png'],
        meaning: '255 = land (terrainHeight >= 0), 0 = water; derived from dequantized height.r16 (sign-exact)',
      },
      'shore_sdf.r16': {
        resolution: N, encoding: 'uint16-le', bytes: byteSizes['shore_sdf.r16'],
        valueToMeters: 'd = -500 + v/65535*1000; positive = water; clamped ±500 m; exact EDT, half-texel-centered (schema extension R13)',
      },
      'biome.png': {
        resolution: NB, encoding: 'png-rgba8', bytes: byteSizes['biome.png'],
        channels: {
          R: 'bright shallow band — north-bay lagoon + beach fringe',
          G: 'family C kelp reef — south bay shelf',
          B: 'family E desaturated plain — SE pocket',
          A: 'reserved (constant 255 so canvas decode is lossless)',
        },
      },
      'placement.json': { bytes: byteSizes['placement.json'] },
      'caves.json': { bytes: byteSizes['caves.json'] },
    },
    zones: [
      { family: 'bright-shallow', area: 'north-bay lagoon + beach fringe', raster: 'biome.R', depthBand: '3-10 m' },
      { family: 'C-kelp-reef', area: 'south bay shelf', raster: 'biome.G', depthBand: '10-36 m' },
      { family: 'E-desaturated-plain', area: 'SE pocket', raster: 'biome.B', depthBand: '~44 m' },
      { family: 'D-olive-cave', area: 'headland cave + optional trench-wall cave (interior volumes — sites in caves.json, no top-down raster)', raster: null, depthBand: 'enclosed' },
      { family: 'depth-ramp-default', area: 'everywhere else', raster: null, depthBand: 'master depth ramp' },
    ],
    ridgeLines: [
      { name: 'crescent-spine', points: [[-650, -520], [-780, -80], [-620, 420]] },
      { name: 'crescent-summit', points: [[-760, -100]] },
      { name: 'headland-spine', points: [[-600, -40], [-280, -60]] },
      { name: 'ne-island', points: [[480, -560]] },
      { name: 's-island', points: [[-380, 640]] },
    ],
    silhouetteProtection: {
      coastlineTiles: 'derive from shore.png at cp05 (tiles containing a land/water transition keep max LOD)',
      ridgeLines: 'tiles crossed by ridgeLines keep max LOD (Master §5.4)',
    },
    attribution: [
      'Region: original BodyArcade authored terrain, 2026',
      'Layout: Sketch C (Twin Bay), Checkpoint 03 decision gate, approved 2026-07-18',
      'Authoring algorithms: THREE.Terrain 2.0.0 (MIT, Isaac Sukin) noise passes over the approved analytic field',
      'Relief techniques (CP05A) adapted from ZyFou/ProceduralTerrains (MIT, github.com/ZyFou/ProceduralTerrains, pinned 8b396f9c) into app-owned authoring code',
    ],
    relief: reliefMetadata(),
    verification: {
      note: 'Loader round-trip targets (§8.6): terrainHeight bilinear over the dequantized uint16 grid at these points must match within 0.01 m.',
      probes: PROBES_XZ.map(([x, z]) => ({ x, z, h: r6(bilinearH(h16, x, z)) })),
    },
  };
}

// ---------------------------------------------------------------------------
// Bake (pure, in-memory) → { name: Buffer }
// ---------------------------------------------------------------------------

function bake() {
  const { h16, base, h05, sdfM, reliefRange } = composeHeights();
  const mask = shoreMask(h16);
  const sdf16 = signedShoreDistance(sdfM);

  const heightBuf = Buffer.from(h16.buffer, h16.byteOffset, h16.byteLength); // LE on all supported platforms
  const sdfBuf = Buffer.from(sdf16.buffer, sdf16.byteOffset, sdf16.byteLength);
  const maskPx = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) maskPx[k] = mask[k] ? 255 : 0;
  const shorePng = encodePNG(N, N, maskPx, 0);
  const biomePng = encodePNG(NB, NB, biomePixels(), 6);

  const placement = Buffer.from(JSON.stringify(buildPlacement(), null, 2) + '\n');
  const caves = Buffer.from(
    JSON.stringify(buildCaves((x, z) => bilinearH(h16, x, z)), null, 2) + '\n',
  );

  const byteSizes = {
    'height.r16': heightBuf.length,
    'shore.png': shorePng.length,
    'shore_sdf.r16': sdfBuf.length,
    'biome.png': biomePng.length,
    'placement.json': placement.length,
    'caves.json': caves.length,
  };
  const world = Buffer.from(JSON.stringify(buildWorldJson(h16, byteSizes), null, 2) + '\n');

  return {
    artifacts: {
      'height.r16': heightBuf,
      'shore.png': shorePng,
      'shore_sdf.r16': sdfBuf,
      'biome.png': biomePng,
      'placement.json': placement,
      'caves.json': caves,
      'world.json': world,
    },
    h16, base, h05, sdfM, mask, sdf16, reliefRange,
  };
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------------------
// --check: schema / layout-fidelity / SDF verification (cp04A §8.2–8.4).
// Deterministic seeded sampling; prints a machine-readable JSON report and
// exits non-zero on any failure. The Playwright suite shells out to this and
// re-asserts the numbers.
// ---------------------------------------------------------------------------

function landCentroid(h16, cx, cz, r) {
  let sx = 0, sz = 0, n = 0;
  const i0 = Math.max(0, Math.floor((cx - r + 1000) / TEXEL));
  const i1 = Math.min(N - 1, Math.ceil((cx + r + 1000) / TEXEL));
  const j0 = Math.max(0, Math.floor((cz - r + 1000) / TEXEL));
  const j1 = Math.min(N - 1, Math.ceil((cz + r + 1000) / TEXEL));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = texX(i), z = texZ(j);
      if (hyp(x - cx, z - cz) > r) continue;
      if (qDecode(h16[j * N + i]) >= 0) { sx += x; sz += z; n++; }
    }
  }
  return n ? { x: sx / n, z: sz / n, landTexels: n } : null;
}

function runChecks({ h16, base, h05, mask, sdf16, reliefRange }) {
  const checks = [];
  const push = (name, pass, detail) => checks.push({ name, pass, ...detail });

  // --- cp05A §8.3: coastline preservation — the artifact mask must equal the
  // CP05 (pre-relief) quantized mask texel for texel (⇒ shore.png bytes) ---
  let maskAgree = 0;
  for (let k = 0; k < N * N; k++) {
    if (mask[k] === (qDecode(qEncode(h05[k])) >= 0 ? 1 : 0)) maskAgree++;
  }
  push('cp05a-shore-mask-preserved', maskAgree === N * N, {
    agree: maskAgree, texels: N * N,
    note: 'artifact land/water bit identical to the pre-relief CP05 field ⇒ shore.png byte-identical',
  });

  // --- cp05A relief metrics (delta = final − CP05 field) ---
  // strong zones: near an authored ridge line, unprotected, real relief room
  let strongN = 0, strongSum2 = 0;
  let lagoonRN = 0, lagoonSum2 = 0;
  let gradOld = 0, gradNew = 0, gradSamples = 0;
  for (let j = 4; j < N - 4; j += 4) {
    const z = texZ(j);
    for (let i = 4; i < N - 4; i += 4) {
      const k = j * N + i;
      const x = texX(i);
      const d = qDecode(h16[k]) - h05[k];
      if (hyp(x + 180, z + 380) < 200 && h05[k] < 0) {
        lagoonRN++;
        lagoonSum2 += d * d;
      }
      if (Math.abs(h05[k]) > 10 && ridgeZoneWeight(x, z) > 0.5 && protectionFactor(x, z) > 0.7) {
        strongN++;
        strongSum2 += d * d;
        // roughness gain measured where the CP05 field was SMOOTH (base
        // gradient < 0.35 — the "melted" areas the addendum §2.2 calls out;
        // already-steep macro flanks would dilute the ratio)
        const e = 4 * TEXEL;
        const gxO = (h05[k + 4] - h05[k - 4]) / (2 * e);
        const gzO = (h05[k + 4 * N] - h05[k - 4 * N]) / (2 * e);
        const gO = hyp(gxO, gzO);
        if (gO < 0.35) {
          const gxN = (qDecode(h16[k + 4]) - qDecode(h16[k - 4])) / (2 * e);
          const gzN = (qDecode(h16[k + 4 * N]) - qDecode(h16[k - 4 * N])) / (2 * e);
          gradNew += hyp(gxN, gzN);
          gradOld += gO;
          gradSamples++;
        }
      }
    }
  }
  const strongRms = strongN ? Math.sqrt(strongSum2 / strongN) : 0;
  const lagoonRms = lagoonRN ? Math.sqrt(lagoonSum2 / lagoonRN) : 0;
  const gradRatio = gradOld > 0 ? gradNew / gradOld : Infinity;
  push('cp05a-relief-strong-zone', strongRms >= 4 && gradRatio >= 1.6, {
    rmsDeltaM: r6(strongRms), rmsFloorM: 4,
    gradientRatioNewOldOnSmoothBase: r6(gradRatio), gradientRatioFloor: 1.6,
    sampledTexels: strongN, gradSamples,
    deltaRange: { min: r6(reliefRange.min), max: r6(reliefRange.max) },
  });
  push('cp05a-relief-protected-lagoon', lagoonRms <= 0.9, {
    rmsDeltaM: r6(lagoonRms), rmsCapM: 0.9, sampledTexels: lagoonRN,
  });

  // --- CP05A correction: corridor-islet rockiness — the three approved
  // masses read as rocky mini-islands (peaks raised above the smooth
  // stamps, roughness materially increased) while their footprints stay
  // byte-identical (covered by cp05a-shore-mask-preserved above) ---
  for (const it of isletSpecs()) {
    let maxNew = -Infinity;
    let maxOld = -Infinity;
    let gN = 0;
    let gO = 0;
    let gs = 0;
    const i0 = Math.max(4, Math.floor((it.x - it.r + 1000) / TEXEL));
    const i1 = Math.min(N - 5, Math.ceil((it.x + it.r + 1000) / TEXEL));
    const j0 = Math.max(4, Math.floor((it.z - it.r + 1000) / TEXEL));
    const j1 = Math.min(N - 5, Math.ceil((it.z + it.r + 1000) / TEXEL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = texX(i);
        const z = texZ(j);
        if (hyp(x - it.x, z - it.z) > it.r) continue;
        const k = j * N + i;
        const hNew = qDecode(h16[k]);
        if (hNew > maxNew) maxNew = hNew;
        if (h05[k] > maxOld) maxOld = h05[k];
        if (h05[k] > 0.5) {
          const e = 2 * TEXEL;
          gN += hyp(
            (qDecode(h16[k + 2]) - qDecode(h16[k - 2])) / (2 * e),
            (qDecode(h16[k + 2 * N]) - qDecode(h16[k - 2 * N])) / (2 * e),
          );
          gO += hyp(
            (h05[k + 2] - h05[k - 2]) / (2 * e),
            (h05[k + 2 * N] - h05[k - 2 * N]) / (2 * e),
          );
          gs++;
        }
      }
    }
    const gradRatio = gO > 0 ? gN / gO : Infinity;
    push(`cp05a-islet-rocky-${it.x}-${it.z}`, maxNew >= maxOld + 2 && gradRatio >= 1.5, {
      center: [it.x, it.z], stampPeakM: it.peak,
      maxOldM: r6(maxOld), maxNewM: r6(maxNew), peakGainFloorM: 2,
      gradientRatioNewOld: r6(gradRatio), gradientRatioFloor: 1.5,
      landGradSamples: gs,
    });
  }

  // --- cp05A loop navigability: the approved swim route stays swimmable ---
  const loopPts = loopWaypoints();
  let loopMinDepthNew = Infinity;
  let loopWorstRatio = Infinity;
  let loopSamples = 0;
  for (let s = 0; s < loopPts.length - 1; s++) {
    const [ax, az] = loopPts[s];
    const [bx, bz] = loopPts[s + 1];
    const segLen = hyp(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(segLen / 10));
    for (let t = 0; t <= steps; t++) {
      const x = lerp(ax, bx, t / steps);
      const z = lerp(az, bz, t / steps);
      const hOld = bilinearF(h05, x, z);
      if (hOld >= -2) continue; // land / cave-passage legs (cp09) skipped
      const dNew = -bilinearH(h16, x, z);
      const dOld = -hOld;
      loopSamples++;
      if (dNew < loopMinDepthNew) loopMinDepthNew = dNew;
      const ratio = dNew / dOld;
      if (ratio < loopWorstRatio) loopWorstRatio = ratio;
    }
  }
  push('cp05a-loop-navigability', loopWorstRatio >= 0.55 && loopMinDepthNew >= 2.5, {
    minDepthNewM: r6(loopMinDepthNew), minDepthFloorM: 2.5,
    worstDepthRatio: r6(loopWorstRatio), ratioFloor: 0.55,
    waterSamples: loopSamples,
  });

  // --- §8.2 schema ---
  push('height-resolution', h16.length === N * N, { texels: h16.length, expected: N * N });
  let hMin = Infinity, hMax = -Infinity;
  for (let k = 0; k < h16.length; k++) {
    const h = qDecode(h16[k]);
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  push('height-range', hMin >= H_MIN - 1e-6 && hMax <= H_MAX + 1e-6, { min: r6(hMin), max: r6(hMax) });
  const rnd = mulberry32(SEED ^ 0xc0ffee);
  let signOk = 0;
  const SIGN_SAMPLES = 10000;
  for (let s = 0; s < SIGN_SAMPLES; s++) {
    const k = Math.floor(rnd() * N * N);
    if ((qDecode(h16[k]) >= 0) === (mask[k] === 1)) signOk++;
  }
  push('height-shore-sign-consistency', signOk === SIGN_SAMPLES, { agree: signOk, samples: SIGN_SAMPLES });

  // --- §8.3 layout fidelity vs the approved sketch ---
  // coastline: the compose step asserted zero sign flips vs the base field —
  // recompute IoU here from the base field for the record.
  let inter = 0, union = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = base[j * N + i] >= 0;
      const b = mask[j * N + i] === 1;
      if (a && b) inter++;
      if (a || b) union++;
    }
  }
  const iou = union ? inter / union : 1;
  push('coastline-iou-vs-sketch', iou >= 0.92, { iou: Math.round(iou * 1e6) / 1e6, bound: 0.92, coastlineDeviationMeters: 0 });

  const centroidTargets = [
    { name: 'ne-island', x: 480, z: -560, r: 190 },
    { name: 's-island', x: -380, z: 640, r: 125 },
    { name: 'islet-1', x: -80, z: -70, r: 55 },
    { name: 'islet-2', x: 90, z: -80, r: 46 },
    { name: 'islet-3', x: 230, z: -90, r: 42 },
    { name: 'e-wall-rock-1', x: 900, z: -480, r: 40 },
    { name: 'e-wall-rock-2', x: 905, z: 620, r: 42 },
  ];
  for (const t of centroidTargets) {
    const c = landCentroid(h16, t.x, t.z, t.r);
    const dev = c ? hyp(c.x - t.x, c.z - t.z) : Infinity;
    push(`island-centroid-${t.name}`, c !== null && dev <= 50, {
      target: [t.x, t.z], centroid: c ? [r6(c.x), r6(c.z)] : null, deviationM: r6(dev), boundM: 50,
    });
  }

  // summit: argmax within the summit stamp neighborhood
  let peakH = -Infinity, peakX = 0, peakZ = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const h = qDecode(h16[j * N + i]);
      if (h > peakH) { peakH = h; peakX = texX(i); peakZ = texZ(j); }
    }
  }
  const peakDev = hyp(peakX + 760, peakZ + 100);
  push('summit-position-and-height', peakDev <= 25 && peakH >= 195, {
    peak: [r6(peakX), r6(peakZ)], target: [-760, -100], deviationM: r6(peakDev), heightM: r6(peakH),
  });

  // trench floor ≤ −70 along the approved spine
  let trenchMin = Infinity;
  for (let t = 0; t <= 20; t++) {
    const x = lerp(560, 520, t / 20);
    const z = lerp(-250, 180, t / 20);
    trenchMin = Math.min(trenchMin, bilinearH(h16, x, z));
  }
  push('trench-floor', trenchMin <= -70, { minAlongSpineM: r6(trenchMin), boundM: -70 });

  // lagoon depth 3–10 m over ≥ 80 % of its area (disc r 200 at the center)
  let lagoonN = 0, lagoonOk = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = texX(i), z = texZ(j);
      if (hyp(x + 180, z + 380) > 200) continue;
      const h = qDecode(h16[j * N + i]);
      if (h >= 0) continue; // islet fringe pixels are land, not lagoon
      lagoonN++;
      const depth = -h;
      if (depth >= 3 && depth <= 10) lagoonOk++;
    }
  }
  const lagoonFrac = lagoonN ? lagoonOk / lagoonN : 0;
  push('lagoon-depth-band', lagoonFrac >= 0.8, {
    fracIn3to10: Math.round(lagoonFrac * 1e4) / 1e4, waterTexels: lagoonN,
  });

  // --- §8.4 SDF spot checks ---
  const rnd2 = mulberry32(SEED ^ 0x5df5df);
  let sdfSignOk = 0;
  const SDF_SAMPLES = 1000;
  for (let s = 0; s < SDF_SAMPLES; s++) {
    const x = -1000 + rnd2() * REGION;
    const z = -1000 + rnd2() * REGION;
    const d = bilinearSdf(sdf16, x, z);
    // nearest-texel mask (the loader's inWater semantics)
    const i = clamp(Math.round((x + 1000) / TEXEL), 0, N - 1);
    const j = clamp(Math.round((z + 1000) / TEXEL), 0, N - 1);
    const water = mask[j * N + i] === 0;
    if (d > 0 === water) sdfSignOk++;
  }
  push('sdf-sign-matches-inwater', sdfSignOk === SDF_SAMPLES, { agree: sdfSignOk, samples: SDF_SAMPLES });

  const rnd3 = mulberry32(SEED ^ 0x9dad1e);
  let gradOk = 0, gradN = 0, gradMin = Infinity, gradMax = -Infinity;
  while (gradN < 1000) {
    const x = -990 + rnd3() * (REGION - 20);
    const z = -990 + rnd3() * (REGION - 20);
    const d0 = bilinearSdf(sdf16, x, z);
    if (Math.abs(d0) > 400 || Math.abs(d0) < 3) continue; // skip clamp region + boundary kink
    const e = 2;
    const gx = (bilinearSdf(sdf16, x + e, z) - bilinearSdf(sdf16, x - e, z)) / (2 * e);
    const gz = (bilinearSdf(sdf16, x, z + e) - bilinearSdf(sdf16, x, z - e)) / (2 * e);
    const g = hyp(gx, gz);
    gradN++;
    gradMin = Math.min(gradMin, g);
    gradMax = Math.max(gradMax, g);
    if (g >= 0.85 && g <= 1.15) gradOk++;
  }
  push('sdf-gradient-magnitude', gradOk / gradN >= 0.99, {
    fracIn085to115: gradOk / gradN, min: r6(gradMin), max: r6(gradMax), samples: gradN,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const mode = process.argv.includes('--verify') ? 'verify'
  : process.argv.includes('--check') ? 'check'
  : 'write';

if (mode === 'verify') {
  console.log('Determinism verify: baking twice in memory and comparing SHA-256 per artifact...');
  const run1 = bake().artifacts;
  const run2 = bake().artifacts;
  let ok = true;
  for (const name of Object.keys(run1)) {
    const h1 = sha256(run1[name]);
    const h2 = sha256(run2[name]);
    const same = h1 === h2;
    ok &&= same;
    let diskNote = 'no file on disk';
    const p = join(OUT_DIR, name);
    if (existsSync(p)) {
      const hd = sha256(readFileSync(p));
      const dsame = hd === h1;
      ok &&= dsame;
      diskNote = dsame ? 'disk MATCH' : `disk MISMATCH (${hd.slice(0, 12)})`;
    }
    console.log(`  ${name}: run1 ${h1.slice(0, 16)} run2 ${same ? 'MATCH' : 'MISMATCH ' + h2.slice(0, 16)}; ${diskNote}`);
  }
  console.log(ok ? 'VERIFY PASS: byte-identical across runs and vs disk.' : 'VERIFY FAIL');
  process.exit(ok ? 0 : 1);
} else if (mode === 'check') {
  const b = bake();
  const checks = runChecks(b);
  const pass = checks.every((c) => c.pass);
  console.log('CHECK-REPORT ' + JSON.stringify({ pass, seed: SEED, checks }));
  for (const c of checks) console.error(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
  process.exit(pass ? 0 : 1);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  const b = bake();
  for (const [name, buf] of Object.entries(b.artifacts)) {
    writeFileSync(join(OUT_DIR, name), buf);
    console.log(`wrote ${name}: ${buf.length} bytes, sha256 ${sha256(buf).slice(0, 16)}`);
  }
  const checks = runChecks(b);
  const pass = checks.every((c) => c.pass);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
  if (!pass) {
    console.error('BAKE CHECKS FAILED — artifacts written but non-conforming');
    process.exit(1);
  }
}
