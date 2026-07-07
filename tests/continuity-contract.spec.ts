// PPC ↔ body-input ↔ Flight confidence contract: on a full dropout the
// game must still get autopilot on essentially the legacy schedule.
// Measures when signal.confidence crosses Flight's MIN_CONFIDENCE (0.35)
// with and without PPC in the chain — the shift is bounded, documented,
// and this test is the enforcement. Pure node, deterministic.
import { test, expect } from '@playwright/test';
import { createBodyInputCore } from '@bodyarcade/body-input';
import { LM } from '../src/pose/indices';
import type { LandmarkPoint } from '../src/pose/types';
import { PoseContinuity } from '../src/pose/continuity';

const DT = 100 / 3; // ~30 fps
const FLIGHT_MIN_CONFIDENCE = 0.35; // apps/flight bodyControls.ts, Gate-3-frozen

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
  w[LM.leftHip] = lm(0.1, 0, 0);
  w[LM.rightHip] = lm(-0.1, 0, 0);
  w[LM.leftKnee] = lm(0.11, 0.4, 0);
  w[LM.rightKnee] = lm(-0.11, 0.4, 0);
  w[LM.leftAnkle] = lm(0.12, 0.78, 0);
  w[LM.rightAnkle] = lm(-0.12, 0.78, 0);
  return w;
}
const toNorm = (w: LandmarkPoint[]): LandmarkPoint[] =>
  w.map((p) => lm(0.5 + p.x * 0.4, 0.55 + p.y * 0.35, p.z * 0.1, p.visibility));

/** Run lead-in + dropout through (optionally) PPC into a fresh body-input
 *  core, exactly like main.ts wires it. Returns ms from dropout start to
 *  the confidence crossing Flight's gate. */
function autopilotEngageMs(ppcEnabled: boolean): number {
  const ppc = new PoseContinuity();
  ppc.enabled = ppcEnabled;
  const core = createBodyInputCore();
  const LEAD = 90; // 3 s visible lead-in
  const DROP = 45; // 1.5 s full dropout
  let engagedAt: number | null = null;
  for (let i = 0; i < LEAD + DROP; i++) {
    const t = i * DT;
    const dropped = i >= LEAD;
    const w = dropped ? null : person();
    const n = dropped ? null : toNorm(w!);
    const cont = ppc.apply(w, n, t);
    const sig = core.push({ tsMs: t, world: cont?.world ?? null, norm: cont?.norm ?? null });
    if (dropped && engagedAt === null && sig.confidence < FLIGHT_MIN_CONFIDENCE) {
      engagedAt = t - LEAD * DT;
    }
  }
  expect(engagedAt).not.toBeNull(); // autopilot must always engage
  return engagedAt!;
}

test('flight contract: PPC shifts autopilot engagement ≤ +100 ms on full dropout', () => {
  const legacy = autopilotEngageMs(false);
  const withPpc = autopilotEngageMs(true);
  console.log(
    `flight contract: autopilot engage legacy ${legacy.toFixed(0)}ms, ` +
      `ppc ${withPpc.toFixed(0)}ms, shift ${(withPpc - legacy).toFixed(0)}ms (bound +100)`,
  );
  // sanity: legacy engages on the documented ~300 ms confidence decay
  expect(legacy).toBeGreaterThan(150);
  expect(legacy).toBeLessThan(500);
  // the contract: prediction may smooth the stream, but the game's
  // loss-of-tracking decision arrives on essentially the same schedule
  expect(withPpc - legacy).toBeLessThanOrEqual(100);
  // and PPC never DELAYS forever / never engages early enough to flap
  expect(withPpc).toBeGreaterThanOrEqual(legacy - DT);
});

test('flight contract: confidence never rises during a dropout, with or without PPC', () => {
  for (const ppcEnabled of [false, true]) {
    const ppc = new PoseContinuity();
    ppc.enabled = ppcEnabled;
    const core = createBodyInputCore();
    let prev = Infinity;
    for (let i = 0; i < 150; i++) {
      const t = i * DT;
      const dropped = i >= 90;
      const w = dropped ? null : person();
      const cont = ppc.apply(w, w ? toNorm(w) : null, t);
      const sig = core.push({ tsMs: t, world: cont?.world ?? null, norm: cont?.norm ?? null });
      if (dropped) {
        expect(sig.confidence).toBeLessThanOrEqual(prev + 1e-6);
        prev = sig.confidence;
      }
    }
    expect(prev).toBeLessThan(0.05); // fully decayed by 2 s
  }
});
