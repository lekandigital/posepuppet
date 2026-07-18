# CHECKPOINT 03 — Region-Layout Gate

## 1. Header

Checkpoint 03: produce **2–3 top-down sketch maps** of the fictional 2 km × 2 km region for the user to pick from or redline. **This is a decision gate — no world is built, no terrain is baked, no app view changes.** The approved (possibly redlined) sketch becomes the authoritative layout that checkpoint 04A bakes.

## 2. Preconditions and starting state

- Checkpoint 02 approved. Branch `shared-world-slice` at the 02-approved commit; tree clean.
- No terrain or region data exists anywhere in the app.

## 3. In scope

1. A committed, seeded sketch-rendering script `apps/shared-world/authoring/region-sketches.mjs` (Node; renders PNGs deterministically — running it twice yields identical images).
2. Two or three sketch PNGs at `apps/shared-world/authoring/region-sketches/sketch-{A,B,C}.png`, 2048×2048 px (1 px ≈ 1 m), north up, with a 250 m grid, depth-tint legend, and a labeled legend block.
3. One companion doc `apps/shared-world/authoring/REGION_SKETCHES.md`: per sketch, the element checklist (§6) with coordinates, the intended zone-family assignment, the 5–10-minute swim loop, and open questions for the user.
4. Commit. Nothing else.

## 4. Out of scope

- No heightmap baking, no loader, no app code, no water work, no asset placement (all cp04A+).
- No visual changes to any app view.
- No new dependencies beyond a PNG-writing dev-dependency in the authoring scope (e.g., `pngjs`) — record it.

## 5. Required inputs

- Implementation Master §2 (world contract), §6.2 (zone families), §6.7 (composition grammar), §9 (definition of done).
- Master context §7 (region character: mixture, islands, coastlines, ruins commonality, compositional seed, enclosure by natural geography) — the sketches implement exactly this section.
- Track D report §14 (landmark vocabulary/scales) and §5 (family identities).

## 6. Deterministic implementation specification

Source labels: elements 1–3 and 6–9 are [GOVERNED] (master context §7); element 4 is [DOC] (Track D §5/§6 families via Master §6.2); element 5's counts and scales are [BVM ±50 %] (Track D §14). The region frame (2 km, −80/+200 m, sea level y 0) is [GOVERNED] via Master §2.1.

Every sketch must contain, positioned and labeled (coordinates in region meters, origin center):

1. The compositional seed [master context §7]: a calm **lagoon** linked to a **reef shelf**, then a **trench pocket** (floor near −80 m), with **one arch**, **one short cave**, **one current**, and **one optional discovery**.
2. Islands: ≥ 1 large island whose summit is the region's tallest peak (+200 m), ≥ 2 smaller islands, ≥ 3 islets/exposed rocks. Coastline variety: sandy beach, rocky shore, cliff, cove.
3. Enclosure by natural geography on all four sides (cliff walls, reef walls, deep hazardous water) — no visible artificial boundary.
4. Zone-family assignment (Master §6.2): bright-shallow band around beaches/lagoon; one of B/C/F as the main reef identity; exactly one of E (desaturated plain) or G (hazy sand) as the sparse pocket; one dark cave family (D or J) for the cave interior; E2 shaft optional. Label each area with its family letter.
5. Landmarks per the grammar: corridors with 2–4 masses; plains with 0–2 silhouettes; arch openings 4–8 m wide; spires 6–16 m tall (mark count and rough positions; a distinctive formation roughly every 30–60 s along the loop).
6. Ruin/architecture sites (moderately common, integrated): ≥ 3 marked sites incl. ≥ 1 submerged and ≥ 1 shoreline.
7. Spawn point; ≥ 3 breach sightline spots (annotated with what the airborne view shows); the 5–10-minute swim loop drawn as a route.
8. Depth annotations: lagoon 3–10 m; reef shelf 10–36 m; trench to −80 m; gradual transitions (no biome borders).
9. Cave sites: ≥ 1 short cave (the seed's) + the arch; optional second cave per sketch.

The 2–3 sketches must be **meaningfully different arrangements** (e.g., ring-lagoon vs barrier-arc vs twin-bay), not palette swaps. Render style: flat depth-tinted fill (hypsometric ramp, legend included), landmark glyphs, labeled text — an authoring diagram, not concept art (debug-artifact class; no asset generation).

## 7. Demo

No app demo. The deliverable to review:

```bash
node apps/shared-world/authoring/region-sketches.mjs   # regenerates identical PNGs
open apps/shared-world/authoring/region-sketches/*.png
```

Expected: 2–3 clearly distinct, fully labeled region maps satisfying every §6 element, plus `REGION_SKETCHES.md`.

## 8. Automated verification

- Determinism: run the script twice; byte-identical PNGs (hash compare in a tiny test or the script's own `--verify` mode).
- A checklist self-audit table in `REGION_SKETCHES.md`: each §6 element × each sketch → present/absent (all must be present).
- No app/test regressions (nothing else changed): `git status` shows only the authoring folder.

## 9. Manual review procedure

**USER DECISION GATE:** pick one sketch, or redline one (annotations/notes in reply). The choice + redlines become `REGION_SKETCHES.md`'s "APPROVED LAYOUT" section (recorded verbatim at the start of checkpoint 04A). Also decide the optional elements: second cave, E2 shaft, the optional discovery's identity.

## 10. Performance-report requirements

Not applicable (no runtime change) — state exactly that.

## 11. Placeholder inventory requirements

Not applicable yet; the sketches' marked sites *define* the future placeholder positions — say so.

## 12. Deviation-report requirements

Any §6 element a sketch could not satisfy, with cause (none expected); any composition liberties taken beyond the grammar, listed per sketch.

## 13. Guardrails

- **No build.** This checkpoint produces images and a doc only.
- No invented assets (diagrams are authoring artifacts, not game content); purchase nothing.
- Do not pre-empt the user's choice by baking anything; do not start 04A.
- Local-only; nothing outside `apps/shared-world/authoring/` changes.

## 14. Stop

Present the sketches and the element checklist, commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
