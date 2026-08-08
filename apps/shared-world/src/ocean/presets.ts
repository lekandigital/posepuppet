// The cinematic presets from WaterThreeJS src/main.js (values verbatim; see
// WATERTHREEJS_LICENSE.txt). The apply logic is the demo's applyPreset() with
// the lil-gui refresh lines lifted out — GUI sync happens at the call site.
import type * as THREE from 'three';
import type { Ocean } from './Ocean';
import type { Post } from './Post';
import type { Clouds } from './Clouds';

export interface SunParams {
  elevation: number;
  azimuth: number;
}

export interface OceanPreset {
  sun?: { el: number; az: number };
  amplitude?: number;
  choppy?: number;
  speed?: number;
  waveCount?: number;
  exposure?: number;
  bloom?: number;
  clarity?: number;
  depthFalloff?: number;
  sunGlitter?: number;
  sss?: number;
  deep?: string;
  shallow?: string;
  foam?: string;
  foamCoverage?: number;
  crestFoamStart?: number;
  fog?: number;
  shafts?: number;
  roughness?: number;
  cloudCoverage?: number;
  cloudDensity?: number;
  saturation?: number;
}

export const PRESETS: Record<string, OceanPreset> = {
  'Tropical Noon': {
    sun: { el: 60, az: 125 }, amplitude: 0.7, choppy: 0.5, speed: 1.0, waveCount: 26,
    exposure: 1.05, bloom: 0.5, clarity: 1.3, depthFalloff: 0.16, sunGlitter: 0, sss: 0.35,
    deep: '#063049', shallow: '#5fc6c2', foam: '#f6fdff', foamCoverage: 0.9, crestFoamStart: 1.4,
    fog: 1.0, shafts: 0.05,
    roughness: 0.06, cloudCoverage: 0.34, saturation: 1.08,
  },
  'Golden Hour': {
    sun: { el: 8, az: 205 }, amplitude: 0.9, choppy: 0.6, speed: 0.9, waveCount: 26,
    exposure: 1.15, bloom: 0.95, clarity: 1.0, depthFalloff: 0.18, sunGlitter: 0.55, sss: 0.55,
    deep: '#08283b', shallow: '#3f9f9a', foam: '#fff1df', foamCoverage: 0.85, crestFoamStart: 1.5,
    fog: 1.0, shafts: 0.06,
    roughness: 0.09, cloudCoverage: 0.45, saturation: 1.1,
  },
  'Crimson Sunset': {
    sun: { el: 1.5, az: 250 }, amplitude: 1.0, choppy: 0.7, speed: 0.95, waveCount: 24,
    exposure: 1.2, bloom: 1.15, clarity: 0.9, depthFalloff: 0.2, sunGlitter: 0.6, sss: 0.5,
    deep: '#0e1524', shallow: '#33707a', foam: '#ffe4cf', foamCoverage: 0.9, crestFoamStart: 1.4,
    fog: 1.1, shafts: 0.05,
    roughness: 0.11, cloudCoverage: 0.52, saturation: 1.12,
  },
  'Blue Hour': {
    sun: { el: 2.5, az: 292 }, amplitude: 0.6, choppy: 0.5, speed: 0.8, waveCount: 24,
    exposure: 0.9, bloom: 0.6, clarity: 1.0, depthFalloff: 0.2, sunGlitter: 0.4, sss: 0.3,
    deep: '#050f1e', shallow: '#295a72', foam: '#dbe8f2', foamCoverage: 0.9, crestFoamStart: 1.5,
    fog: 1.1, shafts: 0.04,
    roughness: 0.08, cloudCoverage: 0.42, saturation: 1.0,
  },
  'Clear Dawn': {
    sun: { el: 14, az: 95 }, amplitude: 0.55, choppy: 0.45, speed: 0.85, waveCount: 26,
    exposure: 1.05, bloom: 0.7, clarity: 1.4, depthFalloff: 0.15, sunGlitter: 0.45, sss: 0.4,
    deep: '#073246', shallow: '#63c7c0', foam: '#eefaff', foamCoverage: 0.85, crestFoamStart: 1.6,
    fog: 1.0, shafts: 0.06,
    roughness: 0.06, cloudCoverage: 0.28, saturation: 1.06,
  },
  'Stormy Seas': {
    sun: { el: 18, az: 100 }, amplitude: 1.8, choppy: 1.05, speed: 1.6, waveCount: 32,
    exposure: 0.95, bloom: 0.4, clarity: 0.7, depthFalloff: 0.22, sunGlitter: 0.2, sss: 0.25,
    deep: '#0a1a20', shallow: '#38666a', foam: '#eef3f5', foamCoverage: 1.05, crestFoamStart: 1.3,
    fog: 1.35, shafts: 0.05,
    roughness: 0.22, cloudCoverage: 0.7, cloudDensity: 1.5, saturation: 0.92,
  },
};

export interface PresetContext {
  ocean: Ocean;
  post: Post;
  clouds: Clouds;
  sunParams: SunParams;
  applySun: () => void;
}

export function applyPreset(name: string, ctx: PresetContext): boolean {
  const P = PRESETS[name];
  if (!P) return false;
  const { ocean, post, clouds, sunParams, applySun } = ctx;
  const u = ocean.uniforms;
  if (P.sun) { sunParams.elevation = P.sun.el; sunParams.azimuth = P.sun.az; }
  const set = (k: string, v: number | undefined) => { if (v !== undefined) u[k].value = v; };
  set('uAmplitude', P.amplitude); set('uChoppy', P.choppy); set('uSpeed', P.speed);
  set('uWaveCount', P.waveCount); set('uClarity', P.clarity); set('uDepthFalloff', P.depthFalloff);
  set('uSunGlitter', P.sunGlitter); set('uSSSStrength', P.sss); set('uRoughness', P.roughness);
  set('uFoamCoverage', P.foamCoverage); set('uCrestFoamStart', P.crestFoamStart);
  if (P.deep) (u.uDeepColor.value as THREE.Color).set(P.deep);
  if (P.shallow) (u.uShallowColor.value as THREE.Color).set(P.shallow);
  if (P.foam) (u.uFoamColor.value as THREE.Color).set(P.foam);
  if (P.exposure !== undefined) post.compositeMat.uniforms.uExposure.value = P.exposure;
  if (P.bloom !== undefined) post.compositeMat.uniforms.uBloom.value = P.bloom;
  if (P.saturation !== undefined) post.compositeMat.uniforms.uSaturation.value = P.saturation;
  if (P.fog !== undefined) post.underwaterMat.uniforms.uFogStrength.value = P.fog;
  if (P.shafts !== undefined) post.underwaterMat.uniforms.uShaftDensity.value = P.shafts;
  if (P.cloudCoverage !== undefined) clouds.uniforms.uCoverage.value = P.cloudCoverage;
  if (P.cloudDensity !== undefined) clouds.uniforms.uDensity.value = P.cloudDensity;
  applySun();
  return true;
}
