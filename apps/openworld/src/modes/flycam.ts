// Free/flyover camera — an O1 verification instrument, kept for the
// engineering view. Auto-orbits the region until a key claims it; then
// WASD+RF fly, arrows look. Not a game mode (no body input by design).

import * as THREE from 'three';
import type { WorldRuntime } from '../world/runtime';

export interface Flycam {
  update(dtS: number, timeS: number): void;
  camera: THREE.PerspectiveCamera;
  manual(): boolean;
  dispose(): void;
}

export function createFlycam(world: WorldRuntime, camera: THREE.PerspectiveCamera): Flycam {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const radius = Math.min(maxX - minX, maxZ - minZ) * 0.34;
  let manual = false;
  const keys = new Set<string>();
  let yaw = 0;
  let pitch = -0.35;

  const down = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (!manual) {
        manual = true;
        // adopt current orbit orientation so the switch never snaps
        const e2 = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        yaw = e2.y; pitch = e2.x;
      }
      keys.add(k);
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent): void => { keys.delete(e.key.toLowerCase()); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  return {
    camera,
    manual: () => manual,
    update(dtS: number, timeS: number): void {
      if (!manual) {
        const a = timeS * 0.05;
        camera.position.set(cx + Math.cos(a) * radius, 650 + Math.sin(timeS * 0.11) * 60, cz + Math.sin(a) * radius);
        camera.lookAt(cx + Math.cos(a + 1.2) * radius * 0.25, 60, cz + Math.sin(a + 1.2) * radius * 0.25);
        return;
      }
      const speed = 220;
      if (keys.has('arrowleft')) yaw += dtS * 1.4;
      if (keys.has('arrowright')) yaw -= dtS * 1.4;
      if (keys.has('arrowup')) pitch = Math.min(pitch + dtS * 1.0, 1.4);
      if (keys.has('arrowdown')) pitch = Math.max(pitch - dtS * 1.0, -1.4);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const v = new THREE.Vector3();
      if (keys.has('w')) v.add(fwd);
      if (keys.has('s')) v.sub(fwd);
      if (keys.has('d')) v.add(right);
      if (keys.has('a')) v.sub(right);
      if (keys.has('r')) v.y += 1;
      if (keys.has('f')) v.y -= 1;
      if (v.lengthSq() > 0) camera.position.addScaledVector(v.normalize(), speed * dtS);
      // never below the ground
      const floor = world.groundY(camera.position.x, camera.position.z) + 2;
      if (camera.position.y < floor) camera.position.y = floor;
    },
    dispose(): void {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    },
  };
}
