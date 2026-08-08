// Terrain shader sources (Checkpoint 05C). The surviving heightfield
// primitives from CP04B's RegionContainer.glsl and the CP05A ZyFou substrate
// classification move here as TS template literals so they can splice the
// WaterThreeJS chunks (NOISE / OCEAN_HEIGHT / CAUSTICS) — the same sharing
// pattern the demo's Island.js uses. The jeantimex-era water members
// (windowUv, windowFalloff, raymarchSeabed, surfaceHeightAt, waterPathTint,
// getWallColor*) are deleted with the region water.
//
// CP05C relight (ocean-replacement addendum §4.4, §2.4):
//  - the substrate albedo is LINEAR: the ZyFou display encode
//    (pow 1/2.2, adaptation A4) is removed — the single encode is the post
//    composite's ACES+sRGB. Mirrored in the CPU twin (substrateCpu.ts).
//  - ONE palette across the waterline: the approved Fantasy ('Cartoon
//    Terrain') roles everywhere; the CP05A "Earth underwater" palette arm,
//    the Z_COL_DEEP navy depth ramp, and the waterline palette split are
//    deleted. Underwater color comes only from the water optics.
//  - sandy seafloor: WaterThreeJS dune sand blended over the classification
//    with depth (rock faces and wetland silt retain more class identity).
//  - lighting: the demo Island/Floor laws driven by the dynamic sun
//    (uSunDir), replacing the frozen jeantimex (2,2,-1) sun, the caustics
//    render target, and RegionWallColor.glsl.

import { NOISE, OCEAN_HEIGHT, CAUSTICS } from '../ocean/shaders/common';

/* ------------------------------------------------------------------------
 * Heightfield primitives (from RegionContainer.glsl — water members removed)
 * ---------------------------------------------------------------------- */
export const HEIGHTFIELD = /* glsl */ `
  uniform sampler2D uHeightTex; // baked height.r16 → R-float meters, 2049²
  uniform sampler2D uShoreMask; // baked shore.png → R 0/1 (255 = land), 2049²
  uniform float uSeaLevel;      // 0.0 (Master §2.1)
  uniform float uRegionSize;    // 2000 m
  uniform float uHeightN;       // 2049 texels per side

  /**
   * World xz → height-texture UV, half-texel-centered: grid point i sits at
   * x = -1000 + i·(2000/2048) and texel centers at (i + 0.5)/2049 (the cp04A
   * half-texel law).
   */
  vec2 heightUv(vec2 xz) {
    return ((xz + 0.5 * uRegionSize) * ((uHeightN - 1.0) / uRegionSize) + 0.5) / uHeightN;
  }

  /** terrainHeight(x,z), meters — the single source of truth (Master §2.2). */
  float terrainHeight(vec2 xz) {
    return texture2D(uHeightTex, heightUv(xz)).r;
  }

  /** Shore mask sample: > 0.5 means land (sign-exact vs height by bake law). */
  float shoreLand(vec2 xz) {
    return texture2D(uShoreMask, heightUv(xz)).r;
  }

  /** Seabed normal by central differences, 1-texel offset (cp04B §6.1). */
  vec3 seabedNormal(vec2 xz) {
    float e = uRegionSize / (uHeightN - 1.0);
    float hx1 = terrainHeight(xz + vec2(e, 0.0));
    float hx0 = terrainHeight(xz - vec2(e, 0.0));
    float hz1 = terrainHeight(xz + vec2(0.0, e));
    float hz0 = terrainHeight(xz - vec2(0.0, e));
    return normalize(vec3(hx0 - hx1, 2.0 * e, hz0 - hz1));
  }
`;

/* ------------------------------------------------------------------------
 * ZyFou substrate classification (from RegionSubstrate.glsl), CP05C revision
 * ---------------------------------------------------------------------- */
export const SUBSTRATE = /* glsl */ `
  uniform float uAlbedoDebug;  // 1 = classification-only output (test/debug mode)
  /** climate LUT (adaptation A8): the five ZyFou climate fields baked at load
   *  by the CPU twin's identical math (substrateCpu.bakeClimateLut). */
  uniform sampler2D uClimateA; // (temp, moist, cont, erosion), 256² RGBA32F
  uniform sampler2D uClimateB; // (region, -, -, 1), 256² RGBA32F

  /* ZyFou Blank constants (Engine.js wiring at DEFAULT_PARAMS, seed 1337) */
  const vec2 Z_SEED_OFFSET = vec2(-646.3245668411255, -634.9020133018494);
  const float Z_FREQ = 0.002197265625;
  const float Z_HEIGHT_SCALE = 560.0;
  const float Z_SEA = 160.0;
  const float Z_ROCK_SLOPE_LO = 0.42;
  const float Z_ROCK_SLOPE_HI = 0.72;
  const float Z_SNOW_SLOPE_MIN = 0.30;
  const float Z_SNOW_SLOPE_MAX = 0.62;
  const float Z_BIOME_SCALE = 1.0;
  const float Z_TEMP_BIAS = 0.0;
  const float Z_MOIST_SCALE = 1.0;
  const float Z_MOIST_BIAS = 0.0;
  const float Z_PAL_SATURATION = 1.0;
  const float Z_PAL_CONTRAST = 1.0;
  const vec3 Z_PAL_TINT = vec3(1.0, 1.0, 1.0);

  /* CP05C: ONE palette across the waterline — the approved Fantasy
   * ('Cartoon Terrain') roles + frost/tundra confinement everywhere.
   * The Earth underwater arm, Z_COL_DEEP, and the palette split are gone. */
  const vec3 Z_COL_SAND     = vec3(1.00, 0.86, 0.32);
  const vec3 Z_COL_DUNE     = vec3(1.00, 0.68, 0.24);
  const vec3 Z_COL_DRYGRASS = vec3(0.78, 0.86, 0.20);
  const vec3 Z_COL_GRASS    = vec3(0.18, 0.78, 0.18);
  const vec3 Z_COL_FOREST   = vec3(0.02, 0.50, 0.16);
  const vec3 Z_COL_JUNGLE   = vec3(0.00, 0.40, 0.18);
  const vec3 Z_COL_SWAMP    = vec3(0.10, 0.44, 0.26);
  const vec3 Z_COL_TUNDRA   = vec3(0.62, 0.86, 0.82);
  const vec3 Z_COL_REDROCK  = vec3(0.90, 0.30, 0.18);
  const vec3 Z_COL_REDROCK2 = vec3(1.00, 0.48, 0.22);
  const vec3 Z_COL_ROCK     = vec3(0.44, 0.42, 0.48);
  const vec3 Z_COL_ROCKHI   = vec3(0.64, 0.62, 0.70);
  const vec3 Z_COL_SNOW     = vec3(0.98, 0.98, 0.92);
  const float Z_SNOW_LINE      = 0.82;
  const float Z_FROST_MIN_H01  = 0.86;
  const float Z_FROST_STRENGTH = 0.85;
  const float Z_SEA_FROST      = 0.0;
  const float Z_TUNDRA_H01_LO  = 0.55;
  const float Z_TUNDRA_H01_HI  = 0.75;

  /* CP05C sandy seafloor (WaterThreeJS Floor.js sand values) */
  const vec3 Z_DUNE_SAND  = vec3(0.66, 0.58, 0.44);
  const vec3 Z_DUNE_SAND2 = vec3(0.46, 0.41, 0.31);

  /* TerrainDetailMaterial defaults */
  const float ZD_QUALITY = 3.0;
  const float ZD_SCALE = 0.16;
  const float ZD_STRENGTH = 0.72;
  const float ZD_NORMAL_STRENGTH = 0.42;
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

  /* Noise primitives — fp32-exact mod-289 permutation hash (adaptation A1) */
  float zPerm(float v) {
    return mod(v * (v * 34.0 + 1.0), 289.0);
  }

  float subHash(vec2 ip, float seed) {
    float n = zPerm(mod(zPerm(mod(ip.x + seed, 289.0)) + ip.y, 289.0));
    return fract(n * 0.024390243);
  }

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

  /* Climate / biome weights / vegetation (fields from the load-time LUT) */
  struct ZClimate {
    float temp;
    float moist;
    float cont;
    float erosion;
    float region;
  };

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

  /** hRelFloor: the underwater sand blend runs on REAL meters (adaptation
   *  A2b lineage — depth in unexaggerated meters). */
  ZTerrainColorResult zComputeTerrainAlbedo(
    ZClimate cl, ZBiomeWeights bw,
    float hC, float hRel, float hRelFloor, float h01, float slope, float detail, float jitter, float microN, float duneM
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

    float snowLine01 = max(Z_SNOW_LINE * (0.40 + 1.20 * cl.temp), Z_FROST_MIN_H01);
    float flatness = smoothstep(Z_SNOW_SLOPE_MAX, Z_SNOW_SLOPE_MIN, slope);
    float snow = smoothstep(snowLine01 - 0.03, snowLine01 + 0.05, h01 + jitter * 0.04) * flatness;
    snow = max(snow, smoothstep(0.10, 0.02, tempEff) * smoothstep(0.50, 0.25, slope) * Z_SEA_FROST);
    snow *= 1.0 - bw.desert;
    snow *= Z_FROST_STRENGTH;
    albedo = mix(albedo, Z_COL_SNOW, snow);

    if (hRel < 0.0) {
      // CP05C sandy seafloor (ocean-replacement addendum §2.4): WaterThreeJS
      // dune sand blends over the classification with depth; steep rock and
      // wetland silt retain more class identity; NO depth darkening — the
      // underwater look comes only from the water optics.
      vec3 dune = mix(Z_DUNE_SAND2, Z_DUNE_SAND, smoothstep(0.30, 0.75, duneM));
      dune *= 0.90 + 0.20 * microN;
      float sandW = smoothstep(0.0, 8.0, -hRelFloor) * 0.85
                  * (1.0 - rockBlend * 0.6)
                  * (1.0 - bw.wetland * 0.45);
      albedo = mix(albedo, dune, sandW);
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

  /* Close-range detail layer — TerrainDetailMaterial.js at Blank defaults */
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
    return zDetailNoiseTri(worldPos, n, scale);
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

  /* Entry points — CP05C: LINEAR output (no display encode) */

  void zColorInputs(vec3 point, out ZClimate cl, out ZBiomeWeights bw,
                    out float jitter, out float detail, out float microN, out float duneM) {
    vec2 xz = point.xz;
    cl = zClimateAt(xz);
    bw = zBiomeWeightsAt(cl);
    jitter = (cl.region - 0.5) * 0.8 + (vnoiseQ(xz * 0.045 + Z_SEED_OFFSET, 0.0) - 0.5) * 0.6;
    float d = length(cameraPosition - point);
    float detailFade = 1.0 - smoothstep(100.0, 150.0, d);
    float microFade = 1.0 - smoothstep(40.0, 65.0, d);
    detail = detailFade > 0.001
      ? mix(0.5, vnoiseQ(xz * 0.35 + Z_SEED_OFFSET.yx, 0.0), detailFade)
      : 0.5;
    microN = microFade > 0.001
      ? mix(0.5, vnoiseQ(xz * 0.9, 0.0), microFade)
      : 0.5;
    // CP05C sandy-seafloor mottle (~17 m wavelength; fp32-exact hash so the
    // CPU twin matches — the demo Floor's hash21 fbm is not fp32-parity-safe)
    duneM = vnoiseQ(xz * 0.06 + Z_SEED_OFFSET, 0.0);
  }

  /** Classification albedo (pre-detail), LINEAR — the probe/debug surface
   *  and the base every path shares. */
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
    float duneM;
    zColorInputs(point, cl, bw, jitter, detail, microN, duneM);

    ZTerrainColorResult tc = zComputeTerrainAlbedo(cl, bw, hZ, hRel, h, h01, slope, detail, jitter, microN, duneM);
    return tc.albedo;
  }

  /** Full substrate color: classification + the ZyFou close-range detail
   *  layer, LINEAR. */
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
    float duneM;
    zColorInputs(point, cl, bw, jitter, detail, microN, duneM);

    ZTerrainColorResult tc = zComputeTerrainAlbedo(cl, bw, hZ, hRel, h, h01, slope, detail, jitter, microN, duneM);
    ZDetailResult td;
    if (zDetailFadeAt(point) > 0.001) {
      td = zApplyDetailLayer(tc, cl, bw, point, normal, hRel, h01, slope, jitter);
    } else {
      td.albedo = tc.albedo;
      td.fade = 0.0;
      td.rockMask = tc.rockBlend;
      td.shoreMask = 0.0;
    }
    return td.albedo;
  }

  /** Low-intensity detail normal (unchanged from CP05A). */
  vec3 substrateDetailNormal(vec3 normal, vec3 point) {
    float d = length(cameraPosition - point);
    float fade = zDetailFadeAt(point) * (1.0 - smoothstep(25.0, 40.0, d));
    float strength = ZD_NORMAL_STRENGTH * fade * (0.45 + 0.55 * zDetailQualityFactor());
    if (strength <= 0.0001) return normal;
    float scale = ZD_SCALE * mix(0.55, 1.25, zDetailQualityFactor());
    float e = max(0.45, 0.55 / max(scale, 0.0001));
    float c = zDetailNoise2D(point.xz, scale);
    float dx = zDetailNoise2D(point.xz + vec2(e, 0.0), scale) - c;
    float dz = zDetailNoise2D(point.xz + vec2(0.0, e), scale) - c;
    float slope = 1.0 - clamp(normal.y, 0.0, 1.0);
    float rockMask = zRockMask(slope, 0.0);
    float hRel = terrainHeight(point.xz) * 2.0;
    float shoreMask = zShoreMask(hRel);
    float matStrength = strength * (0.55 + rockMask * 1.05 + shoreMask * 0.25);
    return normalize(normal + vec3(-dx * matStrength * 5.5, 0.0, -dz * matStrength * 5.5));
  }
`;

/* ------------------------------------------------------------------------
 * Terrain chunk vertex shader (unchanged geometry law from CP05)
 * ---------------------------------------------------------------------- */
export const TERRAIN_VERT = /* glsl */ `
  varying vec3 vPosition;

  const float SKIRT_DROP = 2.0;

  ${HEIGHTFIELD}

  void main() {
    vec2 worldXZ = (modelMatrix * vec4(position.x, 0.0, position.z, 1.0)).xz;
    float h = terrainHeight(worldXZ);
    vPosition = vec3(worldXZ.x, h - SKIRT_DROP * position.y, worldXZ.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
  }
`;

/* ------------------------------------------------------------------------
 * Terrain fragment shader — CP05C linear-HDR relight: substrate albedo lit
 * by the WaterThreeJS Island/Floor laws under the dynamic sun; procedural
 * caustics on submerged fragments (vs the real Gerstner surface height, the
 * Island.js law); wet band + swash + sheen near the waterline.
 * ---------------------------------------------------------------------- */
export const TERRAIN_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uCausticColor;

  varying vec3 vPosition;

  ${NOISE}
  ${HEIGHTFIELD}
  ${OCEAN_HEIGHT}
  ${CAUSTICS}
  ${SUBSTRATE}

  void main() {
    vec3 nGeo = seabedNormal(vPosition.xz);

    if (uAlbedoDebug > 0.5) {
      gl_FragColor = vec4(substrateAlbedo(vPosition, nGeo), 1.0);
      return;
    }

    vec3 albedo = substrateColor(vPosition, nGeo);
    vec3 nLit = substrateDetailNormal(nGeo, vPosition);
    vec3 sunDir = normalize(uSunDir);
    vec2 xz = vPosition.xz;
    float y = vPosition.y;
    float ndl = clamp(dot(nLit, sunDir), 0.0, 1.0);

    // Water standing above this fragment, from the real (wavy) Gerstner
    // surface — the Island.js law. Used for lighting/caustics only.
    float submerged = oceanHeight(xz) - y;

    vec3 color;
    if (submerged > 0.0) {
      // Floor.js diffuse law (most underwater light is ambient)
      float diffuse = 0.45 + 0.55 * ndl;
      color = albedo * diffuse;

      // Two counter-scrolling caustic layers (Island.js law): fade in just
      // under the waterline, attenuate with water depth and the sun's dive
      vec2 flow = sunDir.xz * uTime * 0.4;
      float c1 = caustics(xz * 0.05 + flow, uTime * 0.6);
      float c2 = caustics(xz * 0.085 - flow * 0.7 + 15.0, uTime * 0.8);
      float caus = min(c1, c2) + 0.35 * c1 * c2;
      float edge = smoothstep(0.0, 0.5, submerged);
      color += uCausticColor * caus * exp(-submerged * 0.06) * (0.4 + 0.8 * ndl) * edge;
    } else {
      // Island.js exposed law: sky-ambient + sun diffuse, with the stable
      // wet/dry band and swash strip tied to the mean waterline
      float wetness = smoothstep(1.6, -0.2, y);
      float swash = smoothstep(1.1, 0.0, abs(y - 0.25));
      vec3 alb = albedo * mix(1.0, 0.62, wetness * 0.75);
      alb = mix(alb, alb * 0.85, swash * 0.55);
      vec3 sky = vec3(0.35, 0.5, 0.7);
      color = alb * (0.35 * sky + 1.05 * ndl);

      // slight wet sheen on the exposed ground just above the waterline
      float sheen = smoothstep(1.4, 0.0, y) * (1.0 - wetness * 0.4);
      vec3 H = normalize(sunDir + normalize(cameraPosition - vPosition));
      color += vec3(0.9) * pow(max(dot(nLit, H), 0.0), 40.0) * sheen * 0.3;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
