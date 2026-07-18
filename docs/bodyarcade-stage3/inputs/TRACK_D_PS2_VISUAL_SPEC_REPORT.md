# TRACK_D_PS2_VISUAL_SPEC_REPORT.md

PS2 visual identity specification and capture instruction sheet for BodyArcade Shared-World Stage-2. Track D of research tracks A-E. Target: the PlayStation 2 release of Ecco the Dolphin: Defender of the Future (Appaloosa Interactive; Dreamcast 2000, PS2 port 2002, NTSC-U serial SLUS-20394). Destination in bundle: 80_OUTPUTS/research-reports/.

Renderer context for all recommendations: Three.js 0.184, WebGL2, exponential fog, 60 fps at approximately 1728x1080. Unit convention: distances in dolphin body-lengths (BL), conversion assumption 1 BL = 2 m [ESTIMATED, stated per the governing prompt]. The jeantimex water surface is protected; nothing in this report modifies it.

---

## 1. Executive summary

Ranked load-bearing visual principles, in order of importance (full statements in section 2):

1. The fog is the water. Always chromatic, never neutral grey.
2. Palettes are authored per region, layered on a depth ramp. Saturation is a region property, not only a depth property.
3. Value contrast carries navigation. Bright apertures and shafts anchor dark frames.
4. Broad diffuse top-down light. Matte materials. No pin-point speculars, no hard shadows.
5. Terrain is blocked into large simple masses. Detail is textural hue, not geometry.
6. The dolphin is centered at a fixed chase framing, 8-18% of frame width.
7. Life is sparse by default and clustered when present.
8. Caustics live in the shallow band only, soft and modest. Light shafts are aperture-bound landmarks.
9. One bright tropical day. The single dawn frame in the corpus is exceptional, not a system.
10. jeantimex owns the surface and waterline. This spec governs the underwater atmosphere through jeantimex's mechanisms.

Bottom line. The PS2 Defender of the Future look is carried almost entirely by colored exponential depth-fog plus region-authored palettes, under a diffuse overhead light, on matte low-frequency-textured terrain composed as large legible silhouettes. Get the fog color, the fog density band per zone, and the region palette jumps right and the identity follows. Caustics, particles, and wildlife are secondary dressing with strict, low budgets. This is established by direct inspection of 412 PCSX2-captured frames across all twelve source clips [section 3], corroborated by the primary contemporary record [section 16].

Every number in this report is labeled. Nothing here is a native-engine measurement. Atlas-derived values are bounded estimates from downscaled thumbnails; the capture sheet in section 19 and the replacement map in section 20 define exactly how each one is replaced by a native PCSX2 measurement. The recommended Three.js values in sections 6-17 are decision-ready starting points for checkpoint 8 (Ecco atmosphere pass A) and are dialable by number today.

One correction to the prior record: the claim "the original is 4:3" is too narrow for the PS2 port. External verification indicates the PS2 version carries a native, menu-selectable 16:9 mode, and the source capture behind the atlas fills 16:9 without pillarboxing. Details and status in section 16. BodyArcade's decision is unchanged: modern 16:9 at 1728x1080, no retro aspect adoption.

---

## 2. Ranked load-bearing visual principles

P1. The fog is the water, and it is always chromatic. Distant geometry terminates in the water color in every open-water gameplay frame across all four atlases; no neutral-grey fog appears anywhere in 412 frames [DIRECT OBSERVATION; A01 p1 F0001; A02 p3 F0129; A03 p2 F0223; A04 p6 F0370]. Pop-in happens inside the color field [DOCUMENTED: master context section 3.4; Wikipedia's review synthesis records the fog as both aesthetic and draw-distance measure]. The Three.js scene background must equal the fog color per zone [DOCUMENTED: three.js manual].

P2. Region-authored palettes on a depth ramp. Clips 8-9 are desaturated grey-blue at every observed depth including near the surface; Clips 10-12 are vivid teal throughout. The jump is visible side by side on one atlas page [DIRECT OBSERVATION; A02 p6, F0165 vs F0168]. Depth stratification (bright shallows, mid teal, dark sparse deep) is real and load-bearing, but region identity modulates it.

P3. Value contrast, not color coding, carries navigation. Cave exits, arches, and shafts are the brightest elements of dark frames and sit at frame center [DIRECT OBSERVATION; A01 p7 F0080; A02 p5 F0154; A03 p6 F0270; A04 p5 F0365].

P4. Diffuse top-down light on matte materials. The upper third of open-water frames is the brightest region; the dolphin reads as a matte value mass with a soft terminator; no pin-point specular appears on dolphin, rock, coral, or crystal in any of the 412 thumbnails [DIRECT OBSERVATION; F0003, F0145, F0295, F0370]. Dark zones go genuinely dark rather than being lifted by ambient [DIRECT OBSERVATION; F0057, F0212, F0380].

P5. Large blocked terrain masses; detail is textural. Rock reads as low-frequency mottling in broad value groups; adjacent faces carry different hues under one light; faceting is visible on angular forms in dark scenes [DIRECT OBSERVATION; F0051, F0190, F0243, F0308, F0323].

P6. Centered dolphin at a consistent chase framing, 8-18% of frame width, 40-60% of frame height [BOUNDED VISUAL MEASUREMENT; F0009, F0087, F0158, F0223, F0279, F0370].

P7. Sparse-by-default wildlife, clustered when present. Ordinary frames carry 0-4 creatures; schooling frames 10-30; sparse plains 0-1 [BOUNDED VISUAL MEASUREMENT, lower bounds; F0066, F0148, F0177, F0261, F0371].

P8. Shallow-band caustics, aperture-bound shafts. Caustics are strong only on sunlit shallow floors and absent from hazy and deep frames [DIRECT OBSERVATION; F0247, F0008, F0181 vs F0223, F0249]. All observed light shafts descend from a visible opening [DIRECT OBSERVATION; F0154, F0365, F0409].

P9. One bright tropical day. Ten of eleven above-water frames across all four atlases are bright blue day; the single dawn frame F0007 is flagged exceptional and excluded from the slice [DIRECT OBSERVATION; section 15].

P10. jeantimex protection. The jeantimex surface, waterline, reflections, refraction, Snell's window, and breach crossing stay untouched. This spec is implemented through jeantimex's mechanisms (fog, palette, caustic intensity uniforms) and, where the two disagree, jeantimex wins until the user approves each tweak [DOCUMENTED: master context sections 3.3 and 5.2].

---

## 3. Evidence and source-quality statement

Primary visual evidence. The twelve PS2 MP4 clips named by the governing prompt were replaced for this run by the reduced multimodal evidence package: four visual-atlas PDFs carrying 412 chronological frames on 36 pages, sampled approximately every 4 seconds with boundary and scene-change supplements, plus the atlas index, video index, and technical inventory. All four PDFs and all 36 pages were directly inspected in this working context during the evidence-extraction pass (recorded in TRACK_D_ATLAS_EVIDENCE_EXTRACTION.md), and ten pages spanning all four PDFs and early, middle, and late positions were reinspected at full resolution for this specification: A01 pages 1, 5, 6; A02 pages 4, 5, 6; A03 pages 2, 4; A04 pages 7, 9. Gameplay imagery, raster-baked captions, page numbers, frame IDs, clip numbers, and both timestamp fields were read directly from the rendered pages. All twelve source clips are represented and considered.

Source-quality caveat, carried throughout. The atlases are downscaled re-encoded thumbnails of a PCSX2 capture at 1920x1080, 59.94 fps, which is upscaled well beyond native PS2 resolution. Hue relationships, value structure, composition, object identity, and gross density are trustworthy. Native pixel sharpness, true texture frequency, dithering, precise color values, and any motion or timing property are not recoverable from this package. No claim in this report is native-frame, continuous-motion, or plus-or-minus-one-frame evidence. No color below is a native pixel sample.

Companion analysis. TRACK_D_ATLAS_EVIDENCE_EXTRACTION.md (corrected, 56-row strongest-evidence table) is the authoritative structured footage record and is incorporated throughout; its observations were reinspected against the PDFs before being converted into specification values. One erratum found during reinspection: its strongest-evidence table row 53 lists F0405 on A04 page 9; F0405 is the final frame of A04 page 8 (page 9 carries F0406-F0412). Citations to F0405 in this report use page 8.

Governing documents. 00_BODYARCADE_MASTER_CONTEXT_V3.md (sections 3, 5, 7, 7.1, 12.2, 15.4), 01_NEW_DECISIONS_TO_MERGE.md, and 02_BODYARCADE_DESIGN_PLAN_V2.md (Part 2 capture protocol as method source; Part 3 skeleton; Part 4 density and landmark ideas; its layered stack and milestones are superseded) were read and are honored. The two visual-art bibles and two design-archaeology documents were read; they are Dreamcast-oriented prior research used as secondary evidence only (section 4 states the contradictions and resolutions). VIDEO_INDEX.md, VIDEO_TECHNICAL_INVENTORY.md, and TRACK_D_REDUCED_VISUAL_ATLAS_INDEX.md establish package structure. TRACK_D_PRIOR_INCOMPLETE_REPORT.md was written without atlas access and is used strictly as a salvage source; every retained claim was independently re-verified against the atlases or against the original external source (section 16 and the external-verification memo). It satisfies no evidence requirement in this report.

External verification. A targeted research pass (the Visual/Technical/Platform Verification memo produced in this thread) verified the platform-delta record, PS2 hardware facts, PCSX2 capture guidance, and the Three.js FogExp2 formula against primary and contemporary sources, with reliability tiers (primary, contemporary review, wiki, forum-grade) noted per item. Key anchors: the GameSpot PS2 review (Miguel Lopez, March 4 2002), GameSpot PS2 previews, psdevwiki Graphics Synthesizer, PCSX2 wiki and GameDB, threejs.org docs and manual and the fog fragment shader source, and the Official Dreamcast Magazine UK Csaszar interview as quoted by Wikipedia. Forum-grade items (NeoGAF dark10x posts, GameFAQs control maps, GamePilgrimage comparison) are always flagged as forum-grade where used. No dedicated technical postmortem of this game's rendering exists; that gap is stated, not papered over.

Citation shorthand used below: A01 = TRACK_D_REDUCED_VISUAL_ATLAS_01.pdf, A02 = TRACK_D_REDUCED_VISUAL_ATLAS_02.pdf, A03 = TRACK_D_REDUCED_VISUAL_ATLAS_03.pdf, A04 = TRACK_D_REDUCED_VISUAL_ATLAS_04.pdf. A full citation reads [A02 p5, F0154, C09, L 00:01:04.000, O 00:25:14.000]: atlas file, PDF page, frame ID, source clip, clip-local timestamp, original-video timestamp.

---

## 4. Authority and evidence-label explanation

Authority order applied when sources conflict: (1) the newest explicit run instructions; (2) 00_BODYARCADE_MASTER_CONTEXT_V3.md and active addenda; (3) 01_NEW_DECISIONS_TO_MERGE.md; (4) direct inspection of the four atlas PDFs; (5) TRACK_D_ATLAS_EVIDENCE_EXTRACTION.md; (6) authoritative external primary and contemporary sources; (7) the governing Track D prompt; (8) the attached archive and prior research documents; (9) TRACK_D_PRIOR_INCOMPLETE_REPORT.md.

Evidence labels used on every important statement:

- DIRECT OBSERVATION [DO]: visibly established by cited atlas frames.
- BOUNDED VISUAL MEASUREMENT [BVM]: a range constrained by the atlas, with stated uncertainty, method, and corroborating frames.
- DOCUMENTED [DOC]: stated in an authoritative external or attached source; reliability tier noted where it is not primary.
- ESTIMATED [EST]: a reasoned value not measurable from the available evidence.
- RECOMMENDED [REC]: a proposed Three.js or BodyArcade implementation target. Never a native Ecco engine value.
- UNRESOLVED [UNR]: not answerable from the available evidence; mapped to a replacement capture in section 20.

Mapping to the governing prompt's two-way scheme: [DO] and [BVM] are its "measured (from a cited frame)" class, with the explicit caveat that the frames are reduced thumbnails, so nothing is promoted to native-measured; [DOC], [EST], [REC] are its "estimated (with reasoning)" class; [UNR] items are individually listed in sections 20 and 22.

Material contradictions found and resolved (stated per the rules, not silently):

1. Both art bibles recommend targeting the Dreamcast version (Bible A section A: "Recreate the Dreamcast (2000) version"; Bible A cheat sheet: "Avoid emulator/PS2 footage for fidelity calls"; Bible B: "The Dreamcast version is the correct base target"). The master context section 3.1 and this run fix the PS2 release as primary. Resolution by authority order (2 over 8): PS2 is the target; the bibles' palettes and delta tables are secondary Dreamcast-oriented estimates used for cross-checking and for the platform-delta table only, never as color or effects authority.
2. Bible A's cheat sheet lists "wet specular" as a texture trait. Direct atlas observation finds no pin-point speculars anywhere in 412 PS2 frames; Bible B independently agrees ("wetness is communicated less through specular highlights than through broad tonal sheen"). Resolution (4 over 8): matte materials govern. Whether any sub-thumbnail specular exists natively is [UNR], capture C-TEX.
3. Bible A states "No resolution or widescreen difference is documented; original aspect ratio is 4:3." External verification (authority 6) finds the PS2 port carries a native menu-selectable 16:9 mode (Wikipedia PS2 display-modes list, footnote "Can change these settings in option menu"; corroborated by the absence of any fan widescreen patch for SLUS-20394 in the PCSX2 patches repository, and by forum reports; MobyGames could not be retrieved). The atlas gameplay frames fill 16:9 without pillarboxing [DO; A01 p1, F0001-F0012]. Resolution (6 and 4 over 8): section 16 row 8 uses the corrected wording. BodyArcade adopts neither 4:3 nor the PS2's 16:9 mode as a constraint; it renders modern 16:9 per the master context.
4. The PS2-versus-Dreamcast frame-rate delta is contested between forum-grade sources (dark10x: PS2 holds about 30 fps; GamePilgrimage: no significant difference reported). GameSpot (primary) says only "consistently smooth". Resolution: status PARTIALLY SUPPORTED in section 16; stills cannot arbitrate.
5. Design Plan v2 section 3.3 recommends normal maps and per-class roughness/metalness ranges. The PS2 target and the atlas record are matte and diffuse-dominant. Resolution (2 and 4 over 8): section 10 locks roughness near 1.0 and metalness at 0, disallows PBR micro-detail, and permits only silhouette-neutral low-intensity normal relief as a user-approvable option.
6. TRACK_D_ATLAS_EVIDENCE_EXTRACTION.md row 53 page number for F0405: corrected to A04 page 8 (section 3 erratum).

---

## 5. Atlas coverage and visual-family inventory

Coverage. A01 pages 1-9, F0001-F0103, Clips 1-7, original range 04:30.00-21:32.00. A02 pages 1-9, F0104-F0206, Clips 7-10, 21:36.00-28:40.00. A03 pages 1-9, F0207-F0309, Clips 10-11, 28:44.00-35:11.00. A04 pages 1-9, F0310-F0412, Clips 11-12, 35:15.00-41:55.75; A04 opens on the Clip 11 tail (F0310-F0312) and Clip 12 begins on page 1 at F0313, occupying nearly all of the remainder. Frame numbering is continuous with no gaps; final pages carry 7 thumbnails, all others 12. Approximately 44 frames are non-gameplay or non-representative (dialogue overlays, black and white flashes, splash occlusion, extreme close-ups, ambiguous frames, two cosmic starfields) and are excluded from all palette and density evidence; the full list is in the extraction, section 6.

Visual-family inventory. Fourteen families, labeled by appearance, not by assumed level identity. Probable level identities are offered separately below as [EST] inference against the archaeology documents, which own zone identity.

| Family | Clips | One-line identity | Key evidence |
|---|---|---|---|
| A. Structured green midwater | 1 | Saturated green-teal, two dolphins, regularly spaced vertical structures in fog | F0001, F0006, F0009 |
| B. Pale-sand shallow reef | 2, 3 | Teal-green over warm tan sand, sea fans, magenta plants, turtle-like creature | F0011, F0018, F0026, F0029 |
| C. Kelp reef | 4, 5, 6 | Bright teal, tall flat kelp blades dividing the frame, red fish schools | F0049, F0055, F0066, F0087 |
| D. Olive-black cave system | 7 | Warm olive-yellow rock, near-black core, orange spark motes, pink jellyfish | F0099, F0105, F0110, F0112 |
| E. Desaturated grey-blue plain | 8, 9 | Cool pale grey-blue at all depths, grey sand, isolated pinnacles, prominent sharks | F0129, F0144, F0148, F0150 |
| E2. Vertical shaft chamber | 9 | Coral-walled chamber with one strong vertical light shaft | F0153, F0154, F0155 |
| F. Vivid coral canyon | 10, 11, 12 | Vivid teal corridors, red/green/tan rock hues, encrusting coral, sand floor | F0168, F0187, F0192, F0324 |
| G. Hazy pale-teal open sand | 10, 11 | Washed pale teal, lowest lit-water visibility, near-empty | F0223, F0233, F0249, F0298 |
| H. Magenta-lit rock chamber | 10 | Dark chamber with magenta/pink rock and cyan bubbles | F0235, F0236, F0237 |
| I. Violet octopus chamber | 11, 12 | Violet or near-black field, angular grey faceted rock, large orange octopus | F0242, F0379, F0385, F0388 |
| J. Deep blue cavern with pools | 12 | Wide dark blue cavern, dim pale floor, spires, dark circular pool focus | F0396, F0400, F0403, F0406 |
| K. Olive-yellow deep tunnel | 12 | Olive-yellow tunnel bores, magenta coral, kelp silhouettes on backlight | F0404, F0405 (A04 p8), F0408 |
| L. Above water, bright day | 3,4,5,8,9,10,11,12 | Blue sky, discrete cumulus, jungle or bare-rock cliffs, calm sea plane | F0036, F0070, F0128, F0178, F0332 |
| M. Above water, dawn | 1 | Pink-lavender graded sky, silhouetted cliffs. Single frame, exceptional | F0007 |

Probable level identities [EST, inference against archive reports 05/06 and the art bibles; the visual labels above remain primary]: A plausibly the Aquamarine Bay opening (two dolphins, early timeline position); B/C plausibly Aquamarine Bay and Perils of the Coral Reef reef spaces; E plausibly the Perils of the Coral Reef predator basin (archaeology: the great white set-piece sits in "open area with pathing/trap geometry around rocks"; Bible A: a "murky shark basin ... darker, foggier predator pool"); E2 plausibly Up and Down (Bible A: "a vertical shaft ... starting in a dark cavern"); I plausibly the Trial Without Error octopus gate (archaeology: "octopus bypass", "octopus gate"). Clip 1's regularly spaced vertical structures [DO; A01 p1, F0006, C01, L 00:00:20.000, O 00:04:50.000] are consistent with the archive's Atlantean colonnade vocabulary but remain [UNR] at thumbnail scale (built ruin versus natural formation).

---

## 6. Per-zone and per-depth palette specification

Method and status. All hex values in the "atlas range" columns are BOUNDED VISUAL MEASUREMENTS: eyeballed families from downscaled thumbnails, tolerance at least plus-or-minus 15 per channel, hue more reliable than value, never native pixel samples. All values in the "REC pick" columns are RECOMMENDED Three.js starting values chosen inside the atlas range. Replacement: k-means on native captures, procedure C4.1, map rows in section 20. Fog color equals the far-water color and the scene background per zone (section 7).

Table 6.1: water and fog colors per family.

| Family | Near water (atlas range, BVM) | Near REC | Far water / fog (atlas range, BVM) | Fog REC | Evidence |
|---|---|---|---|---|---|
| A green midwater | #3FA394-#57C4B0 | #4BB4A2 | #2E7F76-#3E9E90 | #369287 | F0001, F0009 [A01 p1] |
| B shallow reef | #3FB0A0-#5FC8B8 | #52BEAC | #348E84-#46A89A | #3E9C90 | F0011, F0029 [A01 p1, p3] |
| Bright shallow band (top of B/F) | #55C8C0-#7FE0D4 | #6FD8CC | #46B0A8-#5FC8BC | #55BFB4 | F0008 [A01 p1], F0247 [A03 p4] |
| C kelp reef | #3FAFA2-#5BC8B8 | #4FBFB0 | #2F8E86-#419E94 | #379890 | F0049, F0066 [A01 p5, p6] |
| D olive cave (field) | #3E3A14-#7A6E1E toward #0A0A08 | wall #5C5218, core #16140A | terminus near #0A0A08 | #1E1B0C | F0099, F0110 [A01 p9, A02 p1] |
| E desaturated plain | #5E7A85-#8FA6AE | #7A929C | #6F8792-#9FB2B8 (lighter than near: haze lift) | #8AA0A8 | F0129, F0148, F0156 [A02 p3-5] |
| E2 shaft chamber (ambient) | #24404C-#3A5866 | #2E4A56 | #1C3038-#2A444C | #223A42 | F0153, F0155 [A02 p5] |
| F vivid canyon | #2FB3A8-#62D5C6 | #49C4B7 | #2A8F86-#3FAEA2 | #349A90 | F0168, F0181, F0203 [A02 p6-9] |
| G hazy open sand | #7FB8B0-#9FD0C6 | #8FC4BB | #98C4BC-#B8DAD2 (lighter: haze lift) | #A8CFC8 | F0223, F0249, F0298 [A03 p2-8] |
| H magenta chamber | #2E1C28-#483040 | #3A2430 | near #14080E | #1A0C12 | F0235-F0237 [A03 p3] |
| I violet chamber | #3A1740-#6B2E78 | #532260 | near black #0D0511 | #200A28 | F0388, F0390, F0392 [A04 p7] |
| J deep blue cavern | #10263A-#1E3E56 | #17324A | #081422-#10202E | #0C1A28 | F0396, F0400, F0406 [A04 p8-9] |
| K olive tunnel | walls dominate; field #2E2A10-#4A4218 | #3A340F | near #0C0A06 | #14120A | F0404, F0405 [A04 p8], F0407 [A04 p9] |

Note on E and G far colors: in these two families the far field is lighter than the near field because fog lifts value while flattening contrast [DO; F0148, F0223]. Implement by keeping the fog color at the listed lighter value; do not darken with distance in these zones.

Table 6.2: terrain, vegetation, light, shadow, and accent colors per family. Every hex is [BVM] range collapsed to a [REC] pick; evidence frames per row.

| Family | Terrain / rock | Sand | Vegetation | Light (upper field / highlight) | Shadow / recess | Accents and emissives | Evidence |
|---|---|---|---|---|---|---|---|
| A | grey-green blocks #7C8468 | n/a (rock floor) | algae wash #4E8F46, hanging kelp #3E9B3A | #DFF2EA | #12403B | small red motes #C0392B; pale ruin columns #9AA79A | F0001, F0003, F0006 |
| B | tan reef rock #A98F6C | warm tan #D2C7A9 (range #C0AE92-#E3D6C0) | magenta plants #C05A9E, sea fans #BFE3E1, kelp #3E9B3A | #EAF7EF | #1A4A44 | coral orange #D97A4A; turtle-creature orange #D08038 | F0011, F0013, F0018, F0026 |
| Bright shallow band | sunlit floor #CFCB8E | #D8D2A2 | sparse | caustic bands #EFEFC8 | #6E7A5A | cyan bubble rings #9FE8EC | F0008, F0247, F0248 |
| C | tan-olive rock #9B8A5F with green wash #5E8F4E | #D6C9AB | tall kelp blades #3F9C38 (flat cards) | surface ceiling #DFF4F2 | #143C38 | red fish #D0452F; purple pickup glyph #8E5AD0 | F0049, F0051, F0055, F0066 |
| D | olive-yellow walls #6E621C | absent/dark | none visible | local pools #C8B860 | #0A0A08 | orange sparks #FFB347; pink jellyfish #E88BB8; pale dolphin read #C8CFC9 | F0099, F0105, F0110, F0112 |
| E | warm tan pinnacles #A98F6C | cool grey #A9B2B6 (range #8E9AA0-#BCC4C8) | sparse green tufts #5E8A50 | flat #C9D6D8 | #3E4E54 | shark grey #8C9296 | F0121, F0134, F0148, F0150 |
| E2 | coral-covered walls #4E7C42 / #6E9C50 | dim #4A5A58 | dense wall coral (green) | shaft #DDF2F0 | #16262C | none | F0153, F0154, F0155 |
| F | hue-set rock: red-maroon #A5443A, green #5E8F4E, tan #B08A5C | pale tan #D8CBB2 | encrusting coral #C8442E / #E07B39, kelp #3E9B3A, sea fans #BFE3E1 | #E2F6F1 | #123A36 | crystal prop green #58D07A; magenta starburst #C86AE0; white-cyan starburst #D8F4F2 | F0168, F0190, F0199, F0308, F0318, F0320 |
| G | soft grey-teal silhouettes #55736E | pale #C8CFC2 | almost none | flat #D8E8E4 | weak #5E7E78 | cyan bubbles #9FE8EC | F0217, F0223, F0233 |
| H | magenta/pink rock #B0487E, #D06A9A | absent | green plants #4E8F46 | local chromatic #E0A8C8 | #160A12 | cyan bubbles #7FE7E0 | F0235, F0236, F0237 |
| I | angular grey facets #6E6E76 | absent | none | rim #C9B8D8 | #06030A | octopus orange #D06A2A / #E8873C; yellow sparks #E8D24A; pale dolphin #C4CCCB | F0242, F0243, F0246, F0379, F0388 |
| J | spires #3E4A56 | dim pale #8E937F | pink coral #E06FA8, yellow tube coral #E8C84A | local cyan glows #7FE7E0 | pool black #050A10 | none | F0396, F0400, F0403, F0406 |
| K | olive-yellow bores #7A6E1E / #9C8C2A | absent | magenta coral #C0489A; kelp silhouettes #1E3A1C on backlight #9CC488 | aperture glow #9CC488 | #0C0A06 | small yellow prop glow #E8D24A | F0404, F0405 (A04 p8), F0407, F0408 |

Above-water palette (family L) is specified in section 15. Family M (dawn) is excluded from the slice per the fixed one-time-of-day condition; its observed values (sky grade #E8A8C0 to #B08CD0, cloud bands #D89AB0, cliff silhouettes #1E2A20 [BVM; F0007, A01 p1]) are recorded only so the exceptional frame is never mistaken for a target.

Master depth ramp inside any one region [REC, ties sections 6-7 together; DOC master context 3.4: bright dense shallows, blue midwater, dark sparse deep]: lerp background/fog color, fog density, caustic intensity, and spawn density along one depth parameter: shallow band (0 to about 5 BL below surface) uses the bright shallow row; mid band (about 5-18 BL) uses the region's main row; deep band (18+ BL, and all enclosed caves) trends toward the region's dark family (D/I/J/K vocabulary). Region identity picks which columns feed the lerp; depth picks the position along it.

---

## 7. Fog, visibility, and depth stratification

Fog model [REC]: THREE.FogExp2 per zone, fog color from table 6.1, scene background set to the same color [DOC: three.js manual: "if you want your scene to fade to a certain color you need to set the fog and the background color to the same color"]. FogExp2 factor is 1 - exp(-(density x depth)^2) [DOC: three.js fog fragment shader source; density and depth are squared].

Density derivation [EST, method stated]: anchor the density to the silhouette-loss distance observed in the atlas. At the distance d98 where silhouettes are lost, take fog factor 0.98: density = sqrt(ln 50) / d98 = 1.978 / d98 (meters). With 1 BL = 2 m [EST]. Cross-check: at the observed large-form limit this yields fog factors around 0.7-0.85, and at the mid-detail limit around 0.2-0.4, consistent with the atlas reads. The capture procedure replaces this with a fitted curve (C4.3 uses the 50% contrast anchor, density = 0.833 / d50).

Table 7.1: fog and visibility per family. Visibility distances are [BVM] from the atlas (uncertainty plus-or-minus 40%, plus-or-minus 50% in dark zones; thumbnail value-crush inflates darkness). Densities are [REC] ranges derived as above, with a starting pick. Replacement capture: C-FOG series per zone (section 20).

| Family | Fog color (REC) | Large forms readable to | Mid detail to | Silhouettes lost beyond | FogExp2 density range (REC) | Start (REC) | Evidence |
|---|---|---|---|---|---|---|---|
| Bright shallow band | #55BFB4 | 10-16 BL (20-32 m) | 4-6 BL | 14-20 BL (28-40 m) | 0.049-0.071 | 0.058 | F0008, F0247 [EST band; clearest of the lit water] |
| A green midwater | #369287 | 6-12 BL (12-24 m) | 3-5 BL | 10-16 BL (20-32 m) | 0.062-0.099 | 0.080 | F0001, F0009 |
| B shallow reef | #3E9C90 | 6-12 BL | 3-5 BL | 10-16 BL | 0.062-0.099 | 0.075 | F0011, F0029 |
| C kelp reef | #379890 | 6-12 BL | 3-5 BL | 10-16 BL | 0.062-0.099 | 0.078 | F0049, F0066, F0087 |
| F vivid canyon | #349A90 | 8-14 BL (16-28 m) | 3-5 BL | 12-18 BL (24-36 m) | 0.055-0.082 | 0.068 | F0168, F0181, F0203 |
| E desaturated plain | #8AA0A8 | 5-9 BL (10-18 m) | 2-4 BL | 8-13 BL (16-26 m) | 0.076-0.124 | 0.095 | F0129, F0148, F0156 |
| G hazy open sand | #A8CFC8 | 4-8 BL (8-16 m) | 2-3 BL | 7-11 BL (14-22 m) | 0.090-0.141 | 0.115 | F0223, F0233, F0249, F0298 |
| E2 shaft chamber | #223A42 | 3-6 BL | 1-3 BL | 5-8 BL (10-16 m) | 0.124-0.198 | 0.155 | F0153-F0155 [EST band] |
| D olive cave | #1E1B0C | 2-5 BL (4-10 m) | 1-2 BL | 4-7 BL (8-14 m) | 0.141-0.247 | 0.190 | F0102, F0110, F0114 |
| J deep cavern | #0C1A28 | 2-5 BL | 1-2 BL | 3-6 BL (6-12 m) [EST] | 0.165-0.330 | 0.240 | F0396, F0400, F0406 |
| K olive tunnel | #14120A | 2-4 BL | under 1-2 BL | 4-6 BL [EST] | 0.165-0.247 | 0.200 | F0404, F0405, F0407 |
| I violet / near-black chamber | #200A28 (violet phase), #06030A (black phase) | 1-3 BL (2-6 m) | under 1 BL | 2-4 BL (4-8 m) | 0.247-0.494 | 0.350 | F0109, F0380, F0386 |
| H magenta chamber | #1A0C12 | 2-4 BL | 1-2 BL | 3-5 BL [EST] | 0.198-0.330 | 0.250 | F0235-F0237 |
| L above water | fog effectively off | tens of BL, cliffs fully readable | n/a | n/a | 0.000-0.002 | 0.000 | F0036, F0070, F0178 |

Fog color shift with view direction. Looking up and toward the surface, the field is lighter and more cyan; looking down or into recesses it collapses toward the dark family quickly [DO; F0072, F0181 vs F0109, F0380]. Away-from-light versus toward-light tint difference within one horizontal plane cannot be separated from scene content at thumbnail scale [UNR]; capture C-FOG-DIR replaces it. Interim [REC]: bias the fog color uniform +10-15% luminance toward pale cyan when the view pitches above roughly +20 degrees, and -15% luminance below roughly -25 degrees, as a view-dependent tint on the fog color only. Do not touch the jeantimex surface or its underside rendering.

Depth stratification. Within-region depth banding is real [DO: up-frames lighter and cyan, down-frames darker], and region identity modulates the whole ramp (principle P2). The desaturated plain is desaturated even in frames near the surface, and a bright above-water frame sits inside its clip run [DO; F0128, A02 p3], which argues that E is a region, not a depth band [BVM-level inference; final status UNR item 12 of the extraction]. Implement stratification as the master ramp of section 6 with region palettes as the ramp endpoints; hold the master-context banding (bright dense shallows, blue-teal midwater, dark sparse deep) as the default region.

Fog is never neutral grey. Even family E, the most desaturated, holds a visible blue-green cast [DO; F0129, F0148, F0156, reinspected A02 p4-5]. If any future measurement appears grey, investigate source quality before recording it [rule; governing prompt section 8].

---

## 8. Caustics and light shafts

Caustics.

| Property | Value | Label | Evidence / basis |
|---|---|---|---|
| Presence | Present on sunlit shallow floors; the strongest frame is a near-full-frame rippling band field | [DO] | [A03 p4, F0247, C11, L 00:00:32.000, O 00:31:11.000]; also F0008 [A01 p1], F0181 [A02 p7] |
| Coverage | Seabed and low terrain in the shallow band; effectively the floor within roughly 0-5 BL of the surface | [BVM]+[EST] | F0247 near-total floor coverage; F0008 partial; absent on deeper floors |
| Cell scale | 0.3-0.8 BL per bright band (0.6-1.6 m) | [BVM, plus-or-minus 40%] | F0247 measured against the dolphin |
| Contrast | Modest: bright bands roughly +15-30% luminance over an already-bright floor, never white-hot | [BVM, rough] | F0247, F0008; consistent with the documented "toned down" PS2 delta |
| Edge softness | Soft, no crisp filaments visible | [DO at thumbnail scale] | F0247; true edge hardness [UNR], capture C-CAU |
| Depth falloff | Strong: no discernible caustic pattern on hazy or deep floors | [DO] | F0223, F0249 [A03 p2, p4] versus F0247 |
| Projection on creatures | Not establishable from the atlas | [UNR] | Bible A says DC caustics played on Ecco himself [DOC, DC-only]; PS2 status unknown; capture C-CAU-CRE |
| Animation speed | Not derivable from 4-second stills | [UNR] | Replacement: C-CAU video pass |
| PS2-versus-Dreamcast status | "Seriously toned down for the PS2 version, but they're still there ... just not as complex as the original's" | [DOC, primary] | GameSpot PS2 review, March 4 2002; section 16 row 3 |

Implementation [REC, jeantimex-compatible]: use jeantimex's existing dynamic caustics, do not add a second caustic system, do not modify the surface. Dial its intensity/contrast uniforms to the modest PS2 read above, and depth-limit the effect: full strength in the top shallow band, fading to zero by roughly 10-12 BL of water above the floor. Interim animation values pending capture: two layered caustic contributions drifting at 0.02-0.05 UV per second with an 8-14 s apparent cycle, edges kept soft [REC; per master context 5.2 the shared caustic character is "broad, bright, slightly slower and more graphic than physically perfect": jeantimex's own look wins any conflict until the user approves changes]. Terrain-only projection until C-CAU-CRE settles the creature question.

Light shafts.

- All observed shafts are aperture-bound: they descend from a visible opening, never free-floating in open water [DO; F0154 (A02 p5), F0365, F0369 (A04 p5), F0409 (A04 p9); open-water sun shafts away from apertures: not observed, status UNR item 13 of the extraction].
- Shafts function as landmarks: in every cited case the shaft is the brightest element of the frame and marks the exit or direction of travel [DO]. 
- Character: single or few, vertical or near-vertical, soft-edged, cyan-white (#DDF2F0 family), width roughly 1-3 BL [BVM, F0154, F0365].
- Implementation [REC]: authored volumetric cones or additive billboard fans placed only at real openings in cave/chamber ceilings, intensity tuned so the shaft is the frame's brightest value in its zone; no screen-space god-ray post pass; nothing above the waterline (section 15: no above-water god rays observed).

---

## 9. Lighting model

The observed model [DO unless noted]:

1. Broad diffuse top-down key. Upper third of open-water frames is brightest; seabed is lit by a soft wash; no hard cast shadows anywhere in the corpus (F0082, F0185, F0370).
2. No pin-point speculars, matte response throughout, on dolphin, rock, coral, crystal (F0003, F0145, F0295; corpus-wide, no counterexample).
3. Silhouette inversion by background: the dolphin reads near-black against bright water (F0002, F0223, F0279) and pale against dark rock (F0104, F0386). The model is lit consistently; the read flips with the field.
4. Dark zones go genuinely dark; only local sources and the HUD remain (F0057, F0212, F0380).
5. Local chromatic glows tied to events and props: magenta radial starburst (F0122, F0130, F0342), white-cyan starburst (F0284, F0294), cave sparks (F0105), jellyfish (F0112, F0338), crystal props (F0199). These are transient or local and do not measurably light surrounding geometry at thumbnail scale [DO]; treat as additive sprites/emissives, not light sources [REC].
6. Above water: hard bright sun implied by high-contrast cliffs and clean sky; no sun disc, no lens flare, no god rays above the waterline in any above-water frame (F0036, F0070, F0178, F0332) [DO].

Lighting specification [REC values; colors from section 6; intensities are Three.js-relative starting points]:

| Source | Color | Intensity | Notes |
|---|---|---|---|
| HemisphereLight (per zone) | sky = zone light color (table 6.2), ground = zone floor tint at 25-35% of sky | sky 0.85-1.0 | The primary underwater fill; carries the top-down gradient |
| DirectionalLight (sun) | #FFF4E0 | 0.45-0.65 | Elevation 60-75 degrees [EST from bright tropical day]; provides the soft terminator on the dolphin; castShadow = false |
| Ambient floor (dark zones) | zone shadow color | 0.02-0.05 | Keeps true darkness; never lift caves to readability with ambient |
| Shaft volumes | #DDF2F0 | local, brightest element in zone | Section 8; aperture-bound only |
| Event glows | #C86AE0 magenta, #D8F4F2 white-cyan | additive sprites | Transient; no scene illumination |
| Prop emissives | crystal #58D07A, jelly pink #E88BB8, jelly blue #6FA8E0, sparks #FFB347 | low, local | Emissive materials plus small-radius PointLights only if needed for reads, radius under 2 BL |

Explicitly absent [REC, banned in implementation; grounded in the corpus-wide observations above]: pin-point speculars and PBR gloss; metalness; hard shadow maps; screen-space reflections; ambient occlusion darkening as a look; bloom-forward grading; open-water volumetric god rays; lens flare; any sun disc; exposure adaptation; day/night or weather lighting states.

Tone pipeline [REC]: renderer.outputColorSpace sRGB, tone mapping none or Linear at exposure 1.0. The look is achieved in the palette and fog, not in grading.

---

## 10. Texture treatment

What the atlas establishes [DO]:

- Rock is low-frequency, large-scale mottling in broad value groups, not high-frequency noise (F0051 reinspected at A01 p5; F0300; F0323).
- Sand is near-featureless flat value over large areas; variation comes from lighting and scattered props (F0011, F0158, F0370).
- Hue variety is authored into the texture, per face: adjacent rock faces carry red, green, and tan under one light (F0190, F0308, F0320).
- Materials are matte across the board; no glossy or mirror response in 412 thumbnails.
- Kelp blades are flat cards with uniform width and no visible thickness (F0055 reinspected; F0408).
- Faceting shows on large angular rock in dark scenes: broad flat planes, hard edges (F0243 reinspected at A03 p4; F0385).

What the atlas cannot establish [UNR; the largest fidelity gap]: native texture frequency and softness, texel density, tiling period, filtering, mipmapping behavior, distance shimmer, and dithering. The thumbnails are downscaled far below native; apparent softness is at least partly an atlas property. Replacement: captures C-TEX and C-DITH.

Platform record [DOC with tiers]: the GS hardware supports mipmapping, bilinear/trilinear filtering, and hardware dithering (psdevwiki, primary); many PS2 titles rendered/blended at 16-bit producing visible dithering, and the 4 MB GS eDRAM budget pushed developers to skip mip chains (Wikipedia tech specs, homebrew write-ups; secondary). The claims that this specific game ships with no mipmapping and shows dithering mainly in dark areas are forum-grade (NeoGAF dark10x) and unverifiable from the atlas; statuses in section 16 rows 4-5.

Modern authoring translation for Track C [REC]:

1. Diffuse-only albedo textures, 256-512 px per material tile, feature scale roughly 0.5-1.0 m so the mottle reads as broad patches at gameplay distance.
2. 3-5 value groups per material; chroma-forward, value-restrained. Keep every texture readable through the zone fog: hue and value grouping beat resolution.
3. Roughness locked 0.95-1.0, metalness 0. MeshLambertMaterial or MeshStandardMaterial with those locks; no specular maps, no normal-map micro-detail, no PBR texture sets.
4. Optional, user-approvable only: very low-intensity, large-wavelength normal relief that never changes silhouettes or creates sparkle (reconciles Design Plan v2 3.3 with the matte record; section 4 item 5).
5. Vertex-color tinting is a sanctioned way to get the per-face hue variety.
6. Mipmapping: use standard Three.js mipmaps (LinearMipmapLinear). Do not emulate the alleged PS2 no-mip aliasing; at 1728x1080 it would read as shimmer, which is exactly the artifact the PS2 build reportedly avoided by luck of short draw distance. The sharpness character comes from low-frequency authoring plus the fog, not from disabling mips [REC].
7. Dithering: never reproduced. Dither-as-aesthetic is a banned failure mode [DOC: master context 3.2]; the native dither question stays a measurement item (C-DITH), not a style item.
8. No pure black, no pure white, no fully saturated primaries in albedo [DOC: Design Plan v2 no-go zones; consistent with the atlas's value structure].

Source-quality caveat, restated where it bites: any texture-softness judgment made from the atlas or from the 1080p clips is not native-accurate. Track C sourcing decisions that hinge on frequency content should wait for C-TEX or accept the [REC] guidance above as provisional.

---

## 11. Particles, bubbles, sediment, and marine snow

Observed particle vocabulary [DO]:

1. Large cyan bubble rings/clusters, discrete and ring-outlined, in dense bursts (F0037, F0200, F0230, F0248, F0333, F0361).
2. Small bubble trails from the dolphin, thin vertical strings (F0027, F0136, F0228 reinspected at A03 p2).
3. Fine white specks, sparse, legible mainly against dark rock (F0243, F0325, F0347, F0383).
4. Warm orange spark motes, confined to the olive-black cave family D (F0099, F0101, F0105, F0114, F0288).

Bounded counts [BVM]: bubble bursts occupy roughly 10-35% of frame with roughly 20-60 resolvable bubbles (order of magnitude; F0037, F0200, F0248, F0333). Ambient specks, where visible at all, number roughly 5-30 per frame; most bright open-water frames resolve none (F0243, F0325, F0347 versus F0009, F0181, F0261). Whether ambient snow exists in bright water or is only legible against dark backdrops is [UNR]; capture C-PART.

Sediment. "Sand billowing around Ecco's flukes" is a documented Dreamcast-era description [DOC: Bible A, layout/behavior-grade]; the atlas neither confirms nor refutes a seabed contact puff at 4 s cadence [UNR]. Optional low-priority effect below.

Table 11.1: particle specification. Sizes in BL (1 BL = 2 m); speeds are [EST] or [REC]: no motion property is atlas-measurable.

| Type | Zones | Count / density (REC) | Size (REC) | Motion (REC, pending C-PART) | Color / material | Labels |
|---|---|---|---|---|---|---|
| Marine snow / motes | all underwater; brightness-gated | 30-80 motes inside a 12 m radius bubble around the camera; opacity 0.05-0.15 in lit zones, 0.2-0.35 in dark zones | 0.005-0.015 BL (1-3 cm) | drift 1-3 cm/s, slight lateral wander | soft white #E8F2F0, additive off | [BVM counts anchor] + [REC]; ambient-in-bright-water [UNR] |
| Dolphin bubble trail | all underwater | continuous string, 2-5 bubbles/s while pumping | 0.01-0.03 BL | rise 0.5-1.0 m/s, expand slightly | ringed cyan-white #CFEFEF | [DO existence] + [REC values] |
| Bubble burst events | all underwater; tied to actions/vents | 20-60 bubbles per burst, 10-35% frame at ~1 BL distance, 0.8-1.5 s life | 0.02-0.06 BL, mixed | rise 1-2 m/s | ring texture, cyan #9FE8EC, thin bright rim | [DO]+[BVM] counts; timing [EST] |
| Cave spark motes | family D only | 10-25 in view in cave chambers | 0.004-0.01 BL | slow drift 1-2 cm/s, gentle flicker | warm orange #FFB347, additive | [DO existence, zone-lock]; values [REC] |
| Seabed contact puff (optional) | sand floors | 1 small puff on floor contact, under 1 s | 0.1-0.3 BL cloud | expand and settle | floor tint at low alpha | [DOC DC-era] + [UNR on PS2] + [REC optional] |

Budget rule [REC]: particles never compete with the fog for atmosphere. If a frame reads busy, cut particle counts before touching fog or palette (degradation order per master context 12.2 protects the defining features).

---

## 12. Wildlife density

Creature vocabulary [DO]: player dolphin; NPC dolphin (F0001, F0309, F0317); grey sharks as the principal threat (F0017, F0127, F0144, F0306, F0330); small orange/red reef fish, singly and in schools (F0066, F0371); an orange turtle-like creature (F0026, F0031, F0095); pink jellyfish in loose rows in dark caves (F0112, F0288); larger blue jellyfish with long tentacles in lit caves (F0338, F0356); one large orange octopus anchoring the dark chambers (F0201, F0242, F0379, F0394).

Table 12.1: on-screen counts per band/family [BVM; all counts are lower bounds: small distant fish are lost to downscaling; uncertainty plus-or-minus 2] and spawn targets [REC].

| Band / family | Typical on-screen count (BVM) | Composition read | Spawn target (REC) | Evidence |
|---|---|---|---|---|
| Shallow reef / kelp reef (B, C, F) | 0-4 ambient creatures; schooling moments 10-30 small fish | lively but never crowded; schools are events | 2-4 ambient within 20 m of player; one 12-24 fish school per 60-120 s of reef traversal | F0066, F0177, F0186, F0261, F0310, F0371 |
| Bright shallow band | 0-3 plus occasional school | brightest and busiest | 2-3 ambient; schools as above | F0008, F0247 area frames |
| Desaturated plain (E) | 0-1, sharks prominent when present | emptiness is the point; a shark is an event | 0-1 ambient; 1 patrolling shark per plain pocket | F0144, F0148, F0158, F0223 |
| Hazy open sand (G) | 0-1 | near-empty | 0-1 | F0223, F0249 |
| Dark caves (D, H, J, K) | 0-3, usually jellyfish or small crawlers | clustered, navigational | 0-3; jellyfish in loose rows of 2-4 near routes | F0112, F0161, F0288, F0338 |
| Octopus chambers (I) | 1 octopus + 1-2 dolphins | staged two-figure scenes | boss/setpiece only, out of slice | F0242, F0379 |
| Above water (L) | dolphin only | empty sky and cliffs | none | F0036, F0070, F0178 |

Rule [DO across corpus; DOC master context 3.4]: sparse by default, clustered when present. Density is delivered by vegetation, terrain, and fog before creatures; a school, a shark, or a jelly row is an event, not wallpaper.

---

## 13. Camera framing metrics for composition

Scope: composition only. Feel dynamics (lag curves, springs, collision response, correction behavior) are Track E's domain and are cross-referenced, not duplicated.

| Metric | Value | Label | Evidence / basis |
|---|---|---|---|
| Dolphin screen coverage, ordinary chase | 8-18% of frame width | [BVM, stable] | F0009, F0087, F0158, F0223, F0279, F0370 |
| Dolphin vertical placement | 40-60% of frame height | [BVM, plus-or-minus 10 pp] | F0087, F0158, F0184, F0223, F0370 |
| Follow distance | 3-6 BL (6-12 m) behind | [BVM-derived, plus-or-minus 50%: FOV unknown] | derived from coverage; the coverage figure is the defensible half |
| Camera height/pitch | slightly above the dolphin, gently pitched down; fog horizon in the upper half; seabed occupies 30-55% of frame height in open water | [BVM] | F0087, F0158, F0223, F0370 |
| Apparent FOV | native value not derivable from stills | [UNR] | replacement: C-CAM (known-size object series) |
| FOV, BodyArcade | vertical 50-60 degrees; then tune follow distance so coverage lands 10-15% width at 1728x1080 | [REC] | coverage target governs; FOV is subordinate |
| Lag character | soft trailing lag consistent with the framing stability across samples | [EST, composition note only] | Track E measures it |
| Terrain collision behavior | not derivable from stills | [UNR] | Track E; capture video pass |
| View toggles (PS2) | Triangle view change, L2/R2 side views, R3 manual correct | [DOC, forum-grade: GameFAQs control map] | HUD/control inspiration only |

Implementation note [REC]: hold the dolphin at frame center with the coverage and vertical-placement bands above as the acceptance test for any Track E camera tuning; a camera that satisfies feel but breaks the 8-18% coverage band breaks the look.

---

## 14. Composition and landmark grammar

Two alternating rhythms [DO]:

- Corridor framing: rock masses at both edges, a lit gap at center, dolphin in the gap. F0087 [A01 p8], F0192 [A02 p8], F0324 [A04 p2].
- Open sparse plain: one silhouetted landmark in a wide, near-empty fog field. F0150 [A02 p4], F0223, F0233 [A03 p2-3].

Landmark counts [BVM, plus-or-minus 1]: sparse plains hold 0-2 strong silhouettes (F0150, F0223, F0233, F0249); corridors and reefs hold 2-4 distinct masses (F0168, F0187, F0192, F0324).

Landmark vocabulary [DO]: free-standing stone arches used as framing devices (F0217, F0232, F0253); isolated spires and pinnacles rising from flat sand (F0121, F0134, F0150, F0290); framed cave mouths and tunnel apertures with bright exits centered (F0270, F0336, F0339); aperture-bound light shafts as wayfinding beacons (F0154, F0365, F0409); columned vertical structures in Clip 1 reading as possible ruins (F0001, F0006; identity [UNR]).

Landmark scale [BVM, rough, plus-or-minus 50%]: arch openings roughly 2-4 BL wide (F0253 against the dolphin); spires roughly 3-8 BL tall (F0150, F0290). Replacement: C-COMP.

Frame-area composition, open reef frames [BVM, overlapping categories]: terrain/rock 30-50%, open fogged water 30-50%, seabed 15-35%, vegetation 5-20%, creatures 1-5% (F0087, F0184, F0192, F0370).

Exit grammar [DO]: in dark spaces the route is the brightest aperture, placed at or near frame center; value contrast does the signposting, not color coding or markers (F0270, F0339, F0343, F0365, F0409).

Sparse-versus-dense cadence [DOC + REC]: master context 3.4 sets the pacing (some combination of terrain variation, vegetation, life, and a visible landmark usually in view; a distinctive formation or discovery roughly every 30-60 s of normal exploration, no rigid quota). Build zones as a few high-contrast silhouette landmarks placed just inside the fog boundary, separated by authored negative space of pure colored fog; alternate corridor pockets with open plains at roughly the observed 2-4 versus 0-2 landmark loads. Kelp is a local screen-dividing device in its reef, not a world-wide fill [DO; F0049, F0055, F0171].

---

## 15. Breach and above-water presentation

The slice's fixed condition: one bright tropical time of day, no day/night, no weather [DOC: master context section 7].

| Element | Specification | Label | Evidence |
|---|---|---|---|
| Sky | zenith #3F93DA grading to horizon #82C8F2 (atlas range #3A8FD8-#78C4F0); clean, no sun disc, no flare, no god rays | [BVM]+[DO absence] | F0036, F0042, F0070, F0128, F0178, F0263, F0332, F0346 |
| Clouds | discrete white cumulus #F2F8FB, well-separated, mid-sky | [DO]+[BVM] | F0036, F0053, F0070, F0138 |
| Coastlines | steep; two types: jungle-covered cliffs #3E6B2E and bare tan-orange rock cliffs #A9784A; cliffs often frame a V around the bay | [DO]+[BVM] | jungle F0036, F0070; bare rock F0178, F0263, F0332 |
| Sea surface from above | flat-to-gently-rippled blue-green plane, ~#58B4AC, no whitecaps, no foam banding at this scale; rendered by the untouched jeantimex surface | [DO at thumbnail scale] + [rule] | F0069, F0178, F0332, F0346; jeantimex protection, master context 3.3 |
| Waterline crossing | a hard horizontal boundary; sky and water can share a frame at apertures | [DO] | F0080 [A01 p7]; jeantimex owns the crossing behavior |
| Surface underside | bright rippling cyan-white ceiling, semi-opaque sheet, not a mirror; dolphin silhouettes against it | [DO] | F0072 [A01 p6], F0347 [A04 p4]; jeantimex owns rendering |
| Airborne dolphin | reads as a dark silhouette against sky in most breach frames | [DO] | F0007, F0042, F0070, F0138; [REC] keep breach exposure so the dolphin silhouettes rather than reading fully lit |
| Splash / re-entry | full-frame white/cyan turbulence occluding the environment at entry; duration not derivable from 4 s cadence | [DO occlusion] + [UNR duration] + [REC 0.4-0.8 s burst] | F0071, F0081, F0116, F0174; replacement C-SURF video |
| Shoreline foam / surf | not resolvable at atlas scale | [UNR] | F0069, F0178, F0332; capture C-SURF |
| Above-water visibility | far longer than underwater; fog effectively off | [DO]+[DOC: contemporary record] | section 7 table; Wikipedia review synthesis |
| Dawn condition | excluded from the slice; single exceptional frame | [DO exceptional] | F0007 [A01 p1]; extraction section 6.7 |

---

## 16. PS2-versus-Dreamcast delta verification

Statuses: CONFIRMED / CONTRADICTED / PARTIALLY SUPPORTED / UNVERIFIABLE FROM CURRENT EVIDENCE. Each row separates what the PS2 atlas shows, what is documented externally (with tier), what needs a direct Dreamcast comparison, and what stills cannot establish. Dreamcast evidence is used only inside this table and never overrides PS2 evidence.

| # | Documented delta (master context 3.1) | Status | PS2 atlas | External record | Needs DC comparison / cannot come from stills |
|---|---|---|---|---|---|
| 1 | PS2 environmental textures more vividly colored | CONFIRMED | Vivid, hue-rich environments directly visible (F0168, F0190, F0308, F0318, F0320) | GameSpot PS2 review, primary: "more colorfully vivid in the PS2 version" | Relative-to-DC strength is documentation, not atlas |
| 2 | ... but not more detailed | CONFIRMED (documented) | Thumbnails cannot judge detail [UNR from atlas] | GameSpot, primary: "they're not any more detailed"; a Linneman forum impression of "higher resolution" is resolved by Bible A as a no-mip sharpness artifact (forum-grade) | Native side-by-side texel comparison |
| 3 | Caustics/refraction toned down vs DC, still present and attractive | CONFIRMED (documented; atlas consistent) | Present and modest in the shallow band (F0247, F0008, F0181); relative intensity vs DC not atlas-decidable | GameSpot, primary: "seriously toned down for the PS2 version, but they're still there ... still look pretty nice" | DC-side capture for the intensity ratio |
| 4 | PS2 has no mipmapping (sharper, no distance shimmer) | PARTIALLY SUPPORTED | Not resolvable from downscaled stills [UNR] | Forum-grade only (NeoGAF dark10x: "it doesn't use mipmapping at all"); GS hardware supports mipmapping (psdevwiki, primary), so this is a per-title choice, plausible under the 4 MB VRAM budget (documented, secondary) | Native-res receding-texture capture, C-TEX |
| 5 | PS2 adds dithering visible mainly in dark areas | PARTIALLY SUPPORTED | Not resolvable at atlas scale [UNR] | Forum-grade (dark10x: "only really noticible in dark areas"); GS hardware dithering and 16-bit blending are documented (psdevwiki, primary) as the general mechanism | Native-res dark-area capture, C-DITH |
| 6 | PS2 holds a steadier frame rate | PARTIALLY SUPPORTED | Stills cannot verify frame rate | GameSpot, primary, unquantified: "a consistently smooth experience"; forum-grade: PS2 "holds at 30 fps" (dark10x) versus GamePilgrimage's "no report ... of any significant difference"; IGN's DC review penalized dips (the ~15 fps figure is carried secondhand) | Frame-time capture of both versions |
| 7 | PS2 adds guidance affordances (compass, L3 next objective, R3 camera correct) | CONFIRMED | A diamond compass-like HUD element appears from F0041 onward (F0041 [A01 p4], F0171 [A02 p6]) [DO] | GameSpot previews, primary: objective indicator and onscreen compass added "because consumers complained that the Dreamcast version was vague"; control map forum-grade (GameFAQs) | none; HUD inspiration only per master context |
| 8 | Original presentation 4:3; BodyArcade does not adopt 4:3 | CONTRADICTED as previously worded; CORRECTED WORDING CONFIRMED | Atlas gameplay frames fill 16:9 with no pillarboxing (A01 p1, F0001-F0012) [DO]; whether the capture used the game's own 16:9 mode or an emulator setting is [UNR] (extraction item 14 relates) | DC original is 4:3 (documented). The PS2 port carries a native, menu-selectable 16:9 mode (Wikipedia PS2 display-modes list, wiki-tier, footnote "Can change these settings in option menu"; corroborated by the absence of any fan widescreen patch for SLUS-20394 and by forum reports; MobyGames unretrieved). Neither version offers 480p per the same list | Direct capture of the PS2 options menu, C-SET-0. BodyArcade decision unchanged either way: modern 16:9 at 1728x1080, no retro aspect or console-limitation adoption |

Do not restate "the PS2 version was only 4:3" anywhere downstream; use: "the Dreamcast original is 4:3; the PS2 port is 4:3 with a native selectable 16:9 option (wiki-tier, to be confirmed on hardware); BodyArcade adopts neither as a constraint."

Reception context [DOC]: aggregate scores favored the Dreamcast release (roughly 81-84) over the 2002 PS2 port (roughly 69-71), reflecting a late port, not a documented graphical regression.

---

## 17. Three.js-ready consolidated parameter tables

All values in this section are RECOMMENDED implementation targets for checkpoint 8, derived as stated in sections 6-15. None is a native Ecco engine value. Where a value conflicts with the untouched jeantimex demo, jeantimex wins until the user approves the tweak.

17.1 Renderer and pipeline.

| Parameter | Value |
|---|---|
| Three.js / context | 0.184, WebGL2 |
| Resolution / fps | ~1728x1080 at 60 fps, dynamic resolution allowed |
| Color space | renderer.outputColorSpace = SRGBColorSpace |
| Tone mapping | NoToneMapping (or Linear, exposure 1.0) |
| Post stack | none for the core look: no bloom, no SSR, no AO, no god-ray pass, no film/CRT/dither filters |
| Background | scene.background = zone fog color, always equal to scene.fog.color |

17.2 Fog and background per zone (from table 7.1; density is the starting pick, with the derived range for tuning).

| Zone | fog.color | fog.density start | tuning range |
|---|---|---|---|
| Bright shallow band | #55BFB4 | 0.058 | 0.049-0.071 |
| A green midwater | #369287 | 0.080 | 0.062-0.099 |
| B shallow reef | #3E9C90 | 0.075 | 0.062-0.099 |
| C kelp reef | #379890 | 0.078 | 0.062-0.099 |
| F vivid canyon | #349A90 | 0.068 | 0.055-0.082 |
| E desaturated plain | #8AA0A8 | 0.095 | 0.076-0.124 |
| G hazy open sand | #A8CFC8 | 0.115 | 0.090-0.141 |
| E2 shaft chamber | #223A42 | 0.155 | 0.124-0.198 |
| D olive cave | #1E1B0C | 0.190 | 0.141-0.247 |
| J deep cavern | #0C1A28 | 0.240 | 0.165-0.330 |
| K olive tunnel | #14120A | 0.200 | 0.165-0.247 |
| I violet chamber | #200A28 (violet) / #06030A (black) | 0.350 | 0.247-0.494 |
| H magenta chamber | #1A0C12 | 0.250 | 0.198-0.330 |
| L above water | off | 0.000 | 0.000-0.002 |

View-direction tint (fog color uniform only): +10-15% luminance toward pale cyan above +20 degrees pitch; -15% luminance below -25 degrees. Zone transitions: lerp fog color and density over 3-5 s of traversal so no biome border is visible (master context 7: gradual transitions).

17.3 Lights per zone family (colors from table 6.2).

| Light | Lit zones (A, B, C, F, shallow band) | Desaturated / hazy (E, G) | Dark zones (D, H, I, J, K, E2 ambient) |
|---|---|---|---|
| HemisphereLight sky | zone light color, intensity 0.9-1.0 | zone light color, 0.7-0.85 | zone light color, 0.05-0.15 |
| HemisphereLight ground | floor tint at 25-35% of sky | same rule | shadow color, near 0 |
| DirectionalLight | #FFF4E0, 0.45-0.65, elevation 60-75 deg, castShadow false | same, 0.35-0.5 | 0.0-0.1 |
| Ambient floor | none extra | none extra | 0.02-0.05, zone shadow color |
| Local sources | event sprites only | event sprites only | shafts #DDF2F0 at apertures; prop emissives; PointLights radius < 2 BL |

17.4 Materials.

| Class | Material | Locks |
|---|---|---|
| Terrain, rock, sand | MeshLambertMaterial or MeshStandardMaterial | roughness 0.95-1.0, metalness 0, no specular/normal micro-maps; vertex-color tint allowed |
| Vegetation, kelp | double-sided flat cards, Lambert | as above; sway in Track B/E motion pass |
| Creatures | Lambert/Standard with same locks | matte; silhouette-first |
| Emissive props | emissive color from table 6.2, emissiveIntensity 0.5-1.5 | no bloom |
| Event glows | additive sprite billboards | transient, no scene lighting |
| Water surface, underside, caustic generator | jeantimex, untouched | intensity/depth-limit uniforms only, per section 8 |

17.5 Caustics (through jeantimex uniforms): intensity tuned to +15-30% floor luminance; cell scale 0.6-1.6 m; soft edges; depth-limited to full strength in the top ~5 BL of water over the floor, zero by ~10-12 BL; drift 0.02-0.05 UV/s, 8-14 s apparent cycle; terrain-only projection pending C-CAU-CRE.

17.6 Particles (from table 11.1): marine snow 30-80 motes / 12 m radius, 1-3 cm, drift 1-3 cm/s, opacity 0.05-0.15 lit / 0.2-0.35 dark; dolphin trail 2-5 bubbles/s, rise 0.5-1.0 m/s; bursts 20-60 bubbles, 0.8-1.5 s, rise 1-2 m/s; cave sparks (zone D only) 10-25 motes, #FFB347.

17.7 Camera (composition acceptance bands; Track E owns dynamics): dolphin 8-18% frame width (target 10-15%), 40-60% frame height; follow 3-6 BL; vertical FOV 50-60 degrees, tuned so the coverage band holds.

17.8 Wildlife budgets (from table 12.1): reef 2-4 ambient + one 12-24 fish school per 60-120 s; plain 0-1 + one patrolling shark per pocket; caves 0-3 (jelly rows of 2-4); above water none.

17.9 World scale anchors [DOC: master context section 7]: region ~2 km x 2 km, max depth ~80 m, sea level y = 0, units meters, dolphin cruise ~5 m/s. All BL figures convert at 1 BL = 2 m [EST].

---

## 18. Anti-principles and banned visual failure modes

Banned as style, per master context 3.2 and the atlas record. Any implementation exhibiting these fails review regardless of other qualities.

1. Neutral-grey fog, or fog treated as air. The fog is colored water, always (P1).
2. Retro hardware emulation as identity: forced low poly, flat-shaded vertex lighting, textureless meshes, affine texture wobble, dither filters, scanline/CRT filters, forced 4:3 or adopting the PS2 16:9 mode as a constraint. The target is the game's look, not the console's limitations.
3. Generic modern ocean: clean stylized water, FFT storm ocean, foam-heavy spectral surfaces, "tasteful reinterpretation," "PS2-inspired," "stylized realism," "retro underwater," "modern interpretation." Banned framings; the target is this specific game.
4. Modern lighting tells: pin-point speculars, PBR gloss and metalness, hard shadow maps, SSR, AO-as-look, bloom grading, lens flare, sun discs, open-water god rays, exposure adaptation.
5. Lifting darkness: caves and chambers stay genuinely dark; navigation is carried by bright apertures, not raised ambient.
6. Uniform fill: random even prop scatter, wall-to-wall kelp, constant creature wallpaper. Density is authored contrast: corridors versus plains, clusters versus voids.
7. Day/night cycles, weather states, or generalizing the single dawn frame F0007 into a time-of-day system.
8. Touching jeantimex: no shader rewrites, no visually-similar substitutes, no surface proposals. Only the sanctioned container adaptation (pool walls to coastline, floor to seabed) plus the uniform-level atmosphere dials in this report.
9. Promoting estimates: no atlas hex presented as a native sample; no [REC] density presented as an engine value; no 4 s still presented as motion evidence.

---

## 19. PCSX2 native-reference capture instruction sheet

Self-contained, user-facing. Goal: produce native-accurate frames that replace every estimate in this report via the map in section 20. The report is usable today without this; run it when ready.

C1. Settings that do not lie (capture ID C-SET).

1. Game: NTSC-U ISO, serial SLUS-20394. PCSX2 current (Qt) build; the GameDB auto-applies a race-condition compatibility patch for this title (loading-screen hang fix); leave it enabled.
2. Renderer: Software renderer for all measurement stills. If hardware is unavoidable, Internal Resolution = Native (1x). Never upscale for measurement.
3. Texture filtering: Bilinear (PS2). No forced filtering, no anisotropic, no trilinear overrides.
4. Mipmapping and dithering: leave at the game's native/default behavior; do not force either on or off (we are measuring them, C-TEX and C-DITH).
5. Blending accuracy: Basic for general shots; raise to Medium/High for caustic, jellyfish, and splash shots and note the setting in the filename log.
6. Interlacing: the game outputs 480i; use a clean deinterlace mode (Bob) and note it. If a frame exports half-height, double the height with nearest-neighbor only.
7. Widescreen: no widescreen hacks, no cheats, no FOV patches. First capture the in-game options menu (shot ID C-SET-0) to confirm whether a native 16:9 toggle exists (section 16 row 8). Then capture the measurement grid in 4:3, plus one repeat of the shallow-reef row in the native 16:9 mode if present (C-SET-1) for the aspect delta only.
8. Screenshots: Screenshot Size = Internal Resolution (Aspect Uncorrected); PNG only (never JPEG: chroma subsampling corrupts hex sampling). Expect a native NTSC internal target near 640x448 or 512x448.
9. Motion reference (for C-CAU, C-SURF, C-CAM-lag): 10-20 s lossless or high-bitrate clips at native res; all color measurements still come from PNG stills.

C2. Where to capture: the frame grid. Zones x depth bands x look directions. Zone identities cite the archive reports 05/06 and the art bibles; save at the level entry and work outward.

| Grid zone | Level (archive-cited) | Report family it replaces |
|---|---|---|
| Z1 bright shallows | Aquamarine Bay open lagoon | Bright shallow band, B |
| Z2 reef mid | Aquamarine Bay reef edges; Perils of the Coral Reef reef | B, C, F |
| Z3 predator basin / plain | Perils of the Coral Reef shark basin | E |
| Z4 haze pocket | any low-visibility open sand stretch in the reef levels | G |
| Z5 cave/tunnel | Trial Without Error interiors; Four Ways of Mystery chambers | D, H, J, K analogues |
| Z6 vertical shaft | Up and Down | E2 |
| Z7 dark setpiece | Trial Without Error octopus gate | I |
| Z8 above water | Aquamarine Bay surface, breach spot | L |

Depth bands per zone where applicable: at surface, ~3 m, ~10 m, ~25 m, darkest reachable (Design Plan v2 Part 2 grid, adapted). Look-direction set at every station: (1) toward light/surface, (2) away from light/into deep, (3) along terrain grazing the floor, (4) into open water at max draw, (5) surface underside from below, (6) above water. For the visibility series (C-FOG): at look 4, frame one fixed large landmark and capture from ~2, 4, 6, 8, 12, 16, 20 BL away, counting body-lengths of swim as the ruler.

C3. File naming.

ecco_<zone>_<band>_<look>_<distBL>_<save>_<mmss>.png
zone: z1..z8 or level slug; band: surf/3m/10m/25m/dark; look: toward/away/along/open/underside/above; distBL: na or the BL count; save: save slot id; mmss: session timestamp. Log renderer, blending setting, and aspect mode per session.

C4. Extraction procedures.

1. C-PAL (palette): per zone-band frame set, k-means k = 6-8 in a consistent color space; map clusters to the table 6.1/6.2 columns (water near, water far, terrain, sand, vegetation, light, shadow, accents). Sample "water far" from pure distant fog with no geometry; that hex becomes fog color and background. Record hex + filename per cell.
2. C-FOG (visibility/density): in the distance series, measure the landmark's Michelson contrast against surrounding fog at each BL step. d50 = distance where contrast falls to 50%; fit density = 0.833 / d50 (meters) per zone; cross-check silhouette loss (~2% contrast) against density = 1.978 / d98. Replaces table 7.1.
3. C-FOG-DIR: at one mid-depth station, compare the "water far" cluster toward-light versus away-from-light at matched framing; record the hue/luminance delta. Replaces the view-direction tint.
4. C-CAU (caustics): along-terrain shallow stills for cell size (BL ruler), band contrast (bright versus base floor), coverage %; repeat at 3 m / 10 m / 25 m for falloff; one 10 s video for drift speed and cycle. C-CAU-CRE: frame the dolphin resting on a caustic-lit floor; do caustics project onto the body?
5. C-TEX (texture/mip): native-res still of a long receding textured surface; inspect for mip transitions or shimmer in motion clip; close still of rock for true frequency and value grouping. C-DITH: native-res stills in the darkest cave and any dark alpha effects; inspect for 16-bit dither checkerboard.
6. C-PART / C-WILD: at each band, 5 representative open stills; count motes against dark and bright backdrops (settles the ambient-snow question), bubbles per burst, creatures on screen. Replaces tables 11.1 and 12.1 counts.
7. C-COMP (composition/scale): stills of one arch, one spire, one cave mouth with the dolphin adjacent as the 2 m ruler; count strong landmarks per frame across 10 corridor and 10 plain stills. Replaces section 14 numbers.
8. C-CAM: still with a known-size object (the 2 m dolphin) at measured BL distance centered; solve apparent FOV from its pixel width; note follow distance across 10 chase stills. Replaces the FOV [UNR].
9. C-SURF: 10 s breach video at native res: splash duration, occlusion character, shoreline foam presence, underside behavior. Replaces section 15 [UNR] rows.
10. C-SET-0 / C-SET-1: options-menu still (16:9 toggle present?), and the 16:9-mode repeat row (section 16 row 8).

---

## 20. Replacement map for estimated values

Every estimated or bounded value maps to the capture that overwrites it. Priority order is the recommended execution order.

| Report value ([label]) | Replaced by | Priority |
|---|---|---|
| Table 6.1/6.2 hex ranges and REC picks, all zones [BVM/REC] | C-PAL per zone-band | 1 (highest) |
| Table 7.1 fog colors [BVM/REC] | C-PAL "water far" clusters | 1 |
| Table 7.1 densities and visibility distances [BVM/EST/REC] | C-FOG distance-series fit | 1 |
| View-direction fog tint [REC] | C-FOG-DIR | 2 |
| Caustic cell/contrast/coverage/falloff (section 8) [BVM/EST] | C-CAU stills | 2 |
| Caustic animation speed [UNR/REC] | C-CAU video | 2 |
| Caustic projection on creatures [UNR] | C-CAU-CRE | 3 |
| Texture frequency, mip behavior [UNR]; section 10 authoring guidance [REC] | C-TEX | 2 |
| Dithering presence/location [UNR] (section 16 rows 4-5 upgrade) | C-DITH | 3 |
| Particle counts/sizes/speeds (table 11.1) [BVM/EST/REC]; ambient-snow-in-bright-water [UNR] | C-PART | 3 |
| Wildlife counts (table 12.1) [BVM] | C-WILD | 3 |
| Landmark scales and counts, area fractions (section 14) [BVM] | C-COMP | 3 |
| Apparent FOV [UNR]; follow distance [BVM-derived] | C-CAM | 4 (Track E co-owns) |
| Splash duration, shoreline foam, underside detail (section 15) [UNR/REC] | C-SURF | 3 |
| PS2 16:9 native mode confirmation (section 16 row 8) [wiki-tier DOC] | C-SET-0 / C-SET-1 | 2 |
| Frame-rate delta (section 16 row 6) | frame-time capture of both versions (outside PCSX2 stills) | 4 |
| BL = 2 m conversion [EST] | C-CAM known-size solve refines it | 4 |

Nothing in this map blocks checkpoint 8: the [REC] values are decision-ready now; the captures upgrade them to native-measured.

---

## 21. Answered

All thirteen questions of governing-prompt section 5 are answered with labeled values: (1) per-zone palettes, section 6; (2) fog color/density as FogExp2 targets with view-direction behavior, section 7; (3) visibility distances in BL with the 1 BL = 2 m assumption stated, section 7; (4) caustic character at PS2 intensity with the toned-down delta confirmed against the primary record, section 8; (5) lighting model with the explicit-absence list, section 9; (6) texture treatment with modern authoring translation for Track C, section 10; (7) particles, section 11; (8) wildlife density per band, section 12; (9) camera framing metrics with feel deferred to Track E, section 13; (10) composition and landmark grammar, section 14; (11) breach and above-water presentation, section 15; (12) depth-stratification banding as the master ramp, sections 6-7; (13) all eight PS2-versus-Dreamcast deltas individually statused, section 16. All eleven deliverables of governing-prompt section 7 are present (sections 6-8, 9, 11-16, 19, 21-23), plus the consolidated parameter tables (17), anti-principles (18), and the replacement map (20). The capture sheet is executable without further questions and every estimate maps to its replacing measurement.

## 22. Open

Native facts that the reduced atlas cannot settle, all mapped in section 20: native texture frequency, softness, mip behavior, and dithering (the largest fidelity gap); caustic edge hardness, animation speed, and creature projection; the fog falloff curve and exact per-zone vanish distances; the away-versus-toward-light fog tint; ambient marine snow in bright water; splash duration and shoreline foam; apparent FOV and native follow distance; whether the capture behind the atlas used the game's own 16:9 mode; the frame-rate delta magnitude; the identity of the Clip 1 vertical structures and of the seven ambiguous frames listed in the extraction; whether the desaturated plain is region, depth band, or state; the meaning of the red HUD bar in F0309; open-water sun shafts away from apertures; the nature of the single dawn frame F0007.

## 23. Needs-user

1. Run the section 19 capture sheet when convenient; priority-1 rows (palette and fog) are the highest-leverage replacements. Nothing blocks checkpoint 8 meanwhile.
2. Capture C-SET-0 first (options menu) to settle the native 16:9 question, and say whether you want the aspect-delta row (C-SET-1) at all.
3. Approve or reject the two flagged options: silhouette-neutral low-intensity normal relief (section 10 item 4), and any future caustic-uniform changes that touch jeantimex behavior (section 8; jeantimex wins until you approve).
4. Confirm the BL = 2 m scale anchor for the region build, or supply a preferred dolphin length; all BL-to-meter numbers rescale linearly.
5. If you want the frame-rate delta upgraded past forum-grade, supply or approve sourcing a DC/PS2 frame-time comparison; otherwise it stays PARTIALLY SUPPORTED.
6. Optional: preferred native-hardware PS2 footage links, if any exist in your archive; emulator-upscaled, filtered, or widescreen-hacked sources will be flagged and used for color/composition only.

---

Prepared as Track D of research tracks A-E. Every value is labeled; nothing atlas-derived is presented as a native measurement; the jeantimex surface is untouched; the fog is always colored; and the target remains the PS2 release of Ecco the Dolphin: Defender of the Future, not a softened interpretation of it.
