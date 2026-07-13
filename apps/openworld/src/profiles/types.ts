// The profile contract — profiles are RENDERER + CONTENT PACKS, never
// geography. A profile receives the WorldRuntime read-only and a scene to
// fill; every gameplay-relevant query (terrain, water, SDF, nav, spawns,
// transitions, containment) stays inside WorldRuntime and the mode sims,
// which are profile-blind. The consistency spec runs WorldRuntime.battery()
// under each profile and asserts byte-identical answers.

import type * as THREE from 'three';
import type { WorldRuntime } from '../world/runtime';

export type ProfileId = 'low-poly' | 'realistic' | 'fantasy-game';
export type ModeId = 'flight' | 'walk' | 'row' | 'dolphin';

export interface ProfileContext {
  world: WorldRuntime;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
}

export interface WorldProfile {
  id: ProfileId;
  label: string;
  /** The content pack: which modes this profile ships. Dolphin is a
   *  low-poly-only entry (product law, not a runtime conditional). */
  modes: ModeId[];
  /** Build all static content into ctx.scene. */
  build(ctx: ProfileContext): void;
  /** Per-frame ambience (sky, water motion, life). Never physics. */
  update(dtS: number, timeS: number, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}
