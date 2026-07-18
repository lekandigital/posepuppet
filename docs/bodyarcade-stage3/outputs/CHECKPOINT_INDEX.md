# CHECKPOINT_INDEX.md

**Project:** BodyArcade Shared-World — Stage 3 Implementation
**Date:** 2026-07-17

Ordered checkpoint sequence. Each checkpoint ends in a runnable local demo and a mandatory user approval stop before the next begins.

---

| # | File | Name | Scope | Gate |
|---|---|---|---|---|
| 00 | `CHECKPOINT_00_SCAFFOLD_AND_STOCK_DEMO.md` | Scaffold and Stock Demo | Create `apps/shared-world/` on `bodyarcade-v4-base`; vendor jeantimex pristine; run stock demo unchanged | Demo review |
| 01 | `CHECKPOINT_01_DOLPHIN_IN_THE_POOL.md` | Dolphin in the Pool | GAMICO dolphin swimming in unmodified jeantimex pool; ported `sim.ts` + keyboard `swimControls`; 8 animation clips via AnimationMixer; water interaction via compound-sphere displacement | Demo review + feel review |
| 02 | `CHECKPOINT_02_POOL_CAMERA.md` | Pool Camera | Chase camera rig with Track E spring dynamics; above/below transitions; half-submerged behavior; look-ahead on smoothed velocity | Demo review |
| 03 | `CHECKPOINT_03_REGION_LAYOUT_GATE.md` | Region Layout Gate | Produce 2–3 top-down sketch maps of the fictional region; user selects or redlines; no build | Decision gate |
| 04 | `CHECKPOINT_04_POOL_TO_REGION.md` | Pool to Region | Enlarge water domain; container swap (pool walls → coastline, pool floor → seabed heightfield); windowed 512² sim; shoreline alpha-clip; four-shot fidelity test | Demo review |
| 05 | `CHECKPOINT_05_TERRAIN_AND_ISLANDS.md` | Terrain and Islands | Baked heightfield terrain; continuous waterline crossing; islands emerge; LOD chunks; Rapier heightfield collision; shoreline verified above and below | Demo review |
| 06 | `CHECKPOINT_06_BREACH_OVER_REGION.md` | Breach Over Region | Breach, airborne framing, re-entry over real region; Track E breach parameters; splash injection via jeantimex `addDrop`; camera surface-transition blend | Demo review + feel review |
| 07 | `CHECKPOINT_07_PLACEHOLDER_LAYOUT.md` | Placeholder Layout | Color-coded rectangular blocks for every asset category placed per approved region layout; placeholder inventory complete | Demo review |
| 08 | `CHECKPOINT_08_ECCO_ATMOSPHERE.md` | Ecco Atmosphere Pass A | Track D fog curve, palette, visibility, lighting per zone; caustics intensity tuning; particles (marine snow, bubbles); underwater only; surface stays pure jeantimex | Demo review + visual review |
| 09 | `CHECKPOINT_09_CAVES_AND_OVERHANGS.md` | Caves and Overhangs | Authored modular cave meshes (CC0 Kenney kit + Blender); Rapier trimesh collision; terrain seam blending; cave-zone fog/lighting | Demo review |
| 10 | `CHECKPOINT_10_VEGETATION.md` | Vegetation | SeedThree bakes (or approved alternative) replace vegetation placeholders; instanced placement; vertex-shader sway | Demo review |
| 11 | `CHECKPOINT_11_FISH_AND_WILDLIFE.md` | Fish and Ambient Life | Fish schooling motion; ambient wildlife placement; user-supplied models when available; placeholders until then | Demo review |
| 12 | `CHECKPOINT_12_RUINS_AND_ARCHITECTURE.md` | Ruins and Architecture | User-supplied structure assets replace placeholder blocks; Rapier trimesh collision per structure | Demo review |
| 13 | `CHECKPOINT_13_AUDIO.md` | Audio | Minimal audio: underwater + above-water ambient loops; breach splash; surface breathing; low-pass muffle at waterline; WebAudio | Demo review |
| 14 | `CHECKPOINT_14_OTHER_MODES.md` | Rowing, Walking, and Flight | Three additional movement modes over the same region; donor system ports; mode-camera blending; one style everywhere | Demo review |

---

**Total:** 15 checkpoints (00–14), zero-padded, gapless. No sub-splits required under current research findings.

**Deviation log from master context §13.2:**
- Track E feel retuning explicitly scoped into checkpoints 01–02 (pool-scale) and 04–06 (region-scale and breach).
- Checkpoint 01 expanded to include dolphin animation integration (Track C confirmed 8 clips compatible with AnimationMixer; Track E §11 specifies the mixer architecture).
- No other deviations from the §13.2 ladder.
