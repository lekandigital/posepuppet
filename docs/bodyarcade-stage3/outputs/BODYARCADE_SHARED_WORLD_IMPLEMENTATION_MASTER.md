# BodyArcade Shared-World — Implementation Master

**Stage 3 deliverable 1.** Consolidated, deterministic implementation specification synthesizing the five Stage-2 research reports (Tracks A–E), the governing decision record, and the verified repository state. Generated 2026-07-17 from the checksum-verified input package at `docs/bodyarcade-stage3/inputs/` (all 17 SHA-256 sums verified OK).

This document governs the checkpoint prompt sequence `CHECKPOINT_00 … CHECKPOINT_14C` (see `CHECKPOINT_INDEX.md` in this directory). Every implementable value herein carries a source label. Nothing here authorizes skipping a user review gate.

> **Post-CP05 amendment (2026-07-18) — newer governing context.** After Checkpoint 05 was approved, the user recorded the decision document
> `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (the "post-CP05 addendum"). Where that addendum conflicts with this master or an older checkpoint prompt, **the addendum wins**, and it is required reading before CP05A and every later checkpoint. Its effects, reflected in §9 and the individual prompt files:
>
> 1. **Checkpoint 05 stands approved as the technical terrain foundation** (loading, chunked LOD, skirts/crack control, culling, shoreline integration, shared height authority, camera collision, dolphin contact, water integration) — but **not** as the final terrain geology or final terrain material appearance (addendum §2.2). The approved region water system is **kept**, not replaced (addendum §2.1).
> 2. Two checkpoints are inserted before breach work: **CP05A — Terrain Relief and Substrate Color Rework** and **CP05B — Ambient Ocean Surface Motion and Terrain-Boundary Interaction**. CP06 must not begin until 05A and 05B have each been implemented, reviewed, and explicitly approved.
> 3. **CP06** is renamed **Breach, Re-entry, and Cross-Waterline Continuity** and now also owns continuous cross-waterline geometry and camera-side-dependent visibility. **CP08** becomes **Ecco Atmosphere and Final Water Optics**, a finishing pass over the CP05A substrate classes. CP07, CP09, and CP10+ are amended per addendum §§7, 9, 10.
> 4. CP05A supersedes the R14/§5.4 two-tint provisional terrain treatment with a shared substrate classification and color system (substrate only — never a substitute for assets; the §8.3 rectangular-placeholder law is unchanged).
> 5. **Pinned technique reference:** `docs/bodyarcade-stage3/references/zyfou-procedural-terrains/` — read-only snapshot of ZyFou/ProceduralTerrains at commit `8b396f9c784676d46f6a147d310d9f547bf41403` (MIT; see its `BODYARCADE_SOURCE_RECORD.md` and `LICENSE`). Techniques are adapted into app-owned code; the snapshot never becomes runtime architecture. Secondary conceptual reference: SimonStorlSchulke/threejs-examples (no code copy until licensing is resolved).
> 6. **Visual behavior reference:** `docs/bodyarcade-stage3/references/ecco-waterline/` — 13 selected Ecco: Defender of the Future frames plus a README; the acceptance set for CP05B, CP06, and CP08 (behavior and composition, never pixel-identical reproduction).
>
> The one-checkpoint-per-session rule and every explicit user approval gate are unchanged. Neither this notice nor the addendum authorizes starting CP05A, CP06, or any other checkpoint.

> **Post-CP05B amendment (2026-08-08) — ocean replacement; newest governing context.** After Checkpoint 05B was implemented (`fab3098`), the user rejected the region water's visual direction and recorded
> `docs/bodyarcade-stage3/decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md` (the "ocean-replacement addendum"). Where it conflicts with this master, the post-CP05 addendum, or any older checkpoint prompt, **it wins**, and it is required reading before CP05C and every later checkpoint. Its effects:
>
> 1. The entire jeantimex-derived **region** water (surface, sim, caustics, optics) is replaced at the new **Checkpoint 05C — Ocean Replacement (WaterThreeJS Port)** by a faithful port of the pinned WaterThreeJS procedural ocean (`docs/bodyarcade-stage3/references/waterthreejs/`). §4 of this master is superseded for the region view; the vendored pristine tree, `?view=stock`, and `?view=pool` remain byte-identical and untouched.
> 2. For the region view the user lifts the §6.8 bans on a modern ocean, sun disc, bloom, god rays, HDR post/tone mapping, SSR, and day/night — a continuous time-of-day cycle is now a governed feature. R11 / open item 9 (sky) is resolved by the procedural atmosphere. The §2.1 "one time of day" line is superseded.
> 3. Underwater color law: terrain and objects keep their own albedo, tinted only by physical water optics; the CP05A substrate classification survives with its underwater palette re-based on a sandy-dune blend (ocean-replacement addendum §2.4).
> 4. The side-branch CP06/CP07 implementations are superseded; CP06/07/08 are re-scoped per the ocean-replacement addendum §§5–7; the four-shot fidelity test and fallback ladder are retired.
>
> Nothing in this notice authorizes any checkpoint beyond 05C.

**Source-label key** (carried from the reports, never flattened):
- **[MEASURED]** — measured directly (repository fact, local-file audit, or primary-source verification).
- **[DOC]** — documented in a governing document or authoritative external source.
- **[BVM]** — bounded visual measurement from the Track D/E footage atlases (thumbnail-grade; never native).
- **[EST]** — estimate with stated reasoning.
- **[REC]** — recommended implementation value from a research report (never an original-engine value).
- **[GOVERNED]** — fixed by the master context / newest decisions; outranks the research reports.
- **[DERIVED]** — computed in this document from labeled source values by a stated rule (the rule is always shown).
- **[UNR]** / **[OPEN]** — unresolved; listed in §12, never silently invented.

---

## 1. Authority and precedence

### 1.1 Document stack (highest first)

1. The user's newest explicit statements (including the Stage-3 session instructions that fixed the BL and speed policies, §7.1–§7.2, and the post-CP05 addendum `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md`, which governs every checkpoint after 05).
2. `00_BODYARCADE_MASTER_CONTEXT_V3.md` including Addendum A (Addendum governs over the body where they conflict).
3. `01_NEW_DECISIONS_TO_MERGE.md` (Ecco gameplay-fidelity priority; the GAMICO dolphin listing pin).
4. The verified state of `github.com/lekandigital/posepuppet` at the pinned SHAs (re-verified 2026-07-17, zero drift — §1.4).
5. The five Track A–E research reports (facts and recommendations; where they conflict with the decision record, the decision record wins; where they conflict with each other, resolution is by this stack and recorded in §1.5).
6. The archived prior research corpus (evidence only).

Settled decisions (master context §15.5) are not re-opened anywhere in this package: PS2 over Dreamcast; one style; one shared world; jeantimex with the fidelity hierarchy and minimal-edit rule; dolphin-in-the-pool as checkpoint 1; the GAMICO dolphin as the character; bake-don't-generate terrain; fictional bounded ~2 km region; exploration-only slice; sonar out of slice; placeholder rectangles; no purchases; SeedThree as offline baker with swap clause; Rapier; local-only Mac development; WebGL2 / Three.js 0.184; 60 fps target; checkpoint review gates; strict content-generation policy; keyboard fallback; single-player.

### 1.2 The V1–V8 audit-first clause (verbatim, binding on every implementation session)

> "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

Track A executed that audit (report §6): **V1, V2, V3 completed and merged into `bodyarcade-v4-base`; V4–V7 completed on unmerged lanes (V4's three style profiles presentation-superseded by the one-style decision); V8 never run.** No defects were found in any lane; nothing verified working is rebuilt. The `feat/*` lanes are donors and history, never bases.

### 1.3 Review-gate law

Every checkpoint ends in a working live local demo (or, for checkpoint 03, an explicit decision gate), a change summary, a placeholder inventory, a performance report, and a deviations list — then **STOP** for user review. No new major visual change without prior approval; approved visuals are never changed without permission. The old autonomous no-gate policy and all remote-machine (`DISPLAY=:2`) conventions stay retired [GOVERNED, master context §13.1, §12.2, Addendum A.1].

### 1.4 Repository ground truth (re-verified 2026-07-17 in the Stage-3 session — zero drift from Track A)

| Pin | SHA | Verified |
|---|---|---|
| **Implementation base: `origin/bodyarcade-v4-base`** | `493dd243ffcc321c06067af33a17b89fb3b78d7a` | ✅ resolves on origin; contains apps/{dolphin,flight,walking}, packages/{body-input,locomotion,pose-hud,pose-runtime,world-data}, tools/worldbake |
| `bodyarcade-dolphin-fable` (reference impl.) | `05b4801` | ✅; preserve set byte-identical to v4-base (diff touches only main.ts/vite/playwright/tsconfig/tests) |
| `bodyarcade-v2-base` | `99df0bc` | ✅ |
| `local/v2-base-mac-prep` (NOT a base — Track A F1) | `60b034c` | ✅ |
| `feat/openworld` (donor) | `ed1bb7a` | ✅ |

Spot-checks confirming Track A's conclusions still hold: root `package.json` pins `three ^0.184.0`; `apps/dolphin` pins `^0.172.0`; `sim.ts`/`swimControls.ts` contain zero Three.js imports; the `SIM` table values match §7.4's "old" column exactly; `camera.ts` constants BACK 7.5 / UP 2.6 / POS_TAU 0.35 / LOOK_TAU 0.18 / FOV 68 / far 900; `LICENSE_NOTES.md` absent (F2); `loadBoundary()` throws on empty attribution (F6, `packages/world-data/src/index.ts:84-85`); `eval/dolphin-results.json` present (fps 60.01 / simHz 120.02); `apps/shared-world` does not exist. Dolphin source files present at `/Users/lekan/Downloads/dolphin-models/` exactly per master context §10.1 [MEASURED].

### 1.5 Conflict-resolution log (every cross-report conflict, with the rule applied)

| # | Conflict | Resolution | Rule |
|---|---|---|---|
| R1 | Master context §4.2 named `local/v2-base-mac-prep` the "likely working base"; Track A proved it lacks `apps/dolphin` entirely (F1) and proposed `bodyarcade-v4-base`. | **Base = `origin/bodyarcade-v4-base @ 493dd24`.** Ratified by the Stage-3 session instructions; repository inspection confirms no drift. | Newest user statement > repo evidence > stale pin |
| R2 | Body-length scale: Track D used 1 BL = 2.0 m [EST]; Track E used 1 BL = 2.5 m [REC]; the audited GAMICO model measures 2.89 m nose-to-fluke at scene scale 1.0 [MEASURED, Track C §1 Item 7]. | **Canonical 1 BL = 2.89 m** (§7.1). Track D/E values keep their real-meter meaning: meters = D-BL × 2.0 or E-BL × 2.5; canonical BL = meters ÷ 2.89. Meters are authoritative. Not a user decision. | Stage-3 session instruction (stack level 1) |
| R3 | Speeds: repo sim 16/22 m/s [MEASURED]; master context §7 defaults 5/9 m/s [GOVERNED]; Track E 4/7 E-BL/s = 10/17.5 m/s [REC]. | **Active initial cruise 5 m/s, burst 9 m/s.** Track E's 10 / 17.5 m/s appear only as explicitly labeled later comparison/retuning candidates. Not a user decision. | Master context governs over reports (stack level 2 > 5); session instruction confirms |
| R4 | Track D §16 row 8: prior "original is 4:3" wording contradicted (PS2 port has a wiki-tier native 16:9 option). | Corrected wording adopted; zero implementation impact — BodyArcade renders modern 16:9 at ≈1728×1080 regardless [GOVERNED]. | Track D's own resolution accepted |
| R5 | Materials: Track D locks roughness 0.95–1.0 / metalness 0 (matte, no pin-point speculars) vs the dolphin GLB shipping roughnessFactor 0.6 [MEASURED, Track C Item 5]. | Track D's locks govern **environment** materials (terrain/rock/props/creature NPCs). The hero dolphin uses Track C Item 5: metalness forced 0 if the flank-sheen check reads chrome-like; roughness 0.45–0.6 wet-skin band. No pin-point specular may result — Track D principle P4 still binds the outcome. | Track C owns the audited asset; Track D owns the look constraint |
| R6 | Camera FOV: repo camera FOV 68 [MEASURED] vs Track D REC vertical 50–60° with coverage governing. | Initial FOV 55° at checkpoint 02 [DERIVED: midpoint of Track D's band]; the Track D coverage bands (dolphin 8–18 % frame width, 40–60 % height) are the acceptance test; FOV is subordinate and tunable. | Track D §13 rule ("coverage governs; FOV is subordinate") |
| R7 | jeantimex HEAD commit SHA could not be pinned by Track B (robots-blocked). | Checkpoint 00 clones the repo, records the HEAD SHA in `VENDOR.md`, and grep-confirms every Table-1 pool-assumption site (`intersectCube`, `poolHeight`, sim resolution, render-target sizes, drop/object uniform names). Any mismatch with Track B Table 1 is reported at the checkpoint-00 review before any adaptation work. | Track B open items 1–3 routed to the first checkpoint that has the source |
| R8 | `packages/world-data` `loadWorld()`/`loadBoundary()` hard-require OSM attribution (Track A F6) vs the authored fictional region. | The shared-world app gets its **own loader** for the Track B Table-6 baked schema (checkpoint 04A). `packages/world-data` is not modified; the OSM/ODbL obligation disappears with the data source. | Track B owns the data schema (its §"Terrain" Table 6); Track A F6 respected without package edits |
| R9 | Track E Table E remaps body `crouch` to Brake/Hover; the shipped `swimControls.ts` maps crouch/stretch to depth trim [MEASURED]. | Shipped body mappings are **preserved** (tested, gate-approved system). Active braking is added on the keyboard only (§7.4, X key). The Track E body-brake remap is listed as a user decision in §12. | Preserve working implementations (V1–V8 clause spirit); Track E [REC] does not override shipped behavior without user approval |
| R10 | Track E lists a 180° quick-turn maneuver (0.4 s [REC]); no input binding exists for it in the shipped control set, and no source assigns one. | **Not implemented in the slice.** Recorded in §12 open items with Track E's value, pending a user-assigned binding. | No invented parameters; genuine gap goes to open items |
| R11 | Track D §15 specifies the above-water sky (zenith #3F93DA → horizon #82C8F2, cumulus); the fidelity hierarchy protects the vendored demo's sky, which reflections sample. | The vendored jeantimex sky ships unchanged through the slice (jeantimex wins until individually approved tweaks). The Track D sky is recorded in §12 as an approval-pending later tweak. | Fidelity hierarchy (master context §3.3) |
| R12 | Track B proposed baked-data paths under `assets/world/`; the app serves static files from `public/` under the Vite base. | Baked artifacts live at `apps/shared-world/public/world/` (§2.3). Pure path adjustment; schema unchanged. | Repo serving convention (Track A §11) over a proposed path |
| R13 | The sim needs `shoreDistance()` for containment (Track A §4.3), but Track B Table 6 bakes no distance field. | One artifact added to the baked schema: `shore_sdf.r16` (§2.3), signed distance in meters computed from `shore.png` at bake time. Recorded as a schema extension with cause; everything else in Table 6 is unchanged. | Track A's re-point contract is load-bearing; extension recorded, not silent |
| R14 | Where does the region's rendered terrain get a material before checkpoint 08 (Track B defers texture selection to cp8)? | Checkpoints 04A–07 use an untextured matte Lambert with two provisional vertex tints — submerged #D2C7A9 (family-B sand), exposed #A98F6C (family-B rock) [BVM→REC, Track D table 6.2] — explicitly labeled provisional-until-checkpoint-08. | Track D supplies the only sourced tints; provisional label carried |

---

## 2. The world contract

### 2.1 Coordinates, units, scale [GOVERNED master context §7; validated Track B Table 11]

- Units: **meters**. Axes: right-handed, **y-up**; ground plane = XZ. **Sea level = y 0.** `terrainHeight(x,z) < 0` → seabed; `≥ 0` → exposed land.
- Region: **2 km × 2 km**, origin at region center; X,Z ∈ [−1000, +1000]. Max depth **−80 m**; tallest peak **+200 m**.
- Heightmap texel (i,j) → world: `x = −1000 + i·(2000/2048)`, `z = −1000 + j·(2000/2048)`; value → `y = −80 + h16/65535·280` [Track B Table 10].
- Dolphin cruise **5 m/s**, burst **9 m/s** [GOVERNED §7.2] → 5–10 min traversal across the region.
- ~~One time of day (bright tropical sun); no day/night; no weather [GOVERNED].~~ **Superseded 2026-08-08** (ocean-replacement addendum §2.3/§2.6): the region runs a continuous deterministic time-of-day cycle (~11 min period). Weather remains out of scope beyond the ported ocean's own cloud layer.

### 2.2 Single source of truth [Track B "Q14" data flow; law from master context §6.1]

`terrainHeight(x,z)` decoded from the baked heightmap is the one function every subsystem calls. Render mesh, Rapier collision, water depth (`depth = 0 − terrainHeight`), soft containment, shoreline masking, placement, and all four movement modes derive from the same decoded field. A visible/collision mismatch is a defect by construction.

### 2.3 Baked-data schema [Track B Table 6 + resolutions R12–R13]

All at `apps/shared-world/public/world/`:

| Artifact | Format | Resolution | Content |
|---|---|---|---|
| `height.r16` | 16-bit little-endian R16 | 2049² (~0.98 m/texel) | Height range [−80, +200] m |
| `shore.png` | 8-bit PNG | 2049² | Derived mask: `terrainHeight ≥ 0` |
| `shore_sdf.r16` | 16-bit R16, signed-scaled | 2049² | Signed shore distance, meters (+ = water) — schema extension R13 |
| `biome.png` | 8-bit RGBA | 1025² | Zone-family / placement masks (channels documented in `world.json`) |
| `placement.json` | JSON | — | Instances `{category, type, x, z, yaw, scale}` |
| `caves.json` | JSON + GLB refs | — | Cave module transforms + seam metadata |
| `world.json` | JSON | — | Region origin/size, seaLevel 0, axis note, height range, spawn point(s), zone-family table, authored attribution lines |

Baking is offline and deterministic (seeded); the runtime only loads (bake-don't-generate law, master context §6.2). The loader is app-local (`WorldData`, checkpoint 04A) exposing `terrainHeight(x,z)` (bilinear), `inWater(x,z)`, `shoreDistance(x,z)` (from `shore_sdf.r16`), `depthAt(x,z) = max(0, −terrainHeight)`.

---

## 3. The codebase plan [Track A §4, §5, §10, §11 — all verified against the checkout]

### 3.1 Location and base

- Work branch: **`shared-world-slice`**, created at checkpoint 00 by `git fetch origin && git switch -c shared-world-slice origin/bodyarcade-v4-base` (no local branch exists for v4-base — Track A F15). Every later checkpoint starts from the previous checkpoint's approved commit on this branch.
- New app: **`apps/shared-world/`**, package `{ "name": "@bodyarcade/shared-world", "private": true, "type": "module" }`, `three@^0.184` + `@types/three@^0.184`. `apps/dolphin` stays untouched as the reference implementation.
- jeantimex vendored **pristine** at `apps/shared-world/vendor/threejs-water/` with its MIT LICENSE and a `VENDOR.md` recording the cloned HEAD SHA (R7). The pristine demo remains runnable forever at `?view=stock` for fidelity comparisons.

### 3.2 Integration contract [Track A §11, verbatim where mechanical]

| Item | Contract |
|---|---|
| Vite config | Clone `apps/dolphin/vite.config.ts` (v4-base version): `base: '/shared-world/'`; aliases → `../../packages/{body-input,pose-runtime,pose-hud}/src/index.ts`; `server.fs.allow: ['..','../..']`; dev port **5198**; `build: { outDir: 'dist', target: 'es2022' }`; include the `poseAssets()` middleware clone (serves `/models` + `/mediapipe-wasm` from PosePuppet `public/` in standalone dev). |
| Same-origin serving | Add `sharedWorldStatic()` to root `vite.config.ts` — copy `dolphinStatic()` with `SHARED_WORLD_DIST = ./apps/shared-world/dist`, prefix `/shared-world/`; extend the MIME map with `.glb: 'model/gltf-binary'`. Root scripts: `"shared-world:build"` + extend `"arcade"`. (BroadcastChannel is origin-scoped — the Gate-2 lesson.) |
| Body input | Port `swimControls.ts` unchanged (dual transport `bodyarcade.body-input.v1`, ts-dedupe, 350 ms staleness, 0.35 confidence, 1500 ms keyboard priority, autopilot, assists, T-pose recenter). Boot per `493dd24:apps/dolphin/src/main.ts`: `createPoseRuntime({ model:'lite', worker:true, captureSize:{width:640,height:360}, election:'strict', forceExternal: ?pp==='companion' })` + `mountPoseHud(runtime, { title:'SWIM' })` unless `?hud=0`. Keyboard-only play must survive camera-denied. |
| Sim port | `sim.ts` + `swimControls.ts` + `camera.ts` copied (zero Three.js imports in the first two [MEASURED]); a **`WorldSampler`** interface (`inWater`, `shoreDistance`, `depthAt`) injected into the sim constructor replaces the SF-Bay boundary import; `game.ts`'s fixed-timestep accumulator + eval handle recreated as **`__SHARED_WORLD`** (same shape as `__DOLPHIN`, incl. `runScript`) around the vendored render loop. |
| Tests | Clone `apps/dolphin/playwright.config.ts`: headed Chromium, workers 1, own webServer :5198 + producer webServer on `PP_PORT` (default 5173); viewport pinned 1728×1080; results to `eval/shared-world-results.json` (committed-artifact convention F12). No `DISPLAY`, no SwiftShader — native macOS GPU; fps floor asserted unconditionally. |
| Assets | Dolphin at `apps/shared-world/public/models/dolphin/dolphin.glb` + `LICENSE-dolphin.txt` alongside (Track C Item 7). All asset paths stay under the Vite base. |
| Dev commands | Standalone: `npm --prefix apps/shared-world run dev` → `http://localhost:5198/shared-world/`. Full topology: `npm run arcade` → `http://localhost:5173/shared-world/`. |

### 3.3 Preserve / replace / re-point manifest [Track A §4.1, condensed; verdicts binding]

| Source (dolphin app) | Verdict | Checkpoint |
|---|---|---|
| `src/game/sim.ts` | **Preserve** (port + `WorldSampler` seam + §7.4 constant retune) | 01 |
| `src/input/swimControls.ts` | **Preserve** (port unchanged) | 01 |
| `src/game/camera.ts` | **Preserve as baseline**, superseded by the Track E rig at cp02 (its three behaviors — spring chase, breach lift, bank-coupled roll — carry into the new rig) | 01→02 |
| `src/game/game.ts` | **Preserve pattern** (accumulator, kick-on-first-substep, eval handle, fps/simHz counters); shell recreated around the vendored pipeline | 01 |
| `src/game/world.ts`, `decor.ts`, `dolphinMesh.ts` | **Replace wholesale** (banned presentation pass). Keep two techniques: seabed-displaced-by-`depthAt` single-source law; deterministic golden-angle + value-noise placement for placeholder scattering. `dolphinMesh`'s undulation contract (kick→wave, idle breathing, amp∝speed) is reproduced by the GLTF animation layer | 01+, 04A, 07 |
| `src/ui/hud.ts`, `minimap.ts` | **Replace/defer**: no full HUD in the slice; keep the low-nag coach pattern for later; minimap only if wanted, fed by the authored shoreline | — |
| `src/main.ts` (v4-base version) | **Re-point** (copy the `createPoseRuntime` boot) | 00–01 |
| `tests/dolphin.spec.ts`, `topology.spec.ts`, `hud.spec.ts` | **Preserve assertions** per the migration map (§11.1) | 01+ |
| `shots.mjs` | **Re-point** (screenshot driver; drop the DISPLAY comment) | 02+ |

Wider-repo preserves: `@bodyarcade/body-input`, `pose-runtime`, `pose-hud` (consumed via aliases, unmodified); `packages/locomotion` (checkpoint 14B donor); rowing systems inside `apps/flight` (14A donor: `rowControls.ts`, `Boat.ts` pattern, `RowingHUD.ts`); flight systems (14C donor); `feat/openworld` read-only donor (`WorldRuntime`, `modes/*`, `transitions.ts`, `bodyDrive.ts` patterns).

### 3.4 The 0.172 → 0.184 port surface [Track A §4.7 — verified]

`sim.ts`/`swimControls.ts`: zero Three.js usage — copy. `camera.ts`: stable core API (`PerspectiveCamera`, `Vector3.lerp`, `lookAt`, `rotateZ`) — recompile under 0.184 typings; confirm against the 0.173–0.184 migration notes at port time (expected clean). `game.ts` shell is recreated anyway. **No Three.js API rewrites in the preserve set.**

### 3.5 Local-macOS verification migration [Track A §10]

No `DISPLAY` env anywhere; headed Chromium on native macOS; `USE_SWIFTSHADER`/`POSEPUPPET_GPU_*` gating left unset (harmless); the fps floor asserts unconditionally (native GPU); fixture-dependent topology tests self-skip when the gitignored fixtures are absent. **Stage-3 audit correction to Track A §10.1:** `scripts/remote/*`, `scripts/local/*`, and `.claude/rules/remote-development.md` **are present on `bodyarcade-v4-base @ 493dd24`** (verified `git ls-tree 493dd24`, 2026-07-17 — the remote-infra commit `68ac9a3` is in this base's ancestry). They are historical artifacts of the retired remote policy: no checkpoint invokes, follows, or extends them, and if a session's tooling surfaces `.claude/rules/remote-development.md` or a repo `CLAUDE.md` pointer to it, the local-only law of this package (master context §12.2, Addendum A.1) overrides it. Do not delete them either — that would be an unrequested change to the base.

---

## 4. The water plan [Track B, entire WATER section; fidelity hierarchy master context §3.3]

> **SUPERSEDED for the region view (2026-08-08)** by the ocean-replacement addendum: the region water is the CP05C WaterThreeJS port; the fidelity hierarchy (§4.1), sanctioned edit family (§4.2), windowed sim (§4.3), four-shot test (§4.4), and fallback ladder (§4.5) below are retired for `?view=region`. They remain historical record and still describe the untouched `?view=stock` / `?view=pool` vendored views.

### 4.1 Fidelity hierarchy (binding at every water checkpoint)

1. The exact vendored jeantimex look is preserved as-is; changes limited to the sanctioned minimal-edit family below. Where jeantimex and the Ecco spec disagree, **jeantimex wins** until the user approves each tweak.
2. jeantimex owns the **surface and waterline** (above-water look, reflections/refraction, Snell's window, breach crossing, half-submerged camera). The Track D spec owns the **underwater atmosphere**, implemented through jeantimex's mechanisms (fog/palette/caustic-intensity uniforms), never as a second system.

### 4.2 The sanctioned minimal-edit family (container swap) [Track B Tables 1–2]

Everything not listed **stays byte-identical**: wave-sim shader math, normal pass, caustics differential-area fragment math, Fresnel/Schlick compositing, Snell's-window behavior, skybox sampling, object-displacement pattern, `.xzy` swizzle.

| Site | Edit |
|---|---|
| Water-above frag `intersectCube(origin, ray, cubeMin, cubeMax)` / `poolHeight` | → `raymarchSeabed(origin, ray)` against the baked height texture (fixed-step + binary refine), returning hit point + normal; same `getWallColor` consumption |
| Water-below frag box sample | → same heightfield raymarch; terrain material + caustics at hit; sky/Snell exit unchanged |
| `poolHeight` scalar | → `uSeaLevel` (0.0) + per-fragment seabed height; `depth = 0 − terrainHeight` |
| Caustics vertex floor-plane intersection | → refracted light projected onto the seabed heightfield (raymarch); fragment `newArea/oldArea` math untouched |
| Pool wall shader triplanar box UV | → coastline geometry (terrain above sea level) with the triplanar terrain material |
| Surface mesh extent | → region/window extent + shoreline **alpha-clip** (`discard` where `terrainHeight ≥ 0`); geometry clipping and stencil rejected [Track B Q5] |
| Sim-domain mapping | → player-following window (§4.3); sim shader math untouched |
| `Renderer.ts` pass switch | → add a "region" pool type; wave/normal/caustics/surface passes reused |
| New uniforms (additive) | `uSeaLevel`, `uHeightTex`, `uRegionSize`, `uWindowOrigin`, `uShoreMask` |

### 4.3 Sim-resolution decision [Track B Table 3 + Q4 — REVISED scale default, adopted]

**One global calm surface plane at y = 0 spanning the region** (jeantimex surface shader, low-amplitude ambient swell), with the **interactive GPU sim windowed: 512² texels covering a 256 m square (0.5 m/texel) centered on and scrolled with the dolphin**. Window origin snaps to 0.5 m texel increments; scroll-copy carries overlapping texels; cosine falloff over the outer ~10 % blends window displacement into the ambient swell. A single 2 km sim sheet at any feasible resolution aliases the wake (7.8 m/texel at 256²) — rejected. This windowed design **counts as one system** [GOVERNED, master context §5.2 item 4]. Fallback if the 512² window over-budgets: 256² windowed at 128 m coverage (same texel size).

Dolphin/boat interaction: the demo's compound-sphere displacement pattern (the demo ball generalized); velocity scales ripple amplitude. Breach splash: `addDrop`-style burst injections at both surface crossings [Track B Q7].

### 4.4 The four-shot fidelity test [Track B Table 4 — run at checkpoints 04B and 08; shots (c)+(d) additionally at 02]

Side-by-side against the pristine `?view=stock` demo at 1728×1080, fixed recorded camera transforms:

(a) above-water demo angle — surface color, Fresnel rim, sparkle, swell indistinguishable; (b) underwater looking down — caustic brightness/scale/speed character matches; (c) half-submerged at y=0 — clean waterline, correct Fresnel split, no z-fight, no double horizon; (d) looking up — Snell cone ≈ 97° (critical angle 48.6°), sharp edge, TIR outside. Pass = "every visible part of the ocean appears to belong to the same jeantimex system." Capture PNGs; per-pixel luminance delta in the water region within a small stated tolerance; no structural artifact.

### 4.5 Fallback ladder [Track B Table 5 — documented, not the plan]

1. (Plan) Windowed 512² sim + global surface + heightfield-raymarch container.
2. Near/mid/far tiers — escalate only if rung 1 fails four-shot (b)/(c) at distance or busts the budget; evidence = the failing shots + profile numbers.
3. Selective port of Water + GPU heightmap + CausticsPass + above/below shaders — last resort, requires the same evidence plus user approval.

Caustics fallback (independent): martinRenou/threejs-caustics (license re-verify at source before any code copy) only if the per-vertex terrain raymarch proves too costly/unstable [Track B Q6]. Never stack two caustic systems.

---

## 5. The terrain and cave plan [Track B TERRAIN/CAVES/COLLISION sections]

### 5.1 Authoring and bake (checkpoint 04A)

- **Author once, bake, load** [GOVERNED §6.2]. Authoring implements the checkpoint-03-approved sketch exactly, via a committed, seeded Node script (`apps/shared-world/authoring/bake-region.mjs`) using **THREE.Terrain** (MIT, verified) algorithms — DiamondSquare/Perlin/island/cliff filters plus explicit authored stamps for the sketch's masses. **ProceduralTerrains** (MIT, verified) may be used interactively to shape a seed heightmap PNG that the script ingests (its 1024² grayscale export is verified; its GLB export is README-advertised only — do not depend on it [Track B Needs-user]). The script's output is the §2.3 artifact set, committed.
- Bake also derives: `shore.png` (sign test), `shore_sdf.r16` (distance transform), biome channels from height/slope thresholds per the approved zone map, `placement.json` sites per the approved sketch, and cave lip-stamps (§5.2).

### 5.2 Caves and overhangs (checkpoint 09) [Track B Table 8 — decided]

**Authored/kitbashed modular cave-and-arch meshes** — Kenney Modular Cave Kit ("40 assets… CC0 licensed", verified) finished in Blender — placed per `caves.json`. SDF/marching-cubes route rejected (art-directability, Ecco-authenticity — the game's caves were hand-modeled — collision simplicity, no new toolchain). Seam rule [Track B Q19]: heightmap locally lowered at bake time to meet each module lip; shared triplanar rock material across the seam; where a module undercuts, the heightfield is locally omitted and the trimesh is authoritative.

### 5.3 Collision [Track B Table 9]

- **Rapier** (`@dimforge/rapier3d`): one static **heightfield collider** for base terrain (downsampled 513², ~4 m cells) + **trimesh colliders** (fixed bodies) per cave/arch/structure module. Introduced at checkpoint 09 (first checkpoint that needs volumetric collision — the dolphin previously had no decor collision by design, Track A F7).
- **three-mesh-bvh** (MIT, npm 0.9.10): all non-physics queries — camera collision sphere-casts (from checkpoint 05), dolphin push-out `closestPointToPoint` in caves, walk-mode ground snap (14B), placement raycasts.
- Dolphin containment stays the sim's **soft repulsion**, re-pointed at `shore_sdf.r16` + heightfield (checkpoint 04A/B); never a hard wall.

### 5.4 Terrain rendering (checkpoint 05)

Chunked static LOD: **16×16 tiles (128 m), 4 discrete levels, skirt rings** [Track B Q16 — 16×16 chosen from its "8×8 or 16×16" as the finer authoring granularity; recorded]. **Silhouette protection**: tiles containing coastline or ridge silhouettes keep max LOD. Material mechanism: height/slope-blended low-frequency textures, triplanar on steep faces, single directional light + hemisphere, vertex AO tint — texture selection deferred to checkpoint 08 [Track B Q15]; provisional tints per R14 until then. Transferable mesqme techniques (bounded world only): per-chunk InstancedMesh flora (cp10–11), vertex-shader sway, single directional light, distance fade + fog, base/tip color-lerp fake AO. No streaming architecture.

---

## 6. The visual spec [Track D — scoped to checkpoint 08 and later approved tweaks]

All Track D values are [BVM]/[REC] from thumbnail-grade atlases — decision-ready but provisional; the PCSX2 capture sheet (Track D §19) replaces them with native measurements whenever the user runs it (§12). Distances stated in Track-D BL convert at **1 D-BL = 2.0 m**; canonical BL = meters ÷ 2.89 (§7.1).

### 6.1 The ten load-bearing principles (checkpoint-08 review rubric — Track D §2)

P1 fog **is** the water, always chromatic, never neutral grey; scene.background = fog color. P2 region-authored palettes on a depth ramp. P3 value contrast carries navigation (bright apertures center-frame in dark zones). P4 broad diffuse top-down light, matte materials, no pin-point speculars, no hard shadows. P5 large blocked terrain masses; detail is textural hue. P6 dolphin centered, 8–18 % frame width, 40–60 % height. P7 wildlife sparse by default, clustered when present. P8 caustics shallow-band only; light shafts aperture-bound. P9 one bright tropical day. P10 jeantimex owns surface/waterline; this spec acts only through its mechanisms.

### 6.2 Zone families used by the slice

The checkpoint-03-approved layout assigns each region area one Track D family. Available: Bright shallow band, B shallow reef, C kelp reef, F vivid canyon, E desaturated plain or G hazy open sand, dark cave families D/J/K/H, E2 shaft chamber, I violet chamber (setpiece, optional), L above water. The default/fallback ramp is the master depth ramp: shallow (0–10 m below surface) bright-shallow row; mid (10–36 m) region row; deep (36 m+, and all enclosed caves) dark-family row [Track D §6, depths converted at 2.0 m/D-BL].

### 6.3 Fog and background per zone (FogExp2; factor `1−exp(−(d·density)²)`) [Track D 17.2]

| Zone | fog.color | density start | tuning range |
|---|---|---|---|
| Bright shallow band | #55BFB4 | 0.058 | 0.049–0.071 |
| A green midwater | #369287 | 0.080 | 0.062–0.099 |
| B shallow reef | #3E9C90 | 0.075 | 0.062–0.099 |
| C kelp reef | #379890 | 0.078 | 0.062–0.099 |
| F vivid canyon | #349A90 | 0.068 | 0.055–0.082 |
| E desaturated plain | #8AA0A8 | 0.095 | 0.076–0.124 |
| G hazy open sand | #A8CFC8 | 0.115 | 0.090–0.141 |
| E2 shaft chamber | #223A42 | 0.155 | 0.124–0.198 |
| D olive cave | #1E1B0C | 0.190 | 0.141–0.247 |
| J deep cavern | #0C1A28 | 0.240 | 0.165–0.330 |
| K olive tunnel | #14120A | 0.200 | 0.165–0.247 |
| I violet chamber | #200A28 / #06030A | 0.350 | 0.247–0.494 |
| H magenta chamber | #1A0C12 | 0.250 | 0.198–0.330 |
| L above water | off | 0.000 | 0.000–0.002 |

View-direction tint (fog-color uniform only): +10–15 % luminance toward pale cyan above +20° pitch; −15 % below −25°. Zone transitions lerp color+density over 3–5 s of traversal (no visible biome border). E and G far fields are *lighter* than near (haze lift) — never darken with distance there.

### 6.4 Lighting, materials, renderer [Track D §9, 17.1, 17.3, 17.4]

Renderer: `outputColorSpace = SRGBColorSpace`, `NoToneMapping` (or Linear @ 1.0), **no post stack** (no bloom/SSR/AO/god-ray/film/CRT/dither passes). Lit zones: HemisphereLight sky = zone light color @ 0.9–1.0, ground = floor tint @ 25–35 % of sky; DirectionalLight #FFF4E0 @ 0.45–0.65, elevation 60–75°, castShadow false. Desaturated/hazy: hemi 0.7–0.85, directional 0.35–0.5. Dark zones: hemi 0.05–0.15, directional 0–0.1, ambient floor 0.02–0.05 in zone shadow color — never lift caves to readability. Materials: Lambert/Standard, roughness 0.95–1.0, metalness 0, vertex-color tinting sanctioned, no specular/normal micro-maps (silhouette-neutral low-intensity relief is a user-approvable option only). Emissive props 0.5–1.5, no bloom; event glows = additive sprites, never scene lights.

### 6.5 Caustics and shafts [Track D §8, 17.5 — dials on jeantimex uniforms; user approval required at cp08 review]

Caustic intensity → +15–30 % floor luminance; cell scale 0.6–1.6 m; soft edges; full strength in the top ~10 m of water column over the floor, zero by ~20–24 m; drift 0.02–0.05 UV/s, 8–14 s apparent cycle; terrain-only projection (creature projection [UNR] pending capture C-CAU-CRE). Light shafts: authored volumetric cones/billboard fans **only at real ceiling apertures**, #DDF2F0, width 2–6 m, the brightest element of their zone; no screen-space god rays; nothing above the waterline.

### 6.6 Particles [Track D 17.6] and wildlife budgets [Track D 17.8]

Marine snow 30–80 motes in a 12 m camera bubble, 1–3 cm, drift 1–3 cm/s, opacity 0.05–0.15 lit / 0.2–0.35 dark; dolphin trail 2–5 bubbles/s, rise 0.5–1.0 m/s; bursts 20–60 bubbles, 0.8–1.5 s life, rise 1–2 m/s; cave sparks (family D only) 10–25 motes #FFB347. Budget rule: particles never compete with fog — cut particles first. Wildlife: reef 2–4 ambient + one 12–24-fish school per 60–120 s; plain 0–1 + one patrolling shark per pocket; caves 0–3 (jelly rows of 2–4); above water none.

### 6.7 Composition grammar [Track D §14 — drives checkpoint 03 sketches and 07 placement]

Corridors (2–4 landmark masses, lit gap center) alternate with open plains (0–2 silhouettes in fog). Arch openings 4–8 m wide; spires 6–16 m tall [BVM ±50 %]. Landmarks placed just inside the fog boundary; navigation by value contrast (bright apertures), never markers. A distinctive formation roughly every 30–60 s of normal exploration, no rigid quota.

### 6.8 Banned failure modes (fail review regardless of other qualities) [Track D §18]

> **Amended 2026-08-08** (ocean-replacement addendum §2.3): for the region view the user lifts the bans on a modern ocean look, sun disc, bloom, open-water god rays, SSR, HDR post/tone mapping, and day/night — these are now the governed region water direction. The remaining bans (retro-hardware emulation, lifted cave darkness, presenting estimates as measurements, etc.) stand.

Neutral-grey fog; retro-hardware emulation (forced low poly, flat-shaded identity, affine wobble, dither/CRT filters, 4:3); generic modern ocean; modern lighting tells (pin-point speculars, gloss/metalness, hard shadows, SSR, AO-as-look, bloom, lens flare, sun discs, open-water god rays, exposure adaptation); lifted cave darkness; uniform fill; day/night or weather; touching jeantimex beyond the sanctioned edits; presenting estimates as native measurements.

---

## 7. The movement and camera spec [Track E folded into the feel-constant plan; Track C animation inventory]

### 7.1 Body-length policy [Stage-3 session instruction — deterministic, not a user decision]

- **Canonical 1 BL = the audited GAMICO dolphin's loaded nose-to-tail length at scene scale 1.0 ≈ 2.89 m** [MEASURED, Track C §1 Item 7].
- Track D values (authored at 1 BL = 2.0 m): `meters = D-BL × 2.0`; `canonical BL = meters ÷ 2.89`.
- Track E values (authored at 1 BL = 2.5 m): `meters = E-BL × 2.5`; `canonical BL = meters ÷ 2.89`.
- **Meter values are authoritative** everywhere in this package; BL appears only as commentary.
- **Checkpoint 01 measures the loaded model at runtime** (skinned bounding box along +Z with `SwimForward` playing, frame 0) and reports any deviation > 2 % from 2.89 m as **material asset drift** — it does not choose a new scale.

### 7.2 Speed policy [Stage-3 session instruction; master context §7 governs over reports]

- **Active initial cruise = 5 m/s; active initial burst = 9 m/s.**
- Track E's 4 E-BL/s (10 m/s) and 7 E-BL/s (17.5 m/s) appear **only** as explicitly labeled later comparison/retuning candidates, surfaced at checkpoint reviews — never as active values. Speed selection is not a user decision.

### 7.3 Model verdicts [Track E §7, §9, §21 keep/retune/replace, applied to the shipped sim]

| Behavior | Verdict | Notes |
|---|---|---|
| Impulse-and-glide propulsion (kick banks surge, drag settles cadence, stillness glides) | **Keep** | Already implements Track E's "tap to build / hold to maintain / release to drift" hybrid — sustained cadence *is* hold-to-cruise |
| Speed caps | **Retune** | 16/22 → 5/9 [GOVERNED] |
| Velocity locked to heading | **Replace** | Add velocity-chases-facing lag (slip; arcs) — Track E principle 4 |
| Yaw authority rising with speed (speedFactor saturating at 8 m/s) | **Replace** | Ecco is agile slow, wide fast: full-bank yaw 140°/s at ≤1 m/s → 90°/s at ≥5 m/s (§7.4) |
| Pitch clamp 57° | **Retune** | → 85° near-vertical authority [Track E Table B; DO broad pitch] |
| Input topology (lean/AD → bank → yaw; crouch → depth trim) | **Keep** | Shipped, tested; R9 |
| Active braking | **Add (keyboard)** | X hold-to-brake, cruise→0 in ~0.6 s [Track E Table A]; body remap is a §12 user decision |
| Idle/hover below min controllable speed | **Add** | Full rotation authority; visual = slow-played SwimForward (Track C idle gap-fill), no sim bob |
| Breach ballistic + retained momentum + cooldown | **Keep** | Thresholds retuned (§7.4); variable airtime emerges from speed |
| Assists / autopilot / T-pose recenter / keyboard priority | **Keep** | Untouched |
| Chase camera | **Replace at cp02** | Track E Table C rig (spring + look-ahead + speed distance + asymmetric damping), carrying the old camera's three virtues |
| 180° quick turn | **Not in slice** | R10; open item |

### 7.4 Feel-constant table (checkpoint 01 initial values; the one-table law is preserved)

Meters and seconds. "Old" = `apps/dolphin/src/game/sim.ts` [MEASURED]. Every retune rule shown.

| Constant | Old | New initial | Source / rule |
|---|---|---|---|
| DT | 1/120 | 1/120 | [GOVERNED] architecture |
| WORLD_SCALE | 1/15 | **deleted** | Authored region is native meters; pool sampler is analytic (§7.7) |
| MAX_SPEED | 16 | **5** | [GOVERNED] cruise |
| BURST_MAX_SPEED | 22 | **9** | [GOVERNED] burst |
| BURST_ACCEL | 9 | **6** | [DERIVED] preserve ~0.67 s time-to-cap over the new 4 m/s gap (4/0.67≈6) |
| KICK_IMPULSE | 4.2 | **1.3** | [DERIVED] cruise ratio 5/16 × 4.2 = 1.31; yields ~5 pumps / ~3 s from rest to cruise at 1.6 Hz — inside Track E's "4–6 pumps to cruise". Track E's 0.9 E-BL/s (2.25 m/s) = labeled candidate |
| KICK_AMP_FLOOR | 0.55 | 0.55 | Keep ⚪ |
| SURGE_ATTACK_TAU | 0.30 | 0.30 | Keep (Track E ADSR attack) |
| GLIDE_TAU | 6.0 | 6.0 | Keep initial (repo feel fact; 5 m/s coast ≈ 30 m). Track E τ½ 2.0 s (τ≈2.9 s, coast ≈ 14 m) = labeled candidate; review item at cp01 |
| PITCH_RATE | 1.5 rad/s (86°/s) | 1.5 | Keep — inside Track E 70–160°/s band; 1.75 (100°/s) = candidate |
| PITCH_MAX | 1.0 rad (57°) | **1.48 rad (85°)** | [Track E Table B] near-vertical authority; clamp short of ±90° |
| ROLL_RATE / ROLL_MAX | 2.2 / 0.9 | 2.2 / 0.9 | Keep (manual roll clamp) |
| BANK_AUTO_MAX (new) | — | **0.61 rad (35°)** | [Track E Table B] auto-bank at max yaw |
| TURN_AUTHORITY_LOW (new) | — | **2.71 (1/s per rad bank)** | [DERIVED] full-bank (0.9 rad) yaw = 140°/s at ≤1 m/s [Track E Table B] |
| TURN_AUTHORITY_CRUISE (new) | — | **1.74** | [DERIVED] full-bank yaw = 90°/s at ≥5 m/s [Track E Table B]; lerp between over 1→5 m/s; replaces TURN_COUPLE×speedFactor |
| VEL_FOLLOW_TAU (new) | — | **0.35 s @ cruise**, lerp to 0.55 s @ burst, floor 0.25 s < 2 m/s | [Track E Table B 0.35 s "longer fast", range 0.2–0.7; shaping DERIVED within the range] |
| MIN_CONTROL_SPEED (new) | — | **0.75 m/s** | [Track E Table A 0.3 E-BL/s × 2.5] hover threshold |
| BRAKE (new, keyboard X) | — | **cruise→0 in 0.6 s** | [Track E Table A]; binding X is a derived integration parameter flagged at cp01 review |
| TRIM_SPEED | 3.5 | 3.5 | Keep 🟡; review at 80 m depths (cp04B) |
| SURFACE_Y / SEABED_CLEAR | −0.4 / 1.2 | keep | ⚪ |
| DEPTH_MIN / DEPTH_MAX / DEPTH_SDF_GAIN | 3.5 / 34 / 0.5 | **deleted at cp04A** | Replaced by heightfield sampling; pool sampler analytic until then |
| ASSIST_DEPTH_FRAC | 0.75 | 0.75 | Keep 🟡; review at cp04B |
| SHORE_BAND | 55 | 55 | Keep initial 🔴; explicit region-scale review item at cp04B |
| SHORE_PUSH | 10.5 | 10.5 | Keep initial (containment guaranteed); battery decel threshold restated for the 5/9 family |
| SHORE_YAW_ASSIST | 0.9 | 0.9 | Keep |
| DRIFT_SPEED | 1.6 | **0.5** | [DERIVED] preserve the old 10 %-of-cruise proportion (1.6/16) at cruise 5 |
| DRIFT_TAU / AUTOPILOT_LEVEL_TAU | 3.0 / 0.8 | keep | ⚪ |
| BREACH_MIN_SPEED | 10 | **3.75** | [DERIVED] Track E ratio (min approach 3 E-BL/s ÷ cruise 4 E-BL/s = 0.75) × governed cruise 5. Old-sim-ratio alternative (0.625×5 = 3.1) recorded |
| BREACH_MIN_VY | 3.2 | 3.2 | Keep — apex physics, not speed-family (min leap ≈ 0.68 m at g 7.5); reachable: burst 9 @ ≥25° → vy 3.8 |
| BREACH_GRAVITY | 7.5 | 7.5 | Keep (inside Track E 6–14 band; "dreamy" repo feel fact) |
| BREACH_REENTRY_KEEP / BREACH_COOLDOWN_S | 0.85 / 1.0 | keep | ⚪ |
| swimControls constants (staleness 350 ms, conf 0.35, KB priority 1500 ms, loss decay 0.25 s, reacquire slew 2.0/s, boost thresholds, KB_KICK_HZ 1.6) | all | keep | [MEASURED] shipped consumer discipline, untouched |

Airtime cross-check [DERIVED]: burst 9 @ 45° → vy 6.4, airtime 1.7 s; minimum vy 3.2 → 0.85 s — inside Track E's 0.8–2.0 s variable-airtime band; airtime stays monotonic with speed (acceptance item).

### 7.5 Camera rig (checkpoint 02) [Track E Table C, converted ×2.5 to meters; Track D §13 composition bands govern]

Spring position with asymmetric damping + smoothed-velocity look-ahead + speed-based distance + analytic (pool) / BVH (region) collision. Initial values: follow distance 8.75 m (grows to 13.75 m at burst); height 2.0 m; look-ahead 6.25 m along smoothed velocity; catch-up t90 0.18 s / settle t90 0.45 s; aim t90 0.25 s; distance t90 0.6 s; recenter 0.5 s; obstruction dolly-in t90 0.15 s; collision radius 0.75 m; surface-transition blend 0.3 s; breach pullback +3.75 m; re-entry recovery 0.6 s; camera roll ≤ 10 % of dolphin roll. FOV 55° vertical initial (R6); far plane 900 in the pool, 2500 in the region [DERIVED: region diagonal 2.83 km; underwater visibility is fog-bounded regardless]. Acceptance: dolphin 8–18 % frame width (target 10–15 %), 40–60 % height in NormalFollow; transient excursions only in Airborne/Obstructed/TerrainCompressed states. Camera states per Track E §19 (NormalFollow, SlowHover, FastTravel, TerrainCompressed, Obstructed, SurfaceTransition, Airborne, ReEntryRecovery, EmergencyRecenter), blends 0.2–0.5 s.

### 7.6 Animation plan (checkpoint 01) [Track C §2 inventory MEASURED; Track E §11 mechanism]

8 clips in the GLB: `SwimForward` (2.000 s, primary cruise), `SwimForwardFast` (0.667 s), `SwimLeft`/`SwimRight` (bank cycles), `SwimUp`/`SwimDown` (pitch cycles), `Jump` (2.000 s one-shot, **~2 m baked root motion — strip/zero the `Dolphin_Root` translation track at load**), `BreatheSurface` (2.333 s). Mandatory: **never render without an active AnimationAction — the rest pose is nose-down; start `SwimForward` on frame 0 before first render** [Track C Item 3 gotchas]. One `AnimationMixer`; base clip cross-fade by speed band (0.2–0.4 s): idle = SwimForward @ timeScale 0.7 below 0.75 m/s; cruise = SwimForward; fast = SwimForwardFast above 70 % of cruise-to-burst span [DERIVED band edge, review item]; turn/pitch clips blended by yaw/pitch rate; `BreatheSurface` at sustained surface; `Jump` LoopOnce + clampWhenFinished for breach. timeScale band 0.7–1.6 tied to kick cadence, never linear with velocity [Track E §11]. Additive spine-curvature/bank layers via `AnimationUtils.makeClipAdditive` **before** action creation (forum-documented over-scale pitfall). Missing clips (braking, idle, flinch) are post-checkpoint Blender work from `Dolphin.fbx` [Track C Item 6] — slow-played/reversed stand-ins until then; never a re-render without a clip.

### 7.7 Pool-phase world sampling (checkpoints 01–02) [DERIVED integration parameter]

The vendored demo pool is 2×2 units × 1 deep [DOC, Track B Table 1 — the Wallace-original box bounds; jeantimex's own source was robots-blocked to Track B, so checkpoint 00 §6.4 grep-confirms these bounds before anything relies on them]. The demo mounts at a uniform scene scale **K = 7.5 m per demo unit** → pool interior 15 m × 15 m, 7.5 m deep, sea level y 0. Derivation (both bounds cited): cruise-turn circle at 5 m/s and 90°/s has diameter ≈ 6.4 m — the tank must hold ≈ 2× that → K ≥ 6.5 [Track E Table B]; sim texel 2/256 units × K must stay ≤ ~0.6 m for a readable wake → K ≤ 7.7 [Track B Table 3]. Shaders untouched (the scale is a mount transform; water-system inputs map world↔demo by ÷K). `PoolSampler` implements `WorldSampler` analytically: `inWater` = inside the pool rectangle; `shoreDistance` = distance to the nearest wall; `depthAt` = 7.5 m. Deleted with the region at cp04A.

### 7.8 Enjoyment acceptance criteria (recurring review items) [Track E §22; 01_NEW_DECISIONS]

At cp01/02 (pool) and re-run at cp04B/05/06 (region): a 10-minute no-objective swim stays pleasurable; one pump every 1–2 s sustains a gentle glide (low input, non-fatiguing); turning feels like a dolphin, not a flying camera; the camera never surprises (no snaps, never loses the subject > 0.3 s, no nausea, coverage bands hold); glide-per-kick distance reads graceful; breach achievable from ordinary play within seconds of intent; breach airtime tracks speed monotonically; no wedging anywhere. The final bar [GOVERNED, 01_NEW_DECISIONS]: ordinary swimming without missions stays enjoyable for an extended period, the way Ecco is.

---

## 8. The asset plan [Track C]

### 8.1 The dolphin (in hand — checkpoint 01) [Track C §1, all MEASURED/WEB-verified]

- License **CC-BY 4.0** verified at the live listing (`sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8`, GAMICO). Commercial use, modification, redistribution permitted; **attribution mandatory** and must remain accessible to all end users.
- Files: `/Users/lekan/Downloads/dolphin-models/dolphin-fbx.glb` **is the GLB** (naming swapped vs contents — Track C warning); `dolphin-glb.zip` holds `source/Dolphin.fbx` + 4 Unity PNGs (authoring source; no GLB inside). Copy the GLB to `apps/shared-world/public/models/dolphin/dolphin.glb` + `LICENSE-dolphin.txt` (CC-BY text + the attribution string below).
- GLB: valid glTF 2.0, zero plugins needed (no Draco/KTX2), 1 mesh 4,314 tris / 2,886 verts, 1 skin (17 joints), 8 animations, 3 embedded 4096² PNGs (~21 MB), metallic-roughness already repacked by Sketchfab (channel correctness pending the flank-sheen visual check — cp01 review item), pre-computed tangents, `roughnessFactor 0.6`, doubleSided. `frustumCulled = false` on the skinned mesh.
- **2.89 m nose-to-fluke at scene scale 1.0; faces +Z with +Y up while a clip plays; origin at skeleton root mid-body.**
- Attribution string (exact, in `CREDITS.md` + in-app credits + `LICENSE-dolphin.txt`):
  > "Realistic Dolphin | Rigged with 25+ Animations" by GAMICO (https://sketchfab.com/gamico) is licensed under CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8 — Modified for BodyArcade (see CREDITS.md for changes).

### 8.2 Approved-asset list and pipeline

Pre-approved now: the GAMICO dolphin (character, fixed) and SeedThree as offline vegetation baker (MIT; swap-if-too-costly clause). Everything else in Track C §3/§6 is a **recommendation requiring user approval before download/commit** (checkpoints 08/09/10/12 carry the approval steps — cp08's terrain-texture sets and cp10's re-texture sources included, each raisable async as early as ready; CC0 sources — Kenney, Quaternius, Poly Haven, ambientCG — still get a live license-page check recorded in `CREDITS.md`). Agents purchase nothing; paid items (Superhive coral, Fab twin) are labels only. SeedThree bakes are **re-textured with CC0/own maps** (avoid inheriting gpt-image-2 / Stable Audio / xeno-canto questions [Track C §5]). Delivery: `.glb`, Y-up, meters, +Z forward; texture budgets per Track C §8 (hero 2K, wildlife 2K, rock 1–2K, vegetation 1K cards, ground 1–2K tiled, sprites 256–512); snake_case category-prefixed names; drop paths under `apps/shared-world/public/{models,textures,audio}/...`; `CREDITS.md` at repo root mirrored by an in-app credits panel (checkpoint 13 adds audio credits; the panel ships with the first CC-BY asset — the dolphin, cp01).

### 8.3 Placeholder legend [category → color, hex traced to Track D table 6.2 accents; placeholder policy GOVERNED §9.3]

Every missing asset = a simple rectangular block/primitive at intended position/scale/orientation/footprint/density, color-coded, dev-mode labeled, visually obvious:

| Category | Hex | Trace |
|---|---|---|
| Rock / reef formation | #7C8468 | family-A rock |
| Plate/soft coral, anemone, sponge | #D97A4A | family-B coral orange |
| Kelp | #3E9B3A | kelp green |
| Seagrass / ground vegetation | #5E8A50 | family-E green tufts |
| Tree / shrub (exposed land) | #3E6B2E | jungle cliff green |
| Flower accent | #C05A9E | family-B magenta plant |
| Ruin / ancient structure | #9AA79A | family-A ruin columns |
| Building / dock | #A9784A | bare-rock cliff tan |
| Wreck | #8C9296 | shark grey |
| Fish-school volume | #D0452F | family-C red fish |
| Large marine animal | #D08038 | family-B turtle orange |
| Cave module (pre-asset) | #6E6E76 | family-I grey facets |
| Audio emitter (dev view) | #8E5AD0 | family-C pickup glyph |

### 8.4 Audio slice set (checkpoint 13) [Track C §7; GOVERNED §14]

Above-water ambient loop (Sonniss GDC ★ — user downloads the bundle; klankbeeld Freesound fallback, per-file license check); underwater ambient loop (Freesound #366159 "Underwater [Loop] AMB" by DCSFX, CC0 ★); breach splash (Sonniss ★ / OGA CC0 fallback); surface breathing (Sonniss ★ / OGA fallback); waterline muffle = runtime BiquadFilter low-pass (no asset). Plain WebAudio / `THREE.PositionalAudio`; runtime never generates audio. ElevenLabs only as user-authorized paid-plan fallback. Layout `audio/biomes/reef/...` with the other biome dirs as stubs. Sonniss compliance notes (no resale as-is, no AI/ML-training use) recorded in `CREDITS.md`.

---

## 9. The checkpoint ladder (authoritative)

Base sequence = master context §13.2 (0–14). Adjustments, each with its research cause, per the prompt-writer's sizing rule:

- **04 split into 04A/04B** — cause: Track B specifies two full systems (TERRAIN bake pipeline/loader vs WATER container swap + windowed sim); the baked dataset is the *input* to the water adaptation (Track B data-flow); one session cannot land both in a working state.
- **14 split into 14A/14B/14C** — cause: Track A §8 shows three distinct donor seams (rowing's globe-specific `SphericalMath` must be re-pointed to the planar region; `packages/locomotion` has its own `INTEGRATION.md`; flight's vehicle/camera are globe-coupled). Three mode integrations = three sessions, each demo-terminated.

| CP | Name | Gate type |
|---|---|---|
| 00 | Scaffold and stock demo (vendored pristine; SHA recorded; assumption sites grep-confirmed) | Demo review |
| 01 | Dolphin in the pool (asset + sim port + feel retune §7.4 + animation §7.6; pool mount §7.7) | Demo review |
| 02 | Pool camera (Track E rig §7.5; waterline crossings; shots c/d) | Demo review |
| 03 | Region-layout gate (2–3 sketch maps; **no build**) | **Decision gate** |
| 04A | Region bake and loader (approved sketch → §2.3 artifacts; WorldSampler re-point; terrain preview) | Demo review |
| 04B | Pool → region water (container swap §4.2; windowed sim §4.3; four-shot §4.4) | Demo review |
| 05 | Terrain across the waterline (chunked LOD; islands; masking above+below; BVH camera collision; slide/anti-wedge) — **completed**; approved as the technical terrain foundation, explicitly **not** the final terrain geology or material appearance [addendum §2.2] | Demo review (approved) |
| **05A** | Terrain relief and substrate color rework (deterministic ZyFou-adapted ridged/domain-warped rebake preserving the approved Twin Bay layout; one shared above/below-water substrate classification and color system expanding `RegionWallColor`) [addendum §4] | Demo review |
| **05B** | Ambient ocean surface motion and terrain-boundary interaction (continuous restrained swell + animated underside refraction at idle; persistent low-level shoreline/terrain-contact ripples; jeantimex system and approved water character preserved) [addendum §5] — implemented at `fab3098`; visual gate mooted by the ocean replacement [ocean addendum §3] | Demo review |
| **05C** | **Ocean replacement (WaterThreeJS port)** — region water/sky/optics/post replaced wholesale by the ported procedural ocean; sandy-blend seafloor albedo; time-of-day cycle; terrain relit linear-HDR; suite replaced [ocean addendum §4] | Demo review |
| 06 | **Breach, re-entry, and cross-waterline continuity** — re-scoped: cross-waterline optics arrive with the 05C ocean; remaining scope is the breach chain, camera states, splash/foam via the contact-foam mechanism, and validation [ocean addendum §5; addendum §6 for the behavior law] | Demo review |
| 07 | Placeholder world (every §8.3 category per approved layout + Track D densities; X/Z preserved, Y/normals resampled; terrain color never reduces the placeholder requirement) — re-run on this line over the 05C pipeline [addendum §7; ocean addendum §6] | Demo review |
| 08 | **Atmosphere zones and final tuning** — re-scoped: per-zone underwater extinction/palette dials through the 05C ocean/post mechanisms; final substrate palette pass; four-shot and "jeantimex mechanisms only" retired [ocean addendum §7] | Demo review |
| 09 | Caves and overhangs (Kenney kit + Blender; Rapier heightfield+trimesh; BVH queries; dark-zone atmosphere; shafts; every seam revalidated against the 05A heightfield) [addendum §9] | Demo review |
| 10 | Vegetation and later asset passes (user-supplied or explicitly approved assets/workflows only; SeedThree only for categories it actually produces; replaces placeholders category by category) [addendum §10] | Demo review |
| 11 | Fish and ambient life motion (schooling/drift on placeholders or supplied models; Track D budgets) | Demo review |
| 12 | Ruins and architecture (user-approved assets replace their placeholders; async license gate) | Demo review |
| 13 | Minimal audio pass (§8.4) | Demo review |
| 14A | Rowing view over the region | Demo review |
| 14B | Walking view over the region | Demo review |
| 14C | Flight view over the region | Demo review |

Revised-order provenance: 05A/05B insertion, the 06 and 08 renames, and the 07/09/10 amendments come from the post-CP05 addendum (§3 there); the 05C insertion, the 06/07/08 re-scopes, and the retirement of the four-shot/fallback-ladder machinery come from the ocean-replacement addendum (`decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`), the newest user decision. The side-branch CP06/CP07 implementations (`bodyarcade-shared-world-cp06-cp07`) are superseded and not in this line's history. Rows 11–14C are unchanged in identity; the addendum §10.3 asset gate (no invented substitutes, no terrain-color substitution, placeholders until explicit approval, category-by-category replacement) binds every asset pass from 10 onward. Authoritative prompt files live in this directory (`CHECKPOINT_05A_TERRAIN_RELIEF_AND_SUBSTRATE_COLOR.md`, `CHECKPOINT_05B_AMBIENT_OCEAN_SURFACE_MOTION_AND_BOUNDARY_INTERACTION.md`, `CHECKPOINT_06_BREACH_REENTRY_AND_CROSS_WATERLINE_CONTINUITY.md`, and so on — see `CHECKPOINT_INDEX.md`). CP06 requires explicit prior approval of both 05A and 05B. Nothing in this table authorizes starting any checkpoint.

Definition of done for the slice [GOVERNED §13.3]: full region loop in ~5–10 min; breach at ≥3 sightline spots seeing islands/terrain; ≥1 cave and ≥1 arch passed through; placeholders present for every category; four-shot fidelity passes; 60 fps sustained per §10.

---

## 10. Performance budget [Track B Q11 — all render figures ESTIMATED until checkpoint profiling]

Target: **sustained 60 fps at ≈1728×1080** on the M-class MacBook Pro, desktop Chrome, WebGL2; dynamic resolution allowed. Frame budget 16.6 ms:

| Stage | Est. cost | First asserted |
|---|---|---|
| Wave sim (512² windowed, 2 steps) | ~0.3 ms | 04B |
| Normal pass | ~0.1 ms | 04B |
| Caustics (1024², terrain raymarch) | ~0.5–1.0 ms | 04B |
| Terrain + coastline walls (~1–2 M tris, triplanar) | ~2–3 ms | 05 |
| Water surface above/below raymarch | ~2–4 ms (dominant risk; if > 4 ms, reduce raymarch steps or window coverage before any ladder escalation) | 04B |
| Objects (dolphin, instanced flora) | ~1–2 ms | 01/10 |
| Post/UI | ~0.5 ms | — |
| **Render subtotal** | **~7–11 ms** | — |
| **Pose-tracking reserve (held out even in keyboard demos)** | **~5 ms** | always |

Degradation order [GOVERNED §12.2]: secondary density and effects (particles → flora instances → school sizes → caustic resolution) degrade **before** the defining features — water presentation, fog, dolphin animation, camera, terrain silhouettes, breach view. Every checkpoint's performance report includes: median/min fps over a scripted 10 s swim, render resolution, per-stage GPU/CPU breakdown where measurable, `simHz`, and memory. Playwright asserts `simHz > 100` always and sustained median `fps ≥ 58` (60-target with vsync jitter allowance; methodology stated in the report) at 1728×1080 — never weakened, no `|| true`, no environment excuses on native hardware.

## 11. Verification standard (every checkpoint session produces)

1. **Live local demo** — exact commands + URL + what to try (each checkpoint prompt pins these).
2. **Summary of changes** — files touched, systems added, constants changed (old → new).
3. **Placeholder inventory** — every placeholder present, per category, with counts (from cp07 onward; before that, list which categories exist yet).
4. **Performance report** — per §10.
5. **Deviations list** — every departure from the checkpoint prompt or this master, with cause; provisional values used ([BVM]/[EST]/[REC]) restated so the user knows what is estimate-backed.
6. **Suite state** — full applicable Playwright run, pass/fail/skip listed; committed eval artifact updated.
7. **Then STOP and wait for review.** Approval of one checkpoint never authorizes the next.

### 11.1 Test-migration map [Track A §10.2 — binding]

Carry every dolphin-suite assertion: boot (drop the OSM-attribution check; assert the authored region credit instead); keyboard fallback; impulse-glide cadence coupling; signed pitch/roll; burst; dropout-autopilot (max pitch step < 0.12 rad/100 ms); replay determinism as **self-consistency** (same script → same digest across reloads; old digests invalid by design); 8-direction containment battery re-pointed at the authored shoreline (never exits, never hard-walls, min-speed floor, decel bound restated for 5/9); breach positive + negative; performance (§10); topology (producer → BroadcastChannel → game, self-skipping without fixtures); HUD suite for the runtime boot. New suites arrive with their checkpoints: pool-mount sanity (01), camera coverage bands (02), bake determinism + loader round-trip (04A), four-shot fidelity (04B/08), shoreline masking above/below (05), breach-over-region + airtime monotonicity (06), placeholder census vs placement.json (07), zone fog/caustic uniform checks (08), cave collision + shaft placement (09), instancing budgets (10), school budgets (11), credits-vs-assets audit (12), audio wiring (13), per-mode smoke + shared-terrain law (14A–C).

## 12. Open items and user actions (consolidated; never invented around)

**Blocking at their checkpoint:**
1. **Region sketch choice** — cp03 decision gate (pick or redline one of 2–3 maps).
2. **Ruins/architecture asset approvals** — cp12 (Track C candidates; per-item live license verification precedes commit). Same approval flow for cave-kit (cp09) and any non-preapproved vegetation fallback (cp10) — raise async as early as ready.
3. **Fish models (~3, user-supplied)** — cp11 runs on placeholder schools until they arrive.
4. **Sonniss GDC bundle download** (user action) or ElevenLabs paid-plan authorization — cp13.

**Non-blocking (upgrade estimates when done):**
5. PCSX2 capture sheet (Track D §19; priority 1 = palettes + fog) — replaces every [BVM]/[EST] visual value via Track D §20.
6. Native movement captures (Track E §24, P1 items first) — replace impulse/drag/camera-constant estimates.
7. GAMICO 8-vs-"25+" clip re-download check / creator contact (Track C Item 2).
8. Dolphin metallic-roughness flank-sheen + normal-map lit-sphere check — cp01 review item (repair path from ZIP originals documented in Track C Item 4).
9. ~~Track D above-water sky values — deferred, approval-pending (R11).~~ **Resolved 2026-08-08**: the region sky is the WaterThreeJS procedural atmosphere (ocean-replacement addendum §2.3).
10. Track E comparison candidates at reviews: speeds 10/17.5, GLIDE_TAU ≈ 2.9 s, PITCH_RATE 100°/s, KICK_IMPULSE 2.25 (§7.2/§7.4).
11. 180° quick turn (R10) and body-brake remap (R9) — pending user-assigned bindings/decision.
12. Pitch-inversion default: shipped W-dives semantics kept; toggle is a user decision [Track E §27].
13. Exact Mac GPU core count (Track B needs-user) — checkpoint profiling supersedes.
14. ProceduralTerrains GLB export presence — not depended on (the §5.1 path uses heightmap PNG only).
15. Repo-hygiene records from Track A (user-owned, orthogonal): mac-prep docs salvage; V8 disposition; TinySkies pre-public licensing sweep (F2/F13).
16. Caustic-uniform dials and any normal-relief option require explicit user approval at cp08 (Track D needs-user 3).

---

*End of implementation master. The checkpoint prompts (`CHECKPOINT_00…14C`) are the executable form of this document; where a checkpoint prompt and this master disagree, report the discrepancy at the checkpoint review rather than resolving it silently.*
