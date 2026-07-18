// The swim model, ported from apps/dolphin (Implementation Master §3.2–3.3):
// a pure, fixed-timestep, RNG-free state machine — every run over the same
// intent sequence is byte-identical (the replay spec asserts it).
// Impulse-and-glide propulsion (each kick banks a surge applied with a
// short attack; drag is PROPORTIONAL to speed so every cadence settles at
// its own speed and stillness is a long glide), pitch dive/surface with
// auto-level, banked turns, soft containment against the injected
// WorldSampler (walls are water that pushes back, not geometry), and the
// breach: speed + sustained pitch-up near the surface goes ballistic.
//
// Checkpoint-01 changes from the dolphin original (Master §7.3–§7.4):
//  - WorldSampler seam replaces the SF-Bay boundary import (WORLD_SCALE,
//    toGame/toBoundary, DEPTH_* deleted).
//  - Governed speed family: cruise 5 / burst 9 m/s.
//  - Velocity chases facing (VEL_FOLLOW_TAU) — arcs and visible slip.
//  - Speed-shaped turn authority (TURN_AUTHORITY_LOW/CRUISE) replaces
//    TURN_COUPLE × speedFactor: agile slow, wide fast.
//  - Auto-bank toward BANK_AUTO_MAX merged with manual roll (Track E).
//  - Near-vertical pitch authority (PITCH_MAX 85°).
//  - Keyboard brake (X): cruise→~0 in 0.6 s, exits to hover.

import type { WorldSampler } from './worldSampler';

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
  /** active brake (keyboard X): strong decel toward hover */
  brake: boolean;
  /** -1..1, + = descend (crouch), − = ascend (stretch tall) */
  depthTrim: number;
  /** tracking lost — glide straight, level out, never snap */
  autopilot: boolean;
}

export const NEUTRAL_INTENT: SwimIntent = {
  pitch: 0, roll: 0, kicks: 0, kickAmp: 0, kickRate: 0,
  burst: false, brake: false, depthTrim: 0, autopilot: false,
};

/** All feel constants in one table (the Gate-approval unit) — Master §7.4. */
export const SIM = {
  DT: 1 / 120,
  // propulsion — governed 5/9 family
  KICK_IMPULSE: 1.3,        // m/s banked per kick at amp 1 [DERIVED 5/16 × 4.2]
  KICK_AMP_FLOOR: 0.55,     // impulse floor so weak kicks still move
  SURGE_ATTACK_TAU: 0.30,   // s — the visible per-kick lunge
  GLIDE_TAU: 6.0,           // s — proportional drag; long dolphin glide
                            // (Track E candidate ≈2.9 s on offer at review)
  MAX_SPEED: 5,             // [GOVERNED] cruise
  BURST_ACCEL: 6,           // m/s² while burst held [DERIVED ~0.67 s to cap]
  BURST_MAX_SPEED: 9,       // [GOVERNED] burst
  // attitude
  PITCH_RATE: 1.5,          // rad/s at full deflection
  PITCH_MAX: 1.48,          // rad (~85°) near-vertical authority [Track E]
  ROLL_RATE: 2.2,           // rad/s slew limit on bank changes
  ROLL_MAX: 0.9,            // rad bank clamp (manual + auto merged)
  BANK_AUTO_MAX: 0.61,      // rad (35°) auto-bank at full yaw input [Track E]
  BANK_TAU: 0.3,            // s bank spring (Track E "roll response 0.3 s")
  TURN_AUTHORITY_LOW: 2.71,    // 1/s per rad bank at ≤1 m/s (140°/s full bank)
  TURN_AUTHORITY_CRUISE: 1.74, // 1/s per rad bank at ≥5 m/s (90°/s full bank)
  // velocity-chases-facing (Track E principle 4)
  VEL_FOLLOW_TAU_FLOOR: 0.25,  // s below 2 m/s
  VEL_FOLLOW_TAU_CRUISE: 0.35, // s at cruise 5
  VEL_FOLLOW_TAU_BURST: 0.55,  // s at burst 9 (longer fast = wider arcs)
  MIN_CONTROL_SPEED: 0.75,     // m/s hover threshold [Track E 0.3 E-BL/s]
  BRAKE_TAU: 0.15,          // s exponential decel: 5 m/s → <0.1 in 0.6 s
  AUTOLEVEL: { full: 2.2, standard: 1.1, expert: 0 } as Record<AssistMode, number>,
  // depth
  TRIM_SPEED: 3.5,          // m/s vertical from crouch/stretch
  SURFACE_Y: -0.4,          // resting ceiling below the surface plane
  SEABED_CLEAR: 1.2,
  ASSIST_DEPTH_FRAC: 0.75,  // Full Assist keeps y above −frac·localDepth
  // containment current (band clamped by sampler.containmentBand — the
  // 55 m value is region-scale, review item at cp04B)
  SHORE_BAND: 55,
  SHORE_PUSH: 10.5,         // peak inward acceleration m/s²
  SHORE_YAW_ASSIST: 0.9,    // Full Assist heading bias away from shore
  // assists
  DRIFT_SPEED: 0.5,         // Full Assist: stillness never strands [DERIVED 10 % of cruise]
  DRIFT_TAU: 3.0,
  // autopilot (tracking loss). Old value 0.8: with PITCH_MAX raised to
  // 1.48 rad the governed dropout-smoothness bound (max pitch step
  // < 0.12 rad/100 ms) is arithmetically unsatisfiable at 0.8
  // (1.48·(1−e^(−0.125)) ≈ 0.174). τ ≥ 1.18 satisfies it; 1.4 adds
  // margin. [DERIVED — reported as a cp01 deviation]
  AUTOPILOT_LEVEL_TAU: 1.4,
  // breach
  BREACH_MIN_SPEED: 3.75,   // [DERIVED Track E 0.75 × cruise]
  BREACH_MIN_VY: 3.2,       // apex physics, not speed-family
  BREACH_GRAVITY: 7.5,      // dreamy, slightly sub-earth
  BREACH_REENTRY_KEEP: 0.85,
  BREACH_COOLDOWN_S: 1.0,
  // cp05 terrain contact (region only — activates when the sampler
  // provides terrainHeight; the pool sampler does not, so pool behavior
  // and its committed replay digests are byte-identical)
  CONTACT_PROBE: 1.2,        // m probe along the surface normal [cp05 §6]
  CONTACT_EXIT_FACTOR: 1.15, // probe hysteresis on exit [DERIVED anti-flutter, flagged]
  CONTACT_KEEP: 0.85,        // tangential retention at contact entry [cp05 §6]
  CONTACT_ENTRY_MIN: 0.2,    // m/s into-surface speed that counts as an impact [DERIVED, flagged]
  CONTACT_PITCH_RATE: 0.5,   // rad/s pitch-away cap [cp05 §6]
  CONTACT_NORMAL_EPS: 1.0,   // m central-difference offset for the analytic normal [DERIVED, flagged]
  // cp05 anti-wedge (low-speed multi-contact escape)
  WEDGE_SPEED: 0.75,         // m/s actual-displacement threshold [cp05 §6]
  WEDGE_MIN_ANGLE_COS: 0.5,  // ≥ 2 contact normals > 60° apart [cp05 §6]
  WEDGE_TIME_S: 1.0,         // sustained longer than 1 s [cp05 §6]
  WEDGE_NUDGE: 0.5,          // m/s escape along the mean open direction [cp05 §6]
  WEDGE_PROBE_OFFSET: 1.2,   // m fore/aft/lateral probe offsets [DERIVED ≈ body half-length, flagged]
} as const;

export interface SimState {
  phase: Phase;
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number;
  surge: number;
  /** world velocity (chases facing — the slip vector) */
  wvx: number; wvy: number; wvz: number;
  /** airborne ballistic velocity (breach) */
  vx: number; vy: number; vz: number;
  kickCount: number;
  breachCount: number;
  /** set for one step when re-entry happens (splash hook) */
  splashed: boolean;
  breachCooldown: number;
  time: number;
}

export interface ContactInfo {
  nx: number;
  ny: number;
  nz: number;
  /** clearance along the normal, m (can be negative when penetrated) */
  d: number;
}

export class SwimSim {
  state: SimState;
  assist: AssistMode = 'full';
  private readonly band: number;
  /** cp05: analytic terrain height — null in the pool (no contact model) */
  private readonly th: ((x: number, z: number) => number) | null;

  // cp05 contact/anti-wedge state (deterministic; reset with the sim)
  private inContact = false;
  private wedgeT = 0;
  private lastDispSpeed = 0;

  constructor(readonly sampler: WorldSampler) {
    this.band = Math.min(SIM.SHORE_BAND, sampler.containmentBand ?? SIM.SHORE_BAND);
    this.th = sampler.terrainHeight ? sampler.terrainHeight.bind(sampler) : null;
    this.state = this.spawnState();
  }

  /** cp05 instrumentation: contact/wedge internals (not part of digests). */
  contactState(): { inContact: boolean; wedgeT: number; dispSpeed: number } {
    return { inContact: this.inContact, wedgeT: this.wedgeT, dispSpeed: this.lastDispSpeed };
  }

  /** Spawn: pool/region-neutral — centre, cruising depth, heading +X
   *  (Checkpoint 01 §6.1 [DERIVED]). */
  private spawnState(): SimState {
    return {
      phase: 'swim', x: 0, y: -2.5, z: 0,
      yaw: Math.PI / 2, pitch: 0, roll: 0, speed: 2, surge: 0,
      wvx: 2, wvy: 0, wvz: 0,
      vx: 0, vy: 0, vz: 0,
      kickCount: 0, breachCount: 0, splashed: false, breachCooldown: 0, time: 0,
    };
  }

  shoreDistance(x: number, z: number): number {
    return this.sampler.shoreDistance(x, z);
  }

  inWater(x: number, z: number): boolean {
    return this.sampler.inWater(x, z);
  }

  depthAt(x: number, z: number): number {
    return this.sampler.depthAt(x, z);
  }

  reset(): void {
    this.state = this.spawnState();
    this.inContact = false;
    this.wedgeT = 0;
    this.lastDispSpeed = 0;
  }

  /**
   * cp05 analytic contact probe: heightfield normal by central differences
   * (fixed 1 m offset — deterministic) and the clearance along that normal
   * (planar-slope approximation (y − h)·n_y). Contact within CONTACT_PROBE
   * (× the exit hysteresis while already touching).
   */
  private contactAt(x: number, y: number, z: number, threshold: number): ContactInfo | null {
    const th = this.th!;
    const e = SIM.CONTACT_NORMAL_EPS;
    const h = th(x, z);
    let nx = th(x - e, z) - th(x + e, z);
    let nz = th(x, z - e) - th(x, z + e);
    let ny = 2 * e;
    const len = Math.hypot(nx, ny, nz);
    nx /= len;
    ny /= len;
    nz /= len;
    const d = (y - h) * ny;
    return d < threshold ? { nx, ny, nz, d } : null;
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

    // step-start position (cp05: actual-displacement speed for anti-wedge)
    const px0 = s.x;
    const py0 = s.y;
    const pz0 = s.z;

    // --- attitude ---
    const levelK = intent.autopilot
      ? 1 / SIM.AUTOPILOT_LEVEL_TAU
      : SIM.AUTOLEVEL[this.assist];
    s.pitch += intent.pitch * SIM.PITCH_RATE * dt;
    if (Math.abs(intent.pitch) < 0.15 || intent.autopilot) s.pitch -= s.pitch * levelK * dt;
    s.pitch = clamp(s.pitch, -SIM.PITCH_MAX, SIM.PITCH_MAX);

    // bank: spring toward auto-bank + manual-roll target (Track E merge:
    // BANK_AUTO_MAX at any deflection, up to ROLL_MAX at full deflection),
    // slew-limited by ROLL_RATE. Autopilot levels to zero.
    const rIn = intent.autopilot ? 0 : clamp(intent.roll, -1, 1);
    const bankTarget =
      Math.sign(rIn) *
      (SIM.BANK_AUTO_MAX * Math.abs(rIn) + (SIM.ROLL_MAX - SIM.BANK_AUTO_MAX) * rIn * rIn);
    const bankK = 1 - Math.exp(-dt / SIM.BANK_TAU);
    let bankStep = (bankTarget - s.roll) * bankK;
    bankStep = clamp(bankStep, -SIM.ROLL_RATE * dt, SIM.ROLL_RATE * dt);
    s.roll = clamp(s.roll + bankStep, -SIM.ROLL_MAX, SIM.ROLL_MAX);

    // banking right (roll+) turns right; yaw authority is speed-shaped:
    // agile slow (140°/s full bank), wide fast (90°/s at cruise+)
    const authority =
      SIM.TURN_AUTHORITY_LOW +
      (SIM.TURN_AUTHORITY_CRUISE - SIM.TURN_AUTHORITY_LOW) * clamp(s.speed / SIM.MAX_SPEED, 0, 1);
    s.yaw += s.roll * authority * dt;

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
    if (intent.brake) {
      // exponential decel: cruise→~0 in 0.6 s; below MIN_CONTROL_SPEED
      // this is the hover state (full rotation authority remains)
      s.speed -= s.speed * Math.min(1, dt / SIM.BRAKE_TAU);
    } else if (this.assist === 'full' && !intent.autopilot && s.speed < SIM.DRIFT_SPEED) {
      s.speed += ((SIM.DRIFT_SPEED - s.speed) * dt) / SIM.DRIFT_TAU; // never strands
    }
    s.speed = clamp(s.speed, 0, intent.burst ? SIM.BURST_MAX_SPEED : SIM.MAX_SPEED);

    // --- velocity chases facing (Track E: body leads, velocity follows) ---
    const cp = Math.cos(s.pitch);
    const dx = Math.sin(s.yaw) * cp * s.speed;
    const dz = Math.cos(s.yaw) * cp * s.speed;
    const dy = -Math.sin(s.pitch) * s.speed - intent.depthTrim * SIM.TRIM_SPEED;
    const dmag = Math.hypot(dx, dy, dz);
    const tau = velFollowTau(s.speed);
    const k = 1 - Math.exp(-dt / tau);
    if (dmag < 1e-9) {
      s.wvx = 0; s.wvy = 0; s.wvz = 0;
    } else {
      const dux = dx / dmag, duy = dy / dmag, duz = dz / dmag;
      const vlen = Math.hypot(s.wvx, s.wvy, s.wvz);
      let cux = dux, cuy = duy, cuz = duz;
      if (vlen > 1e-9) {
        cux = s.wvx / vlen; cuy = s.wvy / vlen; cuz = s.wvz / vlen;
      }
      // normalized lerp of direction (≈ slerp at chase angles), magnitude
      // authoritative from the speed model
      let mx = cux + (dux - cux) * k;
      let my = cuy + (duy - cuy) * k;
      let mz = cuz + (duz - cuz) * k;
      const mlen = Math.hypot(mx, my, mz);
      if (mlen < 1e-6) { mx = dux; my = duy; mz = duz; }
      else { mx /= mlen; my /= mlen; mz /= mlen; }
      s.wvx = mx * dmag; s.wvy = my * dmag; s.wvz = mz * dmag;
    }

    // --- cp05 terrain contact (region only; analytic heightfield — the
    // camera's BVH never enters the sim, §6 determinism law). Slide, not
    // stop: the into-surface component of the chase velocity is removed
    // every contact step (the chase re-aims at facing, so pressing into a
    // wall becomes a glide along it); the one-time entry impact scrubs
    // tangential speed to 85 %; a capped pitch nudge eases the nose away
    // while yaw stays fully under player control (Track E §14).
    let wedgeEscape: { x: number; y: number; z: number } | null = null;
    if (this.th) {
      const threshold = this.inContact
        ? SIM.CONTACT_PROBE * SIM.CONTACT_EXIT_FACTOR
        : SIM.CONTACT_PROBE;
      const c = this.contactAt(s.x, s.y, s.z, threshold);
      if (c) {
        const vDotN = s.wvx * c.nx + s.wvy * c.ny + s.wvz * c.nz;
        if (vDotN < 0) {
          const preMag = Math.hypot(s.wvx, s.wvy, s.wvz);
          s.wvx -= c.nx * vDotN;
          s.wvy -= c.ny * vDotN;
          s.wvz -= c.nz * vDotN;
          if (!this.inContact && -vDotN > SIM.CONTACT_ENTRY_MIN) {
            // entry impact: keep 85 % of the tangential component
            s.wvx *= SIM.CONTACT_KEEP;
            s.wvy *= SIM.CONTACT_KEEP;
            s.wvz *= SIM.CONTACT_KEEP;
            let mag = Math.hypot(s.wvx, s.wvy, s.wvz);
            if (mag < 1e-6 && preMag > 1e-6) {
              // near-perpendicular impact: deterministic tangential seed
              // (up, then facing, projected onto the surface tangent) so a
              // head-on hit deflects into a slide instead of a dead stop
              const seeds: [number, number, number][] = [
                [0, 1, 0],
                [Math.sin(s.yaw), 0, Math.cos(s.yaw)],
                [1, 0, 0],
              ];
              for (const [sx, sy, sz] of seeds) {
                const dot = sx * c.nx + sy * c.ny + sz * c.nz;
                const tx = sx - c.nx * dot;
                const ty = sy - c.ny * dot;
                const tz = sz - c.nz * dot;
                const tl = Math.hypot(tx, ty, tz);
                if (tl > 1e-6) {
                  mag = preMag * SIM.CONTACT_KEEP;
                  s.wvx = (tx / tl) * mag;
                  s.wvy = (ty / tl) * mag;
                  s.wvz = (tz / tl) * mag;
                  break;
                }
              }
            }
            // the scalar speed model follows the impact (deceleration is
            // real, and the chase never re-injects the lost energy)
            s.speed = Math.min(s.speed, Math.max(mag, s.speed * SIM.CONTACT_KEEP));
          }
          // pitch-away nudge (≤ CONTACT_PITCH_RATE), only while the nose
          // points into the surface; yaw untouched
          const fCos = Math.cos(s.pitch);
          const fDotN =
            Math.sin(s.yaw) * fCos * c.nx - Math.sin(s.pitch) * c.ny + Math.cos(s.yaw) * fCos * c.nz;
          if (fDotN < 0) {
            const eps = 1e-3;
            const at = (p: number) =>
              Math.sin(s.yaw) * Math.cos(p) * c.nx - Math.sin(p) * c.ny + Math.cos(s.yaw) * Math.cos(p) * c.nz;
            const grad = at(s.pitch + eps) - at(s.pitch - eps);
            const dir = grad > 0 ? 1 : -1;
            s.pitch = clamp(
              s.pitch + dir * SIM.CONTACT_PITCH_RATE * dt,
              -SIM.PITCH_MAX,
              SIM.PITCH_MAX,
            );
          }
        }
        this.inContact = true;
      } else {
        this.inContact = false;
      }

      // --- anti-wedge (cp05 §6): probes fore/aft/lateral collect local
      // contact normals; two normals > 60° apart at low actual speed for
      // > 1 s → a 0.5 m/s escape nudge along the mean open direction,
      // held until the multi-contact clears (never traps the player).
      if (this.lastDispSpeed < SIM.WEDGE_SPEED || this.wedgeT > 0) {
        const sy = Math.sin(s.yaw);
        const cy = Math.cos(s.yaw);
        const o = SIM.WEDGE_PROBE_OFFSET;
        const probePts: [number, number][] = [
          [s.x, s.z],
          [s.x + sy * o, s.z + cy * o],
          [s.x - sy * o, s.z - cy * o],
          [s.x + cy * o, s.z - sy * o],
          [s.x - cy * o, s.z + sy * o],
        ];
        const normals: ContactInfo[] = [];
        for (const [px, pz] of probePts) {
          const pc = this.contactAt(px, s.y, pz, SIM.CONTACT_PROBE);
          if (pc) normals.push(pc);
        }
        let separated = false;
        for (let a = 0; a < normals.length && !separated; a++) {
          for (let b = a + 1; b < normals.length; b++) {
            const na = normals[a]!;
            const nb = normals[b]!;
            if (na.nx * nb.nx + na.ny * nb.ny + na.nz * nb.nz < SIM.WEDGE_MIN_ANGLE_COS) {
              separated = true;
              break;
            }
          }
        }
        if (separated && this.lastDispSpeed < SIM.WEDGE_SPEED) {
          this.wedgeT += dt;
        } else if (!separated) {
          this.wedgeT = 0;
        }
        if (this.wedgeT > SIM.WEDGE_TIME_S && normals.length > 0) {
          let mx2 = 0;
          let my2 = 0;
          let mz2 = 0;
          for (const nrm of normals) {
            mx2 += nrm.nx;
            my2 += nrm.ny;
            mz2 += nrm.nz;
          }
          const ml = Math.hypot(mx2, my2, mz2);
          if (ml > 1e-6) {
            wedgeEscape = {
              x: (mx2 / ml) * SIM.WEDGE_NUDGE,
              y: (my2 / ml) * SIM.WEDGE_NUDGE,
              z: (mz2 / ml) * SIM.WEDGE_NUDGE,
            };
          }
        }
      } else {
        this.wedgeT = 0;
      }
    }

    // step velocity (containment modifies the step's copy, as the dolphin
    // original did with its per-step velocity)
    let vx = s.wvx;
    let vy = s.wvy;
    let vz = s.wvz;
    if (wedgeEscape) {
      vx += wedgeEscape.x;
      vy += wedgeEscape.y;
      vz += wedgeEscape.z;
    }

    // --- containment current: the water pushes back near the shore ---
    const sd = this.shoreDistance(s.x, s.z);
    if (sd < this.band) {
      const t = clamp(1 - sd / this.band, 0, 1);
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
        // gentle heading bias away from the shore
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

    // --- absolute guarantee: never leave the water (soft slide) ---
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
    this.lastDispSpeed = Math.hypot(s.x - px0, s.y - py0, s.z - pz0) / dt;
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
      // re-seed the chase velocity along the travel direction (no lag pop)
      const h = Math.hypot(s.vx, s.vz) || 1e-6;
      s.wvx = (s.vx / h) * s.speed;
      s.wvy = 0;
      s.wvz = (s.vz / h) * s.speed;
      // keep containment honest even on re-entry
      if (!this.inWater(s.x, s.z)) {
        // re-enter where we left the water: walk back along the arc
        s.x -= s.vx * 0.2;
        s.z -= s.vz * 0.2;
      }
    }
  }
}

/** VEL_FOLLOW_TAU(v): floor 0.25 s < 2 m/s, 0.35 s at cruise, 0.55 s at
 *  burst — shaping [DERIVED] within Track E's 0.2–0.7 range. */
function velFollowTau(speed: number): number {
  if (speed <= 2) return SIM.VEL_FOLLOW_TAU_FLOOR;
  if (speed <= SIM.MAX_SPEED) {
    const t = (speed - 2) / (SIM.MAX_SPEED - 2);
    return SIM.VEL_FOLLOW_TAU_FLOOR + (SIM.VEL_FOLLOW_TAU_CRUISE - SIM.VEL_FOLLOW_TAU_FLOOR) * t;
  }
  const t = clamp(
    (speed - SIM.MAX_SPEED) / (SIM.BURST_MAX_SPEED - SIM.MAX_SPEED), 0, 1,
  );
  return SIM.VEL_FOLLOW_TAU_CRUISE + (SIM.VEL_FOLLOW_TAU_BURST - SIM.VEL_FOLLOW_TAU_CRUISE) * t;
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
