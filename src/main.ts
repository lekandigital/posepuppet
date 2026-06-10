// Boot + the imperative capture → detect → retarget → render pipeline.
// No framework in the hot path; UI chrome is plain DOM.

import { startCamera, startVideoFile, watchLayout, layoutOverlay, setMirrored } from './camera';
import { createStage } from './stage/scene';
import { createHud } from './ui/hud';
import { createPanel } from './ui/panel';
import { config, onConfigChange } from './config';
import { createDetector, type ModelVariant } from './pose/detector';
import { drawSkeleton } from './overlay/skeleton';
import { mirrorNorm, mirrorWorld } from './pose/mirror';
import { LandmarkSmoother } from './pose/smoothing';
import type { LandmarkPoint, PoseFrame } from './pose/types';
import { createRobot } from './rig/robot';
import { Retargeter } from './rig/retarget';
import type { Avatar } from './rig/types';
import { EvalCollector } from './eval/runner';

declare global {
  interface Window {
    __PP: {
      videoReady: boolean;
      cameraError: string | null;
      renderFps: () => number;
      poseFps: () => number;
      lastDetectionAt: number;
      detectionCount: number;
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
  // ?src=file plays the fixture mp4 directly (manual eval without fake cam)
  const videoSrc =
    params.get('video') ?? (evalFixture && params.get('src') === 'file' ? `/fixtures/${evalFixture}.mp4` : null);

  const els = { video, overlay, pane };
  const hud = createHud();
  const stage = createStage(stageCanvas);
  createPanel();

  let avatar: Avatar = createRobot();
  stage.scene.add(avatar.object);
  let retargeter = new Retargeter(avatar);

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
