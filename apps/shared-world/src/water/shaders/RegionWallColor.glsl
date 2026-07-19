/**
 * REGION WALL/TERRAIN COLOR — the shared terrain-shading of the region
 * (introduced at Checkpoint 04B as the app-owned adaptation of the vendored
 * `getWallColor`; tint/lighting inputs updated at Checkpoint 05). Shared by
 * the region water-above, water-below and terrain-chunk fragments so the
 * terrain seen directly and the terrain seen through refracted/reflected
 * rays shade identically.
 *
 * Include AFTER RegionContainer.glsl AND RegionSubstrate.glsl. The
 * including shader must declare uniforms `light` (vec3), `causticTex`
 * (sampler2D), `water` (sampler2D) and the IOR constants first.
 *
 * Checkpoint 05A changes vs the cp05 version (sanctioned substrate-color
 * work, cp05A §3 item 2 — the water OPTICS above this function are
 * untouched and re-proven by the four-shot re-run):
 *  - the cp05 R14 two-tint law (RegionTerrainTint.glsl, deleted) → the
 *    shared substrate classification of RegionSubstrate.glsl, evaluated
 *    per raymarch hit and per terrain fragment identically (addendum §4.7);
 *  - getWallColorShaded exposes the lighting normal as a parameter so the
 *    close-range detail normal (addendum §4.10) can feed the SAME lighting
 *    law; getWallColorTinted keeps its cp05 signature and behavior.
 *
 * Checkpoint 05 lineage (kept): the exposed-terrain branch is the single
 * vendored sun direction + hemisphere ambient [Track D §6.4 initial
 * intensities, provisional-until-cp08, flagged].
 *
 * Byte-identical (protected, carried from 04B): surfaceHeightAt(), the
 * caustic projection/sample law, and the submerged diffuse/caustic
 * consumption math (`scale += diffuse·caustic.r·2.0·caustic.g`) with the
 * 0.5 ambient floor.
 */

/** cp05 exposed-terrain lighting [DERIVED initials, provisional-until-cp08] */
const vec3 EXPOSED_SUN_COLOR = vec3(1.0, 0.956863, 0.878431); // #FFF4E0 [Track D 17.1 band]
const float EXPOSED_SUN_INT = 0.55;                            // Track D 0.45–0.65 midpoint
const vec3 EXPOSED_HEMI_SKY = vec3(0.749020, 0.909804, 1.0);   // #BFE8FF (scene hemi sky)
const float EXPOSED_HEMI_INT = 0.50;
const float EXPOSED_HEMI_GROUND_FRAC = 0.30;                   // ground = 30 % of sky

/** Composited global-surface height at xz (calm plane + windowed sim). */
float surfaceHeightAt(vec2 xz) {
  vec2 wuv = windowUv(xz);
  vec4 sInfo = texture2D(water, clamp(wuv, 0.0, 1.0));
  return uSeaLevel + sInfo.r * uDispScale * windowFalloff(wuv);
}

/**
 * Caustic-map sample for a world point, projected along the refracted light
 * onto the y = 0 plane (the generalization of the vendored
 * `0.75·(point.xz − point.y·rl.xz/rl.y)` law, window-normalized), blended
 * to the flat-water caustic value (oldArea/newArea = 1 → 0.2, unshadowed)
 * outside the sim window.
 */
vec4 sampleCaustic(vec3 point, vec3 refractedLight) {
  vec2 proj = point.xz - point.y * refractedLight.xz / refractedLight.y;
  vec2 wuvProj = windowUv(proj);
  vec2 cuv = 0.75 * (wuvProj * 2.0 - 1.0) * 0.5 + 0.5;
  vec4 c = texture2D(causticTex, cuv);
  return mix(vec4(0.2, 1.0, 0.0, 0.0), c, windowFalloff(wuvProj));
}

/**
 * Shade a terrain point with a supplied albedo and lighting normal — the
 * ONE lighting law for terrain seen directly and through the water.
 */
vec3 getWallColorShaded(vec3 point, vec3 tint, vec3 normal) {
  vec3 refractedLight = -refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
  if (point.y < surfaceHeightAt(point.xz)) {
    // submerged: the vendored diffuse/caustic consumption — byte-identical
    float scale = 0.5;
    float diffuse = max(0.0, dot(refractedLight, normal));
    vec4 caustic = sampleCaustic(point, refractedLight);
    scale += diffuse * caustic.r * 2.0 * caustic.g;
    return tint * scale;
  }
  // exposed: single directional (the one vendored sun) + hemisphere (cp05)
  float hemiMix = normal.y * 0.5 + 0.5;
  vec3 hemi = EXPOSED_HEMI_SKY * (EXPOSED_HEMI_INT * mix(EXPOSED_HEMI_GROUND_FRAC, 1.0, hemiMix));
  vec3 sun = EXPOSED_SUN_COLOR * (EXPOSED_SUN_INT * max(0.0, dot(normal, light)));
  return tint * (hemi + sun);
}

/** cp05-signature wrapper: heightfield normal (the water raymarch path). */
vec3 getWallColorTinted(vec3 point, vec3 tint) {
  return getWallColorShaded(point, tint, seabedNormal(point.xz));
}

vec3 getWallColor(vec3 point) {
  vec3 normal = seabedNormal(point.xz);
  return getWallColorShaded(point, substrateColor(point, normal), normal);
}
