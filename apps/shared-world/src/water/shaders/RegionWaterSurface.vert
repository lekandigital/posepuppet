/**
 * REGION WATER SURFACE VERTEX SHADER — Checkpoint 04B app-owned copy of the
 * vendored WaterAbove.vert / WaterBelow.vert (identical files upstream),
 * with only the sanctioned surface-extent/domain remap (Master §4.2 row
 * "surface mesh extent"):
 *
 *  - the grid's local xy maps to world xz through the player-following sim
 *    window (uWindowOrigin + uv·uWindowSize) instead of the pool's fixed
 *    [-1,1] top — same xy→xz swizzle role as the vendored `position.xzy`;
 *  - the wave displacement `info.r` is composited into the one global calm
 *    surface at y = uSeaLevel through the ×uDispScale unit conversion and
 *    the cosine window falloff (Master §4.3); the flat border sheet uses
 *    this same shader with |xy| > 1 → falloff 0 → y = uSeaLevel exactly.
 */

uniform sampler2D water;

varying vec3 vPosition;

#include ./RegionContainer.glsl;

void main() {
  vec2 uv = position.xy * 0.5 + 0.5;
  vec4 info = texture2D(water, clamp(uv, 0.0, 1.0));
  float wf = windowFalloff(uv);
  vec2 xz = uWindowOrigin + uv * uWindowSize;
  vPosition = vec3(xz.x, uSeaLevel + info.r * uDispScale * wf, xz.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}
