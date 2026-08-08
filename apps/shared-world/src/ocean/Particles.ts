// Ported verbatim from WaterThreeJS src/Particles.js (see WATERTHREEJS_LICENSE.txt).
import * as THREE from 'three';

// Drifting "marine snow": thousands of faint motes that catch the light and
// give the underwater volume a sense of scale and depth. The field wraps around
// the camera so it is effectively infinite.
export class Particles {
  box: number;
  uniforms: Record<string, THREE.IUniform>;
  points: THREE.Points;

  constructor(count = 5000, box = 160) {
    this.box = box;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * box;
      positions[i * 3 + 1] = (Math.random() - 0.5) * box;
      positions[i * 3 + 2] = (Math.random() - 0.5) * box;
      seeds[i] = Math.random() * 6.2831853;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uSize: { value: 26.0 },
      uColor: { value: new THREE.Color(0.85, 0.94, 0.98) },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        precision highp float;
        attribute float seed;
        uniform float uTime;
        uniform vec3  uCam;
        uniform float uBox;
        uniform float uSize;
        varying float vTwinkle;

        void main(){
          vec3 p = position;
          // Slow sink + lazy sway.
          p.y -= uTime * 1.4;
          p.x += sin(uTime * 0.3 + seed) * 1.5;
          p.z += cos(uTime * 0.24 + seed * 1.7) * 1.5;

          // Wrap into a box centred on the camera → endless field.
          vec3 rel = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox;
          vec3 world = uCam + rel;

          vTwinkle = 0.6 + 0.4 * sin(uTime * 2.0 + seed * 3.1);

          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize / max(-mv.z, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColor;
        varying float vTwinkle;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float a = smoothstep(0.25, 0.0, r) * 0.5 * vTwinkle;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });

    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  update(time: number, camera: THREE.Camera) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCam.value.copy(camera.position);
  }
}
