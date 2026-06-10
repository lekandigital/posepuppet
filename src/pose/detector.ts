// PoseLandmarker wrapper: GPU delegate with CPU/WASM fallback, VIDEO mode,
// one detection per presented video frame via requestVideoFrameCallback
// (rAF fallback). All assets load same-origin; nothing touches the network.

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame } from './types';

export type ModelVariant = 'full' | 'lite';

export interface PoseDetector {
  start(video: HTMLVideoElement, onFrame: (frame: PoseFrame | null) => void): void;
  stop(): void;
  setModel(variant: ModelVariant): Promise<void>;
  poseFps(): number;
  droppedFrames(): number;
  delegate(): 'GPU' | 'CPU';
}

async function buildLandmarker(variant: ModelVariant, delegate: 'GPU' | 'CPU') {
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `/models/pose_landmarker_${variant}.task`,
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function createDetector(variant: ModelVariant = 'full'): Promise<PoseDetector> {
  let delegate: 'GPU' | 'CPU' = 'GPU';
  let landmarker: PoseLandmarker;
  try {
    landmarker = await buildLandmarker(variant, 'GPU');
  } catch (err) {
    console.warn('pose: GPU delegate failed, falling back to CPU/WASM', err);
    delegate = 'CPU';
    landmarker = await buildLandmarker(variant, 'CPU');
  }

  let stopped = false;
  let currentVariant = variant;
  let video: HTMLVideoElement | null = null;
  let callback: ((frame: PoseFrame | null) => void) | null = null;

  // FPS over a rolling 1 s window.
  let fpsCount = 0;
  let fpsStart = performance.now();
  let fps = 0;

  let dropped = 0;
  let lastPresented = -1;
  let lastVideoTime = -1;
  let lastDetectTs = 0;

  function detectOnce(now: number, meta?: VideoFrameCallbackMetadata) {
    if (!video || !callback || video.readyState < 2) return;
    if (meta) {
      if (lastPresented >= 0) dropped += Math.max(0, meta.presentedFrames - lastPresented - 1);
      lastPresented = meta.presentedFrames;
    }
    const t = video.currentTime;
    if (t === lastVideoTime) return; // never more than once per video frame
    lastVideoTime = t;

    // detectForVideo timestamps must be strictly monotonic.
    const ts = Math.max(now, lastDetectTs + 0.001);
    lastDetectTs = ts;
    const result = landmarker.detectForVideo(video, ts);

    fpsCount++;
    const elapsed = now - fpsStart;
    if (elapsed >= 1000) {
      fps = (fpsCount * 1000) / elapsed;
      fpsCount = 0;
      fpsStart = now;
    }

    if (result.landmarks.length > 0) {
      callback({
        norm: result.landmarks[0],
        world: result.worldLandmarks[0],
        videoTimeMs: t * 1000,
        wallTimeMs: now,
      });
    } else {
      callback(null);
    }
  }

  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  function scheduleLoop() {
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
      if (v === currentVariant) return;
      const next = await buildLandmarker(v, delegate);
      const old = landmarker;
      landmarker = next;
      currentVariant = v;
      old.close();
    },
    poseFps: () => fps,
    droppedFrames: () => dropped,
    delegate: () => delegate,
  };
}
