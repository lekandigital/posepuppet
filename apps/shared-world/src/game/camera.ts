// Spring-damped chase camera, ported unchanged from apps/dolphin as the
// Checkpoint-01 baseline (superseded by the Track E rig at cp02).
// Restraint is the feature: it trails the dolphin's heading with a soft
// catch-up, lifts slightly on a breach so the leap reads, never snaps.

import * as THREE from 'three';
import type { SimState } from './sim';

const BACK = 7.5;
const UP = 2.6;
const POS_TAU = 0.35;
const LOOK_TAU = 0.18;

export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private look = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.1, 900);
  }

  update(s: SimState, dt: number): void {
    const dirX = Math.sin(s.yaw);
    const dirZ = Math.cos(s.yaw);
    const airLift = s.phase === 'air' ? 2.2 : 0;
    // Pool adaptation (cp01 [DERIVED], reported): while the dolphin swims,
    // the eye stays just below the vendored water surface — the demo's
    // above-water plane is opaque from outside, so a waterline-riding eye
    // (the bay tuning: UP 2.6 over a shallow cruise) would hide the
    // dolphin entirely. Breach still lifts the eye above the water so the
    // leap reads. The cp02 Track E rig replaces this wholesale.
    const yCap = s.phase === 'air' ? 6 : -0.35;
    const target = new THREE.Vector3(
      s.x - dirX * BACK,
      Math.min(s.y + UP + airLift, yCap),
      s.z - dirZ * BACK,
    );
    const lookTarget = new THREE.Vector3(s.x + dirX * 4, s.y + 0.6, s.z + dirZ * 4);
    if (!this.initialized) {
      this.camera.position.copy(target);
      this.look.copy(lookTarget);
      this.initialized = true;
    }
    const kp = 1 - Math.exp(-dt / POS_TAU);
    const kl = 1 - Math.exp(-dt / LOOK_TAU);
    this.camera.position.lerp(target, kp);
    this.look.lerp(lookTarget, kl);
    this.camera.lookAt(this.look);
    // a touch of banked roll carries into the frame — the PS2 arcade read
    this.camera.rotateZ(-s.roll * 0.22);
  }
}
