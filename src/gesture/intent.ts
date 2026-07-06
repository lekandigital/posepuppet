// Gesture/intent SEED layer. Consumes normalized (mirrored) pose
// landmarks, emits high-level intents. By design this layer has exactly
// ONE consumer this pass: hands-free take control (start / advance /
// stop). Future body-controlled play could add intents here — as types
// only, per the mission's DO-NOT-BUILD list (no games, no scoring).

import { LM } from '../pose/indices';
import type { LandmarkPoint } from '../pose/types';

export type Intent =
  | 'take:start' // both wrists held above the head for ~1 s
  | 'take:stop'; // wrists crossed in front of the chest for ~1 s
// future (types only, never built this pass): 'play:*' intents

export interface IntentDetector {
  /** Feed one frame of mirrored normalized landmarks (or null). */
  onLandmarks(norm: LandmarkPoint[] | null, wallMs: number): void;
  /** Register the single consumer. */
  onIntent(cb: (intent: Intent) => void): void;
  /** True while the person is holding still (shot-advance signal). */
  holdingStill(): boolean;
  reset(): void;
}

const HOLD_MS = 900; // gesture dwell before it fires
const REFIRE_MS = 2500; // ignore repeats after firing
const STILL_WINDOW_MS = 1200;
const STILL_EPS = 0.018; // normalized-units of wrist wobble that still count as "still"

export function createIntentDetector(): IntentDetector {
  let cb: ((intent: Intent) => void) | null = null;
  let startHeldSince = 0;
  let stopHeldSince = 0;
  let lastFired = -Infinity; // 0 would suppress intents near t=0
  const wristTrail: { x: number; y: number; t: number }[] = [];

  function fire(intent: Intent, now: number): void {
    if (now - lastFired < REFIRE_MS) return;
    lastFired = now;
    startHeldSince = 0;
    stopHeldSince = 0;
    cb?.(intent);
  }

  return {
    onLandmarks(norm, now) {
      if (!norm) {
        startHeldSince = 0;
        stopHeldSince = 0;
        return;
      }
      const lw = norm[LM.leftWrist];
      const rw = norm[LM.rightWrist];
      const nose = norm[LM.nose];
      const ls = norm[LM.leftShoulder];
      const rs = norm[LM.rightShoulder];
      if (Math.min(lw.visibility, rw.visibility, nose.visibility) < 0.5) {
        startHeldSince = 0;
        stopHeldSince = 0;
        return;
      }

      // START: both wrists clearly above the head (y up = smaller in norm)
      const aboveHead = lw.y < nose.y - 0.06 && rw.y < nose.y - 0.06;
      if (aboveHead) {
        if (!startHeldSince) startHeldSince = now;
        if (now - startHeldSince > HOLD_MS) fire('take:start', now);
      } else {
        startHeldSince = 0;
      }

      // STOP: wrists crossed in front of the chest — left wrist on the
      // right side of the body midline and vice versa, at chest height
      const midX = (ls.x + rs.x) / 2;
      const chestY = (ls.y + rs.y) / 2;
      const crossed =
        lw.x < midX && rw.x > midX && // sides swapped (mirrored space)
        Math.abs(lw.y - chestY) < 0.22 && Math.abs(rw.y - chestY) < 0.22 &&
        Math.abs(lw.x - rw.x) < 0.16;
      if (crossed) {
        if (!stopHeldSince) stopHeldSince = now;
        if (now - stopHeldSince > HOLD_MS) fire('take:stop', now);
      } else {
        stopHeldSince = 0;
      }

      // stillness (shot advance): wrist centroid wobble over a window
      wristTrail.push({ x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2, t: now });
      while (wristTrail.length && wristTrail[0].t < now - STILL_WINDOW_MS) wristTrail.shift();
    },
    onIntent(fn) {
      cb = fn; // single consumer, by design
    },
    holdingStill() {
      if (wristTrail.length < 12) return false;
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const p of wristTrail) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      return maxX - minX < STILL_EPS && maxY - minY < STILL_EPS;
    },
    reset() {
      startHeldSince = 0;
      stopHeldSince = 0;
      wristTrail.length = 0;
    },
  };
}
