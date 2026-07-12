// Synthetic dropout test (P2 occlusion recovery): a tracked limb loses its
// landmarks, holds/coasts, relaxes toward rest, then re-acquires — and the
// re-acquisition BLENDS (≤ ~0.5 s, bounded per-tick rotation step), never
// snaps. Runs the real Retargeter on the procedural robot in node.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { LM } from '@bodyarcade/pose-runtime';
import type { LandmarkPoint } from '@bodyarcade/pose-runtime';
import { createRobot } from '../src/rig/robot';
import { Retargeter } from '../src/rig/retarget';

function lm(x: number, y: number, z: number, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}
function blank(): LandmarkPoint[] {
  return Array.from({ length: 33 }, () => lm(0, 0, 0, 1));
}
/** Person facing camera, LEFT arm raised straight up (world space, y down). */
function raisedArmPerson(): LandmarkPoint[] {
  const w = blank();
  w[LM.leftShoulder] = lm(0.18, -0.5, 0);
  w[LM.rightShoulder] = lm(-0.18, -0.5, 0);
  w[LM.leftHip] = lm(0.1, 0, 0);
  w[LM.rightHip] = lm(-0.1, 0, 0);
  w[LM.leftElbow] = lm(0.2, -0.78, 0);
  w[LM.leftWrist] = lm(0.2, -1.05, 0);
  w[LM.rightElbow] = lm(-0.2, -0.25, 0);
  w[LM.rightWrist] = lm(-0.2, 0.0, 0);
  w[LM.nose] = lm(0, -0.65, -0.08);
  w[LM.leftEar] = lm(0.07, -0.62, 0);
  w[LM.rightEar] = lm(-0.07, -0.62, 0);
  return w;
}

const TICK = 1 / 60;
const angleBetween = (a: THREE.Quaternion, b: THREE.Quaternion) =>
  2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test('synthetic dropout: hold → relax → re-acquire blends without snapping', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const bone = robot.bones.leftUpperArm!;
  const rest = bone.quaternion.clone();

  const visible = raisedArmPerson();

  // --- settle on the raised-arm pose (1 s of tracking) ---
  for (let i = 0; i < 60; i++) {
    if (i % 2 === 0) rt.updateFromPose(visible, visible);
    rt.tick(TICK);
  }
  const tracked = bone.quaternion.clone();
  expect(angleBetween(tracked, rest)).toBeGreaterThan(0.5); // arm is genuinely raised

  // --- dropout: arm landmarks go invisible for 2.5 s ---
  const hidden = raisedArmPerson();
  for (const i of [LM.leftElbow, LM.leftWrist]) hidden[i] = { ...hidden[i], visibility: 0 };

  let maxStep = 0;
  let prev = bone.quaternion.clone();
  for (let i = 0; i < 150; i++) {
    if (i % 2 === 0) rt.updateFromPose(hidden, hidden);
    rt.tick(TICK);
    maxStep = Math.max(maxStep, angleBetween(prev, bone.quaternion));
    prev.copy(bone.quaternion);
  }
  // relaxed most of the way to rest, and every step stayed smooth
  expect(angleBetween(bone.quaternion, rest)).toBeLessThan(0.25);
  expect(maxStep).toBeLessThan((4 * Math.PI) / 180); // < 4°/tick while relaxing

  // --- re-acquisition: landmarks return; blend must be smooth and complete ---
  maxStep = 0;
  let settledAt: number | null = null;
  prev.copy(bone.quaternion);
  for (let i = 0; i < 90; i++) {
    if (i % 2 === 0) rt.updateFromPose(visible, visible);
    rt.tick(TICK);
    const step = angleBetween(prev, bone.quaternion);
    maxStep = Math.max(maxStep, step);
    prev.copy(bone.quaternion);
    if (settledAt === null && angleBetween(bone.quaternion, tracked) < 0.12) {
      settledAt = (i + 1) * TICK;
    }
  }
  // never snaps: per-tick step bounded well below a visible pop (a snap
  // would be 30°+ in one tick; smooth chasing peaks under 10°)
  expect(maxStep).toBeLessThan((10 * Math.PI) / 180); // < 10°/tick
  // and it does get back onto the pose, in roughly the blend window
  expect(settledAt).not.toBeNull();
  expect(settledAt!).toBeLessThanOrEqual(1.2);
  expect(angleBetween(bone.quaternion, tracked)).toBeLessThan(0.12);
});

test('joint limit: a coasting/clamped target never exceeds max swing from rest', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const bone = robot.bones.leftUpperArm!;
  const rest = bone.quaternion.clone();

  // wave the arm fast for half a second to build target velocity, then drop out
  for (let i = 0; i < 30; i++) {
    const w = raisedArmPerson();
    const t = i / 30;
    w[LM.leftElbow] = lm(0.2 + 0.3 * Math.sin(t * 9), -0.78, 0);
    w[LM.leftWrist] = lm(0.2 + 0.45 * Math.sin(t * 9), -1.05, 0);
    if (i % 2 === 0) rt.updateFromPose(w, w);
    rt.tick(TICK);
  }
  const hidden = raisedArmPerson();
  for (const i of [LM.leftElbow, LM.leftWrist]) hidden[i] = { ...hidden[i], visibility: 0 };
  for (let i = 0; i < 120; i++) {
    if (i % 2 === 0) rt.updateFromPose(hidden, hidden);
    rt.tick(TICK);
    // the enacted bone never strays past the joint limit (+ small slack)
    expect(angleBetween(bone.quaternion, rest)).toBeLessThan((125 * Math.PI) / 180);
  }
});
