// RegionSampler — the WorldSampler seam re-pointed at the authored region
// (cp04A §3.4; Track A §4.3 re-point contract). The sim keeps asking the
// same three questions; the answers now come from the baked artifacts.
//
// Region-edge law [DERIVED integration parameter, reported at review]: the
// approved layout encloses the region naturally (deep hazard water N + S,
// reef wall E, crescent cliff W), but hazard water still reaches the data
// boundary. The sampler treats the region border like shore — inWater is
// false outside the domain and shoreDistance blends in the distance to the
// nearest border — so the sim's existing soft containment current turns the
// dolphin back long before the data runs out. No hard wall, same mechanism.

import type { WorldSampler } from '../game/worldSampler';
import type { WorldData } from './WorldData';

export class RegionSampler implements WorldSampler {
  private readonly half: number;

  // containmentBand intentionally NOT set: the region-scale SHORE_BAND
  // (55 m, SIM table) applies as-is — cp04B review item.

  constructor(readonly data: WorldData) {
    this.half = data.header.sizeMeters[0] / 2;
  }

  inWater(x: number, z: number): boolean {
    return this.data.inWater(x, z);
  }

  shoreDistance(x: number, z: number): number {
    const edge = Math.min(this.half - Math.abs(x), this.half - Math.abs(z));
    return Math.min(this.data.shoreDistance(x, z), edge);
  }

  depthAt(x: number, z: number): number {
    return this.data.depthAt(x, z);
  }

  /** cp05: activates the sim's deterministic terrain-contact model. */
  terrainHeight(x: number, z: number): number {
    return this.data.terrainHeight(x, z);
  }
}
