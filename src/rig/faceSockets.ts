// Face-touch v2 sockets: named contact points on the head. The person's
// wrist offset from their head center, expressed in their OWN head frame
// (ears + nose basis — pose landmarks only, no face model), classifies to
// one of seven named sockets; the avatar-side IK then targets that
// socket's canonical direction on the avatar's head capsule instead of
// the raw wrist direction. Fixed sockets glue the contact to the face
// (v1's raw direction wobbled with detection noise) and give the eval a
// per-gesture vocabulary.

import * as THREE from 'three';

export type FaceSocketId =
  | 'cheekL'
  | 'cheekR'
  | 'chin'
  | 'mouthCover'
  | 'forehead'
  | 'temple'
  | 'underChin'
  | 'thinkingPose';

/** All seven gesture names (thinkingPose is a dwell re-label of chin/underChin). */
export const FACE_SOCKETS: FaceSocketId[] = [
  'cheekL', 'cheekR', 'chin', 'mouthCover', 'forehead', 'temple', 'underChin', 'thinkingPose',
];

interface SocketDef {
  id: Exclude<FaceSocketId, 'thinkingPose'>;
  /** canonical direction in the head frame: +x = person's left, +y = up,
   *  +z = facing (out of the face) */
  dir: THREE.Vector3;
  /** sockets that exist on both sides mirror their x by wrist side */
  mirrored?: boolean;
}

const DEFS: SocketDef[] = [
  { id: 'cheekL', dir: new THREE.Vector3(0.82, -0.18, 0.55).normalize() },
  { id: 'cheekR', dir: new THREE.Vector3(-0.82, -0.18, 0.55).normalize() },
  { id: 'temple', dir: new THREE.Vector3(0.72, 0.55, 0.42).normalize(), mirrored: true },
  { id: 'forehead', dir: new THREE.Vector3(0, 0.68, 0.73).normalize() },
  { id: 'mouthCover', dir: new THREE.Vector3(0, -0.28, 0.96).normalize() },
  { id: 'chin', dir: new THREE.Vector3(0, -0.76, 0.65).normalize() },
  { id: 'underChin', dir: new THREE.Vector3(0, -0.97, 0.24).normalize() },
];

/** Sticky-socket hysteresis: a challenger must beat the incumbent by this. */
const HYSTERESIS = 0.06;
/** thinkingPose: chin/underChin held with a quiet forearm for this long. */
const THINKING_DWELL_SEC = 0.8;
/** rad/s forearm speed below which a chin hold counts as "thinking". */
const THINKING_MAX_SPEED = 1.3;

const tmp = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Per-side classifier state (hysteresis + thinking dwell). */
export class FaceSocketTracker {
  private current: Exclude<FaceSocketId, 'thinkingPose'> | null = null;
  private dwellSec = 0;

  reset(): void {
    this.current = null;
    this.dwellSec = 0;
  }

  /**
   * Classify a wrist offset (unit vector, head frame) into a socket.
   * `side` mirrors the temple to the wrist's side of the head;
   * `forearmSpeed` (rad/s) and `dt` feed the thinking-pose dwell.
   */
  classify(
    dirHeadLocal: THREE.Vector3,
    side: 'left' | 'right',
    forearmSpeed: number,
    dt: number,
  ): FaceSocketId {
    let bestId: Exclude<FaceSocketId, 'thinkingPose'> = 'mouthCover';
    let bestScore = -Infinity;
    let currentScore = -Infinity;
    for (const def of DEFS) {
      tmp.copy(def.dir);
      if (def.mirrored && dirHeadLocal.x < 0) tmp.x = -tmp.x;
      const score = dirHeadLocal.dot(tmp);
      if (score > bestScore) {
        bestScore = score;
        bestId = def.id;
      }
      if (def.id === this.current) currentScore = score;
    }
    // hysteresis: keep the incumbent unless clearly beaten
    if (this.current && bestId !== this.current && bestScore - currentScore < HYSTERESIS) {
      bestId = this.current;
    }
    if (bestId !== this.current) {
      this.current = bestId;
      this.dwellSec = 0;
    }
    // thinking pose: a settled hand held at/under the chin
    if ((bestId === 'chin' || bestId === 'underChin') && forearmSpeed < THINKING_MAX_SPEED) {
      this.dwellSec += dt;
    } else {
      this.dwellSec = 0;
    }
    void side; // temple mirroring keys off dirHeadLocal.x; side kept for future asymmetry
    return this.dwellSec >= THINKING_DWELL_SEC ? 'thinkingPose' : bestId;
  }
}

/** Canonical head-frame direction for a socket (thinkingPose sits knuckles-
 *  under-chin). `mirrorX` flips side-mirrored sockets onto the wrist's side. */
export function socketDirection(id: FaceSocketId, mirrorX: boolean, out: THREE.Vector3): THREE.Vector3 {
  if (id === 'thinkingPose') return out.set(0, -0.85, 0.53).normalize();
  const def = DEFS.find((d) => d.id === id)!;
  out.copy(def.dir);
  if (def.mirrored && mirrorX) out.x = -out.x;
  return out;
}

/**
 * Closest point ON the capsule surface along `dir` from the capsule
 * center, plus the surface normal there. The capsule is the segment
 * [center − halfHeight·axis, center + halfHeight·axis] with `radius`.
 * Returns the target point at `skin` × radius outside the surface —
 * IK targets built through this can never sit inside the head.
 */
export function capsuleSurfacePoint(
  center: THREE.Vector3,
  axis: THREE.Vector3, // unit
  halfHeight: number,
  radius: number,
  dir: THREE.Vector3, // unit, from center outward
  skin: number,
  outPoint: THREE.Vector3,
): THREE.Vector3 {
  // pick the point on the core segment nearest the ray direction: project
  // a far point along dir onto the segment
  const far = tmp.copy(dir).multiplyScalar(halfHeight + radius * 2).add(center); // tmp = far
  const t = THREE.MathUtils.clamp(
    (far.x - center.x) * axis.x + (far.y - center.y) * axis.y + (far.z - center.z) * axis.z,
    -halfHeight,
    halfHeight,
  );
  const core = tmpB.copy(center).addScaledVector(axis, t); // tmpB = core
  const n = far.sub(core).normalize(); // tmp = surface normal
  return outPoint.copy(core).addScaledVector(n, radius * (1 + skin));
}

/** Signed distance from a point to the capsule surface (< 0 = inside). */
export function capsuleSignedDistance(
  p: THREE.Vector3,
  center: THREE.Vector3,
  axis: THREE.Vector3,
  halfHeight: number,
  radius: number,
): number {
  const t = THREE.MathUtils.clamp(tmp.copy(p).sub(center).dot(axis), -halfHeight, halfHeight);
  const core = tmp.copy(center).addScaledVector(axis, t);
  return p.distanceTo(core) - radius;
}
