// @bodyarcade/pose-runtime — public surface.
//
// Composed runtime (games, HUD, the Full App):
//   createPoseRuntime — camera ownership + lifecycle, detection, PPC,
//   body-input emission, preview state, producer election.
//
// Building blocks (the Full App's hand mode, eval rig, unit tests):
//   detectors, continuity, mirroring, smoothing, landmark indices.
//
// Boundary law: raw landmarks never leave this package on a transport —
// BroadcastChannel/postMessage carry BodySignal; the HUD receives
// PreviewFrame (quantized 2D render state) in-process only.

export type { LandmarkPoint, PoseFrame } from './types';
export { LM, CONNECTIONS, MIRROR_PAIRS } from './indices';
export { mirrorNorm, mirrorWorld } from './mirror';
export { OneEuro } from './oneEuro';
export { LandmarkSmoother } from './smoothing';

export { createDetector } from './detector';
export type { DetectorAssets, ModelVariant, PoseDetector } from './detector';
export { createWorkerDetector } from './workerDetector';

export { createHandDetector, HLM, HAND_CONNECTIONS } from './handDetector';
export type { HandDetector, HandFrame, HandPoint } from './handDetector';

export {
  PoseContinuity, PPC, PPC_GROUP_MEMBERS, PPC_GROUP_OF,
} from './continuity';
export type { PpcGroupInfo, PpcGroupName, PpcState } from './continuity';

export { startCamera, startVideoFile, stopStream } from './camera';

export { electProducer, listenForTraffic, PRODUCER_LOCK } from './election';
export type { ElectionMode, ProducerElection } from './election';

export {
  buildPreviewFrame, createPreviewFrame, PREVIEW_HIDDEN, PREVIEW_POINTS, PREVIEW_Q,
} from './preview';
export type { PreviewFrame } from './preview';

export { createPoseRuntime, __resetPoseRuntimeSingleton } from './runtime';
export type {
  FrameInterceptor, PoseRuntime, PoseRuntimeOptions, RuntimeFrame, RuntimeState,
} from './runtime';
