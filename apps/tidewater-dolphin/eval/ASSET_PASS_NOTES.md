# Asset-integration pass — working notes (paused)

_2026-11-04, cloud session. The Ubuntu asset library could not be reached from the cloud
environment (see `docs/cloud-environment/box-ssh-access.md`); by the user's direction the pass is
paused before any replacement-asset implementation until that connection is fixed. These notes
preserve the survey and the design so the next session does not repeat them._

## Baseline established

- Branch `bodyarcade-tidewater-cp10-controls-camera` at `d843be1` (CP10 complete); `npm run test`
  passes headlessly (52 unit + 99 controls checks); `npm install` is required in a fresh container.
- The existing optional scenery layer (`src/additions/SceneryAdditions.js`) draws two groups of
  Tidewater's own Poly Haven scans (sunken driftwood 11 instances, shell drifts 30) through
  Tidewater's `ScannedDebris` material / LOD pipeline, deterministic, toggled per category in the
  Play tab, `?original` / `?enhanced`.
- `eval/survey/bay-survey.mjs` (new): headless bathymetry + Tidewater reef/bay-floor occupancy maps
  built from the vendored source without a GPU — Tidewater's `Reef` placement runs on a bare object
  that borrows `Reef.prototype`, so the printed layout is exactly the app's.

## What the survey shows (for site authoring)

- The main reef system covers x −198…42, z −12…173 (west half of the bay); its bay-floor scatter
  (`placeBay`) carpets the whole bay with meadow tufts, half-buried bay rocks, small corals and
  small life — the bay is **not** empty sand, so "more scattered objects" would not read.
- Bathymetry: dolphin spawn (0, 66) in 6 m; a deep basin south of it (x −15…25, z 130…160,
  16–20 m); its east wall drops from 7 m at x ≈ 70 to 12–14 m at x ≈ 55 between z 85 and 125
  (≈ 25° slope); an east plateau at 7–9 m around (93, 128); shoaling sand east of x ≈ 115.
- What is missing from the bay: tall structure outside the main reef, landmarks, concentrated
  fish communities away from the pier.

## Design kept for the resumed pass (not implemented)

Four optional sites as new `ADDITION_CATEGORIES`, authored on the survey, deterministic (seeded):

1. **The wreck** — Tidewater's procedural lobster boat (`BoatModel`) listing on the basin's east
   wall at ≈ (57, 87), 9–10 m, materials shared with the drivable boat (no new pipelines), flag
   triangles dropped, nav/glow hidden, hull rasterised into a height field so the dolphin, the
   walker and the fish treat it as ground; sponges and corals settled on and around the hull;
   grunts, snappers, sergeants, a grouper, a barracuda and a silverside school.
2. **Sea-fan slope** — gorgonian forest (rods, plumes, whips, fans broadside to the swell), barrel
   sponges and plates on the wall x 44…78, z 78…128; jacks and an eagle ray patrolling a path along
   the wall; chromis clouds.
3. **East coral garden** — a patch reef on the plateau around (93, 128): framework slabs, boulders,
   brain / star / staghorn / lettuce / plate corals, a gorgonian layer, small life, meadow fringe;
   a full reef-fish community including a turtle.
4. **Deep basin** — big barrel sponges, deep fans, wire and black coral on the basin floor and
   slope (12–19 m); tarpon, an eagle ray, a stingray, a grouper.

Implementation approach (verified feasible headlessly): a `ReefGarden` integration class whose
prototype chain borrows Tidewater's `Reef.prototype` placement, batching and culling (vendor code
untouched), per-site height fields for toggling, `FishSchools` subclasses overriding `layout()`
for per-site fish, a composite ground (terrain ∪ reef ∪ enabled sites) handed to the dolphin's
world sampler, Tidewater's `Player`, and the reef's own fish (`reef.fish.floorAt`). All tops are
kept below −2.2 m so the dolphin's swimmable mask is unchanged. Memory: the reef kinds geometry
is 3.8 MB, so a second merged batch is affordable.

These are intended as a complement to the Ubuntu-library assets, not a substitute; the library's
underwater models (if they exist in game-ready form) would be integrated through the same optional
layer, loaded with Tidewater's GLB reader / GLTF loader and `standard()` materials.
