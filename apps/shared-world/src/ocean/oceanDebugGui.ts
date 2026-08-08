// Debug-only lil-gui panel for the CP05C ocean (?debug=1). The folders are
// the WaterThreeJS demo's own (Waves / Surface / Water & colour / Foam /
// Objects / Volumetric clouds / Underwater / Post) plus the BodyArcade
// time-of-day controls. Never constructed outside debug mode — zero cost in
// tests and normal play.

import GUI from 'lil-gui';
import type * as THREE from 'three';
import type { Ocean } from './Ocean';
import type { Post } from './Post';
import type { Clouds } from './Clouds';
import type { FloatingBodies } from './FloatingBodies';
import type { TimeOfDay } from './timeOfDay';
import { PRESETS, type SunParams } from './presets';
import { OCEAN_CONFIG } from './Ocean';

export interface OceanDebugGuiCtx {
  ocean: Ocean;
  post: Post;
  clouds: Clouds;
  bodies: FloatingBodies;
  timeOfDay: TimeOfDay;
  sunParams: SunParams;
  applySun: () => void;
  cloudShadowP: { strength: number };
  setCloudsEnabled: (on: boolean) => void;
  applyPreset: (name: string) => boolean;
  dropAt: (type: 'sphere' | 'cube') => void;
  /** base exposure — applySun derives uExposure = base × night dimmer */
  postExposure: { base: number };
  /** restore the boot-time Ecco grade after preset/slider experiments */
  applyEccoGrade: () => void;
}

export function mountOceanDebugGui(ctx: OceanDebugGuiCtx): GUI {
  const { ocean, post, clouds, bodies, timeOfDay, sunParams, applySun } = ctx;
  const gui = new GUI({ title: 'Ocean (cp05C debug)' });

  gui
    .add({ ecco: () => { ctx.applyEccoGrade(); gui.controllersRecursive().forEach((c) => c.updateDisplay()); } }, 'ecco')
    .name('↺ Ecco grade (default)');

  const fTod = gui.addFolder('Time of day');
  fTod.add(timeOfDay, 'speedMul', 0, 30, 0.5).name('cycle speed ×');
  fTod.add(timeOfDay, 'frozen').name('pause cycle');
  fTod
    .add(timeOfDay, 'phase', 0, 1, 0.001)
    .name('phase (scrub)')
    .onChange((v: number) => timeOfDay.set({ phase: v }));
  fTod.add(sunParams, 'elevation', -12, 89, 0.5).name('sun elevation').onChange(applySun).listen();
  fTod.add(sunParams, 'azimuth', 0, 360, 1).name('sun azimuth').onChange(applySun).listen();

  const fPre = gui.addFolder('Cinematic presets').close();
  const presetProxy = { preset: 'Tropical Noon' };
  fPre
    .add(presetProxy, 'preset', Object.keys(PRESETS))
    .name('preset')
    .onChange((name: string) => {
      // sun keys are skipped while the auto-cycle runs (it owns the sun)
      const P = PRESETS[name];
      const savedSun = P?.sun;
      if (P && !timeOfDay.frozen) delete P.sun;
      ctx.applyPreset(name);
      if (P && savedSun && !P.sun) P.sun = savedSun;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });

  const u = ocean.uniforms;
  const fWaves = gui.addFolder('Waves').close();
  fWaves.add(u.uAmplitude!, 'value', 0.1, 3.5, 0.05).name('amplitude');
  fWaves.add(u.uChoppy!, 'value', 0.0, 1.4, 0.02).name('choppiness');
  fWaves.add(u.uWaveCount!, 'value', 4, 40, 1).name('wave count');
  fWaves.add(u.uSpeed!, 'value', 0.0, 3.0, 0.05).name('speed');
  fWaves.add(u.uDirSpread!, 'value', 0.0, 1.6, 0.02).name('direction spread');
  fWaves
    .add({ wl: OCEAN_CONFIG.baseWavelength }, 'wl', 40, 320, 5)
    .name('swell length')
    .onChange((v: number) => (u.uBaseFreq!.value = (2 * Math.PI) / v));

  const fSurf = gui.addFolder('Surface').close();
  fSurf.add(u.uDetailStrength!, 'value', 0.0, 1.2, 0.02).name('ripple detail');
  fSurf.add(u.uDetailScale!, 'value', 0.05, 1.2, 0.01).name('ripple scale');
  fSurf.add(u.uRefractStrength!, 'value', 0.0, 0.12, 0.005).name('refraction');
  fSurf.add(u.uSSRStrength!, 'value', 0.0, 1.0, 0.02).name('reflections (SSR)');
  fSurf.add(u.uSunGlitter!, 'value', 0.0, 1.0, 0.02).name('sun glitter');
  fSurf.add(u.uRoughness!, 'value', 0.02, 0.5, 0.01).name('micro roughness');

  const colorProxy = (uniform: THREE.IUniform, folder: GUI, name: string) => {
    const proxy = { c: '#' + (uniform.value as THREE.Color).getHexString() };
    folder.addColor(proxy, 'c').name(name).onChange((v: string) => uniform.value.set(v));
  };

  const fColor = gui.addFolder('Water & colour').close();
  fColor.add(u.uClarity!, 'value', 0.3, 3.0, 0.05).name('clarity');
  fColor.add(u.uDepthFalloff!, 'value', 0.03, 0.5, 0.01).name('depth falloff');
  fColor.add(u.uSSSStrength!, 'value', 0.0, 1.5, 0.02).name('translucency');
  colorProxy(u.uShallowColor!, fColor, 'shallow');
  colorProxy(u.uDeepColor!, fColor, 'deep');
  colorProxy(u.uFoamColor!, fColor, 'foam');

  const fFoam = gui.addFolder('Foam').close();
  fFoam.add(u.uFoamCoverage!, 'value', 0.0, 2.0, 0.05).name('coverage');
  fFoam.add(u.uFoamEdge!, 'value', 0.02, 0.45, 0.01).name('softness / layers');
  fFoam.add(u.uFoamOpacity!, 'value', 0.3, 1.0, 0.02).name('opacity');
  fFoam.add(u.uCrestFoamStart!, 'value', 0.3, 3.0, 0.05).name('whitecap onset');
  fFoam.add(u.uFoamThreshold!, 'value', 0.0, 1.0, 0.02).name('breaking foam');
  fFoam.add(u.uShoreFoamWidth!, 'value', 0.0, 8.0, 0.1).name('shore foam width');
  fFoam.add(u.uContactFoam!, 'value', 0.0, 2.0, 0.05).name('object foam / wakes');

  const fObj = gui.addFolder('Objects').close();
  fObj.add({ s: () => ctx.dropAt('sphere') }, 's').name('drop sphere');
  fObj.add({ c: () => ctx.dropAt('cube') }, 'c').name('drop cube');
  fObj.add({ x: () => bodies.clear() }, 'x').name('clear objects');
  fObj.add(bodies, 'gravity', 0, 45, 0.5).name('gravity');

  const cuU = clouds.uniforms;
  const fClouds = gui.addFolder('Volumetric clouds').close();
  fClouds.add({ on: true }, 'on').name('enabled').onChange(ctx.setCloudsEnabled);
  fClouds.add(cuU.uSteps!, 'value', 16, 80, 2).name('quality (steps)');
  fClouds.add(cuU.uCoverage!, 'value', 0.1, 0.95, 0.01).name('coverage');
  fClouds.add(cuU.uDensity!, 'value', 0.2, 3.0, 0.05).name('density');
  fClouds.add(cuU.uNoiseScale!, 'value', 0.002, 0.02, 0.0005).name('cloud size (inv)');
  fClouds.add(cuU.uHeightFalloff!, 'value', 0.0, 1.0, 0.02).name('roundness');
  fClouds.add(cuU.uDetail!, 'value', 0.0, 1.0, 0.02).name('wispiness');
  fClouds.add(cuU.uWindSpeed!, 'value', 0.0, 0.15, 0.005).name('wind speed');
  fClouds.add(ctx.cloudShadowP, 'strength', 0.0, 1.0, 0.02).name('sea shadows');

  const fUnder = gui.addFolder('Underwater').close();
  fUnder.add(post.underwaterMat.uniforms.uShaftDensity!, 'value', 0.0, 0.2, 0.005).name('god-ray density');
  fUnder.add(post.underwaterMat.uniforms.uFogStrength!, 'value', 0.0, 2.0, 0.05).name('fog strength');

  const fPost = gui.addFolder('Post').close();
  fPost.add(ctx.postExposure, 'base', 0.3, 2.0, 0.02).name('exposure').onChange(applySun);
  fPost.add(post.compositeMat.uniforms.uBloom!, 'value', 0.0, 2.0, 0.02).name('bloom');
  fPost.add(post, 'bloomStreak', 0.0, 1.0, 0.02).name('anamorphic streak');
  fPost.add(post.compositeMat.uniforms.uSaturation!, 'value', 0.5, 1.6, 0.02).name('saturation');
  fPost.add(post.compositeMat.uniforms.uContrast!, 'value', 0.8, 1.3, 0.01).name('contrast');
  fPost.add(post.compositeMat.uniforms.uGrain!, 'value', 0.0, 0.2, 0.005).name('film grain');
  fPost.add(post.compositeMat.uniforms.uCA!, 'value', 0.0, 2.0, 0.05).name('lens fringe');
  fPost.add(post.compositeMat.uniforms.uVignetteAir!, 'value', 0.0, 0.6, 0.02).name('vignette');

  return gui;
}
