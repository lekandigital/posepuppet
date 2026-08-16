// bake-caves.mjs — Checkpoint 09 cave-module bake orchestrator.
//
// Realizes the hand-authored plan (cave-plan.mjs) as committed runtime
// artifacts:
//
//   1. resolve the plan → a frame-annotated JSON handoff;
//   2. run Blender headless (build-cave-modules.py): pipe/arch lofts +
//      Kenney kit kitbash + area-weighted normals + cosine-weighted BVH
//      ambient-occlusion bake → <id>.rawmesh;
//   3. convert each rawmesh to a minimal deterministic GLB (this file owns
//      every byte: fixed JSON key order, fixed binary layout, no wall
//      clock) at public/world/caves/<id>.glb, AO packed into COLOR_0.r;
//   4. print SHA-256 per artifact.
//
// Usage:
//   node apps/shared-world/authoring/caves/bake-caves.mjs           # write
//   node apps/shared-world/authoring/caves/bake-caves.mjs --verify  # 2 runs → byte-identical + vs disk
//
// Blender: /Applications/Blender.app (5.1.0 recorded); its role is GLB kit
// import + BVH raycasts only — all geometry math is explicit plan-driven
// code. Rebaking cave meshes requires Blender; the terrain bake
// (bake-region.mjs) stays pure Node and only READS the committed GLBs.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HEADLAND, TRENCH, ARCH, SHELL, SEEDS, axisFrame,
} from './cave-plan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const OUT_DIR = join(APP, 'public', 'world', 'caves');
const KIT_DIR = join(HERE, '..', 'assets', 'kenney-modular-cave-kit', 'Models', 'GLB format');
const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const BUILD_PY = join(HERE, 'build-cave-modules.py');

function resolvedPlan() {
  const mod = (m, kind) => ({
    id: m.id,
    kind,
    frame: kind === 'pipe' ? axisFrame(m) : null,
    stations: m.stations ?? [],
    endCap: m.endCap ?? false,
    kit: m.kit ?? [],
    ...(kind === 'arch'
      ? {
          yaw: m.yaw, center: m.center, legOffset: m.legOffset,
          footTopYA: m.footTopYA, footTopYB: m.footTopYB,
          footBottomYA: m.footBottomYA, footBottomYB: m.footBottomYB,
          crownY: m.crownY, ringW: m.ringW, ringD: m.ringD, arcSteps: m.arcSteps,
        }
      : {}),
  });
  return {
    shell: SHELL,
    seeds: SEEDS,
    kitDir: KIT_DIR,
    modules: [mod(HEADLAND, 'pipe'), mod(TRENCH, 'pipe'), mod(ARCH, 'arch')],
  };
}

/** One full build pass → { name: glbBuffer }, plus the Blender report. */
function buildOnce() {
  const work = mkdtempSync(join(tmpdir(), 'bodyarcade-cavebake-'));
  try {
    const planPath = join(work, 'resolved-plan.json');
    writeFileSync(planPath, JSON.stringify(resolvedPlan()));
    const out = execFileSync(
      BLENDER,
      ['--background', '--factory-startup', '--python', BUILD_PY, '--', planPath, work],
      { encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024 },
    );
    const line = out.split('\n').find((l) => l.startsWith('CAVE-BUILD '));
    if (!line) throw new Error('Blender build produced no CAVE-BUILD report:\n' + out.slice(-4000));
    const report = JSON.parse(line.slice('CAVE-BUILD '.length));
    const artifacts = {};
    for (const m of resolvedPlan().modules) {
      const raw = readFileSync(join(work, `${m.id}.rawmesh`));
      artifacts[`${m.id}.glb`] = rawmeshToGlb(raw);
    }
    return { artifacts, report };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** rawmesh (BARAWM02) → minimal deterministic GLB.
 *  Two nodes when Kenney dressing is present: `shell` (navigable geometry —
 *  collision/BVH) and `dressing` (render only). */
function rawmeshToGlb(raw) {
  const magic = raw.toString('ascii', 0, 8);
  if (magic !== 'BARAWM02') throw new Error(`bad rawmesh magic ${magic}`);
  const vertCount = raw.readUInt32LE(8);
  const triCount = raw.readUInt32LE(12);
  const shellVertCount = raw.readUInt32LE(16);
  const shellTriCount = raw.readUInt32LE(20);
  let off = 24;
  const posBytes = vertCount * 12;
  const nrmBytes = vertCount * 12;
  const aoBytes = vertCount * 4;
  const pos = raw.subarray(off, off + posBytes); off += posBytes;
  const nrm = raw.subarray(off, off + nrmBytes); off += nrmBytes;
  const aoF = new Float32Array(raw.buffer.slice(raw.byteOffset + off, raw.byteOffset + off + aoBytes)); off += aoBytes;
  const idx = raw.subarray(off, off + triCount * 12);
  const shellIdxBytes = shellTriCount * 12;
  const dressTriCount = triCount - shellTriCount;
  const shellPosBytes = shellVertCount * 12;
  const shellNrmBytes = shellVertCount * 12;
  const dressVertCount = vertCount - shellVertCount;
  const dressPos = dressVertCount > 0 ? pos.subarray(shellPosBytes) : null;
  const dressNrm = dressVertCount > 0 ? nrm.subarray(shellNrmBytes) : null;
  const shellAo = aoF.subarray(0, shellVertCount);
  const dressAo = dressVertCount > 0 ? aoF.subarray(shellVertCount) : null;
  const shellIdx = idx.subarray(0, shellIdxBytes);
  let dressIdx = null;
  if (dressTriCount > 0) {
    const src = idx.subarray(shellIdxBytes);
    dressIdx = Buffer.alloc(src.length);
    for (let i = 0; i < dressTriCount * 3; i++) {
      dressIdx.writeUInt32LE(src.readUInt32LE(i * 4) - shellVertCount, i * 4);
    }
  }

  const packColor = (ao, n) => {
    const color = Buffer.alloc(n * 4, 255);
    for (let v = 0; v < n; v++) {
      color[v * 4] = Math.max(0, Math.min(255, Math.round(ao[v] * 255)));
    }
    return color;
  };
  const shellColor = packColor(shellAo, shellVertCount);
  const dressColor = dressAo ? packColor(dressAo, dressVertCount) : null;

  const boundsOf = (buf, n) => {
    const pf = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + n * 12));
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < n; v++) {
      for (let c = 0; c < 3; c++) {
        const val = pf[v * 3 + c];
        if (val < mn[c]) mn[c] = val;
        if (val > mx[c]) mx[c] = val;
      }
    }
    return { min: mn.map((v) => Number(v)), max: mx.map((v) => Number(v)) };
  };
  const shellB = boundsOf(pos.subarray(0, shellPosBytes), shellVertCount);
  const dressB = dressPos ? boundsOf(dressPos, dressVertCount) : null;

  const binParts = [
    pos.subarray(0, shellPosBytes), nrm.subarray(0, shellNrmBytes), shellColor, shellIdx,
  ];
  if (dressPos && dressNrm && dressColor && dressIdx) {
    binParts.push(dressPos, dressNrm, dressColor, dressIdx);
  }
  const bin = Buffer.concat(binParts);

  let cursor = 0;
  const view = (byteLength, target) => {
    const v = { buffer: 0, byteOffset: cursor, byteLength, target };
    cursor += byteLength;
    return v;
  };
  const views = [
    view(shellPosBytes, 34962),
    view(shellNrmBytes, 34962),
    view(shellVertCount * 4, 34962),
    view(shellIdxBytes, 34963),
  ];
  if (dressPos && dressIdx) {
    views.push(
      view(dressVertCount * 12, 34962),
      view(dressVertCount * 12, 34962),
      view(dressVertCount * 4, 34962),
      view(dressIdx.length, 34963),
    );
  }
  const accessors = [
    { bufferView: 0, componentType: 5126, count: shellVertCount, type: 'VEC3', min: shellB.min, max: shellB.max },
    { bufferView: 1, componentType: 5126, count: shellVertCount, type: 'VEC3' },
    { bufferView: 2, componentType: 5121, count: shellVertCount, type: 'VEC4', normalized: true },
    { bufferView: 3, componentType: 5125, count: shellTriCount * 3, type: 'SCALAR' },
  ];
  if (dressPos && dressB) {
    accessors.push(
      { bufferView: 4, componentType: 5126, count: dressVertCount, type: 'VEC3', min: dressB.min, max: dressB.max },
      { bufferView: 5, componentType: 5126, count: dressVertCount, type: 'VEC3' },
      { bufferView: 6, componentType: 5121, count: dressVertCount, type: 'VEC4', normalized: true },
      { bufferView: 7, componentType: 5125, count: dressTriCount * 3, type: 'SCALAR' },
    );
  }
  const meshes = [
    { primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, mode: 4 }] },
  ];
  const nodes = [{ name: 'shell', mesh: 0 }];
  if (dressPos) {
    meshes.push({ primitives: [{ attributes: { POSITION: 4, NORMAL: 5, COLOR_0: 6 }, indices: 7, mode: 4 }] });
    nodes.push({ name: 'dressing', mesh: 1 });
  }
  const json = {
    asset: { version: '2.0', generator: 'bodyarcade-cave-bake/1 (CP09)' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binBuf = binPad ? Buffer.concat([bin, Buffer.alloc(binPad)]) : bin;

  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const glb = Buffer.alloc(total);
  glb.writeUInt32LE(0x46546c67, 0); // 'glTF'
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(total, 8);
  glb.writeUInt32LE(jsonBuf.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  jsonBuf.copy(glb, 20);
  const binChunkOff = 20 + jsonBuf.length;
  glb.writeUInt32LE(binBuf.length, binChunkOff);
  glb.writeUInt32LE(0x004e4942, binChunkOff + 4); // 'BIN\0'
  binBuf.copy(glb, binChunkOff + 8);
  return glb;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const mode = process.argv.includes('--verify') ? 'verify' : 'write';

if (mode === 'verify') {
  console.log('Cave-bake determinism verify: two full Blender builds, SHA-256 per artifact...');
  const run1 = buildOnce();
  const run2 = buildOnce();
  let ok = true;
  for (const name of Object.keys(run1.artifacts)) {
    const h1 = sha256(run1.artifacts[name]);
    const h2 = sha256(run2.artifacts[name]);
    const same = h1 === h2;
    ok &&= same;
    let diskNote = 'no file on disk';
    const p = join(OUT_DIR, name);
    if (existsSync(p)) {
      const hd = sha256(readFileSync(p));
      const dsame = hd === h1;
      ok &&= dsame;
      diskNote = dsame ? 'disk MATCH' : `disk MISMATCH (${hd.slice(0, 12)})`;
    }
    console.log(`  ${name}: run1 ${h1.slice(0, 16)} run2 ${same ? 'MATCH' : 'MISMATCH ' + h2.slice(0, 16)}; ${diskNote}`);
  }
  console.log(ok ? 'CAVE VERIFY PASS: byte-identical across runs and vs disk.' : 'CAVE VERIFY FAIL');
  process.exit(ok ? 0 : 1);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  const { artifacts, report } = buildOnce();
  for (const [name, buf] of Object.entries(artifacts)) {
    writeFileSync(join(OUT_DIR, name), buf);
    console.log(`wrote ${name}: ${buf.length} bytes, sha256 ${sha256(buf).slice(0, 16)}`);
  }
  console.log('CAVE-BAKE-REPORT ' + JSON.stringify(report));
}
