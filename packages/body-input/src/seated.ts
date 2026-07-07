// Seated auto-detection: a hysteresis state machine over two conditions —
// (A) both thighs near horizontal (knees visible), or (B) hips tracked while
// knees+ankles are not AND the image-space shoulder line has dropped at
// least one shoulder-width below the standing neutral. Unknown frames hold
// the current state (no flapping on brief occlusion).

import type { Measure, NeutralState } from './extract';
import type { ExtractionConfig } from './types';

export function seatedCondition(m: Measure, neutral: NeutralState | null): boolean | null {
  if (!m.ok) return null;
  if (m.thighsHorizontal !== null) return m.thighsHorizontal;
  if (
    m.hipsVisible && !m.kneesVisible && !m.anklesVisible &&
    neutral !== null && neutral.shoulderNormY !== null &&
    neutral.shoulderWidthNorm !== null && m.shoulderNormY !== null
  ) {
    return m.shoulderNormY - neutral.shoulderNormY > neutral.shoulderWidthNorm * 1.0;
  }
  return null; // unknown — hold state
}

export class SeatedDetector {
  private seated = false;
  private condSince: number | null = null;
  private notCondSince: number | null = null;

  reset(): void {
    this.seated = false;
    this.condSince = null;
    this.notCondSince = null;
  }

  /** Returns the debounced state and whether it flipped on this frame. */
  step(cond: boolean | null, tsMs: number, cfg: ExtractionConfig): { seated: boolean; flipped: boolean } {
    if (cond === null) {
      this.condSince = null;
      this.notCondSince = null;
      return { seated: this.seated, flipped: false };
    }
    let flipped = false;
    if (cond) {
      this.notCondSince = null;
      if (!this.seated) {
        if (this.condSince === null) this.condSince = tsMs;
        if (tsMs - this.condSince >= cfg.seatedEnterMs) {
          this.seated = true;
          flipped = true;
          this.condSince = null;
        }
      }
    } else {
      this.condSince = null;
      if (this.seated) {
        if (this.notCondSince === null) this.notCondSince = tsMs;
        if (tsMs - this.notCondSince >= cfg.seatedExitMs) {
          this.seated = false;
          flipped = true;
          this.notCondSince = null;
        }
      }
    }
    return { seated: this.seated, flipped };
  }
}
