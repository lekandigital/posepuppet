// Procedural placeholder plane — original geometry, no license burden.
// Honors the ASSET_CONTRACT node names (prop, aileron_L/R, elevator,
// rudder) and articulation axes, so a conforming user .glb is a drop-in:
// the flight mode animates ONLY these named nodes plus the root.

import * as THREE from 'three';

export interface PlaneRig {
  root: THREE.Group;
  /** Articulate per frame: prop spin + control-surface deflection. */
  animate(dtS: number, throttle01: number, aileron: number, elevator: number, rudder: number): void;
}

const BODY = 0xe8ecf2;
const ACCENT = 0x2f7fd0;
const DARK = 0x3a4150;

function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function createPlaceholderPlane(): PlaneRig {
  const root = new THREE.Group();
  root.name = 'plane_placeholder';

  // fuselage: tapered box, ~7.4 m long — GA scale per the contract
  const fus = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 7.4), mat(BODY));
  fus.geometry.translate(0, 0, 0.2);
  // taper the tail by scaling rear vertices
  const fp = fus.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < fp.count; i++) {
    const z = fp.getZ(i);
    if (z > 1.5) {
      const t = 1 - (z - 1.5) * 0.28;
      fp.setX(i, fp.getX(i) * Math.max(t, 0.22));
      fp.setY(i, fp.getY(i) * Math.max(t, 0.3) + (1 - Math.max(t, 0.3)) * 0.25);
    }
  }
  fp.needsUpdate = true;
  fus.geometry.computeVertexNormals();
  root.add(fus);

  // canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.6), mat(DARK));
  canopy.position.set(0, 0.75, -0.7);
  root.add(canopy);

  // wing: one piece through the fuselage, 9.4 m span
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.16, 1.55), mat(ACCENT));
  wing.position.set(0, 0.1, -0.5);
  root.add(wing);

  // ailerons (outboard trailing edge), contract names + hinge axis X
  const mkAileron = (side: 1 | -1): THREE.Mesh => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.42), mat(BODY));
    a.name = side === 1 ? 'aileron_R' : 'aileron_L';
    a.geometry.translate(0, 0, 0.21); // hinge at leading edge of the surface
    a.position.set(side * 3.4, 0.1, 0.28);
    root.add(a);
    return a;
  };
  const ailR = mkAileron(1);
  const ailL = mkAileron(-1);

  // tailplane + elevator
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.9), mat(ACCENT));
  tail.position.set(0, 0.3, 3.3);
  root.add(tail);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.09, 0.4), mat(BODY));
  elevator.name = 'elevator';
  elevator.geometry.translate(0, 0, 0.2);
  elevator.position.set(0, 0.3, 3.72);
  root.add(elevator);

  // fin + rudder (hinge axis Y)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.0), mat(ACCENT));
  fin.position.set(0, 0.95, 3.35);
  root.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.2, 0.45), mat(BODY));
  rudder.name = 'rudder';
  rudder.geometry.translate(0, 0, 0.22);
  rudder.position.set(0, 1.0, 3.82);
  root.add(rudder);

  // prop: spinner + two blades, spun about local Z (contract)
  const prop = new THREE.Group();
  prop.name = 'prop';
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), mat(DARK));
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.06), mat(DARK));
    blade.rotation.z = a;
    prop.add(blade);
  }
  prop.position.set(0, 0, -3.75);
  root.add(prop);

  // fixed gear (hidden above 40 m AGL by the mode, per contract)
  const gear = new THREE.Group();
  gear.name = 'gear';
  for (const [gx, gz] of [[-1.1, -0.9], [1.1, -0.9], [0, 2.6]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), mat(DARK));
    leg.position.set(gx, -0.95, gz);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10), mat(0x14161a));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx, -1.35, gz);
    gear.add(wheel);
  }
  root.add(gear);

  let propAngle = 0;
  return {
    root,
    animate(dtS, throttle01, aileron, elevator01, rudder01) {
      propAngle += dtS * (8 + throttle01 * 55);
      prop.rotation.z = propAngle;
      const d = (20 * Math.PI) / 180; // contract: ±20°
      ailL.rotation.x = -aileron * d;
      ailR.rotation.x = aileron * d;
      elevator.rotation.x = elevator01 * d;
      rudder.rotation.y = rudder01 * d;
    },
  };
}
