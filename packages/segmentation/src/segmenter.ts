// Person segmenter: MediaPipe ImageSegmenter (selfie model, Apache-2.0,
// Google — same family as the pose/hand landmarkers, recorded in
// ASSETS.md) wrapped the way pose-runtime wraps its landmarkers: VIDEO
// mode, GPU delegate with CPU/WASM fallback, same-origin assets, one
// segmentation per presented video frame via requestVideoFrameCallback
// with a rate cap. The video is downscaled into a small work canvas
// BEFORE inference (the reduced-resolution knob) so mask readback stays a
// few tens of kilobytes. Output: MaskBuffer's smoothed low-res alpha
// canvas. Nothing here touches the network.

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { MaskBuffer, type MaskStats } from './maskBuffer';

export interface SegmenterAssets {
  wasmBase?: string; // default '/mediapipe-wasm'
  modelsBase?: string; // default '/models'
}

export interface SegmenterOptions extends SegmenterAssets {
  /** 'landscape' (144×256 input, webcam-shaped) or 'square' (256×256) */
  model?: 'landscape' | 'square';
  /** inference input width in px; height follows the video aspect */
  workingWidth?: number;
  /** cap segmentations per second; 0 = every presented frame */
  maxHz?: number;
  /** spike/tests: skip the GPU attempt */
  forceDelegate?: 'GPU' | 'CPU';
}

export interface PersonSegmenter {
  start(video: HTMLVideoElement): void;
  stop(): void;
  close(): void;
  /** smoothed low-res person mask (white, alpha = person) */
  readonly mask: HTMLCanvasElement;
  /** wall time of the last ingested mask; 0 before the first */
  lastMaskAt(): number;
  /** EMA of the gap between ingested masks (ms); 0 before two masks.
   *  Freshness gates key off this so a slow-but-live segmenter (weak
   *  machine) is distinguished from a stalled one. */
  avgIntervalMs(): number;
  setMaxHz(hz: number): void;
  setWorkingWidth(w: number): void;
  segFps(): number;
  /** rolling mean full-pipeline cost (downscale+inference+readback+smooth) */
  latencyMs(): number;
  maskStats(): MaskStats;
  delegate(): 'GPU' | 'CPU';
}

const MODEL_FILE = {
  landscape: 'selfie_segmenter_landscape.tflite',
  square: 'selfie_segmenter.tflite',
};

async function build(
  model: 'landscape' | 'square',
  delegate: 'GPU' | 'CPU',
  assets: SegmenterAssets,
): Promise<ImageSegmenter> {
  const fileset = await FilesetResolver.forVisionTasks(assets.wasmBase ?? '/mediapipe-wasm');
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${assets.modelsBase ?? '/models'}/${MODEL_FILE[model]}`,
      delegate,
    },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

export async function createSegmenter(opts: SegmenterOptions = {}): Promise<PersonSegmenter> {
  const model = opts.model ?? 'landscape';
  let delegate: 'GPU' | 'CPU' = opts.forceDelegate ?? 'GPU';
  let segmenter: ImageSegmenter;
  try {
    segmenter = await build(model, delegate, opts);
  } catch (err) {
    if (opts.forceDelegate) throw err;
    console.warn('segmentation: GPU delegate failed, falling back to CPU/WASM', err);
    delegate = 'CPU';
    segmenter = await build(model, delegate, opts);
  }

  // selfie models label ['background', 'person']; be defensive about it
  const labels = segmenter.getLabels();
  const personIdx = Math.max(labels.indexOf('person'), labels.length === 1 ? 0 : labels.length - 1);

  const buffer = new MaskBuffer();
  const work = document.createElement('canvas');
  const workCtx = work.getContext('2d', { willReadFrequently: false })!;
  let workingWidth = opts.workingWidth ?? 256;

  let video: HTMLVideoElement | null = null;
  let stopped = true;
  let closed = false;
  let minIntervalMs = opts.maxHz ? 1000 / opts.maxHz : 0;
  let lastVideoTime = -1;
  let lastSegWall = 0;
  let lastSegTs = 0;
  let lastMaskWall = 0;

  let fpsCount = 0;
  let fpsStart = performance.now();
  let fps = 0;
  let latEma = 0;
  let intEma = 0;

  function segmentOnce(now: number): void {
    if (!video || video.readyState < 2 || closed) return;
    if (minIntervalMs > 0 && now - lastSegWall < minIntervalMs - 1) return;
    const t = video.currentTime;
    if (t === lastVideoTime) return; // once per presented frame at most
    lastVideoTime = t;
    lastSegWall = now;

    const t0 = performance.now();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const w = workingWidth;
    const h = Math.max(2, Math.round((w * vh) / vw) & ~1);
    if (work.width !== w || work.height !== h) {
      work.width = w;
      work.height = h;
    }
    workCtx.drawImage(video, 0, 0, w, h);

    const ts = Math.max(now, lastSegTs + 0.001); // strictly monotonic
    lastSegTs = ts;
    segmenter.segmentForVideo(work, ts, (result) => {
      const m = result.confidenceMasks?.[personIdx];
      if (m) {
        buffer.ingest(m.getAsFloat32Array(), m.width, m.height);
        if (lastMaskWall) {
          const gap = now - lastMaskWall;
          intEma = intEma ? intEma * 0.8 + gap * 0.2 : gap;
        }
        lastMaskWall = now;
      }
    });

    const cost = performance.now() - t0;
    latEma = latEma ? latEma * 0.9 + cost * 0.1 : cost;
    fpsCount++;
    const elapsed = now - fpsStart;
    if (elapsed >= 1000) {
      fps = (fpsCount * 1000) / elapsed;
      fpsCount = 0;
      fpsStart = now;
    }
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
      segmenter.close();
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
