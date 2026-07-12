// Shared palm math for hand puppets: orientation basis, pinch distance,
// and a lightly smoothed view of the landmarks in stage space.

import * as THREE from 'three';
import { HLM, type HandFrame, type HandPoint } from '@bodyarcade/pose-runtime';

/** Map a normalized hand landmark into stage space: x mirrored to match
 *  the mirrored camera view, y flipped (image y-down), z scaled. The hand
 *  floats in a ~1.6 m box centered at stage height. */
export function normToStage(p: HandPoint, out: THREE.Vector3): THREE.Vector3 {
  return out.set((0.5 - p.x) * 1.6, (0.55 - p.y) * 1.2 + 1.1, -p.z * 1.2);
}

export class PalmState {
  /** palm orientation: x = wrist→index-mcp side, y = palm normal, z = fingers */
  readonly quat = new THREE.Quaternion();
  /** wrist position in stage space */
  readonly pos = new THREE.Vector3(0, 1.1, 0);
  /** thumb-tip↔index-tip distance, normalized by palm width (0 closed … ~2 open) */
  pinch = 1;
  /** smoothed pinch (the jaw driver) */
  pinchSmooth = 1;
  /** true while a hand is tracked */
  tracked = false;
  /** seconds since the hand was last seen */
  lostSec = 0;

  private m = new THREE.Matrix4();
  private vx = new THREE.Vector3();
  private vy = new THREE.Vector3();
  private vz = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private targetQuat = new THREE.Quaternion();
  private targetPos = new THREE.Vector3(0, 1.1, 0);

  onFrame(frame: HandFrame | null): void {
    if (!frame) {
      this.tracked = false;
      return;
    }
    this.tracked = true;
    this.lostSec = 0;

    const n = frame.norm;
    normToStage(n[HLM.wrist], this.a);
    normToStage(n[HLM.indexMcp], this.b);
    normToStage(n[HLM.pinkyMcp], this.c);
    this.targetPos.copy(this.a);

    // palm basis: z along fingers (wrist→mid of index/pinky mcp),
    // x across the knuckles, y = normal
    this.vx.copy(this.b).sub(this.c).normalize();
    this.vz.copy(this.b).add(this.c).multiplyScalar(0.5).sub(this.a).normalize();
    this.vy.crossVectors(this.vz, this.vx).normalize();
    this.vx.crossVectors(this.vy, this.vz).normalize();
    this.m.makeBasis(this.vx, this.vy, this.vz);
    this.targetQuat.setFromRotationMatrix(this.m);

    // pinch: thumb tip ↔ index tip over palm width (mcp index↔pinky)
    const palmW = Math.max(this.b.distanceTo(this.c), 1e-3);
    normToStage(n[HLM.thumbTip], this.b);
    normToStage(n[HLM.indexTip], this.c);
    this.pinch = this.b.distanceTo(this.c) / palmW;
  }

  /** Render-tick smoothing toward the last frame's targets. */
  tick(dt: number): void {
    if (!this.tracked) this.lostSec += dt;
    const k = 1 - Math.exp(-18 * dt);
    this.quat.slerp(this.targetQuat, k);
    this.pos.lerp(this.targetPos, k);
    this.pinchSmooth += (this.pinch - this.pinchSmooth) * (1 - Math.exp(-22 * dt));
  }
}
