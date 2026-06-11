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
import { matchBonesByName } from '../src/rig/vrm';
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

function hierarchyOf(names: string[]): THREE.Object3D {
  const root = new THREE.Object3D();
  for (const n of names) {
    const o = new THREE.Object3D();
    o.name = n;
    root.add(o);
  }
  return root;
}

test('bone name matching: VRoid, Mixamo, and generic rigs map correctly', () => {
  const vroid = matchBonesByName(
    hierarchyOf([
      'J_Bip_C_Hips', 'J_Bip_C_Chest', 'J_Bip_C_Neck', 'J_Bip_C_Head',
      'J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_R_UpperArm', 'J_Bip_R_LowerArm',
      'J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg', 'J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg',
    ]),
  );
  expect(Object.keys(vroid)).toHaveLength(12);
  expect(vroid.leftUpperArm!.name).toBe('J_Bip_L_UpperArm');
  expect(vroid.rightLowerLeg!.name).toBe('J_Bip_R_LowerLeg');

  const mixamo = matchBonesByName(
    hierarchyOf(['mixamorig:Hips', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head',
      'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:RightArm', 'mixamorig:RightForeArm']),
  );
  expect(mixamo.leftUpperArm!.name).toBe('mixamorig:LeftArm');
  expect(mixamo.leftLowerArm!.name).toBe('mixamorig:LeftForeArm');
  expect(mixamo.chest!.name).toBe('mixamorig:Spine2');

  const junk = matchBonesByName(hierarchyOf(['Cube', 'Sphere.001', 'Light']));
  expect(Object.keys(junk)).toHaveLength(0);
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

// ---- hand/wrist bone tests ------------------------------------------------

test('robot has leftHand and rightHand bones', () => {
  const robot = createRobot();
  expect(robot.bones.leftHand).toBeDefined();
  expect(robot.bones.rightHand).toBeDefined();
  // hand bone should be a child of the lower arm (forearm)
  expect(robot.bones.leftHand!.parent).toBe(robot.bones.leftLowerArm);
  expect(robot.bones.rightHand!.parent).toBe(robot.bones.rightLowerArm);
});

test('bone name matching includes hand bones for VRoid and Mixamo rigs', () => {
  const vroid = matchBonesByName(
    hierarchyOf([
      'J_Bip_C_Hips', 'J_Bip_C_Chest', 'J_Bip_C_Neck', 'J_Bip_C_Head',
      'J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_L_Hand',
      'J_Bip_R_UpperArm', 'J_Bip_R_LowerArm', 'J_Bip_R_Hand',
      'J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg', 'J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg',
    ]),
  );
  expect(Object.keys(vroid)).toHaveLength(14);
  expect(vroid.leftHand!.name).toBe('J_Bip_L_Hand');
  expect(vroid.rightHand!.name).toBe('J_Bip_R_Hand');

  const mixamo = matchBonesByName(
    hierarchyOf([
      'mixamorig:Hips', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head',
      'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
      'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
    ]),
  );
  expect(mixamo.leftHand!.name).toBe('mixamorig:LeftHand');
  expect(mixamo.rightHand!.name).toBe('mixamorig:RightHand');

  // Generic naming
  const generic = matchBonesByName(
    hierarchyOf(['left_hand', 'right_hand']),
  );
  expect(generic.leftHand!.name).toBe('left_hand');
  expect(generic.rightHand!.name).toBe('right_hand');
});

test('hand landmark indices are the correct BlazePose values', () => {
  expect(LM.leftPinky).toBe(17);
  expect(LM.rightPinky).toBe(18);
  expect(LM.leftIndex).toBe(19);
  expect(LM.rightIndex).toBe(20);
  expect(LM.leftThumb).toBe(21);
  expect(LM.rightThumb).toBe(22);
});

/** Canonical person with hand landmarks for direction-swing testing. */
function personWithHands(): LandmarkPoint[] {
  const w = canonicalPerson();
  // Hand landmarks: fingers pointing down from wrist (in mp space, +y = down)
  // Left hand: wrist at (0.2, 0, 0)
  w[LM.leftPinky] = lm(0.17, 0.1, 0);    // pinky slightly left of wrist
  w[LM.leftIndex] = lm(0.23, 0.1, 0);     // index slightly right of wrist
  // Right hand: mirror
  w[LM.rightPinky] = lm(-0.23, 0.1, 0);
  w[LM.rightIndex] = lm(-0.17, 0.1, 0);
  return w;
}

test('hand orientation: hand bone rotates when wrist bends', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.4, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.4, 0);
  norm[LM.leftHip] = lm(0.55, 0.7, 0);
  norm[LM.rightHip] = lm(0.45, 0.7, 0);

  const bone = robot.bones.leftHand!;
  const rest = bone.quaternion.clone();

  // Bend the wrist: fingers pointing FORWARD (toward camera, mp -z)
  // instead of straight down the arm. This creates a ~90° wrist bend.
  const world = personWithHands();
  world[LM.leftIndex] = lm(0.22, 0.0, -0.15);  // index forward from wrist
  world[LM.leftPinky] = lm(0.18, 0.0, -0.15);  // pinky forward from wrist
  for (let i = 0; i < 40; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  const bentAngle = bone.quaternion.angleTo(rest);
  const bentQuat = bone.quaternion.clone();

  // The hand bone should have moved meaningfully from rest
  expect(bentAngle).toBeGreaterThan(0.3);

  // Now bend the other way: fingers pointing BACKWARD (mp +z)
  world[LM.leftIndex] = lm(0.22, 0.0, 0.15);
  world[LM.leftPinky] = lm(0.18, 0.0, 0.15);
  for (let i = 0; i < 60; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  // The bone should now be in a meaningfully different orientation
  expect(bone.quaternion.angleTo(bentQuat)).toBeGreaterThan(0.3);
});

test('retargeter does not crash when hand bones are missing', () => {
  const robot = createRobot();
  // Remove hand bones to simulate a VRM without them
  delete robot.bones.leftHand;
  delete robot.bones.rightHand;

  // Should construct without error
  const rt = new Retargeter(robot);

  const world = personWithHands();
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.4, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.4, 0);
  norm[LM.leftHip] = lm(0.55, 0.7, 0);
  norm[LM.rightHip] = lm(0.45, 0.7, 0);

  // Should run without error
  for (let i = 0; i < 10; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }

  // Arms should still work fine
  const arm = robot.bones.leftLowerArm!;
  const armRest = new THREE.Quaternion(); // will have moved from rest
  expect(arm.quaternion).toBeDefined();
});

test('hand bones relax to rest when landmarks lose visibility', () => {
  const robot = createRobot();
  const rt = new Retargeter(robot);
  const norm = blank();
  norm[LM.leftShoulder] = lm(0.6, 0.4, 0);
  norm[LM.rightShoulder] = lm(0.4, 0.4, 0);
  norm[LM.leftHip] = lm(0.55, 0.7, 0);
  norm[LM.rightHip] = lm(0.45, 0.7, 0);

  const bone = robot.bones.leftHand!;
  const rest = bone.quaternion.clone();

  // Drive with a wrist bend (fingers forward)
  const world = personWithHands();
  world[LM.leftIndex] = lm(0.22, 0.0, -0.15);
  world[LM.leftPinky] = lm(0.18, 0.0, -0.15);
  for (let i = 0; i < 40; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  const tracked = bone.quaternion.angleTo(rest);
  expect(tracked).toBeGreaterThan(0.15); // measurably away from rest

  // Kill visibility on hand landmarks
  world[LM.leftPinky].visibility = 0.1;
  world[LM.leftIndex].visibility = 0.1;

  // After enough time, should relax back to rest
  for (let i = 0; i < 80; i++) {
    rt.updateFromPose(world, norm);
    rt.tick(0.033);
    robot.object.updateWorldMatrix(true, true);
  }
  expect(bone.quaternion.angleTo(rest)).toBeLessThan(0.15);
});
