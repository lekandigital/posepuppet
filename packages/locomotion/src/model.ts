// LocomotionModel — pure state machine: WalkIntent in, WalkPose out.
// Every timer runs on the caller's frame timestamps, so a recorded intent
// stream replays byte-identically (the body-input determinism contract,
// carried through locomotion).
//
// COMFORT IS ENFORCED HERE, unconditionally, on the OUTPUT side: whatever
// the targets ask for, the integrator clamps speed, acceleration, yaw
// rate, and yaw acceleration to the ComfortConfig envelope, and the eye
// height moves only through a slew limiter (duck exists; bob does not —
// there is no oscillating term anywhere in this file). The model emits no
// FOV and no pitch/roll: the horizon cannot tilt through this package.

import { defaultLocomotionConfig, mergeLocomotionConfig } from './defaults';
import type {
  DeepPartial, LocomotionConfig, PathHint, WalkIntent, WalkMode, WalkPose,
} from './types';

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const clamp01 = (v: number): number => clamp(v, 0, 1);

function wrapDeg(a: number): number {
  let d = a % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Observed output maxima since reset — the comfort envelope evidence the
 *  tests and the eval artifact assert against. */
export interface WalkEnvelope {
  maxSpeed: number;
  maxAccel: number;
  maxYawRateDps: number;
  maxYawAccelDps2: number;
  maxEyeSlewPerS: number;
}

export interface Locomotion {
  /** Advance one frame. `path` is V4's nav-graph hook (optional). */
  step(tsMs: number, intent: WalkIntent, path?: PathHint | null): WalkPose;
  pose(): WalkPose;
  reset(): void;
  setConfig(over: DeepPartial<LocomotionConfig>): void;
  getConfig(): LocomotionConfig;
  envelope(): WalkEnvelope;
  /** Place the rig (spawn); resets motion state, keeps config. */
  teleport(x: number, z: number, yawDeg: number): void;
}

export function createLocomotion(over?: DeepPartial<LocomotionConfig>): Locomotion {
  let cfg = mergeLocomotionConfig(defaultLocomotionConfig(), over);

  let x = 0;
  let z = 0;
  let yawDeg = 0;
  let speed = 0;
  let yawRateDps = 0;
  let eyeY = cfg.comfort.eyeHeight;
  let vignette = 0;
  let mode: WalkMode = 'idle';
  let stepPulse = false;
  let recentered = false;

  let lastTs: number | null = null;
  let lastStepCount: number | null = null;
  /** body-control authority ramp after autopilot/keyboard (re-entry blend) */
  let reentrySince: number | null = null;
  let hadBodyControl = false;

  const env: WalkEnvelope = {
    maxSpeed: 0, maxAccel: 0, maxYawRateDps: 0, maxYawAccelDps2: 0, maxEyeSlewPerS: 0,
  };

  function snapshot(): WalkPose {
    return { x, z, yawDeg, speed, yawRateDps, eyeY, vignette, mode, stepPulse, recentered };
  }

  return {
    step(tsMs: number, intent: WalkIntent, path?: PathHint | null): WalkPose {
      const dt = lastTs === null ? 1 / 60 : clamp((tsMs - lastTs) / 1000, 1e-4, 0.25);
      lastTs = tsMs;
      const c = cfg.comfort;

      // --- control selection -------------------------------------------
      const kbActive = intent.kb.active;
      const bodyOk =
        intent.signalFresh && intent.confidence >= cfg.autopilot.minConfidence;

      let targetSpeed = 0;
      let targetYawDps = 0;
      let braking = false; // voluntary stop vs autopilot's gentler one
      let autop = false;

      if (kbActive) {
        mode = 'keyboard';
        const f = clamp(intent.kb.forward, -1, 1);
        targetSpeed = f >= 0 ? f * cfg.keyboard.speed : f * cfg.keyboard.backSpeed;
        targetYawDps = clamp(intent.kb.turn, -1, 1) * cfg.keyboard.turnDps;
        hadBodyControl = false;
        reentrySince = null;
      } else if (bodyOk) {
        // re-entry blend: after loss/keyboard, body authority ramps in —
        // the accel caps already bound the physics; the ramp keeps the
        // CONTROL from demanding a hard swerve the instant tracking lands.
        if (!hadBodyControl) reentrySince = tsMs;
        hadBodyControl = true;
        const authority = reentrySince === null
          ? 1
          : clamp((tsMs - reentrySince) / cfg.autopilot.reentryMs, 0.15, 1);
        if (authority >= 1) reentrySince = null;

        if (intent.seated) {
          // seated / accessibility fallback: lean-glide
          mode = 'glide';
          const ly = intent.leanY;
          targetSpeed =
            ly > cfg.glide.leanOn
              ? ((ly - cfg.glide.leanOn) / (1 - cfg.glide.leanOn)) * cfg.glide.maxSpeed
              : 0;
        } else {
          const cadence = intent.gaitActive ? intent.cadence : 0;
          const ampScale = clamp(intent.gaitAmp / cfg.ampRef, cfg.ampFloor, 1.15);
          targetSpeed = cfg.strideM * cadence * ampScale;
          mode = targetSpeed > 0.05 || speed > 0.05 ? 'walk' : 'idle';
        }
        if (intent.crouch > cfg.crouchOn) targetSpeed *= cfg.duckSpeedScale;
        targetYawDps = intent.leanX * cfg.leanTurnDps * authority;
        targetSpeed = speed + (targetSpeed - speed) * authority;
        braking = targetSpeed < speed;

        // soft path-shoulder steering (Full Assist default). Deliberate
        // lean SILENCES the assist — steering the user against their own
        // input was the rowing coxswain lesson.
        if (
          path && cfg.assist.mode !== 'off' &&
          Math.abs(intent.leanX) < cfg.leanYieldThreshold &&
          Math.abs(speed) > 0.15
        ) {
          const h = path(x, z);
          if (h) {
            const pathYaw = Math.atan2(h.dirX, -h.dirZ) / DEG;
            const angleErr = wrapDeg(pathYaw - yawDeg);
            const margin = Math.max(h.halfWidth - cfg.assist.shoulderM, 0);
            const excess = Math.sign(h.lateral) * Math.max(0, Math.abs(h.lateral) - margin);
            let assist =
              cfg.assist.alignGain * angleErr - cfg.assist.lateralGain * excess;
            assist = clamp(assist, -cfg.assist.maxDps, cfg.assist.maxDps);
            if (cfg.assist.mode === 'light') assist *= 0.5;
            assist *= clamp(Math.abs(speed) / 0.5, 0, 1); // no rotating in place
            targetYawDps += assist;
          }
        }
      } else {
        // tracking loss (or nothing yet): autopilot — a gentle stop on the
        // held heading. Never a snap, never a turn.
        autop = true;
        mode = Math.abs(speed) > 0.02 ? 'autopilot' : 'idle';
        targetSpeed = 0;
        targetYawDps = 0;
        hadBodyControl = false;
      }

      // --- comfort-clamped integration ----------------------------------
      // yaw: rate target capped, rate CHANGE capped, then integrate
      targetYawDps = clamp(targetYawDps, -c.maxYawRateDps, c.maxYawRateDps);
      const maxRateStep = c.maxYawAccelDps2 * dt;
      const dRate = clamp(targetYawDps - yawRateDps, -maxRateStep, maxRateStep);
      yawRateDps = clamp(yawRateDps + dRate, -c.maxYawRateDps, c.maxYawRateDps);
      yawDeg = wrapDeg(yawDeg + yawRateDps * dt);

      // speed: hard cap, then accel/decel/autopilot-decel limited approach
      targetSpeed = clamp(targetSpeed, -c.maxSpeed, c.maxSpeed);
      const towardZero =
        Math.abs(targetSpeed) < Math.abs(speed) && Math.sign(targetSpeed || speed) === Math.sign(speed);
      const rate = autop
        ? cfg.autopilot.decel
        : towardZero || braking
          ? c.maxDecel
          : c.maxAccel;
      const dv = clamp(targetSpeed - speed, -rate * dt, rate * dt);
      speed = clamp(speed + dv, -c.maxSpeed, c.maxSpeed);

      const yawRad = yawDeg * DEG;
      x += Math.sin(yawRad) * speed * dt;
      z += -Math.cos(yawRad) * speed * dt;

      // eye height: duck target, slew-limited — the only vertical motion
      // this model can produce, and it can never oscillate faster than the
      // slew (no bob by construction)
      const duck =
        bodyOk && intent.crouch > cfg.crouchOn
          ? (intent.crouch - cfg.crouchOn) / (1 - cfg.crouchOn)
          : 0;
      const eyeTarget = c.eyeHeight - c.duckDrop * clamp01(duck);
      const dEye = clamp(eyeTarget - eyeY, -c.eyeSlewPerS * dt, c.eyeSlewPerS * dt);
      eyeY += dEye;

      // comfort vignette: intensity from yaw rate + acceleration, slewed
      const v = c.vignette;
      if (v.enabled) {
        const yawFrac = clamp01(
          (Math.abs(yawRateDps) - v.yawRateOnDps) / Math.max(c.maxYawRateDps - v.yawRateOnDps, 1e-3),
        );
        const accFrac = clamp01(
          (Math.abs(dv) / dt - v.accelOn) / Math.max(c.maxAccel - v.accelOn, 1e-3),
        );
        const vTarget = v.max * Math.max(yawFrac, accFrac);
        vignette += clamp(vTarget - vignette, -v.slewPerS * dt, v.slewPerS * dt);
        vignette = clamp(vignette, 0, v.max);
      } else {
        vignette = 0;
      }

      // pulses
      stepPulse =
        bodyOk && lastStepCount !== null && intent.stepCount > lastStepCount;
      lastStepCount = intent.stepCount;
      recentered = intent.recenterEvent;

      // envelope evidence
      env.maxSpeed = Math.max(env.maxSpeed, Math.abs(speed));
      env.maxAccel = Math.max(env.maxAccel, Math.abs(dv) / dt);
      env.maxYawRateDps = Math.max(env.maxYawRateDps, Math.abs(yawRateDps));
      env.maxYawAccelDps2 = Math.max(env.maxYawAccelDps2, Math.abs(dRate) / dt);
      env.maxEyeSlewPerS = Math.max(env.maxEyeSlewPerS, Math.abs(dEye) / dt);

      return snapshot();
    },

    pose: snapshot,

    reset(): void {
      x = 0; z = 0; yawDeg = 0; speed = 0; yawRateDps = 0;
      eyeY = cfg.comfort.eyeHeight; vignette = 0; mode = 'idle';
      stepPulse = false; recentered = false;
      lastTs = null; lastStepCount = null; reentrySince = null; hadBodyControl = false;
      env.maxSpeed = 0; env.maxAccel = 0; env.maxYawRateDps = 0;
      env.maxYawAccelDps2 = 0; env.maxEyeSlewPerS = 0;
    },

    setConfig(overNew: DeepPartial<LocomotionConfig>): void {
      cfg = mergeLocomotionConfig(cfg, overNew);
    },

    getConfig(): LocomotionConfig {
      return cfg;
    },

    envelope(): WalkEnvelope {
      return { ...env };
    },

    teleport(nx: number, nz: number, nyawDeg: number): void {
      x = nx; z = nz; yawDeg = wrapDeg(nyawDeg);
      speed = 0; yawRateDps = 0; vignette = 0;
    },
  };
}
