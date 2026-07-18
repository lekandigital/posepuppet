// Checkpoint 01 — the pool game shell. Recreates the dolphin app's
// orchestration pattern (fixed-timestep accumulator, kick-on-first-substep,
// eval handle, fps/simHz counters) around the vendored jeantimex render
// pipeline (Master §3.2 "sim port" row).
//
// Mount law (Master §7.7): the vendored demo is mounted under a Group at
// K = 7.5 m per demo unit → pool interior 15 m × 15 m, 7.5 m deep, sea
// level y 0. Shaders are untouched; water-system inputs map world→demo by
// ÷K. The vendored surface shaders raytrace in demo-local space using the
// `eye` uniform, so renderWater() receives a proxy camera at eye÷K while
// the on-screen pass renders the scaled scene with the real metres camera.
//
// The ONLY water integration is the sanctioned object-displacement input
// path (Water.moveSphere / addDrop — VENDOR.md §6.4 item 5) plus the K
// mount transform. No vendored file is edited.

import * as THREE from 'three';
import { Water } from '../../vendor/threejs-water/src/Water';
import { Renderer } from '../../vendor/threejs-water/src/Renderer';
import { loadSceneAssets } from '../../vendor/threejs-water/src/app/LoadSceneAssets';
import { NO_WATER_OPTICS } from '../../vendor/threejs-water/src/water/WaterOptics';
import { SwimSim, SIM, NEUTRAL_INTENT, type AssistMode, type SwimIntent } from './sim';
import { PoolSampler } from './worldSampler';
import { ChaseCamera } from './camera';
import { loadDolphin } from './dolphinActor';
import { createSwimControls } from '../input/swimControls';
import { CREDITS_ATTRIBUTION } from '../credits';

/** Master §7.7: metres per demo unit. */
export const K = 7.5;

/** Compound displacement emitter (cp01 §6.2): 3 spheres of radius 0.45 m
 *  at nose/mid/tail along the spine [DERIVED from the 0.99 m body height]. */
const SPINE_OFFSETS_M = [1.0, 0, -1.0];
const SPHERE_RADIUS_M = 0.45;

export interface EvalState {
  phase: string;
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
}

export async function startPoolGame(root: HTMLElement): Promise<void> {
  const loading = document.getElementById('loading');

  // --- renderer: the vendored demo's own settings (fidelity parity) ---
  const webglRenderer = new THREE.WebGLRenderer({ antialias: true });
  webglRenderer.setPixelRatio(window.devicePixelRatio);
  webglRenderer.setClearColor(0x000000);
  root.appendChild(webglRenderer.domElement);

  const { tileTexture, cubemap } = await loadSceneAssets();
  const water = new Water(webglRenderer);
  const renderer = new Renderer(webglRenderer, tileTexture, cubemap);
  renderer.setWaterOptics(NO_WATER_OPTICS); // no demo obstacle in the pool

  const scene = new THREE.Scene();

  // the vendored demo, mounted at K (its meshes stay demo-local; the group
  // transform is the world scale)
  const demoGroup = new THREE.Group();
  demoGroup.scale.setScalar(K);
  demoGroup.add(
    renderer.getPoolMesh(),
    renderer.getWaterMesh(),
    renderer.getWaterMeshBack(),
  );
  renderer.markWaterOpticsHidden();
  scene.add(demoGroup);

  // lights for the dolphin only (vendored ShaderMaterials ignore scene
  // lights); direction matches the demo's light so the shading agrees
  const lightDir = renderer.lightDir.clone().normalize();
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

  // --- sim + controls + camera ---
  const sampler = new PoolSampler(K, K);
  const sim = new SwimSim(sampler);
  const controls = createSwimControls();
  const cam = new ChaseCamera(innerWidth / innerHeight);
  // demo-space eye proxy for the vendored water shaders (they raytrace in
  // demo-local space; the proxy's world position is the real eye ÷ K)
  const eyeProxy = new THREE.PerspectiveCamera();

  const resize = () => {
    webglRenderer.setSize(innerWidth, innerHeight);
    renderer.setSize(innerWidth, innerHeight);
    cam.camera.aspect = innerWidth / innerHeight;
    cam.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ambient starting ripples (the demo's seedWater pattern)
  for (let i = 0; i < 20; i++) {
    water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, i % 2 === 0 ? -0.01 : 0.01);
  }

  // assist keys (dolphin parity)
  addEventListener('keydown', (e) => {
    if (e.key === '1') sim.assist = 'full';
    if (e.key === '2') sim.assist = 'standard';
    if (e.key === '3') sim.assist = 'expert';
  });
  const qs = new URLSearchParams(location.search);
  const qa = qs.get('assist');
  if (qa === 'full' || qa === 'standard' || qa === 'expert') sim.assist = qa;

  // --- eval / test surface (__SHARED_WORLD, same shape as __DOLPHIN) ---
  let testIntent: Partial<SwimIntent> | null = null;
  let fps = 0;
  let simHz = 0;
  let splashes = 0;
  let firstFrame: { actionRunning: boolean; base: string } | null = null;
  const handle = {
    state: (): EvalState => ({
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
    test: {
      /** merge a partial intent over the live one (null clears) — test-only */
      setIntent(p: Partial<SwimIntent> | null) { testIntent = p; },
      setAssist(a: AssistMode) { sim.assist = a; },
      teleport(x: number, z: number, y = -2.5) {
        sim.state.x = x; sim.state.z = z; sim.state.y = y;
      },
      setYaw(yaw: number) { sim.state.yaw = yaw; },
      /** synchronous deterministic stepping for the replay spec — no rAF,
       *  no clock: returns a digest of the trajectory */
      runScript(script: { steps: number; intent: Partial<SwimIntent> }[]): string {
        const local = new SwimSim(new PoolSampler(K, K));
        local.assist = sim.assist;
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
    SIM,
  };
  (window as unknown as { __SHARED_WORLD: typeof handle }).__SHARED_WORLD = handle;

  // --- per-frame water-displacement state ---
  const prevSpheres: THREE.Vector3[] | null[] = [null, null, null];
  const oldDemo = new THREE.Vector3();
  const newDemo = new THREE.Vector3();
  let prevPhase: 'swim' | 'air' = 'swim';
  let prevPitch = sim.state.pitch;

  if (loading) loading.innerHTML = '';

  // --- loop: fixed-timestep accumulator (dolphin pattern, verbatim) ---
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let steps = 0;
  let statAt = last;

  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dtMs = Math.min(100, now - last);
    last = now;
    acc += dtMs / 1000;

    const live = controls.intent(dtMs);
    const intent: SwimIntent = testIntent ? { ...live, ...testIntent } : live;

    let kicksLeft = intent.kicks;
    while (acc >= SIM.DT) {
      // kick deltas land on the first sub-step only (impulses, not rates)
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

    // --- water interaction: the sanctioned displacement-input path ---
    // 3-sphere spine compound; world→demo by ÷K; amplitude ∝ |velocity|
    const speedNorm = Math.min(1, s.speed / SIM.MAX_SPEED);
    if (s.phase === 'swim') {
      const dirX = Math.sin(s.yaw) * Math.cos(s.pitch);
      const dirY = -Math.sin(s.pitch);
      const dirZ = Math.cos(s.yaw) * Math.cos(s.pitch);
      for (let i = 0; i < SPINE_OFFSETS_M.length; i++) {
        const off = SPINE_OFFSETS_M[i]!;
        newDemo.set(
          (s.x + dirX * off) / K,
          (s.y + dirY * off) / K,
          (s.z + dirZ * off) / K,
        );
        const prev = prevSpheres[i];
        if (prev) {
          oldDemo.copy(prev);
          water.moveSphere(oldDemo, newDemo, SPHERE_RADIUS_M / K, speedNorm);
          prev.copy(newDemo);
        } else {
          prevSpheres[i] = newDemo.clone();
        }
      }
    } else {
      for (let i = 0; i < prevSpheres.length; i++) prevSpheres[i] = null;
    }
    // breach splash: addDrop bursts at both surface crossings (Master §4.3)
    if (prevPhase === 'swim' && s.phase === 'air') {
      water.addDrop(s.x / K, s.z / K, 0.08, 0.05);
    }
    if (s.splashed || (prevPhase === 'air' && s.phase === 'swim')) {
      water.addDrop(s.x / K, s.z / K, 0.1, 0.06);
    }
    prevPhase = s.phase;

    // --- water sim (the demo's per-frame cadence: 2 steps + normals) ---
    water.stepSimulation();
    water.stepSimulation();
    water.updateNormals();

    // --- camera + draw (the demo's pass order) ---
    cam.update(s, frameDt);
    cam.camera.updateMatrixWorld();
    eyeProxy.position.copy(cam.camera.position).divideScalar(K);
    eyeProxy.updateMatrixWorld();
    renderer.updateObjectTextures(scene, cam.camera, null);
    renderer.updateCaustics(water);
    renderer.renderPool(water);
    renderer.renderWater(water, eyeProxy);
    webglRenderer.render(scene, cam.camera);

    frames++;
    if (now - statAt > 1000) {
      fps = (frames * 1000) / (now - statAt);
      simHz = (steps * 1000) / (now - statAt);
      frames = 0;
      steps = 0;
      statAt = now;
    }
  }
  requestAnimationFrame(frame);
}
