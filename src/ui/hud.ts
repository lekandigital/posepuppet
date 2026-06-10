// FPS + status HUD. Updated at a low cadence from the render loop; never
// touches per-frame data structures.

export interface Hud {
  setPoseFps(fps: number): void;
  setRenderFps(fps: number): void;
  setLive(live: boolean): void;
}

export function createHud(): Hud {
  const poseEl = document.getElementById('hud-pose')!;
  const renderEl = document.getElementById('hud-render')!;
  const liveEl = document.getElementById('live-badge')!;
  return {
    setPoseFps(fps) {
      poseEl.textContent = `pose ${fps > 0 ? fps.toFixed(0) : '—'} fps`;
    },
    setRenderFps(fps) {
      renderEl.textContent = `render ${fps > 0 ? fps.toFixed(0) : '—'} fps`;
    },
    setLive(live) {
      liveEl.classList.toggle('hidden', !live);
    },
  };
}
