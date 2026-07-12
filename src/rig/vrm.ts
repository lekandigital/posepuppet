// VRM avatar through the same Avatar interface as the robot. Drives the RAW
// humanoid bones — the Retargeter captures whatever rest pose the model
// ships with at bind time, so normalized-rig subtleties don't apply.
// Also exports a name-matching BoneMap layer (J_Bip_*, mixamorig*, generic)
// so a plain GLB humanoid can be driven the same way.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { Avatar, AvatarCapabilityReport, BoneName, FingerCurls, FingerName, JointName } from './types';

/** humanoid bone → our BoneName (VRM names match ours for the driven set) */
const VRM_BONES: BoneName[] = [
  'hips', 'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

/** joint anchors from humanoid bones (wrist/ankle = hand/foot nodes) */
const JOINT_FROM_VRM: Record<JointName, string> = {
  hipCenter: 'hips',
  shoulderCenter: 'neck',
  head: 'head',
  leftShoulder: 'leftUpperArm',
  leftElbow: 'leftLowerArm',
  leftWrist: 'leftHand',
  rightShoulder: 'rightUpperArm',
  rightElbow: 'rightLowerArm',
  rightWrist: 'rightHand',
  leftHip: 'leftUpperLeg',
  leftKnee: 'leftLowerLeg',
  leftAnkle: 'leftFoot',
  rightHip: 'rightUpperLeg',
  rightKnee: 'rightLowerLeg',
  rightAnkle: 'rightFoot',
};

export async function loadVrmAvatar(url: string): Promise<Avatar> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('file has no VRM extension data');
  // we drive the RAW bones; by default vrm.update() copies the (static)
  // normalized rig onto them every frame, freezing the avatar in T-pose
  vrm.humanoid.autoUpdateHumanBones = false;

  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  // VRM 0.x models face the opposite way from VRM 1.0; normalize so the
  // avatar faces the stage camera like the robot does.
  VRMUtils.rotateVRM0(vrm);

  const root = new THREE.Group();
  root.name = 'vrm-avatar';
  root.add(vrm.scene);
  vrm.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  const bones: Partial<Record<BoneName, THREE.Object3D>> = {};
  for (const name of VRM_BONES) {
    const node = vrm.humanoid.getRawBoneNode(name);
    if (node) bones[name] = node;
  }

  // Capability diagnostics: log which bones were found for this avatar
  const found = VRM_BONES.filter(b => bones[b]);
  const missing = VRM_BONES.filter(b => !bones[b]);
  console.info(`[VRM] bones found: ${found.join(', ')}${missing.length ? `\n[VRM] missing: ${missing.join(', ')}` : ''}`);
  if (!bones.leftHand || !bones.rightHand) {
    console.info('[VRM] hand bones not found — wrist driving unavailable for this avatar');
  }
  // chest is optional in VRM; fall back to spine so torso enactment works
  if (!bones.chest) bones.chest = vrm.humanoid.getRawBoneNode('spine') ?? undefined;

  const joints: Partial<Record<JointName, THREE.Object3D>> = {};
  for (const [joint, vrmName] of Object.entries(JOINT_FROM_VRM) as [JointName, string][]) {
    const node = vrm.humanoid.getRawBoneNode(vrmName as Parameters<typeof vrm.humanoid.getRawBoneNode>[0]);
    if (node) joints[joint] = node;
  }

  // distinguishable name per file ('vrm:woody') so eval results can never
  // silently attribute one VRM's numbers to another
  const slug = url.split('/').pop()?.replace(/\.(vrm|glb)$/i, '').toLowerCase() ?? 'unknown';

  // head collider from the actual skinned geometry: vertices whose dominant
  // skin weight is the head bone (or a descendant — helmets/hair hang off
  // extra bones under it). At load the model stands in bind pose, so
  // mesh-local → world is the rest position; we store the centroid in
  // head-LOCAL space + a radius. (A bbox of the head node finds nothing on
  // skinned meshes — that gap put the astronaut's contact target inside
  // its helmet, found at the Gate-3 live test.)
  let headGeometry: { centerLocal: THREE.Vector3; radius: number; halfHeightY?: number } | undefined;
  const headBone = vrm.humanoid.getRawBoneNode('head');
  if (headBone) {
    gltf.scene.updateWorldMatrix(true, true);
    const headSet = new Set<THREE.Object3D>();
    headBone.traverse((o) => headSet.add(o));
    const pts: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const pos = mesh.geometry.getAttribute('position');
      const idx = mesh.geometry.getAttribute('skinIndex');
      const wgt = mesh.geometry.getAttribute('skinWeight');
      if (!pos || !idx || !wgt) return;
      const headBoneIdx = new Set<number>();
      mesh.skeleton.bones.forEach((b, i) => {
        if (headSet.has(b)) headBoneIdx.add(i);
      });
      if (!headBoneIdx.size) return;
      const stride = Math.max(1, Math.floor(pos.count / 4000)); // sample, don't crawl
      for (let i = 0; i < pos.count; i += stride) {
        // dominant influence
        let best = 0;
        let bestW = wgt.getX(i);
        if (wgt.getY(i) > bestW) { best = 1; bestW = wgt.getY(i); }
        if (wgt.getZ(i) > bestW) { best = 2; bestW = wgt.getZ(i); }
        if (wgt.getW(i) > bestW) { best = 3; bestW = wgt.getW(i); }
        const bone = [idx.getX(i), idx.getY(i), idx.getZ(i), idx.getW(i)][best];
        if (!headBoneIdx.has(bone) || bestW < 0.5) continue;
        v.fromBufferAttribute(pos, i);
        mesh.localToWorld(v);
        pts.push(v.clone());
      }
    });
    if (pts.length > 20) {
      const centroid = new THREE.Vector3();
      for (const p of pts) centroid.add(p);
      centroid.divideScalar(pts.length);
      // capsule fit (face-touch v2): heads are taller than wide — a sphere
      // wide enough for the crown pushed cheek/chin contacts visibly off
      // the face. Split the extent into a radial part (95th percentile
      // horizontal distance in head-local space) and a vertical half-height.
      const centerLocal = headBone.worldToLocal(centroid.clone());
      const lp = new THREE.Vector3();
      const radials: number[] = [];
      const verts: number[] = [];
      for (const p of pts) {
        headBone.worldToLocal(lp.copy(p)).sub(centerLocal);
        radials.push(Math.hypot(lp.x, lp.z));
        verts.push(Math.abs(lp.y));
      }
      radials.sort((a, b) => a - b);
      verts.sort((a, b) => a - b);
      const radius = THREE.MathUtils.clamp(radials[Math.floor(radials.length * 0.95)], 0.08, 0.4);
      const yExtent = verts[Math.floor(verts.length * 0.95)];
      const halfHeightY = THREE.MathUtils.clamp(yExtent - radius, 0, 0.25);
      headGeometry = { centerLocal, radius, halfHeightY };
      console.info(
        `[VRM] head collider: capsule r=${radius.toFixed(3)}m h/2=${halfHeightY.toFixed(3)}m ` +
        `from ${pts.length} sampled vertices`,
      );
    }
  }
  // finger chains for open/fist/point approximations (where the rig has
  // them). Gate-3 fix: the curl axis is COMPUTED per segment from the
  // rig's own geometry — perpendicular to the segment's bone direction,
  // lying in the palm plane — instead of assuming a per-convention axis
  // (which bent the astronaut's fingers backwards live).
  type FingerSeg = { node: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3 };
  type FingerChain = { segs: FingerSeg[]; isThumb: boolean; finger: FingerName };
  const fingerChains: Record<'left' | 'right', FingerChain[]> = { left: [], right: [] };
  gltf.scene.updateWorldMatrix(true, true);
  for (const side of ['left', 'right'] as const) {
    const hand = vrm.humanoid.getRawBoneNode(`${side}Hand`);
    const idxProx = vrm.humanoid.getRawBoneNode(`${side}IndexProximal`);
    const pinkyProx = vrm.humanoid.getRawBoneNode(`${side}LittleProximal`);
    if (!hand || !idxProx || !pinkyProx) continue;

    // palm normal in WORLD space at rest: across-knuckles × finger-dir.
    // Sign: in a T/A-pose VRM, palms face down-ish — pick the candidate
    // pointing more downward so "curl" closes toward the palm.
    const handW = hand.getWorldPosition(new THREE.Vector3());
    const idxW = idxProx.getWorldPosition(new THREE.Vector3());
    const pinkyW = pinkyProx.getWorldPosition(new THREE.Vector3());
    const across = new THREE.Vector3().subVectors(pinkyW, idxW).normalize();
    const fingersDir = new THREE.Vector3().addVectors(idxW, pinkyW).multiplyScalar(0.5).sub(handW).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(fingersDir, across).normalize();
    if (palmNormal.y > 0) palmNormal.negate();

    for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const) {
      const segs: FingerSeg[] = [];
      const segNodes: THREE.Object3D[] = [];
      for (const seg of ['Metacarpal', 'Proximal', 'Intermediate', 'Distal'] as const) {
        const node = vrm.humanoid.getRawBoneNode(
          `${side}${finger}${seg}` as Parameters<typeof vrm.humanoid.getRawBoneNode>[0],
        );
        if (node) segNodes.push(node);
      }
      for (let i = 0; i < segNodes.length; i++) {
        const node = segNodes[i];
        // bone direction: toward the next segment, or reuse the previous
        // segment's direction for the last (distal) bone
        const next = segNodes[i + 1];
        const dirW = new THREE.Vector3();
        if (next) {
          next.getWorldPosition(dirW).sub(node.getWorldPosition(new THREE.Vector3()));
        } else if (i > 0) {
          node.getWorldPosition(dirW).sub(segNodes[i - 1].getWorldPosition(new THREE.Vector3()));
        } else {
          dirW.copy(fingersDir);
        }
        dirW.normalize();
        // curl axis (world): perpendicular to the bone, in the palm plane;
        // sign chosen so +rotation moves the tip toward the palm side
        const axisW = new THREE.Vector3().crossVectors(palmNormal, dirW).normalize();
        const sweep = new THREE.Vector3().crossVectors(axisW, dirW);
        if (sweep.dot(palmNormal) < 0) axisW.negate();
        // world → this bone's local frame at rest
        const parentWorldInv = node.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
        const axisLocal = axisW.applyQuaternion(parentWorldInv).normalize();
        segs.push({ node, rest: node.quaternion.clone(), axis: axisLocal });
      }
      if (segs.length) {
        fingerChains[side].push({ segs, isThumb: finger === 'Thumb', finger: finger.toLowerCase() as FingerName });
      }
    }
  }
  const curlQ = new THREE.Quaternion();

  // idle life: periodic blinks through the VRM expression manager (where
  // the model ships blendshapes); randomized cadence so it never reads
  // mechanical. Springbones (hair/accessories) already run via vrm.update.
  let blinkClock = 0;
  let nextBlink = 2 + Math.random() * 3;
  const canBlink = Boolean(vrm.expressionManager?.getExpressionTrackName('blink'));

  return {
    name: `vrm:${slug}`,
    object: root,
    bones,
    joints,
    headGeometry,
    applyHandState(side, openness, point) {
      const chains = fingerChains[side];
      if (!chains.length) return;
      for (const chain of chains) {
        // pointing: index stays extended
        const ext = point && chain.finger === 'index' ? 1 : openness;
        const maxCurl = chain.isThumb ? 0.45 : 1.05; // rad at the proximal joint
        for (let i = 0; i < chain.segs.length; i++) {
          const seg = chain.segs[i];
          const segCurl = (1 - ext) * maxCurl * (i === 0 ? 1 : 0.75);
          curlQ.setFromAxisAngle(seg.axis, segCurl);
          seg.node.quaternion.copy(seg.rest).multiply(curlQ);
        }
      }
    },
    applyFingerCurls(side, curls: FingerCurls, point) {
      // true per-finger driving (hand-landmark fusion, V5): same per-segment
      // curl axes as applyHandState, but each finger gets its own value
      const chains = fingerChains[side];
      if (!chains.length) return;
      for (const chain of chains) {
        let curl = curls[chain.finger];
        if (point && chain.finger === 'index') curl = 0;
        const maxCurl = chain.isThumb ? 0.5 : 1.35; // rad at the proximal joint
        for (let i = 0; i < chain.segs.length; i++) {
          const seg = chain.segs[i];
          const segCurl = curl * maxCurl * (i === 0 ? 1 : 0.75);
          curlQ.setFromAxisAngle(seg.axis, segCurl);
          seg.node.quaternion.copy(seg.rest).multiply(curlQ);
        }
      }
    },
    fingerCurlEnacted(side) {
      const chains = fingerChains[side];
      let sum = 0;
      let n = 0;
      for (const chain of chains) {
        if (chain.isThumb) continue;
        const seg = chain.segs[0];
        sum += Math.min(1, seg.rest.angleTo(seg.node.quaternion) / 1.35);
        n++;
      }
      return n ? sum / n : Number.NaN;
    },
    describeCapabilities(): AvatarCapabilityReport {
      const chainReport = (side: 'left' | 'right') => {
        const out: Partial<Record<FingerName, number>> = {};
        for (const chain of fingerChains[side]) out[chain.finger] = chain.segs.length;
        return out;
      };
      const hasChains = fingerChains.left.length > 0 || fingerChains.right.length > 0;
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      const armSeg = (side: 'left' | 'right') => {
        const s = joints[`${side}Shoulder` as JointName]?.getWorldPosition(new THREE.Vector3());
        const e = joints[`${side}Elbow` as JointName]?.getWorldPosition(new THREE.Vector3());
        const w = joints[`${side}Wrist` as JointName]?.getWorldPosition(new THREE.Vector3());
        return s && e && w
          ? { upper: s.distanceTo(e), fore: e.distanceTo(w) }
          : { upper: 0, fore: 0 };
      };
      const ALL: BoneName[] = [
        'hips', 'chest', 'neck', 'head',
        'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightUpperArm', 'rightLowerArm', 'rightHand',
        'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
        'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
      ];
      return {
        bonesPresent: ALL.filter((b) => bones[b]),
        bonesMissing: ALL.filter((b) => !bones[b]),
        fingerChains: hasChains ? { left: chainReport('left'), right: chainReport('right') } : null,
        headCollider: headGeometry
          ? { radius: headGeometry.radius, halfHeight: headGeometry.halfHeightY ?? 0 }
          : null,
        armLen: { left: armSeg('left'), right: armSeg('right') },
        height: box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).y,
        feet: Boolean(bones.leftFoot && bones.rightFoot),
      };
    },
    update(dt) {
      if (canBlink) {
        blinkClock += dt;
        const t = blinkClock - nextBlink;
        if (t > 0) {
          // 160 ms close-open envelope
          const v = t < 0.08 ? t / 0.08 : t < 0.16 ? 1 - (t - 0.08) / 0.08 : 0;
          vrm.expressionManager!.setValue('blink', Math.max(0, v));
          if (t >= 0.16) {
            blinkClock = 0;
            nextBlink = 2 + Math.random() * 3.5;
          }
        }
      }
      vrm.update(dt); // springbones, expressions
    },
    dispose() {
      root.removeFromParent();
      VRMUtils.deepDispose(vrm.scene);
    },
  };
}

// --- name-matching layer for plain GLB humanoids ------------------------

/** Regex table per BoneName: VRoid (J_Bip_*), Mixamo (mixamorig*), generic. */
export const BONE_NAME_PATTERNS: Record<BoneName, RegExp> = {
  hips: /^(J_Bip_C_Hips|mixamorig:?Hips|.*\bhips?\b.*)$/i,
  chest: /^(J_Bip_C_Chest|mixamorig:?Spine2|.*\b(chest|upper_?chest)\b.*)$/i,
  neck: /^(J_Bip_C_Neck|mixamorig:?Neck|.*\bneck\b.*)$/i,
  head: /^(J_Bip_C_Head|mixamorig:?Head|.*\bhead\b.*)$/i,
  leftUpperArm: /^(J_Bip_L_UpperArm|mixamorig:?LeftArm|.*\b(left|l)[._ ]?(upper_?arm|arm)\b.*)$/i,
  leftLowerArm: /^(J_Bip_L_LowerArm|mixamorig:?LeftForeArm|.*\b(left|l)[._ ]?(lower_?arm|fore_?arm)\b.*)$/i,
  leftHand: /^(J_Bip_L_Hand|mixamorig:?LeftHand|.*\b(left|l)[._ ]?hand\b.*)$/i,
  rightUpperArm: /^(J_Bip_R_UpperArm|mixamorig:?RightArm|.*\b(right|r)[._ ]?(upper_?arm|arm)\b.*)$/i,
  rightLowerArm: /^(J_Bip_R_LowerArm|mixamorig:?RightForeArm|.*\b(right|r)[._ ]?(lower_?arm|fore_?arm)\b.*)$/i,
  rightHand: /^(J_Bip_R_Hand|mixamorig:?RightHand|.*\b(right|r)[._ ]?hand\b.*)$/i,
  leftUpperLeg: /^(J_Bip_L_UpperLeg|mixamorig:?LeftUpLeg|.*\b(left|l)[._ ]?(upper_?leg|up_?leg|thigh)\b.*)$/i,
  leftLowerLeg: /^(J_Bip_L_LowerLeg|mixamorig:?LeftLeg|.*\b(left|l)[._ ]?(lower_?leg|leg|shin|calf)\b.*)$/i,
  leftFoot: /^(J_Bip_L_Foot|mixamorig:?LeftFoot|.*\b(left|l)[._ ]?(foot|ankle)\b.*)$/i,
  rightUpperLeg: /^(J_Bip_R_UpperLeg|mixamorig:?RightUpLeg|.*\b(right|r)[._ ]?(upper_?leg|up_?leg|thigh)\b.*)$/i,
  rightLowerLeg: /^(J_Bip_R_LowerLeg|mixamorig:?RightLeg|.*\b(right|r)[._ ]?(lower_?leg|leg|shin|calf)\b.*)$/i,
  rightFoot: /^(J_Bip_R_Foot|mixamorig:?RightFoot|.*\b(right|r)[._ ]?(foot|ankle)\b.*)$/i,
};

/** Scans a hierarchy and maps bones by name. First match per bone wins,
 *  preferring exact VRoid/Mixamo names over generic substring matches. */
export function matchBonesByName(rootObj: THREE.Object3D): Partial<Record<BoneName, THREE.Object3D>> {
  const out: Partial<Record<BoneName, THREE.Object3D>> = {};
  const names: THREE.Object3D[] = [];
  rootObj.traverse((o) => {
    if (o.name) names.push(o);
  });
  for (const [bone, re] of Object.entries(BONE_NAME_PATTERNS) as [BoneName, RegExp][]) {
    for (const node of names) {
      if (re.test(node.name)) {
        out[bone] = node;
        break;
      }
    }
  }
  return out;
}
