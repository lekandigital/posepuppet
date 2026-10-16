// CameraRig (Checkpoint 02): the Track E chase-camera rig replacing the
// ported cp01 baseline camera — critically damped spring position with
// asymmetric damping, smoothed-velocity look-ahead, speed-based follow
// distance, a camera state machine with parameter cross-fades, analytic
// pool-wall collision and R recenter.
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
//
// CP10 (Tidewater host): ported verbatim from apps/shared-world/src/game/
// cameraRig.ts with exactly two changes — (1) `three` is replaced by the
// Tidewater engine's three-compatible CPU math (Vector3 / MathUtils; identical
// API, no renderer involved), and (2) the rig no longer constructs its own
// THREE.PerspectiveCamera: it drives the HOST camera it is given (Tidewater's
// engine camera), writing position / quaternion / fov so Tidewater's own
// reversed-Z projection, waterline compositing, temporal state and post chain
// render through the chase pose. `near` stays 0.1 (RIG.NEAR == Tidewater's
// lens plane); `far` is left to Tidewater (60 000 m: island + sky + clouds).
//
// CP10 continuation (user directive, "Fix the split-waterline problem"): the
// waterline anti-shimmer hold inherited from the old BodyArcade renderer is
// REMOVED for the Tidewater host — the ±0.75 m SURFACE_BAND, the 0.35 m
// SHIMMER_MIN_Y exclusion, the per-crossing SHIMMER_HOLD_S side lock, the
// swim-side / air-side clamps on the desired point and the matching clamp in
// the TerrainCompressed probe. The eye now goes wherever the chase geometry
// puts it, including onto and through the sea surface, so Tidewater's own
// near-plane waterline renderer (vendor post/Underwater.js: LENS_REACH,
// per-pixel medium, meniscus) decides what the lens sees — waves crossing a
// stationary lens produce the same split above / below view as the pristine
// game. Airborne framing is still the BREACH_PULLBACK on the follow distance
// (an ordinary framing effect), no longer a rendering constraint. The surface-
// crossing detector that drives SurfaceTransition is measured against the
// local waterline (the dolphin crossing the actual sea surface), not y = 0:
// with the swell ride lifting the rendered dolphin by the wave height, the
// flat check fired on every passing wave and held the state machine in
// SurfaceTransition while hovering (the 41/42 play-test miss). Every other
// constant, spring, state and clamp is the approved cp02/cp05/cp05C/cp09
// behavior, unchanged.

import { Vector3, MathUtils } from '../../vendor/tidewater/src/engine/index.js';
import type { SimState } from './sim';
import { CameraCollision, type CameraCollisionLike } from './cameraCollision';

/** The host camera surface the rig writes (Tidewater's PerspectiveCamera). */
export interface HostCamera {
  position: Vector3;
  up: Vector3;
  quaternion: { x: number; y: number; z: number; w: number };
  fov: number;
  near: number;
  far: number;
  lookAt(target: Vector3): unknown;
  rotateZ(angle: number): unknown;
  updateProjectionMatrix(): void;
}

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
  // (cp02's SURFACE_BAND / SHIMMER_MIN_Y / SHIMMER_HOLD_S anti-shimmer hold is
  // deliberately absent in the Tidewater rig — see the header; a regression
  // test asserts it stays absent)
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
  current: Vector3,
  target: Vector3,
  velocity: Vector3,
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
  /** times the EYE crossed the local waterline (the lens went through the surface) */
  surfaceCrossings: number;
  /** eye height relative to the local waterline, m (|value| < ~0.1 → the lens straddles the surface) */
  eyeAboveWaterM: number;
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
  readonly camera: HostCamera;
  readonly collision: CameraCollisionLike;

  private state: CameraStateName = 'NormalFollow';
  private stateTime = 0;

  private readonly camPos = new Vector3();
  private readonly camVel = new Vector3();
  private readonly aimPos = new Vector3();
  private readonly aimVel = new Vector3();
  private readonly velSmooth = new Vector3();
  private readonly prevDesired = new Vector3();

  private dist: number = RIG.FOLLOW_DIST;
  private readonly distVel = { v: 0 };
  /** cross-faded state parameter: follow-distance goal (pre-spring) */
  private distGoal: number = RIG.FOLLOW_DIST;
  /** cross-faded state parameter: position smoothTime */
  private posSmooth = RIG.T90_SETTLE * T90_TO_SMOOTH;

  private recenterT = 0;
  private reentryT = 0;
  private surfaceT = 0;
  /** dolphin height relative to the local waterline last update (surface-crossing detector) */
  private prevDolphinRel = -2.5;
  /** eye height relative to the local waterline last update (crossing counter) */
  private prevEyeRel: number | null = null;
  private prevWasAir = false;
  private emergency = false;
  private emergencyCount = 0;
  private losBlockedS = 0;
  private crossings = 0;
  private aimErrorRad = 0;
  private azimuthErrorRad = 0;
  private rollRad = 0;
  private initialized = false;
  private snapGraceS = 0;

  // --- cp05C visual waterline (null = constant y 0, the pool behavior) ---
  private readonly waterlineAt: ((x: number, z: number) => number) | null = null;
  private readonly interiorFollowScale: ((x: number, y: number, z: number) => number) | null = null;
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
  private readonly tmpDesired = new Vector3();
  private readonly tmpDolphin = new Vector3();
  private readonly tmpAimTarget = new Vector3();
  private readonly tmpV = new Vector3();
  private readonly tmpErr = new Vector3();

  constructor(
    // CP10: the HOST camera (Tidewater's). The rig used to construct its own
    // THREE.PerspectiveCamera(RIG.FOV, aspect, RIG.NEAR, far); here it takes
    // ownership of the lens state of the camera it is handed instead: fov =
    // RIG.FOV, near = RIG.NEAR (== Tidewater's 0.1 lens plane), far untouched.
    camera: HostCamera,
    collision: CameraCollisionLike = new CameraCollision(7.5, 7.5, RIG.COLLISION_RADIUS),
    // cp05: TerrainCompressed is region-only; the pool rig stays exactly
    // the approved cp02 behavior (the state remains a stub there)
    // cp05C: optional visual-waterline callback — with a wavy sea the
    // dolphin's surface-crossing detector (SurfaceTransition) and the eye
    // crossing counter are measured against the local surface. Absent (pool
    // view), the waterline is the constant y = 0.
    opts: {
      terrainCompression?: boolean;
      waterlineAt?: (x: number, z: number) => number;
      /** cp09: < 1 shortens the chase inside a cave bore so the eye stays in the void */
      interiorFollowScale?: (x: number, y: number, z: number) => number;
    } = {},
  ) {
    this.camera = camera;
    this.camera.fov = RIG.FOV;
    this.camera.near = RIG.NEAR;
    this.camera.updateProjectionMatrix();
    this.collision = collision;
    this.terrainCompression = opts.terrainCompression ?? false;
    this.waterlineAt = opts.waterlineAt ?? null;
    this.interiorFollowScale = opts.interiorFollowScale ?? null;
  }

  /** R key: ease the camera directly behind facing over RECENTER_S. */
  recenter(): void {
    this.recenterT = RIG.RECENTER_S;
  }

  /**
   * Next update copies the resolved chase point onto the eye (teleport /
   * scripted-swim catch-up). The continuity cap still applies after that
   * frame; this does not punch through walls on the live chase.
   */
    snap(): void {
    this.initialized = false;
    this.emergency = false;
    this.emergencyCount = 0;
    this.losBlockedS = 0;
    this.snapGraceS = 1.2;
    this.camVel.set(0, 0, 0);
    this.aimVel.set(0, 0, 0);
    this.prevEyeRel = null; // a teleport is not a surface crossing
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
    if (!air && this.prevWasAir) this.reentryT = RIG.REENTRY_S;
    // the dolphin crossed the SEA SURFACE (local waterline; y 0 in the pool) — a breach or a
    // re-entry, not a passing wave lifting the rendered dolphin at the surface
    const dolphinRel = s.y - this.wl;
    if (Math.sign(dolphinRel) !== Math.sign(this.prevDolphinRel) && Math.abs(dolphinRel - this.prevDolphinRel) < 2) {
      this.surfaceT = RIG.SURFACE_BLEND_S;
    }
    this.prevDolphinRel = dolphinRel;
    this.prevWasAir = air;

    // --- state parameter targets ---
    const speedDist = MathUtils.lerp(
      RIG.FOLLOW_DIST,
      RIG.FOLLOW_DIST_BURST,
      MathUtils.clamp(speed / 9, 0, 1),
    );
    let distTarget = speedDist;
    if (air) distTarget = speedDist + RIG.BREACH_PULLBACK;
    else if (speed < RIG.HOVER_SPEED) distTarget = RIG.HOVER_DIST;
    if (this.interiorFollowScale) {
      distTarget *= this.interiorFollowScale(d.x, d.y, d.z);
    }

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
    // No waterline discipline here (CP10 continuation): the eye may sit on,
    // straddle or pass through the sea surface; Tidewater's renderer shows the
    // split view. Airborne framing is the BREACH_PULLBACK above.

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
          d.y + RIG.HEIGHT,
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
    if (this.snapGraceS > 0) {
      this.snapGraceS = Math.max(0, this.snapGraceS - dt);
      this.emergency = false;
      this.losBlockedS = 0;
    }
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

    // --- wall guarantee (solid geometry only; the sea surface is not a wall) ---
    this.collision.clampPoint(this.camPos);
    // eye / waterline crossings: a metric for the waterline tests, never a clamp
    const eyeRel = this.camPos.y - this.wl;
    if (this.prevEyeRel !== null && Math.sign(eyeRel) !== Math.sign(this.prevEyeRel)) this.crossings++;
    this.prevEyeRel = eyeRel;

    // --- aim: look-ahead along smoothed velocity (facing during recenter) ---
    const vs = this.velSmooth.length();
    const lead = RIG.LOOK_AHEAD * MathUtils.clamp(vs / RIG.FAST_SPEED, 0, 1);
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
    this.aimErrorRad = Math.acos(MathUtils.clamp(fwd.dot(toAim), -1, 1));

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
      surfaceCrossings: this.crossings,
      eyeAboveWaterM: this.camPos.y - this.wl,
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
