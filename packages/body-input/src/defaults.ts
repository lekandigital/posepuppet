// Default shaping + extraction config. Dead zones are PLACEHOLDERS until
// the jitter-floor tool (tools/jitter-floor.mjs) measures still.mp4 and
// rewrites them with provenance — do not hand-tune them past that point.

import type { AxisName, AxisShapingConfig, BodyInputConfig, DeepPartial } from './types';

// [jitter-floor:begin] measured from fixtures/flight/still.mp4 by
// tools/jitter-floor.mjs on 2026-07-07 (450 samples over 15s,
// p95 |raw| noise × 1.2, clamped to [0.01, 0.2]). Do not hand-tune —
// re-run the tool instead.
export const MEASURED_DEAD_ZONES: Record<AxisName, number> = {
  leanX: 0.024,
  leanY: 0.123,
  crouch: 0.017,
  tallness: 0.01,
  armsOut: 0.01,
  armsRaised: 0.01,
  handsForward: 0.01,
  handPoint: 0.068,
};
// [jitter-floor:end]

function axis(name: AxisName, over: Partial<AxisShapingConfig> = {}): AxisShapingConfig {
  return {
    oneEuro: { minCutoff: 1.2, beta: 0.02 },
    deadZone: MEASURED_DEAD_ZONES[name],
    expo: 0,
    slewPerSec: 5,
    decayTauMs: 500,
    ...over,
    ...(over.oneEuro ? { oneEuro: over.oneEuro } : {}),
  };
}

export function defaultConfig(): BodyInputConfig {
  return {
    axes: {
      leanX: axis('leanX', { expo: 0.3, slewPerSec: 6 }),
      leanY: axis('leanY', { expo: 0.3, slewPerSec: 6 }),
      crouch: axis('crouch', { slewPerSec: 3 }),
      tallness: axis('tallness', { slewPerSec: 3 }),
      armsOut: axis('armsOut'),
      armsRaised: axis('armsRaised'),
      handsForward: axis('handsForward', { slewPerSec: 6 }),
      handPoint: axis('handPoint'),
    },
    extraction: {
      maxLeanXDeg: 15,
      maxLeanYDeg: 12,
      crouchRange: 0.3,
      tallnessRange: 0.06,
      fallbackCrouchWidths: 1.2,
      fallbackTallWidths: 0.4,
      fallbackLeanYWidths: 0.3,
      motionScale: 0.5,
      visGate: 0.5,
      seatedThighDeg: 35,
      seatedEnterMs: 1500,
      seatedExitMs: 1500,
    },
    events: {
      recenter: { armsOutMin: 0.8, armsRaisedMax: 0.35, holdMs: 1000, refractoryMs: 2500 },
      action: { enter: 0.75, exit: 0.55, minRatePerSec: 1.2, debounceFrames: 3, refractoryMs: 1000 },
      minConfidence: 0.5,
    },
    stroke: {
      // Position filter is deliberately heavier than the axis filters —
      // reversal detection wants a clean turn, not responsiveness (latency
      // rides on reversalHys anyway). Starting values; the rowing fixture
      // eval is the arbiter and revisions are logged in DECISIONS.md.
      oneEuro: { minCutoff: 0.8, beta: 0.01 },
      // ~4 cm of hand travel on a 65 cm arm — well above the handsForward
      // jitter floor (0.01 arm lengths on still.mp4), well below a real
      // stroke (spec'd ~30 cm ≈ 0.45 arm lengths).
      reversalHys: 0.06,
      minAmp: 0.15,
      minHalfPeriodMs: 250,
      maxPeriodMs: 4000,
      rateDecayTauMs: 1000,
    },
    swim: {
      // Torso-wave (dolphin kick): the signal is vertical chest–hip extent
      // in image space, self-normalized by a slow EMA (refTauMs), so its
      // units are fractions of the resting extent (~1.0 at rest). Floors
      // measured on existing fixtures 2026-07-11 (fixture-eval swim rows):
      // still.mp4 amp p99 = 0.0000; lean_lr 0 kicks; the load-bearing
      // negative is lean_fb — ALTERNATING fwd/back lean cycles modulate
      // extent by ~0.03–0.05 at a ~6–8 s cadence and scored 3 kicks under
      // the first gates (minAmp 0.045, maxPeriod 5000). Revised from that
      // measurement: minAmp 0.055 sits above the lean-tilt crosstalk band
      // (a deliberate wave reads 0.1–0.2), and maxPeriodMs 3200 breaks
      // rhythms slower than ~0.31 Hz (lean alternations) while keeping the
      // slow-wave spec (24–30 waves/min = 0.4–0.5 Hz) comfortably inside.
      oneEuro: { minCutoff: 0.8, beta: 0.01 },
      reversalHys: 0.02,
      minAmp: 0.055,
      minHalfPeriodMs: 300,
      maxPeriodMs: 3200,
      rateDecayTauMs: 1200,
      refTauMs: 8000,
    },
    gait: {
      // Step detection wants responsiveness (a fast march reverses every
      // ~330 ms) — lighter filtering than rowing's, latency still riding
      // on the hysteresis. Starting values; the synthetic-stream evals +
      // fixture negative rows are the arbiter (revisions in DECISIONS.md).
      march: {
        // Units: thigh lengths of knee-lift DIFFERENCE between the legs.
        // A deliberate march swings ±0.4..1.0 (peak-to-peak 0.8+); the
        // still/lean/crouch fixtures keep the difference under ~0.1.
        oneEuro: { minCutoff: 1.4, beta: 0.02 },
        reversalHys: 0.07,
        minAmp: 0.22,
        ampNorm: 0.9,
        shiftScale: 1.6,
      },
      sway: {
        // Units: shoulder widths of lateral hip-center excursion, DC-
        // removed by the refTauMs EMA. A deliberate weight shift sways
        // ±0.1..0.4; lean-turn crosstalk lives below ~0.06 (lean rotates
        // the torso about the hips more than it translates them) — the
        // fixture-eval negative rows (lean_lr especially) measure this.
        oneEuro: { minCutoff: 1.2, beta: 0.015 },
        reversalHys: 0.03,
        minAmp: 0.08,
        ampNorm: 0.45,
        shiftScale: 2.5,
        refTauMs: 6000,
      },
      // Physiology: 37 spm (slow deliberate march) .. 273 spm rejects
      // tremor; the load-bearing negative is slow alternating leans at
      // ~0.1–0.35 Hz — their half-cycles exceed maxStepMs and never
      // establish a rhythm (the swim detector's lesson).
      minStepMs: 220,
      maxStepMs: 1600,
      cadenceDecayTauMs: 900,
    },
    confidenceTauMs: 150,
    confidenceDecayTauMs: 300,
    provisionalNeutralMs: 800,
  };
}

export const AXIS_NAMES: readonly AxisName[] = [
  'leanX', 'leanY', 'crouch', 'tallness', 'armsOut', 'armsRaised', 'handsForward', 'handPoint',
] as const;

/** Plain-object deep merge for config overrides (arrays replaced, not merged). */
export function mergeConfig(base: BodyInputConfig, over?: DeepPartial<BodyInputConfig>): BodyInputConfig {
  if (!over) return base;
  return deepMerge(base, over) as BodyInputConfig;
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (
    typeof base !== 'object' || base === null || Array.isArray(base) ||
    typeof over !== 'object' || over === null || Array.isArray(over)
  ) {
    return over;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], v);
  }
  return out;
}
