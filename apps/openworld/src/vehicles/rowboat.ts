// Procedural low-poly rowboat — original asset. Oars animate from stroke
// events (sweep on pull, feather on recovery) purely as visuals; the sim
// owns motion.

import * as THREE from 'three';

export interface BoatRig {
  root: THREE.Group;
  /** call on each detected stroke (strength 0..1) */
  pulse(strength: number): void;
  animate(dtS: number, speed01: number, timeS: number): void;
}

function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function createRowboat(): BoatRig {
  const root = new THREE.Group();
  root.name = 'rowboat';

  // hull: 4.2 m tapered box with raised bow
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 4.2), mat(0x8a5a33));
  const hp = hull.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const z = hp.getZ(i);
    const t = Math.abs(z) / 2.1;
    hp.setX(i, hp.getX(i) * (1 - t * 0.55));
    if (z < -1.6) hp.setY(i, hp.getY(i) + 0.18); // bow lift
  }
  hp.needsUpdate = true;
  hull.geometry.computeVertexNormals();
  hull.position.y = 0.18;
  root.add(hull);

  // interior + thwart (seat)
  const thwart = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.42), mat(0xb98d5a));
  thwart.position.set(0, 0.42, 0.15);
  root.add(thwart);

  // oars on outriggers
  const mkOar = (side: 1 | -1): THREE.Group => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.07), mat(0xd9c9a8));
    shaft.geometry.translate(side * 1.3, 0, 0);
    g.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.24), mat(0xc23b3b));
    blade.position.set(side * 2.55, 0, 0);
    g.add(blade);
    g.position.set(side * 0.72, 0.5, 0.1);
    root.add(g);
    return g;
  };
  const oarL = mkOar(-1);
  const oarR = mkOar(1);

  let strokeAnim = 0; // 1 → 0 after each pulse
  let lastStrength = 0;

  return {
    root,
    pulse(strength: number): void {
      strokeAnim = 1;
      lastStrength = strength;
    },
    animate(dtS: number, speed01: number, timeS: number): void {
      strokeAnim = Math.max(0, strokeAnim - dtS * 1.6);
      // oar sweep: recovery forward, drive back; idle = gentle trail
      const sweep = strokeAnim > 0
        ? Math.sin(strokeAnim * Math.PI) * (0.5 + 0.4 * lastStrength)
        : 0.08 * Math.sin(timeS * 1.1);
      oarL.rotation.y = 0.35 + sweep;
      oarR.rotation.y = -0.35 - sweep;
      oarL.rotation.z = strokeAnim > 0 ? -0.12 : 0.14; // blade dips on drive
      oarR.rotation.z = strokeAnim > 0 ? 0.12 : -0.14;
      // hull: speed trim + gentle bob
      root.rotation.x = -0.03 * speed01 + 0.012 * Math.sin(timeS * 1.4);
      root.rotation.z = 0.01 * Math.sin(timeS * 1.1);
    },
  };
}
