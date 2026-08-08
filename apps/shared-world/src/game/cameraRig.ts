// CameraRig (Checkpoint 02): the Track E chase-camera rig replacing the
// ported cp01 baseline camera — critically damped spring position with
// asymmetric damping, smoothed-velocity look-ahead, speed-based follow
// distance, a camera state machine with parameter cross-fades, analytic
// pool-wall collision, R recenter, and the waterline anti-shimmer hold.
// All initial values from Implementation Master §7.5 / cp02 §6.
//
// The three virtues of the deleted cp01 camera carry over:
//  - spring chase        → the SmoothDamp position/aim springs below;
//  - breach air-lift     → Airborne lifts the eye above the surface
//                          (+ BREACH_PULLBACK on the follow distance);
//  - bank-coupled roll   → ROLL_COUPLE = 0.10 × dolphin roll (≤ 10 %,
//                          the comfort cap — cp02 §13).
//
// Damping form (cp02 §6, documented conversion): springs are SmoothDamp-
// style critically damped (Game Programming Gems 4; ω = 2 / smoothTime).
// The spec pins t90 values (time to close 90 % of a step). The unit step
// response of the critically damped spring is y(t) = 1 − (1 + ωt)·e^(−ωt),
// which reaches 0.9 at ωt ≈ 3.8897 (root of (1+u)e^(−u) = 0.1). Hence
//   smoothTime = 2·t90 / 3.8897  ≈  t90 / 1.9449.
// The look-ahead velocity low-pass is first-order, y(t) = 1 − e^(−t/τ),
// reaching 0.9 at t = τ·ln 10, hence τ = t90 / ln 10 ≈ t90 / 2.3026.
//
// The rig is presentation-only: it reads sim state and never writes it
// (replay digests are camera-independent by construction).

import * as THREE from 'three';
import type { SimState } from './sim';
import { CameraCollision, type CameraCollisionLike } from './cameraCollision';

export type CameraStateName =
  | 'NormalFollow'
  | 'SlowHover'
  | 'FastTravel'
  | 'TerrainCompressed' // live at cp05 in the region (opt-in; pool keeps the cp02 stub)
  | 'Obstructed'
  | 'SurfaceTransition'
  | 'Airborne'
  | 'ReEntryRecovery'
  | 'EmergencyRecenter';

/**
 * All rig constants in one table (Master §7.5; metres/seconds/radians).
 *
 * DISTANCE-FAMILY RETUNE (measured deviation from Master §7.5, cp02 §12 —
 * "coverage governs; FOV is subordinate", Track D §13): at the §7.5 initial
 * distances (follow 8.75→13.75, height 2.0, look-ahead 6.25) the projected
 * dolphin measures ≈ 4–6 % of frame width — below the Track D 8–18 % band
 * (target 10–15 %) — and the desired camera point sits outside the 15 m
 * pool over most of its area (permanent Obstructed). Every LENGTH in the
 * chase geometry is therefore scaled by 0.55 (the pool-scale retune the
 * checkpoint header calls for); scaling all lengths together preserves the
 * angular composition (pitch-down, look-ahead ratio, height band) while
 * landing measured cruise coverage ≈ 11 % (inside the 10–15 % target).
 * TIME constants, the speed→distance lerp shape, the collision radius, and
 * the comfort caps are untouched. Master §7.5 values in trailing comments.
 */
export const RIG = {
  FOLLOW_DIST: 4.8,         // m behind at rest/cruise floor   [§7.5: 8.75 × 0.55]
  FOLLOW_DIST_BURST: 7.55,  // m behind at burst (lerp 0→9)    [§7.5: 13.75 × 0.55]
  HOVER_DIST: 3.3,          // m in SlowHover [DERIVED, flagged; §7.5: 6.0 × 0.55]
  HEIGHT: 1.1,              // m above the dolphin             [§7.5: 2.0 × 0.55]
  LOOK_AHEAD: 3.44,         // m along the smoothed velocity   [§7.5: 6.25 × 0.55]
  T90_VEL_LP: 0.25,         // s — velocity low-pass for the look-ahead
  T90_CATCH: 0.18,          // s — position catch-up (target receding)
  T90_SETTLE: 0.45,         // s — position settle (target approaching)
  T90_AIM: 0.25,            // s — aim spring
  T90_DIST: 0.6,            // s — follow-distance spring
  RECENTER_S: 0.5,          // s — R eases the camera behind facing
  T90_OBSTRUCT: 0.15,       // s — obstruction dolly-in
  COLLISION_RADIUS: 0.75,   // m keep-out from pool walls (physical, unscaled)
  SURFACE_BLEND_S: 0.3,     // s — SurfaceTransition parameter blend
  BREACH_PULLBACK: 2.05,    // m extra distance while Airborne [§7.5: 3.75 × 0.55]
  REENTRY_S: 0.6,           // s — ReEntryRecovery window
  ROLL_COUPLE: 0.10,        // camera roll = 0.10 × dolphin roll (≤ 10 % cap)
  FOV: 55,                  // ° vertical [R6: midpoint of Track D 50–60]
  NEAR: 0.1,
  FAR: 900,                 // pool far plane
  HOVER_SPEED: 0.75,        // m/s — SlowHover below (Track E min-control)
  FAST_SPEED: 5,            // m/s — FastTravel above
  SURFACE_BAND: 0.75,       // m — anti-shimmer active within ±band of y 0
  SHIMMER_MIN_Y: 0.35,      // m — minimum |camera y| held near the surface
  SHIMMER_HOLD_S: 0.15,     // s — hold per crossing [DERIVED anti-artifact rule]
  EMERGENCY_LOS_S: 0.3,     // s — LOS blocked longer than this → emergency
  EMERGENCY_DIST_FACTOR: 3, // distance error > 3× target → emergency
  T90_EMERGENCY: 0.15,      // s — emergency fast recenter
  STATE_XFADE_T90: 0.3,     // s — state parameter cross-fade (0.2–0.5 band)
  // [DERIVED continuity bound]: "fast recenter, never a teleport" — the eye
  // never moves faster than this, so the camera path stays continuous
  // (< 1.2 m frame-to-frame at 50 fps) even through emergency recenters.
  MAX_CAM_SPEED: 55,        // m/s
  // --- TerrainCompressed (cp05 §6; opt-in — region only, pool untouched) ---
  COMPRESS_RATIO: 0.6,      // engage when resolved/target distance < 60 %…
  COMPRESS_SUSTAIN_S: 0.5,  // …sustained longer than 0.5 s
  COMPRESS_FACTOR: 0.6,     // distance/height parameter set reduced 40 %
  COMPRESS_RELEASE_RATIO: 0.8, // [DERIVED hysteresis, flagged] release above 80 %…
  COMPRESS_RELEASE_S: 0.5,     // …sustained 0.5 s [DERIVED, flagged]
} as const;

const T90_TO_SMOOTH = 2 / 3.8897; // see damping-form note above
const LN10 = Math.log(10);

/** In-place vector SmoothDamp (critically damped; GPG4 form). */
function smoothDampV3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  smoothTime: number,
  dt: number,
): void {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const axis of ['x', 'y', 'z'] as const) {
    const change = current[axis] - target[axis];
    const temp = (velocity[axis] + omega * change) * dt;
    velocity[axis] = (velocity[axis] - omega * temp) * decay;
    current[axis] = target[axis] + (change + temp) * decay;
  }
}

/** Scalar SmoothDamp; returns next value, updates vel via the ref object. */
function smoothDamp1(
  current: number,
  target: number,
  vel: { v: number },
  smoothTime: number,
  dt: number,
): number {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * decay;
  return target + (change + temp) * decay;
}

export interface CameraEvalState {
  state: CameraStateName;
  stateTimeS: number;
  x: number;
  y: number;
  z: number;
  fov: number;
  /** actual eye→dolphin distance, m */
  followDistM: number;
  /** current smoothed follow-distance target, m */
  desiredDistM: number;
  /** angle between camera forward and the live desired aim direction, rad */
  aimErrorRad: number;
  /** |camera azimuth about the dolphin − directly-behind-facing|, rad */
  azimuthErrorRad: number;
  rollRad: number;
  /** seconds remaining in the R-recenter ease window (0 = inactive) */
  recenterActiveS: number;
  antiShimmerEngagements: number;
  surfaceCrossings: number;
  losBlockedS: number;
  emergencyCount: number;
  /** rolling mean rig CPU cost per update, µs (measured by the caller) */
  updateUsAvg: number;
  /** cp05: resolved/desired chase-distance ratio (1 = uncompressed) */
  compressionRatio: number;
  /** cp05: cross-faded TerrainCompressed parameter factor (1 → 0.6) */
  compressFactor: number;
  /** cp05: TerrainCompressed engagement count */
  terrainCompressedCount: number;
  /** cp05: BVH clearance at the resolved camera point, m (region only) */
  bvhClearanceM: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly collision: CameraCollisionLike;

  private state: CameraStateName = 'NormalFollow';
  private stateTime = 0;

  private readonly camPos = new THREE.Vector3();
  private readonly camVel = new THREE.Vector3();
  private readonly aimPos = new THREE.Vector3();
  private readonly aimVel = new THREE.Vector3();
  private readonly velSmooth = new THREE.Vector3();
  private readonly prevDesired = new THREE.Vector3();

  private dist: number = RIG.FOLLOW_DIST;
  private readonly distVel = { v: 0 };
  /** cross-faded state parameter: follow-distance goal (pre-spring) */
  private distGoal: number = RIG.FOLLOW_DIST;
  /** cross-faded state parameter: position smoothTime */
  private posSmooth = RIG.T90_SETTLE * T90_TO_SMOOTH;

  private recenterT = 0;
  private reentryT = 0;
  private surfaceT = 0;
  private shimmerHoldT = 0;
  private side: -1 | 1 = -1; // which side of y 0 the camera occupies
  private prevDolphinY = -2.5;
  private prevWasAir = false;
  private emergency = false;
  private emergencyCount = 0;
  private losBlockedS = 0;
  private antiShimmerCount = 0;
  private crossings = 0;
  private aimErrorRad = 0;
  private azimuthErrorRad = 0;
  private rollRad = 0;
  private initialized = false;

  // --- cp05C visual waterline (null = constant y 0, the pool behavior) ---
  private readonly waterlineAt: ((x: number, z: number) => number) | null = null;
  /** waterline sampled once per update at the dolphin column */
  private wl = 0;

  // --- TerrainCompressed (cp05; inert unless terrainCompression is on) ---
  private readonly terrainCompression: boolean;
  private compressT = 0;
  private releaseT = 0;
  private compressed = false;
  private compressFactor = 1;
  private compressedCount = 0;
  private compressionRatio = 1;

  /** rolling rig CPU cost, written by the caller (game loop) */
  updateUsAvg = 0;

  // temporaries (no per-frame allocation)
  private readonly tmpDesired = new THREE.Vector3();
  private readonly tmpDolphin = new THREE.Vector3();
  private readonly tmpAimTarget = new THREE.Vector3();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpErr = new THREE.Vector3();

  constructor(
    aspect: number,
    collision: CameraCollisionLike = new CameraCollision(7.5, 7.5, RIG.COLLISION_RADIUS),
    // far plane: 900 in the pool, 2500 in the region (Master §7.5 —
    // additive cp04B parameter; the pool default is unchanged)
    far: number = RIG.FAR,
    // cp05: TerrainCompressed is region-only; the pool rig stays exactly
    // the approved cp02 behavior (the state remains a stub there)
    // cp05C: optional visual-waterline callback — with the Gerstner ocean
    // the render surface is wavy, so the anti-shimmer band and the swim/air
    // clamps become surface-relative. Absent (pool view), the waterline is
    // the constant y = 0 and behavior is bit-identical to the approved cp02.
    opts: { terrainCompression?: boolean; waterlineAt?: (x: number, z: number) => number } = {},
  ) {
    this.camera = new THREE.PerspectiveCamera(RIG.FOV, aspect, RIG.NEAR, far);
    this.collision = collision;
    this.terrainCompression = opts.terrainCompression ?? false;
    this.waterlineAt = opts.waterlineAt ?? null;
  }

  /** R key: ease the camera directly behind facing over RECENTER_S. */
  recenter(): void {
    this.recenterT = RIG.RECENTER_S;
  }

  update(s: SimState, dt: number): void {
    if (dt <= 0) return;
    const d = this.tmpDolphin.set(s.x, s.y, s.z);
    const air = s.phase === 'air';

    // cp05C: sample the visual waterline once per update at the dolphin
    // column (constant 0 without the callback — pool behavior unchanged)
    this.wl = this.waterlineAt ? this.waterlineAt(d.x, d.z) : 0;

    // --- smoothed velocity (first-order low-pass, t90 0.25 s) ---
    const vx = air ? s.vx : s.wvx;
    const vy = air ? s.vy : s.wvy;
    const vz = air ? s.vz : s.wvz;
    const kv = 1 - Math.exp((-dt * LN10) / RIG.T90_VEL_LP);
    this.velSmooth.x += (vx - this.velSmooth.x) * kv;
    this.velSmooth.y += (vy - this.velSmooth.y) * kv;
    this.velSmooth.z += (vz - this.velSmooth.z) * kv;
    const speed = Math.hypot(vx, vy, vz);

    // --- timers ---
    if (this.recenterT > 0) this.recenterT = Math.max(0, this.recenterT - dt);
    if (this.reentryT > 0) this.reentryT = Math.max(0, this.reentryT - dt);
    if (this.surfaceT > 0) this.surfaceT = Math.max(0, this.surfaceT - dt);
    if (this.shimmerHoldT > 0) this.shimmerHoldT = Math.max(0, this.shimmerHoldT - dt);
    if (!air && this.prevWasAir) this.reentryT = RIG.REENTRY_S;
    if (Math.sign(s.y) !== Math.sign(this.prevDolphinY) && Math.abs(s.y - this.prevDolphinY) < 2) {
      this.surfaceT = RIG.SURFACE_BLEND_S; // dolphin crossed y 0
    }
    this.prevDolphinY = s.y;
    this.prevWasAir = air;

    // --- state parameter targets ---
    const speedDist = THREE.MathUtils.lerp(
      RIG.FOLLOW_DIST,
      RIG.FOLLOW_DIST_BURST,
      THREE.MathUtils.clamp(speed / 9, 0, 1),
    );
    let distTarget = speedDist;
    if (air) distTarget = speedDist + RIG.BREACH_PULLBACK;
    else if (speed < RIG.HOVER_SPEED) distTarget = RIG.HOVER_DIST;

    // state parameter cross-fade (t90 0.3 s, inside the 0.2–0.5 band)
    const kx = 1 - Math.exp((-dt * LN10) / RIG.STATE_XFADE_T90);

    // cp05 TerrainCompressed: the distance/height parameter set blends down
    // 40 % while engaged (cross-faded — no parameter pops); inert (factor 1)
    // unless the region enabled the state.
    const compressTarget = this.compressed ? RIG.COMPRESS_FACTOR : 1;
    this.compressFactor += (compressTarget - this.compressFactor) * kx;
    distTarget *= this.compressFactor;

    this.distGoal += (distTarget - this.distGoal) * kx;

    // follow-distance spring (t90 0.6 s)
    this.dist = smoothDamp1(
      this.dist,
      this.distGoal,
      this.distVel,
      RIG.T90_DIST * T90_TO_SMOOTH,
      dt,
    );

    // --- desired position: behind horizontal facing, height above ---
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const desired = this.tmpDesired.set(
      d.x - fx * this.dist,
      d.y + RIG.HEIGHT * this.compressFactor,
      d.z - fz * this.dist,
    );
    // waterline discipline (carried cp01 virtue): while swimming, the eye
    // stays on the underwater side of the anti-shimmer band (the vendored
    // surface hides a submerged dolphin from an above-water eye); while
    // airborne it lifts above (breach air-lift) — the crossing itself is
    // sprung and continuous.
    if (air) desired.y = Math.max(desired.y, this.wl + RIG.SHIMMER_MIN_Y + 0.15);
    else desired.y = Math.min(desired.y, this.wl - RIG.SHIMMER_MIN_Y);

    // --- collision on the desired point (pool walls / region BVH
    // sphere-cast; dolly-in on block) ---
    const desiredLenPre = desired.distanceTo(d);
    const resolved = this.collision.resolve(d, desired);
    const obstructed = resolved.obstructed;
    desired.copy(resolved.pos);

    // --- cp05 TerrainCompressed engage/release (region only) ---
    // The ratio is always measured against the UNCOMPRESSED chase geometry
    // (a second probe cast while engaged), so the metric is stable across
    // the engage/release boundary and cannot self-release in a corridor.
    if (this.terrainCompression) {
      if (this.compressFactor > 0.999) {
        this.compressionRatio =
          desiredLenPre > 1e-4 ? desired.distanceTo(d) / desiredLenPre : 1;
      } else {
        const distU = this.dist / this.compressFactor;
        const probe = this.tmpV.set(
          d.x - fx * distU,
          Math.min(d.y + RIG.HEIGHT, air ? Infinity : this.wl - RIG.SHIMMER_MIN_Y),
          d.z - fz * distU,
        );
        const probeLen = probe.distanceTo(d);
        const probeResolved = this.collision.resolve(d, probe);
        this.compressionRatio =
          probeLen > 1e-4 ? probeResolved.pos.distanceTo(d) / probeLen : 1;
      }
      if (!this.compressed) {
        if (this.compressionRatio < RIG.COMPRESS_RATIO) {
          this.compressT += dt;
          if (this.compressT > RIG.COMPRESS_SUSTAIN_S) {
            this.compressed = true;
            this.compressedCount++;
            this.releaseT = 0;
          }
        } else {
          this.compressT = 0;
        }
      } else if (this.compressionRatio > RIG.COMPRESS_RELEASE_RATIO) {
        this.releaseT += dt;
        if (this.releaseT > RIG.COMPRESS_RELEASE_S) {
          this.compressed = false;
          this.compressT = 0;
        }
      } else {
        this.releaseT = 0;
      }
    }

    // --- LOS timer (convex pool: constant-clear; consumed for real at cp05) ---
    this.losBlockedS = this.collision.losClear(this.camPos, d) ? 0 : this.losBlockedS + dt;

    if (!this.initialized) {
      this.camPos.copy(desired);
      this.prevDesired.copy(desired);
      this.aimPos.copy(d);
      this.initialized = true;
    }

    // --- emergency detection: distance error > 3× target, or LOS > 0.3 s ---
    const followDist = this.camPos.distanceTo(d);
    const targetDist = Math.hypot(this.dist, RIG.HEIGHT);
    if (
      !this.emergency &&
      (this.losBlockedS > RIG.EMERGENCY_LOS_S ||
        followDist > RIG.EMERGENCY_DIST_FACTOR * targetDist)
    ) {
      this.emergency = true;
      this.emergencyCount++;
    } else if (this.emergency && followDist < 1.3 * targetDist) {
      this.emergency = false;
    }

    // --- asymmetric position damping ---
    // receding = the desired point is pulling away from the camera along the
    // error direction, or the camera sits far off the behind-facing azimuth
    // (a hard turn IS the dolphin pulling away) → catch-up; else settle.
    const err = this.tmpErr.copy(desired).sub(this.camPos);
    const errLen = err.length();
    const desiredVel = this.tmpV.copy(desired).sub(this.prevDesired).divideScalar(dt);
    this.prevDesired.copy(desired);
    const recede = errLen > 1e-4 ? desiredVel.dot(err) / errLen : 0;
    const camAz = Math.atan2(this.camPos.x - d.x, this.camPos.z - d.z);
    const behindAz = Math.atan2(-fx, -fz);
    this.azimuthErrorRad = Math.abs(angleDelta(camAz, behindAz));
    let posT90: number =
      recede > 0.15 || this.azimuthErrorRad > 0.4 ? RIG.T90_CATCH : RIG.T90_SETTLE;
    if (obstructed) posT90 = Math.min(posT90, RIG.T90_OBSTRUCT);
    if (this.recenterT > 0) posT90 = Math.min(posT90, RIG.T90_CATCH);
    if (this.emergency) posT90 = RIG.T90_EMERGENCY;
    // cross-fade the damping parameter itself (no jerk on state edges)
    const targetSmooth = posT90 * T90_TO_SMOOTH;
    this.posSmooth += (targetSmooth - this.posSmooth) * kx;

    // --- position spring + continuity cap ---
    const before = this.tmpV.copy(this.camPos);
    smoothDampV3(this.camPos, desired, this.camVel, this.posSmooth, dt);
    const step = this.camPos.distanceTo(before);
    const maxStep = RIG.MAX_CAM_SPEED * dt;
    if (step > maxStep) {
      this.camPos.sub(before).multiplyScalar(maxStep / step).add(before);
      this.camVel.multiplyScalar(maxStep / step);
    }

    // --- wall guarantee + waterline anti-shimmer hold ---
    this.collision.clampPoint(this.camPos);
    this.applyAntiShimmer(desired.y);

    // --- aim: look-ahead along smoothed velocity (facing during recenter) ---
    const vs = this.velSmooth.length();
    const lead = RIG.LOOK_AHEAD * THREE.MathUtils.clamp(vs / RIG.FAST_SPEED, 0, 1);
    const aimTarget = this.tmpAimTarget.copy(d);
    if (this.recenterT > 0) {
      aimTarget.x += fx * lead;
      aimTarget.z += fz * lead;
    } else if (vs > 1e-3) {
      aimTarget.addScaledVector(this.velSmooth, lead / vs);
    }
    const aimT90 = this.emergency ? RIG.T90_EMERGENCY : RIG.T90_AIM;
    smoothDampV3(this.aimPos, aimTarget, this.aimVel, aimT90 * T90_TO_SMOOTH, dt);

    // --- apply ---
    this.camera.position.copy(this.camPos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.aimPos);
    this.rollRad = -s.roll * RIG.ROLL_COUPLE;
    this.camera.rotateZ(this.rollRad);

    // aim error: camera forward vs live desired aim direction
    const fwd = this.tmpV.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const toAim = aimTarget.sub(this.camPos).normalize(); // aimTarget is a temp — consumed here
    this.aimErrorRad = Math.acos(THREE.MathUtils.clamp(fwd.dot(toAim), -1, 1));

    // --- state reporting (priority order; TerrainCompressed live at cp05) ---
    const next: CameraStateName = this.emergency
      ? 'EmergencyRecenter'
      : this.surfaceT > 0
        ? 'SurfaceTransition'
        : air
          ? 'Airborne'
          : this.reentryT > 0
            ? 'ReEntryRecovery'
            : this.compressed
              ? 'TerrainCompressed'
              : obstructed
                ? 'Obstructed'
                : speed < RIG.HOVER_SPEED
                  ? 'SlowHover'
                  : speed > RIG.FAST_SPEED
                    ? 'FastTravel'
                    : 'NormalFollow';
    if (next !== this.state) {
      this.state = next;
      this.stateTime = 0;
    } else {
      this.stateTime += dt;
    }
  }

  /**
   * Waterline anti-shimmer (cp02 §6 [DERIVED], flagged): within ±SURFACE_BAND
   * of y 0 the eye holds |y| ≥ SHIMMER_MIN_Y on its current side for at least
   * SHIMMER_HOLD_S per crossing — a committed crossing passes straight
   * through (continuous, never a cut) and then holds on the new side.
   */
  private applyAntiShimmer(desiredY: number): void {
    // cp05C: the band is measured relative to the visual waterline at the
    // dolphin column (wl = 0 in the pool — identical arithmetic to cp02)
    const y = this.camPos.y - this.wl;
    const dY = desiredY - this.wl;
    if (Math.abs(y) >= RIG.SURFACE_BAND) {
      this.side = y >= 0 ? 1 : -1;
      return;
    }
    const wantSide: -1 | 1 = dY >= 0 ? 1 : -1;
    const committed =
      wantSide !== this.side && Math.abs(dY) >= RIG.SHIMMER_MIN_Y && this.shimmerHoldT === 0;
    if (committed) {
      const crossed = Math.sign(y) === wantSide && Math.abs(y) > 0;
      if (crossed) {
        this.side = wantSide;
        this.shimmerHoldT = RIG.SHIMMER_HOLD_S;
        this.crossings++;
      }
      return; // passing through the band — do not clamp mid-crossing
    }
    // not crossing: hold clear of the surface on the current side
    if (this.side === -1 && y > -RIG.SHIMMER_MIN_Y) {
      this.camPos.y = this.wl - RIG.SHIMMER_MIN_Y;
      if (this.camVel.y > 0) this.camVel.y = 0;
      this.antiShimmerCount++;
    } else if (this.side === 1 && y < RIG.SHIMMER_MIN_Y) {
      this.camPos.y = this.wl + RIG.SHIMMER_MIN_Y;
      if (this.camVel.y < 0) this.camVel.y = 0;
      this.antiShimmerCount++;
    }
  }

  evalState(dolphin?: { x: number; y: number; z: number }): CameraEvalState {
    const followDistM = dolphin
      ? this.camPos.distanceTo(this.tmpV.set(dolphin.x, dolphin.y, dolphin.z))
      : 0;
    return {
      state: this.state,
      stateTimeS: this.stateTime,
      x: this.camPos.x,
      y: this.camPos.y,
      z: this.camPos.z,
      fov: this.camera.fov,
      followDistM,
      desiredDistM: this.dist,
      aimErrorRad: this.aimErrorRad,
      azimuthErrorRad: this.azimuthErrorRad,
      rollRad: this.rollRad,
      recenterActiveS: this.recenterT,
      antiShimmerEngagements: this.antiShimmerCount,
      surfaceCrossings: this.crossings,
      losBlockedS: this.losBlockedS,
      emergencyCount: this.emergencyCount,
      updateUsAvg: this.updateUsAvg,
      compressionRatio: this.compressionRatio,
      compressFactor: this.compressFactor,
      terrainCompressedCount: this.compressedCount,
      bvhClearanceM:
        (this.collision as { lastClearanceM?: number }).lastClearanceM ?? Infinity,
    };
  }
}

/** shortest signed angular difference a→b in radians */
function angleDelta(a: number, b: number): number {
  let x = (b - a) % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
