// Orchestration: fixed-timestep sim (deterministic; the renderer only
// reads state), three.js render, HUD/minimap, and the __DOLPHIN eval
// handle the Playwright suite drives — including test-only intent
// overrides and a synchronous stepper for replay-determinism checks.

import * as THREE from 'three';
import { SwimSim, SIM, NEUTRAL_INTENT, type AssistMode, type SwimIntent } from './sim';
import { createWorld } from './world';
import { createDolphin } from './dolphinMesh';
import { ChaseCamera } from './camera';
import { createSwimControls } from '../input/swimControls';
import { Minimap } from '../ui/minimap';
import { Hud } from '../ui/hud';
import { decorate } from './decor';

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
}

export function startGame(root: HTMLElement): void {
  const sim = new SwimSim();
  const controls = createSwimControls();
  const world = createWorld(sim);
  const decor = decorate(world.scene, sim);
  const dolphin = createDolphin();
  world.scene.add(dolphin.group);
  const cam = new ChaseCamera(innerWidth / innerHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  root.append(renderer.domElement);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.camera.aspect = innerWidth / innerHeight;
    cam.camera.updateProjectionMatrix();
  });

  const hud = new Hud(sim.boundary.source.attribution);
  const minimap = new Minimap(
    document.getElementById('minimap') as HTMLCanvasElement,
    sim.boundary,
  );

  // splash particles (breach re-entry): one small additive burst pool
  const splash = createSplash(world.scene);
  let splashes = 0;

  // assist keys
  addEventListener('keydown', (e) => {
    if (e.key === '1') sim.assist = 'full';
    if (e.key === '2') sim.assist = 'standard';
    if (e.key === '3') sim.assist = 'expert';
  });
  const qs = new URLSearchParams(location.search);
  const qa = qs.get('assist');
  if (qa === 'full' || qa === 'standard' || qa === 'expert') sim.assist = qa;

  // --- eval / test surface ---
  let testIntent: Partial<SwimIntent> | null = null;
  let fps = 0;
  let simHz = 0;
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
    }),
    transport: () => controls.debug(),
    test: {
      /** merge a partial intent over the live one (null clears) — test-only */
      setIntent(p: Partial<SwimIntent> | null) { testIntent = p; },
      setAssist(a: AssistMode) { sim.assist = a; },
      teleport(x: number, z: number, y = -6) {
        sim.state.x = x; sim.state.z = z; sim.state.y = y;
      },
      setYaw(yaw: number) { sim.state.yaw = yaw; },
      /** synchronous deterministic stepping for the replay spec — no rAF,
       *  no clock: returns a digest of the trajectory */
      runScript(script: { steps: number; intent: Partial<SwimIntent> }[]): string {
        const local = new SwimSim();
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
  (window as unknown as { __DOLPHIN: typeof handle }).__DOLPHIN = handle;

  // --- loop: fixed-timestep accumulator ---
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
      if (sim.state.splashed) {
        splashes++;
        splash.burst(sim.state.x, SIM.SURFACE_Y + 0.3, sim.state.z);
      }
    }

    // render
    const s = sim.state;
    dolphin.group.position.set(s.x, s.y, s.z);
    dolphin.group.rotation.set(0, 0, 0);
    dolphin.group.rotateY(s.yaw);
    dolphin.group.rotateX(s.pitch);
    dolphin.group.rotateZ(-s.roll);
    dolphin.update(now / 1000, intent.kickRate, s.speed);
    cam.update(s, dtMs / 1000);
    world.update(now / 1000, cam.camera.position.y);
    decor.update(now / 1000, s.x, s.z);
    splash.update(dtMs / 1000);
    renderer.render(world.scene, cam.camera);

    // HUD at ~10 Hz
    frames++;
    if (now - statAt > 100) {
      const hs = controls.hudState();
      hud.update(s, hs.tracking, hs.kickRate || intent.kickRate, sim.assist, hs.seated, hs.recentered, now);
      const [bx, by] = sim.toBoundary(s.x, s.z);
      minimap.draw(bx, by, s.yaw);
      if (now - statAt > 1000) {
        fps = (frames * 1000) / (now - statAt);
        simHz = (steps * 1000) / (now - statAt);
        frames = 0;
        steps = 0;
        statAt = now;
      }
    }
  }
  requestAnimationFrame(frame);
}

/** Tiny additive splash burst pool (breach re-entry). */
function createSplash(scene: THREE.Scene): { burst(x: number, y: number, z: number): void; update(dt: number): void } {
  const N = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd9f6ff, size: 0.5, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const vel = new Float32Array(N * 3);
  let life = 0;
  return {
    burst(x, y, z) {
      for (let i = 0; i < N; i++) {
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        const a = (i / N) * Math.PI * 2;
        const r = 2 + (i % 7) * 0.8;
        vel[i * 3] = Math.cos(a) * r;
        vel[i * 3 + 1] = 3 + (i % 5);
        vel[i * 3 + 2] = Math.sin(a) * r;
      }
      life = 1;
      mat.opacity = 0.9;
      geo.getAttribute('position').needsUpdate = true;
    },
    update(dt) {
      if (life <= 0) return;
      life -= dt * 1.2;
      mat.opacity = Math.max(0, life * 0.9);
      for (let i = 0; i < N; i++) {
        vel[i * 3 + 1] -= 9 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.getAttribute('position').needsUpdate = true;
    },
  };
}
