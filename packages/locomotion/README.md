# @bodyarcade/locomotion

Walking locomotion for the Open World: BodySignal gait in, comfortable
first-person ground movement out. Built by V3 (Walking Locomotion),
proven in the `apps/walking` graybox, integrated by V4.

- **Model** (`createLocomotion`): pure, deterministic state machine.
  Cadence→speed with inertia, lean→capped yaw rate, crouch→duck+slow,
  seated lean-glide, keyboard override, tracking-loss autopilot (gentle
  stop, held heading, snap-free re-entry), T-pose recenter pulse, soft
  path-shoulder assist via a nav-graph `PathHint` callback.
- **Comfort enforced inside the model**: hard caps on speed,
  acceleration, yaw rate, yaw acceleration; slew-limited eye height (duck
  exists, bob does not — there is no oscillating code path); no pitch/
  roll/FOV output at all; optional comfort-vignette intensity for the
  host to render. `envelope()` reports observed maxima as evidence.
- **Controller** (`createWalkController`): the proven consumer
  discipline — BodySignal transports (deduped), WASD/arrow keyboard that
  always wins while touched, staleness/confidence gating, `inject()` for
  tests and replays.
- **Coach** (`WALK_STATUS`, `WALK_COACH`, `coachLine`): shared status
  words and instrument-language guidance so every profile speaks the
  same way.

Tests: `tests/locomotion.spec.ts` (model laws incl. an adversarial
comfort-envelope property test) and `tests/walking-eval.spec.ts` (full
chain landmarks→gait→intent→pose; writes `eval/walking-results.json`).
Closed-loop browser proof: `apps/walking/tests`.

See `INTEGRATION.md` for the V4 contract (API, nav-graph hook, comfort
parameters, coach copy, known limitations).
