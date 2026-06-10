// Boot: webcam (or fixture via ?video=), Three.js stage, HUD.
// The capture → detect → retarget → render loop is imperative; no framework.

import { startCamera, startVideoFile, watchLayout, layoutOverlay, setMirrored } from './camera';
import { createStage } from './stage/scene';
import { createHud } from './ui/hud';

declare global {
  interface Window {
    __PP: {
      videoReady: boolean;
      cameraError: string | null;
      renderFps: () => number;
      poseFps: () => number;
    };
  }
}

async function boot() {
  const video = document.getElementById('video') as HTMLVideoElement;
  const overlay = document.getElementById('overlay') as HTMLCanvasElement;
  const pane = document.getElementById('camera-pane')!;
  const statusEl = document.getElementById('camera-status')!;
  const stageCanvas = document.getElementById('stage') as HTMLCanvasElement;

  const els = { video, overlay, pane };
  const hud = createHud();
  const stage = createStage(stageCanvas);

  window.__PP = {
    videoReady: false,
    cameraError: null,
    renderFps: () => stage.renderFps(),
    poseFps: () => 0,
  };

  watchLayout(els);
  setMirrored(els, true);

  const params = new URLSearchParams(location.search);
  const videoParam = params.get('video'); // e.g. ?video=/fixtures/arms.mp4 (dev only)

  try {
    if (videoParam) {
      await startVideoFile(video, videoParam);
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

  stage.onTick(() => {
    hud.setRenderFps(stage.renderFps());
  });
}

boot();
