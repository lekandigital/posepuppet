// Time-of-day cycle (Checkpoint 05C — BodyArcade addition on top of the
// WaterThreeJS port; ocean-replacement addendum §4.6). The demo exposes sun
// elevation/azimuth as GUI values applied through applySun(); this module
// drives them on a continuous, deterministic day arc.
//
// Determinism: `phase` advances from the render frame delta × speed
// multiplier — never wall clock — and is freezable/settable through the
// test surface, so fixed-phase captures reproduce exactly.

import type { SunParams } from './presets';

export const TOD = {
  /** full day-cycle period at speedMul 1 (~11 min) */
  PERIOD_S: 660,
  /** noon sun elevation, degrees */
  EL_MAX_DEG: 62,
  /** deepest night elevation, degrees (atmosphere clamps at 0 — the night
   *  look comes from the applySun light dimmer) */
  EL_NIGHT_MIN_DEG: -12,
  /** fraction of the cycle occupied by daytime (dawn → sunset) */
  DAY_FRAC: 0.82,
  /** dawn azimuth, degrees (east-ish; rotates a full 360° per cycle) */
  AZ0_DEG: 95,
} as const;

export interface SunAngles {
  elevationDeg: number;
  azimuthDeg: number;
}

/** Pure curve: cycle phase ∈ [0,1) → sun angles. Day occupies DAY_FRAC of
 *  the cycle (elevation EL_MAX·sin over a stretched half-turn); the night
 *  remainder dips to EL_NIGHT_MIN; azimuth rotates continuously. */
export function sunAnglesAt(phase: number): SunAngles {
  const p = ((phase % 1) + 1) % 1;
  let elevationDeg: number;
  if (p < TOD.DAY_FRAC) {
    const a = Math.PI * (p / TOD.DAY_FRAC);
    elevationDeg = TOD.EL_MAX_DEG * Math.sin(a);
  } else {
    const a = Math.PI * ((p - TOD.DAY_FRAC) / (1 - TOD.DAY_FRAC));
    elevationDeg = TOD.EL_NIGHT_MIN_DEG * Math.sin(a);
  }
  return { elevationDeg, azimuthDeg: (TOD.AZ0_DEG + 360 * p) % 360 };
}

export interface TimeOfDayState {
  phase: number;
  speedMul: number;
  frozen: boolean;
  periodS: number;
  elevationDeg: number;
  azimuthDeg: number;
}

export interface TimeOfDay {
  /** advance by a render-frame delta (seconds) and apply to the sun */
  advance(dtS: number): void;
  /** test/GUI control; re-applies the sun immediately */
  set(patch: { phase?: number; speedMul?: number; frozen?: boolean }): void;
  state(): TimeOfDayState;
  /** mutable speed multiplier (bound directly by the debug GUI) */
  speedMul: number;
  /** mutable pause flag (bound directly by the debug GUI) */
  frozen: boolean;
  /** current phase (advance()/set() write it; GUI scrubber binds it) */
  phase: number;
}

export function createTimeOfDay(
  sunParams: SunParams,
  applySun: () => void,
  initialPhase = 0.2,
): TimeOfDay {
  const tod: TimeOfDay = {
    phase: ((initialPhase % 1) + 1) % 1,
    speedMul: 1,
    frozen: false,
    advance(dtS: number) {
      if (!tod.frozen) {
        tod.phase = (tod.phase + (dtS * tod.speedMul) / TOD.PERIOD_S) % 1;
      }
      const a = sunAnglesAt(tod.phase);
      sunParams.elevation = a.elevationDeg;
      sunParams.azimuth = a.azimuthDeg;
      applySun();
    },
    set(patch) {
      if (patch.phase !== undefined) tod.phase = ((patch.phase % 1) + 1) % 1;
      if (patch.speedMul !== undefined) tod.speedMul = patch.speedMul;
      if (patch.frozen !== undefined) tod.frozen = patch.frozen;
      const a = sunAnglesAt(tod.phase);
      sunParams.elevation = a.elevationDeg;
      sunParams.azimuth = a.azimuthDeg;
      applySun();
    },
    state() {
      const a = sunAnglesAt(tod.phase);
      return {
        phase: tod.phase,
        speedMul: tod.speedMul,
        frozen: tod.frozen,
        periodS: TOD.PERIOD_S,
        elevationDeg: a.elevationDeg,
        azimuthDeg: a.azimuthDeg,
      };
    },
  };
  return tod;
}
