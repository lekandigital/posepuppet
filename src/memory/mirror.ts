// Mirror playback: sagittal-plane reflection expressed in landmark space,
// where the loops live — negate world x, reflect norm x (x → 1 − x), and
// swap every left/right landmark pair. Fed through the Retargeter this
// yields exactly the sagittal-plane quaternion reflection on the rig, with
// correct handedness by construction (a right-hand wave replays as a true
// left-hand wave — verified in tests/memory.spec.ts against a ground-truth
// mirrored render). A playback option only: never stored in the loop.

import type { LandmarkPoint, HandPoint } from '@bodyarcade/pose-runtime';
import type { LoopCapture, LoopFrame } from './stream';
import { decodePoseFrame, encodePoseFrame, decodeHandFrame, encodeHandFrame, blankLandmarks, blankHand } from './stream';

/** MediaPipe pose left/right index pairs (0 = nose stays put). */
const POSE_SWAP: ReadonlyArray<readonly [number, number]> = [
  [1, 4], [2, 5], [3, 6],       // eyes
  [7, 8],                       // ears
  [9, 10],                      // mouth corners
  [11, 12], [13, 14], [15, 16], // shoulders, elbows, wrists
  [17, 18], [19, 20], [21, 22], // pinky, index, thumb
  [23, 24], [25, 26], [27, 28], // hips, knees, ankles
  [29, 30], [31, 32],           // heels, foot index
];

export function mirrorPoseInPlace(world: LandmarkPoint[], norm: LandmarkPoint[]): void {
  for (const [l, r] of POSE_SWAP) {
    const wl = world[l];
    world[l] = world[r];
    world[r] = wl;
    const nl = norm[l];
    norm[l] = norm[r];
    norm[r] = nl;
  }
  for (let i = 0; i < 33; i++) {
    world[i].x = -world[i].x;
    norm[i].x = 1 - norm[i].x;
  }
}

/** A single tracked hand mirrors by x reflection alone (the landmark
 *  topology is handedness-agnostic; the reflection flips which hand the
 *  motion reads as). */
export function mirrorHandInPlace(norm: HandPoint[]): void {
  for (let i = 0; i < 21; i++) norm[i].x = 1 - norm[i].x;
}

/** Materialized mirrored copy of a loop — used by tests and by anything
 *  that wants the reflection as data rather than as a playback flag. */
export function mirrorLoop<T extends LoopCapture>(loop: T): T {
  const world = blankLandmarks();
  const norm = blankLandmarks();
  const hand = blankHand();
  const frames: LoopFrame[] = loop.frames.map((f) => {
    if (loop.kind === 'pose') {
      decodePoseFrame(f, world, norm);
      mirrorPoseInPlace(world, norm);
      return encodePoseFrame(world, norm, f.t);
    }
    decodeHandFrame(f, hand);
    mirrorHandInPlace(hand);
    return encodeHandFrame(hand, f.t);
  });
  return { ...loop, frames };
}
