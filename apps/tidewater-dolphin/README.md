# BodyArcade · Tidewater Dolphin (Checkpoint 10)

The GAMICO dolphin — BodyArcade's 120 Hz swim simulation, chase camera and PosePuppet body
input — swimming in **Tidewater** (Daniel Greenheck / DRG Software Solutions, MIT), used as the
host engine and world, unmodified. Tidewater is vendored at the pinned commit `4811ba4` under
`vendor/tidewater/` and imported in place; nothing under that directory is edited.

The dolphin is the default player. Tidewater's own walking, boat and (optional, off by default)
fishing are selectable from the **Play** tab of the settings panel, in the same running world.
An optional, reversible scenery layer (Poly Haven CC0 scans already in Tidewater) can be
compared against the pristine scene from the same tab.

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
```

A WebGPU browser is required (Chrome / Edge / Safari); the first load compiles several hundred
shaders (about a minute).

URL options: Tidewater's own (`?noAudio`, `?noClouds`, `?noHaze`, `?noCaustics`, `?noVeg`,
`?noSim`, `?fly`, `?bench`) plus `?noDolphin` (environment only — the parity captures),
`?original` (scenery additions off: the pristine scene exactly) / `?enhanced` (all on),
`?noSwellRide` (disable the presentation-only swell ride) and `?assist=full|standard|expert`.

## Play modes (settings panel → Play tab, `H`)

| Mode | Who | Camera | Controls |
|---|---|---|---|
| **Dolphin** (default) | BodyArcade dolphin, 120 Hz sim | BodyArcade chase rig (55°), free to sit on and cross the sea surface | Shift kick · W/S pitch · A/D bank · Q/E depth · Space burst · X brake · R recenter · 1/2/3 assist · PosePuppet body input |
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
hands forward to burst. Keyboard always wins while touched; tracking loss glides.

Tidewater's `T · L · M · H · P · F1 · F` (pause time · flashlight · mute · settings · photo mode ·
controls sheet · free review camera) work in every mode.

## Layout

| Path | Contents |
|---|---|
| `vendor/tidewater/` | Pristine Tidewater at `4811ba4` (MIT) + `BODYARCADE_SOURCE_RECORD.md` (SHA-256 manifest). Never edited. |
| `src/DolphinApp.js` | Derived copy of Tidewater's `App.js`: same systems in the same order; the dolphin as the default player beside Tidewater's Player / Game; play-mode ownership, fishing activity, scenery additions (diff in `eval/evidence/`). |
| `src/DolphinAppUI.js`, `src/main.ts`, `index.html`, `src/credits.ts` | Derived copies of `AppUI.js`, `main.js`, `index.html`; the Play tab; the F1 sheet with the dolphin controls and credits. |
| `src/dolphin/sim.ts`, `worldSampler.ts` | BodyArcade swim sim — byte-identical to `apps/shared-world`. |
| `src/input/swimControls.ts` | BodyArcade controls — one import path, a typing-field guard and an enable switch (the walker owns WASD in its modes). |
| `src/dolphin/cameraRig.ts` | BodyArcade chase camera — `three` → engine math; drives Tidewater's camera; the inherited waterline exclusion (anti-shimmer band, side lock, swim / air clamps) removed so the lens sits on and crosses the surface. |
| `src/dolphin/dolphinActor.ts` | The animation controller on Tidewater's GLTF loader / GPU skinning. |
| `src/dolphin/DolphinSkinnedModel.js` | Tidewater `SkinnedModel` + additive layers (three.js arithmetic). |
| `src/dolphin/tidewaterWorld.ts` | World sampler, obstacle correction and camera collision over Tidewater's terrain, reef and colliders. |
| `src/dolphin/dolphinPlayer.ts` | Orchestration (fixed-step loop, presentation, camera, control / resume for the play modes, eval handle `window.__TIDEWATER_DOLPHIN`). |
| `src/additions/SceneryAdditions.js` | The optional scenery layer: curation notes, deterministic placement, per-category groups, manifest. |
| `eval/` | Capture / comparison tooling, evidence, results and `CP10_REPORT.md`. `test/` — unit and live tests. |

## Tests

```sh
npm --prefix apps/tidewater-dolphin run test       # headless unit tests (tsx; no GPU): additive layers, sampler, sim, camera rig (no waterline exclusion)
node apps/tidewater-dolphin/test/play.mjs          # dolphin gameplay trials in the review window
node apps/tidewater-dolphin/test/waterline.mjs     # split-waterline trials (chase camera on / across the surface, pristine side-by-side)
node apps/tidewater-dolphin/test/modes.mjs         # play modes, fishing activity, scenery additions
node apps/tidewater-dolphin/eval/capture.mjs --target=pristine|dolphin-hidden|dolphin|enhanced --tag=…
node apps/tidewater-dolphin/eval/compare.mjs --a=A --b=Bhidden
```
