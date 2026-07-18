# BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md

**Project:** BodyArcade Shared-World — Stage 3 Implementation Specification
**Date:** 2026-07-17
**Status:** LIVE — governs all checkpoint implementation sessions.

This document synthesizes the five completed Stage-2 research reports (Tracks A–E) and the governing decision record into a single deterministic implementation specification. Each checkpoint implementation session consumes only this document plus its own checkpoint prompt file; no implementer judgment is required.

---

## 1. Authority and Precedence

When sources conflict, authority runs in this order:

1. The user's newest explicit statements in the active conversation.
2. `01_NEW_DECISIONS_TO_MERGE.md` (newest decisions).
3. `00_BODYARCADE_MASTER_CONTEXT_V3.md` (governing decision record, including Addendum A).
4. This document.
5. The five Track A–E research reports.
6. The verified state of `lekandigital/posepuppet` at the branches/SHAs Track A verified.

### 1.1 The V1–V8 Rule (verbatim, per master context Addendum A.1)

> "The V1–V8 prompts in the attached prompt pack have already been run. Treat the prompt pack as historical planning context, not as instructions to execute again. Do not relaunch its waves, recreate completed work, or assume its status table is current. First inspect the attached results and the repository as it exists now, determine what each prompt actually completed, partially completed, or left unresolved, and continue only from the remaining gaps. Preserve working implementations and avoid rebuilding anything unless the audit finds a specific defect."

### 1.2 Binding Rules

These rules govern every checkpoint session. Each checkpoint prompt restates them in a short block.

1. **Fidelity hierarchy:** exact jeantimex look preserved; minimal integration edits only; jeantimex wins over the Ecco spec until individually approved tweaks; jeantimex owns surface/waterline, Track D owns underwater atmosphere through jeantimex's mechanisms. (Master context §3.3)
2. **Strict content-generation policy:** no invented assets, ever; color-coded rectangular placeholders for everything missing; agents purchase nothing. (Master context §9)
3. **Review gates:** every meaningful stage produces a working live demo; the user can stop, redirect, or approve; no new major visual change without prior approval; approved visuals are never changed without permission. (Master context §13.1)
4. **Local-only:** all development, builds, demos, and verification on the user's Mac (M5, Chrome, WebGL2, Three.js 0.184, 60 fps @ ≈1728×1080). Remote-machine conventions stay retired. (Master context §12.2)
5. **Preserve the sim architecture:** 120 Hz deterministic sim, replays, body-input with keyboard priority, assist ladder, autopilot, soft containment, tests — constants retune per Track E, architecture does not. (Master context §4.3, 01_NEW_DECISIONS §Ecco gameplay-fidelity priority)
6. **One shared world, one style, one terrain dataset.** (Master context §2.1, §3.5)
7. **Settled decisions stay settled.** (Master context §15.5)

---

## 2. The World Contract

### 2.1 Coordinates and Units

| Parameter | Value | Source |
|---|---|---|
| Units | meters | Master context §7 |
| Axes | right-handed, y-up, ground plane = XZ | Track B §Contract |
| Sea level | y = 0 | Master context §7 |
| Region origin | (0, 0, 0) at region center | Track B Table 10 |
| Region extent | X, Z ∈ [−1000, +1000] (2 km × 2 km) | Master context §7, validated Track B Table 11 |
| Height range | seabed floor y = −80, tallest peak y = +200 | Master context §7 |
| Dolphin cruise / burst | **5 / 9 m/s** (canonical; master context §7) | Master context §7 |

### 2.2 Body-Length Scale

**Canonical definition:** 1 BL equals the GAMICO dolphin model's audited nose-to-tail bounding-box length at scene scale 1.0: **1 BL = 2.89 m** (source: Track C §10, local audit — "2.89 m long × 0.99 m × 0.84 m"). This is a measured fact, not a tuning parameter.

Track D originally expressed BL-denominated values using 1 BL = 2.0 m; Track E used 1 BL = 2.5 m. Both are converted to the canonical 2.89 m BL as follows, preserving the original real-meter meaning:

- Track D values: `meters = Track-D_BL_value × 2.0`; `canonical BL = meters ÷ 2.89`.
- Track E values: `meters = Track-E_BL_value × 2.5`; `canonical BL = meters ÷ 2.89`.

All BL-denominated values in this document and every checkpoint prompt have already been converted using these formulae. The meter column is authoritative; the BL column is informational.

**Runtime verification (checkpoint 01):** measure the loaded dolphin model's axis-aligned bounding box at runtime and compare against 2.89 m. A materially different measurement (>5% deviation) must be reported as repository or asset drift — not treated as permission for the implementation agent to choose a different scale.

### 2.3 Speed Family

**Resolved — not a user decision.** The master context (§7) outranks all research reports in the authority order (§1). The canonical initial implementation values are:

| Parameter | Canonical value | Source |
|---|---|---|
| Cruise speed | **5 m/s** (1.73 BL/s) | Master context §7 |
| Burst speed | **9 m/s** (3.11 BL/s) | Master context §7 |

The existing `sim.ts` constants (16/22 m/s, Track A §4.8 Finding F9) are retired and replaced at checkpoint 01.

Track E's recommended values — cruise 10 m/s (3.46 BL/s), burst 17.5 m/s (6.06 BL/s) — are recorded as **labeled retuning candidates** for the checkpoint 01–02 feel review. They may be adopted only if the user approves them during review. They must never appear as the active implementation value in any checkpoint unless the user has explicitly approved the change.

### 2.4 Baked-Data Schema (Track B Table 6)

All major geography is fixed between visits; author once, bake, load.

| Artifact | Format | Resolution | Repo path |
|---|---|---|---|
| Heightmap | 16-bit R16 (little-endian) | 2049² | `assets/world/height.r16` |
| Shoreline mask | 8-bit PNG | 2049² | `assets/world/shore.png` |
| Biome/placement mask | 8-bit RGBA | 1025² | `assets/world/biome.png` |
| Placement JSON | JSON | — | `assets/world/placement.json` |
| Cave manifest | JSON + GLB refs | — | `assets/world/caves.json` |
| World header | JSON | — | `assets/world/world.json` |

Conventions: heightmap texel (i,j) → world: `x = −1000 + i·(2000/2048)`, `z = −1000 + j·(2000/2048)`; value → `y = −80 + h16/65535 · 280`. (Track B Table 6, §Contract)

### 2.5 Single-Source-of-Truth Data Flow (Track B Q14)

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

`terrainHeight(x,z)` is the single function every subsystem calls; a visible/collision mismatch is a defect by construction.

---

## 3. The Codebase Plan

### 3.1 Base Branch

`origin/bodyarcade-v4-base @ 493dd24` — Track A confirmed this is v2-base + merged V1+V2+V3; the fullest integrated tree containing the Dolphin app. (Track A §5.2, §7)

The `local/v2-base-mac-prep @ 60b034c` branch is rejected as base because it lacks the Dolphin app entirely (Track A Finding F1).

### 3.2 `apps/shared-world/` Integration Contract (Track A §11)

| Item | Contract |
|---|---|
| Location / name | `apps/shared-world/`; package `@bodyarcade/shared-world`, private, type module |
| Three.js | `three@^0.184` + `@types/three@^0.184` in app's own `package.json` |
| Vite config | Clone `apps/dolphin/vite.config.ts`: `base: '/shared-world/'`; aliases → monorepo packages; dev port **5198**; `poseAssets()` middleware |
| Same-origin serving | Add `sharedWorldStatic()` to root `vite.config.ts` (clone `dolphinStatic()`); extend `"arcade"` script |
| Body input | Port `swimControls.ts` unchanged; boot `createPoseRuntime({ model: 'lite', worker: true, election: 'strict' })` |
| Sim port | `sim.ts` + `swimControls.ts` + `camera.ts` copied; `WorldSampler` seam re-pointed |
| Test wiring | Clone `apps/dolphin/playwright.config.ts`; headed, workers 1, port 5198 |
| Assets | Dolphin GLB at `apps/shared-world/public/models/dolphin/` with license file |
| Standalone dev | `npm --prefix apps/shared-world run dev` (port 5198) |
| Full topology | `npm run arcade` → root :5173, game at `/shared-world/` |

### 3.3 Preserve / Replace / Re-Point Manifest

**Preserve (port unchanged):**
- `sim.ts` — 120 Hz deterministic swim model, all feel constants, impulse-and-glide, breach event, replay
- `swimControls.ts` — BodySignal consumer, keyboard priority, autopilot, assists, T-pose recenter, burst state machine
- Camera behaviors (above/below transitions, trailer-follow pattern)
- Test harness patterns (containment battery, replay determinism, breach tests)
- `@bodyarcade/body-input` protocol, Predictive Pose Continuity

**Replace (new presentation):**
- `world.ts`, `decor.ts`, `dolphinMesh.ts` — entire procedural-mesh look replaced by jeantimex water + baked terrain + GAMICO dolphin

**Re-point (same mechanism, new data):**
- `WorldSampler` seam: SF-Bay boundary → authored region shoreline mask + baked heightfield
- Containment band: 55 m → region-appropriate value (retune per Track E at region scale)
- ODbL/OSM attribution → removed with data source

### 3.4 Three.js 0.172 → 0.184 Port Surface

Track A verified: `sim.ts` and `swimControls.ts` have **zero Three.js imports** — the port surface is nil. `camera.ts` and `game.ts` use a small stable-API surface (Scene, Camera, Vector3, Quaternion, Color, Fog). No breaking changes expected; confirm mechanically at port time. (Track A §4.7)

### 3.5 Test Migration to Local macOS (Track A §10)

- Drop `DISPLAY=:2` and SwiftShader assumptions — run headed on native macOS Chrome
- `DOLPHIN_GPU=1 npm test` — the spec only checks `process.env.DOLPHIN_GPU`; `DISPLAY` is meaningless on macOS
- Assert fps floor unconditionally (Mac GPU always present); new floor = 60 fps at 1728×1080
- The topology test self-skips without `fixtures/fullbody.y4m` (gitignored, presence unverifiable)
- All remote-machine scripts (`scripts/remote/*`, `scripts/local/*`, `.claude/rules/remote-development.md`) — not present on v4-base; nothing to delete

---

## 4. The Water Plan

### 4.1 Resource

`jeantimex/threejs-water` — MIT license. TypeScript + Vite + Three.js 0.184. Vendored pristine at HEAD commit (to be pinned at clone time; GitHub robots-blocked the SHA during research — Track B Open Item 1).

**OPEN:** Pin the exact commit SHA via authenticated clone during checkpoint 0.

### 4.2 Pool-Assumption Inventory (Track B Table 1)

13 pool-assumption sites identified. Items 1–6, 9, 13 are the **only sanctioned edits**. Everything else stays byte-identical.

| # | Location | Verdict |
|---|---|---|
| 1 | Water-above frag `intersectCube` | **CHANGES** → seabed heightfield raymarch |
| 2 | Water-below frag `getWallColor` | **CHANGES** → same heightfield raymarch |
| 3 | `poolHeight` uniform | **CHANGES** → `uSeaLevel` + per-fragment seabed height |
| 4 | Caustics vertex shader floor intersection | **CHANGES** → terrain heightfield raymarch |
| 5 | Caustics frag differential-area math | **STAYS** (math byte-identical; only projection surface changes) |
| 6 | Wall shaders triplanar UV | **CHANGES** → coastline geometry + terrain material |
| 7 | Wall/caustics AO/shadow term | **STAYS** |
| 8 | Water surface mesh extent | **STAYS** mechanism / **CHANGES** extent + clipping |
| 9 | Heightfield sim domain mapping | **CHANGES** mapping only (to windowed player-following) |
| 10 | Drop/displacement injection pattern | **STAYS** |
| 11 | Fresnel/Snell compositing | **STAYS** |
| 12 | Skybox/environment reflection | **STAYS** |
| 13 | Renderer pass switch | **CHANGES** → add "region" pool type |

### 4.3 Windowed 512² Player-Following Sim (Track B Q4, Table 3)

- **Global surface**: one large calm plane at y=0 spanning the region, shaded by jeantimex surface shader with low-amplitude ambient normal
- **Window**: 512² GPU sim domain covering 256 m square centered on dolphin; 0.5 m/texel
- **Scrolling**: snap to 0.5 m texel increments; copy shifted overlapping texels; inject zero at new edges
- **Edge blending**: cosine falloff over outer ~10% blends into ambient swell
- This is the **RECOMMENDED** configuration (Track B Table 3). Fallback: 256² windowed at 128 m coverage

### 4.4 Terrain Clipping the Surface (Track B Q5)

Alpha-clip from shoreline mask: fragment shader samples `uShoreMask`/`uHeightTex`; where `terrainHeight(x,z) ≥ 0` → `discard`. No geometry clipping, no stencil.

### 4.5 Caustics onto Arbitrary Terrain (Track B Q6)

Carry jeantimex differential-area caustics by modifying caustics vertex shader to intersect seabed heightfield instead of floor plane. Math stays byte-identical. Fallback: martinRenou/threejs-caustics (BSD-3-Clause, requires modernization to r0.184).

### 4.6 Dolphin/Boat Interaction and Breach (Track B Q7)

- Dolphin = compound-sphere emitter using the demo's `CompoundSphereWaterDisplacement` pattern
- Breach: splash injection via `addDrop` at crossing point; above/below composition via existing waterline compositor; re-entry = larger drop injection
- All through jeantimex mechanisms — no second system

### 4.7 Four-Shot Fidelity Test (Track B Table 4)

Run at every water checkpoint; compare region build side-by-side with stock demo.

| Shot | Camera setup | Pass criteria |
|---|---|---|
| (a) Above-water angle | ~30° down, over open water | Surface indistinguishable from demo |
| (b) Underwater caustics | 5 m below, pitched down at seabed | Caustic pattern matches demo character |
| (c) Half-submerged waterline | Camera at y=0, horizontal | Clean Fresnel split, no z-fight |
| (d) Snell's window | 3 m below, pitched up | ~97° cone present, TIR ring correct |

### 4.8 Fallback Ladder (Track B Table 5)

| Rung | Approach | Trigger |
|---|---|---|
| 1 (plan) | Windowed 512² under one global surface | — |
| 2 | Near/mid/far tiers | Rung 1 fails fidelity test or exceeds budget |
| 3 | Selective port of Water + GPU heightmap + CausticsPass | Rungs 1–2 cannot preserve look |

Escalate only with evidence and user approval.

### 4.9 New Uniforms (Additive)

| Uniform | Type | Purpose |
|---|---|---|
| `uSeaLevel` | float (0.0) | Replaces fixed `poolHeight` |
| `uHeightTex` | sampler2D | Baked heightmap |
| `uRegionSize` | vec2 | Region extent for UV mapping |
| `uWindowOrigin` | vec2 | Player-following sim window center |
| `uShoreMask` | sampler2D | Shoreline alpha-clip |

---

## 5. The Terrain and Cave Plan

### 5.1 Authoring Tools (Track B Table 7)

| Tool | Role | License |
|---|---|---|
| ProceduralTerrains (ZyFou) | World-field authoring — shape region interactively, export heightmap | MIT |
| THREE.Terrain (IceCreamYou) | Algorithm toolbox + bake bridge — scriptable ops, heightmap round-trip | MIT |

Neither is imported as runtime architecture; both are authoring-time tools.

### 5.2 Runtime Loader

Decode heightmap → Float32; build `terrainHeight(x,z)` bilinear sampler. All subsystems call this single function.

### 5.3 LOD (Track B Q16)

Chunked static LODs: 8×8 or 16×16 tiles, 3–4 discrete levels, skirt rings to hide cracks. Silhouette-preserving LOD bias: coastline/peak chunks keep highest LOD regardless of distance.

### 5.4 Cave Method: Authored/Kitbashed Modular Meshes (Track B Table 8)

**Decision:** authored/kitbashed modular cave-and-arch meshes wins over SDF/surface-nets on art-directability, Ecco-authenticity (game caves were hand-modeled), collision simplicity, and authoring effort.

- **Kit:** CC0 Kenney Modular Cave Kit (40 assets) + Blender finishing
- **Collision:** Rapier trimesh directly from cave GLBs
- **Seam blending (Track B Q19):** cave module mouth overlaps terrain; heightmap locally lowered at authoring time; shared triplanar rock material; vertex-color blend band at lip

### 5.5 Collision Plan (Track B Q20)

| Element | Collider | Data source |
|---|---|---|
| Seabed + land | Rapier heightfield `ColliderDesc.heightfield()` | Baked heightmap, downsampled ~513² |
| Caves / arches | Rapier trimesh `ColliderDesc.trimesh()` per module | Cave GLBs |
| Structures | Trimesh or convex hull | Placement JSON |
| Fast queries | three-mesh-bvh | Render geometry |
| Dolphin containment | Soft repulsion re-pointed at shoreline mask + heightfield | Shore mask + BVH |

---

## 6. The Visual Spec (Track D)

### 6.1 Renderer and Pipeline (Track D §17.1)

| Parameter | Value |
|---|---|
| Three.js / context | 0.184, WebGL2 |
| Resolution / fps | ~1728×1080 at 60 fps, dynamic resolution allowed |
| Color space | `renderer.outputColorSpace = SRGBColorSpace` |
| Tone mapping | `NoToneMapping` (or Linear, exposure 1.0) |
| Post stack | None: no bloom, no SSR, no AO, no god-ray, no film/CRT/dither filters |
| Background | `scene.background = zone fog color = scene.fog.color` |

### 6.2 Fog and Background Per Zone (Track D §17.2)

| Zone | fog.color | fog.density start | tuning range |
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

All values labeled [REC] — provisional until replaced by PCSX2 native captures per Track D §19–20.

View-direction tint: +10–15% luminance toward pale cyan above +20° pitch; −15% below −25°. Zone transitions: lerp fog color and density over 3–5 s.

### 6.3 Lights Per Zone (Track D §17.3)

| Light | Lit zones (A,B,C,F,shallow) | Desaturated (E,G) | Dark zones (D,H,I,J,K,E2) |
|---|---|---|---|
| HemisphereLight sky | zone color, 0.9–1.0 | zone color, 0.7–0.85 | zone color, 0.05–0.15 |
| HemisphereLight ground | floor tint 25–35% of sky | same | near 0 |
| DirectionalLight | #FFF4E0, 0.45–0.65, elev 60–75° | same, 0.35–0.5 | 0.0–0.1 |

### 6.4 Materials (Track D §17.4)

| Class | Material | Locks |
|---|---|---|
| Terrain, rock, sand | MeshLambertMaterial or MeshStandardMaterial | roughness 0.95–1.0, metalness 0 |
| Vegetation, kelp | Double-sided flat cards, Lambert | same + sway in motion pass |
| Creatures | Lambert/Standard with same locks | matte, silhouette-first |
| Emissive props | emissive color from Track D palette | emissiveIntensity 0.5–1.5, no bloom |
| Water surface | jeantimex, untouched | intensity/depth-limit uniforms only |

### 6.5 Anti-Principles (Track D §18)

Banned as style — fails review regardless of other qualities:
1. Neutral-grey fog or fog treated as air
2. Retro hardware emulation as identity
3. Generic modern ocean
4. Modern lighting tells (pin-point speculars, PBR gloss, hard shadows, SSR, AO, bloom, lens flare)
5. Lifting darkness (caves stay genuinely dark)
6. Uniform fill (density is authored contrast)
7. Day/night cycles, weather states
8. Touching jeantimex (no shader rewrites, no substitutes)
9. Promoting estimates (no atlas hex as native sample)

---

## 7. The Movement and Camera Spec (Track E)

### 7.1 Core Model

**Hybrid impulse + target-speed cruise** with **facing-led steering** where velocity chases facing. (Track E §7–9)

- Each propulsion event adds a discrete forward impulse along facing
- Passive drag decays speed toward zero → glide
- Hold raises a target cruise speed the system eases toward
- Velocity is a world-space vector continuously re-pointed toward facing at a bounded turn-follow rate

### 7.2 Feel Constants — Canonical Implementation Values

Speed values are set by the master context (§2.3). Other feel constants are from Track E, converted to canonical BL (1 BL = 2.89 m) where applicable.

| Parameter | Canonical value | Meters | Range | Source |
|---|---|---|---|---|
| **Max cruise speed** | **1.73 BL/s** | **5 m/s** | — | Master context §7 (canonical) |
| **Burst speed** | **3.11 BL/s** | **9 m/s** | — | Master context §7 (canonical) |
| Propulsion impulse | 0.78 BL/s/pump | 2.25 m/s | 0.5–1.5 BL/s | Track E [EST]; meters = 0.9 × 2.5 |
| Passive drag (glide) | τ ≈ 2.0 s to half | — | 1.2–3.5 s | Track E [EST] |
| Active braking | 0 in ~0.6 s from cruise | — | 0.3–1.0 s | Track E [REC] |
| Min controllable speed | 0.26 BL/s | 0.75 m/s | 0.1–0.6 BL/s | Track E [REC]; meters = 0.3 × 2.5 |

**Retuning candidates (Track E [REC], not active):** cruise 10 m/s (3.46 BL/s), burst 17.5 m/s (6.06 BL/s). These may replace the canonical values only with explicit user approval at checkpoint 01–02 feel review.

### 7.3 Orientation and Turning (Track E Table B)

| Parameter | Start | Range |
|---|---|---|
| Low-speed yaw rate | 140°/s | 90–200 |
| Cruise yaw rate | 90°/s | 60–130 |
| Pitch rate | 100°/s | 70–160 |
| Max pitch clamp | ±85° | ±80–89 |
| Bank angle (auto) | ≤35° at max yaw | 20–50 |
| Velocity-follows-facing | 0.35 s cruise | 0.2–0.7 |

### 7.4 Camera (Track E Table C, respecting Track D bands)

BL values converted from Track E (original 1 BL = 2.5 m) to canonical 1 BL = 2.89 m. Meter values preserved.

| Parameter | Start (BL) | Start (m) | Range (BL) |
|---|---|---|---|
| Default follow distance | 3.03 BL | 8.75 m | 2.16–5.19 BL |
| Follow height | 0.69 BL | 2.0 m | 0.35–1.30 BL |
| Distance at max speed | 4.76 BL | 13.75 m | 3.46–6.92 BL |
| Look-ahead distance | 2.16 BL on smoothed vel | 6.25 m | 0.87–3.46 BL |
| Positional damping (catch-up) | t90 0.18 s | — | 0.1–0.35 |
| Positional damping (settle) | t90 0.45 s | — | 0.3–0.8 |
| Camera roll copy | 0–10% of dolphin roll | — | 0–15% |

Track D composition bands: dolphin 8–18% frame width (target 10–15%), 40–60% frame height.

### 7.5 Breach (Track E Table D)

BL values converted from Track E (original 1 BL = 2.5 m) to canonical 1 BL = 2.89 m.

| Parameter | Start (BL) | Start (m) | Range |
|---|---|---|---|
| Min approach speed | 2.60 BL/s | 7.5 m/s | 1.73–3.46 BL/s |
| Approach angle | ≥25° up | — | 10–45° |
| Gravity | 3.39 BL/s² | 9.8 m/s² | 6–14 m/s² |
| Airtime | 0.8–2.0 s by speed | — | variable |
| Splash occlusion | 0.2 s | — | 0.1–0.4 |

**Critical:** Do NOT collapse the two observed airtime durations into one constant; airtime depends on speed.

### 7.6 Body-Input Mapping (Track E Table E)

Default "Lean-to-swim" mapping: `leanX` → yaw, `leanY` → pitch, `handsForward` pulses → propulsion, `crouch` → brake, `tallness`+`armsRaised` → breach (dwell-gated), `handPoint` dwell → sonar, `armsOut` → recenter.

All actions have dead zones, hysteresis, confidence gates, and neutral-return timers.

### 7.7 Enjoyment Acceptance Criteria (Track E §22)

Review items at checkpoints 1–2 and 4–6:
- "10-minute no-objective swim stays pleasurable" (01_NEW_DECISIONS acceptance test)
- "Camera never surprised me"
- "Turning feels like a dolphin, not a flying camera"
- Comfort (no nausea) at length
- Coverage 8–18% width, 40–60% height in NormalFollow
- Camera never intersects geometry
- Target never lost >0.3 s
- No wedging
- Breach airtime tracks speed monotonically

### 7.8 Keep / Retune / Do Not Copy (Track E §21)

| Preserve closely | Modernize | Do NOT copy |
|---|---|---|
| Pulse-to-go/hold-to-cruise; facing-only steering; momentum & glide; body curvature; broad pitch; banking; breach continuity; variable airtime; charge as boost; hover/tailwalk; close-behind trailer | Camera lag/catch-up (add look-ahead + asymmetric damping); camera-distance change (smooth, speed-based); above-water camera (auto-blend); roll (flavor only); 180° turn (keep, tune) | Camera clipping; lost target; spazzy angles; cave disorientation; wedging; wrong-direction turns; finger-mashing fatigue; punitive collision |

---

## 8. The Asset Plan

### 8.1 The Dolphin (Track C)

| Property | Value | Source |
|---|---|---|
| Model | "Realistic Dolphin \| Rigged with 25+ Animations" by GAMICO | Track C §10 |
| License | CC-BY 4.0 | Track C §10 [WEB] |
| Format | GLB (valid glTF 2.0, no extensions, self-contained) | Track C [LOCAL] |
| Geometry | 4,314 triangles / 2,886 vertices | Track C [LOCAL] |
| Skin | 1 skin, 17 joints | Track C [LOCAL] |
| Material | 1 material, 3 embedded 4096² PNG textures | Track C [LOCAL] |
| Animations | 8 clips: SwimForward (2.0s), SwimForwardFast (0.667s), SwimLeft (1.333s), SwimRight (1.3s), SwimUp (1.333s), SwimDown (1.333s), Jump (2.0s), BreatheSurface (2.333s) | Track C [LOCAL] |
| Scale | Real-world meters at 1.0 scene scale (2.89 m × 0.99 m × 0.84 m) | Track C [LOCAL] |
| Axes | +Y up, faces +Z when animated (Three.js-conventional) | Track C [LOCAL] |
| Caveat | Rest pose renders nose-down — always play a clip | Track C [LOCAL] |
| Repo path | `apps/shared-world/public/models/dolphin/dolphin-fbx.glb` | Track A §11 |

**OPEN:** Metallic-roughness channel correctness — visual flank-sheen check under jeantimex water at checkpoint 1.

### 8.2 Animation Gap Analysis (Track C, Track E)

8 authored clips available. Track E's needed states map:

| State | Available clip | Procedural supplement |
|---|---|---|
| Cruise swim | SwimForward | — |
| Fast swim | SwimForwardFast | timeScale modulation |
| Turn left/right | SwimLeft / SwimRight | Additive spine curvature |
| Ascent / descent | SwimUp / SwimDown | — |
| Breach/leap | Jump | LoopOnce + clampWhenFinished |
| Surface breathing | BreatheSurface | — |
| Idle/hover | — | SwimForward at very low timeScale + additive bob |
| Braking | — | Procedural decel pose |
| Airborne tricks | — | Procedural roll/pitch from Jump base |

### 8.3 Placeholder Inventory

Every missing asset is a simple rectangular block at intended position, scale, orientation — color-coded by category.

| Category | Color | Source |
|---|---|---|
| Coral (plate/soft/anemone) | Orange (#FF8C00) | Track C §4 |
| Kelp / seagrass | Green (#228B22) | Track C §4 |
| Rock / reef formation | Gray (#808080) | Track C §4 |
| Fish school volume | Cyan (#00CED1) | Track C §4 |
| Ruins / architecture | Tan (#D2B48C) | Track C §4 |
| Tree / shrub | Dark green (#006400) | Track C §4 |
| Large marine wildlife | Purple (#800080) | Track C §4 |
| Wreck / dock | Brown (#8B4513) | Track C §4 |
| Sponge | Yellow (#FFD700) | Track C §4 |

### 8.4 Credits Obligations (Track C §9)

GAMICO dolphin requires: mandatory credit + license link + note changes, accessible to all end users. Satisfied via: `CREDITS.md` + in-app panel + `LICENSE-dolphin.txt` alongside model files.

Attribution text:
```
"Realistic Dolphin | Rigged with 25+ Animations" by GAMICO
(https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8)
Licensed under CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
```

### 8.5 Audio Slice Set (Track C §7, Master context §14)

Minimal pass (checkpoint 13):
- One above-water ambient loop: "Underwater [Loop] AMB" by DCSFX (Freesound, CC0) — *above-water equivalent TBD*
- One underwater ambient loop: "Underwater [Loop] AMB" by DCSFX (CC0)
- Breach splash: Sonniss #GameAudioGDC bundle (royalty-free)
- Surface breathing: same Sonniss source
- Low-pass muffle transition at waterline

Via plain WebAudio / `THREE.PositionalAudio`. No FMOD/Wwise.

---

## 9. The Checkpoint Ladder

### 9.1 Ladder Overview

The ladder follows master context §13.2 with adjustments for research findings. Each adjustment and its cause is recorded below.

**Adjustments from §13.2:**
1. Track E movement/camera retuning is folded into checkpoints 1–2 (pool-scale feel) and 4–6 (region-scale and breach feel) as explicit scope lines.
2. Checkpoint 1 is expanded to include the dolphin animation integration (Track C confirmed 8 clips work with AnimationMixer zero-plugin; Track E §11 specifies the mixer architecture).
3. No checkpoint splits needed under current findings — each is completable in one focused session.

### 9.2 Full Sequence

| # | Name | Scope | Gate type |
|---|---|---|---|
| 00 | Scaffold and Stock Demo | Create `apps/shared-world/`; vendor jeantimex pristine; run stock demo locally | Demo review |
| 01 | Dolphin in the Pool | GAMICO dolphin in unmodified pool; ported `sim.ts` + keyboard controls; 8 animation clips playing; water interaction | Demo review + feel review |
| 02 | Pool Camera | Camera work: above/below transitions, half-submerged behavior, Track E chase camera rig | Demo review |
| 03 | Region Layout Gate | 2–3 top-down sketch maps; user picks or redlines | Decision gate |
| 04 | Pool to Region | Enlarge water domain; container swap (pool → coastline + seabed heightfield); four-shot fidelity test | Demo review |
| 05 | Terrain and Islands | Continuous terrain crossing waterline; islands emerge; shoreline masking verified above and below | Demo review |
| 06 | Breach Over Region | Breach, airborne framing, re-entry over real region; Track E breach feel tuning | Demo review + feel review |
| 07 | Placeholder Layout | Color-coded placeholder blocks for every asset category per approved layout | Demo review |
| 08 | Ecco Atmosphere Pass A | Fog curve, palette, visibility per Track D; underwater only; surface stays pure jeantimex | Demo review + visual review |
| 09 | Caves and Overhangs | Authored modular cave meshes; Rapier trimesh collision; seam blending | Demo review |
| 10 | Vegetation | SeedThree bakes (or alternative) replace vegetation placeholders | Demo review |
| 11 | Fish and Ambient Life | Fish motion + ambient wildlife (placeholders until user-supplied) | Demo review |
| 12 | Ruins and Architecture | Asset replacement as user supplies models | Demo review |
| 13 | Audio | Minimal audio pass: ambient loops, splash, breathing, muffle transition | Demo review |
| 14 | Other Modes | Rowing, Walking, Flight views over the same region | Demo review |

---

## 10. Performance Budget

### 10.1 Frame Budget (Track B Q11)

Target: 16.6 ms total (60 fps). All figures ESTIMATED, confirmed at checkpoints.

| Stage | Est. cost | Notes |
|---|---|---|
| Wave sim (512² windowed) | ~0.3 ms | 2 steps/frame |
| Normal pass | ~0.1 ms | — |
| Caustics (1024²) | ~0.5–1.0 ms | Per-vertex terrain raymarch adds cost |
| Terrain + walls | ~2–3 ms | ~1–2 M tris, triplanar |
| Water surface (raymarch) | ~2–4 ms | Dominant variable cost |
| Objects | ~1–2 ms | Instanced flora/rocks |
| Post/UI | ~0.5 ms | — |
| **Subtotal render** | **~7–11 ms** | — |
| **Pose tracking reserve** | **~5 ms** | Held out of render budget |

### 10.2 Degradation Order

Reduce secondary density and effects **before** touching the defining features:

1. Particle counts, marine snow → reduce first
2. Wildlife instance counts → reduce
3. Vegetation instance counts → reduce
4. Terrain LOD bias → loosen
5. Cave detail → simplify
6. **Protected (degrade last):** water presentation, fog, dolphin animation, camera, terrain silhouettes, breach view

### 10.3 Per-Checkpoint Assertions

Every checkpoint session asserts:
- `simHz > 100` unconditionally
- fps ≥ 60 at 1728×1080 on macOS (native GPU)
- Headed mode required for GPU assertions

---

## 11. Verification Standard

Every checkpoint session must produce:

1. **Live local demo** — exact commands to run, URL, what the user should see and try
2. **Summary of changes** — files added/modified, systems integrated
3. **Placeholder inventory** — current state of all placeholder categories (present/replaced/not-yet-needed)
4. **Performance report** — fps, render resolution, frame-budget breakdown
5. **Deviations list** — any deviation from this spec, with cause
6. **STOP** — wait for user review and approval before any further visual change
7. Approval of this checkpoint does not authorize starting the next

---

## 12. Open Items and User Actions

### 12.1 User Decisions Required

| Item | Context | Blocking? |
|---|---|---|
| Region sketch selection | Checkpoint 03 — pick or redline one of 2–3 maps | Blocks checkpoint 04 |
| Supply fish models | Track C — "user supplies ~3 models" | Blocks checkpoint 11 real assets (placeholders until then) |
| Metallic-roughness visual check | Track C — flank-sheen under water | Review at checkpoint 01 |
| Pitch inversion default | Track E §27 — match original inverted flight model or non-inverted? | Non-blocking (default to inverted per original) |

### 12.2 Consolidated Open Items from Research

| Item | Source | Resolution path |
|---|---|---|
| jeantimex HEAD commit SHA | Track B Open 1 | Pin at authenticated clone (checkpoint 00) |
| Verbatim GLSL of jeantimex shader names | Track B Open 2 | Grep-confirm at clone time |
| 256² sim resolution in `Water.ts` | Track B Open 3 | Confirm at clone |
| All performance numbers [EST] | Track B Open 4 | Confirm at each checkpoint |
| martinRenou/nemutas licenses | Track B Open 5 | Verify before any code copy (fallback only) |
| 8-vs-"25+" clip discrepancy | Track C Open | Non-blocking; 8 clips sufficient |
| PCSX2 native captures | Track D §19–20 | User runs capture sheet when convenient; nothing blocks checkpoint 8 meanwhile |
| Exact original movement constants | Track E §23 | All [UNR]; use [REC] starting values |
| GAMICO exact bone count verified | Track E §23 | Track C confirmed: 17 joints |
| Track D framing bands confirmation | Track E §27 | 8–18% / 40–60% confirmed in Track D §17.7 |

### 12.3 Resolved Cross-Report Conflicts

| Conflict | Resolution | Rule applied |
|---|---|---|
| BL scale (Track D: 2 m vs Track E: 2.5 m) | Canonical 1 BL = 2.89 m (GAMICO model audited loaded length). Both Track D and Track E BL values converted to meters via their original scale, then re-expressed in canonical BL. Meter values are authoritative. | Track C local measurement is ground truth; deterministic resolution, not a user decision |
| Speed family (sim 16/22, master 5/9, Track E 10/17.5) | Master context 5/9 m/s are the canonical implementation values. Track E 10/17.5 m/s are labeled retuning candidates only. Sim's 16/22 retired. | Master context > reports (authority order §1); deterministic resolution, not a user decision |
| Track D / Track E BL-denominated parameter tables | All converted to canonical BL (÷ 2.89) with meter values preserved from original conversion | Meter values authoritative; BL is informational |
| Track A containment band 55 m | Retune at region scale per Track E | Track E retune mandate > Track A preserved constants |

---

*End of Implementation Master. This document, combined with individual checkpoint prompts, is the complete specification for every implementation session. No implementer judgment is required.*
