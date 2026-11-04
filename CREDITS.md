# BodyArcade Shared-World — Asset Credits

_Last updated: 2026-11-04 (asset-integration pass: imported scenery models; previously 2026-10-16, Checkpoint 10 — Tidewater environment adoption).
This file is mirrored by the in-app credits panels
(`/shared-world/?view=credits` for the Three.js region app; the F1 controls
sheet and `?credits` of `apps/tidewater-dolphin/`)._

## Asset-integration pass (2026-11-04) — imported scenery models and staged future-game assets

- **Tidewater dolphin, optional scenery additions** (`apps/tidewater-dolphin/public/models/additions/`,
  Play tab → Scenery additions → Enhanced): 25 runtime GLBs converted from 23 models of the
  user's Ubuntu model-lab by `apps/tidewater-dolphin/tools/assets/convert.mjs`. Per-asset title,
  author, source page, licence, lab path and SHA-256: `public/models/additions/manifest.json`
  and the generated `CREDITS.md` beside it; the in-app credits (F1 sheet, `?credits`) carry the
  CC-BY attributions. Licence classes are the lab's evidence (read from each listing at intake);
  the live-listing check at release remains the user's step.
  - **CC-BY 4.0** (modified for BodyArcade): "Animated Kelp" by JosephWPugsley
    (https://sketchfab.com/3d-models/74c400fd4d81469199268ac27451d03f); "Kelp" by Mazelya
    (https://sketchfab.com/3d-models/d1758bd85ec04eaab14fe50028108a10); "Sea Weed" by rkuhlf
    (https://sketchfab.com/3d-models/d97c596b189845b681cc8eef8a3ab429); "Fantasy Fishing Boat" by
    eb78 (https://sketchfab.com/3d-models/bf7d68cb9db5469a9895064de1499d68); "Ancient column" by
    OdinTdh (https://opengameart.org/content/ancient-column).
  - **CC0**: Medieval Stone Temple and Medieval Boat (AnyRPG), Broken Stone Slab (Kutejnikov),
    Figure Head Human Statute (DaGameKnower), Free Photogrammetric Rock / Rock 2 / Rock Cluster
    (Yughues), Rock (kindland), Mossy Rock (hooded_kian), 3TD Harbour Pack, 3TD Cave Pack Pro and
    3TD Fantasy Ruins Pack (Ron Kapaun), Low Poly Manatee with Hand Painted Textures (DevMops),
    Shark (low poly) (STKRudy85) — all OpenGameArt.org; Wild Rooibos Bush, Shrub 03, Dry Branches
    Medium 01, Bark Debris 01 — Poly Haven (polyhaven.com).
- **Staged future-game assets** (`assets/future-games/models/`, not loaded by any app): 10 GLBs —
  see `assets/future-games/README.md` and its `CREDITS.md` / `manifest.json`. CC-BY 4.0: Five in a
  Row Ocean Rowing Boat (fiveinarow), Old Rowboat (TooManyDemons), Low-Poly Rowboat (Cas_Models),
  Rowing Oar (kai9987kai), Wooden Kayak & Paddle (Dominik Biały), Mannequiny The Open 3D
  Mannequin (hardboileduser). CC0: Simple Wood Boat (mikeask), Canal bridge (ninelionar), Palm
  tree v2 (Yughues), Medieval Statue (Daniel Andersson).

## Checkpoint 10 — Tidewater host environment (`apps/tidewater-dolphin/`)

- **Tidewater** — island, ocean, sky, rendering engine, village, pier, reef,
  vegetation, wildlife, whale, boat and soundscape — by Daniel Greenheck /
  DRG Software Solutions LLC — **MIT** ("Copyright (c) 2026 DRG Software
  Solutions LLC"; license text preserved verbatim at
  `apps/tidewater-dolphin/vendor/tidewater/LICENSE`).
  Source: https://github.com/dgreenheck/tidewater — live build
  https://dgreenheck.github.io/tidewater/ — pinned at commit
  `4811ba48d795197de5621985f404e765c0b7c0ef` (2026-09-24), vendored
  unmodified at `apps/tidewater-dolphin/vendor/tidewater/` with a per-file
  SHA-256 manifest (`BODYARCADE_SOURCE_RECORD.md`). The integrated app imports
  the vendored modules in place; its own orchestration copies (App.js →
  `src/DolphinApp.js`, main.js → `src/main.ts`, AppUI.js →
  `src/DolphinAppUI.js`) and the `SkinnedModel` additive-layer extension are
  recorded in the CP10 report.
  Third-party assets inside Tidewater keep their own licences, audited
  2026-10-16 against the vendored credit files:
  - 42 Freesound field recordings (`vendor/tidewater/public/audio/`) — **CC0 1.0**
    (per-file author / source table in `public/audio/CREDITS.md`).
  - Poly Haven photogrammetry debris (dead quiver trunk / branches, lambis
    shell) and the vendor-stall props and textures — **CC0 1.0**
    (`public/models/debris/CREDITS.md`, `public/models/props/CREDITS.md`).
  - Vendor characters `joe.glb` / `marta.glb` — Microsoft Rocketbox Avatar
    Library — **MIT** (`public/models/characters/LICENSE-Rocketbox.md`).
  - Humpback whale — original procedural model by DRG Software (MIT with the code).
  - Stall lettering fonts Permanent Marker (Apache-2.0), Cabin Sketch and
    Oswald (SIL OFL 1.1) — licence texts in `vendor/tidewater/tools/props/fonts/`.
  - SMAA area / search lookup textures — from three.js (MIT).
  - Cloud noise volumes (`public/clouds/*.bin`) — DRG Software's Sky Pro WebGPU,
    published under the repository MIT licence by its copyright holder.
  - Inter / JetBrains Mono / Caveat Brush / Kalam web fonts — loaded from Google
    Fonts at runtime (OFL), not redistributed.
- **Dolphin** — the same GAMICO asset as below, byte-identical copy at
  `apps/tidewater-dolphin/public/models/dolphin/dolphin.glb` with
  `LICENSE-dolphin.txt` alongside (SHA-256
  `e2cca876f8935269df8b9b658962f5db349bb9e11e6ed695a8c691bb94ef6cb4`). Runtime
  modification unchanged: the `Jump` clip's baked `Dolphin_Root` translation
  channel is stripped at load.
- **Scenery additions (CP10 continuation, optional layer, Play tab → Original /
  Enhanced)** — no new asset files. The layer re-instances four Poly Haven
  **CC0 1.0** photoscans that Tidewater already ships and renders
  (`vendor/tidewater/public/models/debris/`: Dead Quiver Trunk, Dead Quiver
  Branch 01 / 02, Lambis Shell — https://polyhaven.com/a/dead_quiver_trunk,
  …/dead_quiver_branch_01, …/dead_quiver_branch_02, …/lambis_shell; Tidewater's
  LOD exports per `public/models/debris/CREDITS.md`) as 11 sunken driftwood
  pieces on the bay floor and 30 shells on the shallow sand, drawn with
  Tidewater's own ScannedDebris material and LODs; deterministic placement
  record at `apps/tidewater-dolphin/eval/results/additions-manifest.json`.
  The user's downloaded collection was audited and nothing from it was
  added (see the CP10 report, "Assets": character rigs, the Kenney cave kit,
  flight-demo props and aircraft models rejected on art direction / relevance).

## 3D Models

- **Modular Cave Kit 1.0** — by Kenney (www.kenney.nl) — **CC0**
  (http://creativecommons.org/publicdomain/zero/1.0/).
  Source: https://kenney.nl/assets/modular-cave-kit
  Live license check 2026-08-15 (CP09 asset gate, master §12 item 2): the
  source page states "Download this package (40 assets) for free, CC0
  licensed!" and links Creative Commons CC0; the bundled `License.txt`
  confirms CC0 with voluntary crediting; Kenney's release note states
  "Completely free for everyone, no attribution/donation/etc. required."
  User approval recorded 2026-08-16 (Kenney geometry as dressing on the
  hand-authored BodyArcade cave shells; the authored shells remain the
  true navigable geometry). Kit models live at
  `apps/shared-world/authoring/assets/kenney-modular-cave-kit/` (authoring
  input only — geometry kitbashed into the baked cave modules under
  `apps/shared-world/public/world/caves/`; the kit's palette textures are
  not used; runtime materials come from the region substrate rock
  classification). Credit is voluntary under CC0 — given with thanks.
- **Dolphin** — "Realistic Dolphin | Rigged with 25+ Animations" by GAMICO
  (https://sketchfab.com/gamico) — **CC-BY 4.0**
  (https://creativecommons.org/licenses/by/4.0/).
  Source: https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8
  License verified at the live listing 2026-07-16 (Track C §1 Item 1).
  Shipped at `apps/shared-world/public/models/dolphin/dolphin.glb` with
  `LICENSE-dolphin.txt` alongside (attribution + full CC-BY 4.0 text).
  Modified: runtime-only — the `Jump` animation clip's baked `Dolphin_Root`
  translation track is stripped at load so gameplay code drives breach
  motion. The redistributed `.glb` file itself is byte-identical to the
  Sketchfab download (SHA-256
  `e2cca876f8935269df8b9b658962f5db349bb9e11e6ed695a8c691bb94ef6cb4`).
  Standing note (Track C Item 2, non-blocking): the listing advertises
  "25+ animations"; both downloaded containers carry exactly 8 clips.

## Code / Vendored

- **Water pipeline** — jeantimex/threejs-water
  (https://github.com/jeantimex/threejs-water) — MIT. "Original work
  Copyright (c) 2011 Evan Wallace / Modified work Copyright (c) 2026
  Yong Su." Vendored pristine at
  `apps/shared-world/vendor/threejs-water/` (provenance + integrity
  manifest in its `VENDOR.md`). Pool tile texture from zooboing on
  Flickr (per upstream README/help panel). Used by the `?view=stock` and
  `?view=pool` views; the region view's water is the WaterThreeJS port
  below as of Checkpoint 05C.
- **Region ocean** — WaterThreeJS by mohamedachrefelouafi — **MIT**
  (© 2026, license text preserved). Fully procedural Three.js ocean
  (Gerstner surface, analytic atmosphere sky, underwater volumetrics,
  HDR post chain); no upstream asset files (everything is shader code).
  Pinned read-only reference snapshot with per-file SHA-256 manifest at
  `docs/bodyarcade-stage3/references/waterthreejs/`
  (`BODYARCADE_SOURCE_RECORD.md`). Ported into app-owned code at
  `apps/shared-world/src/ocean/` with the upstream MIT text shipped
  alongside (`WATERTHREEJS_LICENSE.txt`). Modifications: TypeScript
  annotations, region-terrain integration, a time-of-day cycle, and a
  night light-dimmer (recorded in the ocean-replacement addendum).

## Textures

_None beyond the embedded dolphin textures and the vendored demo assets
above (Checkpoint 01)._

## Audio

_None yet (audio arrives at Checkpoint 13)._

_CC-BY assets require the credit above to remain accessible to all end
users (Sketchfab policy). The in-app credits panel satisfies this for
the running demo; this file satisfies it for the repository._
