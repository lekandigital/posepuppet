// Per-axis shaping pipeline: raw → One Euro → dead zone → expo → slew →
// clamp. Each shaper is a pure state machine over (value, tsMs). A null raw
// value (axis unavailable: occlusion, missing neutral) decays the output
// toward neutral (0) with the axis' time constant — no NaNs, no snaps; the
// slew stage bounds the re-acquisition step.

import { OneEuro } from './oneEuro';
import type { AxisShapingConfig } from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** symmetric dead zone with rescale so the live range stays continuous */
export function deadZone(v: number, width: number): number {
  if (width <= 0) return v;
  const a = Math.abs(v);
  if (a < width) return 0;
  return (Math.sign(v) * (a - width)) / (1 - width);
}

/** RC-style expo: k=0 linear, k=1 fully cubic (soft center, live ends) */
export function expo(v: number, k: number): number {
  return v * (1 - k) + v * v * v * k;
}

export class AxisShaper {
  private euro: OneEuro;
  private out = 0;
  private lastTs: number | null = null;

  constructor(
    public cfg: AxisShapingConfig,
    private lo: number,
    private hi: number,
  ) {
    this.euro = new OneEuro(cfg.oneEuro.minCutoff, cfg.oneEuro.beta);
  }

  setConfig(cfg: AxisShapingConfig): void {
    this.cfg = cfg;
    this.euro.minCutoff = cfg.oneEuro.minCutoff;
    this.euro.beta = cfg.oneEuro.beta;
  }

  reset(): void {
    this.euro.reset();
    this.out = 0;
    this.lastTs = null;
  }

  get value(): number {
    return this.out;
  }

  step(raw: number | null, tsMs: number): number {
    const dt = this.lastTs === null ? 1 / 30 : clamp((tsMs - this.lastTs) / 1000, 1e-4, 0.25);
    this.lastTs = tsMs;

    if (raw === null) {
      this.euro.reset(); // filter re-seeds on re-acquisition; slew bounds the step
      this.out *= Math.exp((-dt * 1000) / this.cfg.decayTauMs);
      if (Math.abs(this.out) < 1e-4) this.out = 0;
      return this.out;
    }

    let v = this.euro.filter(raw, tsMs);
    v = deadZone(v, this.cfg.deadZone);
    v = expo(v, this.cfg.expo);
    const maxStep = this.cfg.slewPerSec * dt;
    v = clamp(v, this.out - maxStep, this.out + maxStep);
    this.out = clamp(v, this.lo, this.hi);
    return this.out;
  }
}
