// Temporal mask buffer: raw per-frame confidence masks flicker at the
// edges (hair, fingers, chair backs). This buffer EMA-smooths confidence
// per pixel, maps it through a soft threshold band into an alpha channel,
// and keeps a running edge-flicker statistic (mean |Δalpha| across
// consecutive smoothed masks) that the eval asserts against. The output
// is a small RGBA canvas (white, alpha = person) consumers scale up with
// a feathering blur at draw time.

export interface MaskStats {
  /** mean |Δalpha| per pixel (0..1) between the last two smoothed masks */
  flicker: number;
  /** fraction of pixels currently counted as person (0..1) */
  coverage: number;
  /** person bounding box, normalized 0..1; null when nobody is masked */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
}

// soft threshold band: below LO fully background, above HI fully person
const LO = 0.35;
const HI = 0.75;

export class MaskBuffer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ema: Float32Array | null = null;
  private prevAlpha: Uint8ClampedArray | null = null;
  private img: ImageData | null = null;
  private w = 0;
  private h = 0;
  private flicker = 0;
  private coverage = 0;
  private bbox: MaskStats['bbox'] = null;

  constructor(private alpha = 0.55) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /** Feed one confidence mask (row-major floats 0..1). Resizing resets. */
  ingest(conf: Float32Array, w: number, h: number): void {
    if (w !== this.w || h !== this.h || !this.ema) {
      this.w = w;
      this.h = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.ema = new Float32Array(w * h);
      this.ema.set(conf.subarray(0, w * h));
      this.prevAlpha = null;
      this.img = this.ctx.createImageData(w, h);
      // white fill once; only alpha changes per frame
      const d = this.img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = 255;
      }
    }
    const ema = this.ema;
    const a = this.alpha;
    const n = w * h;
    const d = this.img!.data;
    let deltaSum = 0;
    let cover = 0;
    let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
    const band = HI - LO;
    for (let i = 0; i < n; i++) {
      const v = (ema[i] = a * conf[i] + (1 - a) * ema[i]);
      // smoothstep across the [LO, HI] band
      let t = (v - LO) / band;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const al = (t * t * (3 - 2 * t) * 255) | 0;
      if (this.prevAlpha) deltaSum += Math.abs(al - this.prevAlpha[i]);
      if (al > 127) {
        cover++;
        const x = i % w;
        const y = (i / w) | 0;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
      d[i * 4 + 3] = al;
    }
    if (this.prevAlpha) this.flicker = deltaSum / n / 255;
    else this.prevAlpha = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) this.prevAlpha[i] = d[i * 4 + 3];
    this.coverage = cover / n;
    this.bbox =
      bx1 < 0 ? null : { x0: bx0 / w, y0: by0 / h, x1: (bx1 + 1) / w, y1: (by1 + 1) / h };
    this.ctx.putImageData(this.img!, 0, 0);
  }

  stats(): MaskStats {
    return { flicker: this.flicker, coverage: this.coverage, bbox: this.bbox };
  }

  reset(): void {
    this.ema = null;
    this.prevAlpha = null;
    this.flicker = 0;
    this.coverage = 0;
  }
}
