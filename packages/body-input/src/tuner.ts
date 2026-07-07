// Tuner overlay — a mountable, self-contained DOM component any consumer
// can drop over its stage: per-axis raw → shaped bars, live shaping
// sliders (writes core.setConfig), event blips, status chips, latency
// readout. Styling is scoped and self-contained (mono, 1px rules, no
// external CSS), with sensible dark defaults that pick up the host's
// monospace font.

import { AXIS_NAMES } from './defaults';
import type { AxisName, BodyInputConfig, BodySignal, DeepPartial } from './types';
import type { BodyInputCore } from './pipeline';
import type { BodySignalSource } from './transport';

export interface TunerDeps {
  core: BodyInputCore;
  source: BodySignalSource;
  /** wall-clock pose-frame → emitted-signal latency, measured by the host
   *  at the impure edge (the pure core has no clock to measure with) */
  getLatencyMs?: () => number | null;
}

const CSS = `
.bi-tuner { font: 11px/1.45 ui-monospace, 'JetBrains Mono', Menlo, monospace;
  color: #e8f0ff; background: rgba(10, 14, 22, 0.96); border: 1px solid #3a4a66;
  padding: 10px 12px; width: 300px; user-select: none; }
.bi-tuner * { box-sizing: border-box; }
.bi-head { display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 1px solid #3a4a66; padding-bottom: 6px; margin-bottom: 8px;
  letter-spacing: 0.08em; }
.bi-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.bi-chip { border: 1px solid #3a4a66; padding: 1px 6px; letter-spacing: 0.05em; }
.bi-chip.on { border-color: #4da3ff; color: #4da3ff; }
.bi-row { display: grid; grid-template-columns: 86px 1fr 44px; gap: 6px;
  align-items: center; margin: 3px 0; cursor: pointer; }
.bi-row.sel { color: #4da3ff; }
.bi-bars { position: relative; height: 12px; border: 1px solid #3a4a66; }
.bi-bar { position: absolute; top: 0; bottom: 0; }
.bi-bar.raw { background: #3a4a66; top: 7px; }
.bi-bar.shaped { background: #4da3ff; bottom: 5px; }
.bi-val { text-align: right; }
.bi-ev { margin: 6px 0; min-height: 14px; color: #9fe8c8; }
.bi-sliders { border-top: 1px solid #3a4a66; margin-top: 8px; padding-top: 6px; }
.bi-slider { display: grid; grid-template-columns: 86px 1fr 44px; gap: 6px;
  align-items: center; margin: 2px 0; }
.bi-slider input { width: 100%; accent-color: #4da3ff; height: 12px; }
.bi-foot { display: flex; justify-content: space-between; border-top: 1px solid #3a4a66;
  margin-top: 8px; padding-top: 6px; }
.bi-btn { font: inherit; color: inherit; background: none; border: 1px solid #3a4a66;
  padding: 1px 8px; cursor: pointer; letter-spacing: 0.05em; }
.bi-btn:hover { border-color: #4da3ff; color: #4da3ff; }
`;

interface SliderSpec {
  key: 'deadZone' | 'expo' | 'slewPerSec' | 'minCutoff' | 'beta';
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'deadZone', label: 'dead zone', min: 0, max: 0.3, step: 0.005 },
  { key: 'expo', label: 'expo', min: 0, max: 1, step: 0.05 },
  { key: 'slewPerSec', label: 'slew /s', min: 0.5, max: 12, step: 0.5 },
  { key: 'minCutoff', label: '1€ cutoff', min: 0.1, max: 5, step: 0.1 },
  { key: 'beta', label: '1€ beta', min: 0, max: 0.1, step: 0.002 },
];

export function mountTuner(host: HTMLElement, deps: TunerDeps): { unmount(): void } {
  const root = document.createElement('div');
  root.className = 'bi-tuner';
  const style = document.createElement('style');
  style.textContent = CSS;
  root.append(style);

  const head = document.createElement('div');
  head.className = 'bi-head';
  head.innerHTML = `<span>BODY INPUT · TUNER</span><span data-bi="latency">— ms</span>`;
  root.append(head);

  const chips = document.createElement('div');
  chips.className = 'bi-chips';
  chips.innerHTML =
    `<span class="bi-chip" data-bi="conf">CONF —</span>` +
    `<span class="bi-chip" data-bi="neutral">NEUTRAL —</span>` +
    `<span class="bi-chip" data-bi="seated">SEATED</span>` +
    `<span class="bi-chip" data-bi="still">STILL —</span>`;
  root.append(chips);

  let selected: AxisName = 'leanX';
  const rows = new Map<AxisName, { row: HTMLElement; raw: HTMLElement; shaped: HTMLElement; val: HTMLElement }>();
  for (const name of AXIS_NAMES) {
    const row = document.createElement('div');
    row.className = 'bi-row';
    const label = document.createElement('span');
    label.textContent = name;
    const bars = document.createElement('div');
    bars.className = 'bi-bars';
    const raw = document.createElement('div');
    raw.className = 'bi-bar raw';
    const shaped = document.createElement('div');
    shaped.className = 'bi-bar shaped';
    bars.append(raw, shaped);
    const val = document.createElement('span');
    val.className = 'bi-val';
    val.textContent = '0.00';
    row.append(label, bars, val);
    row.onclick = () => {
      selected = name;
      refreshSelection();
      refreshSliders();
    };
    root.append(row);
    rows.set(name, { row, raw, shaped, val });
  }

  const ev = document.createElement('div');
  ev.className = 'bi-ev';
  ev.textContent = '· no events yet';
  root.append(ev);

  const sliders = document.createElement('div');
  sliders.className = 'bi-sliders';
  const sliderEls = new Map<SliderSpec['key'], { input: HTMLInputElement; out: HTMLElement }>();
  for (const spec of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'bi-slider';
    const label = document.createElement('span');
    label.textContent = spec.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    const out = document.createElement('span');
    out.className = 'bi-val';
    input.oninput = () => {
      const v = Number(input.value);
      out.textContent = v.toFixed(3);
      const patch =
        spec.key === 'minCutoff' || spec.key === 'beta'
          ? { oneEuro: { ...deps.core.getConfig().axes[selected].oneEuro, [spec.key]: v } }
          : { [spec.key]: v };
      deps.core.setConfig({ axes: { [selected]: patch } } as DeepPartial<BodyInputConfig>);
    };
    wrap.append(label, input, out);
    sliders.append(wrap);
    sliderEls.set(spec.key, { input, out });
  }
  root.append(sliders);

  const foot = document.createElement('div');
  foot.className = 'bi-foot';
  const recenterBtn = document.createElement('button');
  recenterBtn.className = 'bi-btn';
  recenterBtn.textContent = 'recenter';
  recenterBtn.onclick = () => deps.core.recenter();
  const hint = document.createElement('span');
  hint.textContent = 'click an axis to tune';
  foot.append(recenterBtn, hint);
  root.append(foot);

  function refreshSelection(): void {
    for (const [name, r] of rows) r.row.classList.toggle('sel', name === selected);
  }
  function refreshSliders(): void {
    const axis = deps.core.getConfig().axes[selected];
    for (const spec of SLIDERS) {
      const el = sliderEls.get(spec.key)!;
      const v =
        spec.key === 'minCutoff' || spec.key === 'beta' ? axis.oneEuro[spec.key] : axis[spec.key];
      el.input.value = String(v);
      el.out.textContent = v.toFixed(3);
    }
  }
  refreshSelection();
  refreshSliders();

  // bar geometry: bipolar axes render from the center line, unipolar from 0
  function setBar(el: HTMLElement, v: number, bipolar: boolean): void {
    const pct = Math.min(Math.abs(v), 1) * (bipolar ? 50 : 100);
    if (bipolar) {
      el.style.left = v < 0 ? `${50 - pct}%` : '50%';
      el.style.width = `${pct}%`;
    } else {
      el.style.left = '0';
      el.style.width = `${pct}%`;
    }
  }

  let evClearAt = 0;
  const unsub = deps.source.subscribe((s: BodySignal) => {
    const debug = deps.core.getDebug();
    for (const name of AXIS_NAMES) {
      const r = rows.get(name)!;
      const bipolar = name === 'leanX' || name === 'leanY';
      setBar(r.raw, debug[name].raw ?? 0, bipolar);
      setBar(r.shaped, s.axes[name], bipolar);
      r.val.textContent = s.axes[name].toFixed(2);
    }
    (chips.querySelector('[data-bi=conf]') as HTMLElement).textContent =
      `CONF ${s.confidence.toFixed(2)}`;
    const nc = chips.querySelector('[data-bi=neutral]') as HTMLElement;
    nc.textContent = `NEUTRAL ${s.neutralConfidence.toFixed(1)}`;
    nc.classList.toggle('on', s.neutralConfidence >= 1);
    (chips.querySelector('[data-bi=seated]') as HTMLElement).classList.toggle('on', s.seated);
    (chips.querySelector('[data-bi=still]') as HTMLElement).textContent =
      `STILL ${s.stillness.toFixed(2)}`;
    if (s.events.length) {
      ev.textContent = `» ${s.events.join(', ')} @ ${Math.round(s.ts)}`;
      evClearAt = s.ts + 1500;
    } else if (evClearAt && s.ts > evClearAt) {
      ev.textContent = '·';
      evClearAt = 0;
    }
    const lat = deps.getLatencyMs?.();
    (head.querySelector('[data-bi=latency]') as HTMLElement).textContent =
      lat == null ? '— ms' : `${lat.toFixed(1)} ms`;
  });

  host.append(root);
  return {
    unmount() {
      unsub();
      root.remove();
    },
  };
}
