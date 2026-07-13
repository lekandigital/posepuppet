// GameMode contract. Modes own their sim + camera + vehicle visuals and
// consume ONLY WorldRuntime queries + completed control systems. They are
// profile-blind: a mode never asks which profile is active.

import type * as THREE from 'three';
import type { Chrome } from '../ui/chrome';
import type { WorldRuntime } from '../world/runtime';

export interface ModeContext {
  world: WorldRuntime;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  chrome: Chrome;
}

export interface GameMode {
  id: string;
  /** Place the player/vehicle; called once after construction. */
  enter(): void;
  update(dtS: number, timeS: number): void;
  dispose(): void;
}
