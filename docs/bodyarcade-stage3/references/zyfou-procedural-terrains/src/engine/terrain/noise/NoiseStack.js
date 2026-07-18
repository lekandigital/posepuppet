// ============================================================================
// Noise Stack data model — a serializable, ordered list of typed noise layers
// that produces terrain height. This is the single source of truth the GLSL
// codegen, the CPU evaluator and the UI all read from.
//
// Design notes
// ------------
//  - A stack is plain JSON (no class instances) so it serializes with the rest
//    of `params` for free (save / load / export / share).
//  - The first/default stack is a single `legacy` layer whose noise IS the
//    current hard-coded terrain recipe, so default projects stay bit-identical.
//  - Determinism: every layer gets a deterministic per-layer domain seed derived
//    from the global seed + its `seedOffset`; nothing ever calls Math.random()
//    during height evaluation.
// ============================================================================

import { NOISE_TYPES, getNoiseType } from './noiseTypes.js';

export const NOISE_STACK_VERSION = 1;

// Hard cap on simultaneously evaluated layers. The GLSL uniform arrays are
// sized to this; the codegen also bakes one branchless slot per enabled layer,
// so keeping it modest keeps shader compile time + uniform count sane.
export const MAX_LAYERS = 12;

export const BLEND_MODES = [
  'add', 'subtract', 'multiply', 'divide', 'max', 'min',
  'replace', 'difference', 'overlay', 'carve', 'flatten',
];

// Blend modes considered "core" / surfaced first in the UI quick-select.
export const CORE_BLEND_MODES = [
  'add', 'subtract', 'multiply', 'max', 'min', 'replace', 'carve',
];

let _idCounter = 0;
/** Short unique id for a layer (stable within a session; fine for keys). */
export function makeLayerId() {
  _idCounter = (_idCounter + 1) | 0;
  return `L${Date.now().toString(36)}${_idCounter.toString(36)}`;
}

/**
 * Build a fully-defaulted layer of a given type. Unknown params fall back to
 * the type's declared defaults so older saves with missing keys stay valid.
 */
export function makeLayer(type, overrides = {}) {
  const def = getNoiseType(type);
  if (!def) throw new Error(`Unknown noise type: ${type}`);
  const params = {};
  for (const p of def.params) params[p.key] = p.default;
  return {
    id: makeLayerId(),
    name: overrides.name ?? def.label,
    enabled: overrides.enabled ?? true,
    type,
    blendMode: overrides.blendMode ?? def.defaultBlend ?? 'add',
    strength: overrides.strength ?? def.defaultStrength ?? 1.0,
    opacity: overrides.opacity ?? 1.0,
    seedOffset: overrides.seedOffset ?? 0,
    params: { ...params, ...(overrides.params || {}) },
    masks: overrides.masks ? overrides.masks.map(cloneMask) : [],
    previewSolo: false,
    locked: overrides.locked ?? false,
  };
}

export function cloneMask(m) {
  return { ...m, params: { ...(m.params || {}) } };
}

export function cloneLayer(layer, { newId = true } = {}) {
  return {
    ...layer,
    id: newId ? makeLayerId() : layer.id,
    params: { ...layer.params },
    masks: (layer.masks || []).map(cloneMask),
  };
}

/** Deep clone a whole stack (defensive copy before mutation in React state). */
export function cloneStack(stack) {
  return {
    ...stack,
    layers: stack.layers.map((l) => cloneLayer(l, { newId: false })),
  };
}

export function makeStack(layers = [], overrides = {}) {
  return {
    version: NOISE_STACK_VERSION,
    globalSeed: overrides.globalSeed ?? 0,
    normalizeOutput: overrides.normalizeOutput ?? false,
    outputMin: overrides.outputMin ?? 0.0,
    outputMax: overrides.outputMax ?? 1.35,
    layers,
  };
}

// ---------------------------------------------------------------- mutation
// All helpers return a NEW stack object (immutable update friendly).

export function addLayer(stack, type, index = -1) {
  const layers = stack.layers.slice();
  const layer = makeLayer(type);
  // auto-number duplicate default names so the list stays readable
  const base = layer.name;
  const n = layers.filter((l) => l.name === base || l.name.startsWith(`${base} `)).length;
  if (n > 0) layer.name = `${base} ${n + 1}`;
  if (index < 0 || index >= layers.length) layers.push(layer);
  else layers.splice(index, 0, layer);
  return { ...stack, layers: layers.slice(0, MAX_LAYERS) };
}

export function duplicateLayer(stack, id) {
  const i = stack.layers.findIndex((l) => l.id === id);
  if (i < 0 || stack.layers.length >= MAX_LAYERS) return stack;
  const copy = cloneLayer(stack.layers[i]);
  copy.name = `${stack.layers[i].name} copy`;
  const layers = stack.layers.slice();
  layers.splice(i + 1, 0, copy);
  return { ...stack, layers };
}

export function removeLayer(stack, id) {
  return { ...stack, layers: stack.layers.filter((l) => l.id !== id) };
}

export function updateLayer(stack, id, patch) {
  return {
    ...stack,
    layers: stack.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  };
}

export function updateLayerParam(stack, id, key, value) {
  return {
    ...stack,
    layers: stack.layers.map((l) =>
      l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l),
  };
}

export function moveLayer(stack, fromIndex, toIndex) {
  const layers = stack.layers.slice();
  if (fromIndex < 0 || fromIndex >= layers.length) return stack;
  const clamped = Math.max(0, Math.min(layers.length - 1, toIndex));
  const [item] = layers.splice(fromIndex, 1);
  layers.splice(clamped, 0, item);
  return { ...stack, layers };
}

// ----------------------------------------------------------- structural sig
// Two stacks with the same signature compile to the same GLSL program; only
// continuous uniforms differ. A change in signature => shader recompile.

export function structuralSignature(stack) {
  const parts = [];
  let slot = 0;
  for (const l of stack.layers) {
    if (!l.enabled) continue;
    const def = getNoiseType(l.type);
    if (!def) continue;
    const structural = (def.params || [])
      .filter((p) => p.structural)
      .map((p) => `${p.key}=${l.params[p.key]}`)
      .join(',');
    const masks = (l.masks || [])
      .filter((m) => m.enabled !== false)
      .map((m) => `${m.type}${m.invert ? '!' : ''}`)
      .join('+');
    parts.push(`${slot}:${l.type}/${l.blendMode}[${structural}]{${masks}}`);
    slot++;
  }
  return `v${stack.version}|${parts.join('|')}`;
}

/**
 * True when the stack is exactly the default single Classic-Terrain layer — the
 * CPU samplers can then take their fast f32-exact legacy path instead of the
 * generic f64 evaluator.
 */
export function isLegacyStack(stack) {
  if (!stack || !Array.isArray(stack.layers)) return true;
  const active = stack.layers.filter((l) => l.enabled);
  return active.length === 1 && active[0].type === 'legacy'
    && active[0].blendMode === 'replace'
    && (active[0].strength ?? 1) === 1 && (active[0].opacity ?? 1) === 1
    && (active[0].masks || []).filter((m) => m.enabled !== false).length === 0;
}

/** Enabled, non-zero-contribution layers in evaluation order, with slot index. */
export function activeLayers(stack) {
  const out = [];
  let slot = 0;
  for (const l of stack.layers) {
    if (!l.enabled) continue;
    if (!getNoiseType(l.type)) continue;
    out.push({ layer: l, slot });
    slot++;
    if (slot >= MAX_LAYERS) break;
  }
  return out;
}

// ------------------------------------------------------------- migration
// Old projects have no `noiseStack`. Synthesize the default (single legacy
// layer) so they render exactly as before. `version` guards future bumps.

export function migrateStack(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.layers)) {
    return defaultLegacyStack();
  }
  // fill any missing layer fields against current type defaults
  const layers = raw.layers
    .filter((l) => l && getNoiseType(l.type))
    .map((l) => {
      const base = makeLayer(l.type, l);
      return { ...base, ...l, id: l.id || base.id, params: { ...base.params, ...(l.params || {}) } };
    });
  if (layers.length === 0) return defaultLegacyStack();
  return makeStack(layers, raw);
}

/** The default stack: a single Classic Terrain layer == today's exact recipe. */
export function defaultLegacyStack() {
  return makeStack([makeLayer('legacy', { name: 'Classic Terrain', blendMode: 'replace' })]);
}

export { NOISE_TYPES };
