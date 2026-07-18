/**
 * REGION TERRAIN CHUNK VERTEX SHADER — Checkpoint 05 chunked-LOD terrain
 * (Master §5.4). Replaces the cp04B graybox vertex stage (RegionTerrain.vert,
 * deleted): tile geometry is a shared flat grid per LOD whose vertex heights
 * are sampled HERE from uHeightTex — the same decoded texture every other
 * subsystem reads (§2.2 single-source law; grid vertices sit exactly at
 * heightmap texel centers, where linear and nearest filtering both return
 * the stored value).
 *
 * Vertex attribute encoding: position.x/.z = tile-local meters (the tile's
 * world origin arrives via modelMatrix translation); position.y = skirt flag
 * (0 = surface vertex, 1 = skirt ring vertex dropped SKIRT_DROP below the
 * surface — cp05 §6 skirt 2 m [DERIVED]).
 *
 * Per-vertex provisional tint (R14 / cp05 §6) computed here from the same
 * height + heightfield normal law the water shaders use analytically.
 */

varying vec3 vPosition;
varying vec3 vTint;

const float SKIRT_DROP = 2.0;

#include ./RegionContainer.glsl;
#include ./RegionTerrainTint.glsl;

void main() {
  vec2 worldXZ = (modelMatrix * vec4(position.x, 0.0, position.z, 1.0)).xz;
  float h = terrainHeight(worldXZ);
  vec3 n = seabedNormal(worldXZ);
  vTint = terrainTint(h, n);
  vPosition = vec3(worldXZ.x, h - SKIRT_DROP * position.y, worldXZ.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
}
