// Landmark-space mirroring: swap left/right indices and negate x.
// After this transform the landmark set describes the user's reflection,
// which is what the avatar enacts when mirror mode is ON (default).

import { MIRROR_PAIRS } from './indices';
import type { LandmarkPoint } from './types';

const SWAP_INDEX: number[] = Array.from({ length: 33 }, (_, i) => i);
for (const [a, b] of MIRROR_PAIRS) {
  SWAP_INDEX[a] = b;
  SWAP_INDEX[b] = a;
}

/** Mirrors normalized image-space landmarks (x in [0,1] → 1−x). */
export function mirrorNorm(src: LandmarkPoint[], dst: LandmarkPoint[]): LandmarkPoint[] {
  for (let i = 0; i < 33; i++) {
    const s = src[SWAP_INDEX[i]];
    const d = dst[i] ?? (dst[i] = { x: 0, y: 0, z: 0, visibility: 0 });
    d.x = 1 - s.x;
    d.y = s.y;
    d.z = s.z;
    d.visibility = s.visibility;
  }
  return dst;
}

/** Mirrors metric world landmarks (hip-centered, x → −x). */
export function mirrorWorld(src: LandmarkPoint[], dst: LandmarkPoint[]): LandmarkPoint[] {
  for (let i = 0; i < 33; i++) {
    const s = src[SWAP_INDEX[i]];
    const d = dst[i] ?? (dst[i] = { x: 0, y: 0, z: 0, visibility: 0 });
    d.x = -s.x;
    d.y = s.y;
    d.z = s.z;
    d.visibility = s.visibility;
  }
  return dst;
}
