# Asset tools (asset-integration pass)

Offline conversion of the user's Ubuntu model-lab GLBs into Tidewater runtime assets. The lab
(`o-MacPro`, `/home/o/model-lab/`, reached read-only as `ssh box`) keeps a normalised GLB per
model under `derived/glb/<lab id>.glb` and a card with tests, renders and licence evidence
under `assets/<lab id>/` (`asset.json`, `ASSET_CARD.md`).

1. `npm install` here (the dependencies are not part of the app build).
2. Copy the source GLBs and their `asset.json` cards into a scratch directory as
   `<lab id>.glb` and `<lab id>__asset.json` (e.g. `ssh box tar …`; verify SHA-256).
3. `node convert.mjs --in <scratch> --out ../../public/models/additions` — one runtime GLB per
   recipe in `recipes.mjs` (bake skinned rest poses, drop parts, re-pivot, scale, weld / join,
   meshoptimizer decimation into `LOD0` / `LOD1` / `LOD2` root nodes, component thinning for
   foliage, sharp texture resizing / re-encoding) and `manifest.json` (provenance, licence,
   lab path, SHA-256 of source and output, recipe, bounds, LOD triangle counts).
4. `node credits.mjs --dir ../../public/models/additions` → `CREDITS.md` from the manifest.
5. `node thumbs.mjs --dir ../../public/models/additions --out /tmp/thumbs` — a headless
   three.js render of every output (pivot, scale, alpha masks, textures); not Tidewater's look.

`recipes-future.mjs` + `--recipes` builds the staged future-game assets
(`assets/future-games/models/`, pass-through for rigged sources).
