// Person-segmentation worker (V7) — a CLASSIC worker served verbatim from
// public/ on purpose: module workers under the Vite dev server rewrite
// MediaPipe's internal dynamic import of the wasm loader (`?import` on a
// public asset), which never resolves; in a classic worker MediaPipe uses
// importScripts and no bundler touches anything, so dev and build behave
// identically. Protocol (see packages/segmentation/src/workerSegmenter.ts):
//   in : {t:'init', model, wasmBase, modelsBase, delegate}
//        {t:'segment', bitmap: ImageBitmap, ts}
//   out: {t:'ready', delegate}
//        {t:'mask', empty} | {t:'mask', conf: Float32Array, w, h} [transfer]
// The CPU/XNNPACK delegate is the measured default (see PLAN.md spike
// table): faster than the GPU delegate for this tiny model and free of
// GPU-process contention. Masks never leave this page.

/* eslint-disable no-undef */
'use strict';

// CJS shim so importScripts can load the tasks-vision CJS bundle
self.exports = {};
self.module = { exports: self.exports };

let vision = null;
let segmenter = null;
let personIdx = 0;
let delegate = 'CPU';

const MODEL_FILE = {
  landscape: 'selfie_segmenter_landscape.tflite',
  square: 'selfie_segmenter.tflite',
};

async function build(msg, d) {
  const fileset = await vision.FilesetResolver.forVisionTasks(msg.wasmBase);
  return vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: msg.modelsBase + '/' + MODEL_FILE[msg.model], delegate: d },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.t === 'init') {
    (async () => {
      importScripts(m.wasmBase + '/vision_bundle.cjs');
      vision = self.module.exports;
      try {
        delegate = m.delegate;
        segmenter = await build(m, m.delegate);
      } catch (err) {
        console.warn('segmentation(worker): ' + m.delegate + ' delegate failed, falling back', err);
        delegate = m.delegate === 'CPU' ? 'GPU' : 'CPU';
        segmenter = await build(m, delegate);
      }
      const labels = segmenter.getLabels();
      personIdx = Math.max(labels.indexOf('person'), labels.length === 1 ? 0 : labels.length - 1);
      self.postMessage({ t: 'ready', delegate });
    })().catch((err) => {
      console.error('segmentation(worker): init failed', err);
      self.postMessage({ t: 'initfail', error: String(err) });
    });
  } else if (m.t === 'segment') {
    if (!segmenter) {
      m.bitmap.close();
      self.postMessage({ t: 'mask', empty: true });
      return;
    }
    const w = m.bitmap.width;
    const h = m.bitmap.height;
    segmenter.segmentForVideo(m.bitmap, m.ts, (result) => {
      const mask = result.confidenceMasks && result.confidenceMasks[personIdx];
      if (!mask) {
        self.postMessage({ t: 'mask', empty: true });
        return;
      }
      // getAsFloat32Array returns a view over the WASM heap — copy it
      // into a detachable buffer before transferring
      const conf = mask.getAsFloat32Array().slice();
      self.postMessage({ t: 'mask', empty: false, conf, w: mask.width || w, h: mask.height || h }, [
        conf.buffer,
      ]);
    });
    m.bitmap.close();
  }
};
