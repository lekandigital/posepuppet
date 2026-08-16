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
//
// cp09: the CaveField overlays the cave-interior law (CP09 §6 — analytic
// containment inside the 120 Hz step). Inside a cave channel: the floor is
// the module's interior floor, the walls are the "shore" (the existing soft
// containment current becomes the wall cushion), the bore is water even
// where the mask says land, and a ceiling answer appears. Every override
// blends by the CaveField weight, is a pure function of the committed
// caves.json, and is EXACTLY the open-water law wherever the weight is 0 —
// open-water behavior and replay digests that never enter a cave are
// unchanged by construction.

import type { WorldSampler } from '../game/worldSampler';
import type { WorldData } from './WorldData';
import { CaveField } from './CaveField';
import { SIM } from '../game/sim';

export class RegionSampler implements WorldSampler {
  private readonly half: number;
  readonly caveField: CaveField;

  // containmentBand intentionally NOT set: the region-scale SHORE_BAND
  // (55 m, SIM table) applies as-is — cp04B review item.

  constructor(readonly data: WorldData) {
    this.half = data.header.sizeMeters[0] / 2;
    this.caveField = new CaveField(data.caves);
  }

  inWater(x: number, z: number): boolean {
    return this.caveField.effInWater(x, z, this.data.inWater(x, z));
  }

  shoreDistance(x: number, z: number): number {
    const edge = Math.min(this.half - Math.abs(x), this.half - Math.abs(z));
    const real = Math.min(this.data.shoreDistance(x, z), edge);
    return this.caveField.effShoreDistance(x, z, real, SIM.SHORE_BAND);
  }

  depthAt(x: number, z: number): number {
    return Math.max(0, -this.terrainHeight(x, z));
  }

  /** cp05: activates the sim's deterministic terrain-contact model.
   *  cp09: inside a cave channel the answer is the interior floor. */
  terrainHeight(x: number, z: number): number {
    return this.caveField.effTerrainHeight(x, z, this.data.terrainHeight(x, z));
  }

  /** cp09: cave-interior water ceiling (Infinity in open water). */
  ceilingAt(x: number, z: number): number {
    return this.caveField.effCeiling(x, z);
  }
}
