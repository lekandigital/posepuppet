// The WorldSampler seam (Implementation Master §3.2): the sim asks the
// world three questions and never knows what answers them. Checkpoint 01
// answers analytically for the vendored demo pool; checkpoint 04A swaps
// in the baked-region loader without touching the sim.

export interface WorldSampler {
  /** Is (x, z) inside swimmable water? */
  inWater(x: number, z: number): boolean;
  /** Signed distance to the nearest shore/wall in metres (+ = water). */
  shoreDistance(x: number, z: number): number;
  /** Local water depth in metres (positive down). */
  depthAt(x: number, z: number): number;
  /**
   * Width of the sim's soft containment band, metres. The SIM table keeps
   * the region-scale SHORE_BAND (55 m, cp04B review item); a sampler whose
   * world is smaller than the band declares its own so the containment
   * current stays a wall cushion instead of a whole-world centering
   * pull. [DERIVED integration parameter — see the cp01 deviations list.]
   */
  containmentBand?: number;
  /**
   * cp05: analytic terrain height (metres, y-up; < 0 = seabed). When a
   * sampler provides it, the sim's deterministic terrain-contact model
   * (slide + anti-wedge, cp05 §6) activates. The pool sampler does NOT
   * provide it — pool behavior and its committed replay digests are
   * unchanged by construction.
   */
  terrainHeight?(x: number, z: number): number;
}

/**
 * Analytic sampler for the vendored jeantimex pool mounted at
 * K = 7.5 m/demo-unit (Master §7.7): interior 15 m × 15 m, 7.5 m deep,
 * sea level y 0. Deleted with the region at cp04A.
 */
export class PoolSampler implements WorldSampler {
  /** 2.5 m wall cushion ≈ pool half-width/3 (≈ one body length). */
  readonly containmentBand = 2.5;

  constructor(
    /** pool half-extent in metres (demo ±1 × K) */
    readonly half = 7.5,
    /** pool depth in metres (demo poolHeight 1 × K) */
    readonly depth = 7.5,
  ) {}

  inWater(x: number, z: number): boolean {
    return Math.abs(x) < this.half && Math.abs(z) < this.half;
  }

  /** Distance to the nearest wall (negative outside). */
  shoreDistance(x: number, z: number): number {
    return Math.min(this.half - Math.abs(x), this.half - Math.abs(z));
  }

  depthAt(_x: number, _z: number): number {
    return this.depth;
  }
}
