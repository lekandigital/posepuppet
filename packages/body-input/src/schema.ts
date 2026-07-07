// Schema v1 boundary enforcement: exact-shape validation (landmarks are
// provably absent — the key set is closed) and a canonical serializer with
// fixed key order so identical streams compare byte-identical.

import type { BodyAxes, BodyEvent, BodySignal } from './types';

export const SCHEMA_V = 1 as const;

export const TOP_KEYS = [
  'v', 'ts', 'confidence', 'seated', 'stillness', 'neutralConfidence', 'axes', 'events',
] as const;

export const AXIS_KEYS = [
  'leanX', 'leanY', 'crouch', 'tallness', 'armsOut', 'armsRaised', 'handsForward', 'handPoint',
] as const;

export const EVENT_NAMES: readonly BodyEvent[] = ['recenter', 'action'] as const;

/** Quantize to 1e-4 for the wire: smaller messages, and byte-stable
 *  canonical JSON. Normalizes -0 to 0. */
export function quantize(v: number): number {
  const q = Math.round(v * 1e4) / 1e4;
  return q === 0 ? 0 : q;
}

function fail(msg: string): never {
  throw new Error(`body-input schema violation: ${msg}`);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Throws unless msg is exactly a BodySignal — closed key sets at every
 *  level, finite numbers in range, events from the closed set. Also scans
 *  for anything landmark-shaped (33-length arrays, x/y/z/visibility keys)
 *  as belt-and-braces for the privacy boundary. */
export function assertSignalShape(msg: unknown): asserts msg is BodySignal {
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) fail('not a plain object');
  const o = msg as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const want = [...TOP_KEYS].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
    fail(`top-level keys [${keys.join(',')}] != schema [${want.join(',')}]`);
  }
  if (o.v !== SCHEMA_V) fail(`v=${String(o.v)} (expected ${SCHEMA_V})`);
  if (!isFiniteNumber(o.ts)) fail('ts not a finite number');
  for (const k of ['confidence', 'stillness', 'neutralConfidence'] as const) {
    const v = o[k];
    if (!isFiniteNumber(v) || v < 0 || v > 1) fail(`${k} out of [0,1]`);
  }
  if (typeof o.seated !== 'boolean') fail('seated not boolean');

  const axes = o.axes as Record<string, unknown>;
  if (typeof axes !== 'object' || axes === null || Array.isArray(axes)) fail('axes not an object');
  const axisKeys = Object.keys(axes).sort();
  const wantAxes = [...AXIS_KEYS].sort();
  if (axisKeys.length !== wantAxes.length || axisKeys.some((k, i) => k !== wantAxes[i])) {
    fail(`axes keys [${axisKeys.join(',')}] != schema [${wantAxes.join(',')}]`);
  }
  for (const k of AXIS_KEYS) {
    const v = axes[k];
    const lo = k === 'leanX' || k === 'leanY' ? -1 : 0;
    if (!isFiniteNumber(v) || v < lo || v > 1) fail(`axes.${k} out of [${lo},1]`);
  }

  if (!Array.isArray(o.events)) fail('events not an array');
  for (const e of o.events) {
    if (!EVENT_NAMES.includes(e as BodyEvent)) fail(`unknown event ${String(e)}`);
  }

  scanForLandmarks(o, 'signal');
}

function scanForLandmarks(v: unknown, path: string): void {
  if (Array.isArray(v)) {
    if (v.length === 33) fail(`${path}: 33-length array (landmark-shaped)`);
    v.forEach((e, i) => scanForLandmarks(e, `${path}[${i}]`));
    return;
  }
  if (typeof v === 'object' && v !== null) {
    const keys = Object.keys(v as object);
    if (keys.includes('visibility') || (keys.includes('x') && keys.includes('y') && keys.includes('z'))) {
      fail(`${path}: landmark-shaped object {${keys.join(',')}}`);
    }
    for (const k of keys) scanForLandmarks((v as Record<string, unknown>)[k], `${path}.${k}`);
  }
}

/** Canonical JSON — fixed key order, quantized-by-construction values. */
export function canonicalSignalJSON(s: BodySignal): string {
  const a: BodyAxes = s.axes;
  return (
    `{"v":${s.v},"ts":${JSON.stringify(s.ts)},"confidence":${JSON.stringify(s.confidence)}` +
    `,"seated":${s.seated},"stillness":${JSON.stringify(s.stillness)}` +
    `,"neutralConfidence":${JSON.stringify(s.neutralConfidence)}` +
    `,"axes":{"leanX":${JSON.stringify(a.leanX)},"leanY":${JSON.stringify(a.leanY)}` +
    `,"crouch":${JSON.stringify(a.crouch)},"tallness":${JSON.stringify(a.tallness)}` +
    `,"armsOut":${JSON.stringify(a.armsOut)},"armsRaised":${JSON.stringify(a.armsRaised)}` +
    `,"handsForward":${JSON.stringify(a.handsForward)},"handPoint":${JSON.stringify(a.handPoint)}}` +
    `,"events":[${s.events.map((e) => `"${e}"`).join(',')}]}`
  );
}

export function canonicalStreamJSON(signals: readonly BodySignal[]): string {
  return `[${signals.map(canonicalSignalJSON).join(',')}]`;
}
