// Debug/settings panel (plain DOM). Writes config via setConfig; the hot
// loop reads config directly. Toggle with the ⚙ button or "d".

import { config, setConfig, resetConfig, type Config } from '../config';

function row(label: string, input: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'panel-row';
  const span = document.createElement('span');
  span.textContent = label;
  div.append(span, input);
  return div;
}

function slider(
  key: 'minCutoff' | 'beta' | 'slerpRate' | 'relaxSec',
  min: number,
  max: number,
  step: number,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'panel-slider';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(config[key]);
  const val = document.createElement('em');
  val.textContent = String(config[key]);
  input.oninput = () => {
    setConfig(key, Number(input.value));
    val.textContent = input.value;
  };
  wrap.append(input, val);
  return wrap;
}

function toggle(key: keyof Config & ('mirror' | 'smoothing' | 'rootMotion')): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = config[key] as boolean;
  input.onchange = () => setConfig(key, input.checked);
  return input;
}

export function createPanel(): void {
  const host = document.createElement('div');
  host.id = 'panel';
  host.classList.add('hidden');

  host.append(
    row('mirror', toggle('mirror')),
    row('smoothing', toggle('smoothing')),
    row('root motion', toggle('rootMotion')),
    row('minCutoff', slider('minCutoff', 0.1, 3, 0.05)),
    row('beta', slider('beta', 0, 30, 0.5)),
    row('slerp rate', slider('slerpRate', 5, 40, 1)),
    row('relax sec', slider('relaxSec', 0.2, 2, 0.1)),
  );

  const modelSel = document.createElement('select');
  for (const v of ['full', 'lite']) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    if (config.model === v) o.selected = true;
    modelSel.append(o);
  }
  modelSel.onchange = () => setConfig('model', modelSel.value as Config['model']);
  host.append(row('model', modelSel));

  const reset = document.createElement('button');
  reset.textContent = 'reset defaults';
  reset.onclick = () => {
    resetConfig();
    host.remove();
    createPanel();
    document.getElementById('panel')!.classList.remove('hidden');
  };
  host.append(reset);

  document.body.append(host);

  let btn = document.getElementById('panel-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'panel-toggle';
    btn.textContent = '⚙';
    btn.title = 'settings (d)';
    document.getElementById('controls')!.append(btn);
    btn.onclick = () => document.getElementById('panel')!.classList.toggle('hidden');
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' && !(e.target instanceof HTMLInputElement)) {
        document.getElementById('panel')!.classList.toggle('hidden');
      }
    });
  }
}
