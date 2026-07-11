// The swim model: a pure, fixed-timestep, RNG-free state machine — every
// run over the same intent sequence is byte-identical (the replay spec
// asserts it). Impulse-and-glide propulsion (the Rowing-proven feel:
// each kick banks a surge applied with a short attack; water drag is
// PROPORTIONAL to speed so every kick cadence settles at its own speed
// and stillness is a long glide, never a hard stop), pitch dive/surface
// with auto-level, banked turns, a soft containment current derived from
// the real-bay SDF (walls are water that pushes back, not geometry), and
// the breach: speed + sustained pitch-up near the surface goes ballistic.

import {
  loadBoundary, pointInWater, signedDistanceToShore,
  type BoundaryData,
} from '@bodyarcade/world-data';
import boundaryJson from '../../../../packages/world-data/data/boundaries/san-francisco-bay.json';

export type AssistMode = 'full' | 'standard' | 'expert';
export type Phase = 'swim' | 'air';

export interface SwimIntent {
  /** -1..1, + = dive (nose down) */
  pitch: number;
  /** -1..1, + = roll/turn toward the user's right */
  roll: number;
  /** kick impulses completed since the previous step (count delta) */
  kicks: number;
  /** 0..1 amplitude of the last kick */
  kickAmp: number;
  /** current kick rate, Hz (drives the body undulation visual) */
  kickRate: number;
  burst: boolean;
  /** -1..1, + = descend (crouch), − = ascend (stretch tall) */
  depthTrim: number;
  /** tracking lost — glide straight, level out, never snap */
  autopilot: boolean;
}

export const NEUTRAL_INTENT: SwimIntent = {
  pitch: 0, roll: 0, kicks: 0, kickAmp: 0, kickRate: 0,
  burst: false, depthTrim: 0, autopilot: false,
};

/** All feel constants in one table (the Gate-approval unit). */
export const SIM = {
  DT: 1 / 120,
  /** boundary metres → game metres (shape sacred, size gamified) */
  WORLD_SCALE: 1 / 15,
  // propulsion
  KICK_IMPULSE: 4.2,        // m/s banked per kick at amp 1
  KICK_AMP_FLOOR: 0.55,     // impulse floor so weak kicks still move
  SURGE_ATTACK_TAU: 0.30,   // s — the visible per-kick lunge
  GLIDE_TAU: 6.0,           // s — proportional drag; long dolphin glide
  MAX_SPEED: 16,
  BURST_ACCEL: 9,           // m/s² while burst is held
  BURST_MAX_SPEED: 22,
  // attitude
  PITCH_RATE: 1.5,          // rad/s at full deflection
  PITCH_MAX: 1.0,           // rad (~57°)
  ROLL_RATE: 2.2,
  ROLL_MAX: 0.9,
  TURN_COUPLE: 1.1,         // bank-to-turn: yawRate = roll · couple · speedFactor
  AUTOLEVEL: { full: 2.2, standard: 1.1, expert: 0 } as Record<AssistMode, number>,
  // depth
  TRIM_SPEED: 3.5,          // m/s vertical from crouch/stretch
  SURFACE_Y: -0.4,          // resting ceiling below the surface plane
  SEABED_CLEAR: 1.2,
  DEPTH_MIN: 3.5,           // shallow near shore
  DEPTH_MAX: 34,
  DEPTH_SDF_GAIN: 0.5,      // depth grows ~sqrt of shore distance
  ASSIST_DEPTH_FRAC: 0.75,  // Full Assist keeps y above −frac·localDepth
  // containment current
  SHORE_BAND: 55,           // game metres of soft push near the edge
  SHORE_PUSH: 10.5,         // peak inward acceleration m/s²
  SHORE_YAW_ASSIST: 0.9,    // Full Assist heading bias away from shore
  // assists
  DRIFT_SPEED: 1.6,         // Full Assist: stillness never strands
  DRIFT_TAU: 3.0,
  // autopilot (tracking loss)
  AUTOPILOT_LEVEL_TAU: 0.8,
  // breach
  BREACH_MIN_SPEED: 10,
  BREACH_MIN_VY: 3.2,
  BREACH_GRAVITY: 7.5,      // dreamy, slightly sub-earth
  BREACH_REENTRY_KEEP: 0.85,
  BREACH_COOLDOWN_S: 1.0,
} as const;

/** Deterministic 2-D value noise (integer-hash based, no RNG state). */
function hash2(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}
export function valueNoise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

export interface SimState {
  phase: Phase;
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number;
  surge: number;
  /** airborne ballistic velocity (breach) */
  vx: number; vy: number; vz: number;
  kickCount: number;
  breachCount: number;
  /** set for one step when re-entry happens (splash hook) */
  splashed: boolean;
  breachCooldown: number;
  time: number;
}

export class SwimSim {
  readonly boundary: BoundaryData;
  state: SimState;
  assist: AssistMode = 'full';

  constructor() {
    this.boundary = loadBoundary(boundaryJson);
    this.state = this.spawnState();
  }

  /** Spawn mid-Central-Bay (projected metres → game metres). The seed is
   *  nudged deterministically until it has real water around it (60 game
   *  metres of shore clearance) — a seed grazing a pier is a config bug
   *  this refuses to inherit (the first pick sat 1 m off the Marina). */
  private spawnState(): SimState {
    let [sx, sz] = this.toGame(-10100, 16700); // Central Bay, Alcatraz–Berkeley reach
    for (let r = 0; !(this.inWater(sx, sz) && this.shoreDistance(sx, sz) > 60) && r < 200; r++) {
      sx += 15;
    }
    return {
      phase: 'swim', x: sx, y: -6, z: sz,
      yaw: 0.5, pitch: 0, roll: 0, speed: 2, surge: 0,
      vx: 0, vy: 0, vz: 0,
      kickCount: 0, breachCount: 0, splashed: false, breachCooldown: 0, time: 0,
    };
  }

  /** boundary metres → game metres (game z = −boundary y so north = −z). */
  toGame(bx: number, by: number): [number, number] {
    return [bx * SIM.WORLD_SCALE, -by * SIM.WORLD_SCALE];
  }
  toBoundary(x: number, z: number): [number, number] {
    return [x / SIM.WORLD_SCALE, -z / SIM.WORLD_SCALE];
  }

  /** Signed distance to shore in GAME metres (+ = water). */
  shoreDistance(x: number, z: number): number {
    const [bx, by] = this.toBoundary(x, z);
    return signedDistanceToShore(this.boundary, bx, by) * SIM.WORLD_SCALE;
  }

  inWater(x: number, z: number): boolean {
    const [bx, by] = this.toBoundary(x, z);
    return pointInWater(this.boundary, bx, by);
  }

  /** Local seabed depth (game metres, positive down): SDF + value noise. */
  depthAt(x: number, z: number): number {
    const d = Math.max(0, this.shoreDistance(x, z));
    const base = SIM.DEPTH_MIN + SIM.DEPTH_SDF_GAIN * Math.sqrt(d) * 4;
    const n = valueNoise2(x * 0.011, z * 0.011) * 6 + valueNoise2(x * 0.047, z * 0.047) * 2;
    return Math.min(SIM.DEPTH_MAX, base + n - 4);
  }

  reset(): void {
    this.state = this.spawnState();
  }

  step(intent: SwimIntent, dt = SIM.DT): void {
    const s = this.state;
    s.time += dt;
    s.splashed = false;
    if (s.breachCooldown > 0) s.breachCooldown = Math.max(0, s.breachCooldown - dt);

    if (s.phase === 'air') {
      this.stepAir(dt);
      return;
    }

    // --- attitude ---
    const levelK = intent.autopilot
      ? 1 / SIM.AUTOPILOT_LEVEL_TAU
      : SIM.AUTOLEVEL[this.assist];
    s.pitch += intent.pitch * SIM.PITCH_RATE * dt;
    if (Math.abs(intent.pitch) < 0.15 || intent.autopilot) s.pitch -= s.pitch * levelK * dt;
    s.pitch = clamp(s.pitch, -SIM.PITCH_MAX, SIM.PITCH_MAX);

    s.roll += intent.roll * SIM.ROLL_RATE * dt;
    if (Math.abs(intent.roll) < 0.15 || intent.autopilot) s.roll -= s.roll * Math.max(levelK, 1.2) * dt;
    s.roll = clamp(s.roll, -SIM.ROLL_MAX, SIM.ROLL_MAX);

    // banking right (roll+) turns right: with heading (sin yaw, cos yaw),
    // clockwise-from-above = yaw increasing
    const speedFactor = 0.35 + 0.65 * Math.min(1, s.speed / 8);
    s.yaw += s.roll * SIM.TURN_COUPLE * speedFactor * dt;

    // --- propulsion: impulse and glide ---
    if (intent.kicks > 0) {
      const amp = SIM.KICK_AMP_FLOOR + (1 - SIM.KICK_AMP_FLOOR) * clamp(intent.kickAmp, 0, 1);
      s.surge += intent.kicks * SIM.KICK_IMPULSE * amp;
      s.kickCount += intent.kicks;
    }
    const surgeOut = s.surge * (dt / SIM.SURGE_ATTACK_TAU);
    s.surge -= surgeOut;
    s.speed += surgeOut;
    if (intent.burst) s.speed += SIM.BURST_ACCEL * dt;
    s.speed -= s.speed * (dt / SIM.GLIDE_TAU); // proportional drag — the glide
    if (this.assist === 'full' && !intent.autopilot && s.speed < SIM.DRIFT_SPEED) {
      s.speed += ((SIM.DRIFT_SPEED - s.speed) * dt) / SIM.DRIFT_TAU; // never strands
    }
    s.speed = clamp(s.speed, 0, intent.burst ? SIM.BURST_MAX_SPEED : SIM.MAX_SPEED);

    // --- velocity ---
    const cp = Math.cos(s.pitch);
    let vx = Math.sin(s.yaw) * cp * s.speed;
    let vz = Math.cos(s.yaw) * cp * s.speed;
    let vy = -Math.sin(s.pitch) * s.speed - intent.depthTrim * SIM.TRIM_SPEED;

    // --- containment current: the water pushes back near the shore ---
    const sd = this.shoreDistance(s.x, s.z);
    if (sd < SIM.SHORE_BAND) {
      const t = clamp(1 - sd / SIM.SHORE_BAND, 0, 1);
      // inward gradient by central differences on the SDF
      const e = 2;
      const gx = this.shoreDistance(s.x + e, s.z) - this.shoreDistance(s.x - e, s.z);
      const gz = this.shoreDistance(s.x, s.z + e) - this.shoreDistance(s.x, s.z - e);
      const gl = Math.hypot(gx, gz) || 1;
      const nx = gx / gl;
      const nz = gz / gl;
      const push = SIM.SHORE_PUSH * t * t;
      vx += nx * push * dt * 60; // frame-rate-neutral: dt·60 ≈ per-frame push at 60 fps
      vz += nz * push * dt * 60;
      // damp the outward velocity component progressively (soft, no wall)
      const out = -(vx * nx + vz * nz);
      if (out > 0) {
        const damp = Math.min(1, t * t * 2.2 * dt * 10);
        vx += nx * out * damp;
        vz += nz * out * damp;
      }
      if (this.assist === 'full') {
        // gentle heading bias away from the shore (rowing's course-follow idea)
        const inwardYaw = Math.atan2(nx, nz);
        s.yaw += angleDelta(s.yaw, inwardYaw) * SIM.SHORE_YAW_ASSIST * t * t * dt;
      }
    }

    // --- breach eligibility: crossing the surface fast, nose up ---
    const nextY = s.y + vy * dt;
    if (
      nextY > SIM.SURFACE_Y &&
      s.pitch < -0.35 && // pitch− = nose up
      s.speed >= SIM.BREACH_MIN_SPEED &&
      vy >= SIM.BREACH_MIN_VY &&
      s.breachCooldown === 0
    ) {
      s.phase = 'air';
      s.vx = vx;
      s.vy = vy;
      s.vz = vz;
      s.breachCount += 1;
      s.x += vx * dt;
      s.y = nextY;
      s.z += vz * dt;
      return;
    }

    // --- integrate with soft vertical clamps ---
    let nx2 = s.x + vx * dt;
    let nz2 = s.z + vz * dt;
    let ny2 = nextY;
    const ceiling = SIM.SURFACE_Y;
    if (ny2 > ceiling) ny2 = s.y + (ceiling - s.y) * Math.min(1, dt * 8); // soft surface spring
    const floor = -this.depthAt(nx2, nz2) + SIM.SEABED_CLEAR;
    if (ny2 < floor) ny2 = s.y + (floor - s.y) * Math.min(1, dt * 8);
    if (this.assist === 'full') {
      const assistFloor = -this.depthAt(nx2, nz2) * SIM.ASSIST_DEPTH_FRAC;
      if (ny2 < assistFloor) ny2 = s.y + (assistFloor - s.y) * Math.min(1, dt * 6);
    }

    // --- absolute guarantee: never leave the polygon (soft slide) ---
    if (!this.inWater(nx2, nz2)) {
      if (this.inWater(nx2, s.z)) {
        nz2 = s.z; // slide along x
      } else if (this.inWater(s.x, nz2)) {
        nx2 = s.x; // slide along z
      } else {
        nx2 = s.x;
        nz2 = s.z; // last resort: hold (one-frame displacement, band prevents jolts)
      }
      s.speed *= 1 - Math.min(0.5, dt * 4); // scrub a little energy, smoothly
    }
    s.x = nx2;
    s.y = ny2;
    s.z = nz2;
  }

  private stepAir(dt: number): void {
    const s = this.state;
    s.vy -= SIM.BREACH_GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    // attitude follows the arc (nose traces the ballistic tangent)
    const hSpeed = Math.hypot(s.vx, s.vz) || 1e-6;
    s.pitch = clamp(-Math.atan2(s.vy, hSpeed), -SIM.PITCH_MAX, SIM.PITCH_MAX);
    s.roll -= s.roll * 2 * dt;
    if (s.y <= SIM.SURFACE_Y && s.vy < 0) {
      s.phase = 'swim';
      s.speed = Math.hypot(s.vx, s.vy, s.vz) * SIM.BREACH_REENTRY_KEEP;
      s.yaw = Math.atan2(s.vx, s.vz);
      s.splashed = true;
      s.breachCooldown = SIM.BREACH_COOLDOWN_S;
      // keep containment honest even on re-entry
      if (!this.inWater(s.x, s.z)) {
        // re-enter where we left the water: walk back along the arc
        s.x -= s.vx * 0.2;
        s.z -= s.vz * 0.2;
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** shortest signed angular difference a→b in radians */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
