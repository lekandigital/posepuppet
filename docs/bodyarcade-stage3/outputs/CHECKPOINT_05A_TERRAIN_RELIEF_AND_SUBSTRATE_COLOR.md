# CHECKPOINT 05A — Terrain Relief and Substrate Color Rework

## 1. Header

Checkpoint 05A (inserted after the approved CP05 by the post-CP05 addendum §3–§4): transform the approved-but-too-smooth Twin Bay heightfield into a sharper, rougher, more geological landscape via a **deterministic offline rebake** adapting ZyFou/ProceduralTerrains relief techniques, while preserving the approved world layout, baked-data architecture, height authority, runtime LOD system, water integration, and collision/query behavior — and replace the provisional two-tint terrain treatment with one shared deterministic **substrate classification and color system** for exposed land and underwater terrain. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full; it wins over the master and this prompt wherever they conflict).

## 2. Preconditions and starting state

- Checkpoint 05 approved (`8ca67cc75eeefaf4593abe042ad6a5cdb3155247` in ancestry) and the post-CP05 documentation commit present.
- Branch `bodyarcade-shared-world` (the branch the master's `shared-world-slice` name refers to) at the user-designated starting commit; tree clean.
- Required reading, in full, before modifying anything: the addendum; this prompt; master §2, §5, §9–§11 and R13–R14; `apps/shared-world/authoring/REGION_SKETCHES.md` § APPROVED LAYOUT; the CP04A/04B/05 prompts; and the ZyFou study set below.
- **ZyFou study set** (read-only snapshot at `docs/bodyarcade-stage3/references/zyfou-procedural-terrains/`, pinned commit `8b396f9c784676d46f6a147d310d9f547bf41403`; addendum §4.2 — study the files *and their connected call paths*, do not copy a few constants):
  `src/project/ProjectTemplates.js`, `src/engine/presets.js`, `src/engine/terrain/terrainGLSL.js`, `src/engine/terrain/biomeGLSL.js`, `src/engine/terrain/TerrainMaterial.js`, `src/engine/terrain/TerrainDetailMaterial.js`, `src/engine/terrain/noise/NoiseStack.js`, `src/engine/terrain/noise/noiseStackCodegen.js`, `src/engine/shaders/terrainColor.glsl.js`, `src/engine/style/ColorPalette.js`, `src/engine/style/PaletteUniforms.js`, `src/engine/terrain/TerrainExporter.js`.
  Mechanisms to understand before writing code: Blank→Highlands template/preset selection; deterministic seed-domain offset; multi-octave FBM; ridged multifractal with spectral weighting (detail follows ridges); domain warping; biome/climate-weighted shaping; erosion/regional variation fields; island/rim falloff; smooth overlapping biome weights; slope/height/moisture/depth/noise-driven albedo; **shared terrain-color logic across terrain, water, and export paths**; triplanar/world-space close-range detail; finite-difference normals; the difference between true heightfield relief and render-only surface detail.

## 3. In scope

1. **Deterministic rebake** (`apps/shared-world/authoring/bake-region.mjs` or an authoring module it calls): add ZyFou-adapted domain-warp + ridged-multifractal + authored-emphasis + restrained-breakup relief layers to the approved Twin Bay macro field, gated by **protected masks**, per §6.1. Re-commit the seven world artifacts (master §2.3) with a determinism proof and an old→new hash table.
2. **Substrate color system**: one app-owned shared classification + color function, built by expanding the existing `apps/shared-world/src/water/shaders/RegionWallColor.glsl` architecture (currently `getWallColor`/`getWallColorTinted` shared by `RegionTerrain.frag`, `RegionWaterAbove.frag`, `RegionWaterBelow.frag`, and the caustics read path), per §6.3–§6.5.
3. **Close-range surface-detail layer** (ZyFou `TerrainDetailMaterial` principle): rock grain, shoreline wetness variation, sediment breakup, subtle strata, low-intensity normal detail, reduced stretching on steep faces — strictly subordinate to real geometry (addendum §4.10).
4. Resample placement Y values and terrain-relative transforms (spawn, markers, loop polyline) from the revised `terrainHeight`; X/Z and category identity unchanged.
5. Verification suite additions per §8; commit.

## 4. Out of scope (addendum §4.11)

- No final kelp/coral/seagrass/trees/shrubs/grass/rocks/ruins/wrecks/fish/wildlife/structures; no painting those into terrain; no procedural substitute assets; no rectangular placeholders yet (temporary internal debug markers only, removed before completion).
- No caves, arches, ceilings, or true overhang geometry (cp09).
- **No water-character or ambient-ripple changes** (cp05B); no breach work (cp06); no final atmosphere/fog values (cp08); no external texture sets (cp08 unless separately approved).
- No change to the approved Twin Bay X/Z layout; no ZyFou runtime/editor/engine import; no edits inside the reference snapshot; no vendored-water edits; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §§2–4 and §11 (governance + technique/color decisions, including §11.2: ZyFou-style classification + Simon-style restrained blending + the existing `RegionWallColor` shared shader path).
- Master §2 (world contract), §5 (terrain plan), R13–R14 — note this checkpoint **supersedes R14's two provisional tints**; record that supersession in the report.
- The ZyFou study set (§2 above) and its `LICENSE`/`BODYARCADE_SOURCE_RECORD.md` (MIT attribution preserved; adapted code is app-owned and documented as ZyFou-inspired).
- `REGION_SKETCHES.md` § APPROVED LAYOUT (Sketch C, seed 60418003: both bays; all islands and mini-islands; lagoon; trench; summit/ridge landmarks; spawn (−180, −380); headland cave (−420, 30); trench-W-wall cave (450, −30); monolith-ring discovery (390, 290); routes; breach sightlines).
- Track B TERRAIN section (Tables 6–7, Q14–Q17); Track D §10 and table 6.2 (matte, low-frequency, value-grouped restraint — colors here remain pre-cp08 working values, not the final palette).

## 6. Deterministic implementation specification

### 6.1 Terrain shape (addendum §4.3–§4.5)

- Composition hierarchy (conceptual; exact implementation may differ but must preserve the order of authority): approved Twin Bay macro field → broad domain-warped variation → ridged multifractal formations → authored ridge/peak/trench/cliff emphasis → restrained medium/high-frequency breakup, all multiplied by **protected-flatness and protected-coast masks** → revised deterministic heightfield.
- **Strong relief zones:** island interiors away from protected beach bands; exposed headlands; major ridge/summit areas; coastline cliffs away from approved beach access; reef ridges; trench/canyon walls; rock shelves; open rocky seabed; cave surroundings outside the seam band. Target character (addendum §2.2): sharp ridges, high narrow peaks, broken rocky slopes, steep underwater walls, jagged reef ridges, irregular trench walls, rough island interiors, broad navigable areas interrupted by authored formations — not uniform noise, not a melted heightfield.
- **Restrained relief zones (protected masks):** approved beaches; lagoon floor; spawn area; required navigation corridors; narrow passages used by camera/dolphin acceptance tests; breach takeoff/re-entry zones; cave-mouth and future arch seam zones; future ruin/structure footprints. "Restrained" = safely navigable and compositionally legible, not featureless.
- **Constraints:** world size 2 km, sea level y = 0, height range **[−80, +200] m retained** — sharper profiles come from redistributing relief, narrowing peaks, steepening faces, deepening local formations *within* the range; do not raise the +200 cap without a separate user ruling. **Coastline rule:** preserve the coastline and all island footprints; prefer a byte-identical `shore.png` sign mask — noise displacement tapers to zero (or uses a coastline-preserving formulation) near the height = 0 contour; any unavoidable shoreline difference is reported and shown before approval.
- **Bake, don't generate** (addendum §4.6): the relief exists in `height.r16`; runtime only loads. `terrainHeight(x,z)` remains the single authority for rendered geometry, water raymarching/depth, shoreline calculations, camera collision, dolphin contact, future Rapier collision, placement Y, and all movement modes. No render-only fake peaks or cliffs that collision and water cannot see.

### 6.2 Determinism

Fixed seeds only (the approved layout seed stays; new relief layers get fixed committed seed offsets); no `Math.random`, no timestamps in artifacts; two consecutive bakes byte-identical.

### 6.3 Substrate classification and color (addendum §4.7)

One shared function (GLSL include + any CPU twin needed for baked/debug outputs) consumed identically by: directly rendered terrain; terrain hit by the above-water and underwater water raymarches; reflected/refracted terrain paths where applicable; debug/baked classification outputs; later terrain-material texture blending. Inputs: world position; elevation vs sea level; normalized height; water depth; geometric normal/slope; existing regional/biome mask data; deterministic broad regional noise; deterministic medium/fine breakup; shoreline distance or band; optional cheap deterministic concavity/erosion proxy. **Never separate unrelated colors for direct terrain vs water-raymarched terrain.**

### 6.4 Substrate families

- Above water (addendum §4.8): dry beach sand; wet shoreline sand/stone; lowland soil; dry-earth/weathered ground; vegetation-compatible soil coloration (never vegetation objects); ordinary exposed rock; steep cliff rock; high-elevation rock; subtle mineral/strata variation.
- Underwater (addendum §4.9 — adapted, not copied; more than a sand-to-deep fade): pale shallow sand; wet/algae-stained shoreline stone (material tint, not an algae asset); shallow reef limestone/mineral rock; mixed sand-and-rock shelf; medium-depth stone; steep underwater cliff stone (reduced sediment); silt/fine-sediment pockets on flat low-energy surfaces; broken rocky seabed; deep trench rock and sediment; darker cave-mouth transition rock; restrained regional mineral variation. Depth influences color but is never the only classifier — slope, shore distance, regional mask, accumulation proxy, and deterministic variation must all matter.
- **Prohibition (addendum §2.4):** terrain color must never imitate, substitute for, or encode the presence of kelp, coral, grass, trees, shrubs, freestanding rocks, ruins, wrecks, fish, wildlife, structures, or any other asset. No asset-like silhouettes or patterns painted into the ground.

### 6.5 Surface detail

World-space/triplanar close-range detail per addendum §4.10; enriches surfaces, never substitutes for the requested sharp relief; final external textures remain cp08.

## 7. Demo

```bash
node apps/shared-world/authoring/bake-region.mjs      # regenerate artifacts (byte-identical)
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region          (the game, revised terrain)
# → http://localhost:5198/shared-world/?view=region-preview  (engineering view)
# → http://localhost:5198/shared-world/?view=pool / ?view=stock  (unchanged references)
```

Expected: the same Twin Bay — every island, mini-island, bay, lagoon, trench, route, and landmark where the user approved it — but geologically dramatic: sharp ridges and narrow peaks on the islands, cliff bands on exposed coasts, jagged reef ridges and irregular trench walls underwater; beaches, lagoon, spawn, corridors still calm and navigable; ground reading as varied natural substrate above and below water, with identical coloring whether terrain is seen directly or through the water.

## 8. Automated verification (addendum §4.12 — all twenty, plus suite)

1. Two consecutive bakes → byte-identical artifacts (SHA-256).
2. Every changed world artifact listed with old and new hashes.
3. Coastline/island footprints approved-preserved; preferably `shore.png` byte-identical (else report the diff with IoU + visualization before approval).
4. All mini-islands present.
5. Spawn, landmarks, cave sites, arch sites, monolith site, breach sightlines preserve X/Z placement.
6. Placement Y values / terrain-relative transforms resampled where required.
7. `terrainHeight` remains the single source for render, water, camera, and simulation.
8. LOD-0 vertices match `terrainHeight` at the existing probe tolerance.
9. Water-over-land and terrain/water-gap checks pass at all approved shoreline sites.
10. The full CP04B four-shot comparison remains acceptable.
11. Protected coastline and ridge tiles remain LOD 0.
12. LOD seam/crack and skirt scans pass after the rebake.
13. Camera clearance and subject-occlusion tests pass on the revised geometry.
14. Dolphin slide and anti-wedge tests pass on real revised-terrain probes (not only the analytic harness).
15. Containment and replay tests pass.
16. Stock, pool, region-preview, and region views remain functional.
17. Sustained FPS, terrain-stage timing, triangle counts, and memory reported against CP05.
18. Direct and raymarched terrain use equivalent color classification at fixed probes.
19. Underwater classification visibly varied by substrate, slope, and depth — not one uniform deep tint.
20. No asset-like silhouettes or patterns painted into terrain color.

Plus: full applicable Playwright suite green; `simHz > 100`; sustained median `fps ≥ 58` at 1728×1080; tests never weakened.

## 9. Manual review procedure (addendum §4.13)

The user explores freely and rules on: roughness/rockiness sufficiency; peak sharpness and drama; beach and route usability; underwater cliff/reef-ridge/trench-wall structure; mini-island and Twin Bay composition integrity; above- and underwater substrate readability; whether any colored region incorrectly imitates a missing asset. Also rule on every flagged derived value (noise/mask parameters, family thresholds).

## 10. Performance-report requirements

Frame-budget table update vs CP05 (master §10): terrain stage, triangle totals per LOD, bake time, artifact sizes, decode time, fps median/min, memory delta; viewport and environment stated.

## 11. Placeholder inventory requirements

Still none placed (cp07); restate the placement census as pending; confirm any temporary debug markers were removed.

## 12. Deviation-report requirements

Every derived constant (relief-layer parameters, mask radii, classification thresholds) with source labels; any shoreline deviation with evidence; the R14 supersession record; any addendum requirement not fully met, stated honestly.

## 13. Guardrails

- The approved Twin Bay layout is the macro authority — the rebake sharpens it; it does not redesign it.
- The approved water system is kept (addendum §2.1): water code changes are limited to consuming the revised heightfield and the shared substrate color through the already-sanctioned `RegionWallColor` path; wave-sim/normal/caustics/Fresnel/Snell math untouched; `?view=stock` pixel-identical; vendored files unmodified.
- ZyFou snapshot is read-only reference; techniques are adapted into app-owned code with attribution preserved; no runtime import.
- Substrate color describes ground only; the rectangular-placeholder law (addendum §2.5) is untouched by anything in this checkpoint.
- Local-only; determinism preserved; tests never weakened; purchase nothing.

## 14. Stop

Produce the end-of-checkpoint report (changes, hash table, layout-preservation evidence, classification evidence, four-shot re-run, performance, placeholder statement, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of 05A does not authorize 05B.
