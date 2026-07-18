/**
 * REGION CONTAINER — Checkpoint 04B container-swap primitives.
 *
 * The ONE shader-side implementation of the sanctioned minimal-edit family
 * (Implementation Master §4.2): the baked-heightfield terrain container that
 * replaces the vendored demo's `intersectCube(...)` / `poolHeight` pool box.
 * Included by every app-owned region shader so the swap exists in exactly
 * one reviewable place. Vendored files are untouched; the stock and pool
 * views keep using them.
 *
 * Units: world meters, y-up, sea level y = uSeaLevel (0). The wave-sim
 * texture (`water`) is declared to the vendored sim shaders at
 * SIM_UNIT_M = 15 m per sim unit (see RegionWater.ts header for the
 * [DERIVED] wave-speed reasoning); its heights convert to meters via
 * uDispScale.
 *
 * Raymarch constants [DERIVED, cp04B §6.1]: fixed step 4 m × 48 steps
 * covers 192 m — beyond underwater visual range (flagged); 6 binary-refine
 * iterations give ≤ 6.25 cm hit precision.
 */

const float RM_STEP = 4.0;
const int RM_STEPS = 48;
const float RM_MAX = 192.0;
const int RM_REFINE = 6;
const float PI_REGION = 3.141592653589793;
/** The approved pool mount scale (Master §7.7) — demo-unit evaluations. */
const float POOL_DU_M = 7.5;

uniform sampler2D uHeightTex; // baked height.r16 → R-float meters, 2049²
uniform sampler2D uShoreMask; // baked shore.png → R 0/1 (255 = land), 2049²
uniform float uSeaLevel;      // 0.0 (Master §2.1)
uniform float uRegionSize;    // 2000 m
uniform float uHeightN;       // 2049 texels per side
uniform vec2 uWindowOrigin;   // sim-window min corner, meters, 0.5 m-snapped
uniform float uWindowSize;    // 256 m
uniform float uDispScale;     // sim-units → meters (SIM_UNIT_M = 15)

/**
 * World xz → height-texture UV, half-texel-centered: grid point i sits at
 * x = -1000 + i·(2000/2048) and texel centers at (i + 0.5)/2049 (the cp04A
 * half-texel law).
 */
vec2 heightUv(vec2 xz) {
  return ((xz + 0.5 * uRegionSize) * ((uHeightN - 1.0) / uRegionSize) + 0.5) / uHeightN;
}

/** terrainHeight(x,z), meters — the single source of truth (Master §2.2). */
float terrainHeight(vec2 xz) {
  return texture2D(uHeightTex, heightUv(xz)).r;
}

/** Shore mask sample: > 0.5 means land (sign-exact vs height by bake law). */
float shoreLand(vec2 xz) {
  return texture2D(uShoreMask, heightUv(xz)).r;
}

/** World xz → wave-sim window UV. */
vec2 windowUv(vec2 xz) {
  return (xz - uWindowOrigin) / uWindowSize;
}

/**
 * Cosine (Hann) falloff over the outer 10 % of the sim window (Master §4.3):
 * 1 in the inner 80 %, easing to 0 at the window edge, 0 outside.
 */
float windowFalloff(vec2 wuv) {
  vec2 e = min(wuv, 1.0 - wuv);
  vec2 w = 0.5 - 0.5 * cos(PI_REGION * clamp(e / 0.1, 0.0, 1.0));
  return w.x * w.y;
}

/** Seabed normal by central differences, 1-texel offset (cp04B §6.1). */
vec3 seabedNormal(vec2 xz) {
  float e = uRegionSize / (uHeightN - 1.0);
  float hx1 = terrainHeight(xz + vec2(e, 0.0));
  float hx0 = terrainHeight(xz - vec2(e, 0.0));
  float hz1 = terrainHeight(xz + vec2(0.0, e));
  float hz0 = terrainHeight(xz - vec2(0.0, e));
  return normalize(vec3(hx0 - hx1, 2.0 * e, hz0 - hz1));
}

/**
 * raymarchSeabed(origin, ray) — the container swap for `intersectCube` /
 * `poolHeight` (Master §4.2 items 1, 2, 4): fixed-step march against the
 * baked height texture; on sign change, 6 binary-refine iterations.
 * Returns the hit parameter t (meters along `ray`), or -1.0 on a miss —
 * above-water rays that clear the tallest peak (+200 m) fall through to
 * the vendored sky sampling, unchanged.
 */
float raymarchSeabed(vec3 origin, vec3 ray) {
  float dPrev = origin.y - terrainHeight(origin.xz);
  if (dPrev <= 0.0) return 0.0;
  float tPrev = 0.0;
  for (int i = 1; i <= RM_STEPS; i++) {
    float t = float(i) * RM_STEP;
    vec3 p = origin + ray * t;
    if (ray.y > 0.0 && p.y > 200.0) return -1.0;
    float d = p.y - terrainHeight(p.xz);
    if (d <= 0.0) {
      float lo = tPrev;
      float hi = t;
      for (int k = 0; k < RM_REFINE; k++) {
        float mid = 0.5 * (lo + hi);
        vec3 m = origin + ray * mid;
        if (m.y - terrainHeight(m.xz) > 0.0) lo = mid;
        else hi = mid;
      }
      return 0.5 * (lo + hi);
    }
    tPrev = t;
  }
  return -1.0;
}
