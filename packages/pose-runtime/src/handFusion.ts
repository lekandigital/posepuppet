// Hand-landmark fusion (V5): a reduced-rate 21-point hand stream anchored
// to the POSE detector's wrists, for Character mode. The pose model keeps
// owning arms and wrist direction; this layer adds what pose landmarks
// cannot see — per-finger curl — for rigs whose capability manifest says
// they can enact it.
//
// Budget rules (the perf non-negotiables live here):
//   • detection is rate-capped (default 12 Hz, ~0.4× the pose rate)
//   • inference is skipped entirely while no pose wrist is visible
//     (hands-visible-only) or while the consumer gate is off
//     (capability-gated: incapable rigs never pay for a hand model)
//
// Hands are matched to pose wrists by proximity in RAW image space —
// MediaPipe's handedness labels flip under mirroring and are wrong often
// enough on webcams that geometry is the only trustworthy association.

import { createMultiHandDetector, HLM, type HandFrame, type MultiHandDetector } from './handDetector';
import type { DetectorAssets } from './detector';
import type { LandmarkPoint } from './types';

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'little';
export type FingerCurls = Record<FingerName, number>;

/** Fused per-hand state, keyed by the RAW pose side it anchors to. */
export interface FusedHand {
  /** per-finger curl, 0 straight … 1 curled (EMA-smoothed) */
  curls: FingerCurls;
  /** 1 − mean(index…little) — matches applyHandState semantics */
  openness: number;
  point: boolean;
  /** wall time of the detection that produced this state */
  updatedMs: number;
}

export interface HandFusionOptions {
  assets?: DetectorAssets;
  /** detection rate cap (Hz); the reduced-rate budget. Default 12. */
  maxHz?: number;
  numHands?: number;
}

export interface HandFusion {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  dispose(): void;
  /** master gate — the app sets it from mode + capability manifest */
  setActive(on: boolean): void;
  active(): boolean;
  /** whether the detector is currently started on a video element */
  running(): boolean;
  /** per pose frame: RAW (unmirrored) wrist landmarks, or null on no pose.
   *  Drives association AND the hands-visible-only inference gate. */
  onPoseWrists(raw: LandmarkPoint[] | null): void;
  /** latest fused state for a RAW pose side; null = never seen */
  state(rawSide: 'left' | 'right'): FusedHand | null;
  /** fires after each processed detection (even an empty one) */
  onUpdate(cb: () => void): () => void;
  /** measured detection rate (Hz) — the honest fusion cost number */
  detectFps(): number;
  delegate(): 'GPU' | 'CPU' | null;
  /** diagnostics: detection/association counters + anchor state */
  debug(): {
    detections: number;
    handsSeen: number;
    associated: number;
    wrists: { left: { x: number; y: number; visible: boolean }; right: { x: number; y: number; visible: boolean } };
    lastHandAt: { x: number; y: number } | null;
  };
}

/** raw pose-wrist visibility below this = no hand could be anchored */
const WRIST_VIS_MIN = 0.5;
/** max wrist↔hand distance for association (normalized image units) */
const ASSOC_MAX = 0.18;
/** EMA factor per detection (12 Hz → ~90 ms to settle) */
const SMOOTH = 0.45;

/** MediaPipe pose landmark indices for the wrists (raw space). */
const POSE_LEFT_WRIST = 15;
const POSE_RIGHT_WRIST = 16;

const FINGER_JOINTS: Record<Exclude<FingerName, 'thumb'>, [number, number, number, number]> = {
  index: [HLM.indexMcp, HLM.indexPip, HLM.indexDip, HLM.indexTip],
  middle: [HLM.middleMcp, HLM.middlePip, HLM.middleDip, HLM.middleTip],
  ring: [HLM.ringMcp, HLM.ringPip, HLM.ringDip, HLM.ringTip],
  little: [HLM.pinkyMcp, HLM.pinkyPip, HLM.pinkyDip, HLM.pinkyTip],
};

function jointAngle(
  w: { x: number; y: number; z: number }[],
  a: number,
  b: number,
  c: number,
): number {
  const abx = w[a].x - w[b].x;
  const aby = w[a].y - w[b].y;
  const abz = w[a].z - w[b].z;
  const cbx = w[c].x - w[b].x;
  const cby = w[c].y - w[b].y;
  const cbz = w[c].z - w[b].z;
  const la = Math.hypot(abx, aby, abz);
  const lc = Math.hypot(cbx, cby, cbz);
  if (la < 1e-6 || lc < 1e-6) return Math.PI;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby + abz * cbz) / (la * lc)));
  return Math.acos(cos); // π = straight, smaller = bent
}

/** Per-finger curl 0..1 from world-landmark joint bends. */
export function fingerCurlsFromWorld(w: { x: number; y: number; z: number }[]): FingerCurls {
  const curls = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 };
  for (const [finger, [mcp, pip, dip, tip]] of Object.entries(FINGER_JOINTS) as
    [Exclude<FingerName, 'thumb'>, [number, number, number, number]][]) {
    const bend = (Math.PI - jointAngle(w, mcp, pip, dip)) + (Math.PI - jointAngle(w, pip, dip, tip));
    // fully curled fingers measure ~2.2–2.6 rad of total bend
    curls[finger] = Math.min(1, Math.max(0, bend / 2.2));
  }
  const thumbBend =
    (Math.PI - jointAngle(w, HLM.thumbCmc, HLM.thumbMcp, HLM.thumbIp)) +
    (Math.PI - jointAngle(w, HLM.thumbMcp, HLM.thumbIp, HLM.thumbTip));
  curls.thumb = Math.min(1, Math.max(0, thumbBend / 1.4));
  return curls;
}

export function createHandFusion(opts: HandFusionOptions = {}): HandFusion {
  let detector: MultiHandDetector | null = null;
  let isActive = false;
  let isRunning = false;
  let videoEl: HTMLVideoElement | null = null;
  let starting: Promise<void> | null = null;

  // raw-space pose wrists (association anchors + inference gate)
  const wrists = {
    left: { x: 0, y: 0, visible: false },
    right: { x: 0, y: 0, visible: false },
  };

  const states: Record<'left' | 'right', FusedHand | null> = { left: null, right: null };
  const subs = new Set<() => void>();
  const dbg = { detections: 0, handsSeen: 0, associated: 0, lastHandAt: null as { x: number; y: number } | null };

  function onFrames(frames: HandFrame[], wallTimeMs: number): void {
    dbg.detections++;
    dbg.handsSeen += frames.length;
    // greedy association: each detected hand claims the nearest free wrist
    const free = new Set<'left' | 'right'>();
    if (wrists.left.visible) free.add('left');
    if (wrists.right.visible) free.add('right');
    for (const frame of frames) {
      const hw = frame.norm[HLM.wrist];
      dbg.lastHandAt = { x: hw.x, y: hw.y };
      let best: 'left' | 'right' | null = null;
      let bestD = ASSOC_MAX;
      for (const side of free) {
        const d = Math.hypot(hw.x - wrists[side].x, hw.y - wrists[side].y);
        if (d < bestD) {
          bestD = d;
          best = side;
        }
      }
      if (!best) continue;
      free.delete(best);
      dbg.associated++;

      const raw = fingerCurlsFromWorld(frame.world);
      const prev = states[best];
      const curls = prev
        ? {
            thumb: prev.curls.thumb + (raw.thumb - prev.curls.thumb) * SMOOTH,
            index: prev.curls.index + (raw.index - prev.curls.index) * SMOOTH,
            middle: prev.curls.middle + (raw.middle - prev.curls.middle) * SMOOTH,
            ring: prev.curls.ring + (raw.ring - prev.curls.ring) * SMOOTH,
            little: prev.curls.little + (raw.little - prev.curls.little) * SMOOTH,
          }
        : raw;
      const openness = 1 - (curls.index + curls.middle + curls.ring + curls.little) / 4;
      const point =
        curls.index < 0.35 && curls.middle > 0.55 && curls.ring > 0.55 && curls.little > 0.55;
      states[best] = { curls, openness, point, updatedMs: wallTimeMs };
    }
    for (const cb of subs) cb();
  }

  const api: HandFusion = {
    async start(video) {
      videoEl = video;
      if (!detector) {
        starting ??= (async () => {
          detector = await createMultiHandDetector(opts.assets, {
            numHands: opts.numHands ?? 2,
            maxHz: opts.maxHz ?? 12,
            // the budget gate: no visible pose wrist (or gate off) = the
            // hand model does not run at all this frame
            shouldDetect: () => isActive && (wrists.left.visible || wrists.right.visible),
          });
        })();
        await starting;
      }
      if (!isRunning && videoEl) {
        detector!.start(videoEl, onFrames);
        isRunning = true;
      }
    },
    stop() {
      detector?.stop();
      isRunning = false;
    },
    dispose() {
      detector?.dispose();
      detector = null;
      isRunning = false;
      subs.clear();
    },
    setActive(on) {
      isActive = on;
      if (!on) {
        states.left = null;
        states.right = null;
      }
    },
    active: () => isActive,
    running: () => isRunning,
    onPoseWrists(raw) {
      if (!raw) {
        wrists.left.visible = false;
        wrists.right.visible = false;
        return;
      }
      const lw = raw[POSE_LEFT_WRIST];
      const rw = raw[POSE_RIGHT_WRIST];
      wrists.left = { x: lw.x, y: lw.y, visible: lw.visibility > WRIST_VIS_MIN };
      wrists.right = { x: rw.x, y: rw.y, visible: rw.visibility > WRIST_VIS_MIN };
    },
    state: (side) => states[side],
    onUpdate(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    detectFps: () => detector?.handFps() ?? 0,
    delegate: () => detector?.delegate() ?? null,
    debug: () => ({
      detections: dbg.detections,
      handsSeen: dbg.handsSeen,
      associated: dbg.associated,
      wrists: { left: { ...wrists.left }, right: { ...wrists.right } },
      lastHandAt: dbg.lastHandAt,
    }),
  };
  return api;
}
