// RegionRenderer — Checkpoint 04B app-owned counterpart of the vendored
// Renderer implementing the "region" pool type (Master §4.2 row 13: the
// pass-switch seam). The vendored Renderer/passes stay untouched and keep
// serving the stock and pool views; this orchestrator reuses the vendored
// pipeline SHAPE (caustics → pool/terrain prepare → surface prepare →
// scene draw) with the region passes.
//
// Light direction comes from the vendored WaterOpticsState so the region
// shares the demo's exact sun vector (byte-identical optics inputs).

import * as THREE from 'three';
import { WaterOpticsState } from '../../vendor/threejs-water/src/rendering/WaterOpticsState';
import type { WorldData } from '../world/WorldData';
import type { RegionWater } from './RegionWater';
import { RegionCausticsPass } from './RegionCausticsPass';
import { RegionTerrainPass } from './RegionTerrainPass';
import { RegionWaterSurfacePass } from './RegionWaterSurfacePass';
import { buildRegionContext, type RegionContext } from './regionContext';

export class RegionRenderer {
  readonly lightDir: THREE.Vector3;
  readonly ctx: RegionContext;
  readonly caustics: RegionCausticsPass;
  readonly terrain: RegionTerrainPass;
  readonly surface: RegionWaterSurfacePass;

  constructor(
    renderer: THREE.WebGLRenderer,
    cubemap: THREE.CubeTexture,
    data: WorldData,
    windowOrigin: THREE.Vector2,
  ) {
    this.lightDir = new WaterOpticsState().lightDirection;
    this.ctx = buildRegionContext(renderer, data, windowOrigin);
    this.caustics = new RegionCausticsPass(renderer, this.lightDir, this.ctx);
    this.terrain = new RegionTerrainPass(data, this.lightDir, this.caustics.texture, this.ctx);
    this.surface = new RegionWaterSurfacePass(
      cubemap, this.caustics.texture, this.lightDir, this.ctx,
    );
  }

  /** All scene meshes this renderer owns (terrain + surface sheets). */
  sceneMeshes(): THREE.Object3D[] {
    return [this.terrain.mesh, ...this.surface.meshes()];
  }

  updateCaustics(water: RegionWater) {
    this.caustics.update(water);
  }

  renderTerrain(water: RegionWater) {
    this.terrain.prepare(water);
  }

  renderWater(water: RegionWater, camera: THREE.Camera) {
    this.surface.prepare(water, camera);
  }
}
