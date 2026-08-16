# BodyArcade source record — Kenney Modular Cave Kit 1.0

- **Asset:** Modular Cave Kit, version 1.0 (40 models)
- **Author/distributor:** Kenney (www.kenney.nl)
- **Source page:** https://kenney.nl/assets/modular-cave-kit
- **Acquired:** 2026-08-15, direct download from the source page's own link
  (`https://kenney.nl/media/pages/assets/modular-cave-kit/37ec3cb12d-1783667097/kenney_modular-cave-kit_1.0.zip`)
- **Archive SHA-256:** `48f37a6d4f241124cd7da17da1c6d4ed1bf1820bb149dcb233fbd5ebdd8ba996`
  (the ZIP itself is not committed, per the repository hygiene rule; this
  directory holds the extracted GLB models actually consumed by the CP09
  cave authoring pipeline, plus the kit's own `License.txt`)
- **License:** Creative Commons Zero (CC0)
  http://creativecommons.org/publicdomain/zero/1.0/
- **Live license check (CP09 asset gate, master §12 item 2):** performed
  2026-08-15 against the live source page — the page states "Download this
  package (40 assets) for free, CC0 licensed!"; the bundled `License.txt`
  (this directory) confirms CC0 and notes crediting is voluntary. Kenney's
  release announcement (2026-07-10) states "Completely free for everyone,
  no attribution/donation/etc. required."
- **User approval (2026-08-16):** Kenney Modular Cave Kit 1.0 under the
  verified CC0 license, used as dressing on the hand-authored BodyArcade
  cave shells. The authored shells remain the true navigable cave/arch
  geometry.
- **Use:** authoring-time kitbash geometry for the CP09 cave/arch modules
  (`authoring/caves/`). Only geometry is consumed; the kit's palette
  textures are not used — the runtime cave material shares the region's
  substrate rock classification (Track B Q19 seam rule). The kit models
  are never loaded at runtime; the runtime loads the baked module
  artifacts under `public/world/caves/`.
- **Credit (voluntary, given):** "Kenney (www.kenney.nl)" — recorded in
  repo-root `CREDITS.md` and the in-app credits view.
