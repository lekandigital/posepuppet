# Track C Research Prompt — Asset and Audio Manifest, Dolphin Audit

**Project:** BodyArcade Shared-World, Stage-2 research, Track C of five (A–E).
**Session type:** Web-enabled deep research, with local model-file inspection where the environment supports binary attachments (the dolphin GLB/ZIP are attached when possible).
**You are a researcher, not an implementer.** You produce a manifest and audit report. You purchase nothing, download nothing into the repo, and generate no assets.

---

## 1. Mission

Produce everything needed to eventually replace every placeholder block in the shared world with a real, license-verified asset — starting with a **blocking, first-priority audit of the one asset already in hand: the GAMICO dolphin** (checkpoint 1 of the entire implementation ladder depends on it). Then a full candidate manifest for every asset category, an audio mini-manifest for the slice, and the pipeline standards (formats, budgets, naming, credits).

## 2. Governing context (embedded digest — the attached master context governs in full)

- **Visual target:** strict recreation, as far as practical, of the PS2 release of *Ecco the Dolphin: Defender of the Future* — lush, dense, fogged, caustic-lit, documentary-naturalistic. Prefer assets that **visually match PS2 Ecco** over technically superior but visually inappropriate alternatives. Banned: retro-hardware-emulation aesthetics and generic-modern-ocean aesthetics.
- **Strict content-generation policy:** the implementation model may never invent substitute assets. Every missing asset is a color-coded rectangular placeholder block until the user supplies or approves the real one. **Agents purchase nothing** — paid candidates are labeled, never bought.
- **Asset philosophy:** hybrid — existing assets as the foundation, curated carefully; approved assets may be modified in Blender; custom creation only for identity-defining gaps.
- **Platform:** Three.js 0.184, WebGL2, desktop Chrome, M5 MacBook Pro, 60 fps @ ≈1728×1080. Delivery format glTF 2.0.
- **Vegetation:** SeedThree (`github.com/SkyeShark/SeedThree`) is the approved generator, used as an **offline baking tool** (generate → bake to glTF → instance at runtime with a small vertex-sway shader). Its WebGPU-first nature is irrelevant because output is glTF. If its costs prove too high, list 1–2 alternative generators with cost estimates.
- **Fish:** the user will provide ~3 models initially; they are **not yet chosen** — placeholders until supplied. Your fish candidates are recommendations for the user to pick from, not selections.
- **Audio slice scope (checkpoint 13):** one above-water ambient loop, one underwater ambient loop, breach splash, surface breathing, low-pass muffle transition at the waterline — plain WebAudio / `THREE.PositionalAudio`. FMOD/Wwise are not used. Runtime never generates audio.

## 3. Required attachments and sources

| Item | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record; §8, §9, §10, §14, §15.3 are your spec. |
| `01_NEW_DECISIONS_TO_MERGE.md` | Newest decisions; pins the exact Sketchfab listing. |
| `02_SHARED_WORLD_COMPLETE_REFERENCE_ARCHIVE.md` | Per-mode asset lists from prior planning (archive; evidence, not authority). |
| `03_BODYARCADE_DESIGN_PLAN_V2.md` | Ideas bank (archive). |
| `04_OPTIONAL_HISTORICAL_AUDIO_IDEAS.md` | Historical audio strategy (archive). |
| `05_DOLPHIN_SOURCE.md` | Dolphin source and audit record. |
| `90_REFERENCE_ASSETS/dolphin/dolphin-fbx.glb` | The GLB in hand (likely Sketchfab auto-conversion of the FBX). Attach when the environment supports binary inspection. |
| `90_REFERENCE_ASSETS/dolphin/dolphin-glb.zip` | Archive containing `source/Dolphin.fbx` + Unity-convention textures (`T_Dolphin_BaseColor/MetallicSmoothness/Normal/Occlusion.png`). |
| Sketchfab listing | https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8 — "Realistic Dolphin \| Rigged with 25+ Animations" by GAMICO. |

If binary inspection is not available in your environment, do everything web-verifiable (license, listing claims, creator pattern) and write the exact local inspection procedure (tools and commands: e.g., `gltf-transform inspect`, Blender import checklist) for a follow-up local session, marking the affected checklist items **pending-local-verification**.

## 4. Evidence to inspect

1. The Sketchfab listing: current license type and text, download availability, advertised triangle/vertex counts, the animation list as advertised.
2. The local files: GLB contents (meshes, rig, animation clips, embedded textures) vs the FBX+textures package.
3. GAMICO's creator page and the "Realistic Animal | 25+ Animations" series pattern (free-download vs Fab-marketplace variants) — establishes what the free files typically contain.
4. Candidate asset sources per category: Sketchfab, Poly Haven, Quaternius, Kenney, OpenGameArt, ambientCG/PolyHaven textures, and comparable license-clear sources.
5. SeedThree repository: license (MIT per prior notes — verify), capabilities (trees, branching vegetation, grass, wind, LOD, instancing, billboards; possible branching coral after retuning), export path to glTF, implementation effort.
6. Audio sources: Freesound, Sonniss GDC archives, and comparable license-checked libraries; ElevenLabs capability for the generation list.

## 5. Questions that must be answered

**Dolphin audit (first and blocking — §10.3 of the master context):**

1. What is the exact current license of the listing, with the license text linked and quoted? What attribution wording is required, and what is the exact attribution string to use? Where will attribution live (in-app credits panel + repo `CREDITS.md`)?
2. Do the free files contain the **full rig and all advertised animations**? Does `dolphin-fbx.glb` embed the clips, or must clips be exported from `Dolphin.fbx` via Blender?
3. What is the exact animation clip list — names, lengths, loop suitability, quality notes?
4. Texture conversion status: the set is Unity-convention (`MetallicSmoothness` packs smoothness in alpha; glTF expects metallic-roughness, roughness = 1 − smoothness). Is the GLB already converted correctly? What visual check under the jeantimex water confirms it?
5. Is the material/skin suitable under jeantimex lighting (specular response, normal-map strength), and what adjustments are anticipated?
6. Gap analysis against the needed clip set: cruise swim, fast swim, banking left/right, braking, breach/leap, airborne, re-entry, idle/hover, surface breathing, collision/flinch. Which exist, which are missing, and what Blender work covers the gaps? (Cross-reference Track E's animation-state needs if its report is available; otherwise flag the dependency.)
7. Scale, orientation, forward axis, origin point; confirmed polygon and texture budgets; recommended repo drop path (e.g., `apps/shared-world/public/models/dolphin/` with the license file alongside).

**Category manifest — for every category:** rocks and reef formations; plate coral; soft coral; anemones; sponges; kelp; seagrass; trees; shrubs; flowers; grass and ground vegetation; ruins; buildings; docks; wrecks; shoreline props; licensed terrain and ground textures; fish; larger marine wildlife; bubbles; marine snow; suspended sediment; sand disturbance; light shafts.

8. For each category: 1–3 concrete candidates, each with preview link, source URL, creator, license (verified at source), attribution requirement, cost (free preferred; paid clearly labeled, never purchased), file format, polygon count, texture resolution, rig/animation status, Three.js/WebGL2 compatibility, required Blender work, LOD needs, PS2-Ecco visual fit (justified), and a recommendation — plus **1–2 fallbacks for every critical asset**.
9. Which categories are better served by SeedThree bakes than by downloaded models (kelp? seagrass? branching coral?) — with effort estimates?
10. What licensed terrain/ground texture sources fit the soft, low-frequency, broad-value-grouping PS2 treatment?

**Vegetation pipeline:**

11. SeedThree evaluation: verified license, bake-to-glTF workflow, effort estimate; 1–2 alternative generators with cost estimates in case SeedThree proves too expensive.

**Audio mini-manifest:**

12. License-checked candidate sources for the five slice sounds, plus an ElevenLabs generation list (prompt sketches, variation counts) for the same set; the biome-bed organization (reef, kelp, cave, abyss, vents, wrecks) for the later library.

**Pipeline standards:**

13. Delivery standards: glTF 2.0 conventions, texture budgets per asset class, naming conventions, repo drop paths, the `CREDITS.md` + in-app credits format covering every attribution obligation collected above.

## 6. Required tables and deliverables

1. **Dolphin audit report** — every §5 item 1–7 answered; a verdict: is checkpoint 1 unblocked, and if not, exactly what unblocks it.
2. **Animation inventory table** — clip name, length, loop, quality, maps-to-need, gap/Blender work.
3. **Master asset manifest table** — one row per candidate, all columns from question 8, grouped by category, recommendation marked.
4. **Critical-asset fallback table.**
5. **SeedThree evaluation + alternatives table.**
6. **Texture-source table** (terrain/ground).
7. **Audio mini-manifest** — slice sounds with sources/licenses + ElevenLabs generation list.
8. **Pipeline standards document** — formats, budgets, naming, drop paths, credits format, with a draft `CREDITS.md` skeleton.
9. **License-obligation ledger** — every attribution/copyleft obligation the manifest creates, in one place.
10. **Answered / Open / Needs-user** section (e.g., fish choices, paid candidates awaiting user decision, pending-local-verification items).

## 7. Uncertainty and citation rules

- Verify every license at the primary source; link the license text. **Never assume.** Anything unlicensed or unverifiable is **reference-only** and marked ineligible for use.
- Separate measured facts (listing text, file inspection results) from inference (quality judgments, effort estimates). Label every estimate.
- Cost discipline: free preferred; paid clearly labeled with price; nothing purchased.
- **No substitution:** the GAMICO dolphin is the character; SeedThree is the approved baker (with the sanctioned swap-if-too-costly clause). Candidates elsewhere are recommendations for user approval, not selections — nothing in your report authorizes generation of assets.
- Do not re-open settled decisions (master context §15.5). Do not re-research Ecco design archaeology — cite the archive.
- Pin exact URLs for every candidate and every license.

## 8. Output

- **Exact output filename:** `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md`
- **Destination:** `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.
- Markdown with tables; the dolphin audit comes first in the report; executive summary first overall; Answered / Open / Needs-user last.

## 9. Completion criteria

- [ ] The dolphin audit answers all seven blocking items or marks specific ones pending-local-verification with the exact local procedure written out.
- [ ] A clear checkpoint-1 verdict exists (unblocked / blocked-by-X).
- [ ] Every category in §5 has candidates with all required columns, verified licenses, and fallbacks for critical assets.
- [ ] SeedThree is evaluated and alternatives listed with costs.
- [ ] The audio mini-manifest covers all five slice sounds with license-checked sources and a generation list.
- [ ] Pipeline standards and the license-obligation ledger are complete; a draft `CREDITS.md` skeleton exists.
- [ ] Nothing was purchased; no asset was generated; no unverified license is marked usable.
- [ ] The report is written to `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md`.
