// RegionCausticsPass — Checkpoint 04B app-owned copy of the vendored
// CausticsPass with the "region" pool type (Master §4.2 rows 4/13): the
// caustics vertex stage projects refracted light onto the seabed
// heightfield via the shared raymarch; the differential-area fragment math
// is untouched; the caustic RT stays at the vendored 1024² resolution and
// format (cp04B §6.3).

import * as THREE from 'three';
import type { RegionWater } from './RegionWater';
import { regionUniforms, type RegionContext } from './regionContext';
import regionCausticsVert from './shaders/RegionCaustics.vert';
import regionCausticsFrag from './shaders/RegionCaustics.frag';

export class RegionCausticsPass {
  readonly texture: THREE.Texture;

  private readonly target: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    lightDirection: THREE.Vector3,
    ctx: RegionContext,
  ) {
    // vendored resolution and filtering (CausticsPass.ts:50)
    this.target = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.texture = this.target.texture;

    this.material = new THREE.ShaderMaterial({
      vertexShader: regionCausticsVert,
      fragmentShader: regionCausticsFrag,
      uniforms: {
        light: { value: lightDirection.clone() },
        water: { value: null },
        ...regionUniforms(ctx),
      },
      blending: THREE.NoBlending,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    // vendored grid: 200×200 over the sim domain
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 200, 200), this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  update(water: RegionWater) {
    this.material.uniforms.water.value = water.textureA.texture;
    this.material.uniformsNeedUpdate = true;
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }
}
