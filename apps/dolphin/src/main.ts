// BodyArcade Dolphin — boot. Post-V1, the page initializes the PosePuppet
// runtime itself (no PosePuppet tab needed): the runtime owns the camera —
// one tracking pipeline per page, yielding to an active producer via
// election / ?pp=companion — and publishes BodySignals on the same in-page
// BroadcastChannel swimControls already consumes. Keyboard always works;
// camera denied leaves a fully playable keyboard dolphin. Everything is
// local: no network, no telemetry, the bay outline ships in the bundle.

import { startGame } from './game/game';
import { createPoseRuntime } from '@bodyarcade/pose-runtime';
import { mountPoseHud } from '@bodyarcade/pose-hud';

startGame(document.getElementById('app')!);

const params = new URLSearchParams(location.search);
// The swim-kick signal reads image-space chest–hip extent (no wrist
// depth), so the LITE model is safe here — GPU budget goes to the game.
const runtime = createPoseRuntime({
  model: 'lite',
  election: 'strict',
  forceExternal: params.get('pp') === 'companion',
});
if (params.get('hud') !== '0') {
  // bottom-left clears the dolphin HUD strip (top) and minimap (top-right)
  const hud = mountPoseHud(runtime, { safeArea: { x: 12, y: 12 }, title: 'SWIM' });
  // test/eval surface (tier forcing, preview cost) — same convention as __DOLPHIN
  (window as unknown as { __PP_HUD: typeof hud }).__PP_HUD = hud;
}
// test/eval surface: runtime state + pose rate for the perf table
(window as unknown as { __POSE_RT: typeof runtime }).__POSE_RT = runtime;
void runtime.start();
