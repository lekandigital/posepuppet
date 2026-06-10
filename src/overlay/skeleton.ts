// 2D skeleton overlay drawn in raw video pixel coordinates. The canvas is
// CSS-mirrored together with the video, so no coordinate flipping here.

import { CONNECTIONS, LM } from '../pose/indices';
import type { LandmarkPoint } from '../pose/types';

const VIS_MIN = 0.5;

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  norm: LandmarkPoint[] | null,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  if (!norm) return;

  const lw = Math.max(2, w * 0.008);
  ctx.lineCap = 'round';

  for (const [a, b] of CONNECTIONS) {
    const pa = norm[a];
    const pb = norm[b];
    const vis = Math.min(pa.visibility, pb.visibility);
    if (vis < VIS_MIN) continue;
    ctx.strokeStyle = `rgba(76, 194, 255, ${(0.35 + 0.65 * vis).toFixed(2)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }

  for (let i = 0; i < norm.length; i++) {
    const p = norm[i];
    if (p.visibility < VIS_MIN) continue;
    const isWrist = i === LM.leftWrist || i === LM.rightWrist;
    ctx.fillStyle = isWrist ? '#ffd34c' : '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, isWrist ? lw * 1.6 : lw * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}
