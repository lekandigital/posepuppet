// THE coordinate conversion lives here and only here (unit-tested).
// MediaPipe: x right (image), y down, z toward camera = negative.
// Three.js:  x right, y up, z toward viewer — so (x, −y, −z).
// Body frame: orthonormal torso basis from shoulders + hips; expressing limb
// directions in this frame is what keeps torso turns from corrupting limbs.

import * as THREE from 'three';
import { LM } from './indices';
import type { LandmarkPoint } from './types';

export function mpToThree(p: { x: number; y: number; z: number }, out: THREE.Vector3): THREE.Vector3 {
  return out.set(p.x, -p.y, -p.z);
}

export class BodyFrame {
  /** body → world rotation (world = three camera space) */
  quat = new THREE.Quaternion();
  quatInv = new THREE.Quaternion();
  hipCenter = new THREE.Vector3();
  shoulderCenter = new THREE.Vector3();
  shoulderWidth = 0.34;
  valid = false;

  private m = new THREE.Matrix4();
  private vx = new THREE.Vector3();
  private vy = new THREE.Vector3();
  private vz = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  /** Computes the frame from (already mirrored, smoothed) world landmarks.
   *  Hips occluded (desk, tight framing) degrades to a shoulders-only frame —
   *  lean and turn still read, only hip-relative pitch is lost — so limbs
   *  keep tracking instead of decaying every time the desk hides the hips.
   *  On low-confidence shoulders the previous frame is kept and valid=false. */
  update(world: LandmarkPoint[]): boolean {
    const ls = world[LM.leftShoulder];
    const rs = world[LM.rightShoulder];
    const lh = world[LM.leftHip];
    const rh = world[LM.rightHip];
    const shoulderVis = Math.min(ls.visibility, rs.visibility);
    const hipVis = Math.min(lh.visibility, rh.visibility);
    // 0.4, not 0.5: a side turn dims the far shoulder; killing the frame there
    // is what made "turn to the side" read as nothing at all.
    if (shoulderVis < 0.4) {
      this.valid = false;
      return false;
    }

    mpToThree(ls, this.a);
    mpToThree(rs, this.b);
    this.shoulderCenter.addVectors(this.a, this.b).multiplyScalar(0.5);
    this.shoulderWidth = this.a.distanceTo(this.b);
    // bodyX: right-shoulder → left-shoulder ≈ +x when facing the viewer
    this.vx.subVectors(this.a, this.b).normalize();

    if (hipVis >= 0.3) {
      mpToThree(lh, this.a);
      mpToThree(rh, this.b);
      this.hipCenter.addVectors(this.a, this.b).multiplyScalar(0.5);
      this.vy.subVectors(this.shoulderCenter, this.hipCenter);
    } else {
      // shoulders-only: up = world-up made orthogonal to the shoulder line,
      // so a tilted shoulder line still produces roll (lean) and a rotated
      // one still produces yaw (turn). hipCenter keeps its previous value.
      this.vy.set(0, 1, 0).addScaledVector(this.vx, -this.vx.y);
    }
    if (this.vy.lengthSq() < 0.0004) {
      this.valid = false; // degenerate (torso collapsed / shoulder line vertical)
      return false;
    }
    this.vy.normalize();
    this.vz.crossVectors(this.vx, this.vy).normalize(); // ≈ +z facing viewer
    this.vx.crossVectors(this.vy, this.vz).normalize(); // re-orthogonalize

    this.m.makeBasis(this.vx, this.vy, this.vz);
    this.quat.setFromRotationMatrix(this.m);
    this.quatInv.copy(this.quat).invert();
    this.valid = true;
    return true;
  }
}
