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

console.log(failed === 0 ? '\nall passed' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
