// Ported verbatim from WaterThreeJS src/FloatingBodies.js (see
// WATERTHREEJS_LICENSE.txt).
import * as THREE from 'three';
import type { Ocean, OceanSurfaceSample } from './Ocean';

const Y_UP = new THREE.Vector3(0, 1, 0);

export interface FloatingBody {
  mesh: THREE.Mesh;
  r: number;
  density: number;
  vx: number;
  vy: number;
  vz: number;
  prevWH?: number;
  splash?: number;
  wet?: number;
  dragging?: boolean;
}

export type TerrainHeightFn = (x: number, z: number) => number;

// Manages dropped primitives (spheres / cubes) and their buoyancy physics:
// each body bobs on the wave surface, tilts to the local wave normal, drifts a
// little with the slope, and rests on the terrain (seabed / island) where the
// water is too shallow to float it.
export class FloatingBodies {
  scene: THREE.Scene;
  max: number;
  gravity: number;
  bodies: FloatingBody[];
  private _n: THREE.Vector3;
  private _q: THREE.Quaternion;
  private _surf: OceanSurfaceSample;
  private _sphereGeo: THREE.SphereGeometry;
  private _boxGeo: THREE.BoxGeometry;
  private _palette: number[];

  constructor(scene: THREE.Scene, { max = 48 }: { max?: number } = {}) {
    this.scene = scene;
    this.max = max;
    this.gravity = 20; // tweakable; buoyancy scales with it so float depth is stable
    this.bodies = [];
    this._n = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._surf = { dx: 0, dz: 0, h: 0, nx: 0, ny: 1, nz: 0 };
    this._sphereGeo = new THREE.SphereGeometry(1, 32, 24);
    this._boxGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7); // half-extent 0.85
    this._palette = [0xff5b4a, 0xffd23f, 0x2ea6ff, 0x4ad991, 0xb06bff, 0xff8f3f, 0xf2f2f2];
  }

  spawn(type: string, x: number, z: number, waterY = 0) {
    if (this.bodies.length >= this.max) {
      const old = this.bodies.shift()!;
      this.scene.remove(old.mesh);
      (old.mesh.material as THREE.Material).dispose();
    }
    const isSphere = type !== 'cube';
    const s = isSphere ? 1.1 + Math.random() * 1.0 : 1.0 + Math.random() * 0.8;
    const mat = new THREE.MeshStandardMaterial({
      color: this._palette[(Math.random() * this._palette.length) | 0],
      roughness: 0.4 + Math.random() * 0.3,
      metalness: 0.04,
    });
    const mesh = new THREE.Mesh(isSphere ? this._sphereGeo : this._boxGeo, mat);
    mesh.scale.setScalar(s);
    mesh.position.set(x, waterY + 9 + Math.random() * 4, z); // drop in from above
    mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.bodies.push({
      mesh,
      r: isSphere ? s : 0.85 * s,   // collision half-height
      density: 0.5 + Math.random() * 0.12, // <1 → buoyant, fraction submerged at rest
      vx: 0, vy: 0, vz: 0,
    });
  }

  clear() {
    for (const b of this.bodies) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bodies.length = 0;
  }

  // ocean.heightAt(x,z,t) → wave surface height; terrainAt(x,z) → seabed/land height.
  // Sub-stepped at a fixed ~120 Hz so the (stiff) buoyancy spring stays stable
  // regardless of the render framerate.
  update(dt: number, time: number, ocean: Ocean, terrainAt: TerrainHeightFn) {
    if (dt <= 0 || this.bodies.length === 0) return;
    dt = Math.min(dt, 0.05);
    const sub = Math.min(8, Math.max(1, Math.ceil(dt / 0.008)));
    const h = dt / sub;
    const t0 = time - dt;
    for (let s = 0; s < sub; s++) {
      const tt = t0 + (s + 1) * h;
      for (const b of this.bodies) this._step(b, h, tt, ocean, terrainAt);
    }
  }

  private _step(b: FloatingBody, dt: number, time: number, ocean: Ocean, terrainAt: TerrainHeightFn) {
    const GRAV = this.gravity;
    const p = b.mesh.position;
    // Accurate visible-surface height + normal above the body (Gerstner-inverted,
    // so the body sits on the crest you actually see, not a vertical-only guess).
    const surf = ocean.surfaceSample(p.x, p.z, time, this._surf);
    const wH = surf.h;
    const tH = terrainAt(p.x, p.z);

    // Vertical velocity of the water column the body sits on (material
    // derivative — includes the body's own horizontal motion).
    if (b.prevWH === undefined) b.prevWH = wH;
    const wVel = (wH - b.prevWH) / dt;
    b.prevWH = wH;

    // Local wave normal straight from the Gerstner sample.
    this._n.set(surf.nx, surf.ny, surf.nz);

    // Buoyancy: force ∝ submerged depth; balances gravity at eqDisp = 2·r·density.
    // Damped against the WATER'S velocity so the body rides a rising wave instead
    // of being flung off it.
    const displaced = Math.min(Math.max(wH - (p.y - b.r), 0), 2 * b.r);
    const eqDisp = Math.max(2 * b.r * b.density, 0.3);
    const buoyK = GRAV / eqDisp;
    const wet = displaced / (2 * b.r);                 // 0 in air → 1 submerged

    // Splash burst: entering the water fast kicks up a decaying foam ring
    // (read by the ocean shader's contact foam).
    if (b.splash === undefined) b.splash = 0;
    if (wet > 0.05 && (b.wet ?? 0) < 0.02 && b.vy < -3) {
      b.splash = Math.min(2, b.splash - b.vy * 0.11);
    }
    b.splash *= Math.exp(-1.7 * dt);
    b.wet = wet;
    // Near-critical damping (relative to the buoyancy stiffness) so bodies of
    // any size settle onto the surface calmly instead of bobbing forever.
    const damp = 2 * Math.sqrt(buoyK) * (0.9 * wet) + 0.5;
    const relVy = b.vy - (wet > 0.02 ? wVel : 0.0);
    const ay = -GRAV + buoyK * displaced - damp * relVy;
    b.vy += ay * dt;
    b.vy = Math.max(-45, Math.min(45, b.vy));
    p.y += b.vy * dt;

    // Horizontal: gentle drift down the wave slope (skipped while being dragged).
    if (!b.dragging) {
      if (displaced > 0) {
        b.vx += (this._n.x * 4.0 - 1.8 * b.vx) * dt;
        b.vz += (this._n.z * 4.0 - 1.8 * b.vz) * dt;
        p.x += b.vx * dt;
        p.z += b.vz * dt;
      }
    } else {
      b.vx = b.vz = 0;
    }

    // Terrain collision — rest on the seabed / island, never sink through it.
    let grounded = false;
    if (p.y - b.r < tH) {
      p.y = tH + b.r;
      if (b.vy < 0) b.vy = 0;
      b.vx *= 0.7; b.vz *= 0.7;   // friction
      grounded = true;
    }

    // Orientation: tilt with the waves while floating; upright once beached.
    const beached = grounded && tH > wH - 0.25;
    this._q.setFromUnitVectors(Y_UP, (displaced > 0 && !beached) ? this._n : Y_UP);
    b.mesh.quaternion.slerp(this._q, 1 - Math.exp(-dt * 5));
  }
}
