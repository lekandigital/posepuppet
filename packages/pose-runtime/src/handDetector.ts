// HandLandmarker wrapper for hand-only mode: 21 landmarks per hand, VIDEO
// mode, GPU delegate with CPU/WASM fallback — same shape as the pose
// detector. One detection per presented video frame via rVFC. All assets
// load same-origin; nothing touches the network.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { DetectorAssets } from './detector';

export interface HandPoint {
  x: number;
  y: number;
  z: number;
}

/** One tracked hand per frame: normalized (image) + world (m) landmarks. */
export interface HandFrame {
  norm: HandPoint[];
  world: HandPoint[];
  handedness: 'Left' | 'Right';
  wallTimeMs: number;
}

/** MediaPipe hand landmark indices (21). */
export const HLM = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexDip: 7,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleDip: 11,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringDip: 15,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyDip: 19,
  pinkyTip: 20,
} as const;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export interface HandDetector {
  start(video: HTMLVideoElement, onFrame: (frame: HandFrame | null) => void): void;
  stop(): void;
  handFps(): number;
  delegate(): 'GPU' | 'CPU';
  dispose(): void;
}

async function buildLandmarker(delegate: 'GPU' | 'CPU', assets: DetectorAssets) {
  const fileset = await FilesetResolver.forVisionTasks(assets.wasmBase ?? '/mediapipe-wasm');
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${assets.modelsBase ?? '/models'}/hand_landmarker.task`,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function createHandDetector(assets: DetectorAssets = {}): Promise<HandDetector> {
  let delegate: 'GPU' | 'CPU' = 'GPU';
  let landmarker: HandLandmarker;
  try {
    landmarker = await buildLandmarker('GPU', assets);
  } catch (err) {
    console.warn('hand: GPU delegate failed, falling back to CPU/WASM', err);
    delegate = 'CPU';
    landmarker = await buildLandmarker('CPU', assets);
  }

  let stopped = false;
  let rvfcHandle = 0;
  let videoEl: HTMLVideoElement | null = null;
  let fpsCount = 0;
  let fpsT0 = performance.now();
  let fps = 0;
  let lastVideoTime = -1;

  const api: HandDetector = {
    start(video, onFrame) {
      stopped = false;
      videoEl = video;
      const detectFrame = () => {
        if (stopped) return;
        const now = performance.now();
        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          const res = landmarker.detectForVideo(video, now);
          fpsCount++;
          if (now - fpsT0 >= 1000) {
            fps = (fpsCount * 1000) / (now - fpsT0);
            fpsCount = 0;
            fpsT0 = now;
          }
          if (res.landmarks.length > 0) {
            onFrame({
              norm: res.landmarks[0],
              world: res.worldLandmarks[0],
              handedness: (res.handedness[0]?.[0]?.categoryName as 'Left' | 'Right') ?? 'Right',
              wallTimeMs: now,
            });
          } else {
            onFrame(null);
          }
        }
        schedule();
      };
      const schedule = () => {
        if (stopped) return;
        if ('requestVideoFrameCallback' in video) {
          rvfcHandle = video.requestVideoFrameCallback(detectFrame);
        } else {
          rvfcHandle = requestAnimationFrame(detectFrame) as unknown as number;
        }
      };
      schedule();
    },
    stop() {
      stopped = true;
      if (videoEl && 'cancelVideoFrameCallback' in videoEl) {
        videoEl.cancelVideoFrameCallback(rvfcHandle);
      }
    },
    handFps: () => fps,
    delegate: () => delegate,
    dispose() {
      api.stop();
      landmarker.close();
    },
  };
  return api;
}
