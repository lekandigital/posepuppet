// VRM avatar through the same Avatar interface as the robot. Drives the RAW
// humanoid bones — the Retargeter captures whatever rest pose the model
// ships with at bind time, so normalized-rig subtleties don't apply.
// Also exports a name-matching BoneMap layer (J_Bip_*, mixamorig*, generic)
// so a plain GLB humanoid can be driven the same way.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { Avatar, BoneName, JointName } from './types';

/** humanoid bone → our BoneName (VRM names match ours for the driven set) */
const VRM_BONES: BoneName[] = [
  'hips', 'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
  'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
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
  // chest is optional in VRM; fall back to spine so torso enactment works
  if (!bones.chest) bones.chest = vrm.humanoid.getRawBoneNode('spine') ?? undefined;

  const joints: Partial<Record<JointName, THREE.Object3D>> = {};
  for (const [joint, vrmName] of Object.entries(JOINT_FROM_VRM) as [JointName, string][]) {
    const node = vrm.humanoid.getRawBoneNode(vrmName as Parameters<typeof vrm.humanoid.getRawBoneNode>[0]);
    if (node) joints[joint] = node;
  }

  return {
    name: 'vrm',
    object: root,
    bones,
    joints,
    update(dt) {
      vrm.update(dt); // springbones etc.
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
  rightUpperArm: /^(J_Bip_R_UpperArm|mixamorig:?RightArm|.*\b(right|r)[._ ]?(upper_?arm|arm)\b.*)$/i,
  rightLowerArm: /^(J_Bip_R_LowerArm|mixamorig:?RightForeArm|.*\b(right|r)[._ ]?(lower_?arm|fore_?arm)\b.*)$/i,
  leftUpperLeg: /^(J_Bip_L_UpperLeg|mixamorig:?LeftUpLeg|.*\b(left|l)[._ ]?(upper_?leg|up_?leg|thigh)\b.*)$/i,
  leftLowerLeg: /^(J_Bip_L_LowerLeg|mixamorig:?LeftLeg|.*\b(left|l)[._ ]?(lower_?leg|leg|shin|calf)\b.*)$/i,
  rightUpperLeg: /^(J_Bip_R_UpperLeg|mixamorig:?RightUpLeg|.*\b(right|r)[._ ]?(upper_?leg|up_?leg|thigh)\b.*)$/i,
  rightLowerLeg: /^(J_Bip_R_LowerLeg|mixamorig:?RightLeg|.*\b(right|r)[._ ]?(lower_?leg|leg|shin|calf)\b.*)$/i,
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
