// Segmentation perf spike (V7 P0): runs the createSegmenter pipeline over
// the fake webcam across a config matrix (model × working width ×
// delegate) and reports per-frame cost, achievable rate, mask coverage
// and edge flicker. Results land on window.__SEG_SPIKE for the driver
// (eval/seg-spike.mjs). Spike-only page — not part of the app shell.

import { createSegmenter } from '@bodyarcade/segmentation';

interface SpikeResult {
  model: 'landscape' | 'square';
  workingWidth: number;
  delegate: 'GPU' | 'CPU';
  requestedDelegate: 'GPU' | 'CPU';
  frames: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  segFps: number;
  coverageMean: number;
  flickerMean: number;
}

declare global {
  interface Window {
    __SEG_SPIKE: {
      done: boolean;
      error?: string;
      results: SpikeResult[];
      cutoutPng?: string;
    };
  }
}

window.__SEG_SPIKE = { done: false, results: [] };
const out = document.getElementById('out')!;
const log = (s: string) => {
  out.textContent += `\n${s}`;
};

async function measure(
  video: HTMLVideoElement,
  model: 'landscape' | 'square',
  workingWidth: number,
  requestedDelegate: 'GPU' | 'CPU',
  frames = 90,
): Promise<SpikeResult | null> {
  let seg;
  try {
    seg = await createSegmenter({
      model,
      workingWidth,
      maxHz: 0,
      forceDelegate: requestedDelegate === 'CPU' ? 'CPU' : undefined,
    });
  } catch (err) {
    log(`  ${model}/${workingWidth}/${requestedDelegate}: init failed (${String(err).slice(0, 80)})`);
    return null;
  }
  const lat: number[] = [];
  const cov: number[] = [];
  const flick: number[] = [];
  seg.start(video);
  const t0 = performance.now();
  let lastAt = 0;
  // sample stats each time a new mask lands, until `frames` masks or 15 s
  await new Promise<void>((resolve) => {
    const poll = setInterval(() => {
      const at = seg.lastMaskAt();
      if (at && at !== lastAt) {
        lastAt = at;
        lat.push(seg.latencyMs());
        const s = seg.maskStats();
        cov.push(s.coverage);
        flick.push(s.flicker);
      }
      if (lat.length >= frames || performance.now() - t0 > 15_000) {
        clearInterval(poll);
        resolve();
      }
    }, 5);
  });
  const fps = seg.segFps();
  const delegate = seg.delegate();
  seg.stop();
  seg.close();
  if (!lat.length) return null;
  const sorted = [...lat].sort((a, b) => a - b);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    model,
    workingWidth,
    delegate,
    requestedDelegate,
    frames: lat.length,
    avgLatencyMs: +mean(lat).toFixed(2),
    p95LatencyMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    segFps: +fps.toFixed(1),
    coverageMean: +mean(cov).toFixed(3),
    flickerMean: +mean(flick).toFixed(4),
  };
}

/** one visual sanity artifact: cutout of the person over a dark backdrop */
async function cutoutSnapshot(video: HTMLVideoElement): Promise<string> {
  const seg = await createSegmenter({ model: 'landscape', workingWidth: 256, maxHz: 0 });
  seg.start(video);
  await new Promise<void>((resolve) => {
    const poll = setInterval(() => {
      if (seg.lastMaskAt()) {
        clearInterval(poll);
        resolve();
      }
    }, 30);
    setTimeout(() => {
      clearInterval(poll);
      resolve();
    }, 8000);
  });
  // let the EMA settle over a few masks
  await new Promise((r) => setTimeout(r, 600));
  const view = document.getElementById('view') as HTMLCanvasElement;
  const ctx = view.getContext('2d')!;
  ctx.fillStyle = '#101725';
  ctx.fillRect(0, 0, view.width, view.height);
  const person = document.createElement('canvas');
  person.width = view.width;
  person.height = view.height;
  const pctx = person.getContext('2d')!;
  pctx.drawImage(video, 0, 0, person.width, person.height);
  pctx.globalCompositeOperation = 'destination-in';
  pctx.filter = 'blur(1.5px)';
  pctx.drawImage(seg.mask, 0, 0, person.width, person.height);
  ctx.drawImage(person, 0, 0);
  seg.stop();
  seg.close();
  return view.toDataURL('image/png');
}

async function main(): Promise<void> {
  const video = document.getElementById('cam') as HTMLVideoElement;
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();
  await new Promise<void>((r) => {
    if (video.videoWidth) r();
    else video.onloadedmetadata = () => r();
  });
  log(`camera ${video.videoWidth}×${video.videoHeight}`);

  const results: SpikeResult[] = [];
  const matrix: ['landscape' | 'square', number, 'GPU' | 'CPU'][] = [
    ['landscape', 256, 'GPU'],
    ['landscape', 160, 'GPU'],
    ['square', 256, 'GPU'],
    ['landscape', 256, 'CPU'],
    ['landscape', 160, 'CPU'],
  ];
  for (const [model, w, d] of matrix) {
    log(`measuring ${model} @${w}px ${d}…`);
    const r = await measure(video, model, w, d);
    if (r) {
      results.push(r);
      log(
        `  → delegate=${r.delegate} avg=${r.avgLatencyMs}ms p95=${r.p95LatencyMs}ms ` +
          `rate=${r.segFps}/s cover=${r.coverageMean} flicker=${r.flickerMean}`,
      );
    }
  }
  const cutoutPng = await cutoutSnapshot(video);
  window.__SEG_SPIKE = { done: true, results, cutoutPng };
  log('done.');
}

main().catch((err) => {
  window.__SEG_SPIKE = { done: true, error: String(err), results: [] };
  log(`FATAL ${String(err)}`);
});
