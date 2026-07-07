// BodyArcade Flight bridge: opens the flight app and relays derived body
// signals to it via postMessage. Only BodySignal crosses (the flight side
// re-validates each message with assertSignalShape) — landmarks never
// leave this page. Same-origin (/flight/) deployments also get signals
// over BroadcastChannel automatically; the relay is a redundant second
// path there (the receiver dedupes by signal timestamp).
//
// While the game window is open, PosePuppet drops into flight-companion
// mode: lite pose model + suspended stage renderer, so the GPU/CPU budget
// goes to the game (the 60/45 fps + pose ≥ 15 Hz target). Everything is
// restored when the game window closes.

import type { BodyInputAdapter } from './adapter';

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

/** Open (or focus) the flight app, stream body signals, enter companion mode. */
export function openFlight(
  bodyInput: BodyInputAdapter,
  deps: FlightCompanionDeps = {},
  url = defaultFlightUrl(),
): void {
  const target = new URL(url, window.location.href);
  const win = window.open(target.href, 'bodyarcade-flight');
  if (!win) return; // popup blocked — user can retry from the palette/card

  const unsub = bodyInput.source.subscribe((signal) => {
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
