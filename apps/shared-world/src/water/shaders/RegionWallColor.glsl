/**
 * REGION WALL/TERRAIN COLOR — the shared terrain-shading of the region
 * (introduced at Checkpoint 04B as the app-owned adaptation of the vendored
 * `getWallColor`; tint/lighting inputs updated at Checkpoint 05). Shared by
 * the region water-above, water-below and terrain-chunk fragments so the
 * terrain seen directly and the terrain seen through refracted/reflected
 * rays shade identically.
 *
 * Include AFTER RegionContainer.glsl AND RegionTerrainTint.glsl. The
 * including shader must declare uniforms `light` (vec3), `causticTex`
 * (sampler2D), `water` (sampler2D) and the IOR constants first.
 *
 * Checkpoint 05 changes vs the 04B version (sanctioned terrain-material
 * work, cp05 §3 item 2 — the water OPTICS above this function are
 * untouched and re-proven by the four-shot re-run):
 *  - the ±0.5 m submerged/exposed tint split → the cp05 §6 height/slope
 *    band law (RegionTerrainTint.glsl), evaluated per raymarch hit;
 *  - the exposed-terrain branch (above the waterline) → single
 *    DirectionalLight (the vendored sun direction — one sun) + hemisphere
 *    ambient [initial intensities from Track D §6.4's recommended bands,
 *    provisional-until-cp08, flagged], replacing the 04B pool-rim sigmoid
 *    stand-in (which had no region analogue — 04B deviations list).
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
 * Shade a terrain point with a supplied albedo tint. The chunk fragment
 * passes its interpolated per-vertex tint; the water raymarch path derives
 * the tint analytically (getWallColor below) — same law, same result.
 */
vec3 getWallColorTinted(vec3 point, vec3 tint) {
  vec3 normal = seabedNormal(point.xz);
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

vec3 getWallColor(vec3 point) {
  float h = terrainHeight(point.xz);
  return getWallColorTinted(point, terrainTint(h, seabedNormal(point.xz)));
}
