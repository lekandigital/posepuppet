/**
 * REGION SUBSTRATE — Checkpoint 05A shared substrate classification and
 * color system (post-CP05 addendum §4.7–§4.10; supersedes the R14/cp05
 * two-tint law of RegionTerrainTint.glsl, which this file replaces).
 *
 * ONE classification/color function consumed identically by:
 *   - the directly rendered terrain (RegionTerrain.frag);
 *   - terrain hit by the above-water and underwater water raymarches
 *     (RegionWaterAbove/Below.frag via RegionWallColor.glsl getWallColor);
 *   - reflected/refracted terrain paths (the same raymarch tracer);
 *   - the debug/baked classification outputs (albedo-debug mode + the CPU
 *     twin `src/world/substrateCpu.ts`, which mirrors this math for the
 *     region preview and the probe tests).
 *
 * Architecture adapted from ZyFou/ProceduralTerrains (MIT, pinned snapshot
 * docs/bodyarcade-stage3/references/zyfou-procedural-terrains/, commit
 * 8b396f9c): one shared color function across terrain/water/export paths
 * (terrainColor.glsl.js), slope/height/depth/noise-driven albedo with
 * smooth overlapping family weights (computeTerrainAlbedo), and the
 * close-range world-space/triplanar detail principle
 * (TerrainDetailMaterial.js) — combined with Simon-style restrained
 * blending (addendum §11.2) and the existing RegionWallColor shared-shader
 * discipline. App-owned code; the snapshot is never imported.
 *
 * SUBSTRATE ONLY (addendum §2.4): every family below is ordinary ground —
 * sand, sediment, soil, stone, cliff rock, reef limestone, silt, trench
 * rock, cave-mouth rock. No family imitates, substitutes for, or encodes
 * the presence of kelp, coral, grass, trees, rocks-as-assets, ruins,
 * wrecks, fish, wildlife, or structures.
 *
 * Include AFTER RegionContainer.glsl (uses terrainHeight/heightUv/
 * seabedNormal/uSeaLevel/uRegionSize/uHeightN) and BEFORE
 * RegionWallColor.glsl.
 *
 * Determinism: the noise lattice hash is a permutation polynomial
 * (mod-289, Gustavson-style) whose intermediates stay < 2^23 — exact in
 * fp32 — so the fround-emulating CPU twin reproduces it bit-for-bit;
 * classification thresholds are smoothsteps of artifact-derived inputs.
 * Colors are pre-cp08 WORKING VALUES (Track D table 6.2 [BVM→REC] anchors
 * + [DERIVED] blends, flagged), not the final palette.
 */

uniform sampler2D uShoreSdf; // baked shore_sdf.r16 → R-float meters (+ = water), 2049²
uniform sampler2D uBiomeTex; // baked biome.png → RGBA8 (R bright, G kelp-shelf, B plain), 1025²
uniform float uAlbedoDebug;  // 1 = classification-only output (test/debug mode)

/* ------------------------------------------------------------------------
 * Substrate palette — pre-cp08 working values.
 * [T6.2] = Track D table 6.2 [BVM→REC] source hex; [DRV] = derived blend.
 * ---------------------------------------------------------------------- */

const vec3 SUB_DRY_SAND    = vec3(0.823529, 0.780392, 0.662745); // #D2C7A9 [T6.2 B sand / R14]
const vec3 SUB_WET_SAND    = vec3(0.717647, 0.658824, 0.541176); // #B7A88A [DRV dry sand ×0.87]
const vec3 SUB_LOW_SOIL    = vec3(0.639216, 0.564706, 0.419608); // #A3906B [DRV sand→rock]
const vec3 SUB_DRY_EARTH   = vec3(0.690196, 0.541176, 0.360784); // #B08A5C [T6.2 F tan rock]
const vec3 SUB_VEG_SOIL    = vec3(0.513725, 0.505882, 0.352941); // #83815A [DRV soil→#5E8F4E wash]
const vec3 SUB_ROCK        = vec3(0.662745, 0.560784, 0.423529); // #A98F6C [T6.2 B reef rock / R14]
const vec3 SUB_CLIFF_ROCK  = vec3(0.552941, 0.462745, 0.341176); // #8D7657 [DRV rock ×0.84]
const vec3 SUB_HIGH_ROCK   = vec3(0.611765, 0.580392, 0.541176); // #9C948A [DRV toward A #7C8468]
const vec3 SUB_SHAL_SAND   = vec3(0.847059, 0.823529, 0.635294); // #D8D2A2 [T6.2 bright-shallow sand]
const vec3 SUB_SHORE_STONE = vec3(0.486275, 0.517647, 0.407843); // #7C8468 [T6.2 A grey-green rock]
const vec3 SUB_REEF_LIME   = vec3(0.709804, 0.631373, 0.498039); // #B5A17F [DRV pale B rock]
const vec3 SUB_KELP_STONE  = vec3(0.607843, 0.541176, 0.372549); // #9B8A5F [T6.2 C tan-olive rock]
const vec3 SUB_MID_STONE   = vec3(0.560784, 0.494118, 0.388235); // #8F7E63 [DRV]
const vec3 SUB_UW_CLIFF    = vec3(0.435294, 0.411765, 0.360784); // #6F695C [DRV cool, low sediment]
const vec3 SUB_SILT        = vec3(0.662745, 0.698039, 0.713725); // #A9B2B6 [T6.2 E cool grey sand]
const vec3 SUB_TRENCH_ROCK = vec3(0.243137, 0.290196, 0.337255); // #3E4A56 [T6.2 J spires]
const vec3 SUB_TRENCH_SED  = vec3(0.556863, 0.576471, 0.498039); // #8E937F [T6.2 J dim pale sand]
const vec3 SUB_CAVE_ROCK   = vec3(0.333333, 0.286275, 0.113725); // #55491D [DRV D walls #6E621C ×0.8]

/** approved cave-mouth sites (world XZ; placement.json — fixed transforms) */
const vec2 SUB_CAVE_A = vec2(-420.0, 30.0);
const vec2 SUB_CAVE_B = vec2(-430.0, -150.0);
const vec2 SUB_CAVE_C = vec2(450.0, -30.0);

/* ------------------------------------------------------------------------
 * Deterministic lattice noise (fp32-exact hash; CPU-twin reproducible)
 * ---------------------------------------------------------------------- */

float subHash(vec2 ip, float seed) {
  float n = mod(ip.x + ip.y * 57.0 + seed, 289.0);
  n = mod(n * (n * 34.0 + 1.0), 289.0);
  return fract(n * 0.024390243);
}

float subNoise(vec2 p, float seed) {
  vec2 ip = floor(p);
  vec2 f = p - ip;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = subHash(ip, seed);
  float b = subHash(ip + vec2(1.0, 0.0), seed);
  float c = subHash(ip + vec2(0.0, 1.0), seed);
  float d = subHash(ip + vec2(1.0, 1.0), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** two-band FBM (kept to 2 octaves — this runs per raymarch hit) */
float subFbm(vec2 p, float seed) {
  return subNoise(p, seed) * 0.65 + subNoise(p * 2.13 + 31.0, seed + 7.0) * 0.35;
}

/* ------------------------------------------------------------------------
 * Shared samplers
 * ---------------------------------------------------------------------- */

/** signed shore distance, meters, + = water (same half-texel law as height) */
float shoreDistAt(vec2 xz) {
  return texture2D(uShoreSdf, heightUv(xz)).r;
}

/** biome masks: R bright-shallow, G kelp-shelf region, B plain region */
vec3 biomeAt(vec2 xz) {
  float nb = 1025.0;
  vec2 uv = ((xz + 0.5 * uRegionSize) * ((nb - 1.0) / uRegionSize) + 0.5) / nb;
  return texture2D(uBiomeTex, uv).rgb;
}

/** cheap deterministic concavity proxy: neighborhood mean minus height over
 *  a 4-texel ring, 1 ≈ hollow/low-energy accumulation basin */
float concavityAt(vec2 xz, float h) {
  float e = 4.0 * uRegionSize / (uHeightN - 1.0);
  float hAvg = 0.25 * (
    terrainHeight(xz + vec2(e, 0.0)) + terrainHeight(xz - vec2(e, 0.0)) +
    terrainHeight(xz + vec2(0.0, e)) + terrainHeight(xz - vec2(0.0, e)));
  return clamp((hAvg - h) / 3.0, 0.0, 1.0);
}

/* ------------------------------------------------------------------------
 * The classification (addendum §4.8 above water, §4.9 underwater).
 * Blend order (authoritative → local): elevation/depth base → regional
 * variation → slope-driven rock → accumulation (silt) → shoreline bands →
 * cave-mouth transition → restrained mineral drift.
 * All thresholds [DERIVED, flagged for the §9 manual review].
 * ---------------------------------------------------------------------- */

vec3 substrateAlbedo(vec3 point, vec3 normal) {
  vec2 xz = point.xz;
  float h = terrainHeight(xz);
  float slope = 1.0 - clamp(normal.y, 0.0, 1.0); // 0 flat … 1 vertical
  float sd = shoreDistAt(xz);                    // + water, − land
  vec3 biome = biomeAt(xz);
  // concavity feeds only the underwater silt classifier — land fragments
  // skip its four height fetches (terrain-stage budget; math unchanged)
  float conc = h < 0.0 ? concavityAt(xz, h) : 0.0;

  // deterministic variation fields (fixed seeds, committed)
  float bBroad = subFbm(xz * 0.0058824, 11.0); // ~170 m regional mineral field
  float bMoist = subFbm(xz * 0.0111111, 23.0); // ~90 m soil-condition field
  float bMed   = subFbm(xz * 0.0454545, 37.0); // ~22 m material breakup

  vec3 ground;

  if (h < 0.0) {
    // ---------------- underwater substrate families (addendum §4.9) ----------------
    float depth = -h;

    // sediment ramp: pale shallow sand → mixed → silty grey with depth
    vec3 sediment = mix(SUB_SHAL_SAND, SUB_SILT, smoothstep(10.0, 42.0, depth));

    // stone ramp: reef limestone → medium-depth stone → deep trench rock;
    // the kelp-shelf REGION reads as tan-olive mineral rock (regional stone
    // identity — a material tint, never a kelp asset)
    vec3 shallowStone = mix(SUB_REEF_LIME, SUB_KELP_STONE, biome.g * 0.75);
    vec3 stone = mix(shallowStone, SUB_MID_STONE, smoothstep(8.0, 30.0, depth));
    stone = mix(stone, SUB_TRENCH_ROCK, smoothstep(45.0, 65.0, depth));

    // broken rocky seabed vs sediment: slope + medium breakup decide
    float rockW = smoothstep(0.16, 0.42, slope + (bMed - 0.5) * 0.35);
    ground = mix(sediment, stone, rockW);

    // silt/fine-sediment pockets: flat, concave, low-energy, deeper floors
    float siltW = (1.0 - smoothstep(0.06, 0.16, slope)) *
      smoothstep(0.15, 0.6, conc) * smoothstep(6.0, 16.0, depth);
    ground = mix(ground, mix(SUB_SILT, SUB_TRENCH_SED, smoothstep(45.0, 65.0, depth)), siltW * 0.8);

    // steep underwater cliff stone — reduced sediment accumulation
    float cliffW = smoothstep(0.45, 0.72, slope);
    ground = mix(ground, mix(SUB_UW_CLIFF, SUB_TRENCH_ROCK, smoothstep(40.0, 62.0, depth)), cliffW);

    // wet/algae-stained shoreline stone (material tint on rocky shallows)
    float shoreW = (1.0 - smoothstep(4.0, 14.0, sd)) *
      smoothstep(0.12, 0.35, slope + (bMed - 0.5) * 0.2);
    ground = mix(ground, SUB_SHORE_STONE, shoreW * 0.7);

    // darker cave-mouth transition rock (approved sites; fixed transforms)
    float dCave = min(distance(xz, SUB_CAVE_A), min(distance(xz, SUB_CAVE_B), distance(xz, SUB_CAVE_C)));
    float caveW = 1.0 - smoothstep(8.0, 24.0, dCave);
    ground = mix(ground, SUB_CAVE_ROCK, caveW * 0.75);

    // restrained regional variation: plain region desaturates toward silt;
    // bright-shallow region lifts value slightly
    ground = mix(ground, mix(ground, SUB_SILT, 0.35), biome.b * 0.6);
    ground = mix(ground, ground * 1.06, biome.r * 0.5);
  } else {
    // ---------------- exposed-land substrate families (addendum §4.8) ----------------
    float inland = -sd; // meters from the waterline, on land

    // lowland soil family: soil-condition field picks lowland / dry-earth /
    // vegetation-compatible soil coloration (soil only — never vegetation)
    vec3 soil = mix(SUB_LOW_SOIL, SUB_DRY_EARTH, smoothstep(0.35, 0.7, bMoist));
    soil = mix(soil, SUB_VEG_SOIL, smoothstep(0.55, 0.8, 1.0 - bMoist) * 0.7);

    // dry beach sand: low, flat, near the approved waterline
    float beachW = (1.0 - smoothstep(3.5, 7.0, h)) *
      (1.0 - smoothstep(0.14, 0.32, slope)) *
      (1.0 - smoothstep(28.0, 60.0, inland));
    ground = mix(soil, SUB_DRY_SAND, beachW);

    // ordinary exposed rock → high-elevation rock; steep cliff rock band
    float rockW = smoothstep(0.22, 0.45, slope + (bMed - 0.5) * 0.25);
    vec3 rockCol = mix(SUB_ROCK, SUB_HIGH_ROCK, smoothstep(60.0, 130.0, h));
    float cliffW = smoothstep(0.5, 0.72, slope);
    rockCol = mix(rockCol, SUB_CLIFF_ROCK, cliffW);
    // subtle strata variation on steep faces (elevation-banded, warbled)
    float strata = sin(h * 0.55 + bMed * 6.0);
    rockCol *= 1.0 + strata * 0.05 * cliffW;
    ground = mix(ground, rockCol, rockW);

    // wet shoreline sand/stone: the first meters above the waterline
    float wetW = max(1.0 - smoothstep(0.3, 1.4, h), 1.0 - smoothstep(2.0, 6.0, inland));
    ground = mix(ground, mix(SUB_WET_SAND, SUB_SHORE_STONE, smoothstep(0.25, 0.5, slope)), wetW * 0.65);
  }

  // restrained broad mineral drift (both sides of the waterline; matte,
  // low-frequency, value-grouped — Track D §10 restraint)
  ground *= vec3(1.0 + (bBroad - 0.5) * 0.06, 1.0, 1.0 - (bBroad - 0.5) * 0.05);
  ground *= 1.0 + (bBroad - 0.5) * 0.08;

  return ground;
}

/* ------------------------------------------------------------------------
 * Close-range surface-detail layer (addendum §4.10; ZyFou
 * TerrainDetailMaterial principle — world-space bands, triplanar on steep
 * faces, strictly subordinate to the real geometry; fades out by ~55 m).
 * ---------------------------------------------------------------------- */

const float SUB_DETAIL_NEAR = 14.0;
const float SUB_DETAIL_FAR = 55.0;

/** triplanar blend weights (ZyFou terrainTriBlend, pow-4 sharpening) */
vec3 subTriBlend(vec3 n) {
  vec3 b = pow(abs(n), vec3(4.0));
  return b / max(b.x + b.y + b.z, 1e-4);
}

/** world-space detail noise, triplanar-projected on steep faces so texture
 *  stretching is reduced (planar XZ elsewhere). The triplanar taps are
 *  branched out on flat ground — the majority of fragments — to hold the
 *  cp05 terrain-stage budget (≤ 3 ms); the branch is warp-coherent over
 *  flat regions. */
float subDetailNoise(vec3 p, vec3 n, float freq, float seed) {
  float planar = subNoise(p.xz * freq, seed);
  float steep = smoothstep(0.35, 0.6, 1.0 - clamp(n.y, 0.0, 1.0));
  if (steep <= 0.001) return planar;
  vec3 b = subTriBlend(n);
  float tri = subNoise(p.yz * freq, seed + 3.0) * b.x +
    subNoise(p.zx * freq, seed + 5.0) * b.y +
    subNoise(p.xy * freq, seed + 9.0) * b.z;
  return mix(planar, tri, steep);
}

/** detail fade 0..1 by camera distance (cameraPosition is three-provided) */
float subDetailFade(vec3 point) {
  float d = distance(cameraPosition, point);
  return 1.0 - smoothstep(SUB_DETAIL_NEAR, SUB_DETAIL_FAR, d);
}

/**
 * Close-range albedo detail: rock grain, sediment breakup, shoreline
 * wetness variation, subtle strata — value modulation only (hue held), so
 * classification identity is never repainted. Returns the enriched albedo.
 */
vec3 substrateDetail(vec3 albedo, vec3 point, vec3 normal) {
  float fade = subDetailFade(point);
  if (fade <= 0.001) return albedo;

  float h = terrainHeight(point.xz);
  float slope = 1.0 - clamp(normal.y, 0.0, 1.0);
  float rockish = smoothstep(0.2, 0.5, slope);

  float fine = subDetailNoise(point, normal, 0.9, 51.0) * 2.0 - 1.0;   // ~1.1 m grain
  float micro = subDetailNoise(point, normal, 3.1, 63.0) * 2.0 - 1.0;  // ~0.3 m speckle
  float coarse = subNoise(point.xz * 0.14, 77.0) * 2.0 - 1.0;          // ~7 m clumps

  float amp = 0.05 + 0.05 * rockish;         // rock grain stronger than sediment
  vec3 detailed = albedo * (1.0 + fade * (fine * amp + micro * amp * 0.5 + coarse * 0.04));

  // shoreline wetness variation: darker, patchy band at the waterline
  float sd = shoreDistAt(point.xz);
  float wetBand = 1.0 - smoothstep(1.5, 5.0, abs(sd) + abs(h) * 2.0);
  detailed = mix(detailed, detailed * (0.82 + 0.10 * (fine * 0.5 + 0.5)), wetBand * fade * 0.8);

  return detailed;
}

/**
 * Low-intensity detail normal (ZyFou applyTerrainDetailNormal2D principle):
 * perturbs the lighting normal near the camera; never a substitute for the
 * baked relief (subordinate by amplitude and fade).
 */
vec3 substrateDetailNormal(vec3 normal, vec3 point) {
  float fade = subDetailFade(point);
  if (fade <= 0.001) return normal;
  float e = 0.55;
  float c = subDetailNoise(point, normal, 0.9, 51.0);
  float dx = subDetailNoise(point + vec3(e, 0.0, 0.0), normal, 0.9, 51.0) - c;
  float dz = subDetailNoise(point + vec3(0.0, 0.0, e), normal, 0.9, 51.0) - c;
  float strength = 0.55 * fade;
  return normalize(normal + vec3(-dx * strength, 0.0, -dz * strength));
}

/** The one substrate color entry point (classification + detail). */
vec3 substrateColor(vec3 point, vec3 normal) {
  return substrateDetail(substrateAlbedo(point, normal), point, normal);
}
