// Auto-director camera (elective B2). Restraint is the feature: a
// spring-damped lean that follows the performer's root, a small push-in
// kick on motion spikes, and a slow idle orbit when tracking is lost.
// Toggleable; it never fights the instant replay or the poster orbit —
// callers hold a lock while they own the camera.

import * as THREE from 'three';
import { config } from '../config';

export interface AutoCam {
  /** dt, avatar root x offset, smoothed motion energy, tracking fresh? */
  tick(dt: number, rootX: number, energy: number, tracking: boolean): void;
}

const BASES = {
  character: { pos: new THREE.Vector3(0, 1.3, 3.2), look: new THREE.Vector3(0, 1.0, 0) },
  hand: { pos: new THREE.Vector3(0, 1.15, 2.1), look: new THREE.Vector3(0, 1.05, 0) },
};

export function createAutoCam(camera: THREE.PerspectiveCamera, isLocked: () => boolean): AutoCam {
  // spring state
  let leanX = 0;
  let leanVel = 0;
  let push = 0;
  let pushVel = 0;
  let idleSec = 0;
  let orbit = 0;
  const pos = new THREE.Vector3();

  return {
    tick(dt, rootX, energy, tracking) {
      if (!config.autoCam || isLocked()) return;
      const base = BASES[config.mode === 'hand' ? 'hand' : 'character'];

      // lean-with-me: critically damped spring toward a fraction of root x
      const targetLean = THREE.MathUtils.clamp(rootX * 0.4, -0.35, 0.35);
      const K = 18;
      const C = 2 * Math.sqrt(K);
      leanVel += (K * (targetLean - leanX) - C * leanVel) * dt;
      leanX += leanVel * dt;

      // impact kick: energy spikes push the camera in a touch, spring back
      const kickTarget = Math.min(energy * 0.035, 0.16);
      const K2 = 24;
      const C2 = 2 * Math.sqrt(K2) * 1.1; // slightly overdamped return
      pushVel += (K2 * (kickTarget - push) - C2 * pushVel) * dt;
      push += pushVel * dt;

      // idle slow-orbit when tracking is lost for a while
      if (tracking) {
        idleSec = 0;
        orbit *= Math.max(0, 1 - dt * 1.5); // ease back to front
      } else {
        idleSec += dt;
        if (idleSec > 4) orbit += dt * 0.12; // ~7°/s max sweep feel
      }
      const orbitAng = Math.sin(orbit) * 0.55;

      const r = base.pos.z - push;
      pos.set(
        base.pos.x + leanX + Math.sin(orbitAng) * r * 0.35,
        base.pos.y,
        Math.cos(orbitAng * 0.35) * r,
      );
      camera.position.copy(pos);
      camera.lookAt(base.look);
    },
  };
}
