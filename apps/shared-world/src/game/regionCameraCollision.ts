// RegionCameraCollision — Checkpoint 05 BVH camera collision (Master §5.3,
// §7.5 "analytic (pool) / BVH (region)"), replacing the cp04B heightfield
// stand-in. The cp05 §6 spec: sphere-cast (radius 0.75 m) from the dolphin
// to the desired camera point against the terrain BVH; on a hit the camera
// dollies in along the ray (the rig's existing T90_OBSTRUCT spring answers
// the 0.15 s t90). clampPoint keeps the hard guarantee the pool walls gave:
// closest-point push-out to the keep-out radius, with the 04B heightfield
// floor kept as a cheap backstop (identical surface — §2.2 law), plus the
// region-edge margin. losClear is a real BVH raycast now (the pool's convex
// constant retired) and feeds the rig's Obstructed/Emergency timers.

import * as THREE from 'three';
import type { CameraCollisionLike, CollisionResult } from './cameraCollision';
import type { WorldData } from '../world/WorldData';
import type { TerrainBvh } from './terrainBvh';

export class RegionCameraCollision implements CameraCollisionLike {
  /** clearance at the last resolved camera point, m (instrumentation) */
  lastClearanceM = Infinity;

  private readonly tmpDir = new THREE.Vector3();

  constructor(
    private readonly data: WorldData,
    private readonly bvh: TerrainBvh,
    readonly radius = 0.75,
    readonly edgeMargin = 5,
  ) {}

  private get lim(): number {
    return this.data.header.sizeMeters[0] / 2 - this.edgeMargin;
  }

  clampPoint(p: THREE.Vector3): THREE.Vector3 {
    p.x = THREE.MathUtils.clamp(p.x, -this.lim, this.lim);
    p.z = THREE.MathUtils.clamp(p.z, -this.lim, this.lim);
    // heightfield floor backstop (same surface the BVH triangulates)
    const floor = this.data.terrainHeight(p.x, p.z) + this.radius;
    if (p.y < floor) p.y = floor;
    // BVH push-out: hold the keep-out radius against slopes/walls the
    // vertical floor clamp cannot represent
    const d = this.bvh.closestDistance(p, this.radius);
    if (d < this.radius) {
      // gradient-free push: sample the closest surface point via a short
      // upward probe of the heightfield normal is unreliable on walls, so
      // push along the local heightfield normal blended with up
      const e = 1.0;
      const th = (x: number, z: number) => this.data.terrainHeight(x, z);
      this.tmpDir
        .set(th(p.x - e, p.z) - th(p.x + e, p.z), 2 * e, th(p.x, p.z - e) - th(p.x, p.z + e))
        .normalize();
      p.addScaledVector(this.tmpDir, this.radius - d);
    }
    return p;
  }

  /**
   * Sphere-cast dolphin → desired camera; on a hit, dolly in along the ray
   * to the last clear position (cp05 §6). The `from` point (the dolphin)
   * can graze terrain closer than the radius — then the cast starts blocked
   * and the clamp resolves.
   */
  resolve(from: THREE.Vector3, to: THREE.Vector3): CollisionResult {
    const t = this.bvh.sphereCast(from, to, this.radius);
    if (t === null) {
      const pos = to.clone();
      this.clampPoint(pos);
      this.lastClearanceM = this.bvh.closestDistance(pos, 10);
      const obstructed = pos.distanceToSquared(to) > 1e-8;
      return { pos, obstructed };
    }
    const pos = from.clone().lerp(to, t);
    this.clampPoint(pos);
    this.lastClearanceM = this.bvh.closestDistance(pos, 10);
    return { pos, obstructed: true };
  }

  losClear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    return this.bvh.losClear(a, b);
  }
}
