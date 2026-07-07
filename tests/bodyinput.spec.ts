// @bodyarcade/body-input protocol tests (node, no browser): determinism,
// the landmark privacy boundary, sign conventions, event machines, seated
// detection, and every failure mode from the mission (upper-body framing,
// arms leaving mid-gesture, sit-down mid-session, too close, dropout).
import { test, expect } from '@playwright/test';
import {
  createBodyInputCore, createInPageChannel, createBroadcastSink, createBroadcastSource,
  createInputRecorder, runTape, canonicalStreamJSON, assertSignalShape,
  type BodyInputFrame, type BodySignal, type LandmarkPoint,
} from '../packages/body-input/src/index';
import { LM } from '../packages/body-input/src/lm';

// --- synthetic person in MediaPipe WORLD space (y down, z toward camera =
// negative), mirrored convention: +x = screen right = the user's own right.

interface PoseOpts {
  /** + = lean toward the user's right, degrees */
  leanDeg?: number;
  /** + = lean toward the camera, degrees */
  leanFwdDeg?: number;
  /** lower shoulders/hips by this many meters (knee bend) */
  dropM?: number;
  tpose?: boolean;
  /** 0..1: wrists this fraction of an arm length toward the camera */
  armsFwd?: number;
  pointLeft?: boolean;
  seated?: boolean;
  /** thighs horizontal like a sit, but heels under the hips */
  crouchDeep?: boolean;
  legsVis?: number;
  hipsVis?: number;
  armsVis?: number;
  /** uniform world-scale (the "too close" case) */
  scale?: number;
  /** deterministic per-landmark jitter amplitude, meters (needs jitterPhase) */
  jitter?: number;
  jitterPhase?: number;
}

function lm(x: number, y: number, z: number, visibility = 0.95): LandmarkPoint {
  return { x, y, z, visibility };
}

function makeFrame(tsMs: number, o: PoseOpts = {}): BodyInputFrame {
  const world: LandmarkPoint[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  const armsVis = o.armsVis ?? 0.95;
  const hipsVis = o.hipsVis ?? 0.95;
  const legsVis = o.legsVis ?? 0.95;

  // torso + head
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
  if (o.leanFwdDeg) {
    const b = (o.leanFwdDeg * Math.PI) / 180;
    const rot = (p: [number, number, number]): [number, number, number] => [
      p[0],
      p[1] * Math.cos(b),
      p[2] + p[1] * Math.sin(b), // y is negative above the hips → z goes negative = toward camera
    ];
    sh = sh.map(rot) as typeof sh;
    nose = rot(nose);
  }
  const drop = o.dropM ?? 0;
  world[LM.leftShoulder] = lm(sh[0][0], sh[0][1] + drop, sh[0][2]);
  world[LM.rightShoulder] = lm(sh[1][0], sh[1][1] + drop, sh[1][2]);
  world[LM.nose] = lm(nose[0], nose[1] + drop, nose[2]);
  world[LM.leftHip] = lm(0.1, drop, 0, hipsVis);
  world[LM.rightHip] = lm(-0.1, drop, 0, hipsVis);

  // legs
  if (o.crouchDeep) {
    // hips dropped, thighs horizontal, ankles staying under the hips
    world[LM.leftHip] = lm(0.1, 0.35, 0, hipsVis);
    world[LM.rightHip] = lm(-0.1, 0.35, 0, hipsVis);
    world[LM.leftShoulder] = lm(sh[0][0], sh[0][1] + 0.35, sh[0][2]);
    world[LM.rightShoulder] = lm(sh[1][0], sh[1][1] + 0.35, sh[1][2]);
    world[LM.leftKnee] = lm(0.1, 0.38, -0.35, legsVis);
    world[LM.rightKnee] = lm(-0.1, 0.38, -0.35, legsVis);
    // heels slightly BEHIND the hips, as the real crouch fixture measures
    world[LM.leftAnkle] = lm(0.1, 0.9, 0.1, legsVis);
    world[LM.rightAnkle] = lm(-0.1, 0.9, 0.1, legsVis);
  } else if (o.seated) {
    world[LM.leftKnee] = lm(0.1, 0.05, -0.4, legsVis);
    world[LM.rightKnee] = lm(-0.1, 0.05, -0.4, legsVis);
    world[LM.leftAnkle] = lm(0.1, 0.5, -0.4, legsVis);
    world[LM.rightAnkle] = lm(-0.1, 0.5, -0.4, legsVis);
  } else {
    world[LM.leftKnee] = lm(0.1, 0.45, 0, legsVis);
    world[LM.rightKnee] = lm(-0.1, 0.45, 0, legsVis);
    world[LM.leftAnkle] = lm(0.1, 0.9, 0, legsVis);
    world[LM.rightAnkle] = lm(-0.1, 0.9, 0, legsVis);
  }

  // arms: hang from the (possibly leaned/dropped) shoulders by default
  const armLen = 0.5;
  const wrist = (side: 1 | -1): [number, number, number] => {
    const s = side === 1 ? world[LM.leftShoulder] : world[LM.rightShoulder];
    if (o.tpose) return [s.x + side * armLen, s.y, s.z];
    let fwd = o.armsFwd ?? 0;
    if (o.pointLeft) fwd = side === 1 ? 1 : 0;
    if (fwd > 0) return [s.x, s.y, s.z - fwd * armLen];
    return [s.x + side * 0.02, s.y + armLen, s.z];
  };
  const lw = wrist(1);
  const rw = wrist(-1);
  world[LM.leftWrist] = lm(lw[0], lw[1], lw[2], armsVis);
  world[LM.rightWrist] = lm(rw[0], rw[1], rw[2], armsVis);
  world[LM.leftElbow] = lm((world[LM.leftShoulder].x + lw[0]) / 2, (world[LM.leftShoulder].y + lw[1]) / 2, 0, armsVis);
  world[LM.rightElbow] = lm((world[LM.rightShoulder].x + rw[0]) / 2, (world[LM.rightShoulder].y + rw[1]) / 2, 0, armsVis);

  const scale = o.scale ?? 1;
  const jit = o.jitter ?? 0;
  const phase = o.jitterPhase ?? 0;
  world.forEach((p, k) => {
    // per-landmark phase: uniform jitter would cancel in the torso basis
    const dj = jit * Math.sin(phase + k * 1.3);
    p.x = p.x * scale + dj;
    p.y = p.y * scale + dj;
    p.z = p.z * scale + dj;
  });

  const norm = world.map((p) => ({
    x: 0.5 + p.x * 0.25,
    y: 0.55 + p.y * 0.25,
    z: p.z * 0.25,
    visibility: p.visibility,
  }));
  return { tsMs, world, norm };
}

const STEP = 33; // ~30 fps, integer ms for byte-stable timestamps

function seq(startTs: number, n: number, o: PoseOpts | ((i: number) => PoseOpts) = {}): BodyInputFrame[] {
  return Array.from({ length: n }, (_, i) =>
    makeFrame(startTs + i * STEP, typeof o === 'function' ? o(i) : o),
  );
}

function nullFrames(startTs: number, n: number): BodyInputFrame[] {
  return Array.from({ length: n }, (_, i) => ({ tsMs: startTs + i * STEP, world: null, norm: null }));
}

/** 40 frames (1.3 s) of confident stillness — enough for the provisional
 *  neutral auto-capture (dwell 800 ms after confidence passes 0.6). */
function neutralLeadIn(o: PoseOpts = {}): BodyInputFrame[] {
  return seq(0, 40, o);
}

function run(frames: BodyInputFrame[]): BodySignal[] {
  const core = createBodyInputCore();
  return frames.map((f) => core.push(f));
}

function after(frames: BodyInputFrame[], more: (lastTs: number) => BodyInputFrame[]): BodyInputFrame[] {
  const lastTs = frames[frames.length - 1].tsMs;
  return frames.concat(more(lastTs + STEP));
}

const last = <T>(a: T[]): T => a[a.length - 1];

// ---------------------------------------------------------------------------

test('replay determinism: same input tape → byte-identical signal stream', () => {
  const rec = createInputRecorder();
  let frames = neutralLeadIn();
  frames = after(frames, (t) => seq(t, 30, { leanDeg: 12 }));
  frames = after(frames, (t) => nullFrames(t, 15));
  frames = after(frames, (t) => seq(t, 45, { tpose: true }));
  frames = after(frames, (t) => seq(t, 20, (i) => ({ armsFwd: Math.min(1, i / 5) })));
  for (const f of frames) rec.push(f);
  const tape = rec.tape();

  const a = canonicalStreamJSON(runTape(tape));
  const b = canonicalStreamJSON(runTape(tape));
  expect(a.length).toBeGreaterThan(1000);
  expect(a).toBe(b);
});

test('privacy boundary: every emitted message is exactly schema-shaped', () => {
  const frames = after(neutralLeadIn(), (t) => seq(t, 30, { leanDeg: 10, armsFwd: 0.5 }));
  for (const s of run(frames)) {
    assertSignalShape(s); // throws on any landmark-shaped content
    const clone = structuredClone(s); // transport-safe
    expect(clone).toEqual(s);
  }
  // negative cases: the guard actually bites
  const good = last(run(neutralLeadIn()));
  expect(() => assertSignalShape({ ...good, landmarks: [] })).toThrow(/keys/);
  expect(() => assertSignalShape({ ...good, events: [{ x: 1, y: 2, z: 3 }] })).toThrow();
  expect(() => assertSignalShape({ ...good, v: 2 })).toThrow(/v=2/);
  expect(() => assertSignalShape({ ...good, axes: { ...good.axes, leanX: NaN } })).toThrow();
});

test('tracking block (PPC): optional, validated, canonical, passed through', () => {
  const tracking = {
    torso: 'visible', head: 'visible', leftArm: 'predicted',
    rightArm: 'visible', leftLeg: 'relaxed', rightLeg: 'visible',
  } as const;
  // absent stays valid (old signals/tapes), present validates + serializes
  const good = last(run(neutralLeadIn()));
  assertSignalShape(good);
  assertSignalShape({ ...good, tracking });
  expect(canonicalStreamJSON([{ ...good, tracking }])).toContain('"leftArm":"predicted"');
  // closed sub-shape: wrong keys and wrong states both rejected
  expect(() => assertSignalShape({ ...good, tracking: { ...tracking, extra: 'visible' } })).toThrow(/tracking/);
  expect(() => assertSignalShape({ ...good, tracking: { ...tracking, torso: 'faked' } })).toThrow(/tracking/);
  const { leftLeg: _omit, ...missing } = tracking;
  expect(() => assertSignalShape({ ...good, tracking: missing })).toThrow(/tracking/);

  // pipeline pass-through: a frame carrying tracking emits it verbatim
  const core = createBodyInputCore();
  let sig = null;
  for (const f of neutralLeadIn()) sig = core.push({ ...f, tracking });
  expect(sig.tracking).toEqual(tracking);
  assertSignalShape(sig);
});

test('sign conventions: lean right → +leanX, lean forward → +leanY', () => {
  const right = last(run(after(neutralLeadIn(), (t) => seq(t, 40, { leanDeg: 12 }))));
  expect(right.axes.leanX).toBeGreaterThan(0.4);
  expect(Math.abs(right.axes.leanY)).toBeLessThan(0.25);

  const left = last(run(after(neutralLeadIn(), (t) => seq(t, 40, { leanDeg: -12 }))));
  expect(left.axes.leanX).toBeLessThan(-0.4);

  const fwd = last(run(after(neutralLeadIn(), (t) => seq(t, 40, { leanFwdDeg: 10 }))));
  expect(fwd.axes.leanY).toBeGreaterThan(0.4);
  expect(Math.abs(fwd.axes.leanX)).toBeLessThan(0.25);
});

test('crouch rises and releases; tallness stays quiet', () => {
  let frames = after(neutralLeadIn(), (t) => seq(t, 40, { dropM: 0.35 }));
  const down = last(run(frames));
  expect(down.axes.crouch).toBeGreaterThan(0.6);
  expect(down.axes.tallness).toBe(0);
  frames = after(frames, (t) => seq(t, 40));
  const up = last(run(frames));
  expect(up.axes.crouch).toBeLessThan(0.1);
});

test('T-pose: armsOut ≈ 1, recenter fires exactly once, neutral becomes explicit', () => {
  const frames = after(neutralLeadIn(), (t) => seq(t, 55, { tpose: true })); // ~1.8 s hold
  const signals = run(frames);
  const fin = last(signals);
  expect(fin.axes.armsOut).toBeGreaterThan(0.8);
  expect(fin.axes.armsRaised).toBeLessThan(0.2);
  const recenters = signals.filter((s) => s.events.includes('recenter'));
  expect(recenters.length).toBe(1);
  expect(fin.neutralConfidence).toBe(1);
  expect(signals.filter((s) => s.events.includes('action')).length).toBe(0);
});

test('action: fast hands-forward thrust fires once per thrust, rearms on withdraw', () => {
  let frames = after(neutralLeadIn(), (t) => seq(t, 8, (i) => ({ armsFwd: Math.min(1, (i + 1) / 5) })));
  frames = after(frames, (t) => seq(t, 15, { armsFwd: 1 })); // hold — must not refire
  frames = after(frames, (t) => seq(t, 45, {})); // withdraw + refractory
  frames = after(frames, (t) => seq(t, 8, (i) => ({ armsFwd: Math.min(1, (i + 1) / 5) })));
  frames = after(frames, (t) => seq(t, 15, { armsFwd: 1 }));
  const signals = run(frames);
  expect(signals.filter((s) => s.events.includes('action')).length).toBe(2);
});

test('dropout: documented confidence decay, axes decay to neutral, no NaN, bounded recovery', () => {
  let frames = after(neutralLeadIn(), (t) => seq(t, 40, { leanDeg: 12 }));
  const preDrop = run(frames);
  const c0 = last(preDrop).confidence;
  const lean0 = last(preDrop).axes.leanX;
  expect(lean0).toBeGreaterThan(0.4);

  frames = after(frames, (t) => nullFrames(t, 30)); // ~1 s dropout
  frames = after(frames, (t) => seq(t, 40, { leanDeg: 12 })); // re-acquire same pose
  const signals = run(frames);
  for (const s of signals) assertSignalShape(s); // finiteness everywhere

  // confidence follows exp(−t/300ms) during the dropout
  const dropStart = 80;
  for (const k of [5, 15, 30]) {
    const expected = c0 * Math.exp((-STEP * k) / 300);
    expect(Math.abs(signals[dropStart - 1 + k].confidence - expected)).toBeLessThan(0.02);
  }
  // leanX decays toward 0 with τ = 500ms
  const expectedLean = lean0 * Math.exp((-STEP * 15) / 500);
  expect(Math.abs(signals[dropStart - 1 + 15].axes.leanX - expectedLean)).toBeLessThan(0.05);
  // recovery: bounded step (slew 6/s → ≤ ~0.2 per frame), and it does recover
  for (let i = dropStart + 30; i < signals.length; i++) {
    const step = Math.abs(signals[i].axes.leanX - signals[i - 1].axes.leanX);
    expect(step).toBeLessThanOrEqual(6 * (STEP / 1000) + 0.02);
  }
  expect(last(signals).axes.leanX).toBeGreaterThan(0.4);
});

test('upper-body-only framing: lean + arms still work, crouch falls back to image space', () => {
  const ub: PoseOpts = { legsVis: 0, hipsVis: 0.85 };
  const lean = last(run(after(neutralLeadIn(ub), (t) => seq(t, 40, { ...ub, leanDeg: 12 }))));
  expect(lean.axes.leanX).toBeGreaterThan(0.35);
  expect(lean.seated).toBe(false);

  const arms = last(run(after(neutralLeadIn(ub), (t) => seq(t, 40, { ...ub, tpose: true }))));
  expect(arms.axes.armsOut).toBeGreaterThan(0.8);

  // shoulder-line drops in the image → crouch via the norm-space fallback
  const crouch = last(run(after(neutralLeadIn(ub), (t) => seq(t, 35, { ...ub, dropM: 0.29 }))));
  expect(crouch.axes.crouch).toBeGreaterThan(0.4);
  expect(crouch.seated).toBe(false);
});

test('arms leave frame mid-gesture: no stuck machines, no phantom recenter', () => {
  let frames = after(neutralLeadIn(), (t) => seq(t, 20, { tpose: true })); // 0.66 s — under the 1 s hold
  frames = after(frames, (t) => seq(t, 30, { tpose: true, armsVis: 0 })); // arms vanish mid-hold
  frames = after(frames, (t) => seq(t, 15, {}));
  const signals = run(frames);
  expect(signals.filter((s) => s.events.length > 0).length).toBe(0);
  // armsOut decayed once the wrists vanished
  expect(last(signals).axes.armsOut).toBeLessThan(0.1);
  // and the machinery still works afterwards
  const again = run(after(frames, (t) => seq(t, 55, { tpose: true })));
  expect(again.filter((s) => s.events.includes('recenter')).length).toBe(1);
});

test('sitting down mid-session: seated flips once, neutral trust drops until recenter', () => {
  let frames = after(neutralLeadIn(), (t) => seq(t, 75, { seated: true })); // 2.5 s seated
  const signals = run(frames);
  const flips = signals.filter((s, i) => i > 0 && s.seated !== signals[i - 1].seated);
  expect(flips.length).toBe(1);
  expect(last(signals).seated).toBe(true);
  expect(last(signals).neutralConfidence).toBe(0.3);
  // recenter (T-pose while seated) restores trust
  frames = after(frames, (t) => seq(t, 55, { seated: true, tpose: true }));
  const s2 = run(frames);
  expect(last(s2).neutralConfidence).toBe(1);
  expect(last(s2).seated).toBe(true);
});

test('deep crouch is NOT seated (heels under hips), and crouch survives it', () => {
  const frames = after(neutralLeadIn(), (t) => seq(t, 75, { crouchDeep: true })); // 2.5 s hold
  const signals = run(frames);
  expect(signals.every((s) => !s.seated)).toBe(true);
  // the crouch axis reads the drop instead of being re-referenced away
  expect(last(signals).axes.crouch).toBeGreaterThan(0.5);
});

test('too close (huge, hips barely tracked): confidence-gated, finite, sane', () => {
  const close: PoseOpts = { scale: 3, hipsVis: 0.2, legsVis: 0 };
  const signals = run(after(neutralLeadIn(close), (t) => seq(t, 40, { ...close, leanDeg: 12 })));
  for (const s of signals) assertSignalShape(s);
  const fin = last(signals);
  expect(fin.confidence).toBeLessThan(0.85); // hips missing shows up honestly
  expect(fin.axes.leanX).toBeGreaterThan(0.2); // shoulders-only fallback still reads
});

test('stillness: quiet input → dead-zoned axes, high stillness, zero events', () => {
  // deterministic sub-centimeter wobble
  const frames = seq(0, 90, (i) => ({ jitter: 0.003, jitterPhase: i * 0.7 }));
  const signals = run(frames);
  const fin = last(signals);
  expect(fin.stillness).toBeGreaterThanOrEqual(0.8);
  expect(signals.filter((s) => s.events.length > 0).length).toBe(0);
  for (const k of ['leanX', 'leanY', 'crouch', 'tallness'] as const) {
    expect(Math.abs(fin.axes[k])).toBeLessThanOrEqual(0.05);
  }
});

test('handPoint: single pointed arm reads, T-pose does not', () => {
  const point = last(run(after(neutralLeadIn(), (t) => seq(t, 40, { pointLeft: true }))));
  expect(point.axes.handPoint).toBeGreaterThan(0.6);
  const tpose = last(run(after(neutralLeadIn(), (t) => seq(t, 40, { tpose: true }))));
  expect(tpose.axes.handPoint).toBeLessThan(0.2);
});

test('in-page transport delivers validated signals', () => {
  const { source, sink } = createInPageChannel();
  const got: BodySignal[] = [];
  const unsub = source.subscribe((s) => got.push(s));
  const signals = run(neutralLeadIn());
  for (const s of signals) sink.publish(s);
  expect(got.length).toBe(signals.length);
  expect(got[0]).toEqual(signals[0]);
  unsub();
  sink.publish(signals[0]);
  expect(got.length).toBe(signals.length);
  // the sink refuses non-schema messages — the boundary is enforced live
  expect(() => sink.publish({ bad: true } as unknown as BodySignal)).toThrow();
});

test('BroadcastChannel transport crosses instances and filters schema majors', async () => {
  const name = `bodyinput-test-${Date.now()}`;
  const source = createBroadcastSource(name);
  const sink = createBroadcastSink(name);
  const raw = new BroadcastChannel(name); // to inject a bad-version message
  try {
    const got: BodySignal[] = [];
    source.subscribe((s) => got.push(s));
    const signal = last(run(neutralLeadIn()));
    sink.publish(signal);
    raw.postMessage({ v: 99, nonsense: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(got.length).toBe(1);
    assertSignalShape(got[0]);
    expect(got[0]).toEqual(signal);
  } finally {
    source.close();
    sink.close();
    raw.close();
  }
});
