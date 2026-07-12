# @bodyarcade/body-input

PosePuppet tracking in, derived control signals out. Every BodyArcade mode
(Flight first) consumes this protocol instead of touching landmarks.

**Privacy boundary:** raw landmarks never leave this package. The only
thing that crosses — in-page or over BroadcastChannel — is `BodySignal`,
and the sink shape-guards every message at runtime (`assertSignalShape`).

**Determinism:** the core is a pure state machine over the input stream.
All timers run on frame timestamps (`tsMs`); there are no wall clocks and
no randomness inside. The same recorded input tape replays to a
byte-identical signal stream (`canonicalStreamJSON`).

## Schema v1

```ts
interface BodySignal {
  v: 1;                      // schema major — consumers check this
  ts: number;                // ms, from input-frame timestamps only
  confidence: number;        // 0..1, decays on tracking loss (τ ≈ 300 ms)
  seated: boolean;           // auto-detected, hysteresis both ways (1.5 s)
  stillness: number;         // 0..1, 1 = holding still
  neutralConfidence: number; // 0..1 trust in the captured neutral
  axes: {
    leanX: number;           // -1..1, + = user leans toward THEIR right
    leanY: number;           // -1..1, + = lean forward (toward camera)
    crouch: number;          //  0..1, 0 = neutral stature, 1 = deep crouch
    tallness: number;        //  0..1, upward stretch (small range, high gain)
    armsOut: number;         //  0..1, lateral wrist extension (T-pose ≈ 1)
    armsRaised: number;      //  0..1, wrist elevation above the shoulders
    handsForward: number;    //  0..1, wrist extension toward the camera
    handPoint: number;       //  0..1, single-arm point (asymmetry measure)
  };
  events: ('recenter' | 'action')[]; // fired on THIS frame, transition-only
}
```

Sign convention: landmarks arrive mirrored (PosePuppet's convention), so
screen +x is the user's own right — `leanX = +1` means the user leans to
their right, `leanY = +1` toward the camera.

All axes are **calibration-relative**. A provisional neutral is captured
automatically from the first ~0.8 s of confident stillness
(`neutralConfidence` capped at 0.5); a held T-pose fires `recenter`,
recaptures the neutral, and sets `neutralConfidence = 1`. Sitting down
drops it to 0.3 until the next recenter. `action` is a fast both-hands-
forward thrust.

## Pipeline

Per axis: `raw → One Euro → dead zone → expo → slew-rate limit → clamp`.
Per event: `threshold + hysteresis + N-frame debounce + refractory`.
On tracking loss every axis decays to neutral (τ = 500 ms per axis,
configurable), events are inhibited below confidence 0.5, and
re-acquisition is slew-bounded — no NaNs, no snaps.

Dead-zone defaults are measured, not guessed: `tools/jitter-floor.mjs`
runs `still.mp4` through the rig and writes them with provenance
(see `src/defaults.ts`).

## Use

```ts
import {
  createBodyInputCore, createBroadcastSink, createBroadcastSource,
} from '@bodyarcade/body-input';

// producer (PosePuppet side)
const core = createBodyInputCore();
const sink = createBroadcastSink(); // or createInPageChannel()
onPoseFrame((f) => sink.publish(core.push({ tsMs: f.wallTimeMs, world: f.world, norm: f.norm })));

// consumer (game side, any page, any three.js version)
const source = createBroadcastSource();
source.subscribe((s) => { plane.bank(s.axes.leanX); /* … */ });
```

Recording/replay: `createInputRecorder` / `runTape` (input tapes contain
landmark traces — local dev/eval artifacts only, gitignored like
fixtures), `createSignalRecorder` / `replayInto` for signal tapes.

A minimal working consumer lives at `examples/consumer.html` — open
`http://localhost:5173/packages/body-input/examples/consumer.html` in a
second tab while PosePuppet runs and the bars move with your body.

## Tuner

`mountTuner(host, { core, source, getLatencyMs })` drops a self-contained
overlay into any consumer: raw → shaped bars per axis, live shaping
sliders (writes `core.setConfig`), confidence/neutral/seated/stillness
chips, event blips, latency readout. In PosePuppet: press `b` (or the
command palette).

## Verification

- `tests/bodyinput.spec.ts` — protocol tests: byte-identical replay,
  landmark-absence guard, sign conventions, decay curves, failure modes.
- `tests/bodyinput-app.spec.ts` / `bodyinput-consumer.spec.ts` — live app
  emission, landmark-free broadcast wire, tuner mount, cross-page
  consumer.
- `tools/fixture-eval.mjs` — per-fixture assertions on the six
  fixtures/flight clips (episode-structural: signed lean episodes,
  T-pose → recenter, seated flag, still-clip noise floor), plus measured
  pose-frame → signal latency, written to `eval/bodyinput-results.json`.
- `tools/jitter-floor.mjs` — measures the dead-zone defaults (provenance
  in `src/defaults.ts`).

## Measured limitations (v1, honest numbers from the fixture eval)

- **leanY is the weakest axis.** MediaPipe depth noise gives it a measured
  jitter floor of ~0.10 p95 (dead zone 0.123), and hard *lateral* leans
  bleed systematically into it — 0.5–0.66 p95 across eval runs. Flight
  profiles should widen the leanY dead zone or lower its gain rather than
  expect isolation during aggressive banking.
- **Arm rests need a calm start.** Arm axes are measured relative to a
  hanging-arm rest captured at neutral; if tracking starts mid-T-pose the
  rest reference stays at zero until a calm-arms capture happens
  (`handsForward` then reads its ~0.3 resting bias). Stand at rest for a
  second when starting, or recenter after settling.
- **`action` fires on any fast two-hand forward reach**, including raising
  arms into a T-pose through the front. still.mp4 shows zero false events
  at rest; disambiguating reach-through vs deliberate thrust is a
  consumer-side tuning question (Flight's feel lab).
- **Seated detection needs legs.** Full-leg framing classifies on leg fold
  + ankle-forward (measured: crouch 0.45–0.51/negative, seated
  0.63–0.70/positive); with feet hidden it falls back to thigh angle, and
  with knees hidden to an image-space shoulder-drop heuristic.

## Gait block (v1.1, additive — V3 Walking)

`signal.gait = { active, count, cadence, phase, amp, shift, source }` —
steps from left/right alternation. `cadence` is steps/second; `shift` is
the weight-shift axis (−1..1, + = weight over the user's own right
foot); `source` says which substrate measured THIS frame:

- **`legs`** — signed knee-lift difference between the legs, thigh-length
  units. Marching in place, stepping. Needs knees+hips in frame.
- **`sway`** — lateral hip-center excursion (shoulder widths, slow-EMA
  DC-removed). Weight-shift walking; works at desk framing with no legs
  visible at all.
- **`none`** — dropout / hips unseen; cadence decays, `shift` eases to 0.

One detector, one rhythm: the substrate switches with framing and the
extremum tracking rebases across the switch, so count/cadence survive a
user stepping closer to the camera mid-walk. A step counts at every
hysteresis-qualified reversal with sane amplitude/timing (minAmp per
substrate; step interval 220–1600 ms — slow alternating leans live above
1600 ms half-cycles and can never form a rhythm; the fixture-eval
negative rows on lean_lr/lean_fb/crouch_stand/seated/still are the
arbiter). Consumed by `@bodyarcade/locomotion`.

## Versioning policy

`BodySignal.v` is the schema major. Additive fields (Rowing/Dolphin) bump
the package minor and keep `v: 1`; breaking changes bump both majors.
Consumers pin the package version; the BroadcastChannel source drops
mismatched majors with a one-time console warning, never a throw.
See CHANGELOG.md.
