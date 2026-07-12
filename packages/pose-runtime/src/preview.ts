// PreviewFrame — the APPROVED render state that may cross from the Runtime
// to the HUD. This is deliberately not a landmark array: 2D only (no depth),
// quantized to a 1/512 grid, visibility reduced to a hidden-point sentinel,
// plus per-limb tracking states and a coarse confidence. It is delivered
// in-process only; transports (BroadcastChannel/postMessage) carry
// BodySignal and nothing else — enforced by the boundary tests.

import type { PpcGroupName, PpcState } from './continuity';
import type { LandmarkPoint } from './types';

export const PREVIEW_POINTS = 33;
export const PREVIEW_Q = 512; // quantization grid for normalized [0,1] coords
export const PREVIEW_HIDDEN = -1;
const VIS_MIN = 0.5;

export interface PreviewFrame {
  /** 33 × (x,y) interleaved, quantized to [0, PREVIEW_Q]; PREVIEW_HIDDEN = not visible. */
  pts: Int16Array;
  /** wall-clock ms of the source frame */
  t: number;
  /** per-limb PPC state for tinting (VISIBLE / PREDICTED / RELAXED) */
  groups: Partial<Record<PpcGroupName, PpcState>>;
  /** coarse overall confidence, 2 decimals */
  confidence: number;
  /** false while PPC is carrying the stream through an occlusion */
  live: boolean;
}

export function createPreviewFrame(): PreviewFrame {
  const pts = new Int16Array(PREVIEW_POINTS * 2);
  pts.fill(PREVIEW_HIDDEN);
  return { pts, t: 0, groups: {}, confidence: 0, live: false };
}

/** Fills `out` from a post-mirror, post-PPC normalized frame (or clears it). */
export function buildPreviewFrame(
  out: PreviewFrame,
  norm: LandmarkPoint[] | null,
  tMs: number,
  groups: Partial<Record<PpcGroupName, PpcState>>,
  confidence: number,
  live: boolean,
): PreviewFrame {
  out.t = tMs;
  out.groups = groups;
  out.confidence = Math.round(confidence * 100) / 100;
  out.live = live;
  if (!norm) {
    out.pts.fill(PREVIEW_HIDDEN);
    return out;
  }
  for (let i = 0; i < PREVIEW_POINTS; i++) {
    const p = norm[i];
    if (!p || p.visibility < VIS_MIN) {
      out.pts[i * 2] = PREVIEW_HIDDEN;
      out.pts[i * 2 + 1] = PREVIEW_HIDDEN;
      continue;
    }
    out.pts[i * 2] = Math.max(0, Math.min(PREVIEW_Q, Math.round(p.x * PREVIEW_Q)));
    out.pts[i * 2 + 1] = Math.max(0, Math.min(PREVIEW_Q, Math.round(p.y * PREVIEW_Q)));
  }
  return out;
}
