// Mask-quality eval page (V7): IoU of the shipped segmenter against
// hand-labeled person polygons on fixture frames, plus the smoothed
// edge-flicker rate over ~8 s of playback through the real MaskBuffer
// pipeline. Driven by eval/seg-quality.mjs; results on window.__SEG_EVAL.
// The fixture mp4 is served same-origin by the dev server; nothing here
// touches the network beyond this origin.

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { createSegmenter } from '@bodyarcade/segmentation';

interface LabelFrame {
  tMs: number;
  polygon: [number, number][];
}
interface LabelFile {
  fixture: string;
  frames: LabelFrame[];
}

interface FrameResult {
  tMs: number;
  iou: number;
  maskCoverage: number;
  labelCoverage: number;
}

declare global {
  interface Window {
    __SEG_EVAL: {
      done: boolean;
      error?: string;
      fixture?: string;
      frames: FrameResult[];
      meanIoU?: number;
      flickerMean?: number;
      flickerSamples?: number;
      vizPng?: string;
    };
  }
}

window.__SEG_EVAL = { done: false, frames: [] };
const out = document.getElementById('out')!;
const log = (s: string) => {
  out.textContent += `\n${s}`;
};

const WORK_W = 256;

function seek(video: HTMLVideoElement, tMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`seek timeout ${tMs}`)), 10_000);
    video.onseeked = () => {
      clearTimeout(t);
      resolve();
    };
    video.currentTime = tMs / 1000;
  });
}

function rasterizePolygon(poly: [number, number][], w: number, h: number): Uint8Array {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.beginPath();
  poly.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
  g.closePath();
  g.fill();
  const d = g.getImageData(0, 0, w, h).data;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return bin;
}

async function main(): Promise<void> {
  const fixture = new URLSearchParams(location.search).get('fixture') ?? 'fullbody';
  const labels = (await (await fetch(`/eval/seg-labels/${fixture}.json`)).json()) as LabelFile;
  const video = document.getElementById('vid') as HTMLVideoElement;
  video.src = `/fixtures/${fixture}.mp4`;
  await new Promise<void>((r, j) => {
    video.onloadeddata = () => r();
    video.onerror = () => j(new Error(`cannot load /fixtures/${fixture}.mp4`));
  });
  log(`fixture ${fixture}: ${video.videoWidth}×${video.videoHeight}, ${labels.frames.length} labeled frames`);

  // ── IoU on labeled stills (IMAGE mode = no timestamp bookkeeping) ──
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
  const seg = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/models/selfie_segmenter_landscape.tflite', delegate: 'CPU' },
    runningMode: 'IMAGE',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  const segLabels = seg.getLabels();
  const personIdx = Math.max(segLabels.indexOf('person'), segLabels.length === 1 ? 0 : segLabels.length - 1);

  const work = document.createElement('canvas');
  const workCtx = work.getContext('2d')!;
  const results: FrameResult[] = [];
  let vizPng: string | undefined;

  for (const f of labels.frames) {
    await seek(video, f.tMs);
    const w = WORK_W;
    const h = Math.round((w * video.videoHeight) / video.videoWidth) & ~1;
    work.width = w;
    work.height = h;
    workCtx.drawImage(video, 0, 0, w, h);
    let conf: Float32Array | null = null;
    seg.segment(work, (res) => {
      const m = res.confidenceMasks?.[personIdx];
      if (m) conf = m.getAsFloat32Array().slice();
    });
    if (!conf) {
      log(`  t=${f.tMs}ms: no mask`);
      results.push({ tMs: f.tMs, iou: 0, maskCoverage: 0, labelCoverage: 0 });
      continue;
    }
    const confArr: Float32Array = conf;
    const label = rasterizePolygon(f.polygon, w, h);
    let inter = 0;
    let union = 0;
    let maskCount = 0;
    let labelCount = 0;
    for (let i = 0; i < w * h; i++) {
      const p = confArr[i] > 0.5 ? 1 : 0;
      const l = label[i];
      inter += p & l;
      union += p | l;
      maskCount += p;
      labelCount += l;
    }
    const iou = union ? inter / union : 0;
    results.push({
      tMs: f.tMs,
      iou: +iou.toFixed(3),
      maskCoverage: +(maskCount / (w * h)).toFixed(3),
      labelCoverage: +(labelCount / (w * h)).toFixed(3),
    });
    log(`  t=${f.tMs}ms: IoU ${iou.toFixed(3)} (mask ${maskCount}, label ${labelCount})`);

    // one visual artifact from the first frame: mask (cyan) vs label (violet)
    if (!vizPng) {
      const viz = document.getElementById('viz') as HTMLCanvasElement;
      viz.width = w;
      viz.height = h;
      const g = viz.getContext('2d')!;
      g.drawImage(video, 0, 0, w, h);
      const img = g.getImageData(0, 0, w, h);
      for (let i = 0; i < w * h; i++) {
        const p = confArr[i] > 0.5;
        const l = label[i] === 1;
        if (p && l) {
          img.data[i * 4 + 1] = Math.min(255, img.data[i * 4 + 1] + 80); // agree: green tint
        } else if (p) {
          img.data[i * 4] = 60; img.data[i * 4 + 1] = 200; img.data[i * 4 + 2] = 255; // mask only: cyan
        } else if (l) {
          img.data[i * 4] = 157; img.data[i * 4 + 1] = 123; img.data[i * 4 + 2] = 255; // label only: violet
        }
      }
      g.putImageData(img, 0, 0);
      vizPng = viz.toDataURL('image/png');
    }
  }
  seg.close();

  // ── smoothed edge flicker over real playback (the shipped pipeline) ──
  const liveSeg = await createSegmenter({ model: 'landscape', workingWidth: WORK_W, maxHz: 24, forceDelegate: 'CPU' });
  video.currentTime = 0;
  await video.play();
  liveSeg.start(video);
  const flick: number[] = [];
  let lastAt = 0;
  await new Promise<void>((resolve) => {
    const t0 = performance.now();
    const poll = setInterval(() => {
      const at = liveSeg.lastMaskAt();
      if (at && at !== lastAt) {
        lastAt = at;
        flick.push(liveSeg.maskStats().flicker);
      }
      if (performance.now() - t0 > 8000 || flick.length >= 160) {
        clearInterval(poll);
        resolve();
      }
    }, 10);
  });
  video.pause();
  liveSeg.stop();
  liveSeg.close();
  // discard the EMA warm-up (first few masks converge from a cold buffer)
  const settled = flick.slice(5);
  const flickerMean = settled.length ? settled.reduce((a, b) => a + b, 0) / settled.length : 0;
  log(`flicker: mean ${flickerMean.toFixed(4)} over ${settled.length} masks`);

  const meanIoU = results.length ? results.reduce((a, r) => a + r.iou, 0) / results.length : 0;
  window.__SEG_EVAL = {
    done: true,
    fixture,
    frames: results,
    meanIoU: +meanIoU.toFixed(3),
    flickerMean: +flickerMean.toFixed(4),
    flickerSamples: settled.length,
    vizPng,
  };
  log(`done: mean IoU ${meanIoU.toFixed(3)}`);
}

main().catch((err) => {
  window.__SEG_EVAL = { done: true, error: String(err), frames: [] };
  log(`FATAL ${String(err)}`);
});
