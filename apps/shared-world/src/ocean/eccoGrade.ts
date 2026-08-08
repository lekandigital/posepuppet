// ECCO GRADE (user direction, 2026-08-08): configuration-only tuning of the
// CP05C ocean toward *Ecco the Dolphin: Defender of the Future*, grounded in
// the 13-frame acceptance set (docs/bodyarcade-stage3/references/
// ecco-waterline/) and the Track D palette tables. STRICTLY config: every
// value below is an existing GUI-visible uniform/dial of the ported
// WaterThreeJS pipeline — no shader or behavior code changes, wave spectrum
// and physics untouched.
//
// What the frames show, and what each block chases:
//  - Underwater Ecco water is CHROMATIC TEAL-GREEN (the fog IS the water,
//    Track D P1): green survives deepest into the distance, red dies first,
//    blue in between — never a navy haze. → uExtinction reordered
//    (r > b > g), fog/deep color re-based to dark teal, fog presence up.
//  - Near-field keeps its own warm albedo (sand reads sandy through ~10 m).
//    → clarity up slightly.
//  - Above water: saturated blue sea, vivid cumulus, clean bright daylight,
//    no specular sun streak. → clouds fuller, saturation up, glint softened.
//  - No modern lens tells (Track D §18 spirit the user wants kept for
//    faithfulness): chromatic aberration off, anamorphic streak near zero,
//    bloom restrained, vignette light, grain a whisper.

import type * as THREE from 'three';
import type { Ocean } from './Ocean';
import type { Post } from './Post';
import type { Clouds } from './Clouds';

export const ECCO_GRADE = {
  ocean: {
    /** near-field visibility: sand stays sandy through ~10 m (frames 1, 6) */
    clarity: 1.15,
    /** soften the GGX sun streak — Ecco has no specular streak (P4);
     *  glitter stays 0 (config floor for the no-streak look) */
    roughness: 0.10,
    /** underside distance fog target: dark teal-green, not navy
     *  (ocean shader fades to uDeepColor·0.6 underwater) */
    deepColor: [0.004, 0.046, 0.062] as [number, number, number],
  },
  underwater: {
    /** absorption per metre: red dies first, GREEN survives longest,
     *  blue between — the teal-green Ecco water column */
    extinction: [0.072, 0.030, 0.040] as [number, number, number],
    /** the fog color the column dissolves into (dark chromatic teal) */
    deepColor: [0.010, 0.078, 0.072] as [number, number, number],
    /** fog presence up a touch — "the fog is the water" (P1) */
    fogStrength: 1.15,
    /** god rays slightly restrained (Track D: shafts are accents) */
    shaftDensity: 0.045,
  },
  clouds: {
    /** fuller, whiter cumulus (frames D08_R0006, D10_R0022) */
    coverage: 0.48,
    density: 0.95,
  },
  post: {
    /** Ecco is vividly saturated */
    saturation: 1.12,
    /** modern lens tells off/near-off for period faithfulness */
    ca: 0.0,
    grain: 0.03,
    bloom: 0.35,
    bloomStreak: 0.1,
    vignetteAir: 0.08,
    vignette: 0.25,
  },
} as const;

export interface EccoGradeCtx {
  ocean: Ocean;
  post: Post;
  clouds: Clouds;
}

/** Apply the grade (pure uniform/dial assignment; call applySun() after so
 *  the exposure dimmer re-derives). Re-runnable from the debug GUI. */
export function applyEccoGrade({ ocean, post, clouds }: EccoGradeCtx): void {
  const g = ECCO_GRADE;
  const ou = ocean.uniforms;
  ou.uClarity.value = g.ocean.clarity;
  ou.uRoughness.value = g.ocean.roughness;
  (ou.uDeepColor.value as THREE.Color).setRGB(...g.ocean.deepColor);

  const uw = post.underwaterMat.uniforms;
  (uw.uExtinction!.value as THREE.Vector3).set(...g.underwater.extinction);
  (uw.uDeepColor!.value as THREE.Color).setRGB(...g.underwater.deepColor);
  uw.uFogStrength!.value = g.underwater.fogStrength;
  uw.uShaftDensity!.value = g.underwater.shaftDensity;

  clouds.uniforms.uCoverage!.value = g.clouds.coverage;
  clouds.uniforms.uDensity!.value = g.clouds.density;

  const cm = post.compositeMat.uniforms;
  cm.uSaturation!.value = g.post.saturation;
  cm.uCA!.value = g.post.ca;
  cm.uGrain!.value = g.post.grain;
  cm.uBloom!.value = g.post.bloom;
  post.bloomStreak = g.post.bloomStreak;
  cm.uVignetteAir!.value = g.post.vignetteAir;
  cm.uVignette!.value = g.post.vignette;
}
