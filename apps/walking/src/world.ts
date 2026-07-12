// Graybox world — a flat proving ground, deliberately not a place: grid
// ground, one S-curve path ribbon with shoulder posts, a few parallax
// landmarks, fog. The path polyline doubles as the PathHint implementation
// (the same contract V4's nav graph will provide), so the assist steering
// is proven against the real interface, not a mock.

import * as THREE from 'three';
import type { PathHint } from '@bodyarcade/locomotion';

export interface GrayboxWorld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  pathHint: PathHint;
  spawn: { x: number; z: number; yawDeg: number };
  render(): void;
  dispose(): void;
}

const PATH_HALF_WIDTH = 1.5;

function gridTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d2129';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2a3040';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = '#232838';
  g.lineWidth = 1;
  for (const p of [64, 128, 192]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(150, 150);
  return tex;
}

export function createGrayboxWorld(container: HTMLElement): GrayboxWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151922);
  scene.fog = new THREE.Fog(0x151922, 40, 230);

  const camera = new THREE.PerspectiveCamera(
    70, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 500,
  );
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x8899bb, 0x232838, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(40, 80, -30);
  scene.add(sun);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: gridTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // --- the path: an S-curve polyline ---------------------------------
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(0, 0, -20),
      new THREE.Vector3(10, 0, -48),
      new THREE.Vector3(9, 0, -78),
      new THREE.Vector3(-7, 0, -100),
      new THREE.Vector3(-6, 0, -132),
      new THREE.Vector3(9, 0, -158),
      new THREE.Vector3(10, 0, -190),
    ],
    false,
    'catmullrom',
    0.35,
  );
  const pts = curve.getSpacedPoints(240);

  // ribbon mesh from the polyline
  const verts: number[] = [];
  const rights: { x: number; z: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    // right of travel direction (matches PathHint lateral sign)
    rights.push({ x: -dz / len, z: dx / len });
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const r = rights[i];
    verts.push(p.x + r.x * PATH_HALF_WIDTH, 0.02, p.z + r.z * PATH_HALF_WIDTH);
    verts.push(p.x - r.x * PATH_HALF_WIDTH, 0.02, p.z - r.z * PATH_HALF_WIDTH);
  }
  const idx: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const k = i * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ribbonGeo.setIndex(idx);
  ribbonGeo.computeVertexNormals();
  const ribbon = new THREE.Mesh(
    ribbonGeo,
    // DoubleSide: the strip's winding faces down half the time — culling
    // made the path invisible (vision review, first capture round)
    new THREE.MeshLambertMaterial({ color: 0x4c5a75, side: THREE.DoubleSide }),
  );
  scene.add(ribbon);

  // bright center line so the path reads at distance
  const centerGeo = new THREE.BufferGeometry().setFromPoints(
    pts.map((p) => new THREE.Vector3(p.x, 0.05, p.z)),
  );
  scene.add(new THREE.Line(centerGeo, new THREE.LineBasicMaterial({ color: 0x9fb4d8 })));

  // shoulder posts, alternating sides
  const postGeo = new THREE.ConeGeometry(0.14, 0.8, 6);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x7f96c8 });
  for (let i = 6; i < pts.length - 4; i += 12) {
    const side = (i / 12) % 2 === 0 ? 1 : -1;
    const p = pts[i];
    const r = rights[i];
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(
      p.x + r.x * (PATH_HALF_WIDTH + 0.5) * side,
      0.4,
      p.z + r.z * (PATH_HALF_WIDTH + 0.5) * side,
    );
    scene.add(post);
  }

  // parallax landmarks
  const lmMat = new THREE.MeshLambertMaterial({ color: 0x2c3446 });
  const landmarks: [number, number, number, number][] = [
    [28, -35, 3, 10], [-24, -70, 4, 16], [30, -120, 3, 8], [-30, -150, 5, 22],
    [45, -90, 6, 12], [-45, -40, 3, 9],
  ];
  for (const [lx, lz, s, h] of landmarks) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), lmMat);
    tower.position.set(lx, h / 2, lz);
    scene.add(tower);
  }

  // --- PathHint from the polyline (V4's nav-graph contract) ----------
  const pathHint: PathHint = (x: number, z: number) => {
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dx = x - pts[i].x;
      const dz = z - pts[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    if (best < 0 || bestD2 > 30 * 30) return null; // far off-network
    const a = pts[Math.max(best - 1, 0)];
    const b = pts[Math.min(best + 1, pts.length - 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len;
    const dirZ = dz / len;
    const rx = -dirZ;
    const rz = dirX;
    const lateral = (x - pts[best].x) * rx + (z - pts[best].z) * rz;
    return { dirX, dirZ, lateral, halfWidth: PATH_HALF_WIDTH };
  };

  // spawn at the path start, facing along it
  const d0x = pts[2].x - pts[0].x;
  const d0z = pts[2].z - pts[0].z;
  const spawn = {
    x: pts[0].x,
    z: pts[0].z,
    yawDeg: (Math.atan2(d0x, -d0z) * 180) / Math.PI,
  };

  const onResize = (): void => {
    camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    pathHint,
    spawn,
    render(): void {
      renderer.render(scene, camera);
    },
    dispose(): void {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
