// Ported verbatim from WaterThreeJS src/Post.js (see WATERTHREEJS_LICENSE.txt).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { NOISE, CAUSTICS } from './shaders/common';

const halfFloatRT = (w: number, h: number, depth = false) => {
  const opts: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
  };
  const rt = new THREE.WebGLRenderTarget(w, h, opts);
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
  }
  return rt;
};

export interface PostRenderParams {
  invProjView: THREE.Matrix4;
  cameraPos: THREE.Vector3;
  sunDir: THREE.Vector3;
  time: number;
  underwater: boolean;
  surfaceY: number;
  cloudTexture?: THREE.Texture | null;
}

// Full post chain: underwater absorption + volumetric god-rays (reconstructed
// from the depth buffer), threshold bloom for sun glints, then ACES tone-map
// and sRGB encode to the screen.
//
// BodyArcade perf adaptation (recorded, cp05C): the demo marches the god-ray
// accumulation inside the full-res underwater pass; here the IDENTICAL march
// runs in a half-res pass (raysRT) that the full-res pass samples — the
// Beer-Lambert absorption stays full-res and byte-identical. Measured: the
// 28-step full-res march at 1728×1080 alone cost ~half the frame budget over
// the region terrain; the shafts are soft light volumes and survive half-res
// visually intact.
export class Post {
  renderer: THREE.WebGLRenderer;
  quad: FullScreenQuad;
  bloomStreak: number;
  sceneRT: THREE.WebGLRenderTarget;
  sceneRT2: THREE.WebGLRenderTarget;
  brightRT: THREE.WebGLRenderTarget;
  blurA: THREE.WebGLRenderTarget;
  blurB: THREE.WebGLRenderTarget;
  raysRT: THREE.WebGLRenderTarget;
  raysMat: THREE.ShaderMaterial;
  underwaterMat: THREE.ShaderMaterial;
  brightMat: THREE.ShaderMaterial;
  blurMat: THREE.ShaderMaterial;
  compositeMat: THREE.ShaderMaterial;
  cloudCompositeMat: THREE.ShaderMaterial;

  constructor(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    sunDir: THREE.Vector3,
    deepColor: THREE.Color,
  ) {
    this.renderer = renderer;
    this.quad = new FullScreenQuad();
    this.bloomStreak = 0.3; // anamorphic horizontal stretch of the bloom

    this.sceneRT = halfFloatRT(width, height);
    const bw = Math.max(1, width >> 1);
    const bh = Math.max(1, height >> 1);
    this.brightRT = halfFloatRT(bw, bh);
    this.blurA = halfFloatRT(bw, bh);
    this.blurB = halfFloatRT(bw, bh);
    this.raysRT = halfFloatRT(bw, bh);

    // ---- Underwater god-ray march (HALF-RES; the demo's exact march) -------
    this.raysMat = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uInvProjView: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uSunDir: { value: sunDir.clone() },
        uTime: { value: 0 },
        uSurfaceY: { value: 0 },
        uShaftColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
        uShaftDensity: { value: 0.05 },
        uMaxDist: { value: 140.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${NOISE}
        ${CAUSTICS}
        varying vec2 vUv;
        uniform sampler2D tDepth;
        uniform mat4 uInvProjView;
        uniform vec3 uCameraPos;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uSurfaceY;
        uniform vec3 uShaftColor;
        uniform float uShaftDensity;
        uniform float uMaxDist;

        float hg(float c, float g){
          float g2 = g * g;
          return (1.0 - g2) / (12.5663706 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
        }

        void main(){
          // Reconstruct world position from depth.
          float d = texture2D(tDepth, vUv).x;
          vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 wp = uInvProjView * clip;
          wp /= wp.w;
          vec3 worldPos = wp.xyz;

          vec3 toFrag = worldPos - uCameraPos;
          float viewDist = length(toFrag);
          vec3 rd = toFrag / max(viewDist, 1e-3);

          // Volumetric shafts: march the view ray, sampling a caustic pattern
          // projected up the sun direction to the surface (demo math, verbatim).
          float dither = fract(sin(dot(vUv, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
          float marchLen = min(viewDist, uMaxDist);
          const int STEPS = 28;
          float dt = marchLen / float(STEPS);
          float acc = 0.0;
          for (int i = 0; i < STEPS; i++){
            float s = (float(i) + dither) * dt;
            vec3 p = uCameraPos + rd * s;
            float below = uSurfaceY - p.y;
            if (below <= 0.0) continue;
            float proj = below / max(uSunDir.y, 0.15);
            vec2 sxz = (p + uSunDir * proj).xz;
            float shaft = caustics(sxz * 0.03 + uSunDir.xz * uTime * 0.25, uTime * 0.5);
            acc += shaft * exp(-below * 0.03);
          }
          acc *= dt;
          float phase = hg(clamp(dot(rd, uSunDir), -1.0, 1.0), 0.72);
          gl_FragColor = vec4(uShaftColor * acc * uShaftDensity * phase, 1.0);
        }
      `,
    });

    // ---- Underwater absorption (full-res) + upsampled god-rays -------------
    this.underwaterMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tRays: { value: null },
        uInvProjView: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uSunDir: { value: sunDir.clone() },
        uTime: { value: 0 },
        uUnderwater: { value: 0 },
        uSurfaceY: { value: 0 },
        uDeepColor: { value: deepColor.clone() },
        uShaftColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
        uExtinction: { value: new THREE.Vector3(0.05, 0.031, 0.022) },
        uFogStrength: { value: 1.0 },
        uShaftDensity: { value: 0.05 },
        uMaxDist: { value: 140.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tRays;
        uniform mat4 uInvProjView;
        uniform vec3 uCameraPos;
        uniform float uUnderwater;
        uniform vec3 uDeepColor;
        uniform vec3 uExtinction;
        uniform float uFogStrength;
        uniform float uMaxDist;

        void main(){
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          if (uUnderwater < 0.5){ gl_FragColor = vec4(col, 1.0); return; }

          // Reconstruct world position from depth.
          float d = texture2D(tDepth, vUv).x;
          vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 wp = uInvProjView * clip;
          wp /= wp.w;
          vec3 worldPos = wp.xyz;

          vec3 toFrag = worldPos - uCameraPos;
          float viewDist = length(toFrag);

          // Beer-Lambert absorption toward the deep-water colour (demo math).
          float dist = min(viewDist, uMaxDist * 3.0);
          vec3 trans = exp(-uExtinction * dist);
          vec3 col2 = col * trans + uDeepColor * (1.0 - trans) * uFogStrength;

          // God rays from the half-res march (bilinear upsample — the shafts
          // are soft light volumes; the demo's per-pixel march is preserved
          // verbatim inside the half-res pass).
          vec3 rays = texture2D(tRays, vUv).rgb;

          gl_FragColor = vec4(col2 + rays, 1.0);
        }
      `,
    });

    // ---- Bloom bright-pass --------------------------------------------------
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 1.15 },
        uKnee: { value: 0.9 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        uniform float uKnee;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float k = smoothstep(uThreshold, uThreshold + uKnee, l);
          gl_FragColor = vec4(c * k, 1.0);
        }
      `,
    });

    // ---- Separable Gaussian blur -------------------------------------------
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uTexel: { value: new THREE.Vector2(1 / bw, 1 / bh) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uDir;
        uniform vec2 uTexel;
        void main(){
          vec2 o = uDir * uTexel;
          vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;
          sum += texture2D(tDiffuse, vUv + o * 1.3846).rgb * 0.316216;
          sum += texture2D(tDiffuse, vUv - o * 1.3846).rgb * 0.316216;
          sum += texture2D(tDiffuse, vUv + o * 3.2308).rgb * 0.070270;
          sum += texture2D(tDiffuse, vUv - o * 3.2308).rgb * 0.070270;
          gl_FragColor = vec4(sum, 1.0);
        }
      `,
    });

    // ---- Final composite: the film grade ------------------------------------
    // Bloom add, chromatic aberration, exposure, ACES, saturation/contrast,
    // film grain, vignette, sRGB — the "Hollywood print" of the HDR frame.
    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0.65 },
        uExposure: { value: 1.05 },
        uUnderwater: { value: 0 },
        uVignette: { value: 0.35 },     // underwater depth vignette
        uVignetteAir: { value: 0.16 },  // subtle cinematic edge falloff above water
        uSaturation: { value: 1.06 },
        uContrast: { value: 1.02 },
        uGrain: { value: 0.05 },
        uCA: { value: 0.5 },            // chromatic aberration amount (lens fringe)
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uBloom;
        uniform float uExposure;
        uniform float uUnderwater;
        uniform float uVignette;
        uniform float uVignetteAir;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uGrain;
        uniform float uCA;
        uniform float uTime;

        vec3 aces(vec3 x){
          const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          return mix(c * 12.92,
                     1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055,
                     step(0.0031308, c));
        }
        float grainHash(vec2 p){
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main(){
          vec2 q = vUv - 0.5;
          float r2 = dot(q, q);

          // Chromatic aberration: radial R/B fringe that grows toward the
          // frame edges — reads as a real anamorphic lens, not a filter.
          vec2 caOff = q * r2 * uCA * 0.012;
          vec3 c;
          c.r = texture2D(tScene, vUv + caOff).r;
          c.g = texture2D(tScene, vUv).g;
          c.b = texture2D(tScene, vUv - caOff).b;

          c += texture2D(tBloom, vUv).rgb * uBloom;
          c *= uExposure;
          c = aces(c);

          // Grade: saturation then a gentle S-curve contrast around mid-grey.
          float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(luma), c, uSaturation);
          c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);

          // Film grain — animated, weighted toward the mid/shadow tones like
          // real stock but gated out of near-black so it never reads as noise.
          float gn = grainHash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 13.7) * 91.0);
          float grainAmt = uGrain * (0.35 + 0.65 * (1.0 - luma)) * smoothstep(0.0, 0.14, luma);
          c += (gn - 0.5) * grainAmt;

          // Vignette: subtle above water, heavier when submerged.
          float vigAmt = mix(uVignetteAir, uVignette * 2.0, uUnderwater);
          c *= clamp(1.0 - r2 * vigAmt * 2.0, 0.0, 1.0);

          gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
        }
      `,
    });

    // ---- Volumetric-cloud composite (scene · transmittance + scatter) --------
    this.sceneRT2 = halfFloatRT(width, height);
    this.cloudCompositeMat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, tClouds: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform sampler2D tClouds;   // rgb = scatter (HDR), a = transmittance
        void main(){
          vec3 s = texture2D(tScene, vUv).rgb;
          vec4 f = texture2D(tClouds, vUv);
          gl_FragColor = vec4(s * f.a + f.rgb, 1.0);
        }
      `,
    });
  }

  setSize(w: number, h: number) {
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    this.sceneRT.setSize(w, h);
    this.sceneRT2.setSize(w, h);
    this.brightRT.setSize(bw, bh);
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
    this.raysRT.setSize(bw, bh);
    this.blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
  }

  private _draw(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render(hdrRT: THREE.WebGLRenderTarget, params: PostRenderParams) {
    const uw = this.underwaterMat.uniforms;
    uw.tDiffuse.value = hdrRT.texture;
    uw.tDepth.value = hdrRT.depthTexture;
    uw.tRays.value = this.raysRT.texture;
    uw.uInvProjView.value.copy(params.invProjView);
    uw.uCameraPos.value.copy(params.cameraPos);
    uw.uSunDir.value.copy(params.sunDir);
    uw.uTime.value = params.time;
    uw.uUnderwater.value = params.underwater ? 1 : 0;
    uw.uSurfaceY.value = params.surfaceY;

    // 0) god-ray march at half res (underwater only). The external dials
    // stay on underwaterMat (uShaftDensity/uShaftColor/uMaxDist — the GUI
    // and presets edit those) and are mirrored here each frame.
    if (params.underwater) {
      const rm = this.raysMat.uniforms;
      rm.tDepth.value = hdrRT.depthTexture;
      rm.uInvProjView.value.copy(params.invProjView);
      rm.uCameraPos.value.copy(params.cameraPos);
      rm.uSunDir.value.copy(params.sunDir);
      rm.uTime.value = params.time;
      rm.uSurfaceY.value = params.surfaceY;
      rm.uShaftColor.value.copy(uw.uShaftColor.value);
      rm.uShaftDensity.value = uw.uShaftDensity.value;
      rm.uMaxDist.value = uw.uMaxDist.value;
      this._draw(this.raysMat, this.raysRT);
    }

    // 1) underwater volumetrics → sceneRT
    this._draw(this.underwaterMat, this.sceneRT);

    // 1b) composite volumetric clouds over the (fogged) scene, HDR, before bloom
    let sceneOut = this.sceneRT;
    if (params.cloudTexture) {
      this.cloudCompositeMat.uniforms.tScene.value = this.sceneRT.texture;
      this.cloudCompositeMat.uniforms.tClouds.value = params.cloudTexture;
      this._draw(this.cloudCompositeMat, this.sceneRT2);
      sceneOut = this.sceneRT2;
    }

    // 2) bright pass → brightRT
    this.brightMat.uniforms.tDiffuse.value = sceneOut.texture;
    this._draw(this.brightMat, this.brightRT);

    // 3) two blur iterations (H, V) x2 — the second horizontal pass is
    // stretched by bloomStreak for a subtle anamorphic lens flare.
    let src = this.brightRT;
    for (let i = 0; i < 2; i++) {
      this.blurMat.uniforms.tDiffuse.value = src.texture;
      this.blurMat.uniforms.uDir.value.set(i === 1 ? 1 + this.bloomStreak * 3 : 1, 0);
      this._draw(this.blurMat, this.blurA);
      this.blurMat.uniforms.tDiffuse.value = this.blurA.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1);
      this._draw(this.blurMat, this.blurB);
      src = this.blurB;
    }

    // 4) composite → screen
    this.compositeMat.uniforms.tScene.value = sceneOut.texture;
    this.compositeMat.uniforms.tBloom.value = this.blurB.texture;
    this.compositeMat.uniforms.uUnderwater.value = params.underwater ? 1 : 0;
    this.compositeMat.uniforms.uTime.value = params.time;
    this._draw(this.compositeMat, null);
  }
}
