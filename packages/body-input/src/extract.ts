// Extraction: landmarks → per-frame Measure (neutral-free geometry), then
// Measure + NeutralState → raw axis values. Both steps are deterministic
// state machines over the input stream — no wall clocks, no randomness.
//
// Sign conventions (mirror view: screen +x = the user's own right):
//   leanX + = user leans toward their right; leanY + = toward the camera.

import { LM } from './lm';
import { TorsoBasis, BasisVectors, toBasisLocal } from './basis';
import type { AxisName, BodyInputFrame, ExtractionConfig, LandmarkPoint } from './types';
import { V3, v3, mpToInternal, sub, dist, copy } from './vec';

export interface ArmMeasure {
  /** wrist relative to shoulder center, in the current torso basis */
  rLocal: V3;
  /** own shoulder relative to shoulder center, in the current torso basis */
  oLocal: V3;
  /** straight-line shoulder→wrist length (arm-length measurement) */
  slen: number;
  visOk: boolean;
}

export interface Measure {
  ts: number;
  /** world landmarks arrived this frame (false = dropout) */
  present: boolean;
  /** torso basis valid — everything geometric below requires this */
  ok: boolean;
  basis: BasisVectors;
  hipsValid: boolean;
  shoulderWidth: number;
  /** shoulderCenterY − ankleCenterY (internal y-up), null unless ankles visible */
  statureWorld: number | null;
  /** norm-space (image, y down) shoulder-center y + width — crouch fallback */
  shoulderNormY: number | null;
  shoulderWidthNorm: number | null;
  /** norm-space hip-center y — with shoulderNormY this is the vertical
   *  chest–hip extent, the torso-wave (swim kick) substrate */
  hipNormY: number | null;
  /** norm-space hip-center x — with a slow DC reference this is the
   *  lateral sway (weight-shift gait) substrate; mirrored: + = the
   *  user's own right */
  hipNormX: number | null;
  /** signed knee-lift difference between the legs in thigh-length units
   *  (+ = the user's LEFT knee high = weight over their right foot) —
   *  the marching gait substrate; null unless knees+hips visible */
  kneeDiff: number | null;
  /** nose relative to shoulder center in the torso basis (leanY fallback) */
  noseLocalZ: number | null;
  /** mean straight shoulder→wrist length over visible arms */
  armLenMeasured: number | null;
  left: ArmMeasure;
  right: ArmMeasure;
  /** both thighs within seatedThighDeg of horizontal (null = knees unseen) */
  thighsHorizontal: boolean | null;
  /** ankle forward-of-hip offset / thigh length (null = legs unseen).
   *  Sitting puts the feet forward (~1 thigh length); a deep crouch keeps
   *  the heels under the hips (~0) — this is what separates the two. */
  anklesForwardRatio: number | null;
  /** |ankle−hip| / (|hip−knee| + |knee−ankle|): a folded leg (crouch)
   *  reads low, a seated leg (shin vertical under the knee) reads high.
   *  y-dominated, so it survives MediaPipe's z compression. */
  legFoldRatio: number | null;
  kneesVisible: boolean;
  anklesVisible: boolean;
  hipsVisible: boolean;
  /** mean keypoint speed m/s vs previous measured frame (null = no pair) */
  speed: number | null;
  /** instantaneous confidence 0..1 from core-landmark visibility */
  confidenceTarget: number;
}

const SPEED_KEYS = [
  LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip,
] as const;

function emptyArm(): ArmMeasure {
  return { rLocal: v3(), oLocal: v3(), slen: 0, visOk: false };
}

export class Extractor {
  private basis = new TorsoBasis();
  private prevPts: (V3 | null)[] = SPEED_KEYS.map(() => null);
  private prevTs: number | null = null;
  private scratch = { p: v3(), q: v3(), r: v3(), s: v3() };
  private m: Measure = {
    ts: 0, present: false, ok: false,
    basis: { vx: v3(1, 0, 0), vy: v3(0, 1, 0), vz: v3(0, 0, 1) },
    hipsValid: false, shoulderWidth: 0.34,
    statureWorld: null, shoulderNormY: null, shoulderWidthNorm: null,
    hipNormY: null, hipNormX: null, kneeDiff: null, noseLocalZ: null, armLenMeasured: null,
    left: emptyArm(), right: emptyArm(),
    thighsHorizontal: null, anklesForwardRatio: null, legFoldRatio: null,
    kneesVisible: false, anklesVisible: false, hipsVisible: false,
    speed: null, confidenceTarget: 0,
  };

  reset(): void {
    this.prevPts = SPEED_KEYS.map(() => null);
    this.prevTs = null;
  }

  /** Measure one frame. The returned object is reused across calls. */
  measure(frame: BodyInputFrame, cfg: ExtractionConfig): Measure {
    const m = this.m;
    m.ts = frame.tsMs;
    m.present = frame.world !== null && frame.world.length >= 33;
    m.ok = false;
    m.statureWorld = null;
    m.shoulderNormY = null;
    m.shoulderWidthNorm = null;
    m.hipNormY = null;
    m.hipNormX = null;
    m.kneeDiff = null;
    m.noseLocalZ = null;
    m.armLenMeasured = null;
    m.left.visOk = false;
    m.right.visOk = false;
    m.thighsHorizontal = null;
    m.anklesForwardRatio = null;
    m.legFoldRatio = null;
    m.speed = null;
    m.confidenceTarget = 0;
    m.hipsValid = false;
    m.hipsVisible = false;
    m.kneesVisible = false;
    m.anklesVisible = false;

    if (!m.present) {
      this.prevPts = SPEED_KEYS.map(() => null); // dropout breaks the speed pair
      this.prevTs = null;
      return m;
    }
    const w = frame.world as LandmarkPoint[];

    const shVis = Math.min(w[LM.leftShoulder].visibility, w[LM.rightShoulder].visibility);
    const hipVis = Math.min(w[LM.leftHip].visibility, w[LM.rightHip].visibility);
    m.confidenceTarget =
      0.6 * shVis + 0.2 * hipVis + 0.2 * w[LM.nose].visibility;

    if (!this.basis.update(w)) {
      this.updateSpeed(w, frame.tsMs);
      return m;
    }
    m.ok = true;
    m.basis.vx = { ...this.basis.vx };
    m.basis.vy = { ...this.basis.vy };
    m.basis.vz = { ...this.basis.vz };
    m.hipsValid = this.basis.hipsValid;
    m.shoulderWidth = this.basis.shoulderWidth;
    m.hipsVisible = hipVis >= cfg.visGate;
    m.kneesVisible =
      Math.min(w[LM.leftKnee].visibility, w[LM.rightKnee].visibility) >= cfg.visGate;
    m.anklesVisible =
      Math.min(w[LM.leftAnkle].visibility, w[LM.rightAnkle].visibility) >= cfg.visGate;

    // stature: shoulder-center height above ankle-center (relative distance —
    // immune to MediaPipe's hip-centered world origin)
    if (m.anklesVisible) {
      mpToInternal(w[LM.leftAnkle], this.scratch.p);
      mpToInternal(w[LM.rightAnkle], this.scratch.q);
      const ankleY = (this.scratch.p.y + this.scratch.q.y) / 2;
      m.statureWorld = this.basis.shoulderCenter.y - ankleY;
    }

    // norm-space shoulder y — the crouch/tallness fallback when ankles are
    // cropped (world coords can't see whole-body height changes: hip origin)
    if (frame.norm && frame.norm.length >= 33) {
      const nls = frame.norm[LM.leftShoulder];
      const nrs = frame.norm[LM.rightShoulder];
      if (Math.min(nls.visibility, nrs.visibility) >= 0.4) {
        m.shoulderNormY = (nls.y + nrs.y) / 2;
        m.shoulderWidthNorm = Math.hypot(nls.x - nrs.x, nls.y - nrs.y);
      }
      const nlh = frame.norm[LM.leftHip];
      const nrh = frame.norm[LM.rightHip];
      if (Math.min(nlh.visibility, nrh.visibility) >= 0.4) {
        m.hipNormY = (nlh.y + nrh.y) / 2;
        m.hipNormX = (nlh.x + nrh.x) / 2;
      }
    }

    // nose in torso basis (leanY fallback: forward head/torso lean when hips
    // are occluded — the shoulders-only basis carries no pitch)
    if (w[LM.nose].visibility >= 0.4) {
      mpToInternal(w[LM.nose], this.scratch.p);
      sub(this.scratch.q, this.scratch.p, this.basis.shoulderCenter);
      m.noseLocalZ = this.basis.toLocal(this.scratch.q, this.scratch.r).z;
    }

    this.measureArm(w, LM.leftShoulder, LM.leftWrist, m.left, cfg);
    this.measureArm(w, LM.rightShoulder, LM.rightWrist, m.right, cfg);
    const lens: number[] = [];
    if (m.left.visOk) lens.push(m.left.slen);
    if (m.right.visOk) lens.push(m.right.slen);
    m.armLenMeasured = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : null;

    // seated primary condition: both thighs near horizontal
    if (m.kneesVisible && m.hipsVisible) {
      m.thighsHorizontal =
        this.thighHorizontal(w, LM.leftHip, LM.leftKnee, cfg) &&
        this.thighHorizontal(w, LM.rightHip, LM.rightKnee, cfg);
      if (m.anklesVisible) {
        mpToInternal(w[LM.leftHip], this.scratch.p);
        mpToInternal(w[LM.rightHip], this.scratch.q);
        const hipZ = (this.scratch.p.z + this.scratch.q.z) / 2;
        mpToInternal(w[LM.leftKnee], this.scratch.p);
        mpToInternal(w[LM.rightKnee], this.scratch.q);
        mpToInternal(w[LM.leftHip], this.scratch.r);
        const thighLen = Math.max(dist(this.scratch.r, this.scratch.p), 1e-3);
        mpToInternal(w[LM.leftAnkle], this.scratch.p);
        mpToInternal(w[LM.rightAnkle], this.scratch.q);
        const ankleZ = (this.scratch.p.z + this.scratch.q.z) / 2;
        m.anklesForwardRatio = (ankleZ - hipZ) / thighLen;

        // leg fold, left leg (y-dominated — robust to z compression)
        mpToInternal(w[LM.leftHip], this.scratch.p);
        mpToInternal(w[LM.leftKnee], this.scratch.q);
        mpToInternal(w[LM.leftAnkle], this.scratch.r);
        const legLen = dist(this.scratch.p, this.scratch.q) + dist(this.scratch.q, this.scratch.r);
        if (legLen > 1e-3) m.legFoldRatio = dist(this.scratch.p, this.scratch.r) / legLen;
      }
    }

    // gait (march) substrate: per-leg knee lift relative to the OWN-side
    // hip in internal y-up space, normalized by the mean thigh length (a
    // rigid segment — stable under the lift itself). Mirrored landmarks:
    // the LM.left* slots are the user's anatomical RIGHT side.
    if (m.kneesVisible && m.hipsVisible) {
      mpToInternal(w[LM.leftHip], this.scratch.p);
      mpToInternal(w[LM.leftKnee], this.scratch.q);
      mpToInternal(w[LM.rightHip], this.scratch.r);
      mpToInternal(w[LM.rightKnee], this.scratch.s);
      const thigh = (dist(this.scratch.p, this.scratch.q) + dist(this.scratch.r, this.scratch.s)) / 2;
      if (thigh > 1e-3) {
        const liftUserRight = this.scratch.q.y - this.scratch.p.y; // LM.left* = user's right
        const liftUserLeft = this.scratch.s.y - this.scratch.r.y;
        m.kneeDiff = (liftUserLeft - liftUserRight) / thigh;
      }
    }

    this.updateSpeed(w, frame.tsMs);
    return m;
  }

  private measureArm(
    w: LandmarkPoint[], shoulderIdx: number, wristIdx: number, out: ArmMeasure, cfg: ExtractionConfig,
  ): void {
    const sLm = w[shoulderIdx];
    const wLm = w[wristIdx];
    out.visOk = Math.min(sLm.visibility, wLm.visibility) >= cfg.visGate;
    if (!out.visOk) return;
    mpToInternal(sLm, this.scratch.p);
    mpToInternal(wLm, this.scratch.q);
    out.slen = dist(this.scratch.p, this.scratch.q);
    sub(this.scratch.r, this.scratch.q, this.basis.shoulderCenter);
    this.basis.toLocal(this.scratch.r, out.rLocal);
    sub(this.scratch.r, this.scratch.p, this.basis.shoulderCenter);
    this.basis.toLocal(this.scratch.r, out.oLocal);
  }

  private thighHorizontal(
    w: LandmarkPoint[], hipIdx: number, kneeIdx: number, cfg: ExtractionConfig,
  ): boolean {
    mpToInternal(w[hipIdx], this.scratch.p);
    mpToInternal(w[kneeIdx], this.scratch.q);
    sub(this.scratch.r, this.scratch.q, this.scratch.p);
    const l = Math.hypot(this.scratch.r.x, this.scratch.r.y, this.scratch.r.z);
    if (l < 1e-4) return false;
    return Math.abs(this.scratch.r.y) / l < Math.sin((cfg.seatedThighDeg * Math.PI) / 180);
  }

  private updateSpeed(w: LandmarkPoint[], tsMs: number): void {
    const dt = this.prevTs === null ? null : Math.max((tsMs - this.prevTs) / 1000, 1e-4);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < SPEED_KEYS.length; i++) {
      const lm = w[SPEED_KEYS[i]];
      if (lm.visibility < 0.4) {
        this.prevPts[i] = null;
        continue;
      }
      mpToInternal(lm, this.scratch.p);
      const prev = this.prevPts[i];
      if (prev && dt !== null) {
        sum += dist(this.scratch.p, prev) / dt;
        n++;
      }
      this.prevPts[i] = prev ? copy(prev, this.scratch.p) : { ...this.scratch.p };
    }
    this.m.speed = n > 0 ? sum / n : null;
    this.prevTs = tsMs;
  }
}

// ---------------------------------------------------------------------------
// Measure + neutral → raw axes

export interface NeutralState {
  kind: 'provisional' | 'explicit';
  basis: BasisVectors;
  statureWorld: number | null;
  shoulderNormY: number | null;
  shoulderWidthNorm: number | null;
  noseLocalZ: number | null;
  armLength: number;
  shoulderWidth: number;
  /** hanging-arm resting values (armLength units) — arm axes measure the
   *  EXCESS over these. Hanging wrists sit measurably forward of the
   *  shoulder plane (~0.37 arm lengths in MediaPipe z) and slightly
   *  outside it; the jitter-floor tool exposed that as bias, not noise. */
  armRest: { lat: number; raise: number; fwd: number };
}

/** Stature references while seated (captured on the seated flip). */
export interface StatureRef {
  statureWorld: number | null;
  shoulderNormY: number | null;
}

export function captureNeutral(
  m: Measure, prev: NeutralState | null, kind: NeutralState['kind'],
): NeutralState | null {
  if (!m.ok) return null;
  const sw = m.shoulderWidth;
  let armLength = m.armLenMeasured ?? prev?.armLength ?? 2.2 * sw;
  // sanity-only bounds: measured on the fixtures, a real straight arm reads
  // ~1.3 shoulder-widths in MediaPipe world space — a 1.5× floor silently
  // inflated armLength and capped armsOut at ~0.8. Underestimates are safe
  // (axes clamp at 1); overestimates starve every threshold.
  armLength = Math.min(Math.max(armLength, 1.1 * sw), 2.6 * sw);

  // arm rests: only trust them when the arms LOOK at rest — a T-pose
  // recenter must not poison the rest reference (armsOut would die)
  let armRest = prev?.armRest ?? { lat: 0, raise: 0, fwd: 0 };
  if (m.left.visOk && m.right.visOk) {
    const rest = armGeometry(m, armLength);
    // real hanging arms measure up to ~0.4 fwd (MediaPipe z bias); a genuine
    // T-pose (~0.9 lat) or thrust (~0.9 fwd) stays well above these gates
    if (rest.lat < 0.4 && rest.fwd < 0.55) armRest = rest;
  }
  return {
    kind,
    basis: { vx: { ...m.basis.vx }, vy: { ...m.basis.vy }, vz: { ...m.basis.vz } },
    statureWorld: m.statureWorld ?? prev?.statureWorld ?? null,
    shoulderNormY: m.shoulderNormY ?? prev?.shoulderNormY ?? null,
    shoulderWidthNorm: m.shoulderWidthNorm ?? prev?.shoulderWidthNorm ?? null,
    noseLocalZ: m.noseLocalZ ?? prev?.noseLocalZ ?? null,
    armLength,
    shoulderWidth: sw,
    armRest,
  };
}

/** Mean absolute arm extension (lat/raise/fwd) over visible arms, in
 *  armLength units — shared by extraction and rest capture. */
function armGeometry(m: Measure, armLen: number): { lat: number; raise: number; fwd: number } {
  let lat = 0, raise = 0, fwd = 0, n = 0;
  for (const arm of [m.left, m.right]) {
    if (!arm.visOk) continue;
    lat += Math.max(0, Math.abs(arm.rLocal.x) - Math.abs(arm.oLocal.x)) / armLen;
    raise += Math.max(0, arm.rLocal.y - arm.oLocal.y) / armLen;
    fwd += Math.max(0, arm.rLocal.z - arm.oLocal.z) / armLen;
    n++;
  }
  return n > 0 ? { lat: lat / n, raise: raise / n, fwd: fwd / n } : { lat: 0, raise: 0, fwd: 0 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const asinSafe = (v: number): number => Math.asin(clamp(v, -1, 1));
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Raw (pre-shaping) axis values; null = unavailable this frame (the shaper
 *  decays that axis toward neutral). All calibration-relative. */
export function computeRawAxes(
  m: Measure,
  neutral: NeutralState | null,
  seated: boolean,
  seatedRef: StatureRef | null,
  cfg: ExtractionConfig,
  out: Record<AxisName, number | null>,
  scratch: V3,
): Record<AxisName, number | null> {
  out.leanX = out.leanY = out.crouch = out.tallness = null;
  out.armsOut = out.armsRaised = out.handsForward = out.handPoint = null;
  if (!m.ok) return out;

  // --- lean, relative to the captured neutral basis
  if (neutral) {
    if (m.hipsValid) {
      toBasisLocal(neutral.basis, m.basis.vy, scratch);
      out.leanX = asinSafe(scratch.x) / rad(cfg.maxLeanXDeg);
      out.leanY = asinSafe(scratch.z) / rad(cfg.maxLeanYDeg);
    } else {
      // shoulders-only: roll from the shoulder line (lean right → +x end
      // dips → vx.y < 0), pitch from the nose's forward offset
      toBasisLocal(neutral.basis, m.basis.vx, scratch);
      out.leanX = Math.atan2(-scratch.y, Math.max(scratch.x, 1e-4)) / rad(cfg.maxLeanXDeg);
      if (m.noseLocalZ !== null && neutral.noseLocalZ !== null) {
        out.leanY =
          (m.noseLocalZ - neutral.noseLocalZ) / (cfg.fallbackLeanYWidths * neutral.shoulderWidth);
      }
    }
    if (out.leanX !== null) out.leanX = clamp(out.leanX, -1, 1);
    if (out.leanY !== null) out.leanY = clamp(out.leanY, -1, 1);
  }

  // --- crouch / tallness, against standing or seated stature references
  if (neutral) {
    const refWorld = seated ? seatedRef?.statureWorld ?? null : neutral.statureWorld;
    const refNormY = seated ? seatedRef?.shoulderNormY ?? null : neutral.shoulderNormY;
    if (m.statureWorld !== null && refWorld !== null && refWorld > 1e-3) {
      out.crouch = clamp((refWorld - m.statureWorld) / (refWorld * cfg.crouchRange), 0, 1);
      out.tallness = clamp((m.statureWorld - refWorld) / (refWorld * cfg.tallnessRange), 0, 1);
    } else if (
      m.shoulderNormY !== null && refNormY !== null &&
      neutral.shoulderWidthNorm !== null && neutral.shoulderWidthNorm > 1e-4
    ) {
      // upper-body framing: image-space shoulder drop (norm y grows downward)
      const swn = neutral.shoulderWidthNorm;
      out.crouch = clamp((m.shoulderNormY - refNormY) / (swn * cfg.fallbackCrouchWidths), 0, 1);
      out.tallness = clamp((refNormY - m.shoulderNormY) / (swn * cfg.fallbackTallWidths), 0, 1);
    }
  }

  // --- arm axes: available pre-neutral via the shoulder-width arm estimate.
  // Values are the EXCESS over the hanging-arm rest, renormalized so full
  // extension still reads ≈ 1 (0 = at rest, honestly zero on still footage).
  const armLen = neutral?.armLength ?? 2.2 * m.shoulderWidth;
  if (armLen > 1e-3) {
    if (m.left.visOk || m.right.visOk) {
      const g = armGeometry(m, armLen);
      const rest = neutral?.armRest ?? { lat: 0, raise: 0, fwd: 0 };
      const relative = (v: number, r: number): number =>
        clamp((v - r) / Math.max(1 - r, 0.2), 0, 1);
      out.armsOut = relative(g.lat, rest.lat);
      out.armsRaised = relative(g.raise, rest.raise);
      out.handsForward = relative(g.fwd, rest.fwd);
    }
    if (m.left.visOk && m.right.visOk) {
      // distance of each wrist from its synthesized rest (hanging below the
      // shoulder); the asymmetry is what reads as "pointing"
      const d = (arm: ArmMeasure): number => {
        const rx = arm.rLocal.x / armLen - arm.oLocal.x / armLen;
        const ry = arm.rLocal.y / armLen - (arm.oLocal.y / armLen - 0.95);
        const rz = arm.rLocal.z / armLen - arm.oLocal.z / armLen;
        return Math.hypot(rx, ry, rz);
      };
      out.handPoint = clamp(Math.abs(d(m.left) - d(m.right)), 0, 1);
    }
  }
  return out;
}
