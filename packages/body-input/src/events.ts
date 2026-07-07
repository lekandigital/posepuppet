// Event machines: threshold + hysteresis + N-frame debounce + refractory.
// Events are transition-triggered — a held pose fires exactly once — so a
// replayed stream reproduces the identical event frames.

export class HoldToFire {
  private heldSince: number | null = null;
  private lastFired = -Infinity;

  constructor(
    private holdMs: number,
    private refractoryMs: number,
  ) {}

  configure(holdMs: number, refractoryMs: number): void {
    this.holdMs = holdMs;
    this.refractoryMs = refractoryMs;
  }

  reset(): void {
    this.heldSince = null;
    this.lastFired = -Infinity;
  }

  step(cond: boolean, tsMs: number): boolean {
    if (!cond) {
      this.heldSince = null;
      return false;
    }
    if (tsMs - this.lastFired < this.refractoryMs) return false;
    if (this.heldSince === null) this.heldSince = tsMs;
    if (tsMs - this.heldSince >= this.holdMs) {
      this.lastFired = tsMs;
      this.heldSince = null;
      return true;
    }
    return false;
  }
}

export interface ImpulseConfig {
  enter: number;
  exit: number;
  minRatePerSec: number;
  debounceFrames: number;
  refractoryMs: number;
}

/** Fires when the value crosses `enter` fast (≥ minRate at the crossing) and
 *  stays above for N frames; re-arms only after dropping below `exit`. */
export class ImpulseDetector {
  private armed = true;
  private qualifying = 0;
  private crossFast = false;
  private lastFired = -Infinity;
  private prev: number | null = null;
  private prevTs: number | null = null;

  constructor(private cfg: ImpulseConfig) {}

  configure(cfg: ImpulseConfig): void {
    this.cfg = cfg;
  }

  reset(): void {
    this.armed = true;
    this.qualifying = 0;
    this.crossFast = false;
    this.lastFired = -Infinity;
    this.prev = null;
    this.prevTs = null;
  }

  step(value: number, tsMs: number): boolean {
    const dt = this.prevTs === null ? null : Math.max((tsMs - this.prevTs) / 1000, 1e-4);
    const rate = this.prev === null || dt === null ? 0 : (value - this.prev) / dt;
    const crossedUp = this.prev !== null && this.prev < this.cfg.enter && value >= this.cfg.enter;
    this.prev = value;
    this.prevTs = tsMs;

    if (!this.armed) {
      if (value < this.cfg.exit) {
        this.armed = true;
        this.qualifying = 0;
        this.crossFast = false;
      }
      return false;
    }
    if (tsMs - this.lastFired < this.cfg.refractoryMs) return false;

    if (crossedUp) {
      this.crossFast = rate >= this.cfg.minRatePerSec;
      this.qualifying = this.crossFast ? 1 : 0;
      return false;
    }
    if (value >= this.cfg.enter && this.crossFast) {
      this.qualifying++;
      if (this.qualifying >= this.cfg.debounceFrames) {
        this.lastFired = tsMs;
        this.armed = false;
        this.qualifying = 0;
        this.crossFast = false;
        return true;
      }
    } else if (value < this.cfg.enter) {
      this.qualifying = 0;
      this.crossFast = false;
    }
    return false;
  }
}
