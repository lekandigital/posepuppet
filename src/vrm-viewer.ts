// src/vrm-viewer.ts — VRM Viewer for PosePuppet
// Grouped character view with audit data, type filters, rigging animation.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

// ─── Types ──────────────────────────────────────────────────────────

interface ModelFile {
  name: string;
  url: string;
  type: 'vrm' | 'glb' | 'gltf';
  size: number;
  sizeHuman: string;
  source?: string;
}

interface Attempt {
  name: string;
  models: ModelFile[];
}

interface Character {
  slug: string;
  displayName: string;
  score: number | null;
  profile: string;
  action: string | null;
  warningLabel: string | null;
  enabledControls: string[];
  disabledControls: string[];
  notes: string[];
  attempts: Attempt[];
  totalFiles: number;
}

interface Manifest {
  totalModels: number;
  byType: { vrm: number; glb: number; gltf: number };
  characters: Character[];
  ungroupedModels: ModelFile[];
}

// ─── DOM refs ───────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusText = document.getElementById('status-text')!;
const progressBar = document.getElementById('progress-bar')!;
const progressFill = document.getElementById('progress-fill')!;
const modelInfo = document.getElementById('model-info')!;
const modelListEl = document.getElementById('model-list')!;
const modelCount = document.getElementById('model-count')!;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const dropZone = document.getElementById('drop-zone')!;
const metaPanel = document.getElementById('meta-panel')!;
const metaContent = document.getElementById('meta-content')!;
const filterAll = document.getElementById('filter-all')!;
const filterVrm = document.getElementById('filter-vrm')!;
const filterGlb = document.getElementById('filter-glb')!;
const filterCountAll = document.getElementById('filter-count-all')!;
const filterCountVrm = document.getElementById('filter-count-vrm')!;
const filterCountGlb = document.getElementById('filter-count-glb')!;
const btnGrid = document.getElementById('btn-grid')!;
const btnAxes = document.getElementById('btn-axes')!;
const btnReset = document.getElementById('btn-reset')!;
const btnScreenshot = document.getElementById('btn-screenshot')!;
const btnWireframe = document.getElementById('btn-wireframe')!;
const btnAnimate = document.getElementById('btn-animate')!;

// ─── Three.js Setup ─────────────────────────────────────────────────

const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0d0f13);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
camera.position.set(0, 1.2, 3.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.5;
controls.maxDistance = 50;
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x8899cc, 0.8);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);
scene.add(new THREE.AmbientLight(0x404060, 1.2));

const gridHelper = new THREE.GridHelper(10, 20, 0x2a2f42, 0x1c2030);
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(2);
axesHelper.visible = false;
scene.add(axesHelper);

// ─── State ──────────────────────────────────────────────────────────

let currentVrm: VRM | null = null;
let currentScene: THREE.Object3D | null = null;
let currentModelUrl = '';
let currentCharacter: Character | null = null;
let manifest: Manifest | null = null;
let wireframeEnabled = false;
let animationEnabled = false;
let activeFilter: 'all' | 'vrm' | 'glb' = 'all';
let loadGeneration = 0;
let currentGlbBones: Map<string, THREE.Object3D> = new Map();

function createLoader(): GLTFLoader {
  const ldr = new GLTFLoader();
  ldr.crossOrigin = 'anonymous';
  // Register VRM plugin but make it tolerant of broken VRM data
  ldr.register((parser) => {
    const plugin = new VRMLoaderPlugin(parser);
    const origAfterRoot = plugin.afterRoot.bind(plugin);
    plugin.afterRoot = async (gltf) => {
      try {
        await origAfterRoot(gltf);
      } catch (e) {
        // VRM files with missing required bones will error here.
        // We still want to display them as plain GLB geometry.
        console.warn('[VRM Viewer] VRM parse error (will render as GLB):', e);
        gltf.userData.vrm = undefined;
        gltf.userData.vrmError = e instanceof Error ? e.message : String(e);
      }
    };
    return plugin;
  });
  return ldr;
}

// ─── Rigging Animation ─────────────────────────────────────────────

const ANIM_BONES: VRMHumanBoneName[] = [
  'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
  'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
  'neck', 'head', 'spine', 'chest', 'hips',
] as VRMHumanBoneName[];

const GLB_BONE_PATTERNS: [string, RegExp][] = [
  ['leftUpperArm', /^(mixamorig:?LeftArm|.*\b(left|l)[._ ]?(upper_?arm|arm)\b)/i],
  ['leftLowerArm', /^(mixamorig:?LeftForeArm|.*\b(left|l)[._ ]?(lower_?arm|fore_?arm)\b)/i],
  ['rightUpperArm', /^(mixamorig:?RightArm|.*\b(right|r)[._ ]?(upper_?arm|arm)\b)/i],
  ['rightLowerArm', /^(mixamorig:?RightForeArm|.*\b(right|r)[._ ]?(lower_?arm|fore_?arm)\b)/i],
  ['leftUpperLeg', /^(mixamorig:?LeftUpLeg|.*\b(left|l)[._ ]?(upper_?leg|thigh)\b)/i],
  ['leftLowerLeg', /^(mixamorig:?LeftLeg|.*\b(left|l)[._ ]?(lower_?leg|shin|calf)\b)/i],
  ['rightUpperLeg', /^(mixamorig:?RightUpLeg|.*\b(right|r)[._ ]?(upper_?leg|thigh)\b)/i],
  ['rightLowerLeg', /^(mixamorig:?RightLeg|.*\b(right|r)[._ ]?(lower_?leg|shin|calf)\b)/i],
  ['neck', /^(mixamorig:?Neck|.*\bneck\b)/i],
  ['head', /^(mixamorig:?Head|.*\bhead\b)/i],
  ['spine', /^(mixamorig:?Spine$|.*\bspine\b)/i],
  ['chest', /^(mixamorig:?Spine2|.*\b(chest|upper_?chest)\b)/i],
  ['hips', /^(mixamorig:?Hips|.*\bhips?\b)/i],
];

const restPoses = new Map<string, THREE.Quaternion>();

function getAnimRot(bone: string, t: number): THREE.Euler | null {
  const s = Math.sin(t * 1.2), c = Math.cos(t * 1.2), a = 0.35;
  switch (bone) {
    case 'leftUpperArm': return new THREE.Euler(0, 0, -Math.PI/3 + s*a);
    case 'rightUpperArm': return new THREE.Euler(0, 0, Math.PI/3 - s*a);
    case 'leftLowerArm': return new THREE.Euler(0, 0, -s*a*0.5);
    case 'rightLowerArm': return new THREE.Euler(0, 0, s*a*0.5);
    case 'leftUpperLeg': return new THREE.Euler(s*a*0.6, 0, 0);
    case 'rightUpperLeg': return new THREE.Euler(-s*a*0.6, 0, 0);
    case 'leftLowerLeg': return new THREE.Euler(Math.max(0,-s)*a*0.4, 0, 0);
    case 'rightLowerLeg': return new THREE.Euler(Math.max(0,s)*a*0.4, 0, 0);
    case 'head': return new THREE.Euler(c*a*0.15, s*a*0.2, 0);
    case 'neck': return new THREE.Euler(0, s*a*0.1, 0);
    case 'spine': case 'chest': return new THREE.Euler(0, s*a*0.08, c*a*0.05);
    case 'hips': return new THREE.Euler(0, -s*a*0.05, 0);
    default: return null;
  }
}

function updateAnimation(t: number) {
  if (!animationEnabled) return;
  const applyBone = (key: string, node: THREE.Object3D, boneName: string) => {
    if (!restPoses.has(key)) restPoses.set(key, node.quaternion.clone());
    const euler = getAnimRot(boneName, t);
    if (euler) { node.quaternion.copy(restPoses.get(key)!).multiply(new THREE.Quaternion().setFromEuler(euler)); }
  };
  if (currentVrm?.humanoid) {
    for (const b of ANIM_BONES) {
      let n: THREE.Object3D | null = null;
      try { n = currentVrm.humanoid.getRawBoneNode(b); } catch { /* */ }
      if (n) applyBone(`vrm-${b}`, n, b);
    }
  } else if (currentGlbBones.size > 0) {
    for (const [b, n] of currentGlbBones) applyBone(`glb-${b}`, n, b);
  }
}

function resetAnimation() {
  if (currentVrm?.humanoid) {
    for (const b of ANIM_BONES) {
      let n: THREE.Object3D | null = null;
      try { n = currentVrm.humanoid.getRawBoneNode(b); } catch { /* */ }
      const k = `vrm-${b}`;
      if (n && restPoses.has(k)) n.quaternion.copy(restPoses.get(k)!);
    }
  }
  for (const [b, n] of currentGlbBones) { const k = `glb-${b}`; if (restPoses.has(k)) n.quaternion.copy(restPoses.get(k)!); }
  restPoses.clear();
}

function matchGlbBones(root: THREE.Object3D) {
  currentGlbBones.clear();
  const cands: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.name) cands.push(o); });
  for (const [bn, pat] of GLB_BONE_PATTERNS) { for (const o of cands) { if (pat.test(o.name)) { currentGlbBones.set(bn, o); break; } } }
}

// ─── Model Loading ──────────────────────────────────────────────────

function setStatus(msg: string, type: 'info' | 'error' | 'success' = 'info') {
  statusText.textContent = msg;
  statusText.style.color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '';
  document.body.classList.toggle('loading', type === 'info' && msg.includes('Loading'));
}

function showProgress(pct: number) { progressBar.classList.remove('hidden'); progressFill.style.width = `${Math.round(pct)}%`; }
function hideProgress() { progressBar.classList.add('hidden'); progressFill.style.width = '0%'; }

function disposeCurrentModel() {
  resetAnimation();
  currentGlbBones.clear();
  restPoses.clear();
  if (currentVrm) { try { currentVrm.scene.removeFromParent(); VRMUtils.deepDispose(currentVrm.scene); } catch (e) { console.warn('[dispose]', e); } currentVrm = null; }
  if (currentScene) {
    scene.remove(currentScene);
    currentScene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) { if (!mat) continue; for (const k of Object.keys(mat)) { const v = (mat as Record<string,unknown>)[k]; if (v instanceof THREE.Texture) v.dispose(); } mat.dispose(); }
      }
    });
    currentScene = null;
  }
  THREE.Cache.clear();
  metaPanel.classList.add('hidden');
  modelInfo.textContent = '';
}

async function loadModel(url: string, displayName: string, character?: Character) {
  const gen = ++loadGeneration;
  disposeCurrentModel();
  await new Promise(r => setTimeout(r, 50));
  if (gen !== loadGeneration) return;

  setStatus(`Loading ${displayName}…`);
  showProgress(10);
  currentModelUrl = url;
  currentCharacter = character ?? null;

  try {
    const loader = createLoader();
    const gltf = await new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>((resolve, reject) => {
      loader.load(url, resolve, (p) => { if (p.total > 0) showProgress(10 + (p.loaded / p.total) * 80); }, reject);
    });
    if (gen !== loadGeneration) { gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const ms = Array.isArray(m.material)?m.material:[m.material]; for (const mt of ms) mt?.dispose(); } }); return; }

    showProgress(95);
    const vrm = gltf.userData.vrm as VRM | undefined;

    if (vrm) {
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch { /* */ }
      try { VRMUtils.combineSkeletons(gltf.scene); } catch { /* */ }
      try { VRMUtils.rotateVRM0(vrm); } catch { /* */ }
      vrm.scene.traverse((o) => { o.frustumCulled = false; if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      scene.add(vrm.scene);
      currentVrm = vrm; currentScene = vrm.scene;
      autoCenterCamera(vrm.scene);
      showMetadata(vrm, gltf, character);
      const driven = ANIM_BONES.filter(b => { try { return vrm.humanoid.getRawBoneNode(b) != null; } catch { return false; } });
      modelInfo.textContent = `VRM · ${driven.length}/${ANIM_BONES.length} bones`;
    } else {
      gltf.scene.traverse((o) => { o.frustumCulled = false; if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      scene.add(gltf.scene); currentScene = gltf.scene;
      matchGlbBones(gltf.scene);
      autoCenterCamera(gltf.scene);
      showMetadata(null, gltf, character);
      const vrmErr = gltf.userData.vrmError as string | undefined;
      modelInfo.textContent = vrmErr ? `⚠ VRM fallback · ${currentGlbBones.size} bones` : `GLB · ${currentGlbBones.size} bones`;
    }

    if (wireframeEnabled) applyWireframe(true);
    showProgress(100);
    setTimeout(hideProgress, 400);
    setStatus(displayName, 'success');
  } catch (err) {
    if (gen !== loadGeneration) return;
    hideProgress();
    setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    console.error('[VRM Viewer]', err);
  }
}

function autoCenterCamera(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z);
  controls.target.copy(center);
  camera.position.set(center.x + d*0.8, center.y + d*0.3, center.z + d*1.5);
  controls.update();
}

// ─── Metadata Panel ─────────────────────────────────────────────────

function mr(label: string, value: string) { return `<div class="meta-row"><span class="meta-label">${label}</span><span class="meta-value">${value}</span></div>`; }

function showMetadata(vrm: VRM | null, gltf: import('three/examples/jsm/loaders/GLTFLoader.js').GLTF, char?: Character) {
  let html = '';

  // Character audit info
  if (char) {
    if (char.score != null) html += mr('Audit Score', `${char.score}/100`);
    html += mr('Profile', char.profile);
    if (char.action) html += mr('Action', char.action.replace(/_/g, ' '));
    if (char.warningLabel) html += mr('Status', char.warningLabel.replace(/-/g, ' '));
    if (char.enabledControls.length) html += mr('Enabled', char.enabledControls.join(', '));
    if (char.disabledControls.length) html += mr('Disabled', char.disabledControls.join(', '));
  }

  // VRM-specific
  if (vrm?.meta) {
    const m = vrm.meta;
    if (m.metaVersion) html += mr('VRM Ver', m.metaVersion);
    if ('title' in m && m.title) html += mr('Title', String(m.title));
    if ('authors' in m && m.authors) html += mr('Authors', (m.authors as string[]).join(', '));
    if ('author' in m && m.author) html += mr('Author', String(m.author));
  }

  if (vrm?.humanoid) {
    const found = ANIM_BONES.filter(b => { try { return vrm.humanoid.getRawBoneNode(b) != null; } catch { return false; } });
    const missing = ANIM_BONES.filter(b => { try { return vrm.humanoid.getRawBoneNode(b) == null; } catch { return true; } });
    html += mr('Driven Bones', `${found.length}/${ANIM_BONES.length}`);
    if (missing.length > 0 && missing.length < ANIM_BONES.length) html += mr('Missing', missing.join(', '));
  }

  // GLB bone info
  if (!vrm && currentGlbBones.size > 0) {
    html += mr('Matched Bones', `${currentGlbBones.size}/${GLB_BONE_PATTERNS.length}`);
  }

  // Mesh stats
  let meshes = 0, verts = 0, bones = 0;
  gltf.scene.traverse(o => {
    if ((o as THREE.Mesh).isMesh) { meshes++; verts += (o as THREE.Mesh).geometry?.getAttribute('position')?.count ?? 0; }
    if ((o as THREE.Bone).isBone) bones++;
  });
  html += mr('Meshes', String(meshes));
  html += mr('Vertices', verts.toLocaleString());
  if (!vrm) { html += mr('Skel Bones', String(bones)); html += mr('Animations', String(gltf.animations?.length ?? 0)); }

  // Notes from audit
  if (char?.notes?.length) {
    html += '<div class="meta-notes">';
    for (const note of char.notes) html += `<div class="meta-note">• ${note}</div>`;
    html += '</div>';
  }

  metaContent.innerHTML = html;
  metaPanel.classList.remove('hidden');
}

// ─── Wireframe ──────────────────────────────────────────────────────

function applyWireframe(en: boolean) {
  currentScene?.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material) { const ms = Array.isArray(m.material)?m.material:[m.material]; for (const mt of ms) (mt as THREE.MeshStandardMaterial).wireframe = en; }
  });
}

// ─── Sidebar Rendering ─────────────────────────────────────────────

const chevronSvg = (cls: string) => `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 4 10 8 6 12"/></svg>`;

function matchesFilter(m: ModelFile): boolean {
  if (activeFilter !== 'all' && m.type !== activeFilter) return false;
  const q = searchInput.value.toLowerCase();
  return !q || m.name.toLowerCase().includes(q);
}

function matchesFilterType(type: string): boolean {
  return activeFilter === 'all' || type === activeFilter;
}

function matchesSearch(text: string): boolean {
  const q = searchInput.value.toLowerCase();
  return !q || text.toLowerCase().includes(q);
}

function countFiltered(models: ModelFile[]): number {
  return models.filter(matchesFilter).length;
}

function renderModelList() {
  if (!manifest) return;
  modelListEl.innerHTML = '';
  let totalShown = 0;

  // Render characters
  for (const char of manifest.characters) {
    const charVisible = char.attempts.some(a => a.models.some(matchesFilter)) ||
                         matchesSearch(char.slug) || matchesSearch(char.displayName);
    if (!charVisible) continue;

    const group = document.createElement('div');
    group.className = 'char-group';

    // Character header
    const header = document.createElement('div');
    header.className = 'char-header';

    const scoreClass = char.score == null ? '' : char.score >= 80 ? 'score-high' : char.score >= 50 ? 'score-mid' : 'score-low';
    const profileClass = char.profile.startsWith('humanoid') ? 'humanoid' : char.profile === 'creature' ? 'creature' : char.profile === 'hand_only' ? 'hand_only' : '';
    const charFileCount = char.attempts.reduce((s, a) => s + countFiltered(a.models), 0);
    totalShown += charFileCount;

    header.innerHTML = `
      ${chevronSvg('char-chevron')}
      <span class="char-name">${char.displayName}</span>
      ${char.score != null ? `<span class="char-score ${scoreClass}">${char.score}</span>` : ''}
      <span class="char-profile ${profileClass}">${char.profile.replace(/_/g, ' ')}</span>
      <span class="char-count">${charFileCount}</span>
    `;
    header.addEventListener('click', () => group.classList.toggle('collapsed'));
    group.appendChild(header);

    // Audit info row
    const audit = document.createElement('div');
    audit.className = 'char-audit';
    let auditHtml = '';
    if (char.warningLabel) auditHtml += `<div>⚠ ${char.warningLabel.replace(/-/g, ' ')}</div>`;
    if (char.action) auditHtml += `<div>Action: ${char.action.replace(/_/g, ' ')}</div>`;
    if (char.enabledControls.length || char.disabledControls.length) {
      auditHtml += '<div class="controls-row">';
      for (const c of char.enabledControls) auditHtml += `<span class="control-tag enabled">${c.replace(/_/g,' ')}</span>`;
      for (const c of char.disabledControls) auditHtml += `<span class="control-tag disabled">${c.replace(/_/g,' ')}</span>`;
      auditHtml += '</div>';
    }
    audit.innerHTML = auditHtml;
    group.appendChild(audit);

    // Attempts
    for (const attempt of char.attempts) {
      const filtered = attempt.models.filter(matchesFilter);
      if (filtered.length === 0) continue;

      const aGroup = document.createElement('div');
      aGroup.className = 'attempt-group';

      const aHeader = document.createElement('div');
      aHeader.className = 'attempt-header';
      aHeader.innerHTML = `
        ${chevronSvg('attempt-chevron')}
        <span class="attempt-name">${attempt.name}</span>
        <span class="attempt-count">${filtered.length}</span>
      `;
      aHeader.addEventListener('click', () => aGroup.classList.toggle('collapsed'));
      aGroup.appendChild(aHeader);

      const children = document.createElement('div');
      children.className = 'attempt-children';

      for (const model of filtered) {
        const item = document.createElement('div');
        item.className = 'model-item';
        if (model.url === currentModelUrl) item.classList.add('active');
        item.innerHTML = `
          <div class="model-icon ${model.type}">${model.type}</div>
          <span class="file-name" title="${model.name}">${model.name}</span>
          <span class="file-size">${model.sizeHuman}</span>
        `;
        item.addEventListener('click', () => {
          loadModel(model.url, `${char.displayName} / ${attempt.name} / ${model.name}`, char);
          currentModelUrl = model.url;
          highlightActive();
        });
        children.appendChild(item);
      }

      aGroup.appendChild(children);
      group.appendChild(aGroup);
    }

    modelListEl.appendChild(group);
  }

  // Ungrouped models
  const ungrouped = manifest.ungroupedModels.filter(matchesFilter);
  if (ungrouped.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'ungrouped-header';
    hdr.textContent = `Other Models (${ungrouped.length})`;
    modelListEl.appendChild(hdr);

    for (const model of ungrouped) {
      totalShown++;
      const item = document.createElement('div');
      item.className = 'ungrouped-item';
      if (model.url === currentModelUrl) item.classList.add('active');
      item.innerHTML = `
        <div class="model-icon ${model.type}">${model.type}</div>
        <span class="file-name" title="${model.name}">${model.name}</span>
        <span class="file-size">${model.sizeHuman}</span>
      `;
      item.addEventListener('click', () => {
        loadModel(model.url, model.name);
        currentModelUrl = model.url;
        highlightActive();
      });
      modelListEl.appendChild(item);
    }
  }

  modelCount.textContent = String(totalShown);
}

function highlightActive() {
  for (const item of modelListEl.querySelectorAll('.model-item, .ungrouped-item')) {
    const isActive = item.querySelector('.file-name')?.getAttribute('title') ===
      modelListEl.querySelector('.model-item.active .file-name, .ungrouped-item.active .file-name')?.getAttribute('title');
    // Simply remove all active and re-apply based on URL
    item.classList.remove('active');
  }
  // Re-apply based on currentModelUrl by matching file-name's associated URL
  // Since we rebuild on render, just call renderModelList for now
}

function updateFilterCounts() {
  if (!manifest) return;
  const q = searchInput.value.toLowerCase();
  const allFiles: ModelFile[] = [
    ...manifest.characters.flatMap(c => c.attempts.flatMap(a => a.models)),
    ...manifest.ungroupedModels,
  ];
  const mq = (m: ModelFile) => !q || m.name.toLowerCase().includes(q);
  filterCountAll.textContent = String(allFiles.filter(mq).length);
  filterCountVrm.textContent = String(allFiles.filter(m => m.type === 'vrm' && mq(m)).length);
  filterCountGlb.textContent = String(allFiles.filter(m => m.type === 'glb' && mq(m)).length);
}

function setFilter(f: 'all' | 'vrm' | 'glb') {
  activeFilter = f;
  filterAll.classList.toggle('active', f === 'all');
  filterVrm.classList.toggle('active', f === 'vrm');
  filterGlb.classList.toggle('active', f === 'glb');
  renderModelList();
}

filterAll.addEventListener('click', () => setFilter('all'));
filterVrm.addEventListener('click', () => setFilter('vrm'));
filterGlb.addEventListener('click', () => setFilter('glb'));
searchInput.addEventListener('input', () => { updateFilterCounts(); renderModelList(); });

// ─── Drag & Drop ────────────────────────────────────────────────────

function setupDragDrop() {
  for (const el of [dropZone, canvas]) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    el.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['vrm','glb','gltf'].includes(ext)) { setStatus(`Unsupported: ${file.name}`, 'error'); return; }
      loadModel(URL.createObjectURL(file), `📁 ${file.name}`);
    });
  }
}

// ─── Toolbar ────────────────────────────────────────────────────────

btnGrid.addEventListener('click', () => { gridHelper.visible = !gridHelper.visible; btnGrid.classList.toggle('active', gridHelper.visible); });
btnAxes.addEventListener('click', () => { axesHelper.visible = !axesHelper.visible; btnAxes.classList.toggle('active', axesHelper.visible); });
btnReset.addEventListener('click', () => { if (currentScene) autoCenterCamera(currentScene); else { camera.position.set(0,1.2,3.5); controls.target.set(0,0.9,0); controls.update(); } });
btnScreenshot.addEventListener('click', () => { renderer.render(scene, camera); const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `vrm-${Date.now()}.png`; a.click(); setStatus('Screenshot saved', 'success'); });
btnWireframe.addEventListener('click', () => { wireframeEnabled = !wireframeEnabled; btnWireframe.classList.toggle('active', wireframeEnabled); applyWireframe(wireframeEnabled); });
btnAnimate.addEventListener('click', () => { animationEnabled = !animationEnabled; btnAnimate.classList.toggle('active', animationEnabled); if (!animationEnabled) resetAnimation(); });

// ─── Resize ─────────────────────────────────────────────────────────

function onResize() {
  const vp = document.getElementById('viewport')!;
  renderer.setSize(vp.clientWidth, vp.clientHeight);
  camera.aspect = vp.clientWidth / vp.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// ─── Render Loop ────────────────────────────────────────────────────

let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  elapsed += delta;
  if (currentVrm) { try { currentVrm.update(delta); } catch { /* */ } }
  if (animationEnabled) updateAnimation(elapsed);
  controls.update();
  renderer.render(scene, camera);
}

// ─── Init ───────────────────────────────────────────────────────────

async function init() {
  onResize();
  setupDragDrop();
  animate();
  animationEnabled = true;
  btnAnimate.classList.add('active');

  setStatus('Loading manifest…');
  showProgress(5);

  try {
    const res = await fetch('/vrm-viewer/manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > 0 && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        showProgress(5 + (received / contentLength) * 85);
      }
      const all = new Uint8Array(received);
      let pos = 0;
      for (const ch of chunks) { all.set(ch, pos); pos += ch.length; }
      manifest = JSON.parse(new TextDecoder().decode(all));
    } else {
      showProgress(50);
      manifest = await res.json();
    }

    showProgress(95);
    if (!manifest || manifest.totalModels === 0) { hideProgress(); setStatus('No models. Run: npm run vrm:manifest', 'error'); return; }

    updateFilterCounts();
    renderModelList();
    showProgress(100);
    setTimeout(hideProgress, 400);
    setStatus(`${manifest.totalModels} models · ${manifest.characters.length} characters · ${manifest.byType.vrm} VRM, ${manifest.byType.glb} GLB`);

    const param = new URLSearchParams(window.location.search).get('model');
    if (param && manifest.characters.length) {
      const char = manifest.characters.find(c => c.slug.includes(param.toLowerCase()));
      if (char?.attempts[0]?.models[0]) {
        const m = char.attempts[0].models[0];
        loadModel(m.url, `${char.displayName} / ${char.attempts[0].name} / ${m.name}`, char);
      }
    }
  } catch (err) {
    hideProgress();
    setStatus(`Manifest error: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

init();
