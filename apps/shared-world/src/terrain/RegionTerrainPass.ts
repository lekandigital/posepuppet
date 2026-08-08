// RegionTerrainPass — Checkpoint 05 chunked-LOD terrain renderer (Master
// §5.4, Track B Q16), CP05C revision: the pass is decoupled from the
// retired jeantimex water (no caustics RT, no sim-texture binding, no
// WaterOpticsState sun) and relit for the WaterThreeJS linear-HDR pipeline.
// The material shares the ocean's wave-shape uniform objects BY REFERENCE
// (the demo Island.js pattern) so submerged lighting/caustics track the
// real Gerstner surface, and takes the dynamic sun via setSun().
//
// Geometry is unchanged from CP05:
//  - 16×16 tiles: each tile spans 128 heightmap cells = 125 m.
//  - 4 static LOD levels, grid steps 1/2/4/8; selection by camera distance
//    to the tile AABB: 0–256 m → LOD 0, 256–512 → 1, 512–1024 → 2,
//    > 1024 → 3.
//  - Skirt rings: border vertices duplicated and dropped 2 m so LOD seams
//    never open cracks; skirt quads carry both windings.
//  - Per-tile frustum culling; coastline/ridge tiles pinned to LOD 0.
//
// Geometry heights live in uHeightTex, sampled in the chunk vertex shader —
// the same decoded field WorldData/collision read (§2.2 law).

import * as THREE from 'three';
import type { WorldData } from '../world/WorldData';
import { regionUniforms, type RegionContext } from './regionContext';
import { TERRAIN_VERT, TERRAIN_FRAG } from './shaders';

export const TILES = 16;
/** heightmap cells per tile side (2048 / 16) */
export const CELLS_PER_TILE = 128;
/** LOD grid steps in heightmap cells */
export const LOD_STEPS = [1, 2, 4, 8] as const;
/** camera-distance upper bounds for LODs 0/1/2 (m); beyond → LOD 3 */
export const LOD_DISTANCES_M = [256, 512, 1024] as const;
/** skirt drop below the surface, m — must match SKIRT_DROP in TERRAIN_VERT */
export const SKIRT_DROP_M = 2;

export interface TileInfo {
  i: number;
  j: number;
  /** world-space min corner */
  x0: number;
  z0: number;
  minH: number;
  maxH: number;
  protected: boolean;
  protectReason: string | null;
  lod: number;
  visible: boolean;
}

export interface TerrainStats {
  drawnPerLod: [number, number, number, number];
  drawnTiles: number;
  drawnTriangles: number;
  totalTiles: number;
  protectedTiles: number;
  /** true iff every protected tile has been at LOD 0 in every update so far */
  protectedAlwaysLod0: boolean;
}

export class RegionTerrainPass {
  readonly group: THREE.Group;
  readonly tiles: TileInfo[] = [];
  /** tile side length, meters (125) */
  readonly tileSizeM: number;
  /** build wall-clock for the performance report */
  readonly buildMs: number;

  private readonly material: THREE.ShaderMaterial;
  private readonly lodGeometries: THREE.BufferGeometry[];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly boxes: THREE.Box3[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly frustumMatrix = new THREE.Matrix4();
  private readonly stats: TerrainStats;

  constructor(
    data: WorldData,
    ctx: RegionContext,
    /** the ocean's wave-shape uniforms, shared by reference (Island pattern):
     *  uTime, uWindDir, uWaveCount, uBaseFreq, uAmplitude, uDirSpread,
     *  uFreqMul, uAmpMul, uSpeed, uSurfaceY */
    oceanUniforms: Record<string, THREE.IUniform>,
    sunDir: THREE.Vector3,
  ) {
    const t0 = performance.now();
    this.material = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      toneMapped: false, // linear HDR — the post composite is the one encode
      uniforms: {
        uSunDir: { value: sunDir.clone() },
        uCausticColor: { value: new THREE.Color(1.0, 0.98, 0.85) },
        // shared, by reference — auto-synced with the ocean's wave settings
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
      // FrontSide for the surface; skirt quads carry both windings so a
      // single-side material still shows them from anywhere
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
    });

    const n = data.header.artifacts['height.r16']!.resolution!; // 2049
    const size = data.header.sizeMeters[0]; // 2000
    const cellM = size / (n - 1);
    this.tileSizeM = CELLS_PER_TILE * cellM; // 125

    this.lodGeometries = LOD_STEPS.map((step) => buildTileGeometry(step, cellM));
    const ridgeTiles = ridgeCrossedTiles(data, this.tileSizeM);

    this.group = new THREE.Group();
    let protectedCount = 0;
    for (let j = 0; j < TILES; j++) {
      for (let i = 0; i < TILES; i++) {
        const info = analyzeTile(data, i, j, n);
        const key = j * TILES + i;
        if (ridgeTiles.has(key)) {
          info.protected = true;
          info.protectReason = info.protectReason
            ? `${info.protectReason}+ridge`
            : 'ridge';
        }
        if (info.protected) protectedCount++;
        this.tiles.push(info);

        const mesh = new THREE.Mesh(this.lodGeometries[info.lod]!, this.material);
        mesh.position.set(info.x0, 0, info.z0);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.frustumCulled = false; // culling is ours (shared geometries)
        this.group.add(mesh);
        this.meshes.push(mesh);
        this.boxes.push(
          new THREE.Box3(
            new THREE.Vector3(info.x0, info.minH - SKIRT_DROP_M, info.z0),
            new THREE.Vector3(info.x0 + this.tileSizeM, info.maxH, info.z0 + this.tileSizeM),
          ),
        );
      }
    }
    this.stats = {
      drawnPerLod: [0, 0, 0, 0],
      drawnTiles: 0,
      drawnTriangles: 0,
      totalTiles: this.tiles.length,
      protectedTiles: protectedCount,
      protectedAlwaysLod0: true,
    };
    this.buildMs = performance.now() - t0;
  }

  /** Per-frame LOD selection + frustum culling (call once per frame,
   *  before either render pass). */
  update(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    this.frustumMatrix.multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    const eye = camera.getWorldPosition(tmpEye);

    const perLod: [number, number, number, number] = [0, 0, 0, 0];
    let drawnTiles = 0;
    let drawnTris = 0;
    for (let k = 0; k < this.tiles.length; k++) {
      const tile = this.tiles[k]!;
      const mesh = this.meshes[k]!;
      const box = this.boxes[k]!;

      let lod = 0;
      if (!tile.protected) {
        const d = box.distanceToPoint(eye);
        lod =
          d < LOD_DISTANCES_M[0] ? 0 : d < LOD_DISTANCES_M[1] ? 1 : d < LOD_DISTANCES_M[2] ? 2 : 3;
      }
      if (lod !== tile.lod) {
        tile.lod = lod;
        mesh.geometry = this.lodGeometries[lod]!;
      }
      if (tile.protected && tile.lod !== 0) this.stats.protectedAlwaysLod0 = false;

      const visible = this.group.visible && this.frustum.intersectsBox(box);
      tile.visible = visible;
      mesh.visible = visible;
      if (visible) {
        perLod[lod]!++;
        drawnTiles++;
        drawnTris += triangleCount(lod);
      }
    }
    this.stats.drawnPerLod = perLod;
    this.stats.drawnTiles = drawnTiles;
    this.stats.drawnTriangles = drawnTris;
  }

  setSun(sunDir: THREE.Vector3) {
    this.material.uniforms.uSunDir!.value.copy(sunDir);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  /** cp05A test/debug: render raw classification albedo (no lighting). */
  setAlbedoDebug(v: boolean) {
    this.material.uniforms.uAlbedoDebug!.value = v ? 1.0 : 0.0;
    this.material.uniformsNeedUpdate = true;
  }

  /** structural audit: the compiled fragment source (include-marker checks) */
  fragmentSource(): string {
    return this.material.fragmentShader;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  terrainStats(): TerrainStats {
    return {
      ...this.stats,
      drawnPerLod: [...this.stats.drawnPerLod] as [number, number, number, number],
    };
  }

  /** tile-major LOD map (row j, col i) for the flyby instrumentation */
  lodMap(): { lod: number; protected: boolean; visible: boolean }[] {
    return this.tiles.map((t) => ({ lod: t.lod, protected: t.protected, visible: t.visible }));
  }
}

const tmpEye = new THREE.Vector3();

/** triangles a tile draws at a LOD (surface + double-wound skirt) */
export function triangleCount(lod: number): number {
  const m = CELLS_PER_TILE / LOD_STEPS[lod]!;
  return 2 * m * m + 16 * m;
}

/** Per-tile height range + shore-transition protection from the decoded
 *  artifacts (initial lod = 0; the first update() sets the real level). */
function analyzeTile(data: WorldData, i: number, j: number, n: number): TileInfo {
  const size = data.header.sizeMeters[0];
  const cellM = size / (n - 1);
  const g0 = i * CELLS_PER_TILE;
  const r0 = j * CELLS_PER_TILE;
  let minH = Infinity;
  let maxH = -Infinity;
  let land = false;
  let water = false;
  for (let r = r0; r <= r0 + CELLS_PER_TILE; r++) {
    const row = r * n;
    for (let g = g0; g <= g0 + CELLS_PER_TILE; g++) {
      const h = data.heights[row + g]!;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      if (data.mask[row + g] === 1) land = true;
      else water = true;
    }
  }
  const coast = land && water;
  return {
    i,
    j,
    x0: -size / 2 + i * CELLS_PER_TILE * cellM,
    z0: -size / 2 + j * CELLS_PER_TILE * cellM,
    minH,
    maxH,
    protected: coast,
    protectReason: coast ? 'coastline' : null,
    lod: 0,
    visible: true,
  };
}

/** Tiles crossed by any world.json ridgeLine (polyline walk at 1 m steps;
 *  single-point lines mark their containing tile — summits). */
function ridgeCrossedTiles(data: WorldData, tileSizeM: number): Set<number> {
  const half = data.header.sizeMeters[0] / 2;
  const out = new Set<number>();
  const mark = (x: number, z: number) => {
    const i = Math.min(TILES - 1, Math.max(0, Math.floor((x + half) / tileSizeM)));
    const j = Math.min(TILES - 1, Math.max(0, Math.floor((z + half) / tileSizeM)));
    out.add(j * TILES + i);
  };
  for (const line of data.header.ridgeLines ?? []) {
    const pts = line.points;
    if (pts.length === 1) {
      mark(pts[0]![0], pts[0]![1]);
      continue;
    }
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s]!;
      const [bx, bz] = pts[s + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.ceil(len));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        mark(ax + (bx - ax) * t, az + (bz - az) * t);
      }
    }
  }
  return out;
}

/**
 * Shared tile geometry for one LOD: (m+1)² surface vertices on the tile-
 * local grid (y = 0 flag) plus a duplicated border ring (y = 1 flag) for
 * the skirt. Surface winding matches the 04B graybox; skirt quads are
 * emitted with both windings.
 */
function buildTileGeometry(step: number, cellM: number): THREE.BufferGeometry {
  const m = CELLS_PER_TILE / step;
  const verts = m + 1;
  const surface = verts * verts;

  // border ring vertex order: walk the perimeter (used for skirt)
  const ring: number[] = [];
  for (let i = 0; i < verts; i++) ring.push(i); // south edge (j = 0), +x
  for (let j = 1; j < verts; j++) ring.push(j * verts + (verts - 1)); // east, +z
  for (let i = verts - 2; i >= 0; i--) ring.push((verts - 1) * verts + i); // north, −x
  for (let j = verts - 2; j >= 1; j--) ring.push(j * verts); // west, −z

  const total = surface + ring.length;
  const positions = new Float32Array(total * 3);
  for (let j = 0; j < verts; j++) {
    for (let i = 0; i < verts; i++) {
      const o = (j * verts + i) * 3;
      positions[o] = i * step * cellM;
      positions[o + 1] = 0; // surface flag
      positions[o + 2] = j * step * cellM;
    }
  }
  for (let k = 0; k < ring.length; k++) {
    const src = ring[k]! * 3;
    const o = (surface + k) * 3;
    positions[o] = positions[src]!;
    positions[o + 1] = 1; // skirt flag
    positions[o + 2] = positions[src + 2]!;
  }

  const surfTris = 2 * m * m;
  const skirtQuads = ring.length; // one quad per perimeter edge (ring is cyclic)
  const indices = new Uint32Array(surfTris * 3 + skirtQuads * 12);
  let p = 0;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices[p++] = a; indices[p++] = c; indices[p++] = b;
      indices[p++] = b; indices[p++] = c; indices[p++] = d;
    }
  }
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k]!;
    const b = ring[(k + 1) % ring.length]!;
    const as = surface + k;
    const bs = surface + ((k + 1) % ring.length);
    // both windings so the skirt reads from either side
    indices[p++] = a; indices[p++] = b; indices[p++] = as;
    indices[p++] = b; indices[p++] = bs; indices[p++] = as;
    indices[p++] = a; indices[p++] = as; indices[p++] = b;
    indices[p++] = b; indices[p++] = as; indices[p++] = bs;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}
