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
//
// cp09: the cave/arch module BVHs (CavesPass) join every query path —
// Master §5.3 "three-mesh-bvh continues to serve camera and query paths
// inside caves": the sphere-cast takes the earlier hit of terrain/caves,
// LOS requires both clear, and clampPoint adds the literal
// closestPointToPoint push-out against the cave surfaces (the heightfield-
// normal push cannot represent a ceiling). The floor backstop uses the RAW
// heightfield on purpose: inside a cave the camera floor is the module
// floor, owned by the cave push-out, not the analytic override.

import * as THREE from 'three';
import type { CameraCollisionLike, CollisionResult } from './cameraCollision';
import type { WorldData } from '../world/WorldData';
import type { TerrainBvh } from './terrainBvh';
import type { CavesPass } from '../terrain/CavesPass';
import type { CaveField } from '../world/CaveField';

export class RegionCameraCollision implements CameraCollisionLike {
  /** clearance at the last resolved camera point, m (instrumentation) */
  lastClearanceM = Infinity;

  private readonly tmpDir = new THREE.Vector3();

  constructor(
    private readonly data: WorldData,
    private readonly bvh: TerrainBvh,
    readonly radius = 0.75,
    readonly edgeMargin = 5,
    /** cp09: cave/arch module BVH query surface (null before cave load) */
    private caves: CavesPass | null = null,
    /** cp09: analytic bore test — cave push-out only while the eye is inside */
    private caveField: CaveField | null = null,
  ) {}

  /** cp09: attach the cave BVHs once the modules are loaded. */
  setCaves(caves: CavesPass): void {
    this.caves = caves;
  }

  private get lim(): number {
    return this.data.header.sizeMeters[0] / 2 - this.edgeMargin;
  }

  private combinedClearance(p: THREE.Vector3, maxDist: number): number {
    const dTerrain = this.bvh.closestDistance(p, maxDist);
    if (!this.caves) return dTerrain;
    const dCave = this.caves.closestDistance(p, maxDist);
    return Math.min(dTerrain, dCave);
  }

  clampPoint(p: THREE.Vector3): THREE.Vector3 {
    p.x = THREE.MathUtils.clamp(p.x, -this.lim, this.lim);
    p.z = THREE.MathUtils.clamp(p.z, -this.lim, this.lim);
    const inBore = this.caveField?.insideBore(p.x, p.y, p.z, 0.8, 1.2) ?? false;
    if (!inBore) {
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
    }
    // cp09 cave push-out: only while the eye is inside a bore. Pushing
    // against the OUTER shell from open water traps the camera on the
    // hillside and the eye never follows a teleport/shortcut inside.
    // Master §5.3 closestPointToPoint law applies to the interior.
    if (this.caves && inBore) {
      const hit = this.caves.closestPoint(p, this.radius);
      if (hit && hit.distance < this.radius) {
        if (hit.distance > 1e-6) {
          this.tmpDir.copy(p).sub(hit.point).divideScalar(hit.distance);
          p.addScaledVector(this.tmpDir, this.radius - hit.distance);
        } else {
          p.y += this.radius; // degenerate: on the surface — lift
        }
      }
    }
    return p;
  }

  /**
   * Sphere-cast dolphin → desired camera; on a hit, dolly in along the ray
   * to the last clear position (cp05 §6). The `from` point (the dolphin)
   * can graze terrain closer than the radius — then the cast starts blocked
   * and the clamp resolves. cp09: the earlier of the terrain/cave hits wins.
   */
  resolve(from: THREE.Vector3, to: THREE.Vector3): CollisionResult {
    const tTerrain = this.bvh.sphereCast(from, to, this.radius);
    const tCave = this.caves ? this.caves.sphereCast(from, to, this.radius) : null;
    const t =
      tTerrain === null ? tCave : tCave === null ? tTerrain : Math.min(tTerrain, tCave);
    if (t === null) {
      const pos = to.clone();
      this.clampPoint(pos);
      this.lastClearanceM = this.combinedClearance(pos, 10);
      const obstructed = pos.distanceToSquared(to) > 1e-8;
      return { pos, obstructed };
    }
    const pos = from.clone().lerp(to, t);
    this.clampPoint(pos);
    this.lastClearanceM = this.combinedClearance(pos, 10);
    return { pos, obstructed: true };
  }

  losClear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    if (!this.bvh.losClear(a, b)) return false;
    // both ends in a bore: a chord that clips a bend is not a lost camera —
    // sphere-cast + interior follow keep the eye in the void; emergency on
    // every winding-tunnel chord would fire continuously.
    if (
      this.caveField?.insideBore(a.x, a.y, a.z, 1.2, 1.5) &&
      this.caveField?.insideBore(b.x, b.y, b.z, 1.2, 1.5)
    ) {
      return true;
    }
    return this.caves ? this.caves.losClear(a, b) : true;
  }
}
