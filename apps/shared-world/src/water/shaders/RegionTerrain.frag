precision highp float;

/**
 * REGION TERRAIN CHUNK FRAGMENT SHADER — Checkpoint 05 chunked-LOD terrain
 * material (replaces the cp04B graybox fragment). Shading goes through the
 * SAME getWallColorTinted as the region water shaders, so terrain seen
 * directly and terrain seen through refracted rays agree; normals come
 * per-fragment from uHeightTex (single source, Master §2.2).
 *
 * Byte-identical (protected): the submerged caustic-consumption math inside
 * getWallColorTinted and the vendored underwater tint (`underwaterColor ·
 * 1.2`) applied to submerged fragments, both carried from 04B.
 *
 * Triplanar-ready structure (cp05 §3 item 2): `terrainAlbedo` is the cp08
 * texture seam — it receives the world point, the heightfield normal and
 * the provisional per-vertex tint, and today returns the tint unchanged.
 * cp08 replaces its body with height/slope-blended triplanar texture
 * sampling without touching the lighting math around it.
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

const vec3 underwaterColor = vec3(0.4, 0.9, 1.0);

uniform vec3 light;
uniform sampler2D causticTex;
uniform sampler2D water;

varying vec3 vPosition;
varying vec3 vTint;

#include ./RegionContainer.glsl;
#include ./RegionTerrainTint.glsl;
#include ./RegionWallColor.glsl;

/** cp08 triplanar seam — flat provisional tint until textures arrive. */
vec3 terrainAlbedo(vec3 point, vec3 normal, vec3 tint) {
  return tint;
}

void main() {
  vec3 albedo = terrainAlbedo(vPosition, seabedNormal(vPosition.xz), vTint);
  gl_FragColor = vec4(getWallColorTinted(vPosition, albedo), 1.0);

  // Blue tinting for underwater fragments — vendored law, waterline
  // evaluated against the composited global surface (carried from 04B)
  if (vPosition.y < surfaceHeightAt(vPosition.xz)) {
    gl_FragColor.rgb *= underwaterColor * 1.2;
  }
}
