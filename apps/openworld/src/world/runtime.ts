// WorldRuntime — the ONLY geographic authority in the Open World.
//
// Wraps the baked bodyarcade-world/1 artifact (V2, read-only) and exposes
// every query the modes need, in SCENE coordinates. Profiles receive this
// object read-only and may draw from it; they can never alter what it
// answers — the cross-profile consistency spec asserts the same battery of
// queries returns identical results under every profile.
//
// Scene mapping (one place, never repeated): the artifact is metres with
// x = east, y = north. three.js scenes here use x = east, z = SOUTH
// (z = -northing), y = elevation. Yaw 0 faces north (-Z), positive yaw
// turns clockwise viewed from above — the locomotion package convention
// (forward = (sin yaw, -cos yaw)), which also makes yawDeg a compass
// heading, so baked runway headings map straight through.

import {
  loadWorld, decodeHeights, heightAt, worldPointInWater, nearestNavNode,
  worldAttributionLines,
  type WorldData, type WorldNavGraph, type WorldSpawn, type WorldTransition,
} from '@bodyarcade/world-data';
import type { PathHint } from '@bodyarcade/locomotion';

export interface SpawnPoint {
  kind: WorldSpawn['kind'];
  name: string;
  x: number;
  z: number;
  yawDeg: number;
  elevM: number | undefined;
  node: number | null;
}

export interface TransitionPoint {
  kind: WorldTransition['kind'];
  name: string;
  x: number;
  z: number;
  radiusM: number;
  walkNode?: number;
  rowNode?: number | null;
}

/** Walkable half-width by nav edge class (metres) — pavement realism is
 *  not the goal; locomotion assist shoulder behavior is. */
const WALK_HALF_WIDTH: Record<string, number> = {
  footway: 1.2, path: 1.2, steps: 0.9, cycleway: 1.5, pier: 1.4,
  major: 3.2, street: 2.6, service: 2.0, track: 1.8,
};
const WALK_HALF_WIDTH_DEFAULT = 1.5;
/** Off-network beyond this distance: assist disengages (graybox value). */
const WALK_HINT_MAX_M = 30;

interface Seg {
  ax: number; ay: number; bx: number; by: number;
  /** precomputed: (b-a) and squared length */
  dx: number; dy: number; len2: number;
  halfWidth: number;
}

/** Uniform spatial hash over 2-D segments (world x/y metres). */
class SegmentGrid {
  private cell: number;
  private map = new Map<number, number[]>();
  readonly segs: Seg[] = [];
  private minX: number; private minY: number; private cols: number; private rows: number;

  constructor(bbox: [number, number, number, number], cellM: number) {
    this.cell = cellM;
    this.minX = bbox[0]; this.minY = bbox[1];
    this.cols = Math.max(1, Math.ceil((bbox[2] - bbox[0]) / cellM));
    this.rows = Math.max(1, Math.ceil((bbox[3] - bbox[1]) / cellM));
  }

  private key(cx: number, cy: number): number { return cy * this.cols + cx; }
  private clampX(cx: number): number { return Math.min(Math.max(cx, 0), this.cols - 1); }
  private clampY(cy: number): number { return Math.min(Math.max(cy, 0), this.rows - 1); }

  add(ax: number, ay: number, bx: number, by: number, halfWidth = 0): void {
    const idx = this.segs.length;
    const dx = bx - ax; const dy = by - ay;
    this.segs.push({ ax, ay, bx, by, dx, dy, len2: dx * dx + dy * dy, halfWidth });
    const x0 = this.clampX(Math.floor((Math.min(ax, bx) - this.minX) / this.cell));
    const x1 = this.clampX(Math.floor((Math.max(ax, bx) - this.minX) / this.cell));
    const y0 = this.clampY(Math.floor((Math.min(ay, by) - this.minY) / this.cell));
    const y1 = this.clampY(Math.floor((Math.max(ay, by) - this.minY) / this.cell));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        const arr = this.map.get(k);
        if (arr) arr.push(idx); else this.map.set(k, [idx]);
      }
    }
  }

  /** Nearest segment to (x, y) within maxDist; null when none. */
  nearest(x: number, y: number, maxDist: number): { seg: Seg; dist: number; t: number } | null {
    const cx0 = Math.floor((x - this.minX) / this.cell);
    const cy0 = Math.floor((y - this.minY) / this.cell);
    const maxRing = Math.ceil(maxDist / this.cell) + 1;
    let best: { seg: Seg; dist: number; t: number } | null = null;
    const seen = new Set<number>();
    for (let ring = 0; ring <= maxRing; ring++) {
      // once a hit exists, one extra ring guarantees correctness
      if (best && ring > Math.ceil(best.dist / this.cell) + 1) break;
      for (let cy = this.clampY(cy0 - ring); cy <= this.clampY(cy0 + ring); cy++) {
        for (let cx = this.clampX(cx0 - ring); cx <= this.clampX(cx0 + ring); cx++) {
          if (Math.max(Math.abs(cx - cx0), Math.abs(cy - cy0)) !== ring) continue;
          const arr = this.map.get(this.key(cx, cy));
          if (!arr) continue;
          for (const i of arr) {
            if (seen.has(i)) continue;
            seen.add(i);
            const s = this.segs[i];
            let t = s.len2 > 0 ? ((x - s.ax) * s.dx + (y - s.ay) * s.dy) / s.len2 : 0;
            t = Math.min(Math.max(t, 0), 1);
            const px = s.ax + s.dx * t;
            const py = s.ay + s.dy * t;
            const d = Math.hypot(x - px, y - py);
            if (d <= maxDist && (!best || d < best.dist)) best = { seg: s, dist: d, t };
          }
        }
      }
    }
    return best;
  }
}

export class WorldRuntime {
  readonly world: WorldData;
  readonly heights: Float32Array;
  readonly seaLevel: number;
  /** scene-space bounds: minX/maxX east, minZ/maxZ (z = -north) */
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  private waterGrid: SegmentGrid;
  private walkGrid: SegmentGrid;
  private rowAdj: Map<number, number[]>;
  /** heading fed by the active mode so PathHint dir follows travel */
  private hintYawDeg = 0;

  constructor(json: unknown) {
    const w = loadWorld(json);
    this.world = w;
    this.heights = decodeHeights(w);
    this.seaLevel = w.terrain.seaLevelM;
    const [minX, minY, maxX, maxY] = w.bbox;
    this.bounds = { minX, maxX, minZ: -maxY, maxZ: -minY };

    // --- shoreline SDF support: every water polygon ring, hashed ---
    this.waterGrid = new SegmentGrid(w.bbox, 60);
    for (const p of w.layers.water.polygons) {
      this.addRing(this.waterGrid, p.outer);
      for (const h of p.holes) this.addRing(this.waterGrid, h.ring);
    }

    // --- bathymetry carve -------------------------------------------
    // The DEM carries no water depths at this latitude (open-fjord cells
    // read as +dozens of metres — V2 documents the coarse->60N sources).
    // The water POLYGONS are authoritative, so water cells get a
    // deterministic synthetic bathymetry from the shore SDF (the
    // completed Dolphin precedent), floored by real DEM depths where the
    // bake does carry them. Lives HERE so every profile and every mode
    // shares one seabed. DECISIONS.md V4.
    this.carveBathymetry();

    // --- walk network: edges of the LARGEST component only (74 exist;
    // spur components would strand the assist) ---
    const comp = largestComponent(w.nav.walk);
    this.walkGrid = new SegmentGrid(w.bbox, 40);
    const classes = w.nav.walk.edgeClasses ?? [];
    for (const e of w.nav.walk.edges) {
      const [a, b, , classCode] = e;
      if (comp[a] !== 1) continue;
      const [ax, ay] = w.nav.walk.nodes[a];
      const [bx, by] = w.nav.walk.nodes[b];
      const cls = classes[classCode ?? -1];
      this.walkGrid.add(ax, ay, bx, by, WALK_HALF_WIDTH[cls] ?? WALK_HALF_WIDTH_DEFAULT);
    }

    // --- row network adjacency (routing/containment helpers) ---
    this.rowAdj = new Map();
    for (const [a, b] of w.nav.row.edges) {
      (this.rowAdj.get(a) ?? this.rowAdj.set(a, []).get(a)!).push(b);
      (this.rowAdj.get(b) ?? this.rowAdj.set(b, []).get(b)!).push(a);
    }
  }

  /** depth (m) synthesized from shore distance — deterministic, shared. */
  static synthDepth(sdfM: number): number {
    return Math.min(45, 1.5 + 0.16 * sdfM);
  }

  private carveBathymetry(): void {
    const t = this.world.terrain;
    const shoreDists = new Float32Array(t.width * t.height);
    for (let gy = 0; gy < t.height; gy++) {
      const wy = t.originY + gy * t.cellSizeM;
      for (let gx = 0; gx < t.width; gx++) {
        const wx = t.originX + gx * t.cellSizeM;
        const i = gy * t.width + gx;
        const hit = this.waterGrid.nearest(wx, wy, 400);
        const shoreDist = hit ? hit.dist : 400;
        if (worldPointInWater(this.world, wx, wy)) {
          const depth = WorldRuntime.synthDepth(shoreDist);
          this.heights[i] = Math.min(this.heights[i], this.seaLevel - depth);
        } else {
          // Coastal conditioning: the same coarse DEM reports the town
          // spit (~3 m in reality) as a 20–40 m plateau with cliff walls
          // at the coastline. Clamp land to a slope envelope rising from
          // the shore — fjord walls 1 km inland are untouched.
          const cap = this.seaLevel + 3 + 0.45 * shoreDist;
          if (this.heights[i] > cap) this.heights[i] = cap;
        }
        shoreDists[i] = shoreDist;
      }
    }
    // Round the shoreline lip: a 3×3 mean over cells within ~3 cells of
    // the shore kills the near-vertical faces where cap meets carve
    // without touching ridge lines inland.
    const blurred = this.heights.slice();
    const BLUR_BAND_M = 3 * t.cellSizeM;
    for (let gy = 1; gy < t.height - 1; gy++) {
      for (let gx = 1; gx < t.width - 1; gx++) {
        const i = gy * t.width + gx;
        if (shoreDists[i] > BLUR_BAND_M) continue;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) sum += this.heights[i + dy * t.width + dx];
        }
        blurred[i] = sum / 9;
      }
    }
    this.heights.set(blurred);
  }

  private addRing(grid: SegmentGrid, ring: [number, number][]): void {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      grid.add(ax, ay, bx, by);
    }
  }

  // ---- scene <-> world ------------------------------------------------
  toScene(wx: number, wy: number): [number, number] { return [wx, -wy]; }
  toWorld(x: number, z: number): [number, number] { return [x, -z]; }

  // ---- terrain --------------------------------------------------------
  /** Terrain elevation (scene Y, metres) at scene (x, z). */
  groundY(x: number, z: number): number {
    return heightAt(this.world, this.heights, x, -z);
  }

  // ---- water ----------------------------------------------------------
  /** True when scene (x, z) lies in any baked water polygon. */
  inWater(x: number, z: number): boolean {
    return worldPointInWater(this.world, x, -z);
  }

  /** Signed distance to the nearest shoreline: + in water, − on land.
   *  Clamped to ±clampM when no shoreline is within reach (open sea /
   *  deep inland — both fine for containment forces). */
  shoreSDF(x: number, z: number, clampM = 400): number {
    const hit = this.waterGrid.nearest(x, -z, clampM);
    const d = hit ? hit.dist : clampM;
    return this.inWater(x, z) ? d : -d;
  }

  /** Water depth in metres at scene (x, z): bathymetry from the baked
   *  heightfield (0 on land or where terrain rises above sea level). */
  waterDepth(x: number, z: number): number {
    return Math.max(0, this.seaLevel - this.groundY(x, z));
  }

  // ---- walking --------------------------------------------------------
  /** Modes feed the traveler's heading so hint direction follows travel. */
  setHintHeading(yawDeg: number): void { this.hintYawDeg = yawDeg; }

  /** PathHint over nav.walk — the exact @bodyarcade/locomotion contract. */
  readonly walkHint: PathHint = (x: number, z: number) => {
    const hit = this.walkGrid.nearest(x, -z, WALK_HINT_MAX_M);
    if (!hit) return null;
    const { seg } = hit;
    const len = Math.sqrt(seg.len2) || 1;
    // world dir → scene dir (z = -y), then orient along current travel
    let dirX = seg.dx / len;
    let dirZ = -seg.dy / len;
    const yaw = (this.hintYawDeg * Math.PI) / 180;
    const fwdX = Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    if (dirX * fwdX + dirZ * fwdZ < 0) { dirX = -dirX; dirZ = -dirZ; }
    const px = seg.ax + seg.dx * hit.t;
    const py = seg.ay + seg.dy * hit.t;
    const [sx, sz] = this.toScene(px, py);
    // right of travel
    const rx = -dirZ;
    const rz = dirX;
    const lateral = (x - sx) * rx + (z - sz) * rz;
    return { dirX, dirZ, lateral, halfWidth: seg.halfWidth };
  };

  nearestWalkNode(x: number, z: number): number {
    return nearestNavNode(this.world.nav.walk, x, -z);
  }

  // ---- rowing ---------------------------------------------------------
  nearestRowNode(x: number, z: number): number {
    return nearestNavNode(this.world.nav.row, x, -z);
  }

  rowNodeScene(i: number): [number, number] {
    const [wx, wy] = this.world.nav.row.nodes[i];
    return this.toScene(wx, wy);
  }

  rowNeighbors(i: number): number[] { return this.rowAdj.get(i) ?? []; }

  get rowGraph(): WorldNavGraph { return this.world.nav.row; }

  // ---- spawns / transitions --------------------------------------------
  spawns(kind?: WorldSpawn['kind']): SpawnPoint[] {
    return this.world.spawns
      .filter((s) => !kind || s.kind === kind)
      .map((s) => {
        const [x, z] = this.toScene(s.pos[0], s.pos[1]);
        return {
          kind: s.kind, name: s.name, x, z,
          yawDeg: s.headingDeg ?? 0, elevM: s.elevM, node: s.node ?? null,
        };
      });
  }

  spawn(kind: WorldSpawn['kind'], name?: string): SpawnPoint {
    const all = this.spawns(kind);
    const hit = name ? all.find((s) => s.name === name) : all[0];
    if (!hit) throw new Error(`openworld: no ${kind} spawn${name ? ` named ${name}` : ''}`);
    return hit;
  }

  transitions(kind?: WorldTransition['kind']): TransitionPoint[] {
    return this.world.transitions
      .filter((t) => !kind || t.kind === kind)
      .map((t) => {
        const [x, z] = this.toScene(t.pos[0], t.pos[1]);
        return {
          kind: t.kind, name: t.name, x, z, radiusM: t.radiusM,
          walkNode: t.walkNode, rowNode: t.rowNode,
        };
      });
  }

  // ---- region containment (flight) --------------------------------------
  /** Distance from scene (x, z) to the region edge (+ inside, − outside). */
  edgeDistance(x: number, z: number): number {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    return Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
  }

  // ---- provenance --------------------------------------------------------
  attribution(): string[] { return worldAttributionLines(this.world); }

  /** Deterministic geographic query battery — the cross-profile
   *  consistency contract. Profiles cannot influence any of this. */
  battery(): Record<string, unknown> {
    const pts: [number, number][] = [];
    const { minX, maxX, minZ, maxZ } = this.bounds;
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) {
        pts.push([minX + ((maxX - minX) * i) / 6, minZ + ((maxZ - minZ) * j) / 6]);
      }
    }
    this.setHintHeading(0);
    return {
      spawns: this.spawns(),
      transitions: this.transitions(),
      ground: pts.map(([x, z]) => Math.round(this.groundY(x, z) * 100) / 100),
      water: pts.map(([x, z]) => this.inWater(x, z)),
      sdf: pts.map(([x, z]) => Math.round(this.shoreSDF(x, z) * 10) / 10),
      walkHint: pts.map(([x, z]) => {
        const h = this.walkHint(x, z);
        return h ? [h.dirX.toFixed(4), h.dirZ.toFixed(4), h.lateral.toFixed(2), h.halfWidth] : null;
      }),
      walkNode: pts.map(([x, z]) => this.nearestWalkNode(x, z)),
      rowNode: pts.map(([x, z]) => this.nearestRowNode(x, z)),
      attribution: this.attribution(),
    };
  }
}

/** Mark nodes of the largest connected component (1 = member). */
function largestComponent(g: WorldNavGraph): Uint8Array {
  const n = g.nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of g.edges) { adj[a].push(b); adj[b].push(a); }
  const comp = new Int32Array(n).fill(-1);
  let bestComp = -1;
  let bestSize = 0;
  let c = 0;
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1) continue;
    let size = 0;
    stack.push(i);
    comp[i] = c;
    while (stack.length) {
      const v = stack.pop()!;
      size++;
      for (const u of adj[v]) if (comp[u] === -1) { comp[u] = c; stack.push(u); }
    }
    if (size > bestSize) { bestSize = size; bestComp = c; }
    c++;
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = comp[i] === bestComp ? 1 : 0;
  return out;
}
