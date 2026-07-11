// Procedural low-poly dolphin — original geometry, no imported assets.
// A spindle body built from rings (so few segments the facets show — the
// PS2 read), dorsal fin, pectorals, and a tail whose vertices carry a
// "spine parameter" for CPU undulation: the swim kick literally travels
// down the body. Vertex colors, flat shading, no textures.

import * as THREE from 'three';

const BODY = 0x9db8cf; // pale blue-grey back
const BELLY = 0xe8f4f7;
const FIN = 0x7e99b3;

export interface DolphinRig {
  group: THREE.Group;
  /** advance the undulation: phase 0..1 per kick cycle, amp 0..1 */
  update(timeS: number, kickRate: number, speed: number): void;
}

export function createDolphin(): DolphinRig {
  const group = new THREE.Group();

  // body rings along +z (nose at +z): [z, radius, yOffset]
  const rings: [number, number, number][] = [
    [1.55, 0.02, 0.02],   // rostrum tip
    [1.35, 0.09, 0.03],
    [1.05, 0.18, 0.02],
    [0.6, 0.30, 0],
    [0.0, 0.34, 0],
    [-0.6, 0.26, 0.02],
    [-1.05, 0.15, 0.05],
    [-1.35, 0.07, 0.08],
  ];
  const SEG = 8; // octagonal rings — deliberately chunky
  const pos: number[] = [];
  const col: number[] = [];
  const spine: number[] = []; // 0 at nose → 1 at tail, for undulation
  const idx: number[] = [];
  const zMax = rings[0][0];
  const zMin = rings[rings.length - 1][0];
  const bodyC = new THREE.Color(BODY);
  const bellyC = new THREE.Color(BELLY);
  for (let r = 0; r < rings.length; r++) {
    const [z, rad, oy] = rings[r];
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad * 0.9 + oy;
      pos.push(x, y, z);
      spine.push((zMax - z) / (zMax - zMin));
      const c = Math.sin(a) < -0.25 ? bellyC : bodyC; // belly lighter
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < SEG; k++) {
      const a = r * SEG + k;
      const b = r * SEG + ((k + 1) % SEG);
      const c = (r + 1) * SEG + k;
      const d = (r + 1) * SEG + ((k + 1) % SEG);
      idx.push(a, c, b, b, c, d);
    }
  }
  // fluke: two triangles spreading from the tail end
  const tailBase = pos.length / 3;
  const finC = new THREE.Color(FIN);
  const fluke: [number, number, number][] = [
    [0, 0.1, -1.45], [0.55, 0.14, -1.8], [0.1, 0.12, -1.72],
    [0, 0.1, -1.45], [-0.55, 0.14, -1.8], [-0.1, 0.12, -1.72],
  ];
  for (const [x, y, z] of fluke) {
    pos.push(x, y, z);
    spine.push(1);
    col.push(finC.r, finC.g, finC.b);
  }
  idx.push(tailBase, tailBase + 1, tailBase + 2, tailBase + 3, tailBase + 5, tailBase + 4);
  // dorsal fin
  const dorsalBase = pos.length / 3;
  const dorsal: [number, number, number][] = [
    [0, 0.3, 0.15], [0, 0.62, -0.28], [0, 0.28, -0.42],
  ];
  for (const [x, y, z] of dorsal) {
    pos.push(x, y, z);
    spine.push((zMax - z) / (zMax - zMin));
    col.push(finC.r, finC.g, finC.b);
  }
  idx.push(dorsalBase, dorsalBase + 1, dorsalBase + 2);
  // pectorals
  for (const side of [1, -1]) {
    const b = pos.length / 3;
    const pts: [number, number, number][] = [
      [side * 0.24, -0.16, 0.55], [side * 0.62, -0.34, 0.3], [side * 0.28, -0.2, 0.22],
    ];
    for (const [x, y, z] of pts) {
      pos.push(x, y, z);
      spine.push((zMax - z) / (zMax - zMin));
      col.push(finC.r, finC.g, finC.b);
    }
    if (side === 1) idx.push(b, b + 1, b + 2);
    else idx.push(b, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  const base = new Float32Array(pos);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(1.4);
  group.add(mesh);

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const spineArr = spine;
  let phase = 0;

  function update(_timeS: number, kickRate: number, speed: number): void {
    // undulation frequency follows the kick rhythm; a resting dolphin
    // still breathes a slow wave (idle life)
    const hz = Math.max(0.35, kickRate > 0 ? kickRate : speed * 0.08);
    phase += hz * (1 / 60) * Math.PI * 2;
    const amp = 0.06 + Math.min(0.16, speed * 0.012);
    for (let i = 0; i < spineArr.length; i++) {
      const s = spineArr[i];
      const wave = Math.sin(phase - s * 2.4) * amp * s * s;
      posAttr.setY(i, base[i * 3 + 1] + wave);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return { group, update };
}
