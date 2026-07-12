// Gait detection (V3 Walking) — node-only protocol tests: known synthetic
// cadences in → step counts / cadence out, hysteresis floors, the
// march↔sway source switch, dropout decay, schema shape, and replay
// determinism with the gait block present. Real-clip validation is
// deferred to FINAL_USER_TEST_PLAN S8 (fixtures optional per the prompt);
// false-positive rows on the existing fixtures live in
// packages/body-input/tools/fixture-eval.mjs.
import { test, expect } from '@playwright/test';
import {
  assertSignalShape, canonicalSignalJSON, canonicalStreamJSON, createBodyInputCore,
  createInputRecorder, runTape,
  type BodyInputFrame, type BodySignal, type LandmarkPoint,
} from '../packages/body-input/src/index';
import { LM } from '../packages/body-input/src/lm';

// --- synthetic person in MediaPipe WORLD space (y down), mirrored
// convention: +x = screen right = the user's own right. LM.left* slots are
// the user's anatomical RIGHT side.

interface WalkOpts {
  /** phase of the march cycle (radians): the user's LEFT knee lifts on the
   *  positive half-sine, their RIGHT on the negative */
  marchPhase?: number;
  /** thigh swing at full knee lift, degrees from vertical (thigh 0.45 m) */
  marchLiftDeg?: number;
  /** whole-body lateral offset, meters (+ = the user's right) */
  swayM?: number;
  /** + = lean toward the user's right, degrees (rotates the torso) */
  leanDeg?: number;
  /** lower shoulders/hips by this many meters (both-knee crouch bounce) */
  dropM?: number;
  legsVis?: number;
  hipsVis?: number;
  /** deterministic per-landmark jitter amplitude, meters */
  jitter?: number;
  jitterPhase?: number;
}

function lm(x: number, y: number, z: number, visibility = 0.95): LandmarkPoint {
  return { x, y, z, visibility };
}

function walkFrame(tsMs: number, o: WalkOpts = {}): BodyInputFrame {
  const world: LandmarkPoint[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  const legsVis = o.legsVis ?? 0.95;
  const hipsVis = o.hipsVis ?? 0.95;
  const drop = o.dropM ?? 0;
  const sway = o.swayM ?? 0;

  let sh: [number, number, number][] = [
    [0.18, -0.5, 0],
    [-0.18, -0.5, 0],
  ];
  let nose: [number, number, number] = [0, -0.65, -0.08];
  if (o.leanDeg) {
    const a = (o.leanDeg * Math.PI) / 180;
    const rot = (p: [number, number, number]): [number, number, number] => [
      p[0] * Math.cos(a) - p[1] * Math.sin(a),
      p[0] * Math.sin(a) + p[1] * Math.cos(a),
      p[2],
    ];
    sh = sh.map(rot) as typeof sh;
    nose = rot(nose);
  }
  world[LM.leftShoulder] = lm(sh[0][0] + sway, sh[0][1] + drop, sh[0][2]);
  world[LM.rightShoulder] = lm(sh[1][0] + sway, sh[1][1] + drop, sh[1][2]);
  world[LM.nose] = lm(nose[0] + sway, nose[1] + drop, nose[2]);
  world[LM.leftHip] = lm(0.1 + sway, drop, 0, hipsVis);
  world[LM.rightHip] = lm(-0.1 + sway, drop, 0, hipsVis);

  // legs: RIGID thigh, 0.45 m — a lift rotates it about the hip (knee
  // rises and comes toward the camera; |hip−knee| never changes). March
  // alternates: the user's LEFT knee (LM.right* slots) lifts on the
  // positive half-sine, their RIGHT (LM.left* slots) on the negative.
  const thigh = 0.45;
  const maxRad = ((o.marchLiftDeg ?? 70) * Math.PI) / 180;
  const p = o.marchPhase ?? 0;
  const thetaUserLeft = Math.max(0, Math.sin(p)) * maxRad;
  const thetaUserRight = Math.max(0, -Math.sin(p)) * maxRad;
  world[LM.leftKnee] = lm(
    0.1 + sway, drop + thigh * Math.cos(thetaUserRight), -thigh * Math.sin(thetaUserRight), legsVis,
  );
  world[LM.rightKnee] = lm(
    -0.1 + sway, drop + thigh * Math.cos(thetaUserLeft), -thigh * Math.sin(thetaUserLeft), legsVis,
  );
  world[LM.leftAnkle] = lm(0.1 + sway, 0.9, 0, legsVis);
  world[LM.rightAnkle] = lm(-0.1 + sway, 0.9, 0, legsVis);

  // arms hang
  const armLen = 0.5;
  world[LM.leftWrist] = lm(world[LM.leftShoulder].x + 0.02, world[LM.leftShoulder].y + armLen, 0);
  world[LM.rightWrist] = lm(world[LM.rightShoulder].x - 0.02, world[LM.rightShoulder].y + armLen, 0);
  world[LM.leftElbow] = lm(world[LM.leftShoulder].x, world[LM.leftShoulder].y + armLen / 2, 0);
  world[LM.rightElbow] = lm(world[LM.rightShoulder].x, world[LM.rightShoulder].y + armLen / 2, 0);

  const jit = o.jitter ?? 0;
  const phase = o.jitterPhase ?? 0;
  if (jit > 0) {
    world.forEach((pt, k) => {
      const dj = jit * Math.sin(phase + k * 1.3);
      pt.x += dj;
      pt.y += dj;
      pt.z += dj;
    });
  }

  const norm = world.map((pt) => ({
    x: 0.5 + pt.x * 0.25,
    y: 0.55 + pt.y * 0.25,
    z: pt.z * 0.25,
    visibility: pt.visibility,
  }));
  return { tsMs, world, norm };
}

const STEP = 33; // ~30 fps, integer ms for byte-stable timestamps

function seq(startTs: number, n: number, o: WalkOpts | ((i: number) => WalkOpts) = {}): BodyInputFrame[] {
  return Array.from({ length: n }, (_, i) =>
    walkFrame(startTs + i * STEP, typeof o === 'function' ? o(i) : o),
  );
}

function nullFrames(startTs: number, n: number): BodyInputFrame[] {
  return Array.from({ length: n }, (_, i) => ({ tsMs: startTs + i * STEP, world: null, norm: null }));
}

/** 40 frames (1.3 s) of confident stillness — provisional neutral capture. */
function leadIn(o: WalkOpts = {}): BodyInputFrame[] {
  return seq(0, 40, o);
}

function after(frames: BodyInputFrame[], more: (lastTs: number) => BodyInputFrame[]): BodyInputFrame[] {
  const lastTs = frames[frames.length - 1].tsMs;
  return frames.concat(more(lastTs + STEP));
}

function run(frames: BodyInputFrame[]): BodySignal[] {
  const core = createBodyInputCore();
  return frames.map((f) => core.push(f));
}

const last = <T>(a: T[]): T => a[a.length - 1];

/** March frames at a full L-R cycle frequency of `hz` (steps/s = 2·hz). */
function march(startTs: number, seconds: number, hz: number, o: WalkOpts = {}): BodyInputFrame[] {
  const n = Math.round((seconds * 1000) / STEP);
  return seq(startTs, n, (i) => ({ ...o, marchPhase: 2 * Math.PI * hz * ((i * STEP) / 1000) }));
}

/** Whole-body sway at a full cycle frequency of `hz` (steps/s = 2·hz),
 *  legs out of frame (the desk-framing / weight-shift substrate). */
function swayWalk(startTs: number, seconds: number, hz: number, ampM = 0.08): BodyInputFrame[] {
  const n = Math.round((seconds * 1000) / STEP);
  return seq(startTs, n, (i) => ({
    legsVis: 0.2,
    swayM: ampM * Math.sin(2 * Math.PI * hz * ((i * STEP) / 1000)),
  }));
}

// ---------------------------------------------------------------------------

test('march: known cadence in → step count and cadence out (3 rates)', () => {
  // full-cycle hz → steps/s = 2·hz; expected steps ≈ 2·hz·seconds
  for (const [hz, seconds] of [[0.5, 12], [0.9, 10], [1.35, 8]] as const) {
    const frames = after(leadIn(), (t) => march(t, seconds, hz));
    const out = run(frames);
    const g = last(out).gait!;
    const expected = 2 * hz * seconds;
    expect(g.count, `steps @ ${hz} Hz cycle`).toBeGreaterThanOrEqual(Math.floor(expected) - 2);
    expect(g.count, `steps @ ${hz} Hz cycle`).toBeLessThanOrEqual(Math.ceil(expected) + 1);
    expect(g.active, `active @ ${hz}`).toBe(true);
    expect(g.source).toBe('legs');
    expect(Math.abs(g.cadence - 2 * hz) / (2 * hz), `cadence @ ${hz}`).toBeLessThan(0.12);
  }
});

test('march: amp reflects lift size; shift alternates sign with the legs', () => {
  const frames = after(leadIn(), (t) => march(t, 8, 0.9));
  const out = run(frames);
  expect(last(out).gait!.amp).toBeGreaterThan(0.35);
  // shift must visit both polarities during the alternation
  const shifts = out.slice(60).map((s) => s.gait!.shift);
  expect(Math.max(...shifts)).toBeGreaterThan(0.3);
  expect(Math.min(...shifts)).toBeLessThan(-0.3);
});

test('shift sign convention: user LEFT knee held high → shift positive', () => {
  // user's left knee = LM.right* slots (mirrored input) = marchPhase π/2
  const frames = after(leadIn(), (t) => seq(t, 40, { marchPhase: Math.PI / 2 }));
  const g = last(run(frames)).gait!;
  expect(g.shift).toBeGreaterThan(0.4);
  // and a held pose is NOT a rhythm
  expect(g.active).toBe(false);
});

test('sway substrate: weight-shift with legs out of frame counts steps', () => {
  const frames = after(leadIn({ legsVis: 0.2 }), (t) => swayWalk(t, 12, 0.55));
  const out = run(frames);
  const g = last(out).gait!;
  const expected = 2 * 0.55 * 12; // ≈ 13.2 steps
  expect(g.source).toBe('sway');
  expect(g.count).toBeGreaterThanOrEqual(Math.floor(expected) - 3); // EMA ref settles first
  expect(g.count).toBeLessThanOrEqual(Math.ceil(expected) + 1);
  expect(g.active).toBe(true);
  expect(Math.abs(g.cadence - 1.1) / 1.1).toBeLessThan(0.15);
});

test('negatives: still / jitter / crouch bounce / slow alternating lean → no steps', () => {
  // still
  expect(last(run(after(leadIn(), (t) => seq(t, 300)))).gait!.count).toBe(0);

  // sub-hysteresis jitter (~1 cm)
  const jitter = after(leadIn(), (t) => seq(t, 300, (i) => ({ jitter: 0.01, jitterPhase: i * 0.9 })));
  expect(last(run(jitter)).gait!.count).toBe(0);

  // both-knee crouch bounce (kneeDiff stays 0)
  const crouch = after(leadIn(), (t) =>
    seq(t, 300, (i) => ({ dropM: 0.12 * Math.max(0, Math.sin((2 * Math.PI * 0.5 * i * STEP) / 1000)) })),
  );
  expect(last(run(crouch)).gait!.count).toBe(0);

  // slow alternating lean, legs visible (march substrate quiet)
  const lean = after(leadIn(), (t) =>
    seq(t, 400, (i) => ({ leanDeg: 12 * Math.sin((2 * Math.PI * 0.15 * i * STEP) / 1000) })),
  );
  expect(last(run(lean)).gait!.count).toBe(0);

  // slow alternating lean with legs OUT of frame (sway substrate active):
  // torso rotation about the hips must not read as hip translation
  const leanNoLegs = after(leadIn({ legsVis: 0.2 }), (t) =>
    seq(t, 400, (i) => ({ legsVis: 0.2, leanDeg: 12 * Math.sin((2 * Math.PI * 0.15 * i * STEP) / 1000) })),
  );
  expect(last(run(leanNoLegs)).gait!.count).toBe(0);
});

test('dropout: cadence decays, count is monotonic, recovery has no spike', () => {
  let frames = after(leadIn(), (t) => march(t, 8, 0.9));
  const atLoss = run(frames);
  const beforeLoss = last(atLoss).gait!;
  expect(beforeLoss.active).toBe(true);

  frames = after(frames, (t) => nullFrames(t, 120)); // 4 s dropout
  const afterLoss = run(frames);
  const lost = last(afterLoss).gait!;
  expect(lost.active).toBe(false);
  expect(lost.cadence).toBeLessThan(0.3);
  expect(lost.count).toBe(beforeLoss.count); // never counts in the dark
  expect(Math.abs(lost.shift)).toBeLessThan(0.05); // shift eased to center

  // resume marching: steps resume, count stays monotonic, no burst
  frames = after(frames, (t) => march(t, 6, 0.9));
  const resumed = run(frames);
  const g = last(resumed).gait!;
  expect(g.active).toBe(true);
  const resumedSteps = g.count - beforeLoss.count;
  expect(resumedSteps).toBeGreaterThanOrEqual(8);
  expect(resumedSteps).toBeLessThanOrEqual(12); // ≈ 2·0.9·6 = 10.8, never a spike
  for (let i = 1; i < resumed.length; i++) {
    expect(resumed[i].gait!.count).toBeGreaterThanOrEqual(resumed[i - 1].gait!.count);
  }
});

test('source switch march→sway rebases without a phantom burst', () => {
  // 8 s of marching, then the legs leave frame and the user weight-shifts
  let frames = after(leadIn(), (t) => march(t, 8, 0.9));
  const marchOnly = last(run(frames)).gait!;
  frames = after(frames, (t) => swayWalk(t, 8, 0.55));
  const out = run(frames);
  const g = last(out).gait!;
  expect(g.source).toBe('sway');
  const swaySteps = g.count - marchOnly.count;
  const expected = 2 * 0.55 * 8; // ≈ 8.8
  // the switch itself must not mint steps: allow the sway rhythm ± ref settle
  expect(swaySteps).toBeGreaterThanOrEqual(Math.floor(expected) - 3);
  expect(swaySteps).toBeLessThanOrEqual(Math.ceil(expected) + 1);
});

test('gait block: schema-shaped, canonical order, quantized, old signals valid', () => {
  const frames = after(leadIn(), (t) => march(t, 5, 0.9));
  const out = run(frames);
  for (const s of out) assertSignalShape(s);
  const json = canonicalSignalJSON(last(out));
  // gait serializes last, after swim, in declared key order
  expect(json).toMatch(/"swim":\{[^}]*\},"gait":\{"active":(true|false),"count":\d+,"cadence":/);
  // a pre-gait signal (block absent) still validates — additive contract
  const legacy = JSON.parse(JSON.stringify(last(out))) as Record<string, unknown>;
  delete legacy.gait;
  expect(() => assertSignalShape(legacy)).not.toThrow();
});

test('replay determinism: marching tape → byte-identical stream, gait included', () => {
  const rec = createInputRecorder();
  let frames = leadIn();
  frames = after(frames, (t) => march(t, 6, 0.9));
  frames = after(frames, (t) => nullFrames(t, 30));
  frames = after(frames, (t) => swayWalk(t, 5, 0.55));
  for (const f of frames) rec.push(f);
  const tape = rec.tape();
  const a = canonicalStreamJSON(runTape(tape));
  const b = canonicalStreamJSON(runTape(tape));
  expect(a.length).toBeGreaterThan(1000);
  expect(a).toContain('"gait"');
  expect(a).toBe(b);
});
