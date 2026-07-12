// Producer election: at most ONE tracking pipeline produces body signals
// per origin at a time. Two mechanisms, layered:
//  1. traffic listen — if BodySignal traffic is already flowing (Broadcast
//     Channel, or the postMessage relay envelope from a cross-origin
//     PosePuppet tab), an eligible producer yields and consumes instead;
//  2. Web Locks — the active producer holds "bodyarcade-pose-producer"
//     for as long as its camera runs, so producers that boot later lose
//     the race deterministically (locks are origin-scoped; the fallback
//     when the API is missing is the traffic listen alone).
//
// Modes: 'strict' (games — yield whenever someone else is producing),
// 'claim' (the Full App — take the lock when free, but never yield: two
// app tabs each running their own camera is the pre-extraction behavior
// and stays), 'off' (tests / fixture drives).

export type ElectionMode = 'strict' | 'claim' | 'off';

export interface ProducerElection {
  role: 'producer' | 'external';
  /** Frees the producer lock (no-op for external/off). Idempotent. */
  release(): void;
}

export const PRODUCER_LOCK = 'bodyarcade-pose-producer';
const RELAY_ENVELOPE = 'bodyarcade.body-input.v1';

/** True when body-signal traffic is seen within listenMs. */
export function listenForTraffic(channelName: string, listenMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const bc = new BroadcastChannel(channelName);
    const finish = (heard: boolean) => {
      if (done) return;
      done = true;
      bc.close();
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(heard);
    };
    bc.onmessage = () => finish(true);
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as { t?: string } | null;
      if (d && d.t === RELAY_ENVELOPE) finish(true);
    };
    window.addEventListener('message', onMsg);
    const timer = setTimeout(() => finish(false), listenMs);
  });
}

/** Holds the producer lock until release() — resolves null if unavailable. */
async function acquireLock(): Promise<(() => void) | null> {
  if (!('locks' in navigator)) return null;
  return new Promise((resolve) => {
    let releaseHeld: (() => void) | null = null;
    const held = new Promise<void>((res) => {
      releaseHeld = res;
    });
    void navigator.locks
      .request(PRODUCER_LOCK, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return; // someone else is producing
        }
        resolve(releaseHeld);
        return held; // hold until released
      })
      .catch(() => resolve(null));
  });
}

export async function electProducer(
  mode: ElectionMode,
  channelName: string,
  listenMs = 700,
): Promise<ProducerElection> {
  if (mode === 'off') return { role: 'producer', release: () => {} };

  if (mode === 'strict') {
    const heard = await listenForTraffic(channelName, listenMs);
    if (heard) return { role: 'external', release: () => {} };
    const release = await acquireLock();
    if (release === null && 'locks' in navigator) {
      // lock held elsewhere (a producer that exists but is momentarily quiet)
      return { role: 'external', release: () => {} };
    }
    let released = false;
    return {
      role: 'producer',
      release: () => {
        if (released) return;
        released = true;
        release?.();
      },
    };
  }

  // 'claim': take the lock when free so strict producers yield to us, but
  // proceed as producer regardless (pre-extraction multi-tab app behavior).
  const release = await acquireLock();
  let released = false;
  return {
    role: 'producer',
    release: () => {
      if (released) return;
      released = true;
      release?.();
    },
  };
}
