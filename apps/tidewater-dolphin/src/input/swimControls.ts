// Keyboard / mouse / gamepad / PosePuppet body input → swim intents and camera look.
//
// CP10 controls pass. Two profiles (Dolphin Controls → Scheme):
//
//   Modern (default, Ecco-inspired)
//     keyboard  Space hold = swim, tap = one tail stroke · Shift = charge · W dive / S climb ·
//               A / D turn (the sim banks) · X brake · V camera style · R recenter ·
//               1 / 2 / 3 assist (dolphinPlayer) · drag the view (left or right button) to look
//     gamepad   left stick steer · RT (analog) or A swim · LB or B charge · LT or X brake ·
//               right stick look · Y or D-pad ◄ ► camera style · right-stick click recenter ·
//               Start menu · Back controls sheet
//   Legacy BodyArcade
//     keyboard  Shift kick (tap = one kick, hold = 1.6 Hz cadence) · Space burst · W / S pitch ·
//               A / D bank · Q / E depth trim · X brake
//     gamepad   A kick · B burst · X brake · bumpers depth trim · left stick steer
//
// PosePuppet body input is unchanged (kick rhythm, lean to pitch and bank, crouch / stretch
// for depth, hands forward to burst) and arrives over the same-origin BroadcastChannel /
// postMessage transport.
//
// Source arbitration (one owner per frame): between the keyboard and a gamepad the one touched
// last owns the dolphin while it is held and for a short hold-over afterwards; only CONTROL
// inputs count — the camera keys (R, V), the assist keys, mouse look and the menu keys never
// take the dolphin away from a pad. Body input drives the dolphin only when neither is live,
// and only once a body signal has actually been seen (or Input = Body). The dolphin works
// with a keyboard alone: no webcam, no pad.
//
// Safety: keys clear on window blur (no stuck swim after alt-tab); Ctrl / Meta / Alt chords
// are left to the browser (Ctrl is not a game key — Ctrl+W closes the tab); typing targets are
// ignored; a look-drag must start on the canvas, never on the settings panel.

import {
  assertSignalShape, createBroadcastSource, type BodySignal,
} from '@bodyarcade/body-input';
import { NEUTRAL_INTENT, type SwimIntent } from '../dolphin/sim';
import {
  loadPrefs, savePrefs, type ControlProfile, type DolphinControlPrefs, type InputSourcePref,
} from './controlPrefs';

const ENVELOPE = 'bodyarcade.body-input.v1';
const SIGNAL_STALE_MS = 350;
const MIN_CONFIDENCE = 0.35;
/** the keyboard keeps the dolphin this long after its last control key (against body input) */
const KEYBOARD_HOLDOVER_MS = 1500;
/** a pad keeps the dolphin this long after its last stick / button activity */
const GAMEPAD_HOLDOVER_MS = 600;
const LOSS_DECAY_TAU_S = 0.25;
const REACQUIRE_SLEW_PER_S = 2.0;
const BOOST_ENGAGE = 0.75;
const BOOST_RELEASE = 0.55;
const BOOST_HOLD_FRAMES = 6;
const BOOST_REFRACTORY_MS = 3000;
const BURST_DURATION_MS = 1600;
const CROUCH_ON = 0.35;
const TALL_ON = 0.4;
/** legacy cadence (Shift / A held) */
const KB_KICK_HZ = 1.6;
/** presentation cadence while Swim is held (drives the tail animation, never the physics) */
const HOLD_KICK_HZ_MIN = 1.1;
const HOLD_KICK_HZ_MAX = 1.8;
/** keyboard analog emulation: seconds to full deflection, and to release */
const KB_RAMP_PITCH_S = 0.22;
const KB_RAMP_ROLL_S = 0.18;
const KB_RELEASE_S = 0.08;
const PAD_DEAD = 0.16;
/** trigger travel below this is not a swim (resting finger) */
const PAD_SWIM_ON = 0.08;
const MOUSE_LOOK_RAD_PER_PX = 0.0022;
const PAD_LOOK_RAD_PER_S = 1.8;

/** keys that COUNT as control input (own the dolphin); utility keys never do */
export const MODERN_CONTROL_KEYS: readonly string[] = ['w', 'a', 's', 'd', ' ', 'shift', 'x'];
export const LEGACY_CONTROL_KEYS: readonly string[] = ['w', 'a', 's', 'd', ' ', 'shift', 'x', 'q', 'e'];
const UTILITY_KEYS: readonly string[] = ['r', 'v'];

/** standard-mapping gamepad buttons (W3C Gamepad API) */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
} as const;

export type InputSource = 'keyboard' | 'gamepad' | 'body';

export type TrackingStateHud =
  | 'live' | 'stale' | 'low-confidence' | 'autopilot' | 'keyboard' | 'gamepad' | 'none';

export interface CameraInput {
  lookYaw: number;
  lookPitch: number;
  recenter: boolean;
  cycleStyle: boolean;
}

export interface SwimControlsHud {
  tracking: TrackingStateHud;
  kickRate: number;
  seated: boolean;
  recentered: boolean;
  hipsQuiet: boolean;
  profile: ControlProfile;
  padConnected: boolean;
  padId: string | null;
  source: InputSource;
  /** 0..1 held swim level of the last intent (analog on a trigger) */
  swimLevel: number;
}

export interface SwimControls {
  /** Poll once per render frame; dtMs since last poll. */
  intent(dtMs: number): SwimIntent;
  cameraInput(dtS: number): CameraInput;
  setEnabled(on: boolean): void;
  hudState(): SwimControlsHud;
  prefs(): DolphinControlPrefs;
  setPrefs(p: Partial<DolphinControlPrefs>): DolphinControlPrefs;
  debug(): {
    lastTs: number; ageMs: number; gotBroadcast: boolean; gotMessage: boolean;
    axes: { leanX: number; leanY: number; crouch: number } | null;
    padId: string | null;
    source: InputSource;
    keysHeld: string[];
  };
  dispose(): void;
}

export interface SwimControlHooks {
  onMenu?: () => void;
  onHelp?: () => void;
  onCycleCamera?: () => void;
  onRecenter?: () => void;
}

/** the subset of `window` the controls touch (a test can hand in a fake) */
export type ControlsWindow = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
  navigator: { getGamepads?: () => (Gamepad | null)[] };
};

export function createSwimControls(win: ControlsWindow = window, hooks: SwimControlHooks = {}): SwimControls {
  let prefs: DolphinControlPrefs = loadPrefs();

  // ---------------------------------------------------------------- body transport
  let latest: BodySignal | null = null;
  let latestAt = 0;
  let lastTsSeen = -1;
  let lastKickCount: number | null = null;
  let pendingKicks = 0;
  let recenteredFlag = false;
  let gotBroadcast = false;
  let gotMessage = false;
  let bodySeen = false;
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
  win.addEventListener('message', onMsg as EventListener);

  function onSignal(s: BodySignal): void {
    if (s.ts === lastTsSeen) return;
    lastTsSeen = s.ts;
    latest = s;
    latestAt = performance.now();
    bodySeen = true;
    if (s.swim) {
      if (lastKickCount !== null && s.swim.count > lastKickCount) {
        pendingKicks += s.swim.count - lastKickCount;
      }
      lastKickCount = s.swim.count;
    }
    if (s.events.includes('recenter')) recenteredFlag = true;
  }

  // ---------------------------------------------------------------- keyboard
  /** watched keys currently down (control + utility) */
  const keys = new Set<string>();
  let lastKbControlAt = -Infinity;
  let kbKickAccum = 0; // legacy cadence
  let kbTapKicks = 0;  // modern Space taps / legacy Shift taps
  let kbPitchAxis = 0;
  let kbRollAxis = 0;
  let enabled = true;
  let lookYawAcc = 0;
  let lookPitchAcc = 0;
  let recenterQueued = false;
  let cycleQueued = false;
  let dragging = false;
  /** last pointer position during a drag (fallback for events without movementX, e.g. synthesized ones) */
  let dragX: number | null = null;
  let dragY: number | null = null;

  const controlKeys = (): readonly string[] => (prefs.profile === 'legacy' ? LEGACY_CONTROL_KEYS : MODERN_CONTROL_KEYS);
  const anyControlHeld = (): boolean => controlKeys().some((k) => keys.has(k));

  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);
  };
  const codeKey = (e: KeyboardEvent): string => {
    switch (e.code) {
      case 'Space': return ' ';
      case 'ShiftLeft': case 'ShiftRight': return 'shift';
      case 'KeyW': return 'w';
      case 'KeyA': return 'a';
      case 'KeyS': return 's';
      case 'KeyD': return 'd';
      case 'KeyQ': return 'q';
      case 'KeyE': return 'e';
      case 'KeyX': return 'x';
      case 'KeyR': return 'r';
      case 'KeyV': return 'v';
      default: return (e.key || '').toLowerCase();
    }
  };

  const down = (e: KeyboardEvent) => {
    if (!enabled || typing(e)) return;
    // browser chords (Ctrl+W, Cmd+R, Alt+…) are the browser's — never a game key
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = codeKey(e);
    const isControl = controlKeys().includes(k);
    if (!isControl && !UTILITY_KEYS.includes(k)) return;
    e.preventDefault();
    if (keys.has(k)) return; // OS auto-repeat
    keys.add(k);
    if (k === 'r') { recenterQueued = true; hooks.onRecenter?.(); return; }
    if (k === 'v') { cycleQueued = true; hooks.onCycleCamera?.(); return; }
    lastKbControlAt = performance.now();
    // the press itself is one tail stroke (modern: Space; legacy: Shift) — a tap lunges, a hold swims
    if (prefs.profile === 'legacy' ? k === 'shift' : k === ' ') kbTapKicks += 1;
  };
  const up = (e: KeyboardEvent) => { keys.delete(codeKey(e)); };
  const onBlur = () => {
    keys.clear();
    kbPitchAxis = 0;
    kbRollAxis = 0;
    dragging = false;
    dragX = dragY = null;
  };
  win.addEventListener('keydown', down as EventListener);
  win.addEventListener('keyup', up as EventListener);
  win.addEventListener('blur', onBlur);

  // ---------------------------------------------------------------- mouse look (drag on the view)
  const isCanvas = (t: EventTarget | null): boolean => !!t && (t as HTMLElement).tagName === 'CANVAS';
  const onMouseDown = (e: MouseEvent) => {
    if (!enabled || (e.button !== 0 && e.button !== 2)) return;
    dragging = isCanvas(e.target);
    dragX = typeof e.clientX === 'number' ? e.clientX : null;
    dragY = typeof e.clientY === 'number' ? e.clientY : null;
  };
  const onMouseUp = (e: MouseEvent) => {
    if ((e.buttons & 3) === 0) dragging = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if ((e.buttons & 3) === 0) { dragging = false; return; }
    if (!enabled || !dragging) return;
    // movementX/Y when the browser provides them; otherwise the delta of the pointer position
    let dx = typeof e.movementX === 'number' ? e.movementX : 0;
    let dy = typeof e.movementY === 'number' ? e.movementY : 0;
    if (dx === 0 && dy === 0 && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      if (dragX !== null && dragY !== null) { dx = e.clientX - dragX; dy = e.clientY - dragY; }
    }
    if (typeof e.clientX === 'number') dragX = e.clientX;
    if (typeof e.clientY === 'number') dragY = e.clientY;
    const sens = MOUSE_LOOK_RAD_PER_PX * prefs.lookSensitivity;
    lookYawAcc -= dx * sens;
    lookPitchAcc -= dy * sens;
  };
  win.addEventListener('mousedown', onMouseDown as EventListener);
  win.addEventListener('mouseup', onMouseUp as EventListener);
  win.addEventListener('mousemove', onMouseMove as EventListener);

  // ---------------------------------------------------------------- body intent (unchanged)
  let boostFrames = 0;
  let burstUntil = 0;
  let burstReadyAt = 0;
  const held = { pitch: 0, roll: 0, depthTrim: 0 };
  let wasLost = false;
  let hudTracking: TrackingStateHud = 'none';
  let activeSource: InputSource = 'keyboard';
  let lastSwimLevel = 0;
  let lastKickRate = 0;

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
      hudTracking = !s ? 'none' : 'autopilot';
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

  // ---------------------------------------------------------------- keyboard intent
  function keyboardIntent(dtMs: number): SwimIntent {
    const dt = dtMs / 1000;
    const legacy = prefs.profile === 'legacy';
    const pitchIn = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
    const rollIn = (keys.has('d') ? 1 : 0) + (keys.has('a') ? -1 : 0);
    if (legacy) {
      kbPitchAxis = pitchIn;
      kbRollAxis = rollIn;
    } else {
      // analog emulation: a tap is a nudge, a hold reaches full authority in ~0.2 s
      kbPitchAxis = ramp(kbPitchAxis, pitchIn, dt, KB_RAMP_PITCH_S);
      kbRollAxis = ramp(kbRollAxis, rollIn, dt, KB_RAMP_ROLL_S);
    }
    const steer = prefs.steerSensitivity;
    const invert = prefs.invertY ? -1 : 1;
    const pitch = clampAxis(kbPitchAxis * invert * steer);
    const roll = clampAxis(kbRollAxis * steer);
    const taps = kbTapKicks;
    kbTapKicks = 0;

    if (legacy) {
      if (keys.has('shift')) kbKickAccum += KB_KICK_HZ * dt;
      const cadence = Math.floor(kbKickAccum);
      kbKickAccum -= cadence;
      return {
        pitch, roll,
        kicks: taps + cadence,
        kickAmp: 0.8,
        kickRate: keys.has('shift') ? KB_KICK_HZ : 0,
        burst: keys.has(' '),
        brake: keys.has('x'),
        swim: 0,
        depthTrim: (keys.has('e') ? 1 : 0) + (keys.has('q') ? -1 : 0),
        autopilot: false,
      };
    }

    const swimming = keys.has(' ');
    return {
      pitch, roll,
      kicks: taps,
      kickAmp: 0.8,
      kickRate: swimming ? HOLD_KICK_HZ_MAX : 0,
      burst: keys.has('shift'),
      brake: keys.has('x'),
      swim: swimming ? 1 : 0,
      depthTrim: 0,
      autopilot: false,
    };
  }

  // ---------------------------------------------------------------- gamepad
  let padConnected = false;
  let padId: string | null = null;
  let lastPadAt = -Infinity;
  let padActiveNow = false;
  let prevPadButtons: boolean[] = [];
  let padKickAccum = 0;
  let padTapKicks = 0;

  function padAxis(v: number): number {
    if (!Number.isFinite(v) || Math.abs(v) < PAD_DEAD) return 0;
    const mag = (Math.abs(v) - PAD_DEAD) / (1 - PAD_DEAD);
    return Math.sign(v) * mag * mag; // squared response: precise near centre, full at the rim
  }

  function pollGamepad(dtMs: number, now: number): SwimIntent | null {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = win.navigator.getGamepads ? win.navigator.getGamepads() : [];
    } catch {
      pads = [];
    }
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') { pad = p; break; }
    if (!pad) for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      if (padConnected) {
        padConnected = false;
        padId = null;
        prevPadButtons = [];
        padKickAccum = 0;
        padTapKicks = 0;
      }
      padActiveNow = false;
      return null;
    }
    if (!padConnected) {
      padConnected = true;
      prevPadButtons = pad.buttons.map((btn) => btn.pressed); // a pad that arrives with a button held fires no edges
    }
    padId = pad.id;
    const b = (i: number): boolean => !!pad!.buttons[i]?.pressed;
    const bv = (i: number): number => {
      const btn = pad!.buttons[i];
      if (!btn) return 0;
      return typeof btn.value === 'number' ? btn.value : (btn.pressed ? 1 : 0);
    };
    const lx = padAxis(pad.axes[0] ?? 0);
    const ly = padAxis(pad.axes[1] ?? 0);
    const rx = padAxis(pad.axes[2] ?? 0);
    const ry = padAxis(pad.axes[3] ?? 0);
    const rising = (i: number): boolean => b(i) && !prevPadButtons[i];
    padActiveNow = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0 || pad.buttons.some((btn) => btn.pressed);
    if (padActiveNow) lastPadAt = now;

    // utility edges
    if (rising(PAD.START)) hooks.onMenu?.();
    if (rising(PAD.BACK)) hooks.onHelp?.();
    if (rising(PAD.Y) || rising(PAD.LEFT) || rising(PAD.RIGHT)) { cycleQueued = true; hooks.onCycleCamera?.(); }
    if (rising(PAD.RS)) { recenterQueued = true; hooks.onRecenter?.(); }

    const steer = prefs.steerSensitivity;
    const invert = prefs.invertY ? -1 : 1;
    const look = PAD_LOOK_RAD_PER_S * prefs.lookSensitivity * dtMs / 1000;
    lookYawAcc -= rx * look;
    lookPitchAcc -= ry * look;
    // stick forward (axes[1] < 0) noses DOWN, like W — the flight / Ecco convention; Invert flips both
    const pitch = clampAxis(-ly * invert * steer);
    const roll = clampAxis(lx * steer);

    let out: SwimIntent;
    if (prefs.profile === 'legacy') {
      if (rising(PAD.A)) padTapKicks += 1;
      if (b(PAD.A)) padKickAccum += KB_KICK_HZ * dtMs / 1000;
      const cadence = Math.floor(padKickAccum);
      padKickAccum -= cadence;
      out = {
        pitch, roll,
        kicks: padTapKicks + cadence,
        kickAmp: 0.8,
        kickRate: b(PAD.A) ? KB_KICK_HZ : 0,
        burst: b(PAD.B),
        brake: b(PAD.X),
        swim: 0,
        depthTrim: (b(PAD.RB) ? 1 : 0) + (b(PAD.LB) ? -1 : 0),
        autopilot: false,
      };
    } else {
      const swimVal = Math.max(bv(PAD.RT), bv(PAD.A));
      const swimming = swimVal > PAD_SWIM_ON;
      if (rising(PAD.A) || rising(PAD.RT)) padTapKicks += 1;
      const level = swimming ? clamp((swimVal - PAD_SWIM_ON) / (1 - PAD_SWIM_ON), 0, 1) : 0;
      out = {
        pitch, roll,
        kicks: padTapKicks,
        kickAmp: 0.8,
        kickRate: swimming ? HOLD_KICK_HZ_MIN + (HOLD_KICK_HZ_MAX - HOLD_KICK_HZ_MIN) * level : 0,
        burst: b(PAD.LB) || b(PAD.B),
        brake: b(PAD.LT) || b(PAD.X),
        swim: swimming ? Math.max(0.05, level) : 0,
        depthTrim: 0,
        autopilot: false,
      };
    }
    padTapKicks = 0;
    prevPadButtons = pad.buttons.map((btn) => btn.pressed);
    return out;
  }

  // ---------------------------------------------------------------- arbitration
  function pickSource(now: number): InputSource {
    const pref: InputSourcePref = prefs.inputSource;
    const kbHeld = anyControlHeld();
    const kbStamp = kbHeld ? now : lastKbControlAt;
    const kbLive = kbHeld || now - lastKbControlAt < KEYBOARD_HOLDOVER_MS;
    const padStamp = padActiveNow ? now : lastPadAt;
    const padLive = padConnected && (padActiveNow || now - lastPadAt < GAMEPAD_HOLDOVER_MS);
    if (pref === 'keyboard') return 'keyboard';
    if (pref === 'gamepad') return padConnected ? 'gamepad' : 'keyboard';
    if (pref === 'body') {
      if (kbHeld) return 'keyboard';
      if (padActiveNow) return 'gamepad';
      return 'body';
    }
    // auto: last touched wins between keyboard and pad; body only when neither is live
    if (kbLive && (!padLive || kbStamp >= padStamp)) return 'keyboard';
    if (padLive) return 'gamepad';
    if (bodySeen) return 'body';
    return padConnected && lastPadAt > lastKbControlAt ? 'gamepad' : 'keyboard';
  }

  function resetKeyboardIntentState(): void {
    kbPitchAxis = 0;
    kbRollAxis = 0;
    kbTapKicks = 0;
    kbKickAccum = 0;
  }

  return {
    setEnabled(on: boolean): void {
      if (on === enabled) return;
      enabled = on;
      keys.clear();
      resetKeyboardIntentState();
      padKickAccum = 0;
      padTapKicks = 0;
      dragging = false;
      lookYawAcc = 0;
      lookPitchAcc = 0;
      recenterQueued = false;
      cycleQueued = false;
      if (!on) {
        lastKbControlAt = -Infinity;
        lastPadAt = -Infinity;
        padActiveNow = false;
      }
    },
    intent(dtMs: number): SwimIntent {
      const now = performance.now();
      const padIntent = enabled ? pollGamepad(dtMs, now) : null;
      const src = enabled ? pickSource(now) : 'keyboard';
      activeSource = src;
      let out: SwimIntent;
      if (src === 'keyboard' || (src === 'gamepad' && !padIntent)) {
        hudTracking = src === 'gamepad' ? 'gamepad' : 'keyboard';
        pendingKicks = 0;
        out = keyboardIntent(dtMs);
      } else if (src === 'gamepad') {
        hudTracking = 'gamepad';
        pendingKicks = 0;
        resetKeyboardIntentState();
        out = padIntent!;
      } else {
        resetKeyboardIntentState();
        out = bodyIntent(dtMs, now);
      }
      lastSwimLevel = out.swim ?? 0;
      lastKickRate = out.kickRate;
      return out;
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
    hudState(): SwimControlsHud {
      return {
        tracking: hudTracking,
        kickRate: activeSource === 'body' ? (latest?.swim?.rate ?? 0) : lastKickRate,
        seated: latest?.seated ?? false,
        recentered: false,
        hipsQuiet: !!latest && latest.swim === undefined,
        profile: prefs.profile,
        padConnected,
        padId,
        source: activeSource,
        swimLevel: lastSwimLevel,
      };
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
        source: activeSource,
        keysHeld: [...keys],
      };
    },
    dispose() {
      unsub();
      source.close();
      win.removeEventListener('message', onMsg as EventListener);
      win.removeEventListener('keydown', down as EventListener);
      win.removeEventListener('keyup', up as EventListener);
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('mousedown', onMouseDown as EventListener);
      win.removeEventListener('mouseup', onMouseUp as EventListener);
      win.removeEventListener('mousemove', onMouseMove as EventListener);
    },
  };
}

/** digital key → analog axis: rise toward the target over riseS, fall to 0 over KB_RELEASE_S */
function ramp(cur: number, target: number, dt: number, riseS: number): number {
  if (target !== 0) {
    const step = dt / riseS;
    return clamp(cur + clamp(target - cur, -step, step), -1, 1);
  }
  const step = dt / KB_RELEASE_S;
  return Math.abs(cur) <= step ? 0 : cur - Math.sign(cur) * step;
}

const clampAxis = (v: number): number => clamp(v, -1, 1);
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
