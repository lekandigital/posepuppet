// TerrainBvh — Checkpoint 05 camera-query acceleration (Master §5.3:
// three-mesh-bvh carries all non-physics spatial queries; Rapier does not
// arrive until cp09). PRESENTATION-SIDE ONLY: the 120 Hz sim's terrain
// contact stays analytic (heightfield + shore SDF) so replays remain
// platform-stable (cp05 §6 determinism law); only the camera consumes this.
//
// Per-tile lazy BVHs over the LOD-0 terrain grid (the same 16×16 / 128-cell
// tiling the renderer uses; vertex heights read from the same decoded
// Float32 field — §2.2 single-source law, checked by the law test). Tiles
// build on first demand (~tens of ms each, measured and reported) with a
// small LRU so memory stays bounded; a per-frame prefetch budget of one
// build keeps hitches out of the steady state.

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { WorldData } from '../world/WorldData';
import { TILES, CELLS_PER_TILE } from '../terrain/RegionTerrainPass';

/** LRU capacity [DERIVED memory bound, reported]: must exceed the working
 *  set (prefetch ring up to 4×4 = 16 tiles + camera/LOS tiles behind the
 *  dolphin), or eviction ping-pongs with the prefetch and rebuilds tiles
 *  every frame (measured: 2 566 rebuilds in one session at capacity 16).
 *  40 tiles ≈ 32 MB holds the ring plus travel margin. */
const MAX_TILES = 40;
/** prefetch radius around a focus point, meters */
const PREFETCH_M = 150;

export interface BvhStats {
  tilesBuilt: number;
  tilesLive: number;
  buildMsTotal: number;
  buildMsMax: number;
  queries: number;
  queryUsTotal: number;
  /** approximate live geometry+BVH memory, bytes */
  liveBytes: number;
}

interface TileEntry {
  bvh: MeshBVH;
  geometry: THREE.BufferGeometry;
  lastUsed: number;
  bytes: number;
}

export class TerrainBvh {
  private readonly cache = new Map<number, TileEntry>();
  private readonly half: number;
  private readonly cellM: number;
  private readonly n: number;
  private clock = 0;
  readonly stats: BvhStats = {
    tilesBuilt: 0,
    tilesLive: 0,
    buildMsTotal: 0,
    buildMsMax: 0,
    queries: 0,
    queryUsTotal: 0,
    liveBytes: 0,
  };

  private readonly tmpPoint = new THREE.Vector3();
  private readonly tmpTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  private readonly tmpRay = new THREE.Ray();
  private readonly tmpDir = new THREE.Vector3();

  constructor(private readonly data: WorldData) {
    this.n = data.header.artifacts['height.r16']!.resolution!;
    this.half = data.header.sizeMeters[0] / 2;
    this.cellM = data.header.sizeMeters[0] / (this.n - 1);
  }

  private tileByKey(key: number): TileEntry {
    let entry = this.cache.get(key);
    if (!entry) {
      entry = this.buildTile(key);
      this.cache.set(key, entry);
      this.evict();
    }
    entry.lastUsed = ++this.clock;
    return entry;
  }

  private buildTile(key: number): TileEntry {
    const t0 = performance.now();
    const i = key % TILES;
    const j = Math.floor(key / TILES);
    const g0 = i * CELLS_PER_TILE;
    const r0 = j * CELLS_PER_TILE;
    const verts = CELLS_PER_TILE + 1;
    const positions = new Float32Array(verts * verts * 3);
    const { heights } = this.data;
    for (let r = 0; r < verts; r++) {
      const worldZ = -this.half + (r0 + r) * this.cellM;
      const row = (r0 + r) * this.n;
      for (let c = 0; c < verts; c++) {
        const o = (r * verts + c) * 3;
        positions[o] = -this.half + (g0 + c) * this.cellM;
        positions[o + 1] = heights[row + g0 + c]!;
        positions[o + 2] = worldZ;
      }
    }
    const indices = new Uint32Array(CELLS_PER_TILE * CELLS_PER_TILE * 6);
    let p = 0;
    for (let r = 0; r < CELLS_PER_TILE; r++) {
      for (let c = 0; c < CELLS_PER_TILE; c++) {
        const a = r * verts + c;
        const b = a + 1;
        const d = a + verts;
        const e = d + 1;
        indices[p++] = a; indices[p++] = d; indices[p++] = b;
        indices[p++] = b; indices[p++] = d; indices[p++] = e;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const bvh = new MeshBVH(geometry);
    const ms = performance.now() - t0;
    this.stats.tilesBuilt++;
    this.stats.buildMsTotal += ms;
    if (ms > this.stats.buildMsMax) this.stats.buildMsMax = ms;
    const bytes = positions.byteLength + indices.byteLength + positions.byteLength; // BVH ≈ position-order
    this.stats.liveBytes += bytes;
    this.stats.tilesLive = this.cache.size + 1;
    return { bvh, geometry, lastUsed: 0, bytes };
  }

  private evict() {
    while (this.cache.size > MAX_TILES) {
      let oldestKey = -1;
      let oldest = Infinity;
      for (const [k, e] of this.cache) {
        if (e.lastUsed < oldest) {
          oldest = e.lastUsed;
          oldestKey = k;
        }
      }
      const e = this.cache.get(oldestKey)!;
      e.geometry.dispose();
      this.stats.liveBytes -= e.bytes;
      this.cache.delete(oldestKey);
    }
    this.stats.tilesLive = this.cache.size;
  }

  /** Amortized prefetch: build at most one missing tile within PREFETCH_M
   *  of the focus per call (call once per frame from the game loop). */
  prefetch(x: number, z: number): void {
    const size = CELLS_PER_TILE * this.cellM;
    const i0 = Math.max(0, Math.floor((x - PREFETCH_M + this.half) / size));
    const i1 = Math.min(TILES - 1, Math.floor((x + PREFETCH_M + this.half) / size));
    const j0 = Math.max(0, Math.floor((z - PREFETCH_M + this.half) / size));
    const j1 = Math.min(TILES - 1, Math.floor((z + PREFETCH_M + this.half) / size));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const key = j * TILES + i;
        if (!this.cache.has(key)) {
          this.tileByKey(key);
          return; // one build per call
        }
      }
    }
  }

  /** Distance from p to the terrain surface within maxDist (Infinity when
   *  farther than maxDist from every triangle of the touched tiles). */
  closestDistance(p: THREE.Vector3, maxDist: number): number {
    const t0 = performance.now();
    let best = Infinity;
    for (const key of this.tilesOverlapping(p.x - maxDist, p.z - maxDist, p.x + maxDist, p.z + maxDist)) {
      const entry = this.tileByKey(key);
      const hit = entry.bvh.closestPointToPoint(p, this.tmpTarget, 0, Math.min(best, maxDist));
      if (hit && hit.distance < best) best = hit.distance;
    }
    this.stats.queries++;
    this.stats.queryUsTotal += (performance.now() - t0) * 1000;
    return best;
  }

  /**
   * Camera sphere-cast (cp05 §6): march a sphere of `radius` from `from`
   * toward `to` (step radius/2, binary refine at the first blocked sample);
   * returns the parameter t ∈ [0, 1] of the last clear position, or null
   * when the whole segment is clear.
   */
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
        // binary refine between prevT (clear) and t (blocked)
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

  /** Line-of-sight: true when the open segment a→b hits no terrain. */
  losClear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const t0 = performance.now();
    const len = a.distanceTo(b);
    if (len < 1e-6) return true;
    this.tmpDir.copy(b).sub(a).divideScalar(len);
    this.tmpRay.origin.copy(a);
    this.tmpRay.direction.copy(this.tmpDir);
    let clear = true;
    for (const key of this.tilesOverlapping(
      Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z),
    )) {
      const entry = this.tileByKey(key);
      const hit = entry.bvh.raycastFirst(this.tmpRay, THREE.DoubleSide);
      if (hit && hit.distance < len - 1e-3) {
        clear = false;
        break;
      }
    }
    this.stats.queries++;
    this.stats.queryUsTotal += (performance.now() - t0) * 1000;
    return clear;
  }

  private tilesOverlapping(x0: number, z0: number, x1: number, z1: number): number[] {
    const size = CELLS_PER_TILE * this.cellM;
    const i0 = Math.max(0, Math.floor((x0 + this.half) / size));
    const i1 = Math.min(TILES - 1, Math.floor((x1 + this.half) / size));
    const j0 = Math.max(0, Math.floor((z0 + this.half) / size));
    const j1 = Math.min(TILES - 1, Math.floor((z1 + this.half) / size));
    const out: number[] = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) out.push(j * TILES + i);
    }
    return out;
  }
}
