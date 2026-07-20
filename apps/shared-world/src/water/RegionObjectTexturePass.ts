// RegionObjectTexturePass — Checkpoint 06 app-owned counterpart of the
// vendored rendering/ObjectTexturePass (the Phase-One optical restoration,
// CP06 §6.3 first preference). Restores the stock mesh-object optical
// subsystem for the regional actor (the dolphin):
//
//   - refraction target   — the actor rendered from the main camera
//                           (texturePassMode 1), consumed by the water
//                           shaders' restored `meshEnabled` branches;
//   - reflection target   — the actor rendered from the camera mirrored
//                           across the water plane (y = uSeaLevel = 0 —
//                           the same mirror the vendored pass uses);
//   - clipped reflection  — the mirrored render with submerged fragments
//                           discarded (texturePassMode 2), the above-water
//                           reflection source;
//   - shadow target       — the actor's refracted-light footprint for the
//                           caustics shadow (vendored Caustics.frag mesh
//                           branch, restored in RegionCaustics.frag).
//
// Deviations from the vendored pass (each a sanctioned regional
// substitution per the CP06 architecture — "stock object interaction →
// dolphin"):
//   1. The shadow projection rasterizes into the SIM-WINDOW caustic
//      footprint (the same `0.75·(windowUv(proj)·2−1)` law RegionCaustics
//      \.vert and RegionWallColor.sampleCaustic use) instead of the pool's
//      poolWidth/poolLength normalization — the exact window
//      generalization of the vendored `0.75·(xz − y·rl.xz/rl.y)` formula.
//   2. The shadow override material carries the three.js skinning chunks
//      so the skinned dolphin casts its posed footprint (the vendored duck
//      is unskinned; plain position would freeze the rest pose).
//   3. Pass-mode signalling reaches the actor through an adapter callback
//      (the dolphin's materials are GLB MeshStandardMaterials with
//      injected uniforms, not ShaderMaterials with `isTexturePass`).
//
// Everything else — target sizes/formats, the dynamic 1024-cap resize, the
// mirrored-camera construction, matrices, transparent clears, and the
// only-object-visible discipline — matches the vendored implementation.

import * as THREE from 'three';

/** Vertex shader for the actor shadow footprint (vendored shadow shader
 *  with the window-footprint rasterization law + skinning chunks). */
const shadowVertexShader = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>

const float IOR_AIR = 1.0;
const float IOR_WATER = 1.333;

uniform vec3 light;
uniform vec2 uWindowOrigin;
uniform float uWindowSize;

void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec3 worldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vec3 refractedLight = refract(-normalize(light), vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
  vec2 projected = worldPosition.xz - worldPosition.y * refractedLight.xz / refractedLight.y;
  vec2 wuv = (projected - uWindowOrigin) / uWindowSize;
  gl_Position = vec4(0.75 * (wuv * 2.0 - 1.0), 0.0, 1.0);
}
`;

const shadowFragmentShader = /* glsl */ `
precision highp float;

void main() {
  gl_FragColor = vec4(1.0);
}
`;

/** Narrow adapter the actor implements so the pass can signal render modes
 *  (0 = normal, 1 = texture pass, 2 = clipped-reflection pass). */
export interface ActorPassModeAdapter {
  setTexturePassMode(mode: number): void;
}

export class RegionObjectTexturePass {
  readonly reflectionTarget: THREE.WebGLRenderTarget;
  readonly clippedReflectionTarget: THREE.WebGLRenderTarget;
  readonly refractionTarget: THREE.WebGLRenderTarget;
  readonly shadowTarget: THREE.WebGLRenderTarget;
  readonly reflectionViewProjectionMatrix = new THREE.Matrix4();
  readonly viewProjectionMatrix = new THREE.Matrix4();

  private readonly reflectionCamera = new THREE.PerspectiveCamera();
  private readonly shadowCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly shadowMaterial: THREE.ShaderMaterial;
  private readonly clearColor = new THREE.Color();
  private readonly previousClearColor = new THREE.Color();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly lightDirection: THREE.Vector3,
    windowOrigin: THREE.Vector2, // shared BY REFERENCE into the shadow material
    private readonly windowSize: number,
  ) {
    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    };

    this.reflectionTarget = new THREE.WebGLRenderTarget(512, 512, options);
    this.clippedReflectionTarget = new THREE.WebGLRenderTarget(512, 512, options);
    this.refractionTarget = new THREE.WebGLRenderTarget(512, 512, options);
    this.shadowTarget = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.shadowMaterial = new THREE.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      uniforms: {
        light: { value: lightDirection.clone() },
        uWindowOrigin: { value: windowOrigin },
        uWindowSize: { value: windowSize },
      },
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** Dynamic scaling capped at 1024 max dimension — vendored. */
  setSize(width: number, height: number) {
    const scale = Math.min(1, 1024 / Math.max(width, height));
    this.reflectionTarget.setSize(
      Math.max(1, Math.floor(width * scale)),
      Math.max(1, Math.floor(height * scale)),
    );
    this.clippedReflectionTarget.setSize(
      Math.max(1, Math.floor(width * scale)),
      Math.max(1, Math.floor(height * scale)),
    );
    this.refractionTarget.setSize(
      Math.max(1, Math.floor(width * scale)),
      Math.max(1, Math.floor(height * scale)),
    );
  }

  /** Vendored update flow: matrices, then refraction / reflection /
   *  clipped-reflection / shadow renders of the actor in isolation. */
  update(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderableObject: THREE.Object3D | null,
    adapter: ActorPassModeAdapter | null,
  ) {
    this.updateViewProjection(camera);

    if (!renderableObject) {
      this.withTransparentClear(() => {
        this.clearTarget(this.reflectionTarget);
        this.clearTarget(this.clippedReflectionTarget);
        this.clearTarget(this.refractionTarget);
        this.clearTarget(this.shadowTarget);
      });
      return;
    }

    // Regional deviation (documented): the region scene carries the sky
    // cubemap as scene.background (cp04B); the vendored demo's scene has
    // none. The background must not render into the object targets — their
    // alpha channel is the compositing mask the restored water branches
    // consume (an opaque background would repaint the whole surface).
    const previousBackground = scene.background;
    scene.background = null;
    this.withOnlyObjectVisible(scene, renderableObject, () => {
      this.withTransparentClear(() => {
        this.renderRefraction(scene, camera, adapter);
        this.renderReflection(scene, camera, adapter);
        this.renderClippedReflection(scene, adapter);
        this.renderShadow(scene);
      });
    });
    scene.background = previousBackground;

    adapter?.setTexturePassMode(0);
  }

  private updateViewProjection(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    this.viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }

  private renderRefraction(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    adapter: ActorPassModeAdapter | null,
  ) {
    adapter?.setTexturePassMode(1);
    this.renderer.setRenderTarget(this.refractionTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);
  }

  private renderReflection(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    adapter: ActorPassModeAdapter | null,
  ) {
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const target = new THREE.Vector3();

    camera.getWorldPosition(position);
    camera.getWorldDirection(direction);
    target.copy(position).add(direction);

    this.reflectionCamera.copy(camera);
    this.reflectionCamera.position.set(position.x, -position.y, position.z);
    this.reflectionCamera.up.set(camera.up.x, -camera.up.y, camera.up.z);
    this.reflectionCamera.lookAt(target.x, -target.y, target.z);
    this.reflectionCamera.updateMatrixWorld();
    this.reflectionViewProjectionMatrix.multiplyMatrices(
      this.reflectionCamera.projectionMatrix,
      this.reflectionCamera.matrixWorldInverse,
    );

    adapter?.setTexturePassMode(1);
    this.renderer.setRenderTarget(this.reflectionTarget);
    this.renderer.clear();
    this.renderer.render(scene, this.reflectionCamera);
  }

  private renderClippedReflection(scene: THREE.Scene, adapter: ActorPassModeAdapter | null) {
    adapter?.setTexturePassMode(2);
    this.renderer.setRenderTarget(this.clippedReflectionTarget);
    this.renderer.clear();
    this.renderer.render(scene, this.reflectionCamera);
  }

  private renderShadow(scene: THREE.Scene) {
    (this.shadowMaterial.uniforms.light!.value as THREE.Vector3).copy(this.lightDirection);
    this.shadowMaterial.uniforms.uWindowSize!.value = this.windowSize;
    this.shadowMaterial.uniformsNeedUpdate = true;

    const previousOverrideMaterial = scene.overrideMaterial;
    scene.overrideMaterial = this.shadowMaterial;
    this.renderer.setRenderTarget(this.shadowTarget);
    this.renderer.clear();
    this.renderer.render(scene, this.shadowCamera);
    scene.overrideMaterial = previousOverrideMaterial;
  }

  private clearTarget(target: THREE.WebGLRenderTarget) {
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
  }

  private withTransparentClear(render: () => void) {
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.getClearColor(this.previousClearColor);
    const previousClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setClearColor(this.clearColor, 0);
    render();
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(this.previousClearColor, previousClearAlpha);
  }

  private withOnlyObjectVisible(
    scene: THREE.Scene,
    renderableObject: THREE.Object3D,
    render: () => void,
  ) {
    const changed: Array<[THREE.Object3D, boolean]> = [];

    // Regional deviation (documented): scene LIGHTS stay visible — the
    // actor's GLB materials are scene-lit MeshStandardMaterials (the
    // vendored duck's ShaderMaterial ignores scene lights, so the vendored
    // pass could hide everything indiscriminately).
    scene.traverse((object) => {
      if (
        object !== scene &&
        !(object as THREE.Light).isLight &&
        !this.isObjectOrDescendant(object, renderableObject)
      ) {
        changed.push([object, object.visible]);
        object.visible = false;
      }
    });

    render();

    for (const [object, visible] of changed) {
      object.visible = visible;
    }
  }

  private isObjectOrDescendant(object: THREE.Object3D, root: THREE.Object3D) {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
      if (current === root) return true;
    }
    return false;
  }
}
