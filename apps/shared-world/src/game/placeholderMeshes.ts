// Checkpoint 07 — Placeholder World: scene meshes for the deterministic
// placement plan (src/world/placeholders.ts).
//
// Presentation law (Master §8.3): simple rectangular blocks, color-coded
// per the legend, matte (§6.4 material discipline: Lambert, metalness-free,
// no speculars), dev-mode labeled, visually obvious. One InstancedMesh per
// category keeps the draw cost flat (≤ 13 draw calls for every placeholder
// in the world).
//
// Wildlife VOLUMES (fish school / large marine animal) render translucent
// so they read as patrol/school volumes rather than solid props — they are
// still color-coded rectangular boxes (presentation choice, reported).
//
// The placeholders are ordinary scene meshes: directly visible from the
// camera's side of the surface exactly like the terrain scene meshes. They
// do NOT join the vendored single-object water-optics subsystem (CP06
// restored it for the actor; the vendored mechanism tracks one mesh
// descriptor) — asset-side optics integration belongs to the later asset
// checkpoints. Recorded as a checkpoint limitation.

import * as THREE from 'three';
import {
  PLACEHOLDER_LEGEND,
  type PlaceholderCategory,
  type PlaceholderInstance,
  type PlaceholderPlan,
} from '../world/placeholders';

export interface PlaceholderMeshes {
  /** production placeholders (always visible) */
  group: THREE.Group;
  /** dev labels + non-asset site markers (?debug=1 only) */
  debugGroup: THREE.Group;
  setVisible(v: boolean): void;
  counts: { meshes: number; instances: number; labels: number };
  dispose(): void;
}

const VOLUME_CATEGORIES: ReadonlySet<PlaceholderCategory> = new Set(['fish', 'animal']);

export function buildPlaceholderMeshes(plan: PlaceholderPlan): PlaceholderMeshes {
  const group = new THREE.Group();
  group.name = 'cp07-placeholders';
  const debugGroup = new THREE.Group();
  debugGroup.name = 'cp07-placeholder-debug';

  const box = new THREE.BoxGeometry(1, 1, 1);
  const disposables: { dispose(): void }[] = [box];

  // bucket instances per category
  const byCategory = new Map<PlaceholderCategory, PlaceholderInstance[]>();
  for (const inst of plan.instances) {
    const list = byCategory.get(inst.category) ?? [];
    list.push(inst);
    byCategory.set(inst.category, list);
  }

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const yawQuat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3();

  let meshCount = 0;
  for (const [category, list] of byCategory) {
    const legend = PLACEHOLDER_LEGEND[category];
    const isVolume = VOLUME_CATEGORIES.has(category);
    const material = new THREE.MeshLambertMaterial({
      color: legend.hex,
      ...(isVolume
        ? { transparent: true, opacity: 0.4, depthWrite: false }
        : {}),
    });
    disposables.push(material);
    const mesh = new THREE.InstancedMesh(box, material, list.length);
    mesh.name = `cp07-${category}`;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i]!;
      pos.set(inst.x, inst.y, inst.z);
      yawQuat.setFromAxisAngle(up, inst.yaw);
      if (inst.align === 'normal') {
        nrm.set(inst.normal[0], inst.normal[1], inst.normal[2]);
        quat.setFromUnitVectors(up, nrm).multiply(yawQuat);
      } else {
        quat.copy(yawQuat);
      }
      scale.set(inst.size[0], inst.size[1], inst.size[2]);
      m4.compose(pos, quat, scale);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // the region is fog-free until cp08 and the boxes span the whole
    // region — cull per category bounds (computed once)
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshCount++;
  }

  // --- dev labels (?debug=1): category + census-unit id per cluster ---
  let labels = 0;
  const labelAnchors = new Map<string, { x: number; y: number; z: number; category: string }>();
  for (const inst of plan.instances) {
    const key = `${inst.category}/${inst.cluster}`;
    const top = inst.y + inst.size[1] / 2;
    const cur = labelAnchors.get(key);
    if (!cur || top + 1.2 > cur.y) {
      labelAnchors.set(key, { x: inst.x, y: top + 1.2, z: inst.z, category: inst.category });
    }
  }
  for (const [key, a] of labelAnchors) {
    const sprite = makeLabelSprite(key, '#e8f4fa');
    sprite.position.set(a.x, a.y, a.z);
    debugGroup.add(sprite);
    disposables.push(sprite.material.map!, sprite.material);
    labels++;
  }

  // --- dev markers for the non-asset approved sites (census-represented,
  // never production rectangles — see placeholders.ts §2) ---
  const siteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  disposables.push(siteMat);
  for (const site of plan.sites) {
    const marker = new THREE.Mesh(box, siteMat);
    marker.position.set(site.x, site.y, site.z);
    marker.rotation.y = site.yaw;
    marker.scale.set(1.2, 1.2, 1.2);
    debugGroup.add(marker);
    const sprite = makeLabelSprite(site.id, '#9fd8ff');
    sprite.position.set(site.x, site.y + 1.6, site.z);
    debugGroup.add(sprite);
    disposables.push(sprite.material.map!, sprite.material);
    labels++;
  }

  return {
    group,
    debugGroup,
    setVisible(v: boolean) {
      group.visible = v;
      debugGroup.visible = v;
    },
    counts: { meshes: meshCount, instances: plan.instances.length, labels },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** small canvas-texture text sprite (dev view only; no external assets). */
function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const pad = 8;
  const fontPx = 28;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontPx}px ui-monospace, Menlo, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const c2 = canvas.getContext('2d')!;
  c2.font = `${fontPx}px ui-monospace, Menlo, monospace`;
  c2.fillStyle = 'rgba(0,0,0,0.55)';
  c2.fillRect(0, 0, w, h);
  c2.fillStyle = color;
  c2.textBaseline = 'middle';
  c2.fillText(text, pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  // ~0.035 m per px at 1 m distance-independent sprite scale keeps labels
  // readable without dominating the frame
  sprite.scale.set(w * 0.035, h * 0.035, 1);
  sprite.renderOrder = 20;
  return sprite;
}
