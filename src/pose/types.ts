export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** One detected pose frame: normalized image-space + metric world landmarks. */
export interface PoseFrame {
  norm: LandmarkPoint[];
  world: LandmarkPoint[];
  videoTimeMs: number;
  wallTimeMs: number;
}
