// mountPoseHud — the console-system overlay every BodyArcade game mounts.
// Compact, bottom-left by default, collapsible; hover/focus expands and a
// click (or keyboard) swaps the preview for the live camera feed. Full
// keyboard parity with every hover behavior. No settings panel — state
// display + the two permitted actions (collapse, start camera) only.

import type { PoseRuntime, RuntimeState } from '@bodyarcade/pose-runtime';
import { createPreviewRenderer, type PreviewRenderer } from './preview2d';
import { injectHudStyles } from './styles';

export type HudPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface PoseHudOptions {
  host?: HTMLElement; // default document.body
  position?: HudPosition; // default bottom-left
  /** Safe-area hint: px offsets from the chosen corner so the HUD never
   *  overlaps critical game controls (e.g. rowing strip → y: 96). */
  safeArea?: { x?: number; y?: number };
  collapsed?: boolean;
  /** Mono title chip, e.g. 'POSE' (default). */
  title?: string;
}

export interface PoseHudHandle {
  root: HTMLElement;
  expand(): void;
  collapse(): void;
  toggle(): void;
  collapsed(): boolean;
  setSafeArea(sa: { x?: number; y?: number }): void;
  /** Pin the preview degradation tier (null restores auto). */
  setPreviewTier(t: number | null): void;
  stats(): { tier: number; drawMsAvg: number; pageFps: number };
  unmount(): void;
}

const SIGNAL_FRESH_MS = 1500;
const REMOTE_STALE_MS = 3000;
const FLASH_MS = 2500;

export function mountPoseHud(runtime: PoseRuntime, opts: PoseHudOptions = {}): PoseHudHandle {
  const doc = (opts.host ?? document.body).ownerDocument!;
  injectHudStyles(doc);

  const root = doc.createElement('section');
  root.className = 'pp-hud';
  root.tabIndex = 0;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Body tracking');
  root.dataset.testid = 'pp-hud';
  root.setAttribute('data-testid', 'pp-hud');
  root.dataset.pos = opts.position ?? 'bottom-left';
  root.dataset.open = opts.collapsed ? 'collapsed' : 'open';
  root.dataset.feed = 'preview';
  root.dataset.size = 'compact';
  root.dataset.msg = '0';
  root.dataset.swap = '0';
  root.dataset.startable = '0';

  root.innerHTML = `
    <header class="pp-hud-head">
      <span class="pp-hud-dot" data-s="off"></span>
      <span class="pp-hud-title"></span>
      <span class="pp-hud-track" data-testid="pp-hud-track">OFF</span>
      <button class="pp-hud-btn pp-hud-toggle" data-testid="pp-hud-toggle"
              aria-expanded="${!opts.collapsed}" aria-label="Toggle tracking HUD"></button>
    </header>
    <div class="pp-hud-stage">
      <canvas class="pp-hud-canvas" width="248" height="192"></canvas>
      <video class="pp-hud-cam" muted playsinline aria-hidden="true"></video>
      <div class="pp-hud-msg" aria-live="polite" data-testid="pp-hud-msg"></div>
      <button class="pp-hud-start" data-testid="pp-hud-start">START CAMERA</button>
      <button class="pp-hud-swap" data-testid="pp-hud-swap" aria-label="Show camera feed">CAM</button>
    </div>
    <footer class="pp-hud-foot">
      <span class="pp-hud-privacy" title="All inference runs in this page — nothing is uploaded.">LOCAL INFERENCE</span>
      <span class="pp-hud-flash" data-on="0">RECENTERED ✓</span>
    </footer>
  `;
  (root.querySelector('.pp-hud-title') as HTMLElement).textContent = opts.title ?? 'POSE';

  const dot = root.querySelector('.pp-hud-dot') as HTMLElement;
  const track = root.querySelector('.pp-hud-track') as HTMLElement;
  const toggleBtn = root.querySelector('.pp-hud-toggle') as HTMLButtonElement;
  const canvas = root.querySelector('.pp-hud-canvas') as HTMLCanvasElement;
  const cam = root.querySelector('.pp-hud-cam') as HTMLVideoElement;
  const msg = root.querySelector('.pp-hud-msg') as HTMLElement;
  const startBtn = root.querySelector('.pp-hud-start') as HTMLButtonElement;
  const swapBtn = root.querySelector('.pp-hud-swap') as HTMLButtonElement;
  const flash = root.querySelector('.pp-hud-flash') as HTMLElement;
  const stage = root.querySelector('.pp-hud-stage') as HTMLElement;

  function setSafeArea(sa: { x?: number; y?: number }): void {
    root.style.setProperty('--pph-x', `${sa.x ?? 12}px`);
    root.style.setProperty('--pph-y', `${sa.y ?? 12}px`);
  }
  setSafeArea(opts.safeArea ?? {});

  const glyph = () => {
    toggleBtn.textContent = root.dataset.open === 'collapsed' ? '▴' : '▾';
  };
  glyph();

  const preview: PreviewRenderer = createPreviewRenderer(canvas, runtime);

  // ── open/collapse + hover/focus expansion (keyboard parallels hover) ──
  function setOpen(open: boolean): void {
    root.dataset.open = open ? 'open' : 'collapsed';
    toggleBtn.setAttribute('aria-expanded', String(open));
    glyph();
  }
  function setPeek(on: boolean): void {
    root.classList.toggle('pp-hud-peek', on);
    root.dataset.size = on || root.matches(':hover, :focus-within') ? 'expanded' : 'compact';
  }
  root.addEventListener('mouseenter', () => setPeek(true));
  root.addEventListener('mouseleave', () => setPeek(false));
  root.addEventListener('focusin', () => setPeek(true));
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) setPeek(false);
  });
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(root.dataset.open === 'collapsed');
  });

  // ── feed swap: preview ↔ live camera (click stage, or keyboard) ──────
  function canSwap(): boolean {
    return runtime.mediaStream() !== null && root.dataset.msg !== '1';
  }
  function setFeed(feed: 'preview' | 'camera'): void {
    if (feed === 'camera') {
      const stream = runtime.mediaStream();
      if (!stream) return;
      if (cam.srcObject !== stream) cam.srcObject = stream;
      void cam.play().catch(() => {});
      swapBtn.textContent = 'FIG';
      swapBtn.setAttribute('aria-label', 'Show preview figure');
    } else {
      cam.srcObject = null;
      swapBtn.textContent = 'CAM';
      swapBtn.setAttribute('aria-label', 'Show camera feed');
    }
    root.dataset.feed = feed;
  }
  function swapFeed(): void {
    if (!canSwap()) return;
    setFeed(root.dataset.feed === 'camera' ? 'preview' : 'camera');
  }
  stage.addEventListener('click', (e) => {
    if (e.target === startBtn || e.target === swapBtn) return;
    swapFeed();
  });
  swapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    swapFeed();
  });
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void runtime.start();
  });

  root.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(root.dataset.open === 'collapsed');
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'c' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (root.dataset.open !== 'collapsed') swapFeed();
    }
  });

  // ── status: runtime state + signal freshness → mono readout ─────────
  let flashUntil = 0;
  const unsubSignals = runtime.signals.subscribe((s) => {
    if (s.events.includes('recenter')) flashUntil = performance.now() + FLASH_MS;
  });

  function status(now: number): void {
    const st: RuntimeState = runtime.state();
    let d = 'off';
    let label = 'OFF';
    let message = '';
    let startable = false;

    if (st === 'denied') {
      d = 'bad';
      label = 'CAMERA DENIED';
      message = 'CAMERA DENIED\nKEYBOARD CONTROLS ACTIVE';
      startable = true;
    } else if (st === 'error') {
      d = 'bad';
      label = 'CAMERA ERROR';
      message = 'CAMERA ERROR\nKEYBOARD CONTROLS ACTIVE';
      startable = true;
    } else if (st === 'external') {
      const age = runtime.externalSignalAgeMs();
      if (age < REMOTE_STALE_MS) {
        d = 'live';
        label = 'REMOTE FEED';
        message = 'TRACKING FROM THE\nPOSEPUPPET TAB';
      } else {
        d = 'warn';
        label = 'REMOTE LOST';
        message = 'REMOTE FEED ENDED';
        startable = true;
      }
    } else if (st === 'electing' || st === 'starting') {
      d = 'warn';
      label = 'STARTING…';
    } else if (st === 'loading-model') {
      d = 'warn';
      label = 'LOADING MODEL…';
    } else if (st === 'running' || st === 'file') {
      const f = runtime.preview.latest();
      const age = f ? now - f.t : Infinity;
      if (age > SIGNAL_FRESH_MS) {
        d = 'warn';
        label = 'SIGNAL LOST';
      } else if (!f!.live) {
        d = 'warn';
        label = 'REACQUIRING';
      } else {
        d = 'live';
        label = `${st === 'file' ? 'FILE' : 'LIVE'} · ${Math.round(runtime.poseFps())} HZ`;
      }
    } else if (st === 'idle' || st === 'stopped') {
      d = 'off';
      label = 'OFF';
      message = 'TRACKING OFF';
      startable = st === 'idle';
    }

    dot.dataset.s = d;
    if (track.textContent !== label) track.textContent = label;
    const showMsg = message !== '';
    root.dataset.msg = showMsg ? '1' : '0';
    if (showMsg && msg.textContent !== message) msg.innerText = message;
    root.dataset.startable = startable ? '1' : '0';
    root.dataset.state = st;
    root.dataset.swap = canSwap() ? '1' : '0';
    if (root.dataset.feed === 'camera' && !canSwap()) setFeed('preview');
    flash.dataset.on = now < flashUntil ? '1' : '0';
  }

  // ── loop ─────────────────────────────────────────────────────────────
  let raf = 0;
  let lastStatus = 0;
  let unmounted = false;
  function loop(now: number): void {
    if (unmounted) return;
    preview.tick(now);
    if (now - lastStatus > 250) {
      lastStatus = now;
      status(now);
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  (opts.host ?? doc.body).append(root);

  return {
    root,
    expand: () => setOpen(true),
    collapse: () => setOpen(false),
    toggle: () => setOpen(root.dataset.open === 'collapsed'),
    collapsed: () => root.dataset.open === 'collapsed',
    setSafeArea,
    setPreviewTier: (t) => preview.setTier(t),
    stats: () => preview.stats(),
    unmount() {
      unmounted = true;
      cancelAnimationFrame(raf);
      unsubSignals();
      preview.dispose();
      root.remove();
    },
  };
}
