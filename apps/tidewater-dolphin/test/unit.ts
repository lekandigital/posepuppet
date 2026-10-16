// CP10 headless unit tests (no GPU): the additive animation layer, the Jump root-translation
// strip, the Tidewater world sampler's distance field, obstacle correction and the sim seam.
//   npx tsx test/unit.ts

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from '../vendor/tidewater/src/engine/loaders/GLTF.js';
import { Quaternion } from '../vendor/tidewater/src/engine/index.js';
import { GPU } from '../vendor/tidewater/src/engine/gpu/GPU.js';
import { DolphinSkinnedModel } from '../src/dolphin/DolphinSkinnedModel.js';

// CPU-only: the skinned model uploads its joint matrices through the GPU singleton; stub the
// device so the pose math (what these tests check) runs without WebGPU.
(globalThis as unknown as { GPUBufferUsage: unknown }).GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, VERTEX: 8, INDEX: 16, INDIRECT: 32, UNIFORM: 64 };
(GPU as unknown as { device: unknown; queue: unknown }).device = { createBuffer: () => ({ destroy() {} }) };
(GPU as unknown as { device: unknown; queue: unknown }).queue = { writeBuffer() {} };
import { TidewaterWorldSampler, TidewaterObstacles, WORLD_PARAMS } from '../src/dolphin/tidewaterWorld';
import { SwimSim, SIM, NEUTRAL_INTENT } from '../src/dolphin/sim';

const HERE = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`);
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------- model / additive layers
const buf = readFileSync(resolve(HERE, '..', 'public', 'models', 'dolphin', 'dolphin.glb'));
const gltf = parseGLB(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) as {
  nodes: { name: string }[]; animations: { name: string; duration: number; channels: { node: number; path: string; times: Float32Array; values: Float32Array }[] }[];
};
const jump = gltf.animations.find((a) => a.name === 'Jump')!;
const rootIdx = gltf.nodes.findIndex((n) => n.name === 'Dolphin_Root');
check('Jump clip carries a Dolphin_Root translation track in the asset (to be stripped at load)', jump.channels.some((c) => c.node === rootIdx && c.path === 'translation'));
const stripped = { ...jump, channels: jump.channels.filter((c) => !(c.node === rootIdx && c.path === 'translation')) };
check('strip removes exactly one channel', stripped.channels.length === jump.channels.length - 1, { before: jump.channels.length, after: stripped.channels.length });
gltf.animations = gltf.animations.map((a) => (a === jump ? stripped : a));

const model = new DolphinSkinnedModel(gltf as never) as DolphinSkinnedModel & {
  layers: { clip: { name: string }; weight: number; time: number; speed: number }[];
  additive: { name: string; weight: number; time: number; speed: number; clip: { duration: number } }[];
  jointData: Float32Array; local: { r: Float32Array; t: Float32Array; s: Float32Array }[]; joints: number;
  play(n: string, o?: object): unknown; update(dt: number): void; addAdditive(n: string): { weight: number; time: number };
};
check('17 joints', model.joints === 17);
model.play('SwimForward', { fade: 0.3, loop: true, speed: 1, from: 0 });
model.update(0);
const J0 = Float32Array.from(model.jointData.subarray(0, 17 * 16));
const L0 = model.local.map((l) => Float32Array.from(l.r));
const left = model.addAdditive('SwimLeft');
const up = model.addAdditive('SwimUp');
model.update(0);
check('additive layers at weight 0 leave the pose unchanged', model.jointData.subarray(0, 17 * 16).every((v, i) => near(v, J0[i]!, 1e-6)));
left.weight = 1;
model.update(0); // additive time stays 0
check('additive weight 1 at the clip\'s own frame 0 is the identity delta (pose unchanged)', model.jointData.subarray(0, 17 * 16).every((v, i) => near(v, J0[i]!, 1e-4)));
left.time = 0.4;
model.update(0);
const changed = model.jointData.subarray(0, 17 * 16).some((v, i) => !near(v, J0[i]!, 1e-4));
check('additive weight 1 at t = 0.4 s changes the pose', changed);

// independent reference for one rotated node: base ⊗ slerp(identity, q_t ⊗ conj(q_0), w)
const ch = gltf.animations.find((a) => a.name === 'SwimLeft')!.channels.find((c) => c.path === 'rotation' && c.node === gltf.nodes.findIndex((n) => n.name === 'Dolphin_Spine1_00'))!;
const sampleQ = (t: number) => {
  const T = ch.times, V = ch.values; let k = 0; while (k < T.length - 2 && T[k + 1]! <= t) k++;
  const f = (t - T[k]!) / (T[k + 1]! - T[k]!);
  const a = new Quaternion(V[k * 4], V[k * 4 + 1], V[k * 4 + 2], V[k * 4 + 3]), b = new Quaternion(V[k * 4 + 4], V[k * 4 + 5], V[k * 4 + 6], V[k * 4 + 7]);
  if (a.dot(b) < 0) b.set(-b.x, -b.y, -b.z, -b.w);
  return new Quaternion(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, a.w + (b.w - a.w) * f).normalize();
};
for (const w of [0.35, 1]) {
  left.weight = w; left.time = 0.4;
  model.update(0);
  const node = ch.node;
  const base = new Quaternion(L0[node]![0], L0[node]![1], L0[node]![2], L0[node]![3]);
  const q0 = new Quaternion(ch.values[0], ch.values[1], ch.values[2], ch.values[3]).normalize().conjugate();
  const delta = sampleQ(0.4).multiply(q0); // q_t ⊗ conj(q_0)
  const add = new Quaternion().slerp(delta, w); // slerp(identity, delta, w)
  const expect = base.clone().multiply(add);
  const got = model.local[node]!.r;
  const dot = Math.abs(expect.x * got[0]! + expect.y * got[1]! + expect.z * got[2]! + expect.w * got[3]!);
  check(`additive rotation matches three.js arithmetic at weight ${w} (|dot| = 1)`, near(dot, 1, 1e-5), +dot.toFixed(7));
}
left.weight = 0; up.weight = 0;

// crossfade + speed bookkeeping (the actor's timeScale law sets layer.speed)
model.play('SwimForwardFast', { fade: 0.3, loop: true, speed: 1, from: 0 });
model.update(0.15);
const w = Object.fromEntries(model.layers.map((l) => [l.clip.name, +l.weight.toFixed(3)]));
check('0.3 s crossfade: half-way after 0.15 s, weights sum to 1', near(w.SwimForward!, 0.5, 0.02) && near(w.SwimForwardFast!, 0.5, 0.02), w);

// ---------------------------------------------------------------- world sampler
// synthetic island: 256 m domain, seabed at −8 m rising to a round island of radius 40 m at the
// centre and a 1.5 m-deep shoal at (60, 0) r 10 m; reef structure: a coral head top at −1.0 m at (−60, 0) r 3
const terrain = {
  size: 256, origin: -128,
  heightAt(x: number, z: number) {
    const r = Math.hypot(x, z);
    let h = -8 + Math.max(0, 1 - r / 40) * 12; // island: +4 at the centre, −8 beyond r 40
    if (Math.hypot(x - 60, z) < 10) h = Math.max(h, -1.5); // shoal
    return h;
  },
};
const reef = { structureAt: (x: number, z: number) => (Math.hypot(x + 60, z) < 3 ? -1.0 : -Infinity) };
const world = new TidewaterWorldSampler(terrain, reef, []);
check('sampler built', world.stats.cells === (256 / WORLD_PARAMS.MASK_CELL) ** 2, world.stats);
check('deep water is swimmable, the island is not, the shoal is not, the coral head is not', world.inWater(0, -90) && !world.inWater(0, 0) && !world.inWater(60, 0) && !world.inWater(-60, 0));
// brute-force distance to the nearest non-swimmable point on a fine grid
const brute = (x: number, z: number) => {
  let best = Infinity;
  for (let qz = -128; qz <= 128; qz += 0.5) for (let qx = -128; qx <= 128; qx += 0.5) if (!world.inWater(qx, qz)) best = Math.min(best, Math.hypot(qx - x, qz - z));
  return best;
};
for (const [x, z] of [[0, -60], [0, -90], [50, 0], [-50, 0], [30, 30]] as [number, number][]) {
  const d = world.shoreDistance(x, z), b = brute(x, z);
  check(`shoreDistance(${x},${z}) ≈ brute force (${b.toFixed(1)} m) within one mask cell`, Math.abs(d - b) <= WORLD_PARAMS.MASK_CELL * 1.5, +d.toFixed(2));
}
check('shoreDistance is negative on land', world.shoreDistance(0, 0) < 0, +world.shoreDistance(0, 0).toFixed(1));
check('terrainHeight is the max of seabed and reef structure', near(world.terrainHeight(-60, 0), -1.0) && near(world.terrainHeight(0, -90), -8));
check('edge margin: the domain border counts as shore', !world.inWater(120, 0) && world.shoreDistance(100, 0) <= 4.01, +world.shoreDistance(100, 0).toFixed(2));

// ---------------------------------------------------------------- sim on the sampler: containment + determinism
const digest = () => {
  const sim = new SwimSim(world);
  sim.state.x = 0; sim.state.z = -90; sim.state.y = -2.5; sim.state.yaw = 0; // heading +z toward the island
  const parts: string[] = [];
  const script = [{ steps: 600, intent: { burst: true } }, { steps: 600, intent: { roll: 1 } }, { steps: 600, intent: { pitch: 1, kicks: 1, kickRate: 1.6 } }];
  for (const seg of script) {
    const intent = { ...NEUTRAL_INTENT, ...seg.intent };
    for (let i = 0; i < seg.steps; i++) sim.step(intent);
    const s = sim.state;
    parts.push(`${s.x.toFixed(6)},${s.y.toFixed(6)},${s.z.toFixed(6)},${s.yaw.toFixed(6)},${s.speed.toFixed(6)}`);
  }
  return { d: parts.join('|'), sim };
};
const r1 = digest(), r2 = digest();
check('sim replay on the Tidewater sampler is deterministic', r1.d === r2.d);
check('containment band is the sampler\'s (12 m), never the 55 m region band', near(Math.min(SIM.SHORE_BAND, world.containmentBand), 12));
{
  const sim = new SwimSim(world);
  sim.state.x = 0; sim.state.z = -90; sim.state.y = -2.5; sim.state.yaw = 0;
  let minShore = Infinity, left = false, minClear = Infinity;
  for (let i = 0; i < 120 * 20; i++) {
    sim.step({ ...NEUTRAL_INTENT, burst: true });
    const s = sim.state;
    minShore = Math.min(minShore, world.shoreDistance(s.x, s.z));
    if (!world.inWater(s.x, s.z)) left = true;
    minClear = Math.min(minClear, s.y - world.terrainHeight(s.x, s.z));
  }
  check('20 s burst at the island: never leaves the water, seabed clearance kept', !left && minClear >= 1.0, { minShore: +minShore.toFixed(2), minClear: +minClear.toFixed(2) });
}

// ---------------------------------------------------------------- obstacle correction
{
  const colliders = {
    boxes: [], cylinders: [{ x: 10, z: 0, radius: 0.2, yMin: -5, yMax: 3, tag: 'pile' }],
    resolveCapsule(pos: { x: number; y: number; z: number }, radius: number, height: number) {
      let hit = false;
      for (const c of this.cylinders) {
        if (pos.y + height < c.yMin || pos.y > c.yMax) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z, r = c.radius + radius, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        pos.x = c.x + (dx / (d || 1e-4)) * r; pos.z = c.z + (dz / (d || 1e-4)) * r; hit = true;
      }
      return hit;
    },
    raycast: () => Infinity,
  };
  const obs = new TidewaterObstacles(colliders as never);
  const sim = new SwimSim(world);
  sim.state.x = 4; sim.state.z = -92; sim.state.y = -2.5; sim.state.yaw = Math.PI / 2; sim.state.speed = 4; sim.state.wvx = 4; sim.state.wvz = 0;
  // a pile stands at (10, 0): swim straight at a pile placed on the path (moved to z = −92)
  colliders.cylinders[0]!.z = -92;
  let inside = false;
  for (let i = 0; i < 120 * 6; i++) {
    const px = sim.state.x, py = sim.state.y, pz = sim.state.z;
    sim.step({ ...NEUTRAL_INTENT, kicks: i % 60 === 0 ? 1 : 0, kickRate: 1.6, kickAmp: 0.8 });
    obs.correct(px, py, pz, sim.state);
    if (Math.hypot(sim.state.x - 10, sim.state.z + 92) < 0.2 + 0.45 - 1e-3) inside = true;
  }
  check('head-on swim at a pile: corrected every step, centre never enters the pile', !inside && obs.stats.corrections > 0, { corrections: obs.stats.corrections, x: +sim.state.x.toFixed(2), z: +sim.state.z.toFixed(2) });
}

// ---------------------------------------------------------------- chase camera: no waterline exclusion (CP10 continuation)
// The inherited anti-shimmer hold (±0.75 m band, 0.35 m minimum |eye − surface|, side lock) must stay
// removed: the eye follows the chase geometry onto and through the sea surface so Tidewater's own
// near-plane waterline renderer can show the split above / below view.
{
  const { CameraRig, RIG } = await import('../src/dolphin/cameraRig');
  const { PerspectiveCamera, Vector3 } = await import('../vendor/tidewater/src/engine/index.js');
  const rigConst = RIG as unknown as Record<string, unknown>;
  check('RIG carries no SURFACE_BAND / SHIMMER_MIN_Y / SHIMMER_HOLD_S (waterline exclusion removed)', !('SURFACE_BAND' in rigConst) && !('SHIMMER_MIN_Y' in rigConst) && !('SHIMMER_HOLD_S' in rigConst));
  const src = readFileSync(resolve(HERE, '..', 'src', 'dolphin', 'cameraRig.ts'), 'utf8');
  check('cameraRig.ts has no anti-shimmer code path', !/RIG\.SHIMMER|RIG\.SURFACE_BAND|applyAntiShimmer\(|shimmerHoldT|\.side\b/.test(src));
  const open = { resolve: (_f: unknown, to: Vector3) => ({ pos: to.clone(), obstructed: false }), clampPoint: (p: Vector3) => p, losClear: () => true };
  const mkRig = (waterlineAt?: (x: number, z: number) => number) => {
    const cam = new PerspectiveCamera(62, 16 / 9, 0.1, 60000);
    return { cam, rig: new CameraRig(cam as never, open as never, { terrainCompression: true, waterlineAt }) };
  };
  const simState = (y: number, speed: number, vz: number) => ({ x: 0, y, z: 0, yaw: 0, pitch: 0, roll: 0, phase: 'swim' as const, wvx: 0, wvy: 0, wvz: vz, vx: 0, vy: 0, vz, speed });
  check('rig takes the host lens: fov 55, near 0.1 (Tidewater\'s lens plane)', (() => { const { cam } = mkRig(); return cam.fov === 55 && cam.near === 0.1; })());

  // 1. level cruise 0.8 m below a flat surface: the chase geometry puts the eye 0.3 m ABOVE the surface
  //    (HEIGHT 1.1): inside the old ±0.75 band, where the old rig pushed it down to −0.35
  {
    const { rig } = mkRig();
    const s = simState(-0.8, 3, 3);
    for (let i = 0; i < 120 * 6; i++) { s.z += 3 / 120; rig.update(s as never, 1 / 120); }
    const c = rig.evalState(s);
    check('eye settles where the chase geometry puts it (y ≈ +0.30 m, inside the old exclusion band)', Math.abs(c.y - 0.3) < 0.03, { eyeY: +c.y.toFixed(3) });
  }
  // 2. the eye can rest ON the surface: dolphin 1.1 m down → desired eye at the waterline
  {
    const { rig } = mkRig();
    const s = simState(-1.1, 3, 3);
    for (let i = 0; i < 120 * 6; i++) { s.z += 3 / 120; rig.update(s as never, 1 / 120); }
    const c = rig.evalState(s);
    check('eye rests on the surface (|y| < 3 cm) — the straddling lens the pristine game shows', Math.abs(c.y) < 0.03 && Math.abs(c.eyeAboveWaterM) < 0.03, { eyeY: +c.y.toFixed(3) });
  }
  // 3. a slow dive from −0.6 m to −3 m and back: the eye passes through [−0.35, 0.35] continuously
  //    (samples inside the band, no step larger than the spring would produce) and the crossings count
  {
    const { rig } = mkRig();
    const s = simState(-0.6, 2, 2);
    let inBand = 0, maxStep = 0, prevY: number | null = null;
    const T = 12, N = 120 * T;
    for (let i = 0; i < N; i++) {
      const t = i / 120;
      s.y = -1.8 + 1.2 * Math.cos((2 * Math.PI * t) / T); // −0.6 → −3.0 → −0.6
      s.z += 2 / 120;
      rig.update(s as never, 1 / 120);
      const y = rig.evalState(s).y;
      if (Math.abs(y) < 0.35) inBand++;
      if (prevY !== null) maxStep = Math.max(maxStep, Math.abs(y - prevY));
      prevY = y;
    }
    const c = rig.evalState(s);
    check('dive / ascent: the eye spends time inside the old band and moves continuously (< 2 cm per 1/120 s)', inBand > 120 && maxStep < 0.02, { inBandSamples: inBand, maxStepM: +maxStep.toFixed(4) });
    check('eye / waterline crossings are counted (two per dive-and-return)', c.surfaceCrossings >= 2, c.surfaceCrossings);
  }
  // 4. airborne: no hard lift above the surface — the eye follows the dolphin (HEIGHT above it, pulled back)
  {
    const { rig } = mkRig();
    const s = { ...simState(0.2, 6, 6), phase: 'air' as const, vy: 2 };
    for (let i = 0; i < 120 * 3; i++) { s.z += 6 / 120; rig.update(s as never, 1 / 120); }
    const c = rig.evalState(s);
    check('airborne framing = chase geometry (eye ≈ dolphin + 1.1 m), follow distance pulled back by BREACH_PULLBACK', Math.abs(c.y - (0.2 + RIG.HEIGHT)) < 0.05 && c.desiredDistM > RIG.FOLLOW_DIST + 1.5, { eyeY: +c.y.toFixed(3), dist: +c.desiredDistM.toFixed(2), state: c.state });
  }
  // 5. the SlowHover regression: a dolphin hovering at the soft ceiling with the swell ride lifting its
  //    rendered y by a ±0.3 m wave must NOT re-trigger SurfaceTransition on every passing wave
  {
    let t = 0;
    const wave = () => 0.3 * Math.sin(2 * Math.PI * t / 4);
    const { rig } = mkRig(wave);
    const s = simState(-0.4, 0, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 120 * 8; i++) {
      t += 1 / 120;
      const rs = { ...s, y: -0.4 + wave() }; // what the presentation layer feeds the rig (swell ride)
      rig.update(rs as never, 1 / 120);
      if (i > 120 * 2) seen.add(rig.evalState(rs).state);
    }
    check('hover at the surface in a swell: SlowHover, never SurfaceTransition (crossing detector is surface-relative)', seen.has('SlowHover') && !seen.has('SurfaceTransition'), [...seen]);
  }
  // 6. a real breach still produces SurfaceTransition (the dolphin crosses the surface itself)
  {
    const { rig } = mkRig(() => 0.2);
    const s = simState(-0.3, 6, 6);
    const seen = new Set<string>();
    for (let i = 0; i < 120 * 1.5; i++) {
      s.y += 0.02; s.z += 6 / 120; // rises through the 0.2 m waterline
      rig.update(s as never, 1 / 120);
      seen.add(rig.evalState(s).state);
    }
    check('crossing the actual surface still flags SurfaceTransition', seen.has('SurfaceTransition'), [...seen]);
  }
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
