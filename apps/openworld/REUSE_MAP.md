# V4 Open World — REUSE_MAP

Audit of every completed system V4 consumes, the exact seam it is
consumed at, and whether it is changed. Law: reuse, never rebuild; a
completed control system may be adapted at its integration seam only.

## 1. `@bodyarcade/world-data` (V2) — read-only

- **Artifact**: `packages/world-data/data/worlds/isafjordur/world.json`
  (`bodyarcade-world/1`, 1.1 MB). Verified contents: terrain 376×334 @
  12 m heightfield (u16 base64), water polygons (sea + lakes), roads/
  paths/buildings/landuse/aeroways, collision (heightfield + building
  triangles + water edges), `nav.walk` (2782 nodes / 2814 edges,
  largest component 2262), `nav.row` (3506 nodes / 13261 edges),
  minimap vectors, spawns (airfield "08/26", walk "settlement",
  3 docks, 2 dive points), transitions (land-to-walk, 3× dock-to-row,
  2× row-to-dive), attribution lines inside the artifact.
- **Seam**: `loadWorld()`, `decodeHeights()`, `heightAt()`,
  `worldPointInWater()`, `nearestNavNode()`, `worldAttributionLines()`
  from `@bodyarcade/world-data` — plus the unchanged boundary surface
  (`pointInWater`, `signedDistanceToShore`) for the Dolphin adaptation.
- **Changed**: nothing. Schema forbids style; profiles never touch it.

## 2. `@bodyarcade/pose-runtime` + `@bodyarcade/pose-hud` (V1) — read-only

- **Seam**: exactly the `apps/walking/src/main.ts` mount:
  `createPoseRuntime({ model, worker: true, captureSize, election:
  'strict', forceExternal: ?pp=companion })`, then
  `mountPoseHud(runtime, { safeArea, title })`. Camera-denied ⇒
  `denied|error` state ⇒ keyboard-only play (documented Dolphin-suite
  convention). Model choice per mode: lite for flight/walk/dolphin,
  **full for rowing** (lite collapses wrist depth — measured in V1).
- **Changed**: nothing.

## 3. `@bodyarcade/locomotion` (V3) — read-only

- **Seam**: the package's own `INTEGRATION.md`, written for V4.
  `createWalkController(window)` (transports + WASD/arrows + inject()),
  `createLocomotion()` (comfort enforced at output), `loco.step(ts,
  intent, pathHint)`; V4 supplies **PathHint from `nav.walk`** (the
  graybox proved the identical contract on a polyline) and owns ground
  clamping (`camera.y = terrainHeight + pose.eyeY`). `WALK_STATUS` /
  `coachLine` reused for HUD strings. Comfort caps may be lowered,
  never raised.
- **Changed**: nothing.

## 4. `@bodyarcade/body-input` — read-only

- **Seam**: `BodySignal` via BroadcastChannel/postMessage (flight/row
  controllers subscribe themselves); `createBodyInputCore` for
  synthetic closed-loop drivers (the `apps/walking/src/drive.ts`
  pattern: deterministic landmark frames through the real production
  chain). Stroke block (rate/phase/ampL/ampR/count) feeds rowing.
- **Changed**: nothing.

## 5. TinySkies Flight controls (`apps/flight`) — imported, unchanged

- **What is completed**: `apps/flight/client/src/input/bodyControls.ts`
  — the Gate-2/3-approved BodySignal→flight mapping: profiles
  (Superman etc.), arming gates, assist clamps, boost hysteresis +
  refractory, tracking-loss autopilot (τ 0.25 s decay, slew-2.0
  re-entry), keyboard priority (1.5 s), T-pose recenter handling; and
  `apps/flight/client/src/game/FlightControls.ts` — the keyboard
  `ControlState` source.
- **Seam**: both modules are transport-driven and world-agnostic (they
  emit/fill `ControlState`: turnRate, forward/brake, speedAxis,
  elevateAxis, boost trigger). openworld **imports them by path**
  (vite alias `@flight-input/*`) and feeds the resulting `ControlState`
  to its own region plane dynamics. The TinySkies globe physics
  (`Plane.ts`, spherical math) is inseparable from the globe world and
  is NOT the control system; the approved *mapping/assists/autopilot/
  recenter* are, and they are consumed byte-identical.
- **Changed**: nothing under `apps/flight/` (diff evidence: no commits
  touch it).

## 6. Rowing stroke logic (`apps/flight/.../input/rowControls.ts` +
   `game/Boat.ts`) — imported / adapted at the seam

- **What is completed**: stroke→impulse queue, steering profiles
  (asymmetry vs lean), coxswain-yield assist ladder, cruise latch,
  loss autopilot, keyboard priority (Gate-2 round-2 approved) — all in
  `rowControls.ts`, world-agnostic (consumes BodySignal stroke block,
  emits `ControlState`-shaped intent). `Boat.ts` impulse-and-glide
  hull feel constants.
- **Seam**: import `rowControls.ts` unchanged; openworld provides the
  boat hull integration on the region's water (drag/impulse constants
  read from the completed Boat feel table) and shoreline containment
  from world SDF.
- **Changed**: nothing under `apps/flight/`.

## 7. PS2 Dolphin (`apps/dolphin`) — adapted at its data seam, standalone stays green

- **What is completed**: `SwimSim` (pure fixed-timestep swim model:
  impulse-and-glide kicks, banked turns, breach, SDF containment
  current, assist ladder), `swimControls.ts` (torso-wave kick
  detection → SwimIntent), `dolphinMesh.ts` + `world.ts` (PS2 art:
  vertex-lit flat-shaded, palette, fog, shimmer curtain, seabed from
  the same `depthAt()` as the sim), `camera.ts`, HUD/minimap, suites.
- **Seam**: `SwimSim` construction — currently hardcodes the SF-bay
  boundary JSON import and an SF spawn point. **Minimal adaptation**:
  parameterize constructor with `{ boundary, spawnHint, worldScale,
  depthFn? }` defaulting to the current SF values, so the standalone
  app is behavior-identical (suite proves it). openworld constructs it
  with Ísafjörður water polygons (same ring convention — stated in
  WORLD_SCHEMA.md) + real bathymetry from the world heightfield
  (replacing the SDF+noise synthetic depth). Renderer modules are
  imported as-is where decoupled; the openworld low-poly profile mounts
  the PS2 look on region data.
- **Changed**: the constructor parameter seam only, default-compatible,
  logged in DECISIONS.md; `apps/dolphin` suite re-run green.

## 8. PPC, election, HUD degradation, privacy line

All inside pose-runtime/pose-hud — inherited automatically by every
consumer. Nothing to do.

## 9. Verification rig

- Playwright per-app pattern (`apps/*/playwright.config.ts`,
  `tests/*.spec.ts`), `shots.mjs` screenshot boards, synthetic drive
  query params, `__WALK`-style page eval surface, display-:2 flock for
  headed/perf runs (`/tmp/bodyarcade-display2.lock`), fixture y4m fake
  webcam. All reused as patterns in `apps/openworld/tests`.

## Explicitly NOT reused (and why)

- TinySkies globe world/rendering (`Globe.ts`, `SphericalMath.ts`,
  quests, NPCs): globe-specific content; the Open World is a
  local-tangent-plane region. TinySkies remains untouched.
- Dolphin's synthetic `depthAt` noise bathymetry: replaced by real
  terrain bathymetry in-region (the artifact carries it).
- PosePuppet Full App UI: the Open World is a game page like Flight/
  Dolphin/Walking; shared chrome comes from pose-hud only.
