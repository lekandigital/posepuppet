# CHECKPOINT 10 — Vegetation and Later Asset Passes

## 1. Header

Checkpoint 10 (amended by the post-CP05 addendum §10): the first asset-replacement pass (vegetation), and the **binding asset gate for every later pass** (CP11 fish/ambient life, CP12 ruins/architecture, and all subsequent asset checkpoints). Terrain coloring authorizes no vegetation generation and no asset substitution, ever. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- Checkpoint 09 approved; branch `bodyarcade-shared-world` at the 09-approved commit; tree clean.
- Required reading: the addendum (§2.4–§2.5, §10); this prompt; master §8.2–§8.3 (approved-asset pipeline, delivery contract, budgets), §5.4 (instancing techniques), §12 (approval flow); the CP07 census with its "no approved final asset yet" list.

## 3. In scope

1. **Per-category asset gate** (addendum §10.1) — for every vegetation category (kelp, seagrass, coral, land vegetation, grass clumps, shrubs, trees):
   - use a **user-supplied or explicitly user-approved** asset or generation workflow;
   - verify license and provenance live, recorded in `CREDITS.md` (CC0 sources still get a live license-page check);
   - replace **only the matching placeholders**, category by category;
   - leave rectangular placeholders wherever no approved final asset exists.
2. SeedThree remains a candidate **only for categories it can actually produce convincingly** — it is *not* assumed to provide convincing kelp; kelp, coral, and other specialized underwater assets remain separate sourcing or generation decisions raised to the user (async, as early as ready). SeedThree bakes are re-textured with CC0/own maps per master §8.2.
3. Instanced rendering per master §5.4 (per-chunk InstancedMesh, vertex-shader sway, distance fade), within Track D matte-material locks and budgets.
4. **Placement relationship** (addendum §10.2): terrain classification may inform whether a placement is *physically suitable*, but it must not silently add, delete, or relocate approved instances — material suitability and asset presence remain distinct data; any conflict is reported for a user ruling. Commit.

## 4. Out of scope

- No invented substitute assets; no terrain-color substitution for any asset; no unapproved downloads or purchases; no new categories; no terrain/water/atmosphere retuning; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §10; master §8.2 (pipeline: `.glb`, Y-up, meters, +Z forward; texture budgets; snake_case names; paths under `apps/shared-world/public/models|textures/`), §8.3 legend, §12 approval items; Track C §3/§6 candidate lists (recommendations only — each requires explicit approval before download/commit); Track D 17.4 material locks and 17.8 budgets; the CP07 census.

## 6. Deterministic implementation specification

- Replacement is a data-level swap at the placeholder's approved X/Z (Y/normal from `terrainHeight`); deterministic instance parameters (seeded variation in scale/yaw within approved bounds); the census delta is computed, not hand-maintained.
- Every replaced category records: asset source, license, approval reference, tri/texture budget compliance.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: approved vegetation categories now render as real assets exactly where their rectangles stood — kelp swaying in its reef, seagrass on the shelves — while every unapproved category (and all of CP11+'s fauna, ruins, wrecks, structures) remains an honest rectangle.

## 8. Automated verification

1. Census delta: replaced categories ↔ approvals on record, one-to-one; every unapproved category still fully placeholdered; zero silent additions/deletions/relocations (X/Z diff empty).
2. Credits audit: every new asset in `CREDITS.md` with live-check record (master §11.1 credits-vs-assets audit).
3. Ground-contact and slope checks for replaced instances on the authoritative heightfield.
4. Budgets: instancing counts, texture sizes, material locks (roughness 0.95–1.0, metalness 0) asserted.
5. Suite green (four-shot, containment, replay, 06 continuity, cave clearance); `simHz > 100`; sustained median `fps ≥ 58` with vegetation active (degradation order: flora instances cut before defining features).

## 9. Manual review procedure

The user judges each replaced category against the Ecco look (P5, P7: density as authored contrast, kelp as local screen-divider not world-fill), approves or redlines per category; free exploration as long as desired.

## 10. Performance-report requirements

Frame-budget vs 09 with instancing costs per category; fps median/min; viewport stated.

## 11. Placeholder inventory requirements

Full census delta: replaced categories with counts; remaining placeholder categories with counts and their sourcing status.

## 12. Deviation-report requirements

Any suitability conflict between classification and an approved placement (reported for ruling); any SeedThree output judged unconvincing and left placeholdered; license/provenance gaps.

## 13. Guardrails — the standing asset law for CP10 and every later pass (addendum §10.3)

- No invented substitute assets; no terrain-color substitution; **never infer asset presence from terrain color.**
- Placeholders remain until real assets are approved; replacement happens category by category with explicit review.
- The same law binds CP11 (fish/wildlife), CP12 (ruins/wrecks/architecture), and all subsequent asset passes; their prompts are authored at launch under this gate.
- Local-only; purchases never made by the agent; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, census delta, credits audit, performance, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of this checkpoint does not authorize starting the next checkpoint.
