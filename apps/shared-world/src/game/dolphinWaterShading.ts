// dolphinWaterShading — Checkpoint 06 Phase One: the vendored DuckRender
// per-fragment waterline law applied to the regional actor (region view
// only; the pool and stock views are untouched).
//
// The stock mechanism (DuckRender.frag): every OBJECT fragment tests its
// world position against the ANIMATED water height at its xz column —
// never the camera side, never a clip plane — and
//   - submerged fragments take caustic-modulated diffuse + the underwater
//     tint `underwaterColor * 1.2`;
//   - during the clipped-reflection texture pass (texturePassMode == 2)
//     submerged fragments are DISCARDED so the surface reflection shows
//     only the emerged body.
// That per-fragment split is what keeps a partially submerged actor one
// continuous object across both optical regions.
//
// Regional substitutions (CP06 §5 sanctioned; each recorded):
//   - the water height is the region's full drawn-surface law —
//     uSeaLevel + (sim·uDispScale + CP05B ambient)·windowFalloff — exactly
//     the RegionWaterSurface.vert composition, so the split tracks the
//     visible surface;
//   - the caustic sample is RegionWallColor.sampleCaustic's window-mapped
//     law (body copied here; parity asserted by test);
//   - the duck REPLACES its lighting below the line; the dolphin KEEPS its
//     approved GLB Standard lighting and applies the duck law
//     multiplicatively (brightness factor 0.4 + duckDiffuse, then the
//     duck's underwaterColor·1.2 tint) — deviation recorded: the approved
//     albedo/lighting base is preserved while the vendored waterline
//     mechanics and constants are restored.

import * as THREE from 'three';

export interface DolphinWaterUniforms {
  water: THREE.IUniform;
  causticTex: THREE.IUniform;
  uOpticsLight: THREE.IUniform;
  uTexturePassMode: THREE.IUniform;
  uActorWaterMask: THREE.IUniform;
  [key: string]: THREE.IUniform;
}

const PARS = /* glsl */ `
varying vec3 vRegionWorldPos;
varying vec3 vRegionNormal;
uniform sampler2D water;
uniform sampler2D causticTex;
uniform vec3 uOpticsLight;
uniform float uTexturePassMode;
uniform float uActorWaterMask;

REGION_SHARED_GLSL

/** The drawn-surface height law (RegionWaterSurface.vert, exact). */
float regionActorWaterline(vec2 xz) {
  vec2 wuv = windowUv(xz);
  vec4 sInfo = texture2D(water, clamp(wuv, 0.0, 1.0));
  float wf = windowFalloff(wuv);
  return uSeaLevel + (sInfo.r * uDispScale + ambientSurf(xz).x) * wf;
}

/** RegionWallColor.sampleCaustic — same body (parity asserted by test). */
vec4 regionActorCaustic(vec3 point, vec3 refractedLight) {
  vec2 proj = point.xz - point.y * refractedLight.xz / refractedLight.y;
  vec2 wuvProj = windowUv(proj);
  vec2 cuv = 0.75 * (wuvProj * 2.0 - 1.0) * 0.5 + 0.5;
  vec4 c = texture2D(causticTex, cuv);
  return mix(vec4(0.2, 1.0, 0.0, 0.0), c, windowFalloff(wuvProj));
}
`;

const APPLY = /* glsl */ `
{
  float wl = regionActorWaterline(vRegionWorldPos.xz);
  bool submergedFrag = vRegionWorldPos.y < wl;
  // clipped-reflection pass: the vendored DuckRender mode-2 discard
  if (uTexturePassMode > 1.5 && submergedFrag) discard;
  if (uActorWaterMask > 0.5 && submergedFrag) {
    // the vendored DuckRender submerged law, composed multiplicatively
    vec3 refractedLight = refract(-uOpticsLight, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
    vec4 caustic = regionActorCaustic(vRegionWorldPos, refractedLight);
    float lam = max(0.0, dot(-refractedLight, normalize(vRegionNormal)));
    float duckDiffuse = lam * 0.6 * caustic.r * 4.0 * caustic.g;
    gl_FragColor.rgb *= clamp(0.4 + duckDiffuse, 0.0, 1.6);
    gl_FragColor.rgb *= vec3(0.48, 1.08, 1.2); // underwaterColor * 1.2
  }
}
`;

const VERT_PARS = /* glsl */ `
varying vec3 vRegionWorldPos;
varying vec3 vRegionNormal;
`;

const VERT_APPLY = /* glsl */ `
vRegionWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRegionNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

/**
 * Injects the waterline law into every material of the actor group and
 * returns the shared uniform record (one object — a single update reaches
 * all materials) plus the pass-mode adapter for RegionObjectTexturePass.
 */
export function attachDolphinWaterShading(
  group: THREE.Object3D,
  regionShared: string,
  regionUniformValues: Record<string, THREE.IUniform>,
  lightDirection: THREE.Vector3,
): {
  uniforms: DolphinWaterUniforms;
  setTexturePassMode(mode: number): void;
  /** fragment source of one injected program (structural audit) */
  injectedPars: string;
} {
  const uniforms: DolphinWaterUniforms = {
    water: { value: null },
    causticTex: { value: null },
    uOpticsLight: { value: lightDirection.clone() },
    uTexturePassMode: { value: 0 },
    uActorWaterMask: { value: 1 },
    ...regionUniformValues,
  };

  const pars = PARS.replace('REGION_SHARED_GLSL', regionShared);

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial;
      std.customProgramCacheKey = () => 'region-actor-waterline';
      std.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + VERT_PARS)
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\n' + VERT_APPLY,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + pars)
          .replace(
            '#include <opaque_fragment>',
            '#include <opaque_fragment>\n' + APPLY,
          );
      };
      std.needsUpdate = true;
    }
  });

  return {
    uniforms,
    setTexturePassMode(mode: number) {
      uniforms.uTexturePassMode.value = mode;
    },
    injectedPars: pars,
  };
}
