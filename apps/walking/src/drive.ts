// Synthetic drivers — deterministic BodyInputFrame generators pumped
// through a real createBodyInputCore IN the page, so a driven graybox run
// exercises the exact production chain: landmarks → gait detection →
// BodySignal → controller → locomotion → camera. Frame timestamps are
// simulated (idx·33 ms) — the body-input core stays on its deterministic
// clock; only the pump rate rides the wall clock.
//
// Scenarios (query params):
//   ?drive=march&hz=0.9          march-in-place, full L-R cycle at hz
//   ?drive=sway&hz=0.55          weight-shift, legs out of frame
//   ?drive=glide                 seated, constant forward lean
//   &lean=8                      constant lean (degrees, + = right turn)
//   &loss=8,3                    dropout: at t=8 s, 3 s of null frames
//   &tpose=12                    hold a T-pose for 1.5 s at t=12 s

import {
  createBodyInputCore, type BodyInputFrame, type LandmarkPoint,
} from '@bodyarcade/body-input';
import type { WalkController } from '@bodyarcade/locomotion';

// landmark indices the generator needs (BlazePose 33)
const LM = {
  nose: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
} as const;

interface FrameOpts {
  marchPhase?: number;
  swayM?: number;
  leanDeg?: number;
  leanFwdDeg?: number;
  seated?: boolean;
  tpose?: boolean;
  legsVis?: number;
}

function lm(x: number, y: number, z: number, visibility = 0.95): LandmarkPoint {
  return { x, y, z, visibility };
}

/** Synthetic person in MediaPipe WORLD space (y down), mirrored convention
 *  (+x = the user's own right) — the same geometry as the gait unit tests. */
function walkFrame(tsMs: number, o: FrameOpts = {}): BodyInputFrame {
  const world: LandmarkPoint[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  const legsVis = o.legsVis ?? 0.95;
  const sway = o.swayM ?? 0;

  let sh: [number, number, number][] = [
    [0.18, -0.5, 0],
    [-0.18, -0.5, 0],
  ];
  let nose: [number, number, number] = [0, -0.65, -0.08];
  if (o.leanDeg) {
    const a = (o.leanDeg * Math.PI) / 180;
    const rot = (p: [number, number, number]): [number, number, number] => [
      p[0] * Math.cos(a) - p[1] * Math.sin(a),
      p[0] * Math.sin(a) + p[1] * Math.cos(a),
      p[2],
    ];
    sh = sh.map(rot) as typeof sh;
    nose = rot(nose);
  }
  if (o.leanFwdDeg) {
    const b = (o.leanFwdDeg * Math.PI) / 180;
    const rot = (p: [number, number, number]): [number, number, number] => [
      p[0],
      p[1] * Math.cos(b),
      p[2] + p[1] * Math.sin(b),
    ];
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
    // rigid thigh, 0.45 m — march rotates it about the hip
    const thigh = 0.45;
    const maxRad = (70 * Math.PI) / 180;
    const p = o.marchPhase ?? 0;
    const thetaUserLeft = Math.max(0, Math.sin(p)) * maxRad;
    const thetaUserRight = Math.max(0, -Math.sin(p)) * maxRad;
    world[LM.leftKnee] = lm(
      0.1 + sway, thigh * Math.cos(thetaUserRight), -thigh * Math.sin(thetaUserRight), legsVis,
    );
    world[LM.rightKnee] = lm(
      -0.1 + sway, thigh * Math.cos(thetaUserLeft), -thigh * Math.sin(thetaUserLeft), legsVis,
    );
    world[LM.leftAnkle] = lm(0.1 + sway, 0.9, 0, legsVis);
    world[LM.rightAnkle] = lm(-0.1 + sway, 0.9, 0, legsVis);
  }

  const armLen = 0.5;
  const wrist = (side: 1 | -1): [number, number, number] => {
    const s = side === 1 ? world[LM.leftShoulder] : world[LM.rightShoulder];
    if (o.tpose) return [s.x + side * armLen, s.y, s.z];
    return [s.x + side * 0.02, s.y + armLen, s.z];
  };
  const lw = wrist(1);
  const rw = wrist(-1);
  world[LM.leftWrist] = lm(lw[0], lw[1], lw[2]);
  world[LM.rightWrist] = lm(rw[0], rw[1], rw[2]);
  world[LM.leftElbow] = lm((world[LM.leftShoulder].x + lw[0]) / 2, (world[LM.leftShoulder].y + lw[1]) / 2, 0);
  world[LM.rightElbow] = lm((world[LM.rightShoulder].x + rw[0]) / 2, (world[LM.rightShoulder].y + rw[1]) / 2, 0);

  const norm = world.map((pt) => ({
    x: 0.5 + pt.x * 0.25,
    y: 0.55 + pt.y * 0.25,
    z: pt.z * 0.25,
    visibility: pt.visibility,
  }));
  return { tsMs, world, norm };
}

export interface DriveSpec {
  kind: 'march' | 'sway' | 'glide';
  hz: number;
  leanDeg: number;
  /** [startSec, durSec] dropout window */
  loss: [number, number] | null;
  /** T-pose hold start (1.5 s), seconds */
  tposeAt: number | null;
}

export function parseDrive(params: URLSearchParams): DriveSpec | null {
  const kind = params.get('drive');
  if (kind !== 'march' && kind !== 'sway' && kind !== 'glide') return null;
  const loss = params.get('loss');
  const tpose = params.get('tpose');
  return {
    kind,
    hz: Number(params.get('hz') ?? (kind === 'sway' ? 0.55 : 0.9)),
    leanDeg: Number(params.get('lean') ?? 0),
    loss: loss ? (loss.split(',').map(Number).slice(0, 2) as [number, number]) : null,
    tposeAt: tpose ? Number(tpose) : null,
  };
}

const STEP = 33; // ms of simulated time per generated frame (~30 Hz)
const LEAD_IN_S = 2; // still, for the provisional neutral capture

/** Starts the pump; returns a stop function. */
export function startDrive(spec: DriveSpec, controller: WalkController): () => void {
  const core = createBodyInputCore();
  let idx = 0;
  let running = true;
  let lastPump = performance.now();

  function frameAt(idx: number): BodyInputFrame {
    const tsMs = idx * STEP;
    const t = tsMs / 1000;
    if (spec.loss && t >= spec.loss[0] && t < spec.loss[0] + spec.loss[1]) {
      return { tsMs, world: null, norm: null };
    }
    if (spec.tposeAt !== null && t >= spec.tposeAt && t < spec.tposeAt + 1.5) {
      return walkFrame(tsMs, { tpose: true });
    }
    if (t < LEAD_IN_S) {
      return walkFrame(tsMs, spec.kind === 'glide' ? { seated: true } : {});
    }
    const tt = t - LEAD_IN_S;
    switch (spec.kind) {
      case 'march':
        return walkFrame(tsMs, {
          marchPhase: 2 * Math.PI * spec.hz * tt,
          leanDeg: spec.leanDeg,
        });
      case 'sway':
        return walkFrame(tsMs, {
          legsVis: 0.2,
          swayM: 0.08 * Math.sin(2 * Math.PI * spec.hz * tt),
          leanDeg: spec.leanDeg,
        });
      case 'glide':
        return walkFrame(tsMs, { seated: true, leanFwdDeg: 9, leanDeg: spec.leanDeg });
    }
  }

  function pump(): void {
    if (!running) return;
    const now = performance.now();
    // generate as many simulated frames as real time asks for (~30 Hz)
    let budget = Math.min(Math.round((now - lastPump) / STEP), 8);
    lastPump += budget * STEP;
    while (budget-- > 0) {
      const signal = core.push(frameAt(idx++));
      controller.inject(signal, now);
    }
    requestAnimationFrame(pump);
  }
  requestAnimationFrame(pump);

  return () => {
    running = false;
  };
}
