# CHECKPOINT 09 — Caves and Overhangs

## 1. Header

Checkpoint 09 (amended by the post-CP05 addendum §9): true cave, arch, ceiling, and overhang geometry — **separate volumetric/modular meshes, because a heightfield cannot fold over itself** — seamed into the revised 05A terrain, with Rapier collision and dark-zone atmosphere. Every seam is revalidated against the 05A heightfield. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- Checkpoint 08 approved; branch `bodyarcade-shared-world` at the 08-approved commit; tree clean.
- Required reading: the addendum (§9); this prompt; master §5.2–§5.3 (cave method decision, Rapier plan), §6 dark families; Track B CAVES/COLLISION sections (Table 8, Q19–Q20); `caves.json`; the 05A report (seam-zone masks and revised heights at both cave sites).
- Asset gate: the Kenney Modular Cave Kit (CC0) plus any Blender-finished modules require the recorded live license check and the user's explicit approval before download/commit (master §12 item 2 — raise async as early as ready).

## 3. In scope

1. Authored/kitbashed modular cave-and-arch meshes placed per `caves.json`: the **headland cave (−420, 30)** as the primary bay-to-bay loop shortcut and the **trench-W-wall cave (450, −30)** as a smaller optional discovery (never a major route), plus the approved arch site(s).
2. **Revised-terrain seam work** (addendum §9.1): revalidate every cave/arch transform against the 05A heightfield; adjust **only Y and seam-local terrain stamps** unless the user approves an X/Z change; preserve approved cave-mouth locations and route relationships; locally lower or omit the heightfield where the module mesh becomes authoritative (the trimesh owns undercuts); share compatible rock classification and material logic across terrain and cave seams (extend the 05A substrate classes — cave-mouth transition rock is already a class); **prevent the sharper 05A relief from sealing entrances or narrowing approved routes below their required clearance** (measured clearance checks at both mouths and along the shortcut route).
3. **Collision** (master §5.3): Rapier introduced — one static heightfield collider (downsampled ~513²) + fixed-body trimesh colliders per module, seam overlap so the dolphin cannot clip through; three-mesh-bvh continues to serve camera and query paths inside caves (push-out `closestPointToPoint`).
4. Dark-zone atmosphere for cave interiors through the cp08 zone system (families D/J per the approved zone map; genuinely dark; aperture-bound light shafts only at real ceiling openings).
5. **Placeholder transition** (addendum §9.2): replace only the cave/arch placeholders whose final geometry is implemented; every other placeholder remains. Commit.

## 4. Out of scope

- No SDF/marching-cubes toolchain (rejected, Track B Table 8); no new asset categories; no terrain-wide reshaping (seam-local stamps only, with determinism proof); no water changes; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §9; master §5.2–§5.3, §6.5 (shafts), §12 item 2 (approval flow); Track B Table 8 + Q19 (seam rule) + Table 9 (Rapier/BVH); `caves.json` + `world.json`; 05A seam-band masks; Kenney kit license page (live check recorded in `CREDITS.md`).

## 6. Deterministic implementation specification

- Seam stamps are authoring-time, seeded, and re-bake deterministically (two runs byte-identical; hash table for changed artifacts); the runtime loads committed geometry and stamps.
- Sim-side cave containment stays analytic-plus-SDF inside the 120 Hz step where possible; Rapier owns volumetric collision; BVH remains camera/presentation and query-side. Replay self-consistency preserved.
- Clearance contract: minimum navigable cross-section for the primary shortcut and both mouths stated and asserted (values proposed from the approved routes; flagged for user ruling).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for collision/seam overlays)
```

Expected: swim the bay-to-bay shortcut through the headland cave — a true interior with a ceiling, genuinely dark, exit aperture reading as the brightest element; the trench-wall cave rewards the detour; seams show no gaps, no floating lips, no camera or dolphin clip-through; the sharper terrain frames the mouths without choking them.

## 8. Automated verification

1. Seam integrity at every module: no visible gap/overlap beyond tolerance at the lip (capture scans); heightfield locally lowered/omitted exactly where recorded.
2. Clearance checks: scripted traversal of both caves and the arch at cruise — no wedging, no camera loss > 0.3 s, TerrainCompressed engages/releases; minimum-clearance assertions pass.
3. Collision: no tunneling through module walls at burst speed (scripted ram tests); Rapier heightfield vs `terrainHeight` consistency probes; BVH cave queries green.
4. X/Z preservation of cave mouths; only Y/seam-local changes vs the approved transforms (diff report).
5. Dark-zone values match the approved zone table; shafts only at real apertures.
6. Placeholder census: cave/arch placeholders replaced, all others unchanged.
7. Suite green (four-shot, containment, replay, 06 continuity captures); `simHz > 100`; sustained median `fps ≥ 58` including cave interiors.

## 9. Manual review procedure

The user swims both caves and the arch, judges interiors, darkness, seams, clearance feel, and shortcut value; rules on the clearance constants and any module aesthetics; free exploration as long as desired.

## 10. Performance-report requirements

Frame-budget vs 08 with Rapier step cost, trimesh counts, BVH build/query deltas, cave-interior fps; viewport stated.

## 11. Placeholder inventory requirements

Census delta: which cave/arch placeholders were replaced by real geometry; confirmation every other category remains.

## 12. Deviation-report requirements

Every seam stamp with its determinism proof; any transform that needed more than a Y adjustment (requires the user's X/Z approval — red-flag if done without it); derived clearance values; license-check record.

## 13. Guardrails

- Caves are hand-authored geometry in the Ecco tradition — never procedural substitutes; modules require prior user approval and recorded licenses.
- The 05A heightfield outside seam bands is immutable; approved routes and mouth locations preserved.
- Water, atmosphere (outside the new dark zones), breach, and placeholders untouched; local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, seam evidence, clearance data, collision results, census delta, performance, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of this checkpoint does not authorize starting the next checkpoint.
