// Boot + the imperative capture → detect → retarget → render pipeline.
// No framework in the hot path; UI chrome is plain DOM.

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
import type { Avatar } from './rig/types';
import { type AvatarId, isAvatarId, getAvatarDef, nextAvatarId, loadAvatarById } from './rig/avatarRegistry';
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

  const params = new URLSearchParams(location.search);
  const evalFixture = params.get('eval');
  const evalDuration = Number(params.get('dur') ?? 60);
  const modelVariant = (params.get('model') ?? config.model) as ModelVariant;
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
  };

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
