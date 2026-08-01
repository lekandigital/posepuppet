// Checkpoint 07 — Placeholder World: the deterministic placement plan.
//
// Law (addendum §7 + Master §8.3): every approved asset instance or cluster
// whose final asset is unavailable is represented by a color-coded
// RECTANGULAR placeholder at its intended position/scale/orientation/
// footprint/density. Terrain color never satisfies or reduces this
// requirement. No category may be omitted because the terrain suggests the
// biome, a generator might exist, a search is planned, a model is not
// selected, or the area looks acceptable (addendum §7.1).
//
// Placement law (addendum §7.2): approved X/Z and category identity are
// immutable; Y and normals are RESAMPLED from the revised CP05A
// `terrainHeight` — sampled AT LOAD through WorldData (recorded per §6 of
// the checkpoint prompt: load-time sampling, not bake-time). Discrete sites
// come verbatim from `placement.json`; density-driven categories (the
// approved layout defines density, not instances) use the preserved
// dolphin-app technique: deterministic golden-angle scattering with
// value-noise jitter and acceptance gates (Master §3.3 keep-list), fixed
// seeds, no Math.random, no Date.
//
// This module is pure math over the WorldData samplers so the plan is
// byte-deterministic and independently testable.

import type { WorldData } from './WorldData';

/** Master §8.3 placeholder legend — category → hex, verbatim. */
export const PLACEHOLDER_LEGEND = {
  rock: { hex: 0x7c8468, label: 'Rock / reef formation' },
  coral: { hex: 0xd97a4a, label: 'Plate/soft coral, anemone, sponge' },
  kelp: { hex: 0x3e9b3a, label: 'Kelp' },
  seagrass: { hex: 0x5e8a50, label: 'Seagrass / ground vegetation' },
  tree: { hex: 0x3e6b2e, label: 'Tree / shrub (exposed land)' },
  flower: { hex: 0xc05a9e, label: 'Flower accent' },
  ruin: { hex: 0x9aa79a, label: 'Ruin / ancient structure' },
  building: { hex: 0xa9784a, label: 'Building / dock' },
  wreck: { hex: 0x8c9296, label: 'Wreck' },
  fish: { hex: 0xd0452f, label: 'Fish-school volume' },
  animal: { hex: 0xd08038, label: 'Large marine animal' },
  cave: { hex: 0x6e6e76, label: 'Cave module (pre-asset)' },
  audio: { hex: 0x8e5ad0, label: 'Audio emitter (dev view)' },
} as const;

export type PlaceholderCategory = keyof typeof PLACEHOLDER_LEGEND;

/**
 * CP07 constants. Tolerances are [DERIVED] for this checkpoint and
 * reported in the checkpoint report:
 *  - embed depth = min(EMBED_M, EMBED_FRAC·height): grounded boxes sink
 *    this far below their lowest footprint contact, so floating is
 *    impossible by construction and squat tufts are not swallowed.
 *  - FLOAT_TOL_M: asserted residual float gap (normal-aligned boxes on
 *    curved ground can open a corner gap; beyond this it is a defect —
 *    fixed approved sites are FLAGGED, never moved; scatter candidates
 *    are deterministically rejected).
 *  - EXPOSED_MIN_SCATTER / EXPOSED_MIN_FIXED: minimum fraction of the box
 *    height clearing the MEAN footprint sample (the never-fully-buried
 *    law; the mean keeps the law scale-fair — a single micro-hummock
 *    corner cannot condemn a squat vegetation tuft, while a genuinely
 *    buried box still fails); the scatter gate rejects, fixed sites flag.
 *    hMax is retained in the contact record for review.
 *  - SLOPE_MAX_DEG: scatter slope gate (addendum §7.2 unintended
 *    steep-terrain intersections).
 *  - RESERVE_M / CAVE_RESERVE_M / SPAWN_CLEAR_M: scatter exclusion radii
 *    that keep the cave/arch/ruin/structure seam reservations and the
 *    spawn (four-shot) neighborhood clear (prompt §3.2 seam retention).
 * Seeds continue the bake's seed family (world seed 60418003).
 */
export const PH = {
  EMBED_M: 0.3,
  EMBED_FRAC: 0.25,
  FLOAT_TOL_M: 0.05,
  EXPOSED_MIN_SCATTER: 0.25,
  EXPOSED_MIN_FIXED: 0.1,
  SLOPE_MAX_DEG: 35,
  RESERVE_M: 18,
  CAVE_RESERVE_M: 25,
  SPAWN_CLEAR_M: 25,
  VOLUME_TOP_MAX_Y: -1.0,
  VOLUME_BOTTOM_CLEAR_M: 0.5,
  NORMAL_EPS_M: 1.5,
  SEEDS: {
    kelp: 60470001,
    seagrass: 60470002,
    coral: 60470003,
    boulder: 60470004,
    tree: 60470005,
    grass: 60470006,
    ruinCluster: 60470007,
  },
} as const;

export interface PlaceholderContact {
  hCenter: number;
  hMin: number;
  hMax: number;
  /** largest gap between the box base and the terrain under the footprint */
  floatGapM: number;
  /** fraction of the box height clearing the highest footprint sample */
  exposedFrac: number;
  slopeDeg: number;
  /** fixed approved site violating the contact gates on the revised
   *  terrain — REPORTED, never moved (addendum §7.2) */
  steepFlag: boolean;
}

export interface PlaceholderInstance {
  /** census id: `${category}/${name}` */
  id: string;
  category: PlaceholderCategory;
  /** placement.json category for approved-site placeholders, else 'density' */
  source: string;
  /** census cluster this instance belongs to */
  cluster: string;
  x: number;
  z: number;
  /** box CENTER y (world meters) */
  y: number;
  yaw: number;
  /** box dimensions, meters */
  size: [number, number, number];
  /** 'up' = world-vertical (+yaw); 'normal' = tilted to the terrain normal */
  align: 'up' | 'normal';
  /** ground-contact law applies (false = mid-water volume) */
  grounded: boolean;
  /** terrain normal at (x,z), load-sampled */
  normal: [number, number, number];
  contact: PlaceholderContact;
}

/** A non-asset approved site: represented in the census, dev-view only. */
export interface PlaceholderSite {
  id: string;
  source: string;
  type: string;
  x: number;
  z: number;
  yaw: number;
  y: number;
  representation: string;
}

export interface PlaceholderCensusRow {
  category: PlaceholderCategory;
  label: string;
  hex: string;
  clusters: number;
  instances: number;
}

export interface PlaceholderPlan {
  instances: PlaceholderInstance[];
  sites: PlaceholderSite[];
  census: PlaceholderCensusRow[];
  /** legend categories with zero placements + the governing reason */
  notPlaced: { category: PlaceholderCategory; reason: string }[];
  /** placement.json instance → how it is represented (zero omissions law) */
  placementMap: { category: string; type: string; x: number; z: number; representation: string }[];
  /** deterministic digest of every placed transform (replay-style) */
  digest: string;
  ySampling: string;
}

// ---------------------------------------------------------------- RNG/noise

/** mulberry32 — the deterministic PRNG family used across the repo. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** deterministic 2-D value-noise hash ∈ [0,1) (scatter jitter). */
function hash2(x: number, z: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.round(x * 8192), 0x85ebca6b);
  h = Math.imul(h ^ Math.round(z * 8192), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ---------------------------------------------------------------- builder

interface WorldLike {
  terrainHeight(x: number, z: number): number;
  biomeAt(x: number, z: number): [number, number, number];
  placement: WorldData['placement'];
  header: { spawn: { x: number; z: number } };
}

export function buildPlaceholderPlan(world: WorldLike): PlaceholderPlan {
  const instances: PlaceholderInstance[] = [];
  const sites: PlaceholderSite[] = [];
  const placementMap: PlaceholderPlan['placementMap'] = [];

  const h = (x: number, z: number) => world.terrainHeight(x, z);
  const spawn = world.header.spawn;

  const normalAt = (x: number, z: number): [number, number, number] => {
    const e = PH.NORMAL_EPS_M;
    const dx = (h(x + e, z) - h(x - e, z)) / (2 * e);
    const dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
    const inv = 1 / Math.hypot(dx, 1, dz);
    return [-dx * inv, inv, -dz * inv];
  };
  const slopeDegAt = (x: number, z: number): number => {
    const n = normalAt(x, z);
    return (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
  };

  // scatter exclusion set: every approved discrete reservation stays clear
  // (cave/arch seam reservations, ruin/wreck/monolith footprints, the
  // spire/silhouette formation sites, spawn + four-shot neighborhood)
  const reserves: { x: number; z: number; r: number }[] = [
    { x: spawn.x, z: spawn.z, r: PH.SPAWN_CLEAR_M },
  ];
  for (const p of world.placement.instances) {
    if (p.category === 'cave-mouth' || p.category === 'arch') {
      reserves.push({ x: p.x, z: p.z, r: PH.CAVE_RESERVE_M });
    } else if (
      p.category === 'ruin' ||
      p.category === 'wreck' ||
      p.category === 'spire' ||
      p.category === 'silhouette' ||
      p.category === 'discovery'
    ) {
      reserves.push({ x: p.x, z: p.z, r: PH.RESERVE_M });
    }
  }
  const clearOfReserves = (x: number, z: number): boolean =>
    reserves.every((rv) => Math.hypot(x - rv.x, z - rv.z) > rv.r);

  const embedFor = (sy: number): number => Math.min(PH.EMBED_M, PH.EMBED_FRAC * sy);

  /** yaw-rotated footprint sample points: center + 4 corners. */
  function footprint(
    x: number,
    z: number,
    yaw: number,
    sx: number,
    sz: number,
  ): [number, number][] {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const pts: [number, number][] = [[x, z]];
    for (const [ux, uz] of [
      [-sx / 2, -sz / 2],
      [sx / 2, -sz / 2],
      [-sx / 2, sz / 2],
      [sx / 2, sz / 2],
    ] as [number, number][]) {
      pts.push([x + ux * c + uz * s, z - ux * s + uz * c]);
    }
    return pts;
  }

  /**
   * Grounded contact solve against the load-sampled CP05A heightfield.
   *  - 'up': base = hMin − embed → float gap 0 by construction; the
   *    exposed fraction measures burial at the highest sample.
   *  - 'normal': the box lies on the tangent plane through the center;
   *    per-corner terrain deviation from that plane yields the corner
   *    float gap (terrain fell away) and the burial (terrain rose).
   */
  function groundedSolve(
    x: number,
    z: number,
    yaw: number,
    size: [number, number, number],
    align: 'up' | 'normal',
  ): { y: number; contact: PlaceholderContact; fixedOk: boolean; scatterOk: boolean } {
    const [sx, sy, sz] = size;
    const embed = embedFor(sy);
    const pts = footprint(x, z, yaw, sx, sz);
    const hs = pts.map(([px, pz]) => h(px, pz));
    const hCenter = hs[0]!;
    const hMin = Math.min(...hs);
    const hMax = Math.max(...hs);
    const hMean = hs.reduce((a, b) => a + b, 0) / hs.length;
    const slopeDeg = slopeDegAt(x, z);

    let y: number;
    let floatGapM: number;
    let exposedFrac: number;
    if (align === 'up') {
      const base = hMin - embed;
      y = base + sy / 2;
      floatGapM = 0;
      exposedFrac = (base + sy - hMean) / sy;
    } else {
      const n = normalAt(x, z);
      // terrain deviation from the tangent plane through (x, hCenter, z)
      let devMin = 0;
      let devSum = 0;
      for (let i = 1; i < pts.length; i++) {
        const [px, pz] = pts[i]!;
        const planeH = hCenter - (n[0] * (px - x) + n[2] * (pz - z)) / n[1];
        const dev = hs[i]! - planeH;
        devMin = Math.min(devMin, dev);
        devSum += dev;
      }
      const devMean = devSum / (pts.length - 1);
      // center sits along the normal so the base plane is embed below the
      // tangent plane
      y = hCenter + n[1] * (sy / 2 - embed);
      floatGapM = Math.max(0, -devMin - embed);
      exposedFrac = (sy - embed - Math.max(0, devMean)) / sy;
    }
    const scatterOk =
      floatGapM <= PH.FLOAT_TOL_M &&
      exposedFrac >= PH.EXPOSED_MIN_SCATTER &&
      slopeDeg <= PH.SLOPE_MAX_DEG;
    const fixedOk = floatGapM <= PH.FLOAT_TOL_M && exposedFrac >= PH.EXPOSED_MIN_FIXED;
    return {
      y,
      fixedOk,
      scatterOk,
      contact: {
        hCenter,
        hMin,
        hMax,
        floatGapM,
        exposedFrac,
        slopeDeg,
        steepFlag: !fixedOk,
      },
    };
  }

  /** fixed approved site: placed unconditionally, flagged when the revised
   *  terrain violates the contact gates (reported, never moved). */
  function addFixed(
    category: PlaceholderCategory,
    source: string,
    cluster: string,
    name: string,
    x: number,
    z: number,
    yaw: number,
    size: [number, number, number],
    align: 'up' | 'normal' = 'up',
  ): void {
    const { y, contact } = groundedSolve(x, z, yaw, size, align);
    instances.push({
      id: `${category}/${name}`,
      category, source, cluster,
      x, z, y, yaw, size, align,
      grounded: true,
      normal: normalAt(x, z),
      contact,
    });
  }

  /** scatter candidate: placed only when the contact gates pass. */
  function addScattered(
    category: PlaceholderCategory,
    cluster: string,
    name: string,
    x: number,
    z: number,
    yaw: number,
    size: [number, number, number],
    align: 'up' | 'normal' = 'up',
  ): boolean {
    const { y, contact, scatterOk } = groundedSolve(x, z, yaw, size, align);
    if (!scatterOk) return false;
    instances.push({
      id: `${category}/${name}`,
      category,
      source: 'density',
      cluster,
      x, z, y, yaw, size, align,
      grounded: true,
      normal: normalAt(x, z),
      contact: { ...contact, steepFlag: false },
    });
    return true;
  }

  /** mid-water volume (fish school / large animal): the ground-contact law
   *  does not apply; fully-submerged + seabed clearance are asserted. */
  function addVolume(
    category: PlaceholderCategory,
    source: string,
    cluster: string,
    name: string,
    x: number,
    z: number,
    size: [number, number, number],
  ): void {
    const sy = size[1];
    const floor = h(x, z);
    const depth = Math.max(0, -floor);
    const lo = floor + PH.VOLUME_BOTTOM_CLEAR_M + sy / 2;
    const hi = PH.VOLUME_TOP_MAX_Y - sy / 2;
    const y = Math.min(hi, Math.max(lo, floor + depth * 0.45));
    instances.push({
      id: `${category}/${name}`,
      category, source, cluster,
      x, z, y,
      yaw: 0,
      size,
      align: 'up',
      grounded: false,
      normal: normalAt(x, z),
      contact: {
        hCenter: floor, hMin: floor, hMax: floor,
        floatGapM: 0,
        exposedFrac: 1,
        slopeDeg: slopeDegAt(x, z),
        steepFlag: false,
      },
    });
  }

  /** deterministic golden-angle scatter around an anchor with value-noise
   *  jitter + acceptance gates (the Master §3.3 preserved technique).
   *  `place` returns whether the candidate survived its contact gates. */
  function scatter(
    seed: number,
    anchor: { x: number; z: number },
    spreadR: number,
    want: number,
    accept: (x: number, z: number) => boolean,
    place: (x: number, z: number, k: number, rng: () => number) => boolean,
    opts: { maxTries?: number; respectReserves?: boolean } = {},
  ): number {
    const rng = mulberry32(seed);
    const rot = rng() * Math.PI * 2;
    const maxTries = opts.maxTries ?? want * 16;
    const respect = opts.respectReserves ?? true;
    let placed = 0;
    for (let k = 0; k < maxTries && placed < want; k++) {
      const rr = spreadR * Math.sqrt((k + 0.5) / maxTries);
      const a = rot + k * GOLDEN_ANGLE;
      const jr = (hash2(anchor.x + k, anchor.z - k, seed) - 0.5) * spreadR * 0.18;
      const x = anchor.x + Math.cos(a) * (rr + jr);
      const z = anchor.z + Math.sin(a) * (rr + jr);
      if (respect && !clearOfReserves(x, z)) continue;
      if (!accept(x, z)) continue;
      if (place(x, z, placed, rng)) placed++;
    }
    return placed;
  }

  // ------------------------------------------------------------ 1. approved
  // discrete sites from placement.json (X/Z + yaw verbatim — immutable)

  const byCat = (cat: string) => world.placement.instances.filter((p) => p.category === cat);
  const mapRep = (p: { category: string; type: string; x: number; z: number }, rep: string) =>
    placementMap.push({ category: p.category, type: p.type, x: p.x, z: p.z, representation: rep });

  // ruins: shoreline settlement = block cluster; column field = colonnade.
  // The cluster ANCHOR keeps the exact approved X/Z; member blocks spread
  // deterministically around it (a ruin is a cluster-class site).
  for (const p of byCat('ruin')) {
    if (p.type === 'shoreline-settlement') {
      const rng = mulberry32(PH.SEEDS.ruinCluster);
      addFixed('ruin', p.category, p.type, `${p.type}-core`, p.x, p.z, p.yaw, [5, 3.2, 3.5]);
      for (let k = 0; k < 5; k++) {
        const a = p.yaw + k * GOLDEN_ANGLE;
        const r = 6 + rng() * 10;
        addFixed(
          'ruin', p.category, p.type, `${p.type}-block-${k + 1}`,
          p.x + Math.cos(a) * r, p.z + Math.sin(a) * r,
          p.yaw + (rng() - 0.5) * 1.2,
          [2.2 + rng() * 1.6, 1.8 + rng() * 1.4, 1.8 + rng() * 1.2],
        );
      }
      mapRep(p, 'ruin placeholder cluster (6 blocks) anchored at the approved X/Z');
    } else {
      const rng = mulberry32(PH.SEEDS.ruinCluster + 1);
      const rot = rng() * Math.PI * 2;
      for (let k = 0; k < 9; k++) {
        const r = 16 * Math.sqrt((k + 0.5) / 9);
        const a = rot + k * GOLDEN_ANGLE;
        addFixed(
          'ruin', p.category, p.type, `${p.type}-column-${k + 1}`,
          p.x + Math.cos(a) * r, p.z + Math.sin(a) * r,
          p.yaw,
          [0.9, 4.5, 0.9],
        );
      }
      mapRep(p, 'ruin placeholder colonnade (9 columns) anchored at the approved X/Z');
    }
  }

  // monolith-ring discovery: 7 stones at EXACT approved transforms
  for (const p of byCat('discovery')) {
    addFixed('ruin', p.category, 'monolith-ring', p.type, p.x, p.z, p.yaw, [1.4, 3.6, 1.0]);
    mapRep(p, 'ruin (ancient structure) placeholder stone at the exact approved X/Z/yaw');
  }

  // wreck: one hull lying on the seabed (terrain-normal aligned)
  for (const p of byCat('wreck')) {
    addFixed('wreck', p.category, p.type, p.type, p.x, p.z, p.yaw, [14, 4.5, 5], 'normal');
    mapRep(p, 'wreck placeholder hull at the approved X/Z (terrain-normal aligned)');
  }

  // cave mouths + arch: pre-asset cave-module reservation markers
  for (const p of byCat('cave-mouth')) {
    addFixed('cave', p.category, p.type, p.type, p.x, p.z, p.yaw, [6, 6, 1.5]);
    mapRep(p, 'cave-module placeholder slab at the approved mouth (cp09 seam reserved)');
  }
  for (const p of byCat('arch')) {
    addFixed('cave', p.category, p.type, p.type, p.x, p.z, p.yaw, [8, 7, 1.5]);
    mapRep(p, 'cave-module placeholder slab at the approved arch (opening 5 m, cp09 seam reserved)');
  }

  // spires + plain silhouette: authored rock-formation placeholders
  // (§6.7 spires 6–16 m tall; sites are CP05A protected-flat reservations)
  const spireSizes: [number, number, number][] = [
    [3.5, 11, 3.5],
    [4, 14, 4],
  ];
  byCat('spire').forEach((p, i) => {
    addFixed('rock', p.category, p.type, p.type, p.x, p.z, p.yaw, spireSizes[i] ?? [3.5, 11, 3.5]);
    mapRep(p, 'rock-formation placeholder spire at the approved X/Z');
  });
  for (const p of byCat('silhouette')) {
    addFixed('rock', p.category, p.type, p.type, p.x, p.z, p.yaw, [10, 9, 6]);
    mapRep(p, 'rock-formation placeholder mass at the approved X/Z');
  }

  // ------------------------------------------------------------ 2. non-asset
  // approved sites: represented in the census, dev-view markers only.
  // Judgment calls (checkpoint report §12): these carry no §8.3 asset
  // category — spawn/route/breach are navigation metadata (realized by the
  // sim + loop), corridor masses are realized as baked terrain islets
  // (CP05A rocky correction), and the current funnel is a future flow
  // EFFECT with no asset and no legend color — kept visible in dev view,
  // never faked with an invented palette entry.
  const siteRep: Record<string, string> = {
    spawn: 'realized — the sim spawn point (WorldData header + placement)',
    breach: 'realized — approved breach-sightline waypoint (CP06 breach system)',
    route: 'realized — approved loop waypoint (navigation metadata)',
    'corridor-mass': 'realized — baked terrain islet (CP05A rocky-islet correction)',
    current:
      'dev-view marker — flow effect pending a later checkpoint (no asset category; reported §12)',
  };
  for (const p of world.placement.instances) {
    const rep = siteRep[p.category];
    if (!rep) continue;
    sites.push({
      id: `${p.category}/${p.type}`,
      source: p.category,
      type: p.type,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      y: Math.max(h(p.x, p.z) + 1.5, -3),
      representation: rep,
    });
    mapRep(p, rep);
  }

  // ------------------------------------------------------------ 3. density
  // categories — the approved layout defines density, not instances
  // (CP03 zones + Track D §12 wildlife budgets + §14 composition grammar).

  // KELP — family-C kelp reef, south bay shelf (biome.G): "a local
  // screen-dividing device in its reef, not world-wide fill" → up to 6
  // fields of 5–8 tall blades on the shelf (depth 8–36 m).
  scatter(
    PH.SEEDS.kelp,
    { x: -180, z: 300 },
    260,
    6,
    (x, z) => {
      const th = h(x, z);
      return world.biomeAt(x, z)[1] >= 0.5 && th <= -8 && th >= -36 && slopeDegAt(x, z) <= 30;
    },
    (fx, fz, fi, rng) => {
      const field = `kelp-field-${fi + 1}`;
      const want = 5 + Math.floor(rng() * 4);
      const blades = scatter(
        PH.SEEDS.kelp + 100 + fi,
        { x: fx, z: fz },
        6,
        want,
        (x, z) => h(x, z) < -4,
        (bx, bz, bi, brng) => {
          const depth = -h(bx, bz);
          const bladeH = Math.min(12, Math.max(4, depth - 1.5));
          return addScattered(
            'kelp', field, `${field}-blade-${bi + 1}`,
            bx, bz, brng() * Math.PI * 2,
            [0.7, bladeH, 0.2],
          );
        },
      );
      return blades > 0;
    },
  );

  // SEAGRASS (underwater) — bright shallow lagoon (biome.R), sand,
  // depth 2–10 m: up to 8 patches of 5 low tufts.
  scatter(
    PH.SEEDS.seagrass,
    { x: -180, z: -380 },
    200,
    8,
    (x, z) => {
      const th = h(x, z);
      return world.biomeAt(x, z)[0] >= 0.5 && th <= -2 && th >= -10 && slopeDegAt(x, z) <= 25;
    },
    (px, pz, pi) => {
      const patch = `seagrass-patch-${pi + 1}`;
      const tufts = scatter(
        PH.SEEDS.seagrass + 100 + pi,
        { x: px, z: pz },
        5,
        5,
        (x, z) => h(x, z) < -1.5,
        (tx, tz, ti, trng) =>
          addScattered(
            'seagrass', patch, `${patch}-tuft-${ti + 1}`,
            tx, tz, trng() * Math.PI * 2,
            [1.0, 0.6, 1.0],
          ),
      );
      return tufts > 0;
    },
  );

  // GRASS CLUMPS (exposed land — same §8.3 "Seagrass / ground vegetation"
  // category): clumps on the crescent inner shore + S island.
  // anchors sit on the gentle low-land bands of the CP05A terrain (headland
  // saddle, crescent SE shore, S island) — probed, not guessed
  const grassAnchors = [
    { x: -520, z: -50 },
    { x: -520, z: 350 },
    { x: -390, z: 665 },
  ];
  grassAnchors.forEach((anchor, gi) => {
    const clump = `grass-clump-${gi + 1}`;
    scatter(
      PH.SEEDS.grass + gi,
      anchor,
      70,
      4,
      (x, z) => {
        const th = h(x, z);
        return th >= 0.5 && th <= 40 && slopeDegAt(x, z) <= 30;
      },
      (x, z, ti, trng) =>
        addScattered(
          'seagrass', clump, `${clump}-tuft-${ti + 1}`,
          x, z, trng() * Math.PI * 2,
          [0.8, 0.4, 0.8],
        ),
    );
  });

  // CORAL — clusters on reef rock: the south-bay shelf (zone C) plus the
  // islet-chain corridor fringe (the reef-rock corridor masses), depth
  // 5–30 m: up to 10 clusters of 3–5 blocks.
  {
    const coralAnchors = [
      { x: -180, z: 300, r: 240, n: 7, requireZone: true },
      { x: 80, z: -90, r: 120, n: 3, requireZone: false },
    ];
    let ci = 0;
    for (const a of coralAnchors) {
      scatter(
        PH.SEEDS.coral + a.n,
        a,
        a.r,
        a.n,
        (x, z) => {
          const th = h(x, z);
          if (a.requireZone && world.biomeAt(x, z)[1] < 0.35) return false;
          return th <= -5 && th >= -30 && slopeDegAt(x, z) <= 40;
        },
        (cx, cz, _k, rng) => {
          const clus = `coral-cluster-${ci + 1}`;
          const want = 3 + Math.floor(rng() * 3);
          const blocks = scatter(
            PH.SEEDS.coral + 100 + ci,
            { x: cx, z: cz },
            5,
            want,
            (x, z) => h(x, z) < -3,
            (bx, bz, bi, brng) => {
              const s = 1.2 + brng();
              return addScattered(
                'coral', clus, `${clus}-block-${bi + 1}`,
                bx, bz, brng() * Math.PI * 2,
                [s, 0.8 + brng() * 1.2, s],
              );
            },
          );
          if (blocks > 0) ci++;
          return blocks > 0;
        },
      );
    }
  }

  // FREESTANDING ROCKS / BOULDERS — sparse-by-default across the reef
  // shelf, lagoon fringe and plain edge (composition grammar: clusters
  // versus voids; never uniform fill).
  {
    const boulderAnchors = [
      { x: -180, z: 300, r: 250, n: 6 },
      { x: -180, z: -380, r: 210, n: 4 },
      { x: 140, z: 660, r: 180, n: 4 },
    ];
    let bi = 0;
    boulderAnchors.forEach((a, ai) => {
      scatter(
        PH.SEEDS.boulder + ai,
        a,
        a.r,
        a.n,
        (x, z) => {
          const th = h(x, z);
          return th <= -3 && th >= -50;
        },
        (x, z, _k, rng) => {
          const s = 1.2 + rng() * 2.3;
          const ok = addScattered(
            'rock', `boulder-${bi + 1}`, `boulder-${bi + 1}`,
            x, z, rng() * Math.PI * 2,
            [s, s * 0.8, s * (0.8 + rng() * 0.4)],
            'normal',
          );
          if (ok) bi++;
          return ok;
        },
      );
    });
  }

  // TREES / SHRUBS — exposed land on the three islands (breach-visible
  // land vegetation; addendum §2.5 trees + shrubs).
  {
    const treeAnchors = [
      { x: -600, z: -200, r: 220, trees: 10, shrubs: 5 },
      { x: -560, z: 250, r: 180, trees: 7, shrubs: 4 },
      { x: 480, z: -560, r: 130, trees: 5, shrubs: 2 },
      { x: -380, z: 640, r: 110, trees: 2, shrubs: 1 },
    ];
    treeAnchors.forEach((a, ai) => {
      let ti = 0;
      scatter(
        PH.SEEDS.tree + ai,
        a,
        a.r,
        a.trees,
        (x, z) => {
          const th = h(x, z);
          return th >= 1.5 && th <= 130;
        },
        (x, z, _k, rng) => {
          const s = 2.0 + rng() * 1.2;
          const ok = addScattered(
            'tree', `island-${ai + 1}-trees`, `island-${ai + 1}-tree-${ti + 1}`,
            x, z, rng() * Math.PI * 2,
            [s, 5.5 + rng() * 3, s],
          );
          if (ok) ti++;
          return ok;
        },
      );
      let si = 0;
      scatter(
        PH.SEEDS.tree + 50 + ai,
        a,
        a.r,
        a.shrubs,
        (x, z) => {
          const th = h(x, z);
          return th >= 0.8 && th <= 130;
        },
        (x, z, _k, rng) => {
          const ok = addScattered(
            'tree', `island-${ai + 1}-shrubs`, `island-${ai + 1}-shrub-${si + 1}`,
            x, z, rng() * Math.PI * 2,
            [1.5, 1.8 + rng() * 0.6, 1.5],
          );
          if (ok) si++;
          return ok;
        },
      );
    });
  }

  // FISH-SCHOOL VOLUMES — Track D §12: one 12–24-fish school per
  // 60–120 s of reef traversal → 4 volumes on the reef/corridor legs of
  // the approved loop (each named with its budget).
  const schoolSites = [
    { x: 40, z: -185, name: 'corridor' },
    { x: -180, z: 300, name: 'south-bay-shelf' },
    { x: -280, z: 380, name: 'kelp-west' },
    { x: 300, z: -140, name: 'funnel-approach' },
  ];
  schoolSites.forEach((sc, i) => {
    addVolume(
      'fish', 'density', `school-${sc.name}`, `school-${i + 1}-${sc.name}-12-24`,
      sc.x, sc.z,
      [10, 5, 10],
    );
  });

  // LARGE MARINE ANIMAL — Track D §12: one patrolling shark per plain
  // pocket → 1 patrol volume in the E desaturated-plain pocket.
  addVolume('animal', 'density', 'plain-shark', 'plain-pocket-shark-patrol', 140, 660, [16, 5, 16]);

  // ------------------------------------------------------------ 4. legend
  // categories with no approved placements in THIS layout (reported, never
  // silently dropped — addendum §7.3 / prompt §11)
  const notPlaced: PlaceholderPlan['notPlaced'] = [
    {
      category: 'flower',
      reason:
        'Track D flower accents belong to zone families B/F; the approved Twin Bay layout carries ' +
        'bright-shallow/C-kelp/E-plain/D-cave only — no approved flower-accent site exists.',
    },
    {
      category: 'building',
      reason:
        'the approved layout has no building/dock site (its three built sites are the two ruins and ' +
        'the wreck, placed above); no instance may be invented.',
    },
    {
      category: 'audio',
      reason:
        'the cp13 audio slice is global ambient loops + event sounds with no approved positional ' +
        'emitter sites in the placement manifest; dev-view emitters arrive with cp13.',
    },
  ];

  const census: PlaceholderCensusRow[] = [];
  for (const key of Object.keys(PLACEHOLDER_LEGEND) as PlaceholderCategory[]) {
    const mine = instances.filter((i) => i.category === key);
    if (mine.length === 0) continue;
    census.push({
      category: key,
      label: PLACEHOLDER_LEGEND[key].label,
      hex: '#' + PLACEHOLDER_LEGEND[key].hex.toString(16).toUpperCase().padStart(6, '0'),
      clusters: new Set(mine.map((i) => i.cluster)).size,
      instances: mine.length,
    });
  }

  const digest = instances
    .map(
      (i) =>
        `${i.id}:${i.x.toFixed(4)},${i.y.toFixed(4)},${i.z.toFixed(4)},${i.yaw.toFixed(4)},` +
        i.size.map((v) => v.toFixed(3)).join('x'),
    )
    .join('|');

  return {
    instances,
    sites,
    census,
    notPlaced,
    placementMap,
    digest,
    ySampling: 'load-time WorldData.terrainHeight (CP05A revised heightfield)',
  };
}
