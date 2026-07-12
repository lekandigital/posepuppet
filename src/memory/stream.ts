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

export interface MotionLoop {
  id: string;
  name: string;
  kind: LoopKind;
  createdAt: number;
  durationMs: number;
  frames: LoopFrame[];
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
  snapshot(sec: number, name: string): MotionLoop | null {
    if (this.frames.length < 10) return null;
    const end = this.frames[this.frames.length - 1].t;
    const start = Math.max(end - sec * 1000, this.frames[0].t);
    const slice = this.frames.filter((f) => f.t >= start);
    if (slice.length < 10) return null;
    return {
      id: `loop-${Date.now().toString(36)}`,
      name,
      kind: this.kind,
      createdAt: Date.now(),
      durationMs: end - start,
      frames: slice.map((f) => ({ t: f.t - start, q: f.q })),
    };
  }

  clear(): void {
    this.frames = [];
  }
}
