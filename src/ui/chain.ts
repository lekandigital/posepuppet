// The take bar's signal chain — the app's signature element and its
// truth-teller: CAM ▸ POSE ▸ SMOOTH ▸ RIG ▸ RENDER ▸ REC. Each node lights
// cyan while its pipeline stage is flowing, dims when idle, and goes red
// when a stage that should be flowing has stalled. Updated at low cadence
// from the render loop; reads nothing per-frame.

import { config } from '../config';

type NodeState = 'on' | 'dim' | 'bad';

export interface Chain {
  setSource(s: 'pose' | 'hand'): void; // relabels the detection node
  setCam(label: string | null): void; // "LIVE 1280×720" | "FILE" | null=lost
  setPoseFps(fps: number): void;
  setRenderFps(fps: number): void;
  setRig(activeBones: number): void;
  setRec(recording: boolean, elapsedSec: number): void;
  setLive(live: boolean): void;
  /** Call at HUD cadence (~4/s); applies smoothing/staleness coloring. */
  tick(lastDetectionAt: number, videoReady: boolean): void;
}

function setState(el: HTMLElement, state: NodeState): void {
  el.classList.toggle('dim', state === 'dim');
  el.classList.toggle('bad', state === 'bad');
}

export function createChain(): Chain {
  const cam = document.getElementById('chain-cam')!;
  const camVal = cam.querySelector('span')!;
  const pose = document.getElementById('chain-pose')!;
  const poseVal = document.getElementById('hud-pose')!;
  const smooth = document.getElementById('chain-smooth')!;
  const rig = document.getElementById('chain-rig')!;
  const render = document.getElementById('chain-render')!;
  const renderVal = document.getElementById('hud-render')!;
  const rec = document.getElementById('chain-rec')!;
  const recVal = document.getElementById('chain-rec-val')!;
  const liveBadge = document.getElementById('live-badge')!;
  const trackStatus = document.getElementById('track-status')!;
  const camMeta = document.getElementById('cam-meta')!;

  let lastPoseFps = 0;

  const poseLabel = pose.querySelector('b')!;

  return {
    setSource(s) {
      poseLabel.textContent = s === 'hand' ? 'HAND' : 'POSE';
    },
    setCam(label) {
      if (label) {
        camVal.textContent = label.split(' ')[0]; // LIVE | FILE
        camMeta.textContent = `CAM ${label.split(' ').slice(1).join(' ') || 'OK'}`;
        setState(cam, 'on');
      } else {
        camVal.textContent = '—';
        camMeta.textContent = 'CAM —';
        setState(cam, 'dim');
      }
    },
    setPoseFps(fps) {
      lastPoseFps = fps;
      poseVal.textContent = fps > 0 ? fps.toFixed(0) : '—';
    },
    setRenderFps(fps) {
      renderVal.textContent = fps > 0 ? fps.toFixed(0) : '—';
      setState(render, fps > 0 ? 'on' : 'dim');
    },
    setRig(activeBones) {
      setState(rig, activeBones > 0 ? 'on' : 'dim');
    },
    setRec(recording, elapsedSec) {
      recVal.textContent = recording ? `${elapsedSec.toFixed(0)}s` : '—';
      setState(rec, recording ? 'bad' : 'dim'); // 'bad' = red — recording reads red on purpose
    },
    setLive(live) {
      liveBadge.classList.toggle('hidden', !live);
      liveBadge.textContent = live ? 'LIVE' : 'FILE';
    },
    tick(lastDetectionAt, videoReady) {
      const fresh = performance.now() - lastDetectionAt < 600;
      if (fresh) {
        setState(pose, 'on');
        trackStatus.textContent = 'TRACKING';
        trackStatus.className = 'ok';
      } else if (videoReady && lastPoseFps > 0) {
        // had signal, lost it — the stall the chain exists to surface
        setState(pose, 'bad');
        trackStatus.textContent = 'NO SIGNAL';
        trackStatus.className = 'warn';
      } else {
        setState(pose, 'dim');
        trackStatus.textContent = '—';
        trackStatus.className = '';
      }
      setState(smooth, config.smoothing ? 'on' : 'dim');
    },
  };
}
