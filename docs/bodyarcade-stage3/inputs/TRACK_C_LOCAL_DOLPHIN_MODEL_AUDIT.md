# Track C — Local Dolphin Model Audit (Binary Inspection Only)

**Date:** 2026-07-16
**Scope:** Local, read-only inspection of the two GAMICO dolphin files in
`90_REFERENCE_ASSETS/dolphin/`. This report covers only what the local binaries
can prove. License verification, listing claims, and creator-pattern research
require a web-enabled session and are listed at the end as
**pending-web-verification**.

**Method:** SHA-256 via `shasum`; ZIP listed with `unzip -l`; GLB header and
JSON chunk parsed with a custom read-only Python script (no writes to either
asset); binary keyframe data decoded from the GLB `BIN` chunk with NumPy; the
ZIP was extracted once into a session scratchpad directory, scanned with
`grep`/`file`, and the extraction was deleted. Neither source file was
modified. All facts below are **measured** unless explicitly labeled
*(inference)* or *(estimate)*.

---

## 1. Executive summary

- Both files contain the **same asset**: GAMICO's "Realistic Dolphin | Rigged
  with 25+ Animations" from a pack internally named
  `ANIMALS FULL PACK\Ocean Animals Pack Vol 1\Dolphin`. The GLB is a Sketchfab
  auto-conversion (generator `Sketchfab-17.14.0`); the ZIP is the Sketchfab
  "original format" download containing the source **FBX** plus four
  Unity-convention PNG textures. **Despite its filename, `dolphin-glb.zip`
  contains no GLB.**
- The GLB is **valid glTF 2.0**, self-contained, uses **no extensions**, and is
  structurally clean for Three.js `GLTFLoader` + `AnimationMixer`.
- **Only 8 animation clips are present — in both files.** The advertised
  "25+ animations" are **not in the local downloads**. The 8 clips cover
  forward/fast swim, up/down, left/right turns, a jump/breach, and surface
  breathing. Braking, idle/hover, and collision/flinch clips are absent.
- The embedded `asset.extras` block declares **CC-BY-4.0** with author GAMICO,
  but this is a claim inside the file, not proof of the current listing
  license — web verification remains mandatory.
- Real-world scale is correct: the composed scene renders a dolphin
  **≈ 2.89 m long**, matching a large bottlenose dolphin, in meters, **+Y up**,
  facing **+Z** while animated.
- Two behavioral gotchas: the **static rest pose is wrong** (nose-down; any
  clip fixes it), and the **Jump clip has ~2 m of baked root motion**.
- **Checkpoint-1 verdict (local half):** technically **unblocked** — the GLB
  can be dropped into a Three.js scene today and will swim. The blocking
  remainder is **license/attribution verification on the live listing**, which
  this offline session cannot perform.

---

## 2. File identities

| File | Size (bytes) | SHA-256 |
|---|---|---|
| `90_REFERENCE_ASSETS/dolphin/dolphin-fbx.glb` | 21,692,084 | `e2cca876f8935269df8b9b658962f5db349bb9e11e6ed695a8c691bb94ef6cb4` |
| `90_REFERENCE_ASSETS/dolphin/dolphin-glb.zip` | 63,043,135 | `fc2353c76087b530b3ea9df407e5470d907c1bc5773c6ed93262c7eea2feb004` |

### ZIP contents (`unzip -l`, all members dated 2026-05-12 00:28)

```
source/Dolphin.fbx                              30,550,769 bytes
textures/T_Dolphin_MetallicSmoothness.png        8,294,172 bytes
textures/T_Dolphin_BaseColor.png                 3,925,074 bytes
textures/T_Dolphin_Occlusion.png                 7,043,743 bytes
textures/T_Dolphin_Normal.png                   13,228,671 bytes
```

SHA-256 of extracted members (computed during temporary extraction, since
deleted):

| Member | SHA-256 |
|---|---|
| `source/Dolphin.fbx` | `83059ea449ffc0b6546f00038b4a142f21f18d75ee03863683c17a6fbe1fdcb0` |
| `textures/T_Dolphin_BaseColor.png` | `9eb35cf76c45e59e99f2fd7aaa3a2c0123049e898732c2a2f50645ba812cf279` |
| `textures/T_Dolphin_MetallicSmoothness.png` | `a609522a838f12983d7098e94c51151cd4a1e4d10308912d0c5792d3e439ac73` |
| `textures/T_Dolphin_Normal.png` | `e9ee6ee1a0dd4b979d1acc6644eb67f2ac177e7dc5f96b44be5b60893cdb553b` |
| `textures/T_Dolphin_Occlusion.png` | `b4c669ea50c47a0959bf2787f9116340f9e7fe4d3a2a5aa71f19763da36a4092` |

**Naming warning:** the two local filenames are swapped relative to their
contents. `dolphin-fbx.glb` is the GLB (Sketchfab's glTF conversion, named for
its FBX origin); `dolphin-glb.zip` is the FBX package. The ZIP contains **no**
GLB.

---

## 3. GLB container and glTF validity

- Header: magic `glTF`, container version 2, declared length 21,692,084 =
  actual file length. Two chunks: `JSON` (116,160 bytes) and `BIN`
  (21,575,896 bytes). Single buffer, no external URIs — **fully
  self-contained**.
- `asset.version`: `"2.0"`. `asset.generator`: `"Sketchfab-17.14.0"`.
- `extensionsUsed` / `extensionsRequired`: **none**. No Draco, no KTX2, no
  quantization — nothing that needs loader plugins.
- `asset.extras` (embedded provenance, verbatim):
  - `author`: `GAMICO (https://sketchfab.com/gamico)`
  - `license`: `CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)`
  - `source`: `https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8`
  - `title`: `Realistic Dolphin | Rigged with 25+ Animations`

  This matches the pinned listing in `01_NEW_DECISIONS_TO_MERGE.md`, but it is
  self-reported metadata written at download time — **it does not substitute
  for checking the live listing license** *(the license itself is
  pending-web-verification)*.
- No formal `gltf-validator` run was available locally; structural parsing
  found no inconsistencies (all chunk lengths, accessor counts, and buffer
  bounds check out). *(inference: a formal validator pass would very likely be
  clean; can be run later with `npx gltf-validator` in one command.)*

### Object counts

| glTF object | Count |
|---|---|
| scenes | 1 (`Sketchfab_Scene`, default) |
| nodes | 28 |
| meshes | 1 (`SK_Dolphin_M_Dolphin_0`, 1 primitive) |
| skins | 1 (17 joints) |
| materials | 1 (`M_Dolphin`) |
| images | 3 (all embedded PNG) |
| textures | 3 |
| samplers | 1 |
| animations | 8 |
| accessors / bufferViews / buffers | 468 / 12 / 1 |
| cameras / lights / morph targets | 0 / 0 / **0** |

---

## 4. Mesh geometry

Single primitive, `TRIANGLES` mode:

- **2,886 vertices, 4,314 triangles** (GLB). The FBX stores 2,427 unique
  positions and the identical 4,314 triangles — the GLB's higher vertex count
  is normal seam-splitting for UVs/normals, not added geometry.
- Vertex attributes: `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`,
  `TEXCOORD_1`, `JOINTS_0`, `WEIGHTS_0`. Tangents are pre-computed (no runtime
  tangent generation needed for the normal map). The second UV set exists;
  the material's occlusion texture does not declare a `texCoord` override, so
  everything samples UV0 by default *(inference: UV1 is likely a lightmap/AO
  channel inherited from the Unity-oriented source; harmless)*.
- No morph targets anywhere; all deformation is skeletal.
- Local-space AABB (mesh/bind space, centimeters):
  min `(-42.1, -40.0, -167.9)`, max `(42.1, 59.2, 121.1)`.

### Real-world scale and dimensions

The node `18148e911df14d68b614179f64d7d196.fbx` applies Sketchfab's standard
FBX fix-up matrix: **uniform 0.01 scale** (centimeters → meters) plus a
Z-up→Y-up axis swap. Composing the full node chain and transforming the mesh
AABB gives world-space dimensions:

| Axis | Extent | Meaning (animated pose) |
|---|---|---|
| length | **2.89 m** | nose-to-fluke |
| height | **0.99 m** | belly-to-dorsal-fin |
| width | **0.84 m** | pectoral/fluke span |

A wild bottlenose dolphin is roughly 2–4 m long, so the asset is **already in
real-world meters at 1.0 scene scale** — no rescaling required for a
physically-sized jeantimex world. *(measured geometry; species-length
comparison is reference knowledge, not file data)*

### Orientation, forward axis, origin

- FBX GlobalSettings: `UpAxis = 1 (+Y)`, `FrontAxis = 2 (+Z)`,
  `CoordAxis = 0 (+X)`, `UnitScaleFactor = 1` (cm) — standard Maya/Unity-style
  Y-up, Z-forward at 1 cm units.
- In the GLB, bind-pose joint positions (recovered by inverting the
  `inverseBindMatrices`) put the head/jaw at mesh-local **+Z**
  (Z ≈ +60…+74 cm) and the tail chain running to **−Z** (to −154 cm), spine at
  Y ≈ +10 cm. With the animated root transforms applied, the rendered dolphin
  faces **world +Z with +Y up** — exactly the conventional Three.js "model
  forward" orientation. Origin sits at the skeleton root, roughly
  mid-body/pivot point, not at the nose.
- **Rest-pose trap (measured):** the node hierarchy's *static* rest transforms
  do **not** equal the bind pose. Rendered with no animation playing, the
  skeleton's rest chain poses the dolphin nose-down (head at world −Y). Every
  animation clip's first frame restores the correct orientation (it keys an
  extra −90° X rotation on node 4 `Dolphin` plus corrected joint rotations).
  **Practical rule for checkpoint 1: never render the skinned dolphin without
  an active `AnimationAction`; start `SwimForward` (or any clip) on frame 0
  before first render.**

---

## 5. Skeleton

One skin, **17 joints**, `skeleton` root = node 8 `_rootJoint`. Full joint
hierarchy (names as authored; "Pectotal" [sic] is the creator's spelling):

```
_rootJoint                          (node 8 — apparent/actual root bone)
└── Dolphin_Spine1_00
    ├── Dolphin_Spine2_01
    │   ├── Dolphin_Head_02
    │   │   └── Dolphin_Jaw_03
    │   ├── Dolphin_PectotalFinLeft_04
    │   └── Dolphin_PectotalFinRight_06
    └── Dolphin_Tail1_05
        └── Dolphin_Tail2_07
            └── Dolphin_Tail3_08
                └── Dolphin_Tail4_09
                    └── Dolphin_Tail5_010
                        └── Dolphin_Tail6_012
                            ├── Dolphin_CaudalFinLeft1_011
                            │   └── Dolphin_CaudalFinLeft2_014
                            └── Dolphin_CaudalFinRight1_013
                                └── Dolphin_CaudalFinRight2_015
```

Above the skin root, the carrier chain is
`Sketchfab_model → <hash>.fbx (0.01 scale + axis swap) → Object_2 → RootNode →
Dolphin → root → Dolphin_Root → Object_7 → {_rootJoint, Object_26 (skinned
mesh), Object_25}`, plus an empty sibling `SK_Dolphin` node. Animations also
key `Dolphin` (node 4) and `Dolphin_Root` (node 6), so the *effective*
animation root for root-motion purposes is **`Dolphin_Root`**.

Rig coverage: 6-segment tail chain plus 2-bone flukes per side gives good
undulation fidelity for Ecco-style swimming; head+jaw allow mouth animation;
one bone per pectoral fin (no fin-tip bones) limits fine fin articulation
*(measured structure; fidelity judgments are inference)*. The FBX contains the
same skeleton (`LimbNode` models, `SK_Dolphin_Skin` deformer,
`BoneWeightCluster`s) — no extra bones hiding in the source file.

---

## 6. Animations

**Both files contain exactly the same 8 clips.** The FBX was scanned directly
(ASCII FBX 7.7, FBX SDK 2020.3.2): 8 `AnimationStack` objects, 8 `Take`
blocks, names identical to the GLB. **The "25+ animations" advertised by the
listing title are not present in either local file.** *(What the 25+ list is,
and whether the free download is supposed to include them, is
pending-web-verification — GAMICO's series pattern typically splits free vs
full packs, but that is unverified here.)*

### Clip inventory (all values measured from GLB keyframe data)

| # | Clip | Duration | Channels | Root translation range (node `Dolphin_Root`, cm) | Root rot max-dev / returns-to-start | Loop suitability *(inference)* |
|---|---|---|---|---|---|---|
| 0 | `BreatheSurface` | 2.333 s | 29 | 17.2 (Z) | 23.5° / yes (0.00°) | Loopable; surface bobbing built in |
| 1 | `Jump` | 2.000 s | 29 | **198.8 (Z, vertical) + 2.3 (Y)** | 37.8° / yes | One-shot; **~2 m baked root motion** |
| 2 | `SwimDown` | 1.333 s | 29 | 8.7 | 16.6° / yes | Loopable pitch-down cycle |
| 3 | `SwimForward` | 2.000 s | 29 | 4.2 | 3.1° / yes | **Primary cruise loop** |
| 4 | `SwimForwardFast` | 0.667 s | 27 | 4.2 | 3.1° / yes | Fast-swim loop |
| 5 | `SwimLeft` | 1.333 s | 29 | <0.1 | 21.8° / yes | Loopable banked-turn cycle |
| 6 | `SwimRight` | 1.300 s | 29 | <0.1 | 20.4° / yes | Loopable banked-turn cycle |
| 7 | `SwimUp` | 1.333 s | 29 | 4.4 | 19.0° / yes | Loopable pitch-up cycle |

- **Channels/targets:** every clip targets the same **18 nodes** — all 17
  joints plus `Dolphin_Root` (node 6); `Dolphin` (node 4) additionally gets a
  single orientation key. Paths per typical clip: 18 rotation, 9 translation,
  2 scale. Interpolation is **LINEAR** throughout (STEP/CUBICSPLINE absent) —
  fully supported by `AnimationMixer`.
- **All clips end where they start** (root rotation first-vs-last ≤ 0.06°),
  i.e., the turn clips are *lean/bank cycles*, not baked continuous turns —
  correct for a controller that steers via gameplay code and layers animation
  on top, which matches the Ecco-feel plan.
- **Jump root motion:** ~2 m of vertical travel is keyed into `Dolphin_Root`.
  Playing it raw while gameplay code also moves the dolphin will double the
  displacement. Options *(inference)*: strip/zero the root translation track
  at load (`THREE.AnimationClip` track filtering, trivial), or let the clip
  drive the breach and suspend physics during it.
- Keyframe density ≈ 30 keys/s (e.g., 61 keys over 2.0 s).

### Gap analysis vs the needed clip set (master context §5-item 6)

| Needed | Status in local files | Coverage/Blender work *(inference)* |
|---|---|---|
| Cruise swim | ✅ `SwimForward` | Direct use |
| Fast swim | ✅ `SwimForwardFast` | Direct use |
| Banking left/right | ✅ `SwimLeft` / `SwimRight` | Bank cycles; blend with cruise |
| Pitch up/down | ✅ `SwimUp` / `SwimDown` | Direct use |
| Braking | ❌ absent | Author in Blender (short spread-fin pose) or reverse/slow `SwimForward` segment |
| Breach/leap | ⚠️ `Jump` (single combined clip) | Split `Jump` into launch/airborne/re-entry segments, or use as one-shot |
| Airborne | ⚠️ inside `Jump` | Extract mid-segment or hold a frame |
| Re-entry | ⚠️ inside `Jump` | Extract tail segment |
| Idle/hover | ❌ absent | Slow-play `SwimForward` at low speed *(cheap)* or author |
| Surface breathing | ✅ `BreatheSurface` | Direct use |
| Collision/flinch | ❌ absent | Author in Blender or procedural spine-jolt |

---

## 7. Materials and textures

### GLB material `M_Dolphin`

- `doubleSided: true`; metallic-roughness PBR.
- `baseColorTexture` → texture 0; `metallicRoughnessTexture` → texture 1;
  `occlusionTexture` → **texture 1 (same image)**; `normalTexture` → texture 2.
- `roughnessFactor: 0.6` (multiplies the roughness channel); no
  `metallicFactor` specified (spec default 1.0, modulated by the texture's
  blue channel); no emissive; opaque alpha mode.
- Sampler: LINEAR mag / LINEAR_MIPMAP_LINEAR min, REPEAT wrap on both axes.

### Embedded images (GLB) — all **embedded**, none external

| Image | Role | Format | Size |
|---|---|---|---|
| 0 | baseColor | PNG 4096×4096, 8-bit RGB | 3,632,216 B |
| 1 | occlusion + metallicRoughness (shared ORM-style) | PNG 4096×4096, 8-bit **palette-indexed** | 4,521,874 B |
| 2 | normal | PNG 4096×4096, 8-bit RGB | 12,975,253 B |

### Unity-convention conversion status

The ZIP's texture set is Unity-style (`MetallicSmoothness` RGBA with
smoothness in alpha, separate `Occlusion`). In the GLB, Sketchfab's converter
has **already produced a single combined occlusion/metallic-roughness image**
whose byte size and color type differ from both ZIP originals — i.e., the GLB
does **not** simply re-embed the Unity textures; it was **repacked to glTF
convention (occlusion=R, roughness=G, metallic=B) with smoothness inverted to
roughness during conversion** *(the repack is measured — shared image, new
file; the correctness of the channel contents is inference from Sketchfab's
standard pipeline and needs the visual check below)*.

**Visual confirmation for checkpoint 1:** under jeantimex water lighting, a
correctly-converted dolphin shows a broad soft sheen along the flank
highlights and no mirror-like/chrome response. If it renders chrome-like
(metallic stuck high) or uniformly chalky (roughness inverted), re-derive the
maps from the ZIP originals in Blender: `roughness = 1 − smoothness_alpha`,
`metallic = RGB of MetallicSmoothness`, occlusion from `T_Dolphin_Occlusion`.
The ZIP retains everything needed for that repair.

### FBX texture wiring (ZIP)

The FBX references **only** `T_Dolphin_BaseColor.png` (DiffuseColor) and
`T_Dolphin_Normal.png` (NormalMap), via relative paths under
`ANIMALS FULL PACK\Ocean Animals Pack Vol 1\Dolphin\Textures\`. The
MetallicSmoothness and Occlusion PNGs ship in the ZIP but are **not wired into
the FBX material** — any Blender re-import must connect them manually.

---

## 8. GLB vs ZIP: equivalent or different?

**Equivalent asset, different containers.** Evidence:

- Identical triangle count (4,314) and identical 8 animation takes with
  matching names and durations (FBX KTime stops convert to the same seconds).
- Same skeleton (17 deforming bones, same names including the "Pectotal"
  typo), same single material `M_Dolphin`, same texture family.
- The FBX embeds the original pack path, tying both to the same GAMICO source.

Differences that matter:

| Aspect | `dolphin-fbx.glb` | `dolphin-glb.zip` (FBX) |
|---|---|---|
| Format | glTF 2.0 binary, ready for Three.js | ASCII FBX 7.7 — needs Blender for any use |
| Textures | 3 embedded, already glTF-convention | 4 loose PNGs, Unity-convention, only 2 wired |
| PBR completeness | metallic-roughness + AO + normal | source of truth for re-deriving maps |
| Role *(inference)* | **runtime asset** | **repair/authoring source** for new clips (braking, flinch) and texture re-derivation |

---

## 9. Three.js compatibility assessment

**`GLTFLoader`: loads with zero plugins** — no extensions, no Draco/KTX2, one
buffer, embedded PNGs, standard attribute set including precomputed tangents.
**`AnimationMixer`: fully compatible** — 8 named clips, LINEAR interpolation
only, standard TRS paths, one skin.

Warnings for the first checkpoint:

1. **Always play a clip** (rest pose renders nose-down — §4).
2. **Handle `Jump` root motion** (~2 m baked into `Dolphin_Root` — §6).
3. **Texture memory** *(measured sizes, impact estimated)*: three 4096²
   textures ≈ 64 MB decoded GPU memory (more with mipmaps) and ~21 MB download.
   Fine for a single hero character on the M5 target; if budgets tighten,
   resize to 2048² and/or convert to KTX2 later — an optimization, **not** a
   checkpoint-1 requirement, and not performed per this session's constraints.
4. `doubleSided` material and 4,314 tris are trivially cheap; frustum-culling
   with skinned meshes may need `mesh.frustumCulled = false` if clips move the
   dolphin far from its static bounds (standard Three.js skinned-mesh caveat)
   *(inference)*.

---

## 10. Suitability for the first dolphin-in-Jeantimex checkpoint

**Suitable, and technically unblocked.** The GLB is a clean, real-scale,
correctly-oriented (when animated), fully-rigged dolphin with a usable cruise
loop (`SwimForward`), speed variant, turn/pitch cycles, a breach one-shot, and
a surface-breathing clip — precisely the minimum set the checkpoint's
swim-loop needs. Low poly count (4.3 k tris) leaves the entire frame budget
for the world. The clip set's gaps (braking, idle, flinch; splitting `Jump`)
are **post-checkpoint** Blender work, not blockers.

**What still blocks full checkpoint sign-off (not resolvable locally):**
license/attribution verification against the live Sketchfab listing.

---

## 11. Blockers, warnings, required preprocessing

**Blockers (process, not technical):**
- B1 — License unverified at source. The embedded CC-BY-4.0 claim must be
  confirmed on the live listing, attribution string drafted, and recorded in
  `CREDITS.md` before the asset is committed to any repo. *(pending-web-verification)*

**Warnings:**
- W1 — Only 8 of the advertised "25+" clips exist locally; if the listing's
  free download genuinely includes more, a re-download should be considered.
  *(pending-web-verification)*
- W2 — Rest pose renders nose-down; never display without an active animation.
- W3 — `Jump` bakes ~2 m root motion into `Dolphin_Root`.
- W4 — `dolphin-glb.zip` is misnamed (contains FBX, not GLB); recommend the
  repo drop-path names reflect actual contents.
- W5 — Metallic/roughness channel correctness is inferred from Sketchfab's
  pipeline, not proven; do the flank-sheen visual check under jeantimex water
  (§7) at checkpoint 1.
- W6 — Normal-map PNG is 13 MB of the 21.7 MB file; a future 2K resize is the
  single highest-value size optimization *(estimate)*.

**Required preprocessing for checkpoint 1: none.** The GLB is usable as-is.
Optional-later: strip `Jump` root translation at load; downscale/KTX2 textures;
author the 3 missing clips from `Dolphin.fbx` in Blender.

---

## 12. Pending-web-verification items (out of scope for this local session)

1. Current license type and full license text on the live Sketchfab listing;
   required attribution wording; exact attribution string for the credits
   panel and `CREDITS.md`.
2. The advertised animation list (all "25+" names) — to determine whether the
   free download is supposed to contain 8 or whether the remaining clips are
   Fab/paid-only, per GAMICO's series pattern.
3. Listing-advertised triangle/vertex counts vs the measured 4,314 / 2,886.
4. Download availability status (still free? still downloadable?).
5. Everything else in the Track C prompt (category manifest, SeedThree, audio
   mini-manifest, pipeline standards) — untouched by this session by design.
