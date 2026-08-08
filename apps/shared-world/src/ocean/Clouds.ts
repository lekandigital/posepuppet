// Ported verbatim from WaterThreeJS src/Clouds.js (see WATERTHREEJS_LICENSE.txt).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Volumetric sky clouds — a raymarch through a high-altitude slab that follows
// the camera, rendered at HALF resolution into an HDR buffer (scatter.rgb,
// transmittance.a) and smoothed with TEMPORAL REPROJECTION: each frame is
// jittered differently and blended with the reprojected previous result, so
// a cheap 40-ish step march converges to a clean, film-quality image.
//
// Lighting: 5-tap exponential light march for self-shadowing, Beer–Powder for
// the dark "sugary" edges, a 3-octave multi-scattering approximation
// (Wrenninge/Schneider) so thick clouds glow instead of going black, and a
// dual-lobe Henyey–Greenstein phase for the backlit silver lining.
export class Clouds {
  renderer: THREE.WebGLRenderer;
  scale: number;
  enabled: boolean;
  material: THREE.ShaderMaterial;
  resolveMat: THREE.ShaderMaterial;
  quad: FullScreenQuad;
  resolveQuad: FullScreenQuad;
  rtCur: THREE.WebGLRenderTarget;
  rtHistA: THREE.WebGLRenderTarget;
  rtHistB: THREE.WebGLRenderTarget;
  private _w: number;
  private _h: number;
  private _frame: number;
  private _histValid: boolean;
  private _prevViewProj: THREE.Matrix4;
  private _out: THREE.WebGLRenderTarget;

  constructor(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    { scale = 0.5 }: { scale?: number } = {},
  ) {
    this.renderer = renderer;
    this.scale = scale;
    this.enabled = false;
    this._w = width;
    this._h = height;
    this._frame = 0;
    this._histValid = false;
    this._prevViewProj = new THREE.Matrix4();

    const mkRT = () =>
      new THREE.WebGLRenderTarget(this._rw(), this._rh(), {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    this.rtCur = mkRT();    // this frame's raw march
    this.rtHistA = mkRT();  // resolved history (ping)
    this.rtHistB = mkRT();  // resolved history (pong)
    this._out = this.rtHistA;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uFrame: { value: 0 },

        uHalfXZ: { value: 5000 },     // camera-centred slab half-extent
        uBase: { value: 380 },        // cloud-layer altitude
        uHeight: { value: 150 },      // layer thickness
        uHeightFalloff: { value: 0.38 }, // 1 = hug the base (rolling top)
        uDensity: { value: 0.8 },
        uCoverage: { value: 0.42 },
        uCoverageEdge: { value: 0.16 },
        uNoiseScale: { value: 0.002 }, // smaller = bigger clouds
        uDetail: { value: 0.3 },
        uDetailScale: { value: 4.0 },
        uEdgeFade: { value: 1600 },   // soft fade toward the slab walls
        uWindDir: { value: new THREE.Vector2(1, 0.35).normalize() },
        uWindSpeed: { value: 0.03 },
        uDrift: { value: new THREE.Vector3() }, // accumulated wind offset (CPU)
        uSteps: { value: 44 },
        uMaxSpan: { value: 4200 },
        uLightStepSize: { value: 30 },
        uAniso: { value: 0.55 },
        uAmbient: { value: 0.85 },
        uSunStrength: { value: 3.0 },
        uFogColor: { value: new THREE.Color(0.42, 0.5, 0.62) }, // shadowed body
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.86) }, // lit / scattered
        uHazeColor: { value: new THREE.Color(0.60, 0.74, 0.90) }, // horizon melt
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        #include <packing>
        uniform sampler2D tDepth;
        uniform mat4 uInvProj, uInvView;
        uniform vec3 uCameraPos, uFogColor, uSunColor, uHazeColor, uSunDir, uDrift;
        uniform vec2 uWindDir;
        uniform float uTime, uFrame, uHalfXZ, uBase, uHeight, uHeightFalloff,
                      uDensity, uCoverage, uCoverageEdge, uNoiseScale, uDetail,
                      uDetailScale, uEdgeFade, uWindSpeed, uSteps, uMaxSpan,
                      uLightStepSize, uAniso, uAmbient, uSunStrength;
        varying vec2 vUv;

        float hash13(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float vnoise3(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
                mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm3(vec3 p, int oct) {
          float v = 0.0, a = 0.5;
          mat3 m = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
          for (int i = 0; i < 5; i++) {
            if (i >= oct) break;
            v += a * vnoise3(p); p = m * p * 2.02; a *= 0.5;
          }
          return v;
        }

        // Vertical / slab-wall envelope. Returns 0 outside the layer.
        float profileAt(vec3 p, out float yl) {
          yl = (p.y - uBase) / max(uHeight, 1e-3);
          vec2 rel = abs(p.xz - uCameraPos.xz);
          vec2 e = uHalfXZ - rel;
          float edge = smoothstep(0.0, uEdgeFade, min(e.x, e.y));
          if (yl <= 0.0 || yl >= 1.0 || edge <= 0.001) return 0.0;
          return edge * smoothstep(0.0, 0.10, yl) * smoothstep(1.0, 0.80, yl);
        }

        // Cheap density for the light march: fewer octaves, no detail erosion.
        float densityLight(vec3 p) {
          float yl;
          float prof = profileAt(p, yl);
          if (prof <= 0.0) return 0.0;
          float n = fbm3(p * uNoiseScale + uDrift, 3) * 1.07;
          float cov = uCoverage * (1.0 - uHeightFalloff * yl);
          float th = 1.0 - cov;
          float d = smoothstep(th - uCoverageEdge, th + uCoverageEdge, n);
          return d * prof * uDensity;
        }

        // Full density for the view march: detail octave frays the edges.
        float densityFull(vec3 p, out float yl) {
          float prof = profileAt(p, yl);
          if (prof <= 0.0) return 0.0;
          vec3 q = p * uNoiseScale + uDrift;
          float n = fbm3(q, 4);
          float cov = uCoverage * (1.0 - uHeightFalloff * yl);
          float th = 1.0 - cov;
          float d = smoothstep(th - uCoverageEdge, th + uCoverageEdge, n);
          if (d > 0.001 && uDetail > 0.0) {
            float hi = fbm3(q * uDetailScale + uDrift * 2.0 + 19.0, 3);
            d = clamp(d - (1.0 - d) * hi * uDetail, 0.0, 1.0);
          }
          return d * prof * uDensity;
        }

        // Sun-ward optical depth: 5 exponentially spaced cheap samples reach
        // ~12× the base step for the price of a short march.
        float lightOpticalDepth(vec3 p, vec3 L) {
          float d0 = uLightStepSize;
          float tau = 0.0;
          tau += densityLight(p + L * (0.5  * d0)) * (1.0 * d0);
          tau += densityLight(p + L * (1.5  * d0)) * (1.4 * d0);
          tau += densityLight(p + L * (3.2  * d0)) * (2.4 * d0);
          tau += densityLight(p + L * (6.0  * d0)) * (3.6 * d0);
          tau += densityLight(p + L * (10.5 * d0)) * (5.0 * d0);
          return tau;
        }

        float hg(float cosT, float g) {
          float g2 = g * g;
          return (1.0 - g2) / (12.5663706 * pow(1.0 + g2 - 2.0 * g * cosT, 1.5));
        }
        vec2 intersectBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
          vec3 inv = 1.0 / rd;
          vec3 t0 = (bmin - ro) * inv;
          vec3 t1 = (bmax - ro) * inv;
          vec3 tmin = min(t0, t1), tmax = max(t0, t1);
          return vec2(max(max(tmin.x, tmin.y), tmin.z),
                      min(min(tmax.x, tmax.y), tmax.z));
        }
        vec3 worldFromDepth(vec2 uv, float d) {
          vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 view = uInvProj * clip; view /= view.w;
          return (uInvView * view).xyz;
        }

        void main() {
          float depth = texture2D(tDepth, vUv).x;
          // Sky (no geometry) writes the far plane → clouds fill the sky.
          float sceneDist = depth >= 0.9999 ? 1e9 : length(worldFromDepth(vUv, depth) - uCameraPos);

          vec3 ro = uCameraPos;
          vec3 far = worldFromDepth(vUv, 1.0);
          vec3 rd = normalize(far - ro);

          vec3 c = vec3(uCameraPos.x, 0.0, uCameraPos.z);
          vec3 bmin = c + vec3(-uHalfXZ, uBase, -uHalfXZ);
          vec3 bmax = c + vec3(uHalfXZ, uBase + uHeight, uHalfXZ);
          vec2 hit = intersectBox(ro, rd, bmin, bmax);
          float tN = max(hit.x, 0.0);
          float tF = min(min(hit.y, sceneDist), tN + uMaxSpan);
          if (tF <= tN) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

          float span = tF - tN;
          float stepLen = span / uSteps;
          vec3 L = normalize(uSunDir);
          float cosT = dot(rd, L);

          // Phase per multi-scatter octave (precomputed per ray): a sharp
          // forward lobe + a small back lobe, flattening toward isotropic.
          float ph0 = mix(hg(cosT, uAniso), hg(cosT, -0.22), 0.22);
          float ph1 = mix(hg(cosT, uAniso * 0.55), 0.0796, 0.35);
          const float ph2 = 0.0796;

          // Per-frame jitter — the temporal resolve averages it to smoothness.
          float dither = hash13(vec3(gl_FragCoord.xy, mod(uFrame, 64.0)));
          float t = tN + stepLen * dither;
          float transmittance = 1.0;
          vec3 scatter = vec3(0.0);

          for (int i = 0; i < 128; i++) {
            if (float(i) >= uSteps || t > tF) break;
            vec3 p = ro + rd * t;
            float yl;
            float dens = densityFull(p, yl);
            if (dens > 0.001) {
              float tau = lightOpticalDepth(p, L);
              // Multi-scattering octaves: thick clouds stay luminous.
              float sunE = ph0 * exp(-tau)
                         + ph1 * 0.55 * exp(-tau * 0.40)
                         + ph2 * 0.25 * exp(-tau * 0.15);
              // Beer–Powder: thin edges darken (in-scattering deficit).
              float pw = 1.0 - 0.6 * exp(-dens * 10.0);
              // Ambient graded by height: sky-lit tops, occluded bases.
              vec3 amb = uFogColor * uAmbient * (0.35 + 0.65 * yl);
              vec3 lum = uSunColor * (uSunStrength * sunE * pw) + amb;
              float ai = 1.0 - exp(-dens * stepLen);
              scatter += transmittance * ai * lum;
              transmittance *= 1.0 - ai;
              if (transmittance < 0.03) break;
            }
            t += stepLen;
          }

          // Aerial perspective: distant clouds melt into the horizon haze.
          float hazeAmt = 1.0 - exp(-tN * 0.00016);
          scatter = mix(scatter, uHazeColor * (1.0 - transmittance), hazeAmt);

          gl_FragColor = vec4(scatter, transmittance);
        }
      `,
    });
    this.quad = new FullScreenQuad(this.material);

    // ---- Temporal resolve: reproject last frame's result and blend ----------
    this.resolveMat = new THREE.ShaderMaterial({
      uniforms: {
        tCurrent: { value: null },
        tHistory: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
        uPrevViewProj: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uTexel: { value: new THREE.Vector2() },
        uMidY: { value: 455 },   // representative reprojection plane (mid-layer)
        uBlend: { value: 0.88 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tCurrent, tHistory;
        uniform mat4 uInvProj, uInvView, uPrevViewProj;
        uniform vec3 uCameraPos;
        uniform vec2 uTexel;
        uniform float uMidY, uBlend;

        void main(){
          vec4 cur = texture2D(tCurrent, vUv);

          // Neighbourhood bounds — clamping history to them kills ghosting.
          vec4 c1 = texture2D(tCurrent, vUv + vec2(uTexel.x, 0.0));
          vec4 c2 = texture2D(tCurrent, vUv - vec2(uTexel.x, 0.0));
          vec4 c3 = texture2D(tCurrent, vUv + vec2(0.0, uTexel.y));
          vec4 c4 = texture2D(tCurrent, vUv - vec2(0.0, uTexel.y));
          vec4 mn = min(cur, min(min(c1, c2), min(c3, c4)));
          vec4 mx = max(cur, max(max(c1, c2), max(c3, c4)));
          vec4 ex = (mx - mn) * 0.25 + 0.002;   // slight relaxation keeps more history

          // Reproject via a representative point on the cloud layer midplane.
          vec4 clip = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec4 view = uInvProj * clip; view /= view.w;
          vec3 rd = normalize((uInvView * view).xyz - uCameraPos);
          float denom = abs(rd.y) < 0.02 ? sign(rd.y + 1e-5) * 0.02 : rd.y;
          float tMid = (uMidY - uCameraPos.y) / denom;
          tMid = tMid <= 0.0 ? 3000.0 : clamp(tMid, 250.0, 7000.0);
          vec3 wp = uCameraPos + rd * tMid;

          vec4 pc = uPrevViewProj * vec4(wp, 1.0);
          vec2 puv = pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5;
          float blend = uBlend;
          if (pc.w <= 0.0 || puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) blend = 0.0;

          vec4 hist = clamp(texture2D(tHistory, puv), mn - ex, mx + ex);
          gl_FragColor = mix(cur, hist, blend);
        }
      `,
    });
    this.resolveQuad = new FullScreenQuad(this.resolveMat);
  }

  private _rw() { return Math.max(1, Math.floor(this._w * this.scale)); }
  private _rh() { return Math.max(1, Math.floor(this._h * this.scale)); }
  get texture() { return this._out.texture; }
  get uniforms() { return this.material.uniforms; }

  setSize(w: number, h: number) {
    this._w = w;
    this._h = h;
    this.rtCur.setSize(this._rw(), this._rh());
    this.rtHistA.setSize(this._rw(), this._rh());
    this.rtHistB.setSize(this._rw(), this._rh());
    this._histValid = false;
  }

  // Warm, sun-tinted lighting that tracks the time of day.
  setSun(sunDir: THREE.Vector3) {
    const el = Math.max(sunDir.y, 0.0);
    const u = this.material.uniforms;
    u.uSunDir.value.copy(sunDir);
    // lit tops: orange near the horizon → warm white overhead
    u.uSunColor.value.setRGB(1.0, 0.55 + 0.4 * el, 0.32 + 0.6 * el);
    // shadowed bodies: cool blue-grey, a touch darker at low sun
    u.uFogColor.value.setRGB(0.30 + 0.18 * el, 0.40 + 0.16 * el, 0.55 + 0.12 * el);
    // horizon melt colour: warm at sunset → hazy blue at midday
    const k = Math.min(el * 2.2, 1.0);
    u.uHazeColor.value.setRGB(1.0 + (0.60 - 1.0) * k, 0.62 + (0.74 - 0.62) * k, 0.42 + (0.90 - 0.42) * k);
  }

  render(dt: number, camera: THREE.PerspectiveCamera, depthTexture: THREE.Texture) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
    u.uFrame.value = this._frame;
    u.tDepth.value = depthTexture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uInvView.value.copy(camera.matrixWorld);
    u.uCameraPos.value.copy(camera.position);
    // Accumulated wind drift, shared with the ocean's cloud shadows.
    const t = u.uTime.value * u.uWindSpeed.value;
    u.uDrift.value.set(u.uWindDir.value.x * t, 0.06 * t, u.uWindDir.value.y * t);

    const prev = this.renderer.getRenderTarget();

    // 1) Jittered march → rtCur
    this.renderer.setRenderTarget(this.rtCur);
    this.quad.render(this.renderer);

    // 2) Temporal resolve (rtCur + reprojected history) → rtHistB
    const r = this.resolveMat.uniforms;
    r.tCurrent.value = this.rtCur.texture;
    r.tHistory.value = this.rtHistA.texture;
    r.uInvProj.value.copy(camera.projectionMatrixInverse);
    r.uInvView.value.copy(camera.matrixWorld);
    r.uPrevViewProj.value.copy(this._prevViewProj);
    r.uCameraPos.value.copy(camera.position);
    r.uTexel.value.set(1 / this._rw(), 1 / this._rh());
    r.uMidY.value = u.uBase.value + u.uHeight.value * 0.5;
    r.uBlend.value = this._histValid ? 0.88 : 0.0;
    this.renderer.setRenderTarget(this.rtHistB);
    this.resolveQuad.render(this.renderer);

    // 3) Swap: the freshly resolved buffer becomes both output and history.
    const tmp = this.rtHistA;
    this.rtHistA = this.rtHistB;
    this.rtHistB = tmp;
    this._out = this.rtHistA;
    this._histValid = true;

    this._prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frame++;

    this.renderer.setRenderTarget(prev);
  }
}
