/**
 * REGION AMBIENT OCEAN MOTION — Checkpoint 05B (addendum §5; Master §4.3
 * Q4 "breathing sheet").
 *
 * The ONE shader-side implementation of the CP05B ambient field: a
 * restrained, always-present, deterministic analytic swell plus a
 * persistent low-level terrain-boundary ripple response driven by the
 * baked shore SDF. It is an ADDITIVE, REVERSIBLE input to the app-owned
 * jeantimex-derived surface/caustics shaders:
 *
 *   final displacement = vendored windowed-sim displacement
 *                      + ambient carrier swell (this file)
 *                      + terrain-boundary response (this file)
 *                      + existing local interaction inputs
 *
 * uAmbient.y = uAmbient.z = 0 restores the pre-CP05B surface exactly.
 * The vendored wave-sim math, normal pass, caustics fragment math,
 * Fresnel/Schlick compositing, Snell behavior and sky sampling are
 * untouched — consumers only add this field to the displacement/slope
 * INPUTS the vendored math already consumes.
 *
 * Include AFTER RegionContainer.glsl (uses heightUv()).
 *
 * Parity contract: constants mirror src/water/ambientCpu.ts — change them
 * together. Determinism: pure sin/cos of world position and the wrapped
 * ambient clock (uAmbient.x, wrapped at 4096 s by regionGame); every ω is
 * an exact integer multiple of 2π/4096 so the wrap is seamless; there is
 * no randomness and no frame-rate dependence beyond the clock itself.
 *
 * Clip safety (addendum §5.3 / prompt §7): the GEOMETRIC part attenuates
 * smoothly to zero within ~1 m of the shoreline (carrier) and ~0.5 m
 * (boundary), so no crest can reach dry land; the boundary ripple is
 * otherwise normal-domain only and cannot move geometry.
 */

uniform sampler2D uShoreSdf; // baked shore_sdf.r16 → R-float meters, + = water
uniform vec4 uAmbient;       // x = clock s (wrapped 4096), y = amp scale,
                             // z = boundary scale, w = underwater slope mul

/* carriers: (dir.x, dir.z, k = 2π/λ, amp m) + (ω = n·2π/4096, φ) */
const vec4 AMB_C1 = vec4(0.9659258262890683, 0.25881904510252074, 0.11023132117858924, 0.030);
const vec4 AMB_C2 = vec4(-0.25881904510252074, 0.9659258262890683, 0.2026833970057931, 0.020);
const vec4 AMB_C3 = vec4(0.573576436351046, 0.8191520442889918, 0.36959913571644626, 0.012);
const vec4 AMB_C4 = vec4(-0.9063077870366499, 0.42261826174069944, 0.6613879270715354, 0.007);
const vec2 AMB_W12 = vec2(1.0400389741864647, 1.4112623248547899);
const vec2 AMB_W34 = vec2(1.9036701577560807, 2.5433401463143931);
const vec4 AMB_PHASE = vec4(0.0, 2.399, 4.189, 1.117);

/* slow amplitude envelopes: m = 0.75 + 0.25·sin(k·dot(dir,xz) + ωt + φ) */
const vec4 AMB_M1 = vec4(0.766044443118978, 0.6427876096865393, 0.020268339700579314, 0.13345632854605078);
const vec4 AMB_M2 = vec4(-0.5, 0.8660254037844387, 0.02731823001048109, 0.08897088569736719);
const vec2 AMB_MPHASE = vec2(0.7, 3.9);

/* terrain-boundary response */
const float AMB_B_K = 1.0471975511965976;      // 2π/6 m
const float AMB_B_W = 1.8484468494522477;      // n = 1205 → T ≈ 3.40 s
const float AMB_B_DECAY = 9.0;                 // seaward e-fold, m
const float AMB_B_GEO = 0.012;                 // geometric amp, m
const float AMB_B_SLOPE = 0.028;               // normal-domain amp
const float AMB_SDF_EPS = 1.5;                 // SDF gradient step, m

float ambientSdf(vec2 xz) {
  return texture2D(uShoreSdf, heightUv(xz)).r;
}

/**
 * The CP05B ambient field: returns vec3(geometric height m, slope x,
 * slope z). Slope ignores the envelope/attenuation gradients by design
 * (shading approximation; geometry stays clip-safe — see ambientCpu.ts).
 */
vec3 ambientSurf(vec2 xz) {
  float t = uAmbient.x;
  float sdf = ambientSdf(xz);

  vec2 env = 0.75 + 0.25 * sin(vec2(
    dot(xz, AMB_M1.xy) * AMB_M1.z + AMB_M1.w * t,
    dot(xz, AMB_M2.xy) * AMB_M2.z + AMB_M2.w * t
  ) + AMB_MPHASE);

  vec4 amp = vec4(AMB_C1.w * env.x, AMB_C2.w * env.y, AMB_C3.w * env.x, AMB_C4.w * env.y);
  vec4 ph = vec4(
    dot(xz, AMB_C1.xy) * AMB_C1.z,
    dot(xz, AMB_C2.xy) * AMB_C2.z,
    dot(xz, AMB_C3.xy) * AMB_C3.z,
    dot(xz, AMB_C4.xy) * AMB_C4.z
  ) - vec4(AMB_W12, AMB_W34) * t + AMB_PHASE;

  vec4 s = sin(ph);
  vec4 c = cos(ph);
  float h = uAmbient.y * dot(amp, s);
  vec4 d = uAmbient.y * amp * vec4(AMB_C1.z, AMB_C2.z, AMB_C3.z, AMB_C4.z) * c;
  vec2 slope = d.x * AMB_C1.xy + d.y * AMB_C2.xy + d.z * AMB_C3.xy + d.w * AMB_C4.xy;

  /* geometric shore attenuation (smallest boundary damping, prompt §7) */
  h *= smoothstep(1.0, 7.0, sdf);

  /* boundary response: rings along iso-SDF contours travelling shoreward */
  float waterGate = smoothstep(-0.5, 0.5, sdf);
  float decay = exp(-max(sdf, 0.0) / AMB_B_DECAY);
  float jitter = 0.5 * (sin(0.07 * xz.x) + sin(0.09 * xz.y));
  float bph = AMB_B_K * sdf + AMB_B_W * t + jitter;
  h += uAmbient.z * AMB_B_GEO * decay * waterGate * smoothstep(0.5, 4.0, sdf) * sin(bph);

  vec2 g = vec2(
    ambientSdf(xz + vec2(AMB_SDF_EPS, 0.0)) - ambientSdf(xz - vec2(AMB_SDF_EPS, 0.0)),
    ambientSdf(xz + vec2(0.0, AMB_SDF_EPS)) - ambientSdf(xz - vec2(0.0, AMB_SDF_EPS))
  );
  float gl = length(g);
  vec2 gn = gl > 1e-6 ? g / gl : vec2(0.0);
  slope += uAmbient.z * AMB_B_SLOPE * decay * waterGate * cos(bph) * gn;

  return vec3(h, slope);
}
