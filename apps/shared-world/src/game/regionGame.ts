// Checkpoint 04B — the region game shell (`?view=region`): the approved
// Twin Bay baked region becomes the water container. Recreates the pool
// shell's orchestration (fixed-timestep accumulator, kick-on-first-substep,
// eval handle, fps/simHz counters — the dolphin pattern, Master §3.2)
// around the app-owned region water pipeline:
//
//   RegionWater  — vendored sim shaders on the 512² player-following window
//   RegionRenderer — caustics / terrain / surface passes (container swap)
//
// The dolphin, sim, swim controls and cp02 camera rig are the approved
// cp01/cp02 systems on RegionSampler (cp04A), unmodified. Water interaction
// stays the sanctioned displacement-input path: the 3-sphere spine
// compound emitter (cp01 §6.2) through RegionWater.moveSphereWorld, breach
// splashes through addDropWorld — physical radii/amplitudes carry the
// approved pool calibration ×K (see the conversion notes below).

import * as THREE from 'three';
import { loadSceneAssets } from '../../vendor/threejs-water/src/app/LoadSceneAssets';
import { RegionWater, WINDOW_SIZE_M, WINDOW_TEXEL_M, SIM_UNIT_M } from '../water/RegionWater';
import { RegionRenderer } from '../water/RegionRenderer';
import { WorldData } from '../world/WorldData';
import { RegionSampler } from '../world/RegionSampler';
import { SwimSim, SIM, NEUTRAL_INTENT, type AssistMode, type SwimIntent } from './sim';
import type { WorldSampler } from './worldSampler';
import { CameraRig, RIG, type CameraEvalState } from './cameraRig';
import { RegionCameraCollision } from './regionCameraCollision';
import { TerrainBvh } from './terrainBvh';
import {
  TILES,
  CELLS_PER_TILE,
  LOD_STEPS,
  LOD_DISTANCES_M,
  SKIRT_DROP_M,
} from '../water/RegionTerrainPass';
import { loadDolphin } from './dolphinActor';
import { substrateSampleCpu } from '../world/substrateCpu';
import { createSwimControls } from '../input/swimControls';
import { CREDITS_ATTRIBUTION } from '../credits';
import { K, type EvalState } from './game';

/** Region far plane (Master §7.5 [DERIVED]: region diagonal 2.83 km). */
const REGION_FAR = 2500;

/** cp01 §6.2 compound emitter: 3 spheres along the spine (unchanged). */
const SPINE_OFFSETS_M = [1.0, 0, -1.0];
/**
 * Region emitter radius [DERIVED texel-scale adaptation, reported]: the
 * pool's 0.45 m spheres span 7.7 sim texels at the pool's 5.9 cm texel but
 * are SUB-texel at the window's 0.5 m/texel — the vendored super-Gaussian
 * add/subtract then cancels on the grid and the wake vanishes (measured
 * ≤ 1.6 mm at burst). 3.0 m puts the profile's steep skirt (≈ 0.3·r) at
 * ≈ 1.8 texels so the injection is grid-resolved and free of texel-scale
 * checkerboard energy; the injection MATH is untouched.
 */
const SPHERE_RADIUS_M = 3.0;
/**
 * Emitter gain [DERIVED, tuned against the measured window response and
 * reported]: at the resolved radius the vendored column-volume injection
 * over-drives the 0.5 m grid (3.7 m crest measured at r 1.8/gain 1);
 * the gain lands the burst wake in the pool's ripple family (≈ 0.1–0.15 m
 * crest at 9 m/s, centimeters at cruise) so the surface chop never breaches
 * the camera rig's anti-shimmer band.
 */
const EMITTER_GAIN = 0.025;

/** cp01 breach-splash drops (game.ts): radius/strength in pool demo units
 *  0.08/0.05 and 0.1/0.06 → physical meters ×K (the same splash). */
const DROP_EXIT = { radiusM: 0.08 * 2 * K, amplitudeM: 0.05 * K };
const DROP_ENTRY = { radiusM: 0.1 * 2 * K, amplitudeM: 0.06 * K };

interface ShotMode {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  size: [number, number];
}

export interface StageMs {
  sim: number;
  caustics: number;
  prepare: number;
  render: number;
  frame: number;
}

export interface RegionEvalState extends EvalState {
  windowOrigin: [number, number];
}

export async function startRegionGame(
  root: HTMLElement,
  opts: { debug: boolean },
): Promise<void> {
  const loading = document.getElementById('loading');

  const data = await WorldData.load(`${import.meta.env.BASE_URL}world/`);
  const spawn = data.header.spawn;

  // --- renderer: the vendored demo's own settings (fidelity parity) ---
  const webglRenderer = new THREE.WebGLRenderer({ antialias: true });
  webglRenderer.setPixelRatio(window.devicePixelRatio);
  webglRenderer.setClearColor(0x000000);
  root.appendChild(webglRenderer.domElement);

  const { cubemap } = await loadSceneAssets();
  const water = new RegionWater(webglRenderer, spawn.x, spawn.z);
  const regionRenderer = new RegionRenderer(webglRenderer, cubemap, data, water.windowOrigin);

  const scene = new THREE.Scene();
  // above-water background = the vendored sky the reflections sample (the
  // ONE sky, R11); underwater fog stays the demo's own shader look (cp04B
  // §4: no atmosphere pass)
  scene.background = cubemap;
  for (const m of regionRenderer.sceneMeshes()) scene.add(m);

  // lights for the dolphin only (vendored ShaderMaterials ignore scene
  // lights); direction matches the demo's light — the pool-view discipline
  const lightDir = regionRenderer.lightDir.clone().normalize();
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.copy(lightDir.clone().multiplyScalar(50));
  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x1a3a4a, 0.9);
  scene.add(sun, hemi);

  // --- the dolphin: loaded, SwimForward running, THEN first render ---
  const dolphin = await loadDolphin(`${import.meta.env.BASE_URL}models/dolphin/dolphin.glb`);
  scene.add(dolphin.group);
  console.log(
    `[shared-world] dolphin measured nose-to-fluke length: ` +
    `${dolphin.measuredLengthM.toFixed(3)} m (expected 2.89 ± 2 %; BL policy: measure, never rescale)`,
  );

  // --- sim + controls + camera: the approved systems on RegionSampler ---
  const sampler = new RegionSampler(data);
  const sim = new SwimSim(sampler);
  sim.state.x = spawn.x;
  sim.state.z = spawn.z;
  sim.state.yaw = spawn.yaw;
  sim.state.wvx = Math.sin(spawn.yaw) * sim.state.speed;
  sim.state.wvz = Math.cos(spawn.yaw) * sim.state.speed;
  const controls = createSwimControls();
  // cp05: BVH camera collision (presentation-only — the sim never touches
  // it); spawn neighborhood prebuilt so the first frames pay no build cost
  const bvh = new TerrainBvh(data);
  for (let k = 0; k < 9; k++) bvh.prefetch(spawn.x, spawn.z);
  const camCollision = new RegionCameraCollision(data, bvh, RIG.COLLISION_RADIUS);
  const cam = new CameraRig(innerWidth / innerHeight, camCollision, REGION_FAR, {
    terrainCompression: true,
  });

  const resize = () => {
    webglRenderer.setSize(innerWidth, innerHeight);
    cam.camera.aspect = innerWidth / innerHeight;
    cam.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ambient starting ripples: the demo's seedWater pattern in the window
  water.seedAmbient();

  // assist keys (dolphin parity) + R recenter (cp02)
  addEventListener('keydown', (e) => {
    if (e.key === '1') sim.assist = 'full';
    if (e.key === '2') sim.assist = 'standard';
    if (e.key === '3') sim.assist = 'expert';
    if (e.key === 'r' || e.key === 'R') cam.recenter();
  });
  const qs = new URLSearchParams(location.search);
  const qa = qs.get('assist');
  if (qa === 'full' || qa === 'standard' || qa === 'expert') sim.assist = qa;

  // --- per-stage instrumentation (cp04B §6.4): EXT_disjoint_timer_query
  // where available, else CPU-side stage timing ---
  const gl = webglRenderer.getContext() as WebGL2RenderingContext;
  const timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  const gpuTimer = timerExt ? new GpuStageTimer(gl, timerExt) : null;
  const stageAvg: StageMs = { sim: 0, caustics: 0, prepare: 0, render: 0, frame: 0 };
  const stageAcc: StageMs = { sim: 0, caustics: 0, prepare: 0, render: 0, frame: 0 };
  let stageN = 0;

  // --- eval / test surface (__SHARED_WORLD, the pool shape + region) ---
  let testIntent: Partial<SwimIntent> | null = null;
  let fps = 0;
  let simHz = 0;
  let splashes = 0;
  let firstFrame: { actionRunning: boolean; base: string } | null = null;
  let shot: ShotMode | null = null;
  const stageEnabled = { sim: true, caustics: true, surface: true, terrain: true };

  // cp02 coverage probe (unchanged from the pool shell)
  const corner = new THREE.Vector3();
  const coverage = () => {
    const box = dolphin.worldBounds();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let behindCamera = false;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        )
        .project(cam.camera);
      if (corner.z > 1 || corner.z < -1) behindCamera = true;
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }
    return {
      widthFrac: (maxX - minX) / 2,
      heightFrac: (maxY - minY) / 2,
      centerXFrac: ((minX + maxX) / 2 + 1) / 2,
      centerHeightFrac: ((minY + maxY) / 2 + 1) / 2,
      behindCamera,
    };
  };

  /** cp04A-parity containment run (same contract as region-preview's). */
  function containmentRun(
    yaw: number,
    seconds = 11,
    intentOverride: Partial<SwimIntent> = {},
    start: { x: number; z: number } = { x: spawn.x, z: spawn.z },
  ) {
    const local = new SwimSim(sampler);
    local.state.x = start.x;
    local.state.z = start.z;
    local.state.y = -2.5;
    local.state.yaw = yaw;
    local.state.wvx = Math.sin(yaw) * local.state.speed;
    local.state.wvz = Math.cos(yaw) * local.state.speed;
    const intent: SwimIntent = { ...NEUTRAL_INTENT, burst: true, ...intentOverride };
    const samples: {
      t: number; x: number; z: number; y: number;
      depth: number; inWater: boolean; shore: number; speed: number;
    }[] = [];
    const steps = Math.round(seconds / SIM.DT);
    const every = Math.round(0.2 / SIM.DT);
    for (let s = 0; s <= steps; s++) {
      if (s > 0) local.step(intent);
      if (s % every === 0) {
        samples.push({
          t: s * SIM.DT,
          x: local.state.x,
          z: local.state.z,
          y: local.state.y,
          depth: local.depthAt(local.state.x, local.state.z),
          inWater: local.inWater(local.state.x, local.state.z),
          shore: local.shoreDistance(local.state.x, local.state.z),
          speed: local.state.speed,
        });
      }
    }
    return samples;
  }

  // GPU depth-law probe (cp04B §8.6): sample uHeightTex through the same
  // uv law the shaders use, on the GPU, and read the heights back.
  const gpuHeightProbe = makeGpuHeightProbe(webglRenderer, regionRenderer);

  const handle = {
    state: (): RegionEvalState => ({
      phase: sim.state.phase,
      x: sim.state.x, y: sim.state.y, z: sim.state.z,
      yaw: sim.state.yaw, pitch: sim.state.pitch, roll: sim.state.roll,
      speed: sim.state.speed,
      kickCount: sim.state.kickCount,
      breachCount: sim.state.breachCount,
      inWater: sim.inWater(sim.state.x, sim.state.z),
      shoreDist: sim.shoreDistance(sim.state.x, sim.state.z),
      depthHere: sim.depthAt(sim.state.x, sim.state.z),
      assist: sim.assist,
      tracking: controls.hudState().tracking,
      fps, simHz,
      splashes,
      modelLengthM: dolphin.measuredLengthM,
      animation: { base: dolphin.activeActionName(), running: dolphin.actionRunning() },
      windowOrigin: [water.windowOrigin.x, water.windowOrigin.y],
    }),
    transport: () => controls.debug(),
    credits: CREDITS_ATTRIBUTION,
    firstFrame: () => firstFrame,
    camera: (): CameraEvalState => cam.evalState(sim.state),
    coverage,
    RIG,
    SIM,
    region: {
      header: data.header,
      decodeMs: data.decodeMs,
      decodedBytes: data.decodedBytes(),
      windowTexelM: WINDOW_TEXEL_M,
      windowSizeM: WINDOW_SIZE_M,
      simUnitM: SIM_UNIT_M,
      floatLinearHeightTex: regionRenderer.ctx.floatLinear,
      gpuTimerSource: (timerExt ? 'EXT_disjoint_timer_query_webgl2' : 'cpu') as string,
      stageMs: (): StageMs => ({ ...stageAvg }),
      gpuStageMs: () => (gpuTimer ? gpuTimer.averages() : null),
      windowOrigin: () => [water.windowOrigin.x, water.windowOrigin.y] as [number, number],
      world: {
        terrainHeight: (x: number, z: number) => data.terrainHeight(x, z),
        inWater: (x: number, z: number) => data.inWater(x, z),
        shoreDistance: (x: number, z: number) => data.shoreDistance(x, z),
        depthAt: (x: number, z: number) => data.depthAt(x, z),
      },
      gpuHeightProbe: (pts: [number, number][]) => gpuHeightProbe(pts),
      simTexProbe: () => water.probeSimTexture(),
      // --- cp05 terrain instrumentation ---
      terrain: {
        constants: {
          tiles: TILES,
          cellsPerTile: CELLS_PER_TILE,
          tileSizeM: regionRenderer.terrain.tileSizeM,
          lodSteps: [...LOD_STEPS],
          lodDistancesM: [...LOD_DISTANCES_M],
          skirtDropM: SKIRT_DROP_M,
        },
        buildMs: regionRenderer.terrain.buildMs,
        stats: () => regionRenderer.terrain.terrainStats(),
        lodMap: () => regionRenderer.terrain.lodMap(),
        tiles: () =>
          regionRenderer.terrain.tiles.map((t) => ({
            i: t.i,
            j: t.j,
            minH: t.minH,
            maxH: t.maxH,
            protected: t.protected,
            protectReason: t.protectReason,
            lod: t.lod,
            visible: t.visible,
          })),
        bvhStats: () => ({ ...bvh.stats }),
        cameraClearanceM: () => camCollision.lastClearanceM,
      },
    },
    test: {
      /** fixed-camera fidelity-shot mode (cp04B §8.1); null restores */
      shotMode(optsIn: ShotMode | null) {
        shot = optsIn;
        if (optsIn) {
          webglRenderer.setSize(optsIn.size[0], optsIn.size[1]);
        } else {
          cam.camera.fov = RIG.FOV;
          resize();
        }
      },
      setIntent(p: Partial<SwimIntent> | null) { testIntent = p; },
      setAssist(a: AssistMode) { sim.assist = a; },
      teleport(x: number, z: number, y = -2.5) {
        sim.state.x = x; sim.state.z = z; sim.state.y = y;
      },
      setYaw(yaw: number) {
        sim.state.yaw = yaw;
        const sp = Math.hypot(sim.state.wvx, sim.state.wvz);
        sim.state.wvx = Math.sin(yaw) * sp;
        sim.state.wvz = Math.cos(yaw) * sp;
      },
      /** per-stage visibility toggles for frame-budget attribution */
      setStageEnabled(patch: Partial<typeof stageEnabled>) {
        Object.assign(stageEnabled, patch);
        regionRenderer.surface.setVisible(stageEnabled.surface);
        regionRenderer.terrain.setVisible(stageEnabled.terrain);
      },
      setSurfaceVisible(v: boolean) {
        stageEnabled.surface = v;
        regionRenderer.surface.setVisible(v);
      },
      /** cp05A: render raw classification albedo on the terrain (no
       *  lighting) — the probe surface the CPU twin compares against */
      setAlbedoDebug(v: boolean) {
        regionRenderer.terrain.setAlbedoDebug(v);
      },
      /** cp05A: the classification CPU twin at world points (albedo,
       *  dominant family, classifier inputs) */
      substrateProbe(pts: [number, number][]) {
        return pts.map(([x, z]) => substrateSampleCpu(data, x, z));
      },
      /** cp05A structural audit: every terrain-consuming fragment shader
       *  must carry the ONE substrate include (addendum §4.7 equivalence
       *  by construction — direct, refracted and reflected paths) */
      substrateShaderAudit() {
        // code-level markers (comments may be stripped by the glsl plugin):
        // the classification entry point and the deleted cp05 tint law
        const marker = 'substrateAlbedo(';
        const legacyTint = 'terrainTint(';
        const water = regionRenderer.surface.fragmentSources();
        const terrain = regionRenderer.terrain.fragmentSource();
        return {
          terrainHasSubstrate: terrain.includes(marker),
          waterAboveHasSubstrate: water.above.includes(marker),
          waterBelowHasSubstrate: water.below.includes(marker),
          anyLegacyTintLaw:
            terrain.includes(legacyTint) ||
            water.above.includes(legacyTint) ||
            water.below.includes(legacyTint),
        };
      },
      /** re-run the demo's ambient seeding in the current window (the
       *  four-shot procedure matches the stock demo's post-seed state) */
      seedAmbient() { water.seedAmbient(); },
      /** project world points through the live camera → pixel coords */
      projectPoints(pts: [number, number, number][]) {
        const size = new THREE.Vector2();
        webglRenderer.getSize(size);
        const v = new THREE.Vector3();
        return pts.map(([x, y, z]) => {
          v.set(x, y, z).project(cam.camera);
          return {
            px: (v.x * 0.5 + 0.5) * size.x,
            py: (1 - (v.y * 0.5 + 0.5)) * size.y,
            inFront: v.z > -1 && v.z < 1,
          };
        });
      },
      containmentRun,
      /**
       * cp05 slide/contact scenario (deterministic, sim-only): a fresh sim
       * launched at a chosen pose swims a fixed intent against the real
       * baked terrain; per-step displacement is tracked for the jitter
       * bound, samples every 0.05 s for the slide-retention analysis.
       */
      contactRun(opts: {
        x: number;
        z: number;
        y: number;
        yaw: number;
        speed?: number;
        seconds?: number;
        intent?: Partial<SwimIntent>;
        assist?: AssistMode;
      }) {
        const local = new SwimSim(sampler);
        local.assist = opts.assist ?? 'expert';
        local.state.x = opts.x;
        local.state.z = opts.z;
        local.state.y = opts.y;
        local.state.yaw = opts.yaw;
        local.state.speed = opts.speed ?? 5;
        local.state.wvx = Math.sin(opts.yaw) * local.state.speed;
        local.state.wvz = Math.cos(opts.yaw) * local.state.speed;
        const intent: SwimIntent = { ...NEUTRAL_INTENT, ...(opts.intent ?? {}) };
        const seconds = opts.seconds ?? 8;
        const steps = Math.round(seconds / SIM.DT);
        const every = Math.round(0.05 / SIM.DT);
        let maxStepDispM = 0;
        let firstContactT = -1;
        const samples: {
          t: number; x: number; y: number; z: number;
          speed: number; dispSpeed: number; inContact: boolean; wedgeT: number;
        }[] = [];
        for (let k = 0; k <= steps; k++) {
          if (k > 0) {
            const bx = local.state.x;
            const by = local.state.y;
            const bz = local.state.z;
            local.step(intent);
            const d = Math.hypot(local.state.x - bx, local.state.y - by, local.state.z - bz);
            if (d > maxStepDispM) maxStepDispM = d;
          }
          const cs = local.contactState();
          if (cs.inContact && firstContactT < 0) firstContactT = k * SIM.DT;
          if (k % every === 0) {
            samples.push({
              t: k * SIM.DT,
              x: local.state.x,
              y: local.state.y,
              z: local.state.z,
              speed: local.state.speed,
              dispSpeed: cs.dispSpeed,
              inContact: cs.inContact,
              wedgeT: cs.wedgeT,
            });
          }
        }
        return { samples, maxStepDispM, firstContactT, dt: SIM.DT };
      },
      /**
       * cp05 anti-wedge mechanism scenario: the baked region offers no
       * guaranteed tight concave pocket at dolphin scale yet (caves are
       * cp09), so the wedge detector/escape runs against a deterministic
       * analytic V-pocket sampler (45° walls + closed end — two contact
       * normals 90° apart). The SIM CODE under test is the real SwimSim;
       * only the terrain is synthetic. Reported as such.
       */
      wedgeMechanismRun() {
        const pocketHeight = (x: number, z: number) =>
          -30 + Math.abs(x) + Math.max(0, z);
        const pocket: WorldSampler = {
          inWater: () => true,
          shoreDistance: () => 1000,
          depthAt: (x: number, z: number) => Math.max(0, -pocketHeight(x, z)),
          terrainHeight: pocketHeight,
        };
        const local = new SwimSim(pocket);
        local.assist = 'expert';
        local.state.x = 0;
        local.state.z = -8;
        local.state.y = -28.5;
        local.state.yaw = 0; // +z: into the pocket's closed end
        local.state.speed = 1.5;
        local.state.wvx = 0;
        local.state.wvz = 1.5;
        const steps = Math.round(12 / SIM.DT);
        const every = Math.round(0.05 / SIM.DT);
        let wedgeOnsetT = -1;
        let escapeT = -1;
        const samples: {
          t: number; x: number; y: number; z: number;
          dispSpeed: number; wedgeT: number; clearanceM: number;
        }[] = [];
        for (let k = 0; k <= steps; k++) {
          if (k > 0) local.step(NEUTRAL_INTENT);
          const cs = local.contactState();
          const t = k * SIM.DT;
          const h = pocketHeight(local.state.x, local.state.z);
          const clearanceM = local.state.y - h;
          if (cs.wedgeT > SIM.WEDGE_TIME_S && wedgeOnsetT < 0) wedgeOnsetT = t;
          if (wedgeOnsetT >= 0 && escapeT < 0 && cs.wedgeT === 0 && clearanceM > SIM.CONTACT_PROBE) {
            escapeT = t;
          }
          if (k % every === 0) {
            samples.push({
              t,
              x: local.state.x,
              y: local.state.y,
              z: local.state.z,
              dispSpeed: cs.dispSpeed,
              wedgeT: cs.wedgeT,
              clearanceM,
            });
          }
        }
        return { samples, wedgeOnsetT, escapeT };
      },
      /**
       * cp05 crack-scan aid: paint the scene background a flat color so
       * background pixels are exactly detectable in captures (test-only;
       * null restores the vendored cubemap — approved visuals untouched
       * outside the scan).
       */
      setFlatBackground(hex: number | null) {
        scene.background = hex === null ? cubemap : new THREE.Color(hex);
      },
      /** deterministic region replay — the cp04A region-preview contract
       *  verbatim (fresh sim at the approved spawn; digest format shared) */
      runScript(script: { steps: number; intent: Partial<SwimIntent> }[]): string {
        const local = new SwimSim(new RegionSampler(data));
        local.state.x = spawn.x;
        local.state.z = spawn.z;
        const parts: string[] = [];
        for (const seg of script) {
          const intent = { ...NEUTRAL_INTENT, ...seg.intent };
          for (let i = 0; i < seg.steps; i++) local.step(intent);
          const st = local.state;
          parts.push(
            `${st.x.toFixed(6)},${st.y.toFixed(6)},${st.z.toFixed(6)},${st.yaw.toFixed(6)},${st.speed.toFixed(6)},${st.kickCount},${st.breachCount}`,
          );
        }
        return parts.join('|');
      },
    },
  };
  (window as unknown as { __SHARED_WORLD: typeof handle }).__SHARED_WORLD = handle;

  // --- debug overlay (?debug=1) — cp04B §6.4 ---
  const overlay = opts.debug ? makeDebugOverlay() : null;

  // --- per-frame water-displacement state (world-space spheres; window-
  // relative conversion happens at injection time so scrolls are safe) ---
  const prevSpheres: (THREE.Vector3 | null)[] = [null, null, null];
  const newWorld = new THREE.Vector3();
  let prevPhase: 'swim' | 'air' = 'swim';
  let prevPitch = sim.state.pitch;

  if (loading) loading.innerHTML = '';

  // --- loop: fixed-timestep accumulator (dolphin pattern, verbatim) ---
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let steps = 0;
  let statAt = last;
  let rigUs = 0;
  let rigN = 0;

  function frame(now: number): void {
    requestAnimationFrame(frame);
    const frameT0 = performance.now();
    const dtMs = Math.min(100, now - last);
    last = now;
    acc += dtMs / 1000;

    const live = controls.intent(dtMs);
    const intent: SwimIntent = testIntent ? { ...live, ...testIntent } : live;

    if (shot) {
      acc = 0; // sim frozen during fidelity shots (water keeps running)
    }
    let kicksLeft = intent.kicks;
    while (acc >= SIM.DT) {
      sim.step({ ...intent, kicks: kicksLeft }, SIM.DT);
      kicksLeft = 0;
      acc -= SIM.DT;
      steps++;
      if (sim.state.splashed) splashes++;
    }

    const s = sim.state;
    const frameDt = dtMs / 1000;

    // --- dolphin transform + animation (presentation only) ---
    dolphin.group.position.set(s.x, s.y, s.z);
    dolphin.group.rotation.set(0, 0, 0);
    dolphin.group.rotateY(s.yaw);
    dolphin.group.rotateX(s.pitch);
    dolphin.group.rotateZ(-s.roll);
    const pitchRate = frameDt > 0 ? (s.pitch - prevPitch) / frameDt : 0;
    prevPitch = s.pitch;
    dolphin.update(frameDt, {
      speed: s.speed,
      kickRate: intent.kickRate,
      bank: s.roll,
      pitchRate,
      y: s.y,
      phase: s.phase,
    });
    if (firstFrame === null) {
      firstFrame = { actionRunning: dolphin.actionRunning(), base: dolphin.activeActionName() };
    }

    // --- windowed sim: follow, inject, step (cp04B §6.2) ---
    const simT0 = performance.now();
    gpuTimer?.begin('sim');
    const windowMoved = water.setWindowCenter(s.x, s.z);
    if (windowMoved) regionRenderer.surface.updateBorder();

    const speedNorm = Math.min(1, s.speed / SIM.MAX_SPEED);
    if (s.phase === 'swim' && !shot) {
      const dirX = Math.sin(s.yaw) * Math.cos(s.pitch);
      const dirY = -Math.sin(s.pitch);
      const dirZ = Math.cos(s.yaw) * Math.cos(s.pitch);
      for (let i = 0; i < SPINE_OFFSETS_M.length; i++) {
        const off = SPINE_OFFSETS_M[i]!;
        newWorld.set(s.x + dirX * off, s.y + dirY * off, s.z + dirZ * off);
        const prev = prevSpheres[i];
        if (prev) {
          water.moveSphereWorld(prev, newWorld, SPHERE_RADIUS_M, speedNorm * EMITTER_GAIN);
          prev.copy(newWorld);
        } else {
          prevSpheres[i] = newWorld.clone();
        }
      }
    } else {
      for (let i = 0; i < prevSpheres.length; i++) prevSpheres[i] = null;
    }
    if (!shot) {
      if (prevPhase === 'swim' && s.phase === 'air') {
        water.addDropWorld(s.x, s.z, DROP_EXIT.radiusM, DROP_EXIT.amplitudeM);
      }
      if (s.splashed || (prevPhase === 'air' && s.phase === 'swim')) {
        water.addDropWorld(s.x, s.z, DROP_ENTRY.radiusM, DROP_ENTRY.amplitudeM);
      }
    }
    prevPhase = s.phase;

    if (stageEnabled.sim) {
      // the demo's per-frame cadence: 2 steps + normals (byte-identical)
      water.stepSimulation();
      water.stepSimulation();
      water.updateNormals();
    }
    gpuTimer?.end();
    stageAcc.sim += performance.now() - simT0;

    // --- camera ---
    if (shot) {
      cam.camera.position.set(shot.pos[0], shot.pos[1], shot.pos[2]);
      cam.camera.up.set(0, 1, 0);
      cam.camera.fov = shot.fov;
      cam.camera.aspect = shot.size[0] / shot.size[1];
      cam.camera.updateProjectionMatrix();
      cam.camera.lookAt(shot.look[0], shot.look[1], shot.look[2]);
    } else {
      const rigT0 = performance.now();
      cam.update(s, frameDt);
      rigUs += (performance.now() - rigT0) * 1000;
      rigN++;
    }
    cam.camera.updateMatrixWorld();

    // --- region passes (the vendored draw order) ---
    const causT0 = performance.now();
    gpuTimer?.begin('caustics');
    if (stageEnabled.caustics) regionRenderer.updateCaustics(water);
    gpuTimer?.end();
    stageAcc.caustics += performance.now() - causT0;

    const prepT0 = performance.now();
    bvh.prefetch(s.x, s.z); // amortized: at most one tile build per frame
    regionRenderer.renderTerrain(water, cam.camera); // cp05: LOD + culling
    regionRenderer.renderWater(water, cam.camera);
    stageAcc.prepare += performance.now() - prepT0;

    const renderT0 = performance.now();
    gpuTimer?.begin('render');
    webglRenderer.render(scene, cam.camera);
    gpuTimer?.end();
    stageAcc.render += performance.now() - renderT0;
    gpuTimer?.poll();

    stageAcc.frame += performance.now() - frameT0;
    stageN++;

    frames++;
    if (now - statAt > 1000) {
      fps = (frames * 1000) / (now - statAt);
      simHz = (steps * 1000) / (now - statAt);
      if (rigN > 0) cam.updateUsAvg = rigUs / rigN;
      if (stageN > 0) {
        stageAvg.sim = stageAcc.sim / stageN;
        stageAvg.caustics = stageAcc.caustics / stageN;
        stageAvg.prepare = stageAcc.prepare / stageN;
        stageAvg.render = stageAcc.render / stageN;
        stageAvg.frame = stageAcc.frame / stageN;
      }
      stageAcc.sim = stageAcc.caustics = stageAcc.prepare = stageAcc.render = stageAcc.frame = 0;
      stageN = 0;
      frames = 0;
      steps = 0;
      rigUs = 0;
      rigN = 0;
      statAt = now;
    }

    if (overlay) {
      const sd = sim.shoreDistance(s.x, s.z);
      const t = Math.min(Math.max(1 - sd / SIM.SHORE_BAND, 0), 1);
      const gpu = gpuTimer?.averages();
      const ts = regionRenderer.terrain.terrainStats();
      const camEval = cam.evalState(s);
      const contact = sim.contactState();
      overlay.textContent =
        `REGION ?debug — cp04B/cp05 instrumentation\n` +
        `terrain tiles ${ts.drawnTiles}/${ts.totalTiles} ` +
        `(lod ${ts.drawnPerLod.join('/')}) · ${(ts.drawnTriangles / 1000).toFixed(0)}k tris · ` +
        `protected ${ts.protectedTiles}${ts.protectedAlwaysLod0 ? '' : ' ⚠lod>0'}\n` +
        `bvh tiles ${bvh.stats.tilesLive} · builds ${bvh.stats.tilesBuilt} ` +
        `(max ${bvh.stats.buildMsMax.toFixed(0)} ms) · ` +
        `cam ${camEval.state} r ${camEval.compressionRatio.toFixed(2)} ` +
        `clr ${Number.isFinite(camEval.bvhClearanceM) ? camEval.bvhClearanceM.toFixed(2) : '>10'} m\n` +
        `contact ${contact.inContact ? 'YES' : 'no'} · wedgeT ${contact.wedgeT.toFixed(2)} · ` +
        `disp ${contact.dispSpeed.toFixed(2)} m/s\n` +
        `speed ${s.speed.toFixed(2)} m/s · depth under ${sim.depthAt(s.x, s.z).toFixed(1)} m · y ${s.y.toFixed(1)}\n` +
        `shore dist ${sd.toFixed(1)} m · containment ${(SIM.SHORE_PUSH * t * t).toFixed(2)} m/s² ` +
        `(SHORE_BAND ${SIM.SHORE_BAND} / SHORE_PUSH ${SIM.SHORE_PUSH})\n` +
        `window origin (${water.windowOrigin.x.toFixed(1)}, ${water.windowOrigin.y.toFixed(1)}) · texel ${WINDOW_TEXEL_M} m\n` +
        `fps ${fps.toFixed(0)} · simHz ${simHz.toFixed(0)}\n` +
        `cpu ms — sim ${stageAvg.sim.toFixed(2)} · caustics ${stageAvg.caustics.toFixed(2)} · ` +
        `prep ${stageAvg.prepare.toFixed(2)} · render ${stageAvg.render.toFixed(2)} · frame ${stageAvg.frame.toFixed(2)}\n` +
        (gpu
          ? `gpu ms — sim ${gpu.sim?.toFixed(2) ?? '—'} · caustics ${gpu.caustics?.toFixed(2) ?? '—'} · render ${gpu.render?.toFixed(2) ?? '—'}\n`
          : `gpu timers unavailable (${timerExt ? 'ext idle' : 'no EXT_disjoint_timer_query_webgl2'}) — CPU-side stage timing\n`);
    }
  }
  requestAnimationFrame(frame);
}

function makeDebugOverlay(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'region-debug-overlay';
  el.style.cssText =
    'position:fixed;right:12px;top:12px;z-index:10;color:#d8e8f4;text-align:right;' +
    'font:12px/1.6 ui-monospace,Menlo,monospace;text-shadow:0 1px 3px rgba(0,0,0,.8);' +
    'pointer-events:none;user-select:none;white-space:pre;';
  document.body.appendChild(el);
  return el;
}

/**
 * GPU height-texture probe: renders a 32×1 float target where fragment i
 * samples uHeightTex at the i-th world point through the shader uv law —
 * the §8.6 single-source-of-truth check (`depthAt` vs the texture the
 * water/caustics shaders march against).
 */
function makeGpuHeightProbe(renderer: THREE.WebGLRenderer, region: RegionRenderer) {
  const MAX = 32;
  const target = new THREE.WebGLRenderTarget(MAX, 1, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const material = new THREE.ShaderMaterial({
    vertexShader:
      'varying vec2 coord;\n' +
      'void main() { coord = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xyz, 1.0); }',
    fragmentShader:
      'precision highp float;\n' +
      'uniform sampler2D uHeightTex;\n' +
      'uniform float uRegionSize;\n' +
      'uniform float uHeightN;\n' +
      `uniform vec2 uPts[${MAX}];\n` +
      'varying vec2 coord;\n' +
      'void main() {\n' +
      `  int idx = int(floor(coord.x * ${MAX}.0));\n` +
      '  vec2 xz = vec2(0.0);\n' +
      `  for (int i = 0; i < ${MAX}; i++) { if (i == idx) xz = uPts[i]; }\n` +
      '  vec2 uv = ((xz + 0.5 * uRegionSize) * ((uHeightN - 1.0) / uRegionSize) + 0.5) / uHeightN;\n' +
      '  gl_FragColor = vec4(texture2D(uHeightTex, uv).r, 0.0, 0.0, 1.0);\n' +
      '}',
    uniforms: {
      uHeightTex: { value: region.ctx.heightTex },
      uRegionSize: { value: region.ctx.regionSize },
      uHeightN: { value: region.ctx.heightN },
      uPts: { value: Array.from({ length: MAX }, () => new THREE.Vector2()) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return (pts: [number, number][]): number[] => {
    const uPts = material.uniforms.uPts.value as THREE.Vector2[];
    for (let i = 0; i < MAX; i++) {
      const p = pts[Math.min(i, pts.length - 1)] ?? [0, 0];
      uPts[i]!.set(p[0], p[1]);
    }
    material.uniformsNeedUpdate = true;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const out = new Float32Array(MAX * 4);
    renderer.readRenderTargetPixels(target, 0, 0, MAX, 1, out);
    renderer.setRenderTarget(prev);
    return pts.map((_, i) => out[i * 4]!);
  };
}

/** Minimal GPU stage timer over EXT_disjoint_timer_query_webgl2 (one query
 *  per stage in flight; skips a frame's sample while pending). */
class GpuStageTimer {
  private readonly queries = new Map<string, WebGLQuery>();
  private readonly pending = new Set<string>();
  private readonly sums = new Map<string, { ms: number; n: number }>();
  private active: string | null = null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number },
  ) {}

  begin(stage: string) {
    if (this.active !== null || this.pending.has(stage)) return;
    let q = this.queries.get(stage);
    if (!q) {
      q = this.gl.createQuery()!;
      this.queries.set(stage, q);
    }
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = stage;
  }

  end() {
    if (this.active === null) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.add(this.active);
    this.active = null;
  }

  poll() {
    for (const stage of [...this.pending]) {
      const q = this.queries.get(stage)!;
      if (this.gl.getQueryParameter(q, this.gl.QUERY_RESULT_AVAILABLE)) {
        const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
        if (!disjoint) {
          const ns = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT) as number;
          const rec = this.sums.get(stage) ?? { ms: 0, n: 0 };
          rec.ms += ns / 1e6;
          rec.n++;
          if (rec.n > 120) {
            rec.ms /= 2;
            rec.n = Math.floor(rec.n / 2);
          }
          this.sums.set(stage, rec);
        }
        this.pending.delete(stage);
      }
    }
  }

  averages(): Record<string, number | undefined> {
    const out: Record<string, number | undefined> = {};
    for (const [stage, rec] of this.sums) out[stage] = rec.n > 0 ? rec.ms / rec.n : undefined;
    return out;
  }
}
