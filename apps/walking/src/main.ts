// Walking graybox — boot. Two ways to drive it:
//   live:      the page initializes the PosePuppet runtime (lite model, in
//              a worker) + shared HUD, exactly like Dolphin — no PosePuppet
//              tab needed; keyboard always works; camera denied leaves a
//              fully playable keyboard walk.
//   synthetic: ?drive=march|sway|glide pumps deterministic landmark frames
//              through a real body-input core in-page (closed-loop tests,
//              recordings). No camera is requested in this mode.
//
// Everything is local: no network, no telemetry.

import { createLocomotion, createWalkController } from '@bodyarcade/locomotion';
import type { WalkPose } from '@bodyarcade/locomotion';
import { createPoseRuntime } from '@bodyarcade/pose-runtime';
import type { PoseRuntime } from '@bodyarcade/pose-runtime';
import { mountPoseHud } from '@bodyarcade/pose-hud';
import { createGrayboxWorld } from './world';
import { createGrayboxHud } from './hud';
import { parseDrive, startDrive } from './drive';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

const world = createGrayboxWorld(app);
const hud = createGrayboxHud(document.body);
const controller = createWalkController(window);
const loco = createLocomotion();
loco.teleport(world.spawn.x, world.spawn.z, world.spawn.yawDeg);

// --- input source ----------------------------------------------------
const drive = parseDrive(params);
let runtime: PoseRuntime | null = null;
let cameraDenied = false;
if (drive) {
  startDrive(drive, controller);
} else {
  runtime = createPoseRuntime({
    model: 'lite', // gait reads hips/knees — the lite model carries it
    worker: true,
    captureSize: { width: 640, height: 360 },
    election: 'strict',
    forceExternal: params.get('pp') === 'companion',
  });
  runtime.onState((s) => {
    // 'error' covers environment-level denial too (headless auto-deny
    // surfaces as error — the Dolphin suite's documented /denied|error/):
    // either way the camera is unavailable and keyboard is the play path
    cameraDenied = s === 'denied' || s === 'error';
  });
  if (params.get('hud') !== '0') {
    const poseHud = mountPoseHud(runtime, { safeArea: { x: 12, y: 96 }, title: 'WALK' });
    (window as unknown as { __PP_HUD: typeof poseHud }).__PP_HUD = poseHud;
  }
  (window as unknown as { __POSE_RT: PoseRuntime }).__POSE_RT = runtime;
  void runtime.start();
}

// --- main loop ---------------------------------------------------------
let lastPose: WalkPose = loco.pose();
let traveled = 0;
let lastTs: number | null = null;
const fovAtBoot = world.camera.fov;

function frame(now: number): void {
  const intent = controller.intent(now);
  const pose = loco.step(now, intent, world.pathHint);
  if (lastTs !== null) traveled += Math.abs(pose.speed) * Math.min((now - lastTs) / 1000, 0.25);
  lastTs = now;
  lastPose = pose;

  // first-person rig: yaw only — the model owns comfort; the camera adds
  // NOTHING (no bob, no tilt, fixed FOV)
  world.camera.position.set(pose.x, pose.eyeY, pose.z);
  world.camera.rotation.set(0, (-pose.yawDeg * Math.PI) / 180, 0);

  hud.update(pose, controller.hudState(), loco.envelope(), cameraDenied);
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- test/eval surface --------------------------------------------------
(window as unknown as { __WALK: unknown }).__WALK = {
  pose: () => lastPose,
  envelope: () => loco.envelope(),
  config: () => loco.getConfig(),
  hud: () => controller.hudState(),
  fov: () => world.camera.fov,
  fovAtBoot: () => fovAtBoot,
  camTilt: () => [world.camera.rotation.x, world.camera.rotation.z] as [number, number],
  lateral: () => world.pathHint(lastPose.x, lastPose.z)?.lateral ?? null,
  traveled: () => traveled,
  cameraDenied: () => cameraDenied,
  runtimeState: () => runtime?.state() ?? 'synthetic',
};
