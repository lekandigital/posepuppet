/*
 * Spherical ocean replacement for Body Arcade.
 *
 * The rendering approach is adapted for a spherical world from WaterThreeJS:
 * https://github.com/achrefelouafi/WaterThreeJS
 * WaterThreeJS is MIT licensed; see ./third_party/WaterThreeJS_LICENSE.txt.
 *
 * Important design rule: water is a separate optical layer. The globe's existing
 * terrain keeps its own material colors. Ocean vertices in the terrain mesh are
 * recolored as sand/seabed, while underwater viewing uses distance fog to let the
 * water influence the original colors of terrain and objects instead of replacing
 * everything with one blue material.
 */

import {
  BufferAttribute,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Mesh,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Camera,
  type Scene,
} from "three";
import { Globe } from "./Globe";

const DEFAULT_SHALLOW = 0x2a8ca0;
const DEFAULT_DEEP = 0x1560a0;
const DEFAULT_FOAM = 0xeafcff;
const SAND_SHALLOW = new Color(0xd7c59a);
const SAND_DEEP = new Color(0x907858);

const activeOceans = new Set<SphericalOcean>();
const oceanByGlobe = new WeakMap<Globe, SphericalOcean>();
const pendingPalette = new WeakMap<Globe, { shallow: number | Color; deep: number | Color; foam?: number | Color }>();

const _cameraWorld = new Vector3();
const _cameraLocal = new Vector3();
const _lightWorld = new Vector3();
const _targetWorld = new Vector3();

function colorFrom(value: number | Color | undefined, fallback: number): Color {
  if (value instanceof Color) return value.clone();
  return new Color(value ?? fallback);
}

function findTerrainSurface(globe: Globe): Mesh<BufferGeometry, ShaderMaterial | any> | null {
  let found: Mesh<BufferGeometry, ShaderMaterial | any> | null = null;
  globe.group.traverse((obj) => {
    if (found) return;
    const mesh = obj as Mesh<BufferGeometry, ShaderMaterial | any>;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as BufferGeometry;
    if (geometry?.getAttribute?.("oceanDepth")) found = mesh;
  });
  return found;
}

function recolorOceanFloorAsSand(surface: Mesh<BufferGeometry, any>): void {
  const geometry = surface.geometry;
  const depth = geometry.getAttribute("oceanDepth") as BufferAttribute | undefined;
  const color = geometry.getAttribute("color") as BufferAttribute | undefined;
  const pos = geometry.getAttribute("position") as BufferAttribute | undefined;
  if (!depth || !color || !pos) return;

  const c = new Color();
  for (let i = 0; i < depth.count; i++) {
    const d = depth.getX(i);
    if (d < 0) continue; // land remains exactly as authored by Globe.ts

    // Keep the seabed warm and material-like. Water optics are added later by
    // the separate water shell / underwater fog rather than baked into this RGB.
    const t = Math.min(1, Math.max(0, d));
    c.copy(SAND_SHALLOW).lerp(SAND_DEEP, Math.pow(t, 0.72));

    // Tiny deterministic variation keeps the floor from reading as a flat paint.
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const variation = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(x * 23.7 + y * 31.1 + z * 17.9));
    c.multiplyScalar(variation);
    color.setXYZ(i, c.r, c.g, c.b);
  }
  color.needsUpdate = true;
}

const WATER_VERTEX = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uRadius;
uniform float uAmplitude;
uniform float uWaveSpeed;

attribute float oceanDepth;

varying vec3 vWorldPos;
varying vec3 vBaseNormal;
varying float vOceanDepth;

float waveField(vec3 n) {
  float t = uTime * uWaveSpeed;
  float a = sin(dot(n, normalize(vec3( 0.77, 0.19, 0.61))) * 17.0 + t * 1.15);
  float b = sin(dot(n, normalize(vec3(-0.24, 0.91, 0.34))) * 29.0 - t * 0.82 + 1.7);
  float c = sin(dot(n, normalize(vec3( 0.41,-0.37, 0.83))) * 47.0 + t * 1.48 + 4.1);
  float d = sin(dot(n, normalize(vec3(-0.68,-0.52, 0.51))) * 73.0 - t * 1.93 + 0.6);
  return a * 0.48 + b * 0.29 + c * 0.16 + d * 0.07;
}

void main() {
  vec3 n = normalize(position);
  float isWater = step(-0.5, oceanDepth);
  float shoreWave = smoothstep(-0.08, 0.16, oceanDepth);
  float displacement = waveField(n) * uAmplitude * isWater * mix(0.32, 1.0, shoreWave);

  vec3 localPos = n * (uRadius + displacement);
  vec4 world = modelMatrix * vec4(localPos, 1.0);

  vWorldPos = world.xyz;
  vBaseNormal = normalize(mat3(modelMatrix) * n);
  vOceanDepth = oceanDepth;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WATER_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform vec3 uSkyColor;
uniform vec3 uSunDir;
uniform float uSunIntensity;
uniform float uClarity;
uniform float uRoughness;

varying vec3 vWorldPos;
varying vec3 vBaseNormal;
varying float vOceanDepth;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

void main() {
  // Land vertices carry oceanDepth=-1. Interpolation across shoreline triangles
  // gives us a soft coast edge without rebuilding the world's topology.
  float coastMask = smoothstep(-0.46, 0.025, vOceanDepth);
  if (coastMask < 0.012) discard;

  // Geometric normal follows the displaced spherical surface. Fine procedural
  // normal detail is then layered on top, analogous to WaterThreeJS' cascades.
  vec3 N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  if (dot(N, vBaseNormal) < 0.0) N = -N;

  vec3 axis = abs(N.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(axis, N));
  vec3 B = normalize(cross(N, T));

  float micro1 = sin(dot(vWorldPos, vec3(37.0, 21.0, 29.0)) + uTime * 2.7);
  float micro2 = sin(dot(vWorldPos, vec3(-51.0, 33.0, 17.0)) - uTime * 3.4 + 1.9);
  float micro3 = sin(dot(vWorldPos, vec3(83.0, -27.0, 41.0)) + uTime * 4.6 + 4.2);
  float detailStrength = mix(0.025, 0.065, 1.0 - uRoughness);
  N = normalize(N + T * (micro1 * 0.65 + micro3 * 0.35) * detailStrength
                  + B * (micro2 * 0.70 - micro3 * 0.30) * detailStrength);

  vec3 V = normalize(cameraPosition - vWorldPos);
  float NoV = saturate(abs(dot(N, V)));
  float fresnel = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);

  float depth01 = saturate(vOceanDepth);
  float depthCurve = smoothstep(0.06, 0.90, depth01);
  vec3 bodyColor = mix(uShallowColor, uDeepColor, depthCurve);

  // We do not replace the terrain with this color. Alpha blending lets the real
  // sand / terrain / submerged object color remain visible beneath the water.
  vec3 horizon = mix(uSkyColor * 0.56, uSkyColor * 1.18 + vec3(0.035, 0.055, 0.075), pow(1.0 - NoV, 0.55));
  vec3 color = mix(bodyColor, horizon, 0.10 + fresnel * 0.72);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(V + L);
  float gloss = mix(72.0, 420.0, 1.0 - uRoughness);
  float spec = pow(saturate(dot(N, H)), gloss) * saturate(dot(N, L));
  color += vec3(1.0, 0.96, 0.86) * spec * uSunIntensity * (0.22 + fresnel * 1.8);

  // Shore foam follows the existing terrain/ocean relationship instead of a
  // separate coastline map, so it always matches Body Arcade's generated land.
  float shore = 1.0 - smoothstep(0.035, 0.22, depth01);
  float foamNoise = 0.5 + 0.5 * sin(
    dot(vWorldPos, vec3(31.0, 43.0, 23.0)) +
    sin(dot(vWorldPos, vec3(17.0, 13.0, 37.0)) - uTime * 1.7) * 1.7 +
    uTime * 2.2
  );
  float foam = shore * smoothstep(0.53, 0.78, foamNoise) * coastMask;
  color = mix(color, uFoamColor, foam * 0.78);

  // Clear shallows, denser deep water. Fresnel/foam can raise apparent opacity,
  // but the surface never becomes a solid blue sheet.
  float alpha = mix(0.24, 0.55, depthCurve) / max(uClarity, 0.25);
  alpha += fresnel * 0.18 + foam * 0.20;

  // Looking upward from below: keep the ceiling luminous and translucent rather
  // than painting the whole underwater view cyan.
  if (!gl_FrontFacing) {
    color = mix(color, uShallowColor, 0.16);
    alpha *= 0.76;
  }

  gl_FragColor = vec4(color, clamp(alpha * coastMask, 0.0, 0.82));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

class SphericalOcean {
  readonly globe: Globe;
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;

  private readonly material: ShaderMaterial;
  private readonly underwaterFog: FogExp2;
  private readonly shallow = new Color(DEFAULT_SHALLOW);
  private readonly deep = new Color(DEFAULT_DEEP);
  private readonly foam = new Color(DEFAULT_FOAM);
  private disposed = false;

  constructor(globe: Globe) {
    this.globe = globe;

    const terrainSurface = findTerrainSurface(globe);
    if (!terrainSurface) {
      throw new Error("SphericalOcean: Globe terrain surface with oceanDepth attribute was not found");
    }

    // The former baked ocean becomes the actual sandy seafloor. Land is untouched.
    recolorOceanFloorAsSand(terrainSurface);

    const geometry = terrainSurface.geometry.clone();
    geometry.deleteAttribute("color");

    const pos = geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const invLen = 1 / Math.max(1e-8, Math.sqrt(x * x + y * y + z * z));
      pos.setXYZ(
        i,
        x * invLen * globe.radius,
        y * invLen * globe.radius,
        z * invLen * globe.radius,
      );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    this.material = new ShaderMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: true,
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: globe.radius + 0.0008 },
        uAmplitude: { value: Math.max(0.0045, globe.radius * 0.0018) },
        uWaveSpeed: { value: 1.0 },
        uShallowColor: { value: this.shallow },
        uDeepColor: { value: this.deep },
        uFoamColor: { value: this.foam },
        uSkyColor: { value: new Color(0x8fb8d8) },
        uSunDir: { value: new Vector3(0.35, 0.82, 0.45).normalize() },
        uSunIntensity: { value: 1.0 },
        uClarity: { value: 1.15 },
        uRoughness: { value: 0.12 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = "BodyArcadeSphericalOcean";
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    globe.group.add(this.mesh);

    this.underwaterFog = new FogExp2(new Color(DEFAULT_SHALLOW).lerp(new Color(DEFAULT_DEEP), 0.35), 0.22);

    const pending = pendingPalette.get(globe);
    if (pending) this.setPalette(pending.shallow, pending.deep, pending.foam);

    activeOceans.add(this);
  }

  setPalette(shallow: number | Color, deep: number | Color, foam?: number | Color): void {
    this.shallow.copy(colorFrom(shallow, DEFAULT_SHALLOW));
    this.deep.copy(colorFrom(deep, DEFAULT_DEEP));
    if (foam !== undefined) this.foam.copy(colorFrom(foam, DEFAULT_FOAM));

    // Underwater medium: related to the water palette, but deliberately much less
    // saturated than simply replacing every material with water blue.
    this.underwaterFog.color.copy(this.shallow).lerp(this.deep, 0.30).lerp(new Color(0xb9d7d5), 0.08);
  }

  update(dt: number): void {
    if (this.disposed) return;
    this.material.uniforms.uTime.value += dt;
  }

  syncSceneLighting(scene: Scene): void {
    if (scene.background && (scene.background as Color).isColor) {
      this.material.uniforms.uSkyColor.value.copy(scene.background as Color);
    }

    let brightest: DirectionalLight | null = null;
    scene.traverse((obj) => {
      const light = obj as DirectionalLight;
      if (!light.isDirectionalLight || !light.visible) return;
      if (!brightest || light.intensity > brightest.intensity) brightest = light;
    });

    if (brightest) {
      brightest.getWorldPosition(_lightWorld);
      brightest.target.getWorldPosition(_targetWorld);
      _lightWorld.sub(_targetWorld).normalize(); // surface -> light
      this.material.uniforms.uSunDir.value.copy(_lightWorld);
      this.material.uniforms.uSunIntensity.value = Math.min(2.5, Math.max(0.15, brightest.intensity));
    }
  }

  isInScene(scene: Scene): boolean {
    let parent: any = this.globe.group;
    while (parent) {
      if (parent === scene) return true;
      parent = parent.parent;
    }
    return false;
  }

  isUnderwater(camera: Camera): boolean {
    camera.getWorldPosition(_cameraWorld);
    _cameraLocal.copy(_cameraWorld);
    this.globe.group.worldToLocal(_cameraLocal);

    const r = _cameraLocal.length();
    if (r < 1e-6 || r > this.globe.radius + 0.018) return false;

    const inv = 1 / r;
    const nx = _cameraLocal.x * inv;
    const ny = _cameraLocal.y * inv;
    const nz = _cameraLocal.z * inv;

    // Globe already owns the authoritative land/water classification indirectly:
    // land displacement is positive; seafloor displacement is negative.
    return this.globe.getSurfaceAltitudeAt(nx, ny, nz) < -0.00001;
  }

  fogFor(camera: Camera): FogExp2 {
    camera.getWorldPosition(_cameraWorld);
    _cameraLocal.copy(_cameraWorld);
    this.globe.group.worldToLocal(_cameraLocal);
    const submergence = Math.max(0, this.globe.radius - _cameraLocal.length());

    // Nearby objects (e.g. a colored ball) retain their own color; distance and
    // increased submergence gradually add the water medium.
    this.underwaterFog.density = 0.16 + Math.min(0.20, submergence * 7.0);
    return this.underwaterFog;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    activeOceans.delete(this);
    this.globe.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

let installed = false;

/**
 * Installs the spherical WaterThreeJS-style replacement without rewriting Globe.ts.
 * This is intentionally a narrow compatibility layer around the existing world:
 * terrain generation, collision, boats, props, landmarks, and networking keep using
 * the same Globe and TerrainSurface APIs.
 */
export function installSphericalOceanReplacement(): void {
  if (installed) return;
  installed = true;

  const proto = Globe.prototype as any;
  const originalUpdate = proto.update as (this: Globe, dt: number) => void;
  const originalDispose = proto.dispose as (this: Globe) => void;
  const originalSetOceanColors = proto.setOceanColors as ((this: Globe, ...args: any[]) => void) | undefined;

  const ensureOcean = (globe: Globe): SphericalOcean | null => {
    const existing = oceanByGlobe.get(globe);
    if (existing) return existing;
    try {
      const ocean = new SphericalOcean(globe);
      oceanByGlobe.set(globe, ocean);
      return ocean;
    } catch (error) {
      console.warn("Spherical ocean replacement could not attach", error);
      return null;
    }
  };

  proto.update = function patchedGlobeUpdate(this: Globe, dt: number): void {
    const ocean = ensureOcean(this);
    ocean?.update(dt);
    originalUpdate.call(this, dt);
  };

  proto.dispose = function patchedGlobeDispose(this: Globe): void {
    oceanByGlobe.get(this)?.dispose();
    oceanByGlobe.delete(this);
    originalDispose.call(this);
  };

  // The old implementation recolors ocean vertices directly on the terrain mesh.
  // Once those vertices are seabed, keep them sand. Day/night palette changes are
  // routed to the separate water material instead.
  if (typeof originalSetOceanColors === "function") {
    proto.setOceanColors = function patchedSetOceanColors(
      this: Globe,
      shallow: number | Color,
      deep: number | Color,
      foam?: number | Color,
    ): void {
      pendingPalette.set(this, { shallow, deep, foam });
      ensureOcean(this)?.setPalette(shallow, deep, foam);
    };
  }

  // Apply underwater optics at the renderer boundary so every ordinary terrain /
  // prop material keeps its own base color. Fog is temporary for this render only,
  // then the scene's normal day/night fog is restored unchanged.
  const rendererProto = WebGLRenderer.prototype as any;
  const originalRender = rendererProto.render as (this: WebGLRenderer, scene: Scene, camera: Camera) => void;

  rendererProto.render = function patchedRender(this: WebGLRenderer, scene: Scene, camera: Camera): void {
    let underwaterOcean: SphericalOcean | null = null;

    for (const ocean of activeOceans) {
      if (!ocean.isInScene(scene)) continue;
      ocean.syncSceneLighting(scene);
      if (!underwaterOcean && ocean.isUnderwater(camera)) underwaterOcean = ocean;
    }

    const previousFog = scene.fog;
    if (underwaterOcean) scene.fog = underwaterOcean.fogFor(camera);

    try {
      originalRender.call(this, scene, camera);
    } finally {
      scene.fog = previousFog;
    }
  };
}
