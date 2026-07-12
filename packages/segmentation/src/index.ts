// @bodyarcade/segmentation — public surface.
//
// createSegmenter: local person segmentation (MediaPipe selfie model)
// producing a temporally smoothed low-res person mask for the recording
// presentation layer. MaskBuffer is exported for unit tests and the
// mask-quality eval. All inference is in-browser; nothing leaves the page.

export { createSegmenter } from './segmenter';
export { createWorkerSegmenter } from './workerSegmenter';
export type { PersonSegmenter, SegmenterAssets, SegmenterOptions } from './segmenter';
export { MaskBuffer } from './maskBuffer';
export type { MaskStats } from './maskBuffer';
