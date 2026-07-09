// Periodic-motion (stroke) detection — the Rowing primitive, designed for
// reuse (Dolphin's dive cycle is the same detector on a different axis).
// Lives in the package because landmarks never cross the transport: games
// receive rate/phase/amplitude, never wrists.
//
// Signal: per-arm wrist fore-aft extension in the torso basis, normalized
// by arm length (the handsForward substrate, signed and un-rested — an
// oscillation detector cares about excursion, not absolute pose). Reversal
// detection is a position Schmitt trigger on the mean signal: a reversal
// registers when the signal retreats `reversalHys` from the running
// extremum — immune to velocity noise in MediaPipe z, which a
// zero-crossing velocity detector is not (measured: the velocity sign
// flickers near the turn even after One Euro).
//
// Cycle anatomy: CATCH (front extremum, hands furthest forward) → DRIVE
// (pull back) → FINISH (rear extremum) → RECOVERY (return forward). A
// stroke counts at the FINISH — the moment the pull completes and a boat
// would surge — if the drive excursion clears `minAmp` and the timing is
// physiologically sane. Everything runs on frame timestamps only, so a
// recorded stream replays byte-identically.

import { OneEuro } from './oneEuro';
import type { BodyStroke, StrokeConfig } from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

type Direction = 'unknown' | 'forward' | 'backward';

export class StrokeDetector {
  private fMean: OneEuro;
  private fL: OneEuro;
  private fR: OneEuro;

  private dir: Direction = 'unknown';
  /** running extremum of the filtered mean since the last reversal */
  private ext = 0;
  private extTs = 0;
  private extL = 0;
  private extR = 0;
  private hasExt = false;
  /** in 'unknown' we track both ends until one breaks the hysteresis */
  private unkMin = 0;
  private unkMax = 0;

  private lastCatch: { ts: number; pos: number; posL: number; posR: number } | null = null;
  private lastFinish: { ts: number; pos: number; posL: number; posR: number } | null = null;
  private prevFinishTs: number | null = null;

  private periodEmaMs: number | null = null;
  private lastSeenTs: number | null = null;

  private count = 0;
  private rate = 0;
  private ampL = 0;
  private ampR = 0;
  private active = false;

  constructor(private cfg: StrokeConfig) {
    this.fMean = new OneEuro(cfg.oneEuro.minCutoff, cfg.oneEuro.beta);
    this.fL = new OneEuro(cfg.oneEuro.minCutoff, cfg.oneEuro.beta);
    this.fR = new OneEuro(cfg.oneEuro.minCutoff, cfg.oneEuro.beta);
  }

  configure(cfg: StrokeConfig): void {
    this.cfg = cfg;
    this.fMean.minCutoff = cfg.oneEuro.minCutoff;
    this.fMean.beta = cfg.oneEuro.beta;
    this.fL.minCutoff = cfg.oneEuro.minCutoff;
    this.fL.beta = cfg.oneEuro.beta;
    this.fR.minCutoff = cfg.oneEuro.minCutoff;
    this.fR.beta = cfg.oneEuro.beta;
  }

  reset(): void {
    this.fMean.reset();
    this.fL.reset();
    this.fR.reset();
    this.dir = 'unknown';
    this.hasExt = false;
    this.lastCatch = null;
    this.lastFinish = null;
    this.prevFinishTs = null;
    this.periodEmaMs = null;
    this.lastSeenTs = null;
    this.count = 0;
    this.rate = 0;
    this.ampL = 0;
    this.ampR = 0;
    this.active = false;
  }

  /**
   * Advance one frame. `fwdL`/`fwdR` are per-arm wrist fore-aft extension in
   * arm-length units (null = that arm unavailable this frame). Call with
   * both null on dropout/low-confidence frames — rhythm decays, never spikes.
   */
  step(tsMs: number, fwdL: number | null, fwdR: number | null): void {
    if (fwdL === null && fwdR === null) {
      this.decay(tsMs);
      return;
    }
    const raw = fwdL !== null && fwdR !== null ? (fwdL + fwdR) / 2 : (fwdL ?? fwdR)!;
    const pos = this.fMean.filter(raw, tsMs);
    // A one-armed frame reuses the mean for the missing side: amplitude
    // stays defined and symmetric-by-default rather than collapsing to 0.
    const posL = fwdL !== null ? this.fL.filter(fwdL, tsMs) : pos;
    const posR = fwdR !== null ? this.fR.filter(fwdR, tsMs) : pos;

    // Rhythm staleness: no reversal for maxPeriodMs = the cycle is broken.
    const lastRevTs = Math.max(this.lastCatch?.ts ?? -Infinity, this.lastFinish?.ts ?? -Infinity);
    if (Number.isFinite(lastRevTs) && tsMs - lastRevTs > this.cfg.maxPeriodMs) {
      this.active = false;
      this.prevFinishTs = null; // next stroke starts a fresh period estimate
    }
    this.decayRate(tsMs);
    this.lastSeenTs = tsMs;

    const hys = this.cfg.reversalHys;

    if (this.dir === 'unknown') {
      if (!this.hasExt) {
        this.unkMin = pos;
        this.unkMax = pos;
        this.hasExt = true;
        this.setExt(pos, tsMs, posL, posR);
        return;
      }
      this.unkMin = Math.min(this.unkMin, pos);
      this.unkMax = Math.max(this.unkMax, pos);
      if (pos > this.unkMin + hys) {
        this.dir = 'forward'; // moving toward the camera (recovery-like)
        this.setExt(pos, tsMs, posL, posR);
      } else if (pos < this.unkMax - hys) {
        this.dir = 'backward'; // pulling back (drive-like)
        this.setExt(pos, tsMs, posL, posR);
      }
      return;
    }

    if (this.dir === 'forward') {
      if (pos >= this.ext) {
        this.setExt(pos, tsMs, posL, posR);
      } else if (this.ext - pos > hys) {
        this.onCatch(); // front extremum: the catch — drive begins
        this.dir = 'backward';
        this.setExt(pos, tsMs, posL, posR);
      }
      return;
    }

    // dir === 'backward'
    if (pos <= this.ext) {
      this.setExt(pos, tsMs, posL, posR);
    } else if (pos - this.ext > hys) {
      this.onFinish(); // rear extremum: the finish — a completed pull
      this.dir = 'forward';
      this.setExt(pos, tsMs, posL, posR);
    }
  }

  /** Dropout path: nothing to measure — rate/activity decay, state holds. */
  decay(tsMs: number): void {
    this.decayRate(tsMs);
    const lastRevTs = Math.max(this.lastCatch?.ts ?? -Infinity, this.lastFinish?.ts ?? -Infinity);
    if (Number.isFinite(lastRevTs) && tsMs - lastRevTs > this.cfg.maxPeriodMs) {
      this.active = false;
      this.prevFinishTs = null;
    }
    this.lastSeenTs = tsMs;
    // The filters and extremum state deliberately survive short dropouts —
    // a flickering track must not restart the cycle every few frames.
  }

  snapshot(tsMs: number): BodyStroke {
    return {
      active: this.active,
      count: this.count,
      rate: this.rate,
      phase: this.phaseAt(tsMs),
      ampL: this.ampL,
      ampR: this.ampR,
    };
  }

  private setExt(pos: number, tsMs: number, posL: number, posR: number): void {
    this.ext = pos;
    this.extTs = tsMs;
    this.extL = posL;
    this.extR = posR;
    this.hasExt = true;
  }

  private onCatch(): void {
    this.lastCatch = { ts: this.extTs, pos: this.ext, posL: this.extL, posR: this.extR };
  }

  private onFinish(): void {
    const finish = { ts: this.extTs, pos: this.ext, posL: this.extL, posR: this.extR };
    const c = this.lastCatch;
    this.lastFinish = finish;
    if (!c) return;

    const driveMs = finish.ts - c.ts;
    const amp = c.pos - finish.pos; // catch is forward of finish for a real pull
    if (driveMs < this.cfg.minHalfPeriodMs || driveMs > this.cfg.maxPeriodMs) return;
    if (amp < this.cfg.minAmp) return;

    // A stroke. Period from finish-to-finish (steadier than catch-to-catch
    // when the recovery is lazy, which relaxed rowing is).
    this.count++;
    this.ampL = clamp(c.posL - finish.posL, 0, 1);
    this.ampR = clamp(c.posR - finish.posR, 0, 1);
    if (this.prevFinishTs !== null) {
      const period = finish.ts - this.prevFinishTs;
      if (period >= 2 * this.cfg.minHalfPeriodMs && period <= this.cfg.maxPeriodMs) {
        this.periodEmaMs =
          this.periodEmaMs === null ? period : this.periodEmaMs + (period - this.periodEmaMs) * 0.4;
        this.rate = 1000 / this.periodEmaMs;
        this.active = true;
      }
    }
    this.prevFinishTs = finish.ts;
  }

  /** Rate decays toward 0 once the rhythm is stale (τ = rateDecayTauMs). */
  private decayRate(tsMs: number): void {
    if (this.lastSeenTs === null || this.rate === 0) return;
    const lastRevTs = Math.max(this.lastCatch?.ts ?? -Infinity, this.lastFinish?.ts ?? -Infinity);
    const stale = !Number.isFinite(lastRevTs) || tsMs - lastRevTs > this.cfg.maxPeriodMs;
    if (!stale) return;
    const dtMs = Math.max(tsMs - this.lastSeenTs, 0);
    this.rate *= Math.exp(-dtMs / this.cfg.rateDecayTauMs);
    if (this.rate < 0.02) this.rate = 0;
  }

  /** 0 at the catch, ~0.5 at the finish, →1 approaching the next catch.
   *  An estimate against the running period — feedback UI, not physics. */
  private phaseAt(tsMs: number): number {
    if (!this.active || !this.lastCatch || this.periodEmaMs === null) return 0;
    return clamp((tsMs - this.lastCatch.ts) / this.periodEmaMs, 0, 0.999);
  }
}
