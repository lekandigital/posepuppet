// DolphinPlayer — the BodyArcade dolphin inside Tidewater (Checkpoint 10).
//
// Recreates the approved region-game orchestration (apps/shared-world/src/game/
// regionGame.ts, Master §3.2) as the thing Tidewater's frame calls in place of
// its first-person Player: swim controls → fixed-timestep 120 Hz sim with
// kick-on-first-substep and the post-step obstacle correction → presentation
// transform + animation → chase camera rig writing Tidewater's camera. The eval
// handle (`window.__TIDEWATER_DOLPHIN`) keeps the __SHARED_WORLD shape the
// specs use (state / camera / coverage / RIG / SIM / test.runScript …).
//
// Tidewater remains authoritative for everything the camera sees: this module
// never touches the water, sky, terrain, post or lighting. Its only outputs
// into the host are the dolphin meshes (added to the scene), the camera pose,
// one water-query slot, and splash spray / audio events.
//
// Presentation-only adapters (never read back into the sim; digests unchanged):
//  - waterline: the rig's surface-relative anti-shimmer band samples the
//    Tidewater wave height at the dolphin column through the GPU WaterQuery
//    (1–3 frames latency, low-passed) — the cp05C `waterlineAt` seam;
//  - swell ride (default on, ?noSwellRide to compare): near the surface the
//    rendered dolphin (and the camera target) is lifted by the measured wave
//    height so it sits in Tidewater's actual swell instead of the sim's flat
//    SURFACE_Y plane. Weight 1 within 0.6 m of the surface → 0 at 3 m depth
//    [DERIVED]. The deterministic sim state is untouched.

import { Vector3, MathUtils } from '../../vendor/tidewater/src/engine/index.js';
import { SPRAY } from '../../vendor/tidewater/src/fx/Spray.js';
import { SwimSim, SIM, NEUTRAL_INTENT, type AssistMode, type SwimIntent } from './sim';
import { CameraRig, RIG, type CameraEvalState, type HostCamera } from './cameraRig';
import { loadDolphin, type DolphinActor } from './dolphinActor';
import { createSwimControls, type SwimControls } from '../input/swimControls';
import {
  TidewaterWorldSampler, TidewaterObstacles, TidewaterCameraCollision, WORLD_PARAMS,
  type TerrainDataLike, type ReefLike, type CollidersLike,
} from './tidewaterWorld';
import { CREDITS_ATTRIBUTION } from '../credits';

export interface DolphinHost {
  camera: HostCamera & { position: Vector3; quaternion: { x: number; y: number; z: number; w: number } };
  scene: { add(o: unknown): void; remove(o: unknown): void };
  terrainData: TerrainDataLike;
  reef: ReefLike | null;
  colliders: CollidersLike;
  query: { allocate(name: string, n: number): number; setPoint(i: number, x: number, z: number): void; cpu: Float32Array; cpuValid: boolean };
  spray: { emit(p: Vector3, v: Vector3, count: number, size: number, kind: number, opts?: Record<string, number>): void } | null;
  audio: { splash(strength: number): void; submerge(): void; emerge(): void } | null;
  boatDock: { x: number; z: number; heading: number };
  /** the camera's measured water height (App.cameraWaterHeight) */
  cameraWaterHeight(): number;
}

export interface DolphinOptions {
  /** add the meshes to the scene (false: ?noDolphin parity captures) */
  visible: boolean;
  swellRide: boolean;
  spawn: { x: number; y: number; z: number; yaw: number };
  baseUrl: string;
}

/** [DERIVED] spawn: open bay water ~6.5 m deep south of the pier head, heading north at the island */
export const DEFAULT_SPAWN = { x: 0, y: -2.5, z: 66, yaw: Math.PI };

/** static envelope of the moored boat (8.2 m × ~2.7 m hull + 1.5 m swing margin) [DERIVED] */
const BOAT_HALF_LENGTH = 4.6 + 1.5;
const BOAT_HALF_BEAM = 1.4 + 1.5;

interface ShotMode { pos: [number, number, number]; look: [number, number, number]; fov: number }

export interface EvalState {
  phase: 'swim' | 'air';
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number;
  kickCount: number;
  breachCount: number;
  inWater: boolean;
  shoreDist: number;
  depthHere: number;
  assist: AssistMode;
  tracking: string;
  fps: number;
  simHz: number;
  splashes: number;
  modelLengthM: number;
  animation: { base: string; running: boolean };
  renderY: number;
  waterlineM: number;
}

export class DolphinPlayer {
  readonly actor: DolphinActor;
  readonly sim: SwimSim;
  readonly controls: SwimControls;
  readonly rig: CameraRig;
  readonly sampler: TidewaterWorldSampler;
  readonly obstacles: TidewaterObstacles;
  readonly camCollision: TidewaterCameraCollision;
  readonly querySlot: number;
  readonly opts: DolphinOptions;

  /** viewer surface for Tidewater's wildlife (scares animals like the walker did) */
  readonly viewer = { position: new Vector3(), mode: 'swim' };

  private acc = 0;
  private steps = 0;
  private frames = 0;
  private statAt = 0;
  private fps = 0;
  private simHz = 0;
  private rigUs = 0;
  private rigN = 0;
  private splashes = 0;
  private prevPhase: 'swim' | 'air' = 'swim';
  private prevPitch = 0;
  private wl = 0;
  private wlRaw = 0;
  private wasUnder = false;
  private firstFrame: { actionRunning: boolean; base: string } | null = null;
  private testIntent: Partial<SwimIntent> | null = null;
  private shot: ShotMode | null = null;
  private renderState: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; phase: 'swim' | 'air'; wvx: number; wvy: number; wvz: number; vx: number; vy: number; vz: number } | null = null;
  private readonly tmpV = new Vector3();
  private readonly tmpV2 = new Vector3();
  private readonly corner = new Vector3();
  private readonly handle: Record<string, unknown>;

  private constructor(readonly host: DolphinHost, actor: DolphinActor, opts: DolphinOptions) {
    this.actor = actor;
    this.opts = opts;
    const dock = host.boatDock;
    this.sampler = new TidewaterWorldSampler(host.terrainData, host.reef, [
      { x: dock.x, z: dock.z, r: Math.hypot(BOAT_HALF_LENGTH, BOAT_HALF_BEAM) },
    ]);
    this.sim = new SwimSim(this.sampler);
    this.placeAtSpawn();
    this.controls = createSwimControls();
    this.obstacles = new TidewaterObstacles(host.colliders);
    this.obstacles.addBox(dock.x, dock.z, BOAT_HALF_BEAM, BOAT_HALF_LENGTH, dock.heading, -3, 3, 'boatDock');
    this.camCollision = new TidewaterCameraCollision(this.sampler, host.colliders, RIG.COLLISION_RADIUS, 5);
    this.camCollision.addBox(dock.x, dock.z, BOAT_HALF_BEAM, BOAT_HALF_LENGTH, dock.heading, -3, 3.5);
    this.rig = new CameraRig(host.camera, this.camCollision, {
      terrainCompression: true,
      waterlineAt: () => this.wl,
    });
    this.querySlot = host.query.allocate('dolphin', 1);
    this.prevPitch = this.sim.state.pitch;
    this.statAt = performance.now();

    // assist keys (dolphin parity) + R recenter (cp02) — as regionGame.ts
    addEventListener('keydown', (e) => {
      if (e.key === '1') this.sim.assist = 'full';
      if (e.key === '2') this.sim.assist = 'standard';
      if (e.key === '3') this.sim.assist = 'expert';
      if (e.key === 'r' || e.key === 'R') this.rig.recenter();
    });
    const qa = new URLSearchParams(location.search).get('assist');
    if (qa === 'full' || qa === 'standard' || qa === 'expert') this.sim.assist = qa;

    this.handle = this.buildHandle();
    (window as unknown as { __TIDEWATER_DOLPHIN: unknown }).__TIDEWATER_DOLPHIN = this.handle;
  }

  static async create(host: DolphinHost, opts: DolphinOptions): Promise<DolphinPlayer> {
    const actor = await loadDolphin(`${opts.baseUrl}models/dolphin/dolphin.glb`);
    console.log(
      `[tidewater-dolphin] dolphin measured nose-to-fluke length: ` +
      `${actor.measuredLengthM.toFixed(3)} m (expected 2.89 ± 2 %; BL policy: measure, never rescale)`,
    );
    const p = new DolphinPlayer(host, actor, opts);
    if (opts.visible) host.scene.add(actor.group);
    p.applyPresentation(0);
    return p;
  }

  private placeAtSpawn(): void {
    const sp = this.opts.spawn;
    this.sim.reset();
    this.sim.state.x = sp.x;
    this.sim.state.y = sp.y;
    this.sim.state.z = sp.z;
    this.sim.state.yaw = sp.yaw;
    this.sim.state.wvx = Math.sin(sp.yaw) * this.sim.state.speed;
    this.sim.state.wvz = Math.cos(sp.yaw) * this.sim.state.speed;
  }

  /** after the host's shader warm-up frames: back to the first-frame state */
  resetToSpawn(): void {
    this.placeAtSpawn();
    this.acc = 0;
    this.prevPhase = 'swim';
    this.prevPitch = 0;
    this.rig.snap();
    this.applyPresentation(0);
    this.actor.model.update(0);
    this.firstFrame = null;
  }

  /** the dolphin's water-query point (before query.update()) */
  queueQueries(): void {
    const s = this.sim.state;
    this.host.query.setPoint(this.querySlot, s.x, s.z);
  }

  private readWaterline(dt: number): void {
    const q = this.host.query;
    if (q.cpuValid) {
      const h = q.cpu[this.querySlot * 4]!;
      if (Number.isFinite(h)) this.wlRaw = h;
    }
    // readbacks arrive every 1–3 frames: a short low-pass hides the steps
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.15) : 1;
    this.wl += (this.wlRaw - this.wl) * k;
  }

  private rideWeight(y: number, phase: 'swim' | 'air'): number {
    if (!this.opts.swellRide || phase === 'air') return 0;
    return 1 - MathUtils.smoothstep(-y, 0.6, 3.0);
  }

  /** presentation transform + animation (sim → actor); returns the render state */
  private applyPresentation(frameDt: number, kickRate = 0) {
    const s = this.sim.state;
    const ride = this.rideWeight(s.y, s.phase);
    const renderY = s.y + ride * this.wl;
    // (Object3D defines position / rotation in its constructor — not visible to JS inference)
    const g = this.actor.group as unknown as {
      position: Vector3; rotation: { set(x: number, y: number, z: number): void };
      rotateY(a: number): void; rotateX(a: number): void; rotateZ(a: number): void; updateMatrixWorld(f: boolean): void;
    };
    g.position.set(s.x, renderY, s.z);
    g.rotation.set(0, 0, 0);
    g.rotateY(s.yaw);
    g.rotateX(s.pitch);
    g.rotateZ(-s.roll);
    g.updateMatrixWorld(true);
    const pitchRate = frameDt > 0 ? (s.pitch - this.prevPitch) / frameDt : 0;
    this.prevPitch = s.pitch;
    this.actor.update(frameDt, {
      speed: s.speed,
      kickRate,
      bank: s.roll,
      pitchRate,
      y: s.y,
      phase: s.phase,
    });
    this.viewer.position.set(s.x, renderY, s.z);
    this.renderState = {
      x: s.x, y: renderY, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, phase: s.phase,
      wvx: s.wvx, wvy: s.wvy, wvz: s.wvz, vx: s.vx, vy: s.vy, vz: s.vz,
    };
    return this.renderState;
  }

  /**
   * One host frame. paused (free camera / shot mode): no sim steps and the
   * camera is left to its owner; the animation keeps cycling.
   */
  update(dtS: number, { paused = false } = {}): void {
    const now = performance.now();
    const dtMs = Math.min(100, dtS * 1000);
    const live = this.controls.intent(dtMs);
    const intent: SwimIntent = this.testIntent ? { ...live, ...this.testIntent } : live;

    this.readWaterline(dtS);

    if (!paused && !this.shot) {
      this.acc += dtMs / 1000;
      let kicksLeft = intent.kicks;
      while (this.acc >= SIM.DT) {
        const px = this.sim.state.x, py = this.sim.state.y, pz = this.sim.state.z;
        this.sim.step({ ...intent, kicks: kicksLeft }, SIM.DT);
        this.obstacles.correct(px, py, pz, this.sim.state);
        kicksLeft = 0;
        this.acc -= SIM.DT;
        this.steps++;
        if (this.sim.state.splashed) {
          this.splashes++;
          this.onSplash(0.6);
        }
      }
    } else {
      this.acc = 0;
    }

    const s = this.sim.state;
    if (this.prevPhase !== s.phase) {
      if (s.phase === 'air') this.onSplash(1.0);
      this.prevPhase = s.phase;
    }

    const rs = this.applyPresentation(dtS, intent.kickRate);
    if (this.firstFrame === null) {
      this.firstFrame = { actionRunning: this.actor.actionRunning(), base: this.actor.activeActionName() };
    }

    // --- camera (presentation-only; follows the rendered dolphin) ---
    if (this.shot) {
      const cam = this.host.camera;
      cam.position.set(this.shot.pos[0], this.shot.pos[1], this.shot.pos[2]);
      cam.up.set(0, 1, 0);
      cam.fov = this.shot.fov;
      cam.updateProjectionMatrix();
      cam.lookAt(this.tmpV.set(this.shot.look[0], this.shot.look[1], this.shot.look[2]));
    } else if (!paused) {
      const t0 = performance.now();
      this.rig.update(rs as never, dtS);
      this.rigUs += (performance.now() - t0) * 1000;
      this.rigN++;
    }

    // camera submerge / emerge (Tidewater's own transition sounds, as its swimmer played them)
    const under = this.host.camera.position.y < this.host.cameraWaterHeight() - 0.05;
    if (under !== this.wasUnder && this.host.audio && this.frames > 2) {
      if (under) this.host.audio.submerge(); else this.host.audio.emerge();
    }
    this.wasUnder = under;

    this.frames++;
    if (now - this.statAt > 1000) {
      this.fps = (this.frames * 1000) / (now - this.statAt);
      this.simHz = (this.steps * 1000) / (now - this.statAt);
      if (this.rigN > 0) this.rig.updateUsAvg = this.rigUs / this.rigN;
      this.frames = 0; this.steps = 0; this.rigUs = 0; this.rigN = 0;
      this.statAt = now;
    }
  }

  /** breach / re-entry: Tidewater's native spray emitter (the whale's splash recipe, scaled) + audio */
  private onSplash(strength: number): void {
    const s = this.sim.state;
    if (this.host.audio) this.host.audio.splash(strength);
    const spray = this.host.spray;
    if (!spray) return;
    const p = this.tmpV.set(s.x, this.wl + 0.1, s.z);
    const vx = s.phase === 'air' ? s.vx : s.wvx, vz = s.phase === 'air' ? s.vz : s.wvz;
    const vyAbs = Math.abs(s.phase === 'air' ? s.vy : s.wvy);
    for (let k = 0; k < 2; k++) {
      const vel = this.tmpV2.set(vx * 0.4 + (Math.random() - 0.5) * 2, 2.5 + vyAbs * 0.5 + Math.random() * 2, vz * 0.4 + (Math.random() - 0.5) * 2);
      spray.emit(p, vel, 12 * strength, 0.18, SPRAY.SPRAY, { spread: 1.8, jitter: 0.5, life: 1.8, sizeJitter: 0.7 });
      spray.emit(p, vel, 22 * strength, 0.02, SPRAY.DROPLET, { spread: 2.2, jitter: 0.4, life: 1.6 });
    }
  }

  // ---------------------------------------------------------------- eval / test surface

  private coverage() {
    const box = this.actor.worldBounds();
    const cam = this.host.camera as unknown as { projectionMatrix: unknown; matrixWorldInverse: unknown };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, behindCamera = false;
    for (let i = 0; i < 8; i++) {
      this.corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      (this.corner as unknown as { project(c: unknown): void }).project(cam);
      // reversed-Z WebGPU clip: visible depth is 0..1 (1 = near); treat outside as behind
      if (this.corner.z > 1 || this.corner.z < 0) behindCamera = true;
      minX = Math.min(minX, this.corner.x); maxX = Math.max(maxX, this.corner.x);
      minY = Math.min(minY, this.corner.y); maxY = Math.max(maxY, this.corner.y);
    }
    return {
      widthFrac: (maxX - minX) / 2,
      heightFrac: (maxY - minY) / 2,
      centerXFrac: ((minX + maxX) / 2 + 1) / 2,
      centerHeightFrac: ((minY + maxY) / 2 + 1) / 2,
      behindCamera,
    };
  }

  state(): EvalState {
    const s = this.sim.state;
    return {
      phase: s.phase,
      x: s.x, y: s.y, z: s.z,
      yaw: s.yaw, pitch: s.pitch, roll: s.roll,
      speed: s.speed,
      kickCount: s.kickCount,
      breachCount: s.breachCount,
      inWater: this.sim.inWater(s.x, s.z),
      shoreDist: this.sim.shoreDistance(s.x, s.z),
      depthHere: this.sim.depthAt(s.x, s.z),
      assist: this.sim.assist,
      tracking: this.controls.hudState().tracking,
      fps: this.fps,
      simHz: this.simHz,
      splashes: this.splashes,
      modelLengthM: this.actor.measuredLengthM,
      animation: { base: this.actor.activeActionName(), running: this.actor.actionRunning() },
      renderY: this.renderState ? this.renderState.y : s.y,
      waterlineM: this.wl,
    };
  }

  private buildHandle() {
    const self = this;
    return {
      state: () => this.state(),
      transport: () => this.controls.debug(),
      hud: () => this.controls.hudState(),
      credits: CREDITS_ATTRIBUTION,
      firstFrame: () => this.firstFrame,
      camera: (): CameraEvalState => this.rig.evalState(this.sim.state),
      coverage: () => this.coverage(),
      RIG,
      SIM,
      WORLD_PARAMS,
      world: {
        buildMs: this.sampler.buildMs,
        stats: this.sampler.stats,
        terrainHeight: (x: number, z: number) => this.sampler.terrainHeight(x, z),
        inWater: (x: number, z: number) => this.sampler.inWater(x, z),
        shoreDistance: (x: number, z: number) => this.sampler.shoreDistance(x, z),
        depthAt: (x: number, z: number) => this.sampler.depthAt(x, z),
        obstacleStats: () => ({ ...this.obstacles.stats }),
        cameraClearanceM: () => this.camCollision.lastClearanceM,
      },
      model: {
        clipNames: this.actor.clipNames,
        measuredLengthM: this.actor.measuredLengthM,
        joints: this.actor.model.joints,
        bounds: () => { const b = this.actor.worldBounds(); return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] }; },
        layers: () => (this.actor.model.layers as { clip: { name: string }; weight: number; time: number; speed: number; target: number }[]).map((l) => ({ clip: l.clip.name, weight: l.weight, time: l.time, speed: l.speed, target: l.target })),
        additive: () => this.actor.model.additive.map((l: { name: string; weight: number; time: number }) => ({ clip: l.name, weight: l.weight, time: l.time })),
      },
      test: {
        shotMode(o: ShotMode | null) {
          self.shot = o;
          if (!o) {
            self.host.camera.fov = RIG.FOV;
            self.host.camera.updateProjectionMatrix();
          }
        },
        setIntent(p: Partial<SwimIntent> | null) { self.testIntent = p; },
        setAssist(a: AssistMode) { self.sim.assist = a; },
        teleport(x: number, z: number, y = -2.5) { self.sim.state.x = x; self.sim.state.z = z; self.sim.state.y = y; },
        setYaw(yaw: number) {
          self.sim.state.yaw = yaw;
          const sp = Math.hypot(self.sim.state.wvx, self.sim.state.wvz);
          self.sim.state.wvx = Math.sin(yaw) * sp;
          self.sim.state.wvz = Math.cos(yaw) * sp;
        },
        placeAndFace(x: number, z: number, y: number, yaw: number, speed = 4) {
          const s = self.sim.state;
          s.x = x; s.z = z; s.y = y; s.yaw = yaw; s.pitch = 0; s.roll = 0; s.speed = speed;
          s.wvx = Math.sin(yaw) * speed; s.wvz = Math.cos(yaw) * speed; s.wvy = 0;
          self.rig.snap();
        },
        snapCamera() { self.rig.snap(); },
        resetToSpawn() { self.resetToSpawn(); },
        setVisible(v: boolean) { self.actor.setVisible(v); },
        setSwellRide(v: boolean) { self.opts.swellRide = v; },
        contactState() { return self.sim.contactState(); },
        /** deterministic replay — the cp04A/cp05C contract verbatim (fresh sim at spawn; digest format shared) */
        runScript(script: { steps: number; intent: Partial<SwimIntent> }[], withObstacles = true): string {
          const local = new SwimSim(self.sampler);
          const sp = self.opts.spawn;
          local.state.x = sp.x; local.state.y = sp.y; local.state.z = sp.z; local.state.yaw = sp.yaw;
          local.state.wvx = Math.sin(sp.yaw) * local.state.speed;
          local.state.wvz = Math.cos(sp.yaw) * local.state.speed;
          const obstacles = withObstacles ? new TidewaterObstacles(self.host.colliders) : null;
          if (obstacles) obstacles.addBox(self.host.boatDock.x, self.host.boatDock.z, BOAT_HALF_BEAM, BOAT_HALF_LENGTH, self.host.boatDock.heading, -3, 3, 'boatDock');
          const parts: string[] = [];
          for (const seg of script) {
            const intent = { ...NEUTRAL_INTENT, ...seg.intent };
            for (let i = 0; i < seg.steps; i++) {
              const px = local.state.x, py = local.state.y, pz = local.state.z;
              local.step(intent);
              if (obstacles) obstacles.correct(px, py, pz, local.state);
            }
            const st = local.state;
            parts.push(`${st.x.toFixed(6)},${st.y.toFixed(6)},${st.z.toFixed(6)},${st.yaw.toFixed(6)},${st.speed.toFixed(6)},${st.kickCount},${st.breachCount}`);
          }
          return parts.join('|');
        },
        /** containment run (cp04A parity): fresh sim, burst along yaw, samples every 0.2 s */
        containmentRun(yaw: number, seconds = 11, intentOverride: Partial<SwimIntent> = {}, start?: { x: number; z: number; y?: number }) {
          const local = new SwimSim(self.sampler);
          const sp = self.opts.spawn;
          local.state.x = start?.x ?? sp.x; local.state.z = start?.z ?? sp.z; local.state.y = start?.y ?? -2.5; local.state.yaw = yaw;
          local.state.wvx = Math.sin(yaw) * local.state.speed; local.state.wvz = Math.cos(yaw) * local.state.speed;
          const intent: SwimIntent = { ...NEUTRAL_INTENT, burst: true, ...intentOverride };
          const samples: { t: number; x: number; y: number; z: number; depth: number; inWater: boolean; shore: number; speed: number }[] = [];
          const steps = Math.round(seconds / SIM.DT), every = Math.round(0.2 / SIM.DT);
          for (let k = 0; k <= steps; k++) {
            if (k > 0) local.step(intent);
            if (k % every === 0) samples.push({ t: k * SIM.DT, x: local.state.x, y: local.state.y, z: local.state.z, depth: local.depthAt(local.state.x, local.state.z), inWater: local.inWater(local.state.x, local.state.z), shore: local.shoreDistance(local.state.x, local.state.z), speed: local.state.speed });
          }
          return samples;
        },
        projectPoints(pts: [number, number, number][]) {
          const cam = self.host.camera as unknown as { projectionMatrix: unknown };
          const v = new Vector3() as unknown as { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } };
          return pts.map(([x, y, z]) => {
            const p = v.set(x, y, z).project(cam);
            return { px: (p.x * 0.5 + 0.5) * innerWidth, py: (1 - (p.y * 0.5 + 0.5)) * innerHeight, inFront: p.z > 0 && p.z < 1 };
          });
        },
      },
    };
  }
}
