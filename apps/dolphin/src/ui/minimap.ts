// The "this is a real bay" proof: the corner minimap renders the ACTUAL
// boundary polygon from boundary.json plus the dolphin's position and
// heading. The ODbL attribution renders with it — data credit lives
// where the data shows.

import type { BoundaryData } from '@bodyarcade/world-data';

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private path: Path2D;
  private sx: number;
  private sy: number;
  private ox: number;
  private oy: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private boundary: BoundaryData,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const [minx, miny, maxx, maxy] = boundary.bbox;
    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - 30 - pad * 2; // room for the attribution line
    const s = Math.min(w / (maxx - minx), h / (maxy - miny));
    this.sx = s;
    this.sy = -s; // boundary y = north-up; canvas y grows down
    this.ox = pad + (w - (maxx - minx) * s) / 2 - minx * s;
    this.oy = pad + (h - (maxy - miny) * s) / 2 + maxy * s;
    this.path = new Path2D();
    for (const poly of boundary.polygons) {
      for (const ring of [poly.outer, ...poly.holes.map((hh) => hh.ring)]) {
        ring.forEach(([x, y], i) => {
          const px = this.ox + x * this.sx;
          const py = this.oy + y * this.sy;
          if (i === 0) this.path.moveTo(px, py);
          else this.path.lineTo(px, py);
        });
        this.path.closePath();
      }
    }
  }

  /** boundary-metre position + heading (game yaw). */
  draw(bx: number, by: number, yaw: number): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20, 90, 140, 0.75)';
    ctx.fill(this.path, 'evenodd');
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.stroke(this.path);
    // dolphin dot + heading tick
    const px = this.ox + bx * this.sx;
    const py = this.oy + by * this.sy;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px, py);
    // game yaw 0 = −boundary-y (south on the map, since game z = −by)
    ctx.lineTo(px + Math.sin(yaw) * 8, py + Math.cos(yaw) * 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(191, 233, 255, 0.9)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(this.boundary.displayName, 10, canvas.height - 18);
    ctx.fillText(`${this.boundary.source.attribution} (ODbL)`, 10, canvas.height - 6);
  }
}
