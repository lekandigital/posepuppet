// Recorder/replayer. Two tape kinds:
//  - InputTape: the raw frames fed to the core. PRIVACY: contains landmark
//    traces of a real person — a local dev/eval artifact only; recorded
//    tapes are gitignored exactly like fixtures, never a transport message.
//  - SignalTape: the emitted BodySignal stream (safe to share; canonical
//    JSON of it is what the determinism test compares byte-for-byte).

import { createBodyInputCore } from './pipeline';
import { canonicalStreamJSON } from './schema';
import type { BodyInputConfig, BodyInputFrame, BodySignal, DeepPartial } from './types';
import type { BodySignalSink, BodySignalSource } from './transport';

export interface InputTape {
  kind: 'body-input-tape';
  v: 1;
  frames: BodyInputFrame[];
}

export interface SignalTape {
  kind: 'body-signal-tape';
  v: 1;
  signals: BodySignal[];
}

export function createInputRecorder(): {
  push(frame: BodyInputFrame): void;
  tape(): InputTape;
} {
  const frames: BodyInputFrame[] = [];
  return {
    push(frame) {
      frames.push({
        tsMs: frame.tsMs,
        world: frame.world ? frame.world.map((p) => ({ ...p })) : null,
        norm: frame.norm ? frame.norm.map((p) => ({ ...p })) : null,
      });
    },
    tape() {
      return { kind: 'body-input-tape', v: 1, frames };
    },
  };
}

/** Run a tape through a FRESH core. Same tape + same config → the same
 *  signal stream, byte-for-byte (see canonicalStreamJSON). */
export function runTape(tape: InputTape, config?: DeepPartial<BodyInputConfig>): BodySignal[] {
  const core = createBodyInputCore(config);
  return tape.frames.map((f) => core.push(f));
}

export function createSignalRecorder(source: BodySignalSource): {
  stop(): SignalTape;
} {
  const signals: BodySignal[] = [];
  const unsub = source.subscribe((s) => signals.push(s));
  return {
    stop() {
      unsub();
      return { kind: 'body-signal-tape', v: 1, signals };
    },
  };
}

/** Synchronously replay a signal tape into a sink (deterministic; pacing is
 *  the consumer's business — schedule calls to this from your own loop). */
export function replayInto(tape: SignalTape, sink: BodySignalSink): void {
  for (const s of tape.signals) sink.publish(s);
}

export function signalTapeJSON(tape: SignalTape): string {
  return `{"kind":"body-signal-tape","v":1,"signals":${canonicalStreamJSON(tape.signals)}}`;
}
