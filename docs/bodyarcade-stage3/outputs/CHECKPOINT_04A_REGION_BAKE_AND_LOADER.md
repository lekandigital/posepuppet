# CHECKPOINT 04A — Region Bake and Loader

## 1. Header

Checkpoint 04A (first half of the master-ladder checkpoint 4, split per the Implementation Master §9: the baked dataset is the input to the water container swap, and the two systems exceed one session). Scope: turn the approved sketch into the committed baked-data artifacts, build the runtime loader, re-point the sim's `WorldSampler` at the authored region, and show a graybox terrain preview. **No water changes.**

## 2. Preconditions and starting state

- Checkpoint 03 approved with a chosen/redlined sketch, recorded verbatim in `apps/shared-world/authoring/REGION_SKETCHES.md` § "APPROVED LAYOUT".
- Branch `shared-world-slice` at the 03-approved commit; tree clean.

## 3. In scope

1. `apps/shared-world/authoring/bake-region.mjs` — committed, **seeded, deterministic** bake implementing the APPROVED LAYOUT exactly, using THREE.Terrain (MIT) algorithms + explicit authored stamps; optional ProceduralTerrains-exported 1024² PNG as a seed input (its heightmap export is verified; do not depend on its GLB export).
2. The seven baked artifacts at `apps/shared-world/public/world/` per Master §2.3 (`height.r16` 2049², `shore.png`, `shore_sdf.r16`, `biome.png` 1025², `placement.json`, `caves.json`, `world.json`), committed.
3. `src/world/WorldData.ts` loader: decode heightmap → Float32; `terrainHeight(x,z)` bilinear; `inWater`, `shoreDistance` (from `shore_sdf.r16`), `depthAt = max(0, −terrainHeight)`; artifact-header validation; authored attribution lines carried from `world.json`.
4. `RegionSampler` implementing `WorldSampler` over `WorldData`; `?view=region-preview`: graybox terrain render (single mesh or coarse chunks, provisional tints per Master R14: submerged #D2C7A9, exposed #A98F6C, matte Lambert), free-orbit dev camera, sea-level reference grid at y 0 — an engineering view, explicitly not the game look.
5. Sim-side re-point tests: the 8-direction containment battery and depth clamps run against `RegionSampler` (headless-in-page via `runScript`; the pool view still runs on `PoolSampler` until 04B).
6. Commit.

## 4. Out of scope

- **No water system changes whatsoever** (the pool view is untouched; the region has no water yet — the preview shows terrain + a reference grid, not a rendered sea).
- No final terrain material/LOD (cp05), no caves geometry (cp09 — `caves.json` records sites/transforms only), no placeholder blocks (cp07), no Rapier (cp09).
- No deletion of `PoolSampler` yet (cp04B swaps the game view).

## 5. Required inputs

- Implementation Master §2 (world contract + schema), §5.1 (authoring/bake), R12–R14.
- `REGION_SKETCHES.md` § APPROVED LAYOUT (the single layout authority).
- Track B report: TERRAIN section (Tables 6–7, Q14 data flow), Table 10 (texel mapping), Table 11.
- Track A report §4.3 (the `WorldSampler` re-point contract; sign note: `depth = seaLevel − terrainHeight`).
- npm: `three.terrain.js` (IceCreamYou/THREE.Terrain 2.0.0, MIT) as an authoring-scope dev dependency (record exact version).

## 6. Deterministic implementation specification

### 6.1 Bake

- Fixed seed constant in the script (any integer, committed; changing it is a layout change requiring re-approval).
- Compose height: start from the approved sketch's masses (each island/shelf/trench/lagoon stamped at its approved coordinates with smoothstep falloffs), then bounded THREE.Terrain noise passes for natural variation (amplitude ≤ 15 % of local relief [DERIVED bound: variation must never move a coastline off the approved layout by > 25 m — assert in §8]), then clamp to [−80, +200].
- Derive: `shore.png` = height ≥ 0; `shore_sdf.r16` = signed Euclidean distance transform of that mask × texel size (meters, + = water, clamped ±500 m); `biome.png` channels = the approved zone-family areas rasterized (channel table written into `world.json`); `placement.json` = every approved site (ruins, landmarks, cave mouths, spawn, breach sightlines) with `{category, type, x, z, yaw, scale}`; `caves.json` = cave/arch module sites + seam metadata (module IDs assigned at cp09, transforms fixed now); ridge/silhouette-line flags for cp05's LOD protection (coastline tiles derived from `shore.png`; ridge lines traced from the approved sketch's landmark masses) written into `world.json`; `world.json` = origin/size/seaLevel/heightRange/spawn/zone table/ridge flags/attribution ("Region: original BodyArcade authored terrain, 2026").
- Byte-determinism: running the bake twice produces identical files (no `Math.random`, no date stamps inside artifacts).

### 6.2 Loader and preview

- `WorldData.decode` validates magic/size fields from `world.json`; throws on mismatch. Bilinear `terrainHeight`; nearest `inWater`; bilinear `shoreDistance`.
- Preview mesh: 512² grid over the region (≈ 3.9 m step — preview-grade), vertex y from `terrainHeight`, vertex color by the R14 tints with shoreline blend over ±0.5 m; `MeshLambertMaterial({ vertexColors: true })`; one DirectionalLight + hemisphere; fog off (engineering view); stats overlay (fps, camera pos, height under cursor).
- Spawn marker + approved-loop polyline drawn from `placement.json` (line segments, dev-view only).

## 7. Demo

```bash
node apps/shared-world/authoring/bake-region.mjs      # regenerate artifacts (byte-identical)
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region-preview
# → http://localhost:5198/shared-world/?view=pool     (unchanged)
```

Expected: the approved layout recognizably realized in 3D graybox — islands where the sketch put them, lagoon/shelf/trench reading correctly, summit at +200 m, hypsometric tints, spawn and loop markers. Orbit freely; the height-under-cursor readout matches the depth annotations.

## 8. Automated verification

1. Bake determinism: two runs → identical SHA-256 per artifact.
2. Schema: sizes/ranges (2049², min ≥ −80, max ≤ +200, sea-level sign test consistency between `height.r16` and `shore.png` on 10 000 sampled texels).
3. Layout fidelity: for each approved element, sampled assertions — island centroids within 50 m of sketch coordinates; trench floor ≤ −70 m; lagoon depth 3–10 m over ≥ 80 % of its area; summit within 25 m of the marked peak and ≥ +195 m; coastline deviation bound ≤ 25 m vs the sketch mask (IoU ≥ 0.92 on the shore mask [DERIVED tolerance, flagged]).
4. SDF spot-checks: `shoreDistance` sign matches `inWater` on 1 000 samples; gradient magnitude ≈ 1 ± 0.15.
5. Containment battery re-pointed: 8 yaw directions × 11 s full burst from spawn against `RegionSampler` — never exits water, `minShore > −0.5`, min speed > 0.5 m/s [restated for the 5/9 family], max decel per 200 ms < 3.5 m/s [DERIVED from old 6 × (9/22) ≈ 2.5, relaxed to 3.5 — flagged].
6. Loader round-trip: `terrainHeight` at 20 fixed probe points matches the bake's own sampler within 0.01 m.
7. Preview boots with no console errors; `fps ≥ 58` orbiting the full region in the preview.
8. Pool suite from cp01/02 still green (nothing regressed).

## 9. Manual review procedure

1. Orbit the preview against the approved sketch side-by-side; confirm every mass, site marker, and the loop are where you approved them; redline anything that drifted.
2. Check the depth readouts at the annotated spots (lagoon/shelf/trench).
3. Rule on flagged tolerances (coastline IoU, containment decel bound) if the defaults bothered you.

## 10. Performance-report requirements

Preview fps (orbit script), artifact sizes on disk (heightmap ~8 MB expected), decode time, memory for the decoded Float32 field.

## 11. Placeholder inventory requirements

Report the `placement.json` census: sites per category that will become placeholder blocks at cp07 (counts + categories). No blocks exist yet — say so.

## 12. Deviation-report requirements

Any divergence from the approved layout (with the fidelity numbers), any schema deviation from Master §2.3, all [DERIVED] tolerances used, and the exact seed + tool versions (reproducibility line).

## 13. Guardrails

- The approved sketch is the layout authority — the bake reproduces it; it does not improve it.
- No water changes; no vendored edits; `?view=stock` and `?view=pool` byte-identical in behavior.
- Bake-don't-generate: runtime only loads; all generation is offline, seeded, committed.
- No invented assets (graybox is debug geometry); no Rapier yet; packages untouched (the app has its own loader — R8).
- Local-only; suite never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, layout-fidelity numbers, artifact manifest, performance, placeholder census, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
