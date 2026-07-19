/**
 * REGION TERRAIN CHUNK VERTEX SHADER — Checkpoint 05 chunked-LOD terrain
 * (Master §5.4), cp05A revision: the per-vertex R14 tint is superseded by
 * the per-fragment substrate classification (RegionSubstrate.glsl), so
 * this stage now carries geometry only. Tile geometry is a shared flat
 * grid per LOD whose vertex heights are sampled HERE from uHeightTex — the
 * same decoded texture every other subsystem reads (§2.2 single-source
 * law; grid vertices sit exactly at heightmap texel centers, where linear
 * and nearest filtering both return the stored value).
 *
 * Vertex attribute encoding: position.x/.z = tile-local meters (the tile's
 * world origin arrives via modelMatrix translation); position.y = skirt flag
 * (0 = surface vertex, 1 = skirt ring vertex dropped SKIRT_DROP below the
 * surface — cp05 §6 skirt 2 m [DERIVED]).
 */

varying vec3 vPosition;

const float SKIRT_DROP = 2.0;

#include ./RegionContainer.glsl;

void main() {
  vec2 worldXZ = (modelMatrix * vec4(position.x, 0.0, position.z, 1.0)).xz;
  float h = terrainHeight(worldXZ);
  vPosition = vec3(worldXZ.x, h - SKIRT_DROP * position.y, worldXZ.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
}
