/**
 * REGION WALL/TERRAIN COLOR — Checkpoint 04B app-owned adaptation of the
 * vendored `getWallColor` (WaterAbove/WaterBelow/Cube .frag), shared by the
 * region water-above, water-below and terrain fragments so the terrain seen
 * directly and the terrain seen through refracted rays shade identically.
 *
 * Include AFTER RegionContainer.glsl. The including shader must declare
 * uniforms `light` (vec3), `causticTex` (sampler2D), `water` (sampler2D)
 * and the IOR constants first.
 *
 * Sanctioned swaps vs the vendored getWallColor (Master §4.2 items 1–3, 6):
 *  - triplanar pool-tile lookup → R14 provisional terrain tints
 *    (submerged #D2C7A9 sand / exposed #A98F6C rock, ±0.5 m shoreline
 *    blend — provisional-until-checkpoint-08), normal from the heightfield
 *    instead of the box faces;
 *  - `point.y < info.r` waterline test evaluated against the composited
 *    global surface (uSeaLevel + windowed displacement);
 *  - caustic lookup re-parameterized to the window-projected caustic RT and
 *    blended to the flat-water caustic value outside the sim window;
 *  - the above-waterline rim sigmoid evaluated in demo units against the
 *    sea surface [DERIVED — same constants, same band width as the pool
 *    rim: ~2/12 du ≈ 1.25 m];
 *  - the pool-box centre-distance vignette (`scale /= length(point)`) has
 *    no region analogue and is pinned to the pool's centre-floor value
 *    (documented deviation; revisit at the cp08 atmosphere pass).
 * The diffuse/caustic consumption math (`scale += diffuse·caustic.r·2.0·
 * caustic.g`) is byte-identical.
 */

const vec3 TINT_SUBMERGED = vec3(0.823529, 0.780392, 0.662745); // #D2C7A9 [R14]
const vec3 TINT_EXPOSED = vec3(0.662745, 0.560784, 0.423529);   // #A98F6C [R14]

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

vec3 getWallColor(vec3 point) {
  float scale = 0.5;
  float h = terrainHeight(point.xz);
  vec3 wallColor = mix(TINT_SUBMERGED, TINT_EXPOSED, smoothstep(-0.5, 0.5, h));
  vec3 normal = seabedNormal(point.xz);

  vec3 refractedLight = -refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
  float diffuse = max(0.0, dot(refractedLight, normal));
  if (point.y < surfaceHeightAt(point.xz)) {
    vec4 caustic = sampleCaustic(point, refractedLight);
    scale += diffuse * caustic.r * 2.0 * caustic.g;
  } else {
    float yDu = (point.y - uSeaLevel) / POOL_DU_M;
    float travel = max(0.0, (2.0 / 12.0 - yDu) / max(refractedLight.y, 1.0e-3));
    diffuse *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * travel) * (yDu - 2.0 / 12.0)));
    scale += diffuse * 0.5;
  }
  return wallColor * scale;
}
