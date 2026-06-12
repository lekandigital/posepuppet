// X-ray self-portrait: the tracked hand skeleton itself, rendered as a
// glowing cyan wireframe in the design language — additive lines, bright
// joint nodes, a faint after-trail. Some people will share this over any
// character.

import * as THREE from 'three';
import { HAND_CONNECTIONS, type HandFrame } from '../../pose/handDetector';
import type { HandPuppet } from '../types';
import { normToStage } from '../palm';

const SCALE = 1.6;

export function createXray(): HandPuppet {
  const root = new THREE.Group();
  root.name = 'xray';

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x3fe0ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const trailMat = new THREE.LineBasicMaterial({
    color: 0x9d7bff,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
  });
  const jointMat = new THREE.MeshBasicMaterial({
    color: 0xc8ffdf,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  // live skeleton: one segment per connection
  const livePositions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
  const liveGeo = new THREE.BufferGeometry();
  liveGeo.setAttribute('position', new THREE.BufferAttribute(livePositions, 3));
  const liveLines = new THREE.LineSegments(liveGeo, lineMat);
  liveLines.frustumCulled = false;
  root.add(liveLines);

  // trail: a delayed copy of the skeleton
  const trailPositions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailLines = new THREE.LineSegments(trailGeo, trailMat);
  trailLines.frustumCulled = false;
  root.add(trailLines);

  // joints
  const jointGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const joints: THREE.Mesh[] = [];
  for (let i = 0; i < 21; i++) {
    const m = new THREE.Mesh(jointGeo, jointMat);
    root.add(m);
    joints.push(m);
  }

  const targets = Array.from({ length: 21 }, () => new THREE.Vector3(0, 1.1, 0));
  const smooth = Array.from({ length: 21 }, () => new THREE.Vector3(0, 1.1, 0));
  const trail = Array.from({ length: 21 }, () => new THREE.Vector3(0, 1.1, 0));
  const tmp = new THREE.Vector3();
  let tracked = false;

  function writeSegments(buf: Float32Array, pts: THREE.Vector3[]): void {
    let o = 0;
    for (const [a, b] of HAND_CONNECTIONS) {
      buf[o++] = pts[a].x; buf[o++] = pts[a].y; buf[o++] = pts[a].z;
      buf[o++] = pts[b].x; buf[o++] = pts[b].y; buf[o++] = pts[b].z;
    }
  }

  return {
    name: 'xray',
    object: root,
    onHandFrame(frame: HandFrame | null) {
      tracked = Boolean(frame);
      if (!frame) return;
      for (let i = 0; i < 21; i++) {
        normToStage(frame.norm[i], tmp);
        targets[i].set(tmp.x * SCALE, (tmp.y - 1.1) * SCALE + 1.1, tmp.z * SCALE);
      }
    },
    update(dt, time) {
      const k = 1 - Math.exp(-22 * dt);
      const kTrail = 1 - Math.exp(-7 * dt); // the trail lags — motion delay line
      for (let i = 0; i < 21; i++) {
        smooth[i].lerp(targets[i], k);
        trail[i].lerp(smooth[i], kTrail);
        joints[i].position.copy(smooth[i]);
      }
      writeSegments(livePositions, smooth);
      writeSegments(trailPositions, trail);
      liveGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.position.needsUpdate = true;

      // idle pulse when lost — never frozen
      const pulse = tracked ? 0.9 : 0.55 + Math.sin(time * 0.003) * 0.2;
      lineMat.opacity = pulse;
    },
    dispose() {
      root.removeFromParent();
      liveGeo.dispose();
      trailGeo.dispose();
      jointGeo.dispose();
    },
  };
}
