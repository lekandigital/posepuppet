// Beaky — the talking bird puppet. Your hand is the head: palm direction
// aims the head, thumb–index pinch opens and closes the beak. Built from
// primitives in the design palette; the charm is in the motion, not the
// mesh. A lip-sync puppet for voiceover takes.

import * as THREE from 'three';
import type { HandFrame } from '../../pose/handDetector';
import type { HandPuppet } from '../types';
import { PalmState } from '../palm';

const BODY = new THREE.MeshStandardMaterial({ color: 0x5a6f96, roughness: 0.5, metalness: 0.35 });
const BEAK = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.4, metalness: 0.2 });
const BEAK_IN = new THREE.MeshStandardMaterial({ color: 0x0d1119, roughness: 0.9 });
const GLOW = new THREE.MeshStandardMaterial({
  color: 0x3fe0ff,
  emissive: 0x3fe0ff,
  emissiveIntensity: 1.6,
  roughness: 0.3,
});

export function createBeaky(): HandPuppet & { jawAngle(): number; pinchNorm(): number } {
  const root = new THREE.Group();
  root.name = 'beaky';

  const head = new THREE.Group();
  root.add(head);

  // skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), BODY);
  skull.scale.set(1, 1.05, 1.15);
  skull.castShadow = true;
  head.add(skull);

  // crest feathers — three glowing blades that catch the spring motion
  const crest = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.14, 6), GLOW);
    blade.position.set(i * 0.045, 0.16, -0.03 + Math.abs(i) * 0.02);
    blade.rotation.x = -0.35 - Math.abs(i) * 0.15;
    blade.rotation.z = i * 0.3;
    crest.add(blade);
  }
  head.add(crest);

  // eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), GLOW);
    eye.position.set(side * 0.1, 0.045, 0.1);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), BEAK_IN);
    pupil.position.set(side * 0.105, 0.045, 0.128);
    head.add(pupil);
  }

  // beak: upper fixed, lower hinged — the jaw
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 4), BEAK);
  upperBeak.rotation.x = Math.PI / 2;
  upperBeak.rotation.y = Math.PI / 4;
  upperBeak.position.set(0, -0.005, 0.26);
  upperBeak.scale.set(1, 1, 0.55);
  upperBeak.castShadow = true;
  head.add(upperBeak);

  const jaw = new THREE.Group();
  jaw.position.set(0, -0.05, 0.12); // hinge under the skull front
  head.add(jaw);
  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 4), BEAK);
  lowerBeak.rotation.x = Math.PI / 2;
  lowerBeak.rotation.y = Math.PI / 4;
  lowerBeak.position.set(0, -0.012, 0.12);
  lowerBeak.scale.set(1, 1, 0.4);
  lowerBeak.castShadow = true;
  jaw.add(lowerBeak);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), BEAK_IN);
  mouth.position.set(0, 0.01, 0.05);
  jaw.add(mouth);

  // little neck ruff so the floating head reads intentional
  const ruff = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 12), BODY);
  ruff.position.set(0, -0.17, 0);
  ruff.rotation.x = Math.PI;
  head.add(ruff);

  const palm = new PalmState();
  const tmpPos = new THREE.Vector3();
  let jawNow = 0;
  let jawTarget = 0;
  // crest spring (secondary motion)
  let crestVel = 0;
  let crestPos = 0;
  let prevQuat = new THREE.Quaternion();

  const PINCH_CLOSED = 0.25; // pinchNorm at touching fingertips
  const PINCH_OPEN = 1.1; // wide open
  const JAW_MAX = 0.62; // rad

  return {
    name: 'beaky',
    object: root,
    onHandFrame(frame: HandFrame | null) {
      palm.onFrame(frame);
      if (frame) {
        const t = THREE.MathUtils.clamp((palm.pinch - PINCH_CLOSED) / (PINCH_OPEN - PINCH_CLOSED), 0, 1);
        jawTarget = t * JAW_MAX;
      }
    },
    update(dt, time) {
      palm.tick(dt);
      const k = 1 - Math.exp(-24 * dt);

      if (palm.tracked || palm.lostSec < 0.5) {
        head.quaternion.slerp(palm.quat, k);
        // a talking head stays center-weighted: half the hand's travel,
        // clamped to the stage, so the puppet never wanders off frame
        tmpPos.set(
          THREE.MathUtils.clamp(palm.pos.x * 0.5, -0.55, 0.55),
          THREE.MathUtils.clamp(1.1 + (palm.pos.y - 1.1) * 0.6, 0.75, 1.5),
          THREE.MathUtils.clamp(palm.pos.z * 0.5, -0.4, 0.4),
        );
        root.position.lerp(tmpPos, k);
      } else {
        // idle: settle level, slow look-around, breathing bob
        head.quaternion.slerp(new THREE.Quaternion(), 1 - Math.exp(-2 * dt));
        head.rotation.y += Math.sin(time * 0.00045) * 0.0006;
        jawTarget = 0.04 + Math.sin(time * 0.0012) * 0.02;
      }
      root.position.y += Math.sin(time * 0.0019) * 0.0006;

      jawNow += (jawTarget - jawNow) * (1 - Math.exp(-26 * dt));
      jaw.rotation.x = jawNow;

      // crest follow-through from head angular speed
      const dq = 2 * Math.acos(Math.min(1, Math.abs(head.quaternion.dot(prevQuat))));
      prevQuat.copy(head.quaternion);
      const speed = dq / Math.max(dt, 1e-3);
      crestVel += (-90 * crestPos - 9 * crestVel + speed * 0.6) * Math.min(dt, 0.05);
      crestPos = THREE.MathUtils.clamp(crestPos + crestVel * Math.min(dt, 0.05), -0.5, 0.5);
      crest.rotation.x = -crestPos;
    },
    jawAngle: () => jawNow,
    pinchNorm: () => palm.pinchSmooth,
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}
