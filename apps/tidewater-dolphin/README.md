# BodyArcade · Tidewater Dolphin (Checkpoint 10)

The GAMICO dolphin — BodyArcade's 120 Hz swim simulation, chase camera and PosePuppet body
input — swimming in **Tidewater** (Daniel Greenheck / DRG Software Solutions, MIT), used as the
host engine and world, unmodified. Tidewater is vendored at the pinned commit `4811ba4` under
`vendor/tidewater/` and imported in place; nothing under that directory is edited.

The dolphin is the default player. Tidewater's own walking, boat and (optional, off by default)
fishing are selectable from the **Play** tab of the settings panel, in the same running world.
An optional, reversible scenery layer — Tidewater's own Poly Haven scans re-used, and (since the
asset-integration pass) models from the user's Ubuntu library placed at authored sites: seagrass
meadows, a kelp wall, a wreck, a drowned temple, wildlife, a lighthouse — can be compared against
the pristine scene from the same tab (**Original / Enhanced**, per category).

## Run

```sh
# integrated game (BodyArcade dolphin in Tidewater)
npm --prefix apps/tidewater-dolphin install        # once
npm --prefix apps/tidewater-dolphin run dev        # → http://127.0.0.1:5199/

# pristine Tidewater, the frozen visual baseline (same pinned code, untouched)
npm --prefix apps/tidewater-dolphin/vendor/tidewater install   # once
npm --prefix apps/tidewater-dolphin run pristine   # → http://127.0.0.1:5189/
```

Dedicated headed review window (the BodyArcade Chrome profile at `<repo>/.local/chrome-review-profile`,
real WebGPU, never the personal profile; camera access mocked off):

```sh
node apps/tidewater-dolphin/review.mjs             # integrated app
node apps/tidewater-dolphin/review.mjs --pristine  # pristine Tidewater
node apps/tidewater-dolphin/review.mjs --headless  # no window: Playwright's Chromium on its WebGPU adapter
                                                   # (TIDEWATER_WEBGPU_ADAPTER=swiftshader → Chrome's software
                                                   # adapter: slow, but Tidewater's real renderer; used in the cloud)
```

A WebGPU browser is required (Chrome / Edge / Safari); the first load compiles several hundred
shaders (about a minute).

URL options: Tidewater's own (`?noAudio`, `?noClouds`, `?noHaze`, `?noCaustics`, `?noVeg`,
`?noSim`, `?fly`, `?bench`, `?scale=0.5`) plus `?noDolphin` (environment only — the parity captures),
`?original` (scenery additions off: the pristine scene exactly) / `?enhanced` (all on),
`?noSwellRide` (disable the presentation-only swell ride) and `?assist=full|standard|expert`.

## Dolphin controls

Two schemes, chosen in the Play tab → **Dolphin Controls** → Scheme (stored in the browser).
**Modern** is the default: hold to swim, Ecco-inspired, with modern third-person conventions.

| | Modern (default) | Legacy BodyArcade |
|---|---|---|
| **Swim** | **Space** — hold to swim and keep speed, let go to glide; a tap is one tail stroke (a lunge) | **Shift** — tap = one kick, hold = a 1.6 Hz kick cadence |
| **Charge** | **Shift** — hold for the fast swim (9 m/s); release and it eases back to cruise | **Space** — burst |
| **Dive / climb** | **W** noses down, **S** noses up (Invert vertical flips) | W / S pitch |
| **Turn** | **A / D** — the dolphin banks on its own; tight when slow, wide when fast | A / D bank |
| **Brake** | **X** — slows to a hover in under a second | X |
| **Depth trim** | — (not needed: dive and climb) | **Q / E** |
| **Camera** | **V** cycles Follow · Remote · Surface; **R** recenters; drag the view (either mouse button) to look — the camera settles behind you again as you swim | same |
| **Assist** | **1 / 2 / 3** full · standard · expert | same |
| **Gamepad** (standard mapping) | left stick steers (forward = nose down) · **RT** swims — an analog trigger: squeeze gently to cruise slowly — or **A** · **LB** or **B** charges · **LT** or **X** brakes · right stick looks · **Y** or D-pad ◄ ► camera style · click the right stick to recenter · **Start** menu · **Back** controls sheet | left stick steers · A kicks · B bursts · X brakes · bumpers trim depth · right stick looks |
| **PosePuppet** | kick rhythm swims, lean pitches and banks, crouch / stretch trims depth, hands forward bursts (unchanged) | same |

Who owns the dolphin: between the keyboard and a gamepad, the one touched last — while it is held
and for a short hold-over afterwards. The camera keys, mouse look and the menu never take control
away from a pad. PosePuppet body input drives the dolphin only when neither is live (and only once
a body signal has actually arrived, or Input = Body); keyboard and a live pad always beat body
tracking; body-tracking loss glides. The dolphin needs neither a webcam nor a pad. Keys release on
window blur; Ctrl / Cmd / Alt chords are left to the browser.

Other Dolphin Controls: Input (Auto / Keyboard / Gamepad / Body), Camera style, Invert vertical,
Steering sensitivity, Look sensitivity, Camera distance, Chase field of view (55° default). The
`F1` sheet, the start overlay and the loader tips describe the same bindings.

Movement (the 120 Hz deterministic sim): holding Swim thrusts smoothly toward the held target
speed — rest to the 5 m/s cruise in about 1.4 s, an analog trigger holds 40–100 % of cruise —
and release is a long glide; charge accelerates to 9 m/s and, released, eases back to cruise
(never a step); a tail-stroke tap may lunge up to 1 m/s past cruise; the brake stops cruise to a
hover in ~0.8 s; turning banks the body with speed-shaped authority (≈ 80°/s at cruise, ≈ 110°/s
slow), so braking into a turn tightens it; speed plus a nose-up near the surface breaches (dive a
little, then hold S).

Camera styles: **Follow** (default) stays close behind; swimming shallow, the lens sits just under
the mean surface (≈ 0.1 m) so Tidewater's waves cross it both ways and the split above / below
view appears every wave. **Remote** is a looser, more cinematic follow. **Surface** puts the lens
≈ 0.1 m above the mean — the swimmer's eye, waves washing over it. All three are Tidewater's own
near-plane waterline rendering; nothing pins the camera to a wave.

## Play modes (settings panel → Play tab, `H`)

| Mode | Who | Camera | Controls |
|---|---|---|---|
| **Dolphin** (default) | BodyArcade dolphin, 120 Hz sim | BodyArcade chase rig (55° default), free to sit on and cross the sea surface | Modern scheme above (Space swim · WASD · Shift charge · X brake · V / R camera · drag look · 1/2/3 assist) · gamepad · PosePuppet body input · Legacy scheme optional |
| **Walking** | Tidewater's walker / swimmer | Tidewater first person (62°), click the view for mouse look | WASD · Shift sprint · Space jump / swim up · C dive · E board the boat, ladders, trade |
| **Boat** | Tidewater's boat at the helm | Tidewater helm / 3rd-person orbit (V) | W/S throttle · A/D steer · Shift boost · E leave the helm / step ashore |

One controller owns the input and the camera at a time; switching never rebuilds the world
(ocean, FFT, sky, terrain, reef, whale, wildlife, audio and the dolphin rig are the same objects
before and after). Leaving the dolphin leaves it hovering where it was; returning to it resumes
there with the camera snapped behind it. Walking off the boat uses Tidewater's own step-ashore
target when there is one, else the spot where the walker was last on foot (first time:
Tidewater's start on the boardwalk). Fresh sessions always start as the dolphin.

**Fishing gameplay** (Play tab, default **off**): Tidewater's own fishing — rod (R), casting,
bites, the fight, catch card, cooler / log (I), Joe's fish stand and Marta's chandlery, fuel and
sonar on the boat, minimap and first-play guide. It only runs in Walking / Boat; in Dolphin mode
the line comes in, the rod goes away and its HUD is hidden (the session's progress is kept). The
stalls and vendors are scenery in every mode, fishing on or off.

**Scenery additions** (Play tab → Original Tidewater / Enhanced, per category): sunken driftwood
on the bay floor and shell drifts on the shallow sand — Poly Haven CC0 scans that Tidewater
already ships, drawn with its own material and LOD pipeline, deterministic placement
(`eval/results/additions-manifest.json`). Both off == the pristine scene exactly.

PosePuppet body input works unchanged through `@bodyarcade/body-input` (same-origin
BroadcastChannel / postMessage): kick rhythm, lean to pitch and bank, crouch / stretch for depth,
hands forward to burst.

Tidewater's `T · L · M · H · P · F1 · F` (pause time · flashlight · mute · settings · photo mode ·
controls sheet · free review camera) work in every mode.

## Scenery additions (asset-integration pass)

Play tab → **Scenery additions**: Original (exactly the pristine scene) or Enhanced, and a toggle
per category. Everything is deterministic (seeded), additive, and keeps every solid top below
−2.5 m so the dolphin's swimmable mask is the same either way; the solid structures join the
contact surface the dolphin, the camera, the walker and the fish use (`SceneryAdditions.ground`
/ `.floor`). Start with everything on: `http://127.0.0.1:5199/?enhanced` (`?original` for the
pristine scene).

| category | where | what (source, licence) |
|---|---|---|
| Sunken driftwood · Seabed shells | bay floor east of the pier · shallows off the beach | Tidewater's own Poly Haven scans (CP10 continuation) |
| Seagrass meadows | the shallow bay floor east of the spawn (5–8 m) and the east plateau | Sea Weed clumps (rkuhlf, CC-BY), a sunken skiff (AnyRPG, CC0), algae rocks (CC0) |
| Kelp wall | the east wall of the deep channel, x 54–76 / z 94–134, 7–13 m | Animated Kelp (JosephWPugsley, CC-BY), Kelp thickets (Mazelya, CC-BY), weed, photogrammetric boulders (Yughues, CC0) |
| The wreck | the foot of the wall, (56, 114), 12.9 m | Fantasy Fishing Boat (eb78, CC-BY) — sail and oars gone, heeled, weed-grown |
| Drowned temple | a colonnade from the channel floor (11 m) into the basin (18 m), the temple at (4.5, 156) | Medieval Stone Temple (AnyRPG, CC0), Ancient columns (OdinTdh, CC-BY), Broken Stone Slab (Kutejnikov, CC0), Figure Head (DaGameKnower, CC0), cathedral ruins and boulders (Ron Kapaun / Yughues, CC0) |
| Added wildlife | the spawn meadow · the wall and the wreck · the two sites | manatee pair (DevMops, CC0), hammerhead (STKRudy85, CC0), reef-fish communities made of Tidewater's own fish |
| Lighthouse & shore scrub | the eastern headland (226, 136) · the back-beach at both ends of the beach | 3TD Harbour Pack lighthouse (Ron Kapaun, CC0), Poly Haven shrubs, branches, bark (CC0) |

Provenance, licences, lab paths and checksums: `public/models/additions/manifest.json` and
`CREDITS.md`; conversion tooling: `tools/assets/` (`convert.mjs`, recipes, `thumbs.mjs`,
`credits.mjs`); the pass report: `eval/ASSET_PASS_NOTES.md`. Staged assets for future games (not
loaded here): `assets/future-games/` at the repository root.

## Layout

| Path | Contents |
|---|---|
| `vendor/tidewater/` | Pristine Tidewater at `4811ba4` (MIT) + `BODYARCADE_SOURCE_RECORD.md` (SHA-256 manifest). Never edited. |
| `src/DolphinApp.js` | Derived copy of Tidewater's `App.js`: same systems in the same order; the dolphin as the default player beside Tidewater's Player / Game; play-mode ownership, fishing activity, scenery additions (diff in `eval/evidence/`). |
| `src/DolphinAppUI.js`, `src/main.ts`, `index.html`, `src/credits.ts` | Derived copies of `AppUI.js`, `main.js`, `index.html`; the Play tab with Dolphin Controls; the F1 sheet with the dolphin controls and credits. |
| `src/dolphin/sim.ts`, `worldSampler.ts` | BodyArcade swim sim (120 Hz, deterministic). CP10 controls pass: hold-to-swim thrust toward a held target, caps govern thrust and overspeed bleeds, softer brake. |
| `src/input/swimControls.ts`, `src/input/controlPrefs.ts` | Keyboard / mouse / gamepad / body input → intents; source arbitration; the two control schemes; preferences and the binding text the interface shows. |
| `src/dolphin/cameraRig.ts` | BodyArcade chase camera — `three` → engine math; drives Tidewater's camera; no waterline exclusion; surface skim (eye near the mean when shallow); Follow / Remote / Surface styles; look orbit that returns behind the dolphin. |
| `src/dolphin/dolphinActor.ts` | The animation controller on Tidewater's GLTF loader / GPU skinning. |
| `src/dolphin/DolphinSkinnedModel.js` | Tidewater `SkinnedModel` + additive layers (three.js arithmetic). |
| `src/dolphin/tidewaterWorld.ts` | World sampler, obstacle correction and camera collision over Tidewater's terrain, reef and colliders. |
| `src/dolphin/dolphinPlayer.ts` | Orchestration (fixed-step loop, presentation, camera, control / resume for the play modes, eval handle `window.__TIDEWATER_DOLPHIN`). |
| `src/additions/SceneryAdditions.js` | The optional scenery layer: curation notes, deterministic placement, per-category groups, manifest. |
| `eval/` | Capture / comparison tooling, evidence, results, `CP10_REPORT.md` and `CP10_CONTROLS_CAMERA_PASS.md`. `test/` — unit, controls and live tests. |

## Tests

```sh
npm --prefix apps/tidewater-dolphin run test       # headless, no GPU: unit (additive layers, sampler, sim, camera rig) + controls scenarios
npm --prefix apps/tidewater-dolphin run test:unit
npm --prefix apps/tidewater-dolphin run test:controls   # synthetic keyboard / mouse / gamepad / body events through the real sim and rig
npm --prefix apps/tidewater-dolphin run build      # tsc --noEmit + vite build

# live suites (review window up: node review.mjs, or node review.mjs --headless)
node apps/tidewater-dolphin/test/play.mjs          # dolphin gameplay trials (eval handle)
node apps/tidewater-dolphin/test/controls-live.mjs # the same scheme through real key events and a simulated gamepad
node apps/tidewater-dolphin/test/waterline.mjs     # split-waterline trials (chase camera on / across the surface, pristine side-by-side)
node apps/tidewater-dolphin/test/modes.mjs         # play modes, fishing activity, scenery additions
node apps/tidewater-dolphin/eval/capture.mjs --target=pristine|dolphin-hidden|dolphin|enhanced --tag=…
node apps/tidewater-dolphin/eval/compare.mjs --a=A --b=Bhidden
```

The live suites pace themselves on the world clock (game time), so they run the same way at 70 fps
on an Apple GPU and at 1 fps on a software adapter. Environment variables: `TIDEWATER_DOLPHIN_URL`
/ `TIDEWATER_PRISTINE_URL` (default `http://127.0.0.1:5199` / `:5189`), `TIDEWATER_URL_FLAGS`
(extra query flags, e.g. `scale=0.5`), `TIDEWATER_RESULTS_DIR` (default `eval/results`; the committed
Mac results stay as the baseline when a different machine writes elsewhere).
