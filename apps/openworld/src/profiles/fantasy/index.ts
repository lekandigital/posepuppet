// Fantasy-game profile — a living storybook diorama of the SAME fjord:
// golden-hour light, painterly meadow bands, milky pastel water, fluffy
// birch blobs, cream-and-butter houses with glowing windows and chimney
// smoke, a windmill on the hill and a lighthouse at the fjord mouth
// (both placed FROM data, not hand pins), drifting clouds, circling
// birds, little sailboats, fireflies at dusk, and one restrained magical
// focal point: a faint aurora ribbon over the water. Geographically
// recognizable by construction — same terrain, coastline, roads,
// settlement pattern; the battery spec proves it. Style only.

import * as THREE from 'three';
import type { ProfileContext, WorldProfile } from '../types';
import type { WorldRuntime } from '../../world/runtime';
import { valueNoise2 } from '../../../../dolphin/src/game/sim';

const F = {
  skyTop: 0x7fb2d9,
  skyHorizon: 0xf2d9b8, // peach dusk
  sun: 0xffe2b0,
  hemiSky: 0xd9e2f0,
  hemiGround: 0x8a7f9a, // lavender bounce
  haze: 0xe8d9d0,
  waterDeep: 0x3d7d8c,
  water: 0x6db5bd,
  sand: 0xe8d9a8,
  meadow: 0x8fbf6a,
  meadowWarm: 0xb5cc70,
  heath: 0xc9a86a,
  rock: 0xa895b0, // lavender rock
  snow: 0xfdf4e3, // warm cream snow
  road: 0xc9b795, // cream lanes
  path: 0xd9c9a3,
  runway: 0xb0a58c,
  trunk: 0x8a6a4a,
  canopy: 0x7ab55c,
  canopyWarm: 0xa3c96a,
  wallPaints: [0xf7ecd7, 0xf2dfb8, 0xe8c9a0, 0xd9a8a0, 0xb8cbd9, 0xc9d9b0, 0xf0d9c9],
  roofPaints: [0xb5645a, 0x8a6a8a, 0x6a8a9a, 0xa3835a, 0x7a8a6a],
  window: 0xffd98a,
  smoke: 0xf0ece8,
  firefly: 0xaef0e0,
  aurora: 0x9fe8d0,
} as const;

// ---------------------------------------------------------------------
function buildTerrain(world: WorldRuntime): THREE.Mesh {
  const t = world.world.terrain;
  const step = 1;
  const w = t.width;
  const h = t.height;
  const pos = new Float32Array(w * h * 3);
  const col = new Float32Array(w * h * 3);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const i = gy * w + gx;
      pos[i * 3] = t.originX + gx * step * t.cellSizeM;
      pos[i * 3 + 1] = world.heights[i];
      pos[i * 3 + 2] = -(t.originY + gy * step * t.cellSizeM);
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
  const sand = new THREE.Color(F.sand);
  const meadow = new THREE.Color(F.meadow);
  const meadowWarm = new THREE.Color(F.meadowWarm);
  const heath = new THREE.Color(F.heath);
  const rock = new THREE.Color(F.rock);
  const snow = new THREE.Color(F.snow);
  const shallows = new THREE.Color(0x7ac9b8);
  const deeps = new THREE.Color(0x2d6a70);
  for (let i = 0; i < w * h; i++) {
    const elev = pos[i * 3 + 1];
    const x = pos[i * 3];
    const z = pos[i * 3 + 2];
    const slope = 1 - normals.getY(i);
    const n = valueNoise2(x * 0.01 + 3, z * 0.01 - 9);
    if (elev <= world.seaLevel + 0.15) {
      c.lerpColors(shallows, deeps, Math.min(1, Math.max(0, world.seaLevel - elev) / 40));
    } else if (elev < 3.5) {
      c.copy(sand);
    } else {
      // painterly meadow bands, warm patches from noise
      const band = elev + n * 80 - 40;
      if (band < 140) c.lerpColors(meadow, meadowWarm, n);
      else if (band < 300) c.lerpColors(meadowWarm, heath, (band - 140) / 160);
      else c.copy(heath);
      const rockMix = Math.min(1, Math.max(0, (slope - 0.16) * 3));
      if (rockMix > 0) c.lerp(rock, rockMix);
      const snowLine = 400 + n * 70;
      if (elev > snowLine && slope < 0.4) c.lerp(snow, 0.85);
    }
    const g = 0.96 + valueNoise2(x * 0.06, z * 0.06) * 0.08;
    col[i * 3] = c.r * g;
    col[i * 3 + 1] = c.g * g;
    col[i * 3 + 2] = c.b * g;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
}

function buildSky(world: WorldRuntime): THREE.Mesh {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const radius = Math.max(maxX - minX, maxZ - minZ) * 1.6;
  const geo = new THREE.SphereGeometry(radius, 24, 12);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const top = new THREE.Color(F.skyTop);
  const hor = new THREE.Color(F.skyHorizon);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.lerpColors(hor, top, Math.pow(Math.max(0, Math.min(1, p.getY(i) / radius)), 0.5));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(
    geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
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
    color: F.water, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.92,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    mat.userData.uniforms = sh.uniforms;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOwWorld;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvOwWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vOwWorld;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(normal + 0.045 * vec3(
          sin(vOwWorld.x * 0.021 + vOwWorld.z * 0.013 + uTime * 0.6),
          0.0,
          cos(vOwWorld.z * 0.024 - vOwWorld.x * 0.016 + uTime * 0.5)));`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = world.seaLevel + 0.12;
  return {
    mesh,
    update(tS: number) {
      const u = mat.userData.uniforms as { uTime: { value: number } } | undefined;
      if (u) u.uTime.value = tS;
      mesh.position.y = world.seaLevel + 0.12 + Math.sin(tS * 0.4) * 0.06;
    },
  };
}

function buildRibbons(
  world: WorldRuntime,
  lines: { pts: [number, number][]; widthM?: number }[],
  color: number, lift: number, defaultWidth: number,
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
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  );
}

function buildBuildings(world: WorldRuntime): { mesh: THREE.Mesh; glows: [number, number, number][] } {
  const roofIdx = new Map<number, number[]>();
  for (const cb of world.world.collision.buildings) roofIdx.set(cb.building, cb.indices);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const wall = new THREE.Color();
  const roof = new THREE.Color();
  const glows: [number, number, number][] = [];
  for (const b of world.world.layers.buildings) {
    const ring = b.outer;
    if (ring.length < 3) continue;
    wall.setHex(F.wallPaints[Math.abs(b.id) % F.wallPaints.length]);
    roof.setHex(F.roofPaints[Math.abs(b.id * 7 + 3) % F.roofPaints.length]);
    let baseY = Infinity;
    let cx = 0; let cz = 0;
    const scenePts: [number, number][] = ring.map(([wx, wy]) => world.toScene(wx, wy));
    for (const [sx, sz] of scenePts) {
      baseY = Math.min(baseY, world.groundY(sx, sz));
      cx += sx; cz += sz;
    }
    cx /= ring.length; cz /= ring.length;
    // cozy exaggeration: a touch taller than life, never a tower
    const topY = baseY + Math.max(3.2, b.heightM * 1.15);
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
    // glowing window + occasional chimney-smoke anchor
    if (valueNoise2(b.id * 0.73, b.id * 0.31) > 0.45) {
      glows.push([cx, baseY + Math.max(2.2, b.heightM * 0.6), cz]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  );
  return { mesh, glows };
}

/** Fluffy two-blob trees on forest landuse + meadow strays. */
function buildTrees(world: WorldRuntime): THREE.InstancedMesh | null {
  const blob1 = new THREE.IcosahedronGeometry(1.7, 1);
  blob1.translate(0, 3.1, 0);
  const blob2 = new THREE.IcosahedronGeometry(1.15, 1);
  blob2.translate(0.7, 4.1, 0.3);
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 5);
  trunk.translate(0, 1.1, 0);
  const parts = [trunk, blob1, blob2];
  const partCols = [new THREE.Color(F.trunk), new THREE.Color(F.canopy), new THREE.Color(F.canopyWarm)];
  const posArr: number[] = [];
  const colArr: number[] = [];
  const idxArr: number[] = [];
  let base = 0;
  parts.forEach((g, gi) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      posArr.push(p.getX(i), p.getY(i), p.getZ(i));
      colArr.push(partCols[gi].r, partCols[gi].g, partCols[gi].b);
    }
    const ind = g.getIndex();
    if (ind) for (let i = 0; i < ind.count; i++) idxArr.push(ind.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idxArr.push(i + base);
    base += p.count;
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  merged.setIndex(idxArr);
  merged.computeVertexNormals();

  const spots: { x: number; z: number; s: number; r: number }[] = [];
  const push = (px: number, py: number): void => {
    const [sx, sz] = world.toScene(px, py);
    const g = world.groundY(sx, sz);
    if (g <= world.seaLevel + 0.5 || g > 300) return;
    spots.push({
      x: sx, z: sz,
      s: 0.75 + valueNoise2(px * 0.7, py * 0.7) * 0.9,
      r: valueNoise2(px * 0.9 + 5, py * 0.9) * Math.PI * 2,
    });
  };
  for (const f of world.world.layers.landuse.filter((l) => l.class === 'forest')) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of f.outer) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    for (let y = minY; y <= maxY; y += 24) {
      for (let x = minX; x <= maxX; x += 24) {
        const px = x + (valueNoise2(x * 0.13, y * 0.17) - 0.5) * 20;
        const py = y + (valueNoise2(x * 0.19 + 31, y * 0.11 - 17) - 0.5) * 20;
        if (valueNoise2(px * 0.03, py * 0.03) < 0.3) continue;
        if (!pointInPoly(px, py, f.outer)) continue;
        push(px, py);
        if (spots.length >= 3800) break;
      }
    }
  }
  // meadow strays near the settlement lowlands
  const { minX, maxX, minZ, maxZ } = world.bounds;
  for (let i = 0; i < 900; i++) {
    const px = minX + valueNoise2(i * 1.7, i * 0.4) * (maxX - minX);
    const pz = minZ + valueNoise2(i * 0.9 + 40, i * 2.3) * (maxZ - minZ);
    const g = world.groundY(px, pz);
    if (g < world.seaLevel + 2 || g > 90) continue;
    if (valueNoise2(px * 0.02, pz * 0.02) < 0.62) continue;
    spots.push({ x: px, z: pz, s: 0.7 + valueNoise2(px, pz) * 0.7, r: 0 });
  }
  if (!spots.length) return null;
  const mesh = new THREE.InstancedMesh(
    merged,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((sp, i) => {
    q.setFromAxisAngle(up, sp.r);
    m.compose(
      new THREE.Vector3(sp.x, world.groundY(sp.x, sp.z), sp.z),
      q,
      new THREE.Vector3(sp.s, sp.s, sp.s),
    );
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

/** Soft radial sprite texture (clouds, smoke, glows). */
function puffTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------
export function createFantasyProfile(): WorldProfile {
  let built: THREE.Object3D[] = [];
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let prevTone: THREE.ToneMapping = THREE.NoToneMapping;
  let water: { mesh: THREE.Mesh; update(t: number): void } | null = null;
  let clouds: THREE.Sprite[] = [];
  let birds: THREE.Group[] = [];
  let smoke: { s: THREE.Sprite; seed: number; base: THREE.Vector3 }[] = [];
  let fireflies: THREE.Points | null = null;
  let fireflyBase: Float32Array | null = null;
  let aurora: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: Float32Array } | null = null;
  let windmillBlades: THREE.Group | null = null;
  let boats: { g: THREE.Group; cx: number; cz: number; r: number; ph: number }[] = [];
  let bounds = { cx: 0, cz: 0, span: 1000 };

  return {
    id: 'fantasy-game',
    label: 'FANTASY',
    modes: ['flight', 'walk', 'row'], // no fantasy dolphin — product law

    build(ctx: ProfileContext): void {
      const world = ctx.world;
      scene = ctx.scene;
      renderer = ctx.renderer;
      prevTone = renderer.toneMapping;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      const { minX, maxX, minZ, maxZ } = world.bounds;
      bounds = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, span: Math.max(maxX - minX, maxZ - minZ) };

      scene.fog = new THREE.Fog(F.haze, 1100, 6200);
      scene.background = new THREE.Color(F.skyHorizon);

      const hemi = new THREE.HemisphereLight(F.hemiSky, F.hemiGround, 1.05);
      const sun = new THREE.DirectionalLight(F.sun, 1.9);
      sun.position.set(-1800, 850, 2000); // golden hour from the south-west
      const fill = new THREE.DirectionalLight(0xb0a3d9, 0.35); // lavender fill
      fill.position.set(1500, 700, -1400);
      built.push(hemi, sun, fill);

      built.push(buildSky(world));
      built.push(buildTerrain(world));
      water = buildWater(world);
      built.push(water.mesh);

      const roads = buildRibbons(world, world.world.layers.roads.filter((r) => !r.tunnel), F.road, 0.22, 4.5);
      if (roads) built.push(roads);
      const paths = buildRibbons(world, world.world.layers.paths, F.path, 0.18, 1.6);
      if (paths) built.push(paths);
      const runways = buildRibbons(
        world,
        world.world.layers.aeroways.map((a) => ({ pts: a.pts, widthM: a.widthM ?? (a.class === 'runway' ? 16 : 8) })),
        F.runway, 0.26, 16,
      );
      if (runways) built.push(runways);

      const b = buildBuildings(world);
      built.push(b.mesh);
      const trees = buildTrees(world);
      if (trees) built.push(trees);

      // --- glowing windows (one additive Points batch) ---
      if (b.glows.length) {
        const pts = new Float32Array(b.glows.length * 3);
        b.glows.forEach((g, i) => { pts[i * 3] = g[0]; pts[i * 3 + 1] = g[1]; pts[i * 3 + 2] = g[2]; });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const glow = new THREE.Points(geo, new THREE.PointsMaterial({
          color: F.window, size: 6, sizeAttenuation: true,
          map: puffTexture('rgba(255,225,150,0.95)', 'rgba(255,225,150,0)'),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        built.push(glow);
      }

      // --- chimney smoke: soft rising sprites over a few homes ---
      const smokeTex = puffTexture('rgba(240,236,232,0.55)', 'rgba(240,236,232,0)');
      for (let i = 0; i < Math.min(14, b.glows.length); i += 1) {
        const g = b.glows[(i * 13) % b.glows.length];
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false,
        }));
        s.position.set(g[0], g[1] + 4, g[2]);
        s.scale.setScalar(7);
        smoke.push({ s, seed: i * 1.618, base: new THREE.Vector3(g[0], g[1] + 3, g[2]) });
        built.push(s);
      }

      // --- clouds: big soft puffs drifting over the fjord ---
      const cloudTex = puffTexture('rgba(255,250,240,0.85)', 'rgba(255,250,240,0)');
      for (let i = 0; i < 11; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false, fog: false,
        }));
        const n1 = valueNoise2(i * 3.1, i * 1.3);
        const n2 = valueNoise2(i * 1.9 + 8, i * 2.7);
        s.position.set(
          bounds.cx + (n1 - 0.5) * bounds.span * 0.9,
          620 + n2 * 260,
          bounds.cz + (n2 - 0.5) * bounds.span * 0.9,
        );
        s.scale.set(420 + n1 * 320, 130 + n2 * 90, 1);
        clouds.push(s);
        built.push(s);
      }

      // --- birds: three small circling flocks ---
      for (let f = 0; f < 3; f++) {
        const flock = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const bird = new THREE.Mesh(
            new THREE.ConeGeometry(0.7, 2.4, 3),
            new THREE.MeshBasicMaterial({ color: 0x3a3f45 }),
          );
          bird.rotation.x = Math.PI / 2;
          bird.position.set((i - 2) * 5, (i % 2) * 2, Math.abs(i - 2) * 4);
          flock.add(bird);
        }
        flock.userData.f = f;
        birds.push(flock);
        built.push(flock);
      }

      // --- little sailboats far from shore (row lattice keeps them honest) ---
      const rg = world.rowGraph;
      const step = Math.max(1, Math.floor(rg.nodes.length / 6));
      for (let i = 0; i < rg.nodes.length && boats.length < 5; i += step) {
        const [wx, wy] = rg.nodes[i];
        const [sx, sz] = world.toScene(wx, wy);
        if (world.shoreSDF(sx, sz) < 120) continue;
        const g = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0xf0e8d9 }));
        hull.position.y = 0.4;
        const sail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.5, 4), new THREE.MeshStandardMaterial({ color: 0xfdf6ea }));
        sail.position.y = 3.6;
        g.add(hull, sail);
        boats.push({ g, cx: sx, cz: sz, r: 40 + boats.length * 12, ph: boats.length * 1.9 });
        built.push(g);
      }

      // --- fireflies over the settlement meadows (dusk magic, restrained) ---
      const walkSpawn = world.spawn('walk');
      const fCount = 90;
      fireflyBase = new Float32Array(fCount * 3);
      for (let i = 0; i < fCount; i++) {
        const a = valueNoise2(i * 2.3, i) * Math.PI * 2;
        const r = 30 + valueNoise2(i, i * 1.7) * 220;
        const x = walkSpawn.x + Math.cos(a) * r;
        const z = walkSpawn.z + Math.sin(a) * r;
        fireflyBase[i * 3] = x;
        fireflyBase[i * 3 + 1] = Math.max(world.groundY(x, z), world.seaLevel) + 1.5 + valueNoise2(i * 3, i) * 3;
        fireflyBase[i * 3 + 2] = z;
      }
      const fGeo = new THREE.BufferGeometry();
      fGeo.setAttribute('position', new THREE.BufferAttribute(fireflyBase.slice(), 3));
      fireflies = new THREE.Points(fGeo, new THREE.PointsMaterial({
        color: F.firefly, size: 1.6, sizeAttenuation: true,
        map: puffTexture('rgba(174,240,224,0.9)', 'rgba(174,240,224,0)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      built.push(fireflies);

      // --- the magical focal point: a faint aurora ribbon over the fjord ---
      {
        const seg = 60;
        const pos = new Float32Array((seg + 1) * 2 * 3);
        for (let i = 0; i <= seg; i++) {
          const tI = i / seg;
          const x = bounds.cx + (tI - 0.5) * bounds.span * 1.1;
          const z = bounds.cz - bounds.span * 0.34 + Math.sin(tI * 4) * 220;
          const y = 780 + Math.sin(tI * 6.3) * 60;
          pos[(i * 2) * 3] = x; pos[(i * 2) * 3 + 1] = y; pos[(i * 2) * 3 + 2] = z;
          pos[(i * 2 + 1) * 3] = x; pos[(i * 2 + 1) * 3 + 1] = y + 210; pos[(i * 2 + 1) * 3 + 2] = z - 40;
        }
        const idx: number[] = [];
        for (let i = 0; i < seg; i++) {
          const k = i * 2;
          idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
        geo.setIndex(idx);
        const mat = new THREE.MeshBasicMaterial({
          color: F.aurora, transparent: true, opacity: 0.09, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        });
        aurora = { mesh: new THREE.Mesh(geo, mat), mat, base: pos };
        built.push(aurora.mesh);
      }

      // --- windmill on the meadow above the settlement (data-derived: the
      // highest ground within 350 m of the walk spawn) ---
      {
        let best: { x: number; z: number; y: number } | null = null;
        for (let a = 0; a < 24; a++) {
          for (const r of [120, 220, 320]) {
            const x = walkSpawn.x + Math.cos((a / 24) * Math.PI * 2) * r;
            const z = walkSpawn.z + Math.sin((a / 24) * Math.PI * 2) * r;
            const y = world.groundY(x, z);
            if (y > world.seaLevel + 2 && (!best || y > best.y)) best = { x, z, y };
          }
        }
        if (best) {
          const mill = new THREE.Group();
          const towerM = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.9 });
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 14, 8), towerM);
          tower.position.y = 7;
          const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0xb5645a }));
          cap.position.y = 15.6;
          mill.add(tower, cap);
          windmillBlades = new THREE.Group();
          for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(
              new THREE.BoxGeometry(0.5, 9.5, 0.14),
              new THREE.MeshStandardMaterial({ color: 0xfdf6ea }),
            );
            blade.geometry.translate(0, 4.75, 0);
            blade.rotation.z = (i * Math.PI) / 2;
            windmillBlades.add(blade);
          }
          windmillBlades.position.set(0, 14.2, -3.6);
          mill.add(windmillBlades);
          mill.position.set(best.x, best.y, best.z);
          built.push(mill);
        }
      }

      // --- lighthouse at the fjord-mouth headland (data-derived: coastline
      // vertex nearest the region's north edge, on land) ---
      {
        let best: { x: number; z: number; d: number } | null = null;
        for (const line of world.world.layers.coastline) {
          for (const [wx, wy] of line.pts) {
            const [sx, sz] = world.toScene(wx, wy);
            const d = Math.abs(sz - world.bounds.minZ);
            if (!best || d < best.d) best = { x: sx, z: sz, d };
          }
        }
        if (best) {
          const y = Math.max(world.groundY(best.x, best.z), world.seaLevel + 0.5);
          const lh = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1.6, 2.3, 11, 10),
            new THREE.MeshStandardMaterial({ color: 0xf7ecd7 }),
          );
          body.position.y = 5.5;
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8, 1.9, 2.2, 10),
            new THREE.MeshStandardMaterial({ color: 0xb5645a }),
          );
          band.position.y = 4.4;
          const lamp = new THREE.Mesh(
            new THREE.SphereGeometry(1.1, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
          );
          lamp.position.y = 11.6;
          lh.add(body, band, lamp);
          lh.position.set(best.x, y, best.z);
          built.push(lh);
        }
      }

      for (const o of built) scene.add(o);
    },

    update(dtS: number, timeS: number, camera: THREE.PerspectiveCamera): void {
      water?.update(timeS);
      // clouds drift east, wrap at the region edge
      for (const c of clouds) {
        c.position.x += dtS * 9;
        if (c.position.x > bounds.cx + bounds.span * 0.7) c.position.x = bounds.cx - bounds.span * 0.7;
      }
      // birds circle
      birds.forEach((flock, i) => {
        const a = timeS * 0.11 + i * 2.1;
        const r = 260 + i * 140;
        flock.position.set(
          bounds.cx + Math.cos(a) * r,
          150 + i * 60 + Math.sin(timeS * 0.5 + i) * 12,
          bounds.cz + Math.sin(a) * r * 0.8,
        );
        flock.rotation.y = -a - Math.PI / 2;
      });
      // smoke rises and re-seeds
      for (const sm of smoke) {
        const t = (timeS * 0.14 + sm.seed) % 1;
        sm.s.position.set(
          sm.base.x + Math.sin(timeS * 0.6 + sm.seed * 7) * 1.6 + t * 4,
          sm.base.y + t * 22,
          sm.base.z,
        );
        sm.s.material.opacity = 0.42 * (1 - t);
        sm.s.scale.setScalar(5 + t * 13);
      }
      // fireflies wander + twinkle
      if (fireflies && fireflyBase) {
        const p = fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          p.setXYZ(
            i,
            fireflyBase[i * 3] + Math.sin(timeS * 0.7 + i * 1.3) * 2.2,
            fireflyBase[i * 3 + 1] + Math.sin(timeS * 1.1 + i * 2.1) * 1.1,
            fireflyBase[i * 3 + 2] + Math.cos(timeS * 0.5 + i * 0.7) * 2.2,
          );
        }
        p.needsUpdate = true;
        (fireflies.material as THREE.PointsMaterial).opacity = 0.6 + 0.4 * Math.sin(timeS * 1.7);
        (fireflies.material as THREE.PointsMaterial).transparent = true;
      }
      // aurora breathes
      if (aurora) {
        aurora.mat.opacity = 0.07 + 0.03 * Math.sin(timeS * 0.35);
        const p = aurora.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          p.setY(i, aurora.base[i * 3 + 1] + Math.sin(timeS * 0.6 + i * 0.35) * 14);
        }
        p.needsUpdate = true;
      }
      windmillBlades?.rotateZ(dtS * 0.8);
      // sailboats drift small circles and bob
      for (const b of boats) {
        const a = timeS * 0.05 + b.ph;
        b.g.position.set(
          b.cx + Math.cos(a) * b.r,
          Math.sin(timeS * 0.9 + b.ph) * 0.25,
          b.cz + Math.sin(a) * b.r,
        );
        b.g.rotation.y = -a;
        b.g.rotation.z = Math.sin(timeS * 0.8 + b.ph) * 0.04;
      }
      void camera;
    },

    dispose(): void {
      if (renderer) renderer.toneMapping = prevTone;
      if (!scene) return;
      for (const o of built) scene.remove(o);
      built = [];
      clouds = [];
      birds = [];
      smoke = [];
      boats = [];
      fireflies = null;
      aurora = null;
      windmillBlades = null;
    },
  };
}
