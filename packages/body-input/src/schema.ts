// Schema v1 boundary enforcement: exact-shape validation (landmarks are
// provably absent — the key set is closed) and a canonical serializer with
// fixed key order so identical streams compare byte-identical.

import type { BodyAxes, BodyEvent, BodyGait, BodySignal, TrackingState } from './types';

/** v1-additive OPTIONAL top-level key: periodic-motion (stroke) state.
 *  Old signals and tapes without it stay valid. Key order is the
 *  canonical serialization order. */
export const STROKE_KEYS = ['active', 'count', 'rate', 'phase', 'ampL', 'ampR'] as const;

/** v1-additive OPTIONAL top-level key: torso-wave (swim kick) state.
 *  Same contract as stroke. Key order is the canonical order. */
export const SWIM_KEYS = ['active', 'count', 'rate', 'phase', 'amp'] as const;

/** v1-additive OPTIONAL top-level key: gait (step) state. Same contract
 *  as stroke/swim. Key order is the canonical order. */
export const GAIT_KEYS = ['active', 'count', 'cadence', 'phase', 'amp', 'shift', 'source'] as const;

export const GAIT_SOURCES: readonly BodyGait['source'][] = ['legs', 'sway', 'none'] as const;

export const SCHEMA_V = 1 as const;

export const TOP_KEYS = [
  'v', 'ts', 'confidence', 'seated', 'stillness', 'neutralConfidence', 'axes', 'events',
] as const;

/** v1-additive OPTIONAL top-level key: per-limb tracking continuity.
 *  Old signals (and recorded tapes) without it stay valid. */
export const TRACKING_KEYS = [
  'torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg',
] as const;

export const TRACKING_STATES: readonly TrackingState[] = ['visible', 'predicted', 'relaxed'] as const;

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
  const keys = Object.keys(o)
    .filter((k) => k !== 'tracking' && k !== 'stroke' && k !== 'swim' && k !== 'gait') // optional additive keys, validated below
    .sort();
  const want = [...TOP_KEYS].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
    fail(`top-level keys [${keys.join(',')}] != schema [${want.join(',')}]`);
  }
  if (o.tracking !== undefined) {
    const tr = o.tracking as Record<string, unknown>;
    if (typeof tr !== 'object' || tr === null || Array.isArray(tr)) fail('tracking not an object');
    const tKeys = Object.keys(tr).sort();
    const tWant = [...TRACKING_KEYS].sort();
    if (tKeys.length !== tWant.length || tKeys.some((k, i) => k !== tWant[i])) {
      fail(`tracking keys [${tKeys.join(',')}] != schema [${tWant.join(',')}]`);
    }
    for (const k of TRACKING_KEYS) {
      if (!TRACKING_STATES.includes(tr[k] as TrackingState)) {
        fail(`tracking.${k}=${String(tr[k])} not in {${TRACKING_STATES.join(',')}}`);
      }
    }
  }
  if (o.stroke !== undefined) {
    const st = o.stroke as Record<string, unknown>;
    if (typeof st !== 'object' || st === null || Array.isArray(st)) fail('stroke not an object');
    const sKeys = Object.keys(st).sort();
    const sWant = [...STROKE_KEYS].sort();
    if (sKeys.length !== sWant.length || sKeys.some((k, i) => k !== sWant[i])) {
      fail(`stroke keys [${sKeys.join(',')}] != schema [${sWant.join(',')}]`);
    }
    if (typeof st.active !== 'boolean') fail('stroke.active not boolean');
    if (!isFiniteNumber(st.count) || st.count < 0 || !Number.isInteger(st.count)) {
      fail('stroke.count not a non-negative integer');
    }
    if (!isFiniteNumber(st.rate) || st.rate < 0 || st.rate > 3) fail('stroke.rate out of [0,3]');
    for (const k of ['phase', 'ampL', 'ampR'] as const) {
      const v = st[k];
      if (!isFiniteNumber(v) || v < 0 || v > 1) fail(`stroke.${k} out of [0,1]`);
    }
  }
  if (o.swim !== undefined) {
    const sw = o.swim as Record<string, unknown>;
    if (typeof sw !== 'object' || sw === null || Array.isArray(sw)) fail('swim not an object');
    const wKeys = Object.keys(sw).sort();
    const wWant = [...SWIM_KEYS].sort();
    if (wKeys.length !== wWant.length || wKeys.some((k, i) => k !== wWant[i])) {
      fail(`swim keys [${wKeys.join(',')}] != schema [${wWant.join(',')}]`);
    }
    if (typeof sw.active !== 'boolean') fail('swim.active not boolean');
    if (!isFiniteNumber(sw.count) || sw.count < 0 || !Number.isInteger(sw.count)) {
      fail('swim.count not a non-negative integer');
    }
    if (!isFiniteNumber(sw.rate) || sw.rate < 0 || sw.rate > 3) fail('swim.rate out of [0,3]');
    for (const k of ['phase', 'amp'] as const) {
      const v = sw[k];
      if (!isFiniteNumber(v) || v < 0 || v > 1) fail(`swim.${k} out of [0,1]`);
    }
  }
  if (o.gait !== undefined) {
    const g = o.gait as Record<string, unknown>;
    if (typeof g !== 'object' || g === null || Array.isArray(g)) fail('gait not an object');
    const gKeys = Object.keys(g).sort();
    const gWant = [...GAIT_KEYS].sort();
    if (gKeys.length !== gWant.length || gKeys.some((k, i) => k !== gWant[i])) {
      fail(`gait keys [${gKeys.join(',')}] != schema [${gWant.join(',')}]`);
    }
    if (typeof g.active !== 'boolean') fail('gait.active not boolean');
    if (!isFiniteNumber(g.count) || g.count < 0 || !Number.isInteger(g.count)) {
      fail('gait.count not a non-negative integer');
    }
    if (!isFiniteNumber(g.cadence) || g.cadence < 0 || g.cadence > 4) fail('gait.cadence out of [0,4]');
    for (const k of ['phase', 'amp'] as const) {
      const v = g[k];
      if (!isFiniteNumber(v) || v < 0 || v > 1) fail(`gait.${k} out of [0,1]`);
    }
    if (!isFiniteNumber(g.shift) || g.shift < -1 || g.shift > 1) fail('gait.shift out of [-1,1]');
    if (!GAIT_SOURCES.includes(g.source as BodyGait['source'])) {
      fail(`gait.source=${String(g.source)} not in {${GAIT_SOURCES.join(',')}}`);
    }
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

/** Canonical JSON — fixed key order, quantized-by-construction values.
 *  Optional blocks serialize last — tracking, stroke, swim, then gait —
 *  in their declared key orders. */
export function canonicalSignalJSON(s: BodySignal): string {
  const a: BodyAxes = s.axes;
  const tracking = s.tracking
    ? `,"tracking":{${TRACKING_KEYS.map((k) => `"${k}":"${s.tracking![k]}"`).join(',')}}`
    : '';
  const st = s.stroke;
  const stroke = st
    ? `,"stroke":{"active":${st.active},"count":${JSON.stringify(st.count)}` +
      `,"rate":${JSON.stringify(st.rate)},"phase":${JSON.stringify(st.phase)}` +
      `,"ampL":${JSON.stringify(st.ampL)},"ampR":${JSON.stringify(st.ampR)}}`
    : '';
  const sw = s.swim;
  const swim = sw
    ? `,"swim":{"active":${sw.active},"count":${JSON.stringify(sw.count)}` +
      `,"rate":${JSON.stringify(sw.rate)},"phase":${JSON.stringify(sw.phase)}` +
      `,"amp":${JSON.stringify(sw.amp)}}`
    : '';
  const g = s.gait;
  const gait = g
    ? `,"gait":{"active":${g.active},"count":${JSON.stringify(g.count)}` +
      `,"cadence":${JSON.stringify(g.cadence)},"phase":${JSON.stringify(g.phase)}` +
      `,"amp":${JSON.stringify(g.amp)},"shift":${JSON.stringify(g.shift)}` +
      `,"source":"${g.source}"}`
    : '';
  return (
    `{"v":${s.v},"ts":${JSON.stringify(s.ts)},"confidence":${JSON.stringify(s.confidence)}` +
    `,"seated":${s.seated},"stillness":${JSON.stringify(s.stillness)}` +
    `,"neutralConfidence":${JSON.stringify(s.neutralConfidence)}` +
    `,"axes":{"leanX":${JSON.stringify(a.leanX)},"leanY":${JSON.stringify(a.leanY)}` +
    `,"crouch":${JSON.stringify(a.crouch)},"tallness":${JSON.stringify(a.tallness)}` +
    `,"armsOut":${JSON.stringify(a.armsOut)},"armsRaised":${JSON.stringify(a.armsRaised)}` +
    `,"handsForward":${JSON.stringify(a.handsForward)},"handPoint":${JSON.stringify(a.handPoint)}}` +
    `,"events":[${s.events.map((e) => `"${e}"`).join(',')}]${tracking}${stroke}${swim}${gait}}`
  );
}

export function canonicalStreamJSON(signals: readonly BodySignal[]): string {
  return `[${signals.map(canonicalSignalJSON).join(',')}]`;
}
