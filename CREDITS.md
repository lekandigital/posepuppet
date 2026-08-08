# BodyArcade Shared-World — Asset Credits

_Last updated: 2026-08-08 (Checkpoint 05C docs pass). This file is mirrored
by the in-app credits panel (`/shared-world/?view=credits`)._

## 3D Models

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
