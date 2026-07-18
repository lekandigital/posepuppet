# CHECKPOINT 10 — Vegetation Bakes

## 1. Header

Checkpoint 10: SeedThree offline bakes replace the vegetation placeholders — kelp, seagrass, and (budget permitting) branching coral underwater; trees, shrubs, grass on exposed land — instanced at the placeholder positions with a small vertex-sway shader (current below water, wind above). SeedThree runs as an **offline authoring tool only**; the runtime consumes baked glTF (the WebGPU conflict is thereby irrelevant).

## 2. Preconditions and starting state

- Checkpoint 09 approved. Branch `shared-world-slice` at the 09-approved commit; tree clean.
- SeedThree is pre-approved (MIT, verified; swap-if-too-costly clause active). Its generated *textures* are not clean for redistribution (gpt-image-2 provenance) — bakes are re-textured with CC0/own maps per Track C §5.
- **Asset approval (async gate):** the specific CC0 re-texture downloads (Poly Haven / ambientCG picks) are user-approved **before** any file enters the repo (live license-page verification recorded in CREDITS.md); any non-SeedThree vegetation fallback likewise requires per-item approval. Raise these requests as early as ready.

## 3. In scope

1. SeedThree authoring sessions producing baked `.glb` sets (with LOD chains where the generator provides them) into `apps/shared-world/public/models/vegetation/`: `veg_seagrass_01`, `veg_kelp_01`, `veg_tree_01..02`, `veg_shrub_01`, `veg_grass_01`; branching coral `veg_coral_01` **only within the effort budget** (Track C: seagrass ~0.5 day; kelp ~1 day; coral 2–3 days — if coral exceeds its budget, invoke the swap clause: fall back to a Track C coral candidate **with user approval**, or leave coral as placeholder and record it).
2. Re-texture every bake with CC0 sources (Poly Haven / ambientCG; exact IDs + license checks in CREDITS.md) or flat authored color cards, treated per Track D §10 (matte, value-grouped, 1K cards, alpha-tested foliage).
3. Instanced placement: per-category InstancedMesh sets consuming the exact placeholder transforms (scatter fields from cp07 — same seeds, same counts; the placeholder census converts categories, not layouts).
4. Vertex-sway shader: below water = slow current sway (the mesqme sine + scrolling-noise technique); above water = wind sway; amplitude/frequency per category [values REC-class, flagged]; base/tip color-lerp fake AO.
5. LOD/impostor wiring where the bake provides it; distance fade consistent with fog.
6. Commit.

## 4. Out of scope

- No new placement sites or density changes (cp07's approved fields stand); no fish/wildlife (cp11); no rocks (rocks remain placeholders until their category converts at cp12-adjacent approval or stays for ship — record).
- No SeedThree code vendored into the runtime; no WebGPU anywhere.
- No generated textures shipped (provenance rule); no purchases (SpeedTree/paid packs are labels only).

## 5. Required inputs

- Implementation Master §8.2 (pipeline/budgets), §5.4 (instancing/wind techniques), §6.4 (material locks).
- Track C report §5 (SeedThree evaluation, efforts, swap clause), §3 vegetation tables (fallback candidates), §8 (naming/paths).
- Track D report §10 (texture treatment), table 6.2 vegetation hues per family (kelp #3F9C38, algae #4E8F46, magenta accents #C05A9E — tint targets).
- SeedThree: `github.com/SkyeShark/SeedThree` (MIT recorded); CC0 texture sources.
- cp07 scatter fields + census.

## 6. Deterministic implementation specification

- Bake reproducibility: each species' generator preset file committed under `apps/shared-world/authoring/seedthree-presets/`; the bake session recorded (preset → output glb hash) in `authoring/VEGETATION_BAKES.md`.
- Budgets: vegetation textures ≤ 1K; per-instance triangle targets — grass/seagrass card clusters ≤ 300 tris LOD0; kelp strand ≤ 800; tree ≤ 3 000; coral ≤ 1 500 [DERIVED from the objects budget & instance counts; flagged].
- Kelp: tall swaying strands (blade cards, uniform width — the Track D flat-card read); height 3–5 m matching the placeholder envelope.
- Sway: underwater amplitude 0.15 m at blade tip, period 4–7 s with per-instance phase hash; wind above water amplitude 0.1 m, period 2–4 s [REC-class, flagged]; sway is vertex-shader only (no physics).
- Instancing: reuse cp07 transforms exactly; conversion = swap block → bake per category; census updates conversions.
- Material locks: Lambert-class, metalness 0, roughness ≥ 0.95, alpha-test 0.5 for cards; foliage translucency only if the baked material ships it and it survives the banned-modes audit (no glow).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: reefs carry swaying kelp stands and seagrass meadows; island shores turn green with trees/shrubs/grass; motion is calm and current-like below, breezy above; coral either baked (if within budget) or honestly still orange blocks; everything reads inside the zone fog with no sparkle or gloss.

## 8. Automated verification

1. Census diff: vegetation categories converted (counts identical to cp07's blocks per category); coral status explicit (converted / swapped / still-placeholder).
2. Transform fidelity: sampled instances match cp07 transforms exactly (hash).
3. Sway budget: vertex-shader-only (no per-frame CPU transform writes); GPU cost of vegetation ≤ 1.5 ms at the densest reef station [budget line, flagged].
4. Material audit: metalness/roughness/alpha-test locks; no emissive; textures ≤ 1K; no generated-texture provenance in the shipped set (bake manifest lists every texture's source + license).
5. Above/below sway modes switch at y 0 (scripted capture at a shoreline shows both).
6. Four-shot re-run unchanged; zone shots re-taken for reef families (vegetation now in-frame); suites green.
7. `simHz > 100`; sustained median `fps ≥ 58` at the densest station.

## 9. Manual review procedure

1. Swim the reef loop: kelp/seagrass motion feel (Ecco calm, not storm); density vs the approved composition; silhouettes through fog.
2. Surface at a lush island: shoreline vegetation read from the water (the breach view depends on this).
3. Coral ruling: accept the bake, approve a swap candidate, or keep placeholder for now.
4. Rule on flagged sway/budget values.

## 10. Performance-report requirements

Frame-budget with the vegetation line; instance/triangle totals per category; fps at densest reef + lush shoreline; texture memory; delta vs 09.

## 11. Placeholder inventory requirements

Census diff table (converted categories, remaining categories — rocks, ruins, buildings, wrecks, fish schools, large animals still blocks). Every conversion lists asset name, source, license, CREDITS.md line.

## 12. Deviation-report requirements

Effort spent per species vs the Track C estimates; swap-clause invocations; all [REC]/[DERIVED] sway/budget values; any preset that couldn't hit its silhouette target.

## 13. Guardrails

- SeedThree geometry only + clean textures (CC0/own); MIT notice in THIRD-PARTY/CREDITS; no generated-texture redistribution; purchase nothing.
- Placements/densities immutable (approved at 07); look changes beyond vegetation itself are out of bounds; four-shot must stay clean.
- Placeholders that remain must stay obviously placeholders.
- Local-only; deterministic (hashed phases, no RNG); tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, bake manifest, census diff, captures, performance, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
