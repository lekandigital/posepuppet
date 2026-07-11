// The living sea (P3 art pass). Everything procedural and deterministic:
// placement is seeded by the same value noise as the seabed, boid wander
// uses hashed per-fish phases — no RNG state, same world every run.
// PS2 language throughout: instanced low-poly meshes, vertex/flat
// shading, additive glow, no textures.
//
// Population is placed in a disc around the spawn reach (Central Bay) —
// the whole scaled bay is ~4 km and fog hides everything past ~120 m, so
// dressing the entire polygon would burn memory nobody ever sees. The
// decor field re-centers are a future polish note (FUTURES.md).

import * as THREE from 'three';
import { valueNoise2, type SwimSim } from './sim';

export interface Decor {
  update(timeS: number, focusX: number, focusZ: number): void;
}

export function decorate(scene: THREE.Scene, sim: SwimSim): Decor {
  const spawn = { x: sim.state.x, z: sim.state.z };
  scatterRocks(scene, sim, spawn);
  const ruins = placeRuins(scene, sim, spawn);
  const kelp = plantKelp(scene, sim, spawn);
  const fish = spawnFish(scene, sim, spawn);
  const shafts = lightShafts(scene, spawn);
  const motes = glowMotes(scene, spawn);
  return {
    update(timeS, fx, fz) {
      kelp.update(timeS);
      fish.update(timeS, fx, fz);
      shafts.update(timeS);
      motes.update(timeS, fx, fz);
      void ruins;
    },
  };
}

/** Deterministic candidate positions in a disc: golden-angle spiral. */
function* spiral(cx: number, cz: number, rMax: number, n: number): Generator<[number, number, number]> {
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 1; i <= n; i++) {
    const r = rMax * Math.sqrt(i / n);
    const a = i * GA;
    yield [cx + Math.cos(a) * r, cz + Math.sin(a) * r, i / n];
  }
}

function scatterRocks(scene: THREE.Scene, sim: SwimSim, c: { x: number; z: number }): void {
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x3c5a63, flatShading: true });
  const COUNT = 380;
  const mesh = new THREE.InstancedMesh(rock, mat, COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  let placed = 0;
  for (const [x, z] of spiral(c.x, c.z, 900, COUNT * 4)) {
    if (placed >= COUNT) break;
    if (!sim.inWater(x, z)) continue;
    if (valueNoise2(x * 0.03, z * 0.03) < 0.52) continue;
    const depth = sim.depthAt(x, z);
    const s = 0.8 + valueNoise2(x * 0.7, z * 0.7) * 3.4;
    eul.set(valueNoise2(x, z) * 3, valueNoise2(z, x) * 3, 0);
    q.setFromEuler(eul);
    m.compose(new THREE.Vector3(x, -depth + s * 0.4, z), q, new THREE.Vector3(s, s * 0.8, s));
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  scene.add(mesh);
}

/** Drowned columns and one arch — mysterious, unnamed, original. */
function placeRuins(scene: THREE.Scene, sim: SwimSim, c: { x: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  const colGeo = new THREE.CylinderGeometry(0.7, 0.85, 6, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0x5d7a80, flatShading: true });
  let sites = 0;
  for (const [x, z] of spiral(c.x + 130, c.z + 60, 700, 260)) {
    if (sites >= 4) break;
    if (!sim.inWater(x, z) || sim.depthAt(x, z) < 9) continue;
    if (valueNoise2(x * 0.05, z * 0.05) < 0.62) continue;
    const y = -sim.depthAt(x, z);
    // a broken colonnade: 5 columns, some toppled
    for (let i = 0; i < 5; i++) {
      const col = new THREE.Mesh(colGeo, mat);
      const t = valueNoise2(x + i * 3.7, z - i * 2.1);
      col.position.set(x + i * 3.2, y + (t > 0.6 ? 0.7 : 3), z + (i % 2) * 1.4);
      if (t > 0.6) col.rotation.z = Math.PI / 2 - t * 0.4; // toppled
      col.rotation.y = t * 3;
      g.add(col);
    }
    sites++;
  }
  // the arch — one landmark, breach-bait
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(7, 1.1, 5, 9, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x6b8a8f, flatShading: true }),
  );
  for (const [x, z] of spiral(c.x - 200, c.z - 120, 600, 200)) {
    if (sim.inWater(x, z) && sim.depthAt(x, z) > 14) {
      torus.position.set(x, -sim.depthAt(x, z) + 1, z);
      break;
    }
  }
  g.add(torus);
  scene.add(g);
  return g;
}

/** Kelp: instanced tapered blades, swayed in the vertex shader. */
function plantKelp(scene: THREE.Scene, sim: SwimSim, c: { x: number; z: number }): { update(t: number): void } {
  const COUNT = 700;
  const blade = new THREE.ConeGeometry(0.28, 9, 3, 4, true);
  blade.translate(0, 4.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2e7d5b, flatShading: true, side: THREE.DoubleSide });
  let tUniform = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = tUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float sway = sin(uTime * 0.9 + float(gl_InstanceID) * 1.7) * 0.14;
       transformed.x += sway * transformed.y * transformed.y * 0.06;
       transformed.z += cos(uTime * 0.7 + float(gl_InstanceID) * 2.3) * 0.09 * transformed.y * transformed.y * 0.06;`,
    );
  };
  const mesh = new THREE.InstancedMesh(blade, mat, COUNT);
  const m = new THREE.Matrix4();
  let placed = 0;
  for (const [x, z] of spiral(c.x, c.z, 850, COUNT * 3)) {
    if (placed >= COUNT) break;
    if (!sim.inWater(x, z)) continue;
    const depth = sim.depthAt(x, z);
    if (depth < 6 || depth > 22) continue; // kelp lives on the mid shelf
    if (valueNoise2(x * 0.02 + 9, z * 0.02 - 7) < 0.58) continue; // forests, not lawn
    const s = 0.7 + valueNoise2(x * 1.3, z * 1.3) * 1.3;
    m.makeScale(s, s * (0.8 + valueNoise2(z, x) * 0.7), s);
    m.setPosition(x, -depth, z);
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  scene.add(mesh);
  return { update(t) { tUniform.value = t; } };
}

/** Fish: instanced boids — cohesion along a drifting noise field, flee
 *  from the dolphin. Two species by color band. */
function spawnFish(scene: THREE.Scene, sim: SwimSim, c: { x: number; z: number }): { update(t: number, fx: number, fz: number): void } {
  const N = 240;
  const geo = new THREE.ConeGeometry(0.16, 0.7, 4);
  geo.rotateX(Math.PI / 2); // nose forward (+z)
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const color = new THREE.Color();
  for (let i = 0; i < N; i++) {
    mesh.setColorAt(i, color.setHex(i % 3 === 0 ? 0xd9a441 : 0x9fc7d9));
  }
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  let seeded = 0;
  for (const [x, z] of spiral(c.x, c.z, 500, N * 3)) {
    if (seeded >= N) break;
    if (!sim.inWater(x, z) || sim.depthAt(x, z) < 5) continue;
    pos[seeded * 3] = x;
    pos[seeded * 3 + 1] = -3 - valueNoise2(x, z) * (sim.depthAt(x, z) - 5);
    pos[seeded * 3 + 2] = z;
    seeded++;
  }
  mesh.count = seeded;
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let lastT = 0;
  return {
    update(t, fx, fz) {
      const dt = Math.min(0.05, t - lastT || 0.016);
      lastT = t;
      for (let i = 0; i < seeded; i++) {
        const ix = i * 3;
        // wander: steer along a slowly drifting noise flow field
        const a = valueNoise2(pos[ix] * 0.02 + t * 0.03, pos[ix + 2] * 0.02) * Math.PI * 4;
        let ax = Math.cos(a) * 1.6;
        let az = Math.sin(a) * 1.6;
        let ay = (Math.sin(t * 0.5 + i) * 0.2 - (pos[ix + 1] + 6) * 0.02);
        // flee the dolphin
        const dx = pos[ix] - fx;
        const dz = pos[ix + 2] - fz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 20 * 20) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / 20) * 30;
          ax += (dx / d) * f;
          az += (dz / d) * f;
        }
        vel[ix] += ax * dt;
        vel[ix + 1] += ay * dt;
        vel[ix + 2] += az * dt;
        const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) || 1e-6;
        const cap = d2 < 400 ? 7 : 2.2;
        if (sp > cap) {
          vel[ix] *= cap / sp;
          vel[ix + 1] *= cap / sp;
          vel[ix + 2] *= cap / sp;
        }
        let nx = pos[ix] + vel[ix] * dt;
        let nz = pos[ix + 2] + vel[ix + 2] * dt;
        if (!sim.inWater(nx, nz)) {
          vel[ix] *= -1;
          vel[ix + 2] *= -1;
          nx = pos[ix];
          nz = pos[ix + 2];
        }
        pos[ix] = nx;
        pos[ix + 1] = Math.min(-1.2, pos[ix + 1] + vel[ix + 1] * dt);
        pos[ix + 2] = nz;
        look.set(vel[ix], vel[ix + 1], vel[ix + 2]).normalize();
        m.lookAt(new THREE.Vector3(0, 0, 0), look.negate(), up);
        m.setPosition(pos[ix], pos[ix + 1], pos[ix + 2]);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Caustic light shafts: additive cones from the surface, slow drift —
 *  the animated-gobo fake, no lights involved. */
function lightShafts(scene: THREE.Scene, c: { x: number; z: number }): { update(t: number): void } {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(6, 30, 5, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x7fdcff, transparent: true, opacity: 0.05,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(geo, mat);
    const a = (i / 9) * Math.PI * 2;
    s.position.set(c.x + Math.cos(a) * (60 + i * 22), -14, c.z + Math.sin(a) * (60 + i * 19));
    s.rotation.z = 0.16;
    g.add(s);
    shafts.push(s);
  }
  scene.add(g);
  return {
    update(t) {
      shafts.forEach((s, i) => {
        s.rotation.y = t * 0.05 + i;
        s.position.y = -14 + Math.sin(t * 0.3 + i * 1.3) * 1.5;
      });
    },
  };
}

/** Glowing motes drifting with the swimmer — near-field depth cue. */
function glowMotes(scene: THREE.Scene, c: { x: number; z: number }): { update(t: number, fx: number, fz: number): void } {
  const N = 500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = c.x + (hash01(i) - 0.5) * 120;
    pos[i * 3 + 1] = -2 - hash01(i * 7 + 1) * 26;
    pos[i * 3 + 2] = c.z + (hash01(i * 13 + 2) - 0.5) * 120;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x59d7ff, size: 0.12, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const attr = geo.getAttribute('position') as THREE.BufferAttribute;
  return {
    update(t, fx, fz) {
      // wrap motes into a 120 m box around the dolphin — an infinite field
      for (let i = 0; i < N; i++) {
        let x = attr.getX(i);
        let z = attr.getZ(i);
        x += Math.sin(t * 0.2 + i) * 0.004;
        while (x < fx - 60) x += 120;
        while (x > fx + 60) x -= 120;
        while (z < fz - 60) z += 120;
        while (z > fz + 60) z -= 120;
        attr.setX(i, x);
        attr.setZ(i, z);
      }
      attr.needsUpdate = true;
    },
  };
}

function hash01(i: number): number {
  let h = (i * 374761393) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
