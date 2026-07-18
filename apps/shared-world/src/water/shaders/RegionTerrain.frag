precision highp float;

/**
 * REGION TERRAIN FRAGMENT SHADER — Checkpoint 04B app-owned copy of the
 * vendored Cube.frag (pool walls/floor) with the sanctioned container swap
 * (Master §4.2 row 6): the tiled box walls become the coastline/seabed
 * terrain, shaded by the SAME getWallColor as the region water shaders so
 * terrain seen directly and terrain seen through refracted rays agree.
 *
 * Byte-identical (protected): the caustic consumption math and the
 * underwater tint (`underwaterColor · 1.2`) applied to submerged fragments.
 * Object-optics proximity shadows removed (optics 'none' — see
 * RegionWaterAbove.frag header note).
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

const vec3 underwaterColor = vec3(0.4, 0.9, 1.0);

uniform vec3 light;
uniform sampler2D causticTex;
uniform sampler2D water;

varying vec3 vPosition;

#include ./RegionContainer.glsl;
#include ./RegionWallColor.glsl;

void main() {
  gl_FragColor = vec4(getWallColor(vPosition), 1.0);

  // Blue tinting for underwater fragments — vendored law, waterline
  // evaluated against the composited global surface
  if (vPosition.y < surfaceHeightAt(vPosition.xz)) {
    gl_FragColor.rgb *= underwaterColor * 1.2;
  }
}
