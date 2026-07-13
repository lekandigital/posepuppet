// Open World boot (V4). One region, one WorldRuntime, one profile active,
// one mode active. Modes are profile-blind; profiles are geography-blind.
//
//   ?profile=low-poly            renderer/content pack (default low-poly)
//   ?mode=flight|flyover         active mode (default flight)
//   ?drive=flylap|flyloss|...    synthetic closed-loop body drive (no
//                                camera requested; specs/recordings)
//   ?hud=0                       skip pose runtime + HUD (headless correctness)
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
import { createFlycam, type Flycam } from './modes/flycam';
import { FlightMode } from './modes/flight';
import { WalkMode } from './modes/walk';
import type { GameMode } from './modes/types';
import { SCRIPTS, startBodyDrive } from './drive/bodyDrive';

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
scene.userData.container = app;
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

// --- synthetic drive (before controls construct: no camera in this path) --
const driveName = params.get('drive');
let stopDrive: (() => void) | null = null;
if (driveName && SCRIPTS[driveName]) {
  // drives target a known profile/assist so runs are deterministic
  try {
    localStorage.setItem('bodyarcade_flight_profile_v1', params.get('bodyprofile') ?? 'pilot-lean');
  } catch { /* session-only */ }
  stopDrive = startBodyDrive(SCRIPTS[driveName]);
}

// --- mode ------------------------------------------------------------------
const modeCtx = { world, scene, camera, chrome };
let flycam: Flycam | null = null;
let mode: GameMode | null = null;
const requestedMode = params.get('mode') ?? 'flight';
if (requestedMode === 'flyover') {
  flycam = createFlycam(world, camera);
  chrome.setMode('flyover');
} else if (requestedMode === 'walk') {
  mode = new WalkMode(modeCtx);
  mode.enter();
} else {
  mode = new FlightMode(modeCtx);
  mode.enter();
}

// --- pose runtime + shared HUD (the V1 mount, unchanged) -----------------
let runtime: PoseRuntime | null = null;
let cameraDenied = false;
if (params.get('hud') !== '0' && !driveName) {
  runtime = createPoseRuntime({
    model: 'lite',
    worker: true,
    captureSize: { width: 640, height: 360 },
    election: 'strict',
    forceExternal: params.get('pp') === 'companion',
  });
  runtime.onState((s) => {
    cameraDenied = s === 'denied' || s === 'error';
    if (mode instanceof WalkMode) mode.cameraDenied = cameraDenied;
  });
  const poseHud = mountPoseHud(runtime, { safeArea: { x: 12, y: 96 }, title: 'WORLD' });
  (window as unknown as { __PP_HUD: typeof poseHud }).__PP_HUD = poseHud;
  (window as unknown as { __POSE_RT: PoseRuntime }).__POSE_RT = runtime;
  void runtime.start();
}

// --- loop -------------------------------------------------------------------
let lastTs: number | null = null;
let frames = 0;
let fps = 0;
let fpsWindowStart = performance.now();

function frame(now: number): void {
  const dtS = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.25);
  lastTs = now;
  const timeS = now / 1000;
  if (flycam) {
    flycam.update(dtS, timeS);
    if (now - fpsWindowStart < 50) { /* status below */ }
  }
  mode?.update(dtS, timeS);
  profile.update(dtS, timeS, camera);
  renderer.render(scene, camera);
  frames++;
  if (now - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    frames = 0;
    fpsWindowStart = now;
    if (flycam) {
      chrome.setStatus(
        `${flycam.manual() ? 'FREECAM' : 'FLYOVER'} · ${fps} FPS · ALT ${Math.round(camera.position.y)} M`,
      );
    }
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

window.addEventListener('beforeunload', () => stopDrive?.());

// --- eval surface --------------------------------------------------------
(window as unknown as { __OW: unknown }).__OW = {
  battery: () => world.battery(),
  profile: () => profile.id,
  modes: () => profile.modes.slice(),
  mode: () => (flycam ? 'flyover' : mode?.id ?? 'none'),
  fps: () => fps,
  ground: (x: number, z: number) => world.groundY(x, z),
  inWater: (x: number, z: number) => world.inWater(x, z),
  sdf: (x: number, z: number) => world.shoreSDF(x, z),
  spawns: () => world.spawns(),
  transitions: () => world.transitions(),
  attribution: () => world.attribution(),
  camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  cameraDenied: () => cameraDenied,
  runtimeState: () => runtime?.state() ?? 'off',
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles,
  flight: () => (mode instanceof FlightMode ? mode.state() : null),
  walk: () => (mode instanceof WalkMode ? mode.state() : null),
  flightTeleport: (x: number, z: number, yawDeg: number, y?: number) => {
    if (mode instanceof FlightMode) mode.teleport(x, z, yawDeg, y);
  },
  bounds: () => world.bounds,
};
