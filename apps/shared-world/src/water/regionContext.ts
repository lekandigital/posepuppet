// RegionContext — the GPU-side face of the baked region (Checkpoint 04B):
// the decoded heightfield uploaded ONCE as a float DataTexture (cp04B §5:
// "height.r16 → a DataTexture uploaded once"), the shore mask as uShoreMask,
// and the shared uniform values every region material binds (the required
// §4.2 additive uniform family: uSeaLevel, uHeightTex, uRegionSize,
// uWindowOrigin, uShoreMask — plus the documented window/scale helpers).
//
// The window-origin Vector2 is shared BY REFERENCE with RegionWater, so a
// single scroll update propagates to every material without per-material
// bookkeeping.

import * as THREE from 'three';
import type { WorldData } from '../world/WorldData';
import { SIM_UNIT_M, WINDOW_SIZE_M } from './RegionWater';

export interface RegionContext {
  heightTex: THREE.DataTexture;
  shoreTex: THREE.DataTexture;
  /** shared with RegionWater.windowOrigin (min corner, meters) */
  windowOrigin: THREE.Vector2;
  regionSize: number;
  heightN: number;
  /** true when the height texture filters linearly (float-linear ext) */
  floatLinear: boolean;
}

export function buildRegionContext(
  renderer: THREE.WebGLRenderer,
  data: WorldData,
  windowOrigin: THREE.Vector2,
): RegionContext {
  const n = data.header.artifacts['height.r16']!.resolution!;
  const floatLinear =
    renderer.capabilities.isWebGL2 && renderer.extensions.has('OES_texture_float_linear');

  const heightTex = new THREE.DataTexture(
    data.heights, n, n, THREE.RedFormat, THREE.FloatType,
  );
  heightTex.minFilter = floatLinear ? THREE.LinearFilter : THREE.NearestFilter;
  heightTex.magFilter = heightTex.minFilter;
  heightTex.wrapS = THREE.ClampToEdgeWrapping;
  heightTex.wrapT = THREE.ClampToEdgeWrapping;
  heightTex.generateMipmaps = false;
  heightTex.unpackAlignment = 1;
  heightTex.needsUpdate = true;

  // shore.png mask → 0/255 bytes (255 = land) so the shader's 0.5
  // threshold reads the normalized value correctly
  const shoreBytes = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) shoreBytes[k] = data.mask[k] === 1 ? 255 : 0;
  const shoreTex = new THREE.DataTexture(
    shoreBytes, n, n, THREE.RedFormat, THREE.UnsignedByteType,
  );
  shoreTex.minFilter = THREE.LinearFilter;
  shoreTex.magFilter = THREE.LinearFilter;
  shoreTex.wrapS = THREE.ClampToEdgeWrapping;
  shoreTex.wrapT = THREE.ClampToEdgeWrapping;
  shoreTex.generateMipmaps = false;
  shoreTex.unpackAlignment = 1;
  shoreTex.needsUpdate = true;

  return {
    heightTex,
    shoreTex,
    windowOrigin,
    regionSize: data.header.sizeMeters[0],
    heightN: n,
    floatLinear,
  };
}

/** The shared region uniform family (fresh descriptor object per material;
 *  texture/vector VALUES shared so one update reaches every material). */
export function regionUniforms(ctx: RegionContext): Record<string, THREE.IUniform> {
  return {
    uHeightTex: { value: ctx.heightTex },
    uShoreMask: { value: ctx.shoreTex },
    uSeaLevel: { value: 0.0 },
    uRegionSize: { value: ctx.regionSize },
    uHeightN: { value: ctx.heightN },
    uWindowOrigin: { value: ctx.windowOrigin },
    uWindowSize: { value: WINDOW_SIZE_M },
    uDispScale: { value: SIM_UNIT_M },
  };
}
