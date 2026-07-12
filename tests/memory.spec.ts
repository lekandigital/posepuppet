// Motion Memory round-trip: record a synthetic fixture loop through the
// ring buffer, replay it through a SECOND avatar's retargeter, and check
// the replayed rig matches the source stream within tolerance. Also pins
// the int16 quantization error. Runs in node like the other unit suites.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { LM } from '@bodyarcade/pose-runtime';
import type { LandmarkPoint } from '@bodyarcade/pose-runtime';
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

// ── Motion Memory 2: trim, energy, mirror, thumbnails (schema v2) ──────

import { trimLoop, trimFrames, MIN_TRIM_MS } from '../src/memory/trim';
import { energyCurve, bestWindow, peakFrameIndex } from '../src/memory/energy';
import { mirrorLoop, mirrorPoseInPlace } from '../src/memory/mirror';
import { loopThumbnail } from '../src/memory/thumbnail';
import type { LoopCapture, LoopFrame } from '../src/memory/stream';

/** norm mapping used across these specs (matches the quantization test) */
const normOf = (pts: LandmarkPoint[]) =>
  pts.map((p) => ({ ...p, x: p.x * 0.4 + 0.5, y: p.y * 0.4 + 0.5 }));

/** exact sagittal reflection of a world-space person: negate x + swap L/R */
const POSE_SWAP: [number, number][] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
  [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];
function reflectWorld(pts: LandmarkPoint[]): LandmarkPoint[] {
  const out = pts.map((p) => ({ ...p }));
  for (const [l, r] of POSE_SWAP) {
    const tmp = out[l];
    out[l] = out[r];
    out[r] = tmp;
  }
  for (const p of out) p.x = -p.x;
  return out;
}

/** the same person as wavingPerson, but waving the RIGHT arm — the
 *  asymmetric-gesture fixture stream for the mirror handedness check */
const rightWavingPerson = (t: number) => reflectWorld(wavingPerson(t));

function captureOf(framesSpec: Array<{ t: number; person: LandmarkPoint[] }>): LoopCapture {
  const frames = framesSpec.map(({ t, person }) => encodePoseFrame(person, normOf(person), t));
  return {
    id: 'cap-test',
    name: 'cap',
    kind: 'pose',
    createdAt: 0,
    durationMs: frames.length ? frames[frames.length - 1].t : 0,
    frames,
  };
}

test('trim: exact boundary contract — kept set, re-timing, duration, idempotence', () => {
  const spec = [];
  for (let t = 0; t <= 5900; t += 100) spec.push({ t, person: wavingPerson(t / 1000) });
  const loop = captureOf(spec); // 60 frames, 0..5900

  const trimmed = trimLoop(loop, 1000, 3000)!;
  expect(trimmed).not.toBeNull();
  // frames kept are EXACTLY those with t ∈ [1000, 3000], re-timed from 0
  expect(trimmed.frames.length).toBe(21);
  expect(trimmed.frames[0].t).toBe(0);
  expect(trimmed.frames[20].t).toBe(2000);
  expect(trimmed.durationMs).toBe(2000);
  // frame buffers are shared, not re-encoded
  expect(trimmed.frames[0].q).toBe(loop.frames[10].q);

  // idempotence: full-range trim of the trimmed loop is a no-op
  const again = trimLoop(trimmed, 0, trimmed.durationMs)!;
  expect(again.frames.length).toBe(21);
  expect(again.frames.map((f) => f.t)).toEqual(trimmed.frames.map((f) => f.t));

  // reversed handles normalize; degenerate windows refuse
  expect(trimLoop(loop, 3000, 1000)!.durationMs).toBe(2000);
  expect(trimLoop(loop, 100, 100 + MIN_TRIM_MS - 100)).toBeNull();

  // boundary frames at exactly inMs/outMs are kept
  const edge = trimFrames(loop.frames, 500, 900);
  expect(edge[0].t).toBe(0); // was exactly 500
  expect(edge[edge.length - 1].t).toBe(400); // was exactly 900
});

test('energy: stillness reads ~zero; best 5 s window lands on the motion; peak inside it', () => {
  // 12 s at 20 fps: still (frozen pose) → 3 s of waving → still again
  const still = wavingPerson(0);
  const spec = [];
  for (let t = 0; t <= 12000; t += 50) {
    const person = t < 4000 ? still : t <= 7000 ? wavingPerson(t / 1000) : wavingPerson(7);
    spec.push({ t, person });
  }
  const loop = captureOf(spec);
  const curve = energyCurve(loop.frames, 'pose');

  const meanOver = (a: number, b: number) => {
    const vals = curve.filter((_, i) => loop.frames[i].t >= a && loop.frames[i].t <= b);
    return vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1);
  };
  const stillMean = meanOver(0, 3900);
  const waveMean = meanOver(4100, 6900);
  expect(stillMean).toBeLessThan(0.02); // quantization noise only
  expect(waveMean).toBeGreaterThan(stillMean * 20);

  const win = bestWindow(loop.frames, 'pose', 5000);
  expect(win.endMs - win.startMs).toBeLessThanOrEqual(5000 + 1);
  // the best window must cover the whole 3 s wave
  expect(win.startMs).toBeLessThanOrEqual(4000);
  expect(win.endMs).toBeGreaterThanOrEqual(7000);

  const peakT = loop.frames[peakFrameIndex(loop.frames, 'pose')].t;
  expect(peakT).toBeGreaterThanOrEqual(4000);
  expect(peakT).toBeLessThanOrEqual(7050);

  // a loop shorter than the window returns its full range
  const shortLoop = captureOf(spec.slice(0, 60)); // ~3 s
  const shortWin = bestWindow(shortLoop.frames, 'pose', 5000);
  expect(shortWin.startMs).toBe(shortLoop.frames[0].t);
  expect(shortWin.endMs).toBe(shortLoop.frames[shortLoop.frames.length - 1].t);
});

test('mirror data: a right-hand wave reflects into the left-hand wave stream (quantization-exact)', () => {
  const spec = [];
  for (let t = 0; t <= 3000; t += 50) spec.push({ t, person: rightWavingPerson(t / 1000) });
  const rightLoop = captureOf(spec);

  const mirrored = mirrorLoop(rightLoop);
  const world = blankLandmarks();
  const norm = blankLandmarks();
  const refWorld = blankLandmarks();
  const refNorm = blankLandmarks();
  for (let i = 0; i < mirrored.frames.length; i++) {
    decodePoseFrame(mirrored.frames[i], world, norm);
    const ref = wavingPerson(rightLoop.frames[i].t / 1000);
    decodePoseFrame(encodePoseFrame(ref, normOf(ref), 0), refWorld, refNorm);
    for (let j = 0; j < 33; j++) {
      expect(Math.abs(world[j].x - refWorld[j].x)).toBeLessThan(0.002);
      expect(Math.abs(world[j].y - refWorld[j].y)).toBeLessThan(0.002);
      expect(Math.abs(norm[j].x - refNorm[j].x)).toBeLessThan(0.002);
    }
  }

  // involution: mirroring twice returns the original frames
  const twice = mirrorLoop(mirrored);
  for (let i = 0; i < twice.frames.length; i++) {
    for (let k = 0; k < twice.frames[i].q.length; k++) {
      expect(Math.abs(twice.frames[i].q[k] - rightLoop.frames[i].q[k])).toBeLessThanOrEqual(2);
    }
  }

  // in-place variant mutates consistently with the loop-level one
  const w = rightWavingPerson(1.5);
  const n = normOf(w);
  mirrorPoseInPlace(w, n);
  const refP = wavingPerson(1.5);
  expect(Math.abs(w[LM.leftWrist].x - refP[LM.leftWrist].x)).toBeLessThan(1e-9);
  expect(Math.abs(n[LM.leftWrist].x - normOf(refP)[LM.leftWrist].x)).toBeLessThan(1e-9);
});

test('mirror handedness on the rig: right-hand wave replays as a true left-hand wave', () => {
  const TICK = 1 / 60;

  // record the RIGHT-hand wave through the ring (30 Hz effective)
  const ring = new RingBuffer('pose', 12);
  let clock = 0;
  for (let i = 0; i < 360; i++) {
    clock += TICK * 1000;
    if (i % 2 === 0) {
      const w = rightWavingPerson(clock / 1000);
      ring.push(encodePoseFrame(w, normOf(w), clock));
    }
  }
  const loop = ring.snapshot(5, 'right-wave')!;
  expect(loop).not.toBeNull();

  // ground truth: an avatar driven LIVE by the left-hand wave
  const avatarRef = createRobot();
  const rtRef = new Retargeter(avatarRef);
  // mirrored replay: a second avatar fed the mirrored right-wave loop
  const avatarMir = createRobot();
  const rtMir = new Retargeter(avatarMir);
  const mirrored = mirrorLoop(loop);

  const world = blankLandmarks();
  const norm = blankLandmarks();
  const startT = 360 * TICK * 1000 - loop.durationMs; // loop's t=0 in clock time
  const diffs: number[] = [];
  let leftRange = 0;
  let rightRange = 0;
  let firstLeft: THREE.Quaternion | null = null;
  let firstRight: THREE.Quaternion | null = null;
  let frameIdx = 0;
  let t = 0;
  const ticks = Math.round(loop.durationMs / 1000 / TICK);
  for (let i = 0; i < ticks; i++) {
    t += TICK * 1000;
    while (frameIdx + 1 < mirrored.frames.length && mirrored.frames[frameIdx + 1].t <= t) frameIdx++;
    decodePoseFrame(mirrored.frames[frameIdx], world, norm);
    rtMir.updateFromPose(world, norm);
    rtMir.tick(TICK);

    const ref = wavingPerson((startT + t) / 1000);
    rtRef.updateFromPose(ref, normOf(ref));
    rtRef.tick(TICK);

    if (i > 60) {
      diffs.push(angleBetween(avatarMir.bones.leftUpperArm!.quaternion, avatarRef.bones.leftUpperArm!.quaternion));
      firstLeft ??= avatarMir.bones.leftUpperArm!.quaternion.clone();
      firstRight ??= avatarMir.bones.rightUpperArm!.quaternion.clone();
      leftRange = Math.max(leftRange, angleBetween(avatarMir.bones.leftUpperArm!.quaternion, firstLeft));
      rightRange = Math.max(rightRange, angleBetween(avatarMir.bones.rightUpperArm!.quaternion, firstRight));
    }
  }

  // sync metric vs the ground-truth mirrored render
  expect(diffs.length).toBeGreaterThan(120);
  const meanDeg = (diffs.reduce((a, b) => a + b, 0) / diffs.length) * (180 / Math.PI);
  const maxDeg = Math.max(...diffs) * (180 / Math.PI);
  expect(meanDeg).toBeLessThan(5);
  expect(maxDeg).toBeLessThan(12);

  // handedness: in the mirrored replay the LEFT arm carries the wave,
  // the right arm stays comparatively still — the reflection truly
  // swapped sides rather than just flipping x
  expect(leftRange * (180 / Math.PI)).toBeGreaterThan(15);
  expect(leftRange).toBeGreaterThan(rightRange * 2.5);
});

test('thumbnails: deterministic SVG from the highest-energy frame', () => {
  const spec = [];
  for (let t = 0; t <= 4000; t += 50) spec.push({ t, person: wavingPerson(t / 1000) });
  const loop = captureOf(spec);

  const a = loopThumbnail(loop);
  const b = loopThumbnail({ kind: loop.kind, frames: loop.frames.map((f) => ({ t: f.t, q: new Int16Array(f.q) })) });
  expect(a).toBe(b); // identical bytes, twice, through copied buffers
  expect(a.startsWith('<svg')).toBe(true);
  expect(a).toContain('<line');

  // a different pose renders a different skeleton
  const still = captureOf([{ t: 0, person: wavingPerson(0) }, { t: 100, person: wavingPerson(0) }]);
  expect(loopThumbnail(still)).not.toBe(a);
});
