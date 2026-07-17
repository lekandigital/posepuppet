# TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md
Stage-2 Research — Track C of five (Assets, Audio & Dolphin Audit) — BodyArcade Shared-World
Research date: 16 July 2026. Researcher output only — nothing herein authorizes purchase, download, or asset generation.

## Legend (every claim labeled by evidence class)
- **[WEB]** verified fact from a web source (URL cited inline).
- **[LOCAL]** technical conclusion established by TRACK_C_LOCAL_DOLPHIN_MODEL_AUDIT.md (treated as authoritative fact; not re-derived).
- **[REC]** recommendation / inference / estimate by this researcher.
- **[OPEN]** unresolved / pending-local-verification / needs-user decision.

> Note on document access: the eight governing docs at `/mnt/user-data/uploads/` were supplied as task context. The local dolphin binary audit could not be re-opened as a fetchable URL during the web-research session, so binary-file findings were originally marked **[OPEN] pending-local-verification**. **Reconciliation update (16 July 2026):** this report has since been reconciled against `TRACK_C_LOCAL_DOLPHIN_MODEL_AUDIT.md` (dated 2026-07-16); all former pending-local-verification placeholders now carry that audit's measured findings, labeled **[LOCAL]**. Only items neither session could resolve (visual validation under jeantimex water, the 8-vs-"25+" clip discrepancy, per-asset licensing checks, Track E reconciliation) remain **[OPEN]**.

---

## Executive Summary
- **Checkpoint-1 verdict: UNBLOCKED, conditional on one mechanical confirmation.** The GAMICO "Realistic Dolphin | Rigged with 25+ Animations" listing is live and licensed **CC-BY 4.0**. Verified verbatim at the live listing: "License: CC Attribution Creative Commons Attribution" (links `creativecommons.org/licenses/by/4.0/`), "Triangles: 4.3k · Vertices: 2.4k," "Published … May 12th 2026," now showing 298 downloads / 1,069 views. **[WEB]** Commercial use, redistribution, and modification are all permitted; attribution is mandatory. The character is approved (per §01 pin). Of the two formerly conditional items: (1) the animation-clip roster is now **resolved [LOCAL]** — both local files carry the same **8 clips** (`SwimForward`, `SwimForwardFast`, `SwimLeft`, `SwimRight`, `SwimUp`, `SwimDown`, `Jump`, `BreatheSurface`); the advertised "25+" are **not** in the local downloads (**[OPEN]** whether a re-download yields more — see Item 2); (2) the Unity→glTF MetallicSmoothness texture-conversion is **already repacked to glTF convention in the GLB [LOCAL]**, with only the flank-sheen **visual check under jeantimex water still [OPEN]**.
- **Possession ≠ license — but the license is clean.** CC-BY 4.0 verified at the primary source means the dolphin is usable commercially **only if** attribution is published in both the in-app credits panel and repo `CREDITS.md` (and it must remain accessible to all end users, per Sketchfab policy). This attribution obligation is the single most important compliance item Track C creates.
- **Asset strategy is decisive:** lean on CC0 libraries (Poly Haven, Quaternius, Kenney, ambientCG) for rocks/terrain/props; use SeedThree (MIT) offline bakes for vegetation (kelp, seagrass, branching coral); fill identity gaps with Sketchfab CC-BY models (manta ray, sea turtle, ruins). The audio slice is fully coverable from CC0 Freesound + royalty-free Sonniss sources, with ElevenLabs (paid tier) as a generation fallback. **Every candidate below is a recommendation for user approval; nothing is selected, purchased, downloaded, or generated.** The only pre-approved items are the GAMICO dolphin (character) and SeedThree (vegetation baker, with sanctioned swap-if-too-costly clause).

---

## 1. Dolphin Audit Report — seven blocking items + verdict

### Item 1 — Exact current license, attribution, and where it lives
**[WEB]** At the live listing (`https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8`) the license field reads verbatim: **"License: CC Attribution — Creative Commons Attribution,"** linking to `http://creativecommons.org/licenses/by/4.0/`. Published **12 May 2026** by GAMICO (`https://sketchfab.com/gamico`). This is **CC-BY 4.0**.

**[WEB]** Sketchfab's own policy (`support.fab.com` — "Crediting users for 3D model downloads"): "If you downloaded a Sketchfab model under a Creative Commons (CC) license, giving credit is a necessity (unless the model is licensed as CC0). By downloading a CC model from a Sketchfab user, you agree to credit that user wherever you publicly reuse their work." The Sketchfab Download API guidelines (`sketchfab.com/developers/download-api/guidelines`) add that attribution "must follow the asset everywhere it is used… the original creator attribution must be accessible to all end users."

**[WEB]** CC-BY 4.0 (`creativecommons.org/licenses/by/4.0/`) requires: give appropriate credit, provide a link to the license, and indicate if changes were made. **Commercial use: permitted. Redistribution (incl. modified): permitted. Modification: permitted (must indicate changes).**

**[REC] Exact attribution string to use** (satisfies CC-BY 4.0 + Sketchfab policy):
> "Realistic Dolphin | Rigged with 25+ Animations" by GAMICO (https://sketchfab.com/gamico) is licensed under CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8 — Modified for BodyArcade (see CREDITS.md for changes).

**[REC] Where attribution lives:** (a) in-app credits panel (Settings→Credits), (b) repo `CREDITS.md`, and (c) a `LICENSE-dolphin.txt` alongside the model file in the drop path (see Item 7). All three must remain accessible to end users.

### Item 2 — Do the free files contain the full rig and all advertised animations?
**[LOCAL] Full rig: yes. All advertised animations: no.** The local audit measured both binaries directly:
- **Same asset, different containers.** Both files contain GAMICO's dolphin from a pack internally named `ANIMALS FULL PACK\Ocean Animals Pack Vol 1\Dolphin`. **Naming warning:** the two local filenames are swapped relative to their contents — `dolphin-fbx.glb` is the **GLB** (Sketchfab auto-conversion, generator `Sketchfab-17.14.0`); `dolphin-glb.zip` is the Sketchfab "original format" download containing `source/Dolphin.fbx` (ASCII FBX 7.7) plus four Unity-convention PNGs (`T_Dolphin_BaseColor/MetallicSmoothness/Normal/Occlusion.png`). **The ZIP contains no GLB.**
- **GLB object counts:** valid glTF 2.0, self-contained (single buffer, no external URIs), **no extensions** (no Draco, no KTX2). 1 scene, 28 nodes, **1 mesh** (`SK_Dolphin_M_Dolphin_0`, 1 primitive), **1 skin (17 joints)**, **1 material** (`M_Dolphin`), **3 embedded PNG textures**, **8 animations**, 0 morph targets, 0 cameras/lights.
- **Mesh:** 2,886 vertices / **4,314 triangles** in the GLB (the FBX stores 2,427 unique positions and the identical 4,314 triangles — the GLB's higher vertex count is normal UV/normal seam-splitting, not added geometry). This matches the listing's advertised "4.3k tris / 2.4k verts" **[WEB]**.
- **Skeleton:** 17 deforming joints — `_rootJoint` → `Dolphin_Spine1/2` → head+jaw, one bone per pectoral fin, a 6-segment tail chain, and 2-bone caudal flukes per side. The FBX contains the identical skeleton (no extra bones hiding in the source).
- **Animations: exactly 8 clips, identical in both files** (FBX: 8 `AnimationStack`/`Take` blocks, names and durations matching the GLB). **The "25+ animations" advertised by the listing title are not present in either local file.** The embedded `asset.extras` block self-reports author GAMICO, CC-BY-4.0, and the pinned listing URL — consistent with, and now confirmed by, the live-listing verification in Item 1.

**[WEB] Corroboration of advertised contents:** the live Sketchfab viewer carries the **"Animated" badge** and a video embed (animation plays in-viewer), and the listing advertises "fully rigged and includes 25+ built in animations." The Fab paid twin (`https://www.fab.com/listings/8ab4a749-a18e-4a33-8754-a347573f8a2b`) lists "Included formats: fbx" and is priced **$3.99** — it is the **same single-FBX asset**, not an animation up-sell. So the free CC-BY download is the substantive asset, not a stripped teaser.

**[REC] Series-pattern evidence:** GAMICO's "…Rigged with 25+ Animations"-titled models carry the Animated badge, whereas a sibling "Realistic Crocodile 3D Model - Rigged" listing explicitly **withholds** animation — verbatim: **"I WILL PROVIDE ANIMTION ONCE I SEE SOME GOOD RESPONSE ON THIS MODEL"** — and lacks the Animated badge. The dolphin belongs to the animated-badge group (as does the "Realistic Rhino | Rigged with 25+ Animations," 6.6k tris / 3.3k verts, which similarly states "fully rigged and includes 25+ built in animations"), so the dolphin free FBX is expected to embed clips — and it does embed clips, but only 8.

**[OPEN] Remaining discrepancy — 8 local clips vs. the advertised "25+":** the listing does not publish a named clip list, and the local downloads contain exactly 8 clips, so it cannot be determined offline whether (a) the "25+" is marketing that counts variants, (b) the remaining clips are Fab/paid-only per GAMICO's series pattern, or (c) a re-download of the free file would yield more. **Action:** re-check the live download and/or ask GAMICO before concluding clips are missing. This does **not** block checkpoint 1 — the 8 present clips cover the checkpoint swim loop (see Items 3 and 6). The former contingency ("if the GLB has zero animation channels, export from FBX") is closed: both files carry the same 8 clips, so no FBX→glTF animation export is needed for these; `Dolphin.fbx` remains the authoring source for the clips that are genuinely absent (braking, idle, flinch).

### Item 3 — Exact animation clip list
**[LOCAL]** The Sketchfab listing does **not** publish a named clip list (only the "25+" marketing claim) **[WEB]**, so the local files are the authoritative enumeration. The audit measured the full roster from GLB keyframe data (identical names/durations in the FBX):

| # | Clip | Duration | Channels | Root translation range (`Dolphin_Root`, cm) | Root rot max-dev / returns-to-start | Loop suitability *(audit inference)* |
|---|---|---|---|---|---|---|
| 0 | `BreatheSurface` | 2.333 s | 29 | 17.2 (Z) | 23.5° / yes (0.00°) | Loopable; surface bobbing built in |
| 1 | `Jump` | 2.000 s | 29 | **198.8 (Z, vertical) + 2.3 (Y)** | 37.8° / yes | One-shot; **~2 m baked root motion** |
| 2 | `SwimDown` | 1.333 s | 29 | 8.7 | 16.6° / yes | Loopable pitch-down cycle |
| 3 | `SwimForward` | 2.000 s | 29 | 4.2 | 3.1° / yes | **Primary cruise loop** |
| 4 | `SwimForwardFast` | 0.667 s | 27 | 4.2 | 3.1° / yes | Fast-swim loop |
| 5 | `SwimLeft` | 1.333 s | 29 | <0.1 | 21.8° / yes | Loopable banked-turn cycle |
| 6 | `SwimRight` | 1.300 s | 29 | <0.1 | 20.4° / yes | Loopable banked-turn cycle |
| 7 | `SwimUp` | 1.333 s | 29 | 4.4 | 19.0° / yes | Loopable pitch-up cycle |

**[LOCAL] Clip mechanics:** every clip targets the same 18 nodes (all 17 joints plus `Dolphin_Root`, the effective animation root for root-motion purposes; node `Dolphin` additionally gets a single orientation key). Interpolation is **LINEAR throughout** (no STEP/CUBICSPLINE); keyframe density ≈ 30 keys/s. **All clips end where they start** (root rotation first-vs-last ≤ 0.06°) — the turn clips are *lean/bank cycles*, not baked continuous turns, which is correct for a controller that steers via gameplay code and layers animation on top (matches the Ecco-feel plan).

**[LOCAL] Two behavioral gotchas:** (1) **Rest-pose trap** — the static rest transforms do *not* equal the bind pose; rendered with no animation playing, the dolphin poses nose-down. Every clip's first frame restores correct orientation. **Never render the skinned dolphin without an active `AnimationAction`; start `SwimForward` on frame 0 before first render.** (2) **`Jump` bakes ~2 m of vertical root motion** into `Dolphin_Root`; playing it raw while gameplay code also moves the dolphin doubles the displacement — strip/zero the root translation track at load (`THREE.AnimationClip` track filtering, trivial) or let the clip drive the breach with physics suspended.

### Item 4 — Texture conversion status (Unity MetallicSmoothness → glTF metallic-roughness)
**[WEB/context]** `dolphin-glb.zip` ships Unity-convention textures. Unity packs **smoothness in the alpha channel** of the Metallic map; glTF 2.0 requires a **metallic-roughness** texture where **roughness = 1 − smoothness**, with roughness in the **green** channel and metalness in the **blue** channel (KHR core spec). A raw copy is visually wrong (surface reads far too glossy/plasticky).

**[LOCAL] Conversion status: already repacked in the GLB.** Sketchfab's converter produced a **single combined occlusion + metallic-roughness image** (texture 1 serves both `metallicRoughnessTexture` and `occlusionTexture`) whose byte size and color type differ from both ZIP originals — i.e., the GLB does **not** re-embed the Unity textures; it was repacked to glTF convention (occlusion=R, roughness=G, metallic=B, smoothness inverted to roughness) during conversion. The audit notes the *repack itself is measured* (shared image, new file) but the *correctness of the channel contents* is inferred from Sketchfab's standard pipeline — hence the visual check below remains **[OPEN]**.

**[LOCAL] Material and texture facts (GLB):** material `M_Dolphin` is metallic-roughness PBR, `doubleSided: true`, opaque, no emissive; `roughnessFactor: 0.6` (multiplies the texture's roughness channel); no `metallicFactor` specified (spec default 1.0, modulated by the texture's blue channel). All **3 images are embedded** PNGs at **4096×4096** (baseColor 8-bit RGB ~3.6 MB; combined ORM 8-bit palette-indexed ~4.5 MB; normal 8-bit RGB ~13.0 MB); sampler LINEAR / LINEAR_MIPMAP_LINEAR, REPEAT. None external. The mesh also carries pre-computed `TANGENT`s (no runtime tangent generation needed for the normal map) plus a second UV set (`TEXCOORD_1`, unused by the material — likely a Unity lightmap/AO channel; harmless).

**[LOCAL] FBX texture wiring (repair path):** the FBX references **only** `T_Dolphin_BaseColor.png` and `T_Dolphin_Normal.png`; MetallicSmoothness and Occlusion ship in the ZIP but are **not wired into the FBX material** — any Blender re-import must connect them manually. If the visual check fails (chrome-like = metallic stuck high; uniformly chalky = roughness inverted), re-derive in Blender from the ZIP originals: `roughness = 1 − smoothness_alpha`, `metallic = RGB of MetallicSmoothness`, occlusion from `T_Dolphin_Occlusion`. The ZIP retains everything needed for that repair.

**Visual check under jeantimex water [REC]:** place the dolphin under the jeantimex caustic/God-ray water rig. A **correct** conversion shows soft, broad, skin-like specular roll-off with caustics gently sliding across the back; an **unconverted** (smoothness-as-roughness) map shows a hard, mirror-like hotspot and over-bright rim. Also confirm the normal map is glTF tangent-space (+Y / OpenGL green) — Unity uses the same +Y so no channel flip is expected, but verify on a lit-sphere test. (Poly Haven ships both "Normal (DX)" and "Normal (GL)" variants for its textures, a reminder to always confirm green-channel orientation per asset.)

### Item 5 — Material/skin suitability under jeantimex lighting
**[LOCAL] Current state:** the GLB material already ships `roughnessFactor: 0.6` (within the recommended wet-skin band below) and `doubleSided: true`; metalness is driven by the texture's blue channel (no `metallicFactor` override, spec default 1.0) — so if the flank-sheen check reads chrome-like, force `metalness = 0` per the recommendation below.
**[REC]** Dolphin skin is a low-specular, high-subsurface-feel dielectric. Under jeantimex water: (a) metalness = 0; (b) roughness ≈ 0.45–0.6 for wet-skin sheen without a plastic hotspot; (c) normal-map strength ≈ 0.5–0.7 so PS2-era caustics read as soft light bands rather than harsh micro-detail; (d) fog-consistent rim contributed by the scene, not the material, to match Ecco's documentary-naturalistic, fogged target. Anticipated adjustments: a single Blender material tweak pass; no re-authoring. **[OPEN]** exact base-color saturation to be validated against PS2 Ecco reference frames — note the PS2 release used **more color-saturated but not more detailed** environmental textures than the Dreamcast original (see §6).

### Item 6 — Gap analysis vs. needed clip set
Needed set (from prompt): cruise swim, fast swim, banking left/right, braking, breach/leap, airborne, re-entry, idle/hover, surface breathing, collision/flinch. **[LOCAL]** Mapping to the audit's measured clips:

| Needed | Status in local files | Coverage / Blender work *(audit inference)* |
|---|---|---|
| Cruise swim | ✅ `SwimForward` | Direct use |
| Fast swim | ✅ `SwimForwardFast` | Direct use |
| Banking left/right | ✅ `SwimLeft` / `SwimRight` | Bank cycles; blend with cruise |
| Pitch up/down (bonus) | ✅ `SwimUp` / `SwimDown` | Direct use |
| Braking | ❌ absent | Author in Blender (short spread-fin pose) or reverse/slow `SwimForward` segment |
| Breach/leap | ⚠️ `Jump` (single combined clip) | Split `Jump` into launch/airborne/re-entry segments, or use as one-shot |
| Airborne | ⚠️ inside `Jump` | Extract mid-segment or hold a frame |
| Re-entry | ⚠️ inside `Jump` | Extract tail segment |
| Idle/hover | ❌ absent | Slow-play `SwimForward` at low speed *(cheap)* or author |
| Surface breathing | ✅ `BreatheSurface` | Direct use |
| Collision/flinch | ❌ absent | Author in Blender or procedural spine-jolt |

**[LOCAL] Rig fidelity for gap-fill authoring:** the 6-segment tail chain plus 2-bone flukes per side gives good undulation fidelity for Ecco-style swimming; head+jaw allow mouth animation; one bone per pectoral fin (no fin-tip bones) limits fine fin articulation. `Dolphin.fbx` is the authoring source for the three missing clips.
**[OPEN] Track E dependency:** the authoritative animation-state list belongs to Track E (animation-state machine). This report flags the dependency explicitly: the maps-to-need column in §2 must be reconciled with Track E's state graph before checkpoint-1 animation wiring.
**[REC] Blender gap-fill plan** for the missing clips: braking is derivable as a short decel pose or reversed/slowed `SwimForward`; airborne/re-entry come from splitting `Jump` rather than bespoke authoring (~0.5–1 day if a bespoke arc is preferred); collision/flinch is a 0.3–0.5s one-shot (or a procedural spine-jolt); idle/hover is cheapest as slow-played `SwimForward`. All are **post-checkpoint** work, not checkpoint-1 blockers.

### Item 7 — Scale, orientation, forward axis, origin, budgets, drop path
**[LOCAL] Scale & dimensions (measured):** the GLB's Sketchfab fix-up node (`<hash>.fbx`) applies a **uniform 0.01 scale** (centimeters → meters) plus a Z-up→Y-up axis swap; composing the full node chain gives world-space dimensions of **2.89 m nose-to-fluke × 0.99 m belly-to-dorsal × 0.84 m pectoral/fluke span** — a large bottlenose dolphin, **already in real-world meters at 1.0 scene scale**. No rescaling required for a physically-sized jeantimex world.
**[LOCAL] Orientation & origin (measured):** FBX GlobalSettings are `UpAxis = +Y`, `FrontAxis = +Z`, `CoordAxis = +X`, 1 cm units. In the GLB, bind-pose joints put the head at mesh-local +Z and the tail chain toward −Z; with the animated root transforms applied, the rendered dolphin faces **world +Z with +Y up** — exactly the conventional Three.js "model forward" orientation, no manual axis correction needed. **Origin sits at the skeleton root, roughly mid-body/pivot point (not at the nose)** — suitable for banking pivots. Caveat: this correct orientation holds only *while a clip is playing*; the static rest pose renders nose-down (see Item 3's rest-pose trap).
**[LOCAL] Confirmed budgets:** **4,314 triangles / 2,886 GLB vertices** (2,427 unique FBX positions), matching the listing's advertised "4.3k tris / 2.4k verts" **[WEB]**. Textures: three embedded 4096² PNGs ≈ **21 MB download, ~64 MB decoded GPU memory** (more with mipmaps) — fine for a single hero character on the M5 target; a future 2K resize of the 13 MB normal map is the single highest-value size optimization (optional-later, not checkpoint-1).
**[LOCAL] Three.js compatibility:** `GLTFLoader` **loads with zero plugins** (no extensions, no Draco/KTX2, one buffer, embedded PNGs, standard attribute set incl. precomputed tangents). `AnimationMixer` **fully compatible** (8 named clips, LINEAR-only interpolation, standard TRS paths, one skin). Standard skinned-mesh caveat: may need `mesh.frustumCulled = false` if clips move the dolphin far from its static bounds. **Required preprocessing for checkpoint 1: none** — the GLB is usable as-is. Optional-later: strip `Jump` root translation at load; downscale/KTX2 textures; author the 3 missing clips from `Dolphin.fbx`.
**[REC] Recommended repo drop path:** `apps/shared-world/public/models/dolphin/dolphin.glb` with `apps/shared-world/public/models/dolphin/LICENSE-dolphin.txt` (CC-BY text + attribution string) alongside; textures embedded in the GLB or in `.../dolphin/textures/`. Per the audit's naming warning (local `dolphin-fbx.glb`/`dolphin-glb.zip` filenames are swapped relative to contents), the drop-path names should reflect actual contents.

**Checkpoint-1 verdict: UNBLOCKED** (web + local halves now both confirmed). License verified CC-BY 4.0 at the live listing (commercial + modify + redistribute, attribution mandatory) **[WEB]**; the approved character is in hand and technically clean per the local audit **[LOCAL]**: correct real-world scale, correct Three.js orientation when animated, zero-plugin `GLTFLoader`/`AnimationMixer` compatibility, and a usable cruise loop (`SwimForward`) plus speed/turn/pitch variants, a breach one-shot, and surface breathing — precisely the minimum set the checkpoint swim-loop needs. The clip-roster and axis/scale confirmations are **closed**; the *blocked-by-missing-animations* contingency **did not trigger** (both files embed the same 8 clips). Remaining before full sign-off: the metallic-roughness **visual check** under jeantimex water (Item 4, **[OPEN]**). Remaining but non-blocking: the 8-vs-"25+" clip discrepancy (Item 2, **[OPEN]**) and the three missing clips (braking, idle, flinch — post-checkpoint Blender work, Item 6). Operational warnings carried from the audit: never render without an active clip (rest pose is nose-down); handle `Jump`'s ~2 m baked root motion.

---

## 2. Animation Inventory Table
Filled from the local audit's measured clip data **[LOCAL]**. Status: **EXISTS** (clip present) / **PARTIAL** (contained inside `Jump`) / **MISSING** (must be authored). Track E owns the state graph — reconciliation with its state names remains **[OPEN]**.

| Need (gameplay state) | Local clip | Duration (measured) | Loop? | Quality note | Maps-to-need | Status | Gap / Blender work |
|---|---|---|---|---|---|---|---|
| Cruise swim | `SwimForward` | 2.000 s | Yes | primary cruise loop; near-zero root motion (4.2 cm, 3.1° max-dev) | direct | **EXISTS** | none |
| Fast swim | `SwimForwardFast` | 0.667 s | Yes | fast-swim loop | direct | **EXISTS** | none |
| Bank left | `SwimLeft` | 1.333 s | Yes | lean/bank cycle, returns to start (in-place, <0.1 cm root) | blend with cruise | **EXISTS** | none |
| Bank right | `SwimRight` | 1.300 s | Yes | lean/bank cycle, returns to start | blend with cruise | **EXISTS** | none |
| Pitch up (bonus) | `SwimUp` | 1.333 s | Yes | pitch-up cycle | direct | **EXISTS** | none |
| Pitch down (bonus) | `SwimDown` | 1.333 s | Yes | pitch-down cycle | direct | **EXISTS** | none |
| Braking | — | — | No | — | one-shot→cruise | **MISSING** | author (spread-fin pose) or reverse/slow `SwimForward` |
| Breach / leap | `Jump` | 2.000 s | No | **~2 m baked root motion** on `Dolphin_Root` | one-shot | **PARTIAL** | use whole as one-shot, or split into launch/airborne/re-entry |
| Airborne | inside `Jump` | — | — | apex segment | blend | **PARTIAL** | extract mid-segment or hold a frame |
| Re-entry | inside `Jump` | — | — | tail segment | one-shot | **PARTIAL** | extract tail segment |
| Idle / hover | — | — | Yes | — | direct | **MISSING** | slow-play `SwimForward` *(cheap)* or author |
| Surface breathing | `BreatheSurface` | 2.333 s | Yes | surface bobbing built in (17.2 cm Z root) | direct | **EXISTS** | none |
| Collision / flinch | — | — | No | — | one-shot | **MISSING** | author or procedural spine-jolt |

**[OPEN]** Reconcile clip names with Track E state names before wiring. **[OPEN]** 8-vs-"25+" discrepancy (§1 Item 2): a re-download check may add clips before any Blender authoring is scheduled.

---

## 3. Master Asset Manifest (grouped by category)
License baselines verified at source: **Poly Haven = CC0** (`polyhaven.com/license`: "You do not need to give credit… You can redistribute them… even in a product you sell"). **Quaternius = CC0** ("Free to use in personal, educational and commercial projects (CC0 License)"). **Kenney = CC0** (`kenney.nl/support`: "all game assets… are public domain licensed (CC0)… Attribution is not required"). **ambientCG = CC0**. Sketchfab items are **CC-BY 4.0 unless noted** (mandatory attribution) and each must be individually license-verified before use. Poly/texture figures are per-source where published; **[OPEN]** where the source doesn't publish and must be confirmed on download.

Recommendation key: ★ recommended primary; ○ fallback.

### Rocks & reef formations
| Cand | Source | Creator | License (URL) | Attrib? | Cost | Format | Polys | Tex | Rig/Anim | WebGL2 | Blender work | LOD | PS2-Ecco fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Coast Rocks 05 | polyhaven.com/a/coast_rocks_05 | Rob Tuytel (Poly Haven) | CC0 (polyhaven.com/license) | No | Free | glTF/blend/fbx | **1M tris** (decimate) | 8K, 18.3 px/cm, 3m wide; Normal DX+GL supplied | No | Yes | decimate to ~5–15k, soft retexture | 3–4 LODs needed | High — weathered coastal reef rock; matches lush fogged seabed | ★ |
| Coast Rocks 01/02/03 | polyhaven.com/a/coast_rocks_01 | Poly Haven | CC0 | No | Free | glTF | ~1–2M tris | 8K | No | Yes | heavy decimate | yes | High | ○ |
| Rock (Quaternius Ultimate Nature) | quaternius.com/packs/ultimatenature.html | Quaternius | CC0 | No | Free | glTF/fbx/obj | low-poly | baked | No | Yes | recolor only | minimal | Medium (stylized; retune value grouping) | ○ |

### Plate coral / soft coral / anemones / sponges
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig | WebGL2 | Blender | LOD | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SeedThree branching-coral bake | github.com/SkyeShark/SeedThree | SkyeShark | MIT | Yes (MIT notice) | Free | glTF (baked) | tunable | generated | No | Yes | retune L-system for coral | built-in LOD chain | High — controllable silhouette/density (see §5) | ★ (soft/branching) |
| Lowpoly Coral Pack (poly.pizza) | poly.pizza/search/coral | various (Poly-by-Google backups) | CC-BY 3.0 / CC0 varies | Varies | Free | glTF | low | baked | No | Yes | verify per-item license | minimal | Medium | ○ |
| Coral Pack (11 meshes) | superhivemarket.com/products/coralreefpack | Superhive seller | Paid — price TBD | n/a | **Paid (label only)** | fbx/blend | low+high | 2K/4K PBR | No | Yes | import | yes | High | ○ (paid, user decision) |
| Fan/Plate coral (juljulz collection) | sketchfab.com/juljulz/collections/free-under-the-sea-4dd2264fe2104890a79e17e563af1f1d | various | CC-BY (verify each) | Yes | Free | glTF | varies | varies | some | Yes | per-item | varies | Medium-High | ○ |

### Kelp / seagrass
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig | WebGL2 | Blender | LOD | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SeedThree grass/frond bake | github.com/SkyeShark/SeedThree | SkyeShark | MIT | Yes | Free | glTF | tunable | generated | No (runtime vertex-sway shader) | Yes | retune; export glb | LOD+billboard built-in | High — wind-ready, instanced | ★ |
| Kelp (Poly-by-Google backup) | sketchfab.com/3d-models/kelp-from-poly-by-google-bb9161bc862f4136bce92993dc68e489 | IronEqual (backup) | CC-BY (verify) | Yes | Free | glTF | low | baked | No | Yes | verify license, add sway | billboard | Medium | ○ |
| Scan of Kelp & Seaweed | sketchfab.com/3d-models/scan-of-kelp-and-seaweed-on-sand-beach-c9b5ef07047a4b7a90a4ffd6930ec22c | sterlingcrispin | CC-BY (241.6k tris) | Yes | Free | glTF | 241.6k (decimate) | scan | No | Yes | heavy decimate | needed | Low-Medium (beached, not swaying) | ○ |

### Trees / shrubs / flowers / grass & ground vegetation
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig | WebGL2 | Blender | LOD | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SeedThree (10 species + grass/scrub) | github.com/SkyeShark/SeedThree | SkyeShark | MIT | Yes | Free | glTF | tunable | generated PBR | No | Yes | pick/retune species | LOD0-2 + impostor | High for shoreline foliage | ★ |
| Quaternius Ultimate Nature (150 models) | quaternius.com/packs/ultimatenature.html | Quaternius | CC0 | No | Free | glTF/fbx/obj | low | baked | No | Yes | recolor to PS2 palette | minimal | Medium (stylized) | ○ |
| Kenney Nature Kit | kenney.nl | Kenney | CC0 | No | Free | glTF/obj | low | baked | No | Yes | recolor | minimal | Medium | ○ |

### Ruins / buildings / docks / wrecks / shoreline props
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig | WebGL2 | Blender | LOD | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Underwater Ruins (rosenborg) | sketchfab.com/3d-models/underwater-ruins-356e81f64d6d4b589d794e9a5eba2323 | Erik Rosenborg | CC-BY (verify) | Yes | Free | glTF | mid | textured | No | Yes | verify license | maybe | High — Atlantis-like ruins | ★ (ruins) |
| Underwater Ruin (stefan_wr) | sketchfab.com/3d-models/underwater-ruin-beae50562ef44330b0ac1dfa3dcb6483 | Stefan Rudebjer | CC-BY (verify) | Yes | Free | glTF | mid | textured | No | Yes | verify | maybe | Medium-High | ○ |
| Shipwrecks (Sketchfab shipwreck tag) | sketchfab.com/tags/shipwreck | various | CC-BY / CC0 varies | Varies | Free | glTF | varies | varies | No | Yes | per-item verify | yes | Medium (pick weathered, non-modern) | ★ (wreck) |
| Kenney/Quaternius building & dock kits | kenney.nl ; quaternius.com | Kenney/Quaternius | CC0 | No | Free | glTF | low | baked | No | Yes | recolor | minimal | Medium | ○ (buildings/docks) |

### Licensed terrain & ground textures — see §6.

### Fish
**[OPEN] Needs-user:** the user will supply ~3 fish models; these are recommendations to pick from, not selections.
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig/Anim | WebGL2 | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Animated Fish Pack (7 species) | quaternius.com/packs/animatedfish.html | Quaternius | CC0 (free tier) / Source paid | No | Free (part) | glTF/fbx | low | baked | Animated | Yes | ★ (school fill) |
| DigitalLife3D marine species (bass, eel, etc.) | sketchfab.com/DigitalLife3D/collections | DigitalLife3D | CC-BY (verify) | Yes | Free | glTF | mid | PBR | Animated | Yes | ○ (hero fish) |
| Sketchfab CC0 fish (cc0 tag) | sketchfab.com/tags/cc0 | various | CC0 (verify) | No | Free | glTF | varies | varies | some | Yes | ○ |

### Larger marine wildlife (rays, turtles, sharks — Ecco fauna)
| Cand | Source | Creator | License | Attrib | Cost | Format | Polys | Tex | Rig/Anim | WebGL2 | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Manta Ray Swimming (DigitalLife3D Model 84B) | sketchfab.com/DigitalLife3D/collections/animated-models-623db1a4fd8e4a47a73774aa07960fdf | DigitalLife3D | CC-BY (verify) | Yes | Free | glTF | mid | PBR | Animated | Yes | High — Ecco features manta rays | ★ (ray) |
| Sea Turtle (Eloiart) | sketchfab.com/3d-models/sea-turtle-23dcb315dea44f5082b020b04710bd31 | Eloi | CC-BY (verify) | Yes | Free | glTF | mid | 4K albedo/rough/normal | Animated (120f loop) | Yes | High | ★ (turtle) |
| Leatherback/Green Sea Turtle (DigitalLife3D) | sketchfab.com/DigitalLife3D/collections | DigitalLife3D | CC-BY (verify) | Yes | Free | glTF | mid | PBR | Animated | Yes | High | ○ |
| Great Hammerhead / other sharks (DigitalLife3D) | same | DigitalLife3D | CC-BY (verify) | Yes | Free | glTF | mid | PBR | Animated | Yes | High — Ecco predators | ○ |

### Particle/volumetric categories: bubbles, marine snow, suspended sediment, sand disturbance, light shafts
**[REC]** Best implemented as **runtime shader/particle systems, not downloaded models** — but they need small CC0 source textures:
| Category | Approach | Source asset | License | Rec |
|---|---|---|---|---|
| Bubbles | GPU sprite particles | soft round alpha sprite (author or Kenney particle pack) | CC0 | ★ shader + CC0 sprite |
| Marine snow | slow drifting point sprites | tiny speck alpha (author) | CC0/author | ★ shader |
| Suspended sediment | volumetric fog tint + fine noise | noise texture (ambientCG) | CC0 | ★ shader |
| Sand disturbance | decal puff on contact | soft dust sprite (Kenney) | CC0 | ★ shader + CC0 sprite |
| Light shafts (God rays) | jeantimex water supplies caustics; add radial shaft planes | gradient/ray alpha (author) | author/CC0 | ★ shader (no model) |

**[REC] Categories better served by SeedThree bakes than downloaded models:** kelp (✔ wind-ready fronds), seagrass (✔ grass generator), branching/soft coral (✔ after retuning the dichotomous L-system used for saguaro/Joshua tree — coral is morphologically dichotomous). Rocks/reef *rock* formations are better from Poly Haven CC0 scans. Effort estimates in §5.

---

## 4. Critical-Asset Fallback Table
| Critical asset | Primary (★) | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Dolphin (character — fixed) | GAMICO CC-BY 4.0 (in hand; 8 clips confirmed **[LOCAL]**) | Blender-authored clips (braking, idle, flinch; `Jump` split) over the same rig from `Dolphin.fbx` | (no substitute permitted — character is fixed) |
| Reef rock | Poly Haven Coast Rocks 05 (CC0) | Poly Haven Coast Rocks 01/02/03 (CC0) | Quaternius rock (CC0) |
| Kelp/seagrass | SeedThree bake (MIT) | Poly-by-Google Kelp backup (CC-BY, verify) | Quaternius nature (CC0) |
| Branching coral | SeedThree retuned L-system | poly.pizza coral (verify license) | Superhive Coral Pack (paid, user decision) |
| Ruins | Rosenborg Underwater Ruins (CC-BY) | Rudebjer Underwater Ruin (CC-BY) | Kenney kit (CC0) |
| Ray / turtle | DigitalLife3D / Eloi (CC-BY) | Cartoon Manta (jungle_jim, CC-BY) | author simple mesh |
| Ground/sand texture | ambientCG Ground CC0 | Poly Haven Coral Ground 02 (CC0) | cc0-textures.com sand (CC0) |
| Terrain base | Poly Haven CC0 texture set | ambientCG CC0 | author |

---

## 5. SeedThree Evaluation + Alternatives
**[WEB] License:** repository `LICENSE` = **MIT © 2026 SkyeShark** (`github.com/SkyeShark/SeedThree`, README "License" section). **Caveat quoted:** "Generated textures/audio are produced with third-party models (gpt-image-2, Stable Audio 3) and trimmed xeno-canto recordings; check the respective licenses before commercial redistribution of those assets." → **[REC]** For BodyArcade, use SeedThree as an **offline geometry generator** and re-texture bakes with our own/CC0 maps to avoid inheriting gpt-image-2/Stable-Audio/xeno-canto license questions; the MIT-licensed *code* and the *geometry* it produces are clean.

**[WEB] Capabilities (README, verified):**
- Ten species across temperate/desert biomes; two generators — **Weber–Penn** parametric (broadleaf/conifer) and a from-scratch dichotomous **L-system** (desert succulents; merged-tube mesh, rib crests, areole spines).
- Foliage cards with backlit translucency (Barré-Brisebois SSS); per-instance wind.
- **LOD chain + impostors:** LOD0 full → LOD1 reduced → LOD2 baked branch-cards → 2-plane billboard, baked off-thread in a Web Worker.
- Instanced forest ring; wind-animated grass & scrub; procedural rocks; PBR terrain with slope/height blending.
- **glTF export:** "One click writes a `.glb` with merged per-LOD meshes and standard KHR_materials_* extensions (incl. leaf transmission)." — confirms the glTF baking path the project requires.
- WebGPU-first with automatic WebGL2 fallback — **irrelevant to us** because we consume the exported glTF, not the live app (Three.js 0.184 / WebGL2 renders the baked glTF).

**[REC] Fit & implementation effort:**
- Grass/seagrass: near-immediate — grass system exists; retune blade shape + tint; export. ~0.5 day.
- Kelp: adapt a broadleaf/frond preset to tall swaying strands. ~1 day tuning.
- Branching/soft coral: adapt the dichotomous L-system (`saguaro.js`/`joshua-tree.js` templates) — fork rules, split angle, taper. ~2–3 days for convincing coral silhouettes. Highest-value custom use.
- Pipeline: generate → bake glTF → import to repo → instance at runtime with a small vertex-sway shader (per project spec). Adding a species = preset file + textures, no engine changes (README "agent workflow").
- **Sanctioned swap-if-too-costly clause applies:** if coral tuning exceeds budget, fall back to downloaded coral (§3/§4).

| Alternative generator | License / cost | glTF path | Notes | Cost estimate |
|---|---|---|---|---|
| Blender **Sapling Tree Gen** add-on | Free (bundled, GPL) | Blender→glTF | Trees/branching only; manual, no runtime wind/LOD; good for hero pieces | Free; ~1 day/asset labor |
| **Quaternius Ultimate Nature** (pre-made, not a generator) | CC0 | already glTF | Zero generation effort; stylized look needs recolor | Free; ~0.5 day recolor |
| **Blender geometry-nodes / IVY Gen** vegetation | Free | Blender→glTF | Powerful but steep setup; good for vines/soft coral | Free; ~2–4 days setup |
| SpeedTree (commercial) | Subscription (label only, not purchased) | glTF/fbx | Overkill; licensing cost; not recommended | Paid — not recommended |

---

## 6. Texture-Source Table (terrain / ground) — soft, low-frequency, broad-value-grouping PS2 treatment
| Texture | Source | Creator | License | Attrib | Cost | Res | Maps | PS2 fit | Rec |
|---|---|---|---|---|---|---|---|---|---|
| Coral Ground 02 | polyhaven.com/a/coral_ground_02 | Poly Haven | CC0 | No | Free | up to 8K | diff/nrm/rough/disp/AO | High — porous seabed, soft value grouping | ★ |
| Coral Mud 01 | polyhaven.com/a/coral_mud_01 | Poly Haven | CC0 | No | Free | up to 8K | full PBR | High | ○ |
| Coral Gravel | polyhaven.com/a/coral_gravel | Poly Haven | CC0 | No | Free | up to 8K | full PBR | Medium-High | ○ |
| ambientCG Ground0xx (sand/seabed) | ambientcg.com/list?category=Ground | ambientCG | CC0 | No | Free | up to 8K | full PBR | High — pick low-contrast sand | ★ (sand) |
| cc0-textures.com sand | cc0-textures.com/c/sand | CC0 Textures | CC0 | No | Free | 1–2K | diff/nrm/disp/rough/AO | Medium | ○ |
| 3dtextures.me Stylized Sand 001 | 3dtextures.me/tag/ocean | 3DTextures.me | check per-page (CC0/CC-BY) | Varies | Free | 1K | diff/nrm/disp/rough/AO | Medium (stylized) | ○ |

**[REC]** For the PS2 look, downsample to 1–2K, reduce normal strength, and blend toward broad low-frequency value regions. GameSpot's Ecco: Defender of the Future review confirms the target treatment verbatim: **"The environmental textures are generally more colorfully vivid in the PS2 version, but they're not any more detailed, and everything else looks largely identical to its predecessor,"** and notes the underwater "sunlight's refractions… have been seriously toned down for the PS2 version." So: vivid color, low detail, softened caustics.

---

## 7. Audio Mini-Manifest (five slice sounds) + ElevenLabs generation list
Scope (checkpoint 13): above-water ambient loop; underwater ambient loop; breach splash; surface breathing; waterline low-pass muffle (a **runtime BiquadFilter** — no standalone asset, but matched dry/wet beds sourced). Plain WebAudio / THREE.PositionalAudio; runtime never generates audio.

### 7a. License-checked candidate sources
| Slice sound | Candidate | Source | Creator | License | Attrib | Cost | Rec |
|---|---|---|---|---|---|---|---|
| Underwater ambient loop | "Underwater [Loop] AMB" | freesound.org/s/366159/ | DCSFX | CC0 (Public Domain) | No (optional) | Free | ★ |
| Underwater ambient loop | "Underwater Ambience.wav" | freesound.org/people/Tim_Verberne/sounds/482167/ | Tim_Verberne | CC0 | No | Free | ○ |
| Underwater ambient loop | "Underwater Ambience" | freesound.org/people/Fission9/sounds/504641/ | Fission9 | CC0 | No | Free | ○ |
| Above-water ambient loop | GDC bundle ocean/coast beds | sonniss.com/gameaudiogdc | various vendors | Sonniss GDC EULA (royalty-free, no attribution, media-use only, no AI/ML training) | No | Free | ★ |
| Above-water ambient loop | klankbeeld shore/wave packs | freesound.org/people/klankbeeld/packs/14861/ | klankbeeld | mixed CC0/CC-BY (verify per file) | Varies | Free | ○ |
| Breach splash | GDC water/splash libraries | sonniss.com/gameaudiogdc | various | Sonniss EULA | No | Free | ★ |
| Breach splash | "40 CC0 water / splash / slime SFX" | opengameart.org/content/cc0-sound-effects | OGA community | CC0 | No | Free | ○ |
| Surface breathing | GDC creature/breath libraries | sonniss.com/gameaudiogdc | various | Sonniss EULA | No | Free | ★ |
| Surface breathing | OGA "Breathing Tired" | opengameart.org/content/cc0-sound-effects | OGA | CC0 | No | Free | ○ |
| Waterline muffle | runtime BiquadFilter lowpass — needs matched dry+wet beds above; no standalone asset | — | — | — | — | — | ★ runtime |

**[WEB] Sonniss license note:** GDC bundles are "royalty-free and commercially usable. No attribution is required… on an unlimited number of projects for the rest of your lifetime," but per current terms **"Use for AI/ML training is strictly prohibited"** and sounds may not be resold as-is. This fits WebAudio playback use.
**[WEB] Freesound note:** licenses are per-file; CC0 files require no attribution, CC-BY files do — verify each file's license box before use.

### 7b. ElevenLabs generation list (fallback / gap-fill)
**[WEB] Capability & terms verified:** ElevenLabs has a text-to-SFX generator (`elevenlabs.io/sound-effects`). Commercial use requires a **paid plan**: per the official pricing page, the **Free** plan ($0, 10,000 credits) has "no commercial license, and the generated audio must attribute ElevenLabs," while **Starter ($6/month, 30,000 credits)** is "the minimum paid tier that includes a commercial license" — note Starter recently rose from $5 to $6. "All sound effects generated on paid ElevenLabs plans are cleared for commercial use." The Sound Effects Terms let you opt out of sublicensing your outputs. **Restrictions:** you may not sell the SFX as standalone files, nor use output to build a competing service. → **[REC]** if used, generate on a paid plan; store outputs as normal audio assets (runtime never generates).

| Slice sound | Prompt sketch | Variations |
|---|---|---|
| Above-water ambient loop | "calm open-ocean surface ambience, gentle lapping waves, distant wind, seamless loop, no music, documentary tone" | 3 |
| Underwater ambient loop | "deep underwater ambience, muffled low rumble, faint distant whale/sonar, soft bubbling, seamless loop" | 3 |
| Breach splash | "dolphin breaching the surface, big water whoosh then heavy splash and spray, single hit" | 4 |
| Surface breathing | "dolphin blowhole exhale then sharp inhale at water surface, wet, close-mic, one-shot" | 4 |
| Waterline transition (supporting) | "quick underwater-to-air whoosh transition, water draining off ears" | 3 |

### 7c. Biome-bed organization (for the later full library)
`audio/biomes/{reef, kelp, cave, abyss, vents, wrecks}/{ambient_loop, detail_oneshots, transitions}`. Each biome bed = one seamless underwater loop + 2–4 detail one-shots. Slice scope populates **reef** first (above/underwater loops + splash + breath); the other biomes are stubs for later.

---

## 8. Pipeline Standards + draft CREDITS.md skeleton
**[REC] glTF 2.0 delivery conventions:** deliver `.glb` (binary, embedded textures) for single assets; apply Draco/meshopt compression only if needed; Y-up, meters, +Z forward per glTF; PBR metallic-roughness materials (metalness 0 for organic skin/plants); KHR_materials_* extensions permitted (Three.js 0.184 supports them).

**[REC] Texture budgets per asset class:**
| Class | Max res | Notes |
|---|---|---|
| Dolphin (hero character) | 2K | base/rough/normal/AO; drop MetallicSmoothness after conversion |
| Large wildlife (ray/turtle/shark) | 2K | one set each |
| Reef rock | 1–2K | atlas where possible |
| Vegetation (SeedThree bakes) | 1K cards | alpha-tested |
| Ground/terrain | 1–2K tiled | downsampled from source 4–8K |
| Particle sprites | 256–512 | alpha |

**[REC] Naming conventions:** `dolphin.glb`, `rock_reef_01.glb`, `veg_kelp_01.glb`, `wildlife_ray_manta_01.glb`, `tex_ground_sand_01_{basecolor,normal,rough}.png`, `sfx_amb_underwater_reef_01.ogg`, `sfx_splash_breach_01.ogg`. Lowercase, snake_case, category prefix, zero-padded index.

**[REC] Repo drop paths:**
```
apps/shared-world/public/
  models/dolphin/dolphin.glb  + LICENSE-dolphin.txt
  models/rocks/  models/vegetation/  models/wildlife/  models/ruins/
  textures/ground/  textures/particles/
  audio/biomes/reef/  audio/biomes/{kelp,cave,abyss,vents,wrecks}/
CREDITS.md   (repo root)
```

**Draft CREDITS.md skeleton:**
```markdown
# BodyArcade Shared-World — Asset Credits
_Last updated: <date>. This file is mirrored by the in-app Credits panel._

## 3D Models
- **Dolphin** — "Realistic Dolphin | Rigged with 25+ Animations" by GAMICO
  (https://sketchfab.com/gamico) — **CC-BY 4.0**
  (https://creativecommons.org/licenses/by/4.0/).
  Source: https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8
  Modified: Unity→glTF texture conversion; material/normal tuning; [animation edits if any].
- **Reef rocks** — Poly Haven (https://polyhaven.com) — CC0 (no attribution required; credited voluntarily).
- **Ground textures** — ambientCG (https://ambientcg.com) — CC0.
- **Vegetation** — generated with SeedThree by SkyeShark (https://github.com/SkyeShark/SeedThree) — MIT.
- **[Ray/Turtle/Fish]** — <creator> (Sketchfab URL) — CC-BY 4.0 [fill per asset].

## Textures
- Poly Haven — CC0; ambientCG — CC0.

## Audio
- Underwater ambient — "Underwater [Loop] AMB" by DCSFX (Freesound) — CC0.
- Splash/breath/ambient — Sonniss #GameAudioGDC bundle — royalty-free (Sonniss EULA; no attribution required, credited voluntarily; no AI/ML-training use).
- [Any ElevenLabs-generated SFX — generated on a paid plan; commercial license.]

## Code / Tools
- SeedThree — MIT © 2026 SkyeShark.
- jeantimex water — <license, per relevant track>.

_CC-BY assets require the credit above to remain accessible to all end users (Sketchfab policy)._
```

---

## 9. License-Obligation Ledger (every attribution/copyleft obligation this manifest creates)
| Source | License | Obligation | Where satisfied |
|---|---|---|---|
| GAMICO dolphin | CC-BY 4.0 | **Mandatory** credit + license link + note changes; accessible to all end users | CREDITS.md + in-app panel + LICENSE-dolphin.txt |
| Any Sketchfab CC-BY model (ray, turtle, fish, ruins) | CC-BY 4.0 | **Mandatory** per-asset credit + link + changes | CREDITS.md + in-app panel |
| Poly Haven | CC0 | None (voluntary credit) | CREDITS.md (voluntary) |
| Quaternius | CC0 | None | CREDITS.md (voluntary) |
| Kenney | CC0 | None | CREDITS.md (voluntary) |
| ambientCG | CC0 | None | CREDITS.md (voluntary) |
| SeedThree (code + geometry) | MIT | Retain MIT copyright + permission notice | THIRD-PARTY notice |
| SeedThree *generated textures* (if used as-is) | third-party (gpt-image-2 / Stable Audio 3 / xeno-canto) | Check before commercial redistribution | **[REC]** re-texture with CC0 to avoid |
| Freesound CC0 files | CC0 | None | CREDITS.md (voluntary) |
| Freesound CC-BY files | CC-BY | **Mandatory** credit per file | CREDITS.md — verify before use |
| Sonniss GDC bundle | Sonniss EULA | No attribution; **no resale as-is; no AI/ML training use** | Compliance note in ledger |
| ElevenLabs SFX (if used) | ElevenLabs paid-plan license (Starter $6/mo+) | Paid plan required for commercial; no standalone resale; no competing-service use | Ledger note |

---

## 10. Answered / Open / Needs-User
**Answered (verified):**
- Dolphin license = **CC-BY 4.0**, commercial + modify + redistribute permitted, attribution mandatory. **Checkpoint-1 UNBLOCKED.** [WEB]
- Listing budget **4.3k tris / 2.4k verts**, published 12 May 2026, 298 downloads; Fab twin is **$3.99**, same single-FBX asset (not an animation up-sell). [WEB] Measured counts confirm: 4,314 triangles / 2,886 GLB vertices (2,427 unique FBX positions). [LOCAL]
- Animation clip roster resolved: **exactly 8 clips, identical in both local files** (`SwimForward` 2.000s, `SwimForwardFast` 0.667s, `SwimLeft` 1.333s, `SwimRight` 1.300s, `SwimUp` 1.333s, `SwimDown` 1.333s, `Jump` 2.000s, `BreatheSurface` 2.333s); LINEAR interpolation; all clips return to start; `Jump` bakes ~2 m root motion. No FBX→glTF animation export needed. [LOCAL]
- GLB structure: valid glTF 2.0, no extensions, self-contained; 1 mesh / 1 skin (17 joints) / 1 material / 3 embedded 4096² PNG textures / 8 animations; `GLTFLoader` zero-plugin, `AnimationMixer` fully compatible; no preprocessing required for checkpoint 1. [LOCAL]
- Scale / axes / origin: real-world meters at 1.0 scene scale (2.89 m long × 0.99 m × 0.84 m); **+Y up, faces +Z when animated** (Three.js-conventional, no axis correction); origin at skeleton root, mid-body. Caveats: rest pose renders nose-down — always play a clip; `dolphin-glb.zip` is misnamed (contains FBX, no GLB). [LOCAL]
- Metallic-roughness repack: the GLB carries a Sketchfab-repacked combined occlusion/metallic-roughness texture (occlusion=R, roughness=G, metallic=B) — not the raw Unity maps; channel *correctness* still needs the visual check (below). The ZIP retains all four Unity PNGs for re-derivation if the check fails. [LOCAL]
- SeedThree = **MIT**; glTF `.glb` export confirmed; LOD/impostor/wind confirmed; WebGPU-first is irrelevant to a glTF-consumption pipeline. [WEB]
- CC0 confirmed at source for Poly Haven, Quaternius, Kenney, ambientCG. [WEB]
- Audio slice fully sourceable (Freesound CC0 + Sonniss royalty-free); ElevenLabs SFX commercial on a paid plan (Starter $6/mo, "minimum paid tier that includes a commercial license"). [WEB]
- PS2-Ecco visual target corroborated: vivid-but-low-detail environmental textures, softened underwater caustics, heavy fog for draw-distance/poly reduction. [WEB]

**Open (genuinely unresolved):**
- **Metallic-roughness channel correctness** — visual flank-sheen check under jeantimex water (Item 4); repack is measured but channel contents are inferred from Sketchfab's pipeline. Normal-map orientation likewise pending the lit-sphere check.
- **8-vs-"25+" clip discrepancy** — the listing publishes no named clip list; whether the free download should include more than 8 clips (or the rest are Fab/paid-only per GAMICO's series pattern) needs a live re-download check or creator contact. Non-blocking for checkpoint 1.
- Exact base-color saturation vs. PS2 Ecco reference frames (Item 5 visual validation).
- Track E animation-state graph dependency for the maps-to-need column.
- Per-item CC-BY license verification for each Sketchfab wildlife/ruins/fish candidate before use.

**Needs-user decision:**
- Fish: user supplies ~3 models; candidates above are options, not selections.
- Paid candidates (Superhive Coral Pack; any Fab purchase such as the $3.99 dolphin twin, which is unnecessary given the free CC-BY file) — awaiting user decision; nothing purchased.
- SeedThree coral (2–3 day tune) vs. downloaded coral (swap-if-too-costly clause).
- ElevenLabs paid-plan authorization if the generation route is chosen.

_Nothing in this report authorizes generation of assets, purchase, download, or repository modification. All selections are recommendations for user approval; the GAMICO dolphin (character) and SeedThree (vegetation baker) are the only pre-approved items, per governing context. Settled decisions (master context §15.5) are not re-opened; Ecco design archaeology is cited from the archive documents, not re-researched._