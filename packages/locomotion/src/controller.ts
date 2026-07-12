// Body → walk intents. The consumer discipline proven in Flight/Rowing/
// Dolphin: BodySignal only (landmarks never reach a consumer), two
// transports (BroadcastChannel same-origin + postMessage envelope, deduped
// by ts), staleness/confidence gates downstream in the model, keyboard
// ALWAYS wins while touched, and a synthetic `inject` path so closed-loop
// tests and the graybox drivers run the exact live code.

import {
  assertSignalShape, createBroadcastSource, type BodySignal,
} from '@bodyarcade/body-input';
import type { WalkIntent } from './types';

const ENVELOPE = 'bodyarcade.body-input.v1';
const SIGNAL_STALE_MS = 350;
const KEYBOARD_PRIORITY_MS = 1500;

export type WalkTrackingHud =
  | 'live'
  | 'stale'
  | 'low-confidence'
  | 'keyboard'
  | 'none';

export interface WalkHudState {
  tracking: WalkTrackingHud;
  cadence: number;
  source: 'legs' | 'sway' | 'none';
  seated: boolean;
  /** true once after each T-pose recenter (consumed by reading) */
  recentered: boolean;
}

export interface WalkController {
  /** Build this frame's intent. Call once per render frame. */
  intent(nowMs: number): WalkIntent;
  /** Feed a BodySignal directly (synthetic drivers, tape replay, tests) —
   *  identical path to the live transports. */
  inject(signal: BodySignal, atMs: number): void;
  hudState(): WalkHudState;
  debug(): {
    lastTs: number;
    ageMs: number;
    gotBroadcast: boolean;
    gotMessage: boolean;
    keys: string[];
  };
  dispose(): void;
}

export interface WalkControllerOptions {
  /** attach BroadcastChannel + postMessage listeners (default true) */
  transports?: boolean;
  /** attach keyboard listeners (default true) */
  keyboard?: boolean;
}

const KB_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'] as const;

export function createWalkController(
  win: Window | null = typeof window === 'undefined' ? null : window,
  opts: WalkControllerOptions = {},
): WalkController {
  let latest: BodySignal | null = null;
  let latestAtMs = -Infinity; // receive clock (same clock intent() gets)
  let lastTsSeen = -1;
  let recenterPending = false;
  let recenterHud = false;

  let gotBroadcast = false;
  let gotMessage = false;

  function onSignal(s: BodySignal, atMs: number): void {
    if (s.ts === lastTsSeen) return; // second transport, same signal
    lastTsSeen = s.ts;
    latest = s;
    latestAtMs = atMs;
    if (s.events.includes('recenter')) {
      recenterPending = true;
      recenterHud = true;
    }
  }

  let unsub: (() => void) | null = null;
  let onMsg: ((ev: MessageEvent) => void) | null = null;
  if (win && (opts.transports ?? true)) {
    const source = createBroadcastSource();
    const u = source.subscribe((s) => {
      gotBroadcast = true;
      onSignal(s, performance.now());
    });
    unsub = u;
    onMsg = (ev: MessageEvent) => {
      const d = ev.data as { t?: string; signal?: unknown };
      if (!d || d.t !== ENVELOPE || !d.signal) return;
      try {
        assertSignalShape(d.signal);
        gotMessage = true;
        onSignal(d.signal, performance.now());
      } catch {
        /* shape-guarded: not a BodySignal — dropped */
      }
    };
    win.addEventListener('message', onMsg);
  }

  // --- keyboard (fallback law: works with the camera denied) ---
  const keys = new Set<string>();
  let lastKeyAt = -Infinity;
  const down = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((KB_KEYS as readonly string[]).includes(k)) {
      keys.add(k);
      lastKeyAt = performance.now();
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
    if (keys.size > 0) lastKeyAt = performance.now();
  };
  if (win && (opts.keyboard ?? true)) {
    win.addEventListener('keydown', down);
    win.addEventListener('keyup', up);
  }

  let hudTracking: WalkTrackingHud = 'none';

  return {
    intent(nowMs: number): WalkIntent {
      const s = latest;
      const ageMs = nowMs - latestAtMs;
      const fresh = s !== null && ageMs < SIGNAL_STALE_MS;

      const kbTouched = keys.size > 0 || nowMs - lastKeyAt < KEYBOARD_PRIORITY_MS;
      const forward =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) +
        (keys.has('s') || keys.has('arrowdown') ? -1 : 0);
      const turn =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) +
        (keys.has('a') || keys.has('arrowleft') ? -1 : 0);

      const recenterEvent = recenterPending;
      recenterPending = false;

      hudTracking = kbTouched
        ? 'keyboard'
        : !s
          ? 'none'
          : !fresh
            ? 'stale'
            : s.confidence < 0.35
              ? 'low-confidence'
              : 'live';

      return {
        cadence: fresh && s!.gait ? s!.gait.cadence : 0,
        gaitActive: fresh && s!.gait ? s!.gait.active : false,
        gaitAmp: fresh && s!.gait ? s!.gait.amp : 0,
        stepCount: s?.gait ? s.gait.count : 0,
        shift: fresh && s!.gait ? s!.gait.shift : 0,
        gaitSource: fresh && s!.gait ? s!.gait.source : 'none',
        leanX: fresh ? s!.axes.leanX : 0,
        leanY: fresh ? s!.axes.leanY : 0,
        crouch: fresh ? s!.axes.crouch : 0,
        seated: fresh ? s!.seated : false,
        confidence: fresh ? s!.confidence : 0,
        signalFresh: fresh,
        recenterEvent,
        kb: { forward, turn, active: kbTouched },
      };
    },

    inject(signal: BodySignal, atMs: number): void {
      onSignal(signal, atMs);
    },

    hudState(): WalkHudState {
      const st: WalkHudState = {
        tracking: hudTracking,
        cadence: latest?.gait?.cadence ?? 0,
        source: latest?.gait?.source ?? 'none',
        seated: latest?.seated ?? false,
        recentered: recenterHud,
      };
      recenterHud = false;
      return st;
    },

    debug() {
      return {
        lastTs: lastTsSeen,
        ageMs: performance.now() - latestAtMs,
        gotBroadcast,
        gotMessage,
        keys: [...keys],
      };
    },

    dispose(): void {
      unsub?.();
      if (win && onMsg) win.removeEventListener('message', onMsg);
      if (win && (opts.keyboard ?? true)) {
        win.removeEventListener('keydown', down);
        win.removeEventListener('keyup', up);
      }
    },
  };
}
