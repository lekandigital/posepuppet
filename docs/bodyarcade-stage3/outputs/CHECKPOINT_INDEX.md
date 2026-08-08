# BodyArcade Shared-World — Checkpoint Index

Authoritative index of the Stage-3 checkpoint ladder on branch
`bodyarcade-shared-world` (the branch the master's original `shared-world-slice`
name refers to). Created 2026-07-18 with the post-CP05 documentation update;
this file is the `CHECKPOINT_INDEX.md` the Implementation Master references.

## Governing documents (read before any checkpoint)

1. The user's current launch prompt.
2. The current checkpoint prompt file (this directory).
3. `../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md` — the
   **ocean-replacement addendum (2026-08-08); newest user decision**; wins over
   everything below wherever they conflict; required reading before CP05C and
   every later checkpoint.
4. `../decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` — the
   post-CP05 addendum; wins over the master and older checkpoint prompts
   except where the ocean-replacement addendum supersedes it (notably its §2.1
   water verdict).
5. `BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` (this directory).
6. Approved decisions recorded by earlier checkpoints (e.g. the Checkpoint 03
   APPROVED LAYOUT in `apps/shared-world/authoring/REGION_SKETCHES.md`).

Pinned references installed with the addendum:

- `../references/zyfou-procedural-terrains/` — read-only ZyFou/ProceduralTerrains
  snapshot at commit `8b396f9c784676d46f6a147d310d9f547bf41403` (MIT; see its
  `BODYARCADE_SOURCE_RECORD.md`). Terrain-technique reference only — never
  runtime architecture.
- `../references/ecco-waterline/` — 13 selected *Ecco: Defender of the Future*
  frames + README; composition/behavior reference for CP06 and CP08 (its
  water-system prescriptions are superseded by the ocean-replacement addendum §8).
- `../references/waterthreejs/` — read-only WaterThreeJS snapshot (MIT; see its
  `BODYARCADE_SOURCE_RECORD.md`); the porting source and fidelity reference for
  CP05C. Never edited; the runtime port is app-owned code.

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
| **05A** | `CHECKPOINT_05A_TERRAIN_RELIEF_AND_SUBSTRATE_COLOR.md` | **Approved** (2026-07-19, `d1d3aad`) — substrate classification survives 05C; its underwater palette law is re-based (ocean addendum §2.4) | Demo review |
| **05B** | `CHECKPOINT_05B_AMBIENT_OCEAN_SURFACE_MOTION_AND_BOUNDARY_INTERACTION.md` | **Implemented** at `fab3098`; visual gate mooted — the jeantimex ambient system it tuned is retired at 05C; its never-frozen-surface requirement carries into the 05C suite | Demo review |
| **05C** | Ocean replacement (WaterThreeJS port) — specified by `../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md` §4 (no separate prompt file) | **Authorized — next** | Demo review |
| 06 | `CHECKPOINT_06_BREACH_REENTRY_AND_CROSS_WATERLINE_CONTINUITY.md` | Future — re-scoped by ocean addendum §5; the side-branch implementation (`bodyarcade-shared-world-cp06-cp07`) is superseded | Demo review |
| 07 | `CHECKPOINT_07_PLACEHOLDER_WORLD.md` | Future — re-run on this line (ocean addendum §6); side-branch implementation superseded | Demo review |
| 08 | `CHECKPOINT_08_ECCO_ATMOSPHERE_AND_FINAL_WATER_OPTICS.md` | Future — re-scoped to atmosphere zones and final tuning (ocean addendum §7) | Demo review |
| 09 | `CHECKPOINT_09_CAVES_AND_OVERHANGS.md` | Future — not authorized | Demo review |
| 10 | `CHECKPOINT_10_VEGETATION_AND_LATER_ASSET_PASSES.md` | Future — not authorized | Demo review |
| 11 | Fish and ambient life motion (prompt authored at launch; master §9 + addendum §10.3 asset gate) | Future — not authorized | Demo review |
| 12 | Ruins and architecture (prompt authored at launch; async license gate; addendum §10.3) | Future — not authorized | Demo review |
| 13 | Minimal audio pass (prompt authored at launch; master §8.4) | Future — not authorized | Demo review |
| 14A | Rowing view over the region (prompt authored at launch) | Future — not authorized | Demo review |
| 14B | Walking view over the region (prompt authored at launch) | Future — not authorized | Demo review |
| 14C | Flight view over the region (prompt authored at launch) | Future — not authorized | Demo review |

CP05B was the last checkpoint implemented on this line (commit `fab3098`).
The next checkpoint is **05C — Ocean Replacement (WaterThreeJS port)**,
authorized by the ocean-replacement addendum, followed by the re-scoped 06.
CP06/CP07 implementations exist only on the parked side branch
`bodyarcade-shared-world-cp06-cp07` and are superseded.

## Standing rules (unchanged)

- Exactly **one checkpoint per implementation session**.
- Every checkpoint ends with a local commit, a full report, and a **STOP** for
  unrestricted user review. Approval of one checkpoint never authorizes the
  next; this index authorizes nothing.
- Approved checkpoints and approved visuals are preserved unless the user
  explicitly reopens them. The post-CP05 §2.1 region-water verdict **was
  explicitly reopened** by the ocean-replacement addendum (2026-08-08): the
  region water is replaced at 05C; the vendored stock/pool views stay
  byte-identical. The approved Twin Bay geography is preserved (addendum §2.3).
- Missing assets remain color-coded **rectangular placeholders** until the user
  supplies or explicitly approves the real asset or a generation workflow;
  terrain coloring never satisfies or reduces that requirement (addendum §2.4–2.5).
- Never push, merge, rebase, or open a pull request without explicit user
  authorization.
