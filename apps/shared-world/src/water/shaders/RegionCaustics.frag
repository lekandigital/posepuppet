precision highp float;

/**
 * REGION CAUSTICS FRAGMENT SHADER — Checkpoint 04B app-owned copy of the
 * vendored Caustics.frag. The differential-area `oldArea/newArea` math is
 * byte-identical (protected, Master §4.2 item 5 "STAYS").
 *
 * Swaps carried (documented deviations, same edit family):
 *  - sphere/cube analytic shadow branches removed (never enabled in any
 *    approved view); CP06 RESTORES the vendored mesh/PCF shadow branch
 *    for the regional actor — the 9-tap objectShadowTex kernel with the
 *    shadow UV evaluated through the sim-window caustic footprint (the
 *    same 0.75·(windowUv(proj)·2−1) law the vertex stage rasterizes and
 *    RegionWallColor.sampleCaustic reads);
 *  - the pool-rim edge fadeout (`intersectCube` against the box) becomes
 *    the shoreline fadeout: the same sigmoid constants evaluated in demo
 *    units against the sea surface, fading caustics over the top
 *    ~2/12 du ≈ 1.25 m of seabed below the waterline — the same band the
 *    vendored fade occupied at the pool rim [DERIVED].
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

uniform vec3 light;
// CP06 restored mesh shadow inputs (vendored names)
uniform bool meshEnabled;
uniform sampler2D objectShadowTex;

varying vec3 oldPos;
varying vec3 newPos;
varying vec3 ray;

#include ./RegionContainer.glsl;

void main() {
  // CAUSTICS INTENSITY via differential-area comparison — vendored, untouched
  float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
  float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
  gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);

  vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);

  if (meshEnabled) {
    // CP06 restored: the vendored mesh shadow — 9-tap PCF over the
    // pre-rendered actor footprint (Caustics.frag mesh branch), with the
    // shadow UV through the sim-window caustic footprint
    vec2 proj = newPos.xz - newPos.y * refractedLight.xz / refractedLight.y;
    vec2 shadowUV = 0.75 * (windowUv(proj) * 2.0 - 1.0) * 0.5 + 0.5;
    const float d = 4.0 / 1024.0;
    float occlusion = texture2D(objectShadowTex, shadowUV).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(d, 0.0)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(-d, 0.0)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(0.0, d)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(0.0, -d)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(d, d)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(-d, d)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(d, -d)).r;
    occlusion += texture2D(objectShadowTex, shadowUV + vec2(-d, -d)).r;
    gl_FragColor.g = 1.0 - 0.8 * occlusion / 9.0;
  } else {
    // No objects — fully lit (the vendored optics-none branch)
    gl_FragColor.g = 1.0;
  }

  // SHORELINE FADEOUT — the vendored rim sigmoid re-anchored to the sea
  // surface, evaluated in demo units [DERIVED — see header]
  float yDu = (newPos.y - uSeaLevel) / POOL_DU_M;
  float tUp = max(0.0, yDu / refractedLight.y);
  gl_FragColor.r *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * tUp) * (-yDu - 2.0 / 12.0)));
}
