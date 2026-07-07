// Boot + the imperative capture → detect → retarget → render pipeline.
// No framework in the hot path; UI chrome is plain DOM.

import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '@fontsource-variable/fraunces/index.css';
import './styles.css';

import * as THREE from 'three';
import { startCamera, startVideoFile, watchLayout, layoutOverlay, setMirrored } from './camera';
import { createStage } from './stage/scene';
import { createChain } from './ui/chain';
import { createReceipt } from './ui/receipt';
import { createAvatarCards } from './ui/cards';
import { createPalette } from './ui/palette';
import { createCoach } from './ui/coach';
import { createOnboarding } from './ui/onboarding';
import { createHandMode, HAND_PUPPETS, isHandPuppetId } from './hand/mode';
import { createVfx } from './stage/vfx';
import { createAutoCam } from './stage/autocam';
import { RingBuffer, encodePoseFrame, encodeHandFrame } from './memory/stream';
import { createGhostPlayer } from './memory/ghost';
import { saveLoop, listLoops, loadLoop, deleteLoop } from './memory/store';
import { createIntentDetector } from './gesture/intent';
import { createBodyInputAdapter, type BodyInputAdapter } from './bodyinput/adapter';
import { openFlight } from './bodyinput/flightBridge';
import { createDirector } from './director/director';
import { TAKE_SCRIPTS } from './director/scripts';
import type { HandPuppetId } from './hand/types';
import { createPanel, updatePpcStates } from './ui/panel';
import { config, onConfigChange, setConfig } from './config';
import { createDetector, type ModelVariant } from './pose/detector';
import { drawSkeleton } from './overlay/skeleton';
import { LM } from './pose/indices';
import { mirrorNorm, mirrorWorld } from './pose/mirror';
import { LandmarkSmoother } from './pose/smoothing';
import { PoseContinuity } from './pose/continuity';
import type { LandmarkPoint, PoseFrame } from './pose/types';
import { createRobot } from './rig/robot';
import { Retargeter } from './rig/retarget';
import type { Avatar, BoneName } from './rig/types';
import {
  type AvatarId,
  isAvatarId,
  isAvatarAvailable,
  probeOptionalAvatars,
  getAvatarDef,
  nextAvatarId,
  loadAvatarById,
} from './rig/avatarRegistry';
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
      applyHandState: (side: 'left' | 'right', openness: number, point: boolean) => void;
    };
  }
}

async function boot() {
  const video = document.getElementById('video') as HTMLVideoElement;
  const overlay = document.getElementById('overlay') as HTMLCanvasElement;
  // layout target is the feed box, not the whole camera panel (which now
  // carries a header/footer); countdown + status overlays land here too
  const pane = document.getElementById('camera-feed')!;
  const statusEl = document.getElementById('camera-status')!;
  const stageCanvas = document.getElementById('stage') as HTMLCanvasElement;
  const overlayCtx = overlay.getContext('2d')!;

  // theme before anything paints; persisted via the config store
  document.documentElement.dataset.theme = config.theme;
  onConfigChange((key) => {
    if (key === 'theme') document.documentElement.dataset.theme = config.theme;
  });

  // Add test markers for Playwright
  document.body.setAttribute('data-testid', 'posepuppet-app');
  statusEl.setAttribute('data-testid', 'camera-status');

  const params = new URLSearchParams(location.search);
  const evalFixture = params.get('eval');
  // eval measures retargeting with a STATIC camera — the screen-space sync
  // metric is only meaningful when the projection doesn't move. VFX stays
  // on so FPS numbers include the effects' cost.
  if (evalFixture) config.autoCam = false;
  const evalDuration = Number(params.get('dur') ?? 60);
  const modelVariant = (params.get('model') ?? config.model) as ModelVariant;
  const generatedAvatarSlug = params.get('generatedAvatar');
  const smokeMode = params.get('smoke');
  const isAvatarLoadOnly = smokeMode === 'avatar-load-only';
  const isAvatarVisualReview = smokeMode === 'avatar-visual-review';
  const isGeneratedOnlyMode = isAvatarLoadOnly || isAvatarVisualReview;
  if (params.has('mirror')) config.mirror = params.get('mirror') !== '0';
  if (params.has('ppc')) config.ppc = params.get('ppc') !== '0'; // eval A/B, not persisted
  if (params.has('body')) config.bodyMode = params.get('body') === 'full' ? 'full' : 'upper';
  if (params.has('mode')) config.mode = params.get('mode') === 'hand' ? 'hand' : 'character';
  if (params.has('puppet')) {
    const pp = params.get('puppet')!;
    if (isHandPuppetId(pp)) config.handPuppet = pp;
  }
  if (params.has('avatar')) {
    const av = params.get('avatar')!;
    config.avatar = isAvatarId(av) ? av : 'astronaut';
  }
  // optional avatars (local-only files) leave the cycle when absent; a
  // persisted/requested choice that's gone falls back to the default
  await probeOptionalAvatars();
  if (!isAvatarAvailable(config.avatar)) config.avatar = 'astronaut';
  createAvatarCards();

  // command-bar mode selector: Character is the only live mode this side
  // of P3; Setup re-runs neutral-pose calibration
  document.getElementById('mode-setup')!.addEventListener('click', () => calibrateWithCountdown());

  // exaggeration slider (the expressiveness layer's visible control)
  const exagSlider = document.getElementById('exag-slider') as HTMLInputElement | null;
  const exagVal = document.getElementById('exag-val');
  if (exagSlider && exagVal) {
    exagSlider.value = String(config.exaggeration);
    exagVal.textContent = config.exaggeration.toFixed(2).replace(/0$/, '');
    exagSlider.oninput = () => setConfig('exaggeration', Number(exagSlider.value));
    onConfigChange((key) => {
      if (key === 'exaggeration') {
        exagVal.textContent = config.exaggeration.toFixed(2).replace(/0$/, '');
        if (exagSlider.value !== String(config.exaggeration)) exagSlider.value = String(config.exaggeration);
      }
    });
  }

  // theme toggle (persisted)
  const themeBtn = document.createElement('button');
  themeBtn.id = 'theme-btn';
  themeBtn.textContent = '◐';
  themeBtn.title = 'toggle light/dark theme (t)';
  themeBtn.onclick = () => setConfig('theme', config.theme === 'dark' ? 'light' : 'dark');
  document.getElementById('controls')!.append(themeBtn);
  // ?src=file plays the fixture mp4 directly (manual eval without fake cam)
  const videoSrc =
    params.get('video') ?? (evalFixture && params.get('src') === 'file' ? `/fixtures/${evalFixture}.mp4` : null);

  const els = { video, overlay, pane };
  const hud = createChain();
  const coach = createCoach();
  const receipt = createReceipt();
  const stage = createStage(stageCanvas);
  const handMode = createHandMode();
  stage.scene.add(handMode.object);
  handMode.object.visible = false;

  // Motion Memory: always-on ring buffers (last 12 s) + ghost player
  const poseRing = new RingBuffer('pose', 12);
  const handRing = new RingBuffer('hand', 12);
  const ghosts = createGhostPlayer();
  stage.scene.add(ghosts.object);

  // electives: velocity VFX + auto-director camera (both toggleable)
  const vfx = createVfx();
  stage.scene.add(vfx.object);
  let cameraOwned = 0; // replay/poster hold the camera while > 0
  const autoCam = createAutoCam(stage.camera, () => cameraOwned > 0);

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
      applyHandState: (side, openness, point) => avatar.applyHandState?.(side, openness, point),
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

  // live avatar switcher with crossfade: both avatars share the stage for a
  // beat while opacity swaps; the retargeter's re-acquisition blend ramps
  // the new rig from rest onto the live pose — the switch never pops
  let avatarLoading = false;
  let currentAvatarId: AvatarId = 'robot';

  function setTreeOpacity(obj: THREE.Object3D, opacity: number): void {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.Material & { opacity: number };
        if (opacity < 1 && !mat.userData.ppWasTransparent) {
          mat.userData.ppWasTransparent = mat.transparent;
          mat.transparent = true;
        }
        mat.opacity = opacity;
        if (opacity >= 1 && mat.userData.ppWasTransparent !== undefined) {
          mat.transparent = mat.userData.ppWasTransparent as boolean;
          delete mat.userData.ppWasTransparent;
        }
      }
    });
  }

  function crossfadeAvatars(prev: Avatar, sec = 0.4): void {
    // fade the OLD avatar out over the new one; the new one stays opaque
    // from frame one. Fading both let the old avatar's far side show
    // through the new body (transparent depth sorting) — Gate-3 finding.
    prev.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.renderOrder = 999; // draw last, blended over the new avatar
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.Material;
        mat.transparent = true;
        mat.depthWrite = false; // don't punch holes…
        mat.depthTest = true; // …but stay hidden behind the new body
      }
    });
    const t0 = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - t0) / (sec * 1000), 1);
      setTreeOpacity(prev.object, 1 - t);
      if (t < 1) requestAnimationFrame(step);
      else prev.dispose();
    };
    requestAnimationFrame(step);
  }

  async function setAvatar(id: AvatarId): Promise<void> {
    if (avatarLoading || currentAvatarId === id) return;
    avatarLoading = true;
    try {
      const next = await loadAvatarById(id);
      stage.scene.add(next.object);
      const prev = avatar;
      avatar = next;
      retargeter.bind(avatar);
      installVisualQaHook();
      currentAvatarId = id;
      crossfadeAvatars(prev);
    } catch (err) {
      const def = getAvatarDef(id);
      // error, not warn: eval counts console errors, so a failed load can
      // never again silently measure the fallback avatar as if it were `id`
      console.error(
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

  // Predictive Pose Continuity: sits at the fork so puppeteering AND
  // body-input inherit it; exact pass-through while landmarks are visible
  const continuity = new PoseContinuity();
  continuity.enabled = config.ppc;

  onConfigChange((key) => {
    if (key === 'minCutoff' || key === 'beta') smoother.setParams(config.minCutoff, config.beta);
    if (key === 'smoothing') smoother.enabled = config.smoothing;
    if (key === 'ppc') {
      continuity.enabled = config.ppc;
      continuity.reset();
    }
    if (key === 'mirror') {
      setMirrored(els, config.mirror);
      smoother.reset();
      continuity.reset();
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
      hud.setLive(false);
      hud.setCam(`FILE ${video.videoWidth}×${video.videoHeight}`);
    } else {
      await startCamera(video);
      hud.setLive(true);
      hud.setCam(`LIVE ${video.videoWidth}×${video.videoHeight}`);
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
    onState: (recording, elapsedSec) => {
      updateRecordButton(recording, elapsedSec);
      hud.setRec(recording, elapsedSec);
    },
    onSaved: () => {
      coach.set('Saved', 'Clip downloaded — it never left this machine.', {
        label: 'Copy caption',
        run: () => void navigator.clipboard.writeText(suggestCaption()),
      });
    },
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
        hud.setCam(`LIVE ${video.videoWidth}×${video.videoHeight}`);
        smoother.reset();
        continuity.reset();
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
      hud.setCam(`FILE ${video.videoWidth}×${video.videoHeight}`);
      smoother.reset();
      continuity.reset();
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

  // every boot asset (model, wasm, fonts, avatar) is now in — from here on
  // the privacy receipt counts every network request, truthfully
  void document.fonts.ready.then(() => receipt.arm());

  // ── Motion Memory UI: ghost duet, echo chorus, instant replay, loops ──
  const ghostBtn = document.getElementById('ghost-btn') as HTMLButtonElement;
  const replayBtn = document.getElementById('replay-btn') as HTMLButtonElement;
  const echoSlider = document.getElementById('echo-slider') as HTMLInputElement;
  const echoVal = document.getElementById('echo-val');
  let echoes = 1;
  let replayActive = false;

  async function toggleGhost(): Promise<void> {
    if (ghosts.active) {
      ghosts.stop();
      ghostBtn.classList.remove('on');
      return;
    }
    const loop = poseRing.snapshot(8, 'last take');
    if (!loop) {
      coach.set('Memory', 'Perform for a few seconds first — the ghost replays your last 8 seconds.');
      return;
    }
    await ghosts.start(loop, config.avatar, { echoes, echoOffsetMs: 300 });
    ghostBtn.classList.add('on');
  }

  async function instantReplay(): Promise<void> {
    if (replayActive) return;
    const loop = poseRing.snapshot(5, 'replay');
    if (!loop) {
      coach.set('Memory', 'Perform for a few seconds first — replay shows your last 5 seconds.');
      return;
    }
    replayActive = true;
    cameraOwned++;
    replayBtn.classList.add('on');
    const wasGhosting = ghosts.active;
    ghosts.stop();
    // stage flips to replay framing IMMEDIATELY (the ghost build awaits
    // VRM loads); slow-mo from a side angle, trails via tight echoes
    avatar.object.visible = false;
    stage.camera.position.set(2.6, 1.45, 1.6);
    stage.camera.lookAt(0, 1.0, 0);
    await ghosts.start(loop, config.avatar, {
      echoes: 3,
      echoOffsetMs: 120,
      rate: 0.4,
      placement: 'center',
      baseOpacity: 0.75,
    });
    const replayMs = (loop.durationMs / 0.4) + 400;
    setTimeout(() => {
      ghosts.stop();
      avatar.object.visible = config.mode !== 'hand';
      stage.setTreatment(config.mode === 'hand' ? 'hand' : 'character');
      replayBtn.classList.remove('on');
      replayActive = false;
      cameraOwned--;
      if (wasGhosting) void toggleGhost();
    }, replayMs);
  }

  ghostBtn.onclick = () => void toggleGhost();
  replayBtn.onclick = () => void instantReplay();
  echoSlider.oninput = () => {
    echoes = Number(echoSlider.value);
    if (echoVal) echoVal.textContent = `×${echoes}`;
    if (ghosts.active) ghosts.setEchoes(echoes);
  };

  // saved loops: tiny local list — save the last 8 s, play any loop on the
  // CURRENT avatar (re-skin), delete. IndexedDB, fully local.
  const loopList = document.getElementById('loop-list');
  async function refreshLoopList(): Promise<void> {
    if (!loopList) return;
    const metas = await listLoops();
    loopList.innerHTML = '';
    if (!metas.length) {
      const empty = document.createElement('div');
      empty.className = 'loop-empty';
      empty.textContent = 'no saved loops — ⌘K "save loop"';
      loopList.append(empty);
      return;
    }
    for (const m of metas.slice(0, 6)) {
      const row = document.createElement('div');
      row.className = 'loop-row';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = `${m.name} · ${(m.durationMs / 1000).toFixed(1)}s`;
      const play = document.createElement('button');
      play.className = 'play';
      play.textContent = '▸';
      play.title = 'play on the current avatar (re-skin)';
      play.onclick = async () => {
        const loop = await loadLoop(m.id);
        if (loop && loop.kind === 'pose') {
          await ghosts.start(loop, config.avatar, { echoes, echoOffsetMs: 300 });
          ghostBtn.classList.add('on');
        }
      };
      const del = document.createElement('button');
      del.textContent = '×';
      del.title = 'delete loop';
      del.onclick = async () => {
        await deleteLoop(m.id);
        void refreshLoopList();
      };
      row.append(nm, play, del);
      loopList.append(row);
    }
  }
  void refreshLoopList();

  async function saveCurrentLoop(): Promise<void> {
    const loop = poseRing.snapshot(8, `take ${new Date().toLocaleTimeString()}`);
    if (!loop) {
      coach.set('Memory', 'Perform for a few seconds first, then save.');
      return;
    }
    await saveLoop(loop);
    void refreshLoopList();
  }

  // ── body-input protocol: derived signals for BodyArcade consumers ──
  // (landmarks go in here and only here; transports carry BodySignal only)
  const bodyInput = createBodyInputAdapter();
  (window as unknown as { __BI: BodyInputAdapter }).__BI = bodyInput;

  // BodyArcade Flight entry: opens the game (same-origin /flight/) with
  // body signals streaming; PosePuppet drops to the lite model and pauses
  // its stage renderer while the game window is open (perf budget).
  const startFlight = () =>
    openFlight(bodyInput, {
      setStageSuspended: (v) => stage.setSuspended(v),
      useLiteModel: () => {
        const prev = config.model;
        if (prev !== 'lite') setConfig('model', 'lite');
        return () => {
          if (prev !== 'lite' && config.model === 'lite') setConfig('model', prev);
        };
      },
    });
  document.getElementById('fly-btn')?.addEventListener('click', startFlight);

  // ── recording director: guided takes, hands-free via the gesture seed ──
  let latestNorm: LandmarkPoint[] | null = null;
  const intents = createIntentDetector();
  const director = createDirector({
    holdingStill: () => intents.holdingStill(),
    startRecording: (maxSec, takeName) => recorder.start(maxSec, takeName),
    stopRecording: () => recorder.stop(),
    ghostOn: async () => {
      if (!ghosts.active) await toggleGhost();
    },
    avatarNext: () => setConfig('avatar', nextAvatarId(config.avatar)),
    coach: (eyebrow, text) => coach.set(eyebrow, text),
    latestNorm: () => latestNorm,
    handTracked: () => performance.now() - handMode.lastDetectionAt() < 1000,
  });

  // the seed layer's single consumer: raise both arms to start the default
  // take for the current mode; cross wrists to stop
  intents.onIntent((intent) => {
    if (intent === 'take:start' && !director.running && !recorder.recording) {
      const script = TAKE_SCRIPTS.find((s) => s.mode === config.mode) ?? TAKE_SCRIPTS[0];
      director.begin(script);
    } else if (intent === 'take:stop' && director.running) {
      director.stop();
    }
  });

  // keyboard fallback: space advances the shot, escape stops the take
  window.addEventListener('keydown', (e) => {
    if (!director.running) return;
    if (e.code === 'Space') {
      e.preventDefault();
      director.advance();
    } else if (e.key === 'Escape') {
      director.stop();
    }
  });

  // caption helper: after a clip saves, one click copies an honest caption
  // (local string assembly; nothing is sent anywhere)
  function suggestCaption(): string {
    const subject =
      config.mode === 'hand'
        ? `a ${handMode.puppetId()} hand puppet`
        : `the ${getAvatarDef(config.avatar).label}`;
    return `puppeteering ${subject} live from my webcam — all inference local in the browser, nothing uploaded. posepuppet.`;
  }

  // first-run onboarding (skippable, persisted, reopenable via ⌘K)
  const onboarding = createOnboarding();

  // visibility-driven setup coach: low-nag — one message at a time, only
  // when a problem persists ~2 s, ≥12 s between nags, silent during takes
  let coachProblemSince = 0;
  let coachLastNag = 0;
  let coachActiveMsg = '';
  function visibilityCoach(now: number): void {
    if (recorder.recording || director.running) return;
    let msg = '';
    if (config.mode === 'hand') {
      if (now - handMode.lastDetectionAt() > 2500 && handMode.detectionCount() > 0) {
        msg = 'Bring your hand back into frame — palm toward the camera.';
      }
    } else if (latestNorm) {
      const vis = (i: number) => latestNorm![i].visibility > 0.5;
      if (!vis(LM.leftShoulder) || !vis(LM.rightShoulder)) {
        msg = 'Step back so both shoulders are in frame.';
      } else if (config.bodyMode === 'full' && (!vis(LM.leftAnkle) || !vis(LM.rightAnkle))) {
        msg = 'Step back so your legs are visible — full-body mode needs head to feet.';
      } else if (!vis(LM.leftWrist) && !vis(LM.rightWrist)) {
        msg = 'Keep your hands inside the frame.';
      }
    }
    if (!msg) {
      coachProblemSince = 0;
      if (coachActiveMsg) {
        coach.clear();
        coachActiveMsg = '';
      }
      return;
    }
    if (!coachProblemSince) coachProblemSince = now;
    if (now - coachProblemSince > 2000 && msg !== coachActiveMsg && now - coachLastNag > 12000) {
      coach.set('Framing', msg);
      coachActiveMsg = msg;
      coachLastNag = now;
    }
  }

  // pose poster: freeze the moment — slow quarter-orbit, then export a
  // designed still in the interface frame with mono labels. Local PNG.
  let posterBusy = false;
  async function exportPoster(): Promise<void> {
    if (posterBusy) return;
    posterBusy = true;
    cameraOwned++;
    const cam = stage.camera;
    const origPos = cam.position.clone();
    const origQuat = cam.quaternion.clone();
    try {
      // slow orbit to a three-quarter angle
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const step = () => {
          const t = Math.min((performance.now() - t0) / 900, 1);
          const e = t * t * (3 - 2 * t);
          const ang = e * 0.5;
          const r = config.mode === 'hand' ? 2.1 : 3.2;
          const y = config.mode === 'hand' ? 1.15 : 1.3;
          cam.position.set(Math.sin(ang) * r, y, Math.cos(ang) * r);
          cam.lookAt(0, config.mode === 'hand' ? 1.05 : 1.0, 0);
          if (t < 1) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });

      const poster = document.createElement('canvas');
      poster.width = 1080;
      poster.height = 1350; // 4:5 — poster ratio
      const g = poster.getContext('2d')!;
      g.fillStyle = '#07090f';
      g.fillRect(0, 0, poster.width, poster.height);

      // stage image inside a 1px frame (the interface grammar)
      const inset = 54;
      const frameW = poster.width - inset * 2;
      const frameH = poster.height - inset * 2 - 120;
      stage.renderer.render(stage.scene, stage.camera);
      const sw = stageCanvas.width;
      const sh = stageCanvas.height;
      const scale = Math.max(frameW / sw, frameH / sh); // cover
      const dw = sw * scale;
      const dh = sh * scale;
      g.save();
      g.beginPath();
      g.rect(inset, inset, frameW, frameH);
      g.clip();
      g.drawImage(stageCanvas, inset + (frameW - dw) / 2, inset + (frameH - dh) / 2, dw, dh);
      g.restore();
      g.strokeStyle = '#2a3650';
      g.lineWidth = 1;
      g.strokeRect(inset + 0.5, inset + 0.5, frameW, frameH);

      // mono labels + serif mark
      const subject = config.mode === 'hand' ? handMode.puppetId() : getAvatarDef(config.avatar).label;
      g.font = '500 17px "JetBrains Mono Variable", monospace';
      g.fillStyle = '#66748f';
      g.textAlign = 'left';
      g.fillText(`STAGE · ${subject.toUpperCase()}`, inset, inset - 16);
      g.textAlign = 'right';
      g.fillText(new Date().toISOString().slice(0, 10), poster.width - inset, inset - 16);
      g.font = '420 44px "Fraunces Variable", Georgia, serif';
      g.fillStyle = '#e9f1ff';
      g.textAlign = 'left';
      g.fillText('PosePuppet', inset, poster.height - 64);
      g.font = '500 15px "JetBrains Mono Variable", monospace';
      g.fillStyle = '#c8ffdf';
      g.textAlign = 'right';
      g.fillText('ALL INFERENCE LOCAL', poster.width - inset, poster.height - 68);

      const a = document.createElement('a');
      a.href = poster.toDataURL('image/png');
      a.download = `posepuppet-poster-${Date.now().toString(36)}.png`;
      a.click();
    } finally {
      cam.position.copy(origPos);
      cam.quaternion.copy(origQuat);
      cam.updateProjectionMatrix();
      posterBusy = false;
      cameraOwned--;
    }
  }

  // command palette (⌘K) + single-key shortcuts — instrument controls
  const toggleCmd = (key: 'mirror' | 'smoothing' | 'rootMotion') => () => setConfig(key, !config[key]);
  const toggleCmd2 = (key: 'vfx' | 'autoCam') => () => setConfig(key, !config[key]);
  createPalette([
    { id: 'record', label: 'record · start / stop take', key: 'r',
      run: () => (recorder.recording ? recorder.stop() : recorder.start(15)) },
    { id: 'calibrate', label: 'calibrate · capture neutral pose (3-2-1)', key: 'c',
      run: calibrateWithCountdown },
    { id: 'avatar-next', label: 'avatar · next', key: 'a',
      run: () => setConfig('avatar', nextAvatarId(config.avatar)) },
    { id: 'theme', label: 'theme · toggle light / dark', key: 't',
      run: () => setConfig('theme', config.theme === 'dark' ? 'light' : 'dark') },
    { id: 'engineering', label: 'engineering view · toggle', key: 'd',
      run: () => document.getElementById('panel')!.classList.toggle('hidden') },
    { id: 'mirror', label: 'mirror · toggle', key: 'm', run: toggleCmd('mirror') },
    { id: 'smoothing', label: 'smoothing · toggle', run: toggleCmd('smoothing') },
    { id: 'legs', label: 'full body (legs) · toggle', key: 'f',
      run: () => setConfig('bodyMode', config.bodyMode === 'full' ? 'upper' : 'full') },
    { id: 'root', label: 'root motion · toggle', run: toggleCmd('rootMotion') },
    { id: 'video', label: 'input · load video file / back to camera', key: 'v',
      run: () => fileBtn.click() },
    { id: 'model', label: 'pose model · toggle full / lite',
      run: () => setConfig('model', config.model === 'full' ? 'lite' : 'full') },
    { id: 'ghost', label: 'memory · ghost duet on/off (last 8 s)', key: 'g',
      run: () => void toggleGhost() },
    { id: 'replay', label: 'memory · instant replay (last 5 s, slow)', key: 'i',
      run: () => void instantReplay() },
    { id: 'save-loop', label: 'memory · save last 8 s as loop',
      run: () => void saveCurrentLoop() },
    ...TAKE_SCRIPTS.map((s) => ({
      id: `take-${s.id}`,
      label: `take · ${s.name.toLowerCase()} (${s.shots.length} shots)`,
      run: () => {
        if (s.mode !== config.mode) setConfig('mode', s.mode);
        // wait a beat for a mode switch to settle, then begin
        setTimeout(() => director.begin(s), s.mode !== config.mode ? 1200 : 0);
      },
    })),
    { id: 'aspect', label: 'recording · toggle 16:9 / 9:16 vertical',
      run: () => setConfig('recAspect', config.recAspect === '16:9' ? '9:16' : '16:9') },
    { id: 'packaging', label: 'recording · toggle stinger/end card',
      run: () => setConfig('recPackage', !config.recPackage) },
    { id: 'poster', label: 'poster · export a designed still', key: 'p',
      run: () => void exportPoster() },
    { id: 'help', label: 'help · how to use (onboarding)',
      run: () => onboarding.show() },
    { id: 'vfx', label: 'velocity vfx · toggle', run: toggleCmd2('vfx') },
    { id: 'autocam', label: 'auto-director camera · toggle', run: toggleCmd2('autoCam') },
    { id: 'fly', label: 'fly · bodyarcade flight (body streams into the game)',
      run: () => startFlight() },
    { id: 'body-tuner', label: 'body input · tuner overlay', key: 'b',
      run: () => {
        let host = document.getElementById('bi-tuner-host');
        if (!host) {
          host = document.createElement('div');
          host.id = 'bi-tuner-host';
          host.style.cssText = 'position:fixed;right:12px;bottom:64px;z-index:40;';
          document.body.append(host);
        }
        bodyInput.toggleTuner(host);
      } },
  ]);
  onConfigChange((key) => {
    if (key === 'model') void detector.setModel(config.model);
  });

  const evalCollector = evalFixture
    ? new EvalCollector(evalFixture, evalDuration, {
        stage,
        detector,
        video,
        getAvatar: () => avatar,
        getHeadRadius: () => retargeter.faceTouchDebug.left.headR,
        getFaceTouch: () => retargeter.faceTouchDebug,
        getDetectionFps: () => (config.mode === 'hand' ? handMode.handFps() : detector.poseFps()),
      })
    : null;
  evalCollector?.start();

  // reusable mirror buffers — no per-frame allocation
  const mNorm: LandmarkPoint[] = [];
  const mWorld: LandmarkPoint[] = [];

  function onPoseFrame(frame: PoseFrame | null) {
    // the camera overlay always draws the RAW detection — predicted
    // landmarks never appear over the real video (honesty line)
    drawSkeleton(overlayCtx, frame ? frame.norm : null, overlay.width, overlay.height);

    const tMs = frame ? frame.wallTimeMs : performance.now();
    let world: LandmarkPoint[] | null = null;
    let norm: LandmarkPoint[] | null = null;
    if (frame) {
      window.__PP.lastDetectionAt = frame.wallTimeMs;
      window.__PP.detectionCount++;
      norm = config.mirror ? mirrorNorm(frame.norm, mNorm) : frame.norm;
      world = config.mirror ? mirrorWorld(frame.world, mWorld) : frame.world;
    }

    // Predictive Pose Continuity: may briefly carry the stream through an
    // occlusion (≤ 400 ms, decaying confidence) or synthesize through a
    // short full dropout; null once faded — every consumer inherits it
    const cont = continuity.apply(world, norm, tMs);

    if (cont) {
      const worldSmooth = smoother.apply(cont.world, tMs);
      retargeter.updateFromPose(worldSmooth, cont.norm, tMs);
      poseRing.push(encodePoseFrame(worldSmooth, cont.norm, tMs));
      latestNorm = cont.norm;
      intents.onLandmarks(cont.norm, tMs);
      bodyInput.onPoseFrame(cont.world, cont.norm, tMs);
      // detection honesty: a synthesized dropout frame is NOT a detection —
      // eval only sees frames the detector actually produced
      evalCollector?.onPoseFrame(frame ? cont.norm : null);
    } else {
      retargeter.updateFromPose(null, null);
      latestNorm = null;
      intents.onLandmarks(null, tMs);
      bodyInput.onPoseFrame(null, null, tMs);
      evalCollector?.onPoseFrame(null);
    }
  }

  // in hand mode the pose detector never starts (it would hallucinate a
  // body from the hand and pollute eval sync rows); switching back to
  // character mode starts it via applyMode
  if (config.mode !== 'hand') detector.start(video, onPoseFrame);

  // ── hand-only mode: a first-class mode beside Character ─────────────
  const stageLabel = document.getElementById('stage-label');
  const stageAvatarEl = document.getElementById('stage-avatar');
  const modeCharBtn = document.getElementById('mode-character') as HTMLButtonElement;
  const modeHandBtn = document.getElementById('mode-hand') as HTMLButtonElement;
  modeHandBtn.disabled = false;
  modeHandBtn.title = 'one-hand puppets: expressive hand, beaky, x-ray';

  function syncStageLabel(): void {
    if (!stageLabel || !stageAvatarEl) return;
    const name = config.mode === 'hand' ? handMode.puppetId() : getAvatarDef(config.avatar).label;
    const suffix = config.mode === 'hand' ? 'HAND-ONLY' : 'CHARACTER MODE';
    stageLabel.innerHTML = '';
    stageLabel.append('STAGE · ');
    stageAvatarEl.textContent = name.toUpperCase();
    stageLabel.append(stageAvatarEl);
    stageLabel.append(` · ${suffix}`);
  }

  async function applyMode(): Promise<void> {
    const hand = config.mode === 'hand';
    modeCharBtn.setAttribute('aria-pressed', String(!hand));
    modeHandBtn.setAttribute('aria-pressed', String(hand));
    document.body.classList.toggle('hand-mode', hand);
    if (hand) {
      detector.stop();
      avatar.object.visible = false;
      handMode.object.visible = true;
      stage.setTreatment('hand');
      handMode.setPuppet(config.handPuppet);
      await handMode.start(video);
      hud.setSource('hand');
    } else {
      handMode.stop();
      handMode.object.visible = false;
      avatar.object.visible = true;
      stage.setTreatment('character');
      drawSkeleton(overlayCtx, null, overlay.width, overlay.height);
      detector.start(video, onPoseFrame);
      hud.setSource('pose');
    }
    syncStageLabel();
    rebuildCards();
  }

  modeCharBtn.onclick = () => setConfig('mode', 'character');
  modeHandBtn.onclick = () => setConfig('mode', 'hand');
  onConfigChange((key) => {
    if (key === 'mode') void applyMode();
    if (key === 'handPuppet' && config.mode === 'hand') {
      handMode.setPuppet(config.handPuppet);
      syncStageLabel();
      rebuildCards();
    }
    if (key === 'avatar') syncStageLabel();
  });

  // hand-mode overlay drawing + puppet card roster
  handMode.onFrameHook = (frame) => {
    if (config.mode !== 'hand') return;
    if (frame) {
      window.__PP.lastDetectionAt = frame.wallTimeMs;
      window.__PP.detectionCount++;
      handRing.push(encodeHandFrame(frame.norm, frame.wallTimeMs));
    }
    handMode.drawOverlay(overlayCtx, overlay.width, overlay.height);
    evalCollector?.onHandFrame(Boolean(frame), handMode.beakySignals());
  };

  function rebuildCards(): void {
    const host = document.getElementById('avatar-cards');
    const count = document.getElementById('avatar-count');
    if (!host) return;
    if (config.mode === 'hand') {
      host.innerHTML = '';
      if (count) count.textContent = String(HAND_PUPPETS.length).padStart(2, '0');
      for (const def of HAND_PUPPETS) {
        const card = document.createElement('button');
        card.className = 'card' + (def.id === config.handPuppet ? ' on' : '');
        card.dataset.puppet = def.id;
        const preview = document.createElement('div');
        preview.className = 'preview';
        preview.textContent = def.glyph;
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = def.label;
        const chip = document.createElement('span');
        chip.className = 'chip exp';
        chip.textContent = def.chip;
        const note = document.createElement('div');
        note.className = 'card-note';
        note.textContent = def.note;
        card.append(preview, nm, chip, note);
        card.onclick = () => setConfig('handPuppet', def.id as HandPuppetId);
        host.append(card);
      }
    } else {
      host.innerHTML = '';
      createAvatarCards();
    }
  }

  if (config.mode === 'hand') await applyMode();
  else syncStageLabel();

  // performance auto-tuner: sustained low pose FPS on the full model →
  // the coach offers the lite model + reduced effects, one click. Suggested
  // at most once per session; applying flips model and adds a perf-lite
  // class that drops backdrop blur and halo shadows.
  let lowFpsSec = 0;
  let tunerOffered = false;
  function applyPerfLite(): void {
    setConfig('model', 'lite');
    document.body.classList.add('perf-lite');
  }

  let hudAccum = 0;
  stage.onTick((dt, time) => {
    if (config.mode === 'hand') {
      handMode.tick(dt, time);
    } else {
      retargeter.tick(dt);
      avatar.update(dt, time);
    }
    ghosts.tick(dt, time);
    vfx.tick(dt, avatar);
    autoCam.tick(
      dt,
      avatar.object.position.x,
      retargeter.motionEnergy(),
      performance.now() - window.__PP.lastDetectionAt < 1200,
    );
    hudAccum += dt;
    if (hudAccum > 0.25) {
      hudAccum = 0;
      hud.setRenderFps(stage.renderFps());
      hud.setPoseFps(config.mode === 'hand' ? handMode.handFps() : detector.poseFps());
      hud.setRig(config.mode === 'hand' ? (handMode.lastDetectionAt() > 0 ? 1 : 0) : retargeter.activeBoneCount());
      hud.tick(window.__PP.lastDetectionAt, window.__PP.videoReady);
      updatePpcStates(continuity.states());
      visibilityCoach(performance.now());

      const fps = detector.poseFps();
      const live = window.__PP.videoReady && performance.now() - window.__PP.lastDetectionAt < 1500;
      if (!tunerOffered && config.model === 'full' && live && fps > 0 && fps < 22) {
        lowFpsSec += 0.25;
        if (lowFpsSec >= 5) {
          tunerOffered = true;
          coach.set(
            'Performance',
            'Tracking is running slow on this machine. The lite model keeps motion smooth.',
            { label: 'Switch to lite', run: applyPerfLite },
          );
        }
      } else if (fps >= 24) {
        lowFpsSec = 0;
      }
    }
  });
}

boot();
