# TRACK_D_ATLAS_EVIDENCE_EXTRACTION.md

Footage analysis only. No web research. No outside knowledge of Ecco used to fill gaps. No implementation specification, no renderer constants, no code.

---

## 1. Evidence-access statement

All four reduced visual-atlas PDFs were inspected directly, page by page, including the raster-baked captions beneath each thumbnail.

| PDF | Pages inspected | Frame IDs read |
|---|---|---|
| `TRACK_D_REDUCED_VISUAL_ATLAS_01.pdf` | 1/9 – 9/9 (all 9) | F0001 – F0103 |
| `TRACK_D_REDUCED_VISUAL_ATLAS_02.pdf` | 1/9 – 9/9 (all 9) | F0104 – F0206 |
| `TRACK_D_REDUCED_VISUAL_ATLAS_03.pdf` | 1/9 – 9/9 (all 9) | F0207 – F0309 |
| `TRACK_D_REDUCED_VISUAL_ATLAS_04.pdf` | 1/9 – 9/9 (all 9) | F0310 – F0412 |

36 of 36 pages inspected. 412 thumbnails present; frame numbering is continuous F0001–F0412 with no gaps observed. Pages 9/9 of Atlas 01, 02, 03 and 04 each carry 7 thumbnails rather than 12; all other pages carry 12.

**Source-quality caveat carried throughout.** These are downscaled, re-encoded thumbnails of a PCSX2 1080p capture, arranged on a dark page background. Hue relationships, value structure, composition, object identity and gross density are readable. Native pixel sharpness, true texture frequency, dithering, and precise color values are **not** recoverable at this scale. Every color figure below is an eyeballed family or range, not a sampled measurement, and is labelled accordingly.

---

## 2. Coverage summary

| PDF | Pages | Header original range | Clips represented | Major visual conditions found |
|---|---|---|---|---|
| Atlas 01 | 1–9 | 04:30.00 – 21:32.00 | 1, 2, 3, 4, 5, 6, 7 | Green-teal midwater with submerged structures; pale-sand shallow reef; kelp reef; bright surface/breach; jungle-cliff above-water; entry into olive-black cave system; dialogue overlays |
| Atlas 02 | 1–9 | 21:36.00 – 28:40.00 | 7, 8, 9, 10 | Olive/black cave interior with spark particles and jellyfish; desaturated grey-blue sandy plain with sharks; vertical light-shaft chamber; vivid teal reef canyon; octopus; dialogue overlays |
| Atlas 03 | 1–9 | 28:44.00 – 35:11.00 | 10, 11 | Hazy pale-teal open sand; stone arches; magenta-lit rock chambers; dark octopus chamber; dense coral canyon; sharks; tan-cliff above-water; dialogue overlays |
| Atlas 04 | 1–9 | 35:15.00 – 41:55.75 | 11, 12 | Dense red/orange coral canyon; cave and tunnel network; jellyfish; extended near-black octopus sequence with violet field; olive-yellow deep tunnels; white flash; starfield |

All twelve source clips are represented across the set.

Atlas 04 opens on the tail of Clip 11: p. 1 carries F0310, F0311 and the Clip 11 boundary frame [Atlas 04, p. 1, Clip 11, L 00:04:40.764, O 00:35:19.764, F0312]. Clip 12 begins on the same page at [Atlas 04, p. 1, Clip 12, L 00:00:00.000, O 00:35:30.000, F0313] and occupies nearly all of the remainder of the atlas, running continuously through p. 9. Clip 12 is the only clip contributing non-gameplay cosmic imagery.

---

## 3. Detailed thematic analysis

Evidence labels used below: **[DO]** direct observation, **[BVM]** bounded visual measurement, **[INF]** inference, **[UNC]** uncertainty.

### 3.1 Palette and depth-dependent color

**[DO]** The water field is always chromatic. Across 36 pages no gameplay frame shows a neutral grey water field. Even the most desaturated environment (Clips 8–9) retains a visible blue-green cast rather than grey: [Atlas 02, p. 3, Clip 08, L 00:00:16.000, O 00:23:42.000, F0129], [Atlas 02, p. 4, Clip 09, L 00:00:40.000, O 00:24:50.000, F0148], [Atlas 02, p. 5, Clip 09, L 00:01:12.000, O 00:25:22.000, F0156].

**[DO]** Four materially different water-color families appear:

1. Saturated green-teal, bright, high-key. [Atlas 01, p. 1, Clip 01, L 00:00:00.000, O 00:04:30.000, F0001], [Atlas 01, p. 1, Clip 01, L 00:00:28.000, O 00:04:58.000, F0009], [Atlas 03, p. 4, Clip 11, L 00:01:24.000, O 00:32:03.000, F0261].
2. Cool desaturated blue-grey with pale tan sand. [Atlas 02, p. 2, Clip 07, L 00:01:48.000, O 00:22:40.000, F0121], [Atlas 02, p. 3, Clip 08, L 00:00:24.000, O 00:23:50.000, F0131], [Atlas 02, p. 4, Clip 09, L 00:00:48.000, O 00:24:58.000, F0150].
3. Olive-to-black cave field, water color subordinate to rock color. [Atlas 01, p. 9, Clip 07, L 00:00:36.000, O 00:21:28.000, F0102], [Atlas 02, p. 1, Clip 07, L 00:01:08.000, O 00:22:00.000, F0110], [Atlas 04, p. 8, Clip 12, L 00:06:00.000, O 00:41:30.000, F0405].
4. Violet/magenta field, confined to the late octopus sequence. [Atlas 04, p. 7, Clip 12, L 00:04:52.000, O 00:40:22.000, F0388], [Atlas 04, p. 7, Clip 12, L 00:05:00.000, O 00:40:30.000, F0390], [Atlas 04, p. 7, Clip 12, L 00:05:08.000, O 00:40:38.000, F0392].

**[BVM]** Approximate dominant water-color families, eyeballed from thumbnails, wide tolerance (±15 per channel at minimum, and hue is more reliable than value):

| Family | Near water | Far water / fog terminus | Evidence |
|---|---|---|---|
| Saturated green-teal reef | ~#3FA394 – #57C4B0 | ~#2E7F76 – #3E9E90 | F0001, F0009, F0261, F0297 |
| Vivid teal canyon | ~#2FB3A8 – #62D5C6 | ~#2A8F86 – #3FAEA2 | F0168, F0181, F0203 |
| Desaturated blue-grey plain | ~#5E7A85 – #8FA6AE | ~#6F8792 – #9FB2B8 | F0129, F0148, F0156 |
| Olive-black cave | ~#3E3A14 – #7A6E1E | near #0A0A08 | F0102, F0110, F0114 |
| Violet chamber | ~#3A1740 – #6B2E78 | near black | F0388, F0390 |

**[DO]** Depth is signalled by value and saturation together, not by hue alone. Frames looking up toward the surface are lighter and more cyan: [Atlas 01, p. 6, Clip 05, L 00:00:32.000, O 00:18:32.000, F0072], [Atlas 02, p. 7, Clip 10, L 00:00:56.000, O 00:27:00.000, F0181]. Frames looking down or into recesses collapse toward near-black quickly: [Atlas 02, p. 1, Clip 07, L 00:01:04.000, O 00:21:56.000, F0109], [Atlas 04, p. 6, Clip 12, L 00:04:20.000, O 00:39:50.000, F0380].

**[INF]** The banding across the corpus reads less as a single continuous depth ramp and more as per-region palette authoring: Clips 8–9 are uniformly desaturated across their whole vertical extent, including frames near the surface, while Clips 10–12 are uniformly vivid. Supported by the side-by-side contrast of [Atlas 02, p. 4, Clip 09, L 00:00:48.000, O 00:24:58.000, F0150] against [Atlas 02, p. 6, Clip 10, L 00:00:04.000, O 00:26:08.000, F0168], which are visually adjacent in time but two distinct palettes.

**[UNC]** The sampled frames cannot establish an absolute depth axis. There is no visible depth readout in any frame, and camera altitude is not derivable from a still.

### 3.2 Fog and visibility

**[DO]** Distant geometry terminates in the water color rather than in grey or black in every open-water gameplay frame examined. [Atlas 03, p. 2, Clip 10, L 00:03:40.000, O 00:29:44.000, F0223], [Atlas 03, p. 4, Clip 11, L 00:00:36.000, O 00:31:15.000, F0249], [Atlas 03, p. 8, Clip 11, L 00:03:48.000, O 00:34:27.000, F0298].

**[DO]** Fog attenuates contrast before it attenuates hue. Mid-distance rock in [Atlas 03, p. 3, Clip 10, L 00:04:16.000, O 00:30:20.000, F0233] retains a distinguishable silhouette while its surface detail has already flattened into the field.

**[BVM]** Approximate visibility, expressed in apparent dolphin body-lengths (BL), where 1 BL is the on-screen length of the player dolphin at the same apparent distance. Estimated from frames where a recognizable form persists to the limit of legibility. Uncertainty is high; treat as ±40%.

| Condition | Large forms readable to | Mid detail readable to | Silhouettes lost beyond | Evidence |
|---|---|---|---|---|
| Vivid teal canyon | ~8–14 BL | ~3–5 BL | ~12–18 BL | F0168, F0181, F0203 |
| Green-teal reef | ~6–12 BL | ~3–5 BL | ~10–16 BL | F0001, F0009, F0261 |
| Hazy pale-teal open sand | ~4–8 BL | ~2–3 BL | ~7–11 BL | F0223, F0233, F0249, F0298 |
| Desaturated blue-grey plain | ~5–9 BL | ~2–4 BL | ~8–13 BL | F0129, F0148, F0156 |
| Olive-black cave | ~2–5 BL | ~1–2 BL | ~4–7 BL | F0102, F0110, F0114 |
| Near-black chamber | ~1–3 BL | <1 BL | ~2–4 BL | F0109, F0380, F0386 |

**[DO]** The hazy condition is not confined to one clip. It appears in Clip 10 [Atlas 03, p. 2, Clip 10, L 00:03:40.000, O 00:29:44.000, F0223] and Clip 11 [Atlas 03, p. 4, Clip 11, L 00:00:36.000, O 00:31:15.000, F0249] within the same palette family, suggesting a within-region visibility variation rather than a region boundary.

**[UNC]** No fog falloff curve, density value, or start/end distance can be derived from stills. The atlas explicitly notes ~4 s sampling; nothing here supports a distance-versus-attenuation fit.

### 3.3 Lighting and contrast

**[DO]** Lighting is broad and from above. In open-water frames the upper third is consistently the brightest region and the seabed is lit by a diffuse wash rather than by a directional key with hard shadows. [Atlas 01, p. 7, Clip 06, L 00:00:24.000, O 00:19:16.000, F0082], [Atlas 02, p. 7, Clip 10, L 00:01:12.000, O 00:27:16.000, F0185], [Atlas 04, p. 6, Clip 12, L 00:03:40.000, O 00:39:10.000, F0370].

**[DO]** No pin-point specular highlights are visible on the dolphin, rocks, or coral in any inspected frame. The dolphin reads as a matte value mass with a soft terminator: [Atlas 01, p. 1, Clip 01, L 00:00:08.000, O 00:04:38.000, F0003], [Atlas 02, p. 4, Clip 09, L 00:00:28.000, O 00:24:38.000, F0145], [Atlas 03, p. 8, Clip 11, L 00:03:36.000, O 00:34:15.000, F0295].

**[DO]** The dolphin frequently reads as a near-black silhouette against brighter water when the camera is behind and below the light: [Atlas 01, p. 1, Clip 01, L 00:00:04.000, O 00:04:34.000, F0002], [Atlas 03, p. 2, Clip 10, L 00:03:40.000, O 00:29:44.000, F0223], [Atlas 03, p. 7, Clip 11, L 00:02:32.000, O 00:33:11.000, F0279]. The same model reads pale and lit when framed against dark rock: [Atlas 02, p. 1, Clip 07, L 00:00:44.000, O 00:21:36.000, F0104], [Atlas 04, p. 7, Clip 12, L 00:04:44.000, O 00:40:14.000, F0386].

**[DO]** Local glow sources exist and are chromatic. A purple/magenta radial starburst recurs: [Atlas 02, p. 2, Clip 07, L 00:01:52.000, O 00:22:44.000, F0122], [Atlas 02, p. 3, Clip 08, L 00:00:20.000, O 00:23:46.000, F0130], [Atlas 04, p. 3, Clip 12, L 00:01:52.000, O 00:37:22.000, F0342]. A white/cyan starburst also recurs: [Atlas 03, p. 7, Clip 11, L 00:02:52.000, O 00:33:31.000, F0284], [Atlas 03, p. 8, Clip 11, L 00:03:32.000, O 00:34:11.000, F0294].

**[INF]** These glows appear tied to gameplay events (pickups, sonar, powers) rather than to environment lighting, because they are transient, centered on the dolphin or on a discrete object, and do not illuminate surrounding geometry in a way visible at thumbnail scale.

**[DO]** Dark environments go genuinely dark rather than being lifted by ambient. Several frames are near-black with only the HUD legible: [Atlas 01, p. 5, Clip 04, L 00:01:00.000, O 00:17:03.000, F0057], [Atlas 03, p. 1, Clip 10, L 00:02:58.010, O 00:29:02.010, F0212], [Atlas 03, p. 1, Clip 10, L 00:03:08.000, O 00:29:12.000, F0215].

### 3.4 Caustics and light shafts

**[DO]** Caustics are present and are strongest on and near the seabed in shallow water. The clearest single caustic frame in the corpus is a near-full-frame rippling band field: [Atlas 03, p. 4, Clip 11, L 00:00:32.000, O 00:31:11.000, F0247]. Supporting shallow caustic frames: [Atlas 01, p. 1, Clip 01, L 00:00:24.000, O 00:04:54.000, F0008], [Atlas 02, p. 7, Clip 10, L 00:00:56.000, O 00:27:00.000, F0181].

**[BVM]** Caustic cell size in the strongest frame (F0247) is approximately 0.3–0.8 dolphin body-lengths per bright band, with soft edges rather than crisp filaments. Uncertainty is high because thumbnail downscaling smears fine structure; the true edge hardness cannot be judged from this atlas.

**[DO]** Caustic visibility drops off sharply with depth and with distance from open surface. In the hazy pale-teal frames the seabed shows no discernible caustic pattern: [Atlas 03, p. 2, Clip 10, L 00:03:40.000, O 00:29:44.000, F0223], [Atlas 03, p. 4, Clip 11, L 00:00:36.000, O 00:31:15.000, F0249].

**[DO]** Discrete volumetric light shafts appear at cave and canyon openings. The clearest is a vertical shaft descending between coral-covered walls: [Atlas 02, p. 5, Clip 09, L 00:01:04.000, O 00:25:14.000, F0154]. Others: [Atlas 04, p. 5, Clip 12, L 00:03:20.000, O 00:38:50.000, F0365], [Atlas 04, p. 5, Clip 12, L 00:03:36.000, O 00:39:06.000, F0369], [Atlas 04, p. 9, Clip 12, L 00:06:16.000, O 00:41:46.000, F0409].

**[INF]** Shafts function as landmarks and wayfinding cues, not just as atmosphere: in F0154, F0365 and F0409 the shaft marks the readable exit or the direction of travel and is the brightest element in an otherwise dark frame.

**[UNC]** Caustic animation speed, tiling period, and whether caustics project onto creatures cannot be established from 4-second-interval stills.

### 3.5 Particles, bubbles, suspended sediment, marine snow

**[DO]** Three visually distinct particle systems recur.

1. **Large cyan bubble rings/clusters.** Discrete, ring-outlined, clearly larger than marine snow, often in dense bursts. [Atlas 01, p. 4, Clip 03, L 00:00:26.843, O 00:15:20.843, F0037], [Atlas 02, p. 9, Clip 10, L 00:02:12.000, O 00:28:16.000, F0200], [Atlas 03, p. 2, Clip 10, L 00:04:06.929, O 00:30:10.929, F0230], [Atlas 03, p. 4, Clip 11, L 00:00:33.951, O 00:31:12.951, F0248], [Atlas 04, p. 2, Clip 12, L 00:01:17.210, O 00:36:47.210, F0333], [Atlas 04, p. 5, Clip 12, L 00:03:06.135, O 00:38:36.135, F0361].
2. **Small bubble trails from the dolphin.** Thin vertical strings of small bubbles: [Atlas 01, p. 3, Clip 02, L 00:01:04.000, O 00:14:36.000, F0027], [Atlas 02, p. 3, Clip 09, L 00:00:00.000, O 00:24:10.000, F0136], [Atlas 03, p. 2, Clip 10, L 00:04:00.000, O 00:30:04.000, F0228].
3. **Fine white specks / suspended matter.** Sparse, small, low-contrast, most legible against dark rock: [Atlas 03, p. 4, Clip 11, L 00:00:16.000, O 00:30:55.000, F0243], [Atlas 04, p. 2, Clip 12, L 00:00:48.000, O 00:36:18.000, F0325], [Atlas 04, p. 4, Clip 12, L 00:02:12.000, O 00:37:42.000, F0347], [Atlas 04, p. 7, Clip 12, L 00:04:32.000, O 00:40:02.000, F0383].

**[DO]** A fourth, environment-specific particle type: warm orange/yellow spark motes confined to the olive-black cave system. [Atlas 01, p. 9, Clip 07, L 00:00:24.000, O 00:21:16.000, F0099], [Atlas 01, p. 9, Clip 07, L 00:00:32.000, O 00:21:24.000, F0101], [Atlas 02, p. 1, Clip 07, L 00:00:48.000, O 00:21:40.000, F0105], [Atlas 02, p. 1, Clip 07, L 00:01:24.000, O 00:22:16.000, F0114], [Atlas 03, p. 7, Clip 11, L 00:03:08.000, O 00:33:47.000, F0288].

**[BVM]** The large cyan bubble bursts occupy roughly 10–35% of the frame when present and carry roughly 20–60 individually resolvable bubbles, based on F0037, F0200, F0248, F0333. Counting error at thumbnail scale is significant; treat as an order-of-magnitude statement.

**[BVM]** Ambient marine-snow density in ordinary open-water frames is low. In frames where specks are legible at all, the count is on the order of 5–30 visible specks per frame, and in most bright open-water frames no ambient snow is resolvable. Evidence: F0243, F0325, F0347 (visible), versus F0009, F0181, F0261 (none resolvable).

**[INF]** Ambient suspended particulate is either sparse or is only legible against dark backgrounds. The atlas cannot distinguish these two explanations, because contrast against a bright teal field would suppress low-alpha specks at this resolution.

### 3.6 Water surface, waterline, surface underside, breach, re-entry

**[DO]** The surface underside is visible from below and reads as a bright rippling ceiling with a distinct waterline edge where geometry crosses it. [Atlas 01, p. 6, Clip 05, L 00:00:32.000, O 00:18:32.000, F0072], [Atlas 01, p. 7, Clip 06, L 00:00:21.404, O 00:19:13.404, F0080], [Atlas 04, p. 4, Clip 12, L 00:02:12.000, O 00:37:42.000, F0347].

**[DO]** The camera crosses the waterline. F0080 shows blue sky through a cave opening above a hard horizontal waterline with cyan water below, in a single frame.

**[DO]** Airborne dolphin frames exist across multiple clips and both above-water lighting conditions. Dawn-toned sky: [Atlas 01, p. 1, Clip 01, L 00:00:22.222, O 00:04:52.222, F0007]. Bright blue day sky: [Atlas 01, p. 4, Clip 04, L 00:00:02.018, O 00:16:05.018, F0042], [Atlas 01, p. 5, Clip 04, L 00:00:44.000, O 00:16:47.000, F0053], [Atlas 01, p. 6, Clip 05, L 00:00:28.000, O 00:18:28.000, F0070], [Atlas 02, p. 3, Clip 09, L 00:00:06.222, O 00:24:16.222, F0138].

**[DO]** The airborne dolphin is rendered as a dark silhouette against sky in most breach frames (F0007, F0042, F0070, F0138), not as a lit, textured body.

**[DO]** Re-entry and splash produce frames dominated by white/cyan turbulence with the environment almost entirely occluded. [Atlas 01, p. 6, Clip 05, L 00:00:29.679, O 00:18:29.679, F0071], [Atlas 01, p. 7, Clip 06, L 00:00:22.906, O 00:19:14.906, F0081], [Atlas 02, p. 2, Clip 07, L 00:01:30.157, O 00:22:22.157, F0116], [Atlas 02, p. 6, Clip 10, L 00:00:28.000, O 00:26:32.000, F0174].

**[DO]** Surface-level frames from above show the sea as a flat-to-gently-rippled blue-green plane with no whitecaps and no foam banding at the shoreline visible at this scale. [Atlas 01, p. 6, Clip 05, L 00:00:24.000, O 00:18:24.000, F0069], [Atlas 02, p. 7, Clip 10, L 00:00:44.000, O 00:26:48.000, F0178], [Atlas 04, p. 4, Clip 12, L 00:02:08.000, O 00:37:38.000, F0346].

**[UNC]** Splash particle counts, foam texture, wave amplitude and surface shader behavior cannot be established. F0071 and F0116 are motion-smeared and are not usable as surface-appearance evidence.

### 3.7 Seabed, terrain, caves, arches, trenches, reefs, coastlines

**[DO]** The seabed is overwhelmingly a pale sand plane, ranging from warm tan to cool grey depending on region. Warm tan: [Atlas 01, p. 1, Clip 02, L 00:00:00.000, O 00:13:32.000, F0011], [Atlas 01, p. 3, Clip 03, L 00:00:00.000, O 00:14:54.000, F0029]. Cool grey: [Atlas 02, p. 3, Clip 08, L 00:00:16.000, O 00:23:42.000, F0129], [Atlas 02, p. 4, Clip 09, L 00:00:40.000, O 00:24:50.000, F0148].

**[DO]** Free-standing stone arches occur and are used as framing devices. [Atlas 03, p. 1, Clip 10, L 00:03:16.000, O 00:29:20.000, F0217], [Atlas 03, p. 3, Clip 10, L 00:04:12.000, O 00:30:16.000, F0232], [Atlas 03, p. 4, Clip 11, L 00:00:52.000, O 00:31:31.000, F0253].

**[DO]** Rock spires and pinnacles rising from flat sand recur as isolated landmarks. [Atlas 02, p. 2, Clip 07, L 00:01:48.000, O 00:22:40.000, F0121], [Atlas 02, p. 3, Clip 08, L 00:00:32.000, O 00:23:58.000, F0134], [Atlas 02, p. 4, Clip 09, L 00:00:48.000, O 00:24:58.000, F0150], [Atlas 03, p. 7, Clip 11, L 00:03:16.000, O 00:33:55.000, F0290].

**[DO]** Canyon corridors with rock walls on both sides and a sand floor are the dominant traversal geometry in Clips 10–12. [Atlas 02, p. 7, Clip 10, L 00:01:20.000, O 00:27:24.000, F0187], [Atlas 02, p. 8, Clip 10, L 00:01:40.000, O 00:27:44.000, F0192], [Atlas 04, p. 2, Clip 12, L 00:00:44.000, O 00:36:14.000, F0324].

**[DO]** Caves range from lit sand-floored tunnels with a visible teal exit to fully enclosed near-black chambers. Lit tunnel with exit: [Atlas 03, p. 6, Clip 11, L 00:01:56.000, O 00:32:35.000, F0270], [Atlas 04, p. 3, Clip 12, L 00:01:28.000, O 00:36:58.000, F0336], [Atlas 04, p. 3, Clip 12, L 00:01:40.000, O 00:37:10.000, F0339]. Enclosed chamber: [Atlas 04, p. 8, Clip 12, L 00:05:40.000, O 00:41:10.000, F0400], [Atlas 04, p. 8, Clip 12, L 00:05:48.000, O 00:41:18.000, F0402].

**[DO]** A distinct deep cavern type appears at the end of Clip 12: wide, dark blue, with pale sand floor, scattered spires, and a dark circular pool or hole as the focal element. [Atlas 04, p. 8, Clip 12, L 00:05:24.000, O 00:40:54.000, F0396], [Atlas 04, p. 8, Clip 12, L 00:05:40.000, O 00:41:10.000, F0400], [Atlas 04, p. 9, Clip 12, L 00:06:04.000, O 00:41:34.000, F0406].

**[DO]** Coastlines above water are steep. Two coastline types are visible: green jungle-covered cliffs [Atlas 01, p. 3, Clip 03, L 00:00:25.375, O 00:15:19.375, F0036], [Atlas 01, p. 6, Clip 05, L 00:00:28.000, O 00:18:28.000, F0070]; and bare tan/orange rock cliffs [Atlas 02, p. 7, Clip 10, L 00:00:44.000, O 00:26:48.000, F0178], [Atlas 03, p. 5, Clip 11, L 00:01:32.000, O 00:32:11.000, F0263], [Atlas 04, p. 2, Clip 12, L 00:01:16.000, O 00:36:46.000, F0332].

**[DO]** Submerged built structures are visible in Clip 1. A columned or arcaded form sits in the mid-distance behind the dolphin: [Atlas 01, p. 1, Clip 01, L 00:00:20.000, O 00:04:50.000, F0006], with a similar faint structure at [Atlas 01, p. 1, Clip 01, L 00:00:00.000, O 00:04:30.000, F0001].

**[UNC]** Whether F0006's structure is architectural ruin or natural rock formation cannot be settled at thumbnail scale. It reads as regularly spaced vertical elements, which is suggestive but not conclusive.

### 3.8 Rocks, coral, kelp, vegetation, creatures, ruins, props

**[DO]** Vegetation types observed, each recurring across multiple clips:

- **Tall blade kelp**, bright green, vertical, foreground-scale, used as a screen-dividing element. [Atlas 01, p. 5, Clip 04, L 00:00:28.000, O 00:16:31.000, F0049], [Atlas 01, p. 5, Clip 04, L 00:00:52.000, O 00:16:55.000, F0055], [Atlas 02, p. 6, Clip 10, L 00:00:16.000, O 00:26:20.000, F0171].
- **Fan corals / sea fans**, pale blue-white or cyan, delicate branching silhouettes. [Atlas 01, p. 2, Clip 02, L 00:00:28.000, O 00:14:00.000, F0018], [Atlas 01, p. 7, Clip 06, L 00:00:12.000, O 00:19:04.000, F0077].
- **Encrusting red/orange coral** on rock faces. [Atlas 02, p. 8, Clip 10, L 00:01:32.000, O 00:27:36.000, F0190], [Atlas 04, p. 1, Clip 12, L 00:00:20.000, O 00:35:50.000, F0318], [Atlas 04, p. 4, Clip 12, L 00:02:24.000, O 00:37:54.000, F0350].
- **Magenta/pink plants and tube corals.** [Atlas 01, p. 2, Clip 02, L 00:00:08.000, O 00:13:40.000, F0013], [Atlas 04, p. 8, Clip 12, L 00:05:52.000, O 00:41:22.000, F0403].
- **Green algae/moss on rock**, appearing as a wash rather than as geometry. [Atlas 01, p. 4, Clip 04, L 00:00:08.000, O 00:16:11.000, F0044], [Atlas 02, p. 5, Clip 09, L 00:01:08.000, O 00:25:18.000, F0155].

**[DO]** Creature types observed:

- **Player dolphin**, present in the large majority of gameplay frames.
- **Second dolphin / NPC dolphin.** [Atlas 01, p. 1, Clip 01, L 00:00:00.000, O 00:04:30.000, F0001], [Atlas 03, p. 9, Clip 11, L 00:04:32.000, O 00:35:11.000, F0309], [Atlas 04, p. 1, Clip 12, L 00:00:16.000, O 00:35:46.000, F0317].
- **Sharks**, grey, large, recurring as the principal threat. [Atlas 01, p. 2, Clip 02, L 00:00:24.000, O 00:13:56.000, F0017], [Atlas 02, p. 2, Clip 08, L 00:00:08.000, O 00:23:34.000, F0127], [Atlas 02, p. 4, Clip 09, L 00:00:24.000, O 00:24:34.000, F0144], [Atlas 03, p. 9, Clip 11, L 00:04:20.000, O 00:34:59.000, F0306], [Atlas 04, p. 2, Clip 12, L 00:01:08.000, O 00:36:38.000, F0330].
- **Small reef fish**, orange/yellow/red, in ones and twos and occasionally in schools. Schools: [Atlas 01, p. 6, Clip 05, L 00:00:12.000, O 00:18:12.000, F0066], [Atlas 04, p. 6, Clip 12, L 00:03:44.000, O 00:39:14.000, F0371].
- **Orange turtle-like creature**, recurring in Clips 2, 3, 7. [Atlas 01, p. 3, Clip 02, L 00:01:00.000, O 00:14:32.000, F0026], [Atlas 01, p. 3, Clip 03, L 00:00:08.000, O 00:15:02.000, F0031], [Atlas 01, p. 8, Clip 07, L 00:00:08.000, O 00:21:00.000, F0095].
- **Pink jellyfish**, in loose rows, in dark caves. [Atlas 02, p. 1, Clip 07, L 00:01:16.000, O 00:22:08.000, F0112], [Atlas 03, p. 7, Clip 11, L 00:03:08.000, O 00:33:47.000, F0288].
- **Blue jellyfish**, larger, with long trailing tentacles, in lit caves. [Atlas 04, p. 3, Clip 12, L 00:01:36.000, O 00:37:06.000, F0338], [Atlas 04, p. 4, Clip 12, L 00:02:48.000, O 00:38:18.000, F0356].
- **Large orange octopus**, the visual anchor of the Clip 11 and Clip 12 dark sequences. [Atlas 02, p. 9, Clip 10, L 00:02:16.000, O 00:28:20.000, F0201], [Atlas 03, p. 3, Clip 11, L 00:00:12.000, O 00:30:51.000, F0242], [Atlas 04, p. 6, Clip 12, L 00:04:16.000, O 00:39:46.000, F0379], [Atlas 04, p. 7, Clip 12, L 00:05:16.000, O 00:40:46.000, F0394].

**[DO]** Props: a faceted green crystal object recurs as a discrete interactive-looking prop. [Atlas 02, p. 8, Clip 10, L 00:02:08.000, O 00:28:12.000, F0199], [Atlas 02, p. 9, Clip 10, L 00:02:36.000, O 00:28:40.000, F0206], [Atlas 04, p. 3, Clip 12, L 00:02:04.000, O 00:37:34.000, F0345].

**[DO]** HUD elements observed, useful for dating frames within the corpus: two thin horizontal bars plus a small glyph top-left in nearly all gameplay frames; a purple/pink diamond compass-like icon at lower right from Clip 4 onward [Atlas 01, p. 4, Clip 04, L 00:00:00.000, O 00:16:03.000, F0041], [Atlas 02, p. 6, Clip 10, L 00:00:16.000, O 00:26:20.000, F0171]; a small fish/shell icon upper right in Clips 9–12 [Atlas 02, p. 4, Clip 09, L 00:00:20.000, O 00:24:30.000, F0142], [Atlas 04, p. 4, Clip 12, L 00:02:20.000, O 00:37:50.000, F0349].

**[DO]** A red HUD bar (versus the usual blue) appears at [Atlas 03, p. 9, Clip 11, L 00:04:32.000, O 00:35:11.000, F0309]. **[INF]** likely a low-state indicator; the atlas cannot confirm which resource.

### 3.9 Texture frequency, softness, tiling, material response

**[DO]** Rock reads as low-frequency, large-scale mottling with broad value groups, not as high-frequency detail noise. Best visible on large near-camera rock faces: [Atlas 01, p. 5, Clip 04, L 00:00:36.000, O 00:16:39.000, F0051], [Atlas 03, p. 8, Clip 11, L 00:03:56.000, O 00:34:35.000, F0300], [Atlas 04, p. 2, Clip 12, L 00:00:40.000, O 00:36:10.000, F0323].

**[DO]** Sand reads as an almost featureless flat value across large areas, with variation coming from lighting and from scattered props rather than from surface texture. [Atlas 01, p. 1, Clip 02, L 00:00:00.000, O 00:13:32.000, F0011], [Atlas 02, p. 5, Clip 09, L 00:01:20.000, O 00:25:30.000, F0158], [Atlas 04, p. 6, Clip 12, L 00:03:40.000, O 00:39:10.000, F0370].

**[DO]** Color variation on rock is achieved largely by texture rather than by lighting: adjacent rock faces in the same frame carry markedly different hues (red, green, tan) under the same illumination. [Atlas 02, p. 8, Clip 10, L 00:01:32.000, O 00:27:36.000, F0190], [Atlas 03, p. 9, Clip 11, L 00:04:28.000, O 00:35:07.000, F0308], [Atlas 04, p. 1, Clip 12, L 00:00:28.000, O 00:35:58.000, F0320].

**[DO]** Materials are matte across the board. No frame in the corpus shows a mirror-like or glossy surface response, including on the dolphin, wet rock at the waterline, or the crystal props.

**[UNC]** Texture tiling period, texel density, filtering mode, mipmapping behavior, and dithering are **not establishable from this atlas**. The thumbnails are downscaled well below native resolution; any apparent softness is at least partly a property of the atlas, not the source. This is the single largest evidentiary gap in the visual-fidelity domain and must be resolved from native-resolution captures.

### 3.10 Silhouettes, polygonal simplification, geometric constraints

**[DO]** Faceting is directly visible on large angular rock forms in dark scenes, where broad flat planes meet at hard edges with no surface break-up. [Atlas 03, p. 4, Clip 11, L 00:00:16.000, O 00:30:55.000, F0243], [Atlas 04, p. 7, Clip 12, L 00:04:40.000, O 00:40:10.000, F0385].

**[DO]** Organic forms are silhouette-first. The octopus reads as a strong orange outline against dark rock rather than as a detailed surface: [Atlas 03, p. 3, Clip 11, L 00:00:12.000, O 00:30:51.000, F0242], [Atlas 04, p. 6, Clip 12, L 00:04:16.000, O 00:39:46.000, F0379].

**[DO]** Kelp blades read as flat cards: they present as clean, uniform-width green strips with no visible thickness. [Atlas 01, p. 5, Clip 04, L 00:00:52.000, O 00:16:55.000, F0055], [Atlas 04, p. 9, Clip 12, L 00:06:12.000, O 00:41:42.000, F0408].

**[DO]** Shark and dolphin silhouettes are smooth and readable at small screen size and remain identifiable as species at ~2–4% of frame width: [Atlas 03, p. 9, Clip 11, L 00:04:20.000, O 00:34:59.000, F0306], [Atlas 01, p. 2, Clip 02, L 00:00:24.000, O 00:13:56.000, F0017].

**[INF]** Environment geometry is authored for silhouette legibility under fog: rock masses present as large simple blocked shapes whose read survives contrast loss (F0233, F0223, F0217). This is consistent with, but not proof of, a deliberate low-complexity terrain budget.

### 3.11 Composition, negative space, landmarks, density, navigational readability, apparent scale

**[DO]** The dolphin is placed at or near the center of frame in the overwhelming majority of gameplay frames, at a consistent trailing distance. Representative: F0009, F0087, F0158, F0223, F0279, F0370.

**[BVM]** Dolphin screen size in ordinary following shots is approximately 8–18% of frame width, corresponding to a chase distance on the order of 3–6 body-lengths behind the animal. Estimated across F0009, F0087, F0158, F0184, F0223, F0279, F0370. Uncertainty ±50% on the distance figure, because FOV is unknown; the screen-coverage figure is the more defensible half of this measurement.

**[BVM]** Vertical composition in open-water frames: the dolphin sits at roughly 40–60% of frame height, with the horizon of the fog field consistently in the upper half and seabed occupying roughly the lower 30–55% of frame. Evidence: F0087, F0158, F0184, F0223, F0370.

**[DO]** Two composition rhythms alternate through the corpus:

- **Corridor framing**: rock masses at left and right edges, a lit gap in the center, dolphin in the gap. [Atlas 01, p. 8, Clip 06, L 00:00:44.000, O 00:19:36.000, F0087], [Atlas 02, p. 8, Clip 10, L 00:01:40.000, O 00:27:44.000, F0192], [Atlas 04, p. 2, Clip 12, L 00:00:44.000, O 00:36:14.000, F0324].
- **Open sparse plain**: a single silhouetted landmark against a wide, near-empty fog field. [Atlas 02, p. 4, Clip 09, L 00:00:48.000, O 00:24:58.000, F0150], [Atlas 03, p. 2, Clip 10, L 00:03:40.000, O 00:29:44.000, F0223], [Atlas 03, p. 3, Clip 10, L 00:04:16.000, O 00:30:20.000, F0233].

**[BVM]** Landmark count per frame is low. In sparse-plain frames typically **0–2** strong landmark silhouettes are in view (F0150, F0223, F0233, F0249). In corridor and reef frames typically **2–4** distinct rock masses read as separate forms (F0168, F0187, F0192, F0324). Uncertainty is in the definition of "strong landmark"; counts are stable within ±1 across the cited frames.

**[BVM]** Approximate frame composition by area, averaged over open-water reef frames (F0087, F0184, F0192, F0370): terrain/rock ~30–50%, open fogged water ~30–50%, seabed sand ~15–35%, vegetation ~5–20%, creatures ~1–5%. These bands overlap because the categories are not exclusive at thumbnail scale.

**[BVM]** Wildlife density per frame is low in the sampled corpus. Ordinary reef frames show **0–4** non-player creatures (F0177, F0186, F0261, F0310). Schooling frames show **10–30** small fish (F0066, F0371). Sparse-plain frames show **0–1** (F0148, F0158, F0223). Dark cave frames show **0–3**, usually jellyfish or crabs (F0112, F0161, F0288). Counting uncertainty ±2 at these thumbnail sizes; small distant fish may be lost to downscaling, so all figures are **lower bounds**.

**[DO]** Landmarks are used to signal exits. Bright teal gaps, arches, and light shafts consistently occupy the visual center of dark frames: F0270, F0343, F0365, F0339.

**[INF]** Navigational readability is carried primarily by value contrast (bright exit against dark surround), not by color coding or by explicit markers. Supported by F0270, F0343, F0365, F0409; contradicted by nothing observed.

### 3.12 Above-water presentation

**[DO]** Above-water frames divide into two lighting conditions:

1. **Bright day.** Saturated blue sky, discrete white cumulus, high-contrast cliffs. [Atlas 01, p. 3, Clip 03, L 00:00:25.375, O 00:15:19.375, F0036], [Atlas 01, p. 4, Clip 04, L 00:00:02.018, O 00:16:05.018, F0042], [Atlas 01, p. 5, Clip 04, L 00:00:44.000, O 00:16:47.000, F0053], [Atlas 01, p. 6, Clip 05, L 00:00:28.000, O 00:18:28.000, F0070], [Atlas 02, p. 3, Clip 08, L 00:00:12.000, O 00:23:38.000, F0128], [Atlas 02, p. 3, Clip 09, L 00:00:06.222, O 00:24:16.222, F0138], [Atlas 02, p. 7, Clip 10, L 00:00:44.000, O 00:26:48.000, F0178], [Atlas 03, p. 5, Clip 11, L 00:01:32.000, O 00:32:11.000, F0263], [Atlas 04, p. 2, Clip 12, L 00:01:16.000, O 00:36:46.000, F0332], [Atlas 04, p. 4, Clip 12, L 00:02:08.000, O 00:37:38.000, F0346].
2. **Dawn/dusk.** Pink-lavender graded sky with thin horizontal cloud bands, cliffs in near-silhouette. Observed **once**: [Atlas 01, p. 1, Clip 01, L 00:00:22.222, O 00:04:52.222, F0007].

**[DO]** F0007 is a genuine outlier in the corpus. Every other above-water frame across all four PDFs shows a bright blue day sky. **[INF]** F0007 is more likely a scripted or cinematic moment than evidence of a day/night cycle, but the atlas cannot settle this: a single sampled frame at 4-second cadence is insufficient.

**[DO]** Above-water sky is clean: no sun disc, no lens flare, no god rays above the waterline are visible in any of the cited above-water frames.

**[DO]** Above-water sea surface reads as a flat blue-green plane with soft rippling and no visible foam or whitecaps, even adjacent to cliffs. F0069, F0178, F0332, F0346.

**[BVM]** Above-water palette bands, eyeballed: sky ~#3A8FD8 – #78C4F0; cumulus ~#E8EFF4 – #FFFFFF; jungle cliffs ~#2C5A22 – #6F9440; bare rock cliffs ~#8A5A34 – #C79A62; sea plane ~#3E9E9E – #6FC6BE. Tolerance is wide; treat as families.

### 3.13 Meaningful differences among the represented environments

See the matrix in §4. The strongest, most defensible differences visible in the atlas are:

1. **Saturation as a region property, not just a depth property.** The Clips 8–9 plain is desaturated at all observed depths; the Clips 10–12 canyon is vivid at all observed depths. [Atlas 02, p. 4, Clip 09, L 00:00:48.000, O 00:24:58.000, F0150] versus [Atlas 02, p. 6, Clip 10, L 00:00:04.000, O 00:26:08.000, F0168].
2. **Sand hue shifts by region**, warm tan in Clips 2–3, cool grey in Clips 8–9. F0011/F0029 versus F0129/F0148.
3. **The olive-black cave system (Clip 7) uses a warm rock palette and warm spark particles**, unlike every other dark environment in the corpus, which is blue-black or violet. F0102, F0105, F0110, F0114 versus F0378, F0388, F0396.
4. **Clip 1 is the only environment showing regularly spaced vertical structures suggesting built ruins.** F0001, F0006.

### 3.14 Recurring visual rules shared across environments

Each rule below holds across at least three clips and at least two PDFs.

**R1. The fog is the water, and it is always chromatic.** F0001 (Atlas 01), F0129 (Atlas 02), F0223 (Atlas 03), F0370 (Atlas 04). No neutral-grey fog observed anywhere.

**R2. Broad diffuse top-down light; no pin-point speculars.** F0003 (Atlas 01), F0145 (Atlas 02), F0295 (Atlas 03), F0370 (Atlas 04).

**R3. The dolphin is centered and framed at a consistent trailing distance.** F0009 (Atlas 01), F0158 (Atlas 02), F0279 (Atlas 03), F0370 (Atlas 04).

**R4. Value contrast, not color, carries navigation.** Bright exits and shafts anchor dark frames: F0080 (Atlas 01), F0154 (Atlas 02), F0270 (Atlas 03), F0365 (Atlas 04).

**R5. Terrain is blocked into large simple masses with strong silhouettes; detail is textural, not geometric.** F0051 (Atlas 01), F0190 (Atlas 02), F0300 (Atlas 03), F0323 (Atlas 04).

**R6. Cyan bubble bursts are the loudest particle event and recur in every clip band.** F0037 (Atlas 01), F0200 (Atlas 02), F0248 (Atlas 03), F0333 (Atlas 04).

**R7. Matte materials throughout.** No glossy or mirror response observed in any of the 412 thumbnails.

**R8. Wildlife is sparse by default and clustered when present.** Ordinary frames 0–4 creatures; schooling frames 10–30. F0066 (Atlas 01), F0177 (Atlas 02), F0261 (Atlas 03), F0371 (Atlas 04).

**R9. Reef color variety is delivered by rock and coral texture hue, under uniform lighting.** F0190 (Atlas 02), F0308 (Atlas 03), F0320 (Atlas 04).

**R10. Above water is one condition: bright tropical day.** Ten cited frames across four PDFs; one exception (F0007).

### 3.15 Exceptional frames that do not represent the normal rendering style

Fully enumerated in §6.

---

## 4. Environment comparison matrix

Labels are visual descriptors. No level identity is asserted; clip grouping is used instead of assumed level names.

| Environment (visual label) | Clips | Water color | Sand | Fog / visibility | Light | Vegetation | Creatures | Composition | Key evidence |
|---|---|---|---|---|---|---|---|---|---|
| **A. Structured green midwater** | 1 | Saturated green-teal | Not dominant; rock floor | Mid; ~6–12 BL | Broad top-down; bright upper field | Green algae wash, hanging kelp | 2 dolphins; small red motes | Dolphin centered; vertical structure in mid-distance | F0001, F0006, F0009 |
| **B. Pale-sand shallow reef** | 2, 3 | Teal-green over warm tan | Warm tan, near-featureless | Mid-high visibility near surface | Bright; visible caustics near surface | Magenta plants, cyan sea fans, kelp | Turtle-like creature, shark, small fish | Wide open sand with rock walls at edges | F0011, F0018, F0026, F0029 |
| **C. Kelp reef** | 4, 5, 6 | Teal, bright | Tan | Mid; ~6–12 BL | Bright; surface visible in many frames | Tall blade kelp dominant, red/green coral | Red fish schools, small fish | Kelp blades divide the frame vertically | F0049, F0055, F0066, F0087 |
| **D. Olive-black cave system** | 7 | Subordinate to rock; olive/yellow-brown | Absent or dark | Very low; ~2–5 BL | Near-total darkness with local pools | None visible | Pink jellyfish | Dolphin pale against black; oval cave mouths | F0099, F0105, F0110, F0112, F0114 |
| **E. Desaturated grey-blue plain** | 8, 9 | Cool grey-blue | Cool grey | Mid, but low contrast; ~5–9 BL | Flat, low-contrast | Sparse green plants on isolated rocks | Sharks prominent; few fish | Sparse; isolated pinnacle landmarks; large negative space | F0129, F0134, F0144, F0148, F0150 |
| **E2. Vertical shaft chamber** | 9 | Blue with a bright shaft | Not dominant | Low ambient, high local | Strong single vertical shaft | Dense green coral on walls | Few | Cathedral: symmetric walls, central shaft | F0153, F0154, F0155 |
| **F. Vivid coral canyon** | 10, 11, 12 | Vivid teal | Pale tan | Mid; ~8–14 BL | Bright above, dim at floor | Red/orange encrusting coral, kelp, sea fans | Sharks, reef fish, dolphins | Corridor framing; rock walls both edges | F0168, F0187, F0192, F0308, F0324 |
| **G. Hazy pale-teal open sand** | 10, 11 | Pale, washed teal | Pale tan | Lowest of the lit environments; ~4–8 BL | Flat, high fog lift | Almost none | 0–1 | Near-empty; dolphin alone in field | F0223, F0233, F0249, F0298 |
| **H. Magenta-lit rock chamber** | 10 | Dark with magenta/pink rock | Absent | Low | Local, chromatic | Green plants | Few | Enclosed, warm-vs-cool split | F0235, F0236, F0237 |
| **I. Violet octopus chamber** | 11, 12 | Violet/magenta field or near-black | Absent | Very low; ~1–3 BL | Almost none; local rim light | None | Octopus, dolphins | Two-figure staging on angular grey rock | F0242, F0379, F0385, F0388, F0390 |
| **J. Deep blue cavern with pools** | 12 | Dark blue | Pale, dim | Low | Very dim, local cyan glows | Pink/yellow tube coral clusters | Sparse fish | Wide, dark, dark circular pool as focus | F0396, F0400, F0402, F0403 |
| **K. Olive-yellow deep tunnel** | 12 | Olive/yellow rock dominant | Absent | Very low | Local glow; one white figure | Magenta coral, green kelp silhouettes | Sparse | Tunnel bores; centered aperture | F0404, F0405, F0406, F0408 |
| **L. Above water, bright day** | 3,4,5,8,9,10,11,12 | Blue-green plane | n/a | Clear, long | Hard sun, clean sky | Jungle canopy or bare rock | Dolphin only | Cliffs frame a V; dolphin centered | F0036, F0070, F0128, F0178, F0332, F0346 |
| **M. Above water, dawn** | 1 | Not visible | n/a | Clear | Low, warm, graded sky | Jungle canopy silhouette | Dolphin airborne | Silhouette against graded sky | F0007 |

---

## 5. Repeated visual-rule summary

Condensed from §3.14, which enumerates R1–R10, plus one further and weaker rule (R11) drawn from the fog observations in §3.2. Each rule is supported by frames from all four PDFs unless noted.

| Rule | Support | Cross-PDF |
|---|---|---|
| R1 Chromatic fog, never neutral grey | F0001, F0129, F0223, F0370 | 4/4 |
| R2 Broad diffuse top light; no pin-point speculars | F0003, F0145, F0295, F0370 | 4/4 |
| R3 Centered dolphin, consistent chase distance | F0009, F0158, F0279, F0370 | 4/4 |
| R4 Value contrast carries navigation | F0080, F0154, F0270, F0365 | 4/4 |
| R5 Large blocked terrain masses; textural not geometric detail | F0051, F0190, F0300, F0323 | 4/4 |
| R6 Cyan bubble bursts as the dominant particle event | F0037, F0200, F0248, F0333 | 4/4 |
| R7 Matte materials only | Corpus-wide; no counterexample found | 4/4 |
| R8 Sparse wildlife, clustered when present | F0066, F0177, F0261, F0371 | 4/4 |
| R9 Color variety via rock/coral texture hue under uniform light | F0044, F0190, F0308, F0320 | 4/4 |
| R10 Above water is one bright tropical day condition | F0036, F0128, F0263, F0346 | 4/4 |
| R11 Fog attenuates contrast before hue | F0223, F0233, F0249, F0298 | Atlas 03 only; weakest of the set |

---

## 6. Exceptions and nonrepresentative footage

These frames must **not** be used as evidence of ordinary underwater rendering.

### 6.1 Dialogue / text-overlay frames
Large green display text over a dimmed or letterboxed scene.
[Atlas 01, p. 8, Clip 06, L 00:01:02.762, O 00:19:54.762, F0092];
[Atlas 01, p. 8, Clip 07, L 00:00:00.000, O 00:20:52.000, F0093];
[Atlas 02, p. 4, Clip 09, L 00:00:44.000, O 00:24:54.000, F0149] ("POWER OF VIGOR EXPIRED");
[Atlas 02, p. 6, Clip 09, L 00:01:50.760, O 00:26:00.760, F0166];
[Atlas 02, p. 7, Clip 10, L 00:01:00.000, O 00:27:04.000, F0182];
[Atlas 02, p. 8, Clip 10, L 00:02:00.000, O 00:28:04.000, F0197];
[Atlas 02, p. 8, Clip 10, L 00:02:04.000, O 00:28:08.000, F0198];
[Atlas 02, p. 9, Clip 10, L 00:02:28.000, O 00:28:32.000, F0204];
[Atlas 03, p. 2, Clip 10, L 00:03:56.000, O 00:30:00.000, F0227];
[Atlas 03, p. 5, Clip 11, L 00:01:12.000, O 00:31:51.000, F0258];
[Atlas 03, p. 5, Clip 11, L 00:01:16.000, O 00:31:55.000, F0259];
[Atlas 03, p. 5, Clip 11, L 00:01:40.000, O 00:32:19.000, F0265];
[Atlas 03, p. 6, Clip 11, L 00:02:20.000, O 00:32:59.000, F0276];
[Atlas 04, p. 3, Clip 12, L 00:02:00.000, O 00:37:30.000, F0344];
[Atlas 04, p. 4, Clip 12, L 00:02:40.000, O 00:38:10.000, F0354] (**text partially unreadable at this scale**);
[Atlas 04, p. 6, Clip 12, L 00:04:00.000, O 00:39:30.000, F0375];
[Atlas 04, p. 6, Clip 12, L 00:04:24.000, O 00:39:54.000, F0381];
[Atlas 04, p. 7, Clip 12, L 00:04:28.000, O 00:39:58.000, F0382];
[Atlas 04, p. 7, Clip 12, L 00:04:56.000, O 00:40:26.000, F0389];
[Atlas 04, p. 7, Clip 12, L 00:05:12.000, O 00:40:42.000, F0393] (**text partially unreadable at this scale**).

**Note:** the scene behind the text in several of these frames is still ordinary gameplay rendering, but the overlay dims and letterboxes it. Do not sample palettes from these.

### 6.2 Flash, fade, and fully black frames
[Atlas 01, p. 5, Clip 04, L 00:01:00.000, O 00:17:03.000, F0057] (near-black, HUD only);
[Atlas 02, p. 1, Clip 07, L 00:01:04.000, O 00:21:56.000, F0109] (near-black);
[Atlas 02, p. 1, Clip 07, L 00:01:20.000, O 00:22:12.000, F0113] (near-black);
[Atlas 03, p. 1, Clip 10, L 00:02:58.010, O 00:29:02.010, F0212] (near-black, HUD only);
[Atlas 03, p. 1, Clip 10, L 00:03:08.000, O 00:29:12.000, F0215] (fully black);
[Atlas 04, p. 8, Clip 12, L 00:05:20.000, O 00:40:50.000, F0395] (near-black);
[Atlas 04, p. 9, Clip 12, L 00:06:20.000, O 00:41:50.000, F0410] (**pure white frame**).

### 6.3 Cosmic / non-diegetic imagery
[Atlas 04, p. 9, Clip 12, L 00:06:24.000, O 00:41:54.000, F0411] (starfield with purple-green nebula);
[Atlas 04, p. 9, Clip 12, L 00:06:25.752, O 00:41:55.752, F0412] (same, boundary frame).
These are the only frames in the corpus with no water, no terrain, and no dolphin.

### 6.4 Splash / turbulence-occluded frames
[Atlas 01, p. 6, Clip 05, L 00:00:29.679, O 00:18:29.679, F0071] (motion-smeared split field);
[Atlas 01, p. 7, Clip 06, L 00:00:22.906, O 00:19:14.906, F0081] (frame filled with white/cyan turbulence);
[Atlas 02, p. 2, Clip 07, L 00:01:30.157, O 00:22:22.157, F0116] (frame filled with white/blue turbulence).

### 6.5 Extreme close-ups / obstructed
[Atlas 02, p. 3, Clip 08, L 00:00:26.994, O 00:23:52.994, F0132] (shark head fills frame; no environment readable);
[Atlas 02, p. 3, Clip 08, L 00:00:28.000, O 00:23:54.000, F0133] (tan surfaces fill frame; **subject ambiguous**);
[Atlas 02, p. 4, Clip 09, L 00:00:22.372, O 00:24:32.372, F0143] (dolphin head close against rock);
[Atlas 03, p. 1, Clip 10, L 00:03:00.000, O 00:29:04.000, F0213] and [Atlas 03, p. 1, Clip 10, L 00:03:04.000, O 00:29:08.000, F0214] (camera inside/against rock; **ambiguous**).

### 6.6 Ambiguous frames
[Atlas 02, p. 4, Clip 09, L 00:00:16.000, O 00:24:26.000, F0141] — dark red field with a pale angular form and green marks; **cannot be classified** from the thumbnail.
[Atlas 02, p. 4, Clip 09, L 00:00:52.000, O 00:25:02.000, F0151] — a large pale mass above the dolphin; **cannot distinguish creature from terrain**.
[Atlas 02, p. 9, Clip 10, L 00:02:32.000, O 00:28:36.000, F0205] — murky red-green field, subject not resolvable.
[Atlas 03, p. 4, Clip 11, L 00:00:28.000, O 00:31:07.000, F0246] — dark violet tunnel with a blue glow and yellow sparks; **subject not identifiable**.
[Atlas 03, p. 6, Clip 11, L 00:01:48.000, O 00:32:27.000, F0267] — large dark vertical form; **creature versus rock cannot be settled**.
[Atlas 03, p. 7, Clip 11, L 00:03:12.000, O 00:33:51.000, F0289] — pale angular form and orange objects; **not identifiable**.
[Atlas 04, p. 8, Clip 12, L 00:05:36.000, O 00:41:06.000, F0399] — pale elongated object; **not identifiable**.

### 6.7 The single dawn frame
[Atlas 01, p. 1, Clip 01, L 00:00:22.222, O 00:04:52.222, F0007] is the only non-blue-sky above-water frame in 412. Treat as exceptional pending native capture; do not generalize it into a time-of-day system, and do not use it to contradict the ten bright-day above-water frames.

---

## 7. Measurement table

All figures are bounded visual estimates from downscaled thumbnails. None is a sampled measurement. None should be carried into an implementation document without native-capture replacement.

| # | Quantity | Bounded estimate | Evidence frames | Uncertainty / caveat |
|---|---|---|---|---|
| M1 | Water hue, vivid teal canyon (near) | ~#2FB3A8 – #62D5C6 | F0168, F0181, F0203 | Family only; ±15+/channel; atlas re-encode |
| M2 | Water hue, vivid teal canyon (far/terminus) | ~#2A8F86 – #3FAEA2 | F0181, F0203, F0233 | Same |
| M3 | Water hue, green-teal reef | ~#3FA394 – #57C4B0 | F0001, F0009, F0261 | Same |
| M4 | Water hue, desaturated plain | ~#5E7A85 – #9FB2B8 | F0129, F0148, F0156 | Same; hue is the reliable part, value is not |
| M5 | Water/rock field, olive cave | ~#3E3A14 – #7A6E1E to near #0A0A08 | F0102, F0110, F0114 | Very dark; thumbnail crush likely |
| M6 | Violet chamber field | ~#3A1740 – #6B2E78 | F0388, F0390, F0392 | Exceptional environment |
| M7 | Sand, warm-tan regions | ~#C0AE92 – #E3D6C0 | F0011, F0029, F0089 | Family only |
| M8 | Sand, cool-grey regions | ~#8E9AA0 – #BCC4C8 | F0129, F0148, F0158 | Family only |
| M9 | Sky, bright day | ~#3A8FD8 – #78C4F0 | F0036, F0070, F0332 | Family only |
| M10 | Jungle cliff | ~#2C5A22 – #6F9440 | F0036, F0070 | Family only |
| M11 | Bare rock cliff | ~#8A5A34 – #C79A62 | F0178, F0263, F0332 | Family only |
| M12 | Visibility, vivid teal canyon | large forms ~8–14 BL; silhouettes lost ~12–18 BL | F0168, F0181, F0203 | ±40%; BL is apparent, not metric |
| M13 | Visibility, hazy pale-teal sand | large forms ~4–8 BL; silhouettes lost ~7–11 BL | F0223, F0233, F0249, F0298 | ±40% |
| M14 | Visibility, desaturated plain | large forms ~5–9 BL | F0129, F0148, F0156 | ±40% |
| M15 | Visibility, olive-black cave | large forms ~2–5 BL | F0102, F0110, F0114 | ±50%; thumbnail crush inflates darkness |
| M16 | Visibility, near-black chamber | large forms ~1–3 BL | F0109, F0380, F0386 | ±50% |
| M17 | Dolphin screen coverage, ordinary chase shot | ~8–18% of frame width | F0009, F0087, F0158, F0223, F0279, F0370 | Stable across frames; the more defensible figure |
| M18 | Implied chase distance | ~3–6 BL | Same as M17 | ±50%; FOV unknown, so this is derived, not measured |
| M19 | Dolphin vertical placement | ~40–60% of frame height | F0087, F0158, F0184, F0223, F0370 | ±10 pp |
| M20 | Seabed screen occupancy, open-water frames | ~30–55% of frame height | F0087, F0184, F0223, F0370 | ±10 pp |
| M21 | Terrain area, reef frames | ~30–50% | F0087, F0184, F0192, F0370 | Categories overlap |
| M22 | Open fogged water area, reef frames | ~30–50% | Same | Categories overlap |
| M23 | Vegetation area, reef frames | ~5–20% | F0049, F0055, F0171, F0324 | Kelp-heavy frames sit at the top of the band |
| M24 | Creature area, ordinary frames | ~1–5% | F0177, F0186, F0261 | Excludes shark close encounters |
| M25 | Landmark count, sparse plain | 0–2 strong silhouettes | F0150, F0223, F0233, F0249 | ±1; "strong" is a judgment |
| M26 | Landmark count, corridor/reef | 2–4 distinct masses | F0168, F0187, F0192, F0324 | ±1 |
| M27 | Wildlife count, ordinary reef frame | 0–4 | F0177, F0186, F0261, F0310 | **Lower bound**; small fish lost to downscale |
| M28 | Wildlife count, schooling frame | 10–30 small fish | F0066, F0371 | ±10; individuals merge at this scale |
| M29 | Wildlife count, sparse plain | 0–1 | F0148, F0158, F0223 | Lower bound |
| M30 | Wildlife count, dark cave | 0–3 | F0112, F0161, F0288 | Lower bound |
| M31 | Caustic band size, strongest frame | ~0.3–0.8 BL per bright band | F0247 | Single-frame; edge hardness unrecoverable |
| M32 | Cyan bubble burst, frame coverage | ~10–35% | F0037, F0200, F0248, F0333 | ±10 pp |
| M33 | Cyan bubble burst, resolvable bubble count | ~20–60 | F0037, F0200, F0248, F0333 | Order-of-magnitude only |
| M34 | Ambient suspended specks, where visible | ~5–30 per frame | F0243, F0325, F0347 | Lower bound; invisible against bright fields |
| M35 | Shark/dolphin silhouette legibility threshold | identifiable down to ~2–4% of frame width | F0017, F0306 | Judged at thumbnail scale; native would be better |
| M36 | Above-water frames in corpus | 11 identified (10 bright day + 1 dawn) | §3.12 list | Count is of frames I could positively classify; the ten bright-day IDs and F0007 are enumerated there |
| M37 | Non-gameplay / nonrepresentative frames enumerated in §6.1–§6.6 | **44 unique frames** (20 dialogue + 7 black/flash + 2 cosmic + 3 splash + 5 close-up/obstructed + 7 ambiguous = 44 category assignments) | §6.1, §6.2, §6.3, §6.4, §6.5, §6.6 | Categories were checked for overlap: no frame ID appears in more than one of the six lists, so the 44 assignments resolve to exactly 44 distinct frames. §6.7 (F0007) is listed as an exception but is ordinary gameplay rendering under an exceptional above-water condition, so it is not counted here; including it, §6 as a whole enumerates 45 distinct frames. What qualifies as "non-gameplay" remains a judgment at the boundary (dialogue-overlay frames retain gameplay rendering behind the text, per the §6.1 note), but the enumerated set itself is exact. |

**Explicitly not estimated:** fog density values, light intensities, FOV in degrees, physical meters, texel density, tiling period, frame rate, animation speed, shader parameters. None of these is derivable from this atlas.

---

## 8. Strongest-evidence table (56 frames)

| # | PDF | Page | Clip | Clip-local | Original | Frame | What it directly establishes | Category | Rep/Exc |
|---:|---|---:|---:|---|---|---|---|---|---|
| 1 | Atlas 01 | 1 | 01 | L 00:00:00.000 | O 00:04:30.000 | F0001 | Green-teal midwater; two dolphins; vertical structure in mid-distance; chromatic fog | Palette, structures | Representative |
| 2 | Atlas 01 | 1 | 01 | L 00:00:20.000 | O 00:04:50.000 | F0006 | Regularly spaced vertical forms suggesting built structure; hanging kelp on right rock | Ruins, terrain | Representative |
| 3 | Atlas 01 | 1 | 01 | L 00:00:22.222 | O 00:04:52.222 | F0007 | Dawn sky, dolphin airborne in silhouette, jungle cliffs; only non-blue sky in corpus | Above water | **Exceptional** |
| 4 | Atlas 01 | 1 | 01 | L 00:00:28.000 | O 00:04:58.000 | F0009 | Dolphin large, centered, matte, no specular; canonical chase framing | Lighting, composition | Representative |
| 5 | Atlas 01 | 1 | 02 | L 00:00:00.000 | O 00:13:32.000 | F0011 | Warm tan featureless sand; low-frequency seabed; desaturated relative to Clip 1 | Terrain, texture | Representative |
| 6 | Atlas 01 | 2 | 02 | L 00:00:28.000 | O 00:14:00.000 | F0018 | Pale cyan sea-fan coral on sand; magenta plants; vegetation vocabulary | Vegetation | Representative |
| 7 | Atlas 01 | 3 | 02 | L 00:01:00.000 | O 00:14:32.000 | F0026 | Orange turtle-like creature; sparse ordinary wildlife density | Creatures, density | Representative |
| 8 | Atlas 01 | 3 | 03 | L 00:00:25.375 | O 00:15:19.375 | F0036 | Bright day above water: blue sky, cumulus, jungle cliffs in V, white splash | Above water | Representative |
| 9 | Atlas 01 | 4 | 03 | L 00:00:26.843 | O 00:15:20.843 | F0037 | Dense cyan bubble-ring burst filling ~1/3 frame | Particles | **Exceptional** (event, not ambient) |
| 10 | Atlas 01 | 4 | 04 | L 00:00:00.000 | O 00:16:03.000 | F0041 | First appearance of lower-right diamond HUD icon; teal midwater | HUD, palette | Representative |
| 11 | Atlas 01 | 5 | 04 | L 00:00:36.000 | O 00:16:39.000 | F0051 | Large near-camera rock face: low-frequency mottling, broad value groups | Texture | Representative |
| 12 | Atlas 01 | 5 | 04 | L 00:00:52.000 | O 00:16:55.000 | F0055 | Kelp blades read as flat cards with no thickness; kelp as vertical framing | Geometry, vegetation | Representative |
| 13 | Atlas 01 | 5 | 04 | L 00:01:00.000 | O 00:17:03.000 | F0057 | Near-black frame, HUD only | Non-gameplay | **Exceptional** |
| 14 | Atlas 01 | 6 | 05 | L 00:00:12.000 | O 00:18:12.000 | F0066 | Red-orange fish school; clustered wildlife | Creatures, density | Representative |
| 15 | Atlas 01 | 6 | 05 | L 00:00:28.000 | O 00:18:28.000 | F0070 | Above water: sky, cumulus, jungle cliffs, bay, dolphin airborne | Above water, breach | Representative |
| 16 | Atlas 01 | 7 | 06 | L 00:00:21.404 | O 00:19:13.404 | F0080 | Waterline in-frame: sky through cave opening above, cyan water below | Waterline, surface | Representative |
| 17 | Atlas 01 | 8 | 06 | L 00:00:44.000 | O 00:19:36.000 | F0087 | Canonical corridor framing: rock at both edges, sand floor, dolphin in lit gap | Composition | Representative |
| 18 | Atlas 01 | 8 | 06 | L 00:01:02.762 | O 00:19:54.762 | F0092 | Green dialogue text over letterboxed scene | Non-gameplay | **Exceptional** |
| 19 | Atlas 01 | 9 | 07 | L 00:00:24.000 | O 00:21:16.000 | F0099 | Olive-yellow cave walls, near-black interior, orange spark motes | Cave palette, particles | Representative (of env. D) |
| 20 | Atlas 02 | 1 | 07 | L 00:01:08.000 | O 00:22:00.000 | F0110 | Olive cave with warm rock and dark core; dolphin pale against black | Cave palette, contrast | Representative (of env. D) |
| 21 | Atlas 02 | 1 | 07 | L 00:01:16.000 | O 00:22:08.000 | F0112 | Three pink jellyfish lit against black; orange sparks | Creatures | Representative (of env. D) |
| 22 | Atlas 02 | 2 | 07 | L 00:01:48.000 | O 00:22:40.000 | F0121 | Rock pinnacle with kelp on grey-blue sand; desaturated region begins | Palette, landmarks | Representative |
| 23 | Atlas 02 | 2 | 08 | L 00:00:08.000 | O 00:23:34.000 | F0127 | Shark with open mouth at close range; grey sand; green plants | Creatures | Representative |
| 24 | Atlas 02 | 3 | 08 | L 00:00:26.994 | O 00:23:52.994 | F0132 | Shark head fills frame; no environment readable | Close-up | **Exceptional** |
| 25 | Atlas 02 | 3 | 09 | L 00:00:06.222 | O 00:24:16.222 | F0138 | Breach against blue sky with cumulus; airborne silhouette | Breach, above water | Representative |
| 26 | Atlas 02 | 4 | 09 | L 00:00:48.000 | O 00:24:58.000 | F0150 | Isolated rock pinnacle in a near-empty desaturated field; sparse landmark rule | Composition, palette | Representative |
| 27 | Atlas 02 | 5 | 09 | L 00:01:04.000 | O 00:25:14.000 | F0154 | Strong vertical light shaft between coral walls; cathedral composition | Light shafts | Representative (of env. E2) |
| 28 | Atlas 02 | 6 | 10 | L 00:00:04.000 | O 00:26:08.000 | F0168 | Vivid teal canyon with red/green coral walls; dense reef; palette jump from Clip 9 | Palette, density | Representative |
| 29 | Atlas 02 | 6 | 10 | L 00:00:28.000 | O 00:26:32.000 | F0174 | White splash burst underwater at surface re-entry | Re-entry | **Exceptional** |
| 30 | Atlas 02 | 7 | 10 | L 00:00:44.000 | O 00:26:48.000 | F0178 | Above water: tan/orange canyon cliffs, blue sky, flat blue-green water plane | Above water, coastline | Representative |
| 31 | Atlas 02 | 8 | 10 | L 00:01:32.000 | O 00:27:36.000 | F0190 | Red/maroon rock against teal gap; hue variety from texture under uniform light | Texture, palette | Representative |
| 32 | Atlas 02 | 9 | 10 | L 00:02:12.000 | O 00:28:16.000 | F0200 | Large cyan bubble cluster over pale sand | Particles | **Exceptional** (event) |
| 33 | Atlas 03 | 1 | 10 | L 00:03:16.000 | O 00:29:20.000 | F0217 | Free-standing stone arch on pale sand in hazy field | Terrain, landmarks | Representative |
| 34 | Atlas 03 | 2 | 10 | L 00:03:40.000 | O 00:29:44.000 | F0223 | Hazy pale-teal open sand; lowest lit-environment visibility; contrast lost before hue | Fog, visibility | Representative (of env. G) |
| 35 | Atlas 03 | 3 | 10 | L 00:04:24.000 | O 00:30:28.000 | F0235 | Magenta/pink-lit rock chamber with cyan bubbles | Palette | Representative (of env. H) |
| 36 | Atlas 03 | 3 | 11 | L 00:00:12.000 | O 00:30:51.000 | F0242 | Large orange octopus, silhouette-first read against grey angular rock | Creatures, geometry | Representative (of env. I) |
| 37 | Atlas 03 | 4 | 11 | L 00:00:16.000 | O 00:30:55.000 | F0243 | Faceted angular grey rock with hard plane edges; white specks visible against dark | Geometry, particles | Representative |
| 38 | Atlas 03 | 4 | 11 | L 00:00:32.000 | O 00:31:11.000 | F0247 | Near-full-frame caustic band field; strongest caustic evidence in corpus | Caustics | Representative (of shallow band) |
| 39 | Atlas 03 | 5 | 11 | L 00:01:32.000 | O 00:32:11.000 | F0263 | Above water: bare tan cliffs, blue sky, blue-green plane | Above water, coastline | Representative |
| 40 | Atlas 03 | 6 | 11 | L 00:01:56.000 | O 00:32:35.000 | F0270 | Dark cave tunnel with pale sand floor and bright teal exit centered | Navigation, caves | Representative |
| 41 | Atlas 03 | 7 | 11 | L 00:03:08.000 | O 00:33:47.000 | F0288 | Pink jellyfish row plus orange sparks in dark cave | Creatures, particles | Representative |
| 42 | Atlas 03 | 8 | 11 | L 00:03:48.000 | O 00:34:27.000 | F0298 | Hazy low-visibility field with cyan bubbles; visibility floor for lit water | Fog, visibility | Representative |
| 43 | Atlas 03 | 9 | 11 | L 00:04:20.000 | O 00:34:59.000 | F0306 | Large shark diving over reef; silhouette legible at small size | Creatures | Representative |
| 44 | Atlas 04 | 1 | 12 | L 00:00:20.000 | O 00:35:50.000 | F0318 | Red/orange encrusting coral reef; dense canyon vocabulary | Vegetation, density | Representative |
| 45 | Atlas 04 | 2 | 12 | L 00:01:16.000 | O 00:36:46.000 | F0332 | Above water: tan/orange cliffs, blue sky, dolphin at surface | Above water | Representative |
| 46 | Atlas 04 | 3 | 12 | L 00:01:36.000 | O 00:37:06.000 | F0338 | Blue jellyfish with long tentacles in a lit cave | Creatures | Representative |
| 47 | Atlas 04 | 4 | 12 | L 00:02:12.000 | O 00:37:42.000 | F0347 | Surface underside from below with kelp and white specks | Surface, particles | Representative |
| 48 | Atlas 04 | 5 | 12 | L 00:03:20.000 | O 00:38:50.000 | F0365 | Bright cyan shaft from a cave opening into a dark chamber | Light shafts, navigation | Representative |
| 49 | Atlas 04 | 6 | 12 | L 00:03:44.000 | O 00:39:14.000 | F0371 | Red fish school against dark rock | Creatures, density | Representative |
| 50 | Atlas 04 | 6 | 12 | L 00:04:16.000 | O 00:39:46.000 | F0379 | Octopus grappling dolphin under faint shafts in near-black | Creatures | Representative (of env. I) |
| 51 | Atlas 04 | 7 | 12 | L 00:04:52.000 | O 00:40:22.000 | F0388 | Violet/magenta field with dolphin silhouette; only such palette in corpus | Palette | **Exceptional** |
| 52 | Atlas 04 | 8 | 12 | L 00:05:40.000 | O 00:41:10.000 | F0400 | Wide dark blue cavern, pale sand floor, spires | Caves, terrain | Representative (of env. J) |
| 53 | Atlas 04 | 9 | 12 | L 00:06:00.000 | O 00:41:30.000 | F0405 | Olive-yellow tunnel bore with magenta coral centered | Cave palette | Representative (of env. K) |
| 54 | Atlas 04 | 9 | 12 | L 00:06:12.000 | O 00:41:42.000 | F0408 | Dark green kelp silhouettes against pale green backlight | Silhouette, lighting | Representative |
| 55 | Atlas 04 | 9 | 12 | L 00:06:20.000 | O 00:41:50.000 | F0410 | Pure white frame | Non-gameplay | **Exceptional** |
| 56 | Atlas 04 | 9 | 12 | L 00:06:24.000 | O 00:41:54.000 | F0411 | Starfield with purple-green nebula; no water, terrain or dolphin | Non-gameplay | **Exceptional** |

**Distribution check for the 56 rows.**

- **By PDF:** Atlas 01 = 19 rows (#1–19), Atlas 02 = 13 rows (#20–32), Atlas 03 = 11 rows (#33–43), Atlas 04 = 13 rows (#44–56). All four represented.
- **By page:** every page 1–9 of every atlas contributes at least one row. Early (pp. 1–3), middle (pp. 4–6) and late (pp. 7–9) pages are represented in all four PDFs.
- **By clip:** Clip 01 = 4, Clip 02 = 3, Clip 03 = 2, Clip 04 = 4, Clip 05 = 2, Clip 06 = 3, Clip 07 = 4, Clip 08 = 2, Clip 09 = 3, Clip 10 = 8, Clip 11 = 8, Clip 12 = 13. All twelve clips represented; total 56.
- **By condition:** open underwater (#1, 4, 26, 28, 34), cave (#19, 20, 40, 52, 53), reef (#6, 31, 44), seabed/terrain (#5, 11, 33, 37), surface and waterline (#16, 47), breach and above water (#3, 8, 15, 25, 30, 39, 45), re-entry (#29), creatures (#7, 21, 23, 24, 36, 41, 43, 46, 49, 50), caustics (#38), light shafts (#27, 48), particles (#9, 32, 37, 41), fog and visibility (#34, 42), silhouette and geometry (#12, 37, 54), HUD (#10), transitions and non-gameplay (#13, 18, 55, 56).
- **By environment label (§4):** A (#1, 2), B (#5, 6, 7), C (#12, 14), D (#19, 20, 21), E (#22, 26), E2 (#27), F (#28, 31, 44), G (#34), H (#35), I (#36, 50, 51), J (#52), K (#53), L (#8, 30, 45), M (#3). All fourteen labels retained.

Eighteen rows were removed from the previous draft as redundant examples of conditions already covered by a retained row: F0008, F0017, F0029, F0042, F0049, F0071, F0072, F0081, F0115, F0116, F0128, F0158, F0192, F0201, F0253, F0308, F0324, F0403. No unique environment, clip, page band or visual condition was dropped. All eighteen remain cited in §3 and §6 where relevant.

---

## 9. Unresolved questions

These cannot be answered from the sampled atlases and require native-resolution capture or the original clips.

1. **Texture frequency and softness at native resolution.** The atlas cannot separate source softness from thumbnail downscaling. This is the largest gap.
2. **Presence, scale and distribution of dithering.** Not resolvable at this scale, in dark areas or anywhere else.
3. **Mipmapping behavior and distance shimmer.** Requires motion at native resolution.
4. **Caustic animation speed, edge hardness, tiling period, and whether caustics project onto creatures or only terrain.** 4-second sampling cannot support this.
5. **Fog falloff shape.** No frame set in the atlas holds a fixed subject at increasing known distances.
6. **Absolute scale.** Nothing in the corpus provides a metric reference. All distances here are in apparent dolphin body-lengths.
7. **Camera FOV, follow-distance dynamics, lag and collision behavior.** Stills give a static screen coverage only; motion behavior is not derivable and is Track E's domain regardless.
8. **Whether F0007's dawn sky indicates a time-of-day system, a scripted moment, or a distinct region.** One frame is not enough.
9. **Whether ambient marine snow exists in bright open water or is only rendered/visible against dark backdrops.**
10. **The identity of the structures in F0001/F0006** (built ruin versus natural formation).
11. **The subjects of the ambiguous frames listed in §6.6** (F0141, F0151, F0205, F0246, F0267, F0289, F0399).
12. **Whether the desaturated grey-blue plain (Clips 8–9) is a depth band, a region, or a weather/lighting state.** The atlas shows it as a contiguous run of two clips with a bright above-water frame inside it (F0128), which argues against "depth band" but does not settle it.
13. **Underwater sun-shaft behavior in open water away from cave mouths.** All observed shafts are aperture-bound.
14. **Whether the letterboxing seen on many thumbnails is a source property or an atlas layout artifact.**
15. **True HUD legibility, exact HUD element identity, and the meaning of the red bar in F0309.**
16. **Whether above-water shorelines carry foam or surf.** Not resolvable at this scale in F0069, F0178, F0332, F0346.

---

## 10. Final evidence-confidence summary

### Strongly supported (multiple frames, multiple clips, multiple PDFs, unambiguous)
- The fog is always the water color; never neutral grey. (R1)
- Broad diffuse top-down lighting; no pin-point speculars; matte materials throughout. (R2, R7)
- The dolphin is centered at a consistent chase framing occupying roughly 8–18% of frame width. (R3, M17)
- Value contrast, not color, carries navigation; bright apertures and shafts anchor dark frames. (R4)
- Terrain is blocked into large simple masses; detail is textural rather than geometric. (R5)
- Cyan bubble bursts are the dominant particle event and recur across all four PDFs. (R6)
- Above water is a single bright tropical day condition, with exactly one dawn exception. (R10)
- Multiple visually distinct environments exist, and saturation is a region property, not only a depth property.
- The creature vocabulary: dolphin, shark, small reef fish, turtle-like creature, pink jellyfish, blue jellyfish, octopus.
- Non-gameplay frames (dialogue overlays, black/white flashes, starfield) are present and identified.

### Moderately supported (visible but with real interpretive slack)
- The visibility bands in M12–M16. Direction and ordering are solid; the numbers are eyeballed.
- Caustics are shallow-biased and drop off with depth. F0247 is strong; corroboration is thinner than for the rules above.
- Light shafts are aperture-bound and function as landmarks.
- Wildlife density figures. Direction (sparse by default, clustered when present) is solid; the counts are lower bounds.
- The composition rhythm of corridor framing alternating with sparse plain.
- Kelp as flat cards; faceting on angular rock.

### Weakly supported (one clip, one PDF, or one frame)
- The dawn above-water condition. Single frame (F0007).
- The violet chamber palette. Single sequence, Clip 12 only.
- The magenta-lit rock chamber. Single sequence, Clip 10 only.
- The vertical shaft chamber composition. Essentially F0153–F0155 only.
- The submerged built structure in Clip 1. Two frames, both indistinct.
- R11 (fog attenuates contrast before hue) rests on Atlas 03 frames only.
- Precise hex families in §7. Directionally useful; not measurements.

### Not answerable from this atlas
- Texture frequency, softness, mipmapping, dithering, texel density, tiling.
- Fog falloff curve, densities, distances in meters.
- Camera FOV, lag, collision, and any motion or timing property.
- Caustic animation, projection targets, and cell hardness.
- Any renderer constant or shader parameter.
- The identity of the seven ambiguous frames in §6.6.

**Bottom line for the next step.** The atlas is sufficient to establish palette families, value structure, composition grammar, environment taxonomy, particle and creature vocabulary, and the visibility ordering across regions. It is **not** sufficient for any texture-fidelity claim, any fog or lighting number, or any motion claim. The Track D specification must therefore treat §7 as estimates awaiting native PCSX2 capture, and must not promote any figure in this document to "measured".
