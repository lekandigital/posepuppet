// The GAMICO dolphin: GLTF load, the Master §7.6 animation controller
// over the 8 measured clips, and the runtime body-length measurement
// (BL policy, Master §7.1 — measure, never rescale).
//
// Track C operational law: the rest pose renders nose-down — an
// AnimationAction MUST be running before the first rendered frame, so
// loadDolphin() returns only after SwimForward is playing and applied.
// The Jump clip bakes ~2 m of Dolphin_Root translation; that track is
// stripped at load so gameplay code owns breach motion.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Presentation inputs read from sim state each frame (never fed back). */
export interface DolphinPose {
  speed: number;
  /** kick cadence Hz (drives timeScale, never linear with velocity) */
  kickRate: number;
  /** bank radians (sign-selects SwimLeft/Right, weight ∝ |bank|) */
  bank: number;
  /** pitch rate rad/s (weights SwimUp/Down) */
  pitchRate: number;
  /** sim y (BreatheSurface gating near the surface) */
  y: number;
  phase: 'swim' | 'air';
}

export interface DolphinActor {
  group: THREE.Group;
  /** nose-to-fluke world extent along +Z, SwimForward frame 0, metres */
  measuredLengthM: number;
  /** posed skinned-mesh AABB in world space (cp02 coverage-band probe) */
  worldBounds(): THREE.Box3;
  clipNames: string[];
  /** name of the current base AnimationAction */
  activeActionName(): string;
  /** is any AnimationAction currently running? */
  actionRunning(): boolean;
  update(dt: number, pose: DolphinPose): void;
}

// Master §6.3 bindings (all [DERIVED], flagged for the cp01 review):
const FAST_ON = 7.8;        // 70 % of the 5→9 span
const FAST_OFF = 7.4;       // small hysteresis so the band edge never flaps
const BREATHE_Y = 0.6;      // |y| < 0.6 m …
const BREATHE_HOLD_S = 2;   // … sustained > 2 s …
const BREATHE_SPEED = 1.5;  // … at speed < 1.5 m/s
const IDLE_SPEED = 0.75;    // MIN_CONTROL_SPEED: idle = SwimForward @ 0.7
const XFADE_S = 0.3;        // base-clip cross-fade (0.2–0.4 band)
const KB_KICK_REF_HZ = 1.6; // timeScale = 0.7 + 0.9·rate/1.6, clamped 0.7–1.6

export async function loadDolphin(url: string): Promise<DolphinActor> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const group = new THREE.Group();
  group.add(gltf.scene);

  let skinned: THREE.SkinnedMesh | null = null;
  gltf.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      skinned = o as THREE.SkinnedMesh;
    }
    o.frustumCulled = false; // clips move bones beyond the static bounds
  });
  if (!skinned) throw new Error('dolphin.glb: no skinned mesh found');
  const mesh: THREE.SkinnedMesh = skinned;

  const clips = gltf.animations;
  const byName = new Map(clips.map((c) => [c.name, c]));
  const need = (name: string): THREE.AnimationClip => {
    const c = byName.get(name);
    if (!c) throw new Error(`dolphin.glb: missing clip ${name}`);
    return c;
  };

  // Strip the Jump clip's baked root translation (Track C Item 3 gotcha 2):
  // gameplay code moves the dolphin; the clip keeps rotations only.
  const jumpClip = need('Jump').clone();
  jumpClip.tracks = jumpClip.tracks.filter(
    (t) => !(t.name.includes('Dolphin_Root') && t.name.endsWith('.position')),
  );

  // Additive bank/pitch layers — convert BEFORE creating actions (the
  // forum-documented over-scale pitfall, Master §7.6).
  const additive = (name: string): THREE.AnimationClip =>
    THREE.AnimationUtils.makeClipAdditive(need(name).clone());
  const leftClip = additive('SwimLeft');
  const rightClip = additive('SwimRight');
  const upClip = additive('SwimUp');
  const downClip = additive('SwimDown');

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const fwd = mixer.clipAction(need('SwimForward'));
  const fast = mixer.clipAction(need('SwimForwardFast'));
  const breathe = mixer.clipAction(need('BreatheSurface'));
  const jump = mixer.clipAction(jumpClip);
  jump.setLoop(THREE.LoopOnce, 1);
  jump.clampWhenFinished = true;

  const left = mixer.clipAction(leftClip);
  const right = mixer.clipAction(rightClip);
  const up = mixer.clipAction(upClip);
  const down = mixer.clipAction(downClip);
  for (const a of [left, right, up, down]) {
    a.blendMode = THREE.AdditiveAnimationBlendMode;
    a.setEffectiveWeight(0);
    a.play();
  }

  // SwimForward active before any render (rest pose is nose-down).
  fwd.play();
  mixer.update(0);
  group.updateMatrixWorld(true);

  // Runtime measurement (Master §7.1): skinned world-space nose-to-fluke
  // extent along +Z with SwimForward at frame 0. computeBoundingBox() on a
  // SkinnedMesh applies the current bone transforms per vertex.
  mesh.computeBoundingBox();
  const box = mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  const measuredLengthM = box.max.z - box.min.z;

  let base: THREE.AnimationAction = fwd;
  let baseName = 'SwimForward';
  let breatheTimer = 0;
  let airPrev = false;

  const switchBase = (next: THREE.AnimationAction, name: string) => {
    if (next === base) return;
    next.enabled = true;
    next.reset().play();
    base.crossFadeTo(next, XFADE_S, false);
    base = next;
    baseName = name;
  };

  return {
    group,
    measuredLengthM,
    worldBounds(): THREE.Box3 {
      mesh.computeBoundingBox();
      return mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    },
    clipNames: clips.map((c) => c.name),
    activeActionName: () => baseName,
    actionRunning: () => base.isRunning() || jump.isRunning(),
    update(dt: number, pose: DolphinPose): void {
      // --- base-clip state machine ---
      if (pose.phase === 'air') {
        if (!airPrev) {
          jump.reset().play();
          base.crossFadeTo(jump, 0.15, false);
          base = jump;
          baseName = 'Jump';
        }
      } else {
        if (airPrev) {
          // re-entry: recover to the swim loop
          fwd.enabled = true;
          fwd.reset().play();
          base.crossFadeTo(fwd, XFADE_S, false);
          base = fwd;
          baseName = 'SwimForward';
        }
        // surface breathing gate
        const nearSurface = Math.abs(pose.y) < BREATHE_Y && pose.speed < BREATHE_SPEED;
        breatheTimer = nearSurface ? breatheTimer + dt : 0;
        if (base !== jump) {
          if (breatheTimer > BREATHE_HOLD_S) {
            switchBase(breathe, 'BreatheSurface');
          } else if (pose.speed > FAST_ON) {
            switchBase(fast, 'SwimForwardFast');
          } else if (base === fast ? pose.speed < FAST_OFF : true) {
            switchBase(fwd, 'SwimForward');
          }
        }
      }
      airPrev = pose.phase === 'air';

      // --- timeScale: kick cadence, never linear with velocity ---
      // idle below MIN_CONTROL_SPEED = SwimForward at 0.7 (Track C gap-fill)
      const cadence = pose.speed < IDLE_SPEED ? 0 : pose.kickRate;
      const ts = clamp(0.7 + 0.9 * (cadence / KB_KICK_REF_HZ), 0.7, 1.6);
      fwd.timeScale = ts;
      fast.timeScale = ts;

      // --- additive layers: bank sign-selects the turn cycle, pitch rate
      // the pitch cycle; weights bounded 0..1 ---
      const bankW = clamp(Math.abs(pose.bank) / 0.9, 0, 1);
      left.setEffectiveWeight(pose.bank < 0 ? bankW : 0);
      right.setEffectiveWeight(pose.bank > 0 ? bankW : 0);
      const pitchW = clamp(Math.abs(pose.pitchRate) / 1.5, 0, 1);
      up.setEffectiveWeight(pose.pitchRate < 0 ? pitchW : 0);
      down.setEffectiveWeight(pose.pitchRate > 0 ? pitchW : 0);

      mixer.update(dt);
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
