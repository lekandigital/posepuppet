// ?view=region-preview — the Checkpoint 04A graybox terrain preview,
// cp05A revision: vertex colors now come from the substrate-classification
// CPU twin (substrateCpu.ts — addendum §4.7 "debug and baked color outputs
// used to validate classification"), superseding the R14 two-tint law.
//
// AN ENGINEERING VIEW, explicitly not the game look (cp04A §3.4): single
// 512²-quad Lambert mesh over the region, free-orbit dev camera,
// sea-level reference grid at y 0, fog off, mono stats overlay, spawn +
// approved-loop + site markers from placement.json (dev-view markers, not
// cp07 placeholders).
//
// No water is rendered (cp04A §4: the region has no water yet). The pool
// and stock views are untouched. This view never boots the pose runtime —
// no camera access of any kind.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WorldData } from './WorldData';
import { RegionSampler } from './RegionSampler';
import { substrateSampleCpu } from './substrateCpu';
import { SwimSim, NEUTRAL_INTENT, SIM, type SwimIntent } from '../game/sim';

// (cp05A: the R14 two-tint law is superseded by substrateSampleCpu — the
// preview now renders the real classification, pre-cp08 working values.)

const GRID_SEGMENTS = 512; // 512² quads (≈ 3.9 m step — preview-grade)

/** Dev marker palette by placement category (graybox pins, not placeholders). */
const MARKER_COLORS: Record<string, number> = {
  spawn: 0xffffff,
  breach: 0x82deff,
  arch: 0xff9e40,
  'cave-mouth': 0x9664c8,
  ruin: 0x9aa79a,
  wreck: 0x8c9296,
  'corridor-mass': 0x7c8468,
  spire: 0x7c8468,
  silhouette: 0x5e8a50,
  current: 0x82deff,
  discovery: 0xffec78,
};

interface ContainmentSample {
  t: number;
  x: number;
  z: number;
  y: number;
  depth: number;
  inWater: boolean;
  shore: number;
  speed: number;
}

export async function mountRegionPreview(root: HTMLElement): Promise<void> {
  const loading = document.getElementById('loading');
  const data = await WorldData.load(`${import.meta.env.BASE_URL}world/`);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x10141a); // dark neutral backdrop; engineering view
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = null; // fog off (engineering view)

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1, 8000);
  camera.position.set(-500, 900, -1900);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 5000;

  // lights: one directional + hemisphere (cp04A §6.2)
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.set(600, 1200, -400);
  const hemi = new THREE.HemisphereLight(0xbfd8e8, 0x3a3428, 0.8);
  scene.add(sun, hemi);

  // --- terrain mesh: vertex y from terrainHeight, cp05A substrate colors
  // from the classification CPU twin (the validating debug output) ---
  const t0 = performance.now();
  const verts = GRID_SEGMENTS + 1;
  const positions = new Float32Array(verts * verts * 3);
  const colors = new Float32Array(verts * verts * 3);
  const size = data.header.sizeMeters[0];
  const step = size / GRID_SEGMENTS;
  for (let j = 0; j < verts; j++) {
    const z = -size / 2 + j * step;
    for (let i = 0; i < verts; i++) {
      const x = -size / 2 + i * step;
      const h = data.terrainHeight(x, z);
      const o = (j * verts + i) * 3;
      positions[o] = x;
      positions[o + 1] = h;
      positions[o + 2] = z;
      const s = substrateSampleCpu(data, x, z);
      colors[o] = s.albedo[0];
      colors[o + 1] = s.albedo[1];
      colors[o + 2] = s.albedo[2];
    }
  }
  const indices = new Uint32Array(GRID_SEGMENTS * GRID_SEGMENTS * 6);
  let ptr = 0;
  for (let j = 0; j < GRID_SEGMENTS; j++) {
    for (let i = 0; i < GRID_SEGMENTS; i++) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices[ptr++] = a; indices[ptr++] = c; indices[ptr++] = b;
      indices[ptr++] = b; indices[ptr++] = c; indices[ptr++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);
  const meshBuildMs = performance.now() - t0;

  // --- sea-level reference grid (y 0) + region border ---
  const grid = new THREE.GridHelper(size, 40, 0x4a6a80, 0x2a3a48);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material & { opacity: number }).opacity = 0.5;
  scene.add(grid);
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size / 2, 0, -size / 2),
      new THREE.Vector3(size / 2, 0, -size / 2),
      new THREE.Vector3(size / 2, 0, size / 2),
      new THREE.Vector3(-size / 2, 0, size / 2),
    ]),
    new THREE.LineBasicMaterial({ color: 0x4a6a80 }),
  );
  scene.add(border);

  // --- spawn marker + approved-loop polyline + site markers (dev view) ---
  const markers = new THREE.Group();
  scene.add(markers);

  const route = data.placement.instances.filter((p) => p.category === 'route');
  const loopPts: THREE.Vector3[] = [];
  const routeClosed = data.placement.routeClosed ? [...route, route[0]!] : route;
  for (let s = 0; s < routeClosed.length - 1; s++) {
    const a = routeClosed[s]!;
    const b = routeClosed[s + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    const nSamples = Math.max(2, Math.ceil(segLen / 25));
    for (let k = 0; k < nSamples; k++) {
      const t = k / nSamples;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      // the loop is a swim route: drape 2 m above the seabed, kept underwater
      loopPts.push(new THREE.Vector3(x, Math.min(data.terrainHeight(x, z) + 2, -0.5), z));
    }
  }
  if (loopPts.length) loopPts.push(loopPts[0]!.clone());
  markers.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(loopPts),
      new THREE.LineBasicMaterial({ color: 0xffd640 }),
    ),
  );

  const pinTop = 16;
  for (const p of data.placement.instances) {
    if (p.category === 'route') continue;
    const color = MARKER_COLORS[p.category] ?? 0xff00ff;
    const ground = data.terrainHeight(p.x, p.z);
    const pin = new THREE.Group();
    pin.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.x, ground, p.z),
          new THREE.Vector3(p.x, pinTop, p.z),
        ]),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
    const headGeo =
      p.category === 'spawn' ? new THREE.SphereGeometry(6, 12, 8) : new THREE.OctahedronGeometry(4);
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color }));
    head.position.set(p.x, pinTop, p.z);
    pin.add(head);
    markers.add(pin);
  }

  // --- mono stats overlay ---
  const overlay = document.createElement('div');
  overlay.id = 'region-preview-overlay';
  overlay.style.cssText =
    'position:fixed;left:12px;top:12px;z-index:10;color:#d8e8f4;' +
    'font:12px/1.6 ui-monospace,Menlo,monospace;text-shadow:0 1px 3px rgba(0,0,0,.8);' +
    'pointer-events:none;user-select:none;white-space:pre;';
  document.body.appendChild(overlay);
  const legend = Object.entries(MARKER_COLORS)
    .map(([k, v]) => `<span style="color:#${v.toString(16).padStart(6, '0')}">■</span> ${k}`)
    .join('  ');
  const staticLines =
    `REGION PREVIEW — engineering view (graybox, R14 provisional tints, not the game look)\n` +
    `${data.header.layout.split(':')[0]} · seed ${data.header.seed} · 2 km² · sea level y 0 (grid)\n` +
    `decode ${data.decodeMs.toFixed(0)} ms · mesh build ${meshBuildMs.toFixed(0)} ms · ` +
    `decoded fields ${(data.decodedBytes() / 1048576).toFixed(1)} MB\n` +
    `<span style="color:#ffd640">━</span> approved loop  ${legend}\n`;

  // --- height-under-cursor: analytic heightfield raymarch (single-source law) ---
  const ndc = new THREE.Vector2(NaN, NaN);
  addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  });
  const raycaster = new THREE.Raycaster();
  function cursorProbe(): { x: number; z: number; h: number } | null {
    if (Number.isNaN(ndc.x)) return null;
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin;
    const d = raycaster.ray.direction;
    let tPrev = 0;
    let hPrev = o.y - sampleAt(o.x, o.z);
    const MAX_T = 8000;
    for (let t = 4; t < MAX_T; t += 4) {
      const x = o.x + d.x * t;
      const z = o.z + d.z * t;
      const above = o.y + d.y * t - sampleAt(x, z);
      if (hPrev > 0 && above <= 0) {
        // bisect refine
        let lo = tPrev;
        let hi = t;
        for (let k = 0; k < 16; k++) {
          const mid = (lo + hi) / 2;
          const mx = o.x + d.x * mid;
          const mz = o.z + d.z * mid;
          if (o.y + d.y * mid - sampleAt(mx, mz) > 0) lo = mid;
          else hi = mid;
        }
        const fx = o.x + d.x * hi;
        const fz = o.z + d.z * hi;
        if (Math.abs(fx) > size / 2 || Math.abs(fz) > size / 2) return null;
        return { x: fx, z: fz, h: data.terrainHeight(fx, fz) };
      }
      tPrev = t;
      hPrev = above;
    }
    return null;
  }
  function sampleAt(x: number, z: number): number {
    // outside the region the "terrain" is a bottomless pit for the probe
    if (Math.abs(x) > size / 2 || Math.abs(z) > size / 2) return -10000;
    return data.terrainHeight(x, z);
  }

  // --- containment battery support (cp04A §3.5/§8.5): synchronous sim runs
  // against RegionSampler; the pool view stays on PoolSampler until 04B ---
  const sampler = new RegionSampler(data);
  const spawn = data.header.spawn;
  function containmentRun(
    yaw: number,
    seconds = 11,
    intentOverride: Partial<SwimIntent> = {},
    start: { x: number; z: number } = { x: spawn.x, z: spawn.z },
  ): ContainmentSample[] {
    const sim = new SwimSim(sampler);
    sim.state.x = start.x;
    sim.state.z = start.z;
    sim.state.y = -2.5;
    sim.state.yaw = yaw;
    // aim the chase velocity along the tested heading (deterministic start)
    sim.state.wvx = Math.sin(yaw) * sim.state.speed;
    sim.state.wvz = Math.cos(yaw) * sim.state.speed;
    const intent: SwimIntent = { ...NEUTRAL_INTENT, burst: true, ...intentOverride };
    const samples: ContainmentSample[] = [];
    const steps = Math.round(seconds / SIM.DT);
    const every = Math.round(0.2 / SIM.DT); // 200 ms cadence (battery contract)
    for (let s = 0; s <= steps; s++) {
      if (s > 0) sim.step(intent);
      if (s % every === 0) {
        samples.push({
          t: s * SIM.DT,
          x: sim.state.x,
          z: sim.state.z,
          y: sim.state.y,
          depth: sim.depthAt(sim.state.x, sim.state.z),
          inWater: sim.inWater(sim.state.x, sim.state.z),
          shore: sim.shoreDistance(sim.state.x, sim.state.z),
          speed: sim.state.speed,
        });
      }
    }
    return samples;
  }

  /** generic deterministic script runner (replay-digest shape, region sampler) */
  function runScript(script: { steps: number; intent: Partial<SwimIntent> }[]): string {
    const sim = new SwimSim(sampler);
    sim.state.x = spawn.x;
    sim.state.z = spawn.z;
    const parts: string[] = [];
    for (const seg of script) {
      const intent = { ...NEUTRAL_INTENT, ...seg.intent };
      for (let i = 0; i < seg.steps; i++) sim.step(intent);
      const st = sim.state;
      parts.push(
        `${st.x.toFixed(6)},${st.y.toFixed(6)},${st.z.toFixed(6)},${st.yaw.toFixed(6)},${st.speed.toFixed(6)},${st.kickCount},${st.breachCount}`,
      );
    }
    return parts.join('|');
  }

  // --- eval handle ---
  let fps = 0;
  const handle = {
    ready: true,
    header: data.header,
    decodeMs: data.decodeMs,
    meshBuildMs,
    decodedBytes: data.decodedBytes(),
    stats: () => ({ fps, cameraPos: camera.position.toArray() }),
    world: {
      terrainHeight: (x: number, z: number) => data.terrainHeight(x, z),
      inWater: (x: number, z: number) => data.inWater(x, z),
      shoreDistance: (x: number, z: number) => data.shoreDistance(x, z),
      depthAt: (x: number, z: number) => data.depthAt(x, z),
      sampler: {
        inWater: (x: number, z: number) => sampler.inWater(x, z),
        shoreDistance: (x: number, z: number) => sampler.shoreDistance(x, z),
        depthAt: (x: number, z: number) => sampler.depthAt(x, z),
      },
    },
    test: {
      probeHeights: (pts: [number, number][]) => pts.map(([x, z]) => data.terrainHeight(x, z)),
      containmentRun,
      runScript,
      /** auto-orbit for the scripted fps measurement (§8.7) */
      setAutoOrbit(speed: number | null) {
        controls.autoRotate = speed !== null;
        controls.autoRotateSpeed = speed ?? 2;
      },
      /** fixed camera pose for review screenshots (dev/test only) */
      setCamera(pos: [number, number, number], target: [number, number, number]) {
        camera.position.set(pos[0], pos[1], pos[2]);
        controls.target.set(target[0], target[1], target[2]);
        controls.update();
      },
    },
    SIM,
  };
  (window as unknown as { __REGION_PREVIEW: typeof handle }).__REGION_PREVIEW = handle;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  if (loading) loading.remove();

  let frames = 0;
  let statAt = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
    frames++;
    if (now - statAt > 1000) {
      fps = (frames * 1000) / (now - statAt);
      frames = 0;
      statAt = now;
    }
    const probe = cursorProbe();
    overlay.innerHTML =
      staticLines +
      `fps ${fps.toFixed(0)} · cam (${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)})` +
      (probe
        ? ` · cursor (${probe.x.toFixed(0)}, ${probe.z.toFixed(0)}) height ${probe.h.toFixed(1)} m` +
          (probe.h < 0 ? ` (depth ${(-probe.h).toFixed(1)} m)` : ' (land)')
        : '');
  }
  requestAnimationFrame(frame);
}
