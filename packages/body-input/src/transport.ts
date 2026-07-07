// Two transports behind one interface: in-page subscription (same tab) and
// BroadcastChannel (cross-page, cross-three-version). Transports are the
// impure edge of the package — the core stays clock- and IO-free. The sink
// shape-guards every message by default: the privacy boundary is enforced
// at runtime, not just in tests.

import { assertSignalShape } from './schema';
import type { BodySignal } from './types';

export const DEFAULT_CHANNEL = 'bodyarcade.body-input.v1';

export interface BodySignalSource {
  /** Returns an unsubscribe function. */
  subscribe(cb: (signal: BodySignal) => void): () => void;
  close(): void;
}

export interface BodySignalSink {
  publish(signal: BodySignal): void;
  close(): void;
}

export interface TransportOptions {
  /** assertSignalShape on publish (default true — cheap, and it is the boundary) */
  validate?: boolean;
}

/** Same-tab transport: a source/sink pair over one subscriber set. */
export function createInPageChannel(opts: TransportOptions = {}): {
  source: BodySignalSource;
  sink: BodySignalSink;
} {
  const validate = opts.validate ?? true;
  const subs = new Set<(s: BodySignal) => void>();
  let closed = false;
  return {
    source: {
      subscribe(cb) {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      close() {
        subs.clear();
      },
    },
    sink: {
      publish(signal) {
        if (closed) return;
        if (validate) assertSignalShape(signal);
        for (const cb of subs) cb(signal);
      },
      close() {
        closed = true;
        subs.clear();
      },
    },
  };
}

export function createBroadcastSink(
  name: string = DEFAULT_CHANNEL, opts: TransportOptions = {},
): BodySignalSink {
  const validate = opts.validate ?? true;
  const bc = new BroadcastChannel(name);
  let closed = false;
  return {
    publish(signal) {
      if (closed) return;
      if (validate) assertSignalShape(signal);
      bc.postMessage(signal);
    },
    close() {
      closed = true;
      bc.close();
    },
  };
}

export function createBroadcastSource(name: string = DEFAULT_CHANNEL): BodySignalSource {
  const bc = new BroadcastChannel(name);
  const subs = new Set<(s: BodySignal) => void>();
  let warned = false;
  bc.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { v?: unknown } | null;
    if (!msg || msg.v !== 1) {
      // schema-major mismatch: drop, warn once, never throw (versioning policy)
      if (!warned) {
        warned = true;
        console.warn(`body-input: dropping message with v=${String(msg?.v)} on "${name}"`);
      }
      return;
    }
    for (const cb of subs) cb(msg as BodySignal);
  };
  return {
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    close() {
      subs.clear();
      bc.close();
    },
  };
}
