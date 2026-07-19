/**
 * REGION SUBSTRATE — CP05A correction: ZyFou ProceduralTerrains terrain
 * coloring ported into BodyArcade, at the user's FINAL art direction: the
 * "Fantasy world" (Cartoon Terrain) palette for the 13 terrain-albedo
 * roles over the Blank/Highlands classification structure, with frost
 * confined to the highest peaks. (History: supersedes the Track-D palette
 * of the first CP05A submission and the Earth palette of the first
 * correction; the classification/blending architecture is unchanged.)
 *
 * Source of truth (read-only pinned snapshot, commit 8b396f9c):
 *   docs/bodyarcade-stage3/references/zyfou-procedural-terrains/
 *     src/project/ProjectTemplates.js      fantasy → preset 'cartoon'
 *                                          (classification structure from
 *                                          blank → 'highlands' defaults)
 *     src/engine/presets.js                cartoon preset: palettePreset
 *                                          'cartoon', snowLine 0.82 (its
 *                                          terrain-SHAPE params NOT copied)
 *     src/engine/style/ColorPalettePresets.js  'Cartoon Terrain' — the 13
 *                                          terrain-albedo roles verbatim;
 *                                          deep/shallow/foam WATER roles
 *                                          excluded by user instruction
 *     src/engine/style/PlanetStyleConfig.js DEFAULT_PLANET_STYLE
 *     src/engine/shaders/terrainColor.glsl.js  applyPalettePost +
 *                                          computeTerrainAlbedo (ported)
 *     src/engine/biomeGLSL.js (terrain/)   climateAt / biomeWeightsAt /
 *                                          vegetationDensity (ported)
 *     src/engine/terrain/TerrainMaterial.js  jitter/detail/micro taps
 *     src/engine/terrain/TerrainDetailMaterial.js  close-range detail
 *                                          layer (ported at defaults)
 *     src/engine/Engine.js                 uniform wiring: uFrequency =
 *                                          (noiseScale·0.1)/boardSize;
 *                                          uSeedOffset = mulberry32(seed)
 *                                          ·2048−1024 (defaults below)
 *
 * ONE color function consumed identically by: directly rendered exposed
 * terrain; terrain beneath the ocean; the above-water refraction/ray-hit
 * path; and the underwater/water-below ray-hit path (all via
 * RegionWallColor.glsl getWallColor → substrateColor). Underwater terrain
 * carries the SAME ZyFou Blank substrate identity; the approved water
 * attenuation/caustics/refraction alter only how it is viewed.
 *
 * BodyArcade integration adaptations (each listed in the correction
 * report; everything else is the ZyFou math verbatim):
 *  A1 lattice hash: ZyFou's Dave-Hoskins hash12 is not fp32/f64
 *     bit-reproducible across GPU and CPU; the fp32-exact mod-289
 *     permutation hash below replaces it so the required GPU/CPU parity
 *     holds. Lattice structure, quintic fade, ROT2 octave rotation,
 *     frequencies, offsets and blend math are ZyFou's.
 *  A2 height mapping: BodyArcade heights y ∈ [−80,+200] m map affinely
 *     onto ZyFou's Blank range [0,560]: yZ = 2·y + 160; sea level y=0 →
 *     yZ = ZSEA = 160 (ZyFou's default sea 100 is a fraction-of-range
 *     difference; hRel/h01 keep ZyFou's internal relationship).
 *  A3 coordinates: 1 BodyArcade meter = 1 ZyFou world unit (their Blank
 *     board is 2048 units vs our 2000 m region — feature scale within
 *     2.4 %); uFrequency/uSeedOffset are Blank's own values.
 *  A4 display encode: ZyFou displays pow(litColor, 1/2.2); the vendored
 *     jeantimex pipeline is display-raw, so the encode is folded into the
 *     shared albedo (before BodyArcade's approved lighting laws) — the
 *     palette reads at Blank's intended visible values.
 *  A5 lighting/AO/fog stay BodyArcade's approved region laws (vendored
 *     sun + hemisphere, protected submerged caustic math, jeantimex
 *     optics); ZyFou terrainLighting/cavity-AO/exp2 fog are not ported.
 *  A6 paint/spline/erosion/import/biome-paint editor inputs: absent —
 *     biome weights are the pure climate-noise path.
 *  A7 surface-texture system: no-op at Blank defaults (uSurfMode 0) —
 *     matched by omission.
 *
 * SUBSTRATE ONLY: the ZyFou families are ground/climate colorations
 * (sand, grass, forest-floor tones, rock, snow, underwater floor) — no
 * kelp/coral/vegetation/ruins/wrecks/wildlife assets are painted into the
 * terrain (vegetation-density affects soil COLOR only, as in ZyFou).
 */

uniform float uAlbedoDebug;  // 1 = classification-only output (test/debug mode)
/** climate LUT (adaptation A8): the five ZyFou climate fields baked at load
 *  by the CPU twin's identical math (substrateCpu.bakeClimateLut) — their
 *  wavelengths (143 m – 10 km) are far above the 7.8 m LUT texel, so the
 *  bilinear read reproduces the analytic fields to ~1e-4 while removing
 *  ~1,500 ALU of per-fragment/per-ray noise (the measured 21 ms collapse). */
uniform sampler2D uClimateA; // (temp, moist, cont, erosion), 256² RGBA32F
uniform sampler2D uClimateB; // (region, -, -, 1), 256² RGBA32F

/* ------------------------------------------------------------------------
 * ZyFou Blank constants (Engine.js wiring at DEFAULT_PARAMS, seed 1337)
 * ---------------------------------------------------------------------- */

/** uSeedOffset = mulberry32(1337): (rng()·2048−1024, rng()·2048−1024) */
const vec2 Z_SEED_OFFSET = vec2(-646.3245668411255, -634.9020133018494);
/** uFrequency = (noiseScale 45 · 0.1) / boardSize 2048 */
const float Z_FREQ = 0.002197265625;
/** heightScale 560; BodyArcade [−80,+200] → [0,560]: yZ = 2·y + 160 */
const float Z_HEIGHT_SCALE = 560.0;
const float Z_SEA = 160.0;
/** snowLine: the Fantasy/Cartoon preset value (presets.js cartoon params);
 *  slope gates rock 0.42/0.72, snow 0.30/0.62 (defaults — the cartoon
 *  preset does not override the slope gates) */
const float Z_SNOW_LINE = 0.82;
/** Frost restriction (final art-direction correction): frost is a slight
 *  accent confined to the very highest peaks — the snow line never drops
 *  below this h01 floor (≈ y 161 m real; summit 200 m), the sea-level
 *  cold-climate frost term is removed, and the blend is restrained.
 *  [User-directed adaptation of the snow threshold/height normalization.] */
const float Z_FROST_MIN_H01 = 0.86;
const float Z_FROST_STRENGTH = 0.85;
/** Tundra confinement (same correction: "tundra does not cover large
 *  regions") — the pale tundra coloration only participates at altitude;
 *  cold LOWLAND climate cells keep the green mid-band. */
const float Z_TUNDRA_H01_LO = 0.55;
const float Z_TUNDRA_H01_HI = 0.75;
const float Z_ROCK_SLOPE_LO = 0.42;
const float Z_ROCK_SLOPE_HI = 0.72;
const float Z_SNOW_SLOPE_MIN = 0.30;
const float Z_SNOW_SLOPE_MAX = 0.62;
/** climate defaults: biomeScale 1, tempBias 0, moistScale 1, moistBias 0 */
const float Z_BIOME_SCALE = 1.0;
const float Z_TEMP_BIAS = 0.0;
const float Z_MOIST_SCALE = 1.0;
const float Z_MOIST_BIAS = 0.0;
/** DEFAULT_PLANET_STYLE: saturation 1, contrast 1, tint (1,1,1) */
const float Z_PAL_SATURATION = 1.0;
const float Z_PAL_CONTRAST = 1.0;
const vec3 Z_PAL_TINT = vec3(1.0, 1.0, 1.0);

/* FANTASY-WORLD PALETTE (final user art-direction correction): the 13
 * terrain-albedo roles of ZyFou's "Cartoon Terrain" palette
 * (ColorPalettePresets.js `cartoon`, selected by the `fantasy` project
 * template → `cartoon` preset), verbatim linear RGB. The Cartoon
 * `deep`/`shallow`/`foam` slots are WATER roles and are excluded by
 * explicit instruction — BodyArcade's approved water colors are untouched;
 * Z_COL_DEEP below keeps its Earth value because in this shader it serves
 * ONLY as the approved deep-SEAFLOOR substrate ramp target (the reviewed
 * and approved seafloor presentation), never a water color. */
const vec3 Z_COL_DEEP      = vec3(0.012, 0.075, 0.140); // Earth deep — approved deep-floor substrate target (NOT the Cartoon water deep)
const vec3 Z_COL_SHALLOW   = vec3(0.060, 0.290, 0.330); // Earth shallow — unused by terrain albedo (water role; retained inert)
const vec3 Z_COL_SAND      = vec3(1.00, 0.86, 0.32);
const vec3 Z_COL_DUNE      = vec3(1.00, 0.68, 0.24);
const vec3 Z_COL_DRYGRASS  = vec3(0.78, 0.86, 0.20);
const vec3 Z_COL_GRASS     = vec3(0.18, 0.78, 0.18);
const vec3 Z_COL_FOREST    = vec3(0.02, 0.50, 0.16);
const vec3 Z_COL_JUNGLE    = vec3(0.00, 0.40, 0.18);
const vec3 Z_COL_SWAMP     = vec3(0.10, 0.44, 0.26);
const vec3 Z_COL_TUNDRA    = vec3(0.62, 0.86, 0.82);
const vec3 Z_COL_REDROCK   = vec3(0.90, 0.30, 0.18);
const vec3 Z_COL_REDROCK2  = vec3(1.00, 0.48, 0.22);
const vec3 Z_COL_ROCK      = vec3(0.44, 0.42, 0.48);
const vec3 Z_COL_ROCKHI    = vec3(0.64, 0.62, 0.70);
const vec3 Z_COL_SNOW      = vec3(0.98, 0.98, 0.92);
/* foam slot unused by terrain albedo (water role; not adopted) */

/* TerrainDetailMaterial defaults (Engine._applyTerrainDetailPerf +
 * VISUAL_DEFAULT_PARAMS) */
const float ZD_QUALITY = 3.0;
const float ZD_SCALE = 0.16;
const float ZD_STRENGTH = 0.72;
const float ZD_NORMAL_STRENGTH = 0.42;
/** near/far are ZyFou PERF settings (Engine `this.perf`, device-adaptive
 *  by design; their defaults 80/190). Reduced here to hold BodyArcade's
 *  ≥ 58 fps floor next to the water pipeline and 120 Hz sim — a listed
 *  perf adaptation, not a palette change (underwater visibility is
 *  fog-bounded well inside this range regardless). */
const float ZD_NEAR = 30.0;
const float ZD_FAR = 80.0;
const float ZD_ROCK_SLOPE = 0.28;
const float ZD_ROCK_SHARPNESS = 0.14;
const float ZD_TRIPLANAR = 1.0;
const float ZD_SHORE_RANGE = 18.0;
const float ZD_SHORE_WETNESS = 0.35;
const float ZD_OPACITY = 1.0;
const float ZD_MICRO = 0.6;
const float ZD_MACRO = 0.5;
const float ZV_COLOR_VARIATION = 0.36;
const float ZV_HEIGHT_DETAIL = 0.42;
const float ZV_WET_SHORE = 0.55;
const float ZV_ROCK_DETAIL = 0.45;
const float ZV_SOIL_DETAIL = 0.35;
const float ZV_SAND_DETAIL = 0.38;
const float ZV_WET_SAND_RANGE = 18.0;

/* ------------------------------------------------------------------------
 * Noise primitives — ZyFou structure (quintic fade, ROT2 per-octave
 * rotation, fbm3 weights .55/.30/.15 at lacunarity 2.13) over the
 * fp32-exact mod-289 permutation lattice hash (adaptation A1)
 * ---------------------------------------------------------------------- */

/** permutation polynomial (Gustavson): exact in fp32 for v ∈ [0, 289) */
float zPerm(float v) {
  return mod(v * (v * 34.0 + 1.0), 289.0);
}

/** 2-D lattice hash via NESTED permutation — perm(perm(x) + y) — so the
 *  hash is not a function of any 1-D linear projection of the lattice
 *  (the CP05A-correction fix for the large axis-aligned climate patches
 *  the earlier x + 57·y form produced). All intermediates < 2^23: exact
 *  in fp32, bit-reproducible by the CPU twin. */
float subHash(vec2 ip, float seed) {
  float n = zPerm(mod(zPerm(mod(ip.x + seed, 289.0)) + ip.y, 289.0));
  return fract(n * 0.024390243);
}

/** quintic value noise (ZyFou vnoise fade: f³(f(6f−15)+10)) */
float vnoiseQ(vec2 p, float seed) {
  vec2 ip = floor(p);
  vec2 f = p - ip;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = subHash(ip, seed);
  float b = subHash(ip + vec2(1.0, 0.0), seed);
  float c = subHash(ip + vec2(0.0, 1.0), seed);
  float d = subHash(ip + vec2(1.0, 1.0), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 Z_ROT2 = mat2(0.80, -0.60, 0.60, 0.80);

/* ------------------------------------------------------------------------
 * Climate / biome weights / vegetation — biomeGLSL.js law; the five
 * climate FIELDS come from the load-time LUT (adaptation A8 — identical
 * math, baked by substrateCpu.bakeClimateLut with the same fp32-exact
 * hash); weights/vegetation stay verbatim per-fragment.
 * ---------------------------------------------------------------------- */

struct ZClimate {
  float temp;
  float moist;
  float cont;
  float erosion;
  float region;
};

/** climate at WORLD xz via the baked LUT (256² over the region, half-texel
 *  centered like the other region rasters) */
ZClimate zClimateAt(vec2 xz) {
  float n = 256.0;
  vec2 uv = ((xz + 0.5 * uRegionSize) * ((n - 1.0) / uRegionSize) + 0.5) / n;
  vec4 a = texture2D(uClimateA, uv);
  vec4 b = texture2D(uClimateB, uv);
  ZClimate c;
  c.temp = a.r;
  c.moist = a.g;
  c.cont = a.b;
  c.erosion = a.a;
  c.region = b.r;
  return c;
}

struct ZBiomeWeights {
  float desert;
  float canyon;
  float wetland;
  float mountains;
};

ZBiomeWeights zBiomeWeightsAt(ZClimate c) {
  float j = (c.region - 0.5) * 0.16;
  float hot    = smoothstep(0.52, 0.74, c.temp + j);
  float dry    = smoothstep(0.55, 0.30, c.moist - j);
  float wet    = smoothstep(0.55, 0.78, c.moist + j);
  float lowC   = smoothstep(0.55, 0.32, c.cont);
  float eroded = smoothstep(0.40, 0.70, c.erosion + j * 0.5);

  ZBiomeWeights w;
  w.desert    = hot * dry * (1.0 - eroded * 0.55);
  w.canyon    = dry * eroded * smoothstep(0.30, 0.55, c.cont);
  w.wetland   = wet * lowC * (1.0 - hot * 0.4);
  w.mountains = smoothstep(0.38, 0.62, c.cont) * (1.0 - eroded * 0.7);
  return w;
}

float zVegetationDensity(ZClimate c, float h01, float slope) {
  float tempEff = c.temp - h01 * 0.55;
  float warmEnough = smoothstep(0.18, 0.34, tempEff) * smoothstep(0.92, 0.70, tempEff);
  float wetEnough  = smoothstep(0.34, 0.62, c.moist);
  float flatGround = smoothstep(0.55, 0.25, slope);
  return warmEnough * wetEnough * flatGround;
}

/* ------------------------------------------------------------------------
 * applyPalettePost + computeTerrainAlbedo — terrainColor.glsl.js verbatim
 * (palette uniforms → the Blank constants above)
 * ---------------------------------------------------------------------- */

vec3 zApplyPalettePost(vec3 col) {
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, Z_PAL_SATURATION);
  col = (col - 0.5) * Z_PAL_CONTRAST + 0.5;
  col *= Z_PAL_TINT;
  return max(col, vec3(0.0));
}

struct ZTerrainColorResult {
  vec3 albedo;
  float snow;
  float sandBand;
  float flatness;
  float rockBlend;
};

/** hRelFloor: the underwater floor ramp runs on REAL meters (adaptation
 *  A2b — with the ×2 vertical band mapping the Blank sand→deep ramp would
 *  saturate by 27.5 real meters and erase mid-depth substrate, the exact
 *  uniform-teal collapse the CP05A visual review flagged; ZyFou's −hRel/55
 *  law is kept, fed with unexaggerated depth). */
ZTerrainColorResult zComputeTerrainAlbedo(
  ZClimate cl, ZBiomeWeights bw,
  float hC, float hRel, float hRelFloor, float h01, float slope, float detail, float jitter, float microN
) {
  ZTerrainColorResult res;
  float tempEff = clamp(cl.temp - h01 * 0.55, 0.0, 1.0);
  float veg = zVegetationDensity(cl, h01, slope);
  float jt = jitter * 0.06;

  vec3 hotBand = mix(Z_COL_DUNE,
    mix(Z_COL_DRYGRASS, Z_COL_JUNGLE, smoothstep(0.45, 0.75, cl.moist)),
    smoothstep(0.20, 0.50, cl.moist));
  vec3 midBand = mix(Z_COL_DRYGRASS,
    mix(Z_COL_GRASS, Z_COL_FOREST, veg * (0.5 + 0.5 * smoothstep(0.35, 0.65, detail))),
    smoothstep(0.22, 0.52, cl.moist));
  vec3 coldBand = mix(Z_COL_TUNDRA, mix(Z_COL_TUNDRA, Z_COL_FOREST * 0.85, veg),
    smoothstep(0.30, 0.60, cl.moist));
  // tundra confinement (art-direction correction): pale tundra only at
  // altitude; cold low-elevation cells stay green
  coldBand = mix(midBand, coldBand, smoothstep(Z_TUNDRA_H01_LO, Z_TUNDRA_H01_HI, h01));

  vec3 lowland = mix(coldBand, midBand, smoothstep(0.20, 0.38, tempEff + jt));
  lowland = mix(lowland, hotBand, smoothstep(0.55, 0.72, tempEff + jt));
  lowland = mix(lowland, Z_COL_SWAMP, bw.wetland * 0.8);

  float sandBand = (mix(3.0, 9.0, smoothstep(0.30, 0.70, tempEff)) + jitter * 4.0)
                 * (1.0 - bw.wetland * 0.85);
  vec3 albedo = mix(Z_COL_SAND, lowland, smoothstep(sandBand * 0.4, max(sandBand, 0.3), hRel));

  float band = fract(h01 * 14.0 + detail * 0.15);
  vec3 canyonCol = mix(Z_COL_REDROCK, Z_COL_REDROCK2, smoothstep(0.25, 0.75, band));
  albedo = mix(albedo, canyonCol, bw.canyon * smoothstep(1.0, 6.0, hRel));

  float highBlend = smoothstep(0.30, 0.62, h01 + jitter * 0.08);
  albedo = mix(albedo, Z_COL_ROCKHI, highBlend * 0.65 * (1.0 - bw.desert * 0.7));

  float rockBlend = smoothstep(Z_ROCK_SLOPE_LO, Z_ROCK_SLOPE_HI, slope + jitter * 0.06);
  vec3 slopeRock = mix(mix(Z_COL_ROCK, Z_COL_ROCKHI, detail), Z_COL_REDROCK, bw.canyon * 0.8);
  albedo = mix(albedo, slopeRock, rockBlend);

  // frost restriction (art-direction correction): the ZyFou snow law with
  // (a) a snow-line FLOOR so frost never leaves the highest-peak band,
  // (b) the sea-level cold-climate frost term REMOVED (it painted winter
  // lowlands), (c) restrained blend strength — a high-peak accent only
  float snowLine01 = max(Z_SNOW_LINE * (0.40 + 1.20 * cl.temp), Z_FROST_MIN_H01);
  float flatness = smoothstep(Z_SNOW_SLOPE_MAX, Z_SNOW_SLOPE_MIN, slope);
  float snow = smoothstep(snowLine01 - 0.03, snowLine01 + 0.05, h01 + jitter * 0.04) * flatness;
  snow *= 1.0 - bw.desert;
  snow *= Z_FROST_STRENGTH;
  albedo = mix(albedo, Z_COL_SNOW, snow);

  if (hRel < 0.0) {
    float depth = clamp(-hRelFloor / 55.0, 0.0, 1.0);
    vec3 floorCol = mix(mix(Z_COL_SAND, Z_COL_SWAMP, bw.wetland * 0.7) * 0.65, Z_COL_DEEP, depth);
    albedo = mix(albedo, floorCol, 0.92);
  }

  float micro = mix(0.20, 0.06, max(bw.desert * (1.0 - rockBlend), bw.wetland * 0.8));
  micro = mix(micro, 0.30, max(rockBlend * 0.6, bw.canyon * 0.4));
  albedo *= (1.0 - micro * 0.5) + micro * microN;

  res.albedo = zApplyPalettePost(albedo);
  res.snow = snow;
  res.sandBand = sandBand;
  res.flatness = flatness;
  res.rockBlend = rockBlend;
  return res;
}

/* ------------------------------------------------------------------------
 * Close-range detail layer — TerrainDetailMaterial.js, ported at Blank
 * defaults (quality 3, triplanar on, fade 80→190 m). All ZyFou math; the
 * only omissions are the desert wind-ripple / canyon-band terms' UNUSED
 * inputs (they evaluate exactly as sourced).
 * ---------------------------------------------------------------------- */

float zDetailFadeAt(vec3 worldPos) {
  float d = length(cameraPosition - worldPos);
  float fade = 1.0 - smoothstep(ZD_NEAR, ZD_FAR, d);
  return fade * clamp(ZD_OPACITY, 0.0, 1.0);
}

float zDetailQualityFactor() {
  return clamp(ZD_QUALITY / 3.0, 0.0, 1.0);
}

vec3 zTriBlend(vec3 n) {
  vec3 b = pow(abs(n), vec3(4.0));
  return b / max(b.x + b.y + b.z, 1e-4);
}

float zTriNoise(vec3 p, vec3 blend) {
  // degenerate-weight fast path: ZyFou's pow-4 blend puts ≥ 97 % of the
  // weight on the y-plane for slopes ≲ 4° — the full sum reduces to the
  // single y-plane tap within ±0.03 (same formula, warp-coherent branch;
  // the cp05A-correction fix for the 19 ms always-on triplanar cost)
  if (blend.y > 0.97) return vnoiseQ(p.zx, 0.0);
  return vnoiseQ(p.yz, 0.0) * blend.x + vnoiseQ(p.zx, 0.0) * blend.y + vnoiseQ(p.xy, 0.0) * blend.z;
}

float zDetailNoise2D(vec2 xz, float scale) {
  vec2 p = xz * max(scale, 0.0001) + Z_SEED_OFFSET * 0.37;
  float a = vnoiseQ(p, 0.0);
  float b = vnoiseQ(Z_ROT2 * p * 2.73 + vec2(19.7, 41.1), 0.0);
  float c = vnoiseQ(Z_ROT2 * p * 6.10 + vec2(83.2, 11.4), 0.0);
  return clamp(a * 0.50 + b * 0.32 + c * 0.18, 0.0, 1.0);
}

float zDetailNoiseTri(vec3 worldPos, vec3 n, float scale) {
  vec3 p = worldPos * max(scale, 0.0001) + vec3(Z_SEED_OFFSET, Z_SEED_OFFSET.x - Z_SEED_OFFSET.y) * 0.37;
  vec3 b = zTriBlend(n);
  float a = zTriNoise(p, b);
  float q = zTriNoise(vec3(Z_ROT2 * p.xy, p.z) * 2.73 + vec3(19.7, 41.1, 7.3), b);
  float r = zTriNoise(vec3(Z_ROT2 * p.xz, p.y).xzy * 6.10 + vec3(83.2, 11.4, 31.9), b);
  return clamp(a * 0.50 + q * 0.32 + r * 0.18, 0.0, 1.0);
}

float zDetailNoise(vec3 worldPos, vec3 n, float scale) {
  // ZD_TRIPLANAR is Blank's constant 1.0 → mix(planar, tri, 1.0) ≡ tri;
  // the planar arm is elided outright so no compiler is trusted to DCE it
  // (perf adaptation, exact same value as the sourced expression)
  return zDetailNoiseTri(worldPos, n, scale);
}

float zDetailRelief(vec3 worldPos, vec3 n, float scale) {
  float fine = zDetailNoise(worldPos, n, scale);
  float micro = clamp(ZD_MICRO, 0.0, 1.0);
  float heightDetail = clamp(ZV_HEIGHT_DETAIL, 0.0, 1.0);
  float coarse = zDetailNoise(worldPos + vec3(53.0, 17.0, 29.0), n, scale * 0.42);
  float hi = zDetailNoise(worldPos + vec3(11.3, 5.7, 23.9), n, scale * 3.0);
  return fine
    + (hi - 0.5) * micro * 0.55
    + (coarse - 0.5) * heightDetail * 0.42;
}

float zRockMask(float slope, float jitter) {
  float width = max(0.04, ZD_ROCK_SHARPNESS);
  return smoothstep(ZD_ROCK_SLOPE - width, ZD_ROCK_SLOPE + width, slope + jitter * 0.06);
}

float zShoreMask(float hRel) {
  float shoreRange = max(ZD_SHORE_RANGE + ZV_WET_SAND_RANGE * 0.35, 0.01);
  return 1.0 - smoothstep(0.0, shoreRange, abs(hRel));
}

struct ZDetailResult {
  vec3 albedo;
  float fade;
  float rockMask;
  float shoreMask;
};

ZDetailResult zApplyDetailLayer(
  ZTerrainColorResult tc, ZClimate cl, ZBiomeWeights bw,
  vec3 worldPos, vec3 normalGeo, float hRel, float h01, float slope, float jitter
) {
  ZDetailResult outD;
  float fade = zDetailFadeAt(worldPos);
  float quality = zDetailQualityFactor();
  float scale = ZD_SCALE * mix(0.55, 1.25, quality);

  float fine = zDetailNoise(worldPos, normalGeo, scale);
  float coarse = zDetailNoise(worldPos + vec3(53.0, 17.0, 29.0), normalGeo, scale * 0.33);
  // micro-band LOD (perf adaptation): the ~0.6 m micro speckle is sub-pixel
  // beyond ~35 m at this resolution — beyond it the taps only alias, so the
  // band fades out over 20→35 m (smooth; its uses scale by microFade)
  float microFade = 1.0 - smoothstep(20.0, 35.0, length(cameraPosition - worldPos));
  float microB = microFade > 0.001
    ? zDetailNoise(worldPos + vec3(11.3, 5.7, 23.9), normalGeo, scale * 3.0)
    : 0.5;
  float macroB = zDetailNoise(worldPos + vec3(127.0, 0.0, 211.0), normalGeo, scale * 0.085);
  float micro = clamp(ZD_MICRO, 0.0, 1.0);
  float macroAmt = clamp(ZD_MACRO + ZV_COLOR_VARIATION * 0.45, 0.0, 1.35);

  float grain = clamp(fine * 0.60 + coarse * 0.26 + microB * (0.14 + 0.10 * micro), 0.0, 1.0);
  float signedGrain = grain * 2.0 - 1.0;
  float microSigned = (microB * 2.0 - 1.0) * microFade;
  float macroSigned = macroB * 2.0 - 1.0;

  float rockMask = max(tc.rockBlend, zRockMask(slope, jitter));
  float shoreMask = zShoreMask(hRel);
  float desertGround = clamp(max(bw.desert, tc.sandBand > 0.0 ? 1.0 - smoothstep(tc.sandBand * 0.4, tc.sandBand, hRel) : 0.0), 0.0, 1.0);
  float wetGround = clamp(max(bw.wetland, shoreMask * 0.65), 0.0, 1.0);
  float vegGround = clamp((1.0 - desertGround) * (1.0 - bw.canyon) * (1.0 - tc.snow) * tc.flatness * smoothstep(0.20, 0.72, cl.moist), 0.0, 1.0);

  vec2 windDir = normalize(vec2(0.86, 0.51));
  float ripplePhase = dot(worldPos.xz, windDir) * scale * 7.5 + coarse * 6.5 + macroB * 3.0;
  float ripple = sin(ripplePhase) * 0.5 + 0.5;
  ripple *= ripple;
  float dunes = (ripple - 0.5) * desertGround * (1.0 - rockMask);

  float strata = 0.5 + 0.5 * sin(h01 * 120.0 + coarse * 4.0 + macroSigned * 2.0);
  float canyonBands = 0.5 + 0.5 * sin(h01 * 210.0 + coarse * 5.0);

  float weather = macroSigned * macroAmt;

  float sandDetail = 1.0 + clamp(ZV_SAND_DETAIL, 0.0, 1.0) * 0.45;
  float soilDetail = 1.0 + clamp(ZV_SOIL_DETAIL, 0.0, 1.0) * 0.40;
  float rockDetail = 1.0 + clamp(ZV_ROCK_DETAIL, 0.0, 1.0) * 0.55;

  vec3 sandTint = mix(Z_COL_SAND * 0.78, Z_COL_DUNE * 1.12, clamp((grain - 0.5) * sandDetail + 0.5, 0.0, 1.0));
  sandTint *= 1.0 + dunes * 0.22;
  vec3 grassTint = mix(Z_COL_DRYGRASS * 0.82, Z_COL_FOREST * 0.92, clamp((grain - 0.5) * soilDetail + 0.5, 0.0, 1.0)) * mix(0.96, 1.08, coarse);
  grassTint = mix(grassTint, mix(Z_COL_DRYGRASS, Z_COL_GRASS, grain),
    smoothstep(0.40, 0.70, macroB) * 0.35);
  vec3 mudTint = mix(Z_COL_SWAMP * 0.62, Z_COL_SAND * 0.55, clamp((grain - 0.5) * soilDetail + 0.5, 0.0, 1.0));
  vec3 rockTint = mix(Z_COL_ROCK * 0.68, Z_COL_ROCKHI * 1.10, clamp((grain - 0.5) * rockDetail + 0.5, 0.0, 1.0));
  rockTint = mix(rockTint, rockTint * mix(0.82, 1.12, strata), 0.55);
  vec3 canyonTint = mix(Z_COL_REDROCK * 0.70, Z_COL_REDROCK2 * 1.12, canyonBands);
  vec3 snowTint = mix(Z_COL_SNOW * 0.84, vec3(0.90, 0.97, 1.0), grain);

  vec3 materialTint = mix(tc.albedo, grassTint, vegGround * 0.42);
  materialTint = mix(materialTint, sandTint, desertGround * (1.0 - rockMask) * 0.52);
  materialTint = mix(materialTint, mudTint, wetGround * (1.0 - rockMask) * 0.38);
  materialTint = mix(materialTint, mix(rockTint, canyonTint, bw.canyon), rockMask * 0.66);
  materialTint = mix(materialTint, snowTint, tc.snow * 0.42);

  materialTint *= 1.0 + weather * (0.16 + 0.10 * rockMask);
  materialTint *= vec3(1.0 + weather * 0.05, 1.0, 1.0 - weather * 0.04);

  float crack = smoothstep(0.16, 0.0, abs(microSigned)) * rockMask;
  float fleck = (vnoiseQ(worldPos.xz * scale * 3.8 + Z_SEED_OFFSET.yx, 0.0) - 0.5) * 2.0;
  vec3 detailed = materialTint;
  detailed *= 1.0 + signedGrain * (0.055 + 0.085 * rockMask + 0.030 * vegGround);
  detailed *= 1.0 + microSigned * micro * (0.05 + 0.06 * rockMask);
  detailed *= 1.0 - crack * 0.22;
  detailed += fleck * 0.028 * (desertGround + vegGround * 0.5) * (1.0 - rockMask);
  float wetShore = clamp(ZD_SHORE_WETNESS + ZV_WET_SHORE * 0.55, 0.0, 1.4);
  detailed = mix(detailed, detailed * mix(0.68, 0.92, grain), shoreMask * wetShore);

  float strength = clamp(ZD_STRENGTH, 0.0, 2.0) * fade;
  outD.albedo = mix(tc.albedo, max(detailed, vec3(0.0)), strength);
  outD.fade = fade;
  outD.rockMask = rockMask;
  outD.shoreMask = shoreMask;
  return outD;
}

/* ------------------------------------------------------------------------
 * Entry points (RegionWallColor / RegionTerrain contract preserved)
 * ---------------------------------------------------------------------- */

/** ZyFou display encode folded into the shared albedo (adaptation A4). */
vec3 zDisplayEncode(vec3 col) {
  return pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
}

/** the ZyFou fragment-main input taps (TerrainMaterial.js), on world xz */
void zColorInputs(vec3 point, out ZClimate cl, out ZBiomeWeights bw,
                  out float jitter, out float detail, out float microN) {
  vec2 xz = point.xz;
  cl = zClimateAt(xz); // LUT read (world coords; adaptation A8)
  bw = zBiomeWeightsAt(cl);
  jitter = (cl.region - 0.5) * 0.8 + (vnoiseQ(xz * 0.045 + Z_SEED_OFFSET, 0.0) - 0.5) * 0.6;
  // mip-style staging (perf adaptation): the 2.9 m detail and 1.1 m micro
  // taps are sub-pixel at distance — they fade to their 0.5 mean exactly as
  // texture mip filtering would (smooth, alias-reducing)
  float d = length(cameraPosition - point);
  float detailFade = 1.0 - smoothstep(100.0, 150.0, d);
  float microFade = 1.0 - smoothstep(40.0, 65.0, d);
  detail = detailFade > 0.001
    ? mix(0.5, vnoiseQ(xz * 0.35 + Z_SEED_OFFSET.yx, 0.0), detailFade)
    : 0.5;
  microN = microFade > 0.001
    ? mix(0.5, vnoiseQ(xz * 0.9, 0.0), microFade)
    : 0.5;
}

/** Classification albedo (pre-detail) — the probe/debug surface and the
 *  base every path shares. */
vec3 substrateAlbedo(vec3 point, vec3 normal) {
  vec2 xz = point.xz;
  float h = terrainHeight(xz);
  float hZ = h * 2.0 + Z_SEA;             // adaptation A2
  float hRel = hZ - Z_SEA;                // = 2·h
  float h01 = hZ / Z_HEIGHT_SCALE;
  float slope = 1.0 - clamp(normal.y, 0.0, 1.0);

  ZClimate cl;
  ZBiomeWeights bw;
  float jitter;
  float detail;
  float microN;
  zColorInputs(point, cl, bw, jitter, detail, microN);

  ZTerrainColorResult tc = zComputeTerrainAlbedo(cl, bw, hZ, hRel, h, h01, slope, detail, jitter, microN);
  return zDisplayEncode(tc.albedo);
}

/** Full substrate color: classification + the ZyFou close-range detail
 *  layer (fade 80→190 m), shared by every consuming path. */
vec3 substrateColor(vec3 point, vec3 normal) {
  vec2 xz = point.xz;
  float h = terrainHeight(xz);
  float hZ = h * 2.0 + Z_SEA;
  float hRel = hZ - Z_SEA;
  float h01 = hZ / Z_HEIGHT_SCALE;
  float slope = 1.0 - clamp(normal.y, 0.0, 1.0);

  ZClimate cl;
  ZBiomeWeights bw;
  float jitter;
  float detail;
  float microN;
  zColorInputs(point, cl, bw, jitter, detail, microN);

  ZTerrainColorResult tc = zComputeTerrainAlbedo(cl, bw, hZ, hRel, h, h01, slope, detail, jitter, microN);
  ZDetailResult td;
  if (zDetailFadeAt(point) > 0.001) {
    td = zApplyDetailLayer(tc, cl, bw, point, normal, hRel, h01, slope, jitter);
  } else {
    td.albedo = tc.albedo;
    td.fade = 0.0;
    td.rockMask = tc.rockBlend;
    td.shoreMask = 0.0;
  }
  return zDisplayEncode(td.albedo);
}

/**
 * Low-intensity detail normal (ZyFou applyTerrainDetailNormal2D at Blank
 * defaults: strength 0.42, quality 3) — feeds BodyArcade's approved
 * lighting law (adaptation A5); fades with the same 80→190 m law.
 */
vec3 substrateDetailNormal(vec3 normal, vec3 point) {
  // normal-wobble LOD (perf adaptation): the low-intensity detail normal is
  // invisible beyond a few tens of meters — its own fade closes by 40 m
  float d = length(cameraPosition - point);
  float fade = zDetailFadeAt(point) * (1.0 - smoothstep(25.0, 40.0, d));
  float strength = ZD_NORMAL_STRENGTH * fade * (0.45 + 0.55 * zDetailQualityFactor());
  if (strength <= 0.0001) return normal;
  float scale = ZD_SCALE * mix(0.55, 1.25, zDetailQualityFactor());
  float e = max(0.45, 0.55 / max(scale, 0.0001));
  // perf adaptation (listed): the relief for the NORMAL pass samples the
  // primary fine band in planar XZ (3 taps/sample) instead of ZyFou's full
  // triplanar 3-band relief (27 taps/sample) — the albedo detail keeps
  // ZyFou's full math; only the low-intensity normal wobble is thinned.
  float c = zDetailNoise2D(point.xz, scale);
  float dx = zDetailNoise2D(point.xz + vec2(e, 0.0), scale) - c;
  float dz = zDetailNoise2D(point.xz + vec2(0.0, e), scale) - c;
  // ZyFou material weighting: rock strengthens, shore adds a little
  float slope = 1.0 - clamp(normal.y, 0.0, 1.0);
  float rockMask = zRockMask(slope, 0.0);
  float hRel = terrainHeight(point.xz) * 2.0;
  float shoreMask = zShoreMask(hRel);
  float matStrength = strength * (0.55 + rockMask * 1.05 + shoreMask * 0.25);
  return normalize(normal + vec3(-dx * matStrength * 5.5, 0.0, -dz * matStrength * 5.5));
}
