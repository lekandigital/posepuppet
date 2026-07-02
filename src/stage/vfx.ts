// Velocity VFX (elective B1): impact rings past a hand-velocity threshold,
// subtle speed sparks, and a grid ripple underfoot in full-body mode — all
// driven by velocities the motion layer already produces. Subtle by
// default, pooled (zero allocation in steady state), toggleable, and it
// never runs when disabled.

import * as THREE from 'three';
import type { Avatar } from '../rig/types';
import { config } from '../config';

const RING_POOL = 8;
const SPARK_POOL = 48;
const HAND_IMPACT_SPEED = 2.4; // m/s
const FOOT_IMPACT_SPEED = 1.6;
const SPARK_SPEED = 1.8;
const RING_LIFE = 0.55;
const SPARK_LIFE = 0.4;

interface Ring {
  mesh: THREE.Mesh;
  age: number;
  alive: boolean;
}

interface Spark {
  age: number;
  alive: boolean;
  vel: THREE.Vector3;
}

export interface Vfx {
  readonly object: THREE.Group;
  tick(dt: number, avatar: Avatar): void;
}

export function createVfx(): Vfx {
  const object = new THREE.Group();
  object.name = 'vfx';

  // ── impact rings ──
  const ringGeo = new THREE.RingGeometry(0.96, 1, 40);
  const rings: Ring[] = [];
  for (let i = 0; i < RING_POOL; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3fe0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    object.add(mesh);
    rings.push({ mesh, age: 0, alive: false });
  }

  function spawnRing(pos: THREE.Vector3, ground: boolean): void {
    const r = rings.find((x) => !x.alive);
    if (!r) return;
    r.alive = true;
    r.age = 0;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    if (ground) {
      r.mesh.position.y = 0.02;
      r.mesh.rotation.set(-Math.PI / 2, 0, 0);
      (r.mesh.material as THREE.MeshBasicMaterial).color.set(0x9d7bff);
    } else {
      r.mesh.rotation.set(0, 0, 0);
      r.mesh.lookAt(0, pos.y, 4); // face the stage camera direction
      (r.mesh.material as THREE.MeshBasicMaterial).color.set(0x3fe0ff);
    }
  }

  // ── speed sparks ──
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_POOL * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xc8ffdf,
    size: 0.02,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  object.add(sparkPoints);
  const sparks: Spark[] = Array.from({ length: SPARK_POOL }, () => ({
    age: 0,
    alive: false,
    vel: new THREE.Vector3(),
  }));

  function spawnSpark(pos: THREE.Vector3, speed: number): void {
    const i = sparks.findIndex((s) => !s.alive);
    if (i < 0) return;
    const s = sparks[i];
    s.alive = true;
    s.age = 0;
    s.vel.set((Math.random() - 0.5) * speed * 0.4, Math.random() * 0.5, (Math.random() - 0.5) * 0.4);
    sparkPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.05;
    sparkPos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.05;
    sparkPos[i * 3 + 2] = pos.z;
  }

  // wrist/ankle velocity tracking
  const prev = new Map<string, THREE.Vector3>();
  const cur = new THREE.Vector3();
  const cooldown = new Map<string, number>();

  return {
    object,
    tick(dt, avatar) {
      if (!config.vfx) {
        object.visible = false;
        return;
      }
      object.visible = true;

      // track hands always, feet only in full-body mode
      const joints: Array<[string, boolean]> = [
        ['leftWrist', false],
        ['rightWrist', false],
      ];
      if (config.bodyMode === 'full') {
        joints.push(['leftAnkle', true], ['rightAnkle', true]);
      }
      for (const [name, isFoot] of joints) {
        const j = avatar.joints[name as keyof typeof avatar.joints];
        if (!j) continue;
        j.getWorldPosition(cur);
        const p = prev.get(name);
        if (p) {
          const speed = p.distanceTo(cur) / Math.max(dt, 1e-3);
          const cd = cooldown.get(name) ?? 0;
          const impactBar = isFoot ? FOOT_IMPACT_SPEED : HAND_IMPACT_SPEED;
          if (speed > impactBar && cd <= 0) {
            spawnRing(cur, isFoot);
            cooldown.set(name, 0.45);
          } else {
            cooldown.set(name, cd - dt);
          }
          if (!isFoot && speed > SPARK_SPEED && Math.random() < 0.6) {
            spawnSpark(cur, speed);
          }
          p.copy(cur);
        } else {
          prev.set(name, cur.clone());
        }
      }

      // animate rings
      for (const r of rings) {
        if (!r.alive) continue;
        r.age += dt;
        const t = r.age / RING_LIFE;
        if (t >= 1) {
          r.alive = false;
          r.mesh.visible = false;
          continue;
        }
        const s = 0.06 + t * 0.5;
        r.mesh.scale.set(s, s, s);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      }

      // animate sparks
      let anySpark = false;
      for (let i = 0; i < SPARK_POOL; i++) {
        const s = sparks[i];
        if (!s.alive) {
          sparkPos[i * 3 + 1] = -100; // park off-stage
          continue;
        }
        anySpark = true;
        s.age += dt;
        if (s.age >= SPARK_LIFE) {
          s.alive = false;
          sparkPos[i * 3 + 1] = -100;
          continue;
        }
        s.vel.y -= 2.2 * dt;
        sparkPos[i * 3] += s.vel.x * dt;
        sparkPos[i * 3 + 1] += s.vel.y * dt;
        sparkPos[i * 3 + 2] += s.vel.z * dt;
      }
      sparkMat.opacity = anySpark ? 0.8 : 0;
      sparkGeo.attributes.position.needsUpdate = true;
    },
  };
}
