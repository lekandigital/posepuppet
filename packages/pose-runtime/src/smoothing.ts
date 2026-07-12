// Landmark smoothing bank: One Euro per axis per landmark on the metric
// world landmarks (the input to all rotation math), plus an EMA on
// visibility so the gate doesn't flap. Runs AFTER mirroring so filter state
// stays continuous in the space the avatar enacts.

import { OneEuro } from './oneEuro';
import type { LandmarkPoint } from './types';

export class LandmarkSmoother {
  private fx: OneEuro[] = [];
  private fy: OneEuro[] = [];
  private fz: OneEuro[] = [];
  private vis: number[] = [];
  private out: LandmarkPoint[] = [];
  enabled = true;

  constructor(count = 33) {
    for (let i = 0; i < count; i++) {
      this.fx.push(new OneEuro());
      this.fy.push(new OneEuro());
      this.fz.push(new OneEuro());
      this.vis.push(0);
      this.out.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }
  }

  setParams(minCutoff: number, beta: number): void {
    for (const bank of [this.fx, this.fy, this.fz]) {
      for (const f of bank) {
        f.minCutoff = minCutoff;
        f.beta = beta;
      }
    }
  }

  reset(): void {
    for (const bank of [this.fx, this.fy, this.fz]) for (const f of bank) f.reset();
    this.vis.fill(0);
  }

  apply(src: LandmarkPoint[], tMs: number): LandmarkPoint[] {
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      const o = this.out[i];
      // visibility EMA — smooths gate transitions either way
      this.vis[i] = this.vis[i] * 0.7 + s.visibility * 0.3;
      o.visibility = this.vis[i];
      if (this.enabled) {
        o.x = this.fx[i].filter(s.x, tMs);
        o.y = this.fy[i].filter(s.y, tMs);
        o.z = this.fz[i].filter(s.z, tMs);
      } else {
        o.x = s.x;
        o.y = s.y;
        o.z = s.z;
      }
    }
    return this.out;
  }
}
