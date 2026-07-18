# BodyArcade Shared-World — Checkpoint Index

Authoritative index of the Stage-3 checkpoint ladder on branch
`bodyarcade-shared-world` (the branch the master's original `shared-world-slice`
name refers to). Created 2026-07-18 with the post-CP05 documentation update;
this file is the `CHECKPOINT_INDEX.md` the Implementation Master references.

## Governing documents (read before any checkpoint)

1. The user's current launch prompt.
2. The current checkpoint prompt file (this directory).
3. `../decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` — the
   post-CP05 addendum; **newer user decision**; wins over the master and over
   any older checkpoint prompt wherever they conflict; required reading before
   CP05A and every later checkpoint.
4. `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` (this directory).
5. Approved decisions recorded by earlier checkpoints (e.g. the Checkpoint 03
   APPROVED LAYOUT in `apps/shared-world/authoring/REGION_SKETCHES.md`).

Pinned references installed with the addendum:

- `../references/zyfou-procedural-terrains/` — read-only ZyFou/ProceduralTerrains
  snapshot at commit `8b396f9c784676d46f6a147d310d9f547bf41403` (MIT; see its
  `BODYARCADE_SOURCE_RECORD.md`). Terrain-technique reference only — never
  runtime architecture.
- `../references/ecco-waterline/` — 13 selected *Ecco: Defender of the Future*
  frames + README; the visual acceptance set for CP05B, CP06, and CP08.

## Revised checkpoint order

| CP | Prompt file | Status | Gate |
|---|---|---|---|
| 00 | `CHECKPOINT_00_SCAFFOLD_AND_STOCK_DEMO.md` | **Approved** | Demo review |
| 01 | `CHECKPOINT_01_DOLPHIN_IN_THE_POOL.md` | **Approved** | Demo review |
| 02 | `CHECKPOINT_02_POOL_CAMERA.md` | **Approved** | Demo review |
| 03 | `CHECKPOINT_03_REGION_LAYOUT_GATE.md` | **Approved** (Sketch C — Twin Bay) | Decision gate |
| 04A | `CHECKPOINT_04A_REGION_BAKE_AND_LOADER.md` | **Approved** | Demo review |
| 04B | `CHECKPOINT_04B_POOL_TO_REGION_WATER.md` | **Approved** | Demo review |
| 05 | `CHECKPOINT_05_TERRAIN_ACROSS_THE_WATERLINE.md` | **Approved** — technical terrain foundation only; not final geology or material appearance (addendum §2.2) | Demo review |
| **05A** | `CHECKPOINT_05A_TERRAIN_RELIEF_AND_SUBSTRATE_COLOR.md` | Future — not authorized | Demo review |
| **05B** | `CHECKPOINT_05B_AMBIENT_OCEAN_SURFACE_MOTION_AND_BOUNDARY_INTERACTION.md` | Future — not authorized | Demo review |
| 06 | `CHECKPOINT_06_BREACH_REENTRY_AND_CROSS_WATERLINE_CONTINUITY.md` | Future — requires explicit approval of **both** 05A and 05B first | Demo review |
| 07 | `CHECKPOINT_07_PLACEHOLDER_WORLD.md` | Future — not authorized | Demo review |
| 08 | `CHECKPOINT_08_ECCO_ATMOSPHERE_AND_FINAL_WATER_OPTICS.md` | Future — not authorized | Demo review |
| 09 | `CHECKPOINT_09_CAVES_AND_OVERHANGS.md` | Future — not authorized | Demo review |
| 10 | `CHECKPOINT_10_VEGETATION_AND_LATER_ASSET_PASSES.md` | Future — not authorized | Demo review |
| 11 | Fish and ambient life motion (prompt authored at launch; master §9 + addendum §10.3 asset gate) | Future — not authorized | Demo review |
| 12 | Ruins and architecture (prompt authored at launch; async license gate; addendum §10.3) | Future — not authorized | Demo review |
| 13 | Minimal audio pass (prompt authored at launch; master §8.4) | Future — not authorized | Demo review |
| 14A | Rowing view over the region (prompt authored at launch) | Future — not authorized | Demo review |
| 14B | Walking view over the region (prompt authored at launch) | Future — not authorized | Demo review |
| 14C | Flight view over the region (prompt authored at launch) | Future — not authorized | Demo review |

CP05 was the last implemented checkpoint (commit
`8ca67cc75eeefaf4593abe042ad6a5cdb3155247`). The next checkpoint in order is
**05A**, followed by **05B**, then 06.

## Standing rules (unchanged)

- Exactly **one checkpoint per implementation session**.
- Every checkpoint ends with a local commit, a full report, and a **STOP** for
  unrestricted user review. Approval of one checkpoint never authorizes the
  next; this index authorizes nothing.
- Approved checkpoints and approved visuals are preserved unless the user
  explicitly reopens them. The approved region water system is kept (addendum
  §2.1); the approved Twin Bay geography is preserved (addendum §2.3).
- Missing assets remain color-coded **rectangular placeholders** until the user
  supplies or explicitly approves the real asset or a generation workflow;
  terrain coloring never satisfies or reduces that requirement (addendum §2.4–2.5).
- Never push, merge, rebase, or open a pull request without explicit user
  authorization.
