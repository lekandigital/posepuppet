// Realistic profile — grounded, achievable browser graphics over the SAME
// baked data: subarctic lighting (low warm sun, cool sky bounce, ACES),
// full-resolution smooth terrain with slope/elevation/noise materials
// (wet sand, moss-green valley grass, exposed rock, worn snow), specular
// fjord water with moving ripples, instanced birch stands on the baked
// forest landuse, painted Icelandic building walls, asphalt/gravel road
// treatment, distance haze. Not photoreal, not sim-grade — a believable
// cold place. Style only; geography stays in WorldRuntime.

import * as THREE from 'three';
import type { ProfileContext, WorldProfile } from '../types';
import type { WorldRuntime } from '../../world/runtime';
// deterministic value noise — reused from the completed dolphin (RNG-free)
import { valueNoise2 } from '../../../../dolphin/src/game/sim';

const R = {
  skyTop: 0x4a7fb5,
  skyHorizon: 0xc9dcea,
  sun: 0xffe8c8,
  hemiSky: 0xbfd4e6,
  hemiGround: 0x606a5a,
  haze: 0xc3d6e4,
  waterDeep: 0x14384a,
  waterShallow: 0x2a6273,
  sandWet: 0x8a7f66,
  grassValley: 0x5a7245,
  grassUpland: 0x7d8a5c,
  heath: 0x8a8560,
  rock: 0x75757c,
  rockDark: 0x5c5c63,
  snow: 0xe8edf2,
  road: 0x3f4246,
  path: 0x8c8272,
  runway: 0x505459,
  trunk: 0x6e5a43,
  birch: 0x4f6d3a,
  birchLight: 0x6d8a4a,
} as const;

function buildTerrain(world: WorldRuntime): THREE.Mesh {
  const t = world.world.terrain;
  const w = t.width;
  const h = t.height;
  const pos = new Float32Array(w * h * 3);
  const col = new Float32Array(w * h * 3);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const i = gy * w + gx;
      const wx = t.originX + gx * t.cellSizeM;
      const wy = t.originY + gy * t.cellSizeM;
      const elev = world.heights[i];
      pos[i * 3] = wx;
      pos[i * 3 + 1] = elev;
      pos[i * 3 + 2] = -wy;
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
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const normals = geo.getAttribute('normal') as THREE.BufferAttribute;

  const c = new THREE.Color();
  const sandWet = new THREE.Color(R.sandWet);
  const grassV = new THREE.Color(R.grassValley);
  const grassU = new THREE.Color(R.grassUpland);
  const heath = new THREE.Color(R.heath);
  const rock = new THREE.Color(R.rock);
  const rockDark = new THREE.Color(R.rockDark);
  const snow = new THREE.Color(R.snow);
  const seabed = new THREE.Color(0x2c4a42);
  const seabedDeep = new THREE.Color(0x16323c);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const i = gy * w + gx;
      const elev = pos[i * 3 + 1];
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      const slope = 1 - normals.getY(i); // 0 flat → 1 cliff
      const n = valueNoise2(x * 0.012 + 7, z * 0.012 - 3); // large mottle
      const n2 = valueNoise2(x * 0.05 - 11, z * 0.05 + 5); // fine grain
      if (elev <= world.seaLevel + 0.15) {
        const depth = Math.max(0, world.seaLevel - elev);
        c.lerpColors(seabed, seabedDeep, Math.min(1, depth / 45));
      } else if (elev < 4) {
        c.copy(sandWet).lerp(grassV, (elev / 4) * 0.6);
      } else {
        // grass → upland → heath by elevation with noise-broken bands
        const band = elev + n * 60 - 30;
        if (band < 120) c.lerpColors(grassV, grassU, band / 120);
        else if (band < 260) c.lerpColors(grassU, heath, (band - 120) / 140);
        else c.copy(heath);
        // rock takes over on slope, dark in crevices
        const rockMix = Math.min(1, Math.max(0, (slope - 0.12) * 3.2));
        if (rockMix > 0) c.lerp(n2 > 0.5 ? rock : rockDark, rockMix);
        // worn snow above a noisy line, avoiding cliffs
        const snowLine = 430 + n * 90;
        if (elev > snowLine && slope < 0.35) {
          c.lerp(snow, Math.min(1, (elev - snowLine) / 60 + 0.55));
        }
      }
      // fine tonal grain so big faces never read flat
      const g = 0.94 + n2 * 0.12;
      col[i * 3] = c.r * g;
      col[i * 3 + 1] = c.g * g;
      col[i * 3 + 2] = c.b * g;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }),
  );
}

function buildSky(world: WorldRuntime): THREE.Mesh {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const radius = Math.max(maxX - minX, maxZ - minZ) * 1.6;
  const geo = new THREE.SphereGeometry(radius, 24, 12);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(R.skyTop);
  const hor = new THREE.Color(R.skyHorizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const tUp = Math.max(0, Math.min(1, pos.getY(i) / radius));
    c.lerpColors(hor, top, Math.pow(tUp, 0.55));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  return mesh;
}

function buildWater(world: WorldRuntime): { mesh: THREE.Mesh; update(tS: number): void } {
  const shapes: THREE.Shape[] = [];
  for (const p of world.world.layers.water.polygons) {
    const s = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hl of p.holes) s.holes.push(new THREE.Path(hl.ring.map(([x, y]) => new THREE.Vector2(x, y))));
    shapes.push(s);
  }
  const geo = new THREE.ShapeGeometry(shapes, 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: R.waterShallow,
    roughness: 0.34,
    metalness: 0.05,
    transparent: true,
    opacity: 0.94,
  });
  // moving micro-ripple: perturb the normal in the shader clock — cheap,
  // no texture; the specular sun path shimmers
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    mat.userData.uniforms = sh.uniforms;
    // long low-frequency swell in WORLD space — a broad moving glint,
    // not per-pixel noise (view-space high frequency aliased into moire)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOwWorld;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvOwWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vOwWorld;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(normal + 0.03 * vec3(
          sin(vOwWorld.x * 0.031 + vOwWorld.z * 0.017 + uTime * 0.9)
            + 0.55 * sin(vOwWorld.z * 0.083 - vOwWorld.x * 0.041 + uTime * 1.27),
          0.0,
          cos(vOwWorld.z * 0.029 - vOwWorld.x * 0.019 + uTime * 0.73)
            + 0.55 * cos(vOwWorld.x * 0.071 + vOwWorld.z * 0.047 - uTime * 1.09)));`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = world.seaLevel + 0.12;
  return {
    mesh,
    update(tS: number) {
      const u = mat.userData.uniforms as { uTime: { value: number } } | undefined;
      if (u) u.uTime.value = tS;
      mesh.position.y = world.seaLevel + 0.12 + Math.sin(tS * 0.5) * 0.05;
    },
  };
}

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
    const w = Math.max(1.2, line.widthM ?? defaultWidth) / 2;
    const pts = line.pts;
    if (pts.length < 2) continue;
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(i - 1, 0)];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const rx = dy / len;
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
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  );
}

/** Icelandic paint: corrugated walls in white/cream/red/blue/green, dark
 *  roofs — deterministic per building id. */
const WALL_PAINTS = [0xe8e4da, 0xd9d2c2, 0xb8483e, 0x3e6a8a, 0x4a6b4e, 0xdfd8c8, 0xc4beb0];
const ROOF_PAINTS = [0x3a3f45, 0x593230, 0x2f4050, 0x3d4a3a, 0x44403c];

function buildBuildings(world: WorldRuntime): THREE.Mesh | null {
  const roofIdx = new Map<number, number[]>();
  for (const cb of world.world.collision.buildings) roofIdx.set(cb.building, cb.indices);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const wall = new THREE.Color();
  const roof = new THREE.Color();
  for (const b of world.world.layers.buildings) {
    const ring = b.outer;
    if (ring.length < 3) continue;
    wall.setHex(WALL_PAINTS[Math.abs(b.id) % WALL_PAINTS.length]);
    roof.setHex(ROOF_PAINTS[Math.abs(b.id * 7 + 3) % ROOF_PAINTS.length]);
    let baseY = Infinity;
    const scenePts: [number, number][] = ring.map(([wx, wy]) => world.toScene(wx, wy));
    for (const [sx, sz] of scenePts) baseY = Math.min(baseY, world.groundY(sx, sz));
    const topY = baseY + Math.max(2.8, b.heightM);
    const wallBase = pos.length / 3;
    for (const [sx, sz] of scenePts) {
      pos.push(sx, baseY - 1.2, sz, sx, topY, sz);
      col.push(wall.r, wall.g, wall.b, wall.r, wall.g, wall.b);
    }
    const n = scenePts.length;
    for (let i = 0; i < n; i++) {
      const a = wallBase + i * 2;
      const b2 = wallBase + ((i + 1) % n) * 2;
      idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
    }
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
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
  );
}

/** Birch stands on the baked forest polygons — instanced, deterministic. */
function buildForests(world: WorldRuntime): THREE.InstancedMesh | null {
  const forests = world.world.layers.landuse.filter((l) => l.class === 'forest');
  if (!forests.length) return null;
  // canopy + trunk merged into one low-poly tree
  const canopy = new THREE.ConeGeometry(1.6, 3.4, 6);
  canopy.translate(0, 3.4, 0);
  const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.9, 5);
  trunk.translate(0, 0.95, 0);
  // merge manually
  const geos = [trunk, canopy];
  const colors: number[] = [];
  const merged = new THREE.BufferGeometry();
  const posArr: number[] = [];
  const idxArr: number[] = [];
  let base = 0;
  const cols = [new THREE.Color(R.trunk), new THREE.Color(R.birch)];
  geos.forEach((g, gi) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      posArr.push(p.getX(i), p.getY(i), p.getZ(i));
      colors.push(cols[gi].r, cols[gi].g, cols[gi].b);
    }
    const ind = g.getIndex()!;
    for (let i = 0; i < ind.count; i++) idxArr.push(ind.getX(i) + base);
    base += p.count;
  });
  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(idxArr);
  merged.computeVertexNormals();

  // deterministic scatter: grid + noise jitter, point-in-polygon kept
  const spots: { x: number; z: number; s: number; r: number }[] = [];
  for (const f of forests) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of f.outer) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const STEP = 26;
    for (let y = minY; y <= maxY; y += STEP) {
      for (let x = minX; x <= maxX; x += STEP) {
        const jx = (valueNoise2(x * 0.13, y * 0.17) - 0.5) * STEP * 0.9;
        const jy = (valueNoise2(x * 0.19 + 31, y * 0.11 - 17) - 0.5) * STEP * 0.9;
        const px = x + jx;
        const py = y + jy;
        if (valueNoise2(px * 0.03, py * 0.03) < 0.35) continue; // clearings
        if (!pointInPoly(px, py, f.outer)) continue;
        const [sx, sz] = world.toScene(px, py);
        spots.push({
          x: sx, z: sz,
          s: 0.7 + valueNoise2(px * 0.7, py * 0.7) * 0.8,
          r: valueNoise2(px * 0.9 + 5, py * 0.9) * Math.PI * 2,
        });
        if (spots.length >= 4000) break;
      }
    }
  }
  if (!spots.length) return null;
  const mesh = new THREE.InstancedMesh(
    merged,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3();
  spots.forEach((sp, i) => {
    q.setFromAxisAngle(up, sp.r);
    sc.set(sp.s, sp.s, sp.s);
    m.compose(new THREE.Vector3(sp.x, Math.max(world.groundY(sp.x, sp.z), world.seaLevel), sp.z), q, sc);
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

function pointInPoly(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function createRealisticProfile(): WorldProfile {
  let water: { mesh: THREE.Mesh; update(tS: number): void } | null = null;
  let built: THREE.Object3D[] = [];
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let prevToneMapping: THREE.ToneMapping = THREE.NoToneMapping;

  return {
    id: 'realistic',
    label: 'REALISTIC',
    modes: ['flight', 'walk', 'row'], // no realistic dolphin — product law

    build(ctx: ProfileContext): void {
      scene = ctx.scene;
      renderer = ctx.renderer;
      prevToneMapping = renderer.toneMapping;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      scene.fog = new THREE.Fog(R.haze, 1400, 7000);
      scene.background = new THREE.Color(R.skyHorizon);

      const hemi = new THREE.HemisphereLight(R.hemiSky, R.hemiGround, 1.15);
      const sun = new THREE.DirectionalLight(R.sun, 1.75);
      sun.position.set(-2200, 1150, -1500); // low north-western sun
      const fill = new THREE.DirectionalLight(0x9fb8d0, 0.4);
      fill.position.set(1800, 900, 1200);
      built.push(hemi, sun, fill);

      built.push(buildSky(ctx.world));
      built.push(buildTerrain(ctx.world));
      water = buildWater(ctx.world);
      built.push(water.mesh);

      const roads = buildRibbons(
        ctx.world, ctx.world.world.layers.roads.filter((r) => !r.tunnel), R.road, 0.22, 5,
      );
      if (roads) built.push(roads);
      const paths = buildRibbons(ctx.world, ctx.world.world.layers.paths, R.path, 0.18, 1.6);
      if (paths) built.push(paths);
      const runways = buildRibbons(
        ctx.world,
        ctx.world.world.layers.aeroways.map((a) => ({
          pts: a.pts, widthM: a.widthM ?? (a.class === 'runway' ? 18 : 9),
        })),
        R.runway, 0.26, 18,
      );
      if (runways) built.push(runways);

      const buildings = buildBuildings(ctx.world);
      if (buildings) built.push(buildings);
      const forest = buildForests(ctx.world);
      if (forest) built.push(forest);

      for (const o of built) scene.add(o);
    },

    update(_dtS: number, timeS: number, _camera: THREE.PerspectiveCamera): void {
      water?.update(timeS);
    },

    dispose(): void {
      if (renderer) renderer.toneMapping = prevToneMapping;
      if (!scene) return;
      for (const o of built) {
        scene.remove(o);
        if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      }
      built = [];
    },
  };
}
