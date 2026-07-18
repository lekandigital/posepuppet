/**
 * REGION CAUSTICS VERTEX SHADER — Checkpoint 04B app-owned copy of the
 * vendored Caustics.vert with only the sanctioned projection swap (Master
 * §4.2 row 4): the refracted light columns land on the seabed heightfield
 * (raymarch) instead of the pool floor plane. The differential-area
 * fragment math consuming oldPos/newPos is untouched.
 *
 * Byte-identical (protected): the wave-texture sample, the `info.ba *= 0.5`
 * caustic smoothing (composited with the window falloff so off-window flat
 * water produces the flat-water caustic exactly), normal reconstruction and
 * both Snell refractions.
 *
 * The rasterization target maps the light-projected footprint (onto y = 0
 * along the flat-refracted light) across the sim window with the vendored
 * 0.75 margin — the exact generalization of the vendored
 * `0.75·(newPos.xz + rl.xz/rl.y)` (which assumed floor y = −1), consistent
 * with the read path in RegionWallColor.glsl's sampleCaustic().
 */

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

uniform vec3 light;
uniform sampler2D water;

varying vec3 oldPos;
varying vec3 newPos;
varying vec3 ray;

#include ./RegionContainer.glsl;

/**
 * The vendored project() with the pool box swapped for the seabed: raymarch
 * along the refracted ray; a miss (grazing, > 192 m) continues from the
 * march end to the region's depth floor (−80 m) along the flat-refracted
 * light — mirroring the vendored two-step box-exit → floor-plane structure.
 */
vec3 projectSeabed(vec3 origin, vec3 r, vec3 refractedLight) {
  float t = raymarchSeabed(origin, r);
  if (t >= 0.0) return origin + r * t;
  vec3 p = origin + r * RM_MAX;
  float tplane = (-80.0 - p.y) / refractedLight.y;
  return p + refractedLight * max(0.0, tplane);
}

void main() {
  // Step 1: sample the sim state at this grid point — vendored
  vec4 info = texture2D(water, position.xy * 0.5 + 0.5);
  vec2 uv = position.xy * 0.5 + 0.5;
  float wf = windowFalloff(uv);
  info.r *= wf;        // window composite: displacement fades to the calm plane
  info.ba *= 0.5 * wf; // vendored 0.5 caustic smoothing × window falloff

  // Step 2: reconstruct the surface normal — vendored
  vec2 slope = clamp(info.ba, vec2(-0.999), vec2(0.999));
  float slopeLengthSq = min(dot(slope, slope), 0.999);
  vec3 normal = normalize(vec3(slope.x, sqrt(max(0.001, 1.0 - slopeLengthSq)), slope.y));

  // Step 3: refracted light directions (Snell) — vendored
  vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
  ray = refract(-light, normal, IOR_AIR / IOR_WATER);

  // Step 4: project light columns onto the seabed (the container swap);
  // grid xy spans the sim window in world meters
  vec2 xz = uWindowOrigin + uv * uWindowSize;
  oldPos = projectSeabed(vec3(xz.x, uSeaLevel, xz.y), refractedLight, refractedLight);
  newPos = projectSeabed(
    vec3(xz.x, uSeaLevel + info.r * uDispScale, xz.y),
    ray,
    refractedLight
  );

  // Step 5: rasterize at the light-projected window footprint (0.75 margin)
  vec2 proj = newPos.xz - newPos.y * refractedLight.xz / refractedLight.y;
  vec2 wuvProj = windowUv(proj);
  gl_Position = vec4(0.75 * (wuvProj * 2.0 - 1.0), 0.0, 1.0);
}
