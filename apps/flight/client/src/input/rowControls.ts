import {
  assertSignalShape,
  createBroadcastSource,
  type BodySignal,
} from "@bodyarcade/body-input";
import type { ControlState } from "../game/FlightControls";

/**
 * BodyArcade Rowing: body strokes drive the boat.
 *
 * Consumes the BodySignal `stroke` block (rate/phase/ampL/ampR/count —
 * derived producer-side in @bodyarcade/body-input; landmarks never reach
 * this app) plus leanX for the lean steering profile. Same dual-transport
 * pattern as BodyFlightControls (BroadcastChannel + shape-guarded window
 * message). Deliberately a SEPARATE controller rather than an extraction
 * from BodyFlightControls: the flight controller is the Gate-2-approved
 * baseline and stays untouched (see DECISIONS 2026-07-09); the shared
 * plumbing is ~80 lines and the state machines genuinely differ
 * (impulse/cruise here vs continuous axes there).
 *
 * Owns: stroke→impulse queue, steering profiles (asymmetry vs lean),
 * assist ladder, cruise (rest while momentum holds), tracking-loss
 * autopilot (drift straight, slow), keyboard priority.
 */

const KEYBOARD_PRIORITY_MS = 1500;
const SIGNAL_STALE_MS = 350;
const MIN_CONFIDENCE = 0.35;
const MESSAGE_ENVELOPE = "bodyarcade.body-input.v1";
const PROFILE_STORE_KEY = "bodyarcade_row_profile_v1";
const ASSIST_STORE_KEY = "bodyarcade_row_assist_v1";

/** Loss: turn intent decays to neutral (drift straight) — flight's τ. */
const LOSS_DECAY_TAU_S = 0.25;
/** Re-entry slew after a dropout (intent units per second, no snap). */
const REACQUIRE_SLEW_PER_S = 2.0;

/** Stroke amplitude (arm-lengths) that counts as a full-strength pull —
 *  measured on the fixtures: standing p50 ~0.35–0.45, seated ~0.25. */
const FULL_STROKE_AMP = 0.45;
/** Weakest credited pull — a detected stroke always visibly surges. */
const MIN_STROKE_STRENGTH = 0.35;

/** Cruise: this many strokes at a steady rhythm arm it… */
const CRUISE_ARM_STROKES = 6;
/** …and once armed, resting (no stroke for ~2 periods) latches the hold. */
const CRUISE_LATCH_PERIODS = 2;

/** Asymmetry steering: per-stroke (ampL−ampR) pulse, smoothed + decayed. */
const ASYM_DECAY_TAU_S = 1.1;

export interface RowIntent {
  turnRate: number;
}

export interface RowProfile {
  id: string;
  label: string;
  /** ControlState.turnRate at full deflection (keyboard boat = ±1.2). */
  turnGain: number;
  notes: string;
  /** continuous steering component from the live signal */
  steer(s: BodySignal, asymSmoothed: number, p: RowProfile): number;
}

/** Sign conventions: keyboard A = +turnRate = turn LEFT. leanX + = the
 *  user's own right → negative turnRate (same as flight). Asymmetry:
 *  pulling harder with the LEFT hand turns RIGHT (paddle physics) →
 *  ampL−ampR > 0 maps to negative turnRate. Live gate picks the default. */
export const ROW_PROFILES: RowProfile[] = [
  {
    id: "row-lean",
    label: "Lean steering",
    // GATE-2 FIX (live 360°-pivot report): leanX saturates at ~15° of
    // torso tilt, so a "gentle" lean read as full deflection — expo 1.6
    // makes the response progressive (gentle lean → gentle curve) and the
    // gain drops 1.1 → 0.8. Yaw is additionally speed-coupled in Game.tick
    // (carve, don't pivot) — the two together are the handling fix.
    turnGain: 0.8,
    notes: "lean L/R steers · strokes propel · sit back to rest (cruise)",
    steer: (s, _asym, p) => {
      const x = s.axes.leanX;
      return -Math.sign(x) * Math.pow(Math.abs(x), 1.6) * p.turnGain;
    },
  },
  {
    id: "row-asym",
    label: "Stroke steering",
    turnGain: 3.2,
    notes: "pull harder on one side to turn away from it · strokes propel · rest = cruise",
    steer: (_s, asym, p) => Math.max(-1.2, Math.min(1.2, -asym * p.turnGain)),
  },
];

export interface RowAssist {
  id: string;
  label: string;
  turnCap: number;
  /** Full Assist softly follows the waterway course (Game applies it). */
  courseFollow: boolean;
  cruise: boolean;
  notes: string;
}

export const ROW_ASSISTS: RowAssist[] = [
  { id: "full", label: "Full Assist", turnCap: 0.95, courseFollow: true, cruise: true, notes: "soft course-follow + cruise — the default" },
  { id: "standard", label: "Standard", turnCap: 1.2, courseFollow: false, cruise: true, notes: "free steering, cruise kept" },
  { id: "expert", label: "Expert", turnCap: 1.6, courseFollow: false, cruise: false, notes: "no safety net" },
];

export type RowSourceStatus =
  | "ok"
  | "no-signal"
  | "autopilot"
  | "reacquiring"
  | "low-confidence"
  | "keyboard";

export interface RowDebugState {
  active: boolean;
  reason: RowSourceStatus;
  signal: BodySignal | null;
  turnRate: number;
  strokeRate: number;
  strokePhase: number;
  ampL: number;
  ampR: number;
  asymSmoothed: number;
  cruiseArmed: boolean;
  cruiseHolding: boolean;
  steadyStrokes: number;
  profile: RowProfile;
  assist: RowAssist;
  signalAgeMs: number | null;
  signalRateHz: number;
  senderConnected: boolean;
}

export class RowingControls {
  private signal: BodySignal | null = null;
  private receivedAtMs = 0;
  private recentArrivals: number[] = [];
  private lastKeyboardActiveMs = 0;
  private unsubscribe: (() => void) | null = null;
  private profileIdx = 0;
  private assistIdx = 0;

  private outTurn = 0;
  private lastMergeMs = 0;
  private mode: "live" | "autopilot" | "reacquire" = "autopilot";

  /** strokes seen but not yet consumed by the game (strength 0..1 each) */
  private pendingStrokes: number[] = [];
  private lastStrokeCount: number | null = null;
  private lastStrokeAtMs = -Infinity;

  private asymSmoothed = 0;
  private steadyStrokes = 0;
  private cruiseArmed = false;
  private cruiseHolding = false;

  private readonly onWindowMessage = (ev: MessageEvent) => {
    const data = ev.data as { t?: string; signal?: unknown } | null;
    if (!data || data.t !== MESSAGE_ENVELOPE) return;
    try {
      assertSignalShape(data.signal);
    } catch {
      return;
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
      const p = ROW_PROFILES.findIndex((x) => x.id === localStorage.getItem(PROFILE_STORE_KEY));
      if (p >= 0) this.profileIdx = p;
      const a = ROW_ASSISTS.findIndex((x) => x.id === localStorage.getItem(ASSIST_STORE_KEY));
      if (a >= 0) this.assistIdx = a;
    } catch {
      /* defaults */
    }
  }

  private accept(s: BodySignal) {
    if (this.signal && s.ts === this.signal.ts) return; // both transports carry it
    this.signal = s;
    this.receivedAtMs = performance.now();
    this.recentArrivals.push(this.receivedAtMs);
    if (this.recentArrivals.length > 90) this.recentArrivals.shift();

    const st = s.stroke;
    if (!st) return;
    if (this.lastStrokeCount === null) {
      this.lastStrokeCount = st.count; // never credit history from before we attached
      return;
    }
    if (st.count > this.lastStrokeCount) {
      const n = st.count - this.lastStrokeCount;
      this.lastStrokeCount = st.count;
      this.lastStrokeAtMs = this.receivedAtMs;
      const amp = (st.ampL + st.ampR) / 2;
      const strength = Math.max(MIN_STROKE_STRENGTH, Math.min(1, amp / FULL_STROKE_AMP));
      for (let i = 0; i < n; i++) this.pendingStrokes.push(strength);

      // steering asymmetry: per-stroke pulse into the smoothed value
      this.asymSmoothed = this.asymSmoothed * 0.35 + (st.ampL - st.ampR) * 0.65;

      // cruise arming: consecutive strokes while the rhythm reads steady
      this.steadyStrokes = st.active ? this.steadyStrokes + n : n;
      if (this.steadyStrokes >= CRUISE_ARM_STROKES) this.cruiseArmed = true;
      this.cruiseHolding = false; // actively rowing again
    }
  }

  get profile(): RowProfile {
    return ROW_PROFILES[this.profileIdx]!;
  }

  get assist(): RowAssist {
    return ROW_ASSISTS[this.assistIdx]!;
  }

  cycleProfile(): RowProfile {
    this.profileIdx = (this.profileIdx + 1) % ROW_PROFILES.length;
    this.persist(PROFILE_STORE_KEY, this.profile.id);
    return this.profile;
  }

  setProfile(id: string): boolean {
    const i = ROW_PROFILES.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.profileIdx = i;
    this.persist(PROFILE_STORE_KEY, this.profile.id);
    return true;
  }

  cycleAssist(): RowAssist {
    this.assistIdx = (this.assistIdx + 1) % ROW_ASSISTS.length;
    this.persist(ASSIST_STORE_KEY, this.assist.id);
    return this.assist;
  }

  setAssist(id: string): boolean {
    const i = ROW_ASSISTS.findIndex((a) => a.id === id);
    if (i < 0) return false;
    this.assistIdx = i;
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

  private step(dtS: number): RowSourceStatus {
    const fresh = this.signalFresh();

    // asymmetry pulse decays between strokes regardless of state
    this.asymSmoothed *= Math.exp(-dtS / ASYM_DECAY_TAU_S);

    if (!fresh) {
      if (!this.signal) return "no-signal";
      // autopilot: drift straight (turn → 0), stop crediting strokes,
      // release cruise so the boat slows on its own glide
      this.mode = "autopilot";
      this.cruiseHolding = false;
      this.pendingStrokes.length = 0;
      this.outTurn += (0 - this.outTurn) * (1 - Math.exp(-dtS / LOSS_DECAY_TAU_S));
      return this.signal.confidence < MIN_CONFIDENCE &&
        performance.now() - this.receivedAtMs <= SIGNAL_STALE_MS
        ? "low-confidence"
        : "autopilot";
    }

    const s = this.signal!;
    const target = Math.max(
      -this.assist.turnCap,
      Math.min(this.assist.turnCap, this.profile.steer(s, this.asymSmoothed, this.profile)),
    );

    if (this.mode === "autopilot") this.mode = "reacquire";
    if (this.mode === "reacquire") {
      const maxStep = REACQUIRE_SLEW_PER_S * dtS;
      const d = target - this.outTurn;
      if (Math.abs(d) > maxStep) {
        this.outTurn += Math.sign(d) * maxStep;
        return "reacquiring";
      }
      this.outTurn = target;
      this.mode = "live";
      return "ok";
    }

    this.outTurn = target;

    // cruise latch: armed + resting (no stroke for ~2 periods) = hold
    if (this.assist.cruise && this.cruiseArmed && !this.cruiseHolding) {
      const rate = s.stroke?.rate ?? 0;
      const periodMs = rate > 0.05 ? 1000 / rate : 2000;
      if (performance.now() - this.lastStrokeAtMs > CRUISE_LATCH_PERIODS * periodMs) {
        this.cruiseHolding = true;
      }
    }
    if (!this.assist.cruise) {
      this.cruiseArmed = false;
      this.cruiseHolding = false;
    }
    return "ok";
  }

  /**
   * Merge rowing intent into the keyboard state — called once per tick
   * when the boat is the active vehicle. Keyboard always wins; while it
   * does, rowing state resets so a stale cruise can't fight the keys.
   */
  merge(kb: ControlState): ControlState {
    const now = performance.now();
    const dtS = this.lastMergeMs > 0 ? Math.min(0.1, (now - this.lastMergeMs) / 1000) : 0.016;
    this.lastMergeMs = now;

    const kbActive =
      kb.turnRate !== 0 || kb.forward || kb.brake || kb.elevate || kb.descend ||
      kb.paintball || kb.specialAction || kb.interact;
    if (kbActive) this.lastKeyboardActiveMs = now;

    if (now - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS) {
      this.step(dtS);
      this.outTurn = 0;
      this.mode = "live";
      this.pendingStrokes.length = 0;
      this.cruiseHolding = false;
      return kb;
    }

    const status = this.step(dtS);
    if (status === "no-signal") return kb;

    return {
      ...kb,
      turnRate: this.outTurn,
      forward: false,
      brake: false,
      elevate: false,
      descend: false,
    };
  }

  /** Drain strokes detected since the last call (strength 0..1 each). */
  consumeStrokes(): number[] {
    if (this.pendingStrokes.length === 0) return [];
    const out = this.pendingStrokes.slice();
    this.pendingStrokes.length = 0;
    return out;
  }

  /** Cruise is holding speed (rower resting, momentum kept). */
  get cruising(): boolean {
    return this.cruiseHolding;
  }

  /** Keyboard currently owns the boat (priority window) — the game must
   *  not add any rowing corrections while it does. */
  get keyboardOwns(): boolean {
    return performance.now() - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS;
  }

  /** Body currently owns the boat (fresh signal, keyboard quiet). */
  get bodyActive(): boolean {
    return (
      performance.now() - this.lastKeyboardActiveMs >= KEYBOARD_PRIORITY_MS && this.signalFresh()
    );
  }

  debugState(): RowDebugState {
    const now = performance.now();
    let reason: RowSourceStatus;
    if (now - this.lastKeyboardActiveMs < KEYBOARD_PRIORITY_MS) reason = "keyboard";
    else if (!this.signal) reason = "no-signal";
    else if (!this.signalFresh()) {
      reason =
        this.signal.confidence < MIN_CONFIDENCE && now - this.receivedAtMs <= SIGNAL_STALE_MS
          ? "low-confidence"
          : "autopilot";
    } else if (this.mode === "reacquire") reason = "reacquiring";
    else reason = "ok";
    const windowStart = now - 2000;
    const recent = this.recentArrivals.filter((t) => t >= windowStart);
    const st = this.signal?.stroke;
    return {
      active: reason === "ok",
      reason,
      signal: this.signal,
      turnRate: this.outTurn,
      strokeRate: st?.rate ?? 0,
      strokePhase: st?.phase ?? 0,
      ampL: st?.ampL ?? 0,
      ampR: st?.ampR ?? 0,
      asymSmoothed: this.asymSmoothed,
      cruiseArmed: this.cruiseArmed,
      cruiseHolding: this.cruiseHolding,
      steadyStrokes: this.steadyStrokes,
      profile: this.profile,
      assist: this.assist,
      signalAgeMs: this.signal ? now - this.receivedAtMs : null,
      signalRateHz: recent.length / 2,
      senderConnected: recent.length > 0,
    };
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.removeEventListener("message", this.onWindowMessage);
  }
}
