// Ghost player: replays a recorded loop on a translucent violet copy of a
// roster avatar, through its OWN Retargeter — the same pipeline that
// drives the live avatar, so a loop recorded once performs identically on
// any rig (re-skin). The echo chorus is N ghosts at staggered offsets — a
// motion delay line. Playback only; nothing here scores anything.

import * as THREE from 'three';
import { Retargeter } from '../rig/retarget';
import { loadAvatarById, type AvatarId } from '../rig/avatarRegistry';
import type { Avatar } from '../rig/types';
import { decodePoseFrame, blankLandmarks, type MotionLoop } from './stream';

/** Ghost material: violet, translucent, additive-leaning — the Memory hue. */
function ghostify(obj: THREE.Object3D, opacity: number): void {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9d7bff,
    emissive: 0x9d7bff,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.7,
  });
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = mat;
    mesh.castShadow = false;
    mesh.renderOrder = 5;
  });
}

class GhostInstance {
  retargeter: Retargeter;
  private world = blankLandmarks();
  private norm = blankLandmarks();
  private frameIdx = 0;

  constructor(
    readonly avatar: Avatar,
    readonly offsetMs: number,
    opacity: number,
  ) {
    ghostify(avatar.object, opacity);
    this.retargeter = new Retargeter(avatar);
  }

  /** Feed the loop frame nearest to (t - offset); loops wrap. */
  seek(loop: MotionLoop, tMs: number): void {
    const dur = Math.max(loop.durationMs, 1);
    const local = ((tMs - this.offsetMs) % dur + dur) % dur;
    // frames are time-ordered; walk the index (loops reset it)
    if (this.frameIdx >= loop.frames.length || loop.frames[this.frameIdx].t > local) this.frameIdx = 0;
    while (
      this.frameIdx + 1 < loop.frames.length &&
      loop.frames[this.frameIdx + 1].t <= local
    ) {
      this.frameIdx++;
    }
    const f = loop.frames[this.frameIdx];
    decodePoseFrame(f, this.world, this.norm);
    this.retargeter.updateFromPose(this.world, this.norm);
  }

  tick(dt: number, time: number): void {
    this.retargeter.tick(dt);
    this.avatar.update(dt, time);
  }

  dispose(): void {
    this.avatar.dispose();
  }
}

export interface GhostOptions {
  echoes: number; // 1 = single ghost … 4 = delay line
  echoOffsetMs: number;
  rate?: number; // playback speed (0.4 = slow-mo replay)
  /** 'beside' = duet position next to the live avatar; 'center' = the
   *  ghost IS the star (instant replay) */
  placement?: 'beside' | 'center';
  baseOpacity?: number;
}

export interface GhostPlayer {
  readonly object: THREE.Group;
  readonly active: boolean;
  start(loop: MotionLoop, avatarId: AvatarId, opts: GhostOptions): Promise<void>;
  stop(): void;
  setEchoes(n: number): void;
  tick(dt: number, time: number): void;
}

export function createGhostPlayer(): GhostPlayer {
  const object = new THREE.Group();
  object.name = 'ghosts';

  let ghosts: GhostInstance[] = [];
  let loop: MotionLoop | null = null;
  let avatarId: AvatarId = 'robot';
  let echoOffset = 300;
  let playT = 0;
  let rate = 1;
  let wantEchoes = 1;
  let placement: 'beside' | 'center' = 'beside';
  let baseOpacity = 0.42;
  let building = false;

  async function build(n: number): Promise<void> {
    if (building || !loop) return;
    building = true;
    try {
      while (ghosts.length > n) ghosts.pop()!.dispose();
      while (ghosts.length < n) {
        const i = ghosts.length;
        const av = await loadAvatarById(avatarId);
        const g = new GhostInstance(av, i * echoOffset, Math.max(0.16, baseOpacity - i * 0.09));
        if (placement === 'beside') {
          // duet: ghosts stand beside/behind the live avatar
          av.object.position.x += -0.55 - i * 0.4;
          av.object.position.z += -0.25 - i * 0.18;
        } else {
          // replay: the first ghost takes center stage, echoes trail it
          av.object.position.x += i * 0.12;
          av.object.position.z += -i * 0.1;
        }
        object.add(av.object);
        // Retargeter binds before the reposition above; rebind so the
        // ghost's root rest includes its stage offset
        g.retargeter.bind(av);
        ghosts.push(g);
      }
    } finally {
      building = false;
    }
  }

  return {
    object,
    get active() {
      return ghosts.length > 0 && loop !== null;
    },
    async start(l, id, opts) {
      loop = l;
      avatarId = id;
      echoOffset = opts.echoOffsetMs;
      rate = opts.rate ?? 1;
      placement = opts.placement ?? 'beside';
      baseOpacity = opts.baseOpacity ?? 0.42;
      playT = 0;
      wantEchoes = Math.max(1, Math.min(opts.echoes, 4));
      while (ghosts.length) ghosts.pop()!.dispose();
      await build(wantEchoes);
    },
    stop() {
      loop = null;
      while (ghosts.length) ghosts.pop()!.dispose();
    },
    setEchoes(n) {
      wantEchoes = Math.max(1, Math.min(n, 4));
      void build(wantEchoes);
    },
    tick(dt, time) {
      if (!loop) return;
      playT += dt * 1000 * rate;
      for (const g of ghosts) {
        g.seek(loop, playT);
        g.tick(dt, time);
      }
    },
  };
}
