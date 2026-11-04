// Dolphin control preferences (CP10 follow-up). Session + localStorage; dolphin mode only.

import type { CameraStyle } from '../dolphin/cameraRig';

export type ControlProfile = 'ecco' | 'legacy';
export type InputSourcePref = 'auto' | 'keyboard' | 'gamepad' | 'body';

export interface DolphinControlPrefs {
  profile: ControlProfile;
  invertY: boolean;
  steerSensitivity: number;
  lookSensitivity: number;
  cameraStyle: CameraStyle;
  cameraDistance: number;
  fov: number;
  inputSource: InputSourcePref;
}

export const DEFAULT_PREFS: DolphinControlPrefs = {
  profile: 'ecco',
  invertY: false,
  steerSensitivity: 1,
  lookSensitivity: 1,
  cameraStyle: 'follow',
  cameraDistance: 1,
  fov: 55,
  inputSource: 'auto',
};

const KEY = 'bodyarcade.dolphin.controls.v1';

export function loadPrefs(): DolphinControlPrefs {
  const p: DolphinControlPrefs = { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return p;
    const o = JSON.parse(raw) as Partial<DolphinControlPrefs>;
    if (o.profile === 'ecco' || o.profile === 'legacy') p.profile = o.profile;
    if (typeof o.invertY === 'boolean') p.invertY = o.invertY;
    if (typeof o.steerSensitivity === 'number') p.steerSensitivity = clamp(o.steerSensitivity, 0.4, 2);
    if (typeof o.lookSensitivity === 'number') p.lookSensitivity = clamp(o.lookSensitivity, 0.3, 3);
    if (o.cameraStyle === 'follow' || o.cameraStyle === 'remote' || o.cameraStyle === 'scenic') {
      p.cameraStyle = o.cameraStyle;
    }
    if (typeof o.cameraDistance === 'number') p.cameraDistance = clamp(o.cameraDistance, 0.7, 1.4);
    if (typeof o.fov === 'number') p.fov = clamp(o.fov, 40, 75);
    if (o.inputSource === 'auto' || o.inputSource === 'keyboard' || o.inputSource === 'gamepad' || o.inputSource === 'body') {
      p.inputSource = o.inputSource;
    }
  } catch {
    /* keep defaults */
  }
  return p;
}

export function savePrefs(p: DolphinControlPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
