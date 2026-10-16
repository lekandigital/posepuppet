# CP10 — Tidewater environment adoption + BodyArcade dolphin: integration report

_Checkpoint 10 of BodyArcade Stage 3, branch `bodyarcade-tidewater-cp10`, 2026-10-16. Covers the
first CP10 commit (`42cd32b`, Tidewater host + dolphin) and the CP10 continuation (this commit:
split waterline, play modes, optional fishing, curated scenery additions). Governing decisions:
`docs/bodyarcade-stage3/decisions/POST_CP09_TIDEWATER_ADOPTION_AND_CP10_CONTINUATION.md`._

## 1. Source and repository state

| | |
|---|---|
| Starting point | `bodyarcade-shared-world` @ `81e89c17540cf87fcb38911a55f2162ceb6a76f6` (clean tree) |
| Integration branch | `bodyarcade-tidewater-cp10` (local only) |
| First CP10 commit | `42cd32b` — Tidewater vendored + dolphin integrated |
| Continuation commit | the commit carrying this file (hash in the delivery message) — parent `42cd32b` |
| Tidewater pin | `4811ba48d795197de5621985f404e765c0b7c0ef`, vendored unmodified at `apps/tidewater-dolphin/vendor/tidewater/` (SHA-256 manifest `BODYARCADE_SOURCE_RECORD.md`, digest `96e59323…67c0f`); **no file under `vendor/` is edited** |
| Old world | `apps/shared-world/` untouched and runnable (`npm run dev` → :5198) |
| Push / merge / rebase / deploy | none. No CP11 work. |

Files introduced / modified by the continuation (all under `apps/tidewater-dolphin/` unless noted):

- `src/dolphin/cameraRig.ts` — waterline exclusion removed; surface-relative crossing detector; eye-crossing metric.
- `src/dolphin/dolphinPlayer.ts` — control / camera ownership (`setControlled`, `resume`), gated hotkeys, one-shot `test.kick`.
- `src/input/swimControls.ts` — typing-field guard, `setEnabled`.
- `src/DolphinApp.js` — Tidewater `Player` + `Game` constructed as in `App.js`; `playerMode` ownership; `setPlayerMode`, `placeWalker`, `_moorIfDocked`, `dropPlayerAtCamera`; `setFishing` / `applyFishing` / `setFishingUIVisible`; `SceneryAdditions`.
- `src/DolphinAppUI.js` — Play tab (mode, fishing, dolphin, scenery additions), boat-camera select, mode-aware HUD.
- `src/credits.ts`, `index.html` — F1 sheet with walking / boat / fishing sections, loader tip.
- `src/additions/SceneryAdditions.js` — new: the optional scenery layer (curation notes, deterministic placement, manifest).
- `eval/capture.mjs`, `eval/views.mjs` — `enhanced` target, `?original` for the parity targets, two addition-site views.
- `test/unit.ts` — camera-rig regression tests (no waterline exclusion, SlowHover fix); `test/play.mjs` — one-shot kicks; `test/waterline.mjs`, `test/modes.mjs` — new live suites.
- `eval/results/` — `play.json`, `waterline.json`, `modes.json`, `additions-manifest.json`, `parity/*.json`, `images/*.jpg`; `eval/evidence/*.diff` regenerated.
- `README.md`; repo `CREDITS.md`, `.gitignore`; `docs/bodyarcade-stage3/decisions/POST_CP09_TIDEWATER_ADOPTION_AND_CP10_CONTINUATION.md`, `docs/bodyarcade-stage3/outputs/CHECKPOINT_INDEX.md`.

## 2. Architecture

**Host.** Tidewater's own engine (WebGPU / WGSL): `Engine`, `SceneRenderer` (opaque / water / transparent layers, reversed-Z), `OceanFFT`, `WaterSurface` / `WaterMaterial`, `ShoreWaves` + `ShoreSim`, `Breakers`, `SurfFoam`, `Caustics`, `RefractionPass`, `UnderwaterLighting`, `WakeSim`, `WaterQuery`, terrain (`TerrainData` / `TerrainGPU` / `Terrain`), `Village`, `Vegetation`, `Reef`, `Rocks`, `Debris`, `Pier`, `Colliders`, `Whale`, `Wildlife`, sky (`Atmosphere`, `Sky`, `SkyProClouds`), post (`PostFX`, `Underwater`, `AirHaze`, TAAU, GTAO, motion blur, lens droplets / flare), `SoundScape`. `src/DolphinApp.js` is a derived copy of `App.js` that constructs and updates every one of these in the same order with the same parameters (diff: `eval/evidence/DolphinApp-vs-App.diff`). Nothing changes what the water, sky, terrain or post look like.

**Dolphin (BodyArcade, ported).** `sim.ts` and `worldSampler.ts` byte-identical to `apps/shared-world`; `cameraRig.ts` on the engine's math driving the host camera; `dolphinActor.ts` on Tidewater's GLTF loader / GPU skinning with `DolphinSkinnedModel.js` (Tidewater `SkinnedModel` + additive layers in three.js arithmetic); `swimControls.ts` (`@bodyarcade/body-input`, same-origin BroadcastChannel / postMessage, keyboard priority, autopilot). Environmental queries through `tidewaterWorld.ts` over Tidewater's own `TerrainData.heightAt` / `coastDistance`, `Reef.structureAt`, `Colliders` — CPU, deterministic; the GPU `WaterQuery` (1–3 frame latency) never enters the 120 Hz sim (presentation only: swell ride, splash height, surface-crossing detector).

**Play modes (continuation).** Tidewater's `Player` (walk / swim / deck / helm) and `BoatController` are constructed exactly as in `App.js`. `DolphinApp.playerMode` ∈ {dolphin, walk, boat} names the single owner of input and camera:

| | Dolphin (default) | Walking | Boat |
|---|---|---|---|
| Updated controller | `DolphinPlayer` (controls → 120 Hz sim → animation → chase rig) | `Player.update` (Tidewater) | `Player.update` in `boat` mode (Tidewater, `BoatController.setInput`) |
| Idle controllers | `Player` not updated | dolphin simulates on a neutral autopilot intent (hovers where left), reads no keys, drives no camera | same |
| Lens | 55° (rig) | 62° (Tidewater) | 62° |
| Pointer lock | never requested | on click (Tidewater) | on click |
| Transitions in | `dolphin.resume()`: valid water (else spawn), rig snapped behind it; if at the helm `Player.leaveHelm()` (stands on deck, engine off), boat re-moors if at the dock | off the boat: Tidewater's `ashoreTarget()` → `exitBoat(target)`; else the spot the walker was last on foot (first time `WORLD.start`, the boardwalk); `placeWalker` puts it on the ground / deck | `Player.takeHelm()` if on deck, else `Player.enterBoat()` (board + helm) — Tidewater's own flow |

Switching never rebuilds anything: `test/modes.mjs` records object identities of the FFT, surface, ocean mesh, terrain, reef, whale, wildlife, sky, clouds, post chain, dolphin rig and actor, player, boat, game, audio before and after 13 switches — all identical, scene child count unchanged, time of day unchanged. Tidewater's E-key boarding inside Walking is honoured (`displayedMode` reports Boat when the walker is on deck / at the helm). Fresh sessions always start as the dolphin; no startup preference is stored.

**Fishing (continuation).** Tidewater's `Game` is constructed as in `App.js` (it builds the stalls, rod, saved progress, floodlights). It UPDATES only while `fishing && playerMode !== 'dolphin'` (`fishingActive`). Turning it off, or switching to the dolphin: `cancelLine`, rod away and hidden, catch / panels closed, its HUD, minimap and first-play guide hidden (`display:none`, the elements persist), `player.busy` cleared; the session's `GameState` is kept. Vendors idle in every mode. `R` is the dolphin's recenter in Dolphin mode and Tidewater's rod key in Walking / Boat — the dolphin's hotkeys and WASD are gated by ownership (`swimControls.setEnabled`).

**Waterline (continuation).** Removed from the Tidewater rig: `RIG.SURFACE_BAND` (±0.75 m), `RIG.SHIMMER_MIN_Y` (0.35 m), `RIG.SHIMMER_HOLD_S`, `applyAntiShimmer()` and its side lock, the swim-side clamp `desired.y = min(desired.y, wl − 0.35)`, the air-side clamp `desired.y = max(desired.y, wl + 0.5)`, and the matching clamp in the TerrainCompressed probe. The eye now goes exactly where the chase geometry (follow distance, HEIGHT 1.1, springs) puts it; Tidewater's `post/Underwater.js` (LENS_REACH 0.35, per-pixel medium at the near plane, meniscus, composite) is untouched and reads the water height at the **camera** through Tidewater's own camera query slot (`query.setCamera(camera.position)` in `_frame`, as in `App.js`) — the dolphin-column wave height is only a presentation input (swell ride, crossing detector). Solid-geometry camera collision (terrain, reef, piles, dock) is unchanged. Airborne framing is the `BREACH_PULLBACK` on the follow distance. One real bug fixed on the way: the `SurfaceTransition` detector compared the rendered dolphin's y against y = 0, so the swell ride (rendered y = sim y + wave) fired it on every passing wave and the state machine never reported `SlowHover` at the surface (the 41/42 miss); it is now measured against the local waterline (identical arithmetic in the flat pool).

**Scenery additions (continuation).** `src/additions/SceneryAdditions.js`: per-category `Group`s under one `SceneryAdditions` group; instances drawn by a small `ScanInstances` class that reuses Tidewater's loaded `ScannedDebris` material, atlases and LOD geometry attributes (own `InstancedMesh`es + `iData`, same 22 / 70 / 260 m LOD banding) — no new textures or pipelines. Placement: mulberry32 with fixed seeds and fixed anchors; bare sand only (`Reef.structureAt` ≤ terrain), clear of the pier, pier head, boat dock (12 m), dolphin spawn (6 m) and the reef apron; depth bands 3.3–6.0 m (wood) and 2.3–4.5 m (shells). `?original` / `?enhanced`; Play tab control; `manifest()` exported to `eval/results/additions-manifest.json`. Sim and camera collision are untouched (the pieces are 0.3 m high on the floor, under the sim's 1.2 m seabed clearance and the camera's 0.75 m keep-out).

**Old CP05 / CP08 / CP09 systems.** Retired from the active experience; intact in `apps/shared-world/` (WaterThreeJS ocean port, terrain bake, zone atmosphere, cave shells). Not transplanted.

## 3. Visual proof (parity)

Same-pose stills through Tidewater's own `Bench.shots` (seeded RNG, dt = 0, 64 settle frames, 2560 × 1267, free camera 62°, exposure and lens droplets normalised identically in both apps), 31 views (Tidewater's 21 review cameras + 10 custom), plus 4 moving-water sequences × 6 frames. Metric: per-pixel MAD (0–255), PSNR, fraction > 8 and > 32; "identical" ≤ 0.004 MAD, "within noise" = the TAA / particle / wildlife jitter band the pristine app shows against itself. Files: `eval/results/parity/compare-*.json`, environment / bench JSON; full-resolution PNGs and diff images regenerate with `eval/capture.mjs` + `eval/compare.mjs` (gitignored). Apple M5 (Metal 3), Chrome 155, 1440 × 760 CSS window, render scale 1, exposure 0.55, "Breezy" sea.

| Comparison | Result |
|---|---|
| **A pristine vs Bhidden** (integrated, `?noDolphin&original`) | **31 / 31**: 9 identical (reefCoral ∞, underwater ∞, deepWater 89.8 dB, addWoodEast 85.9, causticsSun 79.6, sunset 77.4, addShellsBeach 73.5, deepBlue 69.6, sunGlitter 69.4), 22 within noise (MAD ≤ 0.08) |
| **Aseq vs Bhiddenseq** (surf / waterline / swash / underwater, 6 frames each) | **24 / 24** within noise (MAD 0.003–0.085) |
| **A vs B** (dolphin visible, `?original`) | identical to the above except **spawnArea** (MAD 0.30, PSNR 39.3, 2.06 % > 8): the dolphin in frame — the intended difference |
| **A vs E** (dolphin + additions) | 25 within noise, 6 identical; the only views that move beyond the Bhidden numbers are the two addition sites (**addWoodEast** MAD 0.044, **addShellsBeach** 0.069) and **causticsSun** (MAD 0.25, PSNR 37.5 — the shell drift lies in that view) plus spawnArea (the dolphin). Every ocean, waterline, sky, beach, surf, swash, village and reef view is unchanged: the additions do not touch the global ocean or underwater appearance |

Waterline: `test/waterline.mjs` (17 / 17) reads Tidewater's own medium target (`post.medium`, the per-pixel water / air classification the composite uses) through the chase camera: fully submerged (medium 1.00), fully above (0.00), lens at the surface (eye within ±8 cm of the local waterline, split frames 0.30–0.84 with air at the top row and water at the bottom, fully-in and fully-out frames between, 3 crossings in 6 s), a literally stationary lens with the swell ride off (eye moved 0.000 m, water fraction sweeps 0 → 1, 3 crossings), swimming at −1.15 m with the lens partly submerged, dive and ascent (4 crossings, continuous), breach (airborne, lens in air at the apex, Airborne → SurfaceTransition → ReEntryRecovery, continuous), the pier shallows (camera clearance ≥ 2.07 m, no EmergencyRecenter). The same lens pose and 55° lens on **pristine Tidewater's free camera** shows the same sweep (medium 0 → 0.98 → 1 → 0 → 0.52 over 7.5 s). Images: `eval/results/images/waterline-*.jpg` (`03-straddle-*` integrated vs `03-straddle-pristine-1`).

Known, intended differences: the dolphin itself; the fishing HUD absent until enabled; the Play tab; the start overlay / F1 sheet text; the two scenery groups when Enhanced is on. Recording artefact: `*-environment.json` logs the lens at page load (55° in B / E — the chase rig's; 62° in A); the bench shots themselves are taken at Tidewater's 62° free camera in every app, which the identical views confirm.

## 4. Dolphin verification

`test/play.mjs` — **42 / 42** (was 41 / 42; the `SlowHover` miss is fixed, see §2). Model: GLB loads, 8 clips, 17 joints, measured length **2.863 m** (2.89 ± 2 %), SwimForward on the first rendered frame (no rest pose), four additive layers advancing, Jump root translation stripped. Swimming: 10 one-shot kicks → 4.99 m/s cruise; burst 9 m/s with SwimForwardFast and FastTravel (follow distance 7.44 m); brake to < 0.5 m/s with `SlowHover`; banking turns with SwimRight additive and 0.10 × camera roll; dive to −5 m with 1.0 m seabed clearance; gentle surfacing to the −0.4 m soft ceiling with the swell ride; BreatheSurface after 2 s; breach (phase air, Jump clip, apex > 0.3 m, re-entry to SwimForward), camera Airborne / SurfaceTransition / ReEntryRecovery, continuous path; R recenter; beach approach contained (never leaves water, ≥ 1.55 m depth), reef crossing (no structure penetration, camera clearance ≥ 0.5 m, no EmergencyRecenter), pier piles (obstacle correction active); tracking loss → autopilot glide; body-input transport listening (BroadcastChannel + postMessage), nothing received without PosePuppet; fixed-step replay digest identical across runs and equal to the bare sim away from obstacles. Sim at 120 Hz (simHz 121). Kick scripting is now frame-rate independent (`test.kick`): the earlier 60 ms setIntent windows landed a frame-rate-dependent number of kicks.

Body input was exercised through the transport state only (no webcam, per the local rules); keyboard works without a camera.

## 5. Play modes and fishing

`test/modes.mjs` — **39 / 39**: fresh launch is Dolphin, fishing off, no fishing HUD, 55° lens, Tidewater player and boat idle (moored at the dock), stalls present; Dolphin → Walking through the Play tab's own control (walker on Tidewater's start at 53.6 / 2.83 / −77, camera at its eye, 62°, dolphin released and hovering in water, W moves the walker 3 m and gives the dolphin no kick / no acceleration, HUD "Walking"); Walking → Boat (`enterBoat`: helm, driven, unmoored, 3rd-person orbit 12.7 m, gauges on, W throttles 3.84 m in 3 s, V → helm camera); Boat → Dolphin (controlled, in water 5.3 m deep, camera 3.9 m behind, 55°, pointer unlocked, `leaveHelm` → walker standing on deck, engine off); 12 further switches: same world objects, same scene child count, same time of day, walker pose remembered on land; fishing on in Walking → Game updates, HUD + minimap shown, R equips Tidewater's rod; Dolphin with fishing on → inactive, rod away and hidden, HUD hidden, R never equips the rod; back to Walking → active again; fishing off → idle, HUD hidden, stalls remain.

Fishing restored = Tidewater's `Game` in full: rod and casting, bites and the fight, catch card, cooler / hold and log, Joe's stand (selling) and Marta's chandlery (upgrades, diesel), fuel burn and sonar on the boat, minimap, first-play guide and tips. Limitation (Tidewater's own): fishing is possible on foot, on the pier and on the boat's deck, not at the helm or while swimming — the menu's "Where" row says so.

## 6. Assets

**Considered — the user's downloaded collection on this machine**

| Candidate | Where | Licence | Verdict |
|---|---|---|---|
| Kenney Modular Cave Kit 1.0 (40 GLBs) | `apps/shared-world/authoring/assets/kenney-modular-cave-kit/` | CC0 | **Rejected** — low-poly flat-shaded style; mismatched beside Tidewater's photoscans and procedural reef |
| Flight-demo props (capybara, pyramid, statue, moon, hot spring, "eternal flame", low-poly whale…) | `apps/flight/client/public/3D/` | not recorded in this repo | **Rejected** — stylised, unrelated biome, provenance not documented here |
| Character rigs (Spider-Man ×3, Darth Vader, Batman, Iron Man, Shrek, Elsa, Olaf, Godzilla, King Kong, Xenomorph, Woody, Buzz, Jack Sparrow, Grogu, T-800, rigged hand, Teal) | `models_for_animation/`, `model-working/`, `model-audits/`, `~/Downloads` | Sketchfab, various | **Rejected** — not environment; a different art direction |
| Aircraft models (FlightGear-derived `fg-*`, `man-*`) | `~/Downloads/New Folder With Items 35/` | FlightGear content is GPL | **Rejected** — irrelevant and licence-incompatible |
| Dolphin FBX / USDZ / Blender variants | `~/Downloads/` | CC-BY (the same GAMICO asset) | not scenery; the shipped GLB stays |
| `catalog/BodyArcade_Placement_Sheet.xlsx` and model cards | — | — | **not present** on this machine (searched `~`, `/Volumes`, Spotlight); the only catalogue material here is the character model-audit set |

Nothing from the collection belongs beside Tidewater's realistic marine scene, and Tidewater's reef (seagrass meadows, algae, conchs, sponges, thirty-odd coral kinds), vegetation and wildlife already cover the "underwater vegetation / coral / land vegetation / ambient life" categories well — adding lower-quality substitutes would degrade them. Those categories are therefore left to Tidewater, by judgment.

**Selected — two restrained groups from assets already in Tidewater** (Poly Haven, **CC0 1.0**, `vendor/tidewater/public/models/debris/`, Tidewater's own LOD exports and material):

| Category | Assets | Count | Where | Rationale |
|---|---|---|---|---|
| Sunken driftwood (`sunkenWood`) | Dead Quiver Trunk, Dead Quiver Branch 01 / 02 | 11 (4 trunks, 7 branches) | east of the pier head on the sandy slope (~80, 64; 4.3–5.0 m) and west of the spawn lane (~−8, 32; 3.3–3.6 m) | waterlogged driftwood sinks in a bay fed by a wrack line; landmarks and fish shelter along the dolphin's cruising depth; the material's wet branch darkens and glosses it |
| Seabed shells (`seabedShells`) | Lambis Shell (scale 1.3–2.1 → 18–29 cm, a grown spider conch) | 30 in three drifts | shallow sand off the beach (~14, 24 / 36, 42 / −6, 20; 2.3–4.5 m) | eye-level detail in the shallows; the same shell is already in Tidewater's wrack line |

Deterministic manifest (asset id, path, source URL, licence, variant, position, YXZ rotation, scale, category, group, rationale): `eval/results/additions-manifest.json`. Optimisations: none needed (shared atlases / material / geometry; 3 + 3 draw calls per category, ~8 k and ~56 k processed triangles at the spawn view, 0 when off). Cost: bench GPU medians A / B / E at the beach 22.94 / 22.87 / 22.61 ms, underwater 14.81 / 15.20 / 15.14 ms, spawnArea 22.87 / 22.74 / 22.68 ms — within run-to-run noise. Images: `eval/results/images/additions-wood-near-{on,off}.jpg`, `modes-05/06-additions-*`, `parity-{A,E}-addWoodEast.jpg`, `parity-{A,E}-causticsSun.jpg`.

Remaining optional categories, not done (no suitable licensed source on this machine): additional coral / underwater plants from outside Tidewater, wrecks or structures, additional land vegetation, additional ambient animals. Tidewater's `props.json` set (crates, jerrycans, lifebuoy — CC0 per its credits) could become a "lost overboard" group under the pier head later; it would need the village `Builder` pipeline.

## 7. Performance

Apple M5 / Metal 3, Chrome 155, visible 1440 × 760 review window, render scale 1.

| | FPS (median, live) | CPU ms/frame |
|---|---|---|
| Pristine Tidewater, free camera at the beach (earlier `livefps.json`) | 80 | 1.47 |
| Dolphin mode, Enhanced | 77.5 | 2.30 |
| Dolphin mode, Original | 78.7 | 1.65 |
| Walking | 69.9 | 1.60 |
| Walking + fishing on | 69.7 | 1.87 |
| Boat (helm, 3rd person) | 73.9 | 1.72 |

Bench (Tidewater's `Bench.run`, 2560 × 1267, 120 measured frames, GPU median ms): beach A 22.94 / B 22.87 / E 22.61; pier 26.35 / 26.28 / 26.21; underwater 14.81 / 15.20 / 15.14; deepWater 18.02 / 17.83 / 17.83; aerial 25.49 / 24.84 / 24.97. Camera rig update < 400 µs (play.json). Sim 120 Hz in every run. Mode switch: no allocation of world systems (object identities unchanged); scene child count constant after 13 switches. No console errors in any suite.

## 8. Running the game

```sh
npm --prefix apps/tidewater-dolphin run dev      # → http://127.0.0.1:5199/
npm --prefix apps/tidewater-dolphin run pristine # → http://127.0.0.1:5189/  (pristine Tidewater, same pinned code)
node apps/tidewater-dolphin/review.mjs           # the dedicated review Chrome on the integrated app (--pristine for the baseline)
```

## 9. Unresolved issues

**Blocking defects:** none known.

**Visual differences requiring approval**
1. The chase camera on and across the surface (requested): the lens now sits at the mean waterline when the dolphin cruises ~1.1 m down and the waves wash over it exactly as they do over Tidewater's swimmer — including Tidewater's lens droplets after each emergence. This is the pristine behaviour, but it is a different feel from the old same-side hold.
2. Scenery additions on by default (Enhanced). Turn off from the Play tab or `?original` for the pristine scene.
3. The dolphin's chase lens is 55° (approved BodyArcade rig) against Tidewater's 62° for its own player / free camera; the lens switches with the owner.

**Optional, can wait**
- Tidewater's bench boat views (`boatHelm` / `boatFish`) assume the walker is the player; the integrated bench would need a mode switch before those two poses (not needed by the parity set).
- "Lost overboard" prop group under the pier head (see §6).
- A stored startup preference for the play mode was deliberately not added (the directive: fresh sessions start as the dolphin).

**Limitations of the source engine**
- Fishing only on foot / pier / deck (Tidewater's `Game.canFish`), not at the helm or while swimming.
- The split-waterline view appears only while the surface is within the lens's few centimetres (near 0.1 m × tan(fov/2)); with the swell riding the dolphin the lens is fully in or fully out whenever a crest or trough passes — identical to the pristine swimmer's eye.
- Tidewater's first-play fishing guide and tips (localStorage) open the first time fishing is enabled; `Esc` / Skip, or "Replay the guide" in the F1 sheet.
