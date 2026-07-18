// RegionCameraCollision — the cp04B analytic camera-collision stand-in for
// the region (Master §7.5: "analytic (pool) / BVH (region)"; the real BVH
// occlusion/collision arrives at cp05). Open-water discipline:
//
//  - the eye never sinks below terrainHeight + radius (the seabed guard the
//    pool floor plane provided);
//  - the eye stays inside the region data domain (soft margin);
//  - line-of-sight is reported clear (the cp05 BVH replaces this, exactly
//    as the pool's convex-interior constant did).
//
// [DERIVED integration stand-in — reported in the cp04B deviations list.]

import * as THREE from 'three';
import type { CameraCollisionLike, CollisionResult } from './cameraCollision';
import type { WorldData } from '../world/WorldData';

export class RegionCameraCollision implements CameraCollisionLike {
  constructor(
    private readonly data: WorldData,
    readonly radius = 0.75,
    readonly edgeMargin = 5,
  ) {}

  private get lim(): number {
    return this.data.header.sizeMeters[0] / 2 - this.edgeMargin;
  }

  clampPoint(p: THREE.Vector3): THREE.Vector3 {
    p.x = THREE.MathUtils.clamp(p.x, -this.lim, this.lim);
    p.z = THREE.MathUtils.clamp(p.z, -this.lim, this.lim);
    const floor = this.data.terrainHeight(p.x, p.z) + this.radius;
    if (p.y < floor) p.y = floor;
    return p;
  }

  resolve(_from: THREE.Vector3, to: THREE.Vector3): CollisionResult {
    const pos = to.clone();
    this.clampPoint(pos);
    return { pos, obstructed: pos.distanceToSquared(to) > 1e-8 };
  }

  losClear(_a: THREE.Vector3, _b: THREE.Vector3): boolean {
    return true;
  }
}
