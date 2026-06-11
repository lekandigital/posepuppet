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
  | 'rightUpperLeg'
  | 'rightLowerLeg';

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
  /** Drivable bone pivots; rotations are applied here by the retargeter. */
  bones: Partial<Record<BoneName, THREE.Object3D>>;
  /** Joint anchors whose world positions define limb segments on screen. */
  joints: Partial<Record<JointName, THREE.Object3D>>;
  /** Idle/secondary animation; called every render tick. */
  update(dt: number, time: number): void;
  dispose(): void;
}
