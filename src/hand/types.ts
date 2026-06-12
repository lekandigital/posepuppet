// Hand-only mode puppet contract. A puppet consumes one HandFrame per
// detection (21 landmarks) and renders itself on the stage. Playback-only
// — no scoring, no game state, ever.

import type * as THREE from 'three';
import type { HandFrame } from '../pose/handDetector';

export interface HandPuppet {
  name: string;
  object: THREE.Object3D;
  /** Per hand-detection frame (~30/s); null = hand lost this frame. */
  onHandFrame(frame: HandFrame | null): void;
  /** Per render tick — smoothing, idle life, springs. */
  update(dt: number, time: number): void;
  dispose(): void;
}

export type HandPuppetId = 'hand' | 'beaky' | 'xray';

export interface HandPuppetDef {
  id: HandPuppetId;
  label: string;
  glyph: string;
  chip: string;
  /** one-line capability/limitation note for the card */
  note: string;
  create(): HandPuppet;
}
