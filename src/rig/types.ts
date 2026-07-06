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

export interface Avatar {
  name: string;
  object: THREE.Object3D;
  /** head collider for face-touch: center in head-bone LOCAL space +
   *  radius (m). Computed from real geometry at load; without it the
   *  retargeter falls back to a generic estimate. */
  headGeometry?: { centerLocal: THREE.Vector3; radius: number };
  /** Drivable bone pivots; rotations are applied here by the retargeter. */
  bones: Partial<Record<BoneName, THREE.Object3D>>;
  /** Joint anchors whose world positions define limb segments on screen. */
  joints: Partial<Record<JointName, THREE.Object3D>>;
  /** Open/fist/point approximation (0=fist … 1=open). Optional: rigs
   *  without finger bones simply don't implement it. */
  applyHandState?(side: 'left' | 'right', openness: number, point: boolean): void;
  /** Idle/secondary animation; called every render tick. */
  update(dt: number, time: number): void;
  dispose(): void;
}
