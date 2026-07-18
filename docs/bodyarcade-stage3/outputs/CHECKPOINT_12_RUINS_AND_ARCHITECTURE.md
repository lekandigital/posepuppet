# CHECKPOINT 12 — Ruins and Architecture

## 1. Header

Checkpoint 12: user-approved ruins, buildings, docks, and wreck assets replace their placeholder blocks at the approved sites — "as supplied." This checkpoint has a built-in **asset-approval decision gate**: nothing is downloaded or committed until the user approves each item and its live license verifies. If no approvals exist when the session starts, the session's deliverable is the approval request itself, then it stops.

## 2. Preconditions and starting state

- Checkpoint 11 approved. Branch `shared-world-slice` at the 11-approved commit; tree clean.
- Check the approval state: has the user approved specific ruin/building/dock/wreck assets (from Track C §3's candidates or their own supply)?
  - **If no:** compile the approval request (the Track C ★/○ candidates with preview links, licenses to verify, and this checkpoint's per-site needs), present it, and **stop at §14 without building** — this checkpoint then re-runs after approvals.
  - **If yes:** proceed.

## 3. In scope

1. Per approved asset: live license verification at the source page (CC-BY items: record creator, URL, license link, and the exact credit line; CC0 items: record the license page), **then** download and commit under `apps/shared-world/public/models/ruins/` (or `buildings/`, `wrecks/`).
2. Blender prep per Track C §8: scale to meters, Y-up +Z forward, decimate to budget (ruins ≤ 25 k tris/site, buildings ≤ 15 k, wreck ≤ 30 k [DERIVED, flagged]), retexture/treat toward Track D §10 (matte, value-grouped, ≤ 2K), Draco only if needed.
3. Placement at the approved `placement.json` sites: slight natural tilt, partial burial (sand/rock intersection), surrounding scatter from existing rock/vegetation categories — "a structure placed at a slight natural tilt … reads as submerged or abandoned" [master context §7]; no destruction systems.
4. Collision: fixed Rapier trimesh per structure + BVH membership (camera + contact queries), per the cp09 infrastructure.
5. CREDITS.md + in-app credits panel updates (CC-BY obligations are mandatory and end-user-accessible).
6. Census conversion for the affected categories.
7. Commit.

## 4. Out of scope

- No un-approved assets, no substitutions, no "close enough" alternatives — a site whose asset wasn't approved keeps its block.
- No new sites; no interior gameplay for structures; no procedural damage; no lore objects.
- No modern/anachronistic items even if approved-by-license (PS2-Ecco fit rule — flag doubts back to the user instead of committing).

## 5. Required inputs

- Implementation Master §8.2–§8.3, §5.3 (collision), §6.4 (material locks), §12 item 2 (the async approval flow).
- Track C report §3 (ruins/buildings/docks/wrecks tables: Rosenborg Underwater Ruins ★, Rudebjer ○, shipwreck tag picks, Kenney/Quaternius kits ○), §9 (obligation ledger), §8 (pipeline).
- Track D report §14 (landmark grammar — structures serve composition), table 6.2 (ruin hue family #9AA79A).
- The user's approval list; `placement.json` sites.

## 6. Deterministic implementation specification

- Site fit: each structure scaled to its site's approved footprint (placement.json `scale`); orientation = site yaw + tilt 3–8° on a hashed axis [DERIVED range, flagged]; burial depth 10–25 % of height for seabed sites [DERIVED, flagged].
- Material treatment: albedo value-grouped toward 4 groups; roughness ≥ 0.95, metalness 0; vertex AO tint at ground contact; hue kept inside the zone palette (ruin family #9AA79A ± zone tint).
- Integration dressing uses only existing approved categories (rocks/vegetation instances re-scattered locally within the site footprint, same deterministic scatter tech).
- Wrecks: weathered, non-modern picks only (Track C guidance); if the approved wreck reads modern in context, stop and flag rather than restyle beyond the treatment rules.
- Every commit of a CC-BY asset lands in the same change as its CREDITS.md line (no unattributed window).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: the approved sites now carry real structures — tilted, half-buried, dressed into the landscape, readable as ancient/abandoned through the zone fog; docks/buildings on shorelines read from both water and air (breach view); remaining un-approved sites still show honest blocks.

## 8. Automated verification

1. License audit: every committed model file maps to a CREDITS.md entry with a recorded live-verification note (script cross-checks `public/models/**` against CREDITS.md — fails on any orphan).
2. Census diff: exactly the approved categories/sites converted; block counts for the rest unchanged.
3. Placement fidelity: structure origins within 1 m of sites; tilt/burial within the stated ranges.
4. Collision: probe casts on each structure (camera never clips; dolphin slides along walls; no fall-through at burial seams).
5. Budgets: per-structure triangle counts within limits; textures ≤ 2K.
6. Four-shot re-run unchanged; suites green; `simHz > 100`; sustained median `fps ≥ 58`.

## 9. Manual review procedure

1. Visit every converted site by swim (and breach for shoreline ones): composition, scale against the dolphin, "submerged/abandoned" read, PS2-Ecco fit.
2. Confirm the credits panel lists every CC-BY item correctly.
3. Rule on flagged ranges (tilt/burial/budgets) and on any site you want re-dressed.

## 10. Performance-report requirements

Frame-budget delta, per-structure costs, trimesh totals, fps at the densest structure site.

## 11. Placeholder inventory requirements

Census diff (converted vs remaining); the remaining-blocks list is the standing to-do the user fills over time.

## 12. Deviation-report requirements

Deviations per structure (treatment, decimation, placement) with cause; all [DERIVED] flags; any approval ambiguity encountered (item approved but license page changed, etc. — never committed silently).

## 13. Guardrails

- **Approval-then-verify-then-commit**, per item, no exceptions; agents purchase nothing; no substitutes for unapproved sites.
- CC-BY attribution mandatory + end-user-accessible; obligation ledger kept current.
- Approved visuals immutable; blocks stay obvious; four-shot clean; local-only; deterministic; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes or — if approvals were missing — the compiled approval request; license audit; census diff; performance; deviations), commit any completed work, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
