// Main-thread proxy for worker-side segmentation: same PersonSegmenter
// interface as the inline segmenter. One segmentation in flight at a
// time; frames arriving while busy simply are not segmented (the mask
// consumer treats a stale mask as missing, so a stalled worker can never
// freeze the performer). Downscaling happens inside createImageBitmap
// (resizeWidth/Height) so the transfer stays tens of kilobytes.
//
// The worker itself is a CLASSIC worker served verbatim from
// public/seg-worker.js — module workers under the Vite dev server break
// MediaPipe's dynamic wasm-loader import (rewritten `?import` on a public
// asset never resolves); the classic worker's importScripts path is
// untouched by any bundler, so dev and build behave identically. Falls
// back to the inline segmenter (CPU first — the spike's winner) if the
// worker can't come up.

import { createSegmenter, type PersonSegmenter, type SegmenterOptions } from './segmenter';
import { MaskBuffer } from './maskBuffer';

const WORKER_INIT_TIMEOUT_MS = 20_000;

async function inlineFallback(opts: SegmenterOptions): Promise<PersonSegmenter> {
  if (opts.forceDelegate) return createSegmenter(opts);
  try {
    return await createSegmenter({ ...opts, forceDelegate: 'CPU' });
  } catch {
    return createSegmenter(opts); // GPU-first auto path as the last resort
  }
}

export async function createWorkerSegmenter(opts: SegmenterOptions = {}): Promise<PersonSegmenter> {
  let worker: Worker;
  try {
    worker = new Worker('/seg-worker.js');
  } catch (err) {
    console.warn('segmentation: worker unavailable, segmenting on the main thread', err);
    return inlineFallback(opts);
  }

  const delegate = await new Promise<'GPU' | 'CPU' | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), WORKER_INIT_TIMEOUT_MS);
    worker.onmessage = (ev: MessageEvent<{ t: string; delegate?: 'GPU' | 'CPU' }>) => {
      if (ev.data.t === 'ready') {
        clearTimeout(timer);
        resolve(ev.data.delegate ?? 'CPU');
      } else if (ev.data.t === 'initfail') {
        clearTimeout(timer);
        resolve(null);
      }
    };
    worker.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    worker.postMessage({
      t: 'init',
      model: opts.model ?? 'landscape',
      wasmBase: opts.wasmBase ?? '/mediapipe-wasm',
      modelsBase: opts.modelsBase ?? '/models',
      // CPU by default: the spike measured XNNPACK faster than the GPU
      // delegate for this model, with none of the GPU-process contention
      delegate: opts.forceDelegate ?? 'CPU',
    });
  });
  if (delegate === null) {
    console.warn('segmentation: worker failed to initialize, main-thread fallback');
    worker.terminate();
    return inlineFallback(opts);
  }

  const buffer = new MaskBuffer();
  let workingWidth = opts.workingWidth ?? 256;
  let minIntervalMs = opts.maxHz ? 1000 / opts.maxHz : 0;

  let video: HTMLVideoElement | null = null;
  let stopped = true;
  let closed = false;
  let busy = false;
  let lastVideoTime = -1;
  let lastSegWall = 0;
  let lastSegTs = 0;
  let lastMaskWall = 0;
  let sentAt = 0;

  let fpsCount = 0;
  let fpsStart = performance.now();
  let fps = 0;
  let latEma = 0;
  let intEma = 0;

  worker.onmessage = (
    ev: MessageEvent<{ t: string; empty?: boolean; conf?: Float32Array; w?: number; h?: number }>,
  ) => {
    const m = ev.data;
    if (m.t !== 'mask') return;
    busy = false;
    if (stopped || m.empty || !m.conf) return;
    buffer.ingest(m.conf, m.w!, m.h!);
    const now = performance.now();
    if (lastMaskWall) {
      const gap = now - lastMaskWall;
      intEma = intEma ? intEma * 0.8 + gap * 0.2 : gap;
    }
    lastMaskWall = now;
    const cost = now - sentAt;
    latEma = latEma ? latEma * 0.9 + cost * 0.1 : cost;
    fpsCount++;
    const elapsed = now - fpsStart;
    if (elapsed >= 1000) {
      fps = (fpsCount * 1000) / elapsed;
      fpsCount = 0;
      fpsStart = now;
    }
  };

  function segmentOnce(now: number): void {
    if (!video || video.readyState < 2 || busy || closed) return;
    if (minIntervalMs > 0 && now - lastSegWall < minIntervalMs - 1) return;
    const t = video.currentTime;
    if (t === lastVideoTime) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    lastVideoTime = t;
    lastSegWall = now;
    const ts = Math.max(now, lastSegTs + 0.001);
    lastSegTs = ts;
    busy = true;
    sentAt = performance.now();
    const w = workingWidth;
    const h = Math.max(2, Math.round((w * vh) / vw) & ~1);
    createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
      .then((bitmap) => {
        if (stopped || closed) {
          bitmap.close();
          busy = false;
          return;
        }
        worker.postMessage({ t: 'segment', bitmap, ts }, [bitmap]);
      })
      .catch(() => {
        busy = false;
      });
  }

  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  function scheduleLoop(): void {
    if (stopped || !video) return;
    if (hasRVFC) {
      video.requestVideoFrameCallback((now) => {
        segmentOnce(now);
        scheduleLoop();
      });
    } else {
      requestAnimationFrame((now) => {
        segmentOnce(now);
        scheduleLoop();
      });
    }
  }

  return {
    get mask() {
      return buffer.canvas;
    },
    start(v) {
      video = v;
      if (!stopped) return;
      stopped = false;
      scheduleLoop();
    },
    stop() {
      stopped = true;
      lastMaskWall = 0;
      intEma = 0;
      buffer.reset();
    },
    close() {
      stopped = true;
      closed = true;
      worker.terminate();
    },
    lastMaskAt: () => lastMaskWall,
    avgIntervalMs: () => intEma,
    setMaxHz(hz) {
      minIntervalMs = hz > 0 ? 1000 / hz : 0;
    },
    setWorkingWidth(w) {
      workingWidth = Math.max(96, Math.min(512, Math.round(w)));
    },
    segFps: () => fps,
    latencyMs: () => latEma,
    maskStats: () => buffer.stats(),
    delegate: () => delegate,
  };
}
