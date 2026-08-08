// Ported verbatim from WaterThreeJS src/Ocean.js (see WATERTHREEJS_LICENSE.txt
// and docs/bodyarcade-stage3/references/waterthreejs/). TypeScript annotations
// are mechanical only — GLSL and numeric behavior are unchanged.
import * as THREE from 'three';
import {
  NOISE,
  OCEAN_GERSTNER,
  DETAIL_NORMAL,
  ATMOSPHERE,
  WATER_TINT,
  CLOUD_SHADOW,
} from './shaders/common';

export const MAX_FOAM_BODIES = 16;

const fract = (v: number) => v - Math.floor(v);

export interface OceanSurfaceSample {
  dx: number;
  dz: number;
  h: number;
  nx: number;
  ny: number;
  nz: number;
}

// Default wave-field / look configuration. Everything the GUI tweaks lives here.
export const OCEAN_CONFIG = {
  windDir: new THREE.Vector2(1.0, 0.55).normalize(),
  waveCount: 26,
  baseWavelength: 150.0, // metres — the longest swell
  amplitude: 0.72,       // calm tropical sea by default
  choppy: 0.5,
  dirSpread: 0.95,
  freqMul: 1.19,
  ampMul: 0.82,
  speed: 1.0,
  surfaceY: 0.0,
  refractStrength: 0.05,
  detailScale: 0.3,
  detailStrength: 0.14,
  clarity: 1.0,        // scales water absorption (higher = see deeper)
  depthFalloff: 0.16,  // how fast the water body darkens with depth
  sssStrength: 0.35,   // subsurface translucency amount
  ssrStrength: 0.85,   // screen-space reflection blend (scene reflected on water)
  sunGlitter: 0,       // shatters the reflected sun into sparkles (vs a solid streak)
  roughness: 0.08,     // micro-roughness of the GGX sun specular (glint size)
  contactFoam: 1.0,    // foam rings / wakes / splashes around floating objects
  foamThreshold: 0.2,
  foamSoftness: 0.4,
  crestFoamStart: 1.4, // wave height (m) at which whitecaps begin (calm = rare)
  shoreFoamWidth: 3.4, // water-column depth (m) over which shore foam builds
  foamCoverage: 1.0,   // overall foam amount
  foamEdge: 0.2,       // dissolve softness — high = soft, layered, feathered foam
  foamOpacity: 0.95,
  deepColor: new THREE.Color(0.0016, 0.032, 0.065), // dark saturated deep
  shallowColor: new THREE.Color(0.13, 0.56, 0.55),
  foamColor: new THREE.Color(0.95, 0.98, 1.0),
  sssColor: new THREE.Color(0.1, 0.52, 0.46),
};

export class Ocean {
  uniforms: Record<string, THREE.IUniform>;
  mesh: THREE.Mesh;
  size: number;
  segments: number;
  private _cell: number;

  constructor(sunDir: THREE.Vector3, resolution: THREE.Vector2) {
    const c = OCEAN_CONFIG;

    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },

      // wave spectrum
      uWindDir: { value: c.windDir.clone() },
      uWaveCount: { value: c.waveCount },
      uBaseFreq: { value: (2.0 * Math.PI) / c.baseWavelength },
      uAmplitude: { value: c.amplitude },
      uChoppy: { value: c.choppy },
      uDirSpread: { value: c.dirSpread },
      uFreqMul: { value: c.freqMul },
      uAmpMul: { value: c.ampMul },
      uSpeed: { value: c.speed },
      uSurfaceY: { value: c.surfaceY },

      // shading
      uResolution: { value: resolution.clone() },
      uRefractionTex: { value: null },
      uDepthTex: { value: null },
      uNear: { value: 0.1 },
      uFar: { value: 8000 },
      uCameraUnderwater: { value: 0 },
      uRefractStrength: { value: c.refractStrength },
      uDetailScale: { value: c.detailScale },
      uDetailStrength: { value: c.detailStrength },
      uClarity: { value: c.clarity },
      uDepthFalloff: { value: c.depthFalloff },
      uSSSStrength: { value: c.sssStrength },
      uSSRStrength: { value: c.ssrStrength },
      uSunGlitter: { value: c.sunGlitter },
      uRoughness: { value: c.roughness },
      uCloudCover: { value: 1.0 },
      uProjMatrix: { value: new THREE.Matrix4() },

      // contact foam sources (filled from FloatingBodies every frame)
      uContactFoam: { value: c.contactFoam },
      uBodyCount: { value: 0 },
      uBodies: { value: Array.from({ length: MAX_FOAM_BODIES }, () => new THREE.Vector4()) },
      uBodyVel: { value: Array.from({ length: MAX_FOAM_BODIES }, () => new THREE.Vector2()) },

      // cloud shadows (synced from the volumetric cloud layer; 0 = off)
      uCloudShadow: { value: 0.0 },
      uCloudPlaneY: { value: 450.0 },
      uCloudScale: { value: 0.002 },
      uCloudCoverage: { value: 0.35 },
      uCloudDrift: { value: new THREE.Vector3() },
      uFoamThreshold: { value: c.foamThreshold },
      uFoamSoftness: { value: c.foamSoftness },
      uCrestFoamStart: { value: c.crestFoamStart },
      uShoreFoamWidth: { value: c.shoreFoamWidth },
      uFoamCoverage: { value: c.foamCoverage },
      uFoamEdge: { value: c.foamEdge },
      uFoamOpacity: { value: c.foamOpacity },
      uDeepColor: { value: c.deepColor.clone() },
      uShallowColor: { value: c.shallowColor.clone() },
      uFoamColor: { value: c.foamColor.clone() },
      uSSSColor: { value: c.sssColor.clone() },
    };

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        precision highp float;
        ${NOISE}
        ${OCEAN_GERSTNER}
        uniform float uSurfaceY;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vFold;
        varying float vHeight;
        varying float vViewZ;

        void main(){
          vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          worldPos.y = uSurfaceY;

          WaveSample w = sampleOcean(worldPos.xz);
          vec3 displaced = worldPos + w.displacement;

          vWorldPos = displaced;
          vNormal   = w.normal;
          vFold     = w.fold;
          vHeight   = w.height;

          vec4 viewPos = viewMatrix * vec4(displaced, 1.0);
          vViewZ = viewPos.z;
          gl_Position = projectionMatrix * viewPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        #include <packing>

        // Uniforms first — the shared chunks below (detailNormal) reference them.
        uniform float uTime;
        uniform vec3  uSunDir;
        uniform vec2  uWindDir;
        uniform vec2  uResolution;
        uniform sampler2D uRefractionTex;
        uniform sampler2D uDepthTex;
        uniform float uNear;
        uniform float uFar;
        uniform float uCameraUnderwater;
        uniform float uRefractStrength;
        uniform float uDetailScale;
        uniform float uDetailStrength;
        uniform float uClarity;
        uniform float uDepthFalloff;
        uniform float uSSSStrength;
        uniform float uSSRStrength;
        uniform float uSunGlitter;
        uniform float uRoughness;
        uniform float uCloudCover;
        uniform float uContactFoam;
        uniform int   uBodyCount;
        uniform vec4  uBodies[${MAX_FOAM_BODIES}];   // x, z, radius, foam strength
        uniform vec2  uBodyVel[${MAX_FOAM_BODIES}];  // horizontal velocity → wake direction
        uniform mat4  uProjMatrix;   // fragment prefix lacks projectionMatrix
        uniform float uFoamThreshold;
        uniform float uFoamSoftness;
        uniform float uCrestFoamStart;
        uniform float uShoreFoamWidth;
        uniform float uFoamCoverage;
        uniform float uFoamEdge;
        uniform float uFoamOpacity;
        uniform vec3  uDeepColor;
        uniform vec3  uShallowColor;
        uniform vec3  uFoamColor;
        uniform vec3  uSSSColor;

        ${NOISE}
        ${ATMOSPHERE}
        ${DETAIL_NORMAL}
        ${WATER_TINT}
        ${CLOUD_SHADOW}

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vFold;
        varying float vHeight;
        varying float vViewZ;

        float fresnelF(float c, float f0){
          return f0 + (1.0 - f0) * pow(clamp(1.0 - c, 0.0, 1.0), 5.0);
        }
        // GGX / Trowbridge-Reitz normal distribution — physical glint shape.
        float dggx(float NoH, float a){
          float a2 = a * a;
          float d = (NoH * a2 - NoH) * NoH + 1.0;
          return a2 / (3.14159265 * d * d);
        }
        float sceneEyeDepth(vec2 uv){
          float d = texture2D(uDepthTex, uv).x;
          return -perspectiveDepthToViewZ(d, uNear, uFar); // positive metres
        }

        // Screen-space reflection: march the reflection ray through the
        // pre-water colour+depth target so the island (and anything above water)
        // is mirrored on the surface. Returns rgb + a confidence in .a.
        #define SSR_STEPS 32
        vec4 ssr(vec3 ro, vec3 rd){
          float stepLen = 2.2;
          float prevDiff = -1.0;
          vec2  prevUV = vec2(0.0);
          for (int i = 1; i <= SSR_STEPS; i++){
            vec3 p = ro + rd * (stepLen * float(i));
            vec4 clip = uProjMatrix * viewMatrix * vec4(p, 1.0);
            if (clip.w <= 0.0) break;
            vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            float sceneEye = sceneEyeDepth(uv);
            float rayEye = -(viewMatrix * vec4(p, 1.0)).z;
            float diff = rayEye - sceneEye;          // >0 → ray is behind the scene
            if (diff > 0.0 && diff < 6.0 && sceneEye < uFar * 0.97){
              // Refine between the last two samples for a cleaner hit.
              float t = prevDiff < 0.0 ? 1.0 : (-prevDiff / (diff - prevDiff));
              vec2 hitUV = mix(prevUV, uv, clamp(t, 0.0, 1.0));
              vec2 edge = smoothstep(0.0, 0.14, hitUV) * smoothstep(0.0, 0.14, 1.0 - hitUV);
              float conf = edge.x * edge.y * (1.0 - float(i) / float(SSR_STEPS) * 0.4);
              return vec4(texture2D(uRefractionTex, hitUV).rgb, conf);
            }
            prevDiff = diff;
            prevUV = uv;
            stepLen *= 1.06;                          // gently accelerate
          }
          return vec4(0.0);
        }

        void main(){
          vec3 sunDir = normalize(uSunDir);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float sunElev = clamp(sunDir.y, 0.0, 1.0);
          float dist = length(cameraPosition - vWorldPos);

          // Base Gerstner normal + three scrolling ripple cascades (coarse →
          // capillary) for organic, non-tiling detail. The finest layers fade
          // with distance so the horizon doesn't shimmer/alias.
          vec3 N = normalize(vNormal);
          float detFade = exp(-dist * 0.012);
          vec3 dN1 = detailNormal(vWorldPos.xz * uDetailScale, uTime, 1.0);
          vec3 dN2 = detailNormal(vWorldPos.xz * uDetailScale * 3.7 + 11.0, uTime * 1.35, 1.0);
          vec3 dN3 = detailNormal(vWorldPos.xz * uDetailScale * 11.0 + 31.0, uTime * 1.9, 1.0);
          vec2 dsum = dN1.xz * uDetailStrength
                    + dN2.xz * uDetailStrength * 0.5 * mix(0.35, 1.0, detFade)
                    + dN3.xz * uDetailStrength * 0.28 * detFade;
          N = normalize(vec3(N.x + dsum.x, N.y, N.z + dsum.y));
          vec3 Ns = N.y >= 0.0 ? N : -N;      // geometric up (points to the air)
          if (dot(N, V) < 0.0) N = -N;         // shading normal faces the viewer

          bool underwater = uCameraUnderwater > 0.5;
          vec2 screenUV = gl_FragCoord.xy / uResolution;
          vec3 color;
          float shoreFoam = 0.0;
          float cs = 0.0;   // cloud shadow amount (0 = clear, 1 = shadowed)

          if (!underwater){
            // ================= ABOVE WATER =================
            // Moving cloud shadows — big soft patches drifting across the sea.
            cs = cloudShadowAmt(vWorldPos, sunDir);
            // Jitter the reflection normal with faded high-frequency sparkle so
            // the reflected sun shatters into moving glitter instead of a solid
            // streak (very visible on calm water at a low sunset sun).
            vec3 spk = detailNormal(vWorldPos.xz * uDetailScale * 16.0, uTime * 2.5, 1.0);
            vec3 Nr = normalize(N + vec3(spk.x, 0.0, spk.z) * uSunGlitter * detFade);
            vec3 R = reflect(-V, Nr);
            // Fold rays that dip below the horizon back up (mirror) instead of
            // clamping to a constant elevation.
            vec3 Rsky = R; Rsky.y = abs(Rsky.y);
            vec3 reflection = atmosphere(Rsky, sunDir);

            // Reflect the actual scene (island, seabed) via screen-space rays,
            // falling back to the sky where the ray finds nothing.
            if (uSSRStrength > 0.001){
              vec4 s = ssr(vWorldPos, R);
              reflection = mix(reflection, s.rgb, clamp(s.a, 0.0, 1.0) * uSSRStrength);
            }

            float fres = fresnelF(max(dot(N, V), 0.0), 0.02);

            // Refraction of the pre-rendered scene, attenuated by water column.
            float waterEye = -vViewZ;
            vec2  rUV = clamp(screenUV + N.xz * uRefractStrength, vec2(0.001), vec2(0.999));
            float sceneEye = sceneEyeDepth(rUV);
            if (sceneEye < waterEye){ rUV = screenUV; sceneEye = sceneEyeDepth(rUV); }
            float thickness = max(sceneEye - waterEye, 0.0);

            // Clear-water transmission: the seabed shows through, tinted and
            // dimmed by the water column. Bright turquoise over shallow sand,
            // fading to dark saturated deep — the tropical depth gradient.
            vec3 sceneCol = texture2D(uRefractionTex, rUV).rgb;
            vec3 T = exp(-(ABSORB / uClarity) * thickness);    // background transmittance
            vec3 waterCol = mix(uShallowColor, uDeepColor, 1.0 - exp(-thickness * uDepthFalloff));
            waterCol *= 0.5 + 0.5 * sunElev;
            vec3 transmitted = sceneCol * T + waterCol * (1.0 - T);

            color = mix(transmitted, reflection, fres);

            // Shoreline: a textured, advecting foam band where water gets shallow.
            float shore = smoothstep(uShoreFoamWidth, 0.12, thickness);
            float sTex = fbm(vWorldPos.xz * 0.5 - uWindDir * uTime * 0.6, 4);
            shoreFoam = shore * smoothstep(0.15, 0.55, sTex);

            // Subsurface translucency: a subtle glow through thin, back-lit
            // crests only — kept gentle so it never washes the sea cyan.
            float back  = pow(max(dot(V, -sunDir), 0.0), 4.0);
            float crest = smoothstep(0.4, 1.8, vHeight) * max(N.y, 0.0);
            color += uSSSColor * back * crest * sunElev * uSSSStrength * (1.0 - cs * 0.85);

            // GGX sun glints: physically-shaped sparkle whose size follows the
            // micro-roughness; slightly rougher in the distance so the horizon
            // reads as a soft streak instead of aliasing fireflies.
            vec3 H = normalize(V + sunDir);
            float rough = clamp(uRoughness + (1.0 - detFade) * 0.10, 0.02, 0.6);
            float D = dggx(max(dot(N, H), 0.0), rough * rough);
            float fh = fresnelF(max(dot(H, V), 0.0), 0.02);
            float sunNoL = max(dot(Ns, sunDir), 0.0);
            color += vec3(1.0, 0.94, 0.82) * D * fh * sunNoL * 3.0 * sunElev * (1.0 - cs * 0.9);

          } else {
            // ============ SEEN FROM BELOW (Snell's window) ============
            // Looking up, most of the upward cone shows the whole sky refracted
            // into a bright, rippling ceiling; only past the ~48.6° critical
            // angle does it fall back to the (still bright, sunlit) water volume.
            vec3 I = normalize(vWorldPos - cameraPosition); // toward the surface
            vec3 refr = refract(I, -Ns, 1.333);             // water -> air
            float ci = abs(dot(Ns, I));
            float fres = fresnelF(ci, 0.02);

            // Sunlit underwater ambient — bright turquoise near the surface,
            // never near-black, so the ceiling reads clear instead of a porthole.
            vec3 waterGlow = mix(uShallowColor, vec3(0.72, 0.92, 0.96), 0.35)
                           * (0.55 + 0.85 * sunElev);

            if (dot(refr, refr) < 1e-4){
              color = waterGlow;                            // total internal reflection
            } else {
              // The window: full sky, softened + lifted so it reads as a bright
              // luminous ceiling rather than hard, high-contrast cloud shapes.
              vec3 sky = atmosphere(refr, sunDir);
              float lum = max(sky.r, max(sky.g, sky.b));
              sky = mix(sky, vec3(0.80, 0.9, 1.0) * lum, 0.4);   // soften clouds
              sky *= 1.25;
              color = mix(waterGlow, sky, 1.0 - fres);
            }
            // Caustic shimmer dancing on the underside of the surface — the
            // silvery rippling highlights that make it read as water, not sky.
            float shimmer = fbm(vWorldPos.xz * 0.5 + uWindDir * uTime * 0.5, 4);
            shimmer = smoothstep(0.52, 0.92, shimmer);
            color += vec3(0.9, 0.98, 1.0) * shimmer * (1.0 - fres) * 0.35;

            // Overall lift + a bright band along the window edge.
            color += vec3(0.85, 0.95, 1.0) * (1.0 - fres) * 0.06;
          }

          // ================= FOAM (layered, both faces) =================
          // "Energy" = how much foam should exist here: from breaking folds,
          // whitecap crests, and the shoreline band.
          float breakE = smoothstep(uFoamThreshold, uFoamThreshold - uFoamSoftness, vFold);
          float crestE = smoothstep(uCrestFoamStart, uCrestFoamStart + 1.6, vHeight);

          // Contact foam: churn rings, trailing wakes and splash bursts around
          // the floating objects (positions fed in every frame).
          float contact = 0.0;
          if (uContactFoam > 0.001){
            for (int i = 0; i < ${MAX_FOAM_BODIES}; i++){
              if (i >= uBodyCount) break;
              vec4 B = uBodies[i];
              if (B.w < 0.01) continue;
              vec2 dp = vWorldPos.xz - B.xy;
              vec2 v = uBodyVel[i];
              float sp = length(v);
              if (sp > 0.25){
                // Fold trailing points onto a capsule behind the body → wake.
                vec2 vd = v / sp;
                float along = dot(dp, vd);
                dp -= vd * clamp(along, -B.z * min(2.0 + sp * 0.9, 7.0), 0.0);
              }
              float q = length(dp) / max(B.z, 0.1);
              contact += smoothstep(2.4, 0.85, q) * B.w;
            }
            contact = min(contact, 1.6) * uContactFoam;
          }

          float energy = clamp((breakE + crestE * 0.7 + shoreFoam + contact) * uFoamCoverage, 0.0, 1.2);

          vec2 fp = vWorldPos.xz;
          vec2 flow = uWindDir * uTime * 0.4;
          // Stretch noise along the wind so foam forms streaks / trails.
          vec2 wperp = vec2(-uWindDir.y, uWindDir.x);
          vec2 sp = vec2(dot(fp, uWindDir), dot(fp, wperp) * 3.0);
          float tCoarse = fbm(sp * 0.12 + flow, 5);
          float tMid    = fbm(fp * 0.8 - flow * 1.3, 4);
          float tFine   = fbm(fp * 2.6 + flow * 0.7, 4);
          float tex = tCoarse * 0.58 + tMid * 0.30 + tFine * 0.12;

          // Dissolve: dense cap where energy is high; only the highest noise
          // peaks survive as it fades → soft, feathered, dissipating layers.
          float thr  = 1.0 - clamp(energy, 0.0, 1.0);
          float foam = smoothstep(thr - uFoamEdge, thr + uFoamEdge, tex);
          foam *= smoothstep(0.0, 0.12, energy);

          // A second, sparser layer of the brightest fresh foam on strong breaks.
          float fresh = smoothstep(0.62, 0.95, tMid)
                      * smoothstep(0.5, 1.0, breakE + shoreFoam + contact);
          foam = max(foam, fresh);

          // Gentle bubble breakup; thin foam is translucent (water shows through).
          // Foam is diffuse — shade it with the sun so it has form, not flat white.
          float bubbles = 0.74 + 0.34 * fbm(fp * 4.5 - flow, 3);
          float foamLight = 0.55 + 0.5 * max(dot(Ns, sunDir), 0.0);
          vec3 foamCol = uFoamColor * bubbles * foamLight;
          float density = smoothstep(0.05, 0.75, foam);
          foamCol = mix(mix(color, uFoamColor, 0.5), foamCol, density);
          color = mix(color, foamCol, clamp(foam, 0.0, 1.0) * uFoamOpacity);

          // ================= HORIZON / DISTANCE =================
          if (!underwater){
            // Cloud shadow dims the whole surface (water + foam) softly; the
            // aerial haze mixed in below stays unshadowed, as in reality.
            color *= 1.0 - cs * 0.30;

            vec3 horizonDir = normalize(vec3(-V.x, 0.02, -V.z));
            // Cap the haze colour: the sun disk is intentionally ×14 bright for
            // glints/bloom, but it must NOT leak into the distance fog or it
            // paints a hard vertical beam straight down the sun's azimuth.
            vec3 fogCol = min(atmosphere(horizonDir, sunDir), vec3(1.6));
            float fogAmt = 1.0 - exp(-dist * 0.00045);
            color = mix(color, fogCol, clamp(fogAmt, 0.0, 1.0));
          } else {
            float fogAmt = 1.0 - exp(-dist * 0.02);
            color = mix(color, uDeepColor * 0.6, clamp(fogAmt, 0.0, 1.0));
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    // A large, dense grid that we keep centred (and grid-snapped) under the
    // camera so detail is always where the viewer is.
    this.size = 6000;
    this.segments = 600;
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);

    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;

    this._cell = this.size / this.segments;
  }

  update(time: number, camera: THREE.Camera) {
    this.uniforms.uTime.value = time;
    // Grid-snap the follow position so vertices stay world-anchored (no crawl).
    const cell = this._cell;
    this.mesh.position.x = Math.round(camera.position.x / cell) * cell;
    this.mesh.position.z = Math.round(camera.position.z / cell) * cell;
  }

  setSun(sunDir: THREE.Vector3) {
    this.uniforms.uSunDir.value.copy(sunDir);
  }

  setResolution(w: number, h: number) {
    this.uniforms.uResolution.value.set(w, h);
  }

  // Exact CPU port of the GLSL hash21(vec2) in common.js.
  private _hash21(a: number, b: number) {
    let px = fract(a * 123.34);
    let py = fract(b * 456.21);
    const d = px * (px + 45.32) + py * (py + 45.32);
    px += d;
    py += d;
    return fract(px * py);
  }

  // Full Gerstner sample at a REST position (the same math the vertex shader's
  // sampleOcean() runs). Fills `out` with the horizontal displacement (dx,dz),
  // the vertical height, and the analytic surface normal (nx,ny,nz).
  private _gerstner(x: number, z: number, time: number, out: OceanSurfaceSample) {
    const u = this.uniforms;
    const baseAngle = Math.atan2(u.uWindDir.value.y, u.uWindDir.value.x);
    const count = u.uWaveCount.value | 0;
    const choppy = u.uChoppy.value;
    const speed = u.uSpeed.value;
    const spread = u.uDirSpread.value;
    let freq = u.uBaseFreq.value;
    let amp = u.uAmplitude.value;

    let dispX = 0, dispY = 0, dispZ = 0;
    let nx = 0, ny = 1, nz = 0;
    for (let i = 0; i < count; i++) {
      const r0 = this._hash21(i, 1.7);
      const r1 = this._hash21(i, 9.1);
      const angle = baseAngle + (r0 * 2 - 1) * spread;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const w = freq;
      const A = amp;
      const phase = Math.sqrt(9.81 * w) * speed;
      const Q = choppy / Math.max(w * A * count, 1e-3);
      const arg = w * (dx * x + dz * z) + time * phase + r1 * 6.2831853;
      const s = Math.sin(arg);
      const c = Math.cos(arg);
      const WA = w * A;
      dispX += Q * A * dx * c;
      dispZ += Q * A * dz * c;
      dispY += A * s;
      nx -= dx * WA * c;
      nz -= dz * WA * c;
      ny -= Q * WA * s;
      freq *= u.uFreqMul.value;
      amp *= u.uAmpMul.value;
    }
    const inv = 1 / Math.hypot(nx, ny, nz);
    out.dx = dispX; out.dz = dispZ;
    out.h = u.uSurfaceY.value + dispY;
    out.nx = nx * inv; out.ny = ny * inv; out.nz = nz * inv;
    return out;
  }

  // Height of the VISIBLE water surface directly above world point (x,z).
  // Gerstner waves push vertices sideways, so the surface you see above (x,z)
  // came from a rest position offset by the horizontal displacement. Invert
  // that map with a few fixed-point iterations so buoyancy matches the crests.
  surfaceSample(x: number, z: number, time: number, out: OceanSurfaceSample = {} as OceanSurfaceSample) {
    let rx = x, rz = z;
    for (let it = 0; it < 4; it++) {
      this._gerstner(rx, rz, time, out);
      rx = x - out.dx;
      rz = z - out.dz;
    }
    // Final sample at the resolved rest position gives the height + normal
    // of the water actually rendered above (x,z).
    return this._gerstner(rx, rz, time, out);
  }

  // Vertical-only surface height (fast approximation; ignores choppiness).
  // Kept for camera-immersion / splash queries where exactness is not needed.
  heightAt(x: number, z: number, time: number) {
    const u = this.uniforms;
    const baseAngle = Math.atan2(u.uWindDir.value.y, u.uWindDir.value.x);
    let freq = u.uBaseFreq.value;
    let amp = u.uAmplitude.value;
    const count = u.uWaveCount.value | 0;
    let h = 0;
    for (let i = 0; i < count; i++) {
      const r0 = this._hash21(i, 1.7);
      const r1 = this._hash21(i, 9.1);
      const angle = baseAngle + (r0 * 2 - 1) * u.uDirSpread.value;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const phase = Math.sqrt(9.81 * freq) * u.uSpeed.value;
      const arg = freq * (dx * x + dz * z) + time * phase + r1 * 6.2831853;
      h += amp * Math.sin(arg);
      freq *= u.uFreqMul.value;
      amp *= u.uAmpMul.value;
    }
    return u.uSurfaceY.value + h;
  }
}
