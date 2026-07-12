/// <reference lib="webworker" />
// Worker-side person segmentation. The spike (.local/seg-spike-gpu.json)
// measured the CPU/XNNPACK delegate FASTER than GPU for this tiny model
// (15.6 ms vs 74.7 ms avg @256px) with far better tails — the GPU
// delegate contends with the page's own GPU process, the same lesson V1
// learned with worker pose detection. So segmentation runs HERE, CPU
// delegate by default, and the main thread only pays bitmap creation and
// a transferable Float32Array per mask. Masks never leave this page.

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

interface InitMsg {
  t: 'init';
  model: 'landscape' | 'square';
  wasmBase: string;
  modelsBase: string;
  delegate: 'GPU' | 'CPU';
}
interface SegmentMsg {
  t: 'segment';
  bitmap: ImageBitmap;
  ts: number; // strictly monotonic detector timestamp
}
type InMsg = InitMsg | SegmentMsg;

const MODEL_FILE = {
  landscape: 'selfie_segmenter_landscape.tflite',
  square: 'selfie_segmenter.tflite',
};

let segmenter: ImageSegmenter | null = null;
let personIdx = 0;
let delegate: 'GPU' | 'CPU' = 'CPU';

async function build(m: InitMsg, d: 'GPU' | 'CPU'): Promise<ImageSegmenter> {
  const fileset = await FilesetResolver.forVisionTasks(m.wasmBase);
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${m.modelsBase}/${MODEL_FILE[m.model]}`, delegate: d },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  void (async () => {
    const m = ev.data;
    if (m.t === 'init') {
      try {
        delegate = m.delegate;
        segmenter = await build(m, m.delegate);
      } catch (err) {
        console.warn(`segmentation(worker): ${m.delegate} delegate failed, falling back`, err);
        delegate = m.delegate === 'CPU' ? 'GPU' : 'CPU';
        segmenter = await build(m, delegate);
      }
      const labels = segmenter.getLabels();
      personIdx = Math.max(labels.indexOf('person'), labels.length === 1 ? 0 : labels.length - 1);
      self.postMessage({ t: 'ready', delegate });
    } else if (m.t === 'segment') {
      if (!segmenter) {
        m.bitmap.close();
        self.postMessage({ t: 'mask', empty: true });
        return;
      }
      const w = m.bitmap.width;
      const h = m.bitmap.height;
      segmenter.segmentForVideo(m.bitmap, m.ts, (result) => {
        const mask = result.confidenceMasks?.[personIdx];
        if (!mask) {
          self.postMessage({ t: 'mask', empty: true });
          return;
        }
        // getAsFloat32Array copies out of the MPMask, so the buffer is
        // ours to transfer
        const conf = mask.getAsFloat32Array();
        self.postMessage({ t: 'mask', empty: false, conf, w: mask.width || w, h: mask.height || h }, [
          conf.buffer,
        ]);
      });
      m.bitmap.close();
    }
  })();
};
