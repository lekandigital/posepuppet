// Ported verbatim from WaterThreeJS src/Sky.js (see WATERTHREEJS_LICENSE.txt).
import * as THREE from 'three';
import { NOISE, ATMOSPHERE } from './shaders/common';

// A camera-locked sky dome that evaluates the shared atmosphere() model.
// depthTest/Write are off so it always sits behind everything, independent of
// the far plane.
export class Sky {
  uniforms: Record<string, THREE.IUniform>;
  mesh: THREE.Mesh;

  constructor(sunDir: THREE.Vector3) {
    this.uniforms = {
      uSunDir: { value: sunDir.clone() },
      uTime: { value: 0 },
      uCloudCover: { value: 1.0 },
    };

    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main(){
          // World-space ray direction from the camera to this vertex.
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = wp.xyz - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uCloudCover;
        varying vec3 vWorldDir;
        ${NOISE}
        ${ATMOSPHERE}
        void main(){
          vec3 dir = normalize(vWorldDir);
          gl_FragColor = vec4(atmosphere(dir, normalize(uSunDir)), 1.0);
        }
      `,
    });

    const geo = new THREE.SphereGeometry(6000, 32, 16);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  // Keep the dome centred on the camera; advance cloud drift.
  update(camera: THREE.Camera, time: number) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = time;
  }

  setSun(sunDir: THREE.Vector3) {
    this.uniforms.uSunDir.value.copy(sunDir);
  }
}
