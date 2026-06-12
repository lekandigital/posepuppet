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
  /** feet: rest direction is synthesized (ankle→toe ≈ forward-down), and
   *  the swing is clamped tighter than the global joint limit */
  foot?: boolean;
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
  // feet: ankle → toe direction, only meaningful when the framing shows feet
  { bone: 'leftFoot', from: LM.leftAnkle, to: LM.leftFootIndex, joints: ['leftAnkle', 'leftAnkle'], legs: true, foot: true },
  { bone: 'rightFoot', from: LM.rightAnkle, to: LM.rightFootIndex, joints: ['rightAnkle', 'rightAnkle'], legs: true, foot: true },
];

/** A standing humanoid's ankle→toe direction in world space (faces +z). */
const FOOT_REST_WORLD = new THREE.Vector3(0, -0.35, 0.94).normalize();
/** Feet articulate less than limbs before they read broken. */
const MAX_FOOT_SWING = (50 * Math.PI) / 180;

/** Hand/wrist spec: direction from wrist to hand center (avg of index+pinky). */
interface HandSpec {
  bone: BoneName;
  wrist: number;
  index: number;
  pinky: number;
}

const HAND_SPECS: HandSpec[] = [
  { bone: 'leftHand', wrist: LM.leftWrist, index: LM.leftIndex, pinky: LM.leftPinky },
  { bone: 'rightHand', wrist: LM.rightWrist, index: LM.rightIndex, pinky: LM.rightPinky },
];

/** Maximum wrist deviation from the forearm in radians (~80°). */
const MAX_WRIST_ANGLE = (80 * Math.PI) / 180;

/** Hand-openness estimation from pose landmarks (no hand model needed):
 *  fingertip reach relative to forearm length. Tuned on live footage —
 *  a fist pulls index/pinky toward the wrist, an open palm extends them. */
const OPEN_REACH_LO = 0.28; // reach/forearm at a closed fist
const OPEN_REACH_HI = 0.52; // reach/forearm fully open
const POINT_GAP = 0.14; // index extended this much beyond pinky = pointing

interface BoneState {
  node: THREE.Object3D;
  restLocal: THREE.Quaternion;
  restWorld: THREE.Quaternion;
  restWorldInv: THREE.Quaternion;
  restDirParentLocal: THREE.Vector3 | null; // limbs only
  target: THREE.Quaternion;
  correction: THREE.Quaternion;
  lastSwing: THREE.Quaternion | null; // limbs: last rest→target swing, for calibration
  visible: boolean; // hysteresis state
  confident: boolean; // drives decay vs track
  isHand?: boolean; // hand bones get extra smoothing
  idleRole?: 'chest' | 'head'; // bones that carry the idle-life micro sway
  // --- occlusion recovery (pose continuity, not fake tracking) ---
  wasConfident: boolean; // previous pose-frame confidence, for transitions
  velAxis: THREE.Vector3; // angular velocity axis of the target (local)
  velAngle: number; // rad/s — coasted with decay after tracking loss
  prevTarget: THREE.Quaternion | null; // for velocity estimation
  prevTargetMs: number;
  lostSec: number; // time since confidence was lost
  reacqSec: number; // time since confidence returned (≥ reacqDur = live)
  reacqDur: number; // blend length, scaled by how long tracking was lost
  reacqFrom: THREE.Quaternion; // pose held at the moment of re-acquisition
  liveTarget: THREE.Quaternion; // raw tracked target during the reacq blend
}

/** Re-acquisition blends the held pose back to live over this long. */
const REACQ_SEC = 0.5;
/** Velocity-coast decay time constant after losing tracking. */
const COAST_TAU = 0.25;
/** Joint limit: no bone target strays further than this from rest. */
const MAX_SWING_FROM_REST = (120 * Math.PI) / 180;

const CALIB_KEY = 'posepuppet-calib-v1';

interface CalibStore {
  bodyZeroInv: number[];
  corrections: Record<string, number[]>;
}

// scratch
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpQ1 = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpQ3 = new THREE.Quaternion(); // commitTarget scratch — callers pass tmpQ1/tmpQ2 as q
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
  /** torso rotation is enacted relative to this zero pose (calibration). */
  private bodyZeroInv = new THREE.Quaternion();

  // squash-and-stretch state (expressiveness)
  private scaleBase = new THREE.Vector3(1, 1, 1);
  private squash = 0;

  // face-touch: per-avatar geometry captured at bind + per-side engagement
  private armLen = { left: { upper: 0.26, fore: 0.24 }, right: { upper: 0.26, fore: 0.24 } };
  private headRadius = 0.12;
  private faceTouch = { left: 0, right: 0 }; // smoothed engagement weight
  /** debug/eval: last avatar-space wrist→head distance per side (m), -1 = n/a */
  readonly faceTouchDebug = { left: { w: 0, dist: -1, headR: 0.12 }, right: { w: 0, dist: -1, headR: 0.12 } };
  // idle-life clock (micro weight shifts while tracking is lost)
  private idleT = 0;

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
    this.scaleBase.copy(avatar.object.scale);
    this.squash = 0;
    this.baseHipX = this.baseHipY = this.baseShoulderW = null;
    this.baseFrames = 0;

    const allBones: BoneName[] = [
      'chest', 'neck', 'head',
      'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
      'leftFoot', 'rightFoot',
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
        lastSwing: null,
        visible: false,
        confident: false,
        isHand: name === 'leftHand' || name === 'rightHand',
        idleRole: name === 'chest' ? 'chest' : name === 'head' ? 'head' : undefined,
        wasConfident: false,
        velAxis: new THREE.Vector3(1, 0, 0),
        velAngle: 0,
        prevTarget: null,
        prevTargetMs: 0,
        lostSec: 0,
        reacqSec: REACQ_SEC,
        reacqDur: REACQ_SEC,
        reacqFrom: node.quaternion.clone(),
        liveTarget: node.quaternion.clone(),
      };
      this.states.set(name, st);
    }
    this.loadCalibration();

    for (const spec of LIMB_SPECS) {
      const st = this.states.get(spec.bone);
      if (!st) continue;
      if (spec.foot) {
        // no toe anchor exists on the rigs; synthesize the standing rest
        st.node.parent!.getWorldQuaternion(tmpQ1).invert();
        st.restDirParentLocal = FOOT_REST_WORLD.clone().applyQuaternion(tmpQ1);
        continue;
      }
      const ja = this.avatar.joints[spec.joints[0]];
      const jb = this.avatar.joints[spec.joints[1]];
      if (!ja || !jb) continue;
      ja.getWorldPosition(tmpV1);
      jb.getWorldPosition(tmpV2);
      const dWorld = tmpV2.sub(tmpV1).normalize();
      st.node.parent!.getWorldQuaternion(tmpQ1).invert();
      st.restDirParentLocal = dWorld.applyQuaternion(tmpQ1).clone();
    }

    // face-touch geometry: arm segment lengths (per-avatar reach
    // normalization) and a head-contact radius from the head subtree bbox
    for (const side of ['left', 'right'] as const) {
      const sh = this.avatar.joints[`${side}Shoulder` as JointName];
      const el = this.avatar.joints[`${side}Elbow` as JointName];
      const wr = this.avatar.joints[`${side}Wrist` as JointName];
      if (sh && el && wr) {
        sh.getWorldPosition(tmpV1);
        el.getWorldPosition(tmpV2);
        wr.getWorldPosition(tmpV3);
        this.armLen[side] = {
          upper: Math.max(0.05, tmpV1.distanceTo(tmpV2)),
          fore: Math.max(0.05, tmpV2.distanceTo(tmpV3)),
        };
      }
    }
    const headNode = this.avatar.bones.head;
    if (this.avatar.headGeometry) {
      // real geometry (robot: authored; VRM: skinned-vertex estimate)
      this.headRadius = this.avatar.headGeometry.radius;
    } else if (headNode) {
      const box = new THREE.Box3().setFromObject(headNode);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        this.headRadius = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.5, 0.08, 0.3);
      }
    }
    this.faceTouchDebug.left.headR = this.headRadius;
    this.faceTouchDebug.right.headR = this.headRadius;

    // Hand bones: rest direction from the bone's position relative to its
    // parent. In T-pose, the hand continues along the forearm axis, so
    // node.position (forearm → hand offset) gives the correct rest direction.
    for (const spec of HAND_SPECS) {
      const st = this.states.get(spec.bone);
      if (!st) continue;
      const pos = st.node.position.clone();
      if (pos.lengthSq() > 0.0001) {
        st.restDirParentLocal = pos.normalize();
      }
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
      this.updateHands(world);
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
      (st.lastSwing ??= new THREE.Quaternion()).copy(tmpQ2);
      this.exaggerateSwing(tmpQ2, st.velAngle);
      if (spec.foot) {
        const fa = 2 * Math.acos(Math.min(1, Math.abs(tmpQ2.w)));
        if (fa > MAX_FOOT_SWING) tmpQ2.slerp(IDENTITY, 1 - MAX_FOOT_SWING / fa);
      }
      this.commitTarget(st, tmpQ2.multiply(st.restLocal).multiply(st.correction));
    }

    if (bodyOk) this.updateFaceTouch(world);

    // confidence transitions for occlusion recovery: a regained bone blends
    // from where it was held back to live over REACQ_SEC — never snaps
    for (const st of this.states.values()) {
      if (st.confident && !st.wasConfident) {
        st.reacqSec = 0;
        // a 50 ms flicker recovers almost instantly; a real occlusion
        // blends back over the full window — lag is only paid when the
        // pose could actually have drifted
        st.reacqDur = THREE.MathUtils.clamp(st.lostSec * 0.8, 0.08, REACQ_SEC);
        st.reacqFrom.copy(st.target);
      } else if (!st.confident && st.wasConfident) {
        st.lostSec = 0;
      }
      st.wasConfident = st.confident;
    }
  }

  /** Smoothed mean angular velocity of confident bones (rad/s) — the
   *  motion-energy signal behind exaggeration overshoot and velocity VFX. */
  motionEnergy(): number {
    return this.energy;
  }
  private energy = 0;

  /** Exaggeration: scale a swing's angle by config.exaggeration, plus a
   *  speed-coupled boost so fast moves overshoot — the cartoon read. The
   *  existing wrist/joint/chest clamps still bound everything downstream. */
  private exaggerateSwing(q: THREE.Quaternion, velAngle: number): void {
    const ex = config.exaggeration;
    if (ex <= 1.001) return;
    const w = THREE.MathUtils.clamp(q.w, -1, 1);
    const ang = 2 * Math.acos(Math.abs(w));
    const s = Math.sqrt(Math.max(1 - w * w, 0));
    if (s < 1e-4 || ang < 1e-4) return;
    // dead zone: never scale small swings — multiplying rest noise made
    // 2.0 read "fidgety" at the Gate-3 live test
    const DEAD = 0.14; // ~8°
    if (ang <= DEAD) return;
    const overshoot = (ex - 1) * Math.min(1, velAngle / 6) * 0.18;
    const scale = Math.min(ex + overshoot, 2.2);
    // soft knee: full scaling up to ~55°, fading to none by ~110° — big
    // gestures already fill the pose space; doubling them folded arms
    // through the body live
    const KNEE_LO = 0.96; // ~55°
    const KNEE_HI = 1.92; // ~110°
    const knee = ang < KNEE_LO ? 1 : ang > KNEE_HI ? 0 : 1 - (ang - KNEE_LO) / (KNEE_HI - KNEE_LO);
    const effScale = 1 + (scale - 1) * knee;
    const newAng = Math.min(DEAD + (ang - DEAD) * effScale, MAX_SWING_FROM_REST);
    tmpV3.set(q.x / s, q.y / s, q.z / s);
    if (w < 0) tmpV3.negate();
    q.setFromAxisAngle(tmpV3, newAng);
  }

  /** Write a freshly tracked target through the recovery layer: estimates
   *  the target's angular velocity (used to coast through dropouts) and
   *  stores it as the live target the tick blends toward. */
  private commitTarget(st: BoneState, q: THREE.Quaternion): void {
    const now = performance.now();
    if (st.prevTarget) {
      const dtp = Math.max((now - st.prevTargetMs) / 1000, 1e-3);
      // dq = q ⊗ prev⁻¹ — the rotation that advanced the target this frame
      tmpQ3.copy(st.prevTarget).invert().premultiply(q);
      const w = THREE.MathUtils.clamp(tmpQ3.w, -1, 1);
      const ang = 2 * Math.acos(Math.abs(w));
      const s = Math.sqrt(Math.max(1 - w * w, 0));
      if (s > 1e-4 && ang > 1e-4) {
        st.velAxis.set(tmpQ3.x / s, tmpQ3.y / s, tmpQ3.z / s);
        if (w < 0) st.velAxis.negate(); // shortest-arc axis
        st.velAngle = ang / dtp;
      } else {
        st.velAngle = 0;
      }
    }
    (st.prevTarget ??= new THREE.Quaternion()).copy(q);
    st.prevTargetMs = now;
    st.liveTarget.copy(q);
  }

  /** Neutral-pose calibration: the pose held right now becomes "rest".
   *  Torso gets a zero-reference; each tracking limb gets a correction that
   *  maps its captured swing back to the avatar's rest. Persisted. */
  calibrate(): void {
    if (this.body.valid) this.bodyZeroInv.copy(this.body.quat).invert();
    for (const st of this.states.values()) {
      if (!st.lastSwing || !st.confident) continue;
      // C = R⁻¹ · S₀⁻¹ · R  ⇒  swing S₀ composes to exactly restLocal
      tmpQ1.copy(st.lastSwing).invert();
      st.correction.copy(st.restLocal).invert().multiply(tmpQ1).multiply(st.restLocal);
    }
    this.persistCalibration();
  }

  clearCalibration(): void {
    this.bodyZeroInv.identity();
    for (const st of this.states.values()) st.correction.identity();
    try {
      localStorage.removeItem(CALIB_KEY);
    } catch {
      /* node / private mode */
    }
  }

  getCorrectionEuler(bone: BoneName): { x: number; y: number; z: number } {
    const st = this.states.get(bone);
    if (!st) return { x: 0, y: 0, z: 0 };
    tmpE.setFromQuaternion(st.correction, 'XYZ');
    return { x: tmpE.x, y: tmpE.y, z: tmpE.z };
  }

  setCorrectionEuler(bone: BoneName, e: { x: number; y: number; z: number }): void {
    this.setCorrection(bone, e);
    this.persistCalibration();
  }

  private persistCalibration(): void {
    const store: CalibStore = { bodyZeroInv: this.bodyZeroInv.toArray(), corrections: {} };
    for (const [name, st] of this.states) store.corrections[name] = st.correction.toArray();
    try {
      localStorage.setItem(CALIB_KEY, JSON.stringify(store));
    } catch {
      /* node / private mode */
    }
  }

  private loadCalibration(): void {
    try {
      const raw = localStorage.getItem(CALIB_KEY);
      if (!raw) return;
      const store = JSON.parse(raw) as CalibStore;
      if (store.bodyZeroInv?.length === 4) this.bodyZeroInv.fromArray(store.bodyZeroInv);
      for (const [name, arr] of Object.entries(store.corrections ?? {})) {
        const st = this.states.get(name as BoneName);
        if (st && arr.length === 4) st.correction.fromArray(arr);
      }
    } catch {
      /* node / corrupt JSON → defaults */
    }
  }

  /** Chest enacts the person's torso orientation (clamped per axis). */
  private updateChest(): void {
    const st = this.states.get('chest');
    if (!st) return;
    st.confident = true;

    // per-axis clamp: a real side turn should read as a turn (yaw up to 65°)
    // without letting lean or pitch go owl — the old 55° total clamp ate
    // most of a genuine 90° turn. Rotation is relative to the calibrated zero.
    tmpE.setFromQuaternion(tmpQ1.copy(this.bodyZeroInv).multiply(this.body.quat), 'YXZ');
    // torso takes exaggeration at half strength (full-rate reads owl-ish);
    // the per-axis clamps below still bound the result
    const chestEx = 1 + (config.exaggeration - 1) * 0.5;
    if (chestEx > 1.001) {
      // yaw + lean only: scaling pitch turned hands-overhead detection
      // noise into a phantom lean-back at the Gate-3 live test
      tmpE.y *= chestEx;
      tmpE.z *= chestEx;
    }
    tmpE.y = THREE.MathUtils.clamp(tmpE.y, -MAX_YAW, MAX_YAW);
    tmpE.x = THREE.MathUtils.clamp(tmpE.x, -MAX_PITCH, MAX_PITCH);
    tmpE.z = THREE.MathUtils.clamp(tmpE.z, -MAX_LEAN, MAX_LEAN);
    tmpQ1.setFromEuler(tmpE);

    // desired world = qBody ⊗ restWorld → parent-local
    tmpQ2.copy(tmpQ1).multiply(st.restWorld);
    st.node.parent!.getWorldQuaternion(tmpQ1).invert();
    this.commitTarget(st, tmpQ1.multiply(tmpQ2).multiply(st.correction));
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
      this.commitTarget(neckSt, tmpQ1.multiply(tmpQ2).multiply(neckSt.correction));
    }
    headSt.confident = true;
    tmpQ2.copy(qBody).multiply(qHb).multiply(headSt.restWorld);
    headSt.node.parent!.getWorldQuaternion(tmpQ1).invert();
    this.commitTarget(headSt, tmpQ1.multiply(tmpQ2).multiply(headSt.correction));
  }

  /** Hand/wrist direction from wrist → hand center (avg of index + pinky).
   *  Uses the same direction-swing approach as limbs: compute a direction
   *  vector, transform through body frame → parent-local, swing from rest.
   *  This avoids the rotation-space confusion of full 3-DOF orientation. */
  /** Smoothed per-side openness (0 fist … 1 open) and pointing flag. */
  readonly handStates = {
    left: { openness: 1, point: false },
    right: { openness: 1, point: false },
  };

  private updateHands(world: LandmarkPoint[]): void {
    for (const spec of HAND_SPECS) {
      const st = this.states.get(spec.bone);
      if (!st || !st.restDirParentLocal) continue;
      const side: 'left' | 'right' = spec.bone === 'leftHand' ? 'left' : 'right';

      // Visibility gate: need wrist + at least one of index/pinky
      const vis = Math.min(
        world[spec.wrist].visibility,
        Math.max(world[spec.index].visibility, world[spec.pinky].visibility),
      );
      st.visible = st.visible ? vis > VIS_OFF : vis > VIS_ON;
      if (!st.visible) {
        st.confident = false;
        continue;
      }

      // Hand direction: wrist → midpoint(index, pinky)
      mpToThree(world[spec.wrist], tmpV1);
      mpToThree(world[spec.index], tmpV2);
      mpToThree(world[spec.pinky], tmpV3);
      // hand center = average of index and pinky positions
      tmpV2.add(tmpV3).multiplyScalar(0.5);
      // direction = hand center − wrist
      const dir = tmpV2.sub(tmpV1);
      if (dir.lengthSq() < 0.0001) { st.confident = false; continue; }
      dir.normalize();

      // Same body-frame → chest transform as arm limbs
      dir.applyQuaternion(this.body.quatInv);
      const chest = this.states.get('chest');
      if (chest) {
        chest.node.getWorldQuaternion(tmpQ1);
        dir.applyQuaternion(chest.restWorldInv).applyQuaternion(tmpQ1);
      }

      // World → parent-local
      st.node.parent!.getWorldQuaternion(tmpQ1).invert();
      const dParentLocal = dir.applyQuaternion(tmpQ1);

      // Swing from rest direction to target (same as limbs)
      tmpQ2.setFromUnitVectors(st.restDirParentLocal, dParentLocal);

      // Apply wrist gain: amplify the swing
      if (config.wristGain !== 1.0) {
        const amplified = IDENTITY.clone().slerp(tmpQ2, config.wristGain);
        tmpQ2.copy(amplified);
      }

      // Clamp extreme wrist deviation
      const angle = 2 * Math.acos(Math.min(1, Math.abs(tmpQ2.w)));
      if (angle > MAX_WRIST_ANGLE) {
        tmpQ2.slerp(IDENTITY, 1 - MAX_WRIST_ANGLE / angle);
      }

      (st.lastSwing ??= new THREE.Quaternion()).copy(tmpQ2);
      this.exaggerateSwing(tmpQ2, st.velAngle);
      // re-clamp after exaggeration — the wrist limit always wins
      const exAngle = 2 * Math.acos(Math.min(1, Math.abs(tmpQ2.w)));
      if (exAngle > MAX_WRIST_ANGLE) tmpQ2.slerp(IDENTITY, 1 - MAX_WRIST_ANGLE / exAngle);
      this.commitTarget(st, tmpQ2.multiply(st.restLocal).multiply(st.correction));
      st.confident = true;

      // open/fist/point approximation: fingertip reach vs forearm length
      const elbowIdx = side === 'left' ? LM.leftElbow : LM.rightElbow;
      mpToThree(world[elbowIdx], tmpV3);
      mpToThree(world[spec.wrist], tmpV1);
      const forearm = tmpV3.distanceTo(tmpV1);
      if (forearm > 1e-3) {
        mpToThree(world[spec.index], tmpV2);
        const dIndex = tmpV2.distanceTo(tmpV1);
        mpToThree(world[spec.pinky], tmpV3);
        const dPinky = tmpV3.distanceTo(tmpV1);
        const reach = (dIndex + dPinky) / 2 / forearm;
        const raw = THREE.MathUtils.clamp((reach - OPEN_REACH_LO) / (OPEN_REACH_HI - OPEN_REACH_LO), 0, 1);
        const hs = this.handStates[side];
        hs.openness += (raw - hs.openness) * 0.25; // EMA — no flicker
        hs.point = (dIndex - dPinky) / forearm > POINT_GAP && hs.openness < 0.75;
        this.avatar.applyHandState?.(side, hs.openness, hs.point);
      }
    }
  }

  /** Face-touch: when the person's wrist comes near their head, magnetize
   *  the avatar's same arm onto its OWN head surface via a two-bone IK
   *  blend. Engagement eases in/out with proximity (smoothstep), the IK
   *  target sits just outside the head-collider radius (hand can never
   *  pass through the skull), and reach uses this avatar's arm lengths —
   *  per-avatar normalization, no per-avatar calibration. */
  private updateFaceTouch(world: LandmarkPoint[]): void {
    const le = world[LM.leftEar];
    const re = world[LM.rightEar];
    if (Math.max(le.visibility, re.visibility) < VIS_ON) {
      this.faceTouch.left *= 0.9;
      this.faceTouch.right *= 0.9;
      return;
    }
    mpToThree(le, tmpV1);
    mpToThree(re, tmpV2);
    const headP = tmpV1.add(tmpV2).multiplyScalar(0.5).clone(); // person head center
    const sw = Math.max(this.body.shoulderWidth, 0.2);

    for (const side of ['left', 'right'] as const) {
      const wristIdx = side === 'left' ? LM.leftWrist : LM.rightWrist;
      const upperSt = this.states.get(`${side}UpperArm` as BoneName);
      const foreSt = this.states.get(`${side}LowerArm` as BoneName);
      const dbg = this.faceTouchDebug[side];
      if (!upperSt || !foreSt || !upperSt.restDirParentLocal || !foreSt.restDirParentLocal) continue;

      // person-side engagement from wrist↔head proximity (shoulder-width units)
      const wl = world[wristIdx];
      let w = 0;
      if (wl.visibility > VIS_OFF && upperSt.confident && foreSt.confident) {
        mpToThree(wl, tmpV1);
        const n = tmpV1.distanceTo(headP) / sw;
        // engage from 1.15 shoulder-widths (near-face gestures, mouth
        // cover with the hand forward of the face) to full at 0.6
        const t = THREE.MathUtils.clamp((1.15 - n) / (1.15 - 0.6), 0, 1);
        w = t * t * (3 - 2 * t);
      }
      const ft = this.faceTouch;
      ft[side] += (w - ft[side]) * 0.3; // contact easing
      dbg.w = ft[side];
      dbg.dist = -1;
      if (ft[side] < 0.02) continue;

      // avatar-side IK target: head surface point in the direction the
      // person's wrist sits relative to their head (mirrored space ≈ stage)
      const headNode = this.avatar.bones.head;
      const shoulderJ = this.avatar.joints[`${side}Shoulder` as JointName];
      if (!headNode || !shoulderJ) continue;
      mpToThree(world[wristIdx], tmpV1);
      const dirOff = tmpV1.sub(headP);
      if (dirOff.lengthSq() < 1e-6) dirOff.set(side === 'left' ? 1 : -1, 0, 0.3);
      dirOff.normalize();
      // bias the contact onto the PERSON'S front hemisphere (their face
      // normal from ears→nose) — forcing camera-z here put the contact on
      // the wrong side whenever the body was turned (Gate-3 live finding)
      const nose = world[LM.nose];
      if (nose.visibility > VIS_OFF) {
        mpToThree(nose, tmpV2);
        tmpV2.sub(headP).normalize(); // person's face normal (mirrored space)
        const d = dirOff.dot(tmpV2);
        if (d < 0.2) dirOff.addScaledVector(tmpV2, 0.2 - d).normalize();
      } else {
        dirOff.z = Math.abs(dirOff.z) * 0.6 + 0.25;
        dirOff.normalize();
      }

      const headGeo = this.avatar.headGeometry;
      headNode.getWorldPosition(tmpV2);
      if (headGeo) headNode.localToWorld(tmpV2.copy(headGeo.centerLocal));
      const target = tmpV2.clone().addScaledVector(dirOff, this.headRadius * 1.18);
      const S = shoulderJ.getWorldPosition(new THREE.Vector3());

      // two-bone IK (law of cosines), pole pushes the elbow down-and-out
      const L1 = this.armLen[side].upper;
      const L2 = this.armLen[side].fore;
      const toT = target.clone().sub(S);
      let d = toT.length();
      const maxD = (L1 + L2) * 0.98;
      if (d > maxD) {
        toT.multiplyScalar(maxD / d);
        d = maxD;
        target.copy(S).add(toT);
      }
      const dirST = toT.clone().normalize();
      const cosA = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const alpha = Math.acos(cosA);
      const pole = new THREE.Vector3(side === 'left' ? 0.7 : -0.7, -1, 0.25).normalize();
      const axis = new THREE.Vector3().crossVectors(dirST, pole);
      if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
      axis.normalize();
      const dirUpper = dirST.clone().applyQuaternion(tmpQ1.setFromAxisAngle(axis, alpha));
      const elbow = S.clone().addScaledVector(dirUpper, L1);
      const dirFore = target.clone().sub(elbow).normalize();

      // convert world directions → parent-local swings (same math as FK),
      // then magnetize: blend the committed FK target toward the IK pose.
      // The forearm converts against the PREDICTED upper-arm orientation
      // (its blended target), not the currently enacted one — with large
      // IK corrections the stale frame makes the hand land short
      const upperParentQ = upperSt.node.parent!.getWorldQuaternion(new THREE.Quaternion());
      this.blendDirIntoTarget(upperSt, dirUpper, ft[side], upperParentQ);
      const forePredParentQ = upperParentQ.multiply(upperSt.liveTarget); // upper node IS the forearm's parent
      this.blendDirIntoTarget(foreSt, dirFore, ft[side], forePredParentQ);

      // eval/debug: where would the avatar wrist land relative to its head
      // center (tmpV2 still holds it)
      dbg.dist = elbow.addScaledVector(dirFore, L2).distanceTo(tmpV2);
    }
  }

  /** Swing st toward pointing its limb axis along dirWorld, blended by w.
   *  parentWorldQ overrides the parent frame (pass a predicted orientation
   *  when the parent itself is being IK-driven this frame). */
  private blendDirIntoTarget(
    st: BoneState,
    dirWorld: THREE.Vector3,
    w: number,
    parentWorldQ?: THREE.Quaternion,
  ): void {
    if (!st.restDirParentLocal) return;
    if (parentWorldQ) tmpQ1.copy(parentWorldQ).invert();
    else st.node.parent!.getWorldQuaternion(tmpQ1).invert();
    tmpV3.copy(dirWorld).applyQuaternion(tmpQ1);
    tmpQ2.setFromUnitVectors(st.restDirParentLocal, tmpV3);
    tmpQ3.copy(tmpQ2).multiply(st.restLocal).multiply(st.correction);
    st.liveTarget.slerp(tmpQ3, w);
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

  /** Number of bones currently tracking (confident); for the signal chain. */
  activeBoneCount(): number {
    let n = 0;
    for (const st of this.states.values()) if (st.confident) n++;
    return n;
  }

  /** Render tick: slerp bones toward targets; decay unconfident bones.
   *  Hand bones use slightly slower slerp for a natural wrist lag. */
  tick(dt: number): void {
    this.idleT += dt;
    const k = 1 - Math.exp(-config.slerpRate * dt);
    const kHand = 1 - Math.exp(-config.slerpRate * 0.7 * dt); // wrist lag
    const kDecay = 1 - Math.exp(-dt / config.relaxSec);
    for (const st of this.states.values()) {
      if (st.confident) {
        // re-acquisition: ease from the held pose back onto the live
        // target over REACQ_SEC (smoothstep) — re-entry never snaps
        if (st.reacqSec < st.reacqDur) {
          st.reacqSec += dt;
          const t = Math.min(st.reacqSec / st.reacqDur, 1);
          const w = t * t * (3 - 2 * t);
          st.target.copy(st.reacqFrom).slerp(st.liveTarget, w);
        } else {
          st.target.copy(st.liveTarget);
        }
      } else {
        // occlusion: coast on decaying angular velocity, then relax to rest
        st.lostSec += dt;
        const coast = st.velAngle * Math.exp(-st.lostSec / COAST_TAU);
        if (coast > 1e-3) {
          tmpQ1.setFromAxisAngle(st.velAxis, coast * dt);
          st.target.premultiply(tmpQ1);
        }
        st.target.slerp(st.restLocal, kDecay);

        // idle life: once settled (>1.5 s lost), chest and head pick up a
        // slow micro sway so the figure never reads as frozen
        const idleIn = Math.min(1, Math.max(0, (st.lostSec - 1.5) / 2));
        if (idleIn > 0 && st.idleRole) {
          if (st.idleRole === 'chest') {
            tmpE.set(0, Math.sin(this.idleT * 0.27) * 0.026 * idleIn, Math.sin(this.idleT * 0.4) * 0.021 * idleIn);
          } else {
            tmpE.set(Math.sin(this.idleT * 0.19) * 0.017 * idleIn, Math.sin(this.idleT * 0.31) * 0.035 * idleIn, 0);
          }
          st.target.multiply(tmpQ1.setFromEuler(tmpE));
        }
      }

      // joint limit: never coast/track past a sane swing from rest
      tmpQ1.copy(st.restLocal).invert().multiply(st.target);
      const dev = 2 * Math.acos(Math.min(1, Math.abs(tmpQ1.w)));
      if (dev > MAX_SWING_FROM_REST) {
        st.target.slerp(st.restLocal, 1 - MAX_SWING_FROM_REST / dev);
      }

      // during the re-acquisition blend the node also slerps at half rate —
      // the detector's own re-convergence wobble was reading as fidget live
      const settling = st.confident && st.reacqSec < st.reacqDur;
      const kEff = st.isHand ? kHand : settling ? k * 0.5 : k;
      st.node.quaternion.slerp(st.target, kEff);

      // …and on the enacted bone: the slerp path between two in-limit
      // targets can bulge past the limit on the rotation sphere
      tmpQ1.copy(st.restLocal).invert().multiply(st.node.quaternion);
      const ndev = 2 * Math.acos(Math.min(1, Math.abs(tmpQ1.w)));
      if (ndev > MAX_SWING_FROM_REST) {
        st.node.quaternion.slerp(st.restLocal, 1 - MAX_SWING_FROM_REST / ndev);
      }
    }

    // root: heavily smoothed, never skates
    const kr = 1 - Math.exp(-6 * dt);
    tmpV1.copy(this.rootRest).add(this.rootTarget);
    this.avatar.object.position.lerp(tmpV1, kr);

    // motion energy: smoothed mean angular velocity of tracking bones —
    // feeds the exaggeration overshoot, squash, and (later) velocity VFX
    let sum = 0;
    let cnt = 0;
    for (const st of this.states.values()) {
      if (st.confident) {
        sum += st.velAngle;
        cnt++;
      }
    }
    const kE = 1 - Math.exp(-dt / 0.15);
    this.energy += ((cnt ? sum / cnt : 0) - this.energy) * kE;

    // squash-and-stretch hint: fast motion at exaggeration > 1 compresses
    // the figure a few percent (and widens it half that) — clamped so it
    // can never break a rig, and zero-cost when exaggeration is 1
    const exNow = config.exaggeration;
    const sTarget = exNow > 1.001 ? Math.min(0.05, this.energy * (exNow - 1) * 0.012) : 0;
    this.squash += (sTarget - this.squash) * (1 - Math.exp(-dt / 0.1));
    if (this.squash > 0.0005) {
      this.avatar.object.scale.set(
        this.scaleBase.x * (1 + this.squash * 0.5),
        this.scaleBase.y * (1 - this.squash),
        this.scaleBase.z * (1 + this.squash * 0.5),
      );
    } else if (this.avatar.object.scale.y !== this.scaleBase.y) {
      this.avatar.object.scale.copy(this.scaleBase);
    }
  }
}
