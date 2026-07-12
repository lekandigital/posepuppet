// PREDICTIVE POSE CONTINUITY (PPC): graceful short-term prediction when
// landmarks disappear. Visible stream → per-landmark ring buffer →
// regression velocity → brief constrained prediction (≤ horizon) →
// confidence decay → smooth re-entry. Sits at the single fork in main.ts
// so puppeteering AND body-input inherit it.
//
// This is explicitly NOT invisible-limb tracking: the horizon is hard-capped
// (400 ms limbs / 150 ms torso+head), output visibility decays every frame a
// limb is predicted, and downstream consumers see that decayed confidence —
// games decide their own autopilot; this layer never fakes certainty.
//
// Deterministic by construction: state advances only on the frame timestamps
// passed in — no wall clocks, no randomness. Landmarks above the visibility
// gate pass through EXACTLY (same values), so fully-visible behavior is
// structurally unchanged.

import { LM } from './indices';
import type { LandmarkPoint } from './types';

/** All PPC constants in one table (Gate-1 approved values). */
export const PPC = {
  /** hard prediction cap for arm/leg groups (ms) */
  horizonLimbMs: 400,
  /** torso + head predict shorter: if the core is gone, the person is gone —
   *  and Flight's autopilot must engage on the legacy schedule (the
   *  contract test measures the shift; 150/100 measures +67 ms) */
  horizonCoreMs: 150,
  /** visibility hysteresis, matching the retargeter's gates */
  visOn: 0.55,
  visOff: 0.45,
  /** samples below this never enter the ring buffer */
  visPush: 0.5,
  /** velocity regression: window size and max sample age at prediction entry */
  velWindow: 5,
  velMaxAgeMs: 280,
  /** exponential damping of the coasted velocity (ms). Short on purpose:
   *  human gestures reverse on ~300–400 ms periods, so ballistics are only
   *  trustworthy for the first ~150 ms (fast_dropout masked eval) */
  dampTauMs: 140,
  /** velocity trust noise floor (m): regression residuals below this never
   *  reduce trust — measured MediaPipe world jitter is ~5–10 mm */
  velTrustNoiseM: 0.015,
  /** speed knee (m/s): trust = 1/(1+(speed/knee)^4). Gestures much above
   *  ~1.3 m/s (strikes, fast swings) reverse within the horizon —
   *  extrapolating them measurably loses to holding (fast_dropout eval);
   *  deliberate motion below ~1 m/s extrapolates well */
  velTrustSpeedKnee: 1.3,
  /** hard drift cap: prediction never strays further than this from the
   *  last-seen (parent-anchored) position — the "never flies away" bound */
  maxDriftM: 0.3,
  maxDriftNorm: 0.25,
  /** rest-pose bias: weight grows with age² to this max at the horizon */
  restBiasMax: 0.3,
  restTauMs: 700,
  /** bone-length projection tolerance around the learned segment length */
  segTolerance: 0.1,
  segTauMs: 1000,
  /** predicted speed caps (world m/s, norm units/s) */
  maxPredSpeed: 2.5,
  maxPredSpeedNorm: 1.2,
  /** entry-pull: with age, the prediction retracts toward the last-seen
   *  position (anchored to its parent, so it rides torso translation) —
   *  reversals make flying-away worse than holding; last-seen is the honest
   *  uncertainty center. Time constant + age exponent. */
  entryPullTauMs: 250,
  entryPullExp: 1.5,
  /** re-entry blend: 0.8 × outage, clamped [100, 400] ms */
  reentryScale: 0.8,
  reentryMinMs: 100,
  reentryMaxMs: 400,
  /** max correction per pose frame during re-entry (no-snap guarantee) */
  maxCorrWorld: 0.06,
  maxCorrNorm: 0.04,
  /** confidence decay: linear vis×1.0 → vis×this across the horizon … */
  visFloorAtHorizon: 0.35,
  /** … then → 0 over this long in RELAXED */
  relaxVisMsLimb: 250,
  relaxVisMsCore: 100,
  /** neighbor-agreement multiplier floor */
  agreementFloor: 0.6,
  /** low-trust prediction decays confidence faster: effective horizon =
   *  horizon × (floor + (1−floor)·trust). A prediction that is basically
   *  "hold" carries no information the bone-level hold doesn't — it must
   *  hand the puppet back to the gate-approved hold quickly (measured:
   *  driving bones with hold-quality predictions made masked leg/fast sync
   *  WORSE than legacy; high-trust arm exits made it better) */
  trustHorizonFloor: 0.35,
  /** chain plausibility: a measured child whose distance to its measured
   *  parent leaves [lo, hi] × learned length is DETECTOR GARBAGE — segment
   *  lengths are physically constant. Traced on fast.mp4: behind-torso
   *  punches collapse the forearm to 0.2–0.6× median at vis 0.5–0.99 while
   *  real fast swings stay within 0.7–1.25×. Implausible samples are held
   *  instead of passed through, emitted at ≤ this vis, and never buffered. */
  chainGateLo: 0.55,
  chainGateHi: 1.55,
  implausibleVis: 0.4,
  /** velocity capture requires this fresh a run of buffered samples —
   *  gate flapping leaves sparse/stale buffers that must read as unknown */
  velFreshRunMs: 170,
  /** in-group pass-through catch-up cap (× maxCorrWorld per frame): a
   *  still-measured member of a lost group re-approaches measurement in
   *  bounded steps instead of teleporting. 1 = the same no-snap bound as
   *  re-entry — the old raw copy was an invisible first-frame snap. */
  regainStepScale: 1,
} as const;

export type PpcState = 'VISIBLE' | 'PREDICTED' | 'RELAXED';

export type PpcGroupName = 'torso' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

export interface PpcGroupInfo {
  name: PpcGroupName;
  state: PpcState;
  /** ms since tracking was lost (0 when VISIBLE) */
  ageMs: number;
  /** current output confidence for the group's gate landmarks, 0..1 */
  confidence: number;
  /** true while re-entry blending is still running */
  blending: boolean;
}

interface GroupSpec {
  name: PpcGroupName;
  /** landmarks the group owns (predicted when the group is lost) */
  members: number[];
  /** visibility gate = min over these */
  gate: number[];
  /** child ← parent projection pairs, parents processed first */
  chain: Array<[number, number]>;
  core: boolean;
  /** measured predictive value of this group's confidence: scales the
   *  effective decay horizon. Legs are 0.25 — stride swings reverse inside
   *  the horizon, and the masked eval showed leg prediction ≈ hold in
   *  position while driving leg bones with it made puppet sync WORSE than
   *  the bone-level hold; positions still flow (body-input crouch/stature
   *  continuity) but the puppet hands legs back to hold almost at once. */
  visTrust: number;
  /** rigid groups (torso, head) predict as ONE translating body: a single
   *  group velocity moves the shape captured at loss — per-landmark
   *  prediction let the quad shear, and the retargeter read that shear as
   *  the torso bending/spinning (Gate-2 live finding). Rotation continuity
   *  stays where it always lived: the bone layer's clamped coast. */
  rigid?: boolean;
  /** pairs with physically constant distance, used only for plausibility
   *  (both members' vis capped when the pair's learned length breaks) */
  plausPairs?: Array<[number, number]>;
}

// Group layout mirrors how the retargeter consumes landmarks: torso first
// (arms/legs project off it), then head, then the four limb chains.
const GROUPS: GroupSpec[] = [
  {
    name: 'torso',
    members: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    gate: [LM.leftShoulder, LM.rightShoulder],
    chain: [],
    core: true,
    visTrust: 1,
    rigid: true,
    plausPairs: [
      [LM.leftShoulder, LM.rightShoulder],
      [LM.leftHip, LM.rightHip],
    ],
  },
  {
    name: 'head',
    members: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    gate: [LM.nose],
    chain: [],
    core: true,
    visTrust: 1,
    rigid: true,
    plausPairs: [[LM.leftEar, LM.rightEar]],
  },
  {
    name: 'leftArm',
    members: [LM.leftElbow, LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb],
    gate: [LM.leftElbow, LM.leftWrist],
    chain: [
      [LM.leftElbow, LM.leftShoulder],
      [LM.leftWrist, LM.leftElbow],
      [LM.leftPinky, LM.leftWrist],
      [LM.leftIndex, LM.leftWrist],
      [LM.leftThumb, LM.leftWrist],
    ],
    core: false,
    visTrust: 1,
  },
  {
    name: 'rightArm',
    members: [LM.rightElbow, LM.rightWrist, LM.rightPinky, LM.rightIndex, LM.rightThumb],
    gate: [LM.rightElbow, LM.rightWrist],
    chain: [
      [LM.rightElbow, LM.rightShoulder],
      [LM.rightWrist, LM.rightElbow],
      [LM.rightPinky, LM.rightWrist],
      [LM.rightIndex, LM.rightWrist],
      [LM.rightThumb, LM.rightWrist],
    ],
    core: false,
    visTrust: 1,
  },
  {
    name: 'leftLeg',
    members: [LM.leftKnee, LM.leftAnkle, LM.leftHeel, LM.leftFootIndex],
    gate: [LM.leftKnee, LM.leftAnkle],
    chain: [
      [LM.leftKnee, LM.leftHip],
      [LM.leftAnkle, LM.leftKnee],
      [LM.leftHeel, LM.leftAnkle],
      [LM.leftFootIndex, LM.leftAnkle],
    ],
    core: false,
    visTrust: 0.25,
  },
  {
    name: 'rightLeg',
    members: [LM.rightKnee, LM.rightAnkle, LM.rightHeel, LM.rightFootIndex],
    gate: [LM.rightKnee, LM.rightAnkle],
    chain: [
      [LM.rightKnee, LM.rightHip],
      [LM.rightAnkle, LM.rightKnee],
      [LM.rightHeel, LM.rightAnkle],
      [LM.rightFootIndex, LM.rightAnkle],
    ],
    core: false,
    visTrust: 0.25,
  },
];

/** Group → member landmark indices (shared with the eval mask harness). */
export const PPC_GROUP_MEMBERS: Record<PpcGroupName, number[]> = Object.fromEntries(
  GROUPS.map((g) => [g.name, g.members]),
) as Record<PpcGroupName, number[]>;

/** landmark index → owning group name (null = unowned). */
export const PPC_GROUP_OF: (PpcGroupName | null)[] = (() => {
  const out: (PpcGroupName | null)[] = Array.from({ length: 33 }, () => null);
  for (const g of GROUPS) for (const m of g.members) out[m] = g.name;
  return out;
})();

const RING = 16;
const N = 33;

/** Per-landmark ring buffer of measured samples (world + norm + vis + t). */
class Track {
  t = new Float64Array(RING);
  wx = new Float64Array(RING);
  wy = new Float64Array(RING);
  wz = new Float64Array(RING);
  nx = new Float64Array(RING);
  ny = new Float64Array(RING);
  nz = new Float64Array(RING);
  v = new Float64Array(RING);
  count = 0;
  private head = 0; // next write slot

  push(tMs: number, w: LandmarkPoint, n: LandmarkPoint): void {
    const i = this.head;
    this.t[i] = tMs;
    this.wx[i] = w.x;
    this.wy[i] = w.y;
    this.wz[i] = w.z;
    this.nx[i] = n.x;
    this.ny[i] = n.y;
    this.nz[i] = n.z;
    this.v[i] = w.visibility;
    this.head = (i + 1) % RING;
    if (this.count < RING) this.count++;
  }

  /** index of the k-th newest sample (k = 0 is the latest) */
  private idx(k: number): number {
    return (this.head - 1 - k + RING * 2) % RING;
  }

  latestT(): number {
    return this.count ? this.t[this.idx(0)] : -Infinity;
  }
  latestVis(): number {
    return this.count ? this.v[this.idx(0)] : 0;
  }

  /** Copy the newest well-measured sample into the output landmarks.
   *  Returns false when the buffer is empty. */
  latestInto(w: LandmarkPoint, n: LandmarkPoint): boolean {
    if (!this.count) return false;
    const i = this.idx(0);
    w.x = this.wx[i];
    w.y = this.wy[i];
    w.z = this.wz[i];
    n.x = this.nx[i];
    n.y = this.ny[i];
    n.z = this.nz[i];
    return true;
  }

  /** Least-squares velocity over the newest `win` samples no older than
   *  maxAgeMs before `nowMs`. Writes [vx,vy,vz] world + norm into out;
   *  returns false (zero velocity) when the history is too thin or stale.
   *
   *  Velocity trust: the fit's own residual scales the result. Oscillating
   *  motion (a punch reversing inside the window) fits a line badly —
   *  extrapolating it full-speed overshoots worse than holding still, which
   *  the fast_dropout masked eval measured. Linear motion keeps ~full
   *  velocity; jerky motion coasts at a fraction. Deterministic, no ML. */
  velocity(nowMs: number, out: Float64Array): number {
    out.fill(0);
    const win = Math.min(PPC.velWindow, this.count);
    if (win < 3) return 0;
    if (nowMs - this.latestT() > PPC.velMaxAgeMs) return 0;
    // freshness: the newest 3 samples must be a continuous recent run —
    // gate flapping leaves sparse buffers whose "velocity" is fiction
    if (this.t[this.idx(0)] - this.t[this.idx(2)] > PPC.velFreshRunMs) return 0;
    // means
    let mt = 0;
    const mean = [0, 0, 0];
    for (let k = 0; k < win; k++) {
      const i = this.idx(k);
      mt += this.t[i];
      mean[0] += this.wx[i];
      mean[1] += this.wy[i];
      mean[2] += this.wz[i];
    }
    mt /= win;
    for (let j = 0; j < 3; j++) mean[j] /= win;
    let den = 0;
    const num = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < win; k++) {
      const i = this.idx(k);
      const dt = (this.t[i] - mt) / 1000;
      den += dt * dt;
      num[0] += dt * this.wx[i];
      num[1] += dt * this.wy[i];
      num[2] += dt * this.wz[i];
      num[3] += dt * this.nx[i];
      num[4] += dt * this.ny[i];
      num[5] += dt * this.nz[i];
    }
    if (den < 1e-9) return 0;
    for (let j = 0; j < 6; j++) out[j] = num[j] / den;

    // residual RMS of the world fit vs the characteristic displacement the
    // fitted velocity claims across half the window
    let se = 0;
    for (let k = 0; k < win; k++) {
      const i = this.idx(k);
      const dt = (this.t[i] - mt) / 1000;
      const ex = this.wx[i] - (mean[0] + out[0] * dt);
      const ey = this.wy[i] - (mean[1] + out[1] * dt);
      const ez = this.wz[i] - (mean[2] + out[2] * dt);
      se += ex * ex + ey * ey + ez * ez;
    }
    const rms = Math.sqrt(se / win);
    const speed = Math.hypot(out[0], out[1], out[2]);
    const halfSpan = (this.latestT() - this.t[this.idx(win - 1)]) / 2000;
    const scale = 0.5 * speed * halfSpan + PPC.velTrustNoiseM;
    let trust = Math.min(Math.max(1 - rms / scale, 0), 1);

    // deceleration factor: recent (last-3-sample) velocity projected onto
    // the window velocity. A limb that is already slowing or reversing at
    // loss must not be extrapolated at window speed — punches reverse, and
    // flying on is worse than holding (fast_dropout masked eval).
    if (win >= 5 && speed > 1e-3) {
      const i0 = this.idx(0);
      const i2 = this.idx(2);
      const dtR = (this.t[i0] - this.t[i2]) / 1000;
      if (dtR > 1e-3) {
        const rx = (this.wx[i0] - this.wx[i2]) / dtR;
        const ry = (this.wy[i0] - this.wy[i2]) / dtR;
        const rz = (this.wz[i0] - this.wz[i2]) / dtR;
        const dot = (rx * out[0] + ry * out[1] + rz * out[2]) / (speed * speed);
        trust *= Math.min(Math.max(dot, 0), 1);
      }
    }
    // speed knee: the faster the motion, the shorter its trustworthy future
    const k = speed / PPC.velTrustSpeedKnee;
    trust *= 1 / (1 + k * k * k * k);
    for (let j = 0; j < 6; j++) out[j] *= trust;

    // speed caps: prediction never exceeds a plausible gesture speed
    capLen3(out, 0, PPC.maxPredSpeed);
    capLen3(out, 3, PPC.maxPredSpeedNorm);
    return trust;
  }
}

function capLen3(a: Float64Array, off: number, max: number): void {
  const l = Math.hypot(a[off], a[off + 1], a[off + 2]);
  if (l > max) {
    const s = max / l;
    a[off] *= s;
    a[off + 1] *= s;
    a[off + 2] *= s;
  }
}

const smoothstep = (t: number): number => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

interface GroupState {
  spec: GroupSpec;
  state: PpcState;
  /** EMA'd gate visibility (same 0.7/0.3 blend the smoother uses) */
  visSmooth: number;
  /** hysteresis output */
  gateOpen: boolean;
  ageMs: number; // since loss (PREDICTED entry)
  outageMs: number; // total lost time, for the re-entry duration
  reentryMs: number;
  reentryDurMs: number;
  blending: boolean;
  /** worst member distance to measured after the last blend step — the blend
   *  only ends once this fits inside one capped step (no snap at hand-off) */
  blendErr: number;
  horizonMs: number;
  relaxVisMs: number;
  /** rigid groups: one shared translation (world xyz + norm xyz) applied to
   *  the shape captured at loss, and its damped velocity */
  offset: Float64Array;
  groupVel: Float64Array;
}

interface LmState {
  /** velocities captured at prediction entry: wx,wy,wz,nx,ny,nz */
  vel: Float64Array;
  /** confidence at loss (last emitted visibility) */
  visEnter: number;
  /** velocity trust at loss — scales how long confidence stays useful */
  trust: number;
  /** neighbor-agreement multiplier, updated by the chain projection */
  agreement: number;
  /** held output at re-entry start (world + norm), for the blend */
  hold: Float64Array; // wx,wy,wz,nx,ny,nz,vis
  /** last-seen offset from the parent (world + norm) at prediction entry;
   *  parentless landmarks store the absolute position */
  entry: Float64Array; // wx,wy,wz,nx,ny,nz
}

export class PoseContinuity {
  enabled = true;

  private tracks: Track[] = [];
  private groups: GroupState[] = [];
  private lm: LmState[] = [];
  /** learned segment lengths, indexed child*33+parent */
  private segLen = new Map<number, number>();
  /** which group owns each landmark (null = never predicted, passes through) */
  private owner: (GroupState | null)[] = [];
  private outWorld: LandmarkPoint[] = [];
  private outNorm: LandmarkPoint[] = [];
  private prevMs: number | null = null;
  private info: PpcGroupInfo[] = [];

  constructor() {
    for (let i = 0; i < N; i++) {
      this.tracks.push(new Track());
      this.lm.push({
        vel: new Float64Array(6),
        visEnter: 0,
        trust: 0,
        agreement: 1,
        hold: new Float64Array(7),
        entry: new Float64Array(6),
      });
      this.outWorld.push({ x: 0, y: 0, z: 0, visibility: 0 });
      this.outNorm.push({ x: 0, y: 0, z: 0, visibility: 0 });
      this.owner.push(null);
    }
    for (const spec of GROUPS) {
      const g: GroupState = {
        spec,
        state: 'VISIBLE',
        visSmooth: 0,
        gateOpen: false,
        ageMs: 0,
        outageMs: 0,
        reentryMs: Infinity,
        reentryDurMs: 0,
        blending: false,
        blendErr: 0,
        horizonMs: spec.core ? PPC.horizonCoreMs : PPC.horizonLimbMs,
        relaxVisMs: spec.core ? PPC.relaxVisMsCore : PPC.relaxVisMsLimb,
        offset: new Float64Array(6),
        groupVel: new Float64Array(6),
      };
      this.groups.push(g);
      for (const m of spec.members) this.owner[m] = g;
      this.info.push({ name: spec.name, state: 'VISIBLE', ageMs: 0, confidence: 0, blending: false });
    }
  }

  reset(): void {
    for (const t of this.tracks) t.count = 0;
    for (const g of this.groups) {
      g.state = 'VISIBLE';
      g.visSmooth = 0;
      g.gateOpen = false;
      g.ageMs = 0;
      g.outageMs = 0;
      g.reentryMs = Infinity;
      g.blending = false;
    }
    this.segLen.clear();
    this.prevMs = null;
  }

  /** Per-limb state for the engineering view and eval. Reused array. */
  states(): readonly PpcGroupInfo[] {
    for (let i = 0; i < this.groups.length; i++) {
      const g = this.groups[i];
      const o = this.info[i];
      o.state = g.state;
      o.ageMs = Math.round(g.ageMs);
      o.blending = g.blending;
      let c = 0;
      for (const m of g.spec.gate) c += this.outWorld[m].visibility;
      o.confidence = Math.round((c / g.spec.gate.length) * 100) / 100;
    }
    return this.info;
  }

  /**
   * Process one pose frame (mirrored landmarks, or null on dropout).
   * Returns continuity-processed streams, a synthesized frame during a brief
   * full dropout, or null once every group has faded out. Output arrays are
   * reused across calls.
   */
  apply(
    world: LandmarkPoint[] | null,
    norm: LandmarkPoint[] | null,
    frameMs: number,
  ): { world: LandmarkPoint[]; norm: LandmarkPoint[] } | null {
    if (!this.enabled) {
      if (!world || !norm) return null;
      return { world, norm };
    }
    const dtMs = this.prevMs === null ? 33.3 : Math.min(Math.max(frameMs - this.prevMs, 1), 100);
    this.prevMs = frameMs;
    const dt = dtMs / 1000;
    const present = world !== null && norm !== null && world.length >= N;

    // ---- group gates: EMA'd min visibility + hysteresis --------------------
    for (const g of this.groups) {
      let vis = 0;
      if (present) {
        vis = 1;
        for (const m of g.spec.gate) vis = Math.min(vis, world![m].visibility);
      }
      g.visSmooth = g.visSmooth * 0.7 + vis * 0.3;
      g.gateOpen = g.gateOpen ? g.visSmooth > PPC.visOff : g.visSmooth > PPC.visOn;
    }

    // ---- state transitions --------------------------------------------------
    for (const g of this.groups) {
      if (g.state === 'VISIBLE') {
        if (!g.gateOpen) {
          // tracking lost: capture per-landmark velocities from the buffers
          g.state = 'PREDICTED';
          g.ageMs = 0;
          g.blending = false;
          g.offset.fill(0);
          g.groupVel.fill(0);
          let velN = 0;
          for (const m of g.spec.members) {
            const s = this.lm[m];
            const track = this.tracks[m];
            s.trust = track.velocity(frameMs, s.vel);
            const ow = this.outWorld[m];
            const on = this.outNorm[m];
            // re-anchor on the last WELL-MEASURED sample: during the 2–3
            // frame gate-hysteresis lag the pass-through already emitted
            // low-visibility garbage positions (MediaPipe hallucinates
            // during occlusion) — predicting from those anchors the whole
            // outage to junk. The ring buffer only ever holds vis ≥ 0.5.
            const gapMs = frameMs - track.latestT();
            if (gapMs <= PPC.velMaxAgeMs && track.latestInto(ow, on)) {
              s.visEnter = track.latestVis();
              if (!g.spec.rigid) {
                // dead-reckon the hysteresis gap: the buffered sample is 2–3
                // frames old; advance it on the trusted velocity so prediction
                // starts where the limb plausibly IS, not where it last was
                const gap = gapMs / 1000;
                ow.x += s.vel[0] * gap;
                ow.y += s.vel[1] * gap;
                ow.z += s.vel[2] * gap;
                on.x += s.vel[3] * gap;
                on.y += s.vel[4] * gap;
                on.z += s.vel[5] * gap;
              }
            } else {
              s.visEnter = ow.visibility;
            }
            if (g.spec.rigid && s.trust > 0) {
              for (let j = 0; j < 6; j++) g.groupVel[j] += s.vel[j];
              velN++;
            }
            s.agreement = 1;
            // last-seen anchor: offset from the parent (which usually stays
            // measured), or absolute for parentless landmarks
            const parent = this.parentOf(g, m);
            if (parent >= 0) {
              const pw = this.outWorld[parent];
              const pn = this.outNorm[parent];
              s.entry[0] = ow.x - pw.x; s.entry[1] = ow.y - pw.y; s.entry[2] = ow.z - pw.z;
              s.entry[3] = on.x - pn.x; s.entry[4] = on.y - pn.y; s.entry[5] = on.z - pn.z;
            } else {
              s.entry[0] = ow.x; s.entry[1] = ow.y; s.entry[2] = ow.z;
              s.entry[3] = on.x; s.entry[4] = on.y; s.entry[5] = on.z;
            }
          }
          if (g.spec.rigid && velN > 0) {
            for (let j = 0; j < 6; j++) g.groupVel[j] /= velN;
            capLen3(g.groupVel, 0, PPC.maxPredSpeed);
            capLen3(g.groupVel, 3, PPC.maxPredSpeedNorm);
          }
        } else if (g.blending) {
          g.reentryMs += dtMs;
          // ends on time AND convergence: if the capped steps haven't caught
          // up to measured yet (long outage, big displacement), keep stepping
          if (g.reentryMs >= g.reentryDurMs && g.blendErr <= PPC.maxCorrWorld) {
            g.blending = false;
          }
        }
      } else {
        g.ageMs += dtMs;
        g.outageMs += dtMs;
        if (g.gateOpen) {
          // re-acquired: blend measured data back in, never snap
          g.state = 'VISIBLE';
          g.blending = true;
          g.blendErr = Infinity;
          g.reentryMs = 0;
          g.reentryDurMs = Math.min(
            Math.max(PPC.reentryScale * g.outageMs, PPC.reentryMinMs),
            PPC.reentryMaxMs,
          );
          g.ageMs = 0;
          g.outageMs = 0;
          for (const m of g.spec.members) {
            const s = this.lm[m];
            const ow = this.outWorld[m];
            const on = this.outNorm[m];
            s.hold[0] = ow.x; s.hold[1] = ow.y; s.hold[2] = ow.z;
            s.hold[3] = on.x; s.hold[4] = on.y; s.hold[5] = on.z;
            s.hold[6] = ow.visibility;
          }
        } else if (g.state === 'PREDICTED' && g.ageMs > g.horizonMs) {
          g.state = 'RELAXED'; // horizon cap: prediction never exceeds it
        }
      }
    }

    // ---- rigid group offsets: one shared translation per frame -------------
    for (const g of this.groups) {
      if (!g.spec.rigid || g.state !== 'PREDICTED') continue;
      const damp = Math.exp(-dtMs / PPC.dampTauMs);
      for (let j = 0; j < 6; j++) g.groupVel[j] *= damp;
      for (let j = 0; j < 6; j++) g.offset[j] += g.groupVel[j] * dt;
      // entry-pull: the shared offset retracts toward zero with age
      const age = Math.min(g.ageMs / g.horizonMs, 1) ** PPC.entryPullExp;
      const kPull = age * (1 - Math.exp(-dtMs / PPC.entryPullTauMs));
      for (let j = 0; j < 6; j++) g.offset[j] -= g.offset[j] * kPull;
      capLen3(g.offset, 0, PPC.maxDriftM);
      capLen3(g.offset, 3, PPC.maxDriftNorm);
    }

    // ---- per-landmark output ------------------------------------------------
    let anyVis = false;
    for (const g of this.groups) {
      if (g.blending) g.blendErr = 0; // re-accumulated by emit below
      for (const m of g.spec.members) {
        this.emit(g, m, present ? world! : null, present ? norm! : null, frameMs, dt, dtMs);
        if (this.outWorld[m].visibility > 0.01) anyVis = true;
      }
    }
    // landmarks owned by no group (eyes/mouth are in head; all 33 are owned —
    // this loop is a guard for completeness) pass through
    if (present) {
      for (let i = 0; i < N; i++) {
        if (this.owner[i]) continue;
        copyLm(world![i], this.outWorld[i]);
        copyLm(norm![i], this.outNorm[i]);
        if (world![i].visibility > 0.01) anyVis = true;
      }
    }

    // segment-length learning runs on measured data only
    if (present) this.learnSegments(world!, dt);

    if (!present && !anyVis) return null; // full dropout, fully faded: honest null
    return { world: this.outWorld, norm: this.outNorm };
  }

  /** Write one landmark's output for this frame. */
  private emit(
    g: GroupState,
    m: number,
    world: LandmarkPoint[] | null,
    norm: LandmarkPoint[] | null,
    frameMs: number,
    dt: number,
    dtMs: number,
  ): void {
    const ow = this.outWorld[m];
    const on = this.outNorm[m];
    const s = this.lm[m];
    const measured = world !== null;
    // chain plausibility: a measured sample that breaks its (physically
    // constant) segment length is detector garbage no matter what its
    // visibility claims — behind-torso punches collapse the forearm onto
    // the elbow at vis 0.5–0.99 (Gate-2 live finding, confirmed on the
    // fast.mp4 trace). Garbage is held instead of enacted, emitted at low
    // confidence, and never enters the ring buffer.
    const plausible = !measured || this.chainPlausible(g, m, world!);

    if (g.state === 'VISIBLE') {
      if (!measured) return; // gate said open but frame missing: hold, next frame decides
      const w = world![m];
      const n = norm![m];
      if (!plausible) {
        // hold the last output; confidence capped below every gate
        ow.visibility = on.visibility = Math.min(w.visibility, PPC.implausibleVis);
        return;
      }
      const pairOk = this.pairPlausible(g, m, world!);
      if (pairOk && w.visibility >= PPC.visPush) this.tracks[m].push(frameMs, w, n);

      if (g.blending && g.reentryDurMs > 0) {
        // re-entry: smoothstep from the held pose toward measured, with a
        // hard per-frame correction cap — re-acquisition never pops
        const f = smoothstep(g.reentryMs / g.reentryDurMs);
        stepToward(ow, s.hold, 0, w, f, PPC.maxCorrWorld);
        stepToward(on, s.hold, 3, n, f, PPC.maxCorrNorm);
        ow.visibility = on.visibility = s.hold[6] + (w.visibility - s.hold[6]) * f;
        g.blendErr = Math.max(g.blendErr, Math.hypot(w.x - ow.x, w.y - ow.y, w.z - ow.z));
      } else {
        // exact pass-through: fully-visible behavior is byte-identical
        copyLm(w, ow);
        copyLm(n, on);
        // …except when a rigid pair's constant width broke: which member is
        // garbage is ambiguous, so neither is trusted (confidence only)
        if (!pairOk) {
          ow.visibility = on.visibility = Math.min(ow.visibility, PPC.implausibleVis);
        }
      }
      return;
    }

    // PREDICTED / RELAXED: advance the held output
    if (g.state === 'PREDICTED') {
      if (g.spec.rigid) {
        // rigid groups translate as one body: shape at loss + group offset.
        // Per-landmark prediction sheared the torso quad and the retargeter
        // read the shear as bending/spinning — rotation continuity belongs
        // to the bone layer's clamped coast, not to landmark extrapolation.
        ow.x = s.entry[0] + g.offset[0];
        ow.y = s.entry[1] + g.offset[1];
        ow.z = s.entry[2] + g.offset[2];
        on.x = s.entry[3] + g.offset[3];
        on.y = s.entry[4] + g.offset[4];
        on.z = s.entry[5] + g.offset[5];
      } else {
        const damp = Math.exp(-dtMs / PPC.dampTauMs);
        for (let j = 0; j < 6; j++) s.vel[j] *= damp;
        ow.x += s.vel[0] * dt;
        ow.y += s.vel[1] * dt;
        ow.z += s.vel[2] * dt;
        on.x += s.vel[3] * dt;
        on.y += s.vel[4] * dt;
        on.z += s.vel[5] * dt;
        // entry-pull: retract toward the last-seen pose (parent-anchored) as
        // age grows — reversals punish flying away; last-seen is the honest
        // uncertainty center. The hanging-rest pull belongs to RELAXED.
        const age = Math.min(g.ageMs / g.horizonMs, 1) ** PPC.entryPullExp;
        const kPull = age * (1 - Math.exp(-dtMs / PPC.entryPullTauMs));
        const parent = this.parentOf(g, m);
        const pw = parent >= 0 ? this.outWorld[parent] : null;
        const pn = parent >= 0 ? this.outNorm[parent] : null;
        const ax = s.entry[0] + (pw?.x ?? 0); // last-seen anchor, riding the parent
        const ay = s.entry[1] + (pw?.y ?? 0);
        const az = s.entry[2] + (pw?.z ?? 0);
        const anx = s.entry[3] + (pn?.x ?? 0);
        const any_ = s.entry[4] + (pn?.y ?? 0);
        const anz = s.entry[5] + (pn?.z ?? 0);
        if (kPull > 0) {
          ow.x += (ax - ow.x) * kPull;
          ow.y += (ay - ow.y) * kPull;
          ow.z += (az - ow.z) * kPull;
          on.x += (anx - on.x) * kPull;
          on.y += (any_ - on.y) * kPull;
          on.z += (anz - on.z) * kPull;
        }
        // hard drift cap: prediction never strays far from the last-seen pose
        capDrift(ow, ax, ay, az, PPC.maxDriftM);
        capDrift(on, anx, any_, anz, PPC.maxDriftNorm);
        // bone-length projection against the (already emitted) parent
        this.projectToParent(g, m, ow, s);
      }
    } else if (!g.spec.rigid) {
      // RELAXED: ease toward rest, no more ballistic motion (rigid groups
      // hold their shape where it settled; vis is already fading to 0)
      this.pullToRest(g, m, ow, 1 - Math.exp(-dtMs / PPC.restTauMs));
    }

    // confidence decay — the honesty channel downstream consumers read.
    // Low velocity trust shrinks the effective horizon: a prediction that
    // is basically "hold" hands bones back to the gate-approved bone-level
    // hold quickly instead of driving them with informationless data.
    let vis: number;
    if (g.state === 'PREDICTED') {
      const effHorizon =
        g.horizonMs * (PPC.trustHorizonFloor + (1 - PPC.trustHorizonFloor) * s.trust);
      const k = Math.min(g.ageMs / Math.max(effHorizon, 1), 1);
      vis = s.visEnter * (1 - (1 - PPC.visFloorAtHorizon) * k) * s.agreement;
    } else {
      const over = g.ageMs - g.horizonMs;
      vis =
        s.visEnter * PPC.visFloorAtHorizon * s.agreement *
        Math.max(0, 1 - over / g.relaxVisMs);
    }
    // group-level predictive value scales the confidence itself: legs emit
    // ≤ 0.25× so downstream gates hand the puppet to bone-hold immediately
    vis *= g.spec.visTrust;
    ow.visibility = on.visibility = Math.max(0, Math.min(vis, 1));

    // a landmark inside a lost group that is itself still well-measured
    // re-approaches its measurement in BOUNDED steps (a mid-occlusion
    // teleport must not reinject raw), and only plausible samples count.
    // Confidence honesty: until the emitted position has actually caught
    // up, it must not claim measured confidence — flapping desk-framed
    // legs spent whole runs in unconverged catch-up at claimed-high vis
    // and poisoned the sync metric (fully-visible refresh caught it).
    if (measured && plausible && world![m].visibility >= PPC.visPush) {
      const w = world![m];
      const n = norm![m];
      if (this.tracks[m].count === 0) {
        // first sighting ever: nothing to preserve continuity of — a
        // catch-up walk from the zeroed origin would be pure invention
        copyLm(w, ow);
        copyLm(n, on);
      } else {
        stepCap(ow, w, PPC.maxCorrWorld * PPC.regainStepScale);
        stepCap(on, n, PPC.maxCorrNorm * PPC.regainStepScale);
        // trusted confidence only once BOTH streams have converged — the
        // sync eval reads norm, and a converged world with a lagging norm
        // paired garbage angles with measured confidence (caught by the
        // fully-visible refresh: facetouch legsMean exploded)
        const gapW = Math.hypot(w.x - ow.x, w.y - ow.y, w.z - ow.z);
        const gapN = Math.hypot(n.x - on.x, n.y - on.y, n.z - on.z);
        if (gapW > PPC.maxCorrWorld || gapN > PPC.maxCorrNorm) {
          ow.visibility = on.visibility = Math.min(w.visibility, PPC.implausibleVis);
          this.tracks[m].push(frameMs, w, n);
          return;
        }
      }
      ow.visibility = on.visibility = w.visibility;
      this.tracks[m].push(frameMs, w, n);
    }
  }

  /** True when the measured child keeps a physically possible distance to
   *  its measured parent (or no judgement is possible). Side-effect free. */
  private chainPlausible(g: GroupState, m: number, world: LandmarkPoint[]): boolean {
    const parent = this.parentOf(g, m);
    if (parent < 0) return true;
    const c = world[m];
    const p = world[parent];
    if (c.visibility < PPC.visPush || p.visibility < PPC.visPush) return true;
    const L = this.segLen.get(m * N + parent);
    if (L === undefined || L < 1e-3) return true;
    const len = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
    return len >= L * PPC.chainGateLo && len <= L * PPC.chainGateHi;
  }

  /** Rigid groups' plausibility pairs (shoulder/hip/ear width): false when
   *  a measured pair containing m has broken its constant distance. */
  private pairPlausible(g: GroupState, m: number, world: LandmarkPoint[]): boolean {
    const pairs = g.spec.plausPairs;
    if (!pairs) return true;
    for (const [a, b] of pairs) {
      if (m !== a && m !== b) continue;
      const pa = world[a];
      const pb = world[b];
      if (Math.min(pa.visibility, pb.visibility) < PPC.visPush) continue;
      const L = this.segLen.get(a * N + b);
      if (L === undefined || L < 1e-3) continue;
      const len = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
      if (len < L * PPC.chainGateLo || len > L * PPC.chainGateHi) return false;
    }
    return true;
  }

  /** Pull a predicted world landmark toward its rest target by k (0..1).
   *  Rest = parent + learned segment length straight down (a hanging chain);
   *  torso/head landmarks rest where they are (hold). */
  private pullToRest(g: GroupState, m: number, ow: LandmarkPoint, k: number): void {
    if (k <= 0) return;
    const parent = this.parentOf(g, m);
    if (parent < 0) return; // torso/head: rest = hold
    const L = this.segLen.get(m * N + parent);
    if (L === undefined) return;
    const p = this.outWorld[parent];
    // MediaPipe world space is y-down: hanging = +y from the parent
    ow.x += (p.x - ow.x) * k;
    ow.y += (p.y + L - ow.y) * k;
    ow.z += (p.z - ow.z) * k;
  }

  /** Clamp a predicted child onto a sphere shell around its parent at the
   *  learned segment length (±tolerance). Updates the agreement factor. */
  private projectToParent(g: GroupState, m: number, ow: LandmarkPoint, s: LmState): void {
    const parent = this.parentOf(g, m);
    if (parent < 0) return;
    const L = this.segLen.get(m * N + parent);
    if (L === undefined || L < 1e-4) return;
    const p = this.outWorld[parent];
    const dx = ow.x - p.x;
    const dy = ow.y - p.y;
    const dz = ow.z - p.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const lo = L * (1 - PPC.segTolerance);
    const hi = L * (1 + PPC.segTolerance);
    const target = Math.min(Math.max(len, lo), hi);
    if (target !== len) {
      const sc = target / len;
      ow.x = p.x + dx * sc;
      ow.y = p.y + dy * sc;
      ow.z = p.z + dz * sc;
      // agreement: the harder the constraint had to correct, the less the
      // prediction agrees with its visible neighbors
      const corr = Math.abs(len - target) / L;
      s.agreement = Math.max(PPC.agreementFloor, Math.min(s.agreement, 1 - corr));
    }
  }

  private parentOf(g: GroupState, m: number): number {
    for (const [child, parent] of g.spec.chain) if (child === m) return parent;
    return -1;
  }

  /** Slow EMA of segment lengths while both endpoints are well-measured
   *  (chains AND the rigid groups' plausibility pairs). */
  private learnSegments(world: LandmarkPoint[], dt: number): void {
    const k = 1 - Math.exp(-dt / (PPC.segTauMs / 1000));
    const learn = (child: number, parent: number): void => {
      const c = world[child];
      const p = world[parent];
      if (Math.min(c.visibility, p.visibility) < PPC.visPush) return;
      const len = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
      const prev = this.segLen.get(child * N + parent);
      this.segLen.set(child * N + parent, prev === undefined ? len : prev + (len - prev) * k);
    };
    for (const g of this.groups) {
      for (const [child, parent] of g.spec.chain) learn(child, parent);
      if (g.spec.plausPairs) for (const [a, b] of g.spec.plausPairs) learn(a, b);
    }
  }
}

/** Move `out` toward `target`, at most `maxStep` per call. */
function stepCap(out: LandmarkPoint, target: LandmarkPoint, maxStep: number): void {
  let dx = target.x - out.x;
  let dy = target.y - out.y;
  let dz = target.z - out.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > maxStep) {
    const sc = maxStep / d;
    dx *= sc;
    dy *= sc;
    dz *= sc;
  }
  out.x += dx;
  out.y += dy;
  out.z += dz;
}

/** Clamp p onto a sphere of radius max around the anchor (ax, ay, az). */
function capDrift(p: LandmarkPoint, ax: number, ay: number, az: number, max: number): void {
  const dx = p.x - ax;
  const dy = p.y - ay;
  const dz = p.z - az;
  const d = Math.hypot(dx, dy, dz);
  if (d > max) {
    const s = max / d;
    p.x = ax + dx * s;
    p.y = ay + dy * s;
    p.z = az + dz * s;
  }
}

function copyLm(src: LandmarkPoint, dst: LandmarkPoint): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.visibility = src.visibility;
}

/** Move `out` toward lerp(hold, measured, f), capped at maxStep from the
 *  previous emitted position (the no-snap bound). */
function stepToward(
  out: LandmarkPoint,
  hold: Float64Array,
  holdOff: number,
  measured: LandmarkPoint,
  f: number,
  maxStep: number,
): void {
  const tx = hold[holdOff] + (measured.x - hold[holdOff]) * f;
  const ty = hold[holdOff + 1] + (measured.y - hold[holdOff + 1]) * f;
  const tz = hold[holdOff + 2] + (measured.z - hold[holdOff + 2]) * f;
  let dx = tx - out.x;
  let dy = ty - out.y;
  let dz = tz - out.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > maxStep) {
    const s = maxStep / d;
    dx *= s;
    dy *= s;
    dz *= s;
  }
  out.x += dx;
  out.y += dy;
  out.z += dz;
}
