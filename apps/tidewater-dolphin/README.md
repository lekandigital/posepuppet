# BodyArcade · Tidewater Dolphin (Checkpoint 10)

The GAMICO dolphin — BodyArcade's 120 Hz swim simulation, chase camera and PosePuppet body
input — swimming in **Tidewater** (Daniel Greenheck / DRG Software Solutions, MIT), used as the
host engine and world, unmodified. Tidewater is vendored at the pinned commit `4811ba4` under
`vendor/tidewater/` and imported in place; nothing under that directory is edited.

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
`?noSwellRide` (disable the presentation-only swell ride) and `?assist=full|standard|expert`.

## Controls

| Key | Action |
|---|---|
| Shift | Kick (tap = one kick, hold = steady rhythm) |
| W / S | Pitch: dive / surface |
| A / D | Bank and turn |
| Q / E | Depth trim up / down |
| Space | Burst (9 m/s) |
| X | Brake to a hover |
| R | Recenter the chase camera |
| 1 / 2 / 3 | Assist: full / standard / expert |
| F | Tidewater's free review camera (the dolphin waits) |
| T · L · M · H · P · F1 | Tidewater: pause time · flashlight · mute · settings · photo mode · controls sheet |

PosePuppet body input works unchanged through `@bodyarcade/body-input` (same-origin
BroadcastChannel / postMessage): kick rhythm, lean to pitch and bank, crouch / stretch for depth,
hands forward to burst. Keyboard always wins while touched; tracking loss glides.

## Layout

| Path | Contents |
|---|---|
| `vendor/tidewater/` | Pristine Tidewater at `4811ba4` (MIT) + `BODYARCADE_SOURCE_RECORD.md` (SHA-256 manifest). Never edited. |
| `src/DolphinApp.js` | Derived copy of Tidewater's `App.js`: same systems in the same order; the walker and fishing game replaced by the dolphin (diff in `eval/evidence/`). |
| `src/DolphinAppUI.js`, `src/main.ts`, `index.html` | Derived copies of `AppUI.js`, `main.js`, `index.html`. |
| `src/dolphin/sim.ts`, `worldSampler.ts` | BodyArcade swim sim — byte-identical to `apps/shared-world`. |
| `src/input/swimControls.ts` | BodyArcade controls — identical except one import path. |
| `src/dolphin/cameraRig.ts` | BodyArcade chase camera — `three` → engine math; drives Tidewater's camera. |
| `src/dolphin/dolphinActor.ts` | The animation controller on Tidewater's GLTF loader / GPU skinning. |
| `src/dolphin/DolphinSkinnedModel.js` | Tidewater `SkinnedModel` + additive layers (three.js arithmetic). |
| `src/dolphin/tidewaterWorld.ts` | World sampler, obstacle correction and camera collision over Tidewater's terrain, reef and colliders. |
| `src/dolphin/dolphinPlayer.ts` | Orchestration (fixed-step loop, presentation, camera, eval handle `window.__TIDEWATER_DOLPHIN`). |
| `eval/` | Capture / comparison tooling, evidence and results. `test/` — unit and gameplay tests. |

## Tests

```sh
npm --prefix apps/tidewater-dolphin run test       # headless unit tests (tsx; no GPU)
node apps/tidewater-dolphin/test/play.mjs          # gameplay trials in the review window
node apps/tidewater-dolphin/eval/capture.mjs --target=pristine|dolphin-hidden|dolphin --tag=…
node apps/tidewater-dolphin/eval/compare.mjs --a=A --b=Bhidden
```
