// CavesPass — Checkpoint 09 cave/arch module renderer + BVH query surface.
//
// Loads the committed cave GLBs (baked world-space geometry: POSITION,
// NORMAL, COLOR_0.r = AO — authored plan realized by the deterministic
// Blender build), renders them with the shared substrate-rock material
// (CAVE_FRAG — Track B Q19 seam rule), and builds one three-mesh-bvh per
// module for the NON-PHYSICS query paths (Master §5.3): camera collision
// sphere-casts, closestPointToPoint push-out, LOS, and the CP09 clearance
// probes. Rapier (volumetric collision) consumes the same SHELL arrays —
// Kenney dressing is a second GLB node, rendered with the same material
// but excluded from BVH and Rapier so the authored shells remain the
// navigable geometry.

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { WorldData } from '../world/WorldData';
import type { RegionContext } from './regionContext';
import { regionUniforms } from './regionContext';
import { CAVE_VERT, CAVE_FRAG } from './shaders';

export interface CaveModuleGeometry {
  id: string;
  positions: Float32Array;
  indices: Uint32Array;
  triangles: number;
  vertices: number;
  bvhBuildMs: number;
}

export interface CavesStats {
  modules: { id: string; vertices: number; triangles: number; bvhBuildMs: number }[];
  loadMs: number;
  queries: number;
  queryUsTotal: number;
}

export class CavesPass {
  readonly group = new THREE.Group();
  readonly stats: CavesStats = { modules: [], loadMs: 0, queries: 0, queryUsTotal: 0 };
  /** per-module geometry arrays (Rapier trimesh source — same artifact) */
  readonly moduleGeometry: CaveModuleGeometry[] = [];

  private readonly material: THREE.ShaderMaterial;
  private readonly bvhs: { id: string; bvh: MeshBVH }[] = [];
  private readonly meshes: THREE.Mesh[] = [];

  private readonly tmpTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  private readonly tmpRay = new THREE.Ray();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpPoint = new THREE.Vector3();

  private constructor(
    ctx: RegionContext,
    oceanUniforms: Record<string, THREE.IUniform>,
    sunDir: THREE.Vector3,
    causticColor: THREE.Color,
  ) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: CAVE_VERT,
      fragmentShader: CAVE_FRAG,
      toneMapped: false, // linear HDR — the post composite is the one encode
      uniforms: {
        uSunDir: { value: sunDir.clone() },
        // the SAME Color instance the terrain material owns — the cp08 zone
        // atmosphere scales it once and both materials follow (dark zones
        // kill the caustic dance on cave and terrain together)
        uCausticColor: { value: causticColor },
        uWireDebug: { value: 0.0 },
        // shared by reference with the ocean (Island.js pattern)
        uTime: oceanUniforms.uTime!,
        uWindDir: oceanUniforms.uWindDir!,
        uWaveCount: oceanUniforms.uWaveCount!,
        uBaseFreq: oceanUniforms.uBaseFreq!,
        uAmplitude: oceanUniforms.uAmplitude!,
        uDirSpread: oceanUniforms.uDirSpread!,
        uFreqMul: oceanUniforms.uFreqMul!,
        uAmpMul: oceanUniforms.uAmpMul!,
        uSpeed: oceanUniforms.uSpeed!,
        uSurfaceY: oceanUniforms.uSurfaceY!,
        ...regionUniforms(ctx),
      },
      // watertight double-walled shells; double-sided so a camera grazing a
      // wall never sees through a backface, with gl_FrontFacing lighting
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
    });
  }

  static async load(
    baseUrl: string,
    data: WorldData,
    ctx: RegionContext,
    oceanUniforms: Record<string, THREE.IUniform>,
    sunDir: THREE.Vector3,
    causticColor: THREE.Color,
  ): Promise<CavesPass> {
    const pass = new CavesPass(ctx, oceanUniforms, sunDir, causticColor);
    const t0 = performance.now();
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();

    for (const m of data.caves.modules) {
      if (!m.moduleId) continue;
      const gltf = await loader.loadAsync(`${baseUrl}world/${m.moduleId}`);
      const parts: { name: string; geo: THREE.BufferGeometry }[] = [];
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          parts.push({ name: (mesh.name || o.parent?.name || '').toLowerCase(), geo: mesh.geometry });
        }
      });
      if (parts.length === 0) throw new Error(`cave module ${m.id}: no mesh in ${m.moduleId}`);
      const shellPart = parts.find((p) => p.name === 'shell') ?? parts[0]!;
      let totalTris = 0;
      let totalVerts = 0;
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geo, pass.material);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.frustumCulled = true;
        pass.group.add(mesh);
        pass.meshes.push(mesh);
        const idx = part.geo.getIndex();
        const pos = part.geo.getAttribute('position');
        totalTris += idx ? idx.count / 3 : 0;
        totalVerts += pos ? pos.count : 0;
      }

      const geo = shellPart.geo;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const idxAttr = geo.getIndex()!;
      const bvhT0 = performance.now();
      const bvh = new MeshBVH(geo);
      const bvhBuildMs = performance.now() - bvhT0;
      pass.bvhs.push({ id: m.id, bvh });

      const rec: CaveModuleGeometry = {
        id: m.id,
        positions: new Float32Array(posAttr.array as Float32Array),
        indices: new Uint32Array(idxAttr.array as ArrayLike<number>),
        triangles: idxAttr.count / 3,
        vertices: posAttr.count,
        bvhBuildMs,
      };
      pass.moduleGeometry.push(rec);
      pass.stats.modules.push({
        id: m.id,
        vertices: totalVerts,
        triangles: totalTris,
        bvhBuildMs,
      });
    }
    pass.stats.loadMs = performance.now() - t0;
    return pass;
  }

  setSun(sunDir: THREE.Vector3) {
    this.material.uniforms.uSunDir!.value.copy(sunDir);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  /** ?debug=1 seam inspection: flat magenta tint + wireframe. */
  setWireDebug(v: boolean) {
    this.material.uniforms.uWireDebug!.value = v ? 1.0 : 0.0;
    this.material.wireframe = v;
  }

  /** structural audit surface (include-marker checks, cp05A pattern) */
  fragmentSource(): string {
    return this.material.fragmentShader;
  }

  // ------------------------------------------------------------------
  // BVH query surface (camera + clearance probes; NEVER the 120 Hz sim)
  // ------------------------------------------------------------------

  /** Distance from p to the nearest cave surface within maxDist. */
  closestDistance(p: THREE.Vector3, maxDist: number): number {
    const t0 = performance.now();
    let best = Infinity;
    for (const { bvh } of this.bvhs) {
      const hit = bvh.closestPointToPoint(p, this.tmpTarget, 0, Math.min(best, maxDist));
      if (hit && hit.distance < best) best = hit.distance;
    }
    this.stats.queries++;
    this.stats.queryUsTotal += (performance.now() - t0) * 1000;
    return best;
  }

  /** closestPointToPoint push-out support: nearest surface point within
   *  maxDist, or null (Master §5.3 camera push-out law). */
  closestPoint(p: THREE.Vector3, maxDist: number): { point: THREE.Vector3; distance: number } | null {
    let best: { point: THREE.Vector3; distance: number } | null = null;
    for (const { bvh } of this.bvhs) {
      const hit = bvh.closestPointToPoint(p, this.tmpTarget, 0, maxDist);
      if (hit && (!best || hit.distance < best.distance)) {
        best = { point: this.tmpTarget.point.clone(), distance: hit.distance };
      }
    }
    return best;
  }

  /** Sphere-cast from→to (same marching law as TerrainBvh.sphereCast):
   *  returns t of the last clear position, or null when clear. */
  sphereCast(from: THREE.Vector3, to: THREE.Vector3, radius: number): number | null {
    const len = from.distanceTo(to);
    if (len < 1e-6) return null;
    const step = radius / 2;
    const steps = Math.max(1, Math.ceil(len / step));
    let prevT = 0;
    for (let k = 1; k <= steps; k++) {
      const t = Math.min(1, (k * step) / len);
      this.tmpPoint.lerpVectors(from, to, t);
      if (this.closestDistance(this.tmpPoint, radius + step) < radius) {
        let lo = prevT;
        let hi = t;
        for (let r = 0; r < 5; r++) {
          const mid = (lo + hi) / 2;
          this.tmpPoint.lerpVectors(from, to, mid);
          if (this.closestDistance(this.tmpPoint, radius + step) < radius) hi = mid;
          else lo = mid;
        }
        return lo;
      }
      prevT = t;
    }
    return null;
  }

  /** Line-of-sight against every cave module. */
  losClear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const len = a.distanceTo(b);
    if (len < 1e-6) return true;
    this.tmpDir.copy(b).sub(a).divideScalar(len);
    this.tmpRay.origin.copy(a);
    this.tmpRay.direction.copy(this.tmpDir);
    for (const { bvh } of this.bvhs) {
      const hit = bvh.raycastFirst(this.tmpRay, THREE.DoubleSide);
      if (hit && hit.distance < len - 1e-3) return false;
    }
    return true;
  }

  /** First-hit distance along a ray (clearance probes), or null. */
  rayDistance(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): number | null {
    this.tmpRay.origin.copy(origin);
    this.tmpRay.direction.copy(dir).normalize();
    let best: number | null = null;
    for (const { bvh } of this.bvhs) {
      const hit = bvh.raycastFirst(this.tmpRay, THREE.DoubleSide);
      if (hit && hit.distance <= maxDist && (best === null || hit.distance < best)) {
        best = hit.distance;
      }
    }
    return best;
  }
}
