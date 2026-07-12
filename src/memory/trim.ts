// Trim: destructive-on-apply, exact by contract. Given in/out points in
// loop time, the kept frames are exactly those with t ∈ [inMs, outMs],
// re-timed so the first possible instant is 0 and durationMs = out − in.
// No trim markers live in the schema — after apply, a trimmed loop is
// indistinguishable from one recorded that short, so every playback and
// V7 consumer stays version-blind about editing state. Frame buffers are
// shared, not copied (frames are immutable once captured).

import type { LoopCapture, LoopFrame } from './stream';

export const MIN_TRIM_MS = 400;
export const MIN_TRIM_FRAMES = 4;

/** Pure trim of the frame list — the exactness contract the suite pins. */
export function trimFrames(frames: LoopFrame[], inMs: number, outMs: number): LoopFrame[] {
  return frames.filter((f) => f.t >= inMs && f.t <= outMs).map((f) => ({ t: f.t - inMs, q: f.q }));
}

/** Trimmed copy of a loop; null when the window is degenerate (too short
 *  or holding fewer than MIN_TRIM_FRAMES frames). Keeps id/name/metadata —
 *  the caller decides whether it replaces the stored loop (apply) or lives
 *  for a moment as a preview. */
export function trimLoop<T extends LoopCapture>(loop: T, inMs: number, outMs: number): T | null {
  const lo = Math.max(0, Math.min(inMs, outMs));
  const hi = Math.min(loop.durationMs, Math.max(inMs, outMs));
  if (hi - lo < MIN_TRIM_MS) return null;
  const frames = trimFrames(loop.frames, lo, hi);
  if (frames.length < MIN_TRIM_FRAMES) return null;
  return { ...loop, durationMs: hi - lo, frames };
}
