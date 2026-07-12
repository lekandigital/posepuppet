// Motion energy: the one metric the library derives from a loop, used
// for thumbnails (highest-energy frame), best-last-motion (highest-energy
// ~5 s window), and the motion-tape strip (energy over time). Definition
// (documented in docs/MOTION_MEMORY.md): per frame i,
//   E_i = Σ_j |θ_j(i) − θ_j(i−1)| / Δt   [rad/s]
// summed joint angular speed over a fixed joint set — pose: interior
// angles at both elbows, shoulders, hips and knees (8 joints); hand: the
// five finger-bend angles (wrist → MCP → tip). Derived on demand, never
// persisted (the thumbnail is the only precomputed derivative).

import { LM } from '@bodyarcade/pose-runtime';
import {
  decodePoseFrame,
  decodeHandFrame,
  blankLandmarks,
  blankHand,
  type LoopFrame,
  type LoopKind,
} from './stream';

type Triple = [number, number, number];

/** interior angle measured at the middle index */
const POSE_JOINTS: Triple[] = [
  [LM.leftShoulder, LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow, LM.rightWrist],
  [LM.leftElbow, LM.leftShoulder, LM.leftHip],
  [LM.rightElbow, LM.rightShoulder, LM.rightHip],
  [LM.leftShoulder, LM.leftHip, LM.leftKnee],
  [LM.rightShoulder, LM.rightHip, LM.rightKnee],
  [LM.leftHip, LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee, LM.rightAnkle],
];

/** MediaPipe hand: wrist 0; finger chains 1-4, 5-8, 9-12, 13-16, 17-20 */
const HAND_JOINTS: Triple[] = [
  [0, 2, 4],
  [0, 6, 8],
  [0, 10, 12],
  [0, 14, 16],
  [0, 18, 20],
];

interface P3 {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

function angleAt(pts: P3[], [a, b, c]: Triple): number {
  const abx = pts[a].x - pts[b].x;
  const aby = pts[a].y - pts[b].y;
  const abz = pts[a].z - pts[b].z;
  const cbx = pts[c].x - pts[b].x;
  const cby = pts[c].y - pts[b].y;
  const cbz = pts[c].z - pts[b].z;
  const la = Math.hypot(abx, aby, abz);
  const lc = Math.hypot(cbx, cby, cbz);
  if (la < 1e-6 || lc < 1e-6) return 0;
  const d = (abx * cbx + aby * cby + abz * cbz) / (la * lc);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

/** Per-frame energy curve (rad/s). curve[0] = 0; curve.length = frames.length.
 *  Low-visibility pose joints contribute NaN angles that the sum skips, so
 *  occlusion noise never reads as motion. */
export function energyCurve(frames: readonly LoopFrame[], kind: LoopKind): number[] {
  const n = frames.length;
  const out = new Array<number>(n).fill(0);
  if (n < 2) return out;

  const world = blankLandmarks();
  const norm = blankLandmarks();
  const hand = blankHand();
  const joints = kind === 'pose' ? POSE_JOINTS : HAND_JOINTS;
  let prev: number[] | null = null;

  for (let i = 0; i < n; i++) {
    let pts: P3[];
    if (kind === 'pose') {
      decodePoseFrame(frames[i], world, norm);
      pts = world;
    } else {
      decodeHandFrame(frames[i], hand);
      pts = hand;
    }
    const angles = joints.map((tri) => {
      if (kind === 'pose') {
        // occluded joints contribute no motion
        const visOk = tri.every((idx) => (world[idx].visibility ?? 1) > 0.3);
        if (!visOk) return NaN;
      }
      return angleAt(pts, tri);
    });
    if (prev) {
      const dt = (frames[i].t - frames[i - 1].t) / 1000;
      if (dt > 1e-4) {
        let sum = 0;
        for (let j = 0; j < angles.length; j++) {
          const a = angles[j];
          const p = prev[j];
          if (Number.isNaN(a) || Number.isNaN(p)) continue;
          sum += Math.abs(a - p) / dt;
        }
        out[i] = sum;
      } else {
        out[i] = out[i - 1];
      }
    }
    prev = angles;
  }
  return out;
}

/** Index of the loop's highest-energy frame (thumbnail source). */
export function peakFrameIndex(frames: readonly LoopFrame[], kind: LoopKind): number {
  const curve = energyCurve(frames, kind);
  let best = 0;
  for (let i = 1; i < curve.length; i++) if (curve[i] > curve[best]) best = i;
  return best;
}

/** The highest-mean-energy window of ~windowMs — "best last motion".
 *  Returns absolute frame-time bounds (same timebase as frames[].t). */
export function bestWindow(
  frames: readonly LoopFrame[],
  kind: LoopKind,
  windowMs = 5000,
): { startMs: number; endMs: number } {
  const n = frames.length;
  if (n === 0) return { startMs: 0, endMs: 0 };
  const t0 = frames[0].t;
  const t1 = frames[n - 1].t;
  if (t1 - t0 <= windowMs) return { startMs: t0, endMs: t1 };

  // candidate windows are always exactly windowMs wide and lie inside
  // [t0, t1] — an early energy burst yields a full window that CONTAINS
  // it, never a clipped sliver (sliding-window mean, two pointers)
  const curve = energyCurve(frames, kind);
  let best = { startMs: t0, endMs: t0 + windowMs };
  let bestScore = -1;
  let lo = 0;
  let hi = -1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const start = Math.min(Math.max(frames[i].t, t0), t1 - windowMs);
    const end = start + windowMs;
    while (hi + 1 < n && frames[hi + 1].t <= end) {
      hi++;
      sum += curve[hi];
    }
    while (frames[lo].t < start) {
      sum -= curve[lo];
      lo++;
    }
    const count = hi - lo + 1;
    if (count < 2) continue;
    const score = sum / count;
    if (score > bestScore) {
      bestScore = score;
      best = { startMs: start, endMs: end };
    }
  }
  return best;
}
