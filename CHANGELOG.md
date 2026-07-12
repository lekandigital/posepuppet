# Changelog

## V3 — Walking Locomotion (2026-07-12)

Gait detection + comfortable first-person ground movement as a reusable
package, proven in a graybox and handed to the Open World (V4) with
integration notes. No town was built; `apps/openworld` is untouched.

### Added
- `@bodyarcade/body-input` 1.1.0: additive `gait` block — step events
  from hip/knee alternation, cadence (steps/s), weight-shift axis, and a
  substrate tag (`legs` = knee-lift difference when legs are framed,
  `sway` = lateral hip excursion for desk framing / weight-shift walking;
  one detector, extremum rebase across the substrate switch so the count
  and rhythm survive reframing). Gait false-positive rows in
  fixture-eval on every existing clip; 9 new node specs; determinism and
  the landmark boundary unchanged.
- `packages/locomotion` 1.0.0: pure deterministic model (cadence→speed
  with inertia, lean→capped turn, crouch→duck+slow, seated lean-glide,
  keyboard-wins override, tracking-loss autopilot with gentle stop +
  snap-free re-entry, T-pose recenter pulse, soft path-shoulder assist
  behind V4's nav-graph `PathHint` hook — Full Assist default, yields to
  deliberate lean) + transport/keyboard controller + shared coach/status
  strings. COMFORT ENFORCED IN THE MODEL: hard caps on speed (2.4 m/s),
  accel (2.5/3.5 m/s²), yaw rate (45°/s), yaw accel (180°/s²); slew-
  limited eye height; no pitch/roll/FOV/bob code path exists;
  `envelope()` reports observed maxima as evidence. INTEGRATION.md is
  the V4 contract.
- `apps/walking`: the graybox — flat proving ground with an S-curve path
  ribbon (its polyline implements the real `PathHint` contract), pose-
  runtime + shared HUD live mode, deterministic synthetic drivers
  (`?drive=march|sway|glide`, dropout/T-pose windows), mono engineering
  readout + comfort vignette + coach line, WASD/camera-denied play.
  Port 5175, base `/walking/`, own Playwright suite (9 specs).
- Evals: `eval/walking-results.json` (full-chain synthetic eval:
  march×3/sway/glide/dropout/adversarial-comfort, written by
  tests/walking-eval.spec.ts) and gait rows in
  `eval/bodyinput-results.json`.

### Deferred (honest)
- Positive real-clip gait validation awaits the optional clips
  (march_slow/fast, weight_shift, walk_lean_turns) — request + specs in
  FINAL_USER_TEST_PLAN S8.4; synthetic streams + negative rows carry the
  automated case meanwhile.
- The nausea check is human-only by nature → FINAL_USER_TEST_PLAN S8.1
  with the envelope evidence attached.

## V1 — PosePuppet Runtime + HUD (2026-07-11)

PosePuppet becomes a system layer: a headless tracking runtime any game
page initializes directly, a shared HUD overlay, and the Full App
refactored onto the same runtime with zero behavior change. TinySkies
Flight, Rowing, and the standalone Dolphin now run body-controlled with
no PosePuppet tab open.

### Added
- `packages/pose-runtime`: camera ownership + lifecycle states, pose/hand
  detection (optional Web Worker offload — the FULL model costs 30–50 ms
  per detection and must not run on a game's main thread), Predictive
  Pose Continuity at the fork, body-input emission (the adapter absorbed;
  landmarks enter body-input inside the runtime and only there), producer
  election (Web Locks + traffic listen; `?pp=companion` hint from the
  bridge), capture-size + detection-rate budgeting, quantized 2D
  `PreviewFrame` state for the HUD.
- `packages/pose-hud`: compact bottom-left overlay in the frozen visual
  language — wireframe preview tinted by per-limb PPC state, mono
  tracking readout, `LOCAL INFERENCE · NO UPLOADS`, camera-feed swap,
  recenter flash, full keyboard parity (Tab/Enter/Esc/`c`), safe-area
  mount hint, four degradation tiers with auto load-shedding. No settings
  panel.
- Game retrofits (mount points only): flight (lite), rowing (FULL model —
  the lite wrist-depth collapse stands — at 15 Hz in a worker), dolphin
  (lite); HUD safe-areas clear the rowing strip and the dolphin ODbL
  attribution; `?hud=0` and `?dethz=` test escapes.
- Tests: BodySignal deep-scan boundary spec (landmark-free wire, quantized
  preview), single-getUserMedia + producer-lock spec, camera-denied specs
  (`--deny-permission-prompts` — a flagless Playwright launch grants a
  fake camera), per-game HUD specs (mouse AND keyboard interaction,
  denied keyboard play, wire scan, tier forcing).
- `scripts/hud-perf.mjs` (per-game HUD-on/off table → 
  `eval/runtime-hud-perf.json`), `scripts/hud-shots.mjs` (screenshot
  board), probe scripts for detection cost / worker GL / capture size.

### Changed
- Full App boots on `createPoseRuntime` (in-process frame tap; pipeline
  order bit-identical: mirror → eval masker → PPC → {smooth → retarget,
  body-input pre-smoothing}); `src/pose/` moved into the package
  (history-preserving); `src/camera.ts` split (capture → runtime,
  layout → `src/ui/cameraLayout.ts`).
- Game suite ports env-parameterized (`FLIGHT_PORT`/`DOLPHIN_PORT`/
  `PP_PORT`) — hardcoded ports were silently hitting other checkouts'
  servers.
- HUD glass is opacity-faked, not `backdrop-filter` — real blur over a
  live WebGL canvas measured ~4 fps on flight (the pass-2 rule applied).

### Measured (eval/runtime-hud-perf.json, headed :2, RTX 3090 / GL-ANGLE)
- HUD preview draw cost: ≤ 0.1 ms/frame at every tier; HUD on/off fps
  delta within run noise on flight and dolphin.
- Flight ~60 fps @ ~29 Hz pose (lite, worker); Dolphin ~57–60 fps @
  ~29 Hz (lite, worker).
- Rowing (FULL model): main-thread detection 30 fps → worker 43 fps;
  the remainder is GPU-process contention (worker GL verified hardware;
  zero main-thread long tasks). ~41–43 fps @ ~13–14 Hz on this box vs
  the 45/15 floors — final floor validation on Apple Silicon per the
  cross-platform policy; strokes verified traversing the in-page chain
  (14 on rowing_slow.y4m, matching the old producer-tab spec's range).

### Deliberately skipped
- No HUD settings panel, no visual redesign, no full PosePuppet stage in
  games (preview is a 2D wireframe — a VRM preview would ship a second
  three.js + GL context into every game page).
- body-input interface untouched (frozen after merge).

## Predictive Pose Continuity (2026-07-07)

Occlusion handling upgraded from per-bone "hold and decay" to a
principled continuity system at the tracking layer, so puppeteering AND
`@bodyarcade/body-input` (Flight) inherit it. Explicitly NOT
invisible-limb tracking — docs/PPC.md states the limits.

### Added
- **PPC core** (`src/pose/continuity.ts`): per-landmark ring buffers,
  least-squares velocity with a measured trust stack (fit residual,
  deceleration projection, 1.3 m/s speed knee), per-limb
  VISIBLE→PREDICTED→RELAXED state machines (six groups), bone-length
  shell projection, parent-anchored entry-pull with a hard 0.3 m drift
  cap, prediction horizon hard-capped at 400 ms (150 ms torso/head),
  confidence decaying visibly to zero, re-entry blended over 0.8×outage
  (0.1–0.4 s) with a 0.06 m/frame correction cap that persists until
  converged. Deterministic; exact pass-through when fully visible.
- **Masked-fixture eval** (`src/eval/masks.ts`, `eval/run-ppc.mjs` →
  `eval/ppc-results.json`): synthetic occlusion windows over real
  fixtures with same-frame ground truth; publishes PPC error next to
  legacy hold, plus re-entry no-snap, horizon-cap, and NaN checks.
- **body-input `tracking` block** (additive, optional, schema
  v1-compatible): per-limb continuity states flow to games; old signals
  and tapes stay valid.
- **Flight contract test**: autopilot engagement shift on full dropout
  measured legacy-vs-PPC and bounded ≤ +100 ms (measured +67 ms). No
  Flight code touched.
- Engineering view: live per-limb PPC state chips; `?ppc=0` and a panel
  toggle for the legacy path.

### Measured
- Masked landmark error vs hold: −19 % (face-cross), −6.5 % (hand
  exits), parity-in-noise on fast/stride reversals (convergence to hold
  is the design goal there — extrapolating reversals measurably loses).
- Masked puppet sync ≤ legacy on all four specs; fully-visible sync
  within ±0.09° of the pass-2 baseline; performance floors intact.

## Pass 2 — "The Instrument Pass" (2026-06-12)

PosePuppet started as webcam-to-avatar puppeteering. This pass turned it
into a browser puppet instrument.

### Added
- **Design system** (Gate-2 approved): tokenized glass/brutalist theme,
  light + dark, four role-bound accents (blue action / cyan signal /
  violet memory / green-white privacy), grain + vignette on chrome only,
  self-hosted variable fonts (Inter, JetBrains Mono, Fraunces — OFL).
  Signature element: the take bar as an instrument strip with a live
  CAM ▸ POSE ▸ SMOOTH ▸ RIG ▸ RENDER ▸ REC signal chain.
- **Shell**: command bar (mode selector, live privacy receipt, record),
  stage hero with viewfinder ticks, camera panel docked as the input
  signal, right rail (avatar cards, expression + memory sliders, coach),
  ⌘K command palette + single-key shortcuts, engineering view.
- **Privacy receipt**: `LOCAL · 0 EXTERNAL REQUESTS SINCE LOAD`, backed by
  a real PerformanceObserver/beacon/WebSocket counter.
- **Motion core**: occlusion recovery (velocity coast → pull-to-rest →
  joint limits → adaptive ≤0.5 s re-acquisition blend, never snapping);
  face-touch via proximity-magnetized two-bone IK with per-avatar head
  colliders measured from skinned geometry; feet driven from ankle→toe
  landmarks; legs added to the eval sync metric.
- **Expressiveness layer**: exaggeration slider (1.0–2.0, dead-zoned,
  soft-kneed, clamped), speed-coupled overshoot + squash hint, robot
  antenna spring, VRM blinks, idle micro-sway, avatar-switch crossfade,
  performance auto-tuner via the coach.
- **Hand-only mode**: MediaPipe HandLandmarker (21 landmarks), violet
  stage treatment, roster: expressive hand, beaky the talking bird
  (pinch = jaw, auto-ranged), x-ray wireframe self-portrait with trail.
- **Motion Memory**: 12 s ring buffers, named loops in IndexedDB, ghost
  duet, echo chorus (2–4 staggered echoes), instant slow-mo replay from a
  side angle, re-skin any loop onto any character.
- **Recording director**: guided takes as data (Character / Ghost Duet /
  Talking Puppet), hands-free start/stop through the gesture seed layer,
  pre-take framing check, 16:9 + 9:16 vertical composite presets, title
  stinger + privacy end card + badge + grade (all toggleable), pose
  poster export, caption helper.
- **Guidance**: first-run onboarding, visibility-driven low-nag coach,
  capability labels + limitation notes on avatar cards.
- **Roster**: erika (100Avatars R1 #053, CC0) — the finger-capable
  character, screened and license-verified at Gate 4.
- **Verification rig**: pinch→jaw correlation metric, face-touch reach
  check, synthetic-dropout occlusion test, Motion Memory round-trip test,
  gesture intent tests, aspect-preset recording checks, automated
  contrast + reduced-motion checks, eval honesty guards (avatar mismatch
  detection, environment-throttle stamping).

### Fixed (found by tests and the live gate)
- Eval could silently measure the fallback avatar under a VRM's name.
- Chromium composited an opaque camera-feed background y-flipped over the
  WebGL stage.
- VRM finger curls used a per-convention axis that bent fingers backwards
  — axes are now computed from each rig's geometry.
- Face-touch hovered at the chest / pierced the astronaut's helmet — head
  colliders now come from real geometry, contact bias from the person's
  face normal.
- Exaggeration amplified rest jitter and folded arms through the body —
  dead zone + soft knee.
- Avatar crossfade showed the old avatar through the new one.
- Onboarding's Enter keypress could click its own Start button.

### Deliberately skipped
Hologram parallax, two-person duet, audio-reactive light (Gate-1
elective selection); games/scoring/worlds (mission non-negotiable);
woody demoted to a local-only experimental file (not redistributable).

### Still limited
Fast motion lands a beat late; depth is a heuristic; one person; finger
tracking is hand-only-mode-first; robot face-touch reads reach-to-collar.

## Pass 1 (2026-06-10)

Initial release: webcam → MediaPipe pose → procedural robot / CC0 VRM
astronaut retargeting, split-screen stage, calibration, recording, eval
rig with fixtures → y4m fake webcam, screen-space limb sync metric.


## BodyArcade Dolphin (2026-07-11)

Body swimming drives a dolphin through a dreamy low-poly PS2 underwater
world bounded by the REAL shape of San Francisco Bay (OSM coastline
data, ODbL, credited in-app; the world inside is fictional; Ecco is an
inspiration, nothing is copied).

- `packages/world-data`: real-water boundary pipeline (offline fetch →
  simplify → boundary.json with embedded provenance/attribution; two
  source modes — curated relation, coastline-clip with named gates;
  runtime point-in-water + signed-distance surface).
- `@bodyarcade/body-input` v1-additive `swim` block: torso-wave kick
  detection (chest–hip extent through the reused StrokeDetector; lite-
  model-safe — no wrist depth). Synthetic contract tests + false-
  positive checks on all existing fixtures; positive torso-wave fixture
  evals await recordings (FINAL_USER_TEST_PLAN.md).
- `apps/dolphin`: pure fixed-timestep swim sim (impulse-and-glide kicks,
  glide τ 6 s, banked turns, breach ballistics + splash), SDF
  containment current (soft walls — never exits, never hard-walls,
  asserted from 8 directions), assist ladder / autopilot / T-pose
  recenter / full keyboard (WASD + Q/E depth + Shift kick + Space
  burst), PS2 world (vertex-lit seabed from the real SDF, boid fish
  that flee, shader kelp, drowned ruins, caustic shafts, motes,
  shimmer-curtain boundary), minimap = the actual bay polygon,
  mono HUD + plain-verb coach.
- PosePuppet: Swim card + ⌘K "swim" (companion mode, lite tracker);
  `/dolphin/` served same-origin for the BroadcastChannel transport.
- Skipped deliberately: 4:3 letterbox toggle, ambient audio (both
  optional); full-bay decor streaming (spawn-reach disc + fog, logged
  in FUTURES.md). Human-only checks: FINAL_USER_TEST_PLAN.md § Dolphin.
