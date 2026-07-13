// Open World boot (V4). One region, one WorldRuntime, one profile active,
// one mode active. O1 ships the foundation: baked world rendered by the
// low-poly profile, Runtime+HUD mounted (no PosePuppet tab; camera-denied
// keyboard play holds by construction), flyover camera, attribution
// on-screen, and the __OW eval surface the specs drive.
//
// Everything is local: no network beyond same-origin assets, no telemetry.

import * as THREE from 'three';
import { createPoseRuntime, type PoseRuntime } from '@bodyarcade/pose-runtime';
import { mountPoseHud } from '@bodyarcade/pose-hud';
import worldJson from '../../../packages/world-data/data/worlds/isafjordur/world.json';
import { WorldRuntime } from './world/runtime';
import { createLowPolyProfile } from './profiles/lowpoly';
import type { WorldProfile, ProfileId } from './profiles/types';
import { createChrome } from './ui/chrome';
import { createFlycam } from './modes/flycam';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

// --- world (geographic authority; profile-independent) -----------------
const world = new WorldRuntime(worldJson);

// --- renderer/scene -----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70, app.clientWidth / Math.max(app.clientHeight, 1), 0.5, 20000,
);
camera.rotation.order = 'YXZ';

// --- profile ------------------------------------------------------------
const PROFILES: Record<string, () => WorldProfile> = {
  'low-poly': createLowPolyProfile,
};
const requestedProfile = (params.get('profile') ?? 'low-poly') as ProfileId;
const profile = (PROFILES[requestedProfile] ?? createLowPolyProfile)();
profile.build({ world, scene, renderer });

// --- chrome ---------------------------------------------------------------
const chrome = createChrome(document.body, world.world.displayName, world.attribution());
chrome.setProfile(profile.label);
chrome.setMode('flyover');
chrome.setStatus('O1 FOUNDATION · FLYOVER — WASD/RF + arrows to take the camera');

// --- pose runtime + shared HUD (the V1 mount, unchanged) -----------------
let runtime: PoseRuntime | null = null;
let cameraDenied = false;
if (params.get('hud') !== '0' && !params.has('drive')) {
  runtime = createPoseRuntime({
    model: 'lite',
    worker: true,
    captureSize: { width: 640, height: 360 },
    election: 'strict',
    forceExternal: params.get('pp') === 'companion',
  });
  runtime.onState((s) => {
    cameraDenied = s === 'denied' || s === 'error';
  });
  const poseHud = mountPoseHud(runtime, { safeArea: { x: 12, y: 96 }, title: 'WORLD' });
  (window as unknown as { __PP_HUD: typeof poseHud }).__PP_HUD = poseHud;
  (window as unknown as { __POSE_RT: PoseRuntime }).__POSE_RT = runtime;
  void runtime.start();
}

// --- flyover --------------------------------------------------------------
const flycam = createFlycam(world, camera);

// --- loop -------------------------------------------------------------------
let lastTs: number | null = null;
let frames = 0;
let fps = 0;
let fpsWindowStart = performance.now();

function frame(now: number): void {
  const dtS = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.25);
  lastTs = now;
  const timeS = now / 1000;
  flycam.update(dtS, timeS);
  profile.update(dtS, timeS, camera);
  renderer.render(scene, camera);
  frames++;
  if (now - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    frames = 0;
    fpsWindowStart = now;
    chrome.setStatus(
      `${flycam.manual() ? 'FREECAM' : 'FLYOVER'} · ${fps} FPS · ` +
      `ALT ${Math.round(camera.position.y)} M`,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const onResize = (): void => {
  camera.aspect = app.clientWidth / Math.max(app.clientHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight);
};
window.addEventListener('resize', onResize);

// --- eval surface --------------------------------------------------------
(window as unknown as { __OW: unknown }).__OW = {
  battery: () => world.battery(),
  profile: () => profile.id,
  modes: () => profile.modes.slice(),
  fps: () => fps,
  ground: (x: number, z: number) => world.groundY(x, z),
  inWater: (x: number, z: number) => world.inWater(x, z),
  sdf: (x: number, z: number) => world.shoreSDF(x, z),
  spawns: () => world.spawns(),
  transitions: () => world.transitions(),
  attribution: () => world.attribution(),
  camera: () => ({
    x: camera.position.x, y: camera.position.y, z: camera.position.z,
  }),
  cameraDenied: () => cameraDenied,
  runtimeState: () => runtime?.state() ?? 'off',
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles,
};
