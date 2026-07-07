// Predictive Pose Continuity unit tests (node, no browser): pass-through
// exactness, the VISIBLE → PREDICTED → RELAXED machine, the 400 ms horizon
// cap, prediction beating hold-last-visible on linear motion, bone-length
// constraints, no-snap re-entry, monotone confidence decay, full-dropout
// synthesis, determinism, and no NaN under a chaotic stream.
import { test, expect } from '@playwright/test';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { PoseContinuity, PPC, type PpcGroupInfo } from '../src/pose/continuity';

const DT = 100 / 3; // ms per pose frame (~30 fps)

function lm(x: number, y: number, z: number, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}

/** Plausible standing person, metric world space (y down), all visible. */
function person(): LandmarkPoint[] {
  const w = Array.from({ length: 33 }, () => lm(0, -0.6, 0));
  w[LM.nose] = lm(0, -0.65, -0.1);
  w[LM.leftEar] = lm(0.07, -0.62, 0);
  w[LM.rightEar] = lm(-0.07, -0.62, 0);
  w[LM.leftShoulder] = lm(0.18, -0.5, 0);
  w[LM.rightShoulder] = lm(-0.18, -0.5, 0);
  w[LM.leftElbow] = lm(0.24, -0.26, 0);
  w[LM.rightElbow] = lm(-0.24, -0.26, 0);
  w[LM.leftWrist] = lm(0.26, -0.02, 0);
  w[LM.rightWrist] = lm(-0.26, -0.02, 0);
  for (const [h, wr] of [
    [LM.leftPinky, LM.leftWrist], [LM.leftIndex, LM.leftWrist], [LM.leftThumb, LM.leftWrist],
    [LM.rightPinky, LM.rightWrist], [LM.rightIndex, LM.rightWrist], [LM.rightThumb, LM.rightWrist],
  ] as const) {
    w[h] = lm(w[wr].x * 1.05, w[wr].y + 0.08, w[wr].z);
  }
  w[LM.leftHip] = lm(0.1, 0, 0);
  w[LM.rightHip] = lm(-0.1, 0, 0);
  w[LM.leftKnee] = lm(0.11, 0.4, 0);
  w[LM.rightKnee] = lm(-0.11, 0.4, 0);
  w[LM.leftAnkle] = lm(0.12, 0.78, 0);
  w[LM.rightAnkle] = lm(-0.12, 0.78, 0);
  w[LM.leftHeel] = lm(0.12, 0.82, 0.02);
  w[LM.rightHeel] = lm(-0.12, 0.82, 0.02);
  w[LM.leftFootIndex] = lm(0.12, 0.84, -0.08);
  w[LM.rightFootIndex] = lm(-0.12, 0.84, -0.08);
  return w;
}

/** Cheap norm stream derived from world (values in ~[0,1], y down). */
function toNorm(w: LandmarkPoint[]): LandmarkPoint[] {
  return w.map((p) => lm(0.5 + p.x * 0.4, 0.55 + p.y * 0.35, p.z * 0.1, p.visibility));
}

function mask(w: LandmarkPoint[], indices: number[]): LandmarkPoint[] {
  const c = w.map((p) => ({ ...p }));
  for (const i of indices) c[i] = { ...c[i], visibility: 0 };
  return c;
}

const LEFT_ARM = [LM.leftElbow, LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb];

function groupInfo(states: readonly PpcGroupInfo[], name: string): PpcGroupInfo {
  return states.find((s) => s.name === name)!;
}

/** Warm a fresh PPC on a visible stream; returns the frame count consumed. */
function warmup(ppc: PoseContinuity, frames = 30, move?: (w: LandmarkPoint[], i: number) => void) {
  for (let i = 0; i < frames; i++) {
    const w = person();
    move?.(w, i);
    ppc.apply(w, toNorm(w), i * DT);
  }
  return frames;
}

test('fully visible: output equals input exactly (structural non-regression)', () => {
  const ppc = new PoseContinuity();
  const n = warmup(ppc);
  const w = person();
  w[LM.leftWrist] = lm(0.31, -0.4, 0.05); // mid-motion, not the warmup pose
  const nm = toNorm(w);
  const out = ppc.apply(w, nm, n * DT)!;
  for (let i = 0; i < 33; i++) {
    expect(out.world[i].x).toBe(w[i].x);
    expect(out.world[i].y).toBe(w[i].y);
    expect(out.world[i].z).toBe(w[i].z);
    expect(out.world[i].visibility).toBe(w[i].visibility);
    expect(out.norm[i].x).toBe(nm[i].x);
    expect(out.norm[i].visibility).toBe(nm[i].visibility);
  }
});

test('state machine: VISIBLE → PREDICTED → RELAXED, horizon cap enforced', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc) * DT;
  const hidden = mask(person(), LEFT_ARM);
  let sawPredicted = false;
  let maxPredictedAge = 0;
  for (let i = 0; i < 60; i++, t += DT) {
    ppc.apply(hidden, toNorm(hidden), t);
    const g = groupInfo(ppc.states(), 'leftArm');
    if (g.state === 'PREDICTED') {
      sawPredicted = true;
      maxPredictedAge = Math.max(maxPredictedAge, g.ageMs);
    }
  }
  expect(sawPredicted).toBe(true);
  // prediction never exceeds the cap (+ one frame of slack for the flip)
  expect(maxPredictedAge).toBeLessThanOrEqual(PPC.horizonLimbMs + DT);
  expect(groupInfo(ppc.states(), 'leftArm').state).toBe('RELAXED');
  // other groups untouched
  expect(groupInfo(ppc.states(), 'rightArm').state).toBe('VISIBLE');
  expect(groupInfo(ppc.states(), 'torso').state).toBe('VISIBLE');
});

test('prediction beats hold-last-visible on linear motion', () => {
  const v = 0.6; // m/s, whole person translating +x
  const shift = (w: LandmarkPoint[], i: number) => {
    for (const p of w) p.x += v * (i * DT) / 1000;
  };
  const ppc = new PoseContinuity();
  const frames = warmup(ppc, 30, shift);

  const heldX = person()[LM.leftWrist].x + v * ((frames - 1) * DT) / 1000; // last visible
  let t = frames * DT;
  let out: { world: LandmarkPoint[] } | null = null;
  const PRED_FRAMES = 5; // ~166 ms into the outage
  for (let i = 0; i < PRED_FRAMES; i++, t += DT) {
    const w = person();
    shift(w, frames + i);
    const hidden = mask(w, LEFT_ARM);
    out = ppc.apply(hidden, toNorm(hidden), t);
  }
  const trueX = person()[LM.leftWrist].x + v * ((frames + PRED_FRAMES - 1) * DT) / 1000;
  const predErr = Math.abs(out!.world[LM.leftWrist].x - trueX);
  const holdErr = Math.abs(heldX - trueX);
  expect(groupInfo(ppc.states(), 'leftArm').state).toBe('PREDICTED');
  expect(predErr).toBeLessThan(holdErr * 0.6); // clearly better than freezing
});

test('bone-length constraint: predicted wrist stays on the forearm shell', () => {
  const ppc = new PoseContinuity();
  // wave the wrist outward fast so the captured velocity points away
  let i = 0;
  warmup(ppc, 30, (w) => {
    w[LM.leftWrist].x = 0.26 + 0.02 * i;
    i++;
  });
  const L = Math.hypot(0.26 + 0.02 * 29 - 0.24, -0.02 + 0.26); // rough forearm at capture
  const hidden = mask(person(), [LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb, LM.leftElbow]);
  let t = 30 * DT;
  for (let k = 0; k < 12; k++, t += DT) {
    const out = ppc.apply(hidden, toNorm(hidden), t)!;
    const wr = out.world[LM.leftWrist];
    const el = out.world[LM.leftElbow];
    const d = Math.hypot(wr.x - el.x, wr.y - el.y, wr.z - el.z);
    // learned length ≈ measured; the shell tolerance bounds the distance
    expect(d).toBeLessThan(L * (1 + PPC.segTolerance) + 0.05);
    expect(Number.isFinite(d)).toBe(true);
  }
});

test('drift cap: a fast-moving masked wrist never strays far from last-seen', () => {
  const ppc = new PoseContinuity();
  // sweep the whole left arm fast so the captured velocity is large
  let i = 0;
  warmup(ppc, 30, (w) => {
    const dx = 0.03 * i;
    w[LM.leftElbow].x += dx * 0.7;
    w[LM.leftWrist].x += dx;
    for (const h of [LM.leftPinky, LM.leftIndex, LM.leftThumb]) w[h].x += dx;
    i++;
  });
  const last = person();
  const dx = 0.03 * 29;
  last[LM.leftWrist].x += dx; // wrist's last-seen x
  const anchorX = last[LM.leftWrist].x;
  const hidden = mask(person(), LEFT_ARM); // person snaps back; arm masked
  let t = 30 * DT;
  let asserted = 0;
  for (let k = 0; k < 14; k++, t += DT) {
    const out = ppc.apply(hidden, toNorm(hidden), t)!;
    // the 2–3 gate-hysteresis frames still pass the (vis-0) input through —
    // the drift bound applies once prediction owns the landmark
    if (groupInfo(ppc.states(), 'leftArm').state === 'VISIBLE') continue;
    const wr = out.world[LM.leftWrist];
    const drift = Math.hypot(wr.x - anchorX, wr.y - last[LM.leftWrist].y, wr.z - last[LM.leftWrist].z);
    expect(drift).toBeLessThan(PPC.maxDriftM + 0.2); // + projection/anchor slack
    expect(Number.isFinite(drift)).toBe(true);
    asserted++;
  }
  expect(asserted).toBeGreaterThan(8);
});

test('confidence decays monotonically while predicted, reaches 0 in RELAXED', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc) * DT;
  const hidden = mask(person(), LEFT_ARM);
  let prev = Infinity;
  for (let iFrame = 0; iFrame < 40; iFrame++, t += DT) {
    const out = ppc.apply(hidden, toNorm(hidden), t);
    const g = groupInfo(ppc.states(), 'leftArm');
    if (g.state === 'VISIBLE') continue; // gate EMA still crossing
    const vis = out!.world[LM.leftWrist].visibility;
    expect(vis).toBeLessThanOrEqual(prev + 1e-9); // never increases
    prev = vis;
  }
  expect(prev).toBe(0); // fully faded after horizon + relax window
});

test('re-entry: no per-frame snap, converges onto measured, vis has no step', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc) * DT;
  const hidden = mask(person(), LEFT_ARM);
  for (let i = 0; i < 9; i++, t += DT) ppc.apply(hidden, toNorm(hidden), t); // ~300 ms out

  // reappear displaced: arm now raised, far from both hold and rest
  const back = person();
  back[LM.leftElbow] = lm(0.2, -0.78, 0);
  back[LM.leftWrist] = lm(0.2, -1.05, 0);
  for (const h of [LM.leftPinky, LM.leftIndex, LM.leftThumb]) back[h] = lm(0.21, -1.13, 0);
  const backNorm = toNorm(back);

  let prevX = NaN;
  let prevY = NaN;
  let prevZ = NaN;
  let prevVis = NaN;
  let maxStep = 0;
  let maxVisStep = 0;
  for (let i = 0; i < 40; i++, t += DT) {
    const out = ppc.apply(back, backNorm, t)!;
    const wr = out.world[LM.leftWrist];
    if (i > 0) {
      maxStep = Math.max(maxStep, Math.hypot(wr.x - prevX, wr.y - prevY, wr.z - prevZ));
      maxVisStep = Math.max(maxVisStep, Math.abs(wr.visibility - prevVis));
    }
    prevX = wr.x; prevY = wr.y; prevZ = wr.z; prevVis = wr.visibility;
  }
  expect(maxStep).toBeLessThanOrEqual(PPC.maxCorrWorld + 1e-9); // the no-snap bound
  expect(maxVisStep).toBeLessThan(0.35); // confidence ramps, never jumps to 1
  // converged: output IS the measured wrist again
  expect(prevX).toBeCloseTo(back[LM.leftWrist].x, 6);
  expect(prevY).toBeCloseTo(back[LM.leftWrist].y, 6);
  expect(groupInfo(ppc.states(), 'leftArm').state).toBe('VISIBLE');
  expect(groupInfo(ppc.states(), 'leftArm').blending).toBe(false);
});

test('full dropout: brief synthesis with decaying confidence, then honest null', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc) * DT;

  // within the core horizon: synthesized frames, torso confidence decaying
  let lastVis = 1;
  let sawSynth = false;
  for (let i = 0; i < 8; i++, t += DT) {
    const out = ppc.apply(null, null, t);
    if (out) {
      sawSynth = true;
      const vis = out.world[LM.leftShoulder].visibility;
      expect(vis).toBeLessThanOrEqual(lastVis + 1e-9);
      lastVis = vis;
    }
  }
  expect(sawSynth).toBe(true);
  expect(lastVis).toBeLessThan(1);

  // long dropout: everything fades → null (no fake tracking, ever)
  for (let i = 0; i < 40; i++, t += DT) ppc.apply(null, null, t);
  expect(ppc.apply(null, null, t)).toBeNull();

  // and it recovers when the person returns
  const w = person();
  for (let i = 0; i < 20; i++, t += DT) ppc.apply(w, toNorm(w), t);
  expect(groupInfo(ppc.states(), 'torso').state).toBe('VISIBLE');
});

test('determinism: identical stream → identical output, twice', () => {
  const run = (): number[] => {
    const ppc = new PoseContinuity();
    const samples: number[] = [];
    let t = 0;
    for (let i = 0; i < 120; i++, t += DT) {
      let w = person();
      // scripted chaos: motion, a masked window, a full dropout window
      for (const p of w) p.x += Math.sin(i * 0.21) * 0.05;
      w[LM.leftWrist].y += Math.cos(i * 0.17) * 0.1;
      if (i >= 40 && i < 52) w = mask(w, LEFT_ARM);
      const out = i >= 80 && i < 86 ? ppc.apply(null, null, t) : ppc.apply(w, toNorm(w), t);
      if (out) {
        for (const p of out.world) samples.push(p.x, p.y, p.z, p.visibility);
      } else {
        samples.push(-999);
      }
    }
    return samples;
  };
  const a = run();
  const b = run();
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) throw new Error(`diverged at sample ${i}: ${a[i]} vs ${b[i]}`);
  }
});

test('no NaN and no explosion under a chaotic masked stream', () => {
  const ppc = new PoseContinuity();
  let t = 0;
  for (let i = 0; i < 400; i++, t += DT * (1 + (i % 3) * 0.5)) {
    let w = person();
    for (const p of w) {
      p.x += Math.sin(i * 0.7) * 0.3;
      p.y += Math.cos(i * 0.5) * 0.2;
    }
    // rotating mask over different groups, plus flicker
    const groups = [LEFT_ARM, [LM.rightElbow, LM.rightWrist], [LM.leftKnee, LM.leftAnkle], [LM.nose]];
    if (i % 7 !== 0) w = mask(w, groups[i % groups.length]);
    const out = i % 31 === 0 ? ppc.apply(null, null, t) : ppc.apply(w, toNorm(w), t);
    if (!out) continue;
    for (const p of out.world) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      expect(p.visibility).toBeGreaterThanOrEqual(0);
      expect(p.visibility).toBeLessThanOrEqual(1);
      expect(Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z)).toBeLessThan(50);
    }
  }
});
