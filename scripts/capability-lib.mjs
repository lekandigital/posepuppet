// Shared derivation + comparison logic for the capability manifest.
// Used by scripts/capability-report.mjs (regen/check) and by
// tests/capability-manifest.spec.ts (the deliberate-mislabel catch), so the
// rules live in exactly one place. Plain node ESM, zero dependencies.

/** numeric tolerance for measured lengths/radii (rig loaders sample) */
const NUM_TOL = 0.15;

/** Build a manifest `inspection` block from the in-page capability report
 *  (Avatar.describeCapabilities()). Rounds so diffs stay readable. */
export function buildInspection(report) {
  if (!report) return null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const chains = report.fingerChains
    ? {
        left: { ...report.fingerChains.left },
        right: { ...report.fingerChains.right },
      }
    : null;
  return {
    bonesMissing: [...report.bonesMissing].sort(),
    fingerChains: chains,
    headCollider: report.headCollider
      ? { radius: r3(report.headCollider.radius), halfHeight: r3(report.headCollider.halfHeight) }
      : null,
    reach: {
      upper: r3((report.armLen.left.upper + report.armLen.right.upper) / 2),
      fore: r3((report.armLen.left.fore + report.armLen.right.fore) / 2),
    },
    feet: report.feet,
  };
}

/** The finger-capability rule: articulated finger control needs at least
 *  four fingers with chains of >= 3 segments on BOTH hands — anything less
 *  is a mitten (or a stub rig) and stays on the pose approximation. */
export function fingersCapable(inspection) {
  const fc = inspection?.fingerChains;
  if (!fc) return false;
  const sideOk = (side) => {
    const chains = fc[side] ?? {};
    let articulated = 0;
    for (const finger of ['index', 'middle', 'ring', 'little']) {
      if ((chains[finger] ?? 0) >= 3) articulated++;
    }
    return articulated >= 4;
  };
  return sideOk('left') && sideOk('right');
}

function numClose(a, b) {
  if (a === b) return true;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-6);
  return Math.abs(a - b) / scale <= NUM_TOL;
}

/**
 * Compare one manifest entry against a live inspection.
 * Returns a list of human-readable issues; empty = entry is truthful.
 * `live` = buildInspection(page report); null when the avatar's file is
 * absent on this machine (localOnly entries then skip inspection checks).
 */
export function compareEntry(id, entry, live) {
  const issues = [];
  if (!entry) return [`${id}: no manifest entry`];

  if (live === null) {
    if (!entry.localOnly) issues.push(`${id}: avatar failed to load but is not marked localOnly`);
    return issues; // capabilities of an absent local file can't be checked here
  }

  const ins = entry.inspection;
  if (!ins) {
    issues.push(`${id}: inspection block missing — run capability-report.mjs --write and review`);
  } else {
    if (JSON.stringify([...ins.bonesMissing].sort()) !== JSON.stringify(live.bonesMissing)) {
      issues.push(`${id}: bonesMissing drift — manifest ${JSON.stringify(ins.bonesMissing)} vs live ${JSON.stringify(live.bonesMissing)}`);
    }
    if (JSON.stringify(ins.fingerChains) !== JSON.stringify(live.fingerChains)) {
      issues.push(`${id}: fingerChains drift — manifest ${JSON.stringify(ins.fingerChains)} vs live ${JSON.stringify(live.fingerChains)}`);
    }
    const mc = ins.headCollider;
    const lc = live.headCollider;
    if (Boolean(mc) !== Boolean(lc)) {
      issues.push(`${id}: headCollider presence drift`);
    } else if (mc && lc && (!numClose(mc.radius, lc.radius) || !numClose(mc.halfHeight, lc.halfHeight))) {
      issues.push(`${id}: headCollider drift — manifest r=${mc.radius}/h=${mc.halfHeight} vs live r=${lc.radius}/h=${lc.halfHeight}`);
    }
    if (!numClose(ins.reach?.upper, live.reach.upper) || !numClose(ins.reach?.fore, live.reach.fore)) {
      issues.push(`${id}: reach drift — manifest ${JSON.stringify(ins.reach)} vs live ${JSON.stringify(live.reach)}`);
    }
    if (ins.feet !== live.feet) issues.push(`${id}: feet drift — manifest ${ins.feet} vs live ${live.feet}`);
  }

  // consistency: the reviewed gates must match what the rig can actually do.
  // fingers:true REQUIRES chains (a promotion can never lie about bones);
  // fingers:false with passing chains is a legitimate human demotion — the
  // astronaut's chains curl a mitten mesh — but must say why (fingersNote),
  // or it is flagged as a silent mislabel.
  const caps = entry.capabilities ?? {};
  const capable = fingersCapable(live);
  if (caps.fingers === true && !capable) {
    issues.push(`${id}: MISLABEL — capabilities.fingers=true but the rig has NO articulated finger chains`);
  }
  if (caps.fingers === false && capable && !caps.fingersNote) {
    issues.push(
      `${id}: MISLABEL — the rig HAS articulated finger chains but fingers=false with no fingersNote justifying the demotion`,
    );
  }
  if (caps.feet !== live.feet) {
    issues.push(`${id}: MISLABEL — capabilities.feet=${caps.feet} but the rig feet=${live.feet}`);
  }
  if (caps.faceTouch !== 'none' && live.headCollider === null && live.bonesMissing.includes('head')) {
    issues.push(`${id}: MISLABEL — face-touch enabled without a head`);
  }
  return issues;
}

/** Check a whole manifest against a map of live inspections
 *  (id → inspection|null). Returns { issues, checked, skipped }. */
export function checkManifest(manifest, liveById) {
  const issues = [];
  const checked = [];
  const skipped = [];
  for (const [id, entry] of Object.entries(manifest.avatars ?? {})) {
    const live = liveById[id] ?? null;
    if (live === null && entry.localOnly) {
      skipped.push(id);
      continue;
    }
    checked.push(id);
    issues.push(...compareEntry(id, entry, live));
  }
  return { issues, checked, skipped };
}
