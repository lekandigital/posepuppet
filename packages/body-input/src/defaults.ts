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
