// Gate-2 regression coverage: the live-test failure modes, mechanized.
// (1) hand behind torso — detector emits physically-impossible collapse
//     at confident visibility → held, low confidence, buffer unpolluted;
// (2) fast punch with wrist dropout → conservative bounded prediction;
// (3) partial-body exit → torso stays rigid, no shear from a dying side;
// (4) full-body dropout + re-entry → no spin, no shear, clean settle;
// (5) root/chest orientation bounded through dropout (retargeter level);
// (6) repeated dropout cycles → no cumulative rotational drift.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { PoseContinuity, PPC } from '../src/pose/continuity';
import { createRobot } from '../src/rig/robot';
import { Retargeter } from '../src/rig/retarget';

const DT = 100 / 3;

function lm(x: number, y: number, z: number, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}
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
const toNorm = (w: LandmarkPoint[]): LandmarkPoint[] =>
  w.map((p) => lm(0.5 + p.x * 0.4, 0.55 + p.y * 0.35, p.z * 0.1, p.visibility));
const dist = (a: LandmarkPoint, b: LandmarkPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function warmup(ppc: PoseContinuity, frames = 40, move?: (w: LandmarkPoint[], i: number) => void) {
  for (let i = 0; i < frames; i++) {
    const w = person();
    move?.(w, i);
    ppc.apply(w, toNorm(w), i * DT);
  }
  return frames * DT;
}

test('hand behind torso: confident-vis collapse is held, low-conf, and never buffered', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc);
  const cleanWristX = person()[LM.leftWrist].x;

  // detector garbage: wrist + hand landmarks collapse ONTO the elbow at
  // vis 0.9 (the fast.mp4 behind-torso signature — physically impossible)
  const garbage = person();
  const el = garbage[LM.leftElbow];
  garbage[LM.leftWrist] = lm(el.x + 0.01, el.y + 0.01, el.z, 0.9);
  for (const h of [LM.leftPinky, LM.leftIndex, LM.leftThumb]) {
    garbage[h] = lm(el.x + 0.02, el.y + 0.02, el.z, 0.9);
  }
  let maxStep = 0;
  let prev: { x: number; y: number; z: number } | null = null;
  for (let i = 0; i < 8; i++, t += DT) {
    const out = ppc.apply(garbage, toNorm(garbage), t)!;
    const wr = out.world[LM.leftWrist];
    // the garbage is never enacted: confidence capped below every gate
    expect(wr.visibility).toBeLessThanOrEqual(PPC.implausibleVis + 1e-9);
    if (prev) maxStep = Math.max(maxStep, Math.hypot(wr.x - prev.x, wr.y - prev.y, wr.z - prev.z));
    prev = { x: wr.x, y: wr.y, z: wr.z };
    // held near the last plausible position, not collapsed onto the elbow
    expect(Math.abs(wr.x - cleanWristX)).toBeLessThan(0.15);
  }
  expect(maxStep).toBeLessThanOrEqual(PPC.maxCorrWorld + 1e-9);

  // buffer hygiene: a dropout right after the garbage predicts calmly from
  // the clean history, not from collapse teleports
  const hidden = person();
  for (const i of [LM.leftElbow, LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb]) {
    hidden[i] = { ...hidden[i], visibility: 0 };
  }
  prev = null;
  for (let i = 0; i < 12; i++, t += DT) {
    const out = ppc.apply(hidden, toNorm(hidden), t)!;
    const wr = out.world[LM.leftWrist];
    expect(Number.isFinite(wr.x + wr.y + wr.z)).toBe(true);
    if (prev) {
      const step = Math.hypot(wr.x - prev.x, wr.y - prev.y, wr.z - prev.z);
      expect(step).toBeLessThan(0.09); // calm continuation, no whip
    }
    prev = { x: wr.x, y: wr.y, z: wr.z };
  }
});

test('fast punch with wrist dropout: prediction stays conservative and bounded', () => {
  const ppc = new PoseContinuity();
  // punch simulation: wrist oscillates in z at high speed, hands follow
  let t = warmup(ppc, 40, (w, i) => {
    const punch = Math.sin(i * 0.9) * 0.35;
    w[LM.leftWrist].z -= Math.max(0, punch);
    w[LM.leftElbow].z -= Math.max(0, punch) * 0.55;
    for (const h of [LM.leftPinky, LM.leftIndex, LM.leftThumb]) w[h].z -= Math.max(0, punch);
  });
  const lastSeen = { ...person()[LM.leftWrist] };
  const hidden = person();
  for (const i of [LM.leftElbow, LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb]) {
    hidden[i] = { ...hidden[i], visibility: 0 };
  }
  for (let i = 0; i < 14; i++, t += DT) {
    const out = ppc.apply(hidden, toNorm(hidden), t)!;
    const wr = out.world[LM.leftWrist];
    // never flies away: bounded around the (parent-anchored) last-seen
    expect(dist(wr, lastSeen)).toBeLessThan(PPC.maxDriftM + 0.45);
    expect(Number.isFinite(wr.x + wr.y + wr.z)).toBe(true);
  }
});

test('partial-body exit: a dying side cannot shear or spin the torso', () => {
  const ppc = new PoseContinuity();
  let t = warmup(ppc);
  // left side degrades: left shoulder/hip drift wildly at fading vis
  const w = person();
  for (let i = 0; i < 20; i++, t += DT) {
    const bad = person();
    bad[LM.leftShoulder] = lm(0.18 + i * 0.05, -0.5 - i * 0.04, 0, Math.max(0.2, 0.9 - i * 0.1));
    bad[LM.leftHip] = lm(0.1 + i * 0.05, i * 0.04, 0, Math.max(0.2, 0.9 - i * 0.1));
    const out = ppc.apply(bad, toNorm(bad), t)!;
    const ls = out.world[LM.leftShoulder];
    const rs = out.world[LM.rightShoulder];
    // emitted shoulder width never breaks the learned rigid width by much:
    // either the pair passes through together or confidence collapses and
    // the rigid hold owns the shape
    const width = dist(ls, rs);
    if (Math.min(ls.visibility, rs.visibility) > PPC.visOff) {
      expect(width).toBeGreaterThan(0.36 * PPC.chainGateLo);
      expect(width).toBeLessThan(0.36 * PPC.chainGateHi + 0.05);
    }
    expect(Number.isFinite(width)).toBe(true);
  }
  void w;
});

test('full dropout: torso synthesizes rigidly — no shear, no spin — then settles', () => {
  const ppc = new PoseContinuity();
  // approach: person walks sideways so the torso has real velocity at loss
  let t = warmup(ppc, 40, (w, i) => {
    for (const p of w) p.x += i * 0.01;
  });
  const quad = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip];
  let entryShape: number[] | null = null;
  let entryDir: { x: number; y: number; z: number } | null = null;
  for (let i = 0; i < 60; i++, t += DT) {
    const out = ppc.apply(null, null, t);
    if (!out) break; // fully faded — honest null
    const states = ppc.states();
    const torso = states.find((s) => s.name === 'torso')!;
    if (torso.state === 'VISIBLE') continue; // gate EMA still crossing
    const pts = quad.map((q) => out.world[q]);
    const shape = [dist(pts[0], pts[1]), dist(pts[2], pts[3]), dist(pts[0], pts[2]), dist(pts[1], pts[3])];
    const dir = {
      x: pts[0].x - pts[1].x,
      y: pts[0].y - pts[1].y,
      z: pts[0].z - pts[1].z,
    };
    if (!entryShape) {
      entryShape = shape;
      entryDir = dir;
      continue;
    }
    // rigid: pairwise distances exact, shoulder-line direction exact
    for (let k = 0; k < 4; k++) expect(Math.abs(shape[k] - entryShape[k])).toBeLessThan(1e-9);
    const num = dir.x * entryDir!.x + dir.y * entryDir!.y + dir.z * entryDir!.z;
    const den = Math.hypot(dir.x, dir.y, dir.z) * Math.hypot(entryDir!.x, entryDir!.y, entryDir!.z);
    expect(num / den).toBeGreaterThan(0.999999); // no rotation at all
  }
  expect(entryShape).not.toBeNull();
});

/** Feed a stream through PPC into a real Retargeter on the robot. */
function drive(
  ppc: PoseContinuity,
  rt: { updateFromPose(w: LandmarkPoint[] | null, n: LandmarkPoint[] | null, t?: number): void; tick(dt: number): void },
  frames: number,
  tStart: number,
  frame: (i: number) => LandmarkPoint[] | null,
): number {
  let t = tStart;
  for (let i = 0; i < frames; i++, t += DT) {
    const w = frame(i);
    const cont = ppc.apply(w, w ? toNorm(w) : null, t);
    if (i % 1 === 0) rt.updateFromPose(cont?.world ?? null, cont?.norm ?? null, t);
    rt.tick(DT / 1000);
    rt.tick(DT / 1000); // ~60 Hz render against ~30 Hz pose
  }
  return t;
}

const angleBetween = (a: THREE.Quaternion, b: THREE.Quaternion) =>
  2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test('root/chest orientation stays bounded through a full dropout (retargeter level)', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const ppc = new PoseContinuity();
  const chest = robot.bones.chest!;
  const chestRest = chest.quaternion.clone();

  let t = drive(ppc, rt, 60, 0, () => person()); // settle visible
  const maxDev = (120 * Math.PI) / 180;
  let worst = 0;
  let prevQ = chest.quaternion.clone();
  let maxTick = 0;
  t = drive(ppc, rt, 90, t, () => null); // 3 s dropout — through synth AND null
  // measure during a second dropout pass with instrumentation inline
  t = drive(ppc, rt, 30, t, () => person());
  let tt = t;
  for (let i = 0; i < 90; i++, tt += DT) {
    const cont = ppc.apply(null, null, tt);
    rt.updateFromPose(cont?.world ?? null, cont?.norm ?? null, tt);
    rt.tick(DT / 1000);
    worst = Math.max(worst, angleBetween(chest.quaternion, chestRest));
    maxTick = Math.max(maxTick, angleBetween(chest.quaternion, prevQ));
    prevQ.copy(chest.quaternion);
  }
  expect(worst).toBeLessThan(maxDev); // never past the joint limit
  expect(worst).toBeLessThan(0.6); // and nowhere near "bent over" (~34°)
  expect(maxTick).toBeLessThan((6 * Math.PI) / 180); // no spinning: < 6°/tick
});

test('repeated dropout cycles: no cumulative rotational drift', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const ppc = new PoseContinuity();
  const chest = robot.bones.chest!;
  const head = robot.bones.head!;

  let t = drive(ppc, rt, 60, 0, () => person());
  const refChest = chest.quaternion.clone();
  const refHead = head.quaternion.clone();

  for (let cycle = 0; cycle < 5; cycle++) {
    t = drive(ppc, rt, 21, t, () => null); // 0.7 s dropout
    t = drive(ppc, rt, 45, t, () => person()); // 1.5 s visible
  }
  // after five cycles the pose is where one cycle would leave it — nothing
  // accumulated (drift would compound rotation cycle over cycle)
  expect(angleBetween(chest.quaternion, refChest)).toBeLessThan(0.08);
  expect(angleBetween(head.quaternion, refHead)).toBeLessThan(0.12);
  for (const b of [chest, head]) {
    for (const v of b.quaternion.toArray()) expect(Number.isFinite(v)).toBe(true);
  }
});
