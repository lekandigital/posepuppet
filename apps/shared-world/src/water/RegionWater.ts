// RegionWater — Checkpoint 04B app-owned wrapper around the vendored
// jeantimex wave simulation (Master §4.3, Track B Q4): the 512² player-
// following interactive window covering 256 m (0.5 m/texel) under the one
// global calm surface. The simulation SHADERS are the vendored files
// imported unmodified (byte-identical math, damping and injection profile);
// this class only rebinds the sanctioned domain uniforms
// (poolWidth/poolLength → the window declaration), doubles the grid to
// 512², and adds the scroll-copy pass for window movement — the exact
// §4.2 "sim-domain mapping" edit row.
//
// UNIT LAW [DERIVED — reported in the cp04B deviations]: the window is
// declared to the vendored sim API at SIM_UNIT_M = 15 m per sim unit
// (poolWidth = poolLength = 128/15 ≈ 8.533). Derivation: the vendored
// wave shader propagates at c = √0.5/poolWidth texels/step; the physical
// speed over the window is therefore c·(0.5 m/texel)·(240 steps/s)
// = 42.43/poolWidth m/s. The approved pool view (Master §7.7 mount,
// K = 7.5) runs the same byte-identical shader at 4.97 m/s physical;
// poolWidth = 8.533 is the unique declaration that reproduces that
// approved physical wave speed at the 512²/256 m window. All injection
// inputs convert world meters → sim units by ÷15; displayed displacement
// converts back via uDispScale = 15 in the surface shaders.

import * as THREE from 'three';
import waterRippleVert from '../../vendor/threejs-water/src/shaders/WaterRipple.vert';
import waterRippleFrag from '../../vendor/threejs-water/src/shaders/WaterRipple.frag';
import waveSimulationVert from '../../vendor/threejs-water/src/shaders/WaveSimulation.vert';
import waveSimulationFrag from '../../vendor/threejs-water/src/shaders/WaveSimulation.frag';
import waterNormalVert from '../../vendor/threejs-water/src/shaders/WaterNormal.vert';
import waterNormalFrag from '../../vendor/threejs-water/src/shaders/WaterNormal.frag';
import sphereDisplacementVert from '../../vendor/threejs-water/src/shaders/Sphere.vert';
import sphereDisplacementFrag from '../../vendor/threejs-water/src/shaders/Sphere.frag';
import windowScrollFrag from './shaders/WindowScroll.frag';

/** Sim-window resolution (Master §4.3: 512² windowed — THE plan). */
export const WINDOW_TEXELS = 512;
/** Sim-window physical coverage, meters. */
export const WINDOW_SIZE_M = 256;
/** Physical texel size (0.5 m) — also the origin snap increment. */
export const WINDOW_TEXEL_M = WINDOW_SIZE_M / WINDOW_TEXELS;
/** Meters per sim unit [DERIVED — header note]. */
export const SIM_UNIT_M = 15;
/** The window half-extent in sim units = the vendored poolWidth/poolLength. */
export const SIM_HALF = WINDOW_SIZE_M / 2 / SIM_UNIT_M;

export interface SimProbeResult {
  nanCount: number;
  /** max |composited displacement| on the outermost texel ring, meters */
  edgeMaxDispM: number;
  /** max |height| anywhere in the window, meters (informational) */
  maxDispM: number;
}

export class RegionWater {
  textureA: THREE.WebGLRenderTarget;
  textureB: THREE.WebGLRenderTarget;

  /** Window min-corner, meters, snapped to 0.5 m. Shared with materials. */
  readonly windowOrigin = new THREE.Vector2(0, 0);

  private renderer: THREE.WebGLRenderer;
  private plane: THREE.Mesh;
  private camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;

  private dropMaterial: THREE.ShaderMaterial;
  private updateMaterial: THREE.ShaderMaterial;
  private normalMaterial: THREE.ShaderMaterial;
  private sphereMaterial: THREE.ShaderMaterial;
  private scrollMaterial: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, centerX = 0, centerZ = 0) {
    this.renderer = renderer;
    this.windowOrigin.set(
      snapHalf(centerX - WINDOW_SIZE_M / 2),
      snapHalf(centerZ - WINDOW_SIZE_M / 2),
    );

    const size = WINDOW_TEXELS;
    const textureType = this.getSimulationTextureType();
    // Filtering [DERIVED display adaptation, reported]: the vendored RTs use
    // NearestFilter; at the window's 0.5 m texels nearest-sampled normals
    // read as visible square blocks, so these RTs filter LINEARLY. The sim
    // passes are unaffected — every sim shader samples at exact texel
    // centers, where linear and nearest return identical values, so the
    // simulation math stays bit-identical; only the surface/caustics
    // display sampling (arbitrary coordinates) smooths.
    const options: THREE.RenderTargetOptions = {
      type: textureType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: false,
    };
    this.textureA = new THREE.WebGLRenderTarget(size, size, options);
    this.textureB = new THREE.WebGLRenderTarget(size, size, options);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    this.dropMaterial = new THREE.ShaderMaterial({
      vertexShader: waterRippleVert,
      fragmentShader: waterRippleFrag,
      uniforms: {
        tInput: { value: null },
        center: { value: new THREE.Vector2() },
        radius: { value: 0 },
        strength: { value: 0 },
        poolWidth: { value: SIM_HALF },
        poolLength: { value: SIM_HALF },
      },
    });
    this.updateMaterial = new THREE.ShaderMaterial({
      vertexShader: waveSimulationVert,
      fragmentShader: waveSimulationFrag,
      uniforms: {
        tInput: { value: null },
        delta: { value: new THREE.Vector2(1 / size, 1 / size) },
        poolWidth: { value: SIM_HALF },
        poolLength: { value: SIM_HALF },
      },
    });
    this.normalMaterial = new THREE.ShaderMaterial({
      vertexShader: waterNormalVert,
      fragmentShader: waterNormalFrag,
      uniforms: {
        tInput: { value: null },
        delta: { value: new THREE.Vector2(1 / size, 1 / size) },
        poolWidth: { value: SIM_HALF },
        poolLength: { value: SIM_HALF },
      },
    });
    this.sphereMaterial = new THREE.ShaderMaterial({
      vertexShader: sphereDisplacementVert,
      fragmentShader: sphereDisplacementFrag,
      uniforms: {
        tInput: { value: null },
        oldCenter: { value: new THREE.Vector3() },
        newCenter: { value: new THREE.Vector3() },
        radius: { value: 0 },
        displacementScale: { value: 1.0 },
        poolWidth: { value: SIM_HALF },
        poolLength: { value: SIM_HALF },
      },
    });
    this.scrollMaterial = new THREE.ShaderMaterial({
      vertexShader: waterRippleVert,
      fragmentShader: windowScrollFrag,
      uniforms: {
        tInput: { value: null },
        shiftUv: { value: new THREE.Vector2() },
      },
    });

    this.plane = new THREE.Mesh(geometry, this.dropMaterial);
    this.scene.add(this.plane);
    this.clearTextures();
  }

  private getSimulationTextureType() {
    const supportsFloatRenderTarget =
      this.renderer.capabilities.isWebGL2 &&
      this.renderer.extensions.has('EXT_color_buffer_float') &&
      this.renderer.extensions.has('OES_texture_float_linear');
    return supportsFloatRenderTarget ? THREE.FloatType : THREE.HalfFloatType;
  }

  private clearTextures() {
    const previousTarget = this.renderer.getRenderTarget();
    const previousClearColor = new THREE.Color();
    this.renderer.getClearColor(previousClearColor);
    const previousClearAlpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(this.textureA);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.textureB);
    this.renderer.clear();
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  private swapTextures() {
    const temp = this.textureA;
    this.textureA = this.textureB;
    this.textureB = temp;
  }

  private runPass(material: THREE.ShaderMaterial) {
    this.plane.material = material;
    this.renderer.setRenderTarget(this.textureB);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.swapTextures();
  }

  /**
   * Follow the dolphin (Master §4.3): snap the window origin to 0.5 m texel
   * increments; on movement, scroll-copy the overlapping sim state and
   * zero-fill (calm water) the newly exposed edges. Returns true when the
   * window moved this call.
   */
  setWindowCenter(xm: number, zm: number): boolean {
    const ox = snapHalf(xm - WINDOW_SIZE_M / 2);
    const oz = snapHalf(zm - WINDOW_SIZE_M / 2);
    const di = Math.round((ox - this.windowOrigin.x) / WINDOW_TEXEL_M);
    const dj = Math.round((oz - this.windowOrigin.y) / WINDOW_TEXEL_M);
    if (di === 0 && dj === 0) return false;
    if (Math.abs(di) >= WINDOW_TEXELS || Math.abs(dj) >= WINDOW_TEXELS) {
      this.clearTextures(); // teleport: no overlap to carry
    } else {
      this.scrollMaterial.uniforms.tInput.value = this.textureA.texture;
      this.scrollMaterial.uniforms.shiftUv.value.set(di / WINDOW_TEXELS, dj / WINDOW_TEXELS);
      this.runPass(this.scrollMaterial);
    }
    this.windowOrigin.set(ox, oz);
    return true;
  }

  /**
   * Drop injection at a world position (the vendored addDrop API through
   * the window mapping). radiusM = physical drop radius in meters;
   * amplitudeM = physical drop strength in meters of surface displacement
   * (the approved pool values × K carry over — e.g. the cp01 breach drop
   * 0.05 du → 0.375 m).
   */
  addDropWorld(xm: number, zm: number, radiusM: number, amplitudeM: number) {
    const cx = this.windowOrigin.x + WINDOW_SIZE_M / 2;
    const cz = this.windowOrigin.y + WINDOW_SIZE_M / 2;
    this.dropMaterial.uniforms.tInput.value = this.textureA.texture;
    this.dropMaterial.uniforms.center.value.set(
      (xm - cx) / (WINDOW_SIZE_M / 2),
      (zm - cz) / (WINDOW_SIZE_M / 2),
    );
    this.dropMaterial.uniforms.radius.value = radiusM / WINDOW_SIZE_M;
    this.dropMaterial.uniforms.strength.value = amplitudeM / SIM_UNIT_M;
    this.runPass(this.dropMaterial);
  }

  /**
   * The vendored compound-sphere displacement (Water.moveSphere) through
   * the window mapping — the dolphin's wake emitter (Track B Q7). Sphere
   * centers in world meters; radius in meters.
   */
  moveSphereWorld(
    oldWorld: THREE.Vector3,
    newWorld: THREE.Vector3,
    radiusM: number,
    displacementScale = 1.0,
  ) {
    const cx = this.windowOrigin.x + WINDOW_SIZE_M / 2;
    const cz = this.windowOrigin.y + WINDOW_SIZE_M / 2;
    const u = this.sphereMaterial.uniforms;
    u.tInput.value = this.textureA.texture;
    (u.oldCenter.value as THREE.Vector3).set(
      (oldWorld.x - cx) / SIM_UNIT_M,
      oldWorld.y / SIM_UNIT_M,
      (oldWorld.z - cz) / SIM_UNIT_M,
    );
    (u.newCenter.value as THREE.Vector3).set(
      (newWorld.x - cx) / SIM_UNIT_M,
      newWorld.y / SIM_UNIT_M,
      (newWorld.z - cz) / SIM_UNIT_M,
    );
    u.radius.value = radiusM / SIM_UNIT_M;
    u.displacementScale.value = displacementScale;
    this.runPass(this.sphereMaterial);
  }

  /**
   * cp05B test/diagnostic hook: reset the interactive sim to flat calm
   * (the same clear the constructor and teleports use). Lets deterministic
   * captures isolate the analytic ambient field from decaying seeded/wake
   * state. Never called by production gameplay.
   */
  clearSim() {
    this.clearTextures();
  }

  /** One wave-equation step — the vendored shader at the window domain. */
  stepSimulation() {
    this.updateMaterial.uniforms.tInput.value = this.textureA.texture;
    this.runPass(this.updateMaterial);
  }

  /** Recompute normal derivatives — the vendored shader, window domain. */
  updateNormals() {
    this.normalMaterial.uniforms.tInput.value = this.textureA.texture;
    this.runPass(this.normalMaterial);
  }

  /**
   * Ambient seeding: the stock demo's boot pattern (20 alternating drops)
   * at the same texel footprint (~7.7 texels ⇒ 3.84 m here) and the same
   * physical amplitude (0.01 du × 7.5 = 0.075 m) — "reuse the demo's
   * resting sim state as the ambient contribution" (cp04B §6.2).
   */
  seedAmbient() {
    const cx = this.windowOrigin.x + WINDOW_SIZE_M / 2;
    const cz = this.windowOrigin.y + WINDOW_SIZE_M / 2;
    for (let i = 0; i < 20; i++) {
      this.addDropWorld(
        cx + (Math.random() * 2 - 1) * 0.8 * (WINDOW_SIZE_M / 2),
        cz + (Math.random() * 2 - 1) * 0.8 * (WINDOW_SIZE_M / 2),
        3.84,
        i % 2 === 0 ? -0.075 : 0.075,
      );
    }
  }

  /**
   * Instrumentation readback (cp04B §8.4): full-window NaN scan plus the
   * falloff-composited displacement on the outermost texel ring (must stay
   * ≤ 1 mm — the window edge sits at falloff ≈ 0 by construction).
   */
  probeSimTexture(): SimProbeResult {
    const n = WINDOW_TEXELS;
    const isFloat = this.textureA.texture.type === THREE.FloatType;
    const raw = isFloat ? new Float32Array(n * n * 4) : new Uint16Array(n * n * 4);
    this.renderer.readRenderTargetPixels(
      this.textureA, 0, 0, n, n,
      raw as unknown as Float32Array,
    );
    const h = (k: number): number =>
      isFloat
        ? (raw as Float32Array)[k]!
        : THREE.DataUtils.fromHalfFloat((raw as Uint16Array)[k]!);
    let nanCount = 0;
    let maxDispM = 0;
    for (let k = 0; k < n * n; k++) {
      const r = h(k * 4);
      const g = h(k * 4 + 1);
      if (Number.isNaN(r) || Number.isNaN(g)) nanCount++;
      const disp = Math.abs(r) * SIM_UNIT_M;
      if (disp > maxDispM) maxDispM = disp;
    }
    let edgeMaxDispM = 0;
    const falloffAt = (u: number, v: number): number => {
      const ex = Math.min(u, 1 - u);
      const ez = Math.min(v, 1 - v);
      const wx = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(ex / 0.1, 0), 1));
      const wz = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(ez / 0.1, 0), 1));
      return wx * wz;
    };
    const ring = (i: number, j: number) => {
      const u = (i + 0.5) / n;
      const v = (j + 0.5) / n;
      const disp = Math.abs(h((j * n + i) * 4)) * SIM_UNIT_M * falloffAt(u, v);
      if (disp > edgeMaxDispM) edgeMaxDispM = disp;
    };
    for (let i = 0; i < n; i++) {
      ring(i, 0);
      ring(i, n - 1);
      ring(0, i);
      ring(n - 1, i);
    }
    return { nanCount, edgeMaxDispM, maxDispM };
  }
}

function snapHalf(v: number): number {
  return Math.round(v / WINDOW_TEXEL_M) * WINDOW_TEXEL_M;
}
