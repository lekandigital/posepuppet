import {
  assertSignalShape,
  createBroadcastSource,
  type BodySignal,
} from "@bodyarcade/body-input";
import type { ControlState } from "../game/FlightControls";

/**
 * BodyArcade original: the body as a parallel input source.
 *
 * Consumes BodySignal (derived axes only — landmarks never reach this app)
 * from two transports at once:
 *  - BroadcastChannel: PosePuppet tab on the same origin (production layout)
 *  - window "message": cross-origin dev, PosePuppet opens this app via
 *    window.open and relays signals; every message is shape-guarded here.
 *
 * Produces the same ControlState the keyboard produces, plus the analog
 * speed/elevate axes. Merge rule: any keyboard/touch activity grabs control
 * for KEYBOARD_PRIORITY_MS — keys are the sacred fallback.
 */

const KEYBOARD_PRIORITY_MS = 1500;
/** Signal older than this (receive clock) = body source inactive. */
const SIGNAL_STALE_MS = 350;
/** Below this confidence the body source goes inactive (package decays axes too). */
const MIN_CONFIDENCE = 0.35;
const MESSAGE_ENVELOPE = "bodyarcade.body-input.v1";
const PROFILE_STORE_KEY = "bodyarcade_flight_profile_v1";

export interface BodyFlightProfile {
  id: string;
  label: string;
  /** ControlState.turnRate at full lean; keyboard full deflection is 1.2. */
  turnGain: number;
  /** Multiplier on leanY → speedAxis. */
  speedGain: number;
  /** Multipliers on tallness/crouch → elevateAxis. */
  climbGain: number;
  descendGain: number;
  /** Which signal axis steers. Seated profiles keep leanX (shoulder-line lean). */
  notes: string;
}

/** Profiles are data. P3's Feel Lab tunes these against the fixture clips. */
export const BODY_PROFILES: BodyFlightProfile[] = [
  {
    id: "pilot-lean",
    label: "Pilot Lean",
    turnGain: 1.2,
    speedGain: 1.6,
    climbGain: 1.4,
    descendGain: 1.2,
    notes: "lean L/R turns, lean F/B speed, stand tall/crouch climbs/descends",
  },
];

export interface BodyDebugState {
  active: boolean;
  reason: "ok" | "no-signal" | "stale" | "low-confidence" | "keyboard";
  signal: BodySignal | null;
  intent: { turnRate: number; speedAxis: number; elevateAxis: number };
  signalAgeMs: number | null;
  signalRateHz: number;
  profile: BodyFlightProfile;
}

export class BodyFlightControls {
  private signal: BodySignal | null = null;
  private receivedAtMs = 0;
  private recentArrivals: number[] = [];
  private lastKeyboardActiveMs = 0;
  private pendingAction = false;
  private profileIdx = 0;
  private unsubscribe: (() => void) | null = null;
  private readonly onWindowMessage = (ev: MessageEvent) => {
    const data = ev.data as { t?: string; signal?: unknown } | null;
    if (!data || data.t !== MESSAGE_ENVELOPE) return;
    try {
      assertSignalShape(data.signal);
    } catch {
      return; // not a valid BodySignal — drop, never throw into the page
    }
    this.accept(data.signal as BodySignal);
  };

  constructor() {
    const bc = createBroadcastSource();
    const unsub = bc.subscribe((s) => this.accept(s));
    this.unsubscribe = () => {
      unsub();
      bc.close();
    };
    window.addEventListener("message", this.onWindowMessage);
    try {
      const saved = localStorage.getItem(PROFILE_STORE_KEY);
      const idx = BODY_PROFILES.findIndex((p) => p.id === saved);
      if (idx >= 0) this.profileIdx = idx;
    } catch {
      /* default profile */
    }
  }

  private accept(s: BodySignal) {
    this.signal = s;
    this.receivedAtMs = performance.now();
    this.recentArrivals.push(this.receivedAtMs);
    if (this.recentArrivals.length > 60) this.recentArrivals.shift();
    if (s.events.includes("action")) this.pendingAction = true;
  }

  get profile(): BodyFlightProfile {
    return BODY_PROFILES[this.profileIdx]!;
  }

  cycleProfile(): BodyFlightProfile {
    this.profileIdx = (this.profileIdx + 1) % BODY_PROFILES.length;
    try {
      localStorage.setItem(PROFILE_STORE_KEY, this.profile.id);
    } catch {
      /* session-only */
    }
    return this.profile;
  }

  setProfile(id: string): boolean {
    const idx = BODY_PROFILES.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.profileIdx = idx;
    try {
      localStorage.setItem(PROFILE_STORE_KEY, this.profile.id);
    } catch {
      /* session-only */
    }
    return true;
  }

  private status(): BodyDebugState["reason"] {
    if (!this.signal) return "no-signal";
    if (performance.now() - this.receivedAtMs > SIGNAL_STALE_MS) return "stale";
    if (this.signal.confidence < MIN_CONFIDENCE) return "low-confidence";
    return "ok";
  }

  private mapIntent(): { turnRate: number; speedAxis: number; elevateAxis: number } {
    const s = this.signal!;
    const p = this.profile;
    const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
    // leanX +1 = user leans to THEIR right; keyboard A (turn left) is
    // +turnRate, so right lean = negative turnRate = right turn.
    const turnRate = -s.axes.leanX * p.turnGain;
    // leanY +1 = lean toward camera = faster.
    const speedAxis = clamp1(s.axes.leanY * p.speedGain);
    const elevateAxis = clamp1(
      s.axes.tallness * p.climbGain - s.axes.crouch * p.descendGain,
    );
    return { turnRate, speedAxis, elevateAxis };
  }

  /**
   * Merge body intent into the keyboard/touch state. Called once per tick
   * from Game — the single place body input enters the flight-intent layer.
   */
  merge(kb: ControlState): ControlState {
    const now = performance.now();
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

    if (now - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS) return kb;
    if (this.status() !== "ok") return kb;

    const intent = this.mapIntent();
    const action = this.pendingAction;
    this.pendingAction = false;
    return {
      turnRate: intent.turnRate,
      forward: false,
      brake: false,
      elevate: false,
      descend: false,
      paintball: action,
      specialAction: action,
      interact: false,
      speedAxis: intent.speedAxis,
      elevateAxis: intent.elevateAxis,
    };
  }

  /** Everything the tuner overlay needs, one call per frame. */
  debugState(): BodyDebugState {
    const reason =
      performance.now() - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS
        ? "keyboard"
        : this.status();
    const now = performance.now();
    const windowStart = now - 2000;
    const recent = this.recentArrivals.filter((t) => t >= windowStart);
    return {
      active: reason === "ok",
      reason,
      signal: this.signal,
      intent:
        this.signal && reason === "ok"
          ? this.mapIntent()
          : { turnRate: 0, speedAxis: 0, elevateAxis: 0 },
      signalAgeMs: this.signal ? now - this.receivedAtMs : null,
      signalRateHz: recent.length / 2,
      profile: this.profile,
    };
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.removeEventListener("message", this.onWindowMessage);
  }
}
