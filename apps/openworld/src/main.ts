// Open World boot (V4). One region, one WorldRuntime, one profile active,
// one mode active (ModeManager owns transitions: TRANSITIONS.md).
//
//   ?profile=low-poly            renderer/content pack (default low-poly)
//   ?mode=flight|walk|row|dolphin|flyover   (default flight; dolphin is
//                                low-poly-only and falls back to flight)
//   ?drive=flylap|walkroute|...  synthetic closed-loop body drive
//   ?hud=0                       skip pose runtime + HUD (headless correctness)
//
// Everything is local: no network beyond same-origin assets, no telemetry.

import * as THREE from 'three';
import { createPoseRuntime, type PoseRuntime } from '@bodyarcade/pose-runtime';
import { mountPoseHud } from '@bodyarcade/pose-hud';
import worldJson from '../../../packages/world-data/data/worlds/isafjordur/world.json';
import { WorldRuntime } from './world/runtime';
import { createLowPolyProfile } from './profiles/lowpoly';
import { createRealisticProfile } from './profiles/realistic';
import { createFantasyProfile } from './profiles/fantasy';
import type { WorldProfile, ProfileId } from './profiles/types';
import { createChrome } from './ui/chrome';
import { createSelector } from './ui/selector';
import { createFlycam, type Flycam } from './modes/flycam';
import { FlightMode } from './modes/flight';
import { WalkMode } from './modes/walk';
import { RowMode } from './modes/row';
import { DolphinMode } from './modes/dolphin';
import { ModeManager } from './transitions';
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
const PROFILES: Partial<Record<ProfileId, () => WorldProfile>> = {
  'low-poly': createLowPolyProfile,
  'realistic': createRealisticProfile,
  'fantasy-game': createFantasyProfile,
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
  try {
    localStorage.setItem('bodyarcade_flight_profile_v1', params.get('bodyprofile') ?? 'pilot-lean');
  } catch { /* session-only */ }
  stopDrive = startBodyDrive(SCRIPTS[driveName]);
}

// --- mode manager ----------------------------------------------------------
const modeCtx = { world, scene, camera, chrome };
const requestedMode = params.get('mode') ?? 'flight';
let flycam: Flycam | null = null;
let manager: ModeManager | null = null;
if (requestedMode === 'flyover') {
  flycam = createFlycam(world, camera);
  chrome.setMode('flyover');
} else {
  manager = new ModeManager(modeCtx, profile.modes);
  manager.start(requestedMode);
}

createSelector(
  document.body,
  Object.keys(PROFILES) as ProfileId[],
  profile.id,
  profile.modes,
  flycam ? 'flyover' : manager?.mode?.id ?? 'flight',
);

// --- pose runtime + shared HUD (the V1 mount, unchanged) -----------------
let runtime: PoseRuntime | null = null;
let cameraDenied = false;
if (params.get('hud') !== '0' && !driveName) {
  runtime = createPoseRuntime({
    // rowing reads wrist depth — the full model is the V1-measured need
    model: requestedMode === 'row' ? 'full' : 'lite',
    worker: true,
    captureSize: { width: 640, height: 360 },
    election: 'strict',
    forceExternal: params.get('pp') === 'companion',
  });
  runtime.onState((s) => {
    cameraDenied = s === 'denied' || s === 'error';
    if (manager?.mode instanceof WalkMode) manager.mode.cameraDenied = cameraDenied;
  });
  const poseHud = mountPoseHud(runtime, { safeArea: { x: 12, y: 96 }, title: 'WORLD' });
  (window as unknown as { __PP_HUD: typeof poseHud }).__PP_HUD = poseHud;
  (window as unknown as { __POSE_RT: PoseRuntime }).__POSE_RT = runtime;
  void runtime.start();
  manager?.onPoseModel((m) => { void runtime?.setModel(m); });
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
  flycam?.update(dtS, timeS);
  manager?.mode?.update(dtS, timeS);
  manager?.update();
  profile.update(dtS, timeS, camera);
  if (!manager?.render(renderer)) renderer.render(scene, camera);
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
const activeMode = (): unknown => manager?.mode ?? null;
(window as unknown as { __OW: unknown }).__OW = {
  battery: () => world.battery(),
  profile: () => profile.id,
  modes: () => profile.modes.slice(),
  mode: () => (flycam ? 'flyover' : manager?.mode?.id ?? 'none'),
  fps: () => fps,
  ground: (x: number, z: number) => world.groundY(x, z),
  inWater: (x: number, z: number) => world.inWater(x, z),
  sdf: (x: number, z: number) => world.shoreSDF(x, z),
  spawns: () => world.spawns(),
  transitions: () => world.transitions(),
  transition: () => manager?.transitionState() ?? { eligible: null, label: null },
  attribution: () => world.attribution(),
  camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  cameraDenied: () => cameraDenied,
  runtimeState: () => runtime?.state() ?? 'off',
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles,
  flight: () => (activeMode() instanceof FlightMode ? (activeMode() as FlightMode).state() : null),
  flightTeleport: (x: number, z: number, yawDeg: number, y?: number) => {
    const m = activeMode();
    if (m instanceof FlightMode) m.teleport(x, z, yawDeg, y);
  },
  walk: () => (activeMode() instanceof WalkMode ? (activeMode() as WalkMode).state() : null),
  walkTeleport: (x: number, z: number, yawDeg: number) => {
    const m = activeMode();
    if (m instanceof WalkMode) m.enterAt(x, z, yawDeg);
  },
  row: () => (activeMode() instanceof RowMode ? (activeMode() as RowMode).state() : null),
  rowTeleport: (x: number, z: number, yawDeg: number, speed?: number) => {
    const m = activeMode();
    if (m instanceof RowMode) m.teleport(x, z, yawDeg, speed);
  },
  dolphin: () => (activeMode() instanceof DolphinMode ? (activeMode() as DolphinMode).state() : null),
  dolphinTest: {
    setIntent: (p: unknown) => { const m = activeMode(); if (m instanceof DolphinMode) m.setTestIntent(p as never); },
    teleport: (x: number, z: number, y?: number) => { const m = activeMode(); if (m instanceof DolphinMode) m.teleport(x, z, y); },
    setYaw: (yaw: number) => { const m = activeMode(); if (m instanceof DolphinMode) m.setYaw(yaw); },
    setAssist: (a: string) => { const m = activeMode(); if (m instanceof DolphinMode) m.setAssist(a as never); },
  },
  bounds: () => world.bounds,
};
