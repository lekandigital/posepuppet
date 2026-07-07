import {
  assertSignalShape,
  createBroadcastSource,
  type BodySignal,
} from "@bodyarcade/body-input";
import type { ControlState } from "../game/FlightControls";

/**
 * BodyArcade original: the body as a parallel input source (Feel Lab).
 *
 * Consumes BodySignal (derived axes only — landmarks never reach this app)
 * from two transports at once:
 *  - BroadcastChannel: PosePuppet tab on the same origin (production layout)
 *  - window "message": cross-origin dev, PosePuppet opens this app via
 *    window.open and relays signals; every message is shape-guarded here.
 *
 * Shaping ownership: the package already runs calibration-relative → One
 * Euro → measured dead zone → expo → slew per axis. This module owns what
 * is game-specific: profile mapping, assist clamps, boost detection with
 * hysteresis + refractory, tracking-loss autopilot (decay to neutral, fly
 * straight and level, slew-bounded re-entry), and keyboard priority.
 */

const KEYBOARD_PRIORITY_MS = 1500;
/** Signal older than this (receive clock) = tracking lost for flight purposes. */
const SIGNAL_STALE_MS = 350;
/** Below this confidence the body source is treated as lost (package decays too). */
const MIN_CONFIDENCE = 0.35;
const MESSAGE_ENVELOPE = "bodyarcade.body-input.v1";
const PROFILE_STORE_KEY = "bodyarcade_flight_profile_v1";
const ASSIST_STORE_KEY = "bodyarcade_flight_assist_v1";

/**
 * Autopilot: axis decay toward neutral on loss (τ ≈ 0.25 s ⇒ ~neutral in
 * 0.5 s). GATE-2 BASELINE — Gate-3 retest found the post-Gate-2 smoothing
 * (τ 0.3, slew 1.2) made overall control feel worse; restored exactly.
 */
const LOSS_DECAY_TAU_S = 0.25;
/** Re-entry: max intent change per second while blending back after loss.
 *  Gate-2 baseline (2.0) — the slower 1.2 added recovery lag after every
 *  confidence dip and read as "harder to control". */
const REACQUIRE_SLEW_PER_S = 2.0;
/** Re-entry blend duration bookkeeping (state leaves "reacquire" when caught up). */
const REACQUIRE_EPS = 0.02;

/** Boost: hold-to-fire with hysteresis + refractory (discrete event law). */
const BOOST_ENGAGE = 0.75;
const BOOST_RELEASE = 0.55;
const BOOST_HOLD_FRAMES = 6;
const BOOST_REFRACTORY_MS = 3000;

export interface BodyIntent {
  turnRate: number;
  speedAxis: number;
  elevateAxis: number;
}

export interface BodyFlightProfile {
  id: string;
  label: string;
  /** ControlState.turnRate at full deflection; keyboard full deflection is 1.2. */
  turnGain: number;
  speedGain: number;
  climbGain: number;
  descendGain: number;
  /** Sustained handsForward triggers Plane.speedBoost() (hysteresis + refractory). */
  boostOnHandsForward: boolean;
  notes: string;
  /** Map a fresh signal to raw intent (before assist clamps). */
  map(s: BodySignal, p: BodyFlightProfile): BodyIntent;
  /**
   * Optional arming gate: when it returns false the profile treats the
   * body as neutral (e.g. SUPERMAN stabilizes unless arms are out).
   * Gate-2 baseline: a plain predicate, instant both ways — the
   * hysteresis + decayed-disarm variant tried after Gate 2 made Superman
   * feel mushy and was reverted at the Gate-3 retest.
   */
  armed?(s: BodySignal): boolean;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Profiles are data + one mapping function each. Sign convention: leanX +1
 * = user leans to THEIR right; keyboard A (turn left) = +turnRate, so
 * right lean maps to negative turnRate.
 */
export const BODY_PROFILES: BodyFlightProfile[] = [
  {
    // Gate-2 outcome: Lekan's pick for the default standing profile.
    // Gains are the exact Gate-2-approved values — the post-Gate-2 bump
    // (turn 1.35 / climb 1.7) failed the Gate-3 retest and was reverted.
    id: "superman",
    label: "Superman",
    turnGain: 1.2,
    speedGain: 1.2,
    climbGain: 1.5,
    descendGain: 1.0,
    boostOnHandsForward: true,
    notes: "arms out to fly (drop arms = stabilize) · lean banks · arms high climbs · hands forward dives+boosts",
    map(s, p) {
      // Hands thrust forward = dive/boost: speed up and shed altitude.
      const dive = s.axes.handsForward;
      return {
        turnRate: -s.axes.leanX * p.turnGain,
        speedAxis: clamp1(s.axes.leanY * 0.6 + dive * p.speedGain),
        elevateAxis: clamp1(
          s.axes.armsRaised * p.climbGain - s.axes.crouch * p.descendGain - dive * 0.8,
        ),
      };
    },
    armed(s) {
      // Flight posture: arms out (T-ish). Gate-2 baseline thresholds.
      return s.axes.armsOut > 0.35 || s.axes.handsForward > 0.5;
    },
  },
  {
    id: "pilot-lean",
    label: "Pilot Lean",
    turnGain: 1.2,
    speedGain: 1.6,
    climbGain: 1.4,
    descendGain: 1.2,
    boostOnHandsForward: true,
    notes: "lean L/R turns · lean F/B speed · stand/crouch climbs/descends · hands forward boosts",
    map(s, p) {
      return {
        turnRate: -s.axes.leanX * p.turnGain,
        speedAxis: clamp1(s.axes.leanY * p.speedGain),
        elevateAxis: clamp1(s.axes.tallness * p.climbGain - s.axes.crouch * p.descendGain),
      };
    },
  },
  {
    id: "head-pilot",
    label: "Head Pilot",
    turnGain: 1.1,
    speedGain: 0,
    // Gate-2: climbing needed an uncomfortably deep backward lean while
    // seated — seated leans are small, so the climb side gets high gain.
    climbGain: 3.0,
    descendGain: 2.0,
    boostOnHandsForward: false,
    notes: "seated: shoulder-line lean turns · lean F/B climbs/descends · speed automated",
    map(s, p) {
      return {
        turnRate: -s.axes.leanX * p.turnGain,
        // Speed automated: hold a comfortable cruise (~70% of max band).
        speedAxis: 0.4,
        // Lean back (−) climbs, lean toward camera (+) descends.
        elevateAxis: clamp1(
          s.axes.leanY <= 0
            ? -s.axes.leanY * p.climbGain
            : -s.axes.leanY * p.descendGain,
        ),
      };
    },
  },
];

export interface AssistLevel {
  id: string;
  label: string;
  /** Cap on |turnRate| reaching the plane (keyboard full deflection = 1.2). */
  turnCap: number;
  /** Cap on |elevateAxis|. */
  elevateCap: number;
  /** Floor on speedAxis (Full Assist never lets the plane wallow at min speed). */
  speedFloor: number;
  notes: string;
}

export const ASSIST_LEVELS: AssistLevel[] = [
  {
    id: "full",
    label: "Full Assist",
    turnCap: 0.95,
    elevateCap: 0.75,
    speedFloor: -0.5,
    notes: "gentle caps on turn/climb, throttle floor — the default",
  },
  { id: "standard", label: "Standard", turnCap: 1.2, elevateCap: 1.0, speedFloor: -0.85, notes: "keyboard-equivalent caps" },
  { id: "expert", label: "Expert", turnCap: 1.6, elevateCap: 1.0, speedFloor: -1, notes: "no safety net, extra turn authority" },
];

export type BodySourceStatus =
  | "ok"
  | "no-signal"
  | "autopilot" // tracking lost: decaying to straight-and-level
  | "reacquiring" // signal back: slew-bounded blend to live intent
  | "unarmed" // profile gate (e.g. Superman arms down) → stabilize
  | "low-confidence"
  | "keyboard";

export interface BodyDebugState {
  active: boolean;
  reason: BodySourceStatus;
  signal: BodySignal | null;
  intent: BodyIntent;
  signalAgeMs: number | null;
  signalRateHz: number;
  profile: BodyFlightProfile;
  assist: AssistLevel;
  boostArmedIn: number; // ms until refractory over; 0 = ready
  recenterFlashMs: number; // >0 briefly after a T-pose recenter event
  /** Which transport delivered the last signal (both are always armed). */
  transport: "broadcast" | "postMessage" | null;
  /** Any signal received within the last 2 s. */
  senderConnected: boolean;
  /** Schema major of the last signal (consumers pin v1). */
  schemaV: number | null;
}

export class BodyFlightControls {
  private signal: BodySignal | null = null;
  private receivedAtMs = 0;
  private recentArrivals: number[] = [];
  private lastKeyboardActiveMs = 0;
  private pendingAction = false;
  private pendingBoost = false;
  private profileIdx = 0;
  private assistIdx = 0;
  private unsubscribe: (() => void) | null = null;

  /** Output state actually delivered last merge — the autopilot/slew substrate. */
  private outIntent: BodyIntent = { turnRate: 0, speedAxis: 0, elevateAxis: 0 };
  private lastMergeMs = 0;
  private mode: "live" | "autopilot" | "reacquire" = "autopilot";

  private boostHoldFrames = 0;
  private boostLatched = false;
  private lastBoostAtMs = -Infinity;
  private lastRecenterAtMs = -Infinity;
  private recenterUnseen = false;

  private lastTransport: "broadcast" | "postMessage" | null = null;

  private readonly onWindowMessage = (ev: MessageEvent) => {
    const data = ev.data as { t?: string; signal?: unknown } | null;
    if (!data || data.t !== MESSAGE_ENVELOPE) return;
    try {
      assertSignalShape(data.signal);
    } catch {
      return; // not a valid BodySignal — drop, never throw into the page
    }
    this.accept(data.signal as BodySignal, "postMessage");
  };

  constructor() {
    const bc = createBroadcastSource();
    const unsub = bc.subscribe((s) => this.accept(s, "broadcast"));
    this.unsubscribe = () => {
      unsub();
      bc.close();
    };
    window.addEventListener("message", this.onWindowMessage);
    try {
      const savedP = localStorage.getItem(PROFILE_STORE_KEY);
      const pi = BODY_PROFILES.findIndex((p) => p.id === savedP);
      if (pi >= 0) this.profileIdx = pi;
      const savedA = localStorage.getItem(ASSIST_STORE_KEY);
      const ai = ASSIST_LEVELS.findIndex((a) => a.id === savedA);
      if (ai >= 0) this.assistIdx = ai;
    } catch {
      /* defaults */
    }
  }

  private accept(s: BodySignal, via: "broadcast" | "postMessage") {
    // Same-origin layouts deliver every signal on BOTH transports (the
    // bridge relays and BroadcastChannel carries) — count each signal once.
    if (this.signal && s.ts === this.signal.ts) return;
    this.signal = s;
    this.lastTransport = via;
    this.receivedAtMs = performance.now();
    this.recentArrivals.push(this.receivedAtMs);
    if (this.recentArrivals.length > 90) this.recentArrivals.shift();
    if (s.events.includes("action")) this.pendingAction = true;
    if (s.events.includes("recenter")) {
      this.lastRecenterAtMs = this.receivedAtMs;
      this.recenterUnseen = true;
    }

    // Boost: hold-to-fire on handsForward with hysteresis + refractory.
    if (this.profile.boostOnHandsForward) {
      const hf = s.axes.handsForward;
      if (this.boostLatched) {
        if (hf < BOOST_RELEASE) this.boostLatched = false;
      } else if (hf > BOOST_ENGAGE) {
        this.boostHoldFrames++;
        if (
          this.boostHoldFrames >= BOOST_HOLD_FRAMES &&
          this.receivedAtMs - this.lastBoostAtMs > BOOST_REFRACTORY_MS
        ) {
          this.pendingBoost = true;
          this.boostLatched = true;
          this.boostHoldFrames = 0;
          this.lastBoostAtMs = this.receivedAtMs;
        }
      } else {
        this.boostHoldFrames = 0;
      }
    }
  }

  get profile(): BodyFlightProfile {
    return BODY_PROFILES[this.profileIdx]!;
  }

  get assist(): AssistLevel {
    return ASSIST_LEVELS[this.assistIdx]!;
  }

  cycleProfile(): BodyFlightProfile {
    this.profileIdx = (this.profileIdx + 1) % BODY_PROFILES.length;
    this.persist(PROFILE_STORE_KEY, this.profile.id);
    return this.profile;
  }

  setProfile(id: string): boolean {
    const idx = BODY_PROFILES.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.profileIdx = idx;
    this.persist(PROFILE_STORE_KEY, this.profile.id);
    return true;
  }

  cycleAssist(): AssistLevel {
    this.assistIdx = (this.assistIdx + 1) % ASSIST_LEVELS.length;
    this.persist(ASSIST_STORE_KEY, this.assist.id);
    return this.assist;
  }

  setAssist(id: string): boolean {
    const idx = ASSIST_LEVELS.findIndex((a) => a.id === id);
    if (idx < 0) return false;
    this.assistIdx = idx;
    this.persist(ASSIST_STORE_KEY, this.assist.id);
    return true;
  }

  private persist(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* session-only */
    }
  }

  private signalFresh(): boolean {
    return (
      this.signal !== null &&
      performance.now() - this.receivedAtMs <= SIGNAL_STALE_MS &&
      this.signal.confidence >= MIN_CONFIDENCE
    );
  }

  private liveIntent(): { intent: BodyIntent; armed: boolean } {
    const s = this.signal!;
    const p = this.profile;
    const armed = p.armed ? p.armed(s) : true;
    if (!armed) {
      return { intent: { turnRate: 0, speedAxis: 0, elevateAxis: 0 }, armed: false };
    }
    const raw = p.map(s, p);
    const a = this.assist;
    return {
      armed: true,
      intent: {
        turnRate: Math.max(-a.turnCap, Math.min(a.turnCap, raw.turnRate)),
        speedAxis: Math.max(a.speedFloor, clamp1(raw.speedAxis)),
        elevateAxis: Math.max(-a.elevateCap, Math.min(a.elevateCap, clamp1(raw.elevateAxis))),
      },
    };
  }

  /**
   * Advance the output intent one merge step: live tracking slews toward
   * the mapped intent (fast, but snap-free after reacquisition); loss
   * decays toward neutral (straight and level in ~0.5 s).
   */
  private step(dtS: number): BodySourceStatus {
    const fresh = this.signalFresh();

    if (!fresh) {
      if (!this.signal) return "no-signal";
      this.mode = "autopilot";
      const k = 1 - Math.exp(-dtS / LOSS_DECAY_TAU_S);
      this.outIntent.turnRate += (0 - this.outIntent.turnRate) * k;
      this.outIntent.speedAxis += (0 - this.outIntent.speedAxis) * k;
      this.outIntent.elevateAxis += (0 - this.outIntent.elevateAxis) * k;
      return this.signal.confidence < MIN_CONFIDENCE &&
        performance.now() - this.receivedAtMs <= SIGNAL_STALE_MS
        ? "low-confidence"
        : "autopilot";
    }

    const { intent: target, armed } = this.liveIntent();
    if (this.mode === "autopilot") this.mode = "reacquire";

    if (this.mode === "reacquire") {
      // Slew-bounded blend back — no snap after a dropout.
      const maxStep = REACQUIRE_SLEW_PER_S * dtS;
      let caughtUp = true;
      for (const k of ["turnRate", "speedAxis", "elevateAxis"] as const) {
        const d = target[k] - this.outIntent[k];
        if (Math.abs(d) > maxStep) {
          this.outIntent[k] += Math.sign(d) * maxStep;
          caughtUp = false;
        } else {
          this.outIntent[k] = target[k];
        }
      }
      if (caughtUp) this.mode = "live";
      return armed ? "reacquiring" : "unarmed";
    }

    // Live: follow directly (the package already slews per axis).
    // Gate-2 baseline: disarm (arms dropped) zeroes intent instantly and
    // re-arm picks up instantly — the smoothed variant felt mushy.
    this.outIntent = { ...target };
    return armed ? "ok" : "unarmed";
  }

  /**
   * Merge body intent into the keyboard/touch state. Called once per tick
   * from Game — the single place body input enters the flight-intent layer.
   */
  merge(kb: ControlState): ControlState & { boost?: boolean } {
    const now = performance.now();
    const dtS = this.lastMergeMs > 0 ? Math.min(0.1, (now - this.lastMergeMs) / 1000) : 0.016;
    this.lastMergeMs = now;

    const kbActive =
      kb.turnRate !== 0 ||
      kb.forward ||
      kb.brake ||
      kb.elevate ||
      kb.descend ||
      kb.paintball ||
      kb.specialAction ||
      kb.interact;
    if (kbActive) this.lastKeyboardActiveMs = now;

    if (now - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS) {
      // Keyboard owns the plane; body state machine keeps tracking silently.
      this.step(dtS);
      this.outIntent = { turnRate: 0, speedAxis: 0, elevateAxis: 0 };
      this.mode = "live";
      this.pendingBoost = false;
      this.pendingAction = false;
      return kb;
    }

    const status = this.step(dtS);
    if (status === "no-signal") return kb;

    const action = this.pendingAction && status === "ok";
    this.pendingAction = false;
    const boost = this.pendingBoost && status === "ok";
    this.pendingBoost = false;

    return {
      turnRate: this.outIntent.turnRate,
      forward: false,
      brake: false,
      elevate: false,
      descend: false,
      paintball: action,
      specialAction: action,
      interact: false,
      speedAxis: this.outIntent.speedAxis,
      elevateAxis: this.outIntent.elevateAxis,
      boost,
    };
  }

  /** One-shot: true once after a T-pose recenter (drives the game toast). */
  consumeRecenterFlag(): boolean {
    const v = this.recenterUnseen;
    this.recenterUnseen = false;
    return v;
  }

  /** Everything the tuner overlay needs, one call per frame. */
  debugState(): BodyDebugState {
    const now = performance.now();
    let reason: BodySourceStatus;
    if (now - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS) {
      reason = "keyboard";
    } else if (!this.signal) {
      reason = "no-signal";
    } else if (!this.signalFresh()) {
      reason =
        this.signal.confidence < MIN_CONFIDENCE && now - this.receivedAtMs <= SIGNAL_STALE_MS
          ? "low-confidence"
          : "autopilot";
    } else if (this.profile.armed && !this.profile.armed(this.signal)) {
      reason = "unarmed";
    } else if (this.mode === "reacquire") {
      reason = "reacquiring";
    } else {
      reason = "ok";
    }
    const windowStart = now - 2000;
    const recent = this.recentArrivals.filter((t) => t >= windowStart);
    return {
      active: reason === "ok",
      reason,
      signal: this.signal,
      intent: { ...this.outIntent },
      signalAgeMs: this.signal ? now - this.receivedAtMs : null,
      signalRateHz: recent.length / 2,
      profile: this.profile,
      assist: this.assist,
      boostArmedIn: Math.max(0, BOOST_REFRACTORY_MS - (now - this.lastBoostAtMs)),
      // Gate-2 feedback: the recenter confirmation was easy to miss — hold
      // the flash long enough to register (tuner banner + in-game toast).
      recenterFlashMs: Math.max(0, 4000 - (now - this.lastRecenterAtMs)),
      transport: this.lastTransport,
      senderConnected: recent.length > 0,
      schemaV: this.signal?.v ?? null,
    };
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.removeEventListener("message", this.onWindowMessage);
  }
}
