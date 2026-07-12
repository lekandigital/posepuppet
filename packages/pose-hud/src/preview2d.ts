// The HUD preview figure: a 2D-canvas glowing wireframe in the x-ray
// language — deliberately NOT a VRM/three.js render (games ship their own
// three versions; a second GL context per page is exactly the GPU cost the
// budget forbids). Draws from PreviewFrame (quantized 2D render state) and
// degrades under load:
//   tier 0  glow skeleton  @30 Hz
//   tier 1  flat skeleton  @15 Hz
//   tier 2  joint dots     @10 Hz
//   tier 3  no drawing     (text state only)
// Auto-degradation watches the page's own rAF cadence; a sustained
// sub-45 fps page sheds one tier at a time and recovers slowly.

import {
  CONNECTIONS,
  PPC_GROUP_OF,
  PREVIEW_HIDDEN,
  PREVIEW_Q,
  type PoseRuntime,
  type PreviewFrame,
} from '@bodyarcade/pose-runtime';

const TIER_HZ = [30, 15, 10, 0] as const;
const DEGRADE_BELOW_FPS = 45;
const DEGRADE_AFTER_MS = 2500;
const RECOVER_ABOVE_FPS = 55;
const RECOVER_AFTER_MS = 5000;

const STATE_COLOR: Record<string, string> = {
  VISIBLE: '63, 224, 255', // cyan — live signal
  PREDICTED: '157, 123, 255', // violet — PPC carrying the limb
  RELAXED: '102, 116, 143', // dim ink — decayed to rest
};

export interface PreviewRenderer {
  /** Advance one page frame (call from the HUD's rAF loop). */
  tick(nowMs: number): void;
  tier(): number;
  /** Pins the tier (tests, explicit budget); pass null to restore auto. */
  setTier(t: number | null): void;
  stats(): { tier: number; drawMsAvg: number; pageFps: number };
  dispose(): void;
}

export function createPreviewRenderer(
  canvas: HTMLCanvasElement,
  runtime: PoseRuntime,
  onTierChange?: (tier: number) => void,
): PreviewRenderer {
  const ctx = canvas.getContext('2d')!;
  let tier = 0;
  let pinned: number | null = null;
  let lastDraw = 0;
  let drawMsAvg = 0;

  // page-fps watcher (EMA over rAF gaps observed by the HUD loop)
  let lastTick = 0;
  let pageFps = 60;
  let lowSince = 0;
  let highSince = 0;

  function setTierInternal(t: number): void {
    const next = Math.max(0, Math.min(3, t));
    if (next === tier) return;
    tier = next;
    canvas.dataset.tier = String(tier);
    onTierChange?.(tier);
  }
  canvas.dataset.tier = '0';

  function autoTier(now: number): void {
    if (pinned !== null) return;
    if (pageFps < DEGRADE_BELOW_FPS) {
      highSince = 0;
      if (!lowSince) lowSince = now;
      else if (now - lowSince > DEGRADE_AFTER_MS) {
        setTierInternal(tier + 1);
        lowSince = 0;
      }
    } else if (pageFps > RECOVER_ABOVE_FPS) {
      lowSince = 0;
      if (!highSince) highSince = now;
      else if (now - highSince > RECOVER_AFTER_MS) {
        setTierInternal(tier - 1);
        highSince = 0;
      }
    } else {
      lowSince = 0;
      highSince = 0;
    }
  }

  function draw(f: PreviewFrame | null, now: number): void {
    const t0 = performance.now();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!f) return;
    const stale = now - f.t > 1200;
    // fit the [0,1]² frame into the canvas, preserving aspect (contain)
    const s = Math.min(w, h);
    const ox = (w - s) / 2;
    const oy = (h - s) / 2;
    const px = (q: number) => ox + (q / PREVIEW_Q) * s;
    const py = (q: number) => oy + (q / PREVIEW_Q) * s;
    const alpha = (stale ? 0.35 : 0.55) + 0.45 * f.confidence;
    const lw = Math.max(1.5, s * 0.012);
    ctx.lineCap = 'round';

    if (tier <= 1) {
      for (const [a, b] of CONNECTIONS) {
        const ax = f.pts[a * 2];
        const ay = f.pts[a * 2 + 1];
        const bx = f.pts[b * 2];
        const by = f.pts[b * 2 + 1];
        if (ax === PREVIEW_HIDDEN || bx === PREVIEW_HIDDEN) continue;
        const group = PPC_GROUP_OF[a] ?? PPC_GROUP_OF[b];
        const state = (group && f.groups[group]) || 'VISIBLE';
        const rgb = STATE_COLOR[state] ?? STATE_COLOR.VISIBLE;
        ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(2)})`;
        ctx.lineWidth = lw;
        if (tier === 0) {
          ctx.shadowColor = `rgba(${rgb}, 0.8)`;
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.moveTo(px(ax), py(ay));
        ctx.lineTo(px(bx), py(by));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    if (tier <= 2) {
      for (let i = 0; i < 33; i++) {
        const x = f.pts[i * 2];
        const y = f.pts[i * 2 + 1];
        if (x === PREVIEW_HIDDEN) continue;
        const group = PPC_GROUP_OF[i];
        const state = (group && f.groups[group]) || 'VISIBLE';
        const rgb = STATE_COLOR[state] ?? STATE_COLOR.VISIBLE;
        ctx.fillStyle = tier === 2 ? `rgba(${rgb}, ${alpha.toFixed(2)})` : 'rgba(233, 241, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(px(x), py(y), tier === 2 ? lw * 1.1 : lw * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawMsAvg = drawMsAvg * 0.9 + (performance.now() - t0) * 0.1;
  }

  return {
    tick(now) {
      if (lastTick) {
        const gap = now - lastTick;
        if (gap > 0 && gap < 500) pageFps = pageFps * 0.92 + (1000 / gap) * 0.08;
      }
      lastTick = now;
      autoTier(now);
      const hz = TIER_HZ[tier];
      if (hz === 0) {
        if (lastDraw !== -1) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          lastDraw = -1;
        }
        return;
      }
      if (lastDraw !== -1 && now - lastDraw < 1000 / hz) return;
      lastDraw = now;
      draw(runtime.preview.latest(), now);
    },
    tier: () => tier,
    setTier(t) {
      pinned = t;
      // unpinning restarts from the top tier; auto re-degrades if the page
      // is genuinely under load
      setTierInternal(t ?? 0);
    },
    stats: () => ({ tier, drawMsAvg, pageFps }),
    dispose() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
