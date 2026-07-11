// The sea: low-poly PS2 language throughout — vertex-lit flat-shaded
// meshes, restricted palette, exponential fog, no textures anywhere.
// The seabed is a heightfield displaced by the SAME depthAt() the sim
// uses (SDF-from-real-boundary + value noise), so what you see is what
// you collide with. The boundary is a shimmer curtain, not geometry —
// the water pushes back before you ever reach it.

import * as THREE from 'three';
import type { SwimSim } from './sim';
import { SIM } from './sim';

export const PALETTE = {
  fogDeep: 0x06283d,
  fogShallow: 0x0d4a63,
  water: 0x1180a8,
  sandLow: 0x27505e,
  sandHigh: 0x4e8577,
  shimmer: 0x9fe8ff,
  glow: 0x59d7ff,
} as const;

export interface World {
  scene: THREE.Scene;
  /** per-frame ambience (water surface wave, shimmer pulse, fog by depth) */
  update(timeS: number, camY: number): void;
  surface: THREE.Mesh;
}

export function createWorld(sim: SwimSim): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.fogDeep);
  scene.fog = new THREE.FogExp2(PALETTE.fogDeep, 0.016);

  const hemi = new THREE.HemisphereLight(0x9fd8e8, 0x0a2733, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xbfeaff, 1.2);
  sun.position.set(40, 120, 20);
  scene.add(sun);

  // --- seabed heightfield over the whole (scaled) bay ---
  const [minx, miny, maxx, maxy] = sim.boundary.bbox;
  const [gx0, gz0] = sim.toGame(minx, maxy); // note z flip: maxy → min z
  const [gx1, gz1] = sim.toGame(maxx, miny);
  const w = gx1 - gx0;
  const h = gz1 - gz0;
  const RES = 220;
  const geo = new THREE.PlaneGeometry(w, h, RES, RES);
  geo.rotateX(-Math.PI / 2);
  geo.translate(gx0 + w / 2, 0, gz0 + h / 2);
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cLow = new THREE.Color(PALETTE.sandLow);
  const cHigh = new THREE.Color(PALETTE.sandHigh);
  const c = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const depth = sim.inWater(x, z) ? sim.depthAt(x, z) : Math.min(2.0, sim.depthAt(x, z));
    // land rises above the surface just enough to read as shore
    const y = sim.inWater(x, z) ? -depth : 1.5;
    posAttr.setY(i, y);
    const t = Math.max(0, Math.min(1, 1 - depth / SIM.DEPTH_MAX));
    c.lerpColors(cLow, cHigh, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const seabed = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  scene.add(seabed);

  // --- water surface, seen from below: a softly waving translucent sheet ---
  const surfGeo = new THREE.PlaneGeometry(w * 1.05, h * 1.05, 96, 96);
  surfGeo.rotateX(Math.PI / 2); // face DOWN toward the swimmer
  surfGeo.translate(gx0 + w / 2, 0, gz0 + h / 2);
  const surfMat = new THREE.MeshBasicMaterial({
    color: PALETTE.water,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    fog: true,
  });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  scene.add(surface);
  const surfPos = surfGeo.getAttribute('position') as THREE.BufferAttribute;
  const surfBase = new Float32Array(surfPos.array);

  // --- boundary shimmer curtain: the real bay outline, as light ---
  const curtain = buildShimmer(sim);
  scene.add(curtain.mesh);

  function update(timeS: number, camY: number): void {
    // surface wave: two crossing sines, chunky enough to read as facets
    for (let i = 0; i < surfPos.count; i++) {
      const x = surfBase[i * 3];
      const z = surfBase[i * 3 + 2];
      surfPos.setY(i, Math.sin(x * 0.11 + timeS * 1.3) * 0.35 + Math.cos(z * 0.13 + timeS * 0.9) * 0.3);
    }
    surfPos.needsUpdate = true;
    curtain.update(timeS);
    // fog eases with depth: bright teal near the surface, deep blue below
    const t = Math.max(0, Math.min(1, -camY / 25));
    (scene.fog as THREE.FogExp2).color.lerpColors(
      new THREE.Color(PALETTE.fogShallow), new THREE.Color(PALETTE.fogDeep), t,
    );
    (scene.background as THREE.Color).copy((scene.fog as THREE.FogExp2).color);
  }

  return { scene, update, surface };
}

/** Vertical translucent quad strip along every boundary ring — additive,
 *  pulsing: "edge of the dream", not a wall. */
function buildShimmer(sim: SwimSim): { mesh: THREE.Mesh; update(t: number): void } {
  const pos: number[] = [];
  const idx: number[] = [];
  const HEIGHT = 40;
  const rings = sim.boundary.polygons.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]);
  for (const ring of rings) {
    const startV = pos.length / 3;
    for (const [bx, by] of ring) {
      const [x, z] = sim.toGame(bx, by);
      pos.push(x, -HEIGHT, z, x, 4, z);
    }
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = startV + i * 2;
      const b = startV + ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    color: PALETTE.shimmer,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return {
    mesh,
    update(t: number) {
      mat.opacity = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(t * 1.7));
    },
  };
}
