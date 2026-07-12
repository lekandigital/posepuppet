// Main-thread proxy for worker-side detection (game pages): implements the
// same PoseDetector interface. One detection in flight at a time — frames
// arriving while busy simply aren't detections; the rate cap and PPC
// handle the gaps. Falls back to the main-thread detector if the worker
// can't come up (older browsers without worker WebGL).

import { createDetector, type DetectorAssets, type ModelVariant, type PoseDetector } from './detector';
import type { PoseFrame } from './types';

const WORKER_INIT_TIMEOUT_MS = 20_000;

export async function createWorkerDetector(
  variant: ModelVariant = 'full',
  assets: DetectorAssets = {},
  preferDelegate?: 'GPU' | 'CPU',
): Promise<PoseDetector> {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./detectWorker.ts', import.meta.url), { type: 'module' });
  } catch (err) {
    console.warn('pose: module worker unavailable, detecting on the main thread', err);
    return createDetector(variant, assets);
  }

  const delegate = await new Promise<'GPU' | 'CPU' | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), WORKER_INIT_TIMEOUT_MS);
    worker.onmessage = (ev: MessageEvent<{ t: string; delegate?: 'GPU' | 'CPU' }>) => {
      if (ev.data.t === 'ready') {
        clearTimeout(timer);
        resolve(ev.data.delegate ?? 'GPU');
      }
    };
    worker.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    worker.postMessage({
      t: 'init',
      variant,
      wasmBase: assets.wasmBase ?? '/mediapipe-wasm',
      modelsBase: assets.modelsBase ?? '/models',
      preferDelegate,
    });
  });
  if (delegate === null) {
    console.warn('pose: worker detector failed to initialize, main-thread fallback');
    worker.terminate();
    return createDetector(variant, assets);
  }

  let stopped = false;
  let busy = false;
  let video: HTMLVideoElement | null = null;
  let callback: ((frame: PoseFrame | null) => void) | null = null;

  let fpsCount = 0;
  let fpsStart = performance.now();
  let fps = 0;
  let dropped = 0;
  let lastPresented = -1;
  let lastVideoTime = -1;
  let lastDetectTs = 0;
  let lastDetectWall = 0;
  let minIntervalMs = 0;

  worker.onmessage = (
    ev: MessageEvent<{
      t: string;
      empty?: boolean;
      norm?: PoseFrame['norm'];
      world?: PoseFrame['world'];
      videoTimeMs?: number;
      wallTimeMs?: number;
    }>,
  ) => {
    const m = ev.data;
    if (m.t !== 'result') return;
    busy = false;
    if (stopped || !callback) return;
    const now = performance.now();
    fpsCount++;
    if (now - fpsStart >= 1000) {
      fps = (fpsCount * 1000) / (now - fpsStart);
      fpsCount = 0;
      fpsStart = now;
    }
    if (m.empty) callback(null);
    else {
      callback({
        norm: m.norm!,
        world: m.world!,
        videoTimeMs: m.videoTimeMs!,
        wallTimeMs: m.wallTimeMs!,
      });
    }
  };

  function detectOnce(now: number, meta?: VideoFrameCallbackMetadata): void {
    if (!video || !callback || video.readyState < 2 || busy) return;
    if (meta) {
      if (lastPresented >= 0) dropped += Math.max(0, meta.presentedFrames - lastPresented - 1);
      lastPresented = meta.presentedFrames;
    }
    if (minIntervalMs > 0 && now - lastDetectWall < minIntervalMs - 1) return;
    const t = video.currentTime;
    if (t === lastVideoTime) return;
    lastVideoTime = t;
    lastDetectWall = now;
    const ts = Math.max(now, lastDetectTs + 0.001);
    lastDetectTs = ts;
    busy = true;
    createImageBitmap(video)
      .then((bitmap) => {
        if (stopped) {
          bitmap.close();
          busy = false;
          return;
        }
        worker.postMessage(
          { t: 'detect', bitmap, ts, videoTimeMs: t * 1000, wallTimeMs: now },
          [bitmap],
        );
      })
      .catch(() => {
        busy = false;
      });
  }

  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  function scheduleLoop(): void {
    if (stopped || !video) return;
    if (hasRVFC) {
      video.requestVideoFrameCallback((now, meta) => {
        detectOnce(now, meta);
        scheduleLoop();
      });
    } else {
      requestAnimationFrame((now) => {
        detectOnce(now);
        scheduleLoop();
      });
    }
  }

  return {
    start(v, onFrame) {
      video = v;
      callback = onFrame;
      stopped = false;
      scheduleLoop();
    },
    stop() {
      stopped = true;
    },
    async setModel(v) {
      await new Promise<void>((resolve) => {
        const prev = worker.onmessage;
        worker.onmessage = (ev: MessageEvent<{ t: string }>) => {
          if (ev.data.t === 'modelSet') {
            worker.onmessage = prev;
            resolve();
          } else {
            prev?.call(worker, ev as MessageEvent);
          }
        };
        worker.postMessage({ t: 'setModel', variant: v });
      });
    },
    setMaxHz(hz) {
      minIntervalMs = hz > 0 ? 1000 / hz : 0;
    },
    poseFps: () => fps,
    droppedFrames: () => dropped,
    delegate: () => delegate,
  };
}
