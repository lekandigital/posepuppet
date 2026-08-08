// Checkpoint 05C — the region game shell (`?view=region`): the approved
// Twin Bay baked region under the ported WaterThreeJS ocean (ocean-
// replacement addendum §4). Recreates the pool shell's orchestration
// (fixed-timestep accumulator, kick-on-first-substep, eval handle, fps/
// simHz counters — the dolphin pattern, Master §3.2) around the demo's
// linear-HDR pass pipeline:
//
//   refraction pass  — everything except the ocean surface + particles,
//                      into a half-float RT with depth (what makes the
//                      dolphin visible THROUGH the surface, absorbed)
//   main pass        — full scene into the HDR RT
//   clouds           — half-res volumetric raymarch, temporally resolved
//   post             — underwater volumetrics + bloom + ACES/sRGB composite
//
// The dolphin, sim, swim controls, cp02 camera rig, cp05 terrain LOD/BVH,
// and the baked world artifacts are the approved systems, unmodified except
// where the addendum records it: the camera rig gains a surface-relative
// waterline, and the terrain material is relit for linear HDR. The dolphin
// couples to the water through the ocean's contact-foam body slots (wake
// while surface-swimming; splash impulses on air↔water transitions) —
// replacing the jeantimex sim injections wholesale.

import * as THREE from 'three';
import { Sky } from '../ocean/Sky';
import { Ocean, OCEAN_CONFIG, MAX_FOAM_BODIES } from '../ocean/Ocean';
import { Floor } from '../ocean/Floor';
import { Particles } from '../ocean/Particles';
import { Post } from '../ocean/Post';
import { Clouds } from '../ocean/Clouds';
import { FloatingBodies } from '../ocean/FloatingBodies';
import { applyPreset, PRESETS, type SunParams } from '../ocean/presets';
import { ECCO_GRADE, applyEccoGrade } from '../ocean/eccoGrade';
import { createTimeOfDay, TOD, sunAnglesAt } from '../ocean/timeOfDay';
import { buildRegionContext } from '../terrain/regionContext';
import {
  RegionTerrainPass,
  TILES,
  CELLS_PER_TILE,
  LOD_STEPS,
  LOD_DISTANCES_M,
  SKIRT_DROP_M,
} from '../terrain/RegionTerrainPass';
import { WorldData } from '../world/WorldData';
import { RegionSampler } from '../world/RegionSampler';
import { SwimSim, SIM, NEUTRAL_INTENT, type AssistMode, type SwimIntent } from './sim';
import type { WorldSampler } from './worldSampler';
import { CameraRig, RIG, type CameraEvalState } from './cameraRig';
import { RegionCameraCollision } from './regionCameraCollision';
import { TerrainBvh } from './terrainBvh';
import { loadDolphin } from './dolphinActor';
import { substrateSampleCpu } from '../world/substrateCpu';
import { createSwimControls } from '../input/swimControls';
import { CREDITS_ATTRIBUTION } from '../credits';
import type { EvalState } from './game';

/** Region far plane — the demo's own (sky dome r 6000, ocean plane 6000). */
const REGION_FAR = 8000;

/** dolphin contact-foam descriptor (slot 0 of the ocean's uBodies field):
 *  radius ≈ half the 2.89 m body, ×1.15 like the demo's bodies feed */
const DOLPHIN_FOAM_RADIUS_M = 1.5;
/** splash impulse spiked on air↔water transitions (demo b.splash pattern) */
const SPLASH_IMPULSE = 1.5;
const SPLASH_DECAY_PER_S = 3;

interface ShotMode {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  size: [number, number];
}

export interface StageMs {
  refraction: number;
  main: number;
  clouds: number;
  post: number;
  frame: number;
}

export type RegionEvalState = EvalState;

export async function startRegionGame(
  root: HTMLElement,
  opts: { debug: boolean },
): Promise<void> {
  const loading = document.getElementById('loading');

  const data = await WorldData.load(`${import.meta.env.BASE_URL}world/`);
  const spawn = data.header.spawn;

  // --- renderer: the WaterThreeJS demo's own settings (linear HDR — the
  // one tone-map + sRGB encode lives in the post composite) ---
  const webglRenderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  // Perf adaptation (recorded): the demo clamps dpr ≤ 2, but this pipeline
  // renders the scene twice (refraction + main) plus terrain/post/clouds.
  // A live retina window at dpr 2 is 4× the master §10 budget target of
  // ≈1728×1080 render pixels; dpr ≤ 1.5 keeps some retina sharpening while
  // protecting the 58 fps floor (the master explicitly allows resolution
  // scaling; the Playwright tiers emulate dpr 1 and are unaffected).
  webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  webglRenderer.toneMapping = THREE.NoToneMapping;
  webglRenderer.autoClear = true;
  root.appendChild(webglRenderer.domElement);

  // --- sun / time of day (demo main.js transplant + the cycle) ---
  const sunParams: SunParams = { elevation: 22, azimuth: 108 };
  const sunDir = new THREE.Vector3();
  function updateSunDir() {
    const el = THREE.MathUtils.degToRad(sunParams.elevation);
    const az = THREE.MathUtils.degToRad(sunParams.azimuth);
    const h = Math.cos(el);
    sunDir.set(Math.cos(az) * h, Math.sin(el), Math.sin(az) * h).normalize();
  }
  updateSunDir();

  // --- scene graph ---
  const scene = new THREE.Scene();
  scene.background = null; // the Sky dome (renderOrder -1000) is the background

  const sky = new Sky(sunDir);
  scene.add(sky.mesh);

  const ocean = new Ocean(sunDir, new THREE.Vector2(innerWidth, innerHeight));
  scene.add(ocean.mesh);

  // Endless sandy seabed below the region's deepest baked point — the demo
  // Floor plays its usual role beyond the 2000 m region edge and is depth-
  // occluded by the terrain inside it.
  let minBakedH = Infinity;
  for (let i = 0; i < data.heights.length; i++) {
    const h = data.heights[i]!;
    if (h < minBakedH) minBakedH = h;
  }
  const FLOOR_DEPTH = Math.max(30, Math.ceil(-minBakedH) + 5);
  const floor = new Floor(sunDir, FLOOR_DEPTH);
  scene.add(floor.mesh);

  const ctx = buildRegionContext(webglRenderer, data);
  const terrain = new RegionTerrainPass(data, ctx, ocean.uniforms, sunDir);
  scene.add(terrain.group);

  // Marine snow restrained vs the demo's 5000 (Ecco frames show sparse
  // motes; Track D keeps particles subordinate to the fog) — count is a
  // construction option, the field/shader untouched.
  const particles = new Particles(2600, 160);
  scene.add(particles.points);

  // lights: the demo's pair — only the dolphin + dropped bodies
  // (MeshStandardMaterial) use them; every ShaderMaterial ignores them
  const sunLight = new THREE.DirectionalLight(0xfff2e0, 3.0);
  scene.add(sunLight, sunLight.target);
  const skyLight = new THREE.HemisphereLight(0xbfe4ff, 0x24424e, 1.1);
  scene.add(skyLight);

  const bodies = new FloatingBodies(scene);
  const terrainAt = (x: number, z: number) => data.terrainHeight(x, z);

  // --- render targets (demo makeSceneRT) ---
  function makeSceneRT(w: number, h: number) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
    return rt;
  }
  let refractionRT = makeSceneRT(innerWidth, innerHeight);
  let hdrRT = makeSceneRT(innerWidth, innerHeight);
  ocean.uniforms.uRefractionTex.value = refractionRT.texture;
  ocean.uniforms.uDepthTex.value = refractionRT.depthTexture;

  const post = new Post(webglRenderer, innerWidth, innerHeight, sunDir, OCEAN_CONFIG.deepColor);
  const clouds = new Clouds(webglRenderer, innerWidth, innerHeight, { scale: 0.5 });
  const cloudShadowP = { strength: 0.5 };
  const cu = clouds.uniforms;
  function setCloudsEnabled(on: boolean) {
    clouds.enabled = on;
    const cover = on ? 0.25 : 1.0;
    sky.uniforms.uCloudCover.value = cover;
    ocean.uniforms.uCloudCover.value = cover;
    if (!on) ocean.uniforms.uCloudShadow.value = 0;
  }

  // --- sun propagation (demo applySun + terrain + the sanctioned night
  // dimmer — the demo atmosphere clamps at elevation 0 and has no night
  // model, so without dimming, night would read as dusk. The dimmer scales
  // the two scene lights AND the post exposure (the single scotopic knob in
  // a single-tone-map pipeline); ocean addendum §4.6) ---
  const postExposure = { base: 1.05 }; // presets/GUI set this, never uExposure
  function applySun() {
    updateSunDir();
    sky.setSun(sunDir);
    ocean.setSun(sunDir);
    floor.setSun(sunDir);
    terrain.setSun(sunDir);
    post.underwaterMat.uniforms.uSunDir.value.copy(sunDir);
    clouds.setSun(sunDir);
    sunLight.position.copy(sunDir).multiplyScalar(300);
    sunLight.target.position.set(0, 0, 0);
    const night = THREE.MathUtils.smoothstep(sunParams.elevation, -8, 8);
    sunLight.intensity = (0.6 + 3.0 * Math.max(sunDir.y, 0.0)) * Math.max(night, 0.2);
    skyLight.intensity = 1.1 * (0.18 + 0.82 * night);
    post.compositeMat.uniforms.uExposure.value = postExposure.base * (0.15 + 0.85 * night);
  }

  const timeOfDay = createTimeOfDay(sunParams, applySun);

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
  const bvh = new TerrainBvh(data);
  for (let k = 0; k < 9; k++) bvh.prefetch(spawn.x, spawn.z);
  const camCollision = new RegionCameraCollision(data, bvh, RIG.COLLISION_RADIUS);

  // --- deterministic ocean clock (test-controllable; never wall clock) ---
  let oceanTimeS = 0;
  let oceanFrozen = false;

  const cam = new CameraRig(innerWidth / innerHeight, camCollision, REGION_FAR, {
    terrainCompression: true,
    // cp05C: the visual waterline is the Gerstner surface (CPU mirror)
    waterlineAt: (x, z) => ocean.heightAt(x, z, oceanTimeS),
  });
  ocean.uniforms.uNear.value = cam.camera.near;
  ocean.uniforms.uFar.value = cam.camera.far;

  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    webglRenderer.setSize(w, h);
    cam.camera.aspect = w / h;
    cam.camera.updateProjectionMatrix();
    refractionRT.dispose();
    hdrRT.dispose();
    refractionRT = makeSceneRT(w, h);
    hdrRT = makeSceneRT(w, h);
    ocean.uniforms.uRefractionTex.value = refractionRT.texture;
    ocean.uniforms.uDepthTex.value = refractionRT.depthTexture;
    ocean.setResolution(w, h);
    post.setSize(w, h);
    clouds.setSize(w, h);
  };
  addEventListener('resize', resize);
  resize();

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

  // --- per-stage instrumentation: EXT_disjoint_timer_query where
  // available, else CPU-side stage timing ---
  const gl = webglRenderer.getContext() as WebGL2RenderingContext;
  const timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  const gpuTimer = timerExt ? new GpuStageTimer(gl, timerExt) : null;
  const stageAvg: StageMs = { refraction: 0, main: 0, clouds: 0, post: 0, frame: 0 };
  const stageAcc: StageMs = { refraction: 0, main: 0, clouds: 0, post: 0, frame: 0 };
  let stageN = 0;

  // --- eval / test surface (__SHARED_WORLD, the pool shape + region) ---
  let testIntent: Partial<SwimIntent> | null = null;
  let fps = 0;
  let simHz = 0;
  let splashes = 0;
  let firstFrame: { actionRunning: boolean; base: string } | null = null;
  let shot: ShotMode | null = null;
  let flatBackground: THREE.Color | null = null;
  const stageEnabled = {
    refraction: true,
    clouds: true,
    post: true,
    particles: true,
    oceanMesh: true,
    terrain: true,
  };

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

  // GPU depth-law probe: sample uHeightTex through the same uv law the
  // terrain shaders use, on the GPU, and read the heights back.
  const gpuHeightProbe = makeGpuHeightProbe(webglRenderer, ctx);

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
    }),
    transport: () => controls.debug(),
    credits: CREDITS_ATTRIBUTION,
    firstFrame: () => firstFrame,
    camera: (): CameraEvalState => cam.evalState(sim.state),
    coverage,
    RIG,
    SIM,
    // --- cp05C ocean surface (the CPU mirrors are the eval contract) ---
    ocean: {
      config: OCEAN_CONFIG,
      grade: ECCO_GRADE,
      TOD,
      heightAt: (x: number, z: number, t?: number) =>
        ocean.heightAt(x, z, t ?? oceanTimeS),
      surfaceSample: (x: number, z: number, t?: number) =>
        ocean.surfaceSample(x, z, t ?? oceanTimeS, {} as never),
      sunAnglesAt,
      state: () => ({ timeS: oceanTimeS, frozen: oceanFrozen }),
      /** the LIVE shader clock (diagnostic: must equal state().timeS) */
      uniformTime: () => ocean.uniforms.uTime.value as number,
      timeOfDay: () => ({ ...timeOfDay.state(), sunDir: [sunDir.x, sunDir.y, sunDir.z] }),
      bodies: () =>
        bodies.bodies.map((b) => ({
          x: b.mesh.position.x, y: b.mesh.position.y, z: b.mesh.position.z,
          r: b.r, wet: b.wet ?? 0,
        })),
    },
    region: {
      header: data.header,
      decodeMs: data.decodeMs,
      decodedBytes: data.decodedBytes(),
      floatLinearHeightTex: ctx.floatLinear,
      floorDepthM: FLOOR_DEPTH,
      gpuTimerSource: (timerExt ? 'EXT_disjoint_timer_query_webgl2' : 'cpu') as string,
      stageMs: (): StageMs => ({ ...stageAvg }),
      gpuStageMs: () => (gpuTimer ? gpuTimer.averages() : null),
      world: {
        terrainHeight: (x: number, z: number) => data.terrainHeight(x, z),
        inWater: (x: number, z: number) => data.inWater(x, z),
        shoreDistance: (x: number, z: number) => data.shoreDistance(x, z),
        depthAt: (x: number, z: number) => data.depthAt(x, z),
      },
      gpuHeightProbe: (pts: [number, number][]) => gpuHeightProbe(pts),
      // --- cp05 terrain instrumentation ---
      terrain: {
        constants: {
          tiles: TILES,
          cellsPerTile: CELLS_PER_TILE,
          tileSizeM: terrain.tileSizeM,
          lodSteps: [...LOD_STEPS],
          lodDistancesM: [...LOD_DISTANCES_M],
          skirtDropM: SKIRT_DROP_M,
        },
        buildMs: terrain.buildMs,
        stats: () => terrain.terrainStats(),
        lodMap: () => terrain.lodMap(),
        tiles: () =>
          terrain.tiles.map((t) => ({
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
      /** fixed-camera fidelity-shot mode; null restores */
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
      /** per-stage toggles for frame-budget attribution */
      setStageEnabled(patch: Partial<typeof stageEnabled>) {
        Object.assign(stageEnabled, patch);
        terrain.setVisible(stageEnabled.terrain);
      },
      /** post on/off — off renders the main pass straight to the canvas
       *  (raw linear values; the flat-background/seam scans use this) */
      setPostEnabled(v: boolean) {
        stageEnabled.post = v;
      },
      /** cp05C ocean clock control — the deterministic fixed-time capture
       *  mechanism (the setAmbient/frozen-surface heir) */
      setOcean(patch: { timeS?: number; frozen?: boolean }) {
        if (patch.timeS !== undefined) oceanTimeS = patch.timeS;
        if (patch.frozen !== undefined) oceanFrozen = patch.frozen;
      },
      /** cp05C time-of-day control (deterministic phase/speed/pause) */
      setTimeOfDay(patch: { phase?: number; speedMul?: number; frozen?: boolean }) {
        timeOfDay.set(patch);
      },
      /** drop a WaterThreeJS floating body (the underwater-albedo probe) */
      dropBody(type: 'sphere' | 'cube', x: number, z: number) {
        bodies.spawn(type, x, z, ocean.heightAt(x, z, oceanTimeS));
      },
      clearBodies() { bodies.clear(); },
      applyOceanPreset(name: string) {
        const ok = applyPreset(name, { ocean, post, clouds, sunParams, applySun });
        const P = PRESETS[name];
        if (ok && P?.exposure !== undefined) {
          postExposure.base = P.exposure;
          applySun();
        }
        return ok;
      },
      /** restore the boot-time Ecco grade (config-only) */
      applyEccoGrade() {
        applyEccoGrade({ ocean, post, clouds });
        applySun();
      },
      presets: Object.keys(PRESETS),
      /** cp05A: render raw classification albedo on the terrain (no
       *  lighting) — the probe surface the CPU twin compares against */
      setAlbedoDebug(v: boolean) {
        terrain.setAlbedoDebug(v);
      },
      /** cp05A: the classification CPU twin at world points */
      substrateProbe(pts: [number, number][]) {
        return pts.map(([x, z]) => substrateSampleCpu(data, x, z));
      },
      /** structural audit: the terrain fragment carries the ONE substrate
       *  entry point and no legacy tint law */
      substrateShaderAudit() {
        const marker = 'substrateAlbedo(';
        const legacyTint = 'waterPathTint(';
        const terrainSrc = terrain.fragmentSource();
        return {
          terrainHasSubstrate: terrainSrc.includes(marker),
          anyLegacyTintLaw: terrainSrc.includes(legacyTint),
        };
      },
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
      contactRun(opts2: {
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
        local.assist = opts2.assist ?? 'expert';
        local.state.x = opts2.x;
        local.state.z = opts2.z;
        local.state.y = opts2.y;
        local.state.yaw = opts2.yaw;
        local.state.speed = opts2.speed ?? 5;
        local.state.wvx = Math.sin(opts2.yaw) * local.state.speed;
        local.state.wvz = Math.cos(opts2.yaw) * local.state.speed;
        const intent: SwimIntent = { ...NEUTRAL_INTENT, ...(opts2.intent ?? {}) };
        const seconds = opts2.seconds ?? 8;
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
       * cp05 anti-wedge mechanism scenario: deterministic analytic V-pocket
       * sampler (45° walls + closed end); the SIM CODE under test is the
       * real SwimSim; only the terrain is synthetic. Reported as such.
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
       * crack-scan aid: paint a flat background so background pixels are
       * exactly detectable in captures (hides the sky dome; combine with
       * setPostEnabled(false) + setStageEnabled({oceanMesh:false}) for raw
       * scans; null restores).
       */
      setFlatBackground(hex: number | null) {
        flatBackground = hex === null ? null : new THREE.Color(hex);
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

  // --- debug overlay + GUI (?debug=1) ---
  const overlay = opts.debug ? makeDebugOverlay() : null;
  if (opts.debug) {
    void import('../ocean/oceanDebugGui').then(({ mountOceanDebugGui }) => {
      mountOceanDebugGui({
        ocean, post, clouds, bodies, timeOfDay, sunParams, applySun,
        cloudShadowP, setCloudsEnabled, postExposure,
        applyEccoGrade: () => {
          applyEccoGrade({ ocean, post, clouds });
          applySun();
        },
        applyPreset: (name: string) => {
          const ok = applyPreset(name, { ocean, post, clouds, sunParams, applySun });
          const P = PRESETS[name];
          if (ok && P?.exposure !== undefined) {
            postExposure.base = P.exposure;
            applySun();
          }
          return ok;
        },
        dropAt: (type: 'sphere' | 'cube') => {
          const s = sim.state;
          bodies.spawn(
            type,
            s.x + (Math.random() - 0.5) * 14,
            s.z + (Math.random() - 0.5) * 14,
            ocean.heightAt(s.x, s.z, oceanTimeS),
          );
        },
      });
    });
  }

  // --- dolphin splash impulse (air↔water transitions → contact foam) ---
  let prevPhase: 'swim' | 'air' = 'swim';
  let splashImpulse = 0;
  let prevPitch = sim.state.pitch;

  if (loading) loading.innerHTML = '';

  applySun();
  setCloudsEnabled(true); // volumetric clouds on by default (GUI toggle)
  // Ecco grade (user direction 2026-08-08): configuration-only tuning of
  // the ported ocean toward the 13-frame Ecco set — see src/ocean/eccoGrade.ts
  applyEccoGrade({ ocean, post, clouds });
  applySun(); // re-derive the exposure dimmer over the graded base

  // --- loop: fixed-timestep accumulator (dolphin pattern, verbatim) ---
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let steps = 0;
  let statAt = last;
  let rigUs = 0;
  let rigN = 0;
  const invProjView = new THREE.Matrix4();

  function setVisible(underwater: boolean, refractionPass: boolean) {
    if (refractionPass) {
      // background behind the water: everything except the surface itself
      ocean.mesh.visible = false;
      sky.mesh.visible = flatBackground === null;
      floor.mesh.visible = true;
      particles.points.visible = false;
    } else {
      ocean.mesh.visible = stageEnabled.oceanMesh;
      sky.mesh.visible = !underwater && flatBackground === null;
      floor.mesh.visible = true;
      particles.points.visible = underwater && stageEnabled.particles;
    }
  }

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

    // --- deterministic clocks (frozen only through the test surface) ---
    if (!oceanFrozen) oceanTimeS += frameDt;
    timeOfDay.advance(frameDt);

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

    // --- immersion test (exact CPU wave height at the camera column) ---
    const camP = cam.camera.position;
    const surfaceH = ocean.heightAt(camP.x, camP.z, oceanTimeS);
    const underwater = camP.y < surfaceH - 0.15;

    // --- per-frame updates (demo animate() transplant) ---
    ocean.update(oceanTimeS, cam.camera);
    floor.update(oceanTimeS, cam.camera);
    particles.update(oceanTimeS, cam.camera);
    sky.update(cam.camera, oceanTimeS);
    bodies.update(frameDt, oceanTimeS, ocean, terrainAt);
    terrain.update(cam.camera); // LOD + culling, once per frame (both passes)

    ocean.uniforms.uCameraUnderwater.value = underwater ? 1 : 0;
    ocean.uniforms.uProjMatrix.value.copy(cam.camera.projectionMatrix);
    post.underwaterMat.uniforms.uTime.value = oceanTimeS;

    // --- contact-foam feed: slot 0 = the dolphin, then the bodies ---
    if (prevPhase !== s.phase) {
      splashImpulse = Math.min(2, splashImpulse + SPLASH_IMPULSE);
    }
    if (s.splashed) splashImpulse = Math.min(2, splashImpulse + SPLASH_IMPULSE * 0.6);
    splashImpulse *= Math.exp(-SPLASH_DECAY_PER_S * frameDt);
    prevPhase = s.phase;

    const ou = ocean.uniforms;
    const dolphinWH = ocean.heightAt(s.x, s.z, oceanTimeS);
    // "wet" ≈ near the surface: full within 0.6 m, fading out by 2.2 m depth
    const dolphinWet =
      s.phase === 'swim'
        ? 1 - THREE.MathUtils.smoothstep(dolphinWH - s.y, 0.6, 2.2)
        : 0;
    const dolphinSpeed = Math.hypot(s.wvx, s.wvz);
    const dolphinStrength =
      dolphinWet > 0.02
        ? Math.min(2, (0.3 + dolphinSpeed * 0.22 + splashImpulse) * Math.min(dolphinWet * 3, 1))
        : Math.min(2, splashImpulse);
    ou.uBodies.value[0].set(s.x, s.z, DOLPHIN_FOAM_RADIUS_M * 1.15, dolphinStrength);
    ou.uBodyVel.value[0].set(s.wvx, s.wvz);

    const blist = bodies.bodies;
    const bn = Math.min(blist.length, MAX_FOAM_BODIES - 1);
    for (let i = 0; i < bn; i++) {
      const b = blist[i]!;
      const spd = Math.hypot(b.vx, b.vz);
      const wet = b.wet || 0;
      const strength = wet > 0.02
        ? Math.min(2, (0.3 + spd * 0.22 + (b.splash || 0)) * Math.min(wet * 3, 1))
        : Math.min(2, b.splash || 0);
      ou.uBodies.value[i + 1].set(b.mesh.position.x, b.mesh.position.z, b.r * 1.15, strength);
      ou.uBodyVel.value[i + 1].set(b.vx, b.vz);
    }
    ou.uBodyCount.value = bn + 1;

    // --- sync the sea's cloud shadows with the volumetric layer ---
    if (clouds.enabled) {
      ou.uCloudShadow.value = cloudShadowP.strength;
      ou.uCloudPlaneY.value = cu.uBase!.value + cu.uHeight!.value * 0.5;
      ou.uCloudScale.value = cu.uNoiseScale!.value;
      ou.uCloudCoverage.value = cu.uCoverage!.value * (1 - cu.uHeightFalloff!.value * 0.5);
      ou.uCloudDrift.value.copy(cu.uDrift!.value);
    }

    webglRenderer.setClearColor(flatBackground ?? OCEAN_CONFIG.deepColor, 1);

    // --- Pass A: refraction background (skip while submerged) ---
    const refrT0 = performance.now();
    if (!underwater && stageEnabled.refraction) {
      gpuTimer?.begin('refraction');
      setVisible(underwater, true);
      webglRenderer.setRenderTarget(refractionRT);
      webglRenderer.render(scene, cam.camera);
      gpuTimer?.end();
    }
    stageAcc.refraction += performance.now() - refrT0;

    // --- Pass B: full scene → HDR (or straight to canvas with post off) ---
    const mainT0 = performance.now();
    gpuTimer?.begin('main');
    setVisible(underwater, false);
    webglRenderer.setRenderTarget(stageEnabled.post ? hdrRT : null);
    webglRenderer.render(scene, cam.camera);
    gpuTimer?.end();
    stageAcc.main += performance.now() - mainT0;

    if (stageEnabled.post) {
      // --- volumetric clouds: raymarch from the scene depth ---
      const cloudsT0 = performance.now();
      if (clouds.enabled && stageEnabled.clouds) {
        gpuTimer?.begin('clouds');
        clouds.render(frameDt, cam.camera, hdrRT.depthTexture!);
        gpuTimer?.end();
      }
      stageAcc.clouds += performance.now() - cloudsT0;

      // --- post: underwater volumetrics + clouds + bloom + tone-map ---
      const postT0 = performance.now();
      gpuTimer?.begin('post');
      invProjView.multiplyMatrices(cam.camera.projectionMatrix, cam.camera.matrixWorldInverse).invert();
      post.render(hdrRT, {
        invProjView,
        cameraPos: cam.camera.position,
        sunDir,
        time: oceanTimeS,
        underwater,
        surfaceY: OCEAN_CONFIG.surfaceY,
        cloudTexture: clouds.enabled && stageEnabled.clouds ? clouds.texture : null,
      });
      gpuTimer?.end();
      stageAcc.post += performance.now() - postT0;
    }
    gpuTimer?.poll();

    stageAcc.frame += performance.now() - frameT0;
    stageN++;

    frames++;
    if (now - statAt > 1000) {
      fps = (frames * 1000) / (now - statAt);
      simHz = (steps * 1000) / (now - statAt);
      if (rigN > 0) cam.updateUsAvg = rigUs / rigN;
      if (stageN > 0) {
        stageAvg.refraction = stageAcc.refraction / stageN;
        stageAvg.main = stageAcc.main / stageN;
        stageAvg.clouds = stageAcc.clouds / stageN;
        stageAvg.post = stageAcc.post / stageN;
        stageAvg.frame = stageAcc.frame / stageN;
      }
      stageAcc.refraction = stageAcc.main = stageAcc.clouds = stageAcc.post = stageAcc.frame = 0;
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
      const ts = terrain.terrainStats();
      const camEval = cam.evalState(s);
      const contact = sim.contactState();
      const tod = timeOfDay.state();
      overlay.textContent =
        `REGION ?debug — cp05C instrumentation\n` +
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
        `ocean t ${oceanTimeS.toFixed(1)} s${oceanFrozen ? ' (frozen)' : ''} · ` +
        `tod phase ${tod.phase.toFixed(3)} el ${tod.elevationDeg.toFixed(1)}° az ${tod.azimuthDeg.toFixed(0)}° ×${tod.speedMul}\n` +
        `camera ${underwater ? 'BELOW' : 'ABOVE'} · surface ${surfaceH.toFixed(2)} m · ` +
        `foam bodies ${ou.uBodyCount.value}\n` +
        `fps ${fps.toFixed(0)} · simHz ${simHz.toFixed(0)}\n` +
        `cpu ms — refr ${stageAvg.refraction.toFixed(2)} · main ${stageAvg.main.toFixed(2)} · ` +
        `clouds ${stageAvg.clouds.toFixed(2)} · post ${stageAvg.post.toFixed(2)} · frame ${stageAvg.frame.toFixed(2)}\n` +
        (gpu
          ? `gpu ms — refr ${gpu.refraction?.toFixed(2) ?? '—'} · main ${gpu.main?.toFixed(2) ?? '—'} · ` +
            `clouds ${gpu.clouds?.toFixed(2) ?? '—'} · post ${gpu.post?.toFixed(2) ?? '—'}\n`
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
 * the single-source-of-truth check (`depthAt` vs the texture the terrain
 * shaders sample).
 */
function makeGpuHeightProbe(
  renderer: THREE.WebGLRenderer,
  ctx: { heightTex: THREE.DataTexture; regionSize: number; heightN: number },
) {
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
      uHeightTex: { value: ctx.heightTex },
      uRegionSize: { value: ctx.regionSize },
      uHeightN: { value: ctx.heightN },
      uPts: { value: Array.from({ length: MAX }, () => new THREE.Vector2()) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return (pts: [number, number][]): number[] => {
    const uPts = material.uniforms.uPts!.value as THREE.Vector2[];
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
  /** ring of the most recent samples per stage — the reported figure is the
   *  ring MEDIAN, so occasional disjoint-timer spikes cannot contaminate
   *  the measurement. */
  private readonly rings = new Map<string, number[]>();
  private static readonly RING_N = 90;
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
          let ring = this.rings.get(stage);
          if (!ring) {
            ring = [];
            this.rings.set(stage, ring);
          }
          ring.push(ns / 1e6);
          if (ring.length > GpuStageTimer.RING_N) ring.shift();
        }
        this.pending.delete(stage);
      }
    }
  }

  /** per-stage ring MEDIAN, ms (name kept for the eval-surface contract) */
  averages(): Record<string, number | undefined> {
    const out: Record<string, number | undefined> = {};
    for (const [stage, ring] of this.rings) {
      if (ring.length === 0) {
        out[stage] = undefined;
        continue;
      }
      const sorted = [...ring].sort((a, b) => a - b);
      out[stage] = sorted[Math.floor(sorted.length / 2)];
    }
    return out;
  }
}
