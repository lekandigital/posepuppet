// Settings store: plain object + subscribers, persisted to localStorage.
// The hot loop reads fields directly; no per-frame allocations or events.

export interface Config {
  mirror: boolean;
  smoothing: boolean;
  minCutoff: number;
  beta: number;
  slerpRate: number; // 1/s — render-tick slerp toward bone targets
  relaxSec: number; // time constant for decay-to-rest on lost visibility
  model: 'full' | 'lite';
  avatar: 'robot' | 'vrm';
  bodyMode: 'upper' | 'full';
  rootMotion: boolean;
}

// One Euro params are for METRIC world landmarks (meters): velocities are
// ~100x smaller than the pixel-space classics, so beta is ~100x larger than
// the textbook 0.007 to get the same speed-adaptive behavior.
const DEFAULTS: Config = {
  mirror: true,
  smoothing: true,
  minCutoff: 1.2,
  beta: 8,
  slerpRate: 28,
  relaxSec: 0.7,
  model: 'full',
  avatar: 'robot',
  bodyMode: 'upper',
  rootMotion: true,
};

const KEY = 'posepuppet-config-v2';

function load(): Config {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* fall through */
  }
  return { ...DEFAULTS };
}

export const config: Config = load();

type Listener = (key: keyof Config) => void;
const listeners: Listener[] = [];

export function onConfigChange(fn: Listener): void {
  listeners.push(fn);
}

export function setConfig<K extends keyof Config>(key: K, value: Config[K]): void {
  if (config[key] === value) return;
  config[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    /* private mode etc. */
  }
  for (const fn of listeners) fn(key);
}

export function resetConfig(): void {
  for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
    setConfig(k, DEFAULTS[k]);
  }
}
