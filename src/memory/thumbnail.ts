// Library card thumbnails: the loop's highest-energy frame rendered as a
// small SVG skeleton in the Memory hue. Pure string assembly from the
// quantized frame data with fixed rounding — deterministic by
// construction (same loop → identical SVG, byte for byte), which the
// suite pins. No canvas, no GPU, no video anywhere near storage.

import {
  decodePoseFrame,
  decodeHandFrame,
  blankLandmarks,
  blankHand,
  type LoopCapture,
  type LoopFrame,
  type LoopKind,
} from './stream';
import { peakFrameIndex } from './energy';

type Seg = readonly [number, number];

const POSE_SEGS: readonly Seg[] = [
  [0, 7], [0, 8],                       // nose → ears
  [11, 12],                             // shoulder line
  [11, 13], [13, 15],                   // left arm
  [12, 14], [14, 16],                   // right arm
  [11, 23], [12, 24], [23, 24],         // torso
  [23, 25], [25, 27], [27, 31],         // left leg
  [24, 26], [26, 28], [28, 32],         // right leg
];

const HAND_SEGS: readonly Seg[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // index
  [5, 9], [9, 10], [10, 11], [11, 12],  // middle
  [9, 13], [13, 14], [14, 15], [15, 16],// ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // pinky + palm edge
];

const VIEW = 96;
const r1 = (v: number) => Math.round(v * VIEW * 10) / 10;

interface Pt {
  x: number;
  y: number;
  visibility?: number;
}

function svgFor(pts: Pt[], segs: readonly Seg[], joints: readonly number[]): string {
  const lines: string[] = [];
  for (const [a, b] of segs) {
    if ((pts[a].visibility ?? 1) < 0.3 || (pts[b].visibility ?? 1) < 0.3) continue;
    lines.push(
      `<line x1="${r1(pts[a].x)}" y1="${r1(pts[a].y)}" x2="${r1(pts[b].x)}" y2="${r1(pts[b].y)}"/>`,
    );
  }
  const dots = joints
    .filter((i) => (pts[i].visibility ?? 1) >= 0.3)
    .map((i) => `<circle cx="${r1(pts[i].x)}" cy="${r1(pts[i].y)}" r="2.2"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" class="mml-thumb-svg">` +
    `<g stroke="#9d7bff" stroke-width="2" stroke-linecap="round" fill="none">${lines.join('')}</g>` +
    `<g fill="#9d7bff">${dots}</g></svg>`
  );
}

/** SVG skeleton of one frame (norm coordinates, already 0..1). */
export function frameThumbnail(frame: LoopFrame, kind: LoopKind): string {
  if (kind === 'pose') {
    const world = blankLandmarks();
    const norm = blankLandmarks();
    decodePoseFrame(frame, world, norm);
    return svgFor(norm, POSE_SEGS, [0, 15, 16]);
  }
  const hand = blankHand();
  decodeHandFrame(frame, hand);
  return svgFor(hand, HAND_SEGS, [0]);
}

/** SVG skeleton of the loop's highest-energy frame — the library card art. */
export function loopThumbnail(loop: Pick<LoopCapture, 'frames' | 'kind'>): string {
  if (!loop.frames.length) return svgFor([], [], []);
  return frameThumbnail(loop.frames[peakFrameIndex(loop.frames, loop.kind)], loop.kind);
}
