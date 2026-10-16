// Tidewater world adapters for the BodyArcade dolphin (Checkpoint 10).
//
// The approved sim (sim.ts, unchanged) asks the world the WorldSampler
// questions; the approved camera rig asks a CameraCollisionLike. Here both
// are answered from Tidewater's OWN authoritative world data — the same
// CPU height field its terrain mesh, swash and colliders use (TerrainData,
// 1 m texels, bilinear), the reef's solid-structure height field (Reef.hf,
// 0.25 m cells: coral heads, boulders, slabs) and the static collider set
// (pier piles, rocks, caps, stalls). Nothing from the old Twin Bay region
// (shore SDF, caves, BVH) is transplanted.
//
// Determinism: TerrainData is procedural from a fixed seed, the reef is
// placed by seeded RNG and the colliders are static, so every answer is a
// pure function of the committed Tidewater source — replays stay
// byte-identical across loads. No GPU readback enters the sim.
//
// [DERIVED] integration parameters (reported for review):
//   MIN_SWIM_DEPTH 1.8 m — swimmable water must hold the sim's two soft
//     vertical clamps (SEABED_CLEAR 1.2 below the body, SURFACE_Y −0.4
//     above) with 0.2 m to spare; shallower water and coral tops above
//     −1.8 m count as "shore" and the containment current turns the
//     dolphin away from them.
//   CONTAINMENT_BAND 12 m — the soft-push band for this island (the pool
//     used 2.5 m, the 2 km region 55 m); Tidewater's bay shelf is ~40 m
//     wide and the reef is a few metres deep, so a wider band would read
//     as a current over the whole playable shallows.
//   EDGE_MARGIN 24 m — the terrain domain border (±1024 m) acts as shore.
//   mask cell 2 m — the distance field resolution; depth / contact
//     queries stay exact (1 m terrain, 0.25 m reef).

import { Vector3, MathUtils } from '../../vendor/tidewater/src/engine/index.js';
import type { WorldSampler } from './worldSampler';
import type { CameraCollisionLike, CollisionResult } from './cameraCollision';
import type { SimState } from './sim';

export interface TerrainDataLike {
  size: number;
  origin: number;
  heightAt(x: number, z: number): number;
}
export interface ReefLike {
  structureAt(x: number, z: number): number;
}
interface ColliderBox {
  center: Vector3; half: Vector3; rotY: number; cos: number; sin: number;
  solid: boolean; tag: string; top: number; bottom: number; radius: number;
}
interface ColliderCylinder { x: number; z: number; radius: number; yMin: number; yMax: number; tag: string }
export interface CollidersLike {
  boxes: ColliderBox[];
  cylinders: ColliderCylinder[];
  resolveCapsule(pos: Vector3, radius: number, height: number, stepHeight?: number): boolean;
  raycast(origin: Vector3, dir: Vector3, maxDist: number): number;
}

export const WORLD_PARAMS = {
  MIN_SWIM_DEPTH: 1.8,
  CONTAINMENT_BAND: 12,
  EDGE_MARGIN: 24,
  MASK_CELL: 2,
} as const;

// ---------------------------------------------------------------- sampler

export class TidewaterWorldSampler implements WorldSampler {
  readonly containmentBand = WORLD_PARAMS.CONTAINMENT_BAND;
  /** signed distance (m) to the swimmable boundary on the 2 m grid (+ water, − shore) */
  private readonly sdf: Float32Array;
  private readonly n: number;
  private readonly cell: number;
  private readonly origin: number;
  private readonly half: number;
  readonly buildMs: number;
  readonly stats: { cells: number; swimmableCells: number; reefShallowCells: number };

  constructor(
    readonly terrain: TerrainDataLike,
    readonly reef: ReefLike | null,
    /** extra static exclusion disks { x, z, r } (e.g. the boat's mooring envelope) */
    readonly exclusions: { x: number; z: number; r: number }[] = [],
  ) {
    const t0 = performance.now();
    this.cell = WORLD_PARAMS.MASK_CELL;
    this.n = Math.round(terrain.size / this.cell);
    this.origin = terrain.origin;
    this.half = terrain.size / 2 - WORLD_PARAMS.EDGE_MARGIN;
    const n = this.n;
    const mask = new Uint8Array(n * n); // 1 = swimmable
    let swimmable = 0;
    let reefShallow = 0;
    for (let j = 0; j < n; j++) {
      const z = this.origin + (j + 0.5) * this.cell;
      for (let i = 0; i < n; i++) {
        const x = this.origin + (i + 0.5) * this.cell;
        // cell is swimmable only if its whole footprint is: sample the centre
        // and the four half-cell offsets (the reef field is 0.25 m — finer
        // than the mask — so a head smaller than a cell still registers)
        let ok = this.inDomain(x, z);
        if (ok) {
          const h = this.cell * 0.5;
          const pts: [number, number][] = [[x, z], [x - h, z - h], [x + h, z - h], [x - h, z + h], [x + h, z + h]];
          for (const [px, pz] of pts) {
            if (this.terrain.heightAt(px, pz) > -WORLD_PARAMS.MIN_SWIM_DEPTH) { ok = false; break; }
          }
          if (ok && this.reef) {
            for (const [px, pz] of pts) {
              if (this.reef.structureAt(px, pz) > -WORLD_PARAMS.MIN_SWIM_DEPTH) { ok = false; reefShallow++; break; }
            }
          }
          if (ok) {
            for (const e of this.exclusions) {
              if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r * e.r) { ok = false; break; }
            }
          }
        }
        if (ok) { mask[j * n + i] = 1; swimmable++; }
      }
    }
    // exact Euclidean distance transforms (Felzenszwalb & Huttenlocher) of the
    // water cells to the nearest shore cell and vice versa → signed field
    const dWater = edt(mask, n, n, 1);  // distance from each water cell to the nearest non-water
    const dLand = edt(mask, n, n, 0);   // distance from each land cell to the nearest water
    this.sdf = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) {
      this.sdf[k] = (mask[k] ? Math.sqrt(dWater[k]) - 0.5 : -(Math.sqrt(dLand[k]) - 0.5)) * this.cell;
    }
    this.buildMs = performance.now() - t0;
    this.stats = { cells: n * n, swimmableCells: swimmable, reefShallowCells: reefShallow };
  }

  private inDomain(x: number, z: number): boolean {
    return Math.abs(x) < this.half && Math.abs(z) < this.half;
  }

  /** seabed or the top of a solid reef structure, metres (the contact surface) */
  terrainHeight(x: number, z: number): number {
    const h = this.terrain.heightAt(x, z);
    if (!this.reef) return h;
    const s = this.reef.structureAt(x, z);
    return s > h ? s : h;
  }

  inWater(x: number, z: number): boolean {
    if (!this.inDomain(x, z)) return false;
    if (this.terrainHeight(x, z) > -WORLD_PARAMS.MIN_SWIM_DEPTH) return false;
    for (const e of this.exclusions) {
      if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r * e.r) return false;
    }
    return true;
  }

  /** bilinear sample of the signed field, blended with the domain edge */
  shoreDistance(x: number, z: number): number {
    const edge = Math.min(this.half - Math.abs(x), this.half - Math.abs(z));
    const fx = (x - this.origin) / this.cell - 0.5;
    const fz = (z - this.origin) / this.cell - 0.5;
    const n = this.n;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return Math.min(edge, -WORLD_PARAMS.EDGE_MARGIN);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const k = j * n + i;
    const s = this.sdf;
    const d = (s[k]! * (1 - tx) + s[k + 1]! * tx) * (1 - tz) + (s[k + n]! * (1 - tx) + s[k + n + 1]! * tx) * tz;
    return Math.min(d, edge);
  }

  depthAt(x: number, z: number): number {
    return Math.max(0, -this.terrainHeight(x, z));
  }
}

/** 1-D squared distance transform (Felzenszwalb & Huttenlocher 2004) */
function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, zb: Float64Array, n: number): void {
  let k = 0;
  v[0] = 0;
  zb[0] = -Infinity;
  zb[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= zb[k]!) {
      k--;
      s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    zb[k] = s;
    zb[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (zb[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** squared distance from every cell to the nearest cell whose mask value != `inside` */
function edt(mask: Uint8Array, w: number, h: number, inside: number): Float64Array {
  const INF = 1e12;
  const g = new Float64Array(w * h);
  for (let k = 0; k < w * h; k++) g[k] = mask[k] === inside ? INF : 0;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), zb = new Float64Array(n + 1);
  // columns
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x]!;
    edt1d(f, d, v, zb, h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y]!;
  }
  // rows
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x]!;
    edt1d(f, d, v, zb, w);
    for (let x = 0; x < w; x++) g[y * w + x] = d[x]!;
  }
  return g;
}

// ---------------------------------------------------------------- obstacles

/**
 * Post-step solid-obstacle correction inside the fixed 120 Hz loop (the cp09
 * pattern: swim phase only; position corrected; the blocked component of
 * the chase velocity removed — the slide law). Obstacles are Tidewater's
 * static Colliders (pier piles and caps, rocks, stall boxes — whatever
 * reaches the dolphin's depth) plus static app boxes (the moored boat's
 * envelope). The body is three vertical capsules (nose / centre / tail,
 * radius 0.45 m, like the cp09 capsule's 2.9 m length) pushed out in XZ.
 */
export class TidewaterObstacles {
  readonly stats = { corrections: 0, lastCorrectionM: 0, usAvg: 0, count: 0 };
  private usAcc = 0;
  private readonly tmp = new Vector3();
  private readonly boxes: { cx: number; cz: number; hx: number; hz: number; cos: number; sin: number; yMin: number; yMax: number; tag: string }[] = [];

  constructor(
    private readonly colliders: CollidersLike,
    readonly radius = 0.45,
    readonly halfLength = 1.0,
    readonly halfHeight = 0.45,
  ) {}

  /** static app-owned box obstacle (centre, half extents, yaw) */
  addBox(cx: number, cz: number, hx: number, hz: number, rotY: number, yMin: number, yMax: number, tag: string): void {
    this.boxes.push({ cx, cz, hx, hz, cos: Math.cos(rotY), sin: Math.sin(rotY), yMin, yMax, tag });
  }

  private pushOut(p: Vector3): boolean {
    let hit = this.colliders.resolveCapsule(p, this.radius, this.halfHeight * 2, 0);
    for (const b of this.boxes) {
      if (p.y + this.halfHeight * 2 < b.yMin || p.y > b.yMax) continue;
      const dx = p.x - b.cx, dz = p.z - b.cz;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      const cxl = Math.max(-b.hx, Math.min(b.hx, lx)), czl = Math.max(-b.hz, Math.min(b.hz, lz));
      let ddx = lx - cxl, ddz = lz - czl;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= this.radius * this.radius) continue;
      let nx: number, nz: number, pen: number;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = ddx / d; nz = ddz / d; pen = this.radius - d;
      } else {
        const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; pen = px + this.radius; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz + this.radius; }
      }
      const wx = nx * b.cos + nz * b.sin, wz = -nx * b.sin + nz * b.cos;
      p.x += wx * pen;
      p.z += wz * pen;
      hit = true;
    }
    return hit;
  }

  correct(prevX: number, prevY: number, prevZ: number, s: SimState): boolean {
    if (s.phase !== 'swim') return false;
    const t0 = performance.now();
    const fx = Math.sin(s.yaw) * Math.cos(s.pitch);
    const fz = Math.cos(s.yaw) * Math.cos(s.pitch);
    let cx = 0, cz = 0, hits = 0;
    for (const o of [0, this.halfLength, -this.halfLength]) {
      const p = this.tmp.set(s.x + fx * o, s.y - this.halfHeight, s.z + fz * o);
      const bx = p.x, bz = p.z;
      if (this.pushOut(p)) {
        cx += p.x - bx;
        cz += p.z - bz;
        hits++;
      }
    }
    let corrected = false;
    if (hits > 0) {
      const err = Math.hypot(cx, cz);
      if (err > 1e-6) {
        // never push farther than the step itself plus the overlap (no jolts)
        s.x += cx;
        s.z += cz;
        const nx = cx / err, nz = cz / err;
        const vDotN = s.wvx * nx + s.wvz * nz;
        if (vDotN < 0) {
          s.wvx -= nx * vDotN;
          s.wvz -= nz * vDotN;
        }
        this.stats.corrections++;
        this.stats.lastCorrectionM = err;
        corrected = true;
      }
    }
    void prevX; void prevY; void prevZ;
    this.usAcc += (performance.now() - t0) * 1000;
    this.stats.count++;
    this.stats.usAvg = this.usAcc / this.stats.count;
    return corrected;
  }
}

// ---------------------------------------------------------------- camera collision

/**
 * CameraCollisionLike over Tidewater geometry (replaces the cp05/cp09
 * terrain + cave BVH): the ground surface (terrain ∪ reef structures) is
 * sphere-cast by marching the dolphin→camera segment against the height
 * field (0.5 m steps, keep-out radius 0.75 m); solid colliders (piles,
 * caps, pier structures, rocks, stalls) and app boxes (the moored boat)
 * are ray-tested with Tidewater's own Colliders.raycast plus a cylinder
 * slab test. clampPoint keeps the hard guarantee: height-field floor +
 * radius, domain edge margin, cylinder / box push-out at the eye.
 */
export class TidewaterCameraCollision implements CameraCollisionLike {
  /** clearance at the last resolved camera point, m (instrumentation) */
  lastClearanceM = Infinity;
  private readonly tmpDir = new Vector3();
  private readonly tmpP = new Vector3();
  private readonly boxes: { cx: number; cz: number; hx: number; hz: number; cos: number; sin: number; yMin: number; yMax: number }[] = [];
  private readonly lim: number;

  constructor(
    private readonly world: TidewaterWorldSampler,
    private readonly colliders: CollidersLike,
    readonly radius = 0.75,
    readonly edgeMargin = 5,
    readonly step = 0.5,
  ) {
    this.lim = world.terrain.size / 2 - edgeMargin;
  }

  addBox(cx: number, cz: number, hx: number, hz: number, rotY: number, yMin: number, yMax: number): void {
    this.boxes.push({ cx, cz, hx, hz, cos: Math.cos(rotY), sin: Math.sin(rotY), yMin, yMax });
  }

  private ground(x: number, z: number): number {
    return this.world.terrainHeight(x, z);
  }

  /** first t in [0,1] along from→to where the sphere touches the ground, or null */
  private groundHit(from: Vector3, to: Vector3): number | null {
    const len = from.distanceTo(to);
    if (len < 1e-6) return null;
    const steps = Math.max(1, Math.ceil(len / this.step));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;
      if (y - this.ground(x, z) < this.radius) return Math.max(0, (i - 1) / steps);
    }
    return null;
  }

  private cylinderHit(from: Vector3, to: Vector3): number | null {
    let best: number | null = null;
    const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
    const a = dx * dx + dz * dz;
    for (const c of this.colliders.cylinders) {
      const yLo = Math.min(from.y, to.y) - this.radius, yHi = Math.max(from.y, to.y) + this.radius;
      if (yHi < c.yMin || yLo > c.yMax) continue;
      const r = c.radius + this.radius;
      const ox = from.x - c.x, oz = from.z - c.z;
      const b = 2 * (ox * dx + oz * dz), cc = ox * ox + oz * oz - r * r;
      if (a < 1e-9) continue;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > 1) continue;
      const y = from.y + dy * t;
      if (y < c.yMin - this.radius || y > c.yMax + this.radius) continue;
      if (best === null || t < best) best = t;
    }
    return best;
  }

  private boxHit(from: Vector3, to: Vector3): number | null {
    let best: number | null = null;
    const len = from.distanceTo(to);
    if (len < 1e-6) return null;
    const dir = this.tmpDir.copy(to).sub(from).divideScalar(len);
    const d = this.colliders.raycast(from, dir, len + this.radius);
    if (d < len + this.radius) best = Math.max(0, (d - this.radius) / len);
    for (const b of this.boxes) {
      const ox = from.x - b.cx, oz = from.z - b.cz, oy = from.y;
      const lox = ox * b.cos - oz * b.sin, loz = ox * b.sin + oz * b.cos;
      const ldx = dir.x * b.cos - dir.z * b.sin, ldz = dir.x * b.sin + dir.z * b.cos;
      let tmin = 0, tmax = len + this.radius;
      const slab = (o: number, dd: number, lo: number, hi: number) => {
        if (Math.abs(dd) < 1e-8) return o >= lo && o <= hi;
        let t1 = (lo - o) / dd, t2 = (hi - o) / dd;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        return tmin <= tmax;
      };
      if (slab(lox, ldx, -b.hx - this.radius, b.hx + this.radius) && slab(oy, dir.y, b.yMin - this.radius, b.yMax + this.radius) && slab(loz, ldz, -b.hz - this.radius, b.hz + this.radius)) {
        const t = Math.max(0, (tmin - this.radius) / len);
        if (best === null || t < best) best = Math.min(t, 1);
      }
    }
    return best;
  }

  clampPoint(p: Vector3): Vector3 {
    p.x = MathUtils.clamp(p.x, -this.lim, this.lim);
    p.z = MathUtils.clamp(p.z, -this.lim, this.lim);
    const floor = this.ground(p.x, p.z) + this.radius;
    if (p.y < floor) p.y = floor;
    // push out of solid cylinders / boxes at the eye (XZ)
    const q = this.tmpP.set(p.x, p.y - this.radius, p.z);
    if (this.colliders.resolveCapsule(q, this.radius, this.radius * 2, 0)) { p.x = q.x; p.z = q.z; }
    for (const b of this.boxes) {
      if (p.y + this.radius < b.yMin || p.y - this.radius > b.yMax) continue;
      const dx = p.x - b.cx, dz = p.z - b.cz;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (Math.abs(lx) >= b.hx + this.radius || Math.abs(lz) >= b.hz + this.radius) continue;
      const px = b.hx + this.radius - Math.abs(lx), pz = b.hz + this.radius - Math.abs(lz);
      let nx = 0, nz = 0, pen = 0;
      if (px < pz) { nx = Math.sign(lx) || 1; pen = px; } else { nz = Math.sign(lz) || 1; pen = pz; }
      p.x += (nx * b.cos + nz * b.sin) * pen;
      p.z += (-nx * b.sin + nz * b.cos) * pen;
    }
    return p;
  }

  resolve(from: Vector3, to: Vector3): CollisionResult {
    const hits = [this.groundHit(from, to), this.cylinderHit(from, to), this.boxHit(from, to)].filter((t): t is number => t !== null);
    if (hits.length === 0) {
      const pos = to.clone();
      this.clampPoint(pos);
      this.lastClearanceM = pos.y - this.ground(pos.x, pos.z);
      return { pos, obstructed: pos.distanceToSquared(to) > 1e-8 };
    }
    const t = Math.min(...hits);
    const pos = from.clone().lerp(to, t);
    this.clampPoint(pos);
    this.lastClearanceM = pos.y - this.ground(pos.x, pos.z);
    return { pos, obstructed: true };
  }

  losClear(a: Vector3, b: Vector3): boolean {
    // ground: march with a small radius (the eye must see the dolphin's centre)
    const len = a.distanceTo(b);
    const steps = Math.max(1, Math.ceil(len / this.step));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      if (y < this.ground(x, z) + 0.1) return false;
    }
    if (len > 1e-6) {
      const dir = this.tmpDir.copy(b).sub(a).divideScalar(len);
      if (this.colliders.raycast(a, dir, len) < len) return false;
    }
    return true;
  }
}
