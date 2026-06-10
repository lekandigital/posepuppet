// SYNC METRIC: per limb, the angle between the 2D landmark limb vector
// (video pixel space) and the avatar's same limb projected to stage screen
// space. Ground truth for "does the character actually copy the person".
// Landmarks passed in must be in the same mirror space the avatar enacts.

import * as THREE from 'three';
import { LM } from '../pose/indices';
import type { LandmarkPoint } from '../pose/types';
import type { Avatar, JointName } from '../rig/types';

export type LimbName =
  | 'leftUpperArm'
  | 'leftForearm'
  | 'rightUpperArm'
  | 'rightForearm'
  | 'torso';

const LIMBS: Record<LimbName, { joints: [JointName, JointName]; lm: [number, number] }> = {
  leftUpperArm: { joints: ['leftShoulder', 'leftElbow'], lm: [LM.leftShoulder, LM.leftElbow] },
  leftForearm: { joints: ['leftElbow', 'leftWrist'], lm: [LM.leftElbow, LM.leftWrist] },
  rightUpperArm: { joints: ['rightShoulder', 'rightElbow'], lm: [LM.rightShoulder, LM.rightElbow] },
  rightForearm: { joints: ['rightElbow', 'rightWrist'], lm: [LM.rightElbow, LM.rightWrist] },
  torso: { joints: ['hipCenter', 'shoulderCenter'], lm: [-1, -1] }, // lm computed from hip/shoulder centers
};

export const UPPER_LIMBS: LimbName[] = [
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
];

const VIS_MIN = 0.5;
const va = new THREE.Vector3();
const vb = new THREE.Vector3();

function projectJoint(
  avatar: Avatar,
  name: JointName,
  camera: THREE.Camera,
  out: THREE.Vector3,
): boolean {
  const j = avatar.joints[name];
  if (!j) return false;
  j.getWorldPosition(out);
  out.project(camera); // NDC
  return true;
}

function centerOf(norm: LandmarkPoint[], a: number, b: number) {
  return {
    x: (norm[a].x + norm[b].x) / 2,
    y: (norm[a].y + norm[b].y) / 2,
    visibility: Math.min(norm[a].visibility, norm[b].visibility),
  };
}

/** Returns per-limb angle error in degrees for one frame (only limbs whose
 *  landmark endpoints are confidently visible). */
export function sampleLimbAngles(
  norm: LandmarkPoint[],
  videoW: number,
  videoH: number,
  avatar: Avatar,
  camera: THREE.Camera,
  stageAspect: number,
): Partial<Record<LimbName, number>> {
  const out: Partial<Record<LimbName, number>> = {};

  for (const limb of Object.keys(LIMBS) as LimbName[]) {
    const def = LIMBS[limb];

    let ax: number, ay: number, bx: number, by: number, vis: number;
    if (limb === 'torso') {
      const hip = centerOf(norm, LM.leftHip, LM.rightHip);
      const sho = centerOf(norm, LM.leftShoulder, LM.rightShoulder);
      ax = hip.x; ay = hip.y; bx = sho.x; by = sho.y;
      vis = Math.min(hip.visibility, sho.visibility);
    } else {
      const [ia, ib] = def.lm;
      vis = Math.min(norm[ia].visibility, norm[ib].visibility);
      ax = norm[ia].x; ay = norm[ia].y; bx = norm[ib].x; by = norm[ib].y;
    }
    if (vis < VIS_MIN) continue;

    // person's limb vector in video pixels (y down)
    let pvx = (bx - ax) * videoW;
    let pvy = (by - ay) * videoH;
    const plen = Math.hypot(pvx, pvy);
    if (plen < 1e-6) continue;
    pvx /= plen; pvy /= plen;

    const [ja, jb] = def.joints;
    if (!projectJoint(avatar, ja, camera, va) || !projectJoint(avatar, jb, camera, vb)) continue;
    // NDC → screen-like (y down), correct for stage aspect
    let avx = (vb.x - va.x) * stageAspect;
    let avy = -(vb.y - va.y);
    const alen = Math.hypot(avx, avy);
    if (alen < 1e-6) continue;
    avx /= alen; avy /= alen;

    const dot = Math.min(1, Math.max(-1, pvx * avx + pvy * avy));
    out[limb] = (Math.acos(dot) * 180) / Math.PI;
  }
  return out;
}

/** Streaming accumulator for per-limb means. */
export class SyncAccumulator {
  private sums = new Map<LimbName, number>();
  private counts = new Map<LimbName, number>();

  add(sample: Partial<Record<LimbName, number>>): void {
    for (const [limb, angle] of Object.entries(sample) as [LimbName, number][]) {
      this.sums.set(limb, (this.sums.get(limb) ?? 0) + angle);
      this.counts.set(limb, (this.counts.get(limb) ?? 0) + 1);
    }
  }

  means(): Partial<Record<LimbName | 'upperLimbsMean', number>> {
    const out: Partial<Record<LimbName | 'upperLimbsMean', number>> = {};
    for (const [limb, sum] of this.sums) {
      out[limb] = sum / this.counts.get(limb)!;
    }
    const upper = UPPER_LIMBS.map((l) => out[l]).filter((v): v is number => v !== undefined);
    if (upper.length > 0) {
      out.upperLimbsMean = upper.reduce((a, b) => a + b, 0) / upper.length;
    }
    return out;
  }
}
