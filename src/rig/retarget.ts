// Retargeting: mirrored+smoothed world landmarks → bone rotations.
//
// Two-stage smoothing: pose frames (~30/s) write LOCAL-space target
// quaternions; every render tick (~60–120/s) bones slerp toward them.
// Limb targets are computed in the BODY frame so torso turns don't corrupt
// arms, then converted world → parent-local before assignment (the single
// biggest source of "possessed" limbs when skipped). Bones whose landmarks
// go invisible hold their last target and relax toward rest over ~0.7 s.

import * as THREE from 'three';
import { LM } from '../pose/indices';
import { BodyFrame, mpToThree } from '../pose/bodyFrame';
import type { LandmarkPoint } from '../pose/types';
import type { Avatar, BoneName, JointName } from './types';
import { config } from '../config';

const VIS_ON = 0.55;
const VIS_OFF = 0.45;

interface LimbSpec {
  bone: BoneName;
  from: number;
  to: number;
  joints: [JointName, JointName]; // rest direction source on the avatar
  legs?: boolean;
}

const LIMB_SPECS: LimbSpec[] = [
  { bone: 'leftUpperArm', from: LM.leftShoulder, to: LM.leftElbow, joints: ['leftShoulder', 'leftElbow'] },
  { bone: 'leftLowerArm', from: LM.leftElbow, to: LM.leftWrist, joints: ['leftElbow', 'leftWrist'] },
  { bone: 'rightUpperArm', from: LM.rightShoulder, to: LM.rightElbow, joints: ['rightShoulder', 'rightElbow'] },
  { bone: 'rightLowerArm', from: LM.rightElbow, to: LM.rightWrist, joints: ['rightElbow', 'rightWrist'] },
  // legs gate on config.bodyMode AND per-bone visibility — at a desk the
  // knees/ankles never clear VIS_ON, so legs hold the relaxed idle.
  { bone: 'leftUpperLeg', from: LM.leftHip, to: LM.leftKnee, joints: ['leftHip', 'leftKnee'], legs: true },
  { bone: 'leftLowerLeg', from: LM.leftKnee, to: LM.leftAnkle, joints: ['leftKnee', 'leftAnkle'], legs: true },
  { bone: 'rightUpperLeg', from: LM.rightHip, to: LM.rightKnee, joints: ['rightHip', 'rightKnee'], legs: true },
  { bone: 'rightLowerLeg', from: LM.rightKnee, to: LM.rightAnkle, joints: ['rightKnee', 'rightAnkle'], legs: true },
];

interface BoneState {
  node: THREE.Object3D;
  restLocal: THREE.Quaternion;
  restWorld: THREE.Quaternion;
  restWorldInv: THREE.Quaternion;
  restDirParentLocal: THREE.Vector3 | null; // limbs only
  target: THREE.Quaternion;
  correction: THREE.Quaternion;
  visible: boolean; // hysteresis state
  confident: boolean; // drives decay vs track
}

// scratch
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ1 = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpE = new THREE.Euler();
const IDENTITY = new THREE.Quaternion();

const MAX_YAW = (65 * Math.PI) / 180;
const MAX_PITCH = (30 * Math.PI) / 180;
const MAX_LEAN = (45 * Math.PI) / 180;

export class Retargeter {
  private body = new BodyFrame();
  private states = new Map<BoneName, BoneState>();
  private avatar: Avatar;

  // root motion state
  private rootRest = new THREE.Vector3();
  private rootTarget = new THREE.Vector3();
  private baseHipX: number | null = null;
  private baseHipY: number | null = null;
  private baseShoulderW: number | null = null;
  private baseFrames = 0;

  constructor(avatar: Avatar) {
    this.avatar = avatar;
    this.bind(avatar);
  }

  /** Captures rest pose: local/world quats per bone; per-limb rest direction
   *  in parent-local space (from the avatar's joint anchors). */
  bind(avatar: Avatar): void {
    this.avatar = avatar;
    this.states.clear();
    avatar.object.updateWorldMatrix(true, true);
    this.rootRest.copy(avatar.object.position);
    this.baseHipX = this.baseHipY = this.baseShoulderW = null;
    this.baseFrames = 0;

    const allBones: BoneName[] = [
      'chest', 'neck', 'head',
      'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
      'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
    ];
    for (const name of allBones) {
      const node = this.avatar.bones[name];
      if (!node || !node.parent) continue;
      const restWorld = node.getWorldQuaternion(new THREE.Quaternion());
      const st: BoneState = {
        node,
        restLocal: node.quaternion.clone(),
        restWorld,
        restWorldInv: restWorld.clone().invert(),
        restDirParentLocal: null,
        target: node.quaternion.clone(),
        correction: new THREE.Quaternion(),
        visible: false,
        confident: false,
      };
      this.states.set(name, st);
    }

    for (const spec of LIMB_SPECS) {
      const st = this.states.get(spec.bone);
      const ja = this.avatar.joints[spec.joints[0]];
      const jb = this.avatar.joints[spec.joints[1]];
      if (!st || !ja || !jb) continue;
      ja.getWorldPosition(tmpV1);
      jb.getWorldPosition(tmpV2);
      const dWorld = tmpV2.sub(tmpV1).normalize();
      st.node.parent!.getWorldQuaternion(tmpQ1).invert();
      st.restDirParentLocal = dWorld.applyQuaternion(tmpQ1).clone();
    }
  }

  setCorrection(bone: BoneName, euler: { x: number; y: number; z: number }): void {
    const st = this.states.get(bone);
    if (st) st.correction.setFromEuler(new THREE.Euler(euler.x, euler.y, euler.z));
  }

  /** Per pose frame. Pass null when nothing was detected. */
  updateFromPose(world: LandmarkPoint[] | null, norm: LandmarkPoint[] | null): void {
    if (!world || !norm) {
      for (const st of this.states.values()) st.confident = false;
      return;
    }

    const bodyOk = this.body.update(world);
    if (bodyOk) {
      this.updateChest();
      this.updateHead(world);
      this.updateRootTarget(norm);
    }

    for (const spec of LIMB_SPECS) {
      const st = this.states.get(spec.bone);
      if (!st || !st.restDirParentLocal) continue;

      if (spec.legs && config.bodyMode !== 'full') {
        st.confident = false; // relaxed idle in upper-body mode
        continue;
      }

      const vis = Math.min(world[spec.from].visibility, world[spec.to].visibility);
      st.visible = st.visible ? vis > VIS_OFF : vis > VIS_ON;
      if (!st.visible || !bodyOk) {
        st.confident = false;
        continue;
      }
      st.confident = true;

      mpToThree(world[spec.from], tmpV1);
      mpToThree(world[spec.to], tmpV2);
      const dir = tmpV2.sub(tmpV1).normalize();

      if (!spec.legs) {
        // arms: person's limb direction → body frame, then body frame →
        // avatar world through the torso rotation the avatar is currently
        // enacting: qDelta = chestWorldNow ⊗ chestWorldRest⁻¹
        dir.applyQuaternion(this.body.quatInv);
        const chest = this.states.get('chest');
        if (chest) {
          chest.node.getWorldQuaternion(tmpQ1);
          dir.applyQuaternion(chest.restWorldInv).applyQuaternion(tmpQ1);
        }
      }
      // legs: raw mirrored camera space — the avatar's hips don't enact the
      // torso lean, so anchoring legs to the leaned body frame would splay
      // them sideways every time the person leans.

      // world → bone parent-local
      st.node.parent!.getWorldQuaternion(tmpQ1).invert();
      const dParentLocal = dir.applyQuaternion(tmpQ1);

      // swing from rest direction, on top of rest local, then correction
      tmpQ2.setFromUnitVectors(st.restDirParentLocal, dParentLocal);
      st.target.copy(tmpQ2).multiply(st.restLocal).multiply(st.correction);
    }
  }

  /** Chest enacts the person's torso orientation (clamped per axis). */
  private updateChest(): void {
    const st = this.states.get('chest');
    if (!st) return;
    st.confident = true;

    // per-axis clamp: a real side turn should read as a turn (yaw up to 65°)
    // without letting lean or pitch go owl — the old 55° total clamp ate
    // most of a genuine 90° turn.
    tmpE.setFromQuaternion(tmpQ1.copy(this.body.quat), 'YXZ');
    tmpE.y = THREE.MathUtils.clamp(tmpE.y, -MAX_YAW, MAX_YAW);
    tmpE.x = THREE.MathUtils.clamp(tmpE.x, -MAX_PITCH, MAX_PITCH);
    tmpE.z = THREE.MathUtils.clamp(tmpE.z, -MAX_LEAN, MAX_LEAN);
    tmpQ1.setFromEuler(tmpE);

    // desired world = qBody ⊗ restWorld → parent-local
    tmpQ2.copy(tmpQ1).multiply(st.restWorld);
    st.node.parent!.getWorldQuaternion(tmpQ1).invert();
    st.target.copy(tmpQ1).multiply(tmpQ2).multiply(st.correction);
  }

  /** Head: orientation built from ears + nose, expressed in the body frame,
   *  split 35% neck / 65% head. */
  private updateHead(world: LandmarkPoint[]): void {
    const neckSt = this.states.get('neck');
    const headSt = this.states.get('head');
    if (!headSt) return;

    const nose = world[LM.nose];
    const le = world[LM.leftEar];
    const re = world[LM.rightEar];
    const vis = Math.min(nose.visibility, Math.max(le.visibility, re.visibility));
    if (vis < VIS_ON) {
      headSt.confident = false;
      if (neckSt) neckSt.confident = false;
      return;
    }

    mpToThree(le, tmpV1);
    mpToThree(re, tmpV2);
    const earCenter = tmpV1.clone().add(tmpV2).multiplyScalar(0.5);
    const hx = tmpV1.sub(tmpV2).normalize(); // right ear → left ear ≈ +x
    mpToThree(nose, tmpV2);
    const hzRaw = tmpV2.sub(earCenter).normalize(); // facing direction
    const hy = new THREE.Vector3().crossVectors(hzRaw, hx).normalize();
    const hz = new THREE.Vector3().crossVectors(hx, hy).normalize();
    const hxo = new THREE.Vector3().crossVectors(hy, hz).normalize();
    tmpM.makeBasis(hxo, hy, hz);
    const qHeadWorld = new THREE.Quaternion().setFromRotationMatrix(tmpM);
    // head orientation relative to the body frame
    const qHb = this.body.quatInv.clone().multiply(qHeadWorld);

    // clamp to keep it owl-free
    const a = 2 * Math.acos(Math.min(1, Math.abs(qHb.w)));
    const maxA = (60 * Math.PI) / 180;
    if (a > maxA) qHb.slerp(IDENTITY, 1 - maxA / a);

    const qBody = this.body.quat;
    if (neckSt) {
      neckSt.confident = true;
      const qNeck = IDENTITY.clone().slerp(qHb, 0.35);
      tmpQ2.copy(qBody).multiply(qNeck).multiply(neckSt.restWorld);
      neckSt.node.parent!.getWorldQuaternion(tmpQ1).invert();
      neckSt.target.copy(tmpQ1).multiply(tmpQ2).multiply(neckSt.correction);
    }
    headSt.confident = true;
    tmpQ2.copy(qBody).multiply(qHb).multiply(headSt.restWorld);
    headSt.node.parent!.getWorldQuaternion(tmpQ1).invert();
    headSt.target.copy(tmpQ1).multiply(tmpQ2).multiply(headSt.correction);
  }

  /** Root motion targets from normalized (mirrored) hip center + shoulder
   *  width depth hint. Baselines auto-capture over the first second. */
  private updateRootTarget(norm: LandmarkPoint[]): void {
    const lh = norm[LM.leftHip];
    const rh = norm[LM.rightHip];
    const ls = norm[LM.leftShoulder];
    const rs = norm[LM.rightShoulder];
    if (Math.min(ls.visibility, rs.visibility) < VIS_ON) return;

    const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    const hipOk = Math.min(lh.visibility, rh.visibility) > VIS_ON;
    const hipX = hipOk ? (lh.x + rh.x) / 2 : (ls.x + rs.x) / 2;
    const hipY = hipOk ? (lh.y + rh.y) / 2 : (ls.y + rs.y) / 2;

    if (this.baseFrames < 45) {
      this.baseHipX = this.baseHipX === null ? hipX : this.baseHipX + (hipX - this.baseHipX) / (this.baseFrames + 1);
      this.baseHipY = this.baseHipY === null ? hipY : this.baseHipY + (hipY - this.baseHipY) / (this.baseFrames + 1);
      this.baseShoulderW =
        this.baseShoulderW === null
          ? shoulderW
          : this.baseShoulderW + (shoulderW - this.baseShoulderW) / (this.baseFrames + 1);
      this.baseFrames++;
    }
    if (!config.rootMotion || this.baseHipX === null) {
      this.rootTarget.set(0, 0, 0);
      return;
    }

    const dx = THREE.MathUtils.clamp((hipX - this.baseHipX) * 1.4, -0.5, 0.5);
    const dy = THREE.MathUtils.clamp((this.baseHipY! - hipY) * 0.6, -0.12, 0.12);
    const dz = THREE.MathUtils.clamp((shoulderW / this.baseShoulderW! - 1) * 1.2, -0.35, 0.35);
    this.rootTarget.set(dx, dy, dz);
  }

  /** Render tick: slerp bones toward targets; decay unconfident bones. */
  tick(dt: number): void {
    const k = 1 - Math.exp(-config.slerpRate * dt);
    const kDecay = 1 - Math.exp(-dt / config.relaxSec);
    for (const st of this.states.values()) {
      if (!st.confident) {
        st.target.slerp(st.restLocal, kDecay);
      }
      st.node.quaternion.slerp(st.target, k);
    }

    // root: heavily smoothed, never skates
    const kr = 1 - Math.exp(-6 * dt);
    tmpV1.copy(this.rootRest).add(this.rootTarget);
    this.avatar.object.position.lerp(tmpV1, kr);
  }
}
