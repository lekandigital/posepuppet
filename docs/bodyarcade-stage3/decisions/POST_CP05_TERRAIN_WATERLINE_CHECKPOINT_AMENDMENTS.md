# BodyArcade Stage 3 — Post-Checkpoint-05 Change Record

**Status:** Canonical planning addendum pending repository documentation commit  
**Date:** 2026-07-18  
**Applies to:** `bodyarcade-shared-world`  
**Recorded Checkpoint 05 implementation:** `8ca67cc75eeefaf4593abe042ad6a5cdb3155247`  
**Implementation authorization:** None. This document records decisions and changes the plan; it does not authorize starting a checkpoint, pushing, merging, rebasing, or opening a pull request.

---

## 1. Purpose

This document records the user’s review decisions after Checkpoint 05 and amends the next and subsequent Stage 3 checkpoints accordingly.

The main changes are:

1. Keep the approved region water system. It is not considered defective and should not be replaced.
2. Insert a terrain-relief and terrain-coloring checkpoint before breach work.
3. Make the existing Twin Bay terrain substantially rougher, sharper, rockier, and more vertically dramatic while preserving its approved geography and all existing islands, including the mini-islands.
4. Adapt the useful terrain-shaping and terrain-coloring principles from ZyFou/ProceduralTerrains without replacing BodyArcade’s baked-world architecture.
5. Extend terrain coloring naturally to underwater substrate, based on depth, slope, sediment, exposed rock, shoreline conditions, and regional variation.
6. Keep terrain coloring entirely separate from environmental assets. Terrain color must never imitate, substitute for, or eliminate kelp, coral, seagrass, trees, rocks, ruins, wildlife, or any other asset.
7. Preserve the strict rectangular-placeholder policy for all missing assets.
8. Add a later, restrained water-tuning checkpoint for slight continuous underwater-visible surface ripples, with stronger disturbances from swimming, breach, and re-entry.

Where this document conflicts with the previously generated Stage 3 implementation master or checkpoint prompts, this document is the newer user decision and must be applied when the affected prompts are revised.

---

## 2. Decisions that are now locked

### 2.1 Water system verdict

The current region water is accepted as a good continuation of the original Three.js water demo. The small visual differences between the stock and region versions are not a reason to replace the system, escalate the fallback ladder, introduce another renderer, or classify Checkpoint 05 as having a water regression.

The current water architecture remains authoritative:

- jeantimex-derived surface and simulation;
- existing reflection and refraction behavior;
- existing above-water and underwater paths;
- existing Snell-window behavior;
- existing shoreline clipping;
- existing dolphin interaction and local ripple injection;
- existing breach/re-entry disturbance mechanism when Checkpoint 06 is implemented.

The only newly requested water adjustment is a restrained ambient-ocean-motion pass described in Section 5.

### 2.2 Terrain appearance verdict

Checkpoint 05 is accepted as a successful technical foundation for:

- terrain loading;
- chunked LOD;
- skirts and crack control;
- culling;
- shoreline integration;
- shared terrain-height authority;
- camera collision;
- dolphin contact, slide, and anti-wedge behavior;
- water integration.

It is **not** accepted as the final terrain geology or final terrain material appearance.

The current terrain is too smooth and rounded compared with the intended *Ecco the Dolphin: Defender of the Future* reference. The target is not uniformly noisy terrain, but it is also not a soft, melted heightfield. The terrain should contain strong, readable geological forms:

- sharp ridges;
- high, narrow peaks;
- broken rocky slopes;
- steep underwater walls;
- jagged reef ridges;
- irregular trench walls;
- rough exposed island interiors;
- broad navigable areas interrupted by authored rocky formations.

### 2.3 Twin Bay geography remains approved

The terrain rework must preserve the approved Twin Bay layout, including:

- both bays;
- all existing islands and mini-islands;
- lagoon and shelf placement;
- trench placement;
- summit and ridge landmark locations;
- spawn location;
- headland cave site;
- optional trench-wall cave site;
- monolith-ring discovery site;
- approved route relationships;
- cave-mouth and arch sites;
- breach sightlines;
- future ruin, vegetation, wildlife, and structure placement sites.

The revision changes terrain relief and surface classification. It must not casually redesign the map.

### 2.4 Terrain coloring is ordinary ground coloring, not an asset substitute

Terrain coloring must describe the terrain substrate itself:

- sand;
- wet shoreline material;
- sediment;
- soil;
- bare stone;
- cliff stone;
- reef limestone or mineral rock;
- shallow seabed;
- deep seabed;
- silt pockets;
- cave-mouth rock;
- broad regional mineral and weathering variation.

It must **not** paint fake kelp, coral, grass, trees, shrubs, rocks, ruins, wrecks, fish, or wildlife into the ground.

A future kelp asset may be placed on suitable rock or sediment, but the substrate remains normal rock or sediment when the kelp is absent. The same separation applies to every other asset category.

### 2.5 Missing assets remain rectangular placeholders

Every missing asset remains a color-coded rectangular placeholder until the user supplies or explicitly approves the real asset or a separately approved generation workflow.

This applies to, at minimum:

- kelp;
- seagrass;
- coral;
- freestanding rocks and boulders;
- trees;
- shrubs;
- grass clumps;
- caves or arches not yet represented by final geometry;
- ruins;
- wrecks;
- buildings and structures;
- fish schools;
- larger wildlife;
- interactable or landmark props;
- any other asset category named in the approved placement manifest.

Terrain coloring does not satisfy the placeholder requirement.

---

## 3. New checkpoint sequence

The Stage 3 sequence is amended as follows:

| Order | Checkpoint | Purpose |
|---|---|---|
| Completed | 05 — Terrain Across the Waterline | Technical terrain, LOD, collision/query, and shoreline foundation |
| New | **05A — Terrain Relief and Substrate Color Rework** | Re-bake sharper ZyFou-inspired relief while preserving Twin Bay; add shared above/below-water terrain coloring |
| New | **05B — Ambient Ocean Surface Motion and Terrain-Boundary Interaction** | Add continuous calm swell plus persistent low-level shoreline and terrain-contact disturbance without changing the approved water character |
| Next | 06 — Breach Over the Region | Implement breach, airborne framing, re-entry, and strong temporary surface disturbance over the revised region |
| Then | 07 — Placeholder World | Place rectangular placeholders for every missing asset category on the revised terrain |
| Then | 08 — Ecco Atmosphere Pass A | Finalize underwater fog, palette, lighting, approved textures, and caustic tuning using the 05A classification foundation |
| Then | 09 — Caves and Overhangs | Add true cave/arch/overhang geometry and collision, seamed into the revised terrain |
| Then | 10+ | Vegetation, wildlife, ruins, audio, and other modes | Replace placeholders only when assets or generation methods are separately approved |

Checkpoint 06 must not begin until 05A and 05B have each been implemented, reviewed, and explicitly approved, unless the user later changes the order.

---

# 4. New Checkpoint 05A — Terrain Relief and Substrate Color Rework

## 4.1 Objective

Transform the existing smooth Twin Bay heightfield into a sharper, rougher, more geological landscape inspired primarily by ZyFou/ProceduralTerrains’ Blank/Highlands terrain, while retaining BodyArcade’s approved world layout, baked-data architecture, height authority, runtime LOD system, water integration, and collision/query behavior.

At the same time, replace the provisional two-color terrain treatment with a shared deterministic substrate-color system for both exposed land and underwater terrain.

## 4.2 Reference implementation to study

The implementer must study the supplied ZyFou/ProceduralTerrains repository deeply before changing BodyArcade terrain. Do not copy only a few constants or reproduce the screenshot superficially.

The research snapshot inspected for this decision used an accessible checkout at commit:

```text
ZyFou/ProceduralTerrains
8b396f9c784676d46f6a147d310d9f547bf41403
```

The repository snapshot has been copied into the BodyArcade repository as a read-only reference at:

```text
docs/bodyarcade-stage3/references/zyfou-procedural-terrains/
```

Its `BODYARCADE_SOURCE_RECORD.md` records the pinned commit. Treat that snapshot as implementation-reference material, not runtime source. Preserve the included MIT license and attribution. Do not edit the snapshot to make BodyArcade work; adapt selected techniques into app-owned BodyArcade code.

Study these files and their connected call paths:

```text
src/project/ProjectTemplates.js
src/engine/presets.js
src/engine/terrain/terrainGLSL.js
src/engine/terrain/biomeGLSL.js
src/engine/terrain/TerrainMaterial.js
src/engine/terrain/TerrainDetailMaterial.js
src/engine/terrain/noise/NoiseStack.js
src/engine/terrain/noise/noiseStackCodegen.js
src/engine/shaders/terrainColor.glsl.js
src/engine/style/ColorPalette.js
src/engine/style/PaletteUniforms.js
src/engine/terrain/TerrainExporter.js
```

The implementer must understand at least these mechanisms:

- Blank template selecting the Highlands/default configuration;
- deterministic seed-domain offset;
- multi-octave FBM;
- ridged multifractal construction;
- spectral weighting that makes detail follow ridges;
- domain warping;
- biome- and climate-weighted shaping;
- erosion and regional variation fields;
- island/rim falloff;
- smooth overlapping biome weights rather than hard borders;
- slope, height, moisture, depth, and noise-driven albedo;
- shared terrain-color logic across terrain, water, and export paths;
- triplanar/world-space close-range detail;
- finite-difference normals and normal-strength treatment;
- the difference between true heightfield relief and render-only surface detail.

SimonStorlSchulke’s terrain generator and terrain-material shader remain useful secondary references, especially for separating shape generation from slope/height/noise-driven coloration, but ZyFou’s Blank/Highlands result is the stronger relief reference.

## 4.3 Terrain-shape strategy

Do not replace BodyArcade’s world with a randomly generated Highlands board.

Use the approved Twin Bay terrain as the macro-shape authority, then add deterministic geological relief through protected masks.

Conceptual composition:

```text
approved Twin Bay macro field
+ broad domain-warped variation
+ ridged multifractal formations
+ authored ridge/peak/trench/cliff emphasis
+ restrained medium- and high-frequency breakup
× protected-flatness and protected-coast masks
= revised deterministic BodyArcade heightfield
```

The exact implementation may differ, but it must preserve this hierarchy:

1. **Layout first:** Twin Bay determines where land, water, bays, islands, trench, lagoon, routes, and landmarks exist.
2. **Geological structure second:** ridges, peaks, cliff bands, broken slopes, reef ridges, and trench walls give those masses character.
3. **Surface breakup third:** smaller deterministic variation prevents smooth, inflated-looking forms.
4. **Materials and atmosphere later:** visual detail must not be used to disguise weak silhouettes.

## 4.4 Roughness zoning

### Strong relief zones

Use strong ridging, warp, and breakup in:

- island interiors away from protected beach bands;
- exposed headlands;
- major ridge and summit areas;
- coastline cliffs away from approved beach access;
- reef ridges;
- underwater canyon or trench walls;
- rock shelves;
- open rocky seabed formations;
- future cave surroundings outside the cave-seam protection band.

### Restrained relief zones

Keep relief restrained or specially authored in:

- approved beaches;
- lagoon floor;
- spawn area;
- required navigation corridors;
- narrow passages used by camera and dolphin acceptance tests;
- breach takeoff and re-entry zones;
- cave-mouth seam zones;
- future arch seam zones;
- future ruin and structure footprints;
- other approved flat or readable composition areas.

“Restrained” does not mean perfectly featureless. It means the terrain remains safely navigable and compositionally legible.

## 4.5 Height and coastline constraints

Unless separately approved:

- retain the existing world-size contract;
- retain sea level at `y = 0`;
- retain the currently approved height range of approximately `-80 m` to `+200 m`;
- create sharper and taller-looking profiles by redistributing relief, narrowing peaks, steepening faces, and deepening local formations within the range;
- do not raise the global maximum above `+200 m` without a separate user ruling;
- preserve the coastline and all island footprints.

Preferred coastline rule:

- the shoreline sign mask should remain byte-identical where practical;
- noise displacement must taper to zero or use a coastline-preserving formulation near the `height = 0` contour;
- any unavoidable shoreline difference must be reported and shown before approval.

## 4.6 Bake, do not generate at runtime

BodyArcade continues to use an offline, deterministic bake.

Do not import ZyFou’s editor, React UI, infinite-world architecture, water system, sky, clouds, or live GPU heightfield as BodyArcade runtime architecture.

The revised authoring pipeline must bake the updated world artifacts. Runtime systems continue to load committed artifacts.

`terrainHeight(x,z)` remains the single authority for:

- rendered geometry;
- water raymarching and depth;
- shoreline calculations;
- camera collision;
- dolphin contact;
- future Rapier heightfield collision;
- placement Y coordinates;
- all movement modes.

The relief must therefore exist in the baked heightfield. Do not fake major peaks or cliffs with vertex displacement or normal detail that collision and water cannot see.

## 4.7 Terrain-coloring architecture

Create one app-owned shared terrain/substrate-color function used consistently by:

- directly rendered terrain;
- terrain hit by the above-water water raymarch;
- terrain hit by the underwater water raymarch;
- reflected and refracted terrain paths where applicable;
- debug and baked color outputs used to validate classification;
- later terrain-material texture blending.

The inputs should include:

- world position;
- elevation relative to sea level;
- normalized height;
- water depth;
- geometric normal and slope;
- existing regional/biome mask data;
- deterministic broad regional noise;
- deterministic medium and fine material breakup;
- shoreline distance or shoreline band;
- optional concavity/erosion proxy where inexpensive and deterministic.

Do not create separate unrelated colors for direct terrain and water-raymarched terrain.

## 4.8 Above-water substrate families

The procedural color foundation should distinguish normal ground families such as:

- dry beach sand;
- wet shoreline sand or wet stone;
- lowland soil;
- dry-earth or weathered ground;
- vegetation-compatible soil coloration, without painting vegetation objects;
- ordinary exposed rock;
- steep cliff rock;
- high-elevation rock;
- subtle mineral or strata variation.

The ground may naturally be more green, brown, tan, grey, red, or dark according to substrate and conditions, but no color family should be described as a substitute for a tree, grass clump, shrub, or other asset.

## 4.9 Underwater substrate families

The ZyFou underwater branch must be adapted rather than copied unchanged. BodyArcade is an ocean exploration world and needs more than a simple sand-to-deep-color fade.

Distinguish underwater ground through substrate and physical conditions:

- pale shallow sand;
- wet or algae-stained shoreline stone as a material tint, not an algae asset;
- shallow reef limestone/mineral rock;
- mixed sand-and-rock shelf;
- medium-depth stone;
- steep underwater cliff stone with reduced sediment accumulation;
- silt or fine sediment pockets on flatter low-energy surfaces;
- broken rocky seabed;
- deep trench rock and sediment;
- darker cave-mouth transition rock;
- restrained regional mineral variation.

Depth influences color, but depth must not be the only classifier. Slope, shore distance, regional mask, concavity/accumulation proxy, and deterministic variation should affect the result.

Do not encode “kelp present,” “coral present,” “fish present,” or any other asset-presence claim into terrain color.

## 4.10 Surface-detail layer

Adapt the principle of ZyFou’s close-range world-space/triplanar material detail to add:

- rock grain;
- shoreline wetness variation;
- sediment breakup;
- subtle crack or strata variation;
- low-intensity normal detail;
- reduced texture stretching on steep faces.

This layer must remain subordinate to the real geometry. It may enrich surfaces but may not be used as a substitute for the requested sharp terrain relief.

Final external textures remain part of the later atmosphere/material checkpoint unless the user separately approves bringing them forward.

## 4.11 Explicitly out of scope for 05A

Do not:

- add final kelp, coral, seagrass, trees, shrubs, grass, rocks, ruins, wrecks, fish, wildlife, or structures;
- paint those assets into the terrain;
- create procedural substitute assets;
- add rectangular placeholders yet, except temporary internal debug markers that are removed before completion;
- add caves, arches, ceilings, or true overhang geometry;
- change water character or ambient ripples;
- begin breach work;
- add final atmosphere/fog values;
- change the approved Twin Bay X/Z layout;
- import ZyFou’s full runtime or editor;
- push, merge, rebase, or open a pull request.

## 4.12 Required 05A verification

At minimum, rerun and report:

1. Two consecutive bakes produce byte-identical artifacts.
2. Every changed world artifact is listed with old and new hashes.
3. Coastline and island footprints remain approved; preferably the shore mask is byte-identical.
4. All mini-islands remain present.
5. Spawn, landmarks, cave sites, arch sites, monolith site, and breach sightlines preserve X/Z placement.
6. Placement Y values and terrain-relative transforms are resampled where required.
7. `terrainHeight` remains the single source used by render, water, camera, and simulation.
8. LOD-0 vertices match `terrainHeight` at the existing probe tolerance.
9. Water-over-land and terrain/water-gap checks pass at all approved shoreline sites.
10. The full Checkpoint 04B water four-shot comparison remains acceptable.
11. Protected coastline and ridge tiles remain LOD 0.
12. LOD seam/crack and skirt scans pass after the rebake.
13. Camera clearance and subject-occlusion tests pass on the revised geometry.
14. Dolphin slide and anti-wedge tests pass on real revised-terrain probes in addition to any analytic harness.
15. Containment and replay tests pass.
16. Stock, pool, region-preview, and region views remain functional.
17. Sustained FPS, terrain-stage timing, triangle counts, and memory are reported against Checkpoint 05.
18. Direct and raymarched terrain use equivalent color classification at fixed probes.
19. Underwater classification is visibly varied by substrate, slope, and depth rather than being one uniform deep tint.
20. No asset-like silhouettes or patterns are painted into terrain color.

## 4.13 Manual 05A review gate

The user must be able to freely inspect the terrain and determine:

- whether it is sufficiently rough and rocky;
- whether peaks are sharp and dramatic enough;
- whether beaches and required routes remain usable;
- whether underwater cliffs, reef ridges, and trench walls have convincing structure;
- whether the mini-islands and Twin Bay composition remain intact;
- whether above-water and underwater terrain coloring reads as normal substrate;
- whether any colored region incorrectly appears to imitate a missing asset.

Stop after the local commit and report. Approval of 05A does not authorize 05B.

---

# 5. New Checkpoint 05B — Ambient Ocean Surface Motion and Terrain-Boundary Interaction

## 5.1 Objective

Preserve the approved water system and current overall appearance while ensuring the ocean surface never appears perfectly motionless when viewed from beneath the water.

There should be slight, continuous ripple or swell distortion even when the dolphin is stationary and no recent interaction has occurred. Ambient wave motion must also interact visibly with static shorelines, cliffs, islands, rocks, and protruding terrain, producing persistent low-level boundary ripples without requiring the terrain itself to move.

## 5.2 Motion hierarchy

```text
ambient ocean motion
    low amplitude, slow, always present

+ terrain and shoreline boundary interaction
    persistent low-level reflected/compressed ripple response

+ swimming interaction
    stronger local wake and ripple response

+ breach and re-entry
    strongest short-lived disturbance, then gradual decay
```

The ambient layer should be visible from below through surface shape, normals, refraction, and Snell-window distortion. It should not depend on a recent breach to become visible.

## 5.3 Constraints

- Preserve the approved above-water look.
- Keep the ocean calm; do not create storm waves or high-frequency visual noise.
- Use the existing jeantimex-derived simulation/surface mechanisms.
- Drive terrain-contact disturbance from the existing terrain height and/or shoreline SDF rather than adding a second shoreline renderer.
- Treat the effect like the pool obstacle interaction with ambient waves moving into a static boundary: the water moves, the terrain does not.
- Do not introduce a second water renderer.
- Do not stack an unrelated normal or caustic system over the existing water.
- Do not alter the pristine stock demo.
- Keep the pool reference behavior unchanged unless a test-only parameter comparison is required.
- Region-only ambient tuning is acceptable when isolated cleanly.
- Strong interaction and re-entry ripples must remain clearly stronger than ambient motion.

## 5.4 Required 05B review

Capture and compare:

1. Stationary underwater camera looking upward for at least 20 seconds.
2. Stationary underwater oblique view showing surface distortion over terrain.
3. Dolphin swimming beneath the surface.
4. Dolphin crossing downward after a breach/re-entry event.
5. Above-water stock-like comparison.
6. Half-submerged waterline comparison.
7. Idle shoreline or cliff contact showing persistent low-level ambient boundary disturbance.
8. The same boundary during swimming and after re-entry, showing a clear intensity hierarchy.

Pass conditions:

- the underwater surface never reads as frozen or geometrically flat;
- ambient motion is calm and restrained;
- movement-driven ripples are stronger;
- shoreline and protruding-terrain contact remains subtly active during idle ocean motion;
- breach/re-entry disturbance is strongest and decays naturally;
- Fresnel, refraction, waterline, Snell behavior, shoreline clipping, and performance remain acceptable.

Stop after the local commit and report. Approval of 05B does not authorize Checkpoint 06.

---

# 6. Amendment to Checkpoint 06 — Breach, Re-entry, and Cross-Waterline Continuity

Checkpoint 06 retains breach and re-entry as its central interaction, but it now also owns the first complete implementation of continuous geometry and camera-side-dependent visibility across the waterline.

## 6.1 New preconditions

Checkpoint 06 requires explicit approval of:

- Checkpoint 05A revised terrain and substrate coloring;
- Checkpoint 05B ambient water motion and terrain-boundary interaction.

## 6.2 Breach and re-entry behavior

Implement and tune:

- breach initiation, ascent, airborne arc, peak height, and descent;
- ordinary trailing-camera behavior through the transition;
- above-water camera framing that exposes the revised islands, ridges, mini-islands, and shoreline without terrain seams;
- re-entry impulse, splash, strongest transient ripple event, and gradual decay toward the continuous 05B ocean baseline;
- continuity of the dolphin body as portions cross the surface.

The breach camera should not become a disconnected cinematic camera unless the approved Track E chain explicitly requires a transient authored adjustment. It should preserve the familiar following relationship and avoid abrupt snaps.

## 6.3 Cross-waterline rendering law

The water must not be modeled as simply opaque from above and transparent from below.

Render above-water and underwater geometry continuously through the surface, with visibility controlled by:

- camera side relative to the water surface;
- view angle and Fresnel balance;
- local surface slope and animated normal distortion;
- water depth;
- horizontal distance;
- underwater attenuation and fog;
- local disturbance from ambient motion, swimming, breach, and re-entry.

Required results:

- no hard clipping of the dolphin, terrain, islands, or other geometry where they intersect the water plane;
- from underwater, above-water terrain may be clear, faint, distorted, reflection-dominated, or effectively hidden according to viewing conditions;
- from above water, the submerged dolphin, terrain, vegetation placeholders, and seabed may remain visible where transmission conditions permit;
- partially submerged objects remain spatially continuous;
- visibility changes smoothly rather than popping when the camera or object crosses the surface.

Opposite-side terrain is not required to be equally visible in every frame. The requirement is coherent variation, not guaranteed full visibility.

## 6.4 Split-level rendering

Support frames in which the camera sees both sides of the surface simultaneously:

- above-water pixels use above-water lighting, sky, color, and reflection;
- underwater pixels use underwater tint, attenuation, haze, and distortion;
- the waterline is a narrow animated refractive boundary, not a hard scene cut;
- one object may occupy both optical regions without being split into disconnected renderings.

## 6.5 Ecco visual acceptance set

The following repository reference is authoritative for intended behavior:

```text
docs/bodyarcade-stage3/references/ecco-waterline/
docs/bodyarcade-stage3/references/ecco-waterline/README.md
```

It contains 13 selected frames and a frame-by-frame interpretation covering:

- breach peak and pre-entry visibility;
- above-water views into submerged terrain and dolphin geometry;
- underwater views of above-water terrain;
- low-visibility and high-visibility underside cases;
- deep-water horizontal attenuation;
- simultaneous split-level views.

Claude must inspect the images, not only read the notes, before implementing and before final review. These frames define behavior and composition; they do not require pixel-identical reproduction.

## 6.6 Ripple relationship

Checkpoint 06 owns the strongest breach and re-entry events, but must build on the 05B hierarchy:

```text
continuous ambient ocean motion
< terrain/shoreline boundary response
< ordinary swimming wake
< breach and re-entry impulse
```

Do not create a separate breach-only renderer or disconnected splash surface.

## 6.7 Required regression and review

Re-run all relevant 05A terrain and 05B water checks, with special attention to:

- shoreline gaps and water-over-land;
- camera collision around sharper peaks and cliffs;
- breach and re-entry near rough shoreline geometry;
- continuous body rendering while crossing the surface;
- underwater upward views immediately after re-entry;
- above-water views of the submerged dolphin immediately after entry;
- split-level views;
- distance- and angle-dependent opposite-side terrain visibility;
- stock, pool, and four-shot water regressions;
- performance with revised terrain, refraction, split-level rendering, splash, and ripple injection active together.

Stop after the local commit and report. Approval of Checkpoint 06 does not authorize Checkpoint 07.

---

# 7. Amendment to Checkpoint 07 — Placeholder World

Checkpoint 07 remains mandatory and is not reduced by terrain coloring.

## 7.1 Placeholder law

Place a color-coded rectangular placeholder for every approved asset instance or cluster whose final asset is unavailable.

No category may be omitted because:

- the terrain color already suggests that biome;
- a future procedural generator might exist;
- an asset search is planned;
- the final model has not been selected;
- the area looks acceptable without it.

## 7.2 Revised-terrain placement

The revised heightfield may change Y coordinates and local normals. Therefore:

- preserve approved X/Z placement and category identity;
- resample Y from the revised `terrainHeight`;
- orient placeholders according to the approved placement rule and revised terrain normal where applicable;
- prevent placeholders from being buried, floating, or intersecting steep terrain unintentionally;
- retain explicit cave/arch/structure seam reservations.

## 7.3 Placeholder categories

The inventory must explicitly include all current categories, including kelp, seagrass, coral, freestanding rocks, land vegetation, ruins, wrecks, architecture, fish, wildlife, landmarks, and interactables.

The checkpoint report must state which placeholders have no approved final asset yet.

---

# 8. Amendment to Checkpoint 08 — Ecco Atmosphere Pass A

Checkpoint 08 becomes a finishing and art-direction pass over the 05A substrate-classification foundation rather than the first place where terrain categories are invented.

## 8.1 Keep from the original plan

- underwater-only fog and atmospheric work;
- zone-driven fog color and density;
- background matching fog color;
- view-direction tint;
- underwater lighting;
- restrained shallow-floor caustics;
- approved particles;
- final approved terrain textures and material tuning;
- preservation of surface, waterline, reflection, and Snell behavior.

## 8.2 New responsibilities

- map the 05A substrate classes into the final Ecco-directed palette;
- tune underwater substrate colors so they remain readable through fog and water refraction;
- add approved textures without erasing classification or making the surface uniformly noisy;
- preserve sharp terrain silhouettes and do not smooth them visually into featureless masses;
- verify direct and raymarched terrain remain consistent;
- keep ambient ripples from 05B visible from below after atmosphere and fog are applied;
- perform the final reflection/transmission balance for views from both sides of the surface;
- tune angle-, depth-, and distance-dependent visibility without introducing hard cutoff thresholds;
- tune the underside animated-normal refraction so it can range from reflection-dominated to clearly transmissive, matching the Ecco acceptance set;
- finalize split-level tint, haze, waterline thickness, and transition behavior;
- preserve the CP06 guarantee that geometry remains continuous across the surface.

## 8.3 Asset separation remains

Checkpoint 08 must not use terrain textures, color, particles, or fog to pretend missing asset geometry exists. Rectangular placeholders remain until later asset checkpoints replace them.

---

# 9. Amendment to Checkpoint 09 — Caves and Overhangs

Checkpoint 09 still uses separate volumetric or modular mesh geometry for true caves, arches, ceilings, and overhangs because a heightfield cannot fold over itself.

## 9.1 Revised-terrain seam work

- revalidate every cave and arch transform against the 05A heightfield;
- adjust only Y and seam-local terrain stamps unless the user approves an X/Z change;
- preserve the approved cave-mouth locations and route relationships;
- locally lower or omit the heightfield where the cave/arch mesh becomes authoritative;
- share compatible rock classification and material logic across terrain and cave seams;
- prevent the sharper terrain relief from sealing entrances or narrowing approved routes below their required clearance.

## 9.2 Placeholder transition

Replace only the cave/arch placeholders whose final geometry is implemented. Other unavailable asset placeholders remain.

---

# 10. Amendment to Checkpoint 10 — Vegetation and Later Asset Passes

Terrain coloring does not authorize vegetation generation or asset substitution.

## 10.1 Asset gate

For every vegetation category:

- use a user-supplied or explicitly user-approved asset/generation workflow;
- verify license and provenance;
- replace only the matching placeholders;
- leave rectangular placeholders where no approved final asset exists.

SeedThree may remain a candidate for categories it can actually produce, but it is not assumed to provide convincing kelp. Kelp, coral, and other specialized underwater assets remain separate sourcing or generation decisions.

## 10.2 Placement relationship

Terrain classification may help determine whether a placement is physically suitable, but it must not silently add, delete, or relocate approved instances. Material suitability and asset presence remain distinct data.

## 10.3 Later checkpoints

The same rule applies to fish, wildlife, ruins, wrecks, architecture, and all subsequent asset passes:

- no invented substitute assets;
- no terrain-color substitution;
- preserve placeholders until real assets are approved;
- replace placeholders category by category with explicit review.

---

# 11. Reference governance for every future checkpoint

These decisions must not live only in chat history.

Before each affected checkpoint, Claude must read:

```text
docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md
```

Then read the checkpoint-specific prompt and every reference explicitly named by that prompt.

The governing hierarchy is:

```text
approved BodyArcade architecture and prior checkpoint outputs
    define the system boundaries and authoritative runtime

this post-CP05 addendum
    defines the newer user decisions and checkpoint changes

pinned reference repositories
    demonstrate implementation techniques

Ecco selected frames
    define target visual behavior and acceptance evidence
```

A reference repository must never silently become a competing engine. A screenshot must never be treated as code architecture. The BodyArcade implementation remains app-owned and deterministic.

### 11.1 Pinned technique references

Primary terrain technique reference:

```text
docs/bodyarcade-stage3/references/zyfou-procedural-terrains/
commit 8b396f9c784676d46f6a147d310d9f547bf41403
```

Use ZyFou for:

- ridged and domain-warped deterministic terrain principles;
- slope, elevation, sea-depth, biome, and noise-driven terrain albedo;
- shared terrain color logic across direct terrain, water paths, and exports;
- world-space/triplanar close-range detail principles.

Secondary terrain reference:

```text
SimonStorlSchulke/threejs-examples
terrain generator and terrain-material shader
```

Use Simon conceptually for restrained height/normal/noise blending and readable material transitions. Do not copy code until licensing or permission is resolved.

### 11.2 Terrain color decision

The BodyArcade color architecture should combine:

```text
ZyFou-style classification and shared palette architecture
+ Simon-style restrained procedural blending
+ the existing BodyArcade RegionWallColor shared shader path
```

It must classify substrate only. It must not represent asset presence.

### 11.3 Visual behavior references

Primary waterline behavior reference:

```text
docs/bodyarcade-stage3/references/ecco-waterline/
```

The accompanying README is required reading, but Claude must also inspect the actual image files during CP05B, CP06, and CP08.

---

# 12. Checkpoint index and master-document updates required

Before implementing 05A, revise the Stage 3 planning documents so they no longer imply the old sequence.

First install this addendum at:

```text
docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md
```

Then locate the authoritative Stage 3 master, checkpoint index, and checkpoint prompt files in the repository rather than assuming a stale path. At minimum, update the current equivalents of:

```text
BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md
CHECKPOINT_INDEX.md
CHECKPOINT_06*.md
CHECKPOINT_07*.md
CHECKPOINT_08*.md
CHECKPOINT_09*.md
CHECKPOINT_10*.md
```

Add new authoritative prompt files for:

```text
CHECKPOINT_05A_TERRAIN_RELIEF_AND_SUBSTRATE_COLOR.md
CHECKPOINT_05B_AMBIENT_OCEAN_SURFACE_MOTION_AND_BOUNDARY_INTERACTION.md
```

Every affected future checkpoint prompt must cite this addendum and the relevant reference directory explicitly.

Amend the existing prompt files for Checkpoints 06–10 so their preconditions, responsibilities, and regression requirements match this document.

Do not silently edit previously approved implementation code while performing the documentation update.

The documentation update should be its own clean local commit and should stop for review before 05A implementation begins.

The current expected starting code commit is:

```text
8ca67cc75eeefaf4593abe042ad6a5cdb3155247
```

The uncommitted reference directories created after that commit are expected documentation inputs, not application-code changes:

```text
docs/bodyarcade-stage3/references/zyfou-procedural-terrains/
docs/bodyarcade-stage3/references/ecco-waterline/
```

Before committing, remove `.DS_Store` and other machine-local metadata. Do not include the downloaded ZIP or temporary clone metadata.

---

# 13. Global guardrails carried forward

- Work only in the authorized BodyArcade worktree and branch.
- Verify the exact starting HEAD and clean tree before each checkpoint.
- One checkpoint per implementation session.
- Stop after every checkpoint for unrestricted user review.
- Approval of one checkpoint does not authorize the next.
- Never push, merge, rebase, or open a pull request without explicit authorization.
- Keep the webcam off and use keyboard, replay, fixture, or mocked input for automated work.
- Preserve the persistent browser/testing workflow.
- Do not modify the vendored pristine water source unless a later user decision explicitly authorizes a vendor change.
- Do not weaken tests to make a checkpoint pass.
- Report every derived value and deviation.
- Keep the baked world deterministic.
- Keep rendered terrain, water depth, camera collision, dolphin contact, later physics, and placement tied to the same terrain authority.
- Keep terrain substrate, atmosphere, and object assets as separate layers.
- Keep rectangular placeholders for all missing assets.

---

# 14. Required documentation-completion report

When this decision document is incorporated into the repository planning files, report:

- exact files added and modified;
- the revised checkpoint order;
- every original checkpoint prompt amended;
- confirmation that Checkpoint 05 implementation code was untouched during the planning-only pass;
- confirmation that no application code changed;
- confirmation that nothing was pushed;
- the local documentation commit SHA;
- any conflict found between this document and the existing implementation master;
- any unresolved value that still needs user approval.

Then stop.
