/// <reference lib="webworker" />
// Worker-side pose detection: the full model costs ~30–50 ms per detection
// (measured on the rowing page) — on a game's main thread that halves the
// frame rate, so game runtimes detect HERE and ship results back. This is
// in-page runtime infrastructure: landmark messages between this worker
// and its owning runtime never touch a cross-page transport (the privacy
// boundary is BroadcastChannel/postMessage-to-windows, enforced elsewhere).

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

interface InitMsg {
  t: 'init';
  variant: 'full' | 'lite';
  wasmBase: string;
  modelsBase: string;
  /** 'CPU' avoids GPU-process contention with the game's own rendering
   *  (wasm SIMD runs entirely inside this worker). Default 'GPU'. */
  preferDelegate?: 'GPU' | 'CPU';
}
interface DetectMsg {
  t: 'detect';
  bitmap: ImageBitmap;
  ts: number; // monotonic detector timestamp
  videoTimeMs: number;
  wallTimeMs: number;
}
interface SetModelMsg {
  t: 'setModel';
  variant: 'full' | 'lite';
}
type InMsg = InitMsg | DetectMsg | SetModelMsg;

let landmarker: PoseLandmarker | null = null;
let delegate: 'GPU' | 'CPU' = 'GPU';
let wasmBase = '/mediapipe-wasm';
let modelsBase = '/models';

async function build(variant: 'full' | 'lite', d: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${modelsBase}/pose_landmarker_${variant}.task`,
      delegate: d,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  void (async () => {
    const m = ev.data;
    if (m.t === 'init') {
      wasmBase = m.wasmBase;
      modelsBase = m.modelsBase;
      const first = m.preferDelegate ?? 'GPU';
      try {
        delegate = first;
        landmarker = await build(m.variant, first);
      } catch (err) {
        console.warn(`pose(worker): ${first} delegate failed, falling back`, err);
        delegate = first === 'GPU' ? 'CPU' : 'GPU';
        landmarker = await build(m.variant, delegate);
      }
      self.postMessage({ t: 'ready', delegate });
    } else if (m.t === 'detect') {
      if (!landmarker) {
        m.bitmap.close();
        self.postMessage({ t: 'result', empty: true, videoTimeMs: m.videoTimeMs, wallTimeMs: m.wallTimeMs });
        return;
      }
      const result = landmarker.detectForVideo(m.bitmap, m.ts);
      m.bitmap.close();
      if (result.landmarks.length > 0) {
        self.postMessage({
          t: 'result',
          empty: false,
          norm: result.landmarks[0],
          world: result.worldLandmarks[0],
          videoTimeMs: m.videoTimeMs,
          wallTimeMs: m.wallTimeMs,
        });
      } else {
        self.postMessage({ t: 'result', empty: true, videoTimeMs: m.videoTimeMs, wallTimeMs: m.wallTimeMs });
      }
    } else if (m.t === 'setModel') {
      const old = landmarker;
      landmarker = null; // drop detects while swapping
      const next = await build(m.variant, delegate);
      old?.close();
      landmarker = next;
      self.postMessage({ t: 'modelSet', variant: m.variant });
    }
  })();
};
