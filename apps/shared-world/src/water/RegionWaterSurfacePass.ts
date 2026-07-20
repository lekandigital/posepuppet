// RegionWaterSurfacePass — Checkpoint 04B app-owned copy of the vendored
// WaterSurfacePass implementing the "region" surface (Master §4.2 rows
// "surface mesh extent" / §4.3): one global calm plane at y = 0 spanning
// the 2000 × 2000 m region, realized as
//
//   - a 400×400-segment window mesh riding the snapped sim window (the
//     same 1.28-texels-per-segment density the vendored 200-segment mesh
//     has over its 256-texel sim), displaced by the windowed sim through
//     the cosine falloff; and
//   - a flat 4-quad border sheet covering region-minus-window at exactly
//     y = uSeaLevel — watertight against the window mesh because the
//     falloff reaches zero at the window edge.
//
// Both use the same materials (above = BackSide, below = FrontSide, the
// vendored two-mesh discipline); the fragment shaders carry the container
// swap. The border geometry is rebuilt (16 vertices) whenever the window
// snaps.

import * as THREE from 'three';
import type { WaterOpticsState } from '../../vendor/threejs-water/src/rendering/WaterOpticsState';
import type { RegionWater } from './RegionWater';
import { WINDOW_SIZE_M } from './RegionWater';
import { regionUniforms, type RegionContext } from './regionContext';
import regionWaterSurfaceVert from './shaders/RegionWaterSurface.vert';
import regionWaterAboveFrag from './shaders/RegionWaterAbove.frag';
import regionWaterBelowFrag from './shaders/RegionWaterBelow.frag';

/** Object-pass texture/matrix inputs (the vendored WaterSurfacePass shape,
 *  restored at CP06 for the regional actor's mesh optics). */
export interface RegionObjectTextureInputs {
  reflectionTexture: THREE.Texture;
  clippedReflectionTexture: THREE.Texture;
  refractionTexture: THREE.Texture;
  viewProjectionMatrix: THREE.Matrix4;
  reflectionViewProjectionMatrix: THREE.Matrix4;
}

export class RegionWaterSurfacePass {
  readonly aboveWindowMesh: THREE.Mesh;
  readonly belowWindowMesh: THREE.Mesh;
  readonly aboveBorderMesh: THREE.Mesh;
  readonly belowBorderMesh: THREE.Mesh;

  private readonly aboveMaterial: THREE.ShaderMaterial;
  private readonly belowMaterial: THREE.ShaderMaterial;
  private readonly borderGeometry: THREE.BufferGeometry;
  private readonly borderPositions: Float32Array;

  constructor(
    cubemap: THREE.CubeTexture,
    causticTexture: THREE.Texture,
    lightDirection: THREE.Vector3,
    private readonly ctx: RegionContext,
    // CP06 restored object optics (vendored WaterSurfacePass inputs): the
    // actor texture-pass targets + the shared optics state
    private readonly objectTextures: RegionObjectTextureInputs | null = null,
    private readonly opticsState: WaterOpticsState | null = null,
  ) {
    const makeMaterial = (fragmentShader: string, side: THREE.Side) =>
      new THREE.ShaderMaterial({
        vertexShader: regionWaterSurfaceVert,
        fragmentShader,
        uniforms: {
          light: { value: lightDirection.clone() },
          causticTex: { value: causticTexture },
          water: { value: null },
          sky: { value: cubemap },
          eye: { value: new THREE.Vector3() },
          // CP06: the vendored optics uniform family (mesh members consumed
          // by the restored branches; primitive members inert, never enabled)
          ...(opticsState
            ? opticsState.createUniforms()
            : {
                meshCenter: { value: new THREE.Vector3() },
                meshBoundingRadius: { value: 1 },
                meshShadowRadius: { value: 1 },
                meshEnabled: { value: false },
              }),
          objectReflectionTex: { value: objectTextures?.reflectionTexture ?? null },
          objectClippedReflectionTex: {
            value: objectTextures?.clippedReflectionTexture ?? null,
          },
          objectRefractionTex: { value: objectTextures?.refractionTexture ?? null },
          viewProjectionMatrix: { value: new THREE.Matrix4() },
          reflectionViewProjectionMatrix: { value: new THREE.Matrix4() },
          ...regionUniforms(ctx),
        },
        side,
        depthTest: true,
        depthWrite: true,
      });
    this.aboveMaterial = makeMaterial(regionWaterAboveFrag, THREE.BackSide);
    this.belowMaterial = makeMaterial(regionWaterBelowFrag, THREE.FrontSide);

    // window meshes: local xy ∈ [-1,1] spans the sim window (vertex shader
    // maps to world through uWindowOrigin)
    const windowGeometry = new THREE.PlaneGeometry(2, 2, 400, 400);
    this.aboveWindowMesh = new THREE.Mesh(windowGeometry, this.aboveMaterial);
    this.belowWindowMesh = new THREE.Mesh(windowGeometry.clone(), this.belowMaterial);

    // border sheet: 4 flat quads in the same local convention (|xy| > 1 ⇒
    // falloff 0 ⇒ y = uSeaLevel exactly)
    this.borderPositions = new Float32Array(16 * 3);
    this.borderGeometry = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(this.borderPositions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.borderGeometry.setAttribute('position', attr);
    const borderIndices: number[] = [];
    for (let q = 0; q < 4; q++) {
      const o = q * 4;
      borderIndices.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    this.borderGeometry.setIndex(borderIndices);
    this.aboveBorderMesh = new THREE.Mesh(this.borderGeometry, this.aboveMaterial);
    this.belowBorderMesh = new THREE.Mesh(this.borderGeometry, this.belowMaterial);

    for (const m of this.meshes()) m.frustumCulled = false;
    this.updateBorder();
  }

  meshes(): THREE.Mesh[] {
    return [
      this.aboveWindowMesh,
      this.belowWindowMesh,
      this.aboveBorderMesh,
      this.belowBorderMesh,
    ];
  }

  /** Rebuild the border quads around the current window (call on snap). */
  updateBorder() {
    const half = this.ctx.regionSize / 2;
    const ox = this.ctx.windowOrigin.x;
    const oz = this.ctx.windowOrigin.y;
    const toLocalX = (x: number) => ((x - ox) / WINDOW_SIZE_M) * 2 - 1;
    const toLocalZ = (z: number) => ((z - oz) / WINDOW_SIZE_M) * 2 - 1;
    const wx0 = Math.max(-half, Math.min(half, ox));
    const wx1 = Math.max(-half, Math.min(half, ox + WINDOW_SIZE_M));
    const wz0 = Math.max(-half, Math.min(half, oz));
    const wz1 = Math.max(-half, Math.min(half, oz + WINDOW_SIZE_M));
    // quads in world space: [x0, x1, z0, z1]
    const quads: [number, number, number, number][] = [
      [-half, half, -half, wz0], // north strip
      [-half, half, wz1, half],  // south strip
      [-half, wx0, wz0, wz1],    // west strip
      [wx1, half, wz0, wz1],     // east strip
    ];
    let o = 0;
    for (const [x0, x1, z0, z1] of quads) {
      const lx0 = toLocalX(Math.min(x0, x1));
      const lx1 = toLocalX(Math.max(x0, x1));
      const lz0 = toLocalZ(Math.min(z0, z1));
      const lz1 = toLocalZ(Math.max(z0, z1));
      // PlaneGeometry-equivalent winding (CCW seen from local +z)
      const corners = [
        [lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1],
      ];
      for (const [lx, lz] of corners) {
        this.borderPositions[o++] = lx!;
        this.borderPositions[o++] = lz!;
        this.borderPositions[o++] = 0;
      }
    }
    (this.borderGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Bind per-frame uniforms (the vendored prepare discipline; CP06 adds
   *  the vendored optics-state sync + object-pass matrices). */
  prepare(water: RegionWater, camera: THREE.Camera) {
    const eye = new THREE.Vector3();
    camera.getWorldPosition(eye);
    for (const material of [this.aboveMaterial, this.belowMaterial]) {
      material.uniforms.water!.value = water.textureA.texture;
      (material.uniforms.eye!.value as THREE.Vector3).copy(eye);
      if (this.objectTextures) {
        (material.uniforms.viewProjectionMatrix!.value as THREE.Matrix4).copy(
          this.objectTextures.viewProjectionMatrix,
        );
        (material.uniforms.reflectionViewProjectionMatrix!.value as THREE.Matrix4).copy(
          this.objectTextures.reflectionViewProjectionMatrix,
        );
      }
      if (this.opticsState) this.opticsState.syncUniforms(material);
      material.uniformsNeedUpdate = true;
    }
  }

  setVisible(v: boolean) {
    for (const m of this.meshes()) m.visible = v;
  }

  /** cp05A structural audit: compiled fragment sources (include-marker
   *  checks — the substrate include must be shared with the terrain path). */
  fragmentSources(): { above: string; below: string } {
    return {
      above: this.aboveMaterial.fragmentShader,
      below: this.belowMaterial.fragmentShader,
    };
  }
}
