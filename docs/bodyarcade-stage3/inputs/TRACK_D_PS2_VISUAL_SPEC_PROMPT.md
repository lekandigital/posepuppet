# Track D Research Prompt — PS2 Visual Specification and Capture Instruction Sheet

**Project:** BodyArcade Shared-World, Stage-2 research, Track D of five (A–E).
**Session type:** Multimodal deep research. The 12 selected PS2 gameplay clips are attached and are your **primary evidence** — watch them, sample frames from them, and measure against them.
**You are a researcher, not an implementer.** You produce a measurable specification and a user-facing capture guide.

---

## 1. Mission

Two objectives:

1. **The measurable spec:** translate the visual identity of the PlayStation 2 release of *Ecco the Dolphin: Defender of the Future* (Appaloosa Interactive; Dreamcast 2000, PS2 port 2002) into Three.js-ready parameters — every value labeled **measured** or **estimated** — precise enough that checkpoint 8 ("Ecco atmosphere pass A") can be implemented by dialing in numbers, not by taste.
2. **The capture instruction sheet:** a step-by-step, user-facing guide for capturing reference frames from PCSX2 so the user can later replace every estimate with a measurement.

This track is **visual measurement only**. Do not re-research design archaeology — story, levels, mechanics, and platform history are finished work owned by the attached archive reports; cite them. Movement/camera *feel* is owned by Track E; you cover camera *framing metrics* as visual composition (follow distance, FOV, lag as they affect the look), and defer feel dynamics to Track E.

## 2. Governing context (embedded digest — the attached master context governs in full)

- **PS2 matters far more than Dreamcast.** PS2 footage is primary; Dreamcast material is secondary evidence for level layout, geometry, and composition only — never the color/effects authority.
- Documented PS2-vs-Dreamcast deltas to re-verify against footage: PS2 environmental textures are **more vividly colored** (not more detailed); PS2 caustics/refraction are **toned down relative to Dreamcast but still present and attractive**; PS2 has **no mipmapping** (sharper, no distance shimmer) and adds **dithering visible mainly in dark areas**; PS2 holds a steadier framerate and adds guidance affordances (compass, L3 next-objective, R3 camera correction — HUD inspiration for later). 4:3 original aspect; **BodyArcade does not adopt 4:3.**
- **Banned failure modes:** (1) retro hardware emulation as style — forced low poly, flat-shaded vertex lighting as identity, textureless meshes, affine wobble, dither-as-aesthetic; (2) generic modern ocean — clean stylized water, FFT storm ocean, foam-heavy spectral water, "tasteful reinterpretation." The target is the look of that specific game — lush, dense, fogged, caustic-lit, documentary-naturalistic ("National Geographic underwater video" was Appaloosa's stated reference).
- **Fidelity hierarchy:** the jeantimex water look is untouchable for now; your spec governs the **underwater atmosphere** (fog curve, palette, visibility, caustic intensity/character) implemented through jeantimex's mechanisms at checkpoint 8. Where your spec and stock jeantimex disagree, jeantimex wins until the user approves each tweak.
- **The fog is the water:** always colored, never neutral gray; pop-in happens inside the color field. Depth stratification is the level design: bright dense shallows, blue midwater, dark sparse deep.
- Fixed conditions for the slice: one time-of-day (bright tropical sun), no day/night, no weather.
- Renderer context for your parameter targets: Three.js 0.184, WebGL2, exponential fog targets, 60 fps @ ≈1728×1080.

## 3. Required attachments and sources

| Item | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record; §3, §7.1, §15.4 are your spec. |
| `01_NEW_DECISIONS_TO_MERGE.md` | Newest decisions. |
| `02_BODYARCADE_DESIGN_PLAN_V2.md` | Method source: capture protocol (Part 2 — adapt to PS2/PCSX2), Style-Bible skeleton (Part 3), density/landmark ideas (Part 4). Its layered stack and milestones are superseded. |
| `03_ECCO_VISUAL_ART_BIBLE_A.md` | Prior art-bible research (per-world palettes, lighting; Dreamcast-oriented — re-label for PS2). |
| `04_ECCO_VISUAL_ART_BIBLE_B.md` | Prior art & rendering bible (platform deltas incl. PS2 caustics/dither facts; recreation cheat-sheet). |
| `05_ECCO_DESIGN_ARCHAEOLOGY_A.md`, `06_ECCO_DESIGN_ARCHAEOLOGY_B.md` | Zone-identity evidence (archive; cite, do not redo). |
| `07_ATTACH_VIDEO_FILES.md` | Clip attachment instructions. |
| `90_REFERENCE_MEDIA/ps2-ecco/VIDEO_INDEX.md` | Clip index. |
| **All 12 selected MP4 clips** from `90_REFERENCE_MEDIA/ps2-ecco/selected/` | Primary evidence: `01_04m30s-05m02s.mp4` … `12_35m30s-41m56s.mp4` (~25 min 13 s total), extracted from the ~42-minute xTimelessGaming PS2 gameplay capture (PCSX2 v1.7.0, 1920×1080, ~59.94 fps). |
| Supplementary web sources | Additional PS2 footage/screenshots as needed — flag every emulator-upscaled, filtered, or widescreen-hacked source and weight it accordingly. |

**Source-quality caveat you must carry through the report:** the attached clips are themselves a PCSX2 capture at 1080p — likely upscaled beyond native PS2 resolution. Colors and composition are trustworthy; sharpness, texture detail, and dither visibility may not be native-accurate. Note this wherever it affects a measurement, and let the capture sheet (Objective 2) define the settings that produce native-accurate replacements.

## 4. Evidence to inspect

1. All 12 clips, systematically: sample frames across depth bands (surface / shallows / midwater / deep / caves), regions, and look-directions (toward light, away from light, along terrain, into open water, at the surface from below, above water).
2. The prior art-bible documents' palette and platform-delta claims — re-verify each against the PS2 footage; correct Dreamcast-oriented labels.
3. Supplementary PS2 screenshots/footage from the web where the clips lack coverage (label source quality).

## 5. Questions that must be answered (the measurable spec)

1. **Per-zone palettes** as hex ramps — for each visible zone/depth band in the footage: water color near/far, terrain, vegetation, light, shadow; extracted via frame sampling (k-means or equivalent), with the frame timestamps cited.
2. **Fog color and density by depth and by region**, expressed as exponential-fog targets (color + density values per depth band) usable directly in Three.js; how fog color shifts with view direction (toward vs away from light).
3. **Visibility distances** per depth band and region — at what apparent distance do large forms, mid detail, and silhouettes vanish into the color field? (Use dolphin body-lengths as the unit where absolute meters are unknowable; state the conversion assumption, ~2 m per body length.)
4. **Caustic character at PS2 intensity** — coverage, scale, contrast, animation speed, where they appear (seabed, terrain, creatures?), depth falloff; confirm the "toned down vs Dreamcast but present and attractive" delta against footage.
5. **Lighting model** — broad overhead surface light, pale caustic streaks, low-frequency bounce, local glows in dark zones; confirm the absence of modern pin-point speculars; sun-shaft behavior; above-water sun/sky treatment.
6. **Texture treatment** — softness, frequency content, value grouping; the no-mipmapping sharpness character and where dithering is visible; what this translates to in modern texture authoring guidance (for Track C's texture sourcing).
7. **Particles** — marine snow, motes, bubbles: types, densities, sizes, speeds, depth variation.
8. **Wildlife density per depth band** — how many fish/creatures are typically on screen in shallows vs midwater vs deep vs caves (counts from sampled frames).
9. **Camera framing metrics as they affect the look** — follow distance (body lengths), FOV estimate, lag character, collision behavior with terrain — measured for composition purposes; feel dynamics deferred to Track E (cross-reference, don't duplicate).
10. **Composition and landmark grammar** — spires, arches, columns, framed cave mouths, navigational silhouettes: how many strong landmarks are in view, at what distances, how framed; the sparse-vs-dense rhythm.
11. **Breach and above-water presentation** — sky, water surface from above, shoreline reads, splash character, above-water palette.
12. **Depth-stratification banding** — the bright-shallows / blue-midwater / dark-deep banding as measurable ramps (tie together items 1–3).
13. **The PS2-vs-Dreamcast delta verification** — for each documented delta in §2, confirmed / contradicted / unverifiable against footage.

## 6. Objective 2 — the capture instruction sheet (user-facing)

A step-by-step guide so the user can replace estimates with measurements:

1. **PCSX2 settings that don't lie:** software renderer or native-resolution hardware; no upscaling, no texture-filtering overrides, no widescreen hacks; original 4:3; recommended capture format.
2. **Where to capture:** a frame grid across depth bands × regions × look-directions (toward light, away, along terrain, into open water, at the surface from below, above water); save-point suggestions from the game's structure (cite the archive reports for locations).
3. **File naming convention** for the frame grid.
4. **Extraction procedure:** k-means palette extraction; deriving absorption/visibility curves from frames at increasing distances.
5. **The replacement map:** exactly how each estimated value in Objective 1 gets replaced by which measurement from which grid cell.

## 7. Required tables and deliverables

1. **Palette table** — per zone/depth band, hex ramps with source frame timestamps, measured/estimated flag.
2. **Fog and visibility table** — per depth band: fog color, exponential density target, visibility distances, measured/estimated flag.
3. **Caustics spec table** — intensity, scale, speed, coverage, falloff.
4. **Lighting spec** — sources, colors, intensities, what is explicitly absent.
5. **Particles and wildlife-density tables** — per depth band.
6. **Camera framing metrics table** (composition only; cross-reference Track E).
7. **Composition/landmark grammar summary** with annotated frame references.
8. **Breach/above-water spec.**
9. **PS2-vs-Dreamcast delta verification table.**
10. **The capture instruction sheet** (§6) as a self-contained user-facing section.
11. **Answered / Open / Needs-user** section (e.g., which estimates most need the PCSX2 capture; whether the user should supply preferred longplay links).

## 8. Uncertainty and citation rules

- Every value is labeled **measured** (from a cited frame/timestamp of a stated source) or **estimated** (with the reasoning). Measured values cite clip filename + timestamp.
- PS2 footage is primary. Dreamcast material is secondary, layout/geometry only. Flag emulator-upscaled or filtered sources everywhere they contribute.
- The fog is never neutral gray — if a measurement appears gray, investigate the source quality before recording it.
- Do not re-research design archaeology; cite the attached archive reports for zone identity and structure.
- Do not soften or generalize the target ("PS2-inspired," "stylized realism" are banned framings). Do not propose changes to the jeantimex surface — your spec feeds checkpoint 8's underwater atmosphere pass only.
- Do not adopt 4:3 or console-limitation aesthetics into the spec.

## 9. Output

- **Exact output filename:** `TRACK_D_PS2_VISUAL_SPEC_REPORT.md`
- **Destination:** `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.
- Markdown with tables; executive summary first; the capture sheet as its own clearly-marked section; Answered / Open / Needs-user last.

## 10. Completion criteria

- [ ] Every question in §5 is answered with values, each labeled measured (with clip + timestamp) or estimated (with reasoning).
- [ ] All deliverable tables in §7 are present and Three.js-ready (hex colors, exponential-fog densities, distances in stated units).
- [ ] The PS2-vs-Dreamcast deltas are individually verified, contradicted, or marked unverifiable.
- [ ] The capture instruction sheet is complete enough for the user to execute without further questions, and every estimate maps to the measurement that will replace it.
- [ ] Source-quality caveats (PCSX2 1080p capture) are carried wherever they matter.
- [ ] No design-archaeology re-research; no target softening; no jeantimex-surface proposals.
- [ ] The report is written to `TRACK_D_PS2_VISUAL_SPEC_REPORT.md`.
