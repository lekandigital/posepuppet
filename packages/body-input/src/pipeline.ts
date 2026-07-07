// The core: one BodySignal out per BodyInputFrame in. Pure state machine
// over the input stream — every timer runs on frame timestamps, so a
// recorded stream replays byte-identically. Landmarks stop here.

import { AXIS_NAMES, defaultConfig, mergeConfig } from './defaults';
import { HoldToFire, ImpulseDetector } from './events';
import {
  Extractor, Measure, NeutralState, StatureRef, captureNeutral, computeRawAxes,
} from './extract';
import { quantize } from './schema';
import { SeatedDetector, seatedCondition } from './seated';
import { AxisShaper } from './stages';
import type {
  AxisName, BodyEvent, BodyInputConfig, BodyInputFrame, BodySignal, DeepPartial,
} from './types';
import { v3 } from './vec';

export interface AxisDebug {
  raw: number | null;
  shaped: number;
}

export interface BodyInputCore {
  /** Process one frame; returns the emitted signal (a fresh plain object). */
  push(frame: BodyInputFrame): BodySignal;
  /** Capture the current pose as neutral (explicit recenter). Returns false
   *  when the frame in hand can't support a capture (no valid torso). */
  recenter(): boolean;
  reset(): void;
  setConfig(over: DeepPartial<BodyInputConfig>): void;
  getConfig(): BodyInputConfig;
  /** Tuner hook: last raw + shaped value per axis. */
  getDebug(): Record<AxisName, AxisDebug>;
  /** null until a provisional or explicit neutral exists */
  getNeutral(): NeutralState | null;
  /** scalar extraction internals (no landmarks) — eval/tuner diagnostics */
  getMeasure(): {
    ok: boolean;
    thighsHorizontal: boolean | null;
    anklesForwardRatio: number | null;
    legFoldRatio: number | null;
    kneesVisible: boolean;
    anklesVisible: boolean;
    hipsVisible: boolean;
    statureWorld: number | null;
    armLenMeasured: number | null;
    shoulderWidth: number;
  } | null;
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

export function createBodyInputCore(over?: DeepPartial<BodyInputConfig>): BodyInputCore {
  let cfg = mergeConfig(defaultConfig(), over);

  const extractor = new Extractor();
  const seatedDet = new SeatedDetector();
  const shapers = {} as Record<AxisName, AxisShaper>;
  for (const name of AXIS_NAMES) {
    const lo = name === 'leanX' || name === 'leanY' ? -1 : 0;
    shapers[name] = new AxisShaper(cfg.axes[name], lo, 1);
  }
  const recenterMachine = new HoldToFire(cfg.events.recenter.holdMs, cfg.events.recenter.refractoryMs);
  const actionMachine = new ImpulseDetector(cfg.events.action);

  let neutral: NeutralState | null = null;
  let seatedRef: StatureRef | null = null;
  let neutralConfidence = 0;
  let confidence = 0;
  let speedEma: number | null = null;
  let stillness = 0;
  let lastTs: number | null = null;
  let lastMeasure: Measure | null = null;
  let provisionalSince: number | null = null;
  let confidentMs = 0; // cumulative, for the never-still fallback capture
  let neutralByFallback = false; // fallback capture upgrades on first stillness

  const raw: Record<AxisName, number | null> = {
    leanX: null, leanY: null, crouch: null, tallness: null,
    armsOut: null, armsRaised: null, handsForward: null, handPoint: null,
  };
  const scratch = v3();

  function captureFrom(m: Measure, kind: NeutralState['kind']): boolean {
    const n = captureNeutral(m, neutral, kind);
    if (!n) return false;
    neutral = n;
    // recentering re-references the stature axes for the current posture too
    seatedRef = { statureWorld: m.statureWorld, shoulderNormY: m.shoulderNormY };
    neutralConfidence = kind === 'explicit' ? 1 : 0.5;
    return true;
  }

  function dtSeconds(tsMs: number): number {
    const dt = lastTs === null ? 1 / 30 : Math.min(Math.max((tsMs - lastTs) / 1000, 1e-4), 0.25);
    return dt;
  }

  return {
    push(frame: BodyInputFrame): BodySignal {
      const dt = dtSeconds(frame.tsMs);
      const m = extractor.measure(frame, cfg.extraction);
      lastMeasure = m;

      // confidence: EMA toward the visibility target; exponential decay on
      // dropout frames (τ documented — the failure-mode test asserts it)
      if (m.present) {
        const a = 1 - Math.exp((-dt * 1000) / cfg.confidenceTauMs);
        confidence += (m.confidenceTarget - confidence) * a;
      } else {
        confidence *= Math.exp((-dt * 1000) / cfg.confidenceDecayTauMs);
      }
      confidence = clamp01(confidence);

      // seated (uses the standing neutral for its fallback condition)
      const sc = seatedCondition(m, neutral);
      const seatedStep = seatedDet.step(sc, frame.tsMs, cfg.extraction);
      if (seatedStep.flipped) {
        // stature axes re-reference to the new posture; the neutral itself
        // is no longer fully trusted until the user recenters
        seatedRef = m.ok ? { statureWorld: m.statureWorld, shoulderNormY: m.shoulderNormY } : null;
        neutralConfidence = Math.min(neutralConfidence, 0.3);
      }

      // provisional neutral: first confident, still dwell auto-captures.
      // If the stream starts mid-motion (walking into frame, sitting down),
      // a best-effort fallback captures once settled (4 s confident +
      // sub-walking speed; unconditionally at 8 s), and the FIRST completed
      // stillness dwell afterwards replaces it — a mid-motion capture must
      // not become a permanent reference (it pegged leanX on seated.mp4).
      if (m.ok && confidence > 0.6) {
        confidentMs += dt * 1000;
        const still = m.speed === null || m.speed < cfg.extraction.motionScale * 0.15;
        if (still && (!neutral || neutralByFallback)) {
          if (provisionalSince === null) provisionalSince = frame.tsMs;
          if (frame.tsMs - provisionalSince >= cfg.provisionalNeutralMs) {
            captureFrom(m, 'provisional');
            neutralByFallback = false;
            provisionalSince = null;
          }
        } else if (!still) {
          provisionalSince = null;
        }
        if (!neutral) {
          const settled = m.speed === null || m.speed < cfg.extraction.motionScale * 0.5;
          if ((confidentMs >= 4000 && settled) || confidentMs >= 8000) {
            if (captureFrom(m, 'provisional')) neutralByFallback = true;
          }
        }
      } else if (!neutral) {
        provisionalSince = null;
      }

      computeRawAxes(m, neutral, seatedStep.seated, seatedRef, cfg.extraction, raw, scratch);
      const shaped = {} as Record<AxisName, number>;
      for (const name of AXIS_NAMES) shaped[name] = shapers[name].step(raw[name], frame.tsMs);

      // stillness: EMA'd keypoint speed, inverted. Held (not zeroed) through
      // short dropouts so a flickering track doesn't read as motion.
      if (m.speed !== null) {
        const a = 1 - Math.exp(-dt / 0.6);
        speedEma = speedEma === null ? m.speed : speedEma + (m.speed - speedEma) * a;
        stillness = clamp01(1 - speedEma / cfg.extraction.motionScale);
      }

      // events (transition-triggered; inhibited at low confidence)
      const events: BodyEvent[] = [];
      const eventsOk = confidence >= cfg.events.minConfidence;
      const tpose =
        eventsOk &&
        shaped.armsOut > cfg.events.recenter.armsOutMin &&
        shaped.armsRaised < cfg.events.recenter.armsRaisedMax;
      if (recenterMachine.step(tpose, frame.tsMs)) {
        if (captureFrom(m, 'explicit')) {
          neutralByFallback = false;
          events.push('recenter');
        }
      }
      if (actionMachine.step(eventsOk ? shaped.handsForward : 0, frame.tsMs)) {
        events.push('action');
      }

      lastTs = frame.tsMs;
      return {
        v: 1,
        ts: frame.tsMs,
        confidence: quantize(confidence),
        seated: seatedStep.seated,
        stillness: quantize(stillness),
        neutralConfidence: quantize(neutralConfidence),
        axes: {
          leanX: quantize(shaped.leanX),
          leanY: quantize(shaped.leanY),
          crouch: quantize(shaped.crouch),
          tallness: quantize(shaped.tallness),
          armsOut: quantize(shaped.armsOut),
          armsRaised: quantize(shaped.armsRaised),
          handsForward: quantize(shaped.handsForward),
          handPoint: quantize(shaped.handPoint),
        },
        events,
        // per-limb continuity states pass straight through when the host
        // tracking layer provides them (additive, optional)
        ...(frame.tracking ? { tracking: frame.tracking } : {}),
      };
    },

    recenter(): boolean {
      if (!lastMeasure || !lastMeasure.ok) return false;
      return captureFrom(lastMeasure, 'explicit');
    },

    reset(): void {
      extractor.reset();
      seatedDet.reset();
      for (const name of AXIS_NAMES) shapers[name].reset();
      recenterMachine.reset();
      actionMachine.reset();
      neutral = null;
      seatedRef = null;
      neutralConfidence = 0;
      confidence = 0;
      speedEma = null;
      stillness = 0;
      lastTs = null;
      lastMeasure = null;
      provisionalSince = null;
      confidentMs = 0;
      neutralByFallback = false;
    },

    setConfig(overNew: DeepPartial<BodyInputConfig>): void {
      cfg = mergeConfig(cfg, overNew);
      for (const name of AXIS_NAMES) shapers[name].setConfig(cfg.axes[name]);
      recenterMachine.configure(cfg.events.recenter.holdMs, cfg.events.recenter.refractoryMs);
      actionMachine.configure(cfg.events.action);
    },

    getConfig(): BodyInputConfig {
      return cfg;
    },

    getDebug(): Record<AxisName, AxisDebug> {
      const out = {} as Record<AxisName, AxisDebug>;
      for (const name of AXIS_NAMES) out[name] = { raw: raw[name], shaped: shapers[name].value };
      return out;
    },

    getNeutral(): NeutralState | null {
      return neutral;
    },

    getMeasure() {
      const m = lastMeasure;
      if (!m) return null;
      return {
        ok: m.ok,
        thighsHorizontal: m.thighsHorizontal,
        anklesForwardRatio: m.anklesForwardRatio,
        legFoldRatio: m.legFoldRatio,
        kneesVisible: m.kneesVisible,
        anklesVisible: m.anklesVisible,
        hipsVisible: m.hipsVisible,
        statureWorld: m.statureWorld,
        armLenMeasured: m.armLenMeasured,
        shoulderWidth: m.shoulderWidth,
      };
    },
  };
}
