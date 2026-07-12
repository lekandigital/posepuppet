// Shared utilities for the worldbake pipeline: hashing, deterministic
// serialization, rounding, and the u16 heightfield encoding. Pure
// functions, no deps — determinism is the contract (golden-file tests
// byte-compare rebuilt artifacts against committed ones).

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Round to centimetres; -0 normalized (a -0 would break byte-stability). */
export const roundCm = (v) => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
};

/** Round to decimetres (elevations, widths). */
export const roundDm = (v) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? 0 : r;
};

export const roundRing = (ring) => ring.map(([x, y]) => [roundCm(x), roundCm(y)]);

export function readJsonGz(path) {
  const buf = readFileSync(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8'));
}

export function writeJsonGz(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const body = JSON.stringify(obj);
  writeFileSync(path, path.endsWith('.gz') ? gzipSync(body, { level: 9 }) : body);
}

function numStr(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`worldbake: non-finite number in artifact: ${String(n)}`);
  }
  return Object.is(n, -0) ? '0' : String(n);
}

/**
 * Deterministic pretty serializer: objects one key per line (insertion
 * order — construction order IS the schema order), arrays of numbers and
 * arrays of number-arrays compacted onto one line so coordinate soup
 * doesn't explode the file. JSON.parse(serializeStable(x)) re-serializes
 * byte-identically (asserted by the schema round-trip check).
 */
export function serializeStable(value) {
  return emit(value, 0) + '\n';
}

function emit(v, depth) {
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => typeof x === 'number')) return `[${v.map(numStr).join(',')}]`;
    if (v.every((x) => Array.isArray(x) && x.every((y) => typeof y === 'number'))) {
      return `[${v.map((x) => `[${x.map(numStr).join(',')}]`).join(',')}]`;
    }
    const ind = ' '.repeat(depth + 1);
    return `[\n${v.map((x) => ind + emit(x, depth + 1)).join(',\n')}\n${' '.repeat(depth)}]`;
  }
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined);
    if (keys.length === 0) return '{}';
    const ind = ' '.repeat(depth + 1);
    return `{\n${keys
      .map((k) => `${ind}${JSON.stringify(k)}: ${emit(v[k], depth + 1)}`)
      .join(',\n')}\n${' '.repeat(depth)}}`;
  }
  if (typeof v === 'number') return numStr(v);
  return JSON.stringify(v);
}

/** Quantize a Float64Array of elevations to u16 little-endian base64.
 *  Decoding: elevM = offsetM + u16 * scaleM (documented in the schema). */
export function encodeHeights(heights, minEIn, maxEIn) {
  const minE = roundDm(minEIn);
  const maxE = roundDm(maxEIn);
  const range = maxE - minE;
  const scale = range === 0 ? 1 : range / 65535;
  const buf = Buffer.allocUnsafe(heights.length * 2);
  for (let i = 0; i < heights.length; i++) {
    const q = range === 0 ? 0 : Math.round((heights[i] - minE) / scale);
    buf.writeUInt16LE(Math.max(0, Math.min(65535, q)), i * 2);
  }
  return { encoding: 'u16-le-base64', offsetM: roundDm(minE), scaleM: scale, data: buf.toString('base64') };
}

/** Nearest node index in [[x,y],...] to (x,y); -1 when empty. Ties break
 *  to the lowest index (deterministic). */
export function nearestPointIndex(pts, x, y) {
  let best = Infinity;
  let bestI = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2;
    if (d < best) { best = d; bestI = i; }
  }
  return bestI;
}
