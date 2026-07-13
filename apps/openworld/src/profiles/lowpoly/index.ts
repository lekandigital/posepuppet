// Low-poly profile — the first renderer over the baked region: PS2-adjacent
// flat-shaded vertex-lit geometry, restricted palette, exponential-distance
// fog, no textures. Deliberately kin to the completed Dolphin's language so
// the underwater mode reads as the same world.
//
// Style only: everything here draws FROM WorldRuntime queries; nothing here
// is queried BY gameplay.

import * as THREE from 'three';
import type { ProfileContext, WorldProfile } from '../types';
import type { WorldRuntime } from '../../world/runtime';

export const LP = {
  sky: 0x8fc3e8,
  fog: 0xa8d4ec,
  seaDeep: 0x1d6f96,
  seaShallow: 0x3ba3c4,
  sand: 0xc7b98a,
  grassLow: 0x6fae62,
  grassHigh: 0x8fbf74,
  rock: 0x8d8f96,
  snow: 0xeef3f6,
  road: 0x5d626e,
  path: 0x9a8f76,
  building: 0xdfe3e8,
  buildingRoof: 0xb4534b,
  runway: 0x4a4f5a,
  pier: 0x7a6a52,
} as const;

const TERRAIN_STEP = 2; // heightfield decimation: 376×334 → 188×167 verts

function buildTerrain(world: WorldRuntime): THREE.Mesh {
  const t = world.world.terrain;
  const step = TERRAIN_STEP;
  const w = Math.floor((t.width - 1) / step) + 1;
  const h = Math.floor((t.height - 1) / step) + 1;
  const pos = new Float32Array(w * h * 3);
  const col = new Float32Array(w * h * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(LP.sand);
  const grassLo = new THREE.Color(LP.grassLow);
  const grassHi = new THREE.Color(LP.grassHigh);
  const rock = new THREE.Color(LP.rock);
  const snow = new THREE.Color(LP.snow);
  const seabedLo = new THREE.Color(0x1a4a5e);
  const seabedHi = new THREE.Color(0x3d7a74);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const wx = t.originX + gx * step * t.cellSizeM;
      const wy = t.originY + gy * step * t.cellSizeM;
      const i = gy * w + gx;
      const elev = world.heights[Math.min(gy * step, t.height - 1) * t.width + Math.min(gx * step, t.width - 1)];
      pos[i * 3] = wx;
      pos[i * 3 + 1] = elev;
      pos[i * 3 + 2] = -wy;
      if (elev <= world.seaLevel + 0.2) {
        // seabed: brighter toward the surface (the Dolphin treatment)
        const depth = Math.max(0, world.seaLevel - elev);
        c.lerpColors(seabedHi, seabedLo, Math.min(1, depth / 60));
        if (depth < 1.5) c.copy(sand);
      } else if (elev < 8) c.copy(sand).lerp(grassLo, elev / 8);
      else if (elev < 160) c.lerpColors(grassLo, grassHi, elev / 160);
      else if (elev < 420) c.lerpColors(grassHi, rock, (elev - 160) / 260);
      else c.lerpColors(rock, snow, Math.min(1, (elev - 420) / 180));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  const idx: number[] = [];
  for (let gy = 0; gy < h - 1; gy++) {
    for (let gx = 0; gx < w - 1; gx++) {
      const a = gy * w + gx;
      idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
}

function buildWater(world: WorldRuntime): { mesh: THREE.Mesh; update(tS: number): void } {
  // Sea + lakes as one translucent sheet at sea level, triangulated from
  // the REAL polygons (ShapeGeometry handles holes). Shape XY plane →
  // rotateX(-90°) maps (x, northing) to scene (x, 0, -northing).
  const shapes: THREE.Shape[] = [];
  for (const p of world.world.layers.water.polygons) {
    const s = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of p.holes) {
      s.holes.push(new THREE.Path(h.ring.map(([x, y]) => new THREE.Vector2(x, y))));
    }
    shapes.push(s);
  }
  const geo = new THREE.ShapeGeometry(shapes, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: LP.seaShallow,
    transparent: true,
    opacity: 0.86,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = world.seaLevel + 0.15;
  return {
    mesh,
    update(tS: number) {
      // low-poly water breathes rather than waves: subtle level bob +
      // hue shimmer, cheap and deliberate
      mesh.position.y = world.seaLevel + 0.15 + Math.sin(tS * 0.7) * 0.08;
      mat.color.lerpColors(
        new THREE.Color(LP.seaShallow), new THREE.Color(LP.seaDeep),
        0.5 + 0.22 * Math.sin(tS * 0.23),
      );
    },
  };
}

/** Merged ribbon mesh for a set of polylines draped on the terrain. */
function buildRibbons(
  world: WorldRuntime,
  lines: { pts: [number, number][]; widthM?: number }[],
  color: number,
  lift: number,
  defaultWidth: number,
): THREE.Mesh | null {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const line of lines) {
    const w = Math.max(1.4, line.widthM ?? defaultWidth) / 2;
    const pts = line.pts;
    if (pts.length < 2) continue;
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(i - 1, 0)];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const rx = dy / len; // right side in scene space (z = -north)
      const rz = dx / len;
      const [sx, sz] = world.toScene(pts[i][0], pts[i][1]);
      const y = world.groundY(sx, sz) + lift;
      pos.push(sx + rx * w, y, sz + rz * w, sx - rx * w, y, sz - rz * w);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide }),
  );
}

function buildBuildings(world: WorldRuntime): THREE.Mesh | null {
  // Extruded footprints: walls from the outer ring, roof from the baked
  // ear-clip triangles (collision.buildings indexes the SAME ring — one
  // geometry, no re-triangulation).
  const roofIdx = new Map<number, number[]>();
  for (const cb of world.world.collision.buildings) roofIdx.set(cb.building, cb.indices);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const wall = new THREE.Color(LP.building);
  const roof = new THREE.Color(LP.buildingRoof);
  for (const b of world.world.layers.buildings) {
    const ring = b.outer;
    if (ring.length < 3) continue;
    let baseY = Infinity;
    let cx = 0; let cz = 0;
    const scenePts: [number, number][] = ring.map(([wx, wy]) => {
      const [sx, sz] = world.toScene(wx, wy);
      cx += sx; cz += sz;
      return [sx, sz];
    });
    cx /= ring.length; cz /= ring.length;
    for (const [sx, sz] of scenePts) baseY = Math.min(baseY, world.groundY(sx, sz));
    baseY = Math.min(baseY, world.groundY(cx, cz));
    const topY = baseY + Math.max(2.5, b.heightM);
    // walls
    const wallBase = pos.length / 3;
    for (const [sx, sz] of scenePts) {
      pos.push(sx, baseY - 1.5, sz, sx, topY, sz);
      col.push(wall.r, wall.g, wall.b, wall.r, wall.g, wall.b);
    }
    const n = scenePts.length;
    for (let i = 0; i < n; i++) {
      const a = wallBase + i * 2;
      const b2 = wallBase + ((i + 1) % n) * 2;
      idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
    }
    // roof
    const tri = roofIdx.get(b.id);
    if (tri) {
      const roofBase = pos.length / 3;
      for (const [sx, sz] of scenePts) {
        pos.push(sx, topY, sz);
        col.push(roof.r, roof.g, roof.b);
      }
      for (const t of tri) idx.push(roofBase + t);
    }
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
  );
}

export function createLowPolyProfile(): WorldProfile {
  let water: { mesh: THREE.Mesh; update(tS: number): void } | null = null;
  let built: THREE.Object3D[] = [];
  let scene: THREE.Scene | null = null;

  return {
    id: 'low-poly',
    label: 'LOW-POLY',
    modes: ['flight', 'walk', 'row', 'dolphin'],

    build(ctx: ProfileContext): void {
      scene = ctx.scene;
      scene.background = new THREE.Color(LP.sky);
      scene.fog = new THREE.Fog(LP.fog, 900, 5200);

      const hemi = new THREE.HemisphereLight(0xdfeefc, 0x51616e, 0.95);
      const sun = new THREE.DirectionalLight(0xfff4dd, 1.15);
      sun.position.set(-1400, 1800, -600); // low northern sun over the fjord
      built.push(hemi, sun);

      const terrain = buildTerrain(ctx.world);
      built.push(terrain);

      water = buildWater(ctx.world);
      built.push(water.mesh);

      const roads = buildRibbons(
        ctx.world,
        ctx.world.world.layers.roads.filter((r) => !r.tunnel),
        LP.road, 0.25, 5,
      );
      if (roads) built.push(roads);
      const paths = buildRibbons(ctx.world, ctx.world.world.layers.paths, LP.path, 0.2, 1.8);
      if (paths) built.push(paths);
      const runways = buildRibbons(
        ctx.world,
        ctx.world.world.layers.aeroways.map((a) => ({
          pts: a.pts,
          widthM: a.widthM ?? (a.class === 'runway' ? 18 : 9),
        })),
        LP.runway, 0.3, 18,
      );
      if (runways) built.push(runways);

      const buildings = buildBuildings(ctx.world);
      if (buildings) built.push(buildings);

      for (const o of built) scene.add(o);
    },

    update(_dtS: number, timeS: number, _camera: THREE.PerspectiveCamera): void {
      water?.update(timeS);
    },

    dispose(): void {
      if (!scene) return;
      for (const o of built) {
        scene.remove(o);
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      }
      built = [];
    },
  };
}
