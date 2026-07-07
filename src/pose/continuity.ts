// PREDICTIVE POSE CONTINUITY (PPC): graceful short-term prediction when
// landmarks disappear. Visible stream → per-landmark ring buffer →
// regression velocity → brief constrained prediction (≤ horizon) →
// confidence decay → smooth re-entry. Sits at the single fork in main.ts
// so puppeteering AND body-input inherit it.
//
// This is explicitly NOT invisible-limb tracking: the horizon is hard-capped
// (400 ms limbs / 250 ms torso+head), output visibility decays every frame a
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
   *  and Flight's autopilot-engagement timing must stay within +100 ms */
  horizonCoreMs: 250,
  /** visibility hysteresis, matching the retargeter's gates */
  visOn: 0.55,
  visOff: 0.45,
  /** samples below this never enter the ring buffer */
  visPush: 0.5,
  /** velocity regression: window size and max sample age at prediction entry */
  velWindow: 5,
  velMaxAgeMs: 280,
  /** exponential damping of the coasted velocity (ms) */
  dampTauMs: 180,
  /** rest-pose bias: weight grows with age² to this max at the horizon */
  restBiasMax: 0.3,
  restTauMs: 700,
  /** bone-length projection tolerance around the learned segment length */
  segTolerance: 0.1,
  segTauMs: 1000,
  /** predicted speed caps (world m/s, norm units/s) */
  maxPredSpeed: 3.5,
  maxPredSpeedNorm: 1.5,
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
  relaxVisMsCore: 150,
  /** neighbor-agreement multiplier floor */
  agreementFloor: 0.6,
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
  },
  {
    name: 'head',
    members: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    gate: [LM.nose],
    chain: [],
    core: true,
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
  },
];

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

  /** Least-squares velocity over the newest `win` samples no older than
   *  maxAgeMs before `nowMs`. Writes [vx,vy,vz] world + norm into out;
   *  returns false (zero velocity) when the history is too thin or stale. */
  velocity(nowMs: number, out: Float64Array): boolean {
    out.fill(0);
    const win = Math.min(PPC.velWindow, this.count);
    if (win < 3) return false;
    if (nowMs - this.latestT() > PPC.velMaxAgeMs) return false;
    // means
    let mt = 0;
    for (let k = 0; k < win; k++) mt += this.t[this.idx(k)];
    mt /= win;
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
    if (den < 1e-9) return false;
    for (let j = 0; j < 6; j++) out[j] = num[j] / den;
    // speed caps: prediction never exceeds a plausible gesture speed
    capLen3(out, 0, PPC.maxPredSpeed);
    capLen3(out, 3, PPC.maxPredSpeedNorm);
    return true;
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
}

interface LmState {
  /** velocities captured at prediction entry: wx,wy,wz,nx,ny,nz */
  vel: Float64Array;
  /** confidence at loss (last emitted visibility) */
  visEnter: number;
  /** neighbor-agreement multiplier, updated by the chain projection */
  agreement: number;
  /** held output at re-entry start (world + norm), for the blend */
  hold: Float64Array; // wx,wy,wz,nx,ny,nz,vis
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
        agreement: 1,
        hold: new Float64Array(7),
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
          for (const m of g.spec.members) {
            const s = this.lm[m];
            this.tracks[m].velocity(frameMs, s.vel);
            s.visEnter = this.outWorld[m].visibility;
            s.agreement = 1;
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

    if (g.state === 'VISIBLE') {
      if (!measured) return; // gate said open but frame missing: hold, next frame decides
      const w = world![m];
      const n = norm![m];
      if (w.visibility >= PPC.visPush) this.tracks[m].push(frameMs, w, n);

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
      }
      return;
    }

    // PREDICTED / RELAXED: advance the held output
    if (g.state === 'PREDICTED') {
      const damp = Math.exp(-dtMs / PPC.dampTauMs);
      for (let j = 0; j < 6; j++) s.vel[j] *= damp;
      ow.x += s.vel[0] * dt;
      ow.y += s.vel[1] * dt;
      ow.z += s.vel[2] * dt;
      on.x += s.vel[3] * dt;
      on.y += s.vel[4] * dt;
      on.z += s.vel[5] * dt;
      // rest bias: gentle pull toward a hanging chain, growing with age²
      const wRest = PPC.restBiasMax * Math.min(g.ageMs / g.horizonMs, 1) ** 2;
      this.pullToRest(g, m, ow, wRest * (1 - Math.exp(-dtMs / PPC.restTauMs)));
      // bone-length projection against the (already emitted) parent
      this.projectToParent(g, m, ow, s);
    } else {
      // RELAXED: ease toward rest, no more ballistic motion
      this.pullToRest(g, m, ow, 1 - Math.exp(-dtMs / PPC.restTauMs));
    }

    // confidence decay — the honesty channel downstream consumers read
    let vis: number;
    if (g.state === 'PREDICTED') {
      const k = Math.min(g.ageMs / g.horizonMs, 1);
      vis = s.visEnter * (1 - (1 - PPC.visFloorAtHorizon) * k) * s.agreement;
    } else {
      const over = g.ageMs - g.horizonMs;
      vis =
        s.visEnter * PPC.visFloorAtHorizon * s.agreement *
        Math.max(0, 1 - over / g.relaxVisMs);
    }
    ow.visibility = on.visibility = Math.max(0, Math.min(vis, 1));

    // a landmark inside a lost group that is itself still well-measured
    // passes through measured data (e.g. one shoulder occluded, not both)
    if (measured && world![m].visibility >= PPC.visPush) {
      copyLm(world![m], ow);
      copyLm(norm![m], on);
      this.tracks[m].push(frameMs, world![m], norm![m]);
    }
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

  /** Slow EMA of segment lengths while both endpoints are well-measured. */
  private learnSegments(world: LandmarkPoint[], dt: number): void {
    const k = 1 - Math.exp(-dt / (PPC.segTauMs / 1000));
    for (const g of this.groups) {
      for (const [child, parent] of g.spec.chain) {
        const c = world[child];
        const p = world[parent];
        if (Math.min(c.visibility, p.visibility) < PPC.visPush) continue;
        const len = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
        const prev = this.segLen.get(child * N + parent);
        this.segLen.set(child * N + parent, prev === undefined ? len : prev + (len - prev) * k);
      }
    }
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
