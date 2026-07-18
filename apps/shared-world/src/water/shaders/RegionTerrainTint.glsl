/**
 * REGION TERRAIN TINT — Checkpoint 05 provisional vertex-tint law (cp05 §6,
 * R14 hexes; band thresholds [DERIVED, provisional-until-cp08, flagged]):
 *
 *   sand #D2C7A9 where slope < 20° AND height ∈ [−12, +2] m;
 *   rock #A98F6C elsewhere; blends over 4 m / 8°.
 *
 * ONE function shared by the chunk vertex shader (per-vertex tint) and by
 * RegionWallColor.glsl (per-hit analytic tint for the water raymarch), so
 * terrain seen directly and terrain seen through refracted/reflected rays
 * carry the same provisional material. No textures (cp08); the fragment
 * shaders keep a triplanar-ready seam (`terrainAlbedo`) for cp08.
 *
 * Include AFTER RegionContainer.glsl (no dependencies of its own).
 */

const vec3 TINT_SAND = vec3(0.823529, 0.780392, 0.662745); // #D2C7A9 [R14]
const vec3 TINT_ROCK = vec3(0.662745, 0.560784, 0.423529); // #A98F6C [R14]

/** Height/slope-blended provisional tint (cp05 §6 bands). */
vec3 terrainTint(float h, vec3 normal) {
  float slopeDeg = degrees(acos(clamp(normal.y, 0.0, 1.0)));
  float slopeFac = 1.0 - smoothstep(16.0, 24.0, slopeDeg); // 20° ± 4°
  float heightFac = smoothstep(-14.0, -10.0, h) * (1.0 - smoothstep(0.0, 4.0, h)); // [−12,+2] ± 2 m
  return mix(TINT_ROCK, TINT_SAND, slopeFac * heightFac);
}
