# STUDY_NOTES.md — TinySkies / GlobeFly architecture map

BodyArcade Flight P0 recon, 2026-07-07. Source: `/Users/lekan/Dev/tinyskies-reference`
(read-only), forked into `apps/flight/`. TinySkies / GlobeFly by Danny
Limanseta is used with permission — https://github.com/dannylimanseta/tinyskies

## Repo shape

npm workspaces: `shared` (types + vehicle capabilities), `client` (the whole
game — Vite + three.js **0.172.0**, TS 5.7), `server` (Express + Socket.io +
Prisma/Postgres). PosePuppet is on three 0.184; the BroadcastChannel
transport means the two renderers never meet, so both versions stay as-is.

Client is ~30k lines of vanilla TS. Two god files — `Game.ts` (7,042 lines:
orchestration, world flow, quests, cinematics) and `Globe.ts` (5,803 lines:
procedural globe, biomes, decorations) — everything else is focused
single-purpose modules. No framework, no state library.

## Render loop

`main.ts` → `new Game(container).start()`. One rAF loop, `Game.tick()`
(Game.ts:3038): `dt = min(clock.getDelta(), 0.05)` — **variable timestep,
clamped at 50 ms**. All simulation (plane physics, camera, effects, NPC
systems) advances on that dt. No fixed-step accumulator anywhere, so replay
determinism is dt-sequence-dependent — the replay eval must record dt per
frame or accept path tolerance (measured at P-eval, stated honestly).

A separate `previewTick` (wall-clock dt) runs the main-menu orbit preview.

## Flight math (`SphericalMath.ts`, `Plane.ts`)

Position on the globe is a **quaternion** (`qPosition`) mapping local +Y to
the surface normal; no Euler poles, no gimbal seams. Each frame:

- `tangentFrame(q)` → up / north / east basis.
- `moveOnSphere(q, heading, arcAngle)` advances along a great circle
  (`arcAngle = speed·dt / globeRadius`).
- `buildPlaneMatrix(q, heading, pitch, bank, altitude, R)` composes the
  final world matrix (matrixAutoUpdate off, matrix built by hand).

`Plane.update(dt, turnRate, forward, brake, elevate, paintball, descend)`:

- **turnRate is already a continuous float** (keyboard supplies ±1.2),
  smoothed by `TURN_INPUT_SMOOTH = 8 /s` exp catch-up, then
  `heading += smoothed·dt`. Bank is *derived* from smoothed turn input
  (±45° max), pitch is *derived* from climb rate. This is the perfect seam
  for body input: continuous axes drop in with zero physics changes.
- Speed: W accelerates toward `MAX_SPEED = 0.8` (accel 2.5), S brakes
  (decel 3.0), idle decays 0.3/s toward `MIN_SPEED = 0.3` — always-flying
  arcade throttle already, exactly what the Feel Lab wants. Turning bleeds
  speed. Ring boosts pin speed to 1.3 with a barrel roll. Hard ceiling 2.0.
- Altitude: three bands — terrain-following low hover (`surfaceAlt + 0.08`),
  cruise 0.55, high 1.35. `elevate`/`descend` booleans blend an
  `elevateBlend ∈ [-1, 1]` (smooth 6/s); a continuous elevate axis can feed
  the same blend directly.
- Also on the plane: HP vs sky-gremlin paintballs, slow debuffs, upgrade
  multipliers from the level-up system, boost barrel roll.

`deadReckon` + `slerpPlayerState` do remote-player interpolation (multiplayer
only). `paintballRayFromPlaneState` must stay aligned with the server's
`paintball/hitTest.ts` (only matters in multiplayer).

## Input flow

`FlightControls.ts` (99 lines) is the **only** gameplay keyboard handler
(others: `DebugMenu` shift+Q, `CampsiteControls` behind a disabled feature
flag, Lobby text fields). Holds a key set; `getState(): ControlState` is
polled once per tick:

```
turnRate: A = +1.2, D = -1.2   (continuous field, float)
forward:  W        brake: S    elevate: ArrowUp   descend: (always false)
paintball/specialAction: Space (one-shot, queued on keydown)
interact: F        (one-shot)
```

**The upstream README's control table (W/S pitch, Shift/Ctrl speed) is
stale** — the code above is the actual behavior and is what "keyboard
identical to upstream" means. Touch devices get `TouchControls` (virtual
stick → the same ControlState shape).

Integration plan: body input becomes a second producer of `ControlState`
(extended with optional continuous speed/elevate axes that the keyboard
path fills from its booleans), merged in `Game.tick` — keyboard always
wins when active, body signal feeds otherwise. No changes to Plane physics.

## Camera (`CameraRig.ts`)

Chase cam in the tangent frame: position/lookAt exp-smoothed (10/9 per s,
damped when chase distance is tight), speed-driven dolly + FOV boost
(per-vehicle via capabilities), turn tilt, impulse shake + persistent
trauma noise, `snapTo` on spawn, direct drive during the intro flythrough.
`camera.up` = radial. A separate void-plane mode (carpet cosmic void) skips
spherical math. Nothing here needs to change for body input.

## World flow + server touchpoints (the offline surface)

World config is 8 fields: `{id, slug, name, globeRadius(5.0), texture,
seed, terrainType, createdBy}`. Terrain is deterministic from seed — client
bundles its own `SimplexNoise/TerrainSurface/TerrainPresets` (server has a
mirror copy for hit tests). **Nothing about the world itself lives only on
the server**; Postgres just stores the 8-field row.

Client→server touchpoints (all of them):

| touchpoint | where | offline treatment |
|---|---|---|
| `resolveServerUrl()` | Game.start (Game.ts:677) | LocalWorldProvider short-circuits |
| `POST /api/worlds/auto-join` | Game.ts:681, world switch :2911 | local provider returns a bundled/generated world |
| `SocketClient` + `StateSync` (20 Hz) | initNetworking (Game.ts:2805) | dormant: no socket in local mode; flag/paintball/remote-player events never fire (all handlers already null-safe `?.`) |
| `POST /api/lanterns/add` | Game.ts:3577 | local no-op (persist count in localStorage) |
| `POST /api/save-feed`, `GET /api/save-feed` | Game.ts:6461, Lobby.ts:508 | local no-op / empty feed |
| `POST /api/events` (milestone history) | Game.ts:6513 | local no-op |

`resolveServerUrl` already falls back gracefully; the only hard failure
today is auto-join (`showLoadingError()` if fetch fails) — that's the one
mandatory intercept. Multiplayer code (RemotePlane, NpcBoats sync, flags,
paintball PvP) keeps compiling; it simply never receives events.

Server (`server/src`): Express + Socket.io rooms (`RoomManager`, capacity +
reservations), Prisma models `World / LanternLedger / SaveFeedEntry /
GameEvent`, paintball server-side hit test, terrain mirror. Stays runnable
via docker-compose (Postgres 16) for parity/multiplayer experiments.

## Vehicles — confirmed roster

`shared/vehicleCapabilities.ts` declares **plane, boat, carpet** — all three
fully real, each with meshes, trails/wakes, camera tuning, and gameplay
flags (plane: diamonds/XP/quests/paintball; boat: fishing minigame + wake;
carpet: portals, void world, leaf/smoke trails). NPC planes and NPC boats
exist too. **Boat and carpet matter for the Rowing/Dolphin seams** — the
capabilities table + per-vehicle mesh/matrix builders (`buildBoatMatrix`,
`buildCarpetMatrixVoidPlane`) are exactly the extension points FUTURES.md
should describe.

## Effects / content inventory (all client-side, all offline-safe)

Day/night cycle (seeded), Aurora, Starfield, MeteorShower, GodRays,
LensFlare, RainOverlay + thunder, RainbowArch, Volcano, WaterSpouts
(twisters), SpeedLines, Contrails/Trail/WakeTrail/CarpetTrail, BirdFlock,
FireflyCluster, FloatingLanterns, OceanFish + fishing, SkyJellyfish,
SkyGremlins + Gremlin King (combat), VoidMoths/VoidHearts/VoidFlameShield
(carpet void world), CosmicWorldPortal, EternalFlame world + beams,
MoonThreat cinematic, Landmarks (pyramid, statue, whale, moonstones,
hotspring, capybara shrine…), package-delivery quests + NPC dialogue,
races + timer, level-up upgrade cards, campsite (feature-flagged off).

Progression: `ProgressionManager` — **already localStorage-only**. Lobby
world customization UI exists (name/texture); world persistence is the
part LocalWorldProvider replaces.

## Assets (licensing surface)

`client/public` = 47 MB: 10 GLBs (landmarks/moon/whale/capybara…), 2D
art/icons, NPC portraits, fonts (Domine, Darumadrop One — Google Fonts,
OFL), ~66 SFX mp3s + music loops. The permission grant covers Danny's own
work; **audio + GLB provenance is flagged in ASSETS.md for verification**
(upstream repo has no third-party credits file). `@vercel/analytics` was
the only tracking dependency — already stripped from the fork.

## Fork deltas at P0 (see ASSETS.md manifest)

- Copied: client, shared, server, docker-compose.yml, README.md, docs/.
- Excluded: `.git`, `node_modules`, `dist`, deploy glue (`vercel.json`,
  `railway.toml`, `.github`, `.railwayignore`, `api/` serverless shim),
  one-off codemod scripts (`patch*.js`), `.env`.
- Modified: `client/package.json` + `client/src/main.ts` — removed
  `@vercel/analytics` (BodyArcade: no telemetry, ever).
- Verified: `npm install && npm run build:client` green (tsc + vite,
  147 modules).
