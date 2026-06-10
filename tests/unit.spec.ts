// Pure-math unit tests (no browser): coordinate conversion, mirroring, body
// frame, and retargeter decay. These run in node inside the Playwright runner.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { mpToThree, BodyFrame } from '../src/pose/bodyFrame';
import { mirrorWorld, mirrorNorm } from '../src/pose/mirror';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { createRobot } from '../src/rig/robot';
import { Retargeter } from '../src/rig/retarget';
import { config } from '../src/config';

function lm(x: number, y: number, z: number, visibility = 1): LandmarkPoint {
  return { x, y, z, visibility };
}

function blank(): LandmarkPoint[] {
  return Array.from({ length: 33 }, () => lm(0, 0, 0, 1));
}

/** Canonical person in MediaPipe WORLD space (y down, z toward camera = −),
 *  facing the camera, arms hanging: returns world landmark array. */
function canonicalPerson(): LandmarkPoint[] {
  const w = blank();
  // person's left is image-right = +x in mp space
  w[LM.leftShoulder] = lm(0.18, -0.5, 0);
  w[LM.rightShoulder] = lm(-0.18, -0.5, 0);
  w[LM.leftHip] = lm(0.1, 0, 0);
  w[LM.rightHip] = lm(-0.1, 0, 0);
  w[LM.leftElbow] = lm(0.2, -0.25, 0);
  w[LM.rightElbow] = lm(-0.2, -0.25, 0);
  w[LM.leftWrist] = lm(0.2, 0.0, 0);
  w[LM.rightWrist] = lm(-0.2, 0.0, 0);
  w[LM.nose] = lm(0, -0.65, -0.08);
  w[LM.leftEar] = lm(0.07, -0.62, 0);
  w[LM.rightEar] = lm(-0.07, -0.62, 0);
  w[LM.leftKnee] = lm(0.1, 0.45, 0);
  w[LM.rightKnee] = lm(-0.1, 0.45, 0);
  w[LM.leftAnkle] = lm(0.1, 0.9, 0);
  w[LM.rightAnkle] = lm(-0.1, 0.9, 0);
  return w;
}

test('mpToThree flips y and z', () => {
  const v = mpToThree({ x: 0.3, y: 0.5, z: -0.2 }, new THREE.Vector3());
  expect(v.x).toBeCloseTo(0.3);
  expect(v.y).toBeCloseTo(-0.5);
  expect(v.z).toBeCloseTo(0.2);
});

test('mirrorWorld swaps sides and negates x', () => {
  const src = canonicalPerson();
  src[LM.leftWrist] = lm(0.4, -0.6, -0.1, 0.9); // raised left hand
  const dst = mirrorWorld(src, []);
  // the mirrored RIGHT wrist holds the raised hand, x negated
  expect(dst[LM.rightWrist].x).toBeCloseTo(-0.4);
  expect(dst[LM.rightWrist].y).toBeCloseTo(-0.6);
  expect(dst[LM.rightWrist].visibility).toBeCloseTo(0.9);
  // double mirror = identity
  const back = mirrorWorld(dst, []);
  expect(back[LM.leftWrist].x).toBeCloseTo(0.4);
});

test('mirrorNorm reflects around x=0.5', () => {
  const src = blank();
  src[LM.leftWrist] = lm(0.8, 0.4, 0, 1);
  const dst = mirrorNorm(src, []);
  expect(dst[LM.rightWrist].x).toBeCloseTo(0.2);
  expect(dst[LM.rightWrist].y).toBeCloseTo(0.4);
});

test('body frame is identity for an upright person facing the camera', () => {
  const bf = new BodyFrame();
  expect(bf.update(canonicalPerson())).toBe(true);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(bf.quat.w)));
  expect(angle).toBeLessThan(0.05);
  expect(bf.shoulderWidth).toBeCloseTo(0.36, 1);
});

/** Shoulders rotated by `lean` radians about the hip center in mp space.
 *  Positive lean shifts shoulders toward +x (person's left side). */
function leanedPerson(lean: number): LandmarkPoint[] {
  const w = canonicalPerson();
  for (const i of [LM.leftShoulder, LM.rightShoulder]) {
    const p = w[i];
    const x = p.x;
    const y = p.y;
    p.x = x * Math.cos(lean) - y * Math.sin(lean);
    p.y = x * Math.sin(lean) + y * Math.cos(lean);
  }
  return w;
}

test('body frame captures BOTH lean directions as opposite-sign roll', () => {
  const bfL = new BodyFrame();
  const bfR = new BodyFrame();
  expect(bfL.update(leanedPerson(0.3))).toBe(true);
  expect(bfR.update(leanedPerson(-0.3))).toBe(true);
  const eL = new THREE.Euler().setFromQuaternion(bfL.quat, 'ZYX');
  const eR = new THREE.Euler().setFromQuaternion(bfR.quat, 'ZYX');
  expect(Math.abs(eL.z)).toBeGreaterThan(0.1);
  expect(Math.abs(eR.z)).toBeGreaterThan(0.1);
  // mp +x lean → up tilts toward +x in three space → negative roll about z
  // (rotating +y toward +x is −z); the directions must mirror, not rectify
  expect(Math.sign(eL.z)).toBe(-1);
  expect(Math.sign(eR.z)).toBe(1);
  expect(eL.z + eR.z).toBeCloseTo(0, 1);
});

test('hips occluded (desk): shoulders-only frame still leans, stays valid', () => {
  const w = leanedPerson(0.3);
  w[LM.leftHip].visibility = 0.1;
  w[LM.rightHip].visibility = 0.1;
  const bf = new BodyFrame();
  expect(bf.update(w)).toBe(true); // limbs keep tracking
  expect(bf.valid).toBe(true);
  const e = new THREE.Euler().setFromQuaternion(bf.quat, 'ZYX');
  expect(Math.abs(e.z)).toBeGreaterThan(0.1); // lean still reads
});

test('side turn with a dimmed far shoulder keeps the frame alive', () => {
  const w = canonicalPerson();
  const turn = 1.2; // rad — deep turn toward profile
  for (const i of [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]) {
    const p = w[i];
    const x = p.x;
    const z = p.z;
    p.x = x * Math.cos(turn) - z * Math.sin(turn);
    p.z = x * Math.sin(turn) + z * Math.cos(turn);
  }
  w[LM.rightShoulder].visibility = 0.45; // far shoulder dims — used to kill the frame at 0.5
  const bf = new BodyFrame();
  expect(bf.update(w)).toBe(true);
  const e = new THREE.Euler().setFromQuaternion(bf.quat, 'YXZ');
  expect(Math.abs(e.y)).toBeGreaterThan(0.8);
});

test('body frame captures a torso turn as yaw about y', () => {
  const w = canonicalPerson();
  const turn = 0.5; // rad — person turns left
  for (const i of [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]) {
    const p = w[i];
    const x = p.x;
    const z = p.z;
    p.x = x * Math.cos(turn) - z * Math.sin(turn);
    p.z = x * Math.sin(turn) + z * Math.cos(turn);
  }
  const bf = new BodyFrame();
  expect(bf.update(w)).toBe(true);
  const e = new THREE.Euler().setFromQuaternion(bf.quat, 'YXZ');
  expect(Math.abs(e.y)).toBeGreaterThan(0.3);
});

test('off-screen hand: bone relaxes toward rest gradually, never snaps', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);

  // forearm pointed at the camera (90° from the hanging rest pose)
  const world = canonicalPerson();
  world[LM.leftWrist] = lm(0.2, -0.25, -0.35);
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.4, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.4, 0);
  norm[LM.leftHip] = lm(0.55, 0.7, 0);
  norm[LM.rightHip] = lm(0.45, 0.7, 0);

  const bone = robot.bones.leftLowerArm!;
  const rest = bone.quaternion.clone();

  // track until settled on the raised target
  for (let i = 0; i < 40; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  const tracked = bone.quaternion.angleTo(rest);
  expect(tracked).toBeGreaterThan(0.8); // ~90° swing actually enacted

  // wrist leaves the frame
  world[LM.leftWrist].visibility = 0.1;

  // 0.2 s later: still mostly holding — no snap to rest
  for (let i = 0; i < 6; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  expect(bone.quaternion.angleTo(rest)).toBeGreaterThan(tracked * 0.5);

  // ~2.5 s later: relaxed essentially back to rest
  for (let i = 0; i < 70; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  expect(bone.quaternion.angleTo(rest)).toBeLessThan(0.2);
});

test('legs: knee raise drives the upper leg in full-body mode only', () => {
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.3, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.3, 0);
  norm[LM.leftHip] = lm(0.55, 0.55, 0);
  norm[LM.rightHip] = lm(0.45, 0.55, 0);

  const raised = canonicalPerson();
  raised[LM.rightKnee] = lm(-0.1, 0.05, -0.35); // knee up, toward camera

  const run = (mode: 'upper' | 'full') => {
    config.bodyMode = mode;
    const robot = createRobot();
    const rt = new Retargeter(robot);
    const bone = robot.bones.rightUpperLeg!;
    const rest = bone.quaternion.clone();
    for (let i = 0; i < 40; i++) {
      rt.updateFromPose(raised, norm);
      rt.tick(0.033);
      robot.object.updateWorldMatrix(true, true);
    }
    return bone.quaternion.angleTo(rest);
  };

  try {
    expect(run('full')).toBeGreaterThan(0.7); // ~90° hip flex enacted
    expect(run('upper')).toBeLessThan(0.05); // legs stay in idle
  } finally {
    config.bodyMode = 'upper';
  }
});

test('calibration maps the held pose to rest', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const world = canonicalPerson();
  world[LM.leftWrist] = lm(0.2, -0.25, -0.35); // forearm at the camera
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.4, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.4, 0);
  norm[LM.leftHip] = lm(0.55, 0.7, 0);
  norm[LM.rightHip] = lm(0.45, 0.7, 0);

  const bone = robot.bones.leftLowerArm!;
  const rest = bone.quaternion.clone();
  const settle = () => {
    for (let i = 0; i < 60; i++) {
      rt.updateFromPose(world, norm);
      rt.tick(0.033);
      robot.object.updateWorldMatrix(true, true);
    }
  };

  settle();
  expect(bone.quaternion.angleTo(rest)).toBeGreaterThan(0.8); // pose is far from rest

  rt.calibrate(); // this held pose becomes neutral
  settle();
  expect(bone.quaternion.angleTo(rest)).toBeLessThan(0.1); // …so it now reads as rest
});

test('low-visibility torso invalidates the frame but keeps previous values', () => {
  const bf = new BodyFrame();
  bf.update(canonicalPerson());
  const prevQuat = bf.quat.clone();
  const w = canonicalPerson();
  w[LM.leftShoulder].visibility = 0.1;
  expect(bf.update(w)).toBe(false);
  expect(bf.valid).toBe(false);
  expect(bf.quat.angleTo(prevQuat)).toBeCloseTo(0);
});
