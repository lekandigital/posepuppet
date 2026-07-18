// Body → swim intents. Ported byte-identical from apps/dolphin except the
// import specifiers and the single sanctioned addition: keyboard X = brake
// (Checkpoint 01 §6.1; the body-brake remap is a Master §12 user decision).
// Mirrors Flight's consumer discipline: BodySignal only (landmarks never
// reach this app), two transports (BroadcastChannel same-origin +
// postMessage envelope, deduped by ts), staleness/confidence gates,
// tracking-loss autopilot with slew-bounded re-entry, and keyboard ALWAYS
// wins while touched (WASD + Q/E depth + Shift kick + Space burst + X brake).
//
// Mapping (Gate-2 candidates; constants surfaced for the live tune):
//   swim.count increments  → kick impulses (the rhythm IS the game feel)
//   leanY  + (forward)     → pitch dive; − → surface
//   leanX                  → banked roll → turn
//   crouch / tallness      → depth trim descend / ascend (low-energy play)
//   handsForward           → burst (hysteresis + refractory, Flight's law)
//   recenter event         → package recaptures neutral; HUD toast

import {
  assertSignalShape, createBroadcastSource, type BodySignal,
} from '@bodyarcade/body-input';
import { NEUTRAL_INTENT, type SwimIntent } from '../game/sim';

const ENVELOPE = 'bodyarcade.body-input.v1';
const SIGNAL_STALE_MS = 350;
const MIN_CONFIDENCE = 0.35;
const KEYBOARD_PRIORITY_MS = 1500;
const LOSS_DECAY_TAU_S = 0.25;   // Gate-2 flight baseline
const REACQUIRE_SLEW_PER_S = 2.0;
const BOOST_ENGAGE = 0.75;
const BOOST_RELEASE = 0.55;
const BOOST_HOLD_FRAMES = 6;
const BOOST_REFRACTORY_MS = 3000;
const BURST_DURATION_MS = 1600;
const CROUCH_ON = 0.35;
const TALL_ON = 0.4;
const KB_KICK_HZ = 1.6; // holding Shift kicks at a steady rhythm

export type TrackingStateHud = 'live' | 'stale' | 'low-confidence' | 'autopilot' | 'keyboard' | 'none';

export interface SwimControls {
  /** Poll once per render frame; dtMs since last poll. */
  intent(dtMs: number): SwimIntent;
  hudState(): { tracking: TrackingStateHud; kickRate: number; seated: boolean; recentered: boolean; hipsQuiet: boolean };
  /** transport introspection for the topology spec */
  debug(): {
    lastTs: number; ageMs: number; gotBroadcast: boolean; gotMessage: boolean;
    axes: { leanX: number; leanY: number; crouch: number } | null;
  };
  dispose(): void;
}

export function createSwimControls(win: Window = window): SwimControls {
  let latest: BodySignal | null = null;
  let latestAt = 0; // receive clock
  let lastTsSeen = -1;
  let lastKickCount: number | null = null;
  let pendingKicks = 0;
  let recentered = false;

  let gotBroadcast = false;
  let gotMessage = false;
  const source = createBroadcastSource();
  const unsub = source.subscribe((s) => {
    gotBroadcast = true;
    onSignal(s);
  });
  const onMsg = (ev: MessageEvent) => {
    const d = ev.data as { t?: string; signal?: unknown };
    if (!d || d.t !== ENVELOPE || !d.signal) return;
    try {
      assertSignalShape(d.signal);
      gotMessage = true;
      onSignal(d.signal);
    } catch {
      /* shape-guarded: not a BodySignal — dropped */
    }
  };
  win.addEventListener('message', onMsg);

  function onSignal(s: BodySignal): void {
    if (s.ts === lastTsSeen) return; // second transport, same signal
    lastTsSeen = s.ts;
    latest = s;
    latestAt = performance.now();
    if (s.swim) {
      if (lastKickCount !== null && s.swim.count > lastKickCount) {
        pendingKicks += s.swim.count - lastKickCount;
      }
      lastKickCount = s.swim.count;
    }
    if (s.events.includes('recenter')) recentered = true;
  }

  // --- keyboard ---
  const keys = new Set<string>();
  let lastKeyAt = -Infinity;
  let kbKickAccum = 0;
  const down = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'x', 'shift', ' '].includes(k)) {
      if (k === 'shift' && !keys.has('shift')) kbKickAccum += 1; // tap = one kick
      keys.add(k);
      lastKeyAt = performance.now();
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  win.addEventListener('keydown', down);
  win.addEventListener('keyup', up);

  // --- burst machine (hysteresis + hold + refractory) ---
  let boostFrames = 0;
  let burstUntil = 0;
  let burstReadyAt = 0;

  // --- autopilot decay / re-entry slew state ---
  const held = { pitch: 0, roll: 0, depthTrim: 0 };
  let wasLost = false;
  let hudTracking: TrackingStateHud = 'none';

  function bodyIntent(dtMs: number, now: number): SwimIntent {
    const dt = dtMs / 1000;
    const s = latest;
    const stale = !s || now - latestAt > SIGNAL_STALE_MS;
    const lowConf = !!s && s.confidence < MIN_CONFIDENCE;
    const lost = stale || lowConf;

    if (lost) {
      // decay toward neutral — glide straight and level, never snap
      const k = Math.exp(-dt / LOSS_DECAY_TAU_S);
      held.pitch *= k;
      held.roll *= k;
      held.depthTrim *= k;
      wasLost = true;
      hudTracking = !s ? 'none' : stale ? 'stale' : 'low-confidence';
      if (s) hudTracking = 'autopilot';
      pendingKicks = 0;
      return { ...NEUTRAL_INTENT, pitch: held.pitch, roll: held.roll, depthTrim: held.depthTrim, autopilot: true };
    }

    hudTracking = 'live';
    const sig = s!;
    const targetPitch = clampAxis(sig.axes.leanY);
    const targetRoll = clampAxis(sig.axes.leanX);
    let targetTrim = 0;
    if (sig.axes.crouch > CROUCH_ON) targetTrim = (sig.axes.crouch - CROUCH_ON) / (1 - CROUCH_ON);
    else if (sig.axes.tallness > TALL_ON) targetTrim = -(sig.axes.tallness - TALL_ON) / (1 - TALL_ON);

    if (wasLost) {
      // slew-bounded re-entry (Gate-2 baseline: catch up, don't jump)
      const maxStep = REACQUIRE_SLEW_PER_S * dt;
      held.pitch += clamp(targetPitch - held.pitch, -maxStep, maxStep);
      held.roll += clamp(targetRoll - held.roll, -maxStep, maxStep);
      held.depthTrim += clamp(targetTrim - held.depthTrim, -maxStep, maxStep);
      if (
        Math.abs(held.pitch - targetPitch) < 0.02 &&
        Math.abs(held.roll - targetRoll) < 0.02 &&
        Math.abs(held.depthTrim - targetTrim) < 0.02
      ) {
        wasLost = false;
      }
    } else {
      held.pitch = targetPitch;
      held.roll = targetRoll;
      held.depthTrim = targetTrim;
    }

    // burst: hold-to-fire with hysteresis + refractory
    if (sig.axes.handsForward > BOOST_ENGAGE) boostFrames += 1;
    else if (sig.axes.handsForward < BOOST_RELEASE) boostFrames = 0;
    if (boostFrames >= BOOST_HOLD_FRAMES && now >= burstReadyAt) {
      burstUntil = now + BURST_DURATION_MS;
      burstReadyAt = now + BOOST_REFRACTORY_MS;
      boostFrames = 0;
    }

    const kicks = pendingKicks;
    pendingKicks = 0;
    return {
      pitch: held.pitch,
      roll: held.roll,
      kicks,
      kickAmp: sig.swim?.amp ?? 0.5,
      kickRate: sig.swim?.rate ?? 0,
      burst: now < burstUntil,
      brake: false, // body-brake remap is a Master §12 open user decision (R9)
      depthTrim: held.depthTrim,
      autopilot: false,
    };
  }

  function keyboardIntent(dtMs: number): SwimIntent {
    const dt = dtMs / 1000;
    if (keys.has('shift')) kbKickAccum += KB_KICK_HZ * dt;
    const kicks = Math.floor(kbKickAccum);
    kbKickAccum -= kicks;
    return {
      pitch: (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0),
      roll: (keys.has('d') ? 1 : 0) + (keys.has('a') ? -1 : 0),
      kicks,
      kickAmp: 0.8,
      kickRate: keys.has('shift') ? KB_KICK_HZ : 0,
      burst: keys.has(' '),
      brake: keys.has('x'),
      depthTrim: (keys.has('e') ? 1 : 0) + (keys.has('q') ? -1 : 0),
      autopilot: false,
    };
  }

  return {
    intent(dtMs: number): SwimIntent {
      const now = performance.now();
      if (now - lastKeyAt < KEYBOARD_PRIORITY_MS) {
        hudTracking = 'keyboard';
        pendingKicks = 0; // body kicks don't stack behind keyboard control
        return keyboardIntent(dtMs);
      }
      return bodyIntent(dtMs, now);
    },
    hudState() {
      const r = {
        tracking: hudTracking,
        kickRate: latest?.swim?.rate ?? 0,
        seated: latest?.seated ?? false,
        recentered,
        // hips invisible = no kick signal — the coach explains
        hipsQuiet: !!latest && latest.swim === undefined,
      };
      recentered = false;
      return r;
    },
    debug() {
      return {
        lastTs: lastTsSeen,
        ageMs: latest ? performance.now() - latestAt : Infinity,
        gotBroadcast,
        gotMessage,
        axes: latest
          ? { leanX: latest.axes.leanX, leanY: latest.axes.leanY, crouch: latest.axes.crouch }
          : null,
      };
    },
    dispose() {
      unsub();
      source.close();
      win.removeEventListener('message', onMsg);
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
    },
  };
}

const clampAxis = (v: number): number => clamp(v, -1, 1);
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
