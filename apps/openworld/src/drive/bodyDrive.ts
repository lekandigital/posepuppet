// Synthetic body drivers for closed-loop specs/recordings: deterministic
// landmark frames pumped through a REAL createBodyInputCore in-page, then
// published on the REAL BroadcastChannel transport — so a driven run
// exercises the exact production chain each completed controller consumes
// (landmarks → axes/events → transport → controller → sim → camera). The
// walking graybox pattern, extended with per-mode motion scripts.
//
// No camera is requested in drive mode; timestamps are simulated
// (idx·33 ms) while the pump rides the wall clock at ~30 Hz.

import {
  createBodyInputCore, createBroadcastSink,
  type BodyInputFrame,
} from '@bodyarcade/body-input';

interface Point { x: number; y: number; z: number; visibility: number }
const lm = (x: number, y: number, z: number, visibility = 0.95): Point => ({ x, y, z, visibility });

const LM = {
  nose: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
} as const;

export interface FigureOpts {
  /** shoulder-line lean, degrees; + = user's own right */
  leanDeg?: number;
  /** forward(+)/back(−) lean, degrees */
  leanFwdDeg?: number;
  /** arms straight out (T) — flight arming / recenter source */
  armsOut?: boolean;
  /** both hands thrust toward the camera (boost/dive) */
  handsForward?: boolean;
  /** vertical wave phase for rowing-style pulls; wrists sweep fwd/back */
  strokePhase?: number | null;
  /** torso wave for dolphin kicks: chest/hip anti-phase bob */
  wavePhase?: number | null;
  /** marching-in-place phase (full L-R cycle = 2pi) — gait source */
  marchPhase?: number | null;
  seated?: boolean;
  crouch01?: number;
}

/** Standing figure in MediaPipe WORLD space (y down, +x = user's right). */
export function figureFrame(tsMs: number, o: FigureOpts = {}): BodyInputFrame {
  const world: Point[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  const crouchDrop = (o.crouch01 ?? 0) * 0.22;

  let sh: [number, number, number][] = [
    [0.18, -0.5 + crouchDrop, 0],
    [-0.18, -0.5 + crouchDrop, 0],
  ];
  let nose: [number, number, number] = [0, -0.65 + crouchDrop, -0.08];
  let hips: [number, number, number][] = [
    [0.1, 0, 0],
    [-0.1, 0, 0],
  ];

  if (o.wavePhase !== null && o.wavePhase !== undefined) {
    // dolphin torso wave: chest and hips bob in anti-phase (z toward camera)
    const a = Math.sin(o.wavePhase) * 0.09;
    sh = sh.map(([x, y, z]) => [x, y + a, z - a * 0.4]) as typeof sh;
    hips = hips.map(([x, y, z]) => [x, y - a, z + a * 0.4]) as typeof hips;
    nose = [nose[0], nose[1] + a, nose[2]];
  }
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
      p[0], p[1] * Math.cos(b), p[2] + p[1] * Math.sin(b),
    ];
    sh = sh.map(rot) as typeof sh;
    nose = rot(nose);
  }

  world[LM.leftShoulder] = lm(...sh[0]);
  world[LM.rightShoulder] = lm(...sh[1]);
  world[LM.nose] = lm(...nose);
  world[LM.leftHip] = lm(...hips[0]);
  world[LM.rightHip] = lm(...hips[1]);

  if (o.seated) {
    world[LM.leftKnee] = lm(0.1, 0.05, -0.4, 0.9);
    world[LM.rightKnee] = lm(-0.1, 0.05, -0.4, 0.9);
    world[LM.leftAnkle] = lm(0.1, 0.5, -0.4, 0.9);
    world[LM.rightAnkle] = lm(-0.1, 0.5, -0.4, 0.9);
  } else if (o.marchPhase !== null && o.marchPhase !== undefined) {
    // marching legs: rigid 0.45 m thigh rotating about the hip — the
    // exact geometry the gait detector was tuned on (walking graybox)
    const thigh = 0.45;
    const maxRad = (70 * Math.PI) / 180;
    const ph = o.marchPhase;
    const thetaUserLeft = Math.max(0, Math.sin(ph)) * maxRad;
    const thetaUserRight = Math.max(0, -Math.sin(ph)) * maxRad;
    world[LM.leftKnee] = lm(0.1, thigh * Math.cos(thetaUserRight), -thigh * Math.sin(thetaUserRight), 0.95);
    world[LM.rightKnee] = lm(-0.1, thigh * Math.cos(thetaUserLeft), -thigh * Math.sin(thetaUserLeft), 0.95);
    world[LM.leftAnkle] = lm(0.1, 0.9, 0, 0.95);
    world[LM.rightAnkle] = lm(-0.1, 0.9, 0, 0.95);
  } else {
    world[LM.leftKnee] = lm(0.1, 0.45 - crouchDrop, 0, 0.95);
    world[LM.rightKnee] = lm(-0.1, 0.45 - crouchDrop, 0, 0.95);
    world[LM.leftAnkle] = lm(0.1, 0.9, 0, 0.95);
    world[LM.rightAnkle] = lm(-0.1, 0.9, 0, 0.95);
  }

  const armLen = 0.5;
  const wristFor = (side: 1 | -1, s: Point): [number, number, number] => {
    if (o.strokePhase !== null && o.strokePhase !== undefined) {
      // rowing pull: wrists sweep from reach (fwd, z −0.45) to finish (z +0.2)
      const c = Math.cos(o.strokePhase);
      return [s.x + side * 0.05, s.y + 0.25, -0.125 - 0.325 * c];
    }
    if (o.handsForward) return [s.x + side * 0.05, s.y + 0.1, -armLen];
    if (o.armsOut) return [s.x + side * armLen, s.y, s.z];
    return [s.x + side * 0.02, s.y + armLen, s.z];
  };
  const ls = world[LM.leftShoulder];
  const rs = world[LM.rightShoulder];
  const lw = wristFor(1, ls);
  const rw = wristFor(-1, rs);
  world[LM.leftWrist] = lm(...lw);
  world[LM.rightWrist] = lm(...rw);
  world[LM.leftElbow] = lm((ls.x + lw[0]) / 2, (ls.y + lw[1]) / 2, (ls.z + lw[2]) / 2);
  world[LM.rightElbow] = lm((rs.x + rw[0]) / 2, (rs.y + rw[1]) / 2, (rs.z + rw[2]) / 2);

  const norm = world.map((pt) => ({
    x: 0.5 + pt.x * 0.25,
    y: 0.55 + pt.y * 0.25,
    z: pt.z * 0.25,
    visibility: pt.visibility,
  }));
  return { tsMs, world, norm };
}

export type ScriptFrame = (tSec: number) => FigureOpts | 'lost';

/** Drive scripts, per mode. Time is seconds after the 2 s neutral lead-in. */
export const SCRIPTS: Record<string, ScriptFrame> = {
  // flight lap (pilot-lean profile): speed up, L turn, cruise, R turn, slow
  flylap: (t) => {
    if (t < 4) return { leanFwdDeg: 8 };
    if (t < 11) return { leanDeg: -12, leanFwdDeg: 4 };
    if (t < 14) return {};
    if (t < 21) return { leanDeg: 12, leanFwdDeg: 4 };
    if (t < 24) return { leanFwdDeg: -6 };
    return {};
  },
  // flight with a mid-lap dropout (autopilot + reacquire)
  flyloss: (t) => {
    if (t < 4) return { leanFwdDeg: 8 };
    if (t >= 8 && t < 11) return 'lost';
    if (t < 16) return { leanDeg: -12 };
    return {};
  },
  // rowing circuit: steady strokes, then asymmetric-lean steering, rest
  rowcircuit: (t) => {
    const RATE = 0.75; // strokes/s
    if (t < 14) return { strokePhase: 2 * Math.PI * RATE * t, seated: false };
    if (t < 20) return { strokePhase: 2 * Math.PI * RATE * t, leanDeg: -10 };
    if (t < 26) return { strokePhase: 2 * Math.PI * RATE * t, leanDeg: 10 };
    if (t < 31) return {}; // rest — cruise should hold
    return { strokePhase: 2 * Math.PI * RATE * t };
  },
  // walking route: march, lean-turn left, march, lean-turn right, stop
  walkroute: (t) => {
    const M = 2 * Math.PI * 0.9;
    if (t < 8) return { marchPhase: M * t };
    if (t < 14) return { marchPhase: M * t, leanDeg: -10 };
    if (t < 20) return { marchPhase: M * t };
    if (t < 26) return { marchPhase: M * t, leanDeg: 10 };
    if (t < 30) return {}; // stop marching -> walk eases to a stop
    return { marchPhase: M * t };
  },
  // walking with a dropout mid-march
  walkloss: (t) => {
    const M = 2 * Math.PI * 0.9;
    if (t >= 8 && t < 11) return 'lost';
    return { marchPhase: M * t };
  },
  // dolphin: kick waves, dive lean, surface lean, roll turns
  swim: (t) => {
    const W = 2 * Math.PI * 0.75;
    if (t < 8) return { wavePhase: W * t };
    if (t < 13) return { wavePhase: W * t, leanFwdDeg: 14 };
    if (t < 18) return { wavePhase: W * t, leanFwdDeg: -12 };
    if (t < 24) return { wavePhase: W * t, leanDeg: -12 };
    return { wavePhase: W * t };
  },
};

const STEP = 33;
const LEAD_IN_S = 2;

/** Pump a script through the production chain onto the broadcast channel.
 *  Returns a stop function. */
export function startBodyDrive(script: ScriptFrame, opts: { lossAt?: [number, number] } = {}): () => void {
  const core = createBodyInputCore();
  const sink = createBroadcastSink();
  let idx = 0;
  let running = true;
  let lastPump = performance.now();

  function frameAt(i: number): BodyInputFrame {
    const tsMs = i * STEP;
    const t = tsMs / 1000;
    if (opts.lossAt && t >= opts.lossAt[0] && t < opts.lossAt[0] + opts.lossAt[1]) {
      return { tsMs, world: null, norm: null };
    }
    if (t < LEAD_IN_S) return figureFrame(tsMs, {});
    const o = script(t - LEAD_IN_S);
    if (o === 'lost') return { tsMs, world: null, norm: null };
    return figureFrame(tsMs, o);
  }

  function pump(): void {
    if (!running) return;
    const now = performance.now();
    let budget = Math.min(Math.round((now - lastPump) / STEP), 8);
    lastPump += budget * STEP;
    while (budget-- > 0) {
      sink.publish(core.push(frameAt(idx++)));
    }
    requestAnimationFrame(pump);
  }
  requestAnimationFrame(pump);

  return () => {
    running = false;
    sink.close();
  };
}
