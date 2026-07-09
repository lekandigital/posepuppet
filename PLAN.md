# PLAN.md — BodyArcade Rowing

Status: **P0 complete — awaiting USER GATE 1** (build-vs-adapt decision +
plan approval + rowing fixtures). Branch `bodyarcade-rowing-fable`,
renamed from the unused placeholder `bodyarcade-water-worlds-fable` at
main `940d31c` (Flight + Predictive Pose Continuity both accepted and
merged; no preservation branch touched). Previous passes' plans (PPC,
Flight, Instrument Pass) live in git history at this path.

## P0 — what the code actually says

**The boat is real, tuned, and already half-wired for body input.**
`apps/flight/client/src/game/Boat.ts` is a complete player vehicle:
accel/brake/coast physics (`COAST_DECAY = 0.07/s` — slow glide is
already the resting behavior), smoothed turn input (same
`TURN_INPUT_SMOOTH = 8/s` idiom as the plane), ocean spawn via
`isMainOcean`, land-collision gating, bob animation, `speedBoost()`,
upgrade multipliers. It has a `WakeTrail`, per-vehicle camera tuning
(`shared/vehicleCapabilities.ts`: tilt 0.28, height 0.95, FOV boost 10),
NPC boat fleets, ocean audio, and the fishing minigame. `Boat.update(dt,
turnRate, forward, brake, …)` has the same shape as `Plane.update`.

**Body input already reaches the boat — for steering only.** Game.tick
merges `BodyFlightControls` output into the shared `ControlState` and
calls `this.localPlayer.update(...)` regardless of vehicle
(Game.ts:3488–3576). So body lean can steer the boat today; but the
continuous `speedAxis`/`elevateAxis` are consumed only by `Plane`
(`localPlayer.analog`, Game.ts:3555). Rowing is exactly the missing
propulsion path — a new input mapping onto an existing vehicle, which is
what FUTURES.md predicted and what Flight itself was.

**Landmarks never cross the transport — so stroke detection must run
producer-side, in the package.** `BodySignal` is a closed-key schema of
derived axes (`packages/body-input/src/schema.ts` enforces exact shape
and scans for landmark-shaped payloads). The consumer (flight app) never
sees wrists. Therefore `strokeRate/strokePhase/strokeAmplitude` cannot
be computed in the game; they are new derived fields computed in
`@bodyarcade/body-input` where the landmarks live. The schema already
has the additive-optional pattern for this (the PPC `tracking` block):
an optional top-level key keeps `v: 1`, old tapes stay valid, the
canonical serializer gains a fixed-order tail. That is the "v1.x"
mechanism.

**The extraction layer already measures what strokes need.**
`extract.ts` computes per-arm `wristLocal` (wrist relative to shoulder
center, in the torso basis) with the fore-aft component along `vz` — the
same measured quantity behind `handsForward`, which was reliable enough
for Flight's boost gesture. Stroke axis = oscillation of `wristLocal.z`
per arm. The pipeline is a pure state machine over frame timestamps
(replay-deterministic by construction), and the `AxisShaper`/One-Euro/
hysteresis idioms to build on are all in place.

**The globe has no rivers.** Terrain is a continuous land/ocean field
(`SimplexNoise.ts`) with an "ocean backbone" mask guaranteeing one
connected main ocean, plus smaller disconnected water components. There
is no waterway graph, no centerline, nothing river-shaped. This forces a
deviation from the prompt's "river run" language — see Deviations.

**Fixture/eval rig** — mp4 → y4m via `scripts/prepare-fixtures.mjs`
(720p/30 for Chrome's fake webcam), per-clip BodySignal assertions in
`packages/body-input/tools/fixture-eval.mjs` (episode-structural, no
hardcoded timestamps) → `eval/bodyinput-results.json`, closed-loop
headed Playwright specs in `apps/flight/tests/` (headless WebGL gets
compositor-throttled; project convention is documented there). Flight
fixtures are portrait 1080×1920@30, 40–80 s. Rowing fixtures do not
exist yet — **USER ACTION below.**

**Baseline**: PosePuppet root suite green at P0 (92 passed, 5 skipped);
Flight suite result recorded in the Gate-1 commit message. Perf floors
for rowing = Flight's existing floors (`eval/flight-perf.json`: 60 fps
render / floor 45, pose ≥ 15 Hz).

## Gate-1 decision material

### Build vs adapt: ADAPT the TinySkies boat

The Track-F fork revealed a real, fully-tuned boat (FUTURES.md called
this the load-bearing discovery). Building a fresh boat would duplicate
spherical math, camera, wake, audio, land collision, and would need its
own feel pass. Adapting means rowing inherits a boat that already feels
right under keyboard, and the work concentrates where the prompt wants
it: stroke detection and the impulse-glide connection. Permission
covers it. **Recommendation: adapt.**

### Where rowing lives: `apps/flight` gains a boat body-mode (no `apps/rowing`)

Everything rowing needs — globe, water, boat, camera, effects, HUD,
tuner, same-origin `/flight/` topology, the body-input merge point, the
eval handle — lives in apps/flight. A separate app would either fork the
30k-line client or import across app boundaries; both are worse than the
Flight precedent: one game, vehicles as modes, per-vehicle body
profiles. The lobby already treats vehicles as a roster.
**Recommendation: apps/flight.**

## Design

### P1 — stroke detection in `@bodyarcade/body-input` (v1.x additive)

New `StrokeDetector` in the package (`src/stroke.ts`), fed from the
existing per-arm measures inside the pipeline:

- **Signal**: per-arm wrist fore-aft position in the torso basis
  (`wristLocal.z / armLen`, the handsForward substrate), One-Euro
  smoothed; differentiate to velocity on frame timestamps.
- **Detection**: zero-crossings of smoothed fore-aft wrist velocity with
  hysteresis (velocity must exceed a floor derived from still.mp4's
  measured jitter, same discipline as the flight dead zones) and a
  minimum half-period (rejects tremor; the implied max detectable rate
  is far above any sane rowing cadence).
- **Phase state machine**: catch (front reversal) → drive (pull back) →
  recovery (return forward). `strokePhase` ∈ [0,1) continuous within the
  cycle; a stroke event fires once per drive.
- **Outputs** (schema-additive optional `stroke` block, `v` stays 1):
  `rate` (Hz, EMA over recent periods, decays to 0 when strokes stop),
  `phase` (0..1), `ampL`/`ampR` (0..1, per-arm normalized stroke
  amplitude over the last cycle), `active` (rhythmic motion currently
  detected). Quantized like everything else; canonical JSON extended
  with a fixed-order tail; `assertSignalShape` validates the block when
  present. Old tapes and consumers unaffected.
- **Seated**: the torso basis and wrist measures are all
  shoulder-relative — seated rowing is arm-dominant and needs no special
  casing; the seated fixture verifies rather than assumes.
- **Dolphin reuse**: the detector is a generic periodic-limb-oscillation
  primitive parameterized by axis (fore-aft here; vertical later). It
  ships in the package, not the game.

Fixture eval extends the package tool: stroke count ±1 vs known truth
per clip, rate slow < fast, left-bias amplitude asymmetry with the
documented sign, still => `active` never true, zero strokes.

### P2 — boat feel: impulse-and-glide + assists

- **`RowingControls`** (`apps/flight/client/src/input/rowControls.ts`),
  sibling of `BodyFlightControls`, sharing its transport/staleness/
  keyboard-priority machinery (extract the common core rather than
  copy). Consumes the `stroke` block; emits per-tick rowing intent.
- **Propulsion**: each detected stroke (drive phase) applies an impulse
  scaled by mean amplitude; between strokes the boat's existing
  `COAST_DECAY` does the gliding. Implemented as an additive path on
  Boat (an `impulse()`/analog-style hook, the same pattern `Plane.analog`
  used) — **zero changes to the keyboard constants or upstream feel.**
  A short attack envelope makes the per-stroke surge visible: the boat
  visibly lunges on each drive. That surge read is the demo.
- **Steering, both profiles as data** (`ROW_PROFILES`, same shape as
  `BODY_PROFILES`): `row-asym` — turnRate from (ampL − ampR); `row-lean`
  — turnRate from leanX. Pick the default at Gate 2. Flight's
  boost/action gestures are **disabled in rowing profiles** (hands
  thrust forward every stroke — they would constantly misfire the
  fishing action / boost).
- **Assist ladder** (same `ASSIST_LEVELS` pattern): Full Assist softly
  steers toward the course centerline (see Waterway seam) and holds a
  gentle speed floor while strokes continue; Standard/Expert relax caps.
- **Cruise**: after N steady strokes (rate variance under threshold),
  cruise latches — momentum holds near the recent average so the user
  can rest; resumes manual on the next stroke or posture change.
  Fatigue is a design constraint: target effort is conversational
  motion (hands travel ~30 cm), not gym form.
- **Autopilot on tracking loss**: reuse Flight's decay pattern — thrust
  intent decays, boat drifts straight and slows; slew-bounded blend on
  re-entry (never snaps). T-pose recenter: already a package event,
  reused as-is.
- **Keyboard fallback**: upstream boat keys keep working exactly as
  upstream (W hold = accelerate, S brake, A/D turn), with Flight's
  keyboard-priority rule (keys win for 1.5 s). See Deviations.
- **Entry**: a direct-entry URL param (`?vehicle=boat` / `?row`) that
  starts the boat for rowing/demo/eval (progression untouched otherwise
  — the boat's normal unlock celebration stays), plus a minimal "Row"
  card in PosePuppet next to "Fly" reusing `openFlight()` with the row
  URL. Tuner ("b") gains a stroke readout row (rate/phase/ampL/ampR/
  cruise state).

>> **USER GATE 2** — live row: both steering profiles, seated, a
2-minute run; Lekan judges rhythm, connection, fatigue. Iterate.
(Gate-approved Flight feel is frozen; nothing in P2 touches plane
controls or gains.)

### P3 — polish + ship

Coach messages via the existing toast/HUD surface ("Bigger strokes read
better", "Sit back to rest — momentum will hold"), README rowing
section, EVAL_NOTES, FUTURES.md waterway-data seam notes, DECISIONS.md.

### The waterway seam (design only — no open-data work)

Interface in apps/flight: `Waterway` — `sample(posQ): { onWater:
boolean, centerlineHeading: number, crossTrack: number }`. v1
implementation is procedural from the existing globe: a generated
open-water course (waypoints sampled on `isMainOcean` cells, smoothed
into a loop that hugs the coast where possible). Full Assist and the
closed-loop eval consume only the interface, so the future open-data
pipeline swaps in real waterway geometry without touching rowing logic.
Documented in FUTURES.md at P3.

## Deviations from the prompt (and why)

1. **"Rivers/lakes" → open-water course.** The globe has no rivers —
   terrain is a land/ocean field with a connected main ocean and
   incidental lakes. Building procedural rivers would mean reworking
   accepted Globe terrain (risk + perf) for geometry the open-data
   pipeline will replace anyway. Instead: the 2-minute run is a coastal/
   open-water course behind the `Waterway` seam; "stays on the waterway"
   = stays on water and within a cross-track band of the course.
2. **Keyboard fallback keeps upstream semantics.** The prompt sketches
   "W hold = stroke"; upstream boat W is hold-to-accelerate, and
   Flight's accepted, non-negotiable rule is keyboard identical to
   upstream. W hold already delivers the fallback's purpose (propel the
   boat without a body); re-mapping it to synthetic strokes would change
   accepted feel for no capability gain.
3. **Stroke fields stay schema v1 (additive optional block), not a v2
   bump.** FUTURES.md sketched "v2"; the PPC `tracking` block
   established the additive-optional pattern that keeps every existing
   consumer and recorded tape valid. Same measured-floor discipline,
   no version churn.

## Verification

- **Fixture evals** (package tool → `eval/bodyinput-results.json` or a
  rowing sibling): stroke count within ±1 of known truth per clip; rate
  ordering slow < fast (values stated); left-bias clip: ampL − ampR
  positive and stable; still.mp4: zero strokes, `active` false
  throughout; seated clip: detection parity with standing.
- **Closed-loop** (`apps/flight/tests/row.spec.ts`, headed like the
  rest): fixture-driven 2-minute run stays on water / in the cross-track
  band under Full Assist; speed correlates with stroke rate (Pearson r
  stated in eval output); injected dropout → drift straight + slow, no
  snap on recovery; replay determinism — recorded signal tape (with
  stroke block) replays byte-identically through the package per the
  canonical-JSON check.
- **Perf**: Flight's floors (60/45 fps, pose ≥ 15 Hz) re-measured with
  rowing active.
- **Suites**: PosePuppet root + Flight suites stay green at every
  commit.

## Fixtures — USER ACTION (exact recording specs)

Same setup as the flight fixtures: **portrait 1080×1920 @ 30 fps**,
camera at chest height ~2.5–3 m back, full torso + arms in frame
through full stroke extension (hands never leave frame at full reach),
front lighting, plain background if possible. Start each clip with ~3 s
standing/sitting still (neutral capture), end with ~2 s still. Drop the
files in `fixtures/rowing/` as `.mp4`; `npm run prepare-fixtures`
converts them.

The stroke motion: both hands reach forward toward the camera at chest
height, then pull back to the ribs — a relaxed sculling motion, elbows
soft. Amplitude target ~30 cm of hand travel; this should feel like a
gesture, not a workout.

| clip | posture | content | true count |
|---|---|---|---|
| `rowing_slow.mp4` (~60 s) | standing | exactly **12 strokes** at a relaxed ~18–20 strokes/min, symmetric | 12 |
| `rowing_fast.mp4` (~45 s) | standing | exactly **24 strokes** at ~35–40 strokes/min, symmetric | 24 |
| `rowing_left_bias.mp4` (~45 s) | standing | exactly **15 strokes**, left arm full range, right arm ~half range | 15 |
| `rowing_seated.mp4` (~60 s) | seated on a chair | exactly **15 strokes** at ~20–25 strokes/min, symmetric | 15 |
| still | — | **reuse** `fixtures/flight/still.mp4` | 0 |

Counting the strokes while recording is the hand-labeled truth the
±1 eval checks against — if a take ends up with a different count,
just tell me the actual number instead of re-recording.

**As delivered (2026-07-08):** all four clips usable at 1080×1920@30;
durations shorter than spec'd (41.3/33.4/47.7/25.6 s) and the takes
start/end mid-motion (no still lead-in/tail) — the eval therefore runs
rowing clips as a single non-looped video pass rather than through the
looping fake webcam (a loop seam that cuts mid-stroke swallows or
fabricates strokes). rowing_seated measured at 13 completed pulls (raw
wrist trace + frame review show a ~2.5 s mid-take pause and a
mid-stroke start); prescribed 15 — measured label used, flagged for
Lekan's confirmation at Gate 2.

## Effort estimates

- P1 stroke detection + schema + fixture eval: ~1 day.
- P2 boat propulsion/steering/assists/cruise/autopilot/entry/tuner:
  ~1.5 days to Gate 2, plus iteration from the live gate.
- P3 polish/docs/seam notes: ~0.5 day.

## Risks

- **Depth noise on the fore-aft stroke axis** — MediaPipe z is the
  noisiest coordinate. Mitigations: One-Euro + velocity-floor hysteresis
  + min half-period; the handsForward axis proved z workable in Flight.
  If fixtures show it's still marginal, fall back to a hybrid axis
  (fore-aft + vertical wrist arc, which real rowing has anyway). This is
  exactly what the fixture gate is for.
- **Gesture collisions**: every stroke passes through "hands forward" —
  Flight's boost/action triggers are disabled in rowing profiles from
  the start.
- **Fatigue**: 2 minutes at 24 SPM must stay conversational — cruise
  mode, modest amplitude normalization, and "sit back to rest" coaching
  are load-bearing, not polish.
- **Boat unlock progression**: direct-entry param must not corrupt the
  saved progression state (entry bypasses selection, not unlocks).
