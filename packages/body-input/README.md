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

## Versioning policy

`BodySignal.v` is the schema major. Additive fields (Rowing/Dolphin) bump
the package minor and keep `v: 1`; breaking changes bump both majors.
Consumers pin the package version; the BroadcastChannel source drops
mismatched majors with a one-time console warning, never a throw.
See CHANGELOG.md.
