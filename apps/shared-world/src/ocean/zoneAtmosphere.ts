// ZONE ATMOSPHERE (re-scoped CP08 §1, user-authorized 2026-08-14): per-zone
// underwater art direction over the EXISTING WaterThreeJS/post atmosphere
// mechanism — no wave, optical, or shader behavior changes. The driver
// smoothly interpolates the post volumetrics' existing dials (extinction,
// fog color, fog strength, god-ray density), the underwater exposure arm,
// and the terrain caustic tint by viewer position, so each zone reads as a
// coherent identity (Ecco navigation-by-color):
//
//   bright shallows  — clear, luminous teal; substrate plainly readable
//   green midwater   — the Ecco-grade baseline, a touch greener/denser
//   deep / trench    — substantially darker, low visibility, shafts gone
//   dark (caves)     — TRUE-darkness capability for cp09 interiors, driven
//                      by an external caveDarkness input (0 in open water)
//
// Zone identity comes from the baked data: the master depth ramp over the
// water column (world.json "depth-ramp-default": shallow 0–10 m, mid
// 10–36 m, deep 36 m+) plus the authored biome.png rasters as biases
// (R bright-shallow lagoon, G C-kelp-reef shelf, B E-desaturated-plain —
// Track D 17.2 families re-expressed through the new uniforms). Transitions
// are doubly smooth: spatial (smoothstep weight bands over continuous
// depth/raster fields) and temporal (~2.5 s dial convergence — the CP08
// "3–5 s zone transitions" law); there are no boundaries or thresholds.
// The view-direction tint (Track D: fog-color-only, +toward pale cyan
// looking up, − looking down) is applied after smoothing.
//
// Isolation guarantees: every driven dial acts only while the camera is
// submerged (the post volumetrics are gated by uUnderwater; the exposure
// arm fades in over the first 0.6 m of submersion), so the approved
// above-water look, waterline, Snell/refraction behavior, wave field,
// terrain palette, and substrate classification are untouched. With the
// driver disabled the dials return to the Ecco grade.

import type * as THREE from 'three';
import type { WorldData } from '../world/WorldData';
import type { Post } from './Post';

type V3 = [number, number, number];

export interface ZoneDials {
  /** Beer-Lambert absorption per metre (post uExtinction); r > b > g —
   *  red dies first, green travels furthest, in every zone */
  extinction: V3;
  /** the fog color the column dissolves into (post uDeepColor) */
  fogColor: V3;
  /** fog presence (post uFogStrength) */
  fogStrength: number;
  /** god-ray density (post uShaftDensity) */
  shaftDensity: number;
  /** underwater exposure arm (multiplies base × night in applySun) */
  exposureMul: number;
  /** terrain caustic tint scale (dark water kills the dance) */
  causticMul: number;
}

/** The recorded per-zone table (Track D 17.2 starting values re-expressed
 *  through the WaterThreeJS dials; mid = the approved Ecco grade). */
export const ZONE_TABLE: Record<'shallow' | 'mid' | 'deep' | 'dark', ZoneDials> = {
  shallow: {
    extinction: [0.058, 0.022, 0.030],
    fogColor: [0.032, 0.128, 0.112],
    fogStrength: 1.0,
    shaftDensity: 0.06,
    exposureMul: 1.0,
    causticMul: 1.0,
  },
  mid: {
    extinction: [0.072, 0.030, 0.040],
    fogColor: [0.009, 0.080, 0.068],
    fogStrength: 1.15,
    shaftDensity: 0.045,
    exposureMul: 0.96,
    causticMul: 0.85,
  },
  deep: {
    extinction: [0.108, 0.054, 0.066],
    fogColor: [0.0035, 0.026, 0.028],
    fogStrength: 1.25,
    shaftDensity: 0.012,
    exposureMul: 0.78,
    causticMul: 0.25,
  },
  dark: {
    extinction: [0.17, 0.105, 0.115],
    fogColor: [0.0006, 0.004, 0.0048],
    fogStrength: 1.3,
    shaftDensity: 0.0,
    exposureMul: 0.3,
    causticMul: 0.0,
  },
};

/** depth-ramp weight bands (m of water column; master depth ramp) */
export const ZONE_BANDS = {
  SHALLOW_LO: 8,
  SHALLOW_HI: 16,
  DEEP_LO: 30,
  DEEP_HI: 48,
} as const;

/** temporal smoothing time constant (CP08 3–5 s transition law) */
const TAU_S = 2.5;

const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;

export interface ZoneAtmosphereState {
  enabled: boolean;
  caveDarkness: number;
  /** cp09: the test/GUI pin (null = the spatial CaveField drive rules) */
  caveDarknessOverride: number | null;
  weights: { shallow: number; mid: number; deep: number; dark: number };
  biome: { bright: number; kelp: number; plain: number };
  /** current smoothed dials (pre view-tint — the table-comparable state) */
  dials: ZoneDials;
  /** the smoothed exposure arm actually applied (1 above water) */
  exposure: number;
  columnDepthM: number;
}

export class ZoneAtmosphere {
  enabled = true;
  /** cp09: driven every frame by the CaveField at the viewer column
   *  (0 in open water; → 1 inside cave interiors) */
  caveDarkness = 0;
  /** cp09: test/GUI pin — when non-null it replaces the spatial drive
   *  (the cp08 "test-forcible" input, formalized) */
  caveDarknessOverride: number | null = null;
  /** consumed by applySun: uExposure = base × night × zoneExposure.value */
  readonly zoneExposure = { value: 1 };

  private readonly data: WorldData;
  private readonly post: Post;
  private readonly causticColor: THREE.Color;
  private readonly causticBase: { r: number; g: number; b: number };

  // smoothed dial state (starts at the mid/Ecco-grade baseline)
  private cur: ZoneDials = {
    extinction: [...ZONE_TABLE.mid.extinction] as V3,
    fogColor: [...ZONE_TABLE.mid.fogColor] as V3,
    fogStrength: ZONE_TABLE.mid.fogStrength,
    shaftDensity: ZONE_TABLE.mid.shaftDensity,
    exposureMul: ZONE_TABLE.mid.exposureMul,
    causticMul: ZONE_TABLE.mid.causticMul,
  };
  private lastState: ZoneAtmosphereState;

  constructor(data: WorldData, post: Post, causticColorUniform: THREE.Color) {
    this.data = data;
    this.post = post;
    this.causticColor = causticColorUniform;
    this.causticBase = {
      r: causticColorUniform.r,
      g: causticColorUniform.g,
      b: causticColorUniform.b,
    };
    this.lastState = this.snapshot(0, { shallow: 0, mid: 1, deep: 0, dark: 0 }, { bright: 0, kelp: 0, plain: 0 });
  }

  /** bilinear biome sample at world xz (1025² over the region, half-texel
   *  centered like every other region raster); returns 0..1 channels */
  private biomeAt(x: number, z: number): { bright: number; kelp: number; plain: number } {
    const n = this.data.biomeN;
    const size = this.data.header.sizeMeters[0];
    const u = Math.min(Math.max(((x + size / 2) / size) * (n - 1), 0), n - 1);
    const v = Math.min(Math.max(((z + size / 2) / size) * (n - 1), 0), n - 1);
    const i0 = Math.min(Math.floor(u), n - 2);
    const j0 = Math.min(Math.floor(v), n - 2);
    const fu = u - i0;
    const fv = v - j0;
    const ch = (i: number, j: number, c: number) => this.data.biome[(j * n + i) * 4 + c]! / 255;
    const bi = (c: number) =>
      (ch(i0, j0, c) * (1 - fu) + ch(i0 + 1, j0, c) * fu) * (1 - fv) +
      (ch(i0, j0 + 1, c) * (1 - fu) + ch(i0 + 1, j0 + 1, c) * fu) * fv;
    return { bright: bi(0), kelp: bi(1), plain: bi(2) };
  }

  /**
   * Per-frame drive. dtS = 0 freezes the temporal smoothing (the ocean-clock
   * freeze ties in here for deterministic captures). Position is the VIEWER
   * column (the camera tracks the dolphin in play; fog is a property of the
   * medium the viewer is in, and fixed-shot captures stay coherent).
   */
  update(
    dtS: number,
    x: number,
    z: number,
    camY: number,
    surfaceH: number,
    pitchRad: number,
    settle = false,
  ): void {
    if (!this.enabled) return;

    // --- spatial zone weights (smooth fields; no thresholds) ---
    const D = this.data.depthAt(x, z);
    const biome = this.biomeAt(x, z);
    let wShallow = 1 - sstep(ZONE_BANDS.SHALLOW_LO, ZONE_BANDS.SHALLOW_HI, D);
    let wDeep = sstep(ZONE_BANDS.DEEP_LO, ZONE_BANDS.DEEP_HI, D);
    // authored bright-shallow band (biome.R) pulls toward the shallow set
    wShallow = Math.min(1, wShallow + biome.bright * 0.6 * (1 - wDeep));
    let wMid = Math.max(0, 1 - wShallow - wDeep);
    // cave darkness overrides proportionally (cp09 interiors → 1); a
    // non-null test/GUI pin replaces the spatial drive
    const darkIn = this.caveDarknessOverride ?? this.caveDarkness;
    const wDark = Math.min(Math.max(darkIn, 0), 1);
    const open = 1 - wDark;
    wShallow *= open;
    wMid *= open;
    wDeep *= open;

    // --- target dials: weighted blend of the table ---
    const T = ZONE_TABLE;
    const blend = (pick: (d: ZoneDials) => number) =>
      pick(T.shallow) * wShallow + pick(T.mid) * wMid + pick(T.deep) * wDeep + pick(T.dark) * wDark;
    const target: ZoneDials = {
      extinction: [
        blend((d) => d.extinction[0]),
        blend((d) => d.extinction[1]),
        blend((d) => d.extinction[2]),
      ],
      fogColor: [
        blend((d) => d.fogColor[0]),
        blend((d) => d.fogColor[1]),
        blend((d) => d.fogColor[2]),
      ],
      fogStrength: blend((d) => d.fogStrength),
      shaftDensity: blend((d) => d.shaftDensity),
      exposureMul: blend((d) => d.exposureMul),
      causticMul: blend((d) => d.causticMul),
    };

    // authored raster flavors (Track D families, fog-color-level only):
    // kelp reef (biome.G) tilts the fog greener; the desaturated plain
    // (biome.B) lifts + grays the far field (E/G: far fields LIGHTER)
    const k = biome.kelp * (1 - wDark);
    const p = biome.plain * (1 - wDark);
    if (k > 0) {
      target.fogColor = [
        target.fogColor[0] * mixN(1, 0.85, k),
        target.fogColor[1] * mixN(1, 1.1, k),
        target.fogColor[2] * mixN(1, 0.92, k),
      ];
      target.fogStrength += 0.04 * k;
    }
    if (p > 0) {
      const luma =
        0.2126 * target.fogColor[0] + 0.7152 * target.fogColor[1] + 0.0722 * target.fogColor[2];
      target.fogColor = [
        mixN(target.fogColor[0], luma * 1.15, p * 0.6),
        mixN(target.fogColor[1], luma * 1.18, p * 0.6),
        mixN(target.fogColor[2], luma * 1.25, p * 0.6),
      ];
      target.fogStrength += 0.08 * p;
    }

    // --- temporal smoothing (~2.5 s; settle snaps for tests) ---
    const kT = settle ? 1 : dtS > 0 ? 1 - Math.exp(-dtS / TAU_S) : 0;
    const c = this.cur;
    for (let i = 0; i < 3; i++) {
      c.extinction[i] = mixN(c.extinction[i]!, target.extinction[i]!, kT);
      c.fogColor[i] = mixN(c.fogColor[i]!, target.fogColor[i]!, kT);
    }
    c.fogStrength = mixN(c.fogStrength, target.fogStrength, kT);
    c.shaftDensity = mixN(c.shaftDensity, target.shaftDensity, kT);
    c.exposureMul = mixN(c.exposureMul, target.exposureMul, kT);
    c.causticMul = mixN(c.causticMul, target.causticMul, kT);

    // --- view-direction tint (Track D: fog-color uniform only) ---
    const up = sstep(10 * (Math.PI / 180), 30 * (Math.PI / 180), pitchRad);
    const down = sstep(15 * (Math.PI / 180), 35 * (Math.PI / 180), -pitchRad);
    const tint = 1 + 0.12 * up - 0.12 * down;

    // --- write the existing dials ---
    const uw = this.post.underwaterMat.uniforms;
    (uw.uExtinction!.value as THREE.Vector3).set(...c.extinction);
    (uw.uDeepColor!.value as THREE.Color).setRGB(
      c.fogColor[0] * tint,
      c.fogColor[1] * tint,
      c.fogColor[2] * tint,
    );
    uw.uFogStrength!.value = c.fogStrength;
    uw.uShaftDensity!.value = c.shaftDensity;
    this.causticColor.setRGB(
      this.causticBase.r * c.causticMul,
      this.causticBase.g * c.causticMul,
      this.causticBase.b * c.causticMul,
    );
    // exposure arm fades in over the first 0.6 m of submersion (no pop at
    // the waterline; exactly 1 above water)
    const wUnder = sstep(0, 0.6, surfaceH - camY);
    this.zoneExposure.value = mixN(1, c.exposureMul, wUnder);

    this.lastState = this.snapshot(D, { shallow: wShallow, mid: wMid, deep: wDeep, dark: wDark }, biome);
  }

  private snapshot(
    D: number,
    weights: ZoneAtmosphereState['weights'],
    biome: ZoneAtmosphereState['biome'],
  ): ZoneAtmosphereState {
    return {
      enabled: this.enabled,
      caveDarkness: this.caveDarkness,
      caveDarknessOverride: this.caveDarknessOverride,
      weights,
      biome,
      dials: {
        extinction: [...this.cur.extinction] as V3,
        fogColor: [...this.cur.fogColor] as V3,
        fogStrength: this.cur.fogStrength,
        shaftDensity: this.cur.shaftDensity,
        exposureMul: this.cur.exposureMul,
        causticMul: this.cur.causticMul,
      },
      exposure: this.zoneExposure.value,
      columnDepthM: D,
    };
  }

  state(): ZoneAtmosphereState {
    return this.lastState;
  }

  /** disable → restore caller-owned baseline (the Ecco grade) + neutral
   *  exposure/caustics; the caller reapplies the grade dials */
  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.zoneExposure.value = 1;
      this.causticColor.setRGB(this.causticBase.r, this.causticBase.g, this.causticBase.b);
    }
  }
}
