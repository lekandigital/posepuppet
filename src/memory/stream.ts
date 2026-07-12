// Motion Memory stream types + quantization. A loop is the recorded
// INPUT of the retargeting pipeline (mirrored, smoothed landmarks), not
// per-bone quaternions: replaying through a second Retargeter reproduces
// the pose on ANY rig — re-skin is exact by construction (DECISIONS.md).
// Quantized to int16 (~400 B/frame body, ~130 B/frame hand); loops stay
// small enough for IndexedDB without ceremony. Playback only — never
// scored, never gamified.

import type { LandmarkPoint } from '@bodyarcade/pose-runtime';
import type { HandPoint } from '@bodyarcade/pose-runtime';

export type LoopKind = 'pose' | 'hand';

export interface LoopFrame {
  /** ms since loop start */
  t: number;
  /** quantized landmarks: pose = world(33×4 incl. vis) + norm(33×3);
   *  hand = norm(21×3) */
  q: Int16Array;
}

/** What the ring buffer emits and the ghost player consumes: the v1 loop
 *  shape. Everything playable is a LoopCapture; the persisted MotionLoop
 *  (schema v2) extends it with library metadata. */
export interface LoopCapture {
  id: string;
  name: string;
  kind: LoopKind;
  createdAt: number;
  durationMs: number;
  frames: LoopFrame[];
}

export type LoopMode = 'character' | 'hand';

/** Loop schema v2 — the stable persisted contract (see docs/MOTION_MEMORY.md).
 *  v1 records (no `v` field) migrate in place on DB open; frames are
 *  byte-identical across the migration. */
export interface MotionLoop extends LoopCapture {
  v: 2;
  /** avatar id active at capture; 'unknown' on migrated v1 loops */
  avatar: string;
  /** app mode at capture; derived from kind on migrated v1 loops */
  mode: LoopMode;
  /** deterministic SVG skeleton of the loop's highest-energy frame */
  thumbSvg: string;
  /** storage accounting: frame buffers + fixed overhead + thumbnail */
  bytes: number;
}

// pose world landmarks live in ~[-2, 2] m; norm in [0, 1]; vis in [0, 1]
const WORLD_SCALE = 8000; // ±4 m → int16
const NORM_SCALE = 16000;

export function encodePoseFrame(world: LandmarkPoint[], norm: LandmarkPoint[], t: number): LoopFrame {
  const q = new Int16Array(33 * 4 + 33 * 3);
  let o = 0;
  for (let i = 0; i < 33; i++) {
    q[o++] = Math.round(world[i].x * WORLD_SCALE);
    q[o++] = Math.round(world[i].y * WORLD_SCALE);
    q[o++] = Math.round(world[i].z * WORLD_SCALE);
    q[o++] = Math.round(world[i].visibility * NORM_SCALE);
  }
  for (let i = 0; i < 33; i++) {
    q[o++] = Math.round(norm[i].x * NORM_SCALE);
    q[o++] = Math.round(norm[i].y * NORM_SCALE);
    q[o++] = Math.round(norm[i].z * NORM_SCALE);
  }
  return { t, q };
}

export function decodePoseFrame(
  f: LoopFrame,
  world: LandmarkPoint[],
  norm: LandmarkPoint[],
): void {
  const q = f.q;
  let o = 0;
  for (let i = 0; i < 33; i++) {
    world[i].x = q[o++] / WORLD_SCALE;
    world[i].y = q[o++] / WORLD_SCALE;
    world[i].z = q[o++] / WORLD_SCALE;
    world[i].visibility = q[o++] / NORM_SCALE;
  }
  for (let i = 0; i < 33; i++) {
    norm[i].x = q[o++] / NORM_SCALE;
    norm[i].y = q[o++] / NORM_SCALE;
    norm[i].z = q[o++] / NORM_SCALE;
    norm[i].visibility = world[i].visibility;
  }
}

export function encodeHandFrame(norm: HandPoint[], t: number): LoopFrame {
  const q = new Int16Array(21 * 3);
  let o = 0;
  for (let i = 0; i < 21; i++) {
    q[o++] = Math.round(norm[i].x * NORM_SCALE);
    q[o++] = Math.round(norm[i].y * NORM_SCALE);
    q[o++] = Math.round(norm[i].z * NORM_SCALE);
  }
  return { t, q };
}

export function decodeHandFrame(f: LoopFrame, norm: HandPoint[]): void {
  const q = f.q;
  let o = 0;
  for (let i = 0; i < 21; i++) {
    norm[i].x = q[o++] / NORM_SCALE;
    norm[i].y = q[o++] / NORM_SCALE;
    norm[i].z = q[o++] / NORM_SCALE;
  }
}

export function blankLandmarks(): LandmarkPoint[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
}
export function blankHand(): HandPoint[] {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
}

/** Fewest frames a snapshot will call a loop. Low on purpose: at real
 *  pose rates (~25–30 Hz) it is a fraction of a second, and on weak
 *  machines running 1–2 Hz a legitimate 5 s best-motion window may hold
 *  only a handful of frames — those loops play (steppy but honest). */
export const MIN_LOOP_FRAMES = 4;

/** Rolling capture of the last `seconds` of frames — always on, free. */
export class RingBuffer {
  private frames: LoopFrame[] = [];
  constructor(
    readonly kind: LoopKind,
    private seconds = 12,
  ) {}

  push(frame: LoopFrame): void {
    this.frames.push(frame);
    const cutoff = frame.t - this.seconds * 1000;
    while (this.frames.length && this.frames[0].t < cutoff) this.frames.shift();
  }

  /** Snapshot the last `sec` seconds as a loop (frames re-timed from 0). */
  snapshot(sec: number, name: string): LoopCapture | null {
    if (this.frames.length < MIN_LOOP_FRAMES) return null;
    const end = this.frames[this.frames.length - 1].t;
    return this.snapshotWindow(Math.max(end - sec * 1000, this.frames[0].t), end, name);
  }

  /** Snapshot an arbitrary [startT, endT] window of the ring (absolute
   *  frame times, as returned by peek()) — best-last-motion grabs this. */
  snapshotWindow(startT: number, endT: number, name: string): LoopCapture | null {
    const slice = this.frames.filter((f) => f.t >= startT && f.t <= endT);
    if (slice.length < MIN_LOOP_FRAMES) return null;
    return {
      id: `loop-${Date.now().toString(36)}`,
      name,
      kind: this.kind,
      createdAt: Date.now(),
      durationMs: endT - startT,
      frames: slice.map((f) => ({ t: f.t - startT, q: f.q })),
    };
  }

  /** Read-only view of the buffered frames (absolute times). */
  peek(): readonly LoopFrame[] {
    return this.frames;
  }

  clear(): void {
    this.frames = [];
  }
}
