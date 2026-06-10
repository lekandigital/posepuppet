// Procedural robot built from primitives in a real bone hierarchy. Every
// joint pivot is an Object3D we own, so retargeting bugs are visible and
// attributable. Rest pose: standing, arms hanging at the sides.

import * as THREE from 'three';
import type { Avatar, BoneName, JointName } from './types';

const BODY = new THREE.MeshStandardMaterial({ color: 0x9aa6bd, roughness: 0.45, metalness: 0.55 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b303c, roughness: 0.6, metalness: 0.4 });
const GLOW = new THREE.MeshStandardMaterial({
  color: 0x0d2731,
  emissive: 0x4cc2ff,
  emissiveIntensity: 1.6,
  roughness: 0.3,
});

function shadowed<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  return m;
}

/** Joint pivot + a cylinder extending down −y for `len`. */
function limbSegment(len: number, r: number): THREE.Object3D {
  const pivot = new THREE.Object3D();
  const geo = new THREE.CylinderGeometry(r, r * 0.85, len, 12);
  const mesh = shadowed(new THREE.Mesh(geo, BODY));
  mesh.position.y = -len / 2;
  pivot.add(mesh);
  const ball = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 12, 10), DARK));
  pivot.add(ball);
  return pivot;
}

export function createRobot(): Avatar {
  const root = new THREE.Group();
  root.name = 'robot';
  root.position.y = 0.9;

  const bones: Partial<Record<BoneName, THREE.Object3D>> = {};
  const joints: Partial<Record<JointName, THREE.Object3D>> = {};

  // hips
  const hips = new THREE.Object3D();
  root.add(hips);
  bones.hips = hips;
  joints.hipCenter = hips;
  const pelvis = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.15), DARK));
  pelvis.position.y = -0.02;
  hips.add(pelvis);

  // chest / torso
  const chest = new THREE.Object3D();
  chest.position.set(0, 0.1, 0);
  hips.add(chest);
  bones.chest = chest;
  const torso = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.17), BODY));
  torso.position.y = 0.17;
  chest.add(torso);
  const corePanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), GLOW);
  corePanel.position.set(0, 0.2, 0.09);
  chest.add(corePanel);
  const shoulderCenter = new THREE.Object3D();
  shoulderCenter.position.set(0, 0.32, 0);
  chest.add(shoulderCenter);
  joints.shoulderCenter = shoulderCenter;

  // neck + head
  const neck = new THREE.Object3D();
  neck.position.set(0, 0.36, 0);
  chest.add(neck);
  bones.neck = neck;
  const neckMesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.07, 10), DARK));
  neckMesh.position.y = 0.03;
  neck.add(neckMesh);

  const head = new THREE.Object3D();
  head.position.set(0, 0.07, 0);
  neck.add(head);
  bones.head = head;
  joints.head = head;
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), BODY));
  skull.position.y = 0.11;
  skull.scale.set(1, 0.95, 0.95);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), GLOW);
    eye.position.set(side * 0.05, 0.13, 0.105);
    head.add(eye);
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), DARK);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * 0.13, 0.11, 0);
    head.add(ear);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), DARK);
  antenna.position.set(0, 0.26, 0);
  head.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), GLOW);
  antennaTip.position.set(0, 0.31, 0);
  head.add(antennaTip);

  // arms: shoulder pivot → upper arm (down −y) → elbow pivot → forearm → wrist
  for (const [prefix, sx] of [
    ['left', 1],
    ['right', -1],
  ] as const) {
    const upper = limbSegment(0.26, 0.045);
    upper.position.set(sx * 0.22, 0.3, 0);
    chest.add(upper);
    bones[`${prefix}UpperArm`] = upper;
    joints[`${prefix}Shoulder`] = upper;

    const lower = limbSegment(0.24, 0.038);
    lower.position.set(0, -0.26, 0);
    upper.add(lower);
    bones[`${prefix}LowerArm`] = lower;
    joints[`${prefix}Elbow`] = lower;

    const wrist = new THREE.Object3D();
    wrist.position.set(0, -0.24, 0);
    lower.add(wrist);
    joints[`${prefix}Wrist`] = wrist;
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), DARK));
    hand.position.y = -0.02;
    hand.scale.set(0.9, 1.1, 0.7);
    wrist.add(hand);
  }

  // legs: hip pivot → thigh → knee pivot → shin → foot
  for (const [prefix, sx] of [
    ['left', 1],
    ['right', -1],
  ] as const) {
    const upper = limbSegment(0.4, 0.058);
    upper.position.set(sx * 0.09, -0.05, 0);
    hips.add(upper);
    bones[`${prefix}UpperLeg`] = upper;
    joints[`${prefix}Hip`] = upper;

    const lower = limbSegment(0.38, 0.048);
    lower.position.set(0, -0.4, 0);
    upper.add(lower);
    bones[`${prefix}LowerLeg`] = lower;
    joints[`${prefix}Knee`] = lower;

    const ankle = new THREE.Object3D();
    ankle.position.set(0, -0.38, 0);
    lower.add(ankle);
    joints[`${prefix}Ankle`] = ankle;

    const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.19), DARK));
    foot.position.set(0, -0.39, 0.04);
    lower.add(foot);
  }

  let baseY = root.position.y;

  return {
    name: 'robot',
    object: root,
    bones,
    joints,
    update(_dt, time) {
      // subtle idle: breathing bob + faint head sway
      root.position.y = baseY + Math.sin(time * 0.0021) * 0.008;
      antennaTip.position.x = Math.sin(time * 0.0035) * 0.01;
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}
