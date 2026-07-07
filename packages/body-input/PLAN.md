# @bodyarcade/body-input — design doc + schema v1 RFC

Status: **COMPLETE — schema gate approved 2026-07-06; P1–P3 shipped
2026-07-07; fixture evals ALL GREEN (eval/bodyinput-results.json).**
Deviations from this RFC are logged in the repo DECISIONS.md (runner
convention, rest-relative arm axes, seated classifier cues, defaults.ts
instead of shaping.json).
Date: 2026-07-06

This package converts PosePuppet tracking into derived control signals
that every BodyArcade mode consumes. Tracking stays in PosePuppet; games
see only this protocol. Raw landmarks never leave the package boundary.

---

## 1. Reading of the existing code (what gets reused)

| Existing piece | Where | Role in body-input |
|---|---|---|
| Pose stream | `src/pose/detector.ts` → `PoseFrame { norm, world, videoTimeMs, wallTimeMs }` | The adapter feeds these frames into the package. 33 BlazePose landmarks, already mirrored + smoothed by PosePuppet before retargeting; the package taps the stream **pre-smoothing** and runs its own filter bank so signal shaping is self-contained and deterministic. |
| One Euro filter | `src/pose/oneEuro.ts` | Ported (44 lines, ours) into the package rather than imported, so the package has zero dependencies on PosePuppet source. PosePuppet keeps its copy; the package's copy is the protocol's. |
| Torso basis | `src/pose/bodyFrame.ts` | Same math, ported: orthonormal shoulder/hip basis with the shoulders-only degradation. Lean/turn extraction happens in this basis so torso turns don't corrupt axes. |
| Gesture seed | `src/gesture/intent.ts` | The dwell / refire / stillness-window patterns are the template for the event pipeline (threshold + hysteresis + debounce). The seed keeps its one consumer (hands-free takes); body-input is a **separate, richer layer**, not a second consumer of the seed. |
| Calibration idea | `src/rig/retarget.ts` `calibrate()` | Concept reused, state separate: body-input captures its own neutral snapshot (stature, shoulder width, torso quat, wrist rests) — it must not couple to avatar-rig corrections. |
| Eval rig | `eval/run.mjs`, `src/eval/runner.ts`, y4m fake webcam | Extended: a `?bodyinput=<fixture>` collector page publishes signal-stream results the node runner writes into `eval/results.json`, same pattern as pass 1/2. |

No `BroadcastChannel` exists in the codebase yet; the cross-page transport
is new.

## 2. Fixture inventory (measured, not assumed)

All 30 fps, verified frame-by-eye at 5 s and 20 s; all correctly oriented
(no rotation metadata), person fully visible head-to-feet except where
noted. Portrait clips are 1080×1920 (9:16).

| Fixture | Size | Duration | Framing notes |
|---|---|---|---|
| `lean_lr.mp4` | 1080×1920 | 42.7 s | Standing, full body, lateral leans |
| `lean_fb.mp4` | 1080×1920 | 63.8 s | Standing, full body, fore/aft leans |
| `crouch_stand.mp4` | 1080×1920 | 47.1 s | Full body, deep crouches visible |
| `arms_tpose.mp4` | **1280×720 landscape** | 44.7 s | Cropped below the knee — arms fully in frame at T-pose; the one upper-body-ish clip |
| `seated.mp4` | 1080×1920 | 82.3 s | Seated on a bench, full body incl. feet |
| `still.mp4` | 1080×1920 | 22.8 s | Standing still — the noise-floor clip |

`scripts/prepare-fixtures.mjs` only scans `fixtures/` top-level; it gets a
small extension to also convert `fixtures/flight/*.mp4` (portrait clips
become ~406×720 y4m — fine for the fake webcam). `fixtures/` is already
fully gitignored; nothing new needs ignoring.

**Eval windows are not hardcoded timestamps.** Assertions are episode-
structural (see §9): "≥ 2 sustained signed episodes per direction" etc.,
so re-recorded fixtures don't silently invalidate magic numbers.

## 3. Schema v1

```ts
/** One emitted message. This is the ONLY thing that crosses the boundary. */
interface BodySignal {
  v: 1;                       // schema major version, literal
  ts: number;                 // ms, monotonically increasing, derived ONLY
                              // from input-frame timestamps (never Date.now)
  confidence: number;         // 0..1 — overall tracking confidence; decays
                              // on loss (§7), recovers smoothly
  seated: boolean;            // auto-detected (§5), hysteresis-guarded
  stillness: number;          // 0..1 — 1 = holding still (windowed motion
                              // energy of shoulders+wrists+hips, inverted)
  neutralConfidence: number;  // 0..1 — how trustworthy the captured neutral
                              // still is (1 right after recenter; drops on
                              // posture-regime change, e.g. seated flip)
  axes: {
    leanX: number;         // -1..1  + = user leans toward THEIR right
    leanY: number;         // -1..1  + = lean forward (toward camera)
    crouch: number;        //  0..1  0 = neutral stature, 1 = deep crouch
    tallness: number;      //  0..1  0 = neutral, 1 = full upward stretch
                           //        (tiptoe/reach — small physical range,
                           //        higher gain; crouch & tallness are
                           //        deliberately two one-sided axes)
    armsOut: number;       //  0..1  mean lateral wrist extension / arm
                           //        length (T-pose ≈ 1)
    armsRaised: number;    //  0..1  mean wrist elevation above shoulder
                           //        line, normalized by arm length
    handsForward: number;  //  0..1  mean wrist extension toward camera
                           //        along -bodyZ, normalized by arm length
    handPoint: number;     //  0..1  asymmetric single-arm extension:
                           //        clamp(maxArmExt − minArmExt); ≈0 in
                           //        T-pose, high when one arm points
  };
  events: BodyEvent[];     // events fired ON THIS FRAME (usually empty)
}

type BodyEvent = 'recenter' | 'action';   // closed set in v1
```

Field semantics, precisely:

- **Sign convention.** Landmarks arrive mirrored (mirror-view: the user's
  right hand appears on screen right). `leanX = +1` means the user leans
  toward their own right. `leanY = +1` is toward the camera. Documented in
  the README with a diagram; the tuner shows live signs so a consumer can
  sanity-check in seconds.
- **All axes are calibration-relative**: measured against the captured
  neutral (stature, shoulder width for scale normalization, torso quat,
  wrist rest positions). Before the first neutral exists, a provisional
  neutral is auto-captured from the first ~1 s of confident, still frames
  and `neutralConfidence` is capped at 0.5 until an explicit `recenter`.
- **`crouch` / `tallness`**: stature = vertical distance shoulder-center →
  ankle-center when legs visible, with a shoulder-height-only fallback
  (upper-body framing) normalized by shoulder width. `crouch` maps neutral
  → deep-knee-bend onto 0..1; `tallness` maps neutral → full stretch onto
  0..1. When seated, both are referenced to the seated neutral.
- **`events` fire on state transitions only** (never level-triggered), so
  replay produces the identical event frames.
  - `recenter`: T-pose held — `armsOut > 0.80`, `armsRaised < 0.35`,
    sustained ~1.0 s, refractory 2.5 s. Firing it also recaptures the
    neutral internally (that is its point) and sets `neutralConfidence = 1`.
  - `action`: both-hands forward thrust — `handsForward` crossing high
    with positive rate (impulse detector), hysteresis + refractory so a
    held-forward posture fires exactly once.

## 4. Package shape

```
packages/body-input/
  package.json          # @bodyarcade/body-input, version 1.0.0
  README.md             # schema, stage docs, transports, versioning policy
  CHANGELOG.md
  PLAN.md               # this file
  src/
    schema.ts           # BodySignal types + JSON canonicalizer + shape guard
    extract.ts          # landmarks -> raw axis/flag values (pure)
    stages.ts           # oneEuro | deadZone | expo | slew  (composable)
    events.ts           # threshold + hysteresis + N-frame debounce machines
    pipeline.ts         # createBodyInput(config): frame-in -> signal-out core
    neutral.ts          # neutral capture/restore, neutralConfidence
    seated.ts           # seated detector (hysteresis state machine)
    transport.ts        # in-page + BroadcastChannel behind one interface
    tape.ts             # recorder/replayer (input tapes + signal tapes)
    tuner.ts            # mountable tuner overlay (DOM, mono design language)
    oneEuro.ts          # ported filter
    bodyBasis.ts        # ported torso basis (three-free: plain vec math, so
                        # the package has no three.js dependency and is
                        # immune to consumer three-version skew)
  tools/
    jitter-floor.mjs    # runs still.mp4 through the rig, emits defaults
  defaults/
    shaping.json        # per-axis dead zone/expo/slew defaults + provenance
  test/                 # vitest-free: plain node:test unit tests (pure core)
```

Integration into the repo: **no npm-workspace conversion this pass** — a
`vite`/`tsconfig` path alias maps `@bodyarcade/body-input` →
`packages/body-input/src`. Zero risk to the install layout and the green
suite; the directory is a real package (own package.json/README) so
extracting it to a true workspace later is mechanical. Logged in
DECISIONS.md.

Input boundary type (what PosePuppet's adapter feeds in):

```ts
interface BodyInputFrame {
  tsMs: number;                      // videoTimeMs (fixtures) or wallTimeMs (live)
  world: LandmarkPoint[] | null;     // null = dropout frame
  norm: LandmarkPoint[] | null;
}
```

Landmarks flow **in**; only `BodySignal` flows **out**. A schema-shape
guard test walks every emitted message and fails on: any array of length
33, any `visibility`/`landmark`/`x|y|z`-triplet key, any key outside the
schema whitelist.

## 5. Extraction (calibration-relative, in the torso basis)

- `leanX`: roll of the torso up-vector (shoulder-center relative to
  hip-center, camera plane) vs the neutral torso quat, normalized by a max
  lean angle (default 15°, tunable). Shoulders-only fallback: shoulder-line
  tilt. Works seated (HEAD PILOT needs exactly this).
- `leanY`: torso pitch from fore/aft displacement (world z) of the
  shoulder center vs hips, same normalization scheme (default 12°).
- `armsOut / armsRaised / handsForward`: wrist positions relative to the
  shoulder line in the torso basis, normalized by calibrated arm length
  (shoulder→wrist at recenter T-pose; before any T-pose, estimated as
  2.2 × shoulder width).
- **Seated detection**: thigh orientation — both hip→knee vectors within
  ~35° of horizontal (knees visible), OR hips confidently visible while
  ankles are not AND stature is < 75 % of standing neutral. Enter after
  1.5 s sustained, exit after 1.5 s sustained (hysteresis both ways). A
  seated flip drops `neutralConfidence` to 0.3 until the next recenter —
  the consumer's coach can prompt.
- All extraction functions are pure: `(frame, neutralState, prevState) →
  rawValues`. No hidden time sources; `dt` comes from input timestamps.

## 6. Per-axis pipeline

```
raw → OneEuro(minCutoff, beta) → deadZone(width) → expo(k) → slew(maxPerSec) → clamp
```

Each stage is a small pure-state module `(value, tsMs, state) → (value,
state')`; a per-axis config object composes them. Defaults live in
`defaults/shaping.json`; dead-zone widths come from the measured
`still.mp4` noise floor (§8) — committed with provenance (fixture name,
date, p95 numbers), reproducible via the jitter tool.

Per-event pipeline: `threshold(enter, exit) → debounce(N frames) →
refractory(ms)` — the hysteresis pair prevents flutter, the debounce
requires N consecutive qualifying frames, the refractory blocks repeats.

## 7. Confidence decay & recovery (no NaNs, no snaps)

On dropout (null frames or key-landmark visibility below gate):

- `confidence` decays exponentially with τ = 300 ms (documented curve;
  the failure-mode test asserts the curve, not just "goes down").
- Every axis decays toward neutral (0) with per-signal τ (default 500 ms,
  matching PosePuppet's pull-to-rest feel). Events are inhibited while
  `confidence < 0.5`.
- On re-acquisition the pipeline blends measured values back over ~500 ms
  (slew stage naturally bounds the step; test asserts a max per-frame
  delta). `stillness` is held, not zeroed, during short dropouts.

## 8. Tooling

- **Tuner overlay** (`mountTuner(el, source, controls?)`): mono-language
  panel any consumer mounts — per-axis raw→shaped bar pairs, live value
  readouts, sliders for dead zone / expo / slew / One Euro params, event
  blips, seated/confidence/neutral chips, and a latency readout (wall-
  clock delta from frame capture to signal callback, measured at the
  impure transport edge — the pure core stays clock-free).
- **Jitter-floor tool** (`tools/jitter-floor.mjs`): drives `still.mp4`
  through the fake-webcam rig with shaping disabled, records per-axis raw
  streams, emits stddev/p95 per axis and writes suggested dead-zone
  defaults into `defaults/shaping.json`.

## 9. Verification plan

Fixture evals (episode-structural, via `?bodyinput=<fixture>` collector →
`eval/results.json`):

- `lean_lr`: ≥ 2 sustained (≥ 1 s) episodes of `leanX > +0.5` and ≥ 2 of
  `< −0.5`; `|leanY|` p95 < 0.35 during them (cross-axis isolation);
  returns inside the dead zone between episodes.
- `lean_fb`: mirror-image assertions on `leanY`, with `leanX` quiet.
- `crouch_stand`: `crouch` episodes ≥ 0.6 with returns < 0.15; `tallness`
  responds on stand-tall segments if present.
- `arms_tpose`: `armsOut ≥ 0.8` episodes; ≥ 1 `recenter` per hold;
  zero `action` events; works on the landscape, knees-cropped framing
  (this clip doubles as the upper-body-only coverage for arm axes).
- `seated`: `seated` flips true within a few seconds and stays true
  (no flapping count > 1); standing clips assert `seated === false`
  throughout.
- `still`: zero events; all shaped axes within the dead zone ≥ 99 % of
  frames; `stillness ≥ 0.8` steady-state; raw p95 recorded as the noise
  floor.

Protocol tests (node, pure core):

- **Replay determinism**: a recorded input tape run twice → byte-identical
  canonical-JSON signal tapes (fixed key order; same engine + pure
  arithmetic ⇒ bit-stable floats).
- **Shape guard**: landmarks provably absent from every emitted message
  (whitelist walk, both transports).
- **Failure modes**: upper-body-only framing (legs' visibility zeroed →
  arm/lean axes still work, crouch falls back to shoulder-height mode);
  arms leaving frame mid-gesture (no stuck event machines, gesture state
  resets); sitting down mid-session (seated flips once, neutralConfidence
  drops to 0.3); user too close (landmarks huge/cropped → confidence
  gates, no garbage axes); synthetic dropout (decay curve correct, zero
  NaN in the full stream, bounded recovery step).
- **Transport proof**: example consumer page (`examples/consumer.html`)
  subscribes over BroadcastChannel from a separate page and renders axes —
  Playwright drives both pages and asserts signal arrival + `v: 1` +
  shape-guard pass. In-page transport covered by the tuner mounting inside
  PosePuppet itself.
- Latency: measured pose-frame → emitted-signal on a live-ish run,
  reported in eval results and shown in the tuner.

PosePuppet's own suite stays green at every commit (no workspace churn,
additive adapter only).

## 10. Versioning policy

- `BodySignal.v` is the schema major. Additive, backward-compatible fields
  (Rowing/Dolphin needs) bump the package minor (1.x) and keep `v: 1`;
  consumers pin the package version and check `v` at runtime (transport
  drops mismatched majors with a console warning, never a throw).
- CHANGELOG.md per release; schema section of README is the normative doc.

## 11. Phases + estimates

- **P0** (this doc) — done pending gate.
- **P1** extraction + pipeline + neutral/seated + transports + tapes,
  unit tests green — the bulk, ~a day of work.
- **P2** tuner overlay + jitter-floor tool + defaults from still.mp4 —
  half day.
- **P3** fixture eval suite + failure-mode tests + example consumer page +
  README/CHANGELOG/EVAL_NOTES — half to full day.

## 12. Open questions folded into defaults (flag at gate if you disagree)

1. **Max-lean normalization angles** default 15° (leanX) / 12° (leanY) —
   tunable per consumer via config and the tuner; Flight's feel lab will
   refine.
2. **`action` gesture = both-hands-forward thrust.** Candidates were clap
   and single-hand punch; thrust is the most separable from normal flight
   posture (Superman profile holds arms out, not forward) and maps to
   Space/boost.
3. **Recorded input tapes are gitignored** (they're skeletal traces of
   you — same privacy class as fixtures). Committed artifacts are only
   derived stats (noise floors) and signal-level eval numbers.
4. **three.js-free core**: the ported body basis uses plain vector math so
   the package never cares about consumer three versions (the Flight fork
   adopts TinySkies' own three).
