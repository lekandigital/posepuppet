# Asset-integration pass — Ubuntu model library → Tidewater (report)

_2026-11-04, cloud session on `bodyarcade-tidewater-cp10-controls-camera`, resumed after the
`ssh box` fix. The first attempt (preserved below under "History") could not reach the asset
server; this session selected, converted and integrated the user's models. Nothing of the
vendored Tidewater tree, the CP10 dolphin (controls, cameras, sim, body input) or the walker /
boat / fishing modes was changed; the additions are an optional, reversible layer._

## 1. What was delivered

- **25 runtime assets** converted from **23 models** of the user's Ubuntu model-lab
  (`/home/o/model-lab/derived/glb/`), 12.7 MB under `public/models/additions/` with
  `manifest.json` (title, author, source page, licence, lab path, source + output SHA-256,
  recipe) and a generated `CREDITS.md`; in-app credits updated (F1 sheet, `?credits`;
  repo-root `CREDITS.md`).
- **Six new scenery categories** (Play tab → Scenery additions; `?original` / `?enhanced`):
  seagrass meadows (370 instances), kelp wall (141), the wreck (25), drowned temple (103),
  added wildlife (2 manatees, a hammerhead, 451 reef fish of Tidewater's own species at the
  wreck and the temple), lighthouse & shore scrub (71). The two CP10 categories (driftwood,
  shells) are unchanged. 756 placement records, deterministic (seeded), all solid tops below
  −2.5 m so the dolphin's swimmable mask is identical with the additions on or off.
- **Runtime architecture** (`src/additions/`): `GLBScenery.js` (engine glTF reader → engine
  textures / materials with Tidewater's underwater lighting, instancing per model × LOD ×
  material with CPU frustum / distance culling and Bayer LOD cross-fade, swell sway in the
  vertex stage, procedural stone / tint / shark surfaces, max-height structure fields),
  `Swimmers.js` (authored loops, body wave with motion vectors, ground / ceiling clamps),
  `SiteFish.js` (a `FishSchools` subclass with an authored community: Tidewater's fish, AI,
  batching and material), `SceneryAdditions.js` (placement on the bay survey, composite
  contact surface `ground` / `floor` for the dolphin's sampler and camera, Tidewater's walker
  and the reef's fish). `DolphinApp.js` builds and loads the layer right after the reef so the
  players are created on the composite surface.
- **Offline tooling** (`tools/assets/`, own `package.json`): `convert.mjs` (bake skinned rest
  poses, drop parts, re-pivot, scale, weld / join, meshoptimizer decimation into LOD root
  nodes, component thinning for foliage, sharp texture resizing / re-encoding, provenance into
  the manifest), `recipes.mjs` / `recipes-future.mjs`, `thumbs.mjs` (headless three.js render
  of every output), `credits.mjs`.
- **Staged future-game assets** (`assets/future-games/`, 5.7 MB, not loaded by any app): ocean
  rowing boat, two rowboats, a photoscanned oar, a kayak, a simple boat, a rigged + animated
  mannequin (skeleton and 12 clips kept), canal bridge, palm tree, marble statue — with
  `README.md` (what stays on the server and why, gaps: no single scull, buoys, boathouse,
  rigged rower in the library), `manifest.json`, `CREDITS.md`.
- **Tests**: `npm test` (unit 69 → 86 checks incl. placement determinism, pinned counts, tops,
  clearances; controls unchanged) pass headlessly; `test/modes.mjs` extended with live checks
  (GLBs loaded, field tops, composite ground seen by the dolphin's sampler, provenance on every
  record, per-category toggles, Enhanced / Original shots at the wreck, temple and kelp wall);
  `tsc --noEmit` and `vite build` pass. See §5 for what ran where.

## 2. Selection (lead-artist decisions)

The lab (37k catalogued models, 71k derived GLBs, `state/lab.sqlite`) is thin on underwater
life: 25 kelp, 3 coral / sponge, 45 fish, 34 large animals, most untextured or low-poly. The
picks and the rejections:

| role | chosen | rejected and why |
|---|---|---|
| kelp forest | **Animated Kelp** (JosephWPugsley, CC-BY): the only tall brown kelp with real frond texture; rest pose baked, 9.2 m, swell sway in the shader; **Kelp** (Mazelya, CC-BY) 365k-tri thicket thinned to 2k blades / 14k tris; **Sea Weed** (rkuhlf, CC-BY) blade clumps as understory and seagrass | Kelp ab0d4358 (untextured grey), Kelp with animation (black blades) |
| seagrass | the three Sea Weed clumps at 0.3–0.55 scale (0.6–1.5 m): taller than Tidewater's own meadow tufts, read as a bed from the dolphin's height | Poly Haven land grasses (nearly invisible under water), Quaternius flat-shaded tufts (style clash) |
| wreck | **Fantasy Fishing Boat** (eb78, CC-BY): textured wooden hull with mast; sail and oars removed, ropes / wood decimated 55k → 19k tris, 2K → 1K textures | 16th-century ship (untextured hull, 100k-line rigging), pirate ship (crude), triremes (34–48 MB) |
| landmark site | **Medieval Stone Temple**, **Ancient column** ×10 (standing / broken / fallen), **Broken Stone Slab** ×5, **Figure Head** (3.7 m carved head, procedural stone), **Cathedral ruins** piece | Underwater Ruin diorama (vertex-coloured, with a baked warrior figure and fish), Greek temple (CC-BY-SA, untextured), Stonehenge |
| rocks | Yughues' **photogrammetric rocks** (shapes) and kindland's **Rock** with Tidewater's own debris stone surface; **Mossy Rock** and the **3TD layered boulder** textured | Quaternius flat-shaded rocks, low-poly threejs rock, glossy black rock, rock_09 pebble scan |
| wildlife | **Manatee** (DevMops, CC0, hand-painted) grazing the spawn meadow; **hammerhead** (STKRudy85, CC0) with a procedural counter-shaded skin patrolling the wall; reef fish = Tidewater's own species at the new sites | Quaternius fish / shark / manta (flat-shaded, clash with Tidewater's procedural fish); whale shark and jellyfish (no verifiable author — not attributable); freshwater fish |
| coast | **3TD Harbour Pack** lighthouse + keeper's house (CC0) on the eastern headland; Poly Haven **Wild Rooibos Bush**, **Shrub 03**, **Dry Branches**, **Bark Debris** on the back-beach | untextured lighthouse, untextured dock kits, Poly Haven island trees (40–250 MB) |

Licences: CC0 and CC-BY 4.0 only, `never_commit` excluded, the lab's licence class recorded
per asset; the live-listing check at release remains the user's step (lab policy).

## 3. Sites (composition on the headless bay survey)

- **Seagrass meadows**: bed A on the shallow bay floor east of the spawn (centre 50, 74; 4.5–8.5 m;
  210 clumps in 7 patches) — the manatees' pasture; bed B on the east plateau (100, 121;
  5.5–9.5 m; 150 clumps) with the sunken skiff and algae rocks.
- **Kelp wall**: the east wall of the deep channel (x 54–76, z 94–134, 7–13 m): 64 stalks less a clearing round the hull —
  tall (7–11 m) in the deeper half, short on the shelf — in clumps, 14 thickets and 70 weed
  clumps at their feet, boulders on the slope; the swimming corridor up the channel (x < 52)
  stays open; every frond tip below −1.5 m.
- **The wreck**: at the foot of the wall at (56, 114), 12.9 m, heeled to port, keel laid along
  the slope (pitch from the terrain), sunk 0.35 m; weed and boulders around it; mast tip ≈ −9 m. The hull is in the contact
  surface (dolphin, camera, walker, fish).
- **Drowned temple**: a colonnade (two rows, 10 m apart) from the channel floor at 11 m down
  to the basin at 17 m, the temple at (4.5, 156) on the empty basin floor (19.9 m), the
  cathedral walls to the east, the carved head half-buried to the west, slabs along the
  colonnade, boulders on the rim, kelp on the southern rim, weed among the ruins; fish anchored
  at the columns and the temple.
- **Wildlife**: manatee loop over bed A at grazing height (0.55 m/s, bobbing); hammerhead loop
  wall → wreck → channel (1.7 m/s, 5–10 m); wreck community (grunts, sergeants, chromis,
  wrasses, tangs, a grouper, a barracuda, 120 silversides, 6 jacks patrolling the shark's
  loop) and temple community (two chromis clouds, grunts, sergeants, yellowtail, two angelfish
  pairs, a grouper, a barracuda, 140 silversides, 3 tarpon).
- **Headland**: lighthouse at (226, 136), 20.9 m up on the eastern headland, long axis along
  the coast; 70 shrubs / branches / bark pieces on the back-beach bands at both ends of the
  beach (0.7–2.4 m above the sea, clear of the pier, boardwalk and village).

## 4. Integration notes

- Materials go through the engine's `Material` so the imports get the scene lighting hooks:
  underwater attenuation, caustics, tinted ambient, shadows, TAA motion vectors. Imports with
  textures use glTF PBR (base colour, normal, ORM; Poly Haven ARM maps read AO); untextured
  scans use Tidewater's debris stone surface (`NatureMaterial.stoneSurfaceModule` over the shared
  terrain detail texture, with the terrain's hill-shadow module); blades are per-instance green
  with translucency; the shark is counter-shaded procedurally. Anything under water gets an
  algae film on its upward faces.
- Instancing: one `InstancedMesh` per model × LOD × material (≈ 70 potential draw calls, only
  levels with instances drawn); CPU re-bucketing only when the camera moves; LOD distances per
  model (foliage fades at 55–65 m — the underwater visibility is ~45 m; landmarks stay to
  300–500 m for the surface cameras; the lighthouse to 1.4 km).
- The contact surface: `StructureField` rasterises each solid instance's LOD1 triangles into a
  0.25 m max-height grid per category; `SceneryAdditions.structureAt()` is the max over the
  enabled categories, so toggling a category removes its collision too. `ground` (ReefLike:
  `structureAt`) feeds the dolphin's `TidewaterWorldSampler` (contact model, camera collision),
  `floor` (`floorHeightAt`) feeds Tidewater's `Player`, and the reef's own fish read it through
  `reef.fish.floorAt` (an instance property, set at runtime; the vendored code is untouched).
- Loading: ~13 MB of GLBs, textures decoded with the engine's `decodeImage`, mipmapped; the
  `Placing the scenery additions…` step of the loader.

## 5. Verification and evidence

Environment: Claude Code cloud container (4 cores, 16 GB, a ~12 GB memory cgroup for the
session's processes), headless Chromium 153 on Chrome's software WebGPU adapter (SwiftShader),
1280 × 720. No native GPU and no hands-on gameplay test happened in this session.

| check | where | result |
|---|---|---|
| `npx tsc --noEmit` | cloud | pass |
| `npx vite build` | cloud | pass (dist 86 MB incl. 27 addition files) |
| `npx tsx test/unit.ts` | cloud, headless | **all passed** (86 checks; 17 new: placement determinism, pinned counts, tops, clearances, composite ground) |
| `npx tsx test/controls.ts` | cloud, headless | **all passed** |
| app load, `?enhanced` (first load of the session) | cloud, software WebGPU | the layer itself loaded: 25 models ready, 670 records, 451 site fish, no loader / shader error from the layer; the render loop never started (see below) |
| `node test/modes.mjs`, `test/play.mjs` (live) | cloud, software WebGPU | **ENVIRONMENT_BLOCKED** — the app cannot finish loading in this container (below) |
| in-app chase-camera shots, Enhanced vs Original | cloud, software WebGPU | **ENVIRONMENT_BLOCKED** (below); replaced by the standalone preview in §5.2 |
| standalone site preview (three.js, WebGL, same placement, same GLBs, real terrain heights) | cloud | 18 views, §5.2 |

### 5.1 Why the full app could not be rendered here (measured)

Tidewater's loader precompiles every pipeline of every material in the scene, hidden or not
("Compiling shaders…"). On SwiftShader each compiled pipeline retains a large JIT footprint:
the GPU process grew by ~2 GB every 30 s and was killed by the memory cgroup
(`dmesg`: `Memory cgroup out of memory: Killed process (chrome) anon-rss 12.7 GB`), after which
the page reports "A valid external Instance reference no longer exists". Measured with a
watcher sampling the GPU process every 30 s:

| load | GPU process peak | outcome |
|---|---|---|
| `?enhanced&noHaze&noVeg&noClouds` (all additions) | 11.6 GB at 270 s | killed |
| `?noAdditions&noHaze&noVeg&noClouds` (**no imported models at all** — the pristine pipeline set) | 11.5 GB at 240 s | killed |

The baseline fails the same way, so the limit is Tidewater's own pipeline count on this
adapter in this container, not the additions. Several vendor pipelines (haze, environment
mips, ocean mips) also exceed SwiftShader's per-stage binding limits and are skipped there, as
before this pass. Three switches were added for memory-limited runs and low-end machines:
`?noAdditions` (load nothing), `?additions=kelpWall,wreck` (load only these categories),
`?lazyAdditions` (attach after the precompile); and the layer's own material count was cut
from 40 to 33 (shared stone and weed materials, no shadow variants for small props).

### 5.2 Visual evidence (standalone preview, `eval/preview/`)

`export-sites.mjs` runs the app's own placement code on Tidewater's deterministic terrain and
reef (no GPU) and exports the records, the swimmer loops, the fish zones, Tidewater's solid
reef / bay items (as proxies) and a 1 m terrain grid; `preview-sites.mjs` renders the converted
GLBs at those records with three.js in headless Chromium (WebGL) from the dolphin's eye
positions (chase framing, a 2.9 m capsule for scale) and from above. It shows placement, scale,
orientation, ground contact, clearances and the Enhanced / Original difference exactly; it does
NOT show Tidewater's water, lighting, caustics, fog or materials (untextured scans are flat
grey there, kelp fronds are unlit from below). Images in `eval/results/images/`:

- `preview-meadow-enhanced/original.jpg` — bed A from the dolphin's height: a seagrass meadow
  (clumps 0.7–1.9 m) over the bare sand of the original, the manatee loop in yellow.
- `preview-kelpwall-enhanced/original.jpg` — from the channel floor up the wall: stalks,
  thickets, understory, the wreck in its clearing; the original is bare sand and bay rocks.
- `preview-wreck-bow.jpg`, `preview-wreck-above.jpg` — the hull laid along the slope, heeled to
  port, keel 0.35 m in the sand, mast and rigging standing, weed around; boulders 11–12 m off.
- `preview-colonnade.jpg`, `preview-temple-door.jpg`, `preview-statue.jpg` — the colonnade
  (standing, broken and fallen columns), the temple at its end, the ruin walls, kelp on the rim,
  the carved head's corner of the basin.
- `preview-plateau.jpg` — bed B with the sunken skiff.
- `preview-lighthouse-beach.jpg`, `preview-shore-east.jpg` — the lighthouse on the eastern
  headland seen from the beach water; the back-beach scrub line.
- `preview-over-temple.jpg`, `preview-over-kelpwall.jpg`, `preview-over-bay.jpg` — site
  layouts from above and the whole bay.
- `assets-converted-thumbs.jpg`, `assets-future-thumbs.jpg` — every converted GLB (all LODs
  side by side, 1.8 m reference post) and the staged future-game assets.

Iterations made on this evidence: the wreck was first sunk 1.2 m into the slope by the
"lowest point of the footprint" rule (only the mast showed) → the keel is now laid along the
terrain slope and rests on the centre ground; kelp grew through the hull → a clearing is cut
round it; two of the temple's boulders blocked the carved head → moved; the seagrass beds were
thin → 370 clumps at 0.38–0.66 scale.

### 5.3 What the user should check locally (Apple Silicon, headed Chrome, `node review.mjs`)

1. Load `?enhanced`, then `node test/modes.mjs` and `node test/play.mjs` from a second shell:
   the live checks (25 GLBs loaded, field tops, composite ground, provenance, toggles) and the
   dolphin regression suite.
2. Swim from the spawn east over bed A (manatees), then south-east down the channel to the
   kelp wall and the wreck, then south down the colonnade into the basin; surface near the
   eastern headland (lighthouse). Look for: kelp sway and frond lighting, the stone surface on
   the boulders and the head, the algae film, fish at the wreck and the temple, the hammerhead's
   patrol, the camera over the wreck and the temple roof.
3. Toggle each category off and on in the Play tab (and Original / Enhanced) while at a site.
4. Frame time with everything on at the kelp wall and at the temple vs Original (the kelp's
   alpha-tested fronds are the overdraw hot spot); the loader's "Compiling shaders…" time.

## 6. Remaining issues and recommended next work

- **Native-GPU validation** (Apple Silicon, headed Chrome, visible window): frame time with all
  categories on at the kelp wall (the alpha-tested kelp is the overdraw hot spot), draw calls,
  texture memory (~60 MB of imported textures with mips), the kelp sway and the swimmers'
  motion vectors under TAA, the stone surface tiling on the big boulders. The LOD distances
  and the kelp stalk count (64) are the knobs.
- **Kelp card thinning** for LOD1 / LOD2 keeps 55 % / 25 % of the fronds; if popping shows on a
  real GPU, bring the switch distances closer or add a billboard LOD.
- **Fish at the sites** are simulated by Tidewater's AI with the composite floor; their
  `warmUp()` runs before the fields exist in the reef's own instance (the reef fish only), so a
  reef fish could start inside the wreck and swim out — harmless, deterministic.
- **The walker** uses `floorHeightAt` only: it can stand on the temple roof if it dives there;
  the lighthouse has no collider (land, far from play).
- **Shore scrub** is modest (70 pieces at the two beach ends); the Poly Haven variants in the
  library are the small ones — bigger shrubs (Shrub 01 a–e, Sorrel) and the island trees are
  on the server if a denser back-beach is wanted.
- **Library gaps** for later games: no single scull, racing buoys, boathouse, pontoon or rigged
  rower; no coral / anemone models worth importing (Tidewater's own are better).
- The lab's licence classes are evidence, not the release check: verify the five CC-BY listings
  live before a public release and keep `CREDITS.md` with the build.

## History — first attempt (2026-11-04, paused: no SSH to the asset server)

- Branch at `d843be1` (CP10 complete); `npm run test` passed headlessly (52 unit + 99 controls
  checks); `npm install` is required in a fresh container.
- The existing optional scenery layer (`src/additions/SceneryAdditions.js`) drew two groups of
  Tidewater's own Poly Haven scans (sunken driftwood 11 instances, shell drifts 30) through
  Tidewater's `ScannedDebris` material / LOD pipeline, deterministic, toggled per category in the
  Play tab, `?original` / `?enhanced`.
- `eval/survey/bay-survey.mjs`: headless bathymetry + Tidewater reef/bay-floor occupancy maps
  built from the vendored source without a GPU — Tidewater's `Reef` placement runs on a bare object
  that borrows `Reef.prototype`, so the printed layout is exactly the app's. The survey showed:
  the main reef system covers x −198…42, z −12…173; the bay floor carries Tidewater's own
  meadow tufts, half-buried rocks, small corals; dolphin spawn (0, 66) in 6 m; a deep basin south
  of it (x −15…25, z 130…160, 16–20 m) whose east wall drops from 7 m at x ≈ 70 to 12–14 m at
  x ≈ 55 between z 85 and 125; an east plateau at 7–9 m around (93, 128).
- Four sites were proposed on it (a wreck, a sea-fan slope, an east coral garden, a deep basin)
  with Tidewater's own procedural geometry as a fallback. This pass kept the wreck (now the
  user's fishing boat), replaced the sea-fan slope with the kelp wall (Tidewater already has
  gorgonians; kelp was the missing biome), replaced the coral garden with a seagrass bed and the
  sunken skiff (Tidewater has thirty coral kinds; a man-made landmark was the missing kind), and
  made the deep basin the drowned temple.
