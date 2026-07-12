// Default locomotion + comfort configuration. The COMFORT block is the
// tested envelope (tests/locomotion.spec.ts asserts no input sequence can
// exceed it); consumers may lower caps, never raise them past what their
// own comfort test covers. Values chosen from VR/first-person comfort
// practice: sub-jog speeds, sub-0.4 g accelerations, smooth yaw well
// under vection-trigger rates, and a duck that eases instead of stepping.

import type { DeepPartial, LocomotionConfig } from './types';

export function defaultLocomotionConfig(): LocomotionConfig {
  return {
    comfort: {
      maxSpeed: 2.4,
      maxAccel: 2.5,
      maxDecel: 3.5,
      maxYawRateDps: 45,
      maxYawAccelDps2: 180,
      eyeHeight: 1.6,
      duckDrop: 0.55,
      eyeSlewPerS: 0.9,
      vignette: { enabled: true, yawRateOnDps: 18, accelOn: 1.2, max: 0.55, slewPerS: 2.5 },
    },
    strideM: 0.62,
    ampRef: 0.55,
    ampFloor: 0.55,
    leanTurnDps: 40,
    leanYieldThreshold: 0.22,
    crouchOn: 0.35,
    duckSpeedScale: 0.45,
    glide: { leanOn: 0.12, maxSpeed: 2.0 },
    assist: {
      mode: 'full',
      maxDps: 14,
      alignGain: 0.6,
      lateralGain: 9,
      shoulderM: 0.6,
    },
    autopilot: { decel: 1.3, reentryMs: 500, minConfidence: 0.35 },
    keyboard: { speed: 2.0, backSpeed: 0.9, turnDps: 40 },
  };
}

/** Plain-object deep merge for config overrides (arrays replaced). */
export function mergeLocomotionConfig(
  base: LocomotionConfig,
  over?: DeepPartial<LocomotionConfig>,
): LocomotionConfig {
  if (!over) return base;
  return deepMerge(base, over) as LocomotionConfig;
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
