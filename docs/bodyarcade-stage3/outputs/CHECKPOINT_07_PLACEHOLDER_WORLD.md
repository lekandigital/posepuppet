# CHECKPOINT 07 — Placeholder World

## 1. Header

Checkpoint 07 (amended by the post-CP05 addendum §7): place a color-coded **rectangular placeholder** for every approved asset instance or cluster whose final asset is unavailable, across the revised 05A terrain. This checkpoint remains mandatory and is **not reduced by terrain coloring** in any way. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- Checkpoint 06 approved; branch `bodyarcade-shared-world` at the 06-approved commit; tree clean.
- Required reading: the addendum (§2.4–§2.5, §7); this prompt; master §8.3 (placeholder legend) and §6.6–§6.7 (densities/composition); `placement.json` and the CP04A census; the 05A report (revised heightfield facts).

## 3. In scope

1. Placeholder blocks/primitives for **every** approved category unavailable, per the master §8.3 color legend, at intended position, scale, orientation, footprint, and density; dev-mode labeled; visually obvious. Categories at minimum (addendum §2.5): kelp; seagrass; coral; freestanding rocks/boulders; trees; shrubs; grass clumps; caves/arches not yet final geometry; ruins; wrecks; buildings/structures; fish schools; larger wildlife; interactable/landmark props; every other category in the approved placement manifest.
2. **Revised-terrain placement law** (addendum §7.2): preserve approved X/Z placement and category identity; **resample Y from the revised `terrainHeight`**; orient per the approved placement rule and revised terrain normal where applicable; prevent placeholders from floating, being buried, or unintentionally intersecting steep terrain; retain explicit cave/arch/ruin/structure seam reservations (including the headland cave (−420, 30), trench-W cave (450, −30), and monolith ring (390, 290)).
3. Deterministic placement from `placement.json` (golden-angle/value-noise scattering only where the approved layout defines density rather than instances). Commit.

## 4. Out of scope

- No real assets, no procedural substitute assets, no asset purchases; no cave geometry (cp09); no atmosphere (cp08); no terrain or water changes; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §7 (placeholder law; no category may be omitted because terrain color suggests the biome, a generator might exist, a search is planned, a model isn't selected, or the area looks acceptable).
- Master §8.3 legend (category → hex), §6.6 wildlife budgets, §6.7 composition grammar; Track D densities.
- `placement.json` + `world.json`; the revised `terrainHeight` via `WorldData`.

## 6. Deterministic implementation specification

- One placement pass reading `placement.json`; Y and normal sampled from the authoritative heightfield at load or bake (recorded which); fixed seeds for any density-driven scatter; per-instance ground-contact rule (base embedded ≤ a stated tolerance, never floating > tolerance, never fully buried); slope gate with explicit handling for instances whose approved X/Z now sits on steep 05A terrain (report each, do not silently move it).
- Dev labels (`?debug=1`): category name + instance id.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for labels)
```

Expected: swimming the approved loop shows every future asset as an obvious color-coded rectangle sitting correctly on the revised terrain — kelp fields, coral clusters, ruins, wreck, cave mouths, monolith ring, wildlife volumes — nothing floating, nothing buried, nothing missing.

## 8. Automated verification

1. Placeholder census vs `placement.json` (master §11.1): every approved instance/cluster represented; counts per category reported; zero omissions.
2. Category completeness vs the addendum §2.5 minimum list.
3. Per-instance ground-contact checks on the revised heightfield (no float/bury beyond tolerance; steep-intersection report).
4. X/Z preservation: placed X/Z equals approved X/Z exactly.
5. Seam reservations intact (cave/arch/structure footprints reserved, not covered).
6. Suite green (04B four-shot, containment, replay, camera); `simHz > 100`; sustained median `fps ≥ 58` with all placeholders visible.

## 9. Manual review procedure

The user tours the loop and rules on placement correctness, density readability (corridors vs plains), and any steep-slope cases; free exploration as long as desired.

## 10. Performance-report requirements

Frame-budget vs 06 with placeholder draw cost (instancing stats); fps median/min; viewport stated.

## 11. Placeholder inventory requirements

The full census: per category — count placed, color, and **which categories have no approved final asset yet** (explicitly listed, addendum §7.3).

## 12. Deviation-report requirements

Any instance whose Y/orientation rule needed a judgment call; any approved site in conflict with the revised terrain (reported, not silently moved); derived tolerances.

## 13. Guardrails

- Terrain color never satisfies or reduces the placeholder requirement (addendum §7.1).
- Approved X/Z and category identity immutable; the revised heightfield changes Y and normals only.
- Approved terrain, water, breach, and camera behavior untouched; local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, census, contact-check evidence, performance, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of this checkpoint does not authorize starting the next checkpoint.
