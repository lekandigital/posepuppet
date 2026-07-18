precision highp float;

/**
 * REGION CAUSTICS FRAGMENT SHADER — Checkpoint 04B app-owned copy of the
 * vendored Caustics.frag. The differential-area `oldArea/newArea` math is
 * byte-identical (protected, Master §4.2 item 5 "STAYS").
 *
 * Swaps carried (documented deviations, same edit family):
 *  - object shadow branches removed (optics 'none' — the region has no
 *    simulation obstacle; the vendored no-object branch `g = 1.0` kept);
 *  - the pool-rim edge fadeout (`intersectCube` against the box) becomes
 *    the shoreline fadeout: the same sigmoid constants evaluated in demo
 *    units against the sea surface, fading caustics over the top
 *    ~2/12 du ≈ 1.25 m of seabed below the waterline — the same band the
 *    vendored fade occupied at the pool rim [DERIVED].
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;
/** The approved pool mount scale (Master §7.7) — demo-unit evaluation. */
const float POOL_DU_M = 7.5;

uniform vec3 light;
uniform float uSeaLevel;

varying vec3 oldPos;
varying vec3 newPos;
varying vec3 ray;

void main() {
  // CAUSTICS INTENSITY via differential-area comparison — vendored, untouched
  float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
  float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
  gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);

  vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);

  // No objects — fully lit (the vendored optics-none branch)
  gl_FragColor.g = 1.0;

  // SHORELINE FADEOUT — the vendored rim sigmoid re-anchored to the sea
  // surface, evaluated in demo units [DERIVED — see header]
  float yDu = (newPos.y - uSeaLevel) / POOL_DU_M;
  float tUp = max(0.0, yDu / refractedLight.y);
  gl_FragColor.r *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * tUp) * (-yDu - 2.0 / 12.0)));
}
