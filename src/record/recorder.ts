// Side-by-side clip recorder: composites the (mirrored) video + skeleton
// overlay and the stage canvas into one offscreen canvas, then
// captureStream(30) → MediaRecorder → downloadable .webm. Everything stays
// local; the blob never leaves the machine.

import { config } from '../config';

const OUT_H = 720;
const PANE_W = 800; // two panes side by side → 1600×720
const FPS = 30;

export interface Recorder {
  start(maxSec?: number): void;
  stop(): void;
  readonly recording: boolean;
}

interface Deps {
  video: HTMLVideoElement;
  overlay: HTMLCanvasElement;
  stage: HTMLCanvasElement;
  onState?: (recording: boolean, elapsedSec: number) => void;
}

function pickMime(): string {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/** contain-fit `sw×sh` into a pane at `px` and draw via cb. */
function fitPane(
  ctx: CanvasRenderingContext2D,
  px: number,
  sw: number,
  sh: number,
  mirror: boolean,
  draw: (x: number, y: number, w: number, h: number) => void,
): void {
  if (!sw || !sh) return;
  const scale = Math.min(PANE_W / sw, OUT_H / sh);
  const w = sw * scale;
  const h = sh * scale;
  const x = px + (PANE_W - w) / 2;
  const y = (OUT_H - h) / 2;
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

export function createRecorder(deps: Deps): Recorder {
  const canvas = document.createElement('canvas');
  canvas.width = PANE_W * 2;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d')!;

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let raf = 0;
  let startedAt = 0;
  let maxMs = 0;

  function composite(): void {
    ctx.fillStyle = '#0e0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { video, overlay, stage } = deps;
    const m = config.mirror;
    fitPane(ctx, 0, video.videoWidth, video.videoHeight, m, (x, y, w, h) =>
      ctx.drawImage(video, x, y, w, h),
    );
    fitPane(ctx, 0, overlay.width, overlay.height, m, (x, y, w, h) =>
      ctx.drawImage(overlay, x, y, w, h),
    );
    fitPane(ctx, PANE_W, stage.width, stage.height, false, (x, y, w, h) =>
      ctx.drawImage(stage, x, y, w, h),
    );
  }

  function loop(): void {
    composite();
    const elapsed = performance.now() - startedAt;
    deps.onState?.(true, elapsed / 1000);
    if (elapsed >= maxMs) {
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
    if (blob.size > 0) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `posepuppet-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }
    deps.onState?.(false, 0);
  }

  const api: Recorder = {
    get recording() {
      return mediaRecorder?.state === 'recording';
    },
    start(maxSec = 15) {
      if (this.recording) return;
      maxMs = maxSec * 1000;
      chunks = [];
      mediaRecorder = new MediaRecorder(canvas.captureStream(FPS), {
        mimeType: pickMime() || undefined,
        videoBitsPerSecond: 8_000_000,
      });
      mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mediaRecorder.onstop = finish;
      composite();
      mediaRecorder.start();
      startedAt = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      if (!this.recording) return;
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
  const idle = '● rec 15s';
  btn.textContent = idle;
  btn.title = 'record a 15 s side-by-side .webm (stays on this machine)';
  btn.onclick = () => (recorder.recording ? recorder.stop() : recorder.start(15));
  btn.dataset.idleLabel = idle;
  document.getElementById('controls')!.prepend(btn);
}

export function updateRecordButton(recording: boolean, elapsedSec: number): void {
  const btn = document.getElementById('record-btn') as HTMLButtonElement | null;
  if (!btn) return;
  btn.classList.toggle('recording', recording);
  btn.textContent = recording ? `■ ${elapsedSec.toFixed(0)}s` : (btn.dataset.idleLabel ?? '● rec 15s');
}
