// ============================================================================
// Blend modes — how a layer's value folds into the accumulated height.
// One definition drives both the GLSL codegen and the CPU JS evaluator so the
// two never diverge.
//
// In every expression below:
//   `acc`  = height accumulated so far
//   `val`  = this layer's noise value, already multiplied by effective
//            strength (strength * opacity) and its mask (0..1).
// `divide` guards against /0; `flatten`/`carve` use val as a signed target.
// ============================================================================

// GLSL snippet: given identifiers for acc + val, return an expression for the
// new accumulated value. Kept as small pure expressions (no statements) so the
// codegen can inline them.
export const BLEND_GLSL = {
  add:        (a, v) => `(${a} + ${v})`,
  subtract:   (a, v) => `(${a} - ${v})`,
  multiply:   (a, v) => `(${a} * mix(1.0, ${v}, clamp(abs(${v}) > 0.0 ? 1.0 : 1.0, 0.0, 1.0)))`,
  divide:     (a, v) => `(${a} / (abs(${v}) < 1e-3 ? sign(${v} + 1e-6) * 1e-3 : ${v}))`,
  max:        (a, v) => `max(${a}, ${v})`,
  min:        (a, v) => `min(${a}, ${v})`,
  replace:    (a, v) => `(${v})`,
  difference: (a, v) => `abs(${a} - ${v})`,
  // overlay: photoshop-style, biased by existing height (artistic)
  overlay:    (a, v) => `(${a} < 0.5 ? 2.0 * ${a} * ${v} : 1.0 - 2.0 * (1.0 - ${a}) * (1.0 - ${v}))`,
  // carve: subtract with a soft floor — useful for rivers/craters
  carve:      (a, v) => `(${a} - max(${v}, 0.0))`,
  // flatten: ease the accumulated height toward the target value `val`
  flatten:    (a, v) => `mix(${a}, ${v}, clamp(abs(${v}), 0.0, 1.0))`,
};

// `multiply` above is awkward as a one-liner; provide a cleaner statement form
// used by the codegen for the modes that read better as statements.
export const BLEND_GLSL_STMT = {
  // newAcc = acc * mix(1, layerRaw, strength*mask). Here `val` already folds
  // strength*mask, so treat it as the blend amount toward the raw value 1+val.
  multiply: (a, v) => `${a} = ${a} * (1.0 + ${v});`,
};

export const BLEND_JS = {
  add:        (a, v) => a + v,
  subtract:   (a, v) => a - v,
  multiply:   (a, v) => a * (1.0 + v),
  divide:     (a, v) => a / (Math.abs(v) < 1e-3 ? (Math.sign(v + 1e-6) * 1e-3) : v),
  max:        (a, v) => Math.max(a, v),
  min:        (a, v) => Math.min(a, v),
  replace:    (a, v) => v,
  difference: (a, v) => Math.abs(a - v),
  overlay:    (a, v) => (a < 0.5 ? 2 * a * v : 1 - 2 * (1 - a) * (1 - v)),
  carve:      (a, v) => a - Math.max(v, 0),
  flatten:    (a, v) => a + (v - a) * Math.min(Math.abs(v), 1),
};

export function blendJs(mode, acc, val) {
  const fn = BLEND_JS[mode] || BLEND_JS.add;
  return fn(acc, val);
}

// Emit a GLSL statement `acc = <blend(acc,val)>;` for the codegen.
export function blendGlslStmt(mode, accId, valId) {
  if (BLEND_GLSL_STMT[mode]) return BLEND_GLSL_STMT[mode](accId, valId);
  const expr = (BLEND_GLSL[mode] || BLEND_GLSL.add)(accId, valId);
  return `${accId} = ${expr};`;
}

export const BLEND_LABELS = {
  add: 'Add', subtract: 'Subtract', multiply: 'Multiply', divide: 'Divide',
  max: 'Max', min: 'Min', replace: 'Replace', difference: 'Difference',
  overlay: 'Overlay', carve: 'Carve', flatten: 'Flatten',
};
