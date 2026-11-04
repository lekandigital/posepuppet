// Dolphin control preferences (CP10). Session + localStorage; dolphin mode only.
// Also the single source of truth for the binding summaries the Play tab, HUD and
// F1 sheet show, so the interface can never drift from the control profile.

import type { CameraStyle } from '../dolphin/cameraRig';

/** 'ecco' is the Modern (default) profile — the id is kept for stored preferences */
export type ControlProfile = 'ecco' | 'legacy';
export type InputSourcePref = 'auto' | 'keyboard' | 'gamepad' | 'body';

export interface DolphinControlPrefs {
  profile: ControlProfile;
  invertY: boolean;
  /** 0.4–2: scales stick deflection; ≤ 1 softens keyboard steering */
  steerSensitivity: number;
  /** 0.3–3: mouse drag and right-stick look */
  lookSensitivity: number;
  cameraStyle: CameraStyle;
  /** 0.7–1.4 follow-distance multiplier */
  cameraDistance: number;
  /** chase lens, ° vertical (40–75; 55 = the approved rig lens) */
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

export const PREF_RANGES = {
  steerSensitivity: [0.4, 2] as const,
  lookSensitivity: [0.3, 3] as const,
  cameraDistance: [0.7, 1.4] as const,
  fov: [40, 75] as const,
};

export const PROFILE_LABELS: Record<ControlProfile, string> = {
  ecco: 'Modern',
  legacy: 'Legacy BodyArcade',
};

export const CAMERA_STYLE_LABELS: Record<CameraStyle, string> = {
  follow: 'Follow',
  remote: 'Remote',
  scenic: 'Surface',
};

/** one-line binding summaries per profile (the interface shows these verbatim) */
export const BINDINGS: Record<ControlProfile, { keyboard: string; gamepad: string; short: string }> = {
  ecco: {
    short: 'Hold Space to swim · W dive · S climb · A/D turn · Shift charge · X brake · drag to look · V camera · R recenter',
    keyboard: 'Space hold = swim, tap = stroke · Shift charge · W dive · S climb · A/D turn · X brake · V camera style · R recenter · drag the view to look',
    gamepad: 'Left stick steer · RT (or A) swim, squeeze gently to cruise slowly · LB (or B) charge · LT (or X) brake · right stick look · Y camera style · click right stick to recenter · Start menu · Back controls sheet',
  },
  legacy: {
    short: 'Shift kick · Space burst · W/S pitch · A/D bank · Q/E depth · X brake · drag to look · V camera · R recenter',
    keyboard: 'Shift kick (tap = one kick, hold = cadence) · Space burst · W/S pitch · A/D bank · Q/E depth trim · X brake · V camera style · R recenter · drag the view to look',
    gamepad: 'Left stick steer · A kick · B burst · X brake · bumpers depth trim · right stick look · Y camera style · click right stick to recenter · Start menu',
  },
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
    if (typeof o.steerSensitivity === 'number') p.steerSensitivity = clamp(o.steerSensitivity, ...PREF_RANGES.steerSensitivity);
    if (typeof o.lookSensitivity === 'number') p.lookSensitivity = clamp(o.lookSensitivity, ...PREF_RANGES.lookSensitivity);
    if (o.cameraStyle === 'follow' || o.cameraStyle === 'remote' || o.cameraStyle === 'scenic') {
      p.cameraStyle = o.cameraStyle;
    }
    if (typeof o.cameraDistance === 'number') p.cameraDistance = clamp(o.cameraDistance, ...PREF_RANGES.cameraDistance);
    if (typeof o.fov === 'number') p.fov = clamp(o.fov, ...PREF_RANGES.fov);
    if (o.inputSource === 'auto' || o.inputSource === 'keyboard' || o.inputSource === 'gamepad' || o.inputSource === 'body') {
      p.inputSource = o.inputSource;
    }
  } catch {
    /* keep defaults (no storage, private mode, corrupt entry) */
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
