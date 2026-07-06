// The expressive 3D hand: a stylized robot-glove hand following all 21
// landmarks — palm slab + five finger chains whose segments stretch
// between smoothed joint positions every frame. True finger tracking,
// hand-only mode first (P3 decision: it does not spread to full-body
// avatars this pass).

import * as THREE from 'three';
import { HLM, HAND_CONNECTIONS, type HandFrame } from '../../pose/handDetector';
import type { HandPuppet } from '../types';
import { normToStage } from '../palm';

const SKIN = new THREE.MeshStandardMaterial({ color: 0x5a6f96, roughness: 0.5, metalness: 0.4 });
const JOINT = new THREE.MeshStandardMaterial({ color: 0x3b4a6b, roughness: 0.6, metalness: 0.3 });
const TIP = new THREE.MeshStandardMaterial({
  color: 0x3fe0ff,
  emissive: 0x3fe0ff,
  emissiveIntensity: 1.2,
  roughness: 0.35,
});

const TIP_IDS = new Set<number>([HLM.thumbTip, HLM.indexTip, HLM.middleTip, HLM.ringTip, HLM.pinkyTip]);
const SCALE = 1.45; // hand box scale on stage

export function createExpressiveHand(): HandPuppet {
  const root = new THREE.Group();
  root.name = 'hand';

  // 21 joints
  const joints: THREE.Mesh[] = [];
  for (let i = 0; i < 21; i++) {
    const isTip = TIP_IDS.has(i);
    const r = i === HLM.wrist ? 0.052 : isTip ? 0.03 : 0.026;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), isTip ? TIP : JOINT);
    m.castShadow = true;
    root.add(m);
    joints.push(m);
  }

  // segments between connected joints (cylinders re-posed per tick)
  const segs: { mesh: THREE.Mesh; a: number; b: number }[] = [];
  for (const [a, b] of HAND_CONNECTIONS) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.0225, 1, 8), SKIN);
    mesh.castShadow = true;
    root.add(mesh);
    segs.push({ mesh, a, b });
  }

  // palm slab between wrist / index-mcp / pinky-mcp
  const palmSlab = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), SKIN);
  palmSlab.scale.set(1.3, 0.55, 1.5);
  palmSlab.castShadow = true;
  root.add(palmSlab);

  // smoothed landmark positions in stage space
  const targets = Array.from({ length: 21 }, () => new THREE.Vector3(0, 1.1, 0));
  const smooth = Array.from({ length: 21 }, () => new THREE.Vector3(0, 1.1, 0));
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let tracked = false;
  let lostSec = 0;
  let center = new THREE.Vector3(0, 1.1, 0);

  return {
    name: 'hand',
    object: root,
    onHandFrame(frame: HandFrame | null) {
      tracked = Boolean(frame);
      if (!frame) return;
      lostSec = 0;
      for (let i = 0; i < 21; i++) {
        normToStage(frame.norm[i], tmp);
        // scale around stage center so the hand fills the stage
        targets[i].set(tmp.x * SCALE, (tmp.y - 1.1) * SCALE + 1.1, tmp.z * SCALE);
      }
    },
    update(dt, time) {
      if (!tracked) {
        lostSec += dt;
        // idle: gentle float + slow finger curl wave
        const f = Math.sin(time * 0.0014) * 0.004;
        for (const t of targets) t.y += f * dt * 60 * 0.01;
      }
      const k = 1 - Math.exp(-20 * dt);
      for (let i = 0; i < 21; i++) smooth[i].lerp(targets[i], k);

      for (let i = 0; i < 21; i++) joints[i].position.copy(smooth[i]);
      for (const { mesh, a, b } of segs) {
        const pa = smooth[a];
        const pb = smooth[b];
        mesh.position.copy(pa).add(pb).multiplyScalar(0.5);
        const len = Math.max(pa.distanceTo(pb), 1e-3);
        mesh.scale.set(1, len, 1);
        tmp.copy(pb).sub(pa).normalize();
        mesh.quaternion.setFromUnitVectors(up, tmp);
      }
      center.copy(smooth[HLM.wrist]).add(smooth[HLM.middleMcp]).multiplyScalar(0.5);
      palmSlab.position.copy(center);
      tmp.copy(smooth[HLM.middleMcp]).sub(smooth[HLM.wrist]).normalize();
      palmSlab.quaternion.setFromUnitVectors(up, tmp);
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}
