# @bodyarcade/locomotion — V4 integration notes

Written by V3 (Walking Locomotion) for the Open World agent. The package
is proven in `apps/walking` (the graybox); V4 performs the world
integration — single owner of `apps/openworld`. The low-poly profile
integrates first; realistic and fantasy inherit WITHOUT locomotion
rework, because profiles are renderers over the same model output.

## The 60-second version

```ts
import {
  createLocomotion, createWalkController, coachLine, WALK_STATUS,
} from '@bodyarcade/locomotion';

const controller = createWalkController(window); // transports + keyboard
const loco = createLocomotion();                 // comfort enforced inside
loco.teleport(spawn.x, spawn.z, spawn.yawDeg);

// per render frame:
const intent = controller.intent(performance.now());
const pose = loco.step(performance.now(), intent, navGraphPathHint);
camera.position.set(pose.x, pose.eyeY, pose.z);
camera.rotation.set(0, -pose.yawDeg * DEG, 0); // yaw only — never tilt
```

The page must already run `@bodyarcade/pose-runtime` (V1) so BodySignals
flow; the controller subscribes to the standard transports
(BroadcastChannel + postMessage envelope, deduped by ts) and owns the
WASD/arrow keyboard fallback. `controller.inject(signal, atMs)` bypasses
transports for tests/replays — the graybox drivers and the eval use it;
your closed-loop specs should too.

## What the model gives you (WalkPose)

`{ x, z, yawDeg, speed, yawRateDps, eyeY, vignette, mode, stepPulse,
recentered }` — a first-person rig pose. Conventions: yawDeg clockwise
from above, forward = `(sin yaw, −cos yaw)` (yaw 0 walks −Z, three.js
camera style); `eyeY` is the full camera height (1.6 m standing, ducks
to ~1.05 m, slew-limited). `mode` ∈ idle/walk/glide/keyboard/autopilot
maps to HUD status words via `WALK_STATUS`. `stepPulse` is true exactly
on footfall frames (HUD pulse, footstep audio). `vignette` is a 0..1
comfort-vignette intensity — render it (radial darkening) or ignore it;
the graybox shows the reference treatment.

## What the model does NOT do (on purpose)

- No pitch, no roll, no FOV, no vertical bob — the horizon cannot move
  through this package. Do not add camera bob in any profile; that is a
  comfort non-negotiable, not an aesthetic choice.
- No collision or terrain height. V4 owns ground clamping: set
  `camera.position.y = terrainHeight(x, z) + pose.eyeY` and resolve
  collisions by adjusting the position you FEED BACK via `teleport` only
  for hard resets (spawns, portals) — for soft containment prefer nav
  hints (below). The model integrates on flat ground; slopes are a
  render-side offset.
- No scoring, no game state.

## The nav-graph hook (PathHint)

`loco.step(ts, intent, pathHint)` — pass a function from your baked walk
network:

```ts
(x, z) => { dirX, dirZ, lateral, halfWidth } | null
```

`dir` = unit path direction at the nearest sample (pick the direction
consistent with travel); `lateral` = signed offset, + = right of dir;
`halfWidth` = walkable half-width there; null = off-network (assist
disengages). Full Assist (default) steers softly back inside the
shoulder (`assist.shoulderM` inside the half-width) and aligns heading —
budgeted at `assist.maxDps` (14°/s), scaled to zero below 0.5 m/s, and
SILENCED while `|leanX| ≥ leanYieldThreshold` (deliberate steering wins —
the rowing coxswain lesson; do not remove the yield). `assist.mode`:
`full` / `light` (half gain) / `off`.

## Comfort parameters (the envelope is the contract)

`defaultLocomotionConfig().comfort` — every value enforced at the
model's OUTPUT each frame, and `loco.envelope()` reports observed maxima
for your perf/comfort evidence:

| Parameter | Default | Meaning |
|---|---|---|
| maxSpeed | 2.4 m/s | hard cap, any control source |
| maxAccel / maxDecel | 2.5 / 3.5 m/s² | speed slew caps |
| maxYawRateDps | 45°/s | yaw rate cap (lean-turn asks 40 max) |
| maxYawAccelDps2 | 180°/s² | yaw rate slew cap (kills snaps) |
| eyeHeight / duckDrop | 1.6 / 0.55 m | standing eye, crouch duck |
| eyeSlewPerS | 0.9 m/s | eye height slew (duck eases) |
| vignette.* | on 18°/s / 1.2 m/s², max 0.55 | comfort vignette curve |

Consumers may LOWER caps per profile; raising them exits the tested
envelope (tests/locomotion.spec.ts + tests/walking-eval.spec.ts assert
no input sequence exceeds these — rerun both if you touch the config).
`eval/walking-results.json` is the current evidence artifact.

## Control mapping (already tuned in the graybox)

- Cadence → speed: `strideM (0.62) × cadence × ampScale`; gait comes
  from body-input's `gait` block (marching legs, or lateral hip sway when
  legs aren't framed — desk users walk by weight-shifting).
- leanX → yaw rate (40°/s at full lean); crouch > 0.35 → duck + slow.
- Seated → lean-glide (accessibility fallback): leanY forward drives up
  to 2.0 m/s, leanX steers. Do not gate walking on standing.
- Keyboard (W/A/S/D + arrows) wins while touched, resumes body ~1.5 s
  after keys go quiet. Works with the camera denied — keep it wired in
  every profile.
- Tracking loss → autopilot: gentle stop (1.3 m/s²) on a held heading;
  re-entry authority ramps over 500 ms. Never fights the caps.
- T-pose recenter: body-input recaptures neutral; `pose.recentered`
  pulses once — show the toast.

## HUD / coach strings

`WALK_STATUS` (mono status words) and `WALK_COACH` +
`coachLine(hudState, mode, cameraDenied)` ship in the package so every
profile says the same things. `controller.hudState()` gives tracking
state, cadence, source, seated, and a consumed-on-read recenter flag.

## Determinism

Model and controller run on caller timestamps only. Same intent stream →
byte-identical pose trace (asserted). For replay evals, drive
`controller.inject` from a recorded BodySignal tape and step the model on
the tape clock.

## Known limitations (honest)

- Gait detection validated on synthetic streams + false-positive rows on
  all real fixtures; POSITIVE real-clip validation (march_slow/fast,
  weight_shift, walk_lean_turns) is deferred until those optional clips
  are recorded — FINAL_USER_TEST_PLAN S8.
- Nausea judgment is human-only: automated yaw/accel envelopes are
  proxies. S8 carries the live check; keep the vignette toggleable.
- The sway substrate needs hips in frame; full occlusion = autopilot.
- No backward body locomotion (comfort); keyboard S backsteps at 0.9 m/s.
