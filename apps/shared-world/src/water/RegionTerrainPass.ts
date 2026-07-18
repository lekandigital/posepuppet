// RegionTerrainPass — Checkpoint 04B replacement for the vendored PoolPass
// (Master §4.2 row 6): the tiled pool box becomes the coastline/seabed
// terrain. The mesh is the cp04A graybox grid (512² quads over the 2 km
// region — cp04B §4: the graybox serves as the rendered terrain/refraction
// target this checkpoint; cp05 owns LOD/materials); shading normals come
// per-fragment from uHeightTex so the drawn terrain and the raymarched
// terrain share one source (Master §2.2).

import * as THREE from 'three';
import type { WorldData } from '../world/WorldData';
import type { RegionWater } from './RegionWater';
import { regionUniforms, type RegionContext } from './regionContext';
import regionTerrainVert from './shaders/RegionTerrain.vert';
import regionTerrainFrag from './shaders/RegionTerrain.frag';

const GRID_SEGMENTS = 512; // cp04A graybox density (≈ 3.9 m per quad)

export class RegionTerrainPass {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(
    data: WorldData,
    lightDirection: THREE.Vector3,
    causticTexture: THREE.Texture,
    ctx: RegionContext,
  ) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: regionTerrainVert,
      fragmentShader: regionTerrainFrag,
      uniforms: {
        light: { value: lightDirection.clone() },
        causticTex: { value: causticTexture },
        water: { value: null },
        ...regionUniforms(ctx),
      },
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(buildGrid(data), this.material);
    this.mesh.frustumCulled = false;
  }

  prepare(water: RegionWater) {
    this.material.uniforms.water.value = water.textureA.texture;
    this.material.uniformsNeedUpdate = true;
  }
}

/** The cp04A graybox grid: vertex y from terrainHeight (single source). */
function buildGrid(data: WorldData): THREE.BufferGeometry {
  const verts = GRID_SEGMENTS + 1;
  const size = data.header.sizeMeters[0];
  const step = size / GRID_SEGMENTS;
  const positions = new Float32Array(verts * verts * 3);
  for (let j = 0; j < verts; j++) {
    const z = -size / 2 + j * step;
    for (let i = 0; i < verts; i++) {
      const x = -size / 2 + i * step;
      const o = (j * verts + i) * 3;
      positions[o] = x;
      positions[o + 1] = data.terrainHeight(x, z);
      positions[o + 2] = z;
    }
  }
  const indices = new Uint32Array(GRID_SEGMENTS * GRID_SEGMENTS * 6);
  let ptr = 0;
  for (let j = 0; j < GRID_SEGMENTS; j++) {
    for (let i = 0; i < GRID_SEGMENTS; i++) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices[ptr++] = a; indices[ptr++] = c; indices[ptr++] = b;
      indices[ptr++] = b; indices[ptr++] = c; indices[ptr++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}
