// Loop library: the creative layer over Motion Memory. Cards (deterministic
// skeleton thumbnail, inline rename, delete), a motion-tape editor (energy
// over time with draggable in/out handles → live trimmed preview on the
// ghost), best-5s snap, and playback controls: duet / echo chorus / mirror,
// ghost opacity and echo-delay presets. Everything plays through the same
// GhostPlayer → Retargeter path as v1, on the CURRENT avatar — re-skin is
// the default, not a feature. Playback only; nothing here scores anything.

import type { AvatarId } from '../rig/avatarRegistry';
import type { GhostPlayer } from './ghost';
import type { MotionLoop } from './stream';
import {
  listLoops,
  loadLoop,
  deleteLoop,
  renameLoop,
  saveLoop,
  finalizeLoop,
  storageTotals,
  type LoopMeta,
} from './store';
import { energyCurve, bestWindow } from './energy';
import { trimLoop, MIN_TRIM_MS } from './trim';

export interface LibraryDeps {
  ghosts: GhostPlayer;
  avatarId: () => AvatarId;
  echoes: () => number;
  /** keep the take-bar ghost button truthful when the library drives playback */
  ghostState: (on: boolean) => void;
}

export interface Library {
  open(): void;
  close(): void;
  refresh(): Promise<void>;
  readonly isOpen: boolean;
}

const OPACITY_PRESETS = [
  { label: 'faint', value: 0.25 },
  { label: 'half', value: 0.45 },
  { label: 'solid', value: 0.7 },
];
const DELAY_PRESETS = [
  { label: 'tight', value: 150 },
  { label: 'beat', value: 300 },
  { label: 'wide', value: 600 },
];

const fmtDur = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const fmtBytes = (b: number) =>
  b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** The oldest-eviction prompt backing saveLoopBounded — a real dialog, not
 *  a silent delete. Lists what would go; nothing happens on cancel. */
export function confirmEvictDialog(candidates: LoopMeta[]): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'mml-evict-overlay';
    const names = candidates.map((c) => `${c.name} · ${fmtDur(c.durationMs)}`).join('\n');
    overlay.innerHTML = `
      <div class="mml-evict" role="alertdialog" aria-label="loop storage full">
        <div class="mml-evict-hdr">LOOP STORAGE FULL</div>
        <p>Saving needs room. Delete the ${candidates.length === 1 ? 'oldest loop' : `${candidates.length} oldest loops`}?</p>
        <pre>${names.replace(/</g, '&lt;')}</pre>
        <div class="mml-evict-row">
          <button class="mml-btn" data-act="cancel">keep everything</button>
          <button class="mml-btn danger" data-act="evict">delete oldest &amp; save</button>
        </div>
      </div>`;
    document.body.append(overlay);
    const done = (ok: boolean) => {
      overlay.remove();
      resolve(ok);
    };
    (overlay.querySelector('[data-act="cancel"]') as HTMLButtonElement).onclick = () => done(false);
    (overlay.querySelector('[data-act="evict"]') as HTMLButtonElement).onclick = () => done(true);
    (overlay.querySelector('[data-act="evict"]') as HTMLButtonElement).focus();
  });
}

export function createLibrary(deps: LibraryDeps): Library {
  const overlay = document.createElement('div');
  overlay.id = 'library';
  overlay.className = 'mml hidden';
  overlay.innerHTML = `
    <div class="mml-box" role="dialog" aria-label="loop library">
      <header class="mml-hdr">
        <span class="mml-title">LOOP LIBRARY</span>
        <span class="mml-totals" id="mml-totals">—</span>
        <button class="mml-btn mml-close" title="close (esc)">esc</button>
      </header>
      <div class="mml-cards" id="mml-cards"></div>
      <div class="mml-editor hidden" id="mml-editor">
        <div class="mml-ed-hdr">
          <span class="mml-ed-name" id="mml-ed-name">—</span>
          <span class="mml-ed-read" id="mml-ed-read">—</span>
        </div>
        <canvas class="mml-tape" id="mml-tape" height="64" aria-label="motion tape: energy over time; drag the handles to trim"></canvas>
        <div class="mml-ed-row">
          <button class="mml-btn" id="mml-preview">▸ preview</button>
          <button class="mml-btn" id="mml-best">✦ best 5 s</button>
          <button class="mml-btn" id="mml-apply">✂ apply trim</button>
          <span class="mml-gap"></span>
          <button class="mml-btn mml-chip" id="mml-mirror" aria-pressed="false" title="sagittal mirror — right-handed motion performs left-handed">⇋ mirror</button>
        </div>
        <div class="mml-ed-row">
          <span class="mml-lbl">ghost</span>
          <span class="mml-set" id="mml-opacity"></span>
          <span class="mml-lbl">echo delay</span>
          <span class="mml-set" id="mml-delay"></span>
        </div>
      </div>
    </div>`;
  document.body.append(overlay);

  const $ = <T extends HTMLElement>(id: string) => overlay.querySelector(`#${id}`) as T;
  const cardsHost = $<HTMLDivElement>('mml-cards');
  const editor = $<HTMLDivElement>('mml-editor');
  const tape = $<HTMLCanvasElement>('mml-tape');
  const readout = $<HTMLSpanElement>('mml-ed-read');

  // editor state
  let current: MotionLoop | null = null;
  let curve: number[] = [];
  let inMs = 0;
  let outMs = 0;
  let mirror = false;
  let opacity = OPACITY_PRESETS[1].value;
  let delay = DELAY_PRESETS[1].value;
  let previewing = false;
  let previewTimer = 0;

  function playOpts() {
    return {
      echoes: deps.echoes(),
      echoOffsetMs: delay,
      baseOpacity: opacity,
      mirror,
    };
  }

  async function playLoop(loop: MotionLoop): Promise<void> {
    await deps.ghosts.start(loop, deps.avatarId(), playOpts());
    deps.ghostState(true);
  }

  function stopPlayback(): void {
    deps.ghosts.stop();
    deps.ghostState(false);
    previewing = false;
    $<HTMLButtonElement>('mml-preview').textContent = '▸ preview';
  }

  // ── motion tape ──────────────────────────────────────────────────────
  function drawTape(): void {
    if (!current) return;
    const dpr = window.devicePixelRatio || 1;
    const w = tape.clientWidth || 520;
    const h = 64;
    tape.width = Math.round(w * dpr);
    tape.height = Math.round(h * dpr);
    const ctx = tape.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const style = getComputedStyle(document.documentElement);
    const violet = style.getPropertyValue('--violet').trim() || '#9d7bff';
    const rule = style.getPropertyValue('--rule-2').trim() || '#2a3650';
    const ink3 = style.getPropertyValue('--ink-3').trim() || '#66748f';

    const dur = Math.max(current.durationMs, 1);
    const x = (ms: number) => (ms / dur) * w;
    const frames = current.frames;
    const peak = Math.max(...curve, 0.001);

    // energy bars — dimmed outside the trim window
    for (let i = 0; i < frames.length; i++) {
      const bx = x(frames[i].t);
      const bh = Math.max(1.5, (curve[i] / peak) * (h - 14));
      const inside = frames[i].t >= inMs && frames[i].t <= outMs;
      ctx.fillStyle = inside ? violet : rule;
      ctx.globalAlpha = inside ? 0.9 : 0.5;
      ctx.fillRect(bx, h - 8 - bh, Math.max(1, w / frames.length - 0.5), bh);
    }
    ctx.globalAlpha = 1;

    // baseline + second ticks
    ctx.fillStyle = rule;
    ctx.fillRect(0, h - 8, w, 1);
    ctx.fillStyle = ink3;
    ctx.font = '8px ui-monospace, monospace';
    for (let s = 0; s * 1000 <= dur; s++) {
      ctx.fillRect(x(s * 1000), h - 8, 1, 3);
      if (s % 2 === 0) ctx.fillText(`${s}s`, x(s * 1000) + 2, h - 1);
    }

    // in/out handles
    for (const [ms, glyph] of [
      [inMs, '▶'],
      [outMs, '◀'],
    ] as const) {
      const hx = x(ms);
      ctx.fillStyle = violet;
      ctx.fillRect(hx - 0.5, 0, 1.5, h - 8);
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(glyph, glyph === '▶' ? hx + 2 : hx - 9, 8);
    }
  }

  function setReadout(): void {
    readout.textContent = `in ${fmtDur(inMs)} · out ${fmtDur(outMs)} · keeps ${fmtDur(outMs - inMs)}`;
  }

  function schedulePreviewUpdate(): void {
    if (!previewing || !current) return;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      if (!previewing || !current) return;
      const t = trimLoop(current, inMs, outMs);
      if (t) deps.ghosts.setLoop(t);
    }, 140);
  }

  function setTrim(nextIn: number, nextOut: number): void {
    if (!current) return;
    inMs = Math.max(0, Math.min(nextIn, current.durationMs));
    outMs = Math.max(0, Math.min(nextOut, current.durationMs));
    // handles never cross — the window keeps its minimum width
    if (outMs - inMs < MIN_TRIM_MS) {
      outMs = Math.min(current.durationMs, inMs + MIN_TRIM_MS);
      if (outMs - inMs < MIN_TRIM_MS) inMs = Math.max(0, outMs - MIN_TRIM_MS);
    }
    setReadout();
    drawTape();
    schedulePreviewUpdate();
  }

  // drag the nearest handle — the tape itself is the trim control
  let dragging: 'in' | 'out' | null = null;
  const tapeMs = (ev: PointerEvent) => {
    const r = tape.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(r.width, 1)));
    return frac * (current?.durationMs ?? 0);
  };
  tape.addEventListener('pointerdown', (ev) => {
    if (!current) return;
    const ms = tapeMs(ev);
    dragging = Math.abs(ms - inMs) <= Math.abs(ms - outMs) ? 'in' : 'out';
    tape.setPointerCapture(ev.pointerId);
    if (dragging === 'in') setTrim(ms, outMs);
    else setTrim(inMs, ms);
  });
  tape.addEventListener('pointermove', (ev) => {
    if (!dragging || !current) return;
    const ms = tapeMs(ev);
    if (dragging === 'in') setTrim(Math.min(ms, outMs - MIN_TRIM_MS), outMs);
    else setTrim(inMs, Math.max(ms, inMs + MIN_TRIM_MS));
  });
  const endDrag = () => (dragging = null);
  tape.addEventListener('pointerup', endDrag);
  tape.addEventListener('pointercancel', endDrag);

  // ── editor ───────────────────────────────────────────────────────────
  async function openEditor(id: string): Promise<void> {
    const loop = await loadLoop(id);
    if (!loop) return;
    current = loop;
    curve = energyCurve(loop.frames, loop.kind);
    inMs = 0;
    outMs = loop.durationMs;
    editor.classList.remove('hidden');
    $<HTMLSpanElement>('mml-ed-name').textContent = loop.name;
    setReadout();
    // draw after layout so clientWidth is real
    requestAnimationFrame(drawTape);
  }

  function closeEditor(): void {
    if (previewing) stopPlayback();
    current = null;
    editor.classList.add('hidden');
  }

  $<HTMLButtonElement>('mml-preview').onclick = async () => {
    if (!current) return;
    if (previewing) {
      stopPlayback();
      return;
    }
    const t = trimLoop(current, inMs, outMs);
    if (!t) return;
    previewing = true;
    $<HTMLButtonElement>('mml-preview').textContent = '⏹ stop';
    await deps.ghosts.start(t, deps.avatarId(), playOpts());
    deps.ghostState(true);
  };

  $<HTMLButtonElement>('mml-best').onclick = () => {
    if (!current) return;
    const win = bestWindow(current.frames, current.kind, 5000);
    setTrim(win.startMs, win.endMs);
  };

  $<HTMLButtonElement>('mml-apply').onclick = async () => {
    if (!current) return;
    const t = trimLoop(current, inMs, outMs);
    if (!t) return;
    // re-finalize: thumbnail + byte accounting follow the new frame set
    const applied = finalizeLoop(t, current.avatar, current.mode);
    applied.id = current.id;
    applied.name = current.name;
    applied.createdAt = current.createdAt;
    await saveLoop(applied);
    stopPlayback();
    await openEditor(applied.id);
    await refresh();
  };

  const mirrorBtn = $<HTMLButtonElement>('mml-mirror');
  mirrorBtn.onclick = () => {
    mirror = !mirror;
    mirrorBtn.classList.toggle('on', mirror);
    mirrorBtn.setAttribute('aria-pressed', String(mirror));
    deps.ghosts.setMirror(mirror);
  };

  function presetRow(host: HTMLElement, presets: { label: string; value: number }[], initial: number, apply: (v: number) => void): void {
    for (const p of presets) {
      const b = document.createElement('button');
      b.className = 'mml-btn mml-chip';
      b.textContent = p.label;
      b.classList.toggle('on', p.value === initial);
      b.onclick = () => {
        host.querySelectorAll('.mml-chip').forEach((el) => el.classList.remove('on'));
        b.classList.add('on');
        apply(p.value);
      };
      host.append(b);
    }
  }
  presetRow($<HTMLSpanElement>('mml-opacity'), OPACITY_PRESETS, opacity, (v) => {
    opacity = v;
    deps.ghosts.setOpacity(v);
  });
  presetRow($<HTMLSpanElement>('mml-delay'), DELAY_PRESETS, delay, (v) => {
    delay = v;
    deps.ghosts.setDelay(v);
  });

  // ── cards ────────────────────────────────────────────────────────────
  async function refresh(): Promise<void> {
    const metas = await listLoops();
    const totals = await storageTotals();
    $<HTMLSpanElement>('mml-totals').textContent =
      `${totals.loops} loop${totals.loops === 1 ? '' : 's'} · ${fmtBytes(totals.bytes)} of ${fmtBytes(totals.caps.maxBytes)} · local only`;

    cardsHost.innerHTML = '';
    if (!metas.length) {
      const empty = document.createElement('div');
      empty.className = 'mml-empty';
      empty.textContent = 'no saved loops yet — perform, then ⌘K “save loop” or “grab best last motion”';
      cardsHost.append(empty);
      return;
    }
    for (const m of metas) {
      const card = document.createElement('div');
      card.className = 'mml-card';
      card.dataset.loopId = m.id;

      const thumb = document.createElement('div');
      thumb.className = 'mml-thumb';
      thumb.innerHTML = m.thumbSvg;

      const name = document.createElement('input');
      name.className = 'mml-name';
      name.value = m.name;
      name.title = 'rename loop';
      name.setAttribute('aria-label', `loop name: ${m.name}`);
      const commit = async () => {
        if (name.value.trim() && name.value !== m.name) {
          await renameLoop(m.id, name.value);
          await refresh();
        }
      };
      name.onchange = () => void commit();
      name.onkeydown = (e) => {
        if (e.key === 'Enter') name.blur();
        e.stopPropagation();
      };

      const meta = document.createElement('div');
      meta.className = 'mml-meta';
      meta.textContent = `${fmtDur(m.durationMs)} · ${m.avatar} · ${m.mode} · ${fmtDate(m.createdAt)}`;

      const row = document.createElement('div');
      row.className = 'mml-card-row';
      const play = document.createElement('button');
      play.className = 'mml-btn play';
      if (m.kind === 'pose') {
        play.textContent = '▸ play';
        play.title = 'play on the current avatar (re-skin) — duet beside the live puppet';
        play.onclick = async () => {
          const loop = await loadLoop(m.id);
          if (loop) await playLoop(loop);
        };
      } else {
        play.textContent = 'hand loop';
        play.disabled = true;
        play.title = 'hand loops don\'t replay yet — the ghost player drives body rigs (FUTURES.md)';
      }
      const edit = document.createElement('button');
      edit.className = 'mml-btn';
      edit.textContent = '✂ tape';
      edit.title = 'open the motion tape — trim, best 5 s, preview';
      edit.onclick = () => void openEditor(m.id);
      const del = document.createElement('button');
      del.className = 'mml-btn';
      del.textContent = '×';
      del.title = 'delete loop (click twice)';
      del.onclick = async () => {
        if (!del.classList.contains('danger')) {
          del.classList.add('danger');
          del.textContent = 'sure?';
          setTimeout(() => {
            del.classList.remove('danger');
            del.textContent = '×';
          }, 3000);
          return;
        }
        await deleteLoop(m.id);
        if (current?.id === m.id) closeEditor();
        await refresh();
      };
      row.append(play, edit, del);
      card.append(thumb, name, meta, row);
      cardsHost.append(card);
    }
  }

  // ── open/close ───────────────────────────────────────────────────────
  function open(): void {
    overlay.classList.remove('hidden');
    void refresh();
    (overlay.querySelector('.mml-close') as HTMLButtonElement).focus();
  }
  function close(): void {
    closeEditor();
    overlay.classList.add('hidden');
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
  (overlay.querySelector('.mml-close') as HTMLButtonElement).onclick = close;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
  window.addEventListener('resize', () => {
    if (!overlay.classList.contains('hidden') && current) drawTape();
  });

  return {
    open,
    close,
    refresh,
    get isOpen() {
      return !overlay.classList.contains('hidden');
    },
  };
}
