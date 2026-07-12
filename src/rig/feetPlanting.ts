// Feet v2: planted-foot detection feeding the planted-leg IK in the
// retargeter.
//
// Detection runs on NORMALIZED landmarks (image space, y down): a foot is
// planted when it sits at the ground line (rolling lowest-foot baseline),
// moves slowly, and is confidently visible. Enactment lives in
// retarget.ts: a planted ankle gets a captured world anchor and the leg
// solves two-bone IK toward it every frame — feet decouple from root
// sway, which is the only thing that actually kills skating (a root
// correction servo and a both-planted root freeze were both measured to
// merely REDISTRIBUTE the slide — eval A/B 2026-07-12, DECISIONS §V5).

import * as THREE from 'three';

/** normalized-y band above the ground line that still counts as grounded */
const GROUND_BAND = 0.045;
/** unplant when the foot rises this far off the ground line */
const LIFT_BAND = 0.075;
/** plant requires foot speed below this (normalized units / s) */
const PLANT_MAX_SPEED = 0.35;
/** unplant when speed exceeds this (hysteresis) */
const LIFT_SPEED = 0.7;
const VIS_MIN = 0.55;

export interface FootInput {
  x: number;
  y: number;
  visibility: number;
}

interface FootState {
  planted: boolean;
  /** eased 0..1 — drives the leg-IK blend and foot leveling */
  weight: number;
  anchor: THREE.Vector3; // avatar ankle world position at plant time
  hasAnchor: boolean;
  prevX: number;
  prevY: number;
  prevMs: number;
  speed: number; // smoothed, normalized units/s
  plantEvents: number;
}

export class FeetPlanting {
  private feet: Record<'left' | 'right', FootState> = {
    left: this.freshFoot(),
    right: this.freshFoot(),
  };
  /** rolling ground line: the lowest (largest-y) foot seen recently */
  private groundY: number | null = null;

  private freshFoot(): FootState {
    return {
      planted: false,
      weight: 0,
      anchor: new THREE.Vector3(),
      hasAnchor: false,
      prevX: 0,
      prevY: 0,
      prevMs: 0,
      speed: 0,
      plantEvents: 0,
    };
  }

  reset(): void {
    this.feet.left = this.freshFoot();
    this.feet.right = this.freshFoot();
    this.groundY = null;
  }

  /** Per pose frame: update plant states from normalized foot landmarks.
   *  Call with null inputs (or low visibility) to release feet. */
  updateDetection(
    left: FootInput | null,
    right: FootInput | null,
    frameMs: number,
  ): void {
    // ground line: EMA toward the lowest visible foot; tracks camera
    // reframing without letting a lifted foot raise the floor
    let lowest = -Infinity;
    for (const f of [left, right]) {
      if (f && f.visibility > VIS_MIN && f.y > lowest) lowest = f.y;
    }
    if (lowest > -Infinity) {
      this.groundY =
        this.groundY === null ? lowest : this.groundY + (lowest - this.groundY) * (lowest > this.groundY ? 0.25 : 0.02);
    }

    for (const side of ['left', 'right'] as const) {
      const st = this.feet[side];
      const f = side === 'left' ? left : right;
      if (!f || f.visibility < VIS_MIN || this.groundY === null) {
        st.planted = false;
        st.hasAnchor = false;
        continue;
      }
      if (st.prevMs > 0 && frameMs > st.prevMs) {
        const dt = Math.max((frameMs - st.prevMs) / 1000, 1e-3);
        const v = Math.hypot(f.x - st.prevX, f.y - st.prevY) / dt;
        st.speed += (v - st.speed) * 0.4;
      }
      st.prevX = f.x;
      st.prevY = f.y;
      st.prevMs = frameMs;

      const heightAboveGround = this.groundY - f.y; // positive = above the line
      if (st.planted) {
        if (heightAboveGround > LIFT_BAND || st.speed > LIFT_SPEED) {
          st.planted = false;
          st.hasAnchor = false;
        }
      } else if (heightAboveGround < GROUND_BAND && st.speed < PLANT_MAX_SPEED) {
        st.planted = true;
        st.hasAnchor = false; // anchor captured on the next enact pass
        st.plantEvents++;
      }
    }
  }

  /** Capture the world anchor for a freshly planted foot (idempotent:
   *  only the first call after a plant sets it). Returns the anchor, or
   *  null when the foot isn't planted. The planted-leg IK aims the ankle
   *  here every frame — feet decouple from root sway instead of skating. */
  anchorFor(side: 'left' | 'right', currentAnkleWorld: THREE.Vector3): THREE.Vector3 | null {
    const st = this.feet[side];
    if (!st.planted) return null;
    if (!st.hasAnchor) {
      st.anchor.copy(currentAnkleWorld);
      st.hasAnchor = true;
    }
    return st.anchor;
  }

  /** The person genuinely moved beyond leg reach — release the plant so
   *  the step proceeds on normal FK instead of a stretched leg. */
  forceRelease(side: 'left' | 'right'): void {
    this.feet[side].planted = false;
    this.feet[side].hasAnchor = false;
  }

  /** Render tick: ease per-foot IK weights. */
  tick(dt: number): void {
    for (const side of ['left', 'right'] as const) {
      const st = this.feet[side];
      const target = st.planted ? 1 : 0;
      const k = 1 - Math.exp(-dt / (st.planted ? 0.08 : 0.15));
      st.weight += (target - st.weight) * k;
    }
  }

  /** Weight distribution −1 (all left) … +1 (all right) from hip center x
   *  between the ankles; null when stance is unknown. Feeds the hips roll. */
  weightShift(hipX: number, leftX: number, rightX: number): number | null {
    if (!this.feet.left.planted && !this.feet.right.planted) return null;
    const span = Math.abs(rightX - leftX);
    if (span < 0.02) return null;
    const mid = (leftX + rightX) / 2;
    return THREE.MathUtils.clamp(((hipX - mid) / span) * 2, -1, 1);
  }

  isPlanted(side: 'left' | 'right'): boolean {
    return this.feet[side].planted;
  }
  plantedWeight(side: 'left' | 'right'): number {
    return this.feet[side].weight;
  }
  plantEvents(side: 'left' | 'right'): number {
    return this.feet[side].plantEvents;
  }
}
