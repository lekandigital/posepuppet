// BodyArcade Flight bridge: opens the flight app and relays derived body
// signals to it via postMessage. Only BodySignal crosses (the flight side
// re-validates each message with assertSignalShape) — landmarks never
// leave this page. Same-origin deployments also get signals over
// BroadcastChannel automatically; this bridge is what makes the
// two-dev-server (cross-origin) layout work.

import type { BodyInputAdapter } from './adapter';

const ENVELOPE = 'bodyarcade.body-input.v1';

export function defaultFlightUrl(): string {
  const env = import.meta.env.VITE_FLIGHT_URL as string | undefined;
  return env && env.trim() ? env.trim() : 'http://localhost:5199/';
}

/** Open (or focus) the flight app and stream body signals to it. */
export function openFlight(bodyInput: BodyInputAdapter, url = defaultFlightUrl()): void {
  const target = new URL(url, window.location.href);
  const win = window.open(target.href, 'bodyarcade-flight');
  if (!win) return; // popup blocked — user can retry from the palette
  const unsub = bodyInput.source.subscribe((signal) => {
    if (win.closed) {
      unsub();
      return;
    }
    win.postMessage({ t: ENVELOPE, signal }, target.origin);
  });
}
