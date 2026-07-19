// ambientCpu — CP05B CPU twin of the ambient ocean-surface motion field
// (RegionAmbient.glsl). The addendum-§5 "breathing sheet" (Master §4.3 Q4):
// a restrained, always-present, deterministic analytic swell that the
// app-owned region surface/caustics shaders ADD to the vendored jeantimex
// windowed-sim displacement, plus a persistent low-level terrain-boundary
// ripple response driven by the baked shore SDF. The vendored wave-sim,
// normal-pass, caustics-fragment, Fresnel/Schlick, Snell and sky math are
// untouched — the ambient field only feeds the existing displacement and
// slope INPUTS of the app-owned copies (an additive, reversible input:
// ampScale = boundaryScale = 0 restores the pre-CP05B surface exactly).
//
// Parity contract: every constant here mirrors RegionAmbient.glsl — change
// them together. The field is pure sin/cos of world position and wrapped
// time; both sides stay within ~1e-3 of each other in fp32 (arguments are
// kept < ~1.1e4 rad; see AMBIENT.WRAP_S).
//
// Determinism: no randomness anywhere; the only time input is the wrapped
// ambient clock owned by regionGame (freezable/settable through the
// __SHARED_WORLD test surface). Every angular frequency is an exact integer
// multiple of 2π/WRAP_S so the wrap at WRAP_S seconds is seamless.

/** The one recorded CP05B parameter table (report §6/§9 of the checkpoint
 *  prompt). All values are [DERIVED] production values, flagged for review. */
export const AMBIENT = {
  /** ambient clock wrap, seconds — all ω are integer multiples of 2π/WRAP_S */
  WRAP_S: 4096,
  /** master ambient amplitude scale (production 1; 0 = pre-CP05B behavior) */
  AMP_SCALE: 1.0,
  /** boundary-response scale (production 1; 0 = no shoreline response) */
  BOUNDARY_SCALE: 1.0,
  /** underwater visibility multiplier on the ambient slope (below-surface
   *  fragment path only) — sanctioned by CP05B §9 "any underwater visibility
   *  multiplier required to make the motion readable" */
  UNDER_MUL: 1.5,
  /** documented bound on |ambient height|, meters (Σ component amps) */
  MAX_HEIGHT_M: 0.07,
  /** carrier components: calm crossing swell (direction °, wavelength m,
   *  amplitude m, period s ≈ WRAP_S/n) */
  components: [
    { dirDeg: 15, wavelengthM: 57, ampM: 0.03, n: 678, phase: 0.0 },
    { dirDeg: 105, wavelengthM: 31, ampM: 0.02, n: 920, phase: 2.399 },
    { dirDeg: 55, wavelengthM: 17, ampM: 0.012, n: 1241, phase: 4.189 },
    { dirDeg: 155, wavelengthM: 9.5, ampM: 0.007, n: 1658, phase: 1.117 },
  ],
  /** slow spatial-temporal amplitude envelopes (gradual variation; break
   *  region-wide synchrony and short loops): m = 0.75 + 0.25·sin(...) */
  modulators: [
    { dirDeg: 40, wavelengthM: 310, n: 87, phase: 0.7 },
    { dirDeg: 120, wavelengthM: 230, n: 58, phase: 3.9 },
  ],
  /** terrain-boundary ripple response (from shore_sdf.r16, + = water):
   *  rings along iso-SDF contours travelling toward shore, exp-decaying
   *  seaward; geometric part tapers to zero at the shoreline so no crest
   *  can touch dry land; slope part is normal-only (cannot move geometry) */
  boundary: {
    wavelengthM: 6,
    n: 1205, // period ≈ 3.40 s
    decayM: 9,
    /** geometric amplitude, m (tapered smoothstep(0.5, 4.0, sdf)) */
    geoAmpM: 0.012,
    /** slope (normal-domain) amplitude, dimensionless */
    slopeAmp: 0.028,
    geoTaper: [0.5, 4.0] as const,
    /** deterministic along-shore phase jitter (breaks ring uniformity) */
    jitter: { kx: 0.07, kz: 0.09, amp: 0.5 },
  },
  /** carrier geometric shore attenuation smoothstep(a, b, sdf), meters —
   *  the CP05B "smallest appropriate terrain-boundary response" damping */
  shoreGeoAtten: [1.0, 7.0] as const,
  /** central-difference step for the SDF gradient (boundary slope dir), m */
  SDF_GRAD_EPS_M: 1.5,
} as const;

const W0 = (2 * Math.PI) / AMBIENT.WRAP_S;
const RAD = Math.PI / 180;

interface Carrier {
  dx: number;
  dz: number;
  k: number;
  a: number;
  w: number;
  phase: number;
}

const CARRIERS: Carrier[] = AMBIENT.components.map((c) => ({
  dx: Math.cos(c.dirDeg * RAD),
  dz: Math.sin(c.dirDeg * RAD),
  k: (2 * Math.PI) / c.wavelengthM,
  a: c.ampM,
  w: c.n * W0,
  phase: c.phase,
}));

const MODS = AMBIENT.modulators.map((m) => ({
  dx: Math.cos(m.dirDeg * RAD),
  dz: Math.sin(m.dirDeg * RAD),
  k: (2 * Math.PI) / m.wavelengthM,
  w: m.n * W0,
  phase: m.phase,
}));

const B = AMBIENT.boundary;
const B_K = (2 * Math.PI) / B.wavelengthM;
const B_W = B.n * W0;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export interface AmbientSample {
  /** geometric surface offset, meters (shore-attenuated — clip-safe) */
  h: number;
  /** shading slope contribution (∂h/∂x, ∂h/∂z domain), incl. boundary */
  sx: number;
  sz: number;
  /** open-water carrier height BEFORE shore attenuation (bounds checks) */
  carrierH: number;
  /** boundary-response slope magnitude alone (hierarchy measurement) */
  boundaryMag: number;
}

/**
 * The ambient field at world (x, z), time t (seconds, caller wraps by
 * WRAP_S), given the local signed shore distance sdf (meters, + = water)
 * and its gradient direction (gx, gz — need not be exactly unit).
 * Mirrors RegionAmbient.glsl ambientSurf(); slope ignores the modulator
 * and attenuation gradients by design (shading approximation — geometry
 * stays clip-safe, documented in the CP05B report).
 */
export function ambientSurfCpu(
  x: number,
  z: number,
  t: number,
  sdf: number,
  gx = 0,
  gz = 0,
  ampScale: number = AMBIENT.AMP_SCALE,
  boundaryScale: number = AMBIENT.BOUNDARY_SCALE,
): AmbientSample {
  const m: number[] = MODS.map(
    (mm) => 0.75 + 0.25 * Math.sin((x * mm.dx + z * mm.dz) * mm.k + mm.w * t + mm.phase),
  );
  let h = 0;
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < CARRIERS.length; i++) {
    const c = CARRIERS[i]!;
    const env = m[i % 2]!;
    const ph = (x * c.dx + z * c.dz) * c.k - c.w * t + c.phase;
    h += c.a * env * Math.sin(ph);
    const d = c.a * env * c.k * Math.cos(ph);
    sx += d * c.dx;
    sz += d * c.dz;
  }
  h *= ampScale;
  sx *= ampScale;
  sz *= ampScale;

  const geoAtten = smoothstep(AMBIENT.shoreGeoAtten[0], AMBIENT.shoreGeoAtten[1], sdf);
  const carrierH = h;
  let outH = h * geoAtten;

  // terrain-boundary response (water side only; gated smoothly at the mask)
  const waterGate = smoothstep(-0.5, 0.5, sdf);
  const decay = Math.exp(-Math.max(sdf, 0) / B.decayM);
  const jitter = B.jitter.amp * (Math.sin(B.jitter.kx * x) + Math.sin(B.jitter.kz * z));
  const bph = B_K * sdf + B_W * t + jitter;
  const bGeo =
    boundaryScale *
    B.geoAmpM *
    decay *
    waterGate *
    smoothstep(B.geoTaper[0], B.geoTaper[1], sdf) *
    Math.sin(bph);
  const gl = Math.hypot(gx, gz);
  const gnx = gl > 1e-6 ? gx / gl : 0;
  const gnz = gl > 1e-6 ? gz / gl : 0;
  const bMag = boundaryScale * B.slopeAmp * decay * waterGate * Math.cos(bph);
  outH += bGeo;
  const bsx = bMag * gnx;
  const bsz = bMag * gnz;

  return {
    h: outH,
    sx: sx + bsx,
    sz: sz + bsz,
    carrierH,
    boundaryMag: Math.abs(bMag) * (gl > 1e-6 ? 1 : 0),
  };
}
