precision highp float;

/**
 * REGION TERRAIN CHUNK FRAGMENT SHADER — Checkpoint 05A substrate-color
 * terrain material (CP05A correction: the shared include now carries the
 * ZyFou-Blank color port — see RegionSubstrate.glsl). Shading goes through
 * the SAME substrateColor + getWallColorShaded as the region water
 * shaders' raymarch path, so terrain seen directly and terrain seen
 * through refracted/reflected rays agree by construction; normals come
 * per-fragment from uHeightTex (single source, Master §2.2), with the
 * ZyFou detail normal feeding the same lighting law.
 *
 * Byte-identical (protected): the submerged caustic-consumption math
 * inside getWallColorShaded and the vendored underwater tint
 * (`underwaterColor · 1.2`) applied to submerged fragments, both carried
 * from 04B/05.
 *
 * `uAlbedoDebug` (test/debug only, default 0): outputs the raw
 * classification albedo with no lighting — the probe surface the CPU twin
 * (substrateCpu.ts) and the region-substrate spec compare against.
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

const vec3 underwaterColor = vec3(0.4, 0.9, 1.0);

uniform vec3 light;
uniform sampler2D causticTex;
uniform sampler2D water;

varying vec3 vPosition;

#include ./RegionContainer.glsl;
#include ./RegionSubstrate.glsl;
#include ./RegionWallColor.glsl;

void main() {
  vec3 nGeo = seabedNormal(vPosition.xz);
  vec3 albedo = substrateColor(vPosition, nGeo);

  if (uAlbedoDebug > 0.5) {
    gl_FragColor = vec4(substrateAlbedo(vPosition, nGeo), 1.0);
    return;
  }

  // low-intensity close-range detail normal feeds the SAME lighting law
  vec3 nLit = substrateDetailNormal(nGeo, vPosition);
  gl_FragColor = vec4(getWallColorShaded(vPosition, albedo, nLit), 1.0);

  // Blue tinting for underwater fragments — the vendored law in
  // path-length form (cp05A correction): the constant full-strength
  // multiply crushed the substrate into uniform teal at region scale;
  // waterPathTint keeps the natural cast, mild up close, deepening with
  // the camera→fragment underwater path. The vendored ×1.2 gain stays.
  if (vPosition.y < surfaceHeightAt(vPosition.xz)) {
    float pathLen = distance(cameraPosition, vPosition);
    gl_FragColor.rgb *= waterPathTint(underwaterColor, pathLen) * 1.2;
  }
}
