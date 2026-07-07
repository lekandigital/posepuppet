// Synthetic occlusion masks for the PPC eval: deterministic visibility
// blackouts over existing fixture footage, keyed on VIDEO time so looping
// fixtures repeat the same occlusion events every loop (more samples, zero
// nondeterminism). The same frame provides ground truth: the collector
// records the pre-mask landmarks, the masked copy feeds the pipeline.
//
// Masks zero the visibility channel (and 'all' windows drop the whole
// frame, emulating a detector dropout). Positions are left intact in the
// masked copy but nothing downstream reads a landmark below its gate —
// PPC itself only buffers samples with vis ≥ 0.5.
//
// Specs are data. Window times must sit inside the source clip duration
// (arms 12.3 s, fast 12.4 s, fullbody 34.5 s, facetouch 65.3 s).

import type { LandmarkPoint } from '../pose/types';
import { PPC_GROUP_MEMBERS, type PpcGroupName } from '../pose/continuity';

export type MaskGroup = PpcGroupName | 'all';

export interface MaskWindow {
  /** video-time start (ms) */
  tMs: number;
  durMs: number;
  group: MaskGroup;
}

export interface MaskSpec {
  name: string;
  fixture: string;
  /** source clip length (ms): the fake webcam loops the clip but its video
   *  time is monotonic, so windows apply modulo this — occlusion events
   *  repeat every loop for more samples */
  loopMs: number;
  windows: MaskWindow[];
}

export const MASKS: Record<string, MaskSpec> = {
  // a hand (whole forearm chain) leaves the frame mid-gesture, both sides,
  // plus one long window that runs past the horizon into RELAXED
  arms_hand_exit: {
    name: 'arms_hand_exit',
    fixture: 'arms',
    loopMs: 12310,
    windows: [
      { tMs: 2500, durMs: 350, group: 'leftArm' },
      { tMs: 5200, durMs: 300, group: 'rightArm' },
      { tMs: 8000, durMs: 400, group: 'leftArm' },
      { tMs: 10400, durMs: 800, group: 'rightArm' }, // → RELAXED, re-entry from deep
    ],
  },
  // a hand crosses the face: face landmarks blink out, arms too
  facetouch_face_cross: {
    name: 'facetouch_face_cross',
    fixture: 'facetouch',
    loopMs: 65339,
    windows: [
      { tMs: 5000, durMs: 300, group: 'head' },
      { tMs: 12000, durMs: 350, group: 'leftArm' },
      { tMs: 20000, durMs: 400, group: 'head' },
      { tMs: 28000, durMs: 300, group: 'rightArm' },
      { tMs: 36000, durMs: 250, group: 'head' },
      { tMs: 44000, durMs: 400, group: 'leftArm' },
      { tMs: 52000, durMs: 350, group: 'rightArm' },
    ],
  },
  // a foot disappears while stepping
  fullbody_foot_out: {
    name: 'fullbody_foot_out',
    fixture: 'fullbody',
    loopMs: 34458,
    windows: [
      { tMs: 4000, durMs: 350, group: 'leftLeg' },
      { tMs: 9000, durMs: 400, group: 'rightLeg' },
      { tMs: 15000, durMs: 300, group: 'leftLeg' },
      { tMs: 21000, durMs: 350, group: 'rightLeg' },
      { tMs: 27000, durMs: 700, group: 'leftLeg' }, // → RELAXED
    ],
  },
  // brief full dropouts + an arm blackout during fast motion (blur analog)
  fast_dropout: {
    name: 'fast_dropout',
    fixture: 'fast',
    loopMs: 12422,
    windows: [
      { tMs: 3000, durMs: 300, group: 'all' },
      { tMs: 6000, durMs: 350, group: 'leftArm' },
      { tMs: 9000, durMs: 250, group: 'all' },
    ],
  },
};

export interface MaskResult {
  world: LandmarkPoint[] | null;
  norm: LandmarkPoint[] | null;
  /** landmark indices masked this frame (empty = clean frame) */
  masked: number[];
  /** true when the whole frame was dropped ('all' window) */
  dropped: boolean;
}

export interface Masker {
  apply(world: LandmarkPoint[], norm: LandmarkPoint[], videoTimeMs: number): MaskResult;
  spec: MaskSpec;
}

export function createMasker(spec: MaskSpec): Masker {
  const mWorld: LandmarkPoint[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const mNorm: LandmarkPoint[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const result: MaskResult = { world: mWorld, norm: mNorm, masked: [], dropped: false };

  return {
    spec,
    apply(world, norm, videoTimeMs) {
      result.masked.length = 0;
      result.dropped = false;
      const t = videoTimeMs % spec.loopMs;
      let active: MaskWindow | null = null;
      for (const w of spec.windows) {
        if (t >= w.tMs && t < w.tMs + w.durMs) {
          active = w;
          break;
        }
      }
      if (active?.group === 'all') {
        result.world = null;
        result.norm = null;
        result.dropped = true;
        for (let i = 0; i < 33; i++) result.masked.push(i);
        return result;
      }
      result.world = mWorld;
      result.norm = mNorm;
      const maskedSet = active ? PPC_GROUP_MEMBERS[active.group] : null;
      for (let i = 0; i < 33; i++) {
        const hide = maskedSet?.includes(i) ?? false;
        mWorld[i].x = world[i].x;
        mWorld[i].y = world[i].y;
        mWorld[i].z = world[i].z;
        mWorld[i].visibility = hide ? 0 : world[i].visibility;
        mNorm[i].x = norm[i].x;
        mNorm[i].y = norm[i].y;
        mNorm[i].z = norm[i].z;
        mNorm[i].visibility = hide ? 0 : norm[i].visibility;
        if (hide) result.masked.push(i);
      }
      return result;
    },
  };
}
