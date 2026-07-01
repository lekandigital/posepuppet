// Motion Memory round-trip: record a synthetic fixture loop through the
// ring buffer, replay it through a SECOND avatar's retargeter, and check
// the replayed rig matches the source stream within tolerance. Also pins
// the int16 quantization error. Runs in node like the other unit suites.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { createRobot } from '../src/rig/robot';
import { Retargeter } from '../src/rig/retarget';
import {
  RingBuffer,
  encodePoseFrame,
  decodePoseFrame,
  blankLandmarks,
} from '../src/memory/stream';

const lm = (x: number, y: number, z: number, visibility = 1): LandmarkPoint => ({ x, y, z, visibility });
const blank = () => Array.from({ length: 33 }, () => lm(0, 0, 0, 1));

/** A person waving the left arm through a sine arc — a moving "fixture". */
function wavingPerson(t: number): LandmarkPoint[] {
  const w = blank();
  w[LM.leftShoulder] = lm(0.18, -0.5, 0);
  w[LM.rightShoulder] = lm(-0.18, -0.5, 0);
  w[LM.leftHip] = lm(0.1, 0, 0);
  w[LM.rightHip] = lm(-0.1, 0, 0);
  const a = Math.sin(t * 2.2) * 0.5 + 0.6; // arm raise phase
  w[LM.leftElbow] = lm(0.2 + 0.12 * a, -0.5 - 0.28 * a, 0);
  w[LM.leftWrist] = lm(0.22 + 0.2 * a, -0.5 - 0.55 * a, -0.05);
  w[LM.rightElbow] = lm(-0.2, -0.25, 0);
  w[LM.rightWrist] = lm(-0.2, 0, 0);
  w[LM.nose] = lm(0, -0.65, -0.08);
  w[LM.leftEar] = lm(0.07, -0.62, 0);
  w[LM.rightEar] = lm(-0.07, -0.62, 0);
  return w;
}

const angleBetween = (a: THREE.Quaternion, b: THREE.Quaternion) =>
  2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test('quantization: encode→decode error stays sub-millimeter', () => {
  const world = wavingPerson(1.234);
  const norm = wavingPerson(1.234).map((p) => ({ ...p, x: p.x * 0.4 + 0.5, y: p.y * 0.4 + 0.5 }));
  const f = encodePoseFrame(world, norm, 0);
  const w2 = blankLandmarks();
  const n2 = blankLandmarks();
  decodePoseFrame(f, w2, n2);
  for (let i = 0; i < 33; i++) {
    expect(Math.abs(w2[i].x - world[i].x)).toBeLessThan(0.001);
    expect(Math.abs(w2[i].y - world[i].y)).toBeLessThan(0.001);
    expect(Math.abs(w2[i].z - world[i].z)).toBeLessThan(0.001);
    expect(Math.abs(n2[i].x - norm[i].x)).toBeLessThan(0.001);
  }
});

test('round-trip: recorded loop replayed on a second avatar matches the source stream', () => {
  const TICK = 1 / 60;

  // ── record: drive avatar A live while the ring captures the stream ──
  const avatarA = createRobot();
  const rtA = new Retargeter(avatarA);
  const ring = new RingBuffer('pose', 12);
  const boneA = avatarA.bones.leftUpperArm!;
  const recordedQuats: THREE.Quaternion[] = [];

  let clock = 0;
  for (let i = 0; i < 360; i++) { // 6 s
    clock += TICK * 1000;
    if (i % 2 === 0) {
      const w = wavingPerson(clock / 1000);
      rtA.updateFromPose(w, w);
      ring.push(encodePoseFrame(w, w, clock));
    }
    rtA.tick(TICK);
    recordedQuats.push(boneA.quaternion.clone());
  }

  const loop = ring.snapshot(5, 'roundtrip');
  expect(loop).not.toBeNull();
  expect(loop!.frames.length).toBeGreaterThan(60);
  expect(loop!.durationMs).toBeGreaterThan(4000);

  // ── replay: feed the loop to a SECOND avatar's retargeter at the same
  // cadence and compare bone trajectories to the live recording ──
  const avatarB = createRobot();
  const rtB = new Retargeter(avatarB);
  const boneB = avatarB.bones.leftUpperArm!;
  const world = blankLandmarks();
  const norm = blankLandmarks();

  // skip A's settle-in: compare from 1 s in, where both streams track
  const skipTicks = 60;
  const diffs: number[] = [];
  let frameIdx = 0;
  let t = 0;
  const loopStartInA = 360 - Math.round(loop!.durationMs / 1000 / TICK); // ticks
  for (let i = 0; i < Math.round(loop!.durationMs / 1000 / TICK); i++) {
    t += TICK * 1000;
    while (frameIdx + 1 < loop!.frames.length && loop!.frames[frameIdx + 1].t <= t) frameIdx++;
    decodePoseFrame(loop!.frames[frameIdx], world, norm);
    rtB.updateFromPose(world, norm);
    rtB.tick(TICK);
    const aIdx = loopStartInA + i;
    if (i > skipTicks && aIdx < recordedQuats.length) {
      diffs.push(angleBetween(boneB.quaternion, recordedQuats[aIdx]));
    }
  }

  expect(diffs.length).toBeGreaterThan(120);
  const meanDeg = (diffs.reduce((a, b) => a + b, 0) / diffs.length) * (180 / Math.PI);
  const maxDeg = Math.max(...diffs) * (180 / Math.PI);
  // replay reproduces the live enactment within tight tolerance
  expect(meanDeg).toBeLessThan(5);
  expect(maxDeg).toBeLessThan(12);
});
