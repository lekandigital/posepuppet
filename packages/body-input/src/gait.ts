// Gait (step) detection — the Rowing periodic-motion primitive carried to
// the legs. Lives in the package because landmarks never cross the
// transport: games receive steps/cadence/weight-shift, never knees.
//
// Two measured substrates, ONE detector:
//   'legs' — signed vertical knee-lift difference between the legs, in
//     thigh-length units (+ = the user's LEFT knee high = weight over
//     their right foot). Marching-in-place swings this ±0.4..1.0; a still
//     stance holds it near a constant offset. Needs knees in frame.
//   'sway' — image-space lateral hip-center excursion in shoulder-width
//     units, DC-removed by a slow EMA reference upstream (the swim
//     detector's self-normalization pattern). Weight-shift walking swings
//     this ±0.1..0.4 and needs no leg visibility at all — the desk-framing
//     substrate (PPC eases invisible legs to rest; hips stay tracked).
//
// The frame's signal is 'legs' when knee data is fresh, else 'sway'. A
// source switch REBASES the extremum state (counters, cadence, and the
// step rhythm survive; the level discontinuity between the two signals
// can never read as a reversal).
//
// Reversal detection is the stroke detector's position Schmitt trigger: a
// reversal registers when the filtered signal retreats `reversalHys` from
// the running extremum — immune to velocity-sign flicker at the turn.
// Unlike rowing (one stroke per cycle, counted at the finish), gait counts
// a step at EVERY qualified reversal: each direction change of the
// left/right alternation is one footfall. Cadence is steps/second from an
// EMA of step intervals; it decays once the rhythm is stale. Everything
// runs on frame timestamps only, so a recorded stream replays
// byte-identically.

import { OneEuro } from './oneEuro';
import type { BodyGait, GaitConfig, GaitSource, GaitSourceConfig } from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const clamp01 = (v: number): number => clamp(v, 0, 1);

type Direction = 'unknown' | 'up' | 'down';

export class GaitDetector {
  private filters: Record<GaitSource, OneEuro>;

  private source: GaitSource | null = null;
  private dir: Direction = 'unknown';
  /** running extremum of the filtered signal since the last reversal */
  private ext = 0;
  private extTs = 0;
  private hasExt = false;
  /** in 'unknown' we track both ends until one breaks the hysteresis */
  private unkMin = 0;
  private unkMax = 0;
  /** last hysteresis-confirmed reversal (the previous footfall candidate) */
  private prevExt: { pos: number; ts: number } | null = null;

  private count = 0;
  private cadence = 0;
  private amp = 0;
  private shift = 0;
  private active = false;
  private stepIntervalEmaMs: number | null = null;
  private lastStepTs: number | null = null;
  private lastSeenTs: number | null = null;
  private lastSource: BodyGait['source'] = 'none';

  constructor(private cfg: GaitConfig) {
    this.filters = {
      legs: new OneEuro(cfg.march.oneEuro.minCutoff, cfg.march.oneEuro.beta),
      sway: new OneEuro(cfg.sway.oneEuro.minCutoff, cfg.sway.oneEuro.beta),
    };
  }

  configure(cfg: GaitConfig): void {
    this.cfg = cfg;
    this.filters.legs.minCutoff = cfg.march.oneEuro.minCutoff;
    this.filters.legs.beta = cfg.march.oneEuro.beta;
    this.filters.sway.minCutoff = cfg.sway.oneEuro.minCutoff;
    this.filters.sway.beta = cfg.sway.oneEuro.beta;
  }

  reset(): void {
    this.filters.legs.reset();
    this.filters.sway.reset();
    this.source = null;
    this.dir = 'unknown';
    this.hasExt = false;
    this.prevExt = null;
    this.count = 0;
    this.cadence = 0;
    this.amp = 0;
    this.shift = 0;
    this.active = false;
    this.stepIntervalEmaMs = null;
    this.lastStepTs = null;
    this.lastSeenTs = null;
    this.lastSource = 'none';
  }

  /**
   * Advance one frame. `legs` is the knee-lift difference (thigh lengths,
   * null when knees/hips aren't measurable); `sway` is the DC-removed hip
   * excursion (shoulder widths, null when hips aren't in frame). Call with
   * both null on dropout frames — rhythm decays, never spikes.
   */
  step(tsMs: number, legs: number | null, sway: number | null): void {
    const source: GaitSource | null = legs !== null ? 'legs' : sway !== null ? 'sway' : null;
    if (source === null) {
      this.decay(tsMs);
      this.lastSource = 'none';
      return;
    }
    if (source !== this.source) {
      // Rebase: the two signals live at unrelated levels — restarting the
      // extremum tracking (and the new source's filter) keeps the switch
      // from ever reading as a reversal. Count/cadence/rhythm survive.
      this.filters[source].reset();
      this.dir = 'unknown';
      this.hasExt = false;
      this.prevExt = null;
      this.source = source;
    }
    const scfg = source === 'legs' ? this.cfg.march : this.cfg.sway;
    const raw = source === 'legs' ? legs! : sway!;
    const pos = this.filters[source].filter(raw, tsMs);

    this.shift = clamp(pos * scfg.shiftScale, -1, 1);
    this.staleness(tsMs);
    this.lastSeenTs = tsMs;
    this.lastSource = source;

    const hys = scfg.reversalHys;

    if (this.dir === 'unknown') {
      if (!this.hasExt) {
        this.unkMin = pos;
        this.unkMax = pos;
        this.hasExt = true;
        this.setExt(pos, tsMs);
        return;
      }
      this.unkMin = Math.min(this.unkMin, pos);
      this.unkMax = Math.max(this.unkMax, pos);
      if (pos > this.unkMin + hys) {
        this.dir = 'up';
        this.setExt(pos, tsMs);
      } else if (pos < this.unkMax - hys) {
        this.dir = 'down';
        this.setExt(pos, tsMs);
      }
      return;
    }

    if (this.dir === 'up') {
      if (pos >= this.ext) {
        this.setExt(pos, tsMs);
      } else if (this.ext - pos > hys) {
        this.onReversal(scfg);
        this.dir = 'down';
        this.setExt(pos, tsMs);
      }
      return;
    }

    // dir === 'down'
    if (pos <= this.ext) {
      this.setExt(pos, tsMs);
    } else if (pos - this.ext > hys) {
      this.onReversal(scfg);
      this.dir = 'up';
      this.setExt(pos, tsMs);
    }
  }

  /** Dropout path: nothing to measure — cadence/activity decay, the shift
   *  axis eases to center, extremum state holds (a flickering track must
   *  not restart the alternation every few frames). */
  decay(tsMs: number): void {
    this.staleness(tsMs);
    if (this.lastSeenTs !== null) {
      const dtMs = Math.max(tsMs - this.lastSeenTs, 0);
      this.shift *= Math.exp(-dtMs / 400);
      if (Math.abs(this.shift) < 1e-3) this.shift = 0;
    }
    this.lastSeenTs = tsMs;
  }

  snapshot(tsMs: number): BodyGait {
    return {
      active: this.active,
      count: this.count,
      cadence: this.cadence,
      phase: this.phaseAt(tsMs),
      amp: this.amp,
      shift: this.shift,
      source: this.lastSource,
    };
  }

  private setExt(pos: number, tsMs: number): void {
    this.ext = pos;
    this.extTs = tsMs;
    this.hasExt = true;
  }

  /** A hysteresis-confirmed reversal — a footfall candidate at the stored
   *  extremum. Counts as a step when the peak-to-peak excursion from the
   *  previous reversal clears the source's amplitude floor and the timing
   *  is physiologically sane. */
  private onReversal(scfg: GaitSourceConfig): void {
    const at = { pos: this.ext, ts: this.extTs };
    const prev = this.prevExt;
    this.prevExt = at;
    if (!prev) return;

    const excursion = Math.abs(at.pos - prev.pos);
    const stepMs = at.ts - prev.ts;
    if (excursion < scfg.minAmp) return;
    if (stepMs < this.cfg.minStepMs || stepMs > this.cfg.maxStepMs) return;

    // A step.
    this.count++;
    this.amp = clamp01(excursion / scfg.ampNorm);
    if (this.lastStepTs !== null) {
      const interval = at.ts - this.lastStepTs;
      if (interval >= this.cfg.minStepMs && interval <= this.cfg.maxStepMs) {
        this.stepIntervalEmaMs =
          this.stepIntervalEmaMs === null
            ? interval
            : this.stepIntervalEmaMs + (interval - this.stepIntervalEmaMs) * 0.4;
        this.cadence = clamp(1000 / this.stepIntervalEmaMs, 0, 3.5);
        this.active = true;
      }
    }
    this.lastStepTs = at.ts;
  }

  /** No step for 1.5× the slowest allowed interval = the rhythm is broken:
   *  active drops, cadence decays toward 0, and the next rhythm needs two
   *  fresh steps before cadence re-establishes (mirrors the stroke
   *  detector's stale-period reset). */
  private staleness(tsMs: number): void {
    if (this.lastStepTs === null) return;
    const stale = tsMs - this.lastStepTs > this.cfg.maxStepMs * 1.5;
    if (!stale) return;
    if (this.active || this.stepIntervalEmaMs !== null) {
      this.active = false;
      this.stepIntervalEmaMs = null;
    }
    if (this.cadence > 0 && this.lastSeenTs !== null) {
      const dtMs = Math.max(tsMs - this.lastSeenTs, 0);
      this.cadence *= Math.exp(-dtMs / this.cfg.cadenceDecayTauMs);
      if (this.cadence < 0.02) this.cadence = 0;
    }
  }

  /** 0 at the last footfall, →1 approaching the next. An estimate against
   *  the running step interval — feedback UI, not physics. */
  private phaseAt(tsMs: number): number {
    if (!this.active || this.lastStepTs === null || this.stepIntervalEmaMs === null) return 0;
    return clamp((tsMs - this.lastStepTs) / this.stepIntervalEmaMs, 0, 0.999);
  }
}
