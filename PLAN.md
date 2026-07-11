# V1 — PosePuppet Runtime + HUD: plan

Branch `feat/pose-runtime-hud`, worktree `~/Dev/wt-runtime`, tmux `ba-runtime`,
dev port 5174. Autonomy policy per BODYARCADE_CONTEXT.md v2 — no user gates;
human-only checks land in FINAL_USER_TEST_PLAN.md S1–S3/S11 with evidence.

## Audit findings (what exists, where the seams are)

**Tracking pipeline (Full App, `src/`).** `src/main.ts` boots:
camera (`src/camera.ts` — getUserMedia / video-file into one `<video>`) →
MediaPipe detector (`src/pose/detector.ts`, rVFC-driven, GPU→CPU fallback,
full/lite hot swap) → mirror (`src/pose/mirror.ts`) → optional eval masker →
Predictive Pose Continuity (`src/pose/continuity.ts`) → fan-out:
One-Euro smoothing → retargeter/stage; ring buffers; intent detector; and
`src/bodyinput/adapter.ts`, the ONLY place landmarks touch
`@bodyarcade/body-input` — the core derives `BodySignal` and publishes on the
in-page channel + BroadcastChannel. Hand mode has a parallel detector
(`src/pose/handDetector.ts`) that the pose detector yields to.

**Games (completed, consumers only).** Flight/TinySkies
(`apps/flight/client`, Rowing is its `?row` mode) and standalone Dolphin
(`apps/dolphin`) never see landmarks: `input/bodyControls.ts` /
`input/swimControls.ts` subscribe to BroadcastChannel + a postMessage
envelope, dedupe by `signal.ts`, gate on staleness/confidence, decay to
autopilot on loss, and keyboard always wins (KEYBOARD_PRIORITY_MS). Both
apps alias `@bodyarcade/body-input` to package source. Today the producer is
a PosePuppet tab in companion mode (`src/bodyinput/flightBridge.ts`).

**Topology.** One origin: root vite serves the app plus built games at
`/flight/` and `/dolphin/` (BroadcastChannel is origin-scoped — the Gate-2
lesson). Model + wasm assets live in root `public/models`,
`public/mediapipe-wasm` (gitignored, fetched at install).

**Model-variant law (measured, keep):** Fly = lite, Dolphin = lite,
Rowing = FULL (lite wrist-depth collapse: 2/13 → 13/13 strokes on the
seated fixture).

**Licensing check (first-actions item):** there is no `LICENSE_NOTES.md`.
The TinySkies permission text lives in `ASSETS.md` § "BodyArcade Flight —
TinySkies / GlobeFly fork manifest" ("used with permission", link, private
record gitignored as `PERMISSION.local.md`). Requirement satisfied; noted
in DECISIONS.md rather than inventing a new file.

**Suites.** Root Playwright (fake-webcam y4m + eval rig), `apps/flight/tests`
(port 5199 + producer), `apps/dolphin/tests` (port 5197 + producer). All
three must stay green — that is the refactor's contract.

## Extraction map

### `packages/pose-runtime` (new; three-free, DOM-light)

Moved verbatim (history-preserving `git mv`, imports adjusted):

| from | to |
|---|---|
| `src/pose/detector.ts` | `packages/pose-runtime/src/detector.ts` (asset paths become options) |
| `src/pose/handDetector.ts` | `packages/pose-runtime/src/handDetector.ts` |
| `src/pose/continuity.ts` | `packages/pose-runtime/src/continuity.ts` |
| `src/pose/indices.ts` `mirror.ts` `oneEuro.ts` `smoothing.ts` `types.ts` | same names |
| `src/camera.ts` (capture half) | `packages/pose-runtime/src/camera.ts` |

New composition:

- `src/runtime.ts` — `createPoseRuntime(opts)`: explicit camera ownership +
  lifecycle (`idle → starting → running / denied / error / external /
  stopped`), video element supplied (app) or created hidden (games), model
  variant, mirror/ppc toggles, an eval-harness frame interceptor hook, PPC
  tracking states → body-input core (absorbs `src/bodyinput/adapter.ts`),
  publishes `BodySignal` in-page + BroadcastChannel, exposes a trusted
  in-process `onFrame` tap (Full App retargeting; same trust domain),
  `preview` state for the HUD, and privacy/tracking state.
- `src/preview.ts` — `PreviewFrame`: the approved render state that may
  cross to the HUD: mirrored, 2D-only, quantized skeleton segments +
  per-limb tracking + coarse confidence. Never serialized onto a transport.
- `src/election.ts` — one producer per origin: Web Locks
  (`bodyarcade-pose-producer`) with a listen-for-traffic fallback; a page
  that finds an active external producer enters `external` and does NOT
  open the camera (companion mode keeps working, no duplicate pipelines).
  Per page, `createPoseRuntime` enforces a singleton.

### `packages/pose-hud` (new)

- `mountPoseHud(host, runtime, { position?, safeArea?, collapsed? })` →
  handle with `expand/collapse/setSafeArea/unmount`.
- Bottom-left compact square; collapsible to a status pill; hover/focus/
  click expands; expanded view swaps preview ↔ live camera feed. Full
  keyboard parity (tabbable, Enter/Space toggle, Esc collapse, arrow swap).
- Contents: preview figure, mono tracking state (LIVE / REACQ / SIGNAL
  LOST / KEYBOARD / CAMERA DENIED / REMOTE FEED), privacy line ("LOCAL
  INFERENCE · NO UPLOADS"), recenter flash. No settings panel.
- **Preview renderer decision:** 2D-canvas glowing wireframe figure (the
  existing x-ray puppet language) — NOT a VRM. Games ship their own three
  versions (0.172 vs 0.184); a VRM preview would bundle a second three +
  GL context into every game page. "Cheap VRM or simpler" → simpler, in
  the frozen visual language, near-zero GPU. Degradation tiers:
  T0 glow skeleton 30 Hz → T1 flat lines 15 Hz → T2 dot silhouette 10 Hz →
  T3 text-only; auto-drop on sustained frame-budget pressure, test hook to
  force tiers.
- Styles injected, `pp-hud-` scoped, token values copied from the app
  grammar (graphite glass, 1 px rules, mono labels, cyan/blue accents).

### Full App refactor (zero behavior change)

`src/main.ts` consumes the runtime: one `createPoseRuntime` with the app's
video element; the pipeline order (mirror → masker → PPC → smooth →
retarget; body-input pre-smoothing) is preserved inside the runtime +
`onFrame` tap. `src/pose/` and `src/bodyinput/adapter.ts` are deleted;
`src/pose/bodyFrame.ts` (three-dependent, retarget-only) moves to
`src/rig/bodyFrame.ts`; layout-only camera helpers stay app-side as
`src/ui/cameraLayout.ts`. `flightBridge.ts` (companion mode) stays.
The app also mounts the shared HUD? — no: the Full App keeps its own
camera panel + chain readout (frozen design); HUD is for games.

### Game retrofits (mount points only)

- `apps/flight/client/src/main.ts`: init runtime (variant: `?row` → full,
  else lite) + mount HUD with a safe-area hint clearing the rowing strip /
  flight HUD; game code untouched (`bodyControls`/`rowControls` keep
  consuming signals exactly as today, now produced in-page).
- `apps/dolphin/src/main.ts`: same, lite variant, safe-area clearing the
  dolphin HUD/minimap (HUD bottom-left conflicts with nothing there —
  verify on screenshot).
- Both game vite configs: alias `@bodyarcade/pose-runtime`/`pose-hud` to
  source; dev-only middleware exposing root `public/models` +
  `public/mediapipe-wasm` (production topology already same-origin).
- Camera policy: games request the camera at boot (that is what
  "initialize Runtime directly" means); denied → `denied` state, HUD says
  keyboard play, game plays on keys (already true). External producer
  streaming → `external`, no camera grab.

## File ownership (this branch edits nothing else)

- `packages/pose-runtime/**`, `packages/pose-hud/**` (new)
- `packages/body-input/**` — interface FROZEN; no edits expected
- root: `src/pose/**` (removed), `src/camera.ts`, `src/bodyinput/**`,
  `src/main.ts`, `src/ui/cameraLayout.ts` (new), `src/rig/bodyFrame.ts`,
  import-path touches in `src/{eval,gesture,memory,rig,hand,overlay,ui,director}`,
  `vite.config.ts`, `tsconfig.json`
- `apps/flight/client/src/main.ts`, `apps/flight/client/vite.config.ts`,
  `apps/flight/client/tsconfig.json`, `apps/flight/tests/hud.spec.ts` (new)
- `apps/dolphin/src/main.ts`, `apps/dolphin/vite.config.ts`,
  `apps/dolphin/tsconfig.json`, `apps/dolphin/tests/hud.spec.ts` (new)
- root `tests/` additions (runtime regression, boundary), `eval/` untouched
- docs: PLAN/DECISIONS/EVAL_NOTES/STATUS/README/FINAL_USER_TEST_PLAN/ASSETS

## Verification plan

1. **Baseline (pre-change):** root + flight + dolphin suites, recorded.
2. **O1 contract:** same suites green post-extraction; eval fixture spot
   run unchanged within tolerance.
3. **Boundary test:** instrument both transports; assert every emitted
   message passes `assertSignalShape` and contains no 33/21-point
   landmark-like arrays anywhere in the object graph (deep scan).
4. **Per game Playwright:** HUD mounts; expands/collapses via mouse AND
   keyboard; camera-denied (permission denied at browser level) still
   plays on keyboard; exactly one `getUserMedia` call per page
   (init-script counter).
5. **Perf (headed :2, display lock):** per game fps with HUD on/off, pose
   Hz, preview tier costs; floors 60/45 fps, pose ≥ 15 Hz. SwiftShader
   numbers never count; headless failures classified ENVIRONMENT_BLOCKED.
6. **Screenshot board + vision self-review** against the frozen language:
   HUD collapsed/expanded/denied/lost states × three games + app.

## Milestones

- M0 baseline suites + env (this commit: PLAN)
- M1 = O1 extraction + app refactor, suites green
- M2 = O2 pose-hud + preview + tiers + keyboard
- M3 = O3 flight/rowing/dolphin retrofit + per-game specs
- M4 = O4 permission flows, boundary/single-pipeline tests, perf table
- M5 docs + screenshot board + FINAL_USER_TEST_PLAN S1–S3/S11 + STATUS

## Risks

- `main.ts` re-wiring regressing eval honesty paths → keep pipeline order
  bit-identical; masked-eval semantics covered by continuity specs.
- Node: remote default is v12 — all work under nvm node 22 in `ba-runtime`.
- Headless WebGL throttling → headed :2 under `flock` for anything timed.
- three version skew → runtime/HUD stay three-free (decision above).
- Second `getUserMedia` from the app's own video-file/camera toggle →
  route ALL capture through the runtime; test enforces one consumer.
