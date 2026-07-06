// Composite clip recorder: camera(+skeleton) and stage composed into one
// canvas → captureStream(30) → MediaRecorder → downloadable .webm. Two
// aspect presets (16:9 side-by-side, 9:16 stacked vertical — how clips
// actually travel), optional produced-take packaging: ~0.5 s title
// stinger in, end card out carrying the privacy line, corner badge, and
// a subtle grain/vignette grade so clips match the interface atmosphere.
// Everything stays local; the blob never leaves the machine.

import { config } from '../config';

const FPS = 30;

export type AspectPreset = '16:9' | '9:16';

interface PaneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  w: number;
  h: number;
  camera: PaneRect;
  stage: PaneRect;
}

const LAYOUTS: Record<AspectPreset, Layout> = {
  '16:9': {
    w: 1920,
    h: 1080,
    camera: { x: 0, y: 0, w: 768, h: 1080 },
    stage: { x: 768, y: 0, w: 1152, h: 1080 },
  },
  '9:16': {
    // vertical: camera above, avatar below — the stage gets the bigger half
    w: 1080,
    h: 1920,
    camera: { x: 0, y: 0, w: 1080, h: 810 },
    stage: { x: 0, y: 810, w: 1080, h: 1110 },
  },
};

const STINGER_MS = 550;
const ENDCARD_MS = 1500;

export interface Recorder {
  start(maxSec?: number, takeName?: string): void;
  stop(): void;
  readonly recording: boolean;
}

interface Deps {
  video: HTMLVideoElement;
  overlay: HTMLCanvasElement;
  stage: HTMLCanvasElement;
  onState?: (recording: boolean, elapsedSec: number) => void;
  onSaved?: (sizeBytes: number) => void;
}

function pickMime(): string {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/** contain-fit `sw×sh` into a pane rect and draw via cb. */
function fitPane(
  ctx: CanvasRenderingContext2D,
  pane: PaneRect,
  sw: number,
  sh: number,
  mirror: boolean,
  draw: (x: number, y: number, w: number, h: number) => void,
): void {
  if (!sw || !sh) return;
  const scale = Math.min(pane.w / sw, pane.h / sh);
  const w = sw * scale;
  const h = sh * scale;
  const x = pane.x + (pane.w - w) / 2;
  const y = pane.y + (pane.h - h) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    draw(0, 0, w, h);
  } else {
    draw(x, y, w, h);
  }
  ctx.restore();
}

/** pre-rendered grain tile for the optional grade */
function makeGrainTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 10 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createRecorder(deps: Deps): Recorder {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const grain = makeGrainTile();

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let raf = 0;
  let startedAt = 0;
  let maxMs = 0;
  let layout = LAYOUTS['16:9'];
  let takeName = '';
  let phase: 'stinger' | 'live' | 'endcard' = 'live';
  let endcardAt = 0;

  function drawChrome(): void {
    if (config.recBadge) {
      ctx.font = '500 18px "JetBrains Mono Variable", monospace';
      ctx.fillStyle = 'rgba(102, 116, 143, 0.85)';
      ctx.textAlign = 'right';
      ctx.fillText('POSEPUPPET · ALL LOCAL', canvas.width - 22, canvas.height - 20);
    }
    if (config.recGrade) {
      // vignette
      const g = ctx.createRadialGradient(
        canvas.width / 2, canvas.height * 0.35, canvas.height * 0.4,
        canvas.width / 2, canvas.height * 0.5, canvas.height * 0.95,
      );
      g.addColorStop(0, 'rgba(2,4,10,0)');
      g.addColorStop(1, 'rgba(2,4,10,0.32)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // grain
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ctx.createPattern(grain, 'repeat')!;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  function drawStinger(t: number): void {
    // t 0..1 — dark card, serif mark fades in
    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const a = Math.min(1, t * 2.5);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `420 ${Math.round(canvas.width * 0.045)}px "Fraunces Variable", Georgia, serif`;
    ctx.fillStyle = '#e9f1ff';
    ctx.fillText('PosePuppet', canvas.width / 2, canvas.height / 2 - 8);
    if (takeName) {
      ctx.font = `500 ${Math.round(canvas.width * 0.014)}px "JetBrains Mono Variable", monospace`;
      ctx.fillStyle = '#66748f';
      ctx.fillText(takeName.toUpperCase(), canvas.width / 2, canvas.height / 2 + Math.round(canvas.width * 0.03));
    }
    ctx.globalAlpha = 1;
  }

  function drawEndcard(t: number): void {
    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.min(1, t * 3);
    ctx.textAlign = 'center';
    ctx.font = `420 ${Math.round(canvas.width * 0.038)}px "Fraunces Variable", Georgia, serif`;
    ctx.fillStyle = '#e9f1ff';
    ctx.fillText('PosePuppet', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = `500 ${Math.round(canvas.width * 0.013)}px "JetBrains Mono Variable", monospace`;
    ctx.fillStyle = '#c8ffdf';
    ctx.fillText(
      'ALL INFERENCE LOCAL — NOTHING UPLOADED',
      canvas.width / 2,
      canvas.height / 2 + Math.round(canvas.width * 0.028),
    );
    ctx.globalAlpha = 1;
  }

  function composite(): void {
    const elapsed = performance.now() - startedAt;
    if (phase === 'stinger') {
      if (elapsed >= STINGER_MS) phase = 'live';
      else {
        drawStinger(elapsed / STINGER_MS);
        return;
      }
    }
    if (phase === 'endcard') {
      drawEndcard((performance.now() - endcardAt) / ENDCARD_MS);
      return;
    }
    ctx.fillStyle = '#0e0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { video, overlay, stage } = deps;
    const m = config.mirror;
    fitPane(ctx, layout.camera, video.videoWidth, video.videoHeight, m, (x, y, w, h) =>
      ctx.drawImage(video, x, y, w, h),
    );
    fitPane(ctx, layout.camera, overlay.width, overlay.height, m, (x, y, w, h) =>
      ctx.drawImage(overlay, x, y, w, h),
    );
    fitPane(ctx, layout.stage, stage.width, stage.height, false, (x, y, w, h) =>
      ctx.drawImage(stage, x, y, w, h),
    );
    drawChrome();
  }

  function loop(): void {
    composite();
    const elapsed = performance.now() - startedAt;
    deps.onState?.(true, elapsed / 1000);
    if (phase === 'endcard') {
      if (performance.now() - endcardAt >= ENDCARD_MS) {
        cancelAnimationFrame(raf);
        mediaRecorder!.stop();
        return;
      }
    } else if (elapsed >= maxMs) {
      api.stop();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function finish(): void {
    const type = mediaRecorder?.mimeType || 'video/webm';
    const blob = new Blob(chunks, { type });
    chunks = [];
    window.__PP.lastRecording = { size: blob.size, type };
    document.body.classList.remove('recording');
    if (blob.size > 0) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const aspectTag = config.recAspect === '9:16' ? '-vertical' : '';
      a.download = `posepuppet${aspectTag}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      deps.onSaved?.(blob.size);
    }
    deps.onState?.(false, 0);
  }

  const api: Recorder = {
    get recording() {
      return mediaRecorder?.state === 'recording';
    },
    start(maxSec = 15, name = '') {
      if (this.recording) return;
      layout = LAYOUTS[config.recAspect];
      canvas.width = layout.w;
      canvas.height = layout.h;
      takeName = name;
      maxMs = maxSec * 1000;
      chunks = [];
      phase = config.recPackage ? 'stinger' : 'live';
      mediaRecorder = new MediaRecorder(canvas.captureStream(FPS), {
        mimeType: pickMime() || undefined,
        videoBitsPerSecond: 8_000_000,
      });
      mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mediaRecorder.onstop = finish;
      composite();
      mediaRecorder.start();
      startedAt = performance.now();
      document.body.classList.add('recording'); // chrome auto-hides (CSS)
      raf = requestAnimationFrame(loop);
    },
    stop() {
      if (!this.recording) return;
      if (config.recPackage && phase !== 'endcard') {
        phase = 'endcard';
        endcardAt = performance.now();
        return; // the loop stops the MediaRecorder after the end card
      }
      cancelAnimationFrame(raf);
      mediaRecorder!.stop();
    },
  };
  return api;
}

/** "● rec 15s" button in the top bar; click again to stop early. */
export function createRecordButton(recorder: Recorder): void {
  const btn = document.createElement('button');
  btn.id = 'record-btn';
  const idle = 'rec 15s';
  btn.textContent = idle;
  btn.title = 'record a 15 s composite .webm (stays on this machine)';
  btn.onclick = () => (recorder.recording ? recorder.stop() : recorder.start(15));
  btn.dataset.idleLabel = idle;
  document.getElementById('controls')!.prepend(btn);
}

export function updateRecordButton(recording: boolean, elapsedSec: number): void {
  const btn = document.getElementById('record-btn') as HTMLButtonElement | null;
  if (!btn) return;
  btn.classList.toggle('recording', recording);
  btn.textContent = recording ? `■ ${elapsedSec.toFixed(0)}s` : (btn.dataset.idleLabel ?? 'rec 15s');
}
