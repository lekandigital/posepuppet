# CHECKPOINT 07 — Placeholder World

## 1. Header

Checkpoint 07: color-coded rectangular placeholder blocks for **every** asset category, placed per the approved layout and the Track D density budgets, so the user can judge composition and scale before any real asset arrives. The placeholder inventory becomes a first-class, permanently reported artifact from here to ship.

## 2. Preconditions and starting state

- Checkpoint 06 approved. Branch `shared-world-slice` at the 06-approved commit; tree clean.
- `placement.json` (04A) carries the approved sites; `biome.png` carries zone areas.

## 3. In scope

1. `src/world/placeholders.ts`: instanced rectangular blocks (BoxGeometry, flat Lambert, category colors per Master §8.3 legend), driven entirely by `placement.json` + deterministic scatter fields.
2. Two placement classes:
   a. **Authored sites** (ruins, buildings, docks, wrecks, cave-mouth markers, landmark spires/arches as block stand-ins where no geometry exists yet, large-animal stations, audio-emitter dev markers) — exact transforms from `placement.json`.
   b. **Scatter categories** (rock fields, coral clusters, kelp stands, seagrass patches, tree/shrub cover on exposed land, flower accents, fish-school volumes as translucent boxes) — deterministic golden-angle + value-noise gating (the `decor.ts` technique, re-implemented against `WorldData` masks; hash-seeded per category from `world.json`'s seed; no RNG at runtime).
3. Densities per zone from Track D: wildlife budgets (17.8) for school volumes and large-animal stations; composition grammar (§6.7) for landmark counts; vegetation/rock scatter densities set per biome channel with the master depth-ramp banding (bright dense shallows → sparse deep) [densities are [REC]-class; each committed value labeled].
4. Dev labels: `&labels=1` renders category names as billboards over blocks.
5. The placeholder census generator: a script emitting `eval/shared-world-placeholders.json` (category → count → zone) consumed by the report and asserted by tests.
6. Commit.

## 4. Out of scope

- No real assets of any kind (that is cp09–12); no vegetation meshes; no motion on fish volumes (cp11); no atmosphere (cp08).
- No new placement sites beyond the approved layout (adding sites = a layout change = user decision).
- No collision on placeholders (Track A F7 stands: decor has no collision by design; caves get collision at cp09).

## 5. Required inputs

- Implementation Master §8.3 (legend — exact hexes), §6.6–§6.7 (budgets/grammar), §9 (DoD: placeholders for every category).
- Master context §9.3 (placeholder rule, verbatim compliance).
- Track D report §12 (Table 12.1), §14 (landmark loads), §11 (particle categories are *not* placeholders — they arrive at cp08; exclude).
- `placement.json`, `biome.png`, `world.json` from 04A.
- Repo: `apps/dolphin/src/game/decor.ts` (the deterministic-scatter technique donor — read-only).

## 6. Deterministic implementation specification

- Block sizing per category (footprint × height, meters) [DERIVED from real-asset scale anchors, each flagged]: rock 2×2×1.5; coral 1×1×0.8; kelp 0.5×0.5×4 (tall thin); seagrass 1×1×0.4; tree 2×2×6; shrub 1×1×1; flower 0.5×0.5×0.3; ruin 6×6×4 (per site scale field); building 8×8×5; dock 3×10×1.5; wreck 12×4×4; fish-school volume 6×6×4 translucent (opacity 0.35); large animal 3×1×1; cave-mouth marker 4×4×4 wireframe; audio emitter 1×1×1 (dev view only).
- Scatter densities (per 100 m × 100 m cell, by zone family) [REC-class starting points, flagged]: reef families B/C/F — rocks 8, coral 12, kelp 10 (C only), seagrass 15, school volumes 1 per 4 cells; plain E/G — rocks 2, tufts 3, schools 1 per 10 cells; shallows — coral 16, seagrass 20; exposed land — trees 12, shrubs 18, flowers 8 per cell above shoreline; deep band — 40 % of its zone's base density.
- Depth banding multiplier: shallow ×1.0, mid ×0.7, deep ×0.4 [Track D stratification; DERIVED multipliers, flagged].
- All placeholders `visible` in the live demo (the policy's point); school volumes render double-sided translucent.
- Instancing: one InstancedMesh per category; total instance budget target ≤ 25 000 [DERIVED from the ~1–2 ms objects budget; flagged].

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region&labels=1
```

Expected: the region is visibly *composed* — landmark blocks at the approved sites, scatter fields respecting zones and depth bands, exposed land carrying tree/shrub blocks, school volumes hovering over reefs, everything unmistakably a placeholder (flat category colors). Swim the loop: something distinct roughly every 30–60 s.

## 8. Automated verification

1. Census: `eval/shared-world-placeholders.json` regenerated; assert **every Master §8.3 category count ≥ 1** (the DoD requirement) and authored-site counts exactly match `placement.json`.
2. Determinism: two runs → identical instance transform hashes.
3. Zone respect: sampled instances per category lie inside their permitted biome channels (≥ 98 %).
4. Depth banding: measured density ratios shallow/mid/deep within ±20 % of the multipliers.
5. No placement below terrain or floating: every instance's base within 0.25 m of `terrainHeight` (or its authored y for suspended school volumes).
6. Four-shot re-run unchanged; containment/breach/replay suites green.
7. `simHz > 100`; sustained median `fps ≥ 58` with all placeholders visible; objects stage ≤ 2 ms.

## 9. Manual review procedure

1. Swim the loop with labels on: judge composition, scale, and rhythm (the 30–60 s discovery cadence); flag any site that reads wrong (feeds a placement.json amendment — a layout micro-change you approve here, not silently).
2. Above water: island coverage read (trees/shrubs where the sketch promised lushness).
3. Rule on flagged sizing/density values (they calibrate every later real-asset checkpoint).

## 10. Performance-report requirements

fps with full placeholders (median/min on the loop script), instance counts per category, draw calls, objects-stage ms, memory delta.

## 11. Placeholder inventory requirements

**The full census table** (category → color → count → zones) — this becomes the standing inventory every later checkpoint diffs against as categories convert to real assets.

## 12. Deviation-report requirements

Deviations from the legend/budgets with cause; every [DERIVED]/[REC] density and size restated; any approved-site transform that had to move (with the user-visible reason).

## 13. Guardrails

- Placeholders are never permission to fake final assets — blocks stay blocks until a user-approved asset replaces them (master context §9.3 verbatim rule).
- No invented assets; no purchases; approved layout is authority for every authored site.
- Water/terrain/breach visuals immutable; vendored files untouched; four-shot must stay clean.
- Deterministic placement only (no runtime RNG); local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, full census, composition captures, performance, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
