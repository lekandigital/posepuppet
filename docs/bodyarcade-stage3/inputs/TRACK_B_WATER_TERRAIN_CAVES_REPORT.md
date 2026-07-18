# TRACK_B_WATER_TERRAIN_CAVES_REPORT.md

*Track B — Water / Terrain / Caves / Collision technical design for BodyArcade Stage 2. Research report (not implementation). Prepared 16 July 2026. Intended destination: `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.*

## Executive summary

The plan is buildable exactly as governed: carry the jeantimex/threejs-water demo across a bounded ~2 km fictional region by minimal integration edits, bake one shared terrain dataset, generate caves by an authored/kitbashed route, and wire collision from that one dataset via Rapier heightfield + trimesh with three-mesh-bvh for fast queries. The single hardest technical fact — that the water/caustics/wall shaders raytrace against the pool's box geometry — is verified at primary source: Evan Wallace's original `renderer.js` (which jeantimex ports 1:1 into GLSL shader files) declares `const float poolHeight = 1.0;` and `vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax)`, called with box bounds `vec3(-1.0, -poolHeight, -1.0)`..`vec3(1.0, 2.0, 1.0)` (bounds verified verbatim in the MIT-licensed `shanecelis/water-demo` port of the same shader). The container swap replaces that box intersection with a seabed heightfield lookup while keeping the surface simulation, Fresnel/Snell compositing and the differential-area caustics math byte-identical.

Key recommendations: (1) validate the scale defaults with one revision — treat the ~2 km region as a **fixed global surface plane clipped by terrain**, and run the GPU wave sim in a **player-following 512² window** covering ~256 m (≈0.5 m/texel), not a single 2 km sheet; (2) for caves, choose the **authored/kitbashed modular-mesh route** (CC0 Kenney Modular Cave Kit + Blender finishing) over local SDF meshing, on art-directability, Ecco-authenticity and collision-simplicity grounds; (3) collision = one Rapier heightfield collider for the seabed + trimesh colliders for caves/arches, with three-mesh-bvh carrying all non-physics spatial queries.

**TL;DR**
- Carry jeantimex byte-identical except for one sanctioned edit family — swap the box-intersection functions (`intersectCube` / `poolHeight`, verified in Evan Wallace's `renderer.js`) for a seabed-heightfield raymarch plus a coastline mask; everything else (wave sim, normals, differential-area caustics, Fresnel compositing) stays unchanged.
- One baked dataset (16-bit heightmap + shoreline/biome/placement masks + placement JSON) authored in ProceduralTerrains (MIT) / THREE.Terrain (MIT), loaded at runtime, drives render mesh, Rapier collision, water depth and all four movement modes; caves are authored modular meshes (CC0 Kenney Modular Cave Kit, "40 assets… CC0 licensed"), not SDF-meshed.
- The frame budget closes at ~1728×1080 on the M-class target because Apple Silicon's tile-based deferred rendering makes multi-pass overdraw nearly free (independent M5 testing measured ~1,284 GPixels/s and found framebuffer store vs. don't-care "indistinguishable"); the windowed 512² sim + caustics + terrain fit inside ~7–11 ms, reserving ~5 ms for pose tracking.

## Verified sources and licenses

All licenses verified at primary source:

- **jeantimex/threejs-water** — MIT (`Original work Copyright (c) 2011 Evan Wallace / Modified work Copyright (c) 2026 Yong Su`), verified at github.com/jeantimex/threejs-water/blob/main/LICENSE. TypeScript + Vite + `vite-plugin-glsl ^1.3.0`, `three ^0.184.0`, `lil-gui ^0.21.0` (verified in `package.json`, internal name `webgl-water-threejs`). HEAD commit SHA **could not be pinned** (GitHub commits page, `raw.githubusercontent.com` and the API were robots-blocked to the fetcher); the observed front-end asset hash `b20acd3722c048fe30761dec1ad24a3ae9151588` is GitHub's `meta-release` value, **not** a commit SHA. **OPEN ITEM** — pin via authenticated clone. Confirmed source files (from `index.html` and README): `src/main.ts`, `src/Water.ts` (ping-pong discrete-wave-equation sim), `src/Renderer.ts` (multi-pass pipeline), `CreateSimulationObjects.ts`, `SimulationObject` interface, plus shader sets `RoundedBox.vert/frag`, `RoundedBoxCaustics.vert/frag`, `RoundedBoxWaterAbove/Below.frag`, and a parallel rectangular-pool shader set.
- **ZyFou/ProceduralTerrains** — MIT (verified github.com/ZyFou/ProceduralTerrains, "MIT license"). React + Vite + Three.js WebGL2. Single fixed board, GPU-only height field (`heightAt()` in `src/engine/terrain/terrainGLSL.js`), deterministic (mulberry32 seed → domain offset; `Math.random()` never used for shape). Exports **PNG screenshot** and **1024² grayscale heightmap PNG** rendered orthographically from the same shader; the repo also advertises GLB export (README-level; see Needs-user).
- **IceCreamYou/THREE.Terrain** — MIT (`@license MIT`, Isaac Sukin), verified in `build/THREE.Terrain.js` header. Latest release 2.0.0 (Three r130 baseline; README states r160+ compatible as ES module). `Terrain()`, `TerrainNS` (DiamondSquare, Perlin/Simplex, Worley, Brownian, filters, `ScatterMeshes`), `generateBlendedMaterial`, and **`TerrainNS.toHeightmap()`** plus heightmap import. Maintained, low velocity.
- **gkjohnson/three-mesh-bvh** — MIT (npm 0.9.10, published May 2026, requires three ≥0.159). Accelerated raycast + `bvhClosestPointToPoint`, `intersectsGeometry`, `shapecast`, `refit`.
- **Rapier (dimforge)** — physics/collision. `@dimforge/rapier3d` WASM; `ColliderDesc.heightfield(heights, scale)` and `ColliderDesc.trimesh(vertices, indices)` verified in rapier.rs docs.
- **martinRenou/threejs-caustics** — APPROVED FALLBACK caustics only (renders sub-water environment position map, marches refracted rays against it, supports arbitrary meshes). License to be re-verified at source before code use — flagged.
- **martinRenou/threejs-water** — reference.
- **mesqme/infinite-terrain** — REFERENCE ONLY (techniques, never architecture import).
- **nemutas/caustics** — license UNVERIFIED → reference-only, no code copying.
- **N8python/caustics** — CC0 (verified) — alternate reference.
- **Kenney Modular Cave Kit** — CC0, "Download this package (40 assets) for free, CC0 licensed!" (verified kenney.nl/assets/modular-cave-kit). **Quaternius** nature/rock packs — CC0 (verified; "released under the CC0 open source license").

---

## WATER

### Table 1 — Pool-assumption inventory (exhaustive)

Derived from Evan Wallace's `renderer.js` (which jeantimex ports 1:1 into GLSL) plus the confirmed jeantimex file structure. Byte-identical-by-default: anything not marked **CHANGES** stays untouched.

| # | Location (file / function / uniform) | What it assumes | Verdict | Replacement mechanism |
|---|---|---|---|---|
| 1 | Water-above frag (`RoundedBoxWaterAbove.frag` / rectangular equivalent), `getSurfaceRayColor` → `intersectCube(origin, ray, cubeMin, cubeMax)` | Refracted/reflected ray hits axis-aligned box at `vec3(-1,-poolHeight,-1)`..`vec3(1,2,1)` | **CHANGES** | Replace box slab test with seabed **heightfield raymarch** (sample baked height texture along ray, fixed-step + binary refine) returning hit point + normal |
| 2 | Water-below frag (`RoundedBoxWaterBelow.frag`), `getWallColor` / `getSurfaceRayColor` | Same box bounds from underwater; wall/floor tile texture + caustics sampled at box hit | **CHANGES** | Same heightfield raymarch; sample terrain material + caustics at hit; sky/Snell's window when ray exits upward |
| 3 | `poolHeight` uniform (`const float poolHeight = 1.0;` in original) | Scalar pool depth; used in `intersectCube` min.y and AO/shadow falloff | **CHANGES** | Replaced by `uSeaLevel` (y=0) + per-fragment seabed height; depth = `seaLevel − terrainHeight` |
| 4 | Caustics vertex shader (`*Caustics.vert`) | Light ray refracts at surface then intersects the **pool floor plane** (fixed y) to compute old/new area | **CHANGES** | Project refracted light onto seabed heightfield; raymarch terrain for landing point |
| 5 | Caustics frag (`*Caustics.frag`) differential-area `newArea/oldArea` | Result written to a texture keyed to floor UV | **STAYS** (math) / **CHANGES** (target parameterization) | Differential-area math byte-identical; only projection surface (item 4) changes |
| 6 | Pool wall shaders (`RoundedBox.vert/frag`) triplanar UV | A finite box has 5 tiled inner faces | **CHANGES** | Walls become authored **coastline geometry** (terrain above sea level); triplanar terrain material replaces tile texture |
| 7 | Wall/caustics AO/blob-shadow term (`exp(-…)` diffuse line in `renderer.js`) | Occluder is the sphere vs. flat floor | **STAYS** | Ball→dolphin occluder generalizes unchanged (compound-sphere displacement) |
| 8 | Water surface mesh (`Water.ts`) — XY plane rendered XZ, `.xzy` swizzle | Surface is a single rectangle matching pool top | **STAYS** (mechanism) / **CHANGES** (extent + clipping) | Mesh extent grows to region/window; add shoreline alpha-clip (Q5). Swizzle & sim untouched |
| 9 | Heightfield sim domain (`Water.ts` ping-pong, 256²) | Sim texels map 1:1 to pool top | **CHANGES** (mapping only) | Domain maps to a player-following window (Q4); sim shader math byte-identical |
| 10 | Drop/displacement injection (`addDrop`-style; per-object `sphereCenter`/`sphereRadius` uniforms) | Interactive object is the demo sphere in the box | **STAYS** (pattern) | Dolphin/boat reuse the compound-sphere displacement pattern; only count/paths change |
| 11 | Fresnel/Snell compositing (`getSurfaceRayColor`, Schlick) | Above/below blend at flat surface | **STAYS** | Byte-identical |
| 12 | Skybox/environment sample for reflection | Reflected ray that misses the box hits sky cubemap | **STAYS** | Byte-identical (reflected ray missing terrain hits sky) |
| 13 | `Renderer.ts` pass switch ("switch between pool passes") | Chooses rectangular vs. rounded pool shader set | **CHANGES** | Add a "region" pool type whose wall/floor passes use terrain+heightfield; wave/normal/caustics/surface passes reused |

A grep for `intersectCube`, `poolHeight`, the cube corner constants, `getWallColor`, `getSurfaceRayColor` and the tile-texture sampler finds every site; items 1–6, 9, 13 are the only sanctioned edits.

### Table 2 — Minimal-edit adaptation spec (container swap, per shader/uniform)

| Shader / stage | Before | After (minimal edit) | Byte-identical? |
|---|---|---|---|
| Wave sim (`Water.ts`) | `texelSize`, ping-pong height RTs, discrete Laplacian | Same shader; only `texelSize`/domain uniforms rebound to window (Q4) | Shader code: YES |
| Normal pass | derivative of heightfield | Unchanged | YES |
| Caustics `.vert` | intersect floor plane at fixed y | `sampleTerrainHeight(worldXZ)` raymarch, else identical | Only intersection swapped |
| Caustics `.frag` | `gl_FragColor = newArea/oldArea` | Unchanged | YES |
| Water-above `.frag` | `intersectCube(…poolHeight…)` | `raymarchSeabed(origin, ray)` → hit/normal; feed same `getWallColor` | Compositing YES; intersection NO |
| Water-below `.frag` | box wall sample + Snell exit | seabed sample + Snell exit unchanged | Compositing YES |
| Wall pass | tile texture, triplanar on box | terrain material, triplanar on coastline mesh | Mechanism YES; inputs NO |
| New uniforms | — | `uSeaLevel` (0.0), `uHeightTex` (sampler2D), `uRegionSize`, `uWindowOrigin`, `uShoreMask` | additive |

### Table 3 — Sim-resolution trade table (region scale ~2 km)

MEASURED baseline: jeantimex's sibling `webgpu-water` documents a **256×256** heightfield sim and **1024×1024** caustics; `Water.ts` here is the same lineage (256² INFERRED, unconfirmed in this repo's source — OPEN). Costs ESTIMATED and labeled.

| Config | Physical texel @ coverage | Visual result | GPU cost (ESTIMATED, M-class TBDR) | Recommendation |
|---|---|---|---|---|
| 256² over full 2 km | 7.8 m/texel | Interactive ripples invisible/aliased; only broad swell survives | negligible sim; detail lost | Reject |
| 512² over full 2 km | 3.9 m/texel | Dolphin wake barely resolved | ~2× 256² | Reject |
| 1024² over full 2 km | 1.95 m/texel | Wake readable but coarse near dolphin; 4 MB+ float RTs | ~4–5× 256²; ~0.5–1 ms | Marginal |
| **512² windowed, 256 m coverage (player-following)** | **0.5 m/texel** | Crisp local response matching demo; global surface calm | ~2× 256²; **<0.5 ms est.** | **RECOMMENDED** |
| 256² windowed, 128 m coverage | 0.5 m/texel | Same texel density, smaller active area | cheapest | Fallback if 512² over-budget |

Interactive detail becomes invisible/aliased above roughly **1–2 m/texel**: dolphin cruise 5 m/s produces a wake that needs sub-meter texels to read. The windowed approach holds texel size at 0.5 m regardless of region size.

### Q4 — Windowed/player-following sim under one global surface (concrete)

- **Global surface**: one large calm plane at y=0 spanning the region, shaded by the jeantimex surface shader driven by a low-amplitude ambient normal (broad swell) — the "breathing sheet."
- **Window**: a 512² GPU sim domain covering a 256 m square centered on and scrolled with the dolphin. Its heightfield composites into the global surface as a local displacement + normal perturbation.
- **Scrolling**: snap the window origin to sim-texel increments (0.5 m) to avoid shimmer; carry over overlapping texels frame-to-frame by copying the shifted region into the new ping-pong target (scroll-copy), injecting zero at newly exposed edges.
- **Edge blending**: cosine falloff over the outer ~10% blends window displacement into the global ambient swell, so no boundary discontinuity. Wave continuity across the boundary is approximate (waves leaving the window are not remembered) — acceptable because the character is calm/local and off-window water is only ever seen at distance.

### Q5 — Terrain clipping the surface above sea level (islands piercing the sheet)

Recommended: **alpha-clip from the shoreline mask**, not stencil or geometry boolean. The surface fragment shader samples `uShoreMask`/`uHeightTex`; where `terrainHeight(x,z) ≥ seaLevel (0)` it `discard`s. Effects: at the shoreline, refraction rays now hit terrain (items 1–2) so shallow-water depth tint appears naturally, and discard prevents z-fighting of the surface against the beach. A ~0.5–1 m foam/wetness band can be derived from the same mask later (deferred to checkpoint 8, PS2 look). Geometry clipping (cutting the water mesh) is rejected — it fights the windowed-sim mapping; stencil is unnecessary given the clean height comparison.

### Q6 — Dynamic caustics onto arbitrary terrain

The demo's differential-area caustics — per Evan Wallace's own account, "the brightness change is proportional to the ratio of the original area" to the new area, computed via `dFdx/dFdy` of refracted vertex positions — can be **carried** if the caustics vertex shader intersects the **seabed heightfield** instead of the floor plane (Table 2). This is the sanctioned path and preserves the graphic, slightly-slow caustic look. If the per-vertex terrain raymarch proves too costly or unstable, fall back to **martinRenou/threejs-caustics** (renders a sub-water environment position map, marches refracted rays against it, supports arbitrary meshes). Modernization cost: it targets older three; expect shader-chunk / RawShaderMaterial updates to r0.184 (~1–2 days), plus verifying its license at source before copying code.

### Q7 — Dolphin/boat/shoreline interaction injection; breach and re-entry

- Injection reuses the demo's object-displacement pattern (`CompoundSphereWaterDisplacement` — a body approximated by overlapping spheres; the demo ball is the canonical pattern). The dolphin is a moving compound-sphere emitter writing displacement into the windowed sim each frame; velocity scales ripple amplitude. Boat = larger, slower compound shape. Shoreline wave reflection is approximate (window-edge falloff).
- **Breach / re-entry** (core to Ecco fidelity per `01_NEW_DECISIONS_TO_MERGE.md`): requires (a) local surface **splash injection** — a burst drop at the crossing point using the `addDrop` mechanism; (b) **above/below composition during crossing** handled by the existing waterline compositor (Q8); (c) while airborne the dolphin is a normal opaque mesh above the surface with no sim interaction until re-entry, when a second, larger drop is injected. No new water system — all through jeantimex mechanisms, honoring the "never bolt on a second system" rule.

### Q8 — Half-submerged camera at the waterline; Snell's window

The demo already composes above/below through `getSurfaceRayColor` (Fresnel/Schlick blend). What breaks when the "pool" becomes a region: (1) the waterline must be evaluated per-fragment against the camera (a clip plane at y=0), not against the box top; (2) the below-water ray must terminate on terrain (raymarch) rather than the box floor. Snell's window from below is preserved: for water (n≈1.333) the critical angle is **48.6°**, and the window compresses the full 180° above-water view into a ~97° cone below; looking up, rays outside the ~48.6° cone undergo total internal reflection (sampling the reflected seabed), inside sample the sky/surface — inherent to the existing refract/reflect code, needing only the terrain-hit substitution.

### Table 4 — Four-shot fidelity test procedure (executable)

Run at every water checkpoint; compare the region build side-by-side with the stock demo. Pass = "every visible part appears to belong to the same jeantimex system."

| Shot | Camera setup | Comparison method | Pass criteria |
|---|---|---|---|
| (a) Above-water angle | Match demo default: ~30° down, mid distance, over open water away from shore | PNG diff + visual A/B | Surface color, Fresnel rim, specular sparkle, swell shape indistinguishable from demo |
| (b) Underwater looking down at caustics on floor | 5 m below surface, pitched down at seabed | A/B of caustic brightness/scale/speed | Caustics broad, bright, slightly slow; differential-area pattern matches demo character |
| (c) Half-submerged at waterline | Camera at y=0, horizontal, static | A/B of above/below split line, refraction band | Clean waterline, correct Fresnel split, no z-fight, no double-horizon |
| (d) Looking up at Snell's window | 3 m below, pitched up | A/B of the ~48.6°-critical / ~97° cone + TIR ring | Snell cone present, edge sharp, outside-cone reflects seabed |

Fixed camera transforms recorded in a test scene; capture PNGs at 1728×1080; accept if per-pixel luminance delta in the water region is within a small tolerance and no structural artifact appears.

### Table 5 — Fallback ladder spec

| Rung | Approach | Trigger evidence to escalate | Cost |
|---|---|---|---|
| 1 (plan) | Windowed 512² sim under one global surface; container swap to heightfield raymarch | — (this is the plan) | Baseline |
| 2 | Near/mid/far tiers: full sim near dolphin, ambient swell mid, static normal far | Rung 1 fails four-shot (b)/(c) at distance, or sim > budget; each tier seam must pass the "same system" test | Medium |
| 3 | Selective port: Water + GPU heightmap + CausticsPass + above/below shaders re-integrated as discrete passes | Rungs 1–2 cannot preserve look OR raymarch cost prohibitive | Highest — explicitly the documented fallback, not the plan |

### Q11 — Per-pipeline-stage performance model (M-class WebGL2, ~1728×1080)

MEASURED architectural facts: Apple Silicon M-series is **tile-based deferred rendering (TBDR)**. Independent M5 fill-rate testing (Michael's Tinkerings, "Apple M5 GPU Roofline Analysis") measured **~1,284 GPixels/s** ("At FMA=0–32, the M5 sustains ~1,290 GPixels/sec"), 62× an immediate-mode baseline (the AMD 780M measured 20.8 GPixels/s), and found the framebuffer **store vs. don't-care curves "indistinguishable"** — i.e. overdraw and multi-pass intermediate writes are absorbed by on-chip tile memory. The final flush of a 1920×1080×4 target "takes ~0.07 ms at 118 GB/s… TBDR makes the store action essentially free." This is why jeantimex's multi-render-target pipeline is cheap on this hardware.

ESTIMATED per-frame budget (16.6 ms; all figures ESTIMATED, confirmed by checkpoint profiling on the actual target):

| Stage | Render targets / format | Est. cost | Notes |
|---|---|---|---|
| Wave sim (512² windowed) | 2× RGBA16F ping-pong, 512² | ~0.3 ms | 2 steps/frame; nearest filtering; half-float fallback per demo |
| Normal pass | 1× RGBA16F 512² | ~0.1 ms | derivative |
| Caustics | 1× 1024² (R/RGBA8) | ~0.5–1.0 ms | differential-area; per-vertex terrain raymarch adds cost |
| Terrain + walls | main color+depth | ~2–3 ms | ~1–2 M tris, triplanar; TBDR absorbs overdraw |
| Water surface (above/below raymarch) | main color | ~2–4 ms | fill-heavy fragment raymarch; dominant variable cost |
| Objects (dolphin/boat, instanced flora) | main color | ~1–2 ms | instanced grass/rocks |
| Post/UI | — | ~0.5 ms | |
| **Subtotal render** | | **~7–11 ms** | leaves ~5–9 ms |
| **Reserved: pose tracking** | CPU/GPU | **~5 ms** | held out of render budget |

The raymarch water-surface fragment cost is the dominant risk; if profiling exceeds ~4 ms, reduce raymarch steps or window coverage before escalating the fallback ladder.

---

## TERRAIN

### Table 7 — Terrain-tool evaluation

| Tool | Capability | Export | License (verified) | Maintenance | Role |
|---|---|---|---|---|---|
| ProceduralTerrains (ZyFou) | GPU field authoring: FBM/ridged/domain-warp `heightAt()`, biome/moisture, LOD board, minimap, live editing; deterministic (mulberry32 seed) | PNG screenshot + **1024² grayscale heightmap PNG** (ortho render); GLB export advertised | MIT (github.com/ZyFou/ProceduralTerrains) | Active, small | **World-field authoring** — shape the region interactively, export heightmap |
| THREE.Terrain (IceCreamYou) | Algorithm toolbox: DiamondSquare, Perlin/Simplex, Worley, Brownian, filters, island/cliff/canyon helpers, `ScatterMeshes`, `generateBlendedMaterial`, **`toHeightmap()`/import** | Heightmap canvas (PNG) via `toHeightmap`; mesh geometry | MIT (`@license MIT`, Sukin) | Maintained, low velocity (2.0.0, r130 base, r160+ compatible) | **Algorithm toolbox + bake bridge** — scriptable ops, heightmap round-trip, scatter authoring |

Neither is imported as runtime architecture; both are **authoring-time** tools whose output is the baked dataset. ProceduralTerrains gives interactive world-shaping; THREE.Terrain gives scriptable algorithms and the `toHeightmap` bake bridge.

### Table 6 — Baked-data schema

Texel-size justification: silhouettes are the protected feature and dolphin cruise is 5 m/s; a **2049×2049 16-bit heightmap over 2 km = ~0.98 m/texel** resolves peaks/coastlines cleanly as one ~8 MB asset. Power-of-two-plus-one for clean LOD/heightfield tiling.

| Artifact | Format | Resolution | Derivation | Repo path (proposed) |
|---|---|---|---|---|
| Heightmap | 16-bit R16 (little-endian) or 16-bit PNG→EXR | 2049² | Authored in ProceduralTerrains; range [−80, +200] m → 16-bit | `assets/world/height.r16` |
| Shoreline mask | 8-bit PNG | 2049² | Derived: `terrainHeight(x,z) ≥ seaLevel(0)` | `assets/world/shore.png` |
| Biome/placement mask | 8-bit RGBA (channels = biomes) | 1025² | Slope/height/moisture thresholds | `assets/world/biome.png` |
| Placement JSON | JSON | — | Instances `{type, x, z, yaw, scale}` for flora/rocks/caves/landmarks | `assets/world/placement.json` |
| Cave manifest | JSON + GLB refs | — | Cave module transforms + seam metadata | `assets/world/caves.json` |
| World header | JSON | — | Region origin, size, seaLevel, axis, height range | `assets/world/world.json` |

Conventions: 1 unit = 1 m, y-up, y=0 = sea level, region origin at region center (0,0), XZ ground plane; max depth −80 m, tallest peak +200 m.

### Q14 / Table 9 (data flow) — Runtime loader (one source of truth)

```
                 ┌────────────────────────────┐
  height.r16 ───▶│  WorldData (loader)         │
  shore.png  ───▶│  - decode heightmap → Float │
  biome.png  ───▶│  - build terrainHeight(x,z) │
  placement  ───▶│    bilinear sampler         │
  caves.json ───▶└──────┬───────────┬──────────┘
                        │           │
       ┌────────────────┼───────────┼─────────────────┐
       ▼                ▼           ▼                  ▼
  Render mesh(es)   Rapier         Water depth      Placement /
  (chunked LOD,     heightfield    input to         movement modes
  triplanar mat)    collider +     surface shader   (dolphin/boat/
                    trimesh caves  (seaLevel−h)     walk/swim)
```
`terrainHeight(x,z)` is the single function every subsystem calls; a visible/collision mismatch is a defect by construction because render mesh, collider and water depth all read the same decoded height field.

### Q15 — Terrain material (PS2 direction; deferred to checkpoint 8)

Mechanism: `generateBlendedMaterial`-style **height/slope-blended low-frequency textures** (soft diffuse, no pin-point speculars), triplanar on steep coastline, one directional light + baked/vertex AO — consistent with the one-lighting-system rule and mesqme's single-directional-light finding. Texture selection and tuning deferred to checkpoint 8.

### Q16 — LOD for a bounded 2 km region

Recommended: **chunked static LODs** (8×8 or 16×16 tiles, 3–4 discrete levels) with skirt rings to hide cracks (the ProceduralTerrains skirt technique). No geomorphing at this scale. **Silhouettes are protected**: coastline/peak silhouette chunks keep their highest LOD regardless of distance (silhouette-preserving LOD bias), so defining forms never simplify visibly.

### Q17 — Transferable mesqme/infinite-terrain techniques (no streaming)

Transfer: (1) **instanced grass/flora/rocks** in per-chunk InstancedMeshes with alpha-test cards; (2) **vertex-shader wind** (sine + scrolling noise); (3) **single directional light** with a copied/simplified shadow chunk (mesqme found >1 light untenable — matches our one-lighting rule); (4) **distance fade + fog** to hide flora cull; (5) fake AO via base/tip color lerp. Do NOT import the infinite chunk streaming/paging architecture — we have a bounded world.

---

## CAVES

### Table 8 — Cave method decision matrix

| Criterion | Authored/kitbashed modular meshes | Local SDF/density-field + surface nets/dual contouring |
|---|---|---|
| Art-directability | **High** — direct, hand-placed | Medium — indirect via field editing |
| Ecco-authenticity (game caves were hand-modeled) | **High** — same methodology | Low–Medium — organic but not authored |
| Collision generation | **Simple** — trimesh straight from GLB | Complex — mesh from field, then trimesh; seam care |
| Integration with heightfield terrain | Manual seam placement (Q19) | Terrain is a heightmap not an SDF → conversion cost to union |
| Authoring effort | Low (CC0 Kenney Modular Cave Kit + Blender) | High (build field editor / offline meshing pipeline) |
| Runtime cost | Low — static GLB, instanced | Low if baked offline; high if runtime-meshed |
| Tooling risk | Low — Blender + glTF | Medium–High — surface-nets lib + integration |

**RECOMMENDED METHOD: authored/kitbashed modular cave-and-arch meshes.** It wins on the two governing priorities (art-directability and Ecco-authenticity — the game's caves were hand-modeled), gives the simplest collision (trimesh from the same GLB), and needs no new meshing toolchain. SDF/surface-nets is documented as viable (e.g. fast-surface-nets ~20 M tris/s offline; naive surface nets / dual contouring for sharp features) but rejected here because the world is heightmap-based (no native SDF to union with) and the authoring/tooling cost is unjustified for a bounded, hand-authored world. Offline meshing in Blender remains available for one-off organic pieces exported as static GLB — capturing the only real advantage of the SDF route without its runtime/pipeline cost.

### Q19 — Volumetric-formation ↔ heightfield seam blending

- **Geometry**: cave modules are placed so their mouth footprint overlaps the terrain; the heightmap is locally lowered (authoring-time stamp) to meet the module lip, avoiding gaps.
- **Texturing**: shared triplanar rock material across terrain and cave near the seam; vertex-color or mask blend band at the lip so the transition reads continuously.
- **Collision continuity**: the seam is covered by both the heightfield collider (terrain) and the cave trimesh, with a small overlap so the dolphin can't clip through. Where a cave undercuts (an overhang the heightfield can't represent), the heightfield is locally omitted and the trimesh is authoritative.

---

## COLLISION

### Q20 / Table 9 — Rapier + three-mesh-bvh plan

| Element | Collider / mechanism | Data source | Cost |
|---|---|---|---|
| Seabed + land base | **Rapier heightfield** `ColliderDesc.heightfield(heights, scale)` | Baked heightmap, downsampled (e.g. 513²) | Rapier docs: heightfields "use much less memory" than trimesh and are "useful to define large parts of terrains"; one static collider |
| Caves / arches / overhangs | **Rapier trimesh** `ColliderDesc.trimesh(verts, indices)` per module | Cave GLBs | Higher per-vertex; keep modules modest poly; static/fixed bodies |
| Structures/landmarks | trimesh or convex hull | placement JSON | as authored |
| Fast spatial queries (raycasts, closest-point, containment, ground snap) | **three-mesh-bvh** (`bvhClosestPointToPoint`, accelerated raycast) | render/terrain geometry | O(log n) |
| Dolphin containment (soft repulsion) | re-point soft-repulsion at **authored shoreline mask** + heightfield closest-point | shoreline mask + BVH | cheap per-frame |

Setup: `await RAPIER.init()`; heightfield heights supplied as a column-major matrix per the Rapier JS API; downsample the 2049² art heightmap to a physics grid (~513² ≈ 4 m cells) to bound memory and step cost. Per-frame: one `world.step()`; a heightfield plus a handful of static trimeshes is well within budget — community reports show large heightfields are cheap and the known cost is *dynamic* trimesh (which we avoid; all cave trimeshes are fixed bodies). three-mesh-bvh handles all non-physics queries (camera collision, walk-mode ground-follow, placement raycasts) so Rapier only does dynamics. The dolphin's soft-repulsion containment re-points from box walls to the `terrainHeight`/shoreline-mask gradient, gently pushing the dolphin off land and out of caves it shouldn't enter.

---

## CONTRACT

### Table 10 — Coordinate/units contract & frame budget

**Coordinate/units contract (Q21):**
- Units: meters. Axes: right-handed, **y-up**. Ground plane = XZ.
- **Sea level = y 0.** `terrainHeight(x,z) < 0` → seabed; `≥ 0` → exposed land.
- Region origin at region center (0,0,0); region spans X,Z ∈ [−1000, +1000] (2 km).
- Height range: seabed floor y = −80, tallest peak y = +200.
- Sim-domain→world: windowed 512² sim maps to a 256 m square, origin = dolphin position snapped to 0.5 m texels; sim's internal XY → world XZ via jeantimex's existing `.xzy` swizzle.
- Heightmap texel (i,j) → world: `x = −1000 + i·(2000/2048)`, `z = −1000 + j·(2000/2048)`; value → `y = −80 + h16/65535·280`.

**Frame budget (Q23):** render ~7–11 ms + pose ~5 ms ≤ 16.6 ms at 60 fps (per Q11 table). All render figures ESTIMATED, confirmed at checkpoints.

### Table 11 — Scale-defaults verdict

| Default | Given | Verdict | Reason |
|---|---|---|---|
| Region | 2 km × 2 km | **Validated** | Fits one 2049² 16-bit heightmap at ~0.98 m/texel; bounded, no streaming |
| Max depth | 80 m | **Validated** | Within 16-bit range with peak; supports deep cyan/cobalt absorption gradient |
| Tallest peak | 200 m | **Validated** | Silhouette feature; [−80,+200]=280 m fits 16-bit |
| Sea level | y 0 | **Validated** | Clean sign test for shoreline mask |
| Units | meters, y-up | **Validated** | — |
| Dolphin cruise/burst | 5 / 9 m/s | **Validated** | Drives the 0.5 m/texel windowed-sim requirement (wake readability) |
| **Sim resolution** | (implicit single sheet) | **REVISED** | Use **512² player-following window @0.5 m/texel**, not a 2 km single sim sheet — a 2 km sheet at any feasible resolution aliases the interactive wake |
| **Water surface** | (implicit pool→region) | **REVISED** | One global calm plane clipped by shoreline mask + windowed sim (fallback rung 1) |

---

## Answered / Open / Needs-user

**Answered (with cited evidence):** Q1 (Table 1), Q2 (Tables 1–2), Q3 (Table 3), Q4, Q5, Q6, Q7, Q8, Q9 (Table 4), Q10 (Table 5), Q11 (perf model), Q12 (Table 7), Q13 (Table 6), Q14 (data flow), Q15, Q16, Q17, Q18 (Table 8 — single recommendation = authored modular meshes), Q19, Q20 (Table 9), Q21, Q22 (Table 11), Q23 (Table 10). All 12 deliverable tables present.

**Open (with what would resolve):**
1. **jeantimex HEAD commit SHA** — GitHub commits/raw/API endpoints were robots-blocked; the observed `b20acd37…` is GitHub's `meta-release` front-end hash, not a commit SHA. Resolve: authenticated `git clone` / GitHub UI, read `/commits/main`.
2. **Verbatim GLSL of jeantimex's port** — whether `intersectCube`/`poolHeight` are kept literally vs. an SDF-only variant, the exact `Renderer.ts` render-target resolutions, and the exact `addDrop`/object-uniform names. Could not open `src/**` blobs (robots-blocked). The Evan Wallace original is verified (`const float poolHeight = 1.0;`, `intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax)`, bounds `vec3(-1,-poolHeight,-1)`..`vec3(1,2,1)`) and is what jeantimex ports; this does not change the design (swap targets are identified), but Stage 3 should grep-confirm at clone time.
3. **256² sim resolution in this repo's `Water.ts`** — inferred from the sibling `webgpu-water`; confirm at clone.
4. **All performance numbers are ESTIMATED** — confirmed only by checkpoint profiling on the actual target machine.
5. **martinRenou/threejs-caustics and nemutas/caustics licenses** — must be re-verified at source before any code copy (fallback only; nemutas remains reference-only).

**Needs-user:** confirmation of the target machine's exact GPU (M-class core count) to firm up the performance model; confirmation that the GLB export path from ProceduralTerrains is present in the pinned version (README-advertised, not source-verified here).