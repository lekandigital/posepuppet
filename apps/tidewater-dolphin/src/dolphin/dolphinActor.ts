// The GAMICO dolphin: GLB load, the Master §7.6 animation controller
// over the 8 measured clips, and the runtime body-length measurement
// (BL policy, Master §7.1 — measure, never rescale).
//
// Track C operational law: the rest pose renders nose-down — an
// animation MUST be running before the first rendered frame, so
// loadDolphin() returns only after SwimForward is playing and applied.
// The Jump clip bakes ~2 m of Dolphin_Root translation; that track is
// stripped at load so gameplay code owns breach motion.
//
// CP10 (Tidewater host): ported from apps/shared-world/src/game/dolphinActor.ts.
// The GLTFLoader / AnimationMixer / SkinnedMesh of three.js are replaced by
// Tidewater's own engine loader (engine/loaders/GLTF.js) and GPU skinning
// (engine/render/Skinning.js) through DolphinSkinnedModel, which adds the
// additive layers three.js provided. Every constant, the state machine, the
// crossfade durations, the timeScale law and the additive weighting below are
// the approved values, unchanged. The model renders through Tidewater's native
// material / shadow / motion-vector / underwater-lighting pipeline (glTF PBR:
// base colour, ORM, normal map, double-sided; plus the ORM-red ambient
// occlusion three.js applied through aoMap, so the shading matches).

import { Group, Box3, Vector3 } from '../../vendor/tidewater/src/engine/index.js';
import { loadGLB } from '../../vendor/tidewater/src/engine/loaders/GLTF.js';
import { DolphinSkinnedModel } from './DolphinSkinnedModel.js';

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
  group: Group;
  /** the engine skinned model (meshes are children of group) */
  model: DolphinSkinnedModel;
  /** nose-to-fluke world extent along +Z, SwimForward frame 0, metres */
  measuredLengthM: number;
  /** posed skinned-mesh AABB in world space (cp02 coverage-band probe) */
  worldBounds(): Box3;
  clipNames: string[];
  /** name of the current base animation layer */
  activeActionName(): string;
  /** is any animation layer currently running? */
  actionRunning(): boolean;
  update(dt: number, pose: DolphinPose): void;
  /** show / hide the meshes (parity captures render the environment alone) */
  setVisible(v: boolean): void;
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
const JUMP_XFADE_S = 0.15;  // air entry cross-fade (dolphinActor.ts, unchanged)

interface GltfChannel { node: number; path: string; times: Float32Array; values: Float32Array; step: boolean }
interface GltfClip { name: string; duration: number; channels: GltfChannel[] }

export async function loadDolphin(url: string): Promise<DolphinActor> {
  const gltf = await loadGLB(url);
  const clips: GltfClip[] = gltf.animations;
  const byName = new Map(clips.map((c) => [c.name, c]));
  const need = (name: string): GltfClip => {
    const c = byName.get(name);
    if (!c) throw new Error(`dolphin.glb: missing clip ${name}`);
    return c;
  };
  for (const n of ['SwimForward', 'SwimForwardFast', 'SwimLeft', 'SwimRight', 'SwimUp', 'SwimDown', 'BreatheSurface', 'Jump']) need(n);

  // Strip the Jump clip's baked root translation (Track C Item 3 gotcha 2):
  // gameplay code moves the dolphin; the clip keeps rotations only. (three.js
  // filtered the `Dolphin_Root.position` track; here it is the translation
  // channel targeting the Dolphin_Root node — the same data.)
  const jump = need('Jump');
  const rootNodes = new Set(gltf.nodes.map((n: { name: string }, i: number) => (n.name.includes('Dolphin_Root') ? i : -1)).filter((i: number) => i >= 0));
  const strippedJump: GltfClip = {
    ...jump,
    channels: jump.channels.filter((ch) => !(ch.path === 'translation' && rootNodes.has(ch.node))),
  };
  if (strippedJump.channels.length === jump.channels.length) throw new Error('dolphin.glb: Jump root translation track not found');
  gltf.animations = clips.map((c) => (c === jump ? strippedJump : c));

  // ORM red = occlusion (the glTF occlusionTexture is the metallicRoughness
  // texture here); three.js applied it as aoMap on TEXCOORD_1 (identical to
  // TEXCOORD_0 in this asset). Tidewater's default glTF surface skips AO.
  const model = await DolphinSkinnedModel.create(gltf, {
    materials: () => ({
      surface: /* wgsl */ `
#if HAS_ORM
	s.ao *= orm.r;
#endif
`,
    }),
  } as never);
  const group = new Group();
  group.name = 'dolphin';
  group.add(model.group);

  // Additive bank/pitch layers (three.js makeClipAdditive semantics; see
  // DolphinSkinnedModel). Created BEFORE the first pose, like the actions.
  const left = model.addAdditive('SwimLeft');
  const right = model.addAdditive('SwimRight');
  const up = model.addAdditive('SwimUp');
  const down = model.addAdditive('SwimDown');

  // SwimForward active before any render (rest pose is nose-down).
  model.play('SwimForward', { fade: XFADE_S, loop: true, speed: 1, from: 0 });
  model.update(0);
  group.updateMatrixWorld(true);

  // Runtime measurement (Master §7.1): skinned world-space nose-to-fluke
  // extent along +Z with SwimForward at frame 0 (CPU skinning with this
  // frame's joint matrices — the computeBoundingBox() equivalent).
  const b0 = model.skinnedBounds(group.matrixWorld);
  const measuredLengthM = b0.max[2] - b0.min[2];

  let baseName = 'SwimForward';
  let breatheTimer = 0;
  let airPrev = false;

  const speedOf = (name: string, ts: number) => {
    for (const l of model.layers as { clip: { name: string }; speed: number }[]) if (l.clip.name === name) l.speed = ts;
  };

  const switchBase = (name: string, fade = XFADE_S, loop = true) => {
    if (name === baseName) return;
    model.play(name, { fade, loop, speed: 1, from: 0 });
    baseName = name;
  };

  return {
    group,
    model,
    measuredLengthM,
    worldBounds(): Box3 {
      group.updateMatrixWorld(true);
      const b = model.skinnedBounds(group.matrixWorld);
      return new Box3(new Vector3(b.min[0], b.min[1], b.min[2]), new Vector3(b.max[0], b.max[1], b.max[2]));
    },
    clipNames: clips.map((c) => c.name),
    activeActionName: () => baseName,
    actionRunning: () => model.layers.length > 0,
    setVisible(v: boolean) {
      for (const m of model.meshes as { visible: boolean }[]) m.visible = v;
    },
    update(dt: number, pose: DolphinPose): void {
      // --- base-clip state machine ---
      if (pose.phase === 'air') {
        if (!airPrev) {
          // jump.reset().play(); base.crossFadeTo(jump, 0.15); LoopOnce + clampWhenFinished
          model.play('Jump', { fade: JUMP_XFADE_S, loop: false, speed: 1, from: 0 });
          baseName = 'Jump';
        }
      } else {
        if (airPrev) {
          // re-entry: recover to the swim loop
          model.play('SwimForward', { fade: XFADE_S, loop: true, speed: 1, from: 0 });
          baseName = 'SwimForward';
        }
        // surface breathing gate
        const nearSurface = Math.abs(pose.y) < BREATHE_Y && pose.speed < BREATHE_SPEED;
        breatheTimer = nearSurface ? breatheTimer + dt : 0;
        if (baseName !== 'Jump') {
          if (breatheTimer > BREATHE_HOLD_S) {
            switchBase('BreatheSurface');
          } else if (pose.speed > FAST_ON) {
            switchBase('SwimForwardFast');
          } else if (baseName === 'SwimForwardFast' ? pose.speed < FAST_OFF : true) {
            switchBase('SwimForward');
          }
        }
      }
      airPrev = pose.phase === 'air';

      // --- timeScale: kick cadence, never linear with velocity ---
      // idle below MIN_CONTROL_SPEED = SwimForward at 0.7 (Track C gap-fill)
      const cadence = pose.speed < IDLE_SPEED ? 0 : pose.kickRate;
      const ts = clamp(0.7 + 0.9 * (cadence / KB_KICK_REF_HZ), 0.7, 1.6);
      speedOf('SwimForward', ts);
      speedOf('SwimForwardFast', ts);

      // --- additive layers: bank sign-selects the turn cycle, pitch rate
      // the pitch cycle; weights bounded 0..1 ---
      const bankW = clamp(Math.abs(pose.bank) / 0.9, 0, 1);
      left.weight = pose.bank < 0 ? bankW : 0;
      right.weight = pose.bank > 0 ? bankW : 0;
      const pitchW = clamp(Math.abs(pose.pitchRate) / 1.5, 0, 1);
      up.weight = pose.pitchRate < 0 ? pitchW : 0;
      down.weight = pose.pitchRate > 0 ? pitchW : 0;

      model.update(dt);
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
