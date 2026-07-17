# BodyArcade Shared-World — Master Context and Decision Record (v3)

Date: 2026-07-16

Status: **Live.** This document supersedes the "BodyArcade Shared-World Discovery Context" draft and absorbs every decision made in the July 2026 planning conversation, plus verified facts about the repositories and the source archive. Addendum A (end of file) records the V1–V8 prompt-pack status, the audit-first rule, and the operative attachment list; where Addendum A conflicts with the body, Addendum A governs.

---

# 0. Purpose and how to use this document

This document exists so that a fresh Fable/Claude thread can **write the Stage-2 research prompts** without re-deriving anything. It is the single consolidated record of:

- what BodyArcade's shared world is;

- every decision that has been made, and which older ideas those decisions replaced;

- the verified current state of the code;

- the exact resources selected, with their internals, licenses, and known risks;

- the visual target, defined precisely enough to be reproducible;

- the asset in hand (the dolphin) and the policy for every asset not in hand;

- the process rules (checkpoints, review gates, local-only development);

- the full specification of the four research tracks the next thread must turn into prompts.

**The next thread's job:** write four extremely detailed, self-contained research prompts (Track A: repository audit; Track B: water/terrain/caves technical plan; Track C: asset and audio manifest; Track D: PS2 visual specification + capture instruction sheet), per Section 15. Each prompt will be pasted into a separate deep-research session. The prompts may be delivered as four files or one file with four clearly separated prompts.

**The next thread must not:**

- re-open decisions recorded here;

- soften, generalize, or "improve" the visual target;

- substitute different repositories, demos, or assets for the ones named here;

- collapse the four tracks into vague general research;

- re-ask questions this document answers.

Stage sequence, for orientation: **Stage 1 (done)** — this planning conversation, producing this document. **Stage 2 (next)** — four research runs producing an architecture, resource plan, asset manifest, and measurable visual spec. **Stage 3** — an implementation prompt (or prompt series) written from the Stage-2 results, deterministic enough that the implementing agent selects nothing on its own judgment.

---

# 1. Decision authority

When sources conflict, authority runs in this order:

1. The user's newest explicit statements in the active conversation.

2. **This document.**

3. The verified state of the `lekandigital/posepuppet` repository at the branches/SHAs pinned in Section 4.

4. The `lekandigital/bodyarcade-current-design-source` repository (design archive extracted at commit `99df0bc`).

5. The prior planning and research documents listed in Section 16 (valuable as archives and evidence; their outdated recommendations are **not** active).

6. External recommendations.

## 1.1 Superseded — no longer the plan

Each of these appears in older documents and is explicitly dead. Research and implementation must not resurrect them:

- **Multiple visual styles.** The whimsical / realistic / low-poly / fantasy-game profile system (and any per-mode style) is retired. There is **one style** for the shared world, across all four modes.

- **"PS2 aesthetic" as retro hardware emulation.** The completed Dolphin app interpreted "PS2" as vertex-lit flat-shaded procedural meshes, no textures, dithered fog, affine-texture vibes, optional 4:3. This interpretation is the reason the current build looks "too low poly and bare" and is banned. See Section 3.

- **Dreamcast-first visual target.** PS2 is the target, by far (Section 3.1).

- **Real-world geography for the first region** (OSM coastlines, San Francisco Bay outline, Google-Maps-derived worlds, real cities). First region is fictional and authored.

- **SeedOcean** as the ocean surface (WebGPU-first; removed from Dolphin direction in the July 15 analysis and not selected for the first build).

- **Underwater AI** (`Underwater-AI/underwater-ai.github.io`) as the environmental-richness system.

- **Streamed / tiled / infinite `threejs-water`** as the starting architecture, and the older "port only selected parts of jeantimex" / "do martinRenou caustics first" / "camera-centered patch first" recommendations from the July 15 Ocean-Floor analysis. Those are now the documented **fallback ladder**, not the starting plan (Section 5).

- **A very large initial world; a globe or multiple cities as the first build; building all systems at once.**

- **The autonomous no-user-gates development policy** from the old prompt pack ("no interruptions, one final test plan"). This project runs on frequent live-demo checkpoints with review gates (Section 13).

- **Remote-machine development** (the remote NVIDIA box, `DISPLAY=:2` GPU verification lanes, remote worktree/tmux orchestration). Everything runs locally on the user's Mac (Section 12).

- **Letting an implementation model invent substitute 3D assets or textures** — ever (Section 9).

- **TinySkies as a styling reference for the shared world.** Shared-world Flight uses the one style. TinySkies as its own separate standalone experience is out of scope for this effort (neither restyled nor deleted; simply not part of this work).

---

# 2. What BodyArcade is

BodyArcade is the games umbrella built on **PosePuppet**, a browser-based, privacy-preserving body-tracking system (webcam → in-browser pose inference → derived movement signals; raw landmarks never leave the tracking boundary). Games consume derived signals through the versioned `@bodyarcade/body-input` protocol. Keyboard controls always work in parallel — this is standing policy across all modes.

## 2.1 One shared physical world, four movement modes

The shared world is one continuous physical place experienced through four controllers and cameras:

- **Dolphin** — swim underwater, explore reefs and caves, surface, breach.

- **Rowing** — travel the water surface along coasts, bays, and inlets.

- **Walking** — explore the exposed land: beaches, paths, forests, hills.

- **Flight** — fly above the same terrain and water.

These are not four maps. In the user's own formulation, which is the canonical statement of the world model:

> The terrain is shared. A hill's base is the sea floor. Some hills aren't tall enough to break the surface of the water; some are; some are flat and are islands; some are tall and reach the height a plane would fly at. The camera can move between underwater, the water surface, the land surface (up and down terrain for walking), and sky level — and the style is the same everywhere. The water overlaps the generated terrain, almost as if the terrain is above ground but just under water. The dolphin and boat interact with the water the way the ball collides with the water in the jeantimex demo — and the jeantimex pool's boundaries become the coastline walls and the seabed floor. It's all one shared world.

Consequences, stated as law:

- There is exactly one terrain dataset. `terrainHeight(x, z) < seaLevel` → seabed under water; `terrainHeight(x, z) ≥ seaLevel` → exposed land. There must never be a separately authored "land map" and "ocean-floor map" for the same location.

- An island is not a floating asset; it is terrain that crosses the waterline.

- Rendered terrain, collision, shorelines, water depth, placement rules, and all four modes derive from the same source data.

- The dolphin's breach is the proof-of-concept moment: rising through the surface, the player sees the horizon, the water around the dolphin, and the same islands/forests/cliffs/ruins the other three modes inhabit, then re-enters cleanly.

## 2.2 Scope facts

- **Single-player, local-first.** No networking or multiplayer architecture in this effort. ("Shared" means shared across modes, not across players. Recording/replay sharing is a later concern and already supported by the deterministic sim design.)

- The first build is **Dolphin-mode pure exploration** in the shared world (Section 11); Rowing, Walking, and Flight views come only after the shared environment is convincing (Section 12).

---

# 3. The visual target — precise definition

## 3.1 Primary target: the PS2 release of *Ecco the Dolphin: Defender of the Future*

The first region pursues a **strict recreation, as far as practical, of the PlayStation 2 visual identity of *Ecco the Dolphin: Defender of the Future*** (Appaloosa Interactive; Dreamcast 2000, PS2 port 2002). PS2 matters far more than Dreamcast. Do not replace this target with broad labels ("low-poly," "stylized ocean," "PS2-inspired," "stylized realism," "photorealistic").

Documented PS2-vs-Dreamcast deltas the visual spec must respect (from the project's own art-bible research, to be re-verified against PS2 footage in Track D):

- PS2 environmental textures are **more vividly colored** (not more detailed).

- PS2 underwater sunlight caustics/refraction effects are **toned down relative to Dreamcast but still present and attractive**.

- PS2 has **no mipmapping** (sharper, no distance shimmer) and adds **dithering visible mainly in dark areas**.

- PS2 holds a **steadier framerate** and adds player-guidance affordances (a compass, an L3 next-objective aid, R3 manual camera correction) — useful later as HUD inspiration, consistent with the project's "keep the mood, remove the frustrations" stance.

- 4:3 original aspect; **do not** adopt 4:3 for BodyArcade.

Dreamcast material remains usable as **secondary evidence for level layout, geometry, and composition** where PS2 footage is scarce — never as the color/effects authority.

## 3.2 The two failure modes, banned by name

**Failure mode 1 — retro hardware emulation.** "PS2" does **not** mean emulating console limitations. Banned as style choices: forced low poly counts, flat-shaded vertex lighting as identity, textureless procedural meshes, affine texture wobble, forced 4:3, dither-as-aesthetic, bare worlds. The existing `apps/dolphin` presentation pass is the cautionary example (Section 4.2). Evidence of intent: the user likes the mesh density of the jeantimex water exactly as it is — modern smooth geometry is simply allowed. The target is **the look of that specific game** — which was lush, dense, fogged, caustic-lit, documentary-naturalistic ("National Geographic underwater video" was Appaloosa's stated reference) — not the look of the console.

**Failure mode 2 — generic modern ocean.** Equally banned: replacing the target with a clean modern stylized ocean, a physically-accurate FFT storm ocean, foam-heavy spectral water, or "tasteful reinterpretation." The fog is heavy, the palette is specific, the composition is landmark-driven, and the water is calm and readable.

## 3.3 The fidelity hierarchy (arbitration rule — confirmed by the user)

Two visual authorities coexist. Their precedence:

1. **Top priority: the exact `jeantimex/threejs-water` look, using the exact resource.** The demo's appearance is preserved as-is. Changes are limited to *minimal integration edits* — the canonical example: the demo's rectangular pool boundary becomes the terrain-defined jagged coastline (pool walls → coastline walls; pool floor → seabed). No reimplementation, no "visually similar" substitute shader, no stylistic rewrites. Where the untouched jeantimex look and the Ecco spec disagree, **jeantimex wins for now**; Ecco-direction tweaks come later as individually approved steps.

2. **Division of authority:** jeantimex is authoritative for the **surface and the waterline** — the above-water look, reflections/refraction, Snell's window from below, the breach crossing, half-submerged camera behavior. The **Ecco specification is authoritative for the underwater atmosphere** — fog curve, palette, visibility distances, caustic intensity/character — implemented **through jeantimex's mechanisms**, not by bolting on a second system.

3. In parallel, the Ecco program continues at full priority on everything that is not the water shader: assets, physics feel, gameplay grammar, creature behavior, world composition, density. Gathering these now is important even while the water stays untouched.

## 3.4 Density and composition

The world must be dense and consistently rich, never bare. The prior design analysis named the real problem precisely: *the volume between camera and geometry is empty, and nothing moves.* Both must be solved. The player should usually see some combination of terrain variation, rocks, coral, kelp/seagrass, fish, ruins, caves or overhangs, shoreline vegetation, atmospheric particles, and a visible landmark or route cue. Distinctive formations or discoveries should appear roughly every 30–60 seconds of normal exploration, without a rigid quota. Geography stays readable and intentionally composed — landmark-driven, like the source game (spires, arches, columns, framed cave mouths; one or two strong navigational silhouettes always in view) — not uniformly filled with random objects. Depth stratification is the level design: bright dense shallows, blue midwater, dark sparse deep; the fog **is** the water and is always colored (never neutral gray).

## 3.5 One style

One style across underwater, surface, land, and sky, across all four modes. It is not defined as "low poly" or "high poly" — it is the culmination of: the PS2 Ecco target (Track D makes it measurable), the exact selected Three.js resources (jeantimex above all), and the approved/user-provided assets. The existing implementations' style (flight, dolphin, rowing, walking) is explicitly rejected as too low-poly and bare.

---

# 4. Verified repository state (checked directly on 2026-07-16)

## 4.1 Repositories

- **`github.com/lekandigital/posepuppet`** — public. The live monorepo. All branches below are pushed to the remote (verified via `git ls-remote`), including the one with a `local/` prefix.

- **`github.com/lekandigital/bodyarcade-current-design-source`** — public (originally created private; now readable — the extraction passed a secrets audit). A complete, unmodified design-source extraction of posepuppet at commit `99df0bc` (branch `bodyarcade-v2-base`): 1,484 files, with `DESIGN_SOURCE_GUIDE.md`, `STATUS_OF_EACH_MODE.md`, `SOURCE_MANIFEST.md`, `LICENSE_AND_ATTRIBUTION.md`, inventories, and full source under `source/`. **It predates the completed Dolphin/Rowing work** — treat it as a design archive, not the current state.

## 4.2 Branch map (name @ SHA — role)

| Branch | SHA | Role |
|---|---|---|
| `local/v2-base-mac-prep` | `60b034c` | Newest baseline (v2 prompt pack + final verification summary; Mac-local prep). Likely working base going forward — Track A confirms. |
| `bodyarcade-dolphin-fable` | `05b4801` | **Completed Dolphin ("Dolphin P4: ship").** Primary audit target. |
| `bodyarcade-rowing-fable-rebuilt` | `c8cdafa` | Completed Rowing (Gate-2 round 2: seated propulsion, steering authority, rowing HUD). |
| `bodyarcade-rowing-fable` | `5ce96fa` | Earlier rowing branch. |
| `bodyarcade-flight-fable` | `07ec2f5` | Completed Flight (TinySkies Track F — **written permission exists** to use/fork/adapt TinySkies/GlobeFly; permission is recorded in-repo per the prompt pack's instructions; Track A verifies `LICENSE_NOTES.md`). |
| `bodyarcade-v2-base` | `99df0bc` | v2 baseline (the extraction commit). |
| `bodyarcade-v4-base` | `493dd24` | **Unexamined.** Track A must diff it against v2-base and mac-prep and report what it is. |
| `main` | `940d31c` | "Merge Predictive Pose Continuity." |
| `ppc-complete` | `922077b` | Predictive Pose Continuity complete. |
| `feat/openworld`, `feat/world-data-v2`, `feat/walking-locomotion`, `feat/pose-runtime-hud`, `feat/character-control`, `feat/motion-memory-2`, `feat/recording-v2` | — | Feature lanes created by the V1–V8 prompt pack. Status unknown pending audit — see Addendum A.2 (the user reports V1–V8 have been run; do not assume in-progress or complete without repo evidence). |

Recorded as complete by the project's own records: shared Body-Input Protocol, Flight (TinySkies Track F), Predictive Pose Continuity, Rowing, Dolphin.

## 4.3 The completed Dolphin app (`apps/dolphin/` on `bodyarcade-dolphin-fable`) — inspected directly

Structure: `src/game/{sim.ts, world.ts, decor.ts, dolphinMesh.ts, camera.ts, game.ts}`, `src/input/swimControls.ts`, `src/ui/{hud.ts, minimap.ts}`, `tests/{dolphin.spec.ts, topology.spec.ts}`, Playwright config, `eval/dolphin-results.json`.

What its own README establishes:

- **`sim.ts`** — pure fixed-timestep **120 Hz** swim model; no RNG; **byte-identical replays (asserted in tests)**; all feel constants in one table. Containment is a signed-distance field from the boundary polygon: a soft current pushes back inside a **55 m band**; the absolute in-polygon guarantee is a slide, never a wall. Seabed depth = SDF + value noise. Impulse-and-glide propulsion (each detected body kick banks a surge with ~0.3 s attack; drag proportional to speed so every cadence settles at its own cruise; stillness is a long glide).

- **`swimControls.ts`** — BodySignal consumer (BroadcastChannel same-origin + postMessage relay, shape-guarded; raw landmarks never reach the app); **keyboard priority always works** (W/S dive/surface, A/D turn, Q/E depth, Shift kick, Space burst, 1/2/3 assist ladder); autopilot on tracking loss (level out, glide, slew-bounded blend back — never a snap); burst state machine; T-pose recenter. Body controls: chest/hip anti-phase wave = kick; forward/back lean = dive/surface; shoulder-line tilt = banked carve; crouch/stretch = depth trim; both-hands-forward = burst; sprint + hard pitch-up near surface = **breach** (ballistic leap, camera follows, splash on re-entry).

- **Assists:** Full (default — depth clamps, auto-level, shore-heading help, gentle drift so stillness never strands), Standard, Expert.

- **`world.ts` / `decor.ts` / `dolphinMesh.ts`** — the presentation pass, in the README's own words: "vertex-lit flat-shaded procedural meshes, exponential depth-tinted fog, instanced boid fish that flee, vertex-shader kelp sway, faked caustic shafts, additive motes, drowned ruins, shimmer-curtain boundary. **No textures, no imported assets.**" World boundary = the real San Francisco Bay outline from OSM via `@bodyarcade/world-data` (ODbL, credited in-app under the minimap).

- **Verification:** Playwright suite — synthetic swim-pump mapping/sign tests, impulse-glide coupling, an **8-direction containment battery** (never exits, never hard-walls), breach positive/negative, dropout→glide recovery, replay determinism across reloads, transport topology, fps/simHz recording. GPU runs currently assume `DISPLAY=:2` (the remote box) — must be re-pointed at local macOS.

## 4.4 The preserve / replace / re-point split (the heart of the Track A audit)

- **Preserve (systems and feel):** `sim.ts` in full (the feel-constant table, impulse-glide model, breach event, deterministic replay); `swimControls.ts` (BodySignal consumption, keyboard priority, autopilot, assists, T-pose recenter); camera behaviors worth keeping; the test harness pattern (containment battery, replay determinism, breach tests). Also preserve, from the wider repo: `@bodyarcade/body-input`, Predictive Pose Continuity, and Flight/Rowing systems as future donors (vehicle patterns, buoyancy, oar interaction, camera rigs).

- **Replace wholesale (presentation):** `world.ts`, `decor.ts`, `dolphinMesh.ts` — the entire procedural-mesh look. The dolphin mesh is replaced by the real rigged asset (Section 10).

- **Re-point (same mechanism, new data):** containment and seabed sampling move from the OSM SF-Bay polygon to the authored fictional region's shoreline mask and baked heightfield. The ODbL/OSM attribution obligation disappears with the data source.

- **Version note:** `apps/dolphin` is on Three.js **0.172**; jeantimex is on **0.184**. The new slice lives on jeantimex's version — **ported dolphin code follows the water, never the reverse.**

## 4.5 Where the new work lives

Build the vertical slice as a **fresh app in the monorepo** (working name `apps/shared-world/`), with jeantimex vendored pristine, and `sim.ts`/`swimControls.ts` ported in. `apps/dolphin` stays untouched as the reference implementation. (Default adopted in conversation; Track A may propose a better location with justification, not a different strategy.)

---

# 5. Water — the `jeantimex/threejs-water` plan

## 5.1 The resource, as analyzed

`github.com/jeantimex/threejs-water` — **MIT license**, TypeScript, Vite, plain Three.js (no React Three Fiber), Three.js **0.184**. Verified internals from the July 15 technical analysis (Track B re-verifies against current source):

- GPU wave simulation on a **256×256 height-field texture**, originally scoped to a bounded pool; ripple injection; moving-sphere and moving-box displacement; compound-object displacement.

- Surface-normal reconstruction; Fresnel reflection and refraction; distinct above-water and underwater materials; above/below transitions; Snell's window from beneath.

- **Dynamic caustics derived from the active simulation.**

- Floating-object buoyancy and drag (the demo ball's collision with the water is the user's reference for how the dolphin and boat should interact with the surface).

- A substantial per-frame pipeline: (1) object shadow/refraction textures → (2) dynamic caustics → (3) pool render → (4) water-surface render → (5) final composition.

- **The load-bearing architectural fact:** the water, caustics, and wall shaders **raycast/intersect against the pool's wall and floor geometry**. Changing the container shape means changing those intersection assumptions in the shaders. This is exactly where the one sanctioned adaptation happens: **pool walls → coastline walls; pool floor → seabed heightfield.**

## 5.2 The strategy (newest decision — supersedes older recommendations)

1. **Start from the demo itself, whole and essentially unchanged**, running locally. Checkpoint 1 is the user's rigged dolphin swimming in the *unmodified* demo pool (Section 13.2). This proves asset + rig + animations inside the exact water before any world exists.

2. **Adapt by minimal edits only**, preserving everything that makes the demo look the way it does: reflection, refraction, caustics, surface normals, displacement response, above/below-water behavior, interaction. The sanctioned edit class: replace the rectangular container with the authored region's coastline "walls" and seabed "floor"; enlarge the domain; clip/mask the surface wherever terrain rises above sea level.

3. **Investigate one bounded water system for the whole region first.** Do not assume a second renderer or a tiered system is necessary. The region is small and bounded (~2 km, Section 7), so the preferred starting assumption is one sufficiently large jeantimex-style system owning the entire water experience.

4. **Sanctioned within "one system":** a single surface and shader set whose *interactive simulation texture is windowed around the player* (detail follows the dolphin/boat) still counts as jeantimex owning the whole experience. This is an allowed answer, not the forbidden "second renderer."

5. **Keep the water calm.** Ecco does not need a storm-ocean simulator: large breathing sheets, clean rolling forms, occasional environmental swell, strong local response to the dolphin — not spectrally accurate open-ocean waves, complex foam fields, or high-frequency noise. Calm water also protects navigation readability and the art direction.

6. **One coherent lighting system.** Surface color, underwater fog, and caustics share the same stylized parameters (turquoise shallows → deep cyan/cobalt offshore; saturated depth-dependent blue-green absorption, never gray; caustics broad, bright, slightly slower and more graphic than physically perfect; reflections softened; refraction readable rather than optically extreme).

## 5.3 Track B's required questions (Section 15.2 has the full list)

Domain scaling limits of the 256² sim and quality at larger resolutions (512/1024) on the target Mac; exactly where pool geometry is assumed (enumerate every shader/uniform/mesh); how caustics project onto arbitrary terrain instead of pool walls; terrain masking at the waterline; wave continuity; dolphin/boat/shoreline interaction injection; breach and re-entry through the surface shader; half-submerged camera; performance; and a **fidelity test**: reproduce four canonical shots side-by-side against the stock demo at every water checkpoint — (a) the demo's above-water angle, (b) underwater looking down at caustics on the floor, (c) half-submerged at the waterline, (d) looking up at Snell's window.

## 5.4 Fallback ladder (documented, not the plan)

If one bounded system demonstrably cannot hold quality across the region: (i) windowed/player-following sim under one global surface (already sanctioned above); (ii) near/mid/far tiers where near = full jeantimex interaction, mid = simplified jeantimex-style waves, far = a low-cost matching horizon surface, with the explicit success test that every visible part of the ocean appears to belong to the same jeantimex system; (iii) selective port of `Water` + GPU heightmap + `CausticsPass` + above/below shaders into a custom container (the July 15 recommendation). Escalate only with evidence and user approval.

## 5.5 Adjacent water resources — status

- `martinRenou/threejs-caustics` — **BSD-3-Clause. Approved fallback** caustics approach (older codebase: global THREE, deprecated `.vertices`, single script, 512² sim — would need modernizing). Use only if jeantimex caustics can't be carried to terrain.

- `nemutas/caustics` — artistic reference / possible lightweight projected-caustics mode. **License must be verified before any code use.** Never stack unrelated caustic patterns simultaneously.

- `cortiz2894` stylized water — **no license found; do not copy code.** Visual reference only.

- `SeedOcean`, FFT/spectral oceans — not selected (Section 1.1).

---

# 6. Terrain, caves, and collision

## 6.1 Shared-terrain law

One world dataset drives rendered terrain, seabed, exposed land, collision, shorelines, water depth, placement rules, and all four movement modes (Section 2.1). Rendered geometry and collision must derive from the same source data — visible/collision mismatch is a defect.

## 6.2 Authoring policy: bake, don't generate at runtime

Major geography is fixed between visits (small ambient details — fish positions, school movement, debris, plant motion, lighting variation — may vary). Therefore: **author once, bake, load.** ProceduralTerrains and THREE.Terrain are *authoring tools* whose output (heightmap + biome/environment masks + shoreline mask + placement data) is committed to the repo; the runtime only loads baked data. This guarantees determinism and eliminates runtime-generation bugs as a class.

## 6.3 Tool roles

- **`ZyFou/ProceduralTerrains`** — primary authoring candidate: world-field generation, regional terrain authoring, height data, biome/environment metadata, terrain painting, mesh/heightmap export; possible sky/cloud support (evaluate).

- **`IceCreamYou/THREE.Terrain`** — terrain-algorithm toolbox: islands, plateaus, cliffs, canyons, trenches, smoothing, noise combination, heightmap processing, prop scattering.

- **`mesqme/infinite-terrain`** — reference only (not an architecture import): nearby-detail generation, chunk lifecycle, instanced grass/trees/stones, wind, interaction, Rapier integration — the visual bar for Walking-mode ground detail later. The bounded first world does **not** need infinite streaming; Track B identifies which techniques transfer without importing streaming architecture.

- **`three-mesh-bvh`** — fast local raycasts/queries against terrain and cave meshes.

## 6.4 Caves, arches, and overhangs

A heightfield cannot make enclosed caves, arches, ceilings, or overhangs — and true caves/overhangs are essential to the Ecco spatial grammar (framed cave mouths, short dark passages, arch and trench transitions). Plan of record, with a mandatory cost comparison in Track B:

1. Heightfield provides the broad terrain (seabed, coastline, shelves, hills, trench floors).

2. Volumetric formations come from **either** (a) a local 3D density/SDF field meshed with marching cubes or surface nets, **or** (b) authored/kitbashed modular cave and arch meshes placed into the terrain. **Track B must cost-compare these seriously.** For a small authored region, the modular route may be cheaper, more art-directable, and more Ecco-authentic (the game's caves were hand-modeled). Caveat on record: Three.js's built-in `MarchingCubes` example is metaball-oriented and blobby; if the SDF route wins, prefer surface nets / dual contouring or offline meshing (bake in Blender or a build step, export glTF).

3. Rapier collision for volumetric formations is generated from the same mesh data.

## 6.5 Collision

**Rapier** is the physics/collision system. Use Rapier's **native heightfield collider** for the base terrain (cheap, exact match to the baked heightmap); **trimesh colliders only for caves, arches, and placed structures**. The dolphin sim's soft-repulsion containment (Section 4.3) is retained and re-pointed at the authored shoreline mask.

---

# 7. The first region

- **Fictional**, bounded, dense, highly polished; designed for exploration (no missions/combat); enclosed by natural geography (cliffs, mountains, dense reef walls, enclosed coastlines, strong currents, deep hazardous areas, narrow caves, impassable formations) rather than obvious invisible walls.

- **Adopted scale defaults** (user-approved as defaults): region ≈ **2 km × 2 km**; max depth ≈ **80 m**; tallest peak ≈ **200 m**; **sea level = y 0**; units = meters. Dolphin cruise ≈ **5 m/s**, burst ≈ **9 m/s** → roughly 5–10 minutes across under normal traversal. Track B validates these against water-sim resolution and performance and may propose adjustments with reasons.

- **Terrain character:** a balanced mixture of gentle rolling terrain, reef shelves, sandy and rocky seabeds, coastlines, beaches, cliffs, sea arches, caves, overhangs, trenches, hills, and mountains. Transitions between environmental regions are gradual and nearly imperceptible — no visible game-biome borders.

- **Islands and coastlines:** larger islands, smaller islands, tiny islets, exposed rocks; coastlines mix sandy beaches, rocky shores, cliffs, coves, reefs, sea caves, arches. Exposed land is generally lush (trees, grass, shrubs, flowers) because Walking, Rowing, Flight, and the Dolphin breach view all depend on the above-water world.

- **Ruins and architecture:** moderately common, integrated into the landscape — ancient stone structures, recognizable human-style buildings, docks, towers, bridges, settlements, ambiguous structures, wrecks. No procedural destruction systems required: a structure placed at a slight natural tilt, with sand/rocks/plants/coral around it, reads as submerged or abandoned.

- **A useful compositional seed** (from the project's own research; adapt for sketches, exploration-only): a calm lagoon linked to a reef shelf, then a trench pocket, with one arch, one short cave, one current, and one optional discovery.

- **Region-layout approval gate:** before any terrain is built, produce **2–3 top-down sketch maps** of the region (island arrangement, reef shelf, trench, cave sites, landmark placement, boundary geography) for the user to pick from or redline.

- **Conditions fixed for the slice:** one time-of-day (bright tropical sun, matching the chosen shallow-reef reference frames); no day/night cycle; no weather.

## 7.1 Underwater visibility

Default visibility is **medium**: preserve the PS2-Ecco-like haze; keep navigation readable; let large terrain forms emerge gradually from the fog; never expose the whole world at once. Visibility varies with depth, environmental region, reef density, caves, trenches, and water clarity. The fog is always colored water, never neutral gray, and pop-in happens inside the color field.

---

# 8. Vegetation and environmental assets

## 8.1 SeedThree — offline baking policy

SeedThree (`github.com/SkyeShark/SeedThree`, MIT per prior notes — Track C verifies) is the approved vegetation generator: trees, branching vegetation, grass support, wind, LOD, instancing, billboard/impostor strategies, and potentially branching coral after deliberate retuning. **Known conflict:** SeedThree is WebGPU-first while the build baseline is WebGL2. **Resolution (user-approved):** use SeedThree as an *offline authoring tool* — generate vegetation in it, bake to glTF, instance at runtime with a small vertex-sway shader (wind above water, current below). This keeps the generator and removes the renderer conflict. If SeedThree's implementation costs prove too high, an alternative generator may be selected (Track C lists 1–2 alternatives with cost estimates); in the meantime, vegetation is represented by rectangular placeholder blocks. Approval of SeedThree does not authorize inventing unrelated procedural models.

## 8.2 Asset philosophy

Hybrid: existing assets are the foundation, curated carefully; approved assets may be modified in Blender; custom assets are created only when they define the project's identity or nothing suitable exists; prefer assets that **visually match PS2 Ecco** over technically superior but visually inappropriate alternatives.

## 8.3 Categories the Track-C manifest must cover

Rocks and reef formations; plate coral; soft coral; anemones; sponges; kelp; seagrass; trees; shrubs; flowers; grass and ground vegetation; ruins; buildings; docks; wrecks; shoreline props; licensed terrain and ground textures; fish; larger marine wildlife; bubbles; marine snow; suspended sediment; sand disturbance; light shafts; audio (Section 14). **Fish:** the user will provide approximately three models initially and add more later; they are **not yet chosen** — placeholder blocks until supplied.

---

# 9. Strict content-generation policy

## 9.1 The implementation model may

Use approved repositories and generators; load approved or user-provided models; use SeedThree, ProceduralTerrains, THREE.Terrain, marching cubes / surface nets, Rapier, and other explicitly approved systems; adjust shaders and code from approved resources to meet the specification (for jeantimex, only within the minimal-edit rule of Section 3.3); recolor, resize, retexture, retopologize, rig, animate, combine, or otherwise modify approved models; instance and procedurally place approved assets; create terrain and cave geometry through approved world-generation methods; create debug geometry and placeholder blocks.

## 9.2 The implementation model may not

Invent a substitute asset because the proper asset has not been introduced. It must not spontaneously generate its own dolphin, fish, robot, animal, building, ruin, rock model, coral model, kelp model, ground texture, terrain texture, decorative prop, character, or vehicle. It must not silently replace an approved demo or model with a generic approximation.

## 9.3 Placeholder rule (simplified per the user)

Every missing asset is a **simple rectangular block or primitive** at the intended position, scale, orientation, approximate footprint, and density — color-coded by category (coral, kelp, fish-school volume, rock, ruin, building, tree, wreck, large animal, …), optionally labeled in development mode, visually obvious as a placeholder, and present in the live demo so the user can judge composition and scale. The placeholder marks where the future asset belongs; it is never permission to generate a fake final asset. The user supplies real assets over time; **agents purchase nothing.**

---

# 10. The dolphin asset (the one asset in hand)

## 10.1 Files on the user's machine

Path: `/Users/lekan/Downloads/dolphin-models`

```text
.
├── dolphin-fbx.glb            ← GLB (naming suggests converted from FBX; likely the
│                                 Sketchfab auto-conversion — verify rig + animations embedded)
├── dolphin-glb.zip            ← archive of the folder below
└── dolphin-glb
    ├── source
    │   └── Dolphin.fbx        ← original FBX: archival + Blender editing source
    └── textures
        ├── T_Dolphin_BaseColor.png
        ├── T_Dolphin_MetallicSmoothness.png
        ├── T_Dolphin_Normal.png
        └── T_Dolphin_Occlusion.png
```

## 10.2 Provenance and listing claims (to be audited, not assumed)

"**Realistic Dolphin | Rigged with 25+ Animations**" by **GAMICO** — Sketchfab creator page `sketchfab.com/gamico` (a Unity developer/3D artist whose "Realistic *Animal* | Rigged with 25+ Animations" series is confirmed on Sketchfab — rhino, crocodile — following the same free-download-plus-Fab-marketplace pattern). **The exact dolphin listing URL should be pasted into this section by the user or pinned by Track C.** Listing claims: ≈4.3k triangles, ≈2.4k vertices, rigged, 25+ animations, intended for real-time use, Creative Commons **Attribution** license.

## 10.3 Audit checklist (Track C's first and blocking task — checkpoint 1 depends on this asset)

- Exact license text and the required attribution wording; where attribution will live (in-app credits panel + a repo `CREDITS.md`).

- Whether the free files contain the **full rig and all animations**; whether `dolphin-fbx.glb` embeds the clips (Sketchfab auto-conversions usually do — verify) or whether clips must be exported from `Dolphin.fbx` via Blender.

- The exact animation clip list, names, lengths, and quality.

- Texture conversion: the set is Unity-convention; `T_Dolphin_MetallicSmoothness` packs smoothness in the alpha channel, while glTF expects metallic-roughness (roughness = 1 − smoothness). If the GLB is the Sketchfab auto-conversion this is likely already handled — verify channels visually under the jeantimex water.

- Material/skin suitability under jeantimex lighting (spec response, normal strength).

- Gap analysis against the needed set: cruise swim, fast swim, banking left/right, braking, breach/leap, airborne, re-entry, idle/hover, surface breathing, collision/flinch — and whether Blender animation work is required for gaps.

- Scale, orientation, forward axis, origin; polygon and texture budgets confirmed.

- Repo drop path (e.g., `apps/shared-world/public/models/dolphin/`) with license file alongside.

---

# 11. Gameplay scope

## 11.1 The first build is pure exploration

Not in the slice: missions, enemies, combat, collectibles, oxygen pressure, puzzles, progression, story, a complete HUD — and **sonar is out of the slice entirely** (at most a cosmetic ping later; the full system is designed in a later phase). The slice exists to prove: the shared world; the PS2 Ecco visual direction; the water; continuous land/seabed terrain; Dolphin movement and camera; breach and re-entry; environmental density; caves and overhangs; mode continuity; asset placement; performance.

## 11.2 Preserved gameplay feel

The completed sim's feel is a *keep*: impulse-and-glide propulsion (kick banks a surge, drag settles each cadence at its own cruise, stillness is a long glide), the assist ladder, autopilot on tracking loss, soft-repulsion containment, the breach event, deterministic replays. These carry into the new slice via the port, re-tuned only where the new world scale requires it (feel constants live in one table by design).

## 11.3 The Ecco content program (gathered now, implemented later)

The project's research reconstructed the source game's grammar; the slice does not implement it, but Stage 2 keeps collecting what it needs. Digest of recorded stances: movement is pulse-and-glide (already aligned with the sim); **sonar is the master verb** (communicate / reveal / echolocation-map) — future; the five-powers/songs system — future; **air/oxygen**: keep the surfacing rhythm's mood without micromanagement (generous timers or situational-only pressure) — later; **predators** as route-changers and territory, not combat targets — later; combat stays minimal; ecology (fish, currents, creature behaviors) is puzzle grammar; levels are landmark-choreographed continuous spaces gated by geography rather than menus; the guiding principle is **"keep the mood, remove the frustrations"** — and the PS2 port's own additions (compass, next-objective aid, camera correction) are recorded as native-to-target HUD inspiration for later.

## 11.4 Interface language principles (for later phases)

Diegetic-first: sonar as expanding rings, objectives as glowing objects, direction as a landmark rather than an arrow, the depth-palette itself as the depth readout. Screen edges are reserved for what genuinely cannot be diegetic: body-input calibration state, tracking confidence, seated/standing mode. One type family, two weights, three sizes. The source game's near-empty HUD is the bar.

---

# 12. Modes beyond Dolphin; platform and local-only development

## 12.1 Mode rollout and reuse

Rowing, Walking, and Flight cameras/controllers arrive over the **same region** only after the shared environment is convincing (final checkpoint band). Donors identified: the rowing branches (seated propulsion, steering authority, oar-water interaction, boat vehicle), the flight branch (plane/camera/altitude systems), `feat/walking-locomotion`. Rowing's oar strikes should disturb the jeantimex surface exactly the way the demo's objects do. One style everywhere; TinySkies-as-standalone is out of scope (Section 1.1).

## 12.2 Platform, performance, local-only

- Target machine: **M5-class MacBook Pro**, desktop **Chrome**. Renderer: **Three.js on WebGL2** (WebGPU is research-only and must not complicate the slice or force replacing the selected WebGL2 resources). Baseline Three.js **0.184** (jeantimex's version).

- Performance target: **sustained 60 fps at ≈1728×1080 render resolution** (not native retina); dynamic resolution allowed. Degradation order: reduce secondary density and effects **before** touching the defining features — water presentation, fog, dolphin animation, camera, terrain silhouettes, breach view. Reserve CPU/GPU headroom for pose tracking even in keyboard-driven demos, since production play shares the machine with the tracker.

- **Local-only development:** all development, builds, live demos, and verification (Playwright, screenshots, fps assertions) run on the user's Mac. The remote-machine assumptions (`DISPLAY=:2` GPU lanes, remote worktrees/tmux) are retired; Track A plans the migration. No cloud dependencies at runtime.

---

# 13. Process: checkpoints and review gates

## 13.1 Review policy

The project advances in small, visible steps. Every meaningful stage produces a **working live demo** for review; the user can stop, redirect, or approve before the next major stage. Do not undertake another large visual change without review. This **supersedes** the old prompt pack's autonomous no-gate policy for this effort. Approved visuals are never changed without permission.

## 13.2 Checkpoint ladder (revised in this conversation)

0. Track A audit complete; scaffold `apps/shared-world/` on Three.js 0.184; vendor jeantimex pristine; run the stock demo locally, unchanged.

1. **The dolphin in the pool:** the GAMICO dolphin swimming in the unmodified jeantimex demo pool, driven by the ported `sim.ts` + keyboard `swimControls`, animations playing, demo water interaction intact. (This is the user-specified starting point.)

2. Camera work in the pool: above/below transitions and half-submerged behavior with the dolphin.

3. **Region-layout gate:** 2–3 top-down sketch maps of the fictional region; the user picks or redlines one.

4. Pool → bounded region: enlarge the water domain; rectangular walls/floor become the authored coastline walls + seabed heightfield (the canonical minimal edit); run the four-shot fidelity comparison against the stock demo.

5. One continuous terrain crossing the waterline — islands emerge; shoreline masking verified from above and below the surface.

6. Breach, airborne framing, re-entry over the real region — the mode-continuity proof (horizon, islands, forests, cliffs, ruins visible; clean camera through the surface both ways).

7. Color-coded placeholder blocks for every asset category, placed per the approved layout.

8. **Ecco atmosphere pass A** (the first approved tweak layer): fog curve, palette, visibility per Track D's estimates — underwater only; the surface stays pure jeantimex.

9. Caves and overhangs via the method Track B selected.

10. Vegetation: baked SeedThree (or the approved alternative) replaces vegetation placeholders.

11. Fish and ambient life motion (user-provided models when available; placeholders until then).

12. Ruins and architecture assets replace their placeholders as the user supplies them.

13. Minimal audio pass (Section 14).

14. Rowing, Walking, and Flight views over the same region.

At **every** checkpoint: a live local demo; a summary of what changed; the placeholder inventory; a performance report (fps, render resolution, frame-budget breakdown); a list of deviations from the selected reference; then **wait for review**.

## 13.3 Definition of done for the slice

Swim a full loop of the region in roughly 5–10 minutes; breach at three or more sightline spots and see islands/terrain each time; pass through at least one cave and one arch; placeholders present for every category; the four-shot water fidelity test passes; 60 fps sustained per Section 12.2.

---

# 14. Audio

**Slice scope (minimal pass, checkpoint 13):** one above-water ambient loop, one underwater ambient loop, a breach splash, surface breathing, and a low-pass muffle transition at the waterline — via plain WebAudio / `THREE.PositionalAudio`. FMOD/Wwise are **not** used now (licensed middleware, heavy for web).

**Later strategy (from the user's audio planning doc, folded here):** pre-generate a large sound library during development with AI tools — ElevenLabs for voices, narration, creature vocalizations, and cinematic audio; loop/ambience generators for biome beds — organized by biome (reef, kelp, cave, abyss, vents, wrecks); at runtime, positional audio with biome blending driven by depth, terrain type, nearby objects, and game state; many randomized variations so wildlife never repeats exactly. **Runtime never generates audio.** Track C includes an audio mini-manifest: license-checked candidate sources (e.g., Freesound/Sonniss) plus an ElevenLabs generation list for the slice set.

---

# 15. Stage-2 research program — what the four prompts must produce

The next thread writes **four extremely detailed, self-contained research prompts**, one per track. Each prompt must embed the context its research session needs (the sessions will not automatically have this document unless it is attached — attach it, and still make each prompt stand alone).

## 15.0 Global rules for every track

- Pin everything: exact URLs, repository branches and commit SHAs, file paths, license names with links to the license text. The pins in Section 4.2 are the repository ground truth.

- Verify licenses at the primary source; never assume. Flag anything unlicensed as **reference-only, no code/asset copying**.

- **No substitution.** The selected resources (jeantimex, ProceduralTerrains, THREE.Terrain, Rapier, three-mesh-bvh, SeedThree-as-baker, the GAMICO dolphin) are the plan; research evaluates *how*, not *whether*, unless it finds a disqualifying fact (license failure, abandonment, technical impossibility) — in which case it reports the fact and proposes alternatives clearly labeled as proposals.

- Mark every estimated value as an estimate; separate measured facts from inference.

- Treat the existing research corpus (Section 16) as **finished work** — build on it, cite it, do not re-do it.

- Constraints that appear in every track: Three.js 0.184, WebGL2, desktop Chrome, M5 MacBook Pro local-only, 60 fps @ ≈1728×1080, single style, PS2 Ecco target, jeantimex fidelity hierarchy (Section 3.3), strict content-generation policy (Section 9), checkpoint process (Section 13).

- Output format: markdown with tables; explicit "answered / open / needs-user" separation at the end of each report; no re-asking of questions this document answers.

- End state: the four reports together make the Stage-3 implementation prompt **deterministic** — able to say "use this exact resource, these exact files, these exact parameters, this exact placement rule, build only this checkpoint, show a demo, stop."

## 15.1 Track A — Repository and systems audit

**Objective:** a complete map of what exists, what is preserved, what is replaced, what is re-pointed, and exactly how the new `apps/shared-world` slice plugs in.

**Inputs:** `github.com/lekandigital/posepuppet` at the branch/SHA table in Section 4.2 (primary: `bodyarcade-dolphin-fable @ 05b4801`, `local/v2-base-mac-prep @ 60b034c`); `github.com/lekandigital/bodyarcade-current-design-source` (archive); the root docs (`ARCHITECTURE.md`, `BODYARCADE_CONTEXT.md`, `DECISIONS.md`, `PLAN.md`, `FUTURES.md`, `STUDY_NOTES.md`, `CLAUDE.md`).

**Tasks:** exhaustive audit of `apps/dolphin/` (every module; the feel-constant table's contents; the containment/seabed sampling API surface; BodySignal message shapes and the BroadcastChannel/postMessage topology and same-origin constraint; camera states; HUD/minimap; the Playwright harness and every asserted behavior); audit of the rowing branches (seated propulsion, steering, oar-water interaction, HUD) and the flight branch (vehicle, camera rig, altitude, TinySkies permission record in `LICENSE_NOTES.md`) as donors; diff `bodyarcade-v2-base` vs `bodyarcade-v4-base` vs `local/v2-base-mac-prep` and report what v4-base is; document `@bodyarcade/body-input` (API, versioning, capability negotiation) and Predictive Pose Continuity as consumed dependencies; map monorepo build tooling (workspace layout, Vite configs, ports, how apps are served same-origin); plan the local-macOS verification migration (everything that assumes `DISPLAY=:2`/remote GPU, and its replacement); the Three.js 0.172 → 0.184 port surface for `sim.ts` + `swimControls.ts` (expected: minimal, since sim is render-free — verify); identify every feel constant likely to need re-tuning at the new 2 km world scale (e.g., the 55 m containment band).

**Deliverables:** architecture map; per-file preserve/replace/re-point manifest; the port plan; the `apps/shared-world` integration contract (where it lives, how it is served, how body-input reaches it); test-migration plan; a findings list of anything undocumented or surprising.

## 15.2 Track B — Water, terrain, and caves technical plan

**Objective:** a concrete, evidence-backed design for jeantimex-across-the-bounded-region, the terrain baking pipeline, the cave method decision, and the collision plan — with performance numbers for the target Mac.

**Water tasks:** read `jeantimex/threejs-water` source in full and enumerate **every place the pool geometry is assumed** (wall/floor intersection functions in the water, caustics, and wall shaders; container meshes; sim-domain-to-world mapping; above/below composition; object-displacement inputs); design the minimal-edit adaptation — pool walls → coastline walls, pool floor → seabed heightfield — specifying which shaders/uniforms change and which stay byte-identical; investigate **one bounded system first** (sim texture resolution options 256/512/1024 and their look and cost at ≈2 km; the sanctioned windowed/player-following sim under one surface; where and how terrain clips/masks the surface above sea level; wave continuity); caustics onto arbitrary terrain instead of pool walls; dolphin/boat/shoreline interaction injection (the demo-ball pattern generalized); breach and re-entry through the surface shader; half-submerged camera handling; the four-shot fidelity test procedure (Section 5.3); the fallback ladder in implementable detail (Section 5.4); performance model per pipeline stage on Apple-Silicon WebGL2. Do **not** assume a second renderer.

**Terrain tasks:** evaluate ProceduralTerrains and THREE.Terrain as *authoring tools* (capabilities, export formats, maintenance status, license); define the baked-data schema (heightmap resolution for 2 km at target detail; shoreline mask derivation from `terrainHeight ≥ seaLevel`; biome/placement masks; placement JSON); the runtime loader; terrain material approach consistent with Track D; LOD strategy; which `mesqme/infinite-terrain` techniques transfer to a bounded world without importing streaming architecture.

**Caves tasks:** the mandated cost comparison — authored/kitbashed modular cave-and-arch meshes vs local SDF/density field + meshing (surface nets / dual contouring preferred over the metaball-oriented built-in `MarchingCubes`; offline meshing in Blender or a build step is allowed) — decided against art-directability, Ecco-authenticity, collision generation, and cost; a single recommended method.

**Collision tasks:** Rapier heightfield collider for base terrain; trimesh for caves/arches/structures; `three-mesh-bvh` usage for fast queries; the single-source-of-truth data flow from baked terrain to render + collision + containment.

**Also deliver:** the coordinate/units contract (meters, y-up, sea level = y 0, region origin), per-subsystem frame-budget allocations, and validated (or revised, with reasons) scale defaults from Section 7.

## 15.3 Track C — Asset and audio manifest

**Objective:** everything needed to replace every placeholder, license-verified, with nothing purchased.

**First and blocking:** the dolphin audit per Section 10.3 (checkpoint 1 depends on it), including pinning the exact Sketchfab listing URL and license text and writing the attribution string.

**Then:** for every category in Section 8.3, concrete candidates — each with preview link, source URL, creator, license (verified), attribution requirement, cost (free preferred; paid clearly labeled, never purchased by agents), file format, polygon count, texture resolution, rig/animation status, Three.js/WebGL2 compatibility, required Blender work, LOD needs, PS2-Ecco visual fit, and a recommendation — plus **1–2 fallbacks for every critical asset**. Evaluate SeedThree for the offline bake (WebGL2-irrelevant since output is glTF; effort estimate) and list 1–2 alternative vegetation generators with costs. Licensed terrain/ground texture sources. The audio mini-manifest (Section 14). Pipeline standards: glTF 2.0 delivery, texture budgets, naming conventions, repo drop paths, the `CREDITS.md` + in-app credits format.

## 15.4 Track D — PS2 visual specification + capture instruction sheet

**Objective 1 — the measurable spec:** translate the PS2 *Defender of the Future* look into Three.js-ready parameters, every value labeled measured or estimated: per-zone palettes as hex ramps; fog color and density by depth (exponential-fog targets) and by region; visibility distances; caustic character **at PS2 intensity** (toned relative to Dreamcast, still present); lighting model (broad overhead surface light, pale caustic streaks, low-frequency bounce, local glows in dark zones — no modern pin-point speculars); texture treatment (soft, low-frequency, broad value grouping); particle types and densities (marine snow, motes, bubbles); wildlife density per depth band; camera metrics (follow distance, FOV, lag, collision behavior); composition and landmark grammar; breach and above-water presentation (sky, water surface from above, shoreline reads); the depth-stratification banding. **Source discipline:** PS2 footage is primary; Dreamcast material is secondary and only for layout/geometry; flag emulator-upscaled or filtered sources; the fog is never neutral gray. **Do not re-research design archaeology** — the existing reports own story, levels, mechanics, and platform history; this track is visual measurement only.

**Objective 2 — the capture instruction sheet (user-facing):** a step-by-step guide so the user can later replace estimates with measured values: PCSX2 settings that don't lie (software renderer or native-resolution hardware; no upscaling, no texture filtering overrides, no widescreen hacks; original 4:3); where to capture (a frame grid across depth bands × regions × look-directions: toward light, away, along terrain, into open water, at the surface from below, above water); save-point suggestions; file naming; k-means palette extraction; deriving the absorption/visibility curves; and exactly how each estimate in Objective 1 gets replaced by a measurement.

## 15.5 Already settled — do not re-open in research

PS2 over Dreamcast; one style; one shared world (Section 2.1 verbatim); jeantimex with the fidelity hierarchy and minimal-edit rule; dolphin-in-the-pool as checkpoint 1; the GAMICO dolphin as the character; bake-don't-generate terrain; fictional bounded ~2 km first region; exploration-only slice; sonar out of slice; oxygen/predators/combat deferred with stances recorded (Section 11.3); placeholder rectangles for all missing assets; no purchases; SeedThree as offline baker with permission to swap; Rapier; local-only Mac development; WebGL2/Three.js 0.184; 60 fps target; checkpoint review gates; the strict content-generation policy; keyboard fallback as standing policy; single-player.

---

# 16. Source-document inventory and attachment guide

Status key: **LIVE** = active authority; **ARCHIVE** = evidence/reference, outdated recommendations not active; **SUPERSEDED** = absorbed by this document.

| File | What it is | Status | Attach to prompt-writing thread? |
|---|---|---|---|
| **This document** | Master context and decision record | LIVE | **Yes — primary; designed to suffice alone** |
| `deep-research-report__6_.md` | Visual Identity Art Bible (per-world palettes, lighting, HUD, source map; Dreamcast-oriented — re-label for PS2) | ARCHIVE (evidence for Track D) | Yes |
| `compass_artifact_wf-1c3201e8…` | Art & Rendering Bible (platform deltas incl. the PS2 caustics/dither facts; recreation cheat-sheet) | ARCHIVE (evidence for Track D) | Yes |
| `deep-research-report__3_.md` | Complete design study (world/levels/mechanics/interface; DC-vs-PS2 comparison tables) | ARCHIVE (content program) | Yes |
| `deep-research-report__5_.md` | Design archaeology (systems, powers, level grammar) | ARCHIVE (content program) | Yes |
| `compass_artifact_wf-d275e044…` (+ its `__1_` duplicate) | Design-archaeology art bible companion | ARCHIVE (content program) | One copy |
| `Complete_Design_Reconstruction_of_…DOTF.docx` | Long-form design reconstruction | ARCHIVE (content program) | Yes |
| `deep-research-report__4_.md` | The 30 implementation-gate answers (movement, camera, world openness, caves, oxygen, combat, region pattern, minimum asset kit) | ARCHIVE (digested in §11.3/§15.5) | Yes — small and dense |
| `ChatGPT-Ocean_Floor_in_Three_js__2_.md` | The July-15 resource/technical analysis: jeantimex internals, martinRenou/nemutas/cortiz licensing, terrain repo survey, the extraction prompts. **Supersedes the other two exports (same conversation, earlier snapshots).** Its "port-selectively/patch-first" recommendations are the fallback ladder, not the plan. | ARCHIVE (evidence for Track B) | Yes |
| `ChatGPT-Ocean_Floor_in_Three_js.md`, `…__1_.md` | Earlier snapshots of the same conversation | SUPERSEDED | No |
| `ChatGPT-Cave_Generation_GitHub_Query.md` | Cave-resource survey + the calm-water / one-lighting-system conclusions | ARCHIVE (evidence for Track B) | Yes |
| `BODYARCADE_DESIGN_PLAN_V2.md` | v2 design plan: capture protocol (Part 2 — adapt to PS2/PCSX2), Style-Bible skeleton (Part 3), density-field/landmark authorship ideas (Part 4), interface language (Part 7). Its layered L0–L11 stack and milestones use superseded selections (SeedOcean, Dreamcast-first, WebGPU leanings). | ARCHIVE (method source for Track D; ideas bank) | Yes |
| `BodyArcade_Shared_World_Combined__1_.md` | Combined shared-world archive: per-mode asset lists, resource notes, globe/arcade future stages | ARCHIVE | Yes |
| `Archiving_BodyArcade_Design_Source.md` | The extraction instructions + final extraction report (provenance of the design-source repo) | ARCHIVE | Optional |
| `_combined.txt` (Fable-launch bundle) | Prompt-pack history proving which systems are complete; predates the Ecco/jeantimex direction (see Addendum A.3 for the corrected description and renaming rule) | ARCHIVE | Optional (completed-systems history only; must carry the Addendum A.1 rule) |
| `document.md` (ElevenLabs audio) | Audio strategy | SUPERSEDED (folded into §14) | No |
| "BodyArcade Shared-World Discovery Context" (the pasted draft) | The v2 context draft this document replaces | SUPERSEDED | **No — attaching it invites authority confusion** |

**Per-track reference packs (when the four research prompts are actually run):** Track A → this doc only (the repos are the source), plus the renamed Fable prompt pack with the Addendum A.1 rule prepended. Track B → this doc + `Ocean_Floor__2_` + `Cave_Generation`. Track C → this doc (+ `Combined` for the per-mode asset lists). Track D → this doc + `deep-research-report__6_` + `compass_1c3201e8` + `BODYARCADE_DESIGN_PLAN_V2` (Parts 2–3) + reports `__3_`/`__5_` for zone identity.

**Missing attachments the user should add:** (1) the exact Sketchfab URL of the GAMICO dolphin listing (paste into §10.2 / hand to Track C); (2) optionally, links to 1–2 preferred PS2 longplays if the user has favorites, so Track D anchors on footage the user considers representative. Nothing else is needed — the dolphin files are already inventoried in §10.1.

---

# 17. Open items and risks (tracked, not blocking)

- **PS2 caustics tension.** The PS2 port tones down caustics while jeantimex was chosen partly for its caustics. Resolved procedurally by the fidelity hierarchy (§3.3: jeantimex untouched until deliberate, approved tweaks; Track D specifies the PS2-accurate intensity for atmosphere pass A). Keep visible as a tuning decision for checkpoint 8.

- **One bounded water system at ~2 km is unproven.** Insurance: the sanctioned windowed-sim design and the fallback ladder (§5.4). Track B must produce numbers, not vibes.

- **The GLB may not carry the full rig/animations** (free downloads sometimes differ from listings). Track C audits first; `Dolphin.fbx` + Blender is the recovery path.

- **Unverified licenses:** the dolphin (CC-BY assumed), SeedThree (MIT per prior notes), ProceduralTerrains, THREE.Terrain, nemutas/caustics (unknown), mesqme (reference-only regardless). Tracks B/C verify all at the source.

- **`bodyarcade-v4-base` contents unknown.** Track A diffs and reports.

- **Scale re-tuning expected:** the sim's feel constants (e.g., the 55 m containment band) were tuned for a bay-scale world; the 2 km region will need re-tuning — by design, all constants live in one table.

- **Three.js 0.172 → 0.184 port surface** for `sim.ts`/`swimControls.ts` — expected minimal (the sim is render-free); Track A confirms.

- **User-side actions on the horizon:** pick a region sketch (checkpoint 3); supply fish and other assets over time; paste the dolphin listing URL; optionally run the PCSX2 capture using Track D's sheet.

---

# Addendum A (2026-07-16): V1–V8 prompt-pack status, audit-first rule, attachment routing

Newest decisions, added after the v3 body was written. Where this addendum conflicts with the body, this addendum governs (Section 1, rule 1).

## A.1 The V1–V8 prompt pack has already been run: audit before continuing

The Fable-launch prompt pack (prompts V1 through V8) has already been executed. It is historical planning context only. Its internal status table is a snapshot from before execution and must never be treated as current.

Binding rule, in the user's words. Embed this paragraph verbatim in the Track A research prompt, carry it into the Stage-3 implementation prompt, and paste it above the prompt pack in any message that attaches the pack:

> "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

Anchors for that rule: the repository ground truth is the branch/SHA table in Section 4.2. If no separate result files are attached, "the attached results" means the in-repo verification artifacts, such as the final verification summary committed on `local/v2-base-mac-prep @ 60b034c` and the Playwright eval outputs in `apps/dolphin/eval/`.

Routing: the prompt-writing thread does not need the pack itself; it needs only this rule, which it now has. The Track A research session is the natural recipient of the pack, as evidence for mapping each prompt to its actual outcome. Two policies survive the audit regardless of what it finds: the pack's Global Context v2 autonomy policy stays retired (§1.1, §13.1), and its remote-machine `DISPLAY=:2` conventions stay retired (§12.2).

## A.2 What V1–V8 are, and the likely branch correspondence

Pack identities (from the bundle itself): V1 shared PosePuppet Runtime + HUD; V2 Open-Data World Pipeline; V3 Walking Locomotion (two-stage: gait package, then world integration); V4 BodyArcade Open World (compact region, three style profiles); V5 Character Control (capability manifest replacing AutoRig); V6 Motion Memory 2; V7 Recording v2; V8 Public Narrative. The pack renumbered these from an older P-series; the old P1/P2/P3/P5/P9 (body-input, Flight, PPC, Rowing, standalone Dolphin) were already complete when the pack was written.

Likely branch correspondence, to be verified by Track A, never assumed: V1 → `feat/pose-runtime-hud`; V2 → `feat/world-data-v2`; V3 → `feat/walking-locomotion`; V4 → `feat/openworld`; V5 → `feat/character-control`; V6 → `feat/motion-memory-2`; V7 → `feat/recording-v2`; V8 → likely docs/content with no dedicated branch. Note that V4's "three style profiles" deliverable is itself superseded by the one-style decision (§1.1, §3.5): even a fully completed V4 world build is presentation-superseded, though its pipeline and region machinery may be reusable. The audit should say so explicitly rather than marking V4 simply "complete."

New Track A deliverable (supplements Section 15.1): a per-prompt outcome table for V1 through V8 with columns: prompt; branch/commit evidence; verdict (completed / partial / unresolved); what remains, if anything; whether the remaining gap is still wanted under the current plan or is itself superseded. Gaps feed Track A's findings list. Nothing verified working is rebuilt without a specific, documented defect.

## A.3 Filename disambiguation (a real collision has already happened)

Two different files have circulated under the name `_combined.txt`:

1. The Fable-launch bundle: the V1–V8 prompt pack, wave plans, status table, worktree/display tables, and Global Context v2. Contains zero jeantimex mentions. Correction to the §16 row: it does mention Ecco a handful of times, but only as loose inspiration for an original dolphin mode ("inspired by Ecco the Dolphin: Defender of the Future, but as an original BodyArcade mode") built inside real OSM water boundaries. The strict-recreation pivot, the PS2 target, and the entire jeantimex direction postdate it.

2. The July 2026 planning-conversation export that produced this document.

In the most recent upload set, both were attached under the same name and collided. Rename both before attaching anywhere; suggested names: `fable-prompt-pack-v1-v8.txt` and `planning-conversation-2026-07.txt`.

Neither file is a decision authority; this document supersedes both for decisions. Do not attach the planning-conversation export to the prompt-writing thread: it contains superseded intermediate statements at ambiguous authority, and this document is its distillation.

## A.4 Operative attachment list for the prompt-writing thread

Attach:

- This document (primary; designed to suffice alone).
- `deep-research-report__6_.md` and `compass_artifact_wf-1c3201e8-5e7f-5406-9312-0f51fd19b30d_text_markdown.md` (Track D visual evidence).
- `deep-research-report__3_.md`, `deep-research-report__4_.md`, `deep-research-report__5_.md`, one copy of `compass_artifact_wf-d275e044-3b4c-5150-bafa-09024678c5e9_text_markdown.md`, and `Complete_Design_Reconstruction_of_Ecco_the_Dolphin_Defender_of_the_Future.docx` (Ecco content program).
- `ChatGPT-Ocean_Floor_in_Three_js__2_.md` and `ChatGPT-Cave_Generation_GitHub_Query.md` (Track B technical evidence).
- `BODYARCADE_DESIGN_PLAN_V2.md` (Track D method source) and `BodyArcade_Shared_World_Combined__1_.md` (asset-list archive).

Optional:

- `Archiving_BodyArcade_Design_Source.md` (extraction provenance).
- The Fable prompt pack, renamed per A.3, with the A.1 paragraph pasted above it (completed-systems history; primarily useful later, for the Track A session itself).

Do not attach:

- The two earlier `ChatGPT-Ocean_Floor_in_Three_js` exports (superseded snapshots of the `__2_` conversation).
- The duplicate copy of `compass_artifact_wf-d275e044…__1_.md`.
- `document.md` (ElevenLabs audio; folded into §14).
- The planning-conversation export (A.3).
- The original "Discovery Context" draft (superseded).

## A.5 Still outstanding from the user

1. The exact Sketchfab listing URL for the GAMICO dolphin (paste into §10.2 or hand to Track C).
2. Optional: one or two preferred PS2 longplay links so Track D anchors on footage the user considers representative.

*End of document (v3 + Addendum A).*
