# PLAN — V3 Walking Locomotion (feat/walking-locomotion)

Gait detection + comfortable ground movement as a reusable package,
proven in a graybox, handed to V4. No town, no apps/openworld.

## Reading of the starting points (audit, 2026-07-12)

- **Rowing's periodic detector** (`packages/body-input/src/stroke.ts`) is a
  position Schmitt trigger on a filtered scalar — reversal on `hys` retreat
  from the running extremum, physiological gates on amplitude/timing, rate
  from an EMA of periods, decay on staleness. That exact pattern carries to
  gait; the differences are (a) gait counts a step at EVERY reversal (each
  footfall), not once per cycle, and (b) the measured scalar switches source
  with framing.
- **The swim detector's lesson** (defaults.ts): the load-bearing negatives
  are slow alternating leans — false rhythm lives at 0.1–0.35 Hz, real
  cadence at 0.7–3 Hz. Tight `maxStepMs` + amplitude floors measured
  against existing fixtures separate them.
- **PPC exists**: at desk framing, knees/ankles vanish and legs ease to
  rest. Gait therefore needs a kneeless substrate — lateral hip sway
  (weight shift) in image space, self-referenced like swim's extent EMA.
- **Consumer discipline** (`apps/dolphin/src/input/swimControls.ts`):
  BodySignal only, two transports deduped by ts, staleness/confidence
  gates, keyboard-wins-while-touched, autopilot decay + slew-bounded
  re-entry. The locomotion controller reuses this discipline.
- **App template** (`apps/dolphin`): standalone Vite app, base path,
  pose-assets middleware, own playwright.config, runtime + HUD in-page.
  The graybox copies this shape at port 5175, base `/walking/`.

## Architecture

### O1 — gait in body-input (v1.x additive)

New measured substrates in `extract.ts` (additive fields on `Measure`):
- `kneeDiff`: signed vertical knee-lift difference between legs in
  thigh-length units, user-side signed (+ = user's LEFT knee high = weight
  on their right). Landmarks are mirrored → LM.left* is the user's right.
  Available when knees+hips visible.
- `hipSwayNorm`: image-space hip-center x in shoulder-width units
  (+ = user's right). DC removed in the pipeline by a slow EMA reference
  (swim's self-normalization pattern). Available whenever hips are in
  frame — the desk-framing / weight-shift substrate.

New `gait.ts`: one `GaitDetector` with two parameter banks (`march` on
kneeDiff, `sway` on hipSway). ONE combined signal per frame — march when
knee data is fresh, else sway; on source switch the extremum state
rebases (counters and cadence survive, no fake reversal). Every
hysteresis-qualified reversal with sane amplitude/timing = one step.
Cadence Hz = 1000/stepIntervalEMA; decays on staleness. Hysteresis at
both gates (Schmitt width + per-source amp floors).

Schema v1 additive block (`gait`), same contract as stroke/swim:
`{ active, count, cadence, phase, amp, shift, source }` — `shift` is the
weight-shift axis (−1..1, + = user's right), `source` ∈
`legs|sway|none`. Canonical JSON order: after `swim`. assertSignalShape,
fixture-eval shape guard, and canonical serializer extended; old tapes
and consumers stay valid (all keys optional-additive).

### O2 — packages/locomotion (new)

Pure TS, three-free, deterministic (frame timestamps only — replays
byte-identically). Two layers:

- `LocomotionModel` — pure state machine. `step(tsMs, intent)` →
  `{ pos, yawDeg, speed, yawRate, eyeY, vignette, mode, stepPulse }`.
  Cadence→speed (stride gain, inertia via accel cap); lean→yaw rate
  (capped, smooth); crouch→slow+duck (eye height slewed, never bobbed);
  seated→lean-glide (accessibility fallback); keyboard intent overrides
  while touched; autopilot on loss (gentle decel to stop, heading held,
  slew-bounded re-entry); T-pose recenter hook; soft path-shoulder
  steering hook (`PathHint` callback — V4's nav graph plugs in here;
  Full Assist default, yields to deliberate lean — the rowing coxswain
  lesson).
- `createWalkController` — binds BodySignal transports + keyboard to the
  model (swimControls discipline).

COMFORT IS ENFORCED IN THE MODEL, not the consumer: hard caps on speed,
acceleration, yaw rate, yaw acceleration; stable eye height (slew-limited,
no oscillating term anywhere — no head-bob code path exists); FOV is not
locomotion's to touch (the model exposes no FOV, the graybox asserts a
constant projection); optional comfort vignette exposed as a 0..1
intensity the host renders. The envelope caps are exported constants a
test asserts against recorded traces.

### O3 — graybox (apps/walking)

Flat ground + grid, an S-curve path ribbon with shoulder, marker pylons,
fog, horizon. First-person camera from the model (no bob). Runtime + HUD
mounted like Dolphin (lite model, worker, election strict). Mono readout
(cadence/speed/yaw-rate/source/mode), coach line, vignette overlay,
recenter toast. `?drive=` deterministic synthetic drivers (march/sway/
glide/dropout scenarios) for closed-loop tests and recordings; WASD
keyboard; camera-denied playable.

### O4 — handoff

`packages/locomotion/INTEGRATION.md`: API, nav-graph hook contract,
comfort parameters (names, defaults, envelope caps), HUD/coach strings,
what V4 must NOT do (re-derive locomotion per profile).

## File ownership (V3 writes only these)

- `packages/body-input/src/{gait.ts,extract.ts,pipeline.ts,types.ts,schema.ts,defaults.ts,index.ts}` (additive edits) + `tools/fixture-eval.mjs` (gait negative rows) + `README.md`, `CHANGELOG.md`, `package.json` (version)
- `packages/locomotion/**` (new)
- `apps/walking/**` (new; own vite + playwright configs, port 5175)
- `tests/gait.spec.ts`, `tests/locomotion.spec.ts` (new root spec files; no
  edits to existing specs or playwright.config.ts)
- `eval/walking-results.json` (synthetic gait/comfort eval artifact) via
  `packages/locomotion/tools/walking-eval.mjs`
- Docs: `PLAN.md` (this), `DECISIONS.md`, `EVAL_NOTES.md`, `STATUS.md`,
  `FINAL_USER_TEST_PLAN.md` (S8), `CHANGELOG.md` (append-only sections)

NOT touched: `apps/openworld` (doesn't exist yet — V4's), `apps/flight`,
`apps/dolphin`, `packages/pose-runtime`, `packages/pose-hud`,
`packages/world-data`, app `src/`, root configs.

## Verification map

| Check | Where |
|---|---|
| Known cadence in → step count ±1, cadence ≤10% err (march + sway, 3 rates) | tests/gait.spec.ts |
| Hysteresis: jitter/still/lean cycles/crouch → 0 steps | tests/gait.spec.ts + fixture-eval negatives |
| Replay determinism incl. gait block (byte-identical) | tests/gait.spec.ts |
| Schema: shape assert, canonical order, old-consumer validity | tests/gait.spec.ts |
| Cadence→speed tracks; inertia; crouch/glide/keyboard/recenter | tests/locomotion.spec.ts |
| Comfort envelopes: adversarial inputs never exceed yaw-rate/accel caps | tests/locomotion.spec.ts (property-style) |
| Dropout → gentle stop (decel ≤ cap, heading held); re-entry no snap | tests/locomotion.spec.ts + graybox closed loop |
| Closed loop: synthetic march follows the path ribbon, bounded lateral dev | apps/walking/tests |
| Camera denied → WASD playable; HUD mounts; FOV constant | apps/walking/tests |
| Numbers artifact | eval/walking-results.json + suite logs |
| Real gait clips (march_slow/fast, weight_shift, walk_lean_turns) | DEFERRED — requested in FINAL_USER_TEST_PLAN S8 (optional per prompt) |

## Risks

- Sway false positives from rhythmic lean-turns (lean_lr-shaped motion):
  mitigated by tight maxStepMs + amp floor measured against fixtures;
  fixture-eval negative rows are the arbiter.
- March/sway crosstalk double-count: killed structurally (one signal, one
  detector, source-switch rebase).
- 5175 squat (V1 lost 5174): checked before serving; fallback 5185 —
  logged in DECISIONS.md if taken.
