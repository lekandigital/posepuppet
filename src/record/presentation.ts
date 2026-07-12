// Performer presentation layer (V7): person segmentation turns the camera
// pane from "webcam evidence" into a produced shot. Six treatments —
// raw · blur · cutout · silhouette · chip (stage full-frame, performer in
// a picture-in-picture body chip) · stage (the signature: performer
// cutout ON STAGE beside the avatar) — all driven by one low-res smoothed
// mask from @bodyarcade/segmentation (worker, CPU delegate; see PLAN.md
// spike table). Degradation is a contract, not a hope: a tier controller
// watches render fps and steps 24 Hz/256px → 12 Hz/160px → off; a mask
// older than 400 ms counts as missing, so every mode always has a safe
// raw fallback and the performer can never freeze. Segmentation is as
// local as everything else here — masks never leave the page.

import type { PersonSegmenter } from '@bodyarcade/segmentation';

export type PresentMode = 'raw' | 'blur' | 'cutout' | 'silhouette' | 'chip' | 'stage';

export const PRESENT_MODES: PresentMode[] = ['raw', 'blur', 'cutout', 'silhouette', 'chip', 'stage'];

/** take-bar / engineering-view labels, mono voice */
export const PRESENT_LABEL: Record<PresentMode, string> = {
  raw: 'RAW',
  blur: 'BLUR',
  cutout: 'CUT',
  silhouette: 'SIL',
  chip: 'CHIP',
  stage: 'STAGE',
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** mask staleness gate: the floor of the freshness window. The gate's job
 *  is to catch a STALLED segmenter, not a slow-but-live one — on weak
 *  machines masks arrive slowly and honestly, so the window widens with
 *  the measured mask interval (never past MASK_FRESH_CAP_MS). On real
 *  hardware the interval is ~40 ms and this floor is what applies. */
const MASK_FRESH_MS = 400;
const MASK_FRESH_CAP_MS = 2000;
/** effective-mode debounce so layouts don't flap on brief mask gaps */
const EFFECTIVE_DEBOUNCE_MS = 600;

const TIERS = [
  { maxHz: 24, width: 256 },
  { maxHz: 12, width: 160 },
] as const;

export interface TierOptions {
  floorFps: number;
  dropAfterMs: number;
  cooldownMs: number;
  recoverFps: number;
  recoverAfterMs: number;
}

const TIER_DEFAULTS: TierOptions = {
  floorFps: 45,
  dropAfterMs: 2000,
  cooldownMs: 20_000,
  recoverFps: 52,
  recoverAfterMs: 4000,
};

/** Render-fps → segmentation tier state machine. Pure and injectable so
 *  the unit suite can drive it with synthetic clocks: drops fast (2 s
 *  under the floor), recovers slowly (20 s cooldown, one tier at a time,
 *  only after 4 s comfortably above it) — no oscillation. */
export class TierController {
  tier: 0 | 1 | 2 = 0;
  // -1 = "no window open" (0 is a valid clock reading, not a sentinel)
  private belowSince = -1;
  private aboveSince = -1;
  private lastChange = -Infinity;

  constructor(private opts: TierOptions = TIER_DEFAULTS) {}

  sample(fps: number, now: number): 0 | 1 | 2 {
    if (fps < this.opts.floorFps) {
      this.aboveSince = -1;
      if (this.belowSince < 0) this.belowSince = now;
      if (this.tier < 2 && now - this.belowSince >= this.opts.dropAfterMs) {
        this.tier++;
        this.lastChange = now;
        this.belowSince = -1;
      }
    } else {
      this.belowSince = -1;
      if (fps >= this.opts.recoverFps) {
        if (this.aboveSince < 0) this.aboveSince = now;
        if (
          this.tier > 0 &&
          now - this.aboveSince >= this.opts.recoverAfterMs &&
          now - this.lastChange >= this.opts.cooldownMs
        ) {
          this.tier--;
          this.lastChange = now;
          this.aboveSince = -1;
        }
      } else {
        this.aboveSince = -1;
      }
    }
    return this.tier;
  }

  reset(): void {
    this.tier = 0;
    this.belowSince = -1;
    this.aboveSince = -1;
    this.lastChange = -Infinity;
  }
}

export interface PresentationStats {
  requested: PresentMode;
  effective: PresentMode;
  tier: 0 | 1 | 2;
  segFps: number;
  segLatencyMs: number;
  maskAgeMs: number;
  flicker: number;
  coverage: number;
  delegate: string;
}

export interface PresentationDeps {
  video: HTMLVideoElement;
  /** skeleton overlay canvas, camera-space (same aspect as the video) */
  overlay: HTMLCanvasElement;
  renderFps(): number;
  coach(eyebrow: string, text: string): void;
  /** lazy segmenter factory (worker CPU-delegate in the app; injectable
   *  in tests) */
  createSeg(): Promise<PersonSegmenter>;
  autoTier(): boolean;
}

export interface Presentation {
  setMode(m: PresentMode): void;
  /** shot-scoped preset; null restores the user's mode */
  setOverride(m: PresentMode | null, skeleton?: boolean): void;
  setSkeleton(on: boolean): void;
  requested(): PresentMode;
  /** the mode compositing actually uses this frame (mask-ready + tier) */
  effective(): PresentMode;
  /** camera-pane treatment (recorder pane + live preview) */
  drawPane(ctx: CanvasRenderingContext2D, pane: Rect, mirror: boolean, forceMode?: PresentMode): void;
  /** performer chip over the full composite (chip mode) */
  drawChip(ctx: CanvasRenderingContext2D, w: number, h: number, mirror: boolean): void;
  /** performer cutout on the stage floor beside the avatar (stage mode) */
  drawStagePerson(ctx: CanvasRenderingContext2D, stagePane: Rect, mirror: boolean): void;
  tick(now: number): void;
  stats(): PresentationStats;
}

/** contain-fit source dims into a rect */
function fit(pane: Rect, sw: number, sh: number): Rect {
  const s = Math.min(pane.w / sw, pane.h / sh);
  const w = sw * s;
  const h = sh * s;
  return { x: pane.x + (pane.w - w) / 2, y: pane.y + (pane.h - h) / 2, w, h };
}

export function createPresentation(deps: PresentationDeps): Presentation {
  let userMode: PresentMode = 'raw';
  let overrideMode: PresentMode | null = null;
  let userSkeleton = false;
  let overrideSkeleton: boolean | undefined;

  let seg: PersonSegmenter | null = null;
  let segStarting = false;
  const tierCtl = new TierController();
  let lastTier: 0 | 1 | 2 = 0;
  let lastSampleAt = 0;
  let effectiveStable: PresentMode = 'raw';
  let effectiveCandidate: PresentMode = 'raw';
  let candidateSince = 0;
  let coachedPause = false;

  // person cutout working canvas (video-res capped, feathered alpha)
  const person = document.createElement('canvas');
  const personCtx = person.getContext('2d')!;
  // silhouette tint canvas
  const sil = document.createElement('canvas');
  const silCtx = sil.getContext('2d')!;
  // tiny canvas for the cheap downscale-upscale background blur
  const tiny = document.createElement('canvas');
  const tinyCtx = tiny.getContext('2d')!;
  let personBuiltFor = -1;

  const requestedMode = (): PresentMode => overrideMode ?? userMode;
  const skeletonOn = (): boolean => overrideSkeleton ?? userSkeleton;

  function maskFresh(): boolean {
    if (!seg || !seg.lastMaskAt()) return false;
    const window = Math.min(
      MASK_FRESH_CAP_MS,
      Math.max(MASK_FRESH_MS, seg.avgIntervalMs() * 2.5),
    );
    return performance.now() - seg.lastMaskAt() < window;
  }

  function ensureSeg(): void {
    if (seg) {
      applyTier(tierCtl.tier);
      seg.start(deps.video);
      return;
    }
    if (segStarting) return;
    segStarting = true;
    deps
      .createSeg()
      .then((s) => {
        seg = s;
        segStarting = false;
        // mode may have gone back to raw while the worker was booting
        if (requestedMode() !== 'raw') {
          applyTier(tierCtl.tier);
          seg.start(deps.video);
        }
      })
      .catch((err) => {
        segStarting = false;
        console.warn('presentation: segmentation unavailable, staying raw', err);
        deps.coach('Presentation', 'Segmentation could not start on this machine — camera stays raw.');
      });
  }

  function applyTier(t: 0 | 1 | 2): void {
    if (!seg) return;
    if (t === 2) {
      seg.stop();
      return;
    }
    seg.setMaxHz(TIERS[t].maxHz);
    seg.setWorkingWidth(TIERS[t].width);
  }

  function syncLifecycle(): void {
    if (requestedMode() === 'raw') {
      seg?.stop();
      tierCtl.reset();
      lastTier = 0;
      coachedPause = false;
    } else {
      ensureSeg();
    }
  }

  /** build the feathered person cutout for this video frame (memoized) */
  function buildPerson(): boolean {
    if (!seg) return false;
    const v = deps.video;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return false;
    const key = v.currentTime * 1000 + seg.lastMaskAt() * 1e-7;
    if (key === personBuiltFor && person.width) return true;
    personBuiltFor = key;
    const scale = Math.min(1, 960 / vw);
    const pw = Math.round(vw * scale);
    const ph = Math.round(vh * scale);
    if (person.width !== pw || person.height !== ph) {
      person.width = pw;
      person.height = ph;
    }
    personCtx.save();
    personCtx.clearRect(0, 0, pw, ph);
    personCtx.drawImage(v, 0, 0, pw, ph);
    personCtx.globalCompositeOperation = 'destination-in';
    // feather scales with the mask upsample factor
    personCtx.filter = `blur(${Math.max(1, pw / 256).toFixed(1)}px)`;
    personCtx.drawImage(seg.mask, 0, 0, pw, ph);
    personCtx.restore();
    if (skeletonOn()) {
      // skeleton-ghost on the cutout: the tracked wireframe glows on the
      // body (not masked — joints may breathe past the cutout edge)
      personCtx.save();
      personCtx.globalCompositeOperation = 'lighter';
      personCtx.globalAlpha = 0.85;
      personCtx.drawImage(deps.overlay, 0, 0, pw, ph);
      personCtx.restore();
    }
    return true;
  }

  /** person bbox in person-canvas pixels (mask coords are normalized) */
  function personBbox(): Rect | null {
    const b = seg?.maskStats().bbox;
    if (!b) return null;
    const margin = 0.02;
    const x0 = Math.max(0, b.x0 - margin) * person.width;
    const y0 = Math.max(0, b.y0 - margin) * person.height;
    const x1 = Math.min(1, b.x1 + margin) * person.width;
    const y1 = Math.min(1, b.y1 + margin) * person.height;
    if (x1 - x0 < 8 || y1 - y0 < 8) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function withMirror(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    mirror: boolean,
    draw: (x: number, y: number, w: number, h: number) => void,
  ): void {
    ctx.save();
    if (mirror) {
      ctx.translate(r.x + r.w, r.y);
      ctx.scale(-1, 1);
      draw(0, 0, r.w, r.h);
    } else {
      draw(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  function drawRaw(ctx: CanvasRenderingContext2D, pane: Rect, mirror: boolean): void {
    const v = deps.video;
    if (!v.videoWidth) return;
    const r = fit(pane, v.videoWidth, v.videoHeight);
    withMirror(ctx, r, mirror, (x, y, w, h) => {
      ctx.drawImage(v, x, y, w, h);
      ctx.drawImage(deps.overlay, x, y, w, h);
    });
  }

  /** dark glass backdrop shared by cutout/silhouette panes */
  function glassBackdrop(ctx: CanvasRenderingContext2D, pane: Rect, deep: boolean): void {
    const g = ctx.createRadialGradient(
      pane.x + pane.w / 2,
      pane.y + pane.h * 0.35,
      pane.h * 0.1,
      pane.x + pane.w / 2,
      pane.y + pane.h * 0.55,
      pane.h * 0.95,
    );
    if (deep) {
      g.addColorStop(0, '#0c1424');
      g.addColorStop(1, '#05070d');
    } else {
      g.addColorStop(0, '#101b30');
      g.addColorStop(1, '#070a12');
    }
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);
  }

  function drawBlur(ctx: CanvasRenderingContext2D, pane: Rect, mirror: boolean): void {
    const v = deps.video;
    const r = fit(pane, v.videoWidth, v.videoHeight);
    // downscale-upscale blur: ctx.filter blur over a live pane is exactly
    // the frame cost the mission warns about; 1/12-scale bounce reads as
    // defocus for ~0 cost
    const tw = Math.max(16, Math.round(r.w / 12));
    const th = Math.max(9, Math.round(r.h / 12));
    if (tiny.width !== tw || tiny.height !== th) {
      tiny.width = tw;
      tiny.height = th;
    }
    tinyCtx.drawImage(v, 0, 0, tw, th);
    withMirror(ctx, r, mirror, (x, y, w, h) => {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tiny, x, y, w, h);
      ctx.fillStyle = 'rgba(5, 8, 15, 0.28)'; // settle the bg behind the performer
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(person, x, y, w, h);
    });
  }

  function drawCutout(ctx: CanvasRenderingContext2D, pane: Rect, mirror: boolean): void {
    glassBackdrop(ctx, pane, false);
    const r = fit(pane, person.width, person.height);
    withMirror(ctx, r, mirror, (x, y, w, h) => ctx.drawImage(person, x, y, w, h));
  }

  function drawSilhouette(ctx: CanvasRenderingContext2D, pane: Rect, mirror: boolean): void {
    glassBackdrop(ctx, pane, true);
    if (!seg) return;
    const pw = person.width || 320;
    const ph = person.height || 180;
    if (sil.width !== pw || sil.height !== ph) {
      sil.width = pw;
      sil.height = ph;
    }
    silCtx.save();
    silCtx.clearRect(0, 0, pw, ph);
    silCtx.filter = `blur(${Math.max(1, pw / 256).toFixed(1)}px)`;
    silCtx.drawImage(seg.mask, 0, 0, pw, ph);
    silCtx.filter = 'none';
    silCtx.globalCompositeOperation = 'source-in';
    const g = silCtx.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, '#9fecff'); // cyan crown
    g.addColorStop(0.55, '#4f9dff'); // electric blue
    g.addColorStop(1, '#8f7bff'); // violet floor glow
    silCtx.fillStyle = g;
    silCtx.fillRect(0, 0, pw, ph);
    silCtx.restore();
    const r = fit(pane, pw, ph);
    withMirror(ctx, r, mirror, (x, y, w, h) => {
      ctx.drawImage(sil, x, y, w, h);
      if (skeletonOn()) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(deps.overlay, x, y, w, h);
        ctx.restore();
      }
    });
  }

  return {
    setMode(m) {
      userMode = m;
      syncLifecycle();
    },
    setOverride(m, skeleton) {
      overrideMode = m;
      overrideSkeleton = m === null ? undefined : skeleton;
      syncLifecycle();
    },
    setSkeleton(on) {
      userSkeleton = on;
    },
    requested: requestedMode,

    effective() {
      return effectiveStable;
    },

    tick(now) {
      // effective mode with debounce: requested if mask is fresh (or raw)
      const req = requestedMode();
      const want: PresentMode = req === 'raw' || !maskFresh() || tierCtl.tier >= 2 ? 'raw' : req;
      if (want !== effectiveCandidate) {
        effectiveCandidate = want;
        candidateSince = now;
      }
      // dropping TO raw is immediate (never composite with a stale mask);
      // entering a masked mode waits out the debounce
      if (want === 'raw' || now - candidateSince >= EFFECTIVE_DEBOUNCE_MS) {
        effectiveStable = want;
      }

      if (req === 'raw' || !deps.autoTier()) return;
      if (now - lastSampleAt < 250) return;
      lastSampleAt = now;
      const t = tierCtl.sample(deps.renderFps(), now);
      if (t !== lastTier) {
        lastTier = t;
        applyTier(t);
        if (t === 2 && !coachedPause) {
          coachedPause = true;
          deps.coach(
            'Presentation',
            'Camera effects paused to keep motion smooth — they return when the frame rate recovers.',
          );
        } else if (t < 2 && coachedPause) {
          coachedPause = false;
          deps.coach('Presentation', 'Camera effects are back on.');
        }
      }
    },

    drawPane(ctx, pane, mirror, forceMode) {
      const mode = forceMode ?? effectiveStable;
      if (mode === 'raw' || !seg || !maskFresh()) {
        drawRaw(ctx, pane, mirror);
        return;
      }
      if (!buildPerson()) {
        drawRaw(ctx, pane, mirror);
        return;
      }
      switch (mode) {
        case 'blur':
          drawBlur(ctx, pane, mirror);
          break;
        case 'silhouette':
          drawSilhouette(ctx, pane, mirror);
          break;
        // chip/stage previews show the cutout — the pane itself is not
        // part of those composites
        case 'cutout':
        case 'chip':
        case 'stage':
          drawCutout(ctx, pane, mirror);
          break;
      }
    },

    drawChip(ctx, w, h, mirror) {
      if (!maskFresh() || !buildPerson()) return;
      const bbox = personBbox();
      if (!bbox) return;
      const chipW = Math.round(w * (w > h ? 0.2 : 0.34));
      const chipH = Math.round(chipW * 1.25);
      const margin = Math.round(w * 0.014);
      const r: Rect = { x: margin, y: h - chipH - margin, w: chipW, h: chipH };
      ctx.save();
      ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const inner = fit({ x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, bbox.w, bbox.h);
      withMirror(ctx, inner, mirror, (x, y, iw, ih) =>
        ctx.drawImage(person, bbox.x, bbox.y, bbox.w, bbox.h, x, y, iw, ih),
      );
      ctx.strokeStyle = 'rgba(210, 228, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.font = '500 11px "JetBrains Mono Variable", monospace';
      ctx.fillStyle = 'rgba(160, 178, 205, 0.9)';
      ctx.textAlign = 'left';
      ctx.fillText('PERFORMER', r.x + 6, r.y + 14);
      ctx.restore();
    },

    drawStagePerson(ctx, stagePane, mirror) {
      if (!maskFresh() || !buildPerson()) return;
      const bbox = personBbox();
      if (!bbox) return;
      // floor-aligned beside the avatar: bbox scaled to ~62% of stage
      // height, feet on the stage floor line, performer stage-left
      const targetH = stagePane.h * 0.62;
      const s = targetH / bbox.h;
      const w = bbox.w * s;
      const floorY = stagePane.y + stagePane.h * 0.93;
      const cx = stagePane.x + stagePane.w * 0.28;
      const r: Rect = { x: cx - w / 2, y: floorY - targetH, w, h: targetH };
      // contact shadow so the cutout stands ON the floor instead of
      // hovering in front of it
      ctx.save();
      const sh = ctx.createRadialGradient(cx, floorY, 1, cx, floorY, w * 0.55);
      sh.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
      sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(cx, floorY, w * 0.55, targetH * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      withMirror(ctx, r, mirror, (x, y, iw, ih) =>
        ctx.drawImage(person, bbox.x, bbox.y, bbox.w, bbox.h, x, y, iw, ih),
      );
      ctx.restore();
    },

    stats() {
      const s = seg?.maskStats();
      return {
        requested: requestedMode(),
        effective: effectiveStable,
        tier: tierCtl.tier,
        segFps: seg ? +seg.segFps().toFixed(1) : 0,
        segLatencyMs: seg ? +seg.latencyMs().toFixed(1) : 0,
        maskAgeMs: seg && seg.lastMaskAt() ? Math.round(performance.now() - seg.lastMaskAt()) : -1,
        flicker: s ? +s.flicker.toFixed(4) : 0,
        coverage: s ? +s.coverage.toFixed(3) : 0,
        delegate: seg?.delegate() ?? '—',
      };
    },
  };
}
