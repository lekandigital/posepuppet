// Boot + the imperative capture → detect → retarget → render pipeline.
// No framework in the hot path; UI chrome is plain DOM.

import { startCamera, startVideoFile, watchLayout, layoutOverlay, setMirrored } from './camera';
import * as THREE from 'three';
import { createStage } from './stage/scene';
import { createHud } from './ui/hud';
import { createPanel } from './ui/panel';
import { config, onConfigChange, setConfig } from './config';
import { createDetector, type ModelVariant } from './pose/detector';
import { drawSkeleton } from './overlay/skeleton';
import { mirrorNorm, mirrorWorld } from './pose/mirror';
import { LandmarkSmoother } from './pose/smoothing';
import type { LandmarkPoint, PoseFrame } from './pose/types';
import { createRobot } from './rig/robot';
import { Retargeter } from './rig/retarget';
import type { Avatar } from './rig/types';
import { type AvatarId, isAvatarId, getAvatarDef, nextAvatarId, loadAvatarById } from './rig/avatarRegistry';
import { getGeneratedAvatarDef } from './rig/generatedAvatarRegistry';
import { EvalCollector } from './eval/runner';
import { createRecorder, createRecordButton, updateRecordButton } from './record/recorder';

declare global {
  interface Window {
    __PP: {
      videoReady: boolean;
      cameraError: string | null;
      renderFps: () => number;
      poseFps: () => number;
      lastDetectionAt: number;
      detectionCount: number;
      lastRecording: { size: number; type: string } | null;
      /** Set by generated-avatar / smoke-mode loading. */
      avatarStatus?: 'loading' | 'loaded' | 'fallback' | 'error';
      avatarWarning?: string;
      avatarNormalization?: Record<string, unknown>;
      avatarDiagnostics?: () => Record<string, unknown>;
      frameAvatar?: () => Record<string, unknown>;
      applyVisualPose?: (poseName: string) => Record<string, unknown>;
      resetVisualPose?: () => Record<string, unknown>;
    };
  }
}

type VisualPoseName =
  | 'neutral'
  | 'arms_forward'
  | 'arms_out'
  | 'arms_up'
  | 'elbow_bend_left'
  | 'elbow_bend_right'
  | 'finger_curl_left_if_fingers_exist'
  | 'finger_curl_right_if_fingers_exist'
  | 'flying_arms_out'
  | 'foot_lift_left'
  | 'foot_lift_right'
  | 'foot_rotate_left'
  | 'foot_rotate_right'
  | 'hand_to_cheek_proxy'
  | 'hand_to_mouth_proxy'
  | 'lean_left'
  | 'lean_right'
  | 'palm_forward'
  | 'rowing_stroke_pull'
  | 'rowing_stroke_start'
  | 'torso_turn_left'
  | 'torso_turn_right'
  | 'walking_stride_proxy'
  | 'wrist_rotate_left'
  | 'wrist_rotate_right';

const VISUAL_POSES: VisualPoseName[] = [
  'neutral',
  'arms_forward',
  'arms_out',
  'arms_up',
  'elbow_bend_left',
  'elbow_bend_right',
  'finger_curl_left_if_fingers_exist',
  'finger_curl_right_if_fingers_exist',
  'flying_arms_out',
  'foot_lift_left',
  'foot_lift_right',
  'foot_rotate_left',
  'foot_rotate_right',
  'hand_to_cheek_proxy',
  'hand_to_mouth_proxy',
  'lean_left',
  'lean_right',
  'palm_forward',
  'rowing_stroke_pull',
  'rowing_stroke_start',
  'torso_turn_left',
  'torso_turn_right',
  'walking_stride_proxy',
  'wrist_rotate_left',
  'wrist_rotate_right',
];

type RuntimeSkinnedMesh = THREE.SkinnedMesh & {
  boneTransform?: (index: number, target: THREE.Vector3) => THREE.Vector3;
};

function avatarBounds(object: THREE.Object3D): {
  empty: boolean;
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  maxDimension: number;
} {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position;
    if (!position) return;

    const skinned = mesh as RuntimeSkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton && typeof skinned.boneTransform === 'function') {
      skinned.skeleton.update();
      const stride = Math.max(1, Math.floor(position.count / 6000));
      for (let index = 0; index < position.count; index += stride) {
        point.fromBufferAttribute(position, index);
        skinned.boneTransform(index, point);
        skinned.localToWorld(point);
        box.expandByPoint(point);
      }
      if (stride > 1 && position.count > 0) {
        point.fromBufferAttribute(position, position.count - 1);
        skinned.boneTransform(position.count - 1, point);
        skinned.localToWorld(point);
        box.expandByPoint(point);
      }
      return;
    }

    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const meshBox = geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    box.union(meshBox);
  });
  if (box.isEmpty()) {
    return {
      empty: true,
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      size: [0, 0, 0],
      maxDimension: 0,
    };
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    empty: false,
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    center: [center.x, center.y, center.z],
    size: [size.x, size.y, size.z],
    maxDimension: Math.max(size.x, size.y, size.z),
  };
}

function countAvatarScene(object: THREE.Object3D): Record<string, unknown> {
  let meshCount = 0;
  let visibleMeshCount = 0;
  let skinnedMeshCount = 0;
  let materialCount = 0;
  let vertexCount = 0;
  const meshNames: string[] = [];
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount++;
    if (mesh.visible) visibleMeshCount++;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount++;
    if (mesh.name) meshNames.push(mesh.name);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materialCount += materials.filter(Boolean).length;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    vertexCount += geometry?.attributes.position?.count ?? 0;
  });
  return { meshCount, visibleMeshCount, skinnedMeshCount, materialCount, vertexCount, meshNames: meshNames.slice(0, 80) };
}

function normalizeGeneratedAvatar(
  object: THREE.Object3D,
  profile: { targetSize?: number; rootRotation?: [number, number, number]; rootPosition?: [number, number, number] } = {},
): Record<string, unknown> {
  const before = avatarBounds(object);
  if (profile.rootRotation) object.rotation.set(...profile.rootRotation);
  object.updateWorldMatrix(true, true);
  const rotated = avatarBounds(object);
  const targetSize = profile.targetSize ?? 1.8;
  const scale = rotated.maxDimension > 0 ? targetSize / rotated.maxDimension : 1;
  if (Number.isFinite(scale) && scale > 0) {
    object.scale.multiplyScalar(scale);
  }
  object.updateWorldMatrix(true, true);
  const scaled = avatarBounds(object);
  const center = new THREE.Vector3(...scaled.center);
  const minY = scaled.min[1];
  object.position.x -= center.x;
  object.position.y -= minY;
  object.position.z -= center.z;
  if (profile.rootPosition) {
    object.position.add(new THREE.Vector3(...profile.rootPosition));
  }
  object.updateWorldMatrix(true, true);
  return { applied: true, before, afterRotation: rotated, scale, after: avatarBounds(object) };
}

function generatedAvatarStageProfile(
  base: { targetSize?: number; rootRotation?: [number, number, number]; rootPosition?: [number, number, number] } | undefined,
  params: URLSearchParams,
  allowTestOverrides: boolean,
): { targetSize?: number; rootRotation?: [number, number, number]; rootPosition?: [number, number, number] } {
  const profile = { ...(base ?? {}) };
  if (!allowTestOverrides) return profile;
  const numberParam = (name: string) => {
    const raw = params.get(name);
    if (raw == null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const rx = numberParam('avatarRotateX');
  const ry = numberParam('avatarRotateY');
  const rz = numberParam('avatarRotateZ');
  if (rx != null || ry != null || rz != null) profile.rootRotation = [rx ?? 0, ry ?? 0, rz ?? 0];
  const targetSize = numberParam('avatarTargetSize');
  if (targetSize != null && targetSize > 0) profile.targetSize = targetSize;
  const px = numberParam('avatarOffsetX');
  const py = numberParam('avatarOffsetY');
  const pz = numberParam('avatarOffsetZ');
  if (px != null || py != null || pz != null) profile.rootPosition = [px ?? 0, py ?? 0, pz ?? 0];
  return profile;
}

function shouldNormalizeGeneratedAvatar(params: URLSearchParams, allowTestOverrides: boolean): boolean {
  if (allowTestOverrides && params.get('avatarNormalize') === '0') return false;
  if (allowTestOverrides && params.get('avatarNormalize') === '1') return true;
  return params.has('avatarRotateX')
    || params.has('avatarRotateY')
    || params.has('avatarRotateZ')
    || params.has('avatarTargetSize')
    || params.has('avatarOffsetX')
    || params.has('avatarOffsetY')
    || params.has('avatarOffsetZ');
}

function applyGeneratedMaterialMode(object: THREE.Object3D, mode: string | null): Record<string, unknown> {
  if (!mode || mode === 'original') return { applied: false, mode: mode ?? 'original' };
  let changed = 0;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mode === 'normal') {
      mesh.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      changed++;
      return;
    }
    if (mode === 'debug-lit') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xd8dde6,
        roughness: 0.6,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      changed++;
    }
  });
  return { applied: changed > 0, mode, changed };
}

function prepareGeneratedAvatarMeshes(object: THREE.Object3D): Record<string, unknown> {
  let meshCount = 0;
  let skinnedMeshCount = 0;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount++;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount++;
  });
  return { meshCount, skinnedMeshCount, frustumCulledDisabled: meshCount };
}

function applyGeneratedDuplicateCull(object: THREE.Object3D, mode: string | null): Record<string, unknown> {
  if (mode !== 'positive-x' && mode !== 'negative-x') return { applied: false, mode: mode ?? 'off' };
  object.updateWorldMatrix(true, true);
  const rootBounds = avatarBounds(object);
  if (rootBounds.empty) return { applied: false, mode, reason: 'empty-root-bounds' };
  const centerX = rootBounds.center[0];
  let hidden = 0;
  let considered = 0;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const box = geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const meshCenterX = box.getCenter(new THREE.Vector3()).x;
    considered++;
    if ((mode === 'positive-x' && meshCenterX > centerX) || (mode === 'negative-x' && meshCenterX < centerX)) {
      mesh.visible = false;
      hidden++;
    }
  });
  object.updateWorldMatrix(true, true);
  return { applied: hidden > 0, mode, considered, hidden, centerX, bounds: avatarBounds(object) };
}

function frameStageCamera(stage: ReturnType<typeof createStage>, object: THREE.Object3D): Record<string, unknown> {
  const bounds = avatarBounds(object);
  if (bounds.empty || bounds.maxDimension <= 0) return { framed: false, bounds };
  const center = new THREE.Vector3(...bounds.center);
  const size = new THREE.Vector3(...bounds.size);
  const fov = THREE.MathUtils.degToRad(stage.camera.fov);
  const distance = Math.max(size.y / (2 * Math.tan(fov / 2)), size.x / (2 * Math.tan(fov / 2) * stage.camera.aspect), 1.8);
  stage.camera.position.set(center.x, center.y + size.y * 0.05, center.z + distance * 1.35);
  stage.camera.near = Math.max(distance / 100, 0.01);
  stage.camera.far = Math.max(distance * 100, 50);
  stage.camera.lookAt(center.x, center.y + size.y * 0.05, center.z);
  stage.camera.updateProjectionMatrix();
  return {
    framed: true,
    bounds,
    camera: {
      position: stage.camera.position.toArray(),
      near: stage.camera.near,
      far: stage.camera.far,
      fov: stage.camera.fov,
      aspect: stage.camera.aspect,
    },
  };
}

function installVisualReviewHarness(stage: ReturnType<typeof createStage>, getAvatar: () => Avatar): void {
  const rest = new Map<string, THREE.Quaternion>();
  const captureRest = () => {
    rest.clear();
    for (const [name, bone] of Object.entries(getAvatar().bones)) {
      if (bone) rest.set(name, bone.quaternion.clone());
    }
  };
  const reset = () => {
    for (const [name, quat] of rest) {
      const bone = getAvatar().bones[name as keyof Avatar['bones']];
      if (bone) bone.quaternion.copy(quat);
    }
    getAvatar().object.updateWorldMatrix(true, true);
    return collect();
  };
  const rotate = (name: keyof Avatar['bones'], x = 0, y = 0, z = 0) => {
    const bone = getAvatar().bones[name];
    if (!bone) return false;
    const base = rest.get(name) ?? bone.quaternion.clone();
    bone.quaternion.copy(base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
    return true;
  };
  const collect = () => ({
    bounds: avatarBounds(getAvatar().object),
    scene: countAvatarScene(getAvatar().object),
    bones: Object.keys(getAvatar().bones).filter((name) => getAvatar().bones[name as keyof Avatar['bones']]),
    renderFps: stage.renderFps(),
    poses: VISUAL_POSES,
  });
  const applyPose = (poseName: string) => {
    reset();
    switch (poseName as VisualPoseName) {
      case 'arms_forward':
        rotate('leftUpperArm', -0.75, 0, 0.15);
        rotate('rightUpperArm', -0.75, 0, -0.15);
        break;
      case 'arms_out':
        rotate('leftUpperArm', 0, 0, 0.75);
        rotate('rightUpperArm', 0, 0, -0.75);
        break;
      case 'arms_up':
      case 'flying_arms_out':
        rotate('leftUpperArm', 0, 0, 1.05);
        rotate('rightUpperArm', 0, 0, -1.05);
        break;
      case 'elbow_bend_left':
        rotate('leftLowerArm', -0.9, 0.15, 0);
        break;
      case 'elbow_bend_right':
        rotate('rightLowerArm', -0.9, -0.15, 0);
        break;
      case 'finger_curl_left_if_fingers_exist':
      case 'wrist_rotate_left':
        rotate('leftHand', 0.45, 0.2, 0.45);
        break;
      case 'finger_curl_right_if_fingers_exist':
      case 'wrist_rotate_right':
        rotate('rightHand', 0.45, -0.2, -0.45);
        break;
      case 'foot_lift_left':
        rotate('leftUpperLeg', -0.35, 0, 0);
        rotate('leftLowerLeg', 0.55, 0, 0);
        break;
      case 'foot_lift_right':
        rotate('rightUpperLeg', -0.35, 0, 0);
        rotate('rightLowerLeg', 0.55, 0, 0);
        break;
      case 'foot_rotate_left':
        rotate('leftLowerLeg', 0, 0.25, 0);
        break;
      case 'foot_rotate_right':
        rotate('rightLowerLeg', 0, -0.25, 0);
        break;
      case 'hand_to_cheek_proxy':
        rotate('leftUpperArm', -0.45, 0.35, 0.35);
        rotate('leftLowerArm', -1.05, 0, 0.2);
        rotate('leftHand', 0.25, 0, 0.35);
        break;
      case 'hand_to_mouth_proxy':
        rotate('rightUpperArm', -0.45, -0.35, -0.35);
        rotate('rightLowerArm', -1.05, 0, -0.2);
        rotate('rightHand', 0.25, 0, -0.35);
        break;
      case 'lean_left':
        rotate('chest', 0, 0, 0.45);
        break;
      case 'lean_right':
        rotate('chest', 0, 0, -0.45);
        break;
      case 'palm_forward':
        rotate('leftHand', 0, 0.65, 0);
        rotate('rightHand', 0, -0.65, 0);
        break;
      case 'rowing_stroke_pull':
        rotate('leftUpperArm', -0.35, 0, 0.2);
        rotate('rightUpperArm', -0.35, 0, -0.2);
        rotate('leftLowerArm', -0.9, 0, 0);
        rotate('rightLowerArm', -0.9, 0, 0);
        break;
      case 'rowing_stroke_start':
        rotate('leftUpperArm', -0.8, 0, 0.1);
        rotate('rightUpperArm', -0.8, 0, -0.1);
        break;
      case 'torso_turn_left':
        rotate('chest', 0, 0.55, 0);
        break;
      case 'torso_turn_right':
        rotate('chest', 0, -0.55, 0);
        break;
      case 'walking_stride_proxy':
        rotate('leftUpperLeg', -0.35, 0, 0);
        rotate('rightUpperLeg', 0.3, 0, 0);
        break;
      case 'neutral':
      default:
        break;
    }
    getAvatar().object.updateWorldMatrix(true, true);
    return collect();
  };
  window.__PP.avatarDiagnostics = collect;
  window.__PP.frameAvatar = () => frameStageCamera(stage, getAvatar().object);
  window.__PP.applyVisualPose = applyPose;
  window.__PP.resetVisualPose = reset;
  captureRest();
}

async function boot() {
  const video = document.getElementById('video') as HTMLVideoElement;
  const overlay = document.getElementById('overlay') as HTMLCanvasElement;
  const pane = document.getElementById('camera-pane')!;
  const statusEl = document.getElementById('camera-status')!;
  const stageCanvas = document.getElementById('stage') as HTMLCanvasElement;
  const overlayCtx = overlay.getContext('2d')!;

  // Add test markers for Playwright
  document.body.setAttribute('data-testid', 'posepuppet-app');
  statusEl.setAttribute('data-testid', 'camera-status');

  const params = new URLSearchParams(location.search);
  const evalFixture = params.get('eval');
  const evalDuration = Number(params.get('dur') ?? 60);
  const modelVariant = (params.get('model') ?? config.model) as ModelVariant;
  const generatedAvatarSlug = params.get('generatedAvatar');
  const smokeMode = params.get('smoke');
  const isAvatarLoadOnly = smokeMode === 'avatar-load-only';
  const isAvatarVisualReview = smokeMode === 'avatar-visual-review';
  if (params.has('mirror')) config.mirror = params.get('mirror') !== '0';
  if (params.has('avatar')) {
    const av = params.get('avatar')!;
    config.avatar = isAvatarId(av) ? av : 'woody';
  }
  // ?src=file plays the fixture mp4 directly (manual eval without fake cam)
  const videoSrc =
    params.get('video') ?? (evalFixture && params.get('src') === 'file' ? `/fixtures/${evalFixture}.mp4` : null);

  const els = { video, overlay, pane };
  const hud = createHud();
  const stage = createStage(stageCanvas);

  let avatar: Avatar = createRobot();
  stage.scene.add(avatar.object);
  let retargeter = new Retargeter(avatar);

  // 3-2-1 countdown over the camera pane, then capture the neutral pose
  let countdownActive = false;
  function calibrateWithCountdown(): void {
    if (countdownActive) return;
    countdownActive = true;
    const el = document.createElement('div');
    el.className = 'countdown';
    el.textContent = '3';
    pane.appendChild(el);
    let n = 3;
    const timer = setInterval(() => {
      n--;
      if (n > 0) {
        el.textContent = String(n);
        return;
      }
      clearInterval(timer);
      retargeter.calibrate();
      el.textContent = 'calibrated ✓';
      setTimeout(() => {
        el.remove();
        countdownActive = false;
      }, 900);
    }, 1000);
  }

  createPanel({
    calibrate: calibrateWithCountdown,
    clearCalibration: () => retargeter.clearCalibration(),
    getCorrectionEuler: (b) => retargeter.getCorrectionEuler(b),
    setCorrectionEuler: (b, e) => retargeter.setCorrectionEuler(b, e),
  });

  // live avatar switcher: robot → astronaut → woody → robot (see ASSETS.md)
  let avatarLoading = false;
  let currentAvatarId: AvatarId = 'robot';
  async function setAvatar(id: AvatarId): Promise<void> {
    if (avatarLoading || currentAvatarId === id) return;
    avatarLoading = true;
    try {
      const next = await loadAvatarById(id);
      stage.scene.add(next.object);
      avatar.dispose();
      avatar = next;
      retargeter.bind(avatar);
      currentAvatarId = id;
    } catch (err) {
      const def = getAvatarDef(id);
      console.warn(
        `Failed to load avatar "${id}" from ${def.url ?? '(procedural)'}. ` +
        `Is the licensed VRM file present?`,
        err,
      );
      setConfig('avatar', currentAvatarId); // revert config to current
    } finally {
      avatarLoading = false;
    }
  }
  const avatarBtn = document.createElement('button');
  avatarBtn.id = 'avatar-btn';
  const avatarLabel = () => {
    avatarBtn.textContent = `avatar: ${getAvatarDef(config.avatar).label}`;
  };
  avatarLabel();
  avatarBtn.onclick = () => setConfig('avatar', nextAvatarId(config.avatar));
  onConfigChange((key) => {
    if (key === 'avatar') {
      avatarLabel();
      void setAvatar(config.avatar);
    }
  });
  document.getElementById('controls')!.append(avatarBtn);

  const smoother = new LandmarkSmoother();
  smoother.setParams(config.minCutoff, config.beta);
  smoother.enabled = config.smoothing;

  onConfigChange((key) => {
    if (key === 'minCutoff' || key === 'beta') smoother.setParams(config.minCutoff, config.beta);
    if (key === 'smoothing') smoother.enabled = config.smoothing;
    if (key === 'mirror') {
      setMirrored(els, config.mirror);
      smoother.reset();
      retargeter.bind(avatar);
    }
  });

  window.__PP = {
    videoReady: false,
    cameraError: null,
    renderFps: () => stage.renderFps(),
    poseFps: () => 0,
    lastDetectionAt: 0,
    detectionCount: 0,
    lastRecording: null,
    avatarStatus: undefined,
    avatarWarning: undefined,
  };

  // --- Generated avatar smoke path (test-only) ---
  if (generatedAvatarSlug) {
    const genDef = getGeneratedAvatarDef(generatedAvatarSlug);
    if (genDef) {
      window.__PP.avatarStatus = 'loading';
      window.__PP.avatarWarning = genDef.warningLabel;
      statusEl.textContent = `loading generated avatar: ${genDef.label}…`;
      statusEl.setAttribute('data-testid', 'avatar-status');
      try {
        const { loadRawGltfAvatar, loadVrmAvatar } = await import('./rig/vrm');
        const requestedLoader = isAvatarVisualReview ? params.get('avatarLoader') : null;
        const loaderMode = requestedLoader === 'raw-gltf' ? 'raw-gltf' : (genDef.loader ?? 'vrm');
        const next = loaderMode === 'raw-gltf'
          ? await loadRawGltfAvatar(genDef.url)
          : await loadVrmAvatar(genDef.url);
        const meshPrep = prepareGeneratedAvatarMeshes(next.object);
        const materialOverride = applyGeneratedMaterialMode(next.object, isAvatarVisualReview ? params.get('avatarMaterialMode') : null);
        const normalization = shouldNormalizeGeneratedAvatar(params, isAvatarVisualReview)
          ? normalizeGeneratedAvatar(
              next.object,
              generatedAvatarStageProfile(genDef.stageProfile, params, isAvatarVisualReview),
            )
          : { applied: false, reason: 'no-normalization-requested', meshPrep, materialOverride, bounds: avatarBounds(next.object) };
        const duplicateCull = applyGeneratedDuplicateCull(
          next.object,
          isAvatarVisualReview ? params.get('avatarDuplicateCull') : null,
        );
        window.__PP.avatarNormalization = { ...normalization, meshPrep, materialOverride, duplicateCull };
        stage.scene.add(next.object);
        avatar.dispose();
        avatar = next;
        retargeter.bind(avatar);
        if (isAvatarVisualReview) installVisualReviewHarness(stage, () => avatar);
        if (isAvatarLoadOnly || isAvatarVisualReview) window.__PP.frameAvatar = () => frameStageCamera(stage, avatar.object);
        if (isAvatarLoadOnly || isAvatarVisualReview) window.__PP.frameAvatar?.();
        window.__PP.avatarStatus = 'loaded';
        statusEl.textContent = `generated avatar loaded: ${genDef.label} [${genDef.warningLabel}]`;
        console.info(`[generated-avatar] loaded ${genDef.id} from ${genDef.url} using ${loaderMode}`);
      } catch (err) {
        window.__PP.avatarStatus = 'error';
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[generated-avatar] failed to load ${generatedAvatarSlug}: ${msg}`);
        statusEl.textContent = `generated avatar failed: ${generatedAvatarSlug} — ${msg}`;
      }
    } else {
      // Missing / unknown generated avatar: controlled fallback
      window.__PP.avatarStatus = 'fallback';
      window.__PP.avatarWarning = `unknown generated avatar: ${generatedAvatarSlug}`;
      console.warn(`[generated-avatar] unknown slug: ${generatedAvatarSlug}, staying on default avatar`);
      statusEl.textContent = `generated avatar not found: ${generatedAvatarSlug} — using default`;
      statusEl.setAttribute('data-testid', 'avatar-status');
    }
    // Add warning indicator
    const warningEl = document.createElement('div');
    warningEl.setAttribute('data-testid', 'avatar-warning');
    warningEl.textContent = window.__PP.avatarWarning ?? '';
    warningEl.style.cssText = 'position:fixed;bottom:4px;right:4px;font-size:11px;color:#fa0;z-index:999;';
    document.body.append(warningEl);
  }

  // --- avatar-load-only smoke mode: skip camera + detector entirely ---
  if (isAvatarLoadOnly || isAvatarVisualReview) {
    statusEl.textContent = window.__PP.avatarStatus === 'loaded'
      ? `${smokeMode} smoke: OK`
      : `${smokeMode} smoke: ${window.__PP.avatarStatus ?? 'idle'}`;
    statusEl.classList.remove('hidden');
    // Still run the render loop so the avatar is visible
    stage.onTick((dt, time) => {
      if (!isAvatarVisualReview) retargeter.tick(dt);
      avatar.update(dt, time);
    });
    return; // skip camera, detector, eval, recording
  }

  watchLayout(els);
  setMirrored(els, config.mirror);

  try {
    if (videoSrc) {
      await startVideoFile(video, videoSrc);
    } else {
      await startCamera(video);
      hud.setLive(true);
    }
    statusEl.classList.add('hidden');
    window.__PP.videoReady = true;
    layoutOverlay(els);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    window.__PP.cameraError = msg;
    statusEl.textContent = `camera unavailable: ${msg} — allow camera access and reload`;
    return;
  }

  const recorder = createRecorder({
    video,
    overlay,
    stage: stageCanvas,
    onState: updateRecordButton,
  });
  createRecordButton(recorder);

  // video-file input through the same pipeline (M3); toggles back to camera
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*';
  fileInput.style.display = 'none';
  document.body.append(fileInput);
  const fileBtn = document.createElement('button');
  fileBtn.id = 'video-file-btn';
  fileBtn.textContent = 'load video';
  let fileMode = false;
  fileBtn.onclick = () => {
    if (fileMode) {
      void startCamera(video).then(() => {
        fileMode = false;
        fileBtn.textContent = 'load video';
        hud.setLive(true);
        smoother.reset();
        layoutOverlay(els);
      });
    } else {
      fileInput.click();
    }
  };
  fileInput.onchange = () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    void startVideoFile(video, f).then(() => {
      fileMode = true;
      fileBtn.textContent = '↩ camera';
      hud.setLive(false);
      smoother.reset();
      layoutOverlay(els);
    });
  };
  document.getElementById('controls')!.append(fileBtn);

  // settle the initial avatar before detection/eval starts, so eval mode
  // measures the avatar it claims to measure
  if (config.avatar !== 'robot') await setAvatar(config.avatar);

  statusEl.textContent = 'loading pose model…';
  statusEl.classList.remove('hidden');
  const detector = await createDetector(modelVariant);
  statusEl.classList.add('hidden');
  window.__PP.poseFps = () => detector.poseFps();
  onConfigChange((key) => {
    if (key === 'model') void detector.setModel(config.model);
  });

  const evalCollector = evalFixture
    ? new EvalCollector(evalFixture, evalDuration, {
        stage,
        detector,
        video,
        getAvatar: () => avatar,
      })
    : null;
  evalCollector?.start();

  // reusable mirror buffers — no per-frame allocation
  const mNorm: LandmarkPoint[] = [];
  const mWorld: LandmarkPoint[] = [];

  function onPoseFrame(frame: PoseFrame | null) {
    if (frame) {
      window.__PP.lastDetectionAt = frame.wallTimeMs;
      window.__PP.detectionCount++;
      drawSkeleton(overlayCtx, frame.norm, overlay.width, overlay.height);

      const norm = config.mirror ? mirrorNorm(frame.norm, mNorm) : frame.norm;
      const world = config.mirror ? mirrorWorld(frame.world, mWorld) : frame.world;
      const worldSmooth = smoother.apply(world, frame.wallTimeMs);
      retargeter.updateFromPose(worldSmooth, norm);
      evalCollector?.onPoseFrame(norm);
    } else {
      drawSkeleton(overlayCtx, null, overlay.width, overlay.height);
      retargeter.updateFromPose(null, null);
      evalCollector?.onPoseFrame(null);
    }
  }

  detector.start(video, onPoseFrame);

  let hudAccum = 0;
  stage.onTick((dt, time) => {
    retargeter.tick(dt);
    avatar.update(dt, time);
    hudAccum += dt;
    if (hudAccum > 0.25) {
      hudAccum = 0;
      hud.setRenderFps(stage.renderFps());
      hud.setPoseFps(detector.poseFps());
    }
  });
}

boot();
