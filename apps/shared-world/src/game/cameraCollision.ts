// CameraCollision (Checkpoint 02, Track E §17 shape): analytic pool-wall
// camera collision. The pool is the vendored demo box mounted at K
// (Master §7.7): interior |x|,|z| < half, floor at −depth, open above.
// The camera keeps COLLISION_RADIUS clearance from every wall/floor plane;
// if the dolphin→desired-camera ray would exit that shrunk interior, the
// desired point is dollied in along the ray to the exit point (Obstructed).
//
// BVH camera collision against real terrain arrives at cp05; this analytic
// module is the pool stand-in and is deleted with the region.

import * as THREE from 'three';

export interface CollisionResult {
  /** resolved (possibly dollied-in / clamped) camera position */
  pos: THREE.Vector3;
  /** true when the desired point had to be pulled in or clamped */
  obstructed: boolean;
}

/**
 * The structural seam the CameraRig consumes (cp04B, additive): the pool
 * keeps this analytic box; the region supplies its heightfield stand-in
 * (regionCameraCollision.ts) until the cp05 BVH replaces both.
 */
export interface CameraCollisionLike {
  resolve(from: THREE.Vector3, to: THREE.Vector3): CollisionResult;
  clampPoint(p: THREE.Vector3): THREE.Vector3;
  losClear(a: THREE.Vector3, b: THREE.Vector3): boolean;
}

export class CameraCollision implements CameraCollisionLike {
  constructor(
    /** pool half-extent, metres */
    readonly half = 7.5,
    /** pool depth, metres */
    readonly depth = 7.5,
    /** camera keep-out radius from walls/floor, metres */
    readonly radius = 0.75,
  ) {}

  private get lim(): number {
    return this.half - this.radius;
  }

  private get floor(): number {
    return -this.depth + this.radius;
  }

  /** Is p inside the radius-shrunk pool interior (no ceiling — breach)? */
  contains(p: THREE.Vector3): boolean {
    return (
      Math.abs(p.x) <= this.lim && Math.abs(p.z) <= this.lim && p.y >= this.floor
    );
  }

  /** Hard clamp into the shrunk interior (the wall guarantee). */
  clampPoint(p: THREE.Vector3): THREE.Vector3 {
    p.x = THREE.MathUtils.clamp(p.x, -this.lim, this.lim);
    p.z = THREE.MathUtils.clamp(p.z, -this.lim, this.lim);
    if (p.y < this.floor) p.y = this.floor;
    return p;
  }

  /**
   * Resolve the desired camera position against the pool walls: if the
   * from→to segment leaves the shrunk interior, dolly in along the ray to
   * the last inside point (slab exit test); otherwise pass through.
   * `from` (the dolphin) may itself sit closer to a wall than the radius —
   * then plain clamping resolves it.
   */
  resolve(from: THREE.Vector3, to: THREE.Vector3): CollisionResult {
    if (this.contains(to)) return { pos: to.clone(), obstructed: false };

    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-6 || !this.contains(from)) {
      return { pos: this.clampPoint(to.clone()), obstructed: true };
    }
    dir.divideScalar(len);

    // slab method: smallest positive t where the ray exits the shrunk box
    let tExit = len;
    const axes: Array<['x' | 'y' | 'z', number, number]> = [
      ['x', -this.lim, this.lim],
      ['z', -this.lim, this.lim],
      ['y', this.floor, Number.POSITIVE_INFINITY],
    ];
    for (const [axis, lo, hi] of axes) {
      const d = dir[axis];
      const o = from[axis];
      if (Math.abs(d) < 1e-9) continue;
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      const tFar = Math.max(t1, t2);
      if (tFar >= 0 && tFar < tExit) tExit = tFar;
    }
    const pos = from.clone().addScaledVector(dir, Math.max(0, tExit));
    return { pos: this.clampPoint(pos), obstructed: true };
  }

  /**
   * Line-of-sight test between two points already inside the pool. The pool
   * interior is convex, so two interior points always see each other — the
   * analytic answer is constant. This exists as the seam the cp05 BVH
   * occlusion query replaces (the rig's LOS-blocked timer consumes it).
   */
  losClear(_a: THREE.Vector3, _b: THREE.Vector3): boolean {
    return true;
  }
}
