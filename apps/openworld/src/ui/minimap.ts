// Minimap — drawn from the artifact's style-free minimap vectors (the
// SAME data in every profile; only this one chrome treatment exists).
// Mono/dark diagnostics language; player arrow + optional route markers.

import type { WorldRuntime } from '../world/runtime';

export interface Minimap {
  update(x: number, z: number, yawDeg: number): void;
  dispose(): void;
}

const SIZE = 172;

export function createMinimap(container: HTMLElement, world: WorldRuntime): Minimap {
  const wrap = document.createElement('div');
  wrap.dataset.testid = 'ow-minimap';
  wrap.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', `width:${SIZE}px`, `height:${SIZE}px`,
    'background:rgba(10,12,16,0.78)', 'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:4px', 'z-index:30', 'pointer-events:none', 'overflow:hidden',
  ].join(';');
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * devicePixelRatio;
  canvas.height = SIZE * devicePixelRatio;
  canvas.style.cssText = 'width:100%;height:100%';
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  const g = canvas.getContext('2d')!;
  g.scale(devicePixelRatio, devicePixelRatio);

  const mm = world.world.minimap;
  const [vx, vy, vw, vh] = mm.viewBox;
  const s = SIZE / Math.max(vw, vh);
  const ox = (SIZE - vw * s) / 2;
  const oy = (SIZE - vh * s) / 2;
  // world (x east, y north) → canvas (x right, y DOWN => flip north)
  const px = (wx: number): number => ox + (wx - vx) * s;
  const py = (wy: number): number => oy + (vy + vh - wy) * s;

  // static layer, drawn once to an offscreen canvas
  const staticC = document.createElement('canvas');
  staticC.width = canvas.width;
  staticC.height = canvas.height;
  const sg = staticC.getContext('2d')!;
  sg.scale(devicePixelRatio, devicePixelRatio);
  sg.fillStyle = '#10141b';
  sg.fillRect(0, 0, SIZE, SIZE);
  sg.fillStyle = 'rgba(50,120,160,0.55)';
  for (const w of mm.water) {
    sg.beginPath();
    for (let i = 0; i < w.outer.length; i++) {
      const [wx, wy] = w.outer[i];
      if (i === 0) sg.moveTo(px(wx), py(wy)); else sg.lineTo(px(wx), py(wy));
    }
    sg.closePath();
    for (const hole of w.holes) {
      for (let i = 0; i < hole.length; i++) {
        const [wx, wy] = hole[i];
        if (i === 0) sg.moveTo(px(wx), py(wy)); else sg.lineTo(px(wx), py(wy));
      }
      sg.closePath();
    }
    sg.fill('evenodd');
  }
  sg.lineWidth = 1;
  for (const r of mm.roads) {
    sg.strokeStyle = r.class === 'major' ? 'rgba(210,220,235,0.8)' : 'rgba(150,160,180,0.45)';
    sg.beginPath();
    for (let i = 0; i < r.pts.length; i++) {
      const [wx, wy] = r.pts[i];
      if (i === 0) sg.moveTo(px(wx), py(wy)); else sg.lineTo(px(wx), py(wy));
    }
    sg.stroke();
  }
  sg.strokeStyle = 'rgba(240,245,255,0.9)';
  sg.lineWidth = 2;
  for (const r of mm.runways) {
    sg.beginPath();
    for (let i = 0; i < r.pts.length; i++) {
      const [wx, wy] = r.pts[i];
      if (i === 0) sg.moveTo(px(wx), py(wy)); else sg.lineTo(px(wx), py(wy));
    }
    sg.stroke();
  }
  for (const sp of mm.spawns) {
    sg.fillStyle = sp.kind === 'airfield' ? '#cfe8ff' : sp.kind === 'dock' ? '#ffd9a8' : sp.kind === 'dive' ? '#a8ffd9' : '#e8e8ff';
    sg.beginPath();
    sg.arc(px(sp.pos[0]), py(sp.pos[1]), 2.2, 0, Math.PI * 2);
    sg.fill();
  }
  // ODbL: the minimap is OSM-derived — keep a credit inside the tile
  sg.font = '7px ui-monospace, Menlo, monospace';
  sg.fillStyle = 'rgba(220,230,240,0.55)';
  sg.fillText('© OpenStreetMap', 6, SIZE - 5);

  return {
    update(x: number, z: number, yawDeg: number): void {
      g.clearRect(0, 0, SIZE, SIZE);
      g.drawImage(staticC, 0, 0, SIZE, SIZE);
      // player arrow (scene z = -north)
      const cx = px(x);
      const cy = py(-z);
      const a = (yawDeg * Math.PI) / 180;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = '#9fd8ff';
      g.beginPath();
      g.moveTo(0, -5);
      g.lineTo(3.4, 4);
      g.lineTo(-3.4, 4);
      g.closePath();
      g.fill();
      g.restore();
    },
    dispose(): void {
      wrap.remove();
    },
  };
}
