# BodyArcade Open World (V4)

One compact real-world region — **Ísafjörður, Iceland** — where the body
flies a plane, walks, rows, and (low-poly only) swims as the dolphin.
Three renderer/content profiles over the SAME baked geographic data.
An expansion beside TinySkies, never a replacement: TinySkies remains
the whimsical globe toy; this is the location-based open world.

## Run

```
cd apps/openworld && npm install && npm run dev -- --port 5176 --strictPort
# http://localhost:5176/openworld/
```

URL parameters: `?profile=low-poly|realistic|fantasy-game` ·
`?mode=flight|walk|row|dolphin|flyover` · `?drive=flylap|flyloss|
walkroute|walkloss|rowcircuit|swim` (synthetic closed-loop body drive,
no camera) · `?hud=0` (skip pose runtime). In-page selector chips cover
profile/mode too.

## Shape

- **`src/world/runtime.ts`** — the only geographic authority: baked
  terrain (+ deterministic bathymetry carve, coastal conditioning,
  airfield flattening — the DEM carries no fjord depths at 66°N),
  water containment, shore SDF, nav.walk PathHint, nav.row lattice,
  spawns, transitions, region-edge distance, and `battery()` — the
  cross-profile consistency contract.
- **`src/modes/`** — sims consuming WorldRuntime + the COMPLETED
  control systems, reused at their seams: TinySkies
  `BodyFlightControls`/`FlightControls`, `RowingControls`, V3
  `@bodyarcade/locomotion`, and the PS2 Dolphin `SwimSim` (one
  default-compatible constructor seam; its standalone app stays green).
  Transitions are honest fade + spawn handoffs at baked points
  (TRANSITIONS.md).
- **`src/profiles/`** — renderer/content packs, geography-blind:
  `lowpoly` (PS2-adjacent, ships the dolphin), `realistic` (subarctic
  light/materials/water/birch), `fantasy` (whimsical diorama: dusk
  palette, glowing windows, smoke, sailboats, windmill + lighthouse
  placed from data, a faint aurora). The battery spec asserts identical
  geographic answers under every profile.
- **V1 Runtime+HUD** mounted on the page: no PosePuppet tab, camera
  denied leaves every mode fully keyboard-playable.

## Verification

`npm test` (23 specs: per-mode closed loops through the real body-input
chain, transitions, consistency, keyboard parity, containment).
Perf boards: `DISPLAY=:2 node perf.mjs <profile>` (headed, display
lock) → `eval/openworld-results.json` + `.shots/board/`. See
EVAL_NOTES.md §V4 and REUSE_MAP.md / PLAN.md / TRANSITIONS.md /
ASSET_CONTRACT.md in this directory.

Map data © OpenStreetMap contributors (ODbL); elevation from Mapzen/AWS
Terrain Tiles — attribution renders on-screen, inside the artifact, and
in DATA_SOURCES.md.
