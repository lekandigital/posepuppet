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

test('body frame captures a sideways lean as roll about z', () => {
  const w = canonicalPerson();
  // lean: shoulders shift toward +x (person's left) in mp space, hips fixed
  const leanAngle = 0.3; // rad
  for (const i of [LM.leftShoulder, LM.rightShoulder]) {
    const p = w[i];
    const y = p.y; // rotate shoulder points around the hip center (0,0)
    p.x = p.x * Math.cos(leanAngle) - y * Math.sin(leanAngle);
    p.y = p.x * Math.sin(leanAngle) * 0 + y * Math.cos(leanAngle) + p.x * 0;
  }
  const bf = new BodyFrame();
  expect(bf.update(w)).toBe(true);
  const e = new THREE.Euler().setFromQuaternion(bf.quat, 'ZYX');
  expect(Math.abs(e.z)).toBeGreaterThan(0.1); // lean shows up as roll
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
