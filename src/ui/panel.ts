// Debug/settings panel (plain DOM). Writes config via setConfig; the hot
// loop reads config directly. Toggle with the ⚙ button or "d".

import { config, setConfig, resetConfig, type Config } from '../config';
import type { BoneName } from '../rig/types';

/** Calibration hooks the panel drives; implemented by main over the live
 *  retargeter so avatar swaps keep working. */
export interface PanelRigApi {
  calibrate(): void;
  clearCalibration(): void;
  getCorrectionEuler(bone: BoneName): { x: number; y: number; z: number };
  setCorrectionEuler(bone: BoneName, e: { x: number; y: number; z: number }): void;
}

const OFFSET_BONES: BoneName[] = [
  'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
];
const DEG = Math.PI / 180;

function row(label: string, input: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'panel-row';
  const span = document.createElement('span');
  span.textContent = label;
  div.append(span, input);
  return div;
}

function slider(
  key: 'minCutoff' | 'beta' | 'slerpRate' | 'relaxSec' | 'wristGain',
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

export function createPanel(rig?: PanelRigApi): void {
  const host = document.createElement('div');
  host.id = 'panel';
  host.classList.add('hidden');

  const fullBody = document.createElement('input');
  fullBody.type = 'checkbox';
  fullBody.id = 'full-body-toggle';
  fullBody.checked = config.bodyMode === 'full';
  fullBody.onchange = () => setConfig('bodyMode', fullBody.checked ? 'full' : 'upper');

  host.append(
    row('mirror', toggle('mirror')),
    row('full body (legs)', fullBody),
    row('smoothing', toggle('smoothing')),
    row('root motion', toggle('rootMotion')),
    row('minCutoff', slider('minCutoff', 0.1, 3, 0.05)),
    row('beta', slider('beta', 0, 30, 0.5)),
    row('slerp rate', slider('slerpRate', 5, 40, 1)),
    row('relax sec', slider('relaxSec', 0.2, 2, 0.1)),
    row('wrist gain', slider('wristGain', 0.5, 2.0, 0.05)),
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

  if (rig) {
    const calBtn = document.createElement('button');
    calBtn.id = 'calibrate-btn';
    calBtn.textContent = 'calibrate (3-2-1)';
    calBtn.title = 'stand neutral; your held pose becomes the rest pose';
    calBtn.onclick = () => rig.calibrate();

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'clear calib';
    clearBtn.onclick = () => {
      rig.clearCalibration();
      syncOffsetSliders();
    };
    const calRow = document.createElement('div');
    calRow.className = 'panel-row';
    calRow.append(calBtn, clearBtn);
    host.append(calRow);

    // per-bone offset: bone selector + xyz degree sliders, persisted
    const boneSel = document.createElement('select');
    boneSel.id = 'offset-bone';
    for (const b of OFFSET_BONES) {
      const o = document.createElement('option');
      o.value = b;
      o.textContent = b;
      boneSel.append(o);
    }
    host.append(row('offset bone', boneSel));

    const axisSliders: { axis: 'x' | 'y' | 'z'; input: HTMLInputElement; val: HTMLElement }[] = [];
    for (const axis of ['x', 'y', 'z'] as const) {
      const wrap = document.createElement('div');
      wrap.className = 'panel-slider';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '-45';
      input.max = '45';
      input.step = '1';
      const val = document.createElement('em');
      input.oninput = () => {
        const bone = boneSel.value as BoneName;
        const e = rig.getCorrectionEuler(bone);
        e[axis] = Number(input.value) * DEG;
        rig.setCorrectionEuler(bone, e);
        val.textContent = `${input.value}°`;
      };
      wrap.append(input, val);
      host.append(row(`offset ${axis}`, wrap));
      axisSliders.push({ axis, input, val });
    }
    function syncOffsetSliders(): void {
      const e = rig!.getCorrectionEuler(boneSel.value as BoneName);
      for (const s of axisSliders) {
        const deg = Math.round(e[s.axis] / DEG);
        s.input.value = String(deg);
        s.val.textContent = `${deg}°`;
      }
    }
    boneSel.onchange = syncOffsetSliders;
    syncOffsetSliders();
  }

  const reset = document.createElement('button');
  reset.textContent = 'reset defaults';
  reset.onclick = () => {
    resetConfig();
    host.remove();
    createPanel(rig);
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
