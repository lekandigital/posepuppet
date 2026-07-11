# BodyArcade Dolphin

An Ecco-*inspired* (original everything — no copied assets, names, or
level designs), body-controlled, low-poly PS2-era underwater world
bounded by the real shape of **San Francisco Bay**. The outline is real
(OSM coastline data via `@bodyarcade/world-data`, ODbL, credited in-app
under the minimap); the world inside is fictional.

## How it plays

- **Kick** — bob chest and hips in a smooth standing wave (anti-phase).
  Each detected wave banks a surge with a ~0.3 s attack; drag is
  proportional to speed, so every cadence settles at its own cruise and
  stillness is a long glide. The rhythm is the game feel (the
  impulse-and-glide model Rowing proved).
- **Dive / surface** — lean forward / back. **Turns** — shoulder-line
  tilt banks and carves. **Depth trim** — crouch descends, stretch
  ascends (low-energy/seated play). **Burst** — both hands forward
  (hysteresis + refractory). **Breach** — sprint, then pitch up hard
  near the surface: ballistic leap, camera follows, splash on re-entry.
  **T-pose** recenters neutral.
- **Keyboard always works**: W/S dive/surface, A/D turns, Q/E depth,
  Shift kick, Space burst, 1/2/3 assist ladder.
- **Assists**: Full (default — depth clamps, auto-level, shore-heading
  help, gentle drift so stillness never strands), Standard, Expert.
  Tracking loss = autopilot: level out and glide, slew-bounded blend
  back, never a snap.

## Architecture

- `src/game/sim.ts` — pure fixed-timestep (120 Hz) swim model; no RNG,
  byte-identical replays (asserted). All feel constants in one table.
  Containment = signed-distance field from the real polygon: a soft
  current pushes back inside a 55 m band; the absolute in-polygon
  guarantee is a slide, never a wall. Seabed depth = SDF + value noise.
- `src/input/swimControls.ts` — BodySignal consumer (BroadcastChannel
  same-origin + postMessage relay, shape-guarded; landmarks never reach
  this app), keyboard priority, autopilot, burst machine.
- `src/game/world.ts`, `decor.ts`, `dolphinMesh.ts` — the PS2 pass:
  vertex-lit flat-shaded procedural meshes, exponential depth-tinted
  fog, instanced boid fish that flee, vertex-shader kelp sway, faked
  caustic shafts, additive motes, drowned ruins, shimmer-curtain
  boundary. No textures, no imported assets.
- Producer side: PosePuppet's Swim card / ⌘K "swim" opens `/dolphin/`
  (served same-origin by the root vite middleware — BroadcastChannel is
  origin-scoped) and drops to the lite tracker: the kick signal reads
  image-space chest–hip extent, no wrist depth, so lite is safe here
  (unlike Rowing).

## Verification

`npm test` (headed; see playwright.config.ts): synthetic swim-pump
mapping and sign tests, impulse-and-glide coupling, 8-direction
containment battery (never exits the polygon, never hard-walls), breach
positive + negative, dropout → glide with smooth recovery, replay
determinism across reloads, transport topology (built app over pure
BroadcastChannel), fps/simHz recording (fps floor asserted on GPU runs:
`DOLPHIN_GPU=1 DISPLAY=:2 npm test`). Results land in
`eval/dolphin-results.json`. Kick-detector unit + fixture evals live
with `@bodyarcade/body-input` (synthetic waves; false-positive checks
on all existing clips; positive fixture evals await the torso_wave
recordings — see FINAL_USER_TEST_PLAN.md).
