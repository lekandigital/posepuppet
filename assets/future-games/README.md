# Staged models for future BodyArcade games

_Asset-integration pass, 2026-11-04. These files are **not loaded by any app**; they are the
reusable picks from the user's Ubuntu model library, converted and stored here so later
projects (EXR-style rowing, other aquatic games, exploration / vehicle games) start from
licence-clean, game-ready GLBs with provenance. The Tidewater dolphin's own imported scenery
lives separately under `apps/tidewater-dolphin/public/models/additions/`._

## What is here (`models/`)

Converted with `apps/tidewater-dolphin/tools/assets/convert.mjs --recipes recipes-future.mjs`
(plain binary glTF, Y-up, metres, origin at the base, 1K textures, LOD root nodes `LOD0` /
`LOD1`; the rigged mannequin is passed through with its skeleton and clips). `manifest.json`
records title, author, source page, licence, the lab path on the asset server, source and output
SHA-256 and the recipe; `CREDITS.md` is generated from it.

| file | for | source (author, licence) | size |
|---|---|---|---|
| `ocean_rowing_boat.glb` | rowing: a modern ocean rowing boat, 8.7 m, cabins, deck, oars baked in | Five in a Row Ocean Rowing Boat — fiveinarow, CC-BY 4.0 (Sketchfab) | 1.9 MB · 30k / 16k tris |
| `rowboat_old.glb` | rowing / lakeside: weathered wooden rowboat with two oars, 3.3 m | Old Rowboat — TooManyDemons, CC-BY 4.0 (Sketchfab) | 150 KB |
| `rowboat_lowpoly.glb` | rowing: low-poly rowboat, three thwarts, two oars, 3.3 m | Low-Poly Rowboat — Cas_Models, CC-BY 4.0 (Sketchfab) | 51 KB |
| `rowing_oar.glb` | rowing: photoscanned wooden oar, 3.2 m, long axis x, centred (pivot at the loom) | Rowing Oar — kai9987kai, CC-BY 4.0 (Sketchfab) | 600 KB · 5.7k / 3.3k tris |
| `kayak_lowpoly.glb` | kayaking: varnished wooden kayak, 3.4 m | Wooden Kayak & Paddle (kayak piece) — Dominik Biały, CC-BY 4.0 (Sketchfab) | 21 KB |
| `simple_wood_boat.glb` | small craft: low-poly rowboat with oars, 4 m, untextured | Simple Wood Boat — mikeask, CC0 (OpenGameArt) | 18 KB |
| `mannequin_rigged.glb` | athletes: rigged, animated mannequin (45 joints, 12 clips) — a rower / swimmer stand-in for rig and pose work | Mannequiny The Open 3D Mannequin — hardboileduser, CC-BY 4.0 (OpenGameArt) | 1.2 MB |
| `canal_bridge.glb` | riverbank / lakeside: mossy stone triple-arch bridge, 13.7 m span | Canal bridge — ninelionar, CC0 (OpenGameArt) | 880 KB |
| `palm_tree.glb` | coasts: realistic coconut palm, 4.4 m (scale per use), alpha-masked fronds | Palm tree v2 — Yughues, CC0 (OpenGameArt) | 200 KB |
| `marble_statue.glb` | exploration: detailed warrior statue, 1.6 m (425k → 30k tris), marble colour at runtime | Medieval Statue — Daniel Andersson, CC0 (OpenGameArt) | 720 KB |

Also reusable, already in the repository for the Tidewater dolphin
(`apps/tidewater-dolphin/public/models/additions/`): photogrammetric boulders, the stone temple,
columns, slabs, the carved head, the ruined cathedral walls, the lighthouse with its keeper's
house, the weathered skiff, the fishing-boat hull, the manatee and the hammerhead, Poly Haven
shrubs, branches and bark debris, kelp and sea-weed clumps.

## Not staged — left on the asset server (`o-MacPro`, `/home/o/model-lab/`), with the reason

Retrieve with `ssh box` (read-only) from `derived/glb/<lab id>.glb` (the lab's normalised GLB);
cards with tests, renders and licence evidence are in `assets/<lab id>/`; the catalogue in
`state/lab.sqlite` (tables `assets`, `verdicts`, `licenses`, `provenance`, `vision`).

| what | lab id / path | why not staged |
|---|---|---|
| Poly Haven island trees, pines, firs, tree small 02 (CC0) | `derived/glb/ph-island-tree-01-a8f3f16b.glb` (62 MB), `ph-island-tree-02-e4e94d37` (42 MB), `ph-island-tree-03-49dba0ce` (80 MB), `ph-tree-small-02-c4ea5ba3` (82 MB), `ph-pine-tree-01-b-49a86db3` (247 MB), `ph-fir-tree-01-*`, `ph-pine-sapling-*` | 40–250 MB each (8K textures); convert per use with 1K–2K textures via `convert.mjs` |
| Poly Haven root cluster, more shrubs, grasses, moss, flowers (CC0) | `derived/glb/ph-root-cluster-02-a-643160b9.glb` (214k tris), `ph-shrub-01-*`, `ph-shrub-sorrel-01-*`, `ph-grass-*`, `ph-moss-01-*`, `ph-flower-*` | plenty of variants; take what a scene needs |
| 3TD Harbour Pack: docks, wharf, warf stand, industrial shack, split rock (CC0) | `/home/o/Downloads/models/OpenGameArt-3D/CC0/3td-harbour-pack/3td_Harbor Pack.zip` (Collada `.DAE` parts); lab card `oga-3td-harbour-pack-57336c05` holds the merged lighthouse | the lab's GLB merges the pack; the dock / wharf pieces need their own conversion from the `.DAE` files |
| 3TD Cave Pack Pro and Fantasy Ruins Pack kit pieces (CC0) | `derived/glb/oga-3td-cave-pack-pro-v1-0-8eb0a359--k-*.glb`, `oga-3td-fantasy-ruins-pack-56d92afe--k-*.glb` | one boulder and one ruin piece are in Tidewater; the rest on demand |
| Roman / Greek triremes (CC-BY, 34–48 MB) | `man-roman-trireme-6fc70f53`, `man-roman-trireme-w-corvus-dc8666c0`, `man-a-greek-trireme-ship-57edb882`, `man-trirreme-roman-2be4c5d0` | large; a rowing-history showpiece only |
| Bridge Command ships (52) | `derived/glb/bc-*.glb` | "use with Bridge Command only" licence — not redistributable |
| Rigs of Rods vehicles, OpenBVE trains, VDrift cars, Orbiter craft | `derived/glb/ror-*`, `bve-*`, `vd-*`, `orb-*` | mostly unstated or restrictive licences (`ok_to_commit` no); FlightGear aircraft (`fg-*`) are GPL |
| Quaternius Animated Fish / Ultimate Nature packs (CC0, flat-shaded low poly) | `derived/glb/xtra-*-in-quaternius-*.glb` | style clashes with Tidewater's scans; fine for a stylised game |
| Whale shark, jellyfish, low-poly human (threejs-projects-master bundle) | `man-whale-shark-final-in-threejs-projects-ma-014a8ba3`, `man-jellyfish-animated-in-threejs-projects-m-af95049c`, `man-low-poly-human-in-threejs-projects-maste-537f3ec1` | no verifiable author / source — cannot be attributed; never commit |
| Royalty-free-store boats / photoreal humans | `man-wooden-rowing-boat-with-oars-f9128bdf`, `man-rigged-t-pose-human-male-w-50-face-blend-41fd6403` | licence needs the user's ruling before any public use |

## Gaps in the library (for the rowing game)

No single-scull rowing shell, no sliding seat / rigger / racing buoy, no boathouse, no pontoon
and no rigged rower exist in the library (searched titles, labels and vision descriptions:
scull, shell, skiff, rigger, buoy, pontoon, boathouse, rower, coxswain). The ocean rowing boat
and the oar above are the closest; a scull and buoys will have to be sourced or modelled.
