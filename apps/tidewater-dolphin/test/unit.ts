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

  // 1. ordinary shallow cruise (SURFACE_Y −0.4): the eye skims just under mean sea, not 1.1 m above the dolphin
  {
    const { rig } = mkRig();
    const s = simState(-0.4, 3, 3);
    for (let i = 0; i < 120 * 6; i++) { s.z += 3 / 120; rig.update(s as never, 1 / 120, { bodyY: -0.4 }); }
    const c = rig.evalState(s);
    check('shallow cruise parks the eye near mean sea (slightly under, not +0.7 m in the air)', c.y < 0.05 && c.y > -0.35 && c.chaseHeightM < 0.4, { eyeY: +c.y.toFixed(3), h: +c.chaseHeightM.toFixed(3) });
  }
  // 2. deep cruise keeps the old 1.1 m chase height
  {
    const { rig } = mkRig();
    const s = simState(-6, 3, 3);
    for (let i = 0; i < 120 * 6; i++) { s.z += 3 / 120; rig.update(s as never, 1 / 120, { bodyY: -6 }); }
    const c = rig.evalState(s);
    check('deep cruise keeps HEIGHT 1.1 (eye ≈ −4.9 m)', Math.abs(c.y - (-6 + RIG.HEIGHT)) < 0.08 && c.chaseHeightM > 1.0, { eyeY: +c.y.toFixed(3), h: +c.chaseHeightM.toFixed(3) });
  }
  // 2b. the eye can still rest on the surface when the body is placed there (no exclusion band)
  {
    const { rig } = mkRig();
    const s = simState(-RIG.HEIGHT_SURFACE, 3, 3);
    for (let i = 0; i < 120 * 6; i++) { s.z += 3 / 120; rig.update(s as never, 1 / 120, { bodyY: -RIG.HEIGHT_SURFACE }); }
    const c = rig.evalState(s);
    check('eye can rest on the surface (|y| < 8 cm) — no waterline exclusion', Math.abs(c.y) < 0.08, { eyeY: +c.y.toFixed(3) });
  }
  // 3. a slow dive from −0.2 m (eye just above the mean) to −3 m and back: the eye passes through
  //    [−0.35, 0.35] continuously (samples inside the band, no step larger than the spring would
  //    produce) and the eye / waterline crossings count. (CP10 controls pass: with the surface skim
  //    the eye only rises above the mean when the body does — a dive from the −0.4 ceiling keeps the
  //    lens under; waves crossing the fixed lens are tested in 5.)
  {
    const { rig } = mkRig();
    const s = simState(-0.2, 2, 2);
    let inBand = 0, maxStep = 0, prevY: number | null = null;
    const T = 12, N = 120 * T;
    for (let i = 0; i < N; i++) {
      const t = i / 120;
      s.y = -1.6 + 1.4 * Math.cos((2 * Math.PI * t) / T); // −0.2 → −3.0 → −0.2
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
  //    rendered y by a ±0.3 m wave must NOT re-trigger SurfaceTransition on every passing wave.
  //    The chase positions on the sim body, so the eye stays put while the wave crosses it.
  {
    let t = 0;
    const wave = () => 0.3 * Math.sin(2 * Math.PI * t / 4);
    const { rig } = mkRig(wave);
    const s = simState(-0.4, 0, 0);
    const seen = new Set<string>();
    const eyeYs: number[] = [];
    let signFlips = 0;
    let prevSign: number | null = null; // sign of the eye / waterline height, with 2 cm hysteresis
    for (let i = 0; i < 120 * 8; i++) {
      t += 1 / 120;
      const rs = { ...s, y: -0.4 + wave() };
      rig.update(rs as never, 1 / 120, { bodyY: -0.4 });
      if (i > 120 * 2) {
        const c = rig.evalState(rs);
        seen.add(c.state);
        eyeYs.push(c.y);
        const rel = c.eyeAboveWaterM;
        if (Math.abs(rel) > 0.02) {
          const sg = Math.sign(rel);
          if (prevSign !== null && sg !== prevSign) signFlips++;
          prevSign = sg;
        }
      }
    }
    const eyeSpan = Math.max(...eyeYs) - Math.min(...eyeYs);
    check('hover at the surface in a swell: SlowHover, never SurfaceTransition (crossing detector is surface-relative)', seen.has('SlowHover') && !seen.has('SurfaceTransition'), [...seen]);
    check('waves cross a nearly still lens (eye moves < 8 cm while the waterline swings ±0.3 m)', eyeSpan < 0.08 && signFlips >= 2, { eyeSpan: +eyeSpan.toFixed(3), signFlips });
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

// ---------------------------------------------------------------- swim model (CP10 controls pass)
// Hold-to-swim is a smooth thrust toward a held target, caps govern thrust, overspeed bleeds.
{
  const open = { inWater: () => true, shoreDistance: () => 500, depthAt: () => 12, containmentBand: 12 };
  const mk = (speed = 0.5, y = -2.5) => { const sim = new SwimSim(open as never); sim.state.y = y; sim.state.speed = speed; sim.state.wvx = 0; sim.state.wvz = speed; return sim; };
  const run = (sim: SwimSim, seconds: number, intent: Partial<typeof NEUTRAL_INTENT>, onStep?: (t: number) => void) => {
    for (let i = 0; i < Math.round(seconds / SIM.DT); i++) { sim.step({ ...NEUTRAL_INTENT, ...intent }); onStep?.((i + 1) * SIM.DT); }
  };
  // hold-to-swim: rest → cruise on a curve, settling exactly at cruise
  {
    const sim = mk(0.5); let t45 = -1; let maxDv = 0; let prev = 0.5;
    run(sim, 4, { swim: 1, kickRate: 1.8 }, (t) => { const v = sim.state.speed; maxDv = Math.max(maxDv, Math.abs(v - prev)); prev = v; if (t45 < 0 && v >= 4.5) t45 = t; });
    check('hold-to-swim: 0.5 → 4.5 m/s in 0.9–2 s and settles at cruise 5 ± 0.03', t45 > 0.9 && t45 < 2 && near(sim.state.speed, 5, 0.03), { t45: +t45.toFixed(2), final: +sim.state.speed.toFixed(3) });
    check('hold-to-swim never steps (max per-step Δv < 0.1 m/s, i.e. < 12 m/s²)', maxDv < 0.1, +maxDv.toFixed(4));
  }
  // analog hold levels settle below cruise (trigger travel = sustained speed)
  {
    const settle = (lvl: number) => { const sim = mk(0.5); run(sim, 10, { swim: lvl, kickRate: 1.4 }); return sim.state.speed; };
    const v03 = settle(0.3), v06 = settle(0.6), v1 = settle(1);
    const want = (lvl: number) => SIM.MAX_SPEED * (SIM.SWIM_MIN_FRAC + (1 - SIM.SWIM_MIN_FRAC) * lvl);
    check('analog swim level sets the sustained speed (0.3 / 0.6 / 1 → 2.9 / 3.8 / 5 m/s ± 0.05)', near(v03, want(0.3), 0.05) && near(v06, want(0.6), 0.05) && near(v1, 5, 0.05), { v03: +v03.toFixed(2), v06: +v06.toFixed(2), v1: +v1.toFixed(2) });
  }
  // charge, then release: bleed, never a step (the old clamp dropped 9 → 5 in one 8 ms step)
  {
    const sim = mk(5); run(sim, 1.5, { burst: true, swim: 1 }); const v9 = sim.state.speed;
    let maxDrop = 0; let prev = v9; const trace: number[] = [];
    // let go of charge, keep swimming: eases back to cruise and stays there
    run(sim, 3, { swim: 1 }, (t) => { const v = sim.state.speed; maxDrop = Math.max(maxDrop, prev - v); prev = v; if (Math.abs(t * 2 - Math.round(t * 2)) < 1e-9) trace.push(+v.toFixed(2)); });
    check('charge reaches 9 m/s', near(v9, 9, 0.05), +v9.toFixed(2));
    check('charge release (still swimming) bleeds 9 → 5 over ~2 s: max per-step drop < 0.1 m/s, 6–8 m/s after 0.5 s, cruise ± 0.05 after 3 s', maxDrop < 0.1 && trace[0]! > 6 && trace[0]! < 8 && near(sim.state.speed, 5, 0.05), { trace, maxDrop: +maxDrop.toFixed(4) });
    // let go of everything from 9 m/s: a glide, still no step (the old clamp dropped to 5.00 in one 8 ms step)
    const sim2 = mk(5); run(sim2, 1.5, { burst: true }); let maxDrop2 = 0; let prev2 = sim2.state.speed; let v05 = 0;
    run(sim2, 1, {}, (t) => { const v = sim2.state.speed; maxDrop2 = Math.max(maxDrop2, prev2 - v); prev2 = v; if (Math.abs(t - 0.5) < 1e-9) v05 = v; });
    check('charge released into a glide: no step (max per-step drop < 0.1 m/s), still > 6 m/s after 0.5 s', maxDrop2 < 0.1 && v05 > 6, { v05: +v05.toFixed(2), maxDrop: +maxDrop2.toFixed(4) });
  }
  // brake: prompt but not a wall
  {
    const sim = mk(5); let v04 = 0; let tHover = -1;
    run(sim, 1.5, { brake: true }, (t) => { if (Math.abs(t - 0.4) < 1e-9) v04 = sim.state.speed; if (tHover < 0 && sim.state.speed < 0.5) tHover = t; });
    check('brake from cruise: still > 1 m/s at 0.4 s, under 0.5 m/s by 1.0 s', v04 > 1 && tHover > 0.5 && tHover < 1.0, { v04: +v04.toFixed(2), tHover: +tHover.toFixed(2) });
  }
  // a tail-stroke tap at cruise lunges ≤ TAP_OVERSHOOT above the cap and comes back
  {
    const sim = mk(5); run(sim, 1, { swim: 1 }); let peak = 0;
    sim.step({ ...NEUTRAL_INTENT, swim: 1, kicks: 1, kickAmp: 0.8 });
    run(sim, 2, { swim: 1 }, () => { peak = Math.max(peak, sim.state.speed); });
    check('tap at cruise: peak ≤ cruise + TAP_OVERSHOOT, back within 0.15 m/s of cruise after 2 s', peak > 5.3 && peak <= SIM.MAX_SPEED + SIM.TAP_OVERSHOOT + 1e-6 && near(sim.state.speed, 5, 0.15), { peak: +peak.toFixed(2), after: +sim.state.speed.toFixed(2) });
  }
  // breach at cruise: hold swim + full nose-up from −2.5 m
  {
    const sim = mk(5, -2.5); let tAir = -1; let apex = -99;
    run(sim, 3, { swim: 1, kickRate: 1.8, pitch: -1 }, (t) => { if (tAir < 0 && sim.state.phase === 'air') tAir = t; apex = Math.max(apex, sim.state.y); });
    check('cruise + nose-up from −2.5 m breaches within 2 s, apex above the surface', tAir > 0 && tAir < 2 && apex > 0.3, { tAir: +tAir.toFixed(2), apex: +apex.toFixed(2) });
  }
  // determinism of the new law
  {
    const digest = () => { const sim = mk(0.5); const parts: string[] = []; for (const seg of [{ s: 2, i: { swim: 1 } }, { s: 1, i: { swim: 1, burst: true } }, { s: 2, i: { roll: 1 } }, { s: 1, i: { brake: true } }, { s: 1, i: { swim: 0.5, pitch: 1 } }]) { run(sim, seg.s, seg.i); parts.push(`${sim.state.x.toFixed(6)},${sim.state.y.toFixed(6)},${sim.state.z.toFixed(6)},${sim.state.speed.toFixed(6)}`); } return parts.join('|'); };
    check('replay with holds / charge / brake is byte-identical across runs', digest() === digest());
  }
}

// ---------------------------------------------------------------- chase camera: look orbit returns behind (CP10 controls pass)
{
  const { CameraRig, RIG } = await import('../src/dolphin/cameraRig');
  const { PerspectiveCamera, Vector3 } = await import('../vendor/tidewater/src/engine/index.js');
  const open = { resolve: (_f: unknown, to: Vector3) => ({ pos: to.clone(), obstructed: false }), clampPoint: (p: Vector3) => p, losClear: () => true };
  const mkRig = () => new CameraRig(new PerspectiveCamera(62, 16 / 9, 0.1, 60000) as never, open as never, { terrainCompression: true });
  const simState = (y: number, speed: number, vz: number) => ({ x: 0, y, z: 0, yaw: 0, pitch: 0, roll: 0, phase: 'swim' as const, wvx: 0, wvy: 0, wvz: vz, vx: 0, vy: 0, vz, speed });
  const swim = (rig: InstanceType<typeof CameraRig>, s: ReturnType<typeof simState>, seconds: number, steer = 0) => { for (let i = 0; i < 120 * seconds; i++) { s.z += s.speed / 120; rig.update(s as never, 1 / 120, { steer }); } };
  {
    const rig = mkRig(); const s = simState(-2, 3, 3); swim(rig, s, 1);
    rig.addLook(1.0, 0.2);
    let c = rig.evalState(s);
    check('mouse / stick look offsets the orbit (yaw 1.0, pitch 0.2)', near(c.orbitYawRad, 1.0) && near(c.orbitPitchRad, 0.2), { yaw: c.orbitYawRad, pitch: c.orbitPitchRad });
    swim(rig, s, RIG.ORBIT_HOLD_S * 0.9);
    c = rig.evalState(s);
    check('the look holds for ORBIT_HOLD_S after the last input', near(c.orbitYawRad, 1.0, 1e-9), c.orbitYawRad);
    swim(rig, s, 4);
    c = rig.evalState(s);
    check('swimming on, the orbit returns behind the dolphin by itself (|yaw| < 0.1 rad, |pitch| < 0.03 after 4.6 s)', Math.abs(c.orbitYawRad) < 0.1 && Math.abs(c.orbitPitchRad) < 0.03, { yaw: +c.orbitYawRad.toFixed(3), pitch: +c.orbitPitchRad.toFixed(3) });
  }
  {
    const rig = mkRig(); const s = simState(-2, 3, 3); swim(rig, s, 1);
    rig.addLook(1.0, 0); swim(rig, s, 2, 1);
    check('steering input brings the camera back faster (|yaw| < 0.12 rad after 2 s with the stick held)', Math.abs(rig.evalState(s).orbitYawRad) < 0.12, +rig.evalState(s).orbitYawRad.toFixed(3));
  }
  {
    const rig = mkRig(); const s = simState(-2, 0, 0); rig.update(s as never, 1 / 120);
    rig.addLook(0.8, -0.3); for (let i = 0; i < 120 * 5; i++) rig.update(s as never, 1 / 120);
    const c = rig.evalState(s);
    check('a hovering dolphin keeps the look where the player put it', near(c.orbitYawRad, 0.8, 1e-9) && near(c.orbitPitchRad, -0.3, 1e-9), { yaw: c.orbitYawRad, pitch: c.orbitPitchRad });
  }
  {
    const rig = mkRig(); const s = simState(-2, 3, 3); swim(rig, s, 1);
    rig.addLook(3.5, 0); // past π: wraps so the return is the short way
    check('orbit yaw wraps to (−π, π]', rig.evalState(s).orbitYawRad < 0 && rig.evalState(s).orbitYawRad > -Math.PI, rig.evalState(s).orbitYawRad);
    rig.recenter();
    check('R clears the orbit', rig.evalState(s).orbitYawRad === 0 && rig.evalState(s).orbitPitchRad === 0);
  }
}


// ---------------------------------------------------------------- asset-integration pass: scenery additions placement (headless, no GPU)
// The placement (sites, instances, swimmer loops, fish zones) is a pure function of Tidewater's
// deterministic terrain and reef; the GPU side (GLB loading, structure fields) is checked live by
// test/modes.mjs. The reef is built as the headless survey builds it (eval/survey/bay-survey.mjs).
{
  const { TerrainData } = await import('../vendor/tidewater/src/world/TerrainData.js');
  const { WORLD } = await import('../vendor/tidewater/src/world/WorldLayout.js');
  const { Reef } = await import('../vendor/tidewater/src/world/Reef.js');
  const { mulberry32, Noise2D } = await import('../vendor/tidewater/src/util/Noise.js');
  const { SceneryAdditions, MODELS, ADDITION_CATEGORIES } = await import('../src/additions/SceneryAdditions.js');
  const T = new TerrainData();
  const reef = Object.create(Reef.prototype);
  reef.terrain = T; reef.center = WORLD.reef.center.clone(); reef.radius = WORLD.reef.radius;
  reef.rng = mulberry32(20260923); reef.noise = new Noise2D(4242); reef.noise2 = new Noise2D(977); reef.timings = {};
  reef.buildKinds(); reef.initFields(); reef.items = { hard: [], soft: [] }; reef.placeLayers();
  const mkApp = () => ({ scene: { add() {} }, qs: new URLSearchParams(''), terrainData: T, reef, colliders: null, debris: null, terrainGPU: null, shoreField: null });
  const t0 = performance.now();
  const a1 = new SceneryAdditions(mkApp());
  const placeMs = performance.now() - t0;
  const a2 = new SceneryAdditions(mkApp());
  const strip = (k: string, v: unknown) => (k === 'matrix' || k === 'center' || k === 'radius' ? undefined : v);
  check('additions placement is deterministic (two constructions give identical records)', JSON.stringify(a1.placed, strip) === JSON.stringify(a2.placed, strip), { placeMs: +placeMs.toFixed(0) });
  const P = a1.placed;
  const count = (id: string) => { const c = P[id]; let n = c.scan ? c.scan.length : 0; for (const k in c.models || {}) n += c.models[k].length; return n + (c.swimmers || []).length; };
  check('the two CP10 categories are unchanged (11 driftwood, 30 shells)', count('sunkenWood') === 11 && count('seabedShells') === 30, { wood: count('sunkenWood'), shells: count('seabedShells') });
  const expect: Record<string, number> = { seagrassMeadows: 370, kelpWall: 141, wreck: 25, drownedTemple: 103, wildlife: 3, headland: 71 };
  for (const id in expect) check(`${id}: ${expect[id]} instances placed (pinned deterministic count)`, count(id) === expect[id], count(id));
  check('the wreck, the temple, the ruin and the lighthouse found a spot', !!P.wreck.hull && !!P.drownedTemple.temple && !!P.drownedTemple.ruin && !!P.headland.lighthouse, { hull: P.wreck.hull, temple: P.drownedTemple.temple, lighthouse: P.headland.lighthouse });
  check('fish communities at the wreck and the temple (Tidewater species only)', P.wildlife.fish.length === 2 && P.wildlife.fish.every((f: { groups: unknown[][] }) => f.groups.length >= 8));
  // every solid top below the swimmable limit, every kelp / weed tip below the surface band,
  // everything on the sand (not inside Tidewater's own structures), clear of the pier, the dock and the spawn
  let badTop = 0, badGround = 0, badClear = 0, badTip = 0, n = 0;
  for (const c of ADDITION_CATEGORIES) {
    const models = P[c.id].models || {};
    for (const id in models) for (const r of models[id]) {
      n++;
      const M = MODELS[id];
      const s = Array.isArray(r.s) ? r.s : [r.s, r.s, r.s];
      const g = T.heightAt(r.x, r.z);
      if (id !== 'lighthouse' && reef.structureAt(r.x, r.z) > g + 0.02) badGround++;
      if (M.solid) {
        const h = Math.abs(r.pitch || 0) > 1 ? Math.max(M.size[0] * s[0], M.size[2] * s[2]) * 0.5 : M.size[1] * s[1];
        if (r.y + h > -2.4) badTop++;
      } else if (M.sway && r.y + M.size[1] * s[1] > -1.4) badTip++;
      if (c.id !== 'headland' && (Math.hypot(r.x - 0, r.z - 66) < 6 || Math.hypot(r.x - 64.5, r.z - 36.5) < 12 || (Math.abs(r.x - 55) < 4 && r.z > -67 && r.z < 43))) badClear++;
    }
  }
  check(`every solid imported structure tops out below −2.4 m (${n} records)`, badTop === 0, badTop);
  check('every kelp stalk / weed clump tip stays below −1.4 m', badTip === 0, badTip);
  check('imported models stand on sand, not inside Tidewater\'s own reef structures', badGround === 0, badGround);
  check('imported models clear of the dolphin spawn, the boat dock and the pier', badClear === 0, badClear);
  const lh = P.headland.lighthouse;
  check('the lighthouse stands on high ground (> 8 m) near the water', !!lh && T.heightAt(lh.x, lh.z) > 8, lh);
  // the composite ground: without GPU fields every structure query is −Infinity, so the reef wins
  check('composite ground falls back to the reef where no field is loaded', a1.ground.structureAt(-78, 58) === reef.structureAt(-78, 58) && a1.floor.floorHeightAt(0, 66) === reef.floorHeightAt(0, 66));
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
