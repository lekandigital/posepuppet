// V3 synthetic-stream eval — the numbers artifact. Drives the FULL chain
// (landmark frames → body-input gait → controller intent → locomotion) on
// simulated clocks (fully deterministic) and writes eval/walking-results.json:
// step-count accuracy, cadence tracking, speed steady-state, dropout stop
// behavior, and the comfort-envelope maxima against their caps. Every
// number a doc or post quotes about walking traces here.
//
// Real-clip validation (march_slow/fast, weight_shift, walk_lean_turns) is
// DEFERRED: the clips are optional per the V3 prompt and not yet recorded —
// FINAL_USER_TEST_PLAN S8 carries the request.
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBodyInputCore, type BodyInputFrame, type LandmarkPoint,
} from '../packages/body-input/src/index';
import { LM } from '../packages/body-input/src/lm';
import {
  createLocomotion, createWalkController, defaultLocomotionConfig,
  type WalkPose,
} from '../packages/locomotion/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', 'eval', 'walking-results.json');

// --- synthetic walker (the gait.spec geometry) ---------------------------
interface FrameOpts {
  marchPhase?: number;
  swayM?: number;
  seated?: boolean;
  leanFwdDeg?: number;
  legsVis?: number;
  drop?: boolean;
}

function lm(x: number, y: number, z: number, visibility = 0.95): LandmarkPoint {
  return { x, y, z, visibility };
}

function frameAt(tsMs: number, o: FrameOpts): BodyInputFrame {
  if (o.drop) return { tsMs, world: null, norm: null };
  const world: LandmarkPoint[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  const legsVis = o.legsVis ?? 0.95;
  const sway = o.swayM ?? 0;
  let sh: [number, number, number][] = [[0.18, -0.5, 0], [-0.18, -0.5, 0]];
  let nose: [number, number, number] = [0, -0.65, -0.08];
  if (o.leanFwdDeg) {
    const b = (o.leanFwdDeg * Math.PI) / 180;
    const rot = (p: [number, number, number]): [number, number, number] =>
      [p[0], p[1] * Math.cos(b), p[2] + p[1] * Math.sin(b)];
    sh = sh.map(rot) as typeof sh;
    nose = rot(nose);
  }
  world[LM.leftShoulder] = lm(sh[0][0] + sway, sh[0][1], sh[0][2]);
  world[LM.rightShoulder] = lm(sh[1][0] + sway, sh[1][1], sh[1][2]);
  world[LM.nose] = lm(nose[0] + sway, nose[1], nose[2]);
  world[LM.leftHip] = lm(0.1 + sway, 0, 0);
  world[LM.rightHip] = lm(-0.1 + sway, 0, 0);
  if (o.seated) {
    world[LM.leftKnee] = lm(0.1 + sway, 0.05, -0.4, legsVis);
    world[LM.rightKnee] = lm(-0.1 + sway, 0.05, -0.4, legsVis);
    world[LM.leftAnkle] = lm(0.1 + sway, 0.5, -0.4, legsVis);
    world[LM.rightAnkle] = lm(-0.1 + sway, 0.5, -0.4, legsVis);
  } else {
    const thigh = 0.45;
    const maxRad = (70 * Math.PI) / 180;
    const p = o.marchPhase ?? 0;
    const thL = Math.max(0, Math.sin(p)) * maxRad;
    const thR = Math.max(0, -Math.sin(p)) * maxRad;
    world[LM.leftKnee] = lm(0.1 + sway, thigh * Math.cos(thR), -thigh * Math.sin(thR), legsVis);
    world[LM.rightKnee] = lm(-0.1 + sway, thigh * Math.cos(thL), -thigh * Math.sin(thL), legsVis);
    world[LM.leftAnkle] = lm(0.1 + sway, 0.9, 0, legsVis);
    world[LM.rightAnkle] = lm(-0.1 + sway, 0.9, 0, legsVis);
  }
  const armLen = 0.5;
  world[LM.leftWrist] = lm(world[LM.leftShoulder].x + 0.02, world[LM.leftShoulder].y + armLen, 0);
  world[LM.rightWrist] = lm(world[LM.rightShoulder].x - 0.02, world[LM.rightShoulder].y + armLen, 0);
  world[LM.leftElbow] = lm(world[LM.leftShoulder].x, world[LM.leftShoulder].y + armLen / 2, 0);
  world[LM.rightElbow] = lm(world[LM.rightShoulder].x, world[LM.rightShoulder].y + armLen / 2, 0);
  const norm = world.map((pt) => ({
    x: 0.5 + pt.x * 0.25, y: 0.55 + pt.y * 0.25, z: pt.z * 0.25, visibility: pt.visibility,
  }));
  return { tsMs, world, norm };
}

// --- full-chain runner ----------------------------------------------------
const STEP = 33;
const LEAD_S = 2;
const CFG = defaultLocomotionConfig();

interface ChainSample { t: number; pose: WalkPose; steps: number; cadence: number }

function runChain(seconds: number, opts: (tSec: number) => FrameOpts): {
  samples: ChainSample[];
  envelope: ReturnType<ReturnType<typeof createLocomotion>['envelope']>;
} {
  const core = createBodyInputCore();
  const controller = createWalkController(null); // no window: pure chain
  const loco = createLocomotion();
  const samples: ChainSample[] = [];
  const n = Math.round((seconds * 1000) / STEP);
  for (let i = 0; i < n; i++) {
    const ts = i * STEP;
    const signal = core.push(frameAt(ts, opts(ts / 1000)));
    controller.inject(signal, ts);
    const intent = controller.intent(ts);
    const pose = loco.step(ts, intent);
    samples.push({ t: ts / 1000, pose, steps: signal.gait?.count ?? 0, cadence: signal.gait?.cadence ?? 0 });
  }
  return { samples, envelope: loco.envelope() };
}

const last = <T>(a: T[]): T => a[a.length - 1];
const round = (v: number, p = 3): number => Math.round(v * 10 ** p) / 10 ** p;

interface ScenarioResult {
  name: string;
  [k: string]: unknown;
  pass: boolean;
}

const results: ScenarioResult[] = [];

test('march scenarios: steps, cadence, speed track the driven rhythm', () => {
  for (const cycleHz of [0.5, 0.9, 1.35]) {
    const seconds = LEAD_S + 12;
    const { samples, envelope } = runChain(seconds, (t) =>
      t < LEAD_S ? {} : { marchPhase: 2 * Math.PI * cycleHz * (t - LEAD_S) },
    );
    const stepsExpected = 2 * cycleHz * 12;
    const cadenceExpected = 2 * cycleHz;
    const end = last(samples);
    const cadenceErrPct = Math.abs(end.cadence - cadenceExpected) / cadenceExpected * 100;
    // model steady-state speed for this cadence (amp saturates ampScale)
    const tail = samples.filter((s) => s.t > seconds - 3);
    const meanSpeed = tail.reduce((a, s) => a + s.pose.speed, 0) / tail.length;
    const pass =
      Math.abs(end.steps - stepsExpected) <= 2 &&
      cadenceErrPct < 12 &&
      meanSpeed > 0.3 &&
      envelope.maxSpeed <= CFG.comfort.maxSpeed + 1e-6;
    results.push({
      name: `march_${cycleHz}hz_cycle`,
      stepsExpected: round(stepsExpected, 1), stepsDetected: end.steps,
      cadenceExpectedHz: cadenceExpected, cadenceDetectedHz: round(end.cadence),
      cadenceErrPct: round(cadenceErrPct, 1), steadySpeedMps: round(meanSpeed),
      envelope: { maxSpeed: round(envelope.maxSpeed), maxAccel: round(envelope.maxAccel), maxYawRateDps: round(envelope.maxYawRateDps) },
      pass,
    });
    expect(pass, `march @ ${cycleHz}`).toBe(true);
  }
});

test('sway scenario: weight-shift walking without legs', () => {
  const cycleHz = 0.55;
  const seconds = LEAD_S + 12;
  const { samples, envelope } = runChain(seconds, (t) =>
    t < LEAD_S
      ? { legsVis: 0.2 }
      : { legsVis: 0.2, swayM: 0.08 * Math.sin(2 * Math.PI * cycleHz * (t - LEAD_S)) },
  );
  const end = last(samples);
  const stepsExpected = 2 * cycleHz * 12;
  const tail = samples.filter((s) => s.t > seconds - 3);
  const meanSpeed = tail.reduce((a, s) => a + s.pose.speed, 0) / tail.length;
  const pass = Math.abs(end.steps - stepsExpected) <= 3 && meanSpeed > 0.25;
  results.push({
    name: 'sway_0.55hz_cycle',
    stepsExpected: round(stepsExpected, 1), stepsDetected: end.steps,
    cadenceDetectedHz: round(end.cadence), steadySpeedMps: round(meanSpeed),
    envelope: { maxSpeed: round(envelope.maxSpeed), maxAccel: round(envelope.maxAccel) },
    pass,
  });
  expect(pass).toBe(true);
});

test('glide scenario: seated forward lean', () => {
  const seconds = LEAD_S + 10;
  const { samples, envelope } = runChain(seconds, (t) =>
    t < LEAD_S + 3 ? { seated: true } : { seated: true, leanFwdDeg: 9 },
  );
  const tail = samples.filter((s) => s.t > seconds - 3);
  const meanSpeed = tail.reduce((a, s) => a + s.pose.speed, 0) / tail.length;
  const mode = last(samples).pose.mode;
  const pass = mode === 'glide' && meanSpeed > 0.6 && meanSpeed <= CFG.glide.maxSpeed + 1e-6;
  results.push({
    name: 'seated_glide',
    steadySpeedMps: round(meanSpeed), mode,
    envelope: { maxSpeed: round(envelope.maxSpeed) },
    pass,
  });
  expect(pass).toBe(true);
});

test('dropout scenario: gentle stop, held heading, snap-free recovery', () => {
  const lossAt = LEAD_S + 8;
  const lossDur = 3;
  const seconds = lossAt + lossDur + 8;
  const { samples, envelope } = runChain(seconds, (t) => {
    if (t >= lossAt && t < lossAt + lossDur) return { drop: true };
    const tt = t < LEAD_S ? 0 : t - LEAD_S;
    return t < LEAD_S ? {} : { marchPhase: 2 * Math.PI * 0.9 * tt };
  });
  const atLoss = samples.filter((s) => s.t < lossAt);
  const speedAtLoss = last(atLoss).pose.speed;
  const stopSample = samples.find((s) => s.t > lossAt && s.pose.speed < 0.05);
  const stopAfterMs = stopSample ? (stopSample.t - lossAt) * 1000 : Infinity;
  // decel during the loss window
  let maxDecel = 0;
  let headingAtStop = 0;
  let headingAtLossEnd = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (b.t > lossAt && b.t <= lossAt + lossDur) {
      maxDecel = Math.max(maxDecel, Math.abs(b.pose.speed - a.pose.speed) / (STEP / 1000));
      headingAtLossEnd = b.pose.yawDeg;
    }
  }
  if (stopSample) headingAtStop = stopSample.pose.yawDeg;
  const headingDrift = Math.abs(headingAtLossEnd - headingAtStop);
  const recovered = samples.some((s) => s.t > lossAt + lossDur && s.pose.speed > 0.7);
  const pass =
    speedAtLoss > 0.8 &&
    stopAfterMs < 2500 &&
    maxDecel <= CFG.autopilot.decel + 1e-3 &&
    headingDrift < 5 &&
    recovered &&
    envelope.maxYawAccelDps2 <= CFG.comfort.maxYawAccelDps2 + 1e-6;
  results.push({
    name: 'dropout_3s',
    speedAtLossMps: round(speedAtLoss), stopAfterMs: Math.round(stopAfterMs),
    maxDecelDuringLoss: round(maxDecel), headingDriftDeg: round(headingDrift, 2),
    recovered,
    envelope: {
      maxAccel: round(envelope.maxAccel), maxYawAccelDps2: round(envelope.maxYawAccelDps2),
    },
    pass,
  });
  expect(pass).toBe(true);
});

test('comfort envelope caps (the S8 automated proxy) + write results', () => {
  // adversarial run straight through the chain: violent scenario flips
  const seconds = 30;
  let seed = 1337;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let cur: FrameOpts = {};
  const { envelope } = runChain(seconds, (t) => {
    const frameIdx = Math.round((t * 1000) / STEP);
    if (frameIdx % 12 === 0) { // flip the scenario every ~0.4 s
      const r = rnd();
      cur =
        r < 0.25 ? { drop: true }
        : r < 0.5 ? { marchPhase: 2 * Math.PI * 1.35 * t }
        : r < 0.7 ? { seated: true, leanFwdDeg: 12 }
        : { legsVis: 0.2, swayM: 0.1 * Math.sin(2 * Math.PI * 0.8 * t) };
    }
    return cur;
  });
  const caps = {
    maxSpeed: CFG.comfort.maxSpeed,
    maxAccel: Math.max(CFG.comfort.maxAccel, CFG.comfort.maxDecel),
    maxYawRateDps: CFG.comfort.maxYawRateDps,
    maxYawAccelDps2: CFG.comfort.maxYawAccelDps2,
    maxEyeSlewPerS: CFG.comfort.eyeSlewPerS,
  };
  const pass =
    envelope.maxSpeed <= caps.maxSpeed + 1e-6 &&
    envelope.maxAccel <= caps.maxAccel + 1e-6 &&
    envelope.maxYawRateDps <= caps.maxYawRateDps + 1e-6 &&
    envelope.maxYawAccelDps2 <= caps.maxYawAccelDps2 + 1e-6 &&
    envelope.maxEyeSlewPerS <= caps.maxEyeSlewPerS + 1e-6;
  results.push({
    name: 'comfort_adversarial_30s',
    observed: {
      maxSpeed: round(envelope.maxSpeed), maxAccel: round(envelope.maxAccel),
      maxYawRateDps: round(envelope.maxYawRateDps),
      maxYawAccelDps2: round(envelope.maxYawAccelDps2),
      maxEyeSlewPerS: round(envelope.maxEyeSlewPerS),
    },
    caps,
    pass,
  });
  expect(pass).toBe(true);

  // artifact — every walking number quoted anywhere traces here
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    generatedBy: 'tests/walking-eval.spec.ts (V3 Walking synthetic-stream eval)',
    generatedAt: new Date().toISOString(),
    note: 'Synthetic-stream chain: landmarks → body-input gait → controller → locomotion. Real-clip validation deferred (clips optional; see FINAL_USER_TEST_PLAN S8).',
    comfortCaps: CFG.comfort,
    scenarios: results,
    allPass: results.every((r) => r.pass),
  }, null, 2));
});
