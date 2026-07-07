// PosePuppet → @bodyarcade/body-input adapter: feeds mirrored,
// PRE-smoothing landmarks into the protocol core (the package runs its own
// filter bank) and publishes the derived signals on both transports. This
// file is the only place PosePuppet touches the package with landmarks —
// everything downstream of the sinks is derived signals only.

import {
  createBodyInputCore, createBroadcastSink, createInPageChannel, mountTuner,
  type BodyInputCore, type BodySignal, type BodySignalSource,
} from '@bodyarcade/body-input';
import type { LandmarkPoint } from '../pose/types';

export interface BodyInputAdapter {
  /** Wire into the pose callback with mirrored norm/world (pre-smoothing). */
  onPoseFrame(world: LandmarkPoint[] | null, norm: LandmarkPoint[] | null, tsMs: number): void;
  core: BodyInputCore;
  /** in-page signal source (game modes in this tab subscribe here) */
  source: BodySignalSource;
  toggleTuner(host: HTMLElement): boolean;
  lastSignal(): BodySignal | null;
}

export function createBodyInputAdapter(): BodyInputAdapter {
  const core = createBodyInputCore();
  const inPage = createInPageChannel();
  // cross-page transport (Flight etc.); validation already ran in-page
  const broadcast = createBroadcastSink(undefined, { validate: false });

  let last: BodySignal | null = null;
  let latencyMs: number | null = null;
  let tuner: { unmount(): void } | null = null;

  return {
    onPoseFrame(world, norm, tsMs) {
      const signal = core.push({ tsMs, world, norm });
      last = signal;
      inPage.sink.publish(signal);
      broadcast.publish(signal);
      // live frames stamp tsMs from performance.now(), so this is the real
      // pose-frame → emitted-signal latency (fixture replays: not meaningful)
      latencyMs = performance.now() - tsMs;
    },
    core,
    source: inPage.source,
    toggleTuner(host: HTMLElement): boolean {
      if (tuner) {
        tuner.unmount();
        tuner = null;
        return false;
      }
      tuner = mountTuner(host, { core, source: inPage.source, getLatencyMs: () => latencyMs });
      return true;
    },
    lastSignal: () => last,
  };
}
