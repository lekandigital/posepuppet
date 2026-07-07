// Orthonormal torso basis — a three.js-free port of PosePuppet's BodyFrame
// (src/pose/bodyFrame.ts), same math and the same shoulders-only
// degradation: hips occluded (desk framing) still yields roll + yaw, only
// hip-relative pitch is lost. Quaternions are unnecessary here: expressing
// a vector in the basis is three dot products.

import { LM } from './lm';
import type { LandmarkPoint } from './types';
import { V3, v3, mpToInternal, mid, sub, cross, dot, norm, set } from './vec';

export interface BasisVectors {
  vx: V3; // ≈ +x when facing the viewer (shoulder line)
  vy: V3; // torso up
  vz: V3; // ≈ toward the viewer
}

export function cloneBasis(b: BasisVectors): BasisVectors {
  return { vx: { ...b.vx }, vy: { ...b.vy }, vz: { ...b.vz } };
}

export class TorsoBasis implements BasisVectors {
  vx = v3(1, 0, 0);
  vy = v3(0, 1, 0);
  vz = v3(0, 0, 1);
  shoulderCenter = v3();
  hipCenter = v3();
  shoulderWidth = 0.34;
  hipsValid = false;
  valid = false;

  private a = v3();
  private b = v3();

  /** Landmarks in MediaPipe axes (mirrored). 0.4 shoulder gate, not 0.5:
   *  a side turn dims the far shoulder (pass-1 lesson). */
  update(world: LandmarkPoint[]): boolean {
    const ls = world[LM.leftShoulder];
    const rs = world[LM.rightShoulder];
    const lh = world[LM.leftHip];
    const rh = world[LM.rightHip];
    if (Math.min(ls.visibility, rs.visibility) < 0.4) {
      this.valid = false;
      return false;
    }

    mpToInternal(ls, this.a);
    mpToInternal(rs, this.b);
    mid(this.shoulderCenter, this.a, this.b);
    this.shoulderWidth = Math.hypot(this.a.x - this.b.x, this.a.y - this.b.y, this.a.z - this.b.z);
    sub(this.vx, this.a, this.b);
    if (!norm(this.vx)) {
      this.valid = false;
      return false;
    }

    this.hipsValid = Math.min(lh.visibility, rh.visibility) >= 0.3;
    if (this.hipsValid) {
      mpToInternal(lh, this.a);
      mpToInternal(rh, this.b);
      mid(this.hipCenter, this.a, this.b);
      sub(this.vy, this.shoulderCenter, this.hipCenter);
    } else {
      // shoulders-only: world-up made orthogonal to the shoulder line
      set(this.vy, 0, 1, 0);
      this.vy.x -= this.vx.x * this.vx.y;
      this.vy.y -= this.vx.y * this.vx.y;
      this.vy.z -= this.vx.z * this.vx.y;
    }
    if (!norm(this.vy)) {
      this.valid = false; // degenerate (torso collapsed / shoulder line vertical)
      return false;
    }
    cross(this.vz, this.vx, this.vy);
    norm(this.vz);
    cross(this.vx, this.vy, this.vz);
    norm(this.vx);
    this.valid = true;
    return true;
  }

  /** Express a world-space (internal y-up) vector in this basis. */
  toLocal(a: V3, o: V3): V3 {
    return set(o, dot(a, this.vx), dot(a, this.vy), dot(a, this.vz));
  }

  copyVectors(): BasisVectors {
    return cloneBasis(this);
  }
}

/** Express vector a in an arbitrary captured basis (e.g. the neutral). */
export function toBasisLocal(b: BasisVectors, a: V3, o: V3): V3 {
  return set(o, dot(a, b.vx), dot(a, b.vy), dot(a, b.vz));
}
