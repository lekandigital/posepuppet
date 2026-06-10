// Three.js stage: dark studio look, ground grid, key + rim light.
// Owns the render loop; callers register per-tick callbacks (retarget slerp,
// HUD updates) via onTick.

import * as THREE from 'three';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  onTick: (cb: (dt: number, time: number) => void) => void;
  renderFps: () => number;
  canvas: HTMLCanvasElement;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0f13);
  scene.fog = new THREE.Fog(0x0e0f13, 6, 14);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 1.3, 3.2);
  camera.lookAt(0, 1.0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.5, 3, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 10;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -1;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4cc2ff, 1.4);
  rim.position.set(-2, 2, -2.5);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(12, 24, 0x2a3040, 0x1d2027);
  scene.add(grid);

  function resize() {
    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement!);
  resize();

  const tickCbs: Array<(dt: number, time: number) => void> = [];
  let last = performance.now();
  let fpsAccum = 0;
  let fpsCount = 0;
  let fps = 0;

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    fpsAccum += dt;
    fpsCount++;
    if (fpsAccum >= 0.5) {
      fps = fpsCount / fpsAccum;
      fpsAccum = 0;
      fpsCount = 0;
    }
    for (const cb of tickCbs) cb(dt, now);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    scene,
    camera,
    renderer,
    canvas,
    onTick: (cb) => tickCbs.push(cb),
    renderFps: () => fps,
  };
}
