# Track B Research Prompt — Water, Terrain, and Caves Technical Plan

**Project:** BodyArcade Shared-World, Stage-2 research, Track B of five (A–E).
**Session type:** Web-enabled deep research. Read source code at the pinned repositories directly; verify licenses at the primary source.
**You are a researcher, not an implementer.** You produce a technical plan with numbers, not code changes.

---

## 1. Mission

Produce a concrete, evidence-backed design for:

1. **Water:** carrying the exact `jeantimex/threejs-water` demo across a bounded ~2 km fictional region by **minimal edits only** — pool walls → coastline walls, pool floor → seabed heightfield — with performance numbers for the target machine.
2. **Terrain:** the author-once/bake/load terrain pipeline (authoring tools, baked-data schema, runtime loader, LOD).
3. **Caves:** the mandated cost comparison between authored/kitbashed modular cave meshes and a local SDF/density-field + meshing route, ending in a single recommendation.
4. **Collision:** the Rapier + three-mesh-bvh plan flowing from one world dataset.

The end state: the Stage-3 implementation prompt can say "change these exact files/uniforms/shaders, keep these byte-identical, bake this schema, use this cave method, at these resolutions" with nothing left to judgment.

## 2. Governing context (embedded digest — the attached master context governs in full)

- **Fidelity hierarchy (top decision):** the exact jeantimex look is preserved as-is; changes are limited to minimal integration edits (the canonical example is the container swap). Where the untouched jeantimex look and the Ecco spec disagree, **jeantimex wins for now**. jeantimex is authoritative for surface and waterline; the Ecco spec (Track D) is authoritative for underwater atmosphere, implemented **through jeantimex's mechanisms**, never by bolting on a second system.
- **One shared world:** exactly one terrain dataset. `terrainHeight(x, z) < seaLevel` → seabed; `≥ seaLevel` → exposed land. Rendered terrain, collision, shorelines, water depth, placement, and all four movement modes derive from the same baked data. Visible/collision mismatch is a defect.
- **Bake, don't generate at runtime.** Authoring tools produce committed heightmap + masks + placement data; the runtime only loads.
- **Scale defaults (validate or revise with reasons):** region ≈ 2 km × 2 km; max depth ≈ 80 m; tallest peak ≈ 200 m; sea level = y 0; units = meters; dolphin cruise ≈ 5 m/s, burst ≈ 9 m/s.
- **Water character:** calm and readable — large breathing sheets, clean rolling forms, occasional swell, strong local response to the dolphin. No storm ocean, no FFT/spectral waves, no foam fields.
- **One coherent lighting system:** surface color, underwater fog, caustics share stylized parameters (turquoise shallows → deep cyan/cobalt; saturated blue-green absorption, never gray; caustics broad, bright, slightly slower and more graphic than physically perfect).
- **Platform constraints:** Three.js **0.184**, **WebGL2** (WebGPU research-only), desktop Chrome, M5-class MacBook Pro, local-only, **sustained 60 fps at ≈1728×1080** with headroom reserved for pose tracking.
- **Superseded — do not resurrect:** SeedOcean; streamed/tiled/infinite `threejs-water`; "port only selected parts of jeantimex" / "caustics first" / "camera-centered patch first" (these are the documented fallback ladder, not the plan); a second water renderer as a starting assumption.

## 3. Required attachments and sources

| Item | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record; §5, §6, §7, §15.2 are your spec. |
| `01_NEW_DECISIONS_TO_MERGE.md` | Newest decisions (gameplay-fidelity priority affects water interaction and breach). |
| `02_OCEAN_FLOOR_THREEJS_LATEST.md` | July-15 technical analysis of jeantimex internals and adjacent resources. Finished work: build on it, cite it, do not redo it. Its port-selectively recommendations are the fallback ladder only. |
| `03_CAVE_GENERATION_RESEARCH.md` | Cave-resource survey; calm-water and one-lighting-system conclusions. |
| `04_BODYARCADE_DESIGN_PLAN_V2.md` | Ideas bank (density fields, landmark authorship). Its L0–L11 stack and milestones are superseded. |
| `github.com/jeantimex/threejs-water` | **Read the source in full.** MIT, TypeScript, Vite, Three.js 0.184. Pin the commit SHA you read. |
| `github.com/ZyFou/ProceduralTerrains` | Primary terrain-authoring candidate. Verify license. |
| `github.com/IceCreamYou/THREE.Terrain` | Terrain-algorithm toolbox. Verify license and maintenance status. |
| `github.com/mesqme/infinite-terrain` | **Reference only** — techniques, never architecture import. |
| `github.com/gkjohnson/three-mesh-bvh` | Fast raycasts/queries. |
| Rapier (rapier.rs) | Physics/collision: heightfield + trimesh colliders. |
| `github.com/martinRenou/threejs-caustics` | BSD-3-Clause, **approved fallback** caustics only. |
| `github.com/nemutas/caustics` | Reference; **license must be verified before any code use**. |

## 4. Evidence to inspect

1. The complete jeantimex source: every shader, uniform, mesh, render target, and the five-stage per-frame pipeline (object shadow/refraction textures → dynamic caustics → pool render → water-surface render → final composition).
2. The 256×256 GPU height-field simulation: domain mapping, ripple injection, moving-sphere/box/compound displacement, buoyancy and drag (the demo ball is the canonical dolphin/boat interaction pattern).
3. **The load-bearing fact to map exhaustively:** the water, caustics, and wall shaders raycast/intersect against the pool's wall and floor geometry. Enumerate **every place pool geometry is assumed.**
4. ProceduralTerrains and THREE.Terrain capabilities, export formats, maintenance, licenses.
5. mesqme/infinite-terrain techniques (instanced grass/trees/stones, wind, interaction, Rapier integration) for what transfers to a bounded world.
6. Rapier heightfield and trimesh collider APIs and costs on the web (WASM) build.
7. Published evidence on Apple-Silicon WebGL2 fill-rate/bandwidth behavior relevant to the performance model (label estimates as estimates).

## 5. Questions that must be answered

**Water:**

1. Every place pool geometry is assumed — file, function, shader, uniform — as a table. Which change for the container swap and which stay **byte-identical**?
2. The minimal-edit design: how do rectangular walls/floor become authored coastline "walls" + seabed heightfield? What exactly replaces the wall/floor intersection functions (heightfield raymarch? SDF lookup? mesh BVH?) and what does that cost per fragment?
3. Domain scaling: what do 256², 512², and 1024² sim textures look and cost like at ~2 km? At what physical texel size does interactive detail become invisible or aliased?
4. The sanctioned windowed/player-following sim under one global surface: how would it work concretely (window size, scrolling the sim domain, blending at the window edge, wave continuity across the window boundary)?
5. Where and how does terrain clip/mask the water surface above sea level (islands piercing the sheet)? Stencil, alpha mask from the shoreline mask, geometry clipping? What does each do to reflections/refraction at the shoreline?
6. How do the demo's dynamic caustics project onto arbitrary terrain instead of pool walls/floor? If they cannot be carried, specify the martinRenou fallback in implementable detail (modernization cost included).
7. How are dolphin, boat, and shoreline interactions injected — generalizing the demo-ball displacement pattern? What does breach and re-entry require of the surface shader (local displacement, splash injection, above/below composition during crossing)?
8. Half-submerged camera: how does the demo compose above/below at the waterline, and what breaks when the "pool" is a region? Include Snell's-window behavior from below.
9. The four-shot fidelity test, as an executable procedure: (a) demo's above-water angle, (b) underwater looking down at caustics on the floor, (c) half-submerged at the waterline, (d) looking up at Snell's window — side-by-side against the stock demo at every water checkpoint. Specify camera positions, comparison method, pass criteria.
10. The fallback ladder in implementable detail — (i) windowed sim (sanctioned), (ii) near/mid/far tiers with the "every visible part appears to belong to the same jeantimex system" success test, (iii) selective port of `Water` + GPU heightmap + `CausticsPass` + above/below shaders — each with trigger evidence required to escalate.
11. Per-pipeline-stage performance model on Apple-Silicon WebGL2 at ≈1728×1080: fill cost, render-target counts and formats, texture bandwidth, expected frame-budget share. Numbers, not vibes; label estimates.

**Terrain:**

12. ProceduralTerrains vs THREE.Terrain as authoring tools: capabilities, export formats, license, maintenance; what does each contribute to the pipeline (world-field authoring vs algorithm toolbox)?
13. The baked-data schema: heightmap resolution for 2 km at target detail (justify texel size against dolphin speed and camera distance); shoreline-mask derivation from `terrainHeight ≥ seaLevel`; biome/placement masks; placement JSON format; file formats and repo layout.
14. The runtime loader: how baked data becomes render mesh(es), collision, containment input, and water-depth input — one source of truth, with the data-flow diagram.
15. Terrain material approach consistent with Track D's PS2 direction (soft low-frequency textures, no modern pin-point speculars) — what mechanism, deferred tuning to checkpoint 8?
16. LOD strategy for a bounded 2 km region (chunked static LODs? geomorphing? none?), with the constraint that silhouettes are a protected defining feature.
17. Which mesqme/infinite-terrain techniques transfer without importing streaming architecture?

**Caves:**

18. The mandated cost comparison — authored/kitbashed modular cave-and-arch meshes vs local SDF/density field + meshing (surface nets / dual contouring preferred over the metaball-oriented built-in `MarchingCubes`; offline meshing in Blender or a build step allowed) — scored against: art-directability, Ecco-authenticity (the game's caves were hand-modeled), collision generation, integration with the heightfield terrain, authoring effort, runtime cost. **End with a single recommended method.**
19. How volumetric formations blend with heightfield terrain at their seams (geometry, texturing, collision continuity).

**Collision:**

20. Rapier heightfield collider for base terrain + trimesh for caves/arches/structures: setup, memory, per-frame cost; how the dolphin sim's soft-repulsion containment re-points at the authored shoreline mask; where three-mesh-bvh is used instead of/alongside Rapier for fast queries.

**Contract:**

21. The coordinate/units contract: meters, y-up, sea level = y 0, region origin, axis conventions, sim-domain-to-world mapping.
22. Validated (or revised, with reasons) scale defaults from §2, checked against sim resolution and the performance model.
23. Per-subsystem frame-budget allocation summing within 16.6 ms with pose-tracking headroom reserved.

## 6. Required tables and deliverables

1. **Pool-assumption inventory** — every file/shader/uniform/mesh where pool geometry is assumed; columns: location; what it assumes; changes or stays byte-identical; replacement mechanism.
2. **Minimal-edit adaptation spec** — the container-swap design, per shader and per uniform.
3. **Sim-resolution trade table** — 256/512/1024 (and windowed variants): texel size at region scale, visual result, GPU cost, recommendation.
4. **Four-shot fidelity test procedure** — cameras, method, pass criteria.
5. **Fallback ladder spec** — three rungs, trigger evidence, cost of each.
6. **Baked-data schema** — formats, resolutions, masks, placement JSON, repo paths.
7. **Terrain-tool evaluation table** — capability, export, license (verified, with link), maintenance, role.
8. **Cave method decision matrix** — both routes scored, one recommendation.
9. **Collision plan** — collider types, data flow, costs.
10. **Coordinate/units contract** and **frame-budget table**.
11. **Scale-defaults verdict** — validated or revised with reasons.
12. **Answered / Open / Needs-user** section at the end.

## 7. Uncertainty and citation rules

- Pin exact URLs, repository commit SHAs (including the jeantimex SHA you read), file paths, and license names with links to the license text. Verify every license at the primary source; anything unlicensed is **reference-only, no code copying** (cortiz2894 water is already ruled reference-only; nemutas is unverified).
- Separate **measured** (read from source / documented) from **estimated** (performance projections, look predictions). Every estimate is labeled and comes with how checkpoint testing will confirm it.
- **No substitution:** jeantimex, ProceduralTerrains, THREE.Terrain, Rapier, three-mesh-bvh are the plan. You evaluate *how*, not *whether*. A disqualifying fact (license failure, abandonment, technical impossibility) is reported as a fact, with alternatives clearly labeled as proposals.
- Do not assume a second renderer. Do not re-open settled decisions (§15.5 of the master context). Do not re-do the July-15 analysis — cite it and verify its load-bearing claims against current source.
- Cite the attached corpus by filename and section when you rely on it.

## 8. Output

- **Exact output filename:** `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md`
- **Destination:** `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.
- Markdown with tables; executive summary first; Answered / Open / Needs-user last.

## 9. Completion criteria

- [ ] Every question in §5 answered with cited evidence or explicitly marked open, with what would resolve it.
- [ ] The pool-assumption inventory is exhaustive (a reader could grep the repo and find nothing missed).
- [ ] The minimal-edit spec preserves everything not sanctioned to change, stated byte-identical-by-default.
- [ ] One cave method is recommended with the full decision matrix behind it.
- [ ] The performance model gives numbers per pipeline stage and a frame budget that sums within target.
- [ ] Scale defaults are validated or revised with reasons.
- [ ] All licenses verified at source with links; every estimate labeled.
- [ ] The report alone lets Stage 3 write water/terrain/cave/collision checkpoints with zero open design choices.
- [ ] The report is written to `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md`.
