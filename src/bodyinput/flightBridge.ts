// BodyArcade game bridge: opens a game app and relays derived body
// signals to it via postMessage. Only BodySignal crosses (the game side
// re-validates each message with assertSignalShape) — landmarks never
// leave this page. Same-origin (/flight/, /dolphin/) deployments also get
// signals over BroadcastChannel automatically; the relay is a redundant
// second path there (the receiver dedupes by signal timestamp).
//
// While the game window is open, PosePuppet drops into companion mode:
// lite pose model + suspended stage renderer, so the GPU/CPU budget goes
// to the game (the 60/45 fps + pose ≥ 15 Hz target). Everything is
// restored when the game window closes.
//
// Post-V1 note: games initialize their own pose runtime when opened
// directly. The `pp=companion` param this bridge appends tells the game's
// runtime an external producer is streaming, so it never opens a second
// camera pipeline (one tracking pipeline per page, one producer per origin).

import type { BodySignalSource } from '@bodyarcade/body-input';

const ENVELOPE = 'bodyarcade.body-input.v1';
const WINDOW_POLL_MS = 1000;

export interface FlightCompanionDeps {
  /** Suspend/resume the PosePuppet stage renderer. */
  setStageSuspended?: (v: boolean) => void;
  /** Switch to the lite pose model; returns the restore function. */
  useLiteModel?: () => () => void;
}

export function defaultFlightUrl(): string {
  const env = import.meta.env.VITE_FLIGHT_URL as string | undefined;
  // Same-origin by default: the PosePuppet dev server serves the built
  // flight app at /flight/ (vite.config.ts middleware).
  return env && env.trim() ? env.trim() : '/flight/';
}

/** Open (or focus) a game app, stream body signals, enter companion mode. */
export function openFlight(
  signals: BodySignalSource,
  deps: FlightCompanionDeps = {},
  url = defaultFlightUrl(),
  windowName = 'bodyarcade-flight',
): void {
  const target = new URL(url, window.location.href);
  target.searchParams.set('pp', 'companion'); // this tab is the producer
  const win = window.open(target.href, windowName);
  if (!win) return; // popup blocked — user can retry from the palette/card

  const unsub = signals.subscribe((signal) => {
    if (!win.closed) win.postMessage({ t: ENVELOPE, signal }, target.origin);
  });

  deps.setStageSuspended?.(true);
  const restoreModel = deps.useLiteModel?.();

  const poll = setInterval(() => {
    if (!win.closed) return;
    clearInterval(poll);
    unsub();
    deps.setStageSuspended?.(false);
    restoreModel?.();
  }, WINDOW_POLL_MS);
}
