// Body / keyboard / gamepad → swim intents.
//
// CP10 follow-up: the default keyboard profile is Ecco-inspired (Space = hold-to-swim,
// Shift = charge, WASD = steer in 3D). The previous BodyArcade mapping remains as the
// Legacy profile. Gamepad API is a first-class source. PosePuppet body input is
// unchanged (kick rhythm, lean, crouch, hands-forward burst) and never overrides a
// live keyboard or gamepad. Keyboard always wins while touched.

import {
  assertSignalShape, createBroadcastSource, type BodySignal,
} from '@bodyarcade/body-input';
import { NEUTRAL_INTENT, type SwimIntent } from '../dolphin/sim';
import {
  DEFAULT_PREFS, loadPrefs, savePrefs, type DolphinControlPrefs, type InputSourcePref,
} from './controlPrefs';

const ENVELOPE = 'bodyarcade.body-input.v1';
const SIGNAL_STALE_MS = 350;
const MIN_CONFIDENCE = 0.35;
const KEYBOARD_PRIORITY_MS = 1500;
const GAMEPAD_PRIORITY_MS = 400;
const LOSS_DECAY_TAU_S = 0.25;
const REACQUIRE_SLEW_PER_S = 2.0;
const BOOST_ENGAGE = 0.75;
const BOOST_RELEASE = 0.55;
const BOOST_HOLD_FRAMES = 6;
const BOOST_REFRACTORY_MS = 3000;
const BURST_DURATION_MS = 1600;
const CROUCH_ON = 0.35;
const TALL_ON = 0.4;
const KB_KICK_HZ = 1.6;
const SWIM_HOLD_KICK_HZ = 1.8;
const PAD_DEAD = 0.18;

export type TrackingStateHud =
  | 'live' | 'stale' | 'low-confidence' | 'autopilot' | 'keyboard' | 'gamepad' | 'none';

export interface CameraInput {
  lookYaw: number;
  lookPitch: number;
  recenter: boolean;
  cycleStyle: boolean;
}

export interface SwimControls {
  /** Poll once per render frame; dtMs since last poll. */
  intent(dtMs: number): SwimIntent;
  cameraInput(dtS: number): CameraInput;
  setEnabled(on: boolean): void;
  hudState(): {
    tracking: TrackingStateHud; kickRate: number; seated: boolean; recentered: boolean;
    hipsQuiet: boolean; profile: DolphinControlPrefs['profile']; padConnected: boolean;
    source: InputSourcePref | 'keyboard' | 'gamepad' | 'body';
  };
  prefs(): DolphinControlPrefs;
  setPrefs(p: Partial<DolphinControlPrefs>): DolphinControlPrefs;
  debug(): {
    lastTs: number; ageMs: number; gotBroadcast: boolean; gotMessage: boolean;
    axes: { leanX: number; leanY: number; crouch: number } | null;
    padId: string | null;
  };
  dispose(): void;
}

export interface SwimControlHooks {
  onMenu?: () => void;
  onCycleCamera?: () => void;
  onRecenter?: () => void;
  onStyleToast?: (style: string) => void;
}

export function createSwimControls(win: Window = window, hooks: SwimControlHooks = {}): SwimControls {
  let latest: BodySignal | null = null;
  let latestAt = 0;
  let lastTsSeen = -1;
  let lastKickCount: number | null = null;
  let pendingKicks = 0;
  let recenteredFlag = false;
  let prefs: DolphinControlPrefs = loadPrefs();

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
      /* not a BodySignal */
    }
  };
  win.addEventListener('message', onMsg);

  function onSignal(s: BodySignal): void {
    if (s.ts === lastTsSeen) return;
    lastTsSeen = s.ts;
    latest = s;
    latestAt = performance.now();
    if (s.swim) {
      if (lastKickCount !== null && s.swim.count > lastKickCount) {
        pendingKicks += s.swim.count - lastKickCount;
      }
      lastKickCount = s.swim.count;
    }
    if (s.events.includes('recenter')) recenteredFlag = true;
  }

  const keys = new Set<string>();
  let lastKeyAt = -Infinity;
  let kbKickAccum = 0;
  let padKickAccum = 0;
  let swimTapKick = 0;
  let padTapKick = 0;
  let enabled = true;
  let lookYawAcc = 0;
  let lookPitchAcc = 0;
  let recenterQueued = false;
  let cycleQueued = false;
  let menuQueued = false;
  let padConnected = false;
  let padId: string | null = null;
  let lastPadAt = -Infinity;
  let prevPadButtons: boolean[] = [];
  let heldSwim = false;

  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);
  };
  const codeKey = (e: KeyboardEvent): string => {
    if (e.code === 'Space') return ' ';
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return 'shift';
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') return 'control';
    if (e.code === 'KeyW') return 'w';
    if (e.code === 'KeyA') return 'a';
    if (e.code === 'KeyS') return 's';
    if (e.code === 'KeyD') return 'd';
    if (e.code === 'KeyQ') return 'q';
    if (e.code === 'KeyE') return 'e';
    if (e.code === 'KeyX') return 'x';
    if (e.code === 'KeyZ') return 'z';
    if (e.code === 'KeyC') return 'c';
    if (e.code === 'KeyR') return 'r';
    if (e.code === 'KeyV') return 'v';
    return e.key.toLowerCase();
  };

  const down = (e: KeyboardEvent) => {
    if (!enabled || typing(e)) return;
    const k = codeKey(e);
    const watched = ['w', 'a', 's', 'd', 'q', 'e', 'x', 'z', 'c', 'r', 'v', 'shift', 'control', ' '];
    if (!watched.includes(k)) return;
    const first = !keys.has(k);
    keys.add(k);
    lastKeyAt = performance.now();
    if (first && prefs.profile === 'legacy' && k === 'shift') kbKickAccum += 1;
    if (first && prefs.profile === 'ecco' && k === ' ') swimTapKick += 1;
    if (first && k === 'r') {
      recenterQueued = true;
      hooks.onRecenter?.();
    }
    if (first && k === 'v') {
      cycleQueued = true;
      hooks.onCycleCamera?.();
    }
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(codeKey(e));
  win.addEventListener('keydown', down);
  win.addEventListener('keyup', up);

  const onMouse = (e: MouseEvent) => {
    if (!enabled || (e.buttons & 1) === 0) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.closest('.tw-ui') || t.closest('.tw-help') || t.closest('.tw-start'))) return;
    const sens = 0.0022 * prefs.lookSensitivity;
    lookYawAcc -= e.movementX * sens;
    lookPitchAcc -= e.movementY * sens;
    lastKeyAt = performance.now();
  };
  win.addEventListener('mousemove', onMouse);

  // --- burst machine (body-input hysteresis + hold + refractory) ---
  let boostFrames = 0;
  let burstUntil = 0;
  let burstReadyAt = 0;
  const held = { pitch: 0, roll: 0, depthTrim: 0 };
  let wasLost = false;
  let hudTracking: TrackingStateHud = 'none';
  let activeSource: 'keyboard' | 'gamepad' | 'body' = 'keyboard';

  function bodyIntent(dtMs: number, now: number): SwimIntent {
    const dt = dtMs / 1000;
    const s = latest;
    const stale = !s || now - latestAt > SIGNAL_STALE_MS;
    const lowConf = !!s && s.confidence < MIN_CONFIDENCE;
    const lost = stale || lowConf;

    if (lost) {
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

    if (sig.axes.handsForward > BOOST_ENGAGE) boostFrames += 1;
    else if (sig.axes.handsForward < BOOST_RELEASE) boostFrames = 0;
    if (boostFrames >= BOOST_HOLD_FRAMES && now >= burstReadyAt) {
      burstUntil = now + BURST_DURATION_MS;
      burstReadyAt = now + BOOST_REFRACTORY_MS;
      boostFrames = 0;
    }

    const kicks = pendingKicks;
    pendingKicks = 0;
    const kickRate = sig.swim?.rate ?? 0;
    return {
      pitch: held.pitch,
      roll: held.roll,
      kicks,
      kickAmp: sig.swim?.amp ?? 0.5,
      kickRate,
      burst: now < burstUntil,
      brake: false,
      swim: kickRate > 0.4 ? clamp(kickRate / 2.4, 0, 1) : 0,
      depthTrim: held.depthTrim,
      autopilot: false,
    };
  }

  function keyboardIntent(dtMs: number): SwimIntent {
    const dt = dtMs / 1000;
    const steer = prefs.steerSensitivity;
    const invert = prefs.invertY ? -1 : 1;
    const pitch = ((keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0)) * invert * steer;
    const roll = ((keys.has('d') ? 1 : 0) + (keys.has('a') ? -1 : 0)) * steer
      + ((keys.has('c') ? 1 : 0) + (keys.has('z') ? -1 : 0)) * 0.55;
    const trim = (keys.has('e') ? 1 : 0) + (keys.has('q') ? -1 : 0);

    if (prefs.profile === 'legacy') {
      if (keys.has('shift')) kbKickAccum += KB_KICK_HZ * dt;
      const kicks = Math.floor(kbKickAccum);
      kbKickAccum -= kicks;
      return {
        pitch, roll,
        kicks,
        kickAmp: 0.8,
        kickRate: keys.has('shift') ? KB_KICK_HZ : 0,
        burst: keys.has(' '),
        brake: keys.has('x') || keys.has('control'),
        swim: 0,
        depthTrim: trim,
        autopilot: false,
      };
    }

    const swimming = keys.has(' ');
    if (swimming) kbKickAccum += SWIM_HOLD_KICK_HZ * dt;
    const cadence = Math.floor(kbKickAccum);
    kbKickAccum -= cadence;
    const taps = swimTapKick;
    swimTapKick = 0;
    heldSwim = swimming;
    return {
      pitch, roll,
      kicks: taps + cadence,
      kickAmp: 0.8,
      kickRate: swimming ? SWIM_HOLD_KICK_HZ : 0,
      burst: keys.has('shift'),
      brake: keys.has('x') || keys.has('control'),
      swim: swimming ? 1 : 0,
      depthTrim: trim,
      autopilot: false,
    };
  }

  function padAxis(v: number): number {
    if (!Number.isFinite(v) || Math.abs(v) < PAD_DEAD) return 0;
    const mag = (Math.abs(v) - PAD_DEAD) / (1 - PAD_DEAD);
    return Math.sign(v) * mag * mag;
  }

  function gamepadIntent(dtMs: number, now: number): SwimIntent | null {
    const nav = win.navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    const pads = nav.getGamepads ? nav.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected && p.mapping === 'standard') { pad = p; break; }
    }
    if (!pad) {
      for (const p of pads) { if (p && p.connected) { pad = p; break; } }
    }
    if (!pad) {
      if (padConnected) {
        padConnected = false;
        padId = null;
        heldSwim = false;
        prevPadButtons = [];
      }
      return null;
    }
    padConnected = true;
    padId = pad.id;
    const b = (i: number) => !!pad!.buttons[i]?.pressed;
    const bv = (i: number) => pad!.buttons[i]?.value ?? (b(i) ? 1 : 0);
    const lx = padAxis(pad.axes[0] ?? 0);
    const ly = padAxis(pad.axes[1] ?? 0);
    const rx = padAxis(pad.axes[2] ?? 0);
    const ry = padAxis(pad.axes[3] ?? 0);
    const active =
      Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.02 ||
      pad.buttons.some((btn) => btn.pressed);
    if (active) lastPadAt = now;

    const rising = (i: number) => b(i) && !prevPadButtons[i];
    const nextBtns = pad.buttons.map((btn) => btn.pressed);
    const startRise = rising(9);
    const yRise = rising(3);
    const dpadRise = [12, 13, 14, 15].some((i) => rising(i));
    prevPadButtons = nextBtns;
    if (startRise) {
      menuQueued = true;
      hooks.onMenu?.();
    }
    if (yRise || dpadRise) {
      cycleQueued = true;
      hooks.onCycleCamera?.();
    }

    const steer = prefs.steerSensitivity;
    const invert = prefs.invertY ? -1 : 1;
    const look = 1.6 * prefs.lookSensitivity * dtMs / 1000;
    lookYawAcc -= rx * look;
    lookPitchAcc -= ry * look;

    if (prefs.profile === 'legacy') {
      if (b(0)) padKickAccum += KB_KICK_HZ * (dtMs / 1000);
      const kicks = Math.floor(padKickAccum);
      padKickAccum -= kicks;
      return {
        pitch: ly * invert * steer,
        roll: lx * steer,
        kicks,
        kickAmp: 0.8,
        kickRate: b(0) ? KB_KICK_HZ : 0,
        burst: b(1),
        brake: b(2),
        swim: 0,
        depthTrim: (b(5) ? 1 : 0) + (b(4) ? -1 : 0),
        autopilot: false,
      };
    }

    const swimVal = Math.max(bv(0), bv(7));
    const swimming = swimVal > 0.12;
    if (rising(0) || rising(7)) padTapKick += 1;
    if (swimming) padKickAccum += SWIM_HOLD_KICK_HZ * (dtMs / 1000);
    const cadence = Math.floor(padKickAccum);
    padKickAccum -= cadence;
    const taps = padTapKick;
    padTapKick = 0;
    heldSwim = swimming;
    return {
      pitch: ly * invert * steer,
      roll: lx * steer + ((b(5) ? 1 : 0) + (b(4) ? -1 : 0)) * 0.7,
      kicks: taps + cadence,
      kickAmp: 0.8,
      kickRate: swimming ? SWIM_HOLD_KICK_HZ : 0,
      burst: b(1),
      brake: b(2) || b(6),
      swim: swimming ? clamp(swimVal, 0.35, 1) : 0,
      depthTrim: 0,
      autopilot: false,
    };
  }

  function pickSource(now: number): 'keyboard' | 'gamepad' | 'body' {
    const pref = prefs.inputSource;
    const kbLive = now - lastKeyAt < KEYBOARD_PRIORITY_MS;
    const padLive = padConnected && now - lastPadAt < GAMEPAD_PRIORITY_MS;
    if (kbLive && pref !== 'body') return 'keyboard';
    if (pref === 'keyboard') return 'keyboard';
    if (pref === 'gamepad') return padLive || padConnected ? 'gamepad' : 'keyboard';
    if (pref === 'body') return kbLive ? 'keyboard' : padLive ? 'gamepad' : 'body';
    if (padLive) return 'gamepad';
    return 'body';
  }

  return {
    setEnabled(on: boolean): void {
      if (on === enabled) return;
      enabled = on;
      keys.clear();
      kbKickAccum = 0;
      padKickAccum = 0;
      swimTapKick = 0;
      padTapKick = 0;
      heldSwim = false;
      lookYawAcc = 0;
      lookPitchAcc = 0;
      if (!on) {
        lastKeyAt = -Infinity;
        lastPadAt = -Infinity;
      }
    },
    intent(dtMs: number): SwimIntent {
      const now = performance.now();
      const padIntent = enabled ? gamepadIntent(dtMs, now) : null;
      if (menuQueued) menuQueued = false;
      const src = pickSource(now);
      activeSource = src;
      if (src === 'keyboard') {
        hudTracking = 'keyboard';
        pendingKicks = 0;
        return keyboardIntent(dtMs);
      }
      if (src === 'gamepad' && padIntent) {
        hudTracking = 'gamepad';
        pendingKicks = 0;
        return padIntent;
      }
      return bodyIntent(dtMs, now);
    },
    cameraInput(dtS: number): CameraInput {
      void dtS;
      const out: CameraInput = {
        lookYaw: lookYawAcc,
        lookPitch: lookPitchAcc,
        recenter: recenterQueued || recenteredFlag,
        cycleStyle: cycleQueued,
      };
      lookYawAcc = 0;
      lookPitchAcc = 0;
      recenterQueued = false;
      cycleQueued = false;
      recenteredFlag = false;
      return out;
    },
    hudState() {
      const r = {
        tracking: hudTracking,
        kickRate: latest?.swim?.rate ?? (heldSwim ? SWIM_HOLD_KICK_HZ : 0),
        seated: latest?.seated ?? false,
        recentered: false,
        hipsQuiet: !!latest && latest.swim === undefined,
        profile: prefs.profile,
        padConnected,
        source: activeSource,
      };
      return r;
    },
    prefs: () => ({ ...prefs }),
    setPrefs(p: Partial<DolphinControlPrefs>) {
      prefs = { ...prefs, ...p };
      savePrefs(prefs);
      return { ...prefs };
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
        padId,
      };
    },
    dispose() {
      unsub();
      source.close();
      win.removeEventListener('message', onMsg);
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('mousemove', onMouse);
    },
  };
}

const clampAxis = (v: number): number => clamp(v, -1, 1);
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
