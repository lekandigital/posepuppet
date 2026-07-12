import type * as THREE from 'three';

/** Humanoid bone names shared by the robot and (later) VRM avatars. */
export type BoneName =
  | 'hips'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

/** Joint anchor points used for the screen-space sync metric. */
export type JointName =
  | 'hipCenter'
  | 'shoulderCenter'
  | 'head'
  | 'leftShoulder'
  | 'leftElbow'
  | 'leftWrist'
  | 'rightShoulder'
  | 'rightElbow'
  | 'rightWrist'
  | 'leftHip'
  | 'leftKnee'
  | 'leftAnkle'
  | 'rightHip'
  | 'rightKnee'
  | 'rightAnkle';

/** Finger names shared by the fusion layer and rigs with finger chains. */
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'little';

/** Per-finger curl, 0 = straight … 1 = fully curled. */
export type FingerCurls = Record<FingerName, number>;

/** Raw capability facts read off a loaded rig — the ground truth the
 *  capability manifest is reviewed against. Facts only; classification
 *  (capable / limited / …) happens in one place (scripts/capability-lib). */
export interface AvatarCapabilityReport {
  bonesPresent: BoneName[];
  bonesMissing: BoneName[];
  /** segment count per finger chain, per side; null = no finger bones */
  fingerChains: { left: Partial<Record<FingerName, number>>; right: Partial<Record<FingerName, number>> } | null;
  /** head collider as bound (capsule when halfHeight > 0) */
  headCollider: { radius: number; halfHeight: number } | null;
  /** bind-time arm segment lengths (m) — per-avatar face-touch reach */
  armLen: { left: { upper: number; fore: number }; right: { upper: number; fore: number } };
  /** standing height of the rig bbox (m) */
  height: number;
  feet: boolean;
}

export interface Avatar {
  name: string;
  object: THREE.Object3D;
  /** head collider for face-touch: center in head-bone LOCAL space +
   *  radius (m); halfHeightY > 0 makes it a vertical capsule (segment
   *  along head-local Y). Computed from real geometry at load; without it
   *  the retargeter falls back to a generic estimate. */
  headGeometry?: { centerLocal: THREE.Vector3; radius: number; halfHeightY?: number };
  /** Drivable bone pivots; rotations are applied here by the retargeter. */
  bones: Partial<Record<BoneName, THREE.Object3D>>;
  /** Joint anchors whose world positions define limb segments on screen. */
  joints: Partial<Record<JointName, THREE.Object3D>>;
  /** Open/fist/point approximation (0=fist … 1=open). Optional: rigs
   *  without finger bones simply don't implement it. */
  applyHandState?(side: 'left' | 'right', openness: number, point: boolean): void;
  /** True per-finger driving (hand-landmark fusion). Only rigs with real
   *  finger chains implement it; the caller additionally gates on the
   *  capability manifest — absence of this method is the hard fallback. */
  applyFingerCurls?(side: 'left' | 'right', curls: FingerCurls, point: boolean): void;
  /** Mean ENACTED non-thumb curl (0..1) read back off the bones — the
   *  eval's proof that finger input actually drove the rig. NaN = no chains. */
  fingerCurlEnacted?(side: 'left' | 'right'): number;
  /** Capability facts for the manifest report script (V5). */
  describeCapabilities?(): AvatarCapabilityReport;
  /** Idle/secondary animation; called every render tick. */
  update(dt: number, time: number): void;
  dispose(): void;
}
