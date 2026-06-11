// Boot + the imperative capture → detect → retarget → render pipeline.
// No framework in the hot path; UI chrome is plain DOM.

import * as THREE from 'three';
import { startCamera, startVideoFile, watchLayout, layoutOverlay, setMirrored } from './camera';
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
import type { Avatar, BoneName } from './rig/types';
import { type AvatarId, isAvatarId, getAvatarDef, nextAvatarId, loadAvatarById } from './rig/avatarRegistry';
import { getGeneratedAvatarDef } from './rig/generatedAvatarRegistry';
import { EvalCollector } from './eval/runner';
import { createRecorder, createRecordButton, updateRecordButton } from './record/recorder';

type VisualQaPoseResult = {
  poseName: string;
  attempted: boolean;
  bonesDriven: string[];
  missingBones: string[];
  extraBonesDriven: string[];
  warnings: string[];
};

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
    };
    __PPVisualQa?: {
      getDiagnostics: () => {
        avatarName: string;
        availableBones: string[];
        fingerLikeBoneCount: number;
        bbox: { center: number[]; size: number[] } | null;
        generatedStageNormalization:
          | {
              applied: boolean;
              scale: number;
              before: { center: number[]; size: number[] } | null;
              after: { center: number[]; size: number[] } | null;
            }
          | null;
      };
      frameAvatar: () => { framed: boolean; bbox: { center: number[]; size: number[] } | null };
      clearPose: () => void;
      applyPose: (poseName: string) => VisualQaPoseResult;
    };
  }
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
  const isGeneratedOnlyMode = isAvatarLoadOnly || isAvatarVisualReview;
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
  const visualQaRest = new Map<string, THREE.Euler>();
  let visualQaPoseOverride = false;
  let generatedStageNormalization:
    | {
        applied: boolean;
        scale: number;
        before: { center: number[]; size: number[] } | null;
        after: { center: number[]; size: number[] } | null;
      }
    | null = null;

  function rememberVisualQaRest(): void {
    visualQaRest.clear();
    for (const [name, node] of Object.entries(avatar.bones) as [BoneName, THREE.Object3D | undefined][]) {
      if (node) visualQaRest.set(name, node.rotation.clone());
    }
  }

  function visualQaBBox(): { center: number[]; size: number[] } | null {
    avatar.object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(avatar.object);
    if (box.isEmpty()) return null;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return { center: center.toArray(), size: size.toArray() };
  }

  function frameVisualQaAvatar(): { framed: boolean; bbox: { center: number[]; size: number[] } | null } {
    const bbox = visualQaBBox();
    if (!bbox) return { framed: false, bbox };
    const center = new THREE.Vector3().fromArray(bbox.center);
    const size = new THREE.Vector3().fromArray(bbox.size);
    const radius = Math.max(size.x, size.y, size.z, 0.75);
    if (Math.max(size.x, size.y, size.z) < 0.5) {
      stage.camera.position.set(0, 1.3, 3.2);
      stage.camera.lookAt(0, 1.0, 0);
      stage.camera.near = 0.1;
      stage.camera.far = 50;
      stage.camera.updateProjectionMatrix();
      return { framed: false, bbox };
    }
    stage.camera.position.set(center.x, center.y + radius * 0.12, center.z + Math.max(2.1, radius * 1.85));
    stage.camera.lookAt(center.x, center.y + size.y * 0.08, center.z);
    stage.camera.near = 0.01;
    stage.camera.far = Math.max(50, radius * 4 + 10);
    stage.camera.updateProjectionMatrix();
    return { framed: true, bbox };
  }

  function normalizeGeneratedAvatarForStage(): void {
    const before = visualQaBBox();
    if (!before) {
      generatedStageNormalization = { applied: false, scale: 1, before, after: null };
      return;
    }
    const beforeCenter = new THREE.Vector3().fromArray(before.center);
    const beforeSize = new THREE.Vector3().fromArray(before.size);
    const maxDim = Math.max(beforeSize.x, beforeSize.y, beforeSize.z);
    const targetMaxDim = 1.9;
    if (maxDim <= 2.4) {
      generatedStageNormalization = { applied: false, scale: 1, before, after: before };
      return;
    }
    const scale = THREE.MathUtils.clamp(targetMaxDim / maxDim, 0.005, 1);
    avatar.object.scale.multiplyScalar(scale);

    avatar.object.updateWorldMatrix(true, true);
    const scaledBox = new THREE.Box3().setFromObject(avatar.object);
    if (!scaledBox.isEmpty()) {
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      avatar.object.position.x -= scaledCenter.x;
      avatar.object.position.z -= scaledCenter.z;
      avatar.object.position.y -= scaledBox.min.y;
    } else {
      avatar.object.position.x -= beforeCenter.x;
      avatar.object.position.z -= beforeCenter.z;
    }
    avatar.object.updateWorldMatrix(true, true);
    generatedStageNormalization = { applied: true, scale, before, after: visualQaBBox() };
  }

  function clearVisualQaPose(): void {
    for (const [name, node] of Object.entries(avatar.bones) as [BoneName, THREE.Object3D | undefined][]) {
      const rest = visualQaRest.get(name);
      if (node && rest) node.rotation.copy(rest);
    }
    visualQaPoseOverride = false;
    avatar.object.updateMatrixWorld(true);
  }

  function rotateVisualQaBone(
    result: VisualQaPoseResult,
    name: BoneName,
    deg: Partial<Record<'x' | 'y' | 'z', number>>,
  ): void {
    const node = avatar.bones[name];
    const rest = visualQaRest.get(name);
    if (!node || !rest) {
      result.missingBones.push(name);
      return;
    }
    node.rotation.set(
      rest.x + THREE.MathUtils.degToRad(deg.x ?? 0),
      rest.y + THREE.MathUtils.degToRad(deg.y ?? 0),
      rest.z + THREE.MathUtils.degToRad(deg.z ?? 0),
    );
    result.bonesDriven.push(name);
  }

  function rotateFingerLikeBones(result: VisualQaPoseResult, side: 'left' | 'right'): void {
    const sideRe = side === 'left' ? /(^|[^a-z])(left|l)[._ -]?/i : /(^|[^a-z])(right|r)[._ -]?/i;
    const fingerRe = /(thumb|index|middle|ring|little|pinky|finger)/i;
    avatar.object.traverse((node) => {
      if (!node.name || !fingerRe.test(node.name) || !sideRe.test(node.name)) return;
      node.rotation.x += THREE.MathUtils.degToRad(side === 'left' ? 18 : -18);
      result.extraBonesDriven.push(node.name);
    });
  }

  function applyVisualQaPose(poseName: string): VisualQaPoseResult {
    const result: VisualQaPoseResult = {
      poseName,
      attempted: true,
      bonesDriven: [],
      missingBones: [],
      extraBonesDriven: [],
      warnings: [],
    };
    clearVisualQaPose();
    visualQaPoseOverride = true;

    switch (poseName) {
      case 'neutral':
      case 'neutral_hand':
        break;
      case 'arms_out':
      case 'flying_arms_out':
        rotateVisualQaBone(result, 'leftUpperArm', { z: 12 });
        rotateVisualQaBone(result, 'rightUpperArm', { z: -12 });
        break;
      case 'arms_up':
        rotateVisualQaBone(result, 'leftUpperArm', { z: 52, x: -16 });
        rotateVisualQaBone(result, 'rightUpperArm', { z: -52, x: -16 });
        break;
      case 'arms_forward':
        rotateVisualQaBone(result, 'leftUpperArm', { x: -48 });
        rotateVisualQaBone(result, 'rightUpperArm', { x: -48 });
        break;
      case 'elbow_bend_left':
        rotateVisualQaBone(result, 'leftLowerArm', { z: 58 });
        break;
      case 'elbow_bend_right':
        rotateVisualQaBone(result, 'rightLowerArm', { z: -58 });
        break;
      case 'wrist_rotate_left':
      case 'wrist_rotate':
        rotateVisualQaBone(result, 'leftHand', { y: 38 });
        break;
      case 'wrist_rotate_right':
        rotateVisualQaBone(result, 'rightHand', { y: -38 });
        break;
      case 'palm_forward':
        rotateVisualQaBone(result, 'leftHand', { y: 28, z: 12 });
        rotateVisualQaBone(result, 'rightHand', { y: -28, z: -12 });
        break;
      case 'palm_down':
        rotateVisualQaBone(result, 'leftHand', { x: 45 });
        rotateVisualQaBone(result, 'rightHand', { x: 45 });
        break;
      case 'lean_left':
        rotateVisualQaBone(result, 'chest', { z: 14 });
        rotateVisualQaBone(result, 'hips', { z: 5 });
        break;
      case 'lean_right':
        rotateVisualQaBone(result, 'chest', { z: -14 });
        rotateVisualQaBone(result, 'hips', { z: -5 });
        break;
      case 'torso_turn_left':
        rotateVisualQaBone(result, 'chest', { y: 22 });
        rotateVisualQaBone(result, 'head', { y: 10 });
        break;
      case 'torso_turn_right':
        rotateVisualQaBone(result, 'chest', { y: -22 });
        rotateVisualQaBone(result, 'head', { y: -10 });
        break;
      case 'walking_stride_proxy':
        rotateVisualQaBone(result, 'leftUpperLeg', { x: -18 });
        rotateVisualQaBone(result, 'leftLowerLeg', { x: 12 });
        rotateVisualQaBone(result, 'rightUpperLeg', { x: 16 });
        rotateVisualQaBone(result, 'rightLowerLeg', { x: -8 });
        break;
      case 'foot_lift_left':
        rotateVisualQaBone(result, 'leftUpperLeg', { x: -22 });
        rotateVisualQaBone(result, 'leftLowerLeg', { x: 28 });
        rotateVisualQaBone(result, 'leftFoot', { x: -24 });
        break;
      case 'foot_lift_right':
        rotateVisualQaBone(result, 'rightUpperLeg', { x: -22 });
        rotateVisualQaBone(result, 'rightLowerLeg', { x: 28 });
        rotateVisualQaBone(result, 'rightFoot', { x: -24 });
        break;
      case 'foot_rotate_left':
        rotateVisualQaBone(result, 'leftFoot', { z: 22 });
        break;
      case 'foot_rotate_right':
        rotateVisualQaBone(result, 'rightFoot', { z: -22 });
        break;
      case 'rowing_stroke_start':
        rotateVisualQaBone(result, 'leftUpperArm', { x: -38, z: 12 });
        rotateVisualQaBone(result, 'rightUpperArm', { x: -38, z: -12 });
        break;
      case 'rowing_stroke_pull':
        rotateVisualQaBone(result, 'leftUpperArm', { x: -16, z: 18 });
        rotateVisualQaBone(result, 'leftLowerArm', { z: 54 });
        rotateVisualQaBone(result, 'rightUpperArm', { x: -16, z: -18 });
        rotateVisualQaBone(result, 'rightLowerArm', { z: -54 });
        break;
      case 'hand_to_mouth_proxy':
        rotateVisualQaBone(result, 'leftUpperArm', { x: -30, z: 28 });
        rotateVisualQaBone(result, 'leftLowerArm', { z: 74 });
        rotateVisualQaBone(result, 'leftHand', { y: 18 });
        break;
      case 'hand_to_cheek_proxy':
        rotateVisualQaBone(result, 'rightUpperArm', { x: -24, z: -26 });
        rotateVisualQaBone(result, 'rightLowerArm', { z: -70 });
        rotateVisualQaBone(result, 'rightHand', { y: -20 });
        break;
      case 'finger_curl_left_if_fingers_exist':
      case 'fist_or_curl':
        rotateFingerLikeBones(result, 'left');
        rotateVisualQaBone(result, 'leftHand', { x: 8 });
        break;
      case 'finger_curl_right_if_fingers_exist':
        rotateFingerLikeBones(result, 'right');
        rotateVisualQaBone(result, 'rightHand', { x: 8 });
        break;
      case 'open_hand':
        rotateVisualQaBone(result, 'leftHand', { x: -8 });
        rotateVisualQaBone(result, 'rightHand', { x: -8 });
        break;
      case 'point_index':
        rotateFingerLikeBones(result, 'right');
        result.warnings.push('index isolation is approximate; non-index finger chains are curled by name when present');
        break;
      default:
        result.attempted = false;
        result.warnings.push(`unknown visual QA pose: ${poseName}`);
    }

    if (
      (poseName.includes('finger') || poseName === 'fist_or_curl' || poseName === 'point_index') &&
      result.extraBonesDriven.length === 0
    ) {
      result.warnings.push('no finger-like bones were found by name in the loaded avatar hierarchy');
    }
    avatar.object.updateMatrixWorld(true);
    return result;
  }

  function installVisualQaHook(): void {
    rememberVisualQaRest();
    window.__PPVisualQa = {
      getDiagnostics: () => {
        const bbox = visualQaBBox();
        let fingerLikeBoneCount = 0;
        avatar.object.traverse((node) => {
          if (/(thumb|index|middle|ring|little|pinky|finger)/i.test(node.name)) fingerLikeBoneCount++;
        });
        return {
          avatarName: avatar.name,
          availableBones: Object.entries(avatar.bones)
            .filter(([, node]) => Boolean(node))
            .map(([name]) => name)
            .sort(),
          fingerLikeBoneCount,
          bbox,
          generatedStageNormalization,
        };
      },
      frameAvatar: frameVisualQaAvatar,
      clearPose: clearVisualQaPose,
      applyPose: applyVisualQaPose,
    };
  }
  installVisualQaHook();

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
      installVisualQaHook();
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
    const registered = getGeneratedAvatarDef(generatedAvatarSlug);
    const reviewOnlyDef =
      !registered && isAvatarVisualReview && /^[a-z0-9-]+$/.test(generatedAvatarSlug)
        ? {
            id: generatedAvatarSlug,
            label: `${generatedAvatarSlug} visual review VRM`,
            url: `/avatars/generated/${generatedAvatarSlug}.vrm`,
            enabledInUi: false as const,
            warningLabel: 'experimental' as const,
            profile: 'humanoid' as const,
            source: 'generated-vrm-smoke-test' as const,
          }
        : undefined;
    const genDef = registered ?? reviewOnlyDef;
    if (genDef) {
      window.__PP.avatarStatus = 'loading';
      window.__PP.avatarWarning = genDef.warningLabel;
      statusEl.textContent = `loading generated avatar: ${genDef.label}…`;
      statusEl.setAttribute('data-testid', 'avatar-status');
      try {
        const { loadVrmAvatar } = await import('./rig/vrm');
        const next = await loadVrmAvatar(genDef.url);
        stage.scene.add(next.object);
        avatar.dispose();
        avatar = next;
        normalizeGeneratedAvatarForStage();
        retargeter.bind(avatar);
        installVisualQaHook();
        window.__PP.avatarStatus = 'loaded';
        statusEl.textContent = `generated avatar loaded: ${genDef.label} [${genDef.warningLabel}]`;
        console.info(`[generated-avatar] loaded ${genDef.id} from ${genDef.url}`);
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

  // --- generated-only smoke/visual modes: skip camera + detector entirely ---
  if (isGeneratedOnlyMode) {
    statusEl.textContent = window.__PP.avatarStatus === 'loaded'
      ? `${smokeMode} smoke: OK`
      : `${smokeMode} smoke: ${window.__PP.avatarStatus ?? 'idle'}`;
    statusEl.classList.remove('hidden');
    // Still run the render loop so the avatar is visible
    stage.onTick((dt, time) => {
      if (!visualQaPoseOverride) retargeter.tick(dt);
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
