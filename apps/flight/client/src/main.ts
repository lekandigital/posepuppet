// Self-hosted Inter (upstream loaded it from Google Fonts): weights the UI uses.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { Game } from "./game/Game";
import { ProgressionManager } from "./game/ProgressionManager";
import { createPoseRuntime } from "@bodyarcade/pose-runtime";
import { mountPoseHud } from "@bodyarcade/pose-hud";

// BodyArcade: upstream's Vercel Web Analytics removed — no analytics, no
// telemetry, no network beacons (BodyArcade non-negotiable).

if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("clearSave")) {
    ProgressionManager.clearAll();
    params.delete("clearSave");
    const q = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`,
    );
  }
}

const app = document.getElementById("app")!;
const game = new Game(app);
game.start();

// ── PosePuppet system layer (V1): the game initializes tracking itself —
// no PosePuppet tab needed. The runtime owns the camera (one pipeline per
// page; it yields to an active producer via election / ?pp=companion), and
// the game's existing signal consumers (bodyControls/rowControls) receive
// its BodySignals over the same in-page BroadcastChannel they already use.
// Camera denied → 'denied' state; keyboard flight/rowing is untouched.
const bootParams = new URLSearchParams(window.location.search);
const rowMode = bootParams.has("row");
const runtime = createPoseRuntime({
  // Rowing keeps the FULL pose model: stroke detection reads wrist depth,
  // which collapses under lite near the frame edge (measured: 2/13 → 13/13
  // strokes on the seated fixture). Flight's torso-scale axes are robust
  // to lite and keep the GPU budget for the game.
  model: rowMode ? "full" : "lite",
  // Detection runs in a worker (the full model costs ~30-50 ms per
  // detection — on the main thread that halves the game fps; measured on
  // :2). Rowing additionally runs the worker on the CPU delegate: the
  // full model's GPU inference contends with the game's own rendering in
  // the GPU process (measured: 35 fps GPU-worker vs 57 fps without), and
  // caps at 15 Hz (plenty for ~0.5 Hz strokes).
  worker: true,
  // ?dethz= is a test/eval override for the perf-vs-rate tradeoff curve.
  // Rowing caps at 15 (the pose floor; strokes are ~0.5 Hz). Effective
  // rate on the remote GL-ANGLE box is ~13 Hz — bounded by per-inference
  // time under GPU contention, not by this cap (raising it was measured
  // to add contention without adding rate).
  maxDetectHz: Number(bootParams.get("dethz") ?? (rowMode ? 15 : 0)),
  captureSize: { width: 640, height: 360 }, // tracking needs no 720p; cheaper uploads
  election: "strict",
  forceExternal: bootParams.get("pp") === "companion",
});
if (bootParams.get("hud") !== "0") {
  const hud = mountPoseHud(runtime, {
    // safe-area hint: clear the rowing feedback strip when rowing
    safeArea: rowMode ? { x: 12, y: 118 } : { x: 12, y: 12 },
    title: rowMode ? "ROW" : "POSE",
  });
  // test/eval surface (tier forcing, preview cost) — same convention as __FLIGHT
  (window as unknown as { __PP_HUD: typeof hud }).__PP_HUD = hud;
}
// test/eval surface: runtime state + pose rate for the perf table
(window as unknown as { __POSE_RT: typeof runtime }).__POSE_RT = runtime;
void runtime.start();

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    runtime.dispose();
    game.dispose();
    app.innerHTML = "";
  });
}
