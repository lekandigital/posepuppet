// @bodyarcade/locomotion model tests (node, no browser): cadence→speed
// tracking, the comfort envelope under adversarial input (the S8 automated
// proxy), tracking-loss autopilot + snap-free re-entry, seated lean-glide,
// crouch duck, keyboard override, path-shoulder assist + lean yield, step/
// recenter pulses, and intent-stream replay determinism.
import { test, expect } from '@playwright/test';
import {
  createLocomotion, defaultLocomotionConfig,
  type PathHint, type WalkIntent, type WalkPose,
} from '../packages/locomotion/src/index';

const CFG = defaultLocomotionConfig();
const DT = 16; // ms per frame
const EPS = 1e-6;

function mkIntent(over: Partial<WalkIntent> = {}): WalkIntent {
  return {
    cadence: 0,
    gaitActive: false,
    gaitAmp: 0,
    stepCount: 0,
    shift: 0,
    gaitSource: 'none',
    leanX: 0,
    leanY: 0,
    crouch: 0,
    seated: false,
    confidence: 0.9,
    signalFresh: true,
    recenterEvent: false,
    kb: { forward: 0, turn: 0, active: false },
    ...over,
    kb: { forward: 0, turn: 0, active: false, ...(over.kb ?? {}) },
  };
}

const walkIntent = (cadence: number, over: Partial<WalkIntent> = {}): WalkIntent =>
  mkIntent({ cadence, gaitActive: cadence > 0, gaitAmp: 0.6, gaitSource: 'legs', ...over });

/** Drive `seconds` of identical intent; returns every pose. */
function drive(
  loco: ReturnType<typeof createLocomotion>,
  startTs: number,
  seconds: number,
  intent: WalkIntent | ((i: number) => WalkIntent),
  path?: PathHint,
): { poses: WalkPose[]; endTs: number } {
  const n = Math.round((seconds * 1000) / DT);
  const poses: WalkPose[] = [];
  for (let i = 0; i < n; i++) {
    poses.push(loco.step(startTs + i * DT, typeof intent === 'function' ? intent(i) : intent, path));
  }
  return { poses, endTs: startTs + n * DT };
}

const last = <T>(a: T[]): T => a[a.length - 1];

// ---------------------------------------------------------------------------

test('cadence→speed: tracks stride·cadence·ampScale with inertia; scales with cadence', () => {
  const loco = createLocomotion();
  const ampScale = Math.min(Math.max(0.6 / CFG.ampRef, CFG.ampFloor), 1.15);
  for (const cadence of [1.0, 2.0, 3.0]) {
    loco.reset();
    const { poses } = drive(loco, 0, 6, walkIntent(cadence));
    const expected = Math.min(CFG.strideM * cadence * ampScale, CFG.comfort.maxSpeed);
    expect(Math.abs(last(poses).speed - expected) / expected, `cadence ${cadence}`).toBeLessThan(0.05);
    expect(last(poses).mode).toBe('walk');
    // inertia: speed rises smoothly, not instantly
    expect(poses[1].speed).toBeLessThan(expected * 0.2);
  }
});

test('comfort envelope holds under adversarial input (S8 automated proxy)', () => {
  const loco = createLocomotion();
  // deterministic LCG — violent extremes flipping every ~0.4 s
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let intent = mkIntent();
  const n = Math.round(30_000 / DT);
  for (let i = 0; i < n; i++) {
    if (i % 25 === 0) {
      const r = rnd();
      intent = mkIntent({
        cadence: rnd() < 0.5 ? 3.5 : 0,
        gaitActive: rnd() < 0.7,
        gaitAmp: rnd(),
        leanX: rnd() < 0.5 ? -1 : 1,
        leanY: rnd() * 2 - 1,
        crouch: rnd() < 0.4 ? 1 : 0,
        seated: rnd() < 0.3,
        signalFresh: r < 0.8,
        confidence: rnd(),
        kb: rnd() < 0.3
          ? { forward: rnd() < 0.5 ? 1 : -1, turn: rnd() < 0.5 ? 1 : -1, active: true }
          : { forward: 0, turn: 0, active: false },
      });
    }
    const p = loco.step(i * DT, intent);
    expect(p.eyeY).toBeGreaterThanOrEqual(CFG.comfort.eyeHeight - CFG.comfort.duckDrop - EPS);
    expect(p.eyeY).toBeLessThanOrEqual(CFG.comfort.eyeHeight + EPS);
    expect(p.vignette).toBeGreaterThanOrEqual(0);
    expect(p.vignette).toBeLessThanOrEqual(CFG.comfort.vignette.max + EPS);
  }
  const env = loco.envelope();
  expect(env.maxSpeed).toBeLessThanOrEqual(CFG.comfort.maxSpeed + EPS);
  expect(env.maxAccel).toBeLessThanOrEqual(Math.max(CFG.comfort.maxAccel, CFG.comfort.maxDecel) + EPS);
  expect(env.maxYawRateDps).toBeLessThanOrEqual(CFG.comfort.maxYawRateDps + EPS);
  expect(env.maxYawAccelDps2).toBeLessThanOrEqual(CFG.comfort.maxYawAccelDps2 + EPS);
  expect(env.maxEyeSlewPerS).toBeLessThanOrEqual(CFG.comfort.eyeSlewPerS + EPS);
});

test('tracking loss: gentle stop on held heading; re-entry never snaps', () => {
  const loco = createLocomotion();
  // establish a walk with a slight ongoing turn
  const { poses: warm, endTs } = drive(loco, 0, 6, walkIntent(2.0, { leanX: 0.3 }));
  const atLoss = last(warm);
  expect(atLoss.speed).toBeGreaterThan(1.0);

  // dropout — decel ≤ autopilot.decel, yaw rate eases to 0, heading held
  const lost = drive(loco, endTs, 3, mkIntent({ signalFresh: false, confidence: 0 }));
  let prev = atLoss;
  for (const p of lost.poses) {
    const dv = Math.abs(p.speed - prev.speed) / (DT / 1000);
    expect(dv).toBeLessThanOrEqual(CFG.autopilot.decel + 1e-3);
    prev = p;
  }
  const stopped = last(lost.poses);
  expect(stopped.speed).toBeLessThan(0.02);
  expect(Math.abs(stopped.yawRateDps)).toBeLessThan(0.5);
  // heading held once the residual yaw rate decays (~0.3 s): compare the
  // yaw shortly after loss with the final yaw
  const settled = lost.poses[Math.round(400 / DT)];
  expect(Math.abs(stopped.yawDeg - settled.yawDeg)).toBeLessThan(2);

  // re-entry with a hard demand: rate change stays inside the yaw-accel cap
  const back = drive(loco, lost.endTs, 2, walkIntent(3.0, { leanX: 1 }));
  prev = stopped;
  for (const p of back.poses) {
    const dRate = Math.abs(p.yawRateDps - prev.yawRateDps) / (DT / 1000);
    expect(dRate).toBeLessThanOrEqual(CFG.comfort.maxYawAccelDps2 + 1e-3);
    const dv = Math.abs(p.speed - prev.speed) / (DT / 1000);
    expect(dv).toBeLessThanOrEqual(Math.max(CFG.comfort.maxAccel, CFG.comfort.maxDecel) + 1e-3);
    prev = p;
  }
  expect(last(back.poses).speed).toBeGreaterThan(0.8); // control genuinely returned
});

test('seated lean-glide: forward lean drives speed, upright stops, lean steers', () => {
  const loco = createLocomotion();
  const glide = (leanY: number, leanX = 0) => mkIntent({ seated: true, leanY, leanX });
  const { poses, endTs } = drive(loco, 0, 5, glide(0.6));
  const expected = ((0.6 - CFG.glide.leanOn) / (1 - CFG.glide.leanOn)) * CFG.glide.maxSpeed;
  expect(last(poses).mode).toBe('glide');
  expect(Math.abs(last(poses).speed - expected) / expected).toBeLessThan(0.05);

  const steered = drive(loco, endTs, 3, glide(0.6, 0.5));
  expect(last(steered.poses).yawRateDps).toBeGreaterThan(10);
  expect(last(steered.poses).yawRateDps).toBeLessThanOrEqual(CFG.comfort.maxYawRateDps + EPS);

  const stopped = drive(loco, steered.endTs, 4, glide(0));
  expect(last(stopped.poses).speed).toBeLessThan(0.02);
});

test('crouch: ducks the eye smoothly and slows the walk; stand restores', () => {
  const loco = createLocomotion();
  const { poses, endTs } = drive(loco, 0, 6, walkIntent(2.0));
  const walkSpeed = last(poses).speed;

  const ducked = drive(loco, endTs, 4, walkIntent(2.0, { crouch: 0.8 }));
  const duck = (0.8 - CFG.crouchOn) / (1 - CFG.crouchOn);
  const expectEye = CFG.comfort.eyeHeight - CFG.comfort.duckDrop * duck;
  expect(Math.abs(last(ducked.poses).eyeY - expectEye)).toBeLessThan(0.02);
  expect(last(ducked.poses).speed).toBeLessThan(walkSpeed * CFG.duckSpeedScale * 1.15);
  let prev = last(poses);
  for (const p of ducked.poses) {
    expect(Math.abs(p.eyeY - prev.eyeY) / (DT / 1000)).toBeLessThanOrEqual(CFG.comfort.eyeSlewPerS + 1e-3);
    prev = p;
  }

  const stood = drive(loco, ducked.endTs, 3, walkIntent(2.0));
  expect(Math.abs(last(stood.poses).eyeY - CFG.comfort.eyeHeight)).toBeLessThan(0.02);
});

test('keyboard wins while touched; caps still hold', () => {
  const loco = createLocomotion();
  const kb = walkIntent(2.0, { kb: { forward: 1, turn: 1, active: true } });
  const { poses } = drive(loco, 0, 5, kb);
  expect(last(poses).mode).toBe('keyboard');
  expect(Math.abs(last(poses).speed - CFG.keyboard.speed)).toBeLessThan(0.05);
  expect(Math.abs(last(poses).yawRateDps - CFG.keyboard.turnDps)).toBeLessThan(0.5);
  const env = loco.envelope();
  expect(env.maxSpeed).toBeLessThanOrEqual(CFG.comfort.maxSpeed + EPS);
  expect(env.maxYawRateDps).toBeLessThanOrEqual(CFG.comfort.maxYawRateDps + EPS);
});

test('path assist: converges back inside the shoulder without oscillation; lean yields', () => {
  // straight path down −Z through x = 0, walkable half-width 1.5 m
  const path: PathHint = (x) => ({ dirX: 0, dirZ: -1, lateral: x, halfWidth: 1.5 });

  const loco = createLocomotion();
  loco.teleport(2.2, 0, 0); // well past the 0.9 m shoulder margin
  const { poses } = drive(loco, 0, 14, walkIntent(2.0), path);
  const end = last(poses);
  expect(Math.abs(end.x)).toBeLessThan(1.0); // pulled back toward the walkable band
  expect(Math.abs(end.yawRateDps)).toBeLessThan(16); // settled, not weaving
  // never violates comfort while assisting
  expect(loco.envelope().maxYawRateDps).toBeLessThanOrEqual(CFG.comfort.maxYawRateDps + EPS);

  // deliberate lean SILENCES the assist (rowing coxswain lesson): leaning
  // right while right of the path keeps drifting right
  const loco2 = createLocomotion();
  loco2.teleport(2.2, 0, 0);
  const leaned = drive(loco2, 0, 5, walkIntent(2.0, { leanX: 0.5 }), path);
  expect(last(leaned.poses).x).toBeGreaterThan(2.2);
});

test('assist off: no path pull', () => {
  const path: PathHint = (x) => ({ dirX: 0, dirZ: -1, lateral: x, halfWidth: 1.5 });
  const loco = createLocomotion({ assist: { mode: 'off' } });
  loco.teleport(2.2, 0, 0);
  const { poses } = drive(loco, 0, 8, walkIntent(2.0), path);
  expect(Math.abs(last(poses).x - 2.2)).toBeLessThan(0.05); // walked straight −Z
});

test('step + recenter pulses fire exactly on their frames', () => {
  const loco = createLocomotion();
  let steps = 0;
  let pulses = 0;
  const { poses } = drive(loco, 0, 6, (i) => {
    if (i > 0 && i % 30 === 0) steps++; // a "footfall" every 480 ms
    return walkIntent(2.0, { stepCount: steps, recenterEvent: i === 200 });
  });
  for (const p of poses) if (p.stepPulse) pulses++;
  expect(pulses).toBe(steps);
  expect(poses[200].recentered).toBe(true);
  expect(poses.filter((p) => p.recentered).length).toBe(1);
});

test('determinism: identical intent stream → identical pose trace', () => {
  const seqIntent = (i: number) =>
    walkIntent(i < 200 ? 2.0 : 0, {
      leanX: Math.sin(i / 40) * 0.6,
      signalFresh: i % 130 < 110,
      crouch: i > 300 && i < 380 ? 0.7 : 0,
    });
  const a = createLocomotion();
  const b = createLocomotion();
  const ta = drive(a, 0, 8, seqIntent).poses;
  const tb = drive(b, 0, 8, seqIntent).poses;
  expect(JSON.stringify(ta)).toBe(JSON.stringify(tb));
});
