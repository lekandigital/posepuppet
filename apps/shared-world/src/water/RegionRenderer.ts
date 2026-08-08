// RegionRenderer — Checkpoint 04B app-owned counterpart of the vendored
// Renderer implementing the "region" pool type (Master §4.2 row 13: the
// pass-switch seam). The vendored Renderer/passes stay untouched and keep
// serving the stock and pool views; this orchestrator reuses the vendored
// pipeline SHAPE (object textures → caustics → pool/terrain prepare →
// surface prepare → scene draw) with the region passes.
//
// Light direction comes from the vendored WaterOpticsState so the region
// shares the demo's exact sun vector (byte-identical optics inputs).
//
// CP06 Phase One: the vendored mesh-object optical subsystem is restored
// for the regional actor — the SAME vendored WaterOpticsState instance now
// also carries the mesh descriptor (the dolphin), RegionObjectTexturePass
// renders the actor's refraction/reflection/clipped-reflection/shadow
// targets each frame, and every region pass consumes them through the
// restored vendored branches.

import * as THREE from 'three';
import { WaterOpticsState } from '../../vendor/threejs-water/src/rendering/WaterOpticsState';
import { NO_WATER_OPTICS } from '../../vendor/threejs-water/src/water/WaterOptics';
import type { WorldData } from '../world/WorldData';
import type { RegionWater } from './RegionWater';
import { WINDOW_SIZE_M } from './RegionWater';
import { RegionCausticsPass } from './RegionCausticsPass';
import { RegionObjectTexturePass, type ActorPassModeAdapter } from './RegionObjectTexturePass';
import { RegionTerrainPass } from './RegionTerrainPass';
import { RegionWaterSurfacePass } from './RegionWaterSurfacePass';
import { buildRegionContext, type RegionContext } from './regionContext';

export class RegionRenderer {
  readonly lightDir: THREE.Vector3;
  readonly ctx: RegionContext;
  readonly opticsState: WaterOpticsState;
  readonly objectTextures: RegionObjectTexturePass;
  readonly caustics: RegionCausticsPass;
  readonly terrain: RegionTerrainPass;
  readonly surface: RegionWaterSurfacePass;

  constructor(
    renderer: THREE.WebGLRenderer,
    cubemap: THREE.CubeTexture,
    data: WorldData,
    windowOrigin: THREE.Vector2,
  ) {
    this.opticsState = new WaterOpticsState();
    this.lightDir = this.opticsState.lightDirection;
    this.ctx = buildRegionContext(renderer, data, windowOrigin);
    this.objectTextures = new RegionObjectTexturePass(
      renderer,
      this.lightDir,
      this.ctx.windowOrigin,
      WINDOW_SIZE_M,
    );
    this.caustics = new RegionCausticsPass(
      renderer,
      this.lightDir,
      this.ctx,
      this.objectTextures.shadowTarget.texture,
      this.opticsState,
    );
    this.terrain = new RegionTerrainPass(
      data,
      this.lightDir,
      this.caustics.texture,
      this.ctx,
      this.opticsState,
    );
    this.surface = new RegionWaterSurfacePass(
      cubemap,
      this.caustics.texture,
      this.lightDir,
      this.ctx,
      {
        reflectionTexture: this.objectTextures.reflectionTarget.texture,
        clippedReflectionTexture: this.objectTextures.clippedReflectionTarget.texture,
        refractionTexture: this.objectTextures.refractionTarget.texture,
        viewProjectionMatrix: this.objectTextures.viewProjectionMatrix,
        reflectionViewProjectionMatrix: this.objectTextures.reflectionViewProjectionMatrix,
      },
      this.opticsState,
    );
  }

  /** All scene meshes this renderer owns (terrain tiles + surface sheets). */
  sceneMeshes(): THREE.Object3D[] {
    return [this.terrain.group, ...this.surface.meshes()];
  }

  /** CP06: declare/clear the actor mesh in the vendored optics state. */
  setActorOptics(
    optics: { center: THREE.Vector3; boundingRadius: number; shadowRadius?: number } | null,
  ) {
    this.opticsState.apply(
      optics
        ? {
            kind: 'mesh',
            center: optics.center,
            boundingRadius: optics.boundingRadius,
            shadowRadius: optics.shadowRadius,
          }
        : NO_WATER_OPTICS,
    );
  }

  /** CP06: render the actor's texture passes (vendored update flow). */
  updateObjectTextures(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    actor: THREE.Object3D | null,
    adapter: ActorPassModeAdapter | null,
  ) {
    this.objectTextures.update(
      scene,
      camera,
      this.opticsState.meshEnabled ? actor : null,
      adapter,
    );
  }

  /** CP06: keep the object targets at the vendored dynamic scale. */
  setSize(width: number, height: number) {
    this.objectTextures.setSize(width, height);
  }

  updateCaustics(water: RegionWater) {
    this.caustics.update(water);
  }

  /** cp05: per-frame chunk LOD selection + frustum culling, then the sim
   *  texture binding the graybox pass had. */
  renderTerrain(water: RegionWater, camera: THREE.Camera) {
    this.terrain.update(camera);
    this.terrain.prepare(water);
  }

  renderWater(water: RegionWater, camera: THREE.Camera) {
    this.surface.prepare(water, camera);
  }
}
