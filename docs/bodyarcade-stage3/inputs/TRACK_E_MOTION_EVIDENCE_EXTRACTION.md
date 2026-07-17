# BodyArcade Track E — Local Motion and Camera Evidence Extraction

## 1. Evidence-access statement

This report is an evidence extraction from four prepared visual-atlas PDFs. All 34 PDF pages were rasterized to local PNGs and directly inspected with multimodal model vision: 25 chronological overview pages and nine dense-sequence pages. Every overview page was inspected as a full page, with a top-left caption crop used to check visible caption legibility; every dense page was inspected as a full page plus four overlapping quadrant crops. The page-by-page record is `_track_e_visual_extraction_work/PAGE_INSPECTION_LEDGER.md`.

The analysis used only these authorized visual and supporting files: `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, `TRACK_E_REDUCED_EVIDENCE_INDEX.md`, `TRACK_E_REDUCED_FRAME_MANIFEST.csv`, `TRACK_E_REDUCED_DENSE_SEQUENCE_MANIFEST.csv`, `VIDEO_INDEX.md`, `VIDEO_TECHNICAL_INVENTORY.md`, `TRACK_E_REDUCED_VALIDATION_REPORT.md`, and `TRACK_E_REDUCED_SHA256SUMS.txt`.

The original MP4 files were not opened or watched. No web sources, previous Track E conclusions, conversation exports, or prior incomplete reports were used. The overview tier samples approximately every four seconds; the dense tier samples every 0.20 seconds. Consequently, this report does not claim native-frame precision, controller input, hidden velocity, physics constants, collision algorithms, camera spring/damping constants, or animation thresholds.

Evidence labels are used as follows:

- `[DO]` — directly visible observation.
- `[BVM]` — bounded visual measurement from sampled frames, with explicit sampling uncertainty.
- `[INF]` — restrained interpretation beyond direct appearance.
- `[UNC]` — unresolved uncertainty or insufficient evidence.

## 2. Source and rasterization integrity

The package validation record reports `PASS`: 12 source clips, combined represented source duration `00:25:13.090`, 393 overview frames, 180 dense frames, nine dense sequences, and 34 PDF pages. The frame manifest contains 573 evidence rows plus its header, and each visual atlas cell maps to a manifest row. These supporting records were used only for citation and timestamps, not as substitutes for visual inspection.

| PDF | Pages | Raster-page dimensions | Expected and revalidated SHA-256 |
|---|---:|---:|---|
| `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf` | 13 | 4824×3560 | `5365d5aac5dce97c6a004129abdd317b9974a03e9a8dfc0f1e21c713c1041e0d` |
| `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf` | 12 | 4824×3560 | `f91af279dd0e17bcb9404638d29a41dc77855e95b892b588d20a450e6700f711` |
| `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf` | 5 | 5336×3144 | `8815f274e1e096549103495739621b60274961fef7254df408da8279150b3dae` |
| `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf` | 4 | 5336×3144 | `b4d3fa1d123cc60bb0468c251d2713210e29686d00151b0bea7bcdee31c64583` |

Exactly 34 inspection PNGs and 61 inspection crops were present. All 34 PNGs opened, had the expected dimensions, and were nonblank. All 34 pages were visually inspectable and are marked `COMPLETE`; no page is marked `UNREADABLE`. Some individual atlas cells remain character-level ambiguous because of darkness, overexposure, terrain occlusion, splash, or cutscene framing, and those limitations are retained below.

Captions and sequence headers were visibly checked in the page images or crops. The manifest was then used to map the already-inspected imagery to exact frame IDs, clip-local timestamps, and original-video timestamps. No OCR or pixel-derived motion measurement was used.

## 3. Coverage summary

The overview tier covers all 12 clips in chronological order. The dense tier contains nine selective 3.80-second windows from clips 01, 02, 03, 04, 05, 06, 07, and 09; clip 03 supplies two dense windows, while clips 08, 10, 11, and 12 are overview-only. The overview tier supplies breadth but not fine timing. The dense tier supplies bounded timing but is not representative of every context in the 25:13 source inventory.

All 36 requested categories were considered. `D1`–`D9` refer to the exact dense citations in §5; overview references point to the exact, timestamped strongest-evidence entries in §18.

| # | Requested category | Evidence disposition |
|---:|---|---|
| 1 | Propulsion onset | `[UNC]` Not bounded. D1 begins with the dolphin already moving; no stationary pre-onset baseline is present. |
| 2 | Visible acceleration | `[INF]` D1 shows increasing camera-dolphin separation and continuing travel, but camera motion prevents recovery of acceleration. |
| 3 | Tail-pump cadence | `[DO]` Successive fluke configurations are visible in D1 and D3; `[UNC]` complete cycle count/cadence is not reliable at 0.20-second sampling. |
| 4 | Transition into cruise | `[UNC]` No dense window cleanly contains propulsion onset followed by a fully bounded steady cruise transition. |
| 5 | Ordinary cruising | `[DO]` Sustained rearward travel is visible in D1 and D3 and repeatedly in overview evidence (§18 entries 4, 12, 13, 17, 19, 22, 25, 28). |
| 6 | Coasting and glide persistence | `[INF]` D2 contains a brief straightened phase and D3 continuous travel, but visible frames do not prove propulsion ceased. |
| 7 | Visible deceleration | `[DO]` D8 visibly approaches and enters a low-speed regime; the exact bounded measurement, uncertainty, and non-corroboration are stated in §6. |
| 8 | Stopping and low-speed hovering | `[DO]` D8 shows low-speed repositioning after arrival; overview has recurring upright tail-down poses (§18 entries 1, 5, 6, 9, 14, 23). `[UNC]` exact zero velocity is not proven. |
| 9 | Slow yaw turns | `[DO]` D2 directly shows a slow curved/banked turn; its bounded duration, uncertainty, and corroboration are stated in §7. |
| 10 | Rapid turns and direction changes | `[DO]` D9 and overview clip 09 show strong curvature near terrain/predators; `[UNC]` D9's path is partly terrain-occluded. |
| 11 | Banking and roll | `[DO]` Banked/curved profiles recur in D2, D3, D7, D9 and many overview clips. |
| 12 | Pitch-up and pitch-down | `[DO]` Pitch-up appears in D1, D4, and D6; pitch-down descent is clearest in D6. |
| 13 | Ascent and descent | `[DO]` D1 continues an underwater ascent; D4 and D6 include ascent, airborne descent, and re-entry. |
| 14 | Facing direction versus apparent travel direction | `[DO]` Side/curved bodies continue translating through turns in D2, D3, D7, and D9; `[UNC]` camera orbit prevents a world-space slip-angle measurement. |
| 15 | Body curvature during turns | `[DO]` Strongly supported in D2, D3, D7, and D9, corroborated throughout overview evidence. |
| 16 | Animation changes associated with apparent speed | `[UNC]` Tail phase, curvature, and pitch visibly change, but no speed threshold or clean slow/fast animation-state comparison is recoverable. |
| 17 | Camera distance | `[DO]` Large changes in subject scale/separation occur in D1, D5, and overview entries 6, 8, 11, 17, 19, 23, 27, 28. |
| 18 | Dolphin screen coverage | `[DO]` Coverage ranges from very small/distant to frame-filling/obstructed, especially near terrain; no metric focal length or distance is recoverable. |
| 19 | Camera lag and catch-up | `[DO]` Gradual rather than instantaneous alignment is visible in D1, D5, and D7. `[UNC]` character and camera motion cannot be decomposed into a parameter. |
| 20 | Camera recentering and settling | `[DO]` D7 and D8 directly show gradual recentering/settling; bounded timings, uncertainties, and confounds are stated in §9. |
| 21 | Camera pitch response | `[DO]` D1 pitches from seafloor-dominant toward surface-dominant during ascent; D4 and D6 cross to above-water views. |
| 22 | Camera behavior near terrain | `[DO]` Close terrain changes sightline, distance, and target visibility in D3, D5, D7, D8, and D9. |
| 23 | Camera behavior in caves and confined spaces | `[DO]` Overview clips 04, 06, 07, 10, 11, and 12 plus D5/D7/D9 show compression, darkness, occlusion, and occasional apparent rock clipping. |
| 24 | Surface approach | `[DO]` D4 and D6 show sustained nose-up approaches directly below the waterline. |
| 25 | Swimming immediately below the surface | `[DO]` Visible in overview entries 3, 10, and 18 and at the beginning of D4/D6. |
| 26 | Waterline crossing | `[DO]` D4 and D6 each contain a visible last-underwater/first-above-water transition; exact bounds, uncertainty, and cross-corroboration are stated in §10. |
| 27 | Breach initiation and launch | `[DO]` D4/D6 visibly transition from nose-up underwater travel to above-water flight. `[UNC]` launch input/impulse is not exposed. |
| 28 | Airborne ascent | `[DO]` D4 and D6 show rising, mostly tail-down airborne poses after exit. |
| 29 | Airborne apex | `[DO]` Both D4 and D6 visibly rise then descend; exact apex bounds, uncertainty, and corroboration are stated in §10. |
| 30 | Airborne descent | `[DO]` D4 shows descent into splash; D6 more clearly shows progressive forward pitch into a nose-down descent. |
| 31 | Re-entry and splash | `[DO]` D4 DF00077 and D6 DF00120 contain large splashes that obscure the dolphin. |
| 32 | Post-entry movement recovery | `[DO]` D4 shows post-splash underwater movement; its bounded recovery timing and D6's lack of corroborating frames are stated in §10. |
| 33 | Post-entry camera recovery | `[DO]` D4 returns to a readable centered underwater view; exact timing and D6's coverage limitation are stated in §10. |
| 34 | Collision or near-collision behavior | `[DO]` Near-terrain and near-predator overlap/occlusion is frequent; `[UNC]` no sampled sequence proves a physical collision or response algorithm. |
| 35 | Low-input, idle, and relaxed swimming | `[DO]` Low-speed upright hovering/repositioning is visible; `[UNC]` input magnitude, true idle state, and relaxed-state logic are invisible. |
| 36 | Recurring visible qualities that make ordinary movement satisfying | `[INF]` The evidence consistently combines curved banked turns, readable pitch, retained forward travel, broad camera-distance variation, and gradual follow correction. “Satisfying” remains a design interpretation, not a directly measurable fact. |

## 4. Overview-atlas inventory

The overview atlas supplies chronological breadth at approximately four-second intervals. The table below inventories every directly inspected page. Exact timestamped evidence supporting the cited focus appears in §18 entries 1–31; the page-level inspection detail and ambiguities are preserved in ledger records 01–25.

| PDF/page | Frames | Clips | Primary visible coverage and limitations |
|---|---|---|---|
| Overview Atlas 01 p.1 | OF00001–OF00016 | 01, 02 | Upright hover, curved turn, pitch down/up, near-surface travel, chase-angle variation. |
| Overview Atlas 01 p.2 | OF00017–OF00032 | 02, 03 | Repeated upright low-speed poses, bubbles, animal proximity, larger camera separation during travel away. |
| Overview Atlas 01 p.3 | OF00033–OF00048 | 03, 04 | Steep descent, leveling at depth, dark cave travel, vegetation ascent, close confined framing. |
| Overview Atlas 01 p.4 | OF00049–OF00064 | 04, 05 | Above-water/nose-up pose, rocky opening, distance variation, banked turn, surface-adjacent framing; OF00053 is nearly black. |
| Overview Atlas 01 p.5 | OF00065–OF00080 | 05, 06 | Surface return, cave/corridor travel, banks and bubbles, strong terrain-driven camera-distance change. |
| Overview Atlas 01 p.6 | OF00081–OF00096 | 06, 07 | Wall-adjacent pitch, open corridor, text exclusions, upright poses, dark cave chase views. |
| Overview Atlas 01 p.7 | OF00097–OF00112 | 07 | Dark cave progression, bubbles, jellyfish, exit to open water, then terrain obstruction/effects. |
| Overview Atlas 01 p.8 | OF00113–OF00128 | 07, 08, 09 | Upright interaction poses, close sharks, surface view, banked turn, extreme terrain obstruction. |
| Overview Atlas 01 p.9 | OF00129–OF00144 | 09 | Predator/rock encounter, repeated curvature/banking, red/status imagery, later open-water recentering; no collision proven. |
| Overview Atlas 01 p.10 | OF00145–OF00160 | 09, 10 | Upright low-speed poses, cave/jellyfish travel, dialogue exclusions, bubbles, close dark-terrain view. |
| Overview Atlas 01 p.11 | OF00161–OF00176 | 10 | Surface turbulence, pitch-up and above-water frames, turns near walls, compressed-to-wide camera changes. |
| Overview Atlas 01 p.12 | OF00177–OF00192 | 10 | Banked travel, upright corridor positioning, circular effects, top-down view, dialogue/cutscene exclusions. |
| Overview Atlas 01 p.13 | OF00193–OF00208 | 10 | Severe rock obstruction, fish/shark/effects, upright poses, distant and recentered open travel. |
| Overview Atlas 02 p.1 | OF00209–OF00224 | 10 | Turns, arches, low ceiling, pillar field, terrain compression and partial orbit. |
| Overview Atlas 02 p.2 | OF00225–OF00240 | 11 | Octopus/encounter framing, dark cave, open-sand travel, bank near rock, arch/doorway compression. |
| Overview Atlas 02 p.3 | OF00241–OF00256 | 11 | Cave and text, surface view, near-waterline close view, distant narrow opening, sharks under arch. |
| Overview Atlas 02 p.4 | OF00257–OF00272 | 11 | Curved turns, triangular/arched gaps, extreme close rear view, cave entry and dark travel. |
| Overview Atlas 02 p.5 | OF00273–OF00288 | 11 | Cave hover, open rear travel, extreme close corridor view, widening/recentering, sharks/bubbles. |
| Overview Atlas 02 p.6 | OF00289–OF00304 | 11, 12 | Curved dolphin among large animals, red/circular effects, repeated upright wall-adjacent poses and foreground occlusion. |
| Overview Atlas 02 p.7 | OF00305–OF00320 | 12 | Banked rock turns, corridor travel, above-water view, then nonchase terrain/creature shots. |
| Overview Atlas 02 p.8 | OF00321–OF00336 | 12 | Nonchase opening, return to travel, above-water view, severe-to-wide terrain camera transition, text exclusions. |
| Overview Atlas 02 p.9 | OF00337–OF00352 | 12 | Upright corridor poses, bubble trails, pitch variation, banked turn, major animal/terrain occlusion. |
| Overview Atlas 02 p.10 | OF00353–OF00368 | 12 | Top-down/close pillar views, dark tunnel, octopus encounter, dialogue/nonchase frames, unresolved dark curvature. |
| Overview Atlas 02 p.11 | OF00369–OF00384 | 12 | Encounter/dialogue and detached environment views; little reliable ordinary movement evidence. |
| Overview Atlas 02 p.12 | OF00385–OF00393 | 12 | Environmental/cinematic imagery with no clearly visible dolphin; locomotion and chase-camera evidence absent. |

The overview repeatedly shows ordinary chase travel alternating with upright tail-down poses, curved/banked turns, steep pitch changes, surface-adjacent states, and terrain-driven camera compression. It also shows that dialogue, encounter, and cinematic frames must be excluded from ordinary follow-camera rules. Because samples are approximately four seconds apart, the overview cannot bound onset, duration, cadence, turn rate, or transient camera response.

## 5. Dense-sequence inventory

Each dense key below is an exact citation anchor used throughout the report. All windows contain 20 frames at 0.20-second spacing, spanning 3.80 seconds.

| Key | Exact source citation | Directly supported use | Central limitation |
|---|---|---|---|
| D1 | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, DF00001–DF00020, clip 01, clip-local `00:00:17.500–00:00:21.300`, original-video `00:04:47.500–00:04:51.300` | Tail-phase changes during travel; increasing camera separation; pitch-up beginning around +2.00s; continued ascent. | Movement is already underway, so propulsion onset and true acceleration are not bounded. |
| D2 | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, DF00021–DF00040, clip 02, clip-local `00:00:21.000–00:00:24.800`, original-video `00:13:53.000–00:13:56.800` | Upright low-speed phase; curved/banked turn; short straight phase; second incomplete turn among sharks; gradual camera orbit/recenter. | Continued propulsion during the apparent glide cannot be excluded; sharks obscure relative motion. |
| D3 | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, DF00041–DF00060, clip 03, clip-local `00:00:15.250–00:00:19.050`, original-video `00:15:09.250–00:15:13.050` | Established cruise, wall-following bank/yaw, body curvature, gradual camera orbit and recentering. | Turn begins after established travel and a new turn starts at the end; bubbles/effects are not assigned to propulsion. |
| D4 | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00061–DF00080, clip 03, clip-local `00:00:23.500–00:00:27.300`, original-video `00:15:17.500–00:15:21.300` | Nose-up surface approach, waterline exit, airborne arc, splash, underwater character/camera recovery. | Camera motion confounds apex height; launch input and physical constants are invisible. |
| D5 | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, DF00081–DF00100, clip 04, clip-local `00:01:00.500–00:01:04.300`, original-video `00:17:03.500–00:17:07.300` | Pillar occlusion, emergence into open sand, long distant/vegetation-screened follow, late close correction. | Hidden path, speed, and exact camera-response timing cannot be recovered. |
| D6 | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, DF00101–DF00120, clip 05, clip-local `00:00:25.700–00:00:29.500`, original-video `00:18:25.700–00:18:29.500` | Second nose-up surface approach, waterline exit, longer airborne arc, progressive pitch-down descent, splash. | Window ends on splash; no post-entry character or camera recovery is visible. |
| D7 | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, DF00121–DF00140, clip 06, clip-local `00:00:41.000–00:00:44.800`, original-video `00:19:33.000–00:19:36.800` | Weaving through rocks, repeated bank/curvature, lateral screen drift, gradual centered corridor settling. | Character steering and camera lag/damping cannot be separated into parameters. |
| D8 | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, DF00141–DF00160, clip 07, clip-local `00:01:40.400–00:01:44.200`, original-video `00:22:32.400–00:22:36.200` | Approach, arrival into low-speed movement, continued local repositioning, foreground-rock clearance and camera settling. | Deceleration onset is before the window; exact stop/zero velocity is not proven. |
| D9 | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, DF00161–DF00180, clip 09, clip-local `00:00:47.000–00:00:50.800`, original-video `00:24:57.000–00:25:00.800` | Curved maneuver around rock, severe camera/terrain obstruction, readable recovery, later shark proximity and further curvature. | World path is hidden during the obstruction; predator cause, collision, and red effect remain unresolved. |

## 6. Propulsion, acceleration, cruise, and glide

`[DO]` Tail/fluke configurations change across successive frames while the dolphin travels over sand and through fish in D1 DF00001–DF00010 (clip-local `00:00:17.500–00:00:19.300`; original-video `00:04:47.500–00:04:49.300`). The dolphin becomes smaller/farther ahead while terrain passes through the view. `[INF]` This is consistent with ongoing propulsion and increasing separation from the camera, but the sequence begins after motion has started and therefore does not show propulsion onset or isolate acceleration from camera response (`TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, clip 01).

`[UNC]` Tail-pump cadence cannot be stated as cycles per second. Body pitch, partial silhouette, and 0.20-second sampling make phase boundaries ambiguous in D1 and D3. The evidence supports changing tail phase, not a complete or native-frame cadence measurement.

`[DO]` Established ordinary cruise is clearer in D3 DF00041–DF00047: the dolphin remains rear-on and continues through a rock corridor while tail phase and background position change (clip-local `00:00:15.250–00:00:16.450`; original-video `00:15:09.250–00:15:10.450`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, clip 03). The overview corroborates sustained chase travel in multiple clips, for example clip 06 OF00081–OF00083 (clip-local `00:00:52.100–00:01:00.100`; original-video `00:19:44.100–00:19:52.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.6) and clip 12 OF00307–OF00310 within §18 entry 25.

`[INF]` A short glide/coast is plausible in D2 DF00034–DF00035, where the dolphin is more level and rear-on after straightening (clip-local `00:00:23.600–00:00:23.800`; original-video `00:13:55.600–00:13:55.800`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, clip 02). `[UNC]` The visual sequence cannot establish that propulsion stopped, so glide persistence is unmeasured. D3 likewise shows retained forward travel through a turn but does not prove an unpowered interval.

`[BVM]` D8 bounds entry into a low-speed regime to approximately +1.80s–+2.20s: forward closure continues through DF00150–DF00151, and DF00152 begins sustained local repositioning at the feature. This corresponds to clip-local approximately `00:01:42.200–00:01:42.600` and original-video `00:22:34.200–00:22:34.600`; uncertainty is at least ±0.20s because the transition is sampled and camera motion overlaps it (`TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, clip 07). It is not corroborated by another dense sequence with equally clear approach-to-hover coverage.

`[DO]` Repeated upright tail-down poses in the overview are consistent with low-speed holding or small repositioning, including clip 02 OF00022–OF00027 (clip-local `00:00:48.100–00:01:05.865`; original-video `00:14:20.100–00:14:37.865`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.2) and clip 11 OF00279–OF00288 (clip-local `00:03:36.100–00:04:12.100`; original-video `00:34:15.100–00:34:51.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.5). `[UNC]` Four-second overview spacing cannot establish stationary duration or input state.

## 7. Turning, banking, pitch, and travel direction

`[BVM]` D2's clearest turn begins with pronounced curvature/banking at DF00027 (+1.20s) and reaches a substantially straightened/rear-on state by DF00033 (+2.40s): about 1.2s, uncertainty at least ±0.20s because onset may precede DF00027 and straightening continues. Exact citation: `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, DF00027–DF00033, clip 02, clip-local `00:00:22.200–00:00:23.400`, original-video `00:13:54.200–00:13:55.400`; not independently corroborated as the same maneuver/speed condition.

`[BVM]` D3 shows a longer wall turn and straightening: DF00048 (+1.40s) through approximately DF00058–DF00059 (+3.40s–+3.60s), about 2.0–2.2s with at least ±0.20s uncertainty. Exact citation: `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, clip 03, clip-local `00:00:16.650–00:00:18.850`, original-video `00:15:10.650–00:15:12.850`. This corroborates gradual curved turning, but not a universal turn duration because context and apparent speed differ.

`[DO]` D7 shows smaller successive heading corrections through a rock corridor rather than a single pivot. The dolphin alternates rear and curved side poses from DF00121–DF00135 while translating continuously (clip-local `00:00:41.000–00:00:43.800`; original-video `00:19:33.000–00:19:35.800`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, clip 06). This supports banking/curvature as a recurring visual accompaniment to direction change.

`[DO]` D9 shows a strong curved/banked pose before, during, and after passage around a pointed rock, then another curving/rolling-away pose as a shark enters (DF00161–DF00180, clip-local `00:00:47.000–00:00:50.800`; original-video `00:24:57.000–00:25:00.800`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, clip 09). `[UNC]` Terrain hides the path for roughly +1.80s–+2.40s, so turn duration, radius, and “rapid” world-space direction change cannot be measured.

`[DO]` Pitch changes are large and readable. D1 rotates from near-level toward nose-up across DF00011–DF00013 (clip-local `00:00:19.500–00:00:19.900`; original-video `00:04:49.500–00:04:49.900`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, clip 01) and remains nose-up through DF00020. D6 progresses from nose-up launch to forward pitch and steep nose-down descent across DF00110–DF00119 (clip-local `00:00:27.500–00:00:29.300`; original-video `00:18:27.500–00:18:29.300`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05).

`[DO]` During banked turns the dolphin's facing direction, curved body axis, and apparent travel across terrain are not always collinear frame-by-frame (D2, D3, D7, D9). `[UNC]` A numeric slip angle or facing-versus-velocity curve cannot be extracted because the camera orbits and no world-space transforms are available.

## 8. Animation and apparent velocity

`[DO]` Visible animation-related changes include alternating tail/fluke positions during D1/D3 cruise, strong whole-body curvature during D2/D3/D7/D9 turns, nearly vertical tail-down holding poses throughout the overview, and a progressive tail-down-to-nose-down airborne rotation in D6. These are direct pose-state observations with exact dense citations in §5 and exact overview examples in §18.

`[UNC]` The evidence does not establish an animation state machine or speed thresholds. D1 may combine increasing apparent travel with tail-phase changes, but camera separation also changes. D2's brief straight phase may be a glide animation, but continued propulsion cannot be excluded. D8's low-speed phase retains changing body orientation rather than a perfectly static idle pose. No sequence pairs a measured speed with a controlled animation transition.

`[INF]` Curvature appears to preserve a sense of continuity through turns because the body bends across multiple 0.20-second samples instead of switching instantaneously from one heading to another. This interpretation is supported by D2 DF00027–DF00033, D3 DF00048–DF00059, and D7 DF00121–DF00135, but “satisfying” or “responsive” remains subjective.

## 9. Camera distance, lag, correction, and terrain behavior

`[DO]` Camera-dolphin separation visibly changes during movement. In D1 DF00001–DF00010 the dolphin becomes smaller/farther ahead through +1.80s before the view pitches toward the ascent; the exact citation is clip-local `00:00:17.500–00:00:19.300`, original-video `00:04:47.500–00:04:49.300`, `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, clip 01. `[UNC]` The amount is not safely measurable in body lengths because depth and camera pitch change.

`[DO]` Camera alignment through turns is gradual. D2 rotates/widens with the dolphin and is largely behind the new heading by DF00033 (+2.40s), while D3 exposes the dolphin's side during the wall turn and returns to a rear alignment by approximately DF00058–DF00059 (+3.40s–+3.60s). These exact windows are cited in §7. No frame shows a reliable instantaneous heading snap.

`[BVM]` D7's clearest camera/character settling interval spans approximately DF00133–DF00140 (+2.40s–+3.80s), about 1.4s with at least ±0.20s uncertainty: clip-local `00:00:43.400–00:00:44.800`, original-video `00:19:35.400–00:19:36.800`, `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, clip 06. The dolphin is also straightening, so this is a visual follow-settling bound, not a camera damping constant. D8 corroborates gradual settling qualitatively, not with the same timing.

`[DO]` In D8, the right foreground rock dominates DF00141 and clears gradually by DF00144–DF00146 (+0.60s–+1.00s); from roughly DF00152 (+2.20s) onward, target scale and composition become comparatively stable while the dolphin makes small local adjustments. Exact full citation: `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, clip 07, clip-local `00:01:40.400–00:01:44.200`, original-video `00:22:32.400–00:22:36.200`.

`[DO]` Terrain can defeat target visibility rather than being fully avoided. D5 hides or only indistinctly shows the dolphin through DF00081–DF00085 (+0.00s–+0.80s), keeps it small/vegetation-screened across much of DF00087–DF00095, then closes/reorients strongly by DF00099–DF00100. Exact citation: `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, clip 04, clip-local `00:01:00.500–00:01:04.300`, original-video `00:17:03.500–00:17:07.300`.

`[BVM]` D9's severe obstruction occupies approximately DF00170–DF00173 (+1.80s–+2.40s), and a readable third-person view returns at DF00174 (+2.60s): a recovery after the last severely obstructed sample within about 0.20s, but with at least ±0.20s sampling uncertainty. Exact citation: `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, clip 09, clip-local `00:00:48.800–00:00:49.600`, original-video `00:24:58.800–00:24:59.600`. This is corroborated qualitatively by repeated terrain compression in the overview, not as a universal duration.

`[DO]` Caves and narrow arches produce closer, darker, more occluded views across overview clips 04, 06, 07, 10, 11, and 12. Examples include clip 06 OF00069–OF00080 (clip-local `00:00:04.100–00:00:48.100`; original-video `00:18:56.100–00:19:40.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.5), clip 11 OF00257–OF00272 (clip-local `00:02:08.100–00:03:08.100`; original-video `00:32:47.100–00:33:47.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.4), and clip 12 OF00353–OF00368 (clip-local `00:03:48.100–00:04:48.100`; original-video `00:39:18.100–00:40:18.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.10).

## 10. Surface approach, breach, airborne movement, and re-entry

`[DO]` D4 begins with a sustained nose-up approach immediately below the surface (DF00061–DF00069, clip-local `00:00:23.500–00:00:25.100`; original-video `00:15:17.500–00:15:19.100`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, clip 03). D6 independently shows another nose-up approach along a rock wall (DF00101–DF00109, clip-local `00:00:25.700–00:00:27.300`; original-video `00:18:25.700–00:18:27.300`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05).

`[BVM]` D4 waterline exit is bounded between DF00070 (+1.80s, still underwater) and DF00071 (+2.00s, clearly above water): clip-local `00:00:25.300–00:00:25.500`, original-video `00:15:19.300–00:15:19.500`, uncertainty at least ±0.20s (`TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, clip 03). D6 corroborates a comparable transition between DF00109 (+1.60s) and DF00110 (+1.80s): clip-local `00:00:27.300–00:00:27.500`, original-video `00:18:27.300–00:18:27.500`, uncertainty at least ±0.20s (`TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05).

`[BVM]` D4's first clear air frame to splash spans DF00071–DF00077 (+2.00s–+3.20s), about 1.2s with at least ±0.20s uncertainty: `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, clip 03, clip-local `00:00:25.500–00:00:26.700`, original-video `00:15:19.500–00:15:20.700`. D6's corresponding interval spans DF00110–DF00120 (+1.80s–+3.80s), about 2.0s with at least ±0.20s uncertainty: `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05, clip-local `00:00:27.500–00:00:29.500`, original-video `00:18:27.500–00:18:29.500`. The two windows corroborate a clear airborne arc but contradict any claim of one fixed visible airborne duration.

`[BVM]` The apparent apex in both sequences falls around +2.40s–+2.60s. In D4 this corresponds approximately to `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00073–DF00074, clip 03, clip-local `00:00:25.900–00:00:26.100`, original-video `00:15:19.900–00:15:20.100`; in D6 to `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, DF00113–DF00114, clip 05, clip-local `00:00:28.100–00:00:28.300`, original-video `00:18:28.100–00:18:28.300`. Uncertainty is at least ±0.20s and greater for metric height because the camera moves and framing differs. The sequences corroborate apex timing in relative-sequence position, not ballistic constants or metric height.

`[DO]` D6 more clearly shows airborne pose evolution: the dolphin is nearly vertical/tail-down after exit, then progressively pitches forward through DF00114–DF00118 and is steeply nose-down at DF00119 before splash at DF00120 (clip-local `00:00:28.300–00:00:29.500`; original-video `00:18:28.300–00:18:29.500`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05). D4 shows a shorter mostly tail-down arc before its splash.

`[BVM]` D4 splash occurs at DF00077 (+3.20s). DF00078 (+3.40s) is underwater turbulence, and DF00079–DF00080 (+3.60s–+3.80s) show a readable dolphin moving away. Post-splash movement/camera recovery is therefore roughly 0.4–0.6s, uncertainty at least ±0.20s: clip-local `00:00:26.700–00:00:27.300`, original-video `00:15:20.700–00:15:21.300`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, clip 03. D6 ends at splash and does not corroborate recovery timing.

`[DO]` The camera pitches upward before exit, changes to an above-water view, retains the airborne dolphin near the central viewing region, then looks toward impact. D6's above-water view remains constrained by dark foreground rock edges, showing that terrain can continue to shape framing even during a breach. Neither sequence exposes a camera algorithm or independent camera input.

## 11. Confined-space and near-collision behavior

`[DO]` The dolphin can pass extremely close to rocks while its body bends and the camera loses a clean view. D5's opening second is pillar-occluded, D7 weaves between rock masses while remaining continuously in motion, and D9 apparently places the camera into/behind rock geometry for several samples. Exact full-window citations are D5, D7, and D9 in §5.

`[DO]` In D5 DF00086–DF00090, the dolphin becomes readable between pillars and turns into an open sandy area (clip-local `00:01:01.500–00:01:02.300`; original-video `00:17:04.500–00:17:05.300`; `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, clip 04). `[UNC]` The path immediately before this interval is hidden, so no clearance, collision normal, or avoidance response can be determined.

`[DO]` D7 DF00128–DF00135 shows a stronger bend around the central/right rock and a correction back toward the gap (clip-local `00:00:42.400–00:00:43.800`; original-video `00:19:34.400–00:19:35.800`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, clip 06). The body curves rather than pivoting in place. No sampled frame visibly establishes contact.

`[DO]` Predator encounters create additional occlusion and relative-motion ambiguity. D2 begins with a shark crossing close in front of an upright dolphin; D9 introduces a shark from DF00177 (+3.20s), followed by curving/rolling dolphin poses and a red shark/alert rendering at DF00180. D9 exact subrange: clip-local `00:00:50.200–00:00:50.800`, original-video `00:25:00.200–00:25:00.800`, `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, clip 09. `[UNC]` Attack, damage, collision, scripted behavior, and causal input are not established.

`[DO]` The overview corroborates frequent near-overlap with terrain and large animals, especially clip 09 OF00129–OF00139 (clip-local `00:00:12.100–00:00:52.100`; original-video `00:24:22.100–00:25:02.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.9) and clip 12 OF00296–OF00304 (clip-local `00:00:00.100–00:00:32.100`; original-video `00:35:30.100–00:36:02.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.6). `[UNC]` Four-second spacing cannot establish whether any overlap is physical contact.

## 12. Strongly supported recurring movement rules

These are evidence-level recurring visible rules, not implementation rules or recovered mechanics.

1. `[DO]` Direction changes are repeatedly expressed through sustained body curvature and banking rather than only through an instantaneous heading swap. Dense corroboration comes from D2 DF00027–DF00033, D3 DF00048–DF00059, D7 DF00121–DF00135, and D9 DF00161–DF00180; exact citations are in §§5 and 7.

2. `[DO]` Large pitch ranges are part of ordinary traversal. D1 changes from near-level to nose-up and continues ascending; D4/D6 maintain nose-up surface approaches; D6 then rotates to nose-down during airborne descent. Exact citations are in §§5, 7, and 10.

3. `[DO]` Forward translation continues through many visible curved/banked poses. The dolphin does not appear to rotate only in place in D2, D3, D7, or the readable portions of D9. `[UNC]` Camera orbit prevents a numerical world-space relationship between heading and velocity.

4. `[DO]` A visually distinct low-speed mode recurs as upright/tail-down posing and small local repositioning. D8 directly shows continued low-speed adjustment after arrival, while overview clips 02, 05, 07, 10, 11, and 12 repeatedly show similar upright poses. `[UNC]` This does not establish an input-free idle state or zero velocity.

5. `[DO]` Surface traversal is continuous across underwater approach, waterline crossing, airborne pose evolution, splash, and—where sampled—underwater recovery. D4 and D6 independently support the approach/crossing/arc/splash phases; only D4 supports recovery timing.

6. `[DO]` Airborne pose is not fixed. D6 changes from tail-down ascent to progressively pitched-forward and nose-down descent across DF00110–DF00119 (clip-local `00:00:27.500–00:00:29.300`; original-video `00:18:27.500–00:18:29.300`; `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, clip 05).

7. `[DO]` Movement remains visually readable across open water, sand corridors, rock arches, caves, surface transitions, and predator-heavy scenes, but readability can degrade sharply when terrain or creatures occupy the camera sightline. This context variation is represented across all 12 overview clips (§18 entries 1–31).

8. `[INF]` A recurring source of movement appeal is continuity: curvature persists across turns, pitch carries through ascent/descent, and forward movement often survives directional change. This is a bounded design interpretation of D1–D4 and D7–D9, not a measured satisfaction score.

## 13. Strongly supported recurring camera rules

1. `[DO]` The ordinary camera is most often behind and somewhat above the dolphin during open-water travel. Overview examples include clip 02 OF00017–OF00018 (clip-local `00:00:28.100–00:00:32.100`; original-video `00:14:00.100–00:14:04.100`; `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.2) and clip 09 OF00141–OF00144 (clip-local `00:01:00.100–00:01:12.100`; original-video `00:25:10.100–00:25:22.100`; same PDF, p.9).

2. `[DO]` The camera does not remain at one fixed distance. Subject scale/separation changes markedly during travel, turning, approaching walls, passing openings, and emerging from confinement. D1 and D5 show this continuously; overview entries 6, 8, 11, 17, 19, 23, 27, and 28 corroborate it across clips.

3. `[DO]` Camera alignment is generally gradual across curved turns. D2 and D3 show lateral exposure/orbit followed by recentering; D7 shows the dolphin moving laterally within frame before corridor alignment settles. `[UNC]` The evidence does not identify a spring, damping equation, or fixed delay.

4. `[DO]` Camera pitch follows major vertical motion. D1 shifts from seafloor-dominant to surface-dominant during ascent; D4 and D6 pitch up through the waterline and then frame impact. Exact dense citations are in §§5, 9, and 10.

5. `[DO]` Terrain materially constrains camera placement. Near walls/pillars, the view can compress, become side-biased, be screened by vegetation, or apparently pass into/behind rock. D5 and D9 are the strongest dense examples; overview clips 04, 06, 07, 10, 11, and 12 repeatedly corroborate the pattern.

6. `[DO]` Occlusion is tolerated rather than always solved immediately. D5 remains obstructed through its first second, and D9 remains severely rock-obstructed for roughly +1.80s–+2.40s before clearing at +2.60s. `[UNC]` The evidence cannot say whether this results from collision limits, line-of-sight logic, level geometry, or another cause.

7. `[DO]` Caves narrow the visible field and reduce illumination while commonly retaining a centered rear sightline toward an opening. This recurs in clips 04, 06, 07, 10, 11, and 12; exact overview citations appear in §18.

8. `[DO]` The presentation can leave ordinary chase framing for dialogue, encounters, or environmental/cinematic shots. Clip 12 OF00317–OF00320, OF00369–OF00384, and OF00385–OF00393 are explicit examples (§18 entries 26, 30, 31). These are not evidence of ordinary follow-camera behavior.

## 14. Likely but unconfirmed mechanics

- `[INF]` The camera appears to use a smoothed follow response rather than perfect rigid locking, because heading alignment and distance correction unfold over multiple 0.20-second samples in D2, D3, D7, and D8. `[UNC]` No mathematical response model or constant is observable.
- `[INF]` Upright tail-down posing likely corresponds to a low-speed/holding mode because it recurs in apparent stationary or locally constrained contexts and is directly sustained in D8. `[UNC]` The evidence does not reveal a velocity threshold, animation state name, or input condition.
- `[INF]` The body appears to bank/curve as a directional-change presentation layer, since curved poses recur during visible path changes in four dense sequences and many overview clips. `[UNC]` The relationship among bank amount, yaw rate, speed, and input cannot be measured.
- `[INF]` The brief straight phase in D2 may represent glide persistence after a turn. `[UNC]` Continued propulsion is visually possible, so no drag, coasting duration, or momentum rule is established.
- `[INF]` Surface launches may preserve underwater pitch into the initial airborne tail-down pose, as both D4 and D6 cross the surface while nose-up and first appear airborne largely tail-down. `[UNC]` Launch impulse and control authority are invisible.
- `[INF]` Camera collision/occlusion handling may prefer continuity of camera movement over immediate target visibility, given D5 and D9. `[UNC]` It is equally possible that the observed obstruction is a level-specific failure or geometry artifact rather than an intended priority.
- `[INF]` Bubble, purple, circular, and red effects may correspond to abilities, status, impacts, or scripted interactions. `[UNC]` The atlas does not establish their meaning, so they are not used as locomotion or collision evidence.

## 15. Behaviors absent or insufficiently represented

- `[UNC]` Propulsion onset is absent: D1 starts with established motion.
- `[UNC]` Exact visible acceleration duration is insufficient because camera and character motion are inseparable.
- `[UNC]` Tail-pump cadence and native animation-cycle timing are insufficient at 0.20-second sampling and with changing pitch/silhouette.
- `[UNC]` A fully bounded transition from rest/propulsion onset into steady cruise is absent.
- `[UNC]` Unpowered coasting/glide persistence is not proven.
- `[UNC]` Exact zero-speed stopping is not proven; D8 retains local repositioning.
- `[UNC]` High-speed turn duration/radius is not measurable because D9 is occluded and speed is unknown.
- `[UNC]` Facing-versus-world-velocity angle is not measurable without transforms.
- `[UNC]` Apparent-speed-specific animation thresholds are not represented.
- `[UNC]` Camera distance in metric units or reliable body-length units is not available across changing perspective.
- `[UNC]` Independent camera-response delay, damping, spring behavior, and correction rate cannot be decomposed from character movement.
- `[UNC]` Collision contact, collision response, sliding, deflection, or avoidance logic is not established by any sampled frame sequence.
- `[UNC]` Input state—including low input, released input, steering input, or button presses—is wholly absent.
- `[UNC]` Breach launch force, airborne gravity, drag, control authority, and height are not recoverable.
- `[UNC]` D6 provides no post-splash frames; D4 alone supports post-entry recovery and cannot establish a universal duration.
- `[UNC]` The overview-only contexts in clips 08, 10, 11, and 12 lack 0.20-second windows, so their motion/camera transients are not measurable.
- `[UNC]` Dialogue, encounter, and cinematic frames—especially late clip 12—do not support ordinary locomotion or chase-camera conclusions.

## 16. Contradictions and ambiguous evidence

1. **Airborne duration varies.** `[DO]` The exact bounded measurements in §10 show about 1.2s for D4 and about 2.0s for D6 from first clear air frame to splash. This contradicts a single universal visible airborne duration, but does not expose why the arcs differ.

2. **Recovery evidence is asymmetric.** `[DO]` The exact bounded measurement in §10 shows D4 regaining a readable underwater dolphin view after splash; `[UNC]` D6 ends on the splash and supplies no recovery evidence. A recovery rule cannot be generalized from one sample.

3. **Low-speed poses are recurrent but not necessarily stationary.** The overview often makes upright tail-down frames look stationary, while D8 shows orientation/local-position changes throughout the apparent hover. “Hover” is supported; exact rest is not.

4. **Glide appearance does not prove no propulsion.** D2's level straight phase is consistent with coasting, but tail/body visibility and sampling do not establish cessation of thrust.

5. **Camera lag and character movement overlap.** D1's separation increase, D7's lateral screen drift, and D8's settling all admit both camera and character contributions. A visible follow effect is supported; an independent response curve is not.

6. **Terrain proximity produces both readable and failed framing.** Many corridors retain centered chase views, but D5 and D9 suffer prolonged obstruction. This may reflect contextual geometry rather than one always-successful camera rule.

7. **Predator proximity and curved movement co-occur without establishing causation.** D2/D9 and overview clips 08, 09, 11, and 12 show sharks near turns, red effects, or bubbles. The sequence cannot establish whether the dolphin is evading, hit, scripted, or simply turning.

8. **Visual effects remain semantically unresolved.** Circular white/blue distortions, purple points, bubble bursts, and red tinting recur. None is used to infer acceleration, collision, ability activation, or damage without direct evidence.

9. **Dark/cinematic cells limit character evidence without making whole pages unreadable.** OF00042 and OF00053 are character-level dark/ambiguous; OF00376 is too dark to resolve the dolphin; OF00391 is overexposed; OF00385–OF00393 are largely environmental/cinematic. Their pages remain inspectable and `COMPLETE` because the limitation itself is directly visible and recorded.

## 17. Questions requiring native-video capture

The following questions cannot be answered from the reduced atlas and should be targeted with native-video captures that include a stationary baseline, visible controller/input telemetry if available, stable reference geometry, and longer pre/post windows:

1. What is the time from true propulsion onset to a stable cruise regime, and how does tail cadence change across it?
2. Does forward speed persist after propulsion input ceases, and for how long under matched conditions?
3. What are the distinct low-speed, cruise, and high-speed animation states, and at what observable transition conditions do they change?
4. How do yaw, roll/bank, pitch, and body curvature relate to world-space velocity during slow versus rapid turns?
5. Does the dolphin retain lateral slip or forward momentum while its facing changes?
6. What is the camera's independent follow delay and correction profile after a controlled step turn, pitch change, acceleration, or stop?
7. How does the camera handle line-of-sight obstruction and physical terrain collision across matched corridor geometries?
8. Are D5/D9 obstructions intended continuity behavior, geometry-specific failure, or camera clipping?
9. What happens immediately before and after confirmed rock contact, including sliding, deflection, speed loss, and camera response?
10. Are the close shark sequences attacks, damage events, scripted encounters, or ordinary proximity, and what movement response occurs at native frame rate?
11. What controls breach launch height/duration, airborne pitch authority, apex, and re-entry angle under repeated matched approaches?
12. How long do character control and camera readability take to recover after re-entry across multiple breaches?
13. What do the recurring bubble, purple, circular, and red effects represent, and do any alter locomotion or camera behavior?
14. How do clips 08, 10, 11, and 12 behave in dense ordinary-motion windows not represented by the current selective dense tier?

## 18. Strongest-evidence table

The 59 entries below are continuously numbered, include all four PDFs, all nine dense sequences, and explicitly consider all 12 source clips. Overview uncertainty is generally at least the approximately four-second sample interval for event timing. Dense uncertainty is at least ±0.20s and greater when phase boundaries or visibility are ambiguous.

| # | Evidence | Exact source citation | Uncertainty / corroboration |
|---:|---|---|---|
| 1 | `[DO]` Upright, tail-down low-speed pose near the seafloor. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.1, OF00001, clip 01, clip-local `00:00:00.100`, original-video `00:04:30.100`. | Pose direct; speed/input unresolved at four-second tier. Corroborated by entries 5, 6, 9, 14, 23, 24. |
| 2 | `[DO]` Strong body curvature/bank during a turn. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.1, OF00003, clip 01, clip-local `00:00:08.100`, original-video `00:04:38.100`. | Turn cause/rate unresolved. Corroborated densely by entries 36, 39, 52, 59. |
| 3 | `[DO]` Near-vertical pitch-up ascent followed by level side travel immediately below the surface. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.1, OF00007–OF00008, clip 01, clip-local `00:00:24.100–00:00:28.100`, original-video `00:04:54.100–00:04:58.100`. | Four-second gap prevents transition timing; dense D1 corroborates pitch-up, not this exact surface event. |
| 4 | `[DO]` Open travel uses a behind/above chase view. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.2, OF00017–OF00018, clip 02, clip-local `00:00:28.100–00:00:32.100`, original-video `00:14:00.100–00:14:04.100`. | Camera/character path between samples unknown; broadly corroborated across clips. |
| 5 | `[DO]` Repeated upright/tail-down poses, several with bubbles, persist late in clip 02. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.2, OF00022–OF00027, clip 02, clip-local `00:00:48.100–00:01:05.865`, original-video `00:14:20.100–00:14:37.865`. | Exact stationary duration and bubble meaning unresolved; D8 corroborates low-speed repositioning. |
| 6 | `[DO]` Clip 03 begins with upright/animal-proximity imagery and ends this range with the dolphin far ahead amid a burst. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.2, OF00028–OF00032, clip 03, clip-local `00:00:00.100–00:00:16.100`, original-video `00:14:54.100–00:15:10.100`. | Relative camera lag is plausible but burst and speed cause unresolved. |
| 7 | `[DO]` Steep nose-down descent into a narrow crevice and leveling at depth. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.3, OF00035–OF00037, clip 03, clip-local `00:00:28.100–00:00:33.850`, original-video `00:15:22.100–00:15:27.850`. | Timing/trajectory between four-second samples unresolved; body pitch is direct. |
| 8 | `[DO]` Nose-up/above-rock pose, confined opening, then more distant rear travel demonstrate large framing/context variation. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.4, OF00049–OF00052, clip 04, clip-local `00:00:44.100–00:00:56.100`, original-video `00:16:47.100–00:16:59.100`. | OF00053 excluded; causal camera behavior not measurable. D5 corroborates confinement effects. |
| 9 | `[DO]` Clip 05 shows upright holding, banked curvature near pillars, bubbles, and a high/top-down waterline view. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.4, OF00058–OF00064, clip 05, clip-local `00:00:00.100–00:00:24.100`, original-video `00:18:00.100–00:18:24.100`. | Sequence timing is sparse; effects and launch state unresolved. D6 corroborates a breach from this clip. |
| 10 | `[DO]` Above-water/tail-down presentation is followed by underwater near-surface rear travel. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.5, OF00065–OF00067, clip 05, clip-local `00:00:28.100–00:00:35.852`, original-video `00:18:28.100–00:18:35.852`. | Launch, apex, and re-entry are not bounded by overview; D6 supplies dense corroboration of the preceding breach. |
| 11 | `[DO]` Banked/corridor travel among rocks alternates distant sightlines with close dark-terrain framing. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.5, OF00069–OF00080, clip 06, clip-local `00:00:04.100–00:00:48.100`, original-video `00:18:56.100–00:19:40.100`. | Bubble/effect meaning and exact camera response unresolved. D7 corroborates confined travel. |
| 12 | `[DO]` Strong pitch beside a wall gives way to centered level corridor travel. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.6, OF00081–OF00083, clip 06, clip-local `00:00:52.100–00:01:00.100`, original-video `00:19:44.100–00:19:52.100`. | Sparse timing; no input/turn-rate inference. |
| 13 | `[DO]` Dark cave progression transitions to a widened open-water view. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.7, OF00097–OF00107, clip 07, clip-local `00:00:48.100–00:01:28.100`, original-video `00:21:40.100–00:22:20.100`. | Darkness limits several poses; four-second samples do not measure the exit correction. |
| 14 | `[DO]` Upright low-speed-looking poses recur at a pointed terrain feature with purple/bubble effects. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.8, OF00113–OF00115, clip 07, clip-local `00:01:52.100–00:01:59.853`, original-video `00:22:44.100–00:22:51.853`. | Effect/interaction mechanics unresolved; D8 densely corroborates low-speed movement at the feature. |
| 15 | `[DO]` Clip 08 includes close shark occlusion, an above-water tail-down view, a banked turn, and upright bubble-adjacent poses. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.8, OF00117–OF00125, clip 08, clip-local `00:00:04.100–00:00:33.851`, original-video `00:23:30.100–00:23:59.851`. | Overview-only clip; no attack, collision, or surface-phase timing established. |
| 16 | `[DO]` Clip 09 repeatedly shows curved/banked dolphin poses among a central rock and close shark, with severe occlusion/red imagery. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.9, OF00129–OF00139, clip 09, clip-local `00:00:12.100–00:00:52.100`, original-video `00:24:22.100–00:25:02.100`. | Collision and red/status meaning unresolved. D9 densely corroborates rock/predator occlusion. |
| 17 | `[DO]` Later clip 09 returns to small, centered open-water chase views after the encounter. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.9, OF00141–OF00144, clip 09, clip-local `00:01:00.100–00:01:12.100`, original-video `00:25:10.100–00:25:22.100`. | Recenter timing is not measurable at four-second spacing. |
| 18 | `[DO]` Clip 10 shows level travel, surface turbulence, pitch-up, upright near-surface, and above-water canyon framing. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.11, OF00161–OF00166, clip 10, clip-local `00:00:24.100–00:00:44.100`, original-video `00:26:28.100–00:26:48.100`. | OF00162 obscures the dolphin; breach versus waterline crossing is unresolved. |
| 19 | `[DO]` Clip 10 alternates extreme rock obstruction/effects with distant and recentered open travel. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_01.pdf`, p.13, OF00193–OF00208, clip 10, clip-local `00:02:32.100–00:03:32.100`, original-video `00:28:36.100–00:29:36.100`. | Effects/contacts unresolved; overview timing too sparse for camera-response measurement. |
| 20 | `[DO]` Clip 10 continues through turns, low ceilings/arches, and a pillar field with progressively compressed views. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.1, OF00209–OF00224, clip 10, clip-local `00:03:36.100–00:04:34.857`, original-video `00:29:40.100–00:30:38.857`. | Body turn and camera orbit cannot be separated at this tier. |
| 21 | `[DO]` Clip 11 begins with octopus/encounter framing, dark cave imagery, then open travel and another compressed doorway/cave entry. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.2, OF00225–OF00240, clip 11, clip-local `00:00:00.100–00:01:00.100`, original-video `00:30:39.100–00:31:39.100`. | Encounter/cutscene versus gameplay and effect meanings unresolved. |
| 22 | `[DO]` Curved turns, narrow triangular/arched openings, an extreme close rear view, and cave travel recur. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.4, OF00257–OF00272, clip 11, clip-local `00:02:08.100–00:03:08.100`, original-video `00:32:47.100–00:33:47.100`. | No physical collision is established; dense equivalent absent for clip 11. |
| 23 | `[DO]` Clip 11 shifts from an extreme close corridor view to distant/recentered travel and later shark/bubble scenes. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.5, OF00279–OF00288, clip 11, clip-local `00:03:36.100–00:04:12.100`, original-video `00:34:15.100–00:34:51.100`. | Camera correction duration and predator response unresolved. |
| 24 | `[DO]` Clip 12 opens with ordinary rear travel but repeatedly becomes upright/curved and foreground-occluded by large animals/walls. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.6, OF00296–OF00304, clip 12, clip-local `00:00:00.100–00:00:32.100`, original-video `00:35:30.100–00:36:02.100`. | Animal identity/cause, effects, and collision unresolved. |
| 25 | `[DO]` Banked rock turns and corridor travel lead to an above-water view and underwater return. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.7, OF00305–OF00316, clip 12, clip-local `00:00:36.100–00:01:20.100`, original-video `00:36:06.100–00:36:50.100`. | Waterline-phase timing not bounded; shark proximity does not prove contact. |
| 26 | `[DO]` The presentation leaves chase framing for terrain/creature-focused shots. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.7, OF00317–OF00320, clip 12, clip-local `00:01:24.100–00:01:36.100`, original-video `00:36:54.100–00:37:06.100`. | Cutscene/script identity unresolved; explicitly excluded from ordinary follow-camera rules. |
| 27 | `[DO]` A close curved/rear terrain view transitions to wider centered corridor travel. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.8, OF00329–OF00333, clip 12, clip-local `00:02:12.100–00:02:28.100`, original-video `00:37:42.100–00:37:58.100`. | Four-second gaps prevent correction-duration measurement. |
| 28 | `[DO]` Upright corridor positioning, bubble-trail travel, banked turning, and heavy terrain/large-animal occlusion coexist. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.9, OF00337–OF00352, clip 12, clip-local `00:02:44.100–00:03:44.100`, original-video `00:38:14.100–00:39:14.100`. | Bubble meaning, pitch/camera separation, and collision unresolved. |
| 29 | `[DO]` Steep top-down and severely compressed pillar views lead into dark tunnel/octopus encounter imagery and curved dark poses. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.10, OF00353–OF00368, clip 12, clip-local `00:03:48.100–00:04:48.100`, original-video `00:39:18.100–00:40:18.100`. | Dialogue/nonchase frames excluded; darkness and effects limit motion interpretation. |
| 30 | `[DO]` Late clip 12 is dominated by encounter/dialogue and detached environmental views, providing little ordinary movement evidence. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.11, OF00369–OF00384, clip 12, clip-local `00:04:52.100–00:05:52.100`, original-video `00:40:22.100–00:41:22.100`. | OF00376 is character-level unreadable; page remains inspectable. |
| 31 | `[UNC]` No clearly visible dolphin appears in the final environmental/cinematic cells, so ordinary locomotion and chase-camera behavior are unsupported there. | `TRACK_E_REDUCED_OVERVIEW_ATLAS_02.pdf`, p.12, OF00385–OF00393, clip 12, clip-local `00:05:56.100–00:06:25.852`, original-video `00:41:26.100–00:41:55.852`. | OF00391 overexposed; this is an explicit coverage limitation, not missing page access. |
| 32 | `[DO]` Tail/fluke phase changes accompany already-established forward travel while camera-dolphin separation increases. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, DF00001–DF00010, clip 01, clip-local `00:00:17.500–00:00:19.300`, original-video `00:04:47.500–00:04:49.300`. | 0.20s sampling; onset, speed, acceleration, and complete cycle count unresolved. |
| 33 | `[DO]` Body rotates from near-level toward nose-up across 0.4s of sampled positions. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, DF00011–DF00013, clip 01, clip-local `00:00:19.500–00:00:19.900`, original-video `00:04:49.500–00:04:49.900`. | Phase boundary uncertainty at least ±0.20s; corroborated qualitatively by both breach approaches. |
| 34 | `[DO]` Nose-up ascent continues to the sequence end while the camera becomes surface-dominant. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.1, SEQ_01, DF00014–DF00020, clip 01, clip-local `00:00:20.100–00:00:21.300`, original-video `00:04:50.100–00:04:51.300`. | Ascent completion absent; character/camera pitch contributions overlap. |
| 35 | `[DO]` Nearly upright dolphin remains close to a wall while a shark crosses in front. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, DF00021–DF00026, clip 02, clip-local `00:00:21.000–00:00:22.000`, original-video `00:13:53.000–00:13:54.000`. | Zero speed and predator cause unresolved; 0.20s sampling. |
| 36 | `[BVM]` Curved/banked turn and substantial straightening span about 1.2s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, DF00027–DF00033, clip 02, clip-local `00:00:22.200–00:00:23.400`, original-video `00:13:54.200–00:13:55.400`. | At least ±0.20s; not corroborated under identical speed/context, but D3/D7 support gradual curved turns. |
| 37 | `[INF]` A short level/rear-on interval is consistent with glide, followed by another incomplete curved maneuver among sharks. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.2, SEQ_02, DF00034–DF00040, clip 02, clip-local `00:00:23.600–00:00:24.800`, original-video `00:13:55.600–00:13:56.800`. | Continued propulsion cannot be excluded; second turn continues beyond window. |
| 38 | `[DO]` Established cruise proceeds through a rock corridor with tail-phase changes. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, DF00041–DF00047, clip 03, clip-local `00:00:15.250–00:00:16.450`, original-video `00:15:09.250–00:15:10.450`. | Cruise began before window; bubbles/effects are not propulsion proof. |
| 39 | `[BVM]` Sustained wall turn shows bank/curvature for roughly 1.4s before straightening continues. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, DF00048–DF00055, clip 03, clip-local `00:00:16.650–00:00:18.050`, original-video `00:15:10.650–00:15:12.050`. | Full turn/straighten about 2.0–2.2s with at least ±0.20s; qualitatively corroborated by D2/D7. |
| 40 | `[DO]` Camera and dolphin progressively recenter to rear alignment, then a new slight bank starts. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.3, SEQ_03, DF00056–DF00060, clip 03, clip-local `00:00:18.250–00:00:19.050`, original-video `00:15:12.250–00:15:13.050`. | Character and camera contributions inseparable; new maneuver incomplete. |
| 41 | `[DO]` Sustained nose-up approach remains immediately below the surface. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00061–DF00069, clip 03, clip-local `00:00:23.500–00:00:25.100`, original-video `00:15:17.500–00:15:19.100`. | Approach began before window; launch input/force unseen. D6 corroborates. |
| 42 | `[BVM]` Waterline exit lies in the 0.20s interval between last clear underwater and first clear above-water frames. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00070–DF00071, clip 03, clip-local `00:00:25.300–00:00:25.500`, original-video `00:15:19.300–00:15:19.500`. | At least ±0.20s; independently corroborated by entry 49 in D6. |
| 43 | `[BVM]` First clear air frame to splash is about 1.2s; arc remains mostly tail-down. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00071–DF00077, clip 03, clip-local `00:00:25.500–00:00:26.700`, original-video `00:15:19.500–00:15:20.700`. | At least ±0.20s; D6 corroborates an arc but shows a different 2.0s visible duration. |
| 44 | `[BVM]` Underwater turbulence follows splash, then a readable moving dolphin returns within roughly 0.4–0.6s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.4, SEQ_04, DF00077–DF00080, clip 03, clip-local `00:00:26.700–00:00:27.300`, original-video `00:15:20.700–00:15:21.300`. | At least ±0.20s; not corroborated because D6 ends on splash. |
| 45 | `[DO]` Closely spaced pillars fully or nearly hide the dolphin for the first 0.8s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, DF00081–DF00085, clip 04, clip-local `00:01:00.500–00:01:01.300`, original-video `00:17:03.500–00:17:04.300`. | Hidden path/speed unresolved; D9 corroborates prolonged terrain obstruction. |
| 46 | `[DO]` Dolphin emerges between pillars, turns away, then remains small/distant or vegetation-screened. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, DF00086–DF00095, clip 04, clip-local `00:01:01.500–00:01:03.300`, original-video `00:17:04.500–00:17:06.300`. | Apparent distance mixes dolphin motion, obstruction, and camera lag. |
| 47 | `[BVM]` Late return toward the right rock ends in a much closer curved/side pose; strongest correction occurs over roughly 0.4s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_01.pdf`, p.5, SEQ_05, DF00098–DF00100, clip 04, clip-local `00:01:03.900–00:01:04.300`, original-video `00:17:06.900–00:17:07.300`. | Correction phase roughly +3.40s–+3.80s, at least ±0.20s; D7/D8 corroborate gradual correction qualitatively, not this duration; no camera parameter inferred. |
| 48 | `[DO]` Second sustained nose-up approach advances along a rock wall to the waterline. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, DF00101–DF00109, clip 05, clip-local `00:00:25.700–00:00:27.300`, original-video `00:18:25.700–00:18:27.300`. | Approach onset before window; D4 corroborates the visible phase. |
| 49 | `[BVM]` Second waterline exit lies between +1.60s and +1.80s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, DF00109–DF00110, clip 05, clip-local `00:00:27.300–00:00:27.500`, original-video `00:18:27.300–00:18:27.500`. | At least ±0.20s; corroborates entry 42. |
| 50 | `[BVM]` First clear air frame to splash is about 2.0s, with progressive pitch-down descent. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.1, SEQ_06, DF00110–DF00120, clip 05, clip-local `00:00:27.500–00:00:29.500`, original-video `00:18:27.500–00:18:29.500`. | At least ±0.20s; duration differs from D4; window ends before recovery. |
| 51 | `[DO]` Continuous travel weaves left then toward center through a rock corridor. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, DF00121–DF00127, clip 06, clip-local `00:00:41.000–00:00:42.200`, original-video `00:19:33.000–00:19:34.200`. | Camera and steering contributions overlap; tail cycles not reliably countable. |
| 52 | `[DO]` Stronger rightward bend around a rock is followed by leftward correction; body repeatedly banks/curves. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, DF00128–DF00135, clip 06, clip-local `00:00:42.400–00:00:43.800`, original-video `00:19:34.400–00:19:35.800`. | Exact turn rate/radius and clearance unavailable; no collision visible. |
| 53 | `[BVM]` Corridor composition and rear alignment settle over roughly +2.40s–+3.80s, about 1.4s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.2, SEQ_07, DF00133–DF00140, clip 06, clip-local `00:00:43.400–00:00:44.800`, original-video `00:19:35.400–00:19:36.800`. | At least ±0.20s; dolphin also straightens, so not an independent camera constant. D8 corroborates gradual settling. |
| 54 | `[DO]` Foreground rock clears gradually while the dolphin approaches the pointed feature. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, DF00141–DF00148, clip 07, clip-local `00:01:40.400–00:01:41.800`, original-video `00:22:32.400–00:22:33.800`. | Approach began before window; deceleration onset unbounded. |
| 55 | `[BVM]` Arrival into the low-speed regime is bounded to roughly +1.80s–+2.20s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, DF00150–DF00152, clip 07, clip-local `00:01:42.200–00:01:42.600`, original-video `00:22:34.200–00:22:34.600`. | At least ±0.20s; exact zero velocity not shown; no equally clear dense corroboration. |
| 56 | `[DO]` Dolphin remains at the feature but alternates rear/side poses and bubbles, indicating local repositioning rather than a frozen stop. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.3, SEQ_08, DF00152–DF00160, clip 07, clip-local `00:01:42.600–00:01:44.200`, original-video `00:22:34.600–00:22:36.200`. | Bubble/interaction meaning unresolved; input state invisible. |
| 57 | `[DO]` Dolphin advances extremely close to a pointed rock with alternating rear and curved poses. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, DF00161–DF00168, clip 09, clip-local `00:00:47.000–00:00:48.400`, original-video `00:24:57.000–00:24:58.400`. | Maneuver onset/path and exact clearance unresolved. |
| 58 | `[BVM]` Severe rock obstruction persists through +2.40s; readable third-person view returns by +2.60s. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, DF00170–DF00174, clip 09, clip-local `00:00:48.800–00:00:49.600`, original-video `00:24:58.800–00:24:59.600`. | At least ±0.20s; world path hidden; D5 qualitatively corroborates terrain occlusion. |
| 59 | `[DO]` Strong curved/banked emergence continues into shark proximity, bubbles, and a red alert-like rendering. | `TRACK_E_REDUCED_DENSE_SEQUENCES_02.pdf`, p.4, SEQ_09, DF00174–DF00180, clip 09, clip-local `00:00:49.600–00:00:50.800`, original-video `00:24:59.600–00:25:00.800`. | Predator cause, damage/alert meaning, collision, and input unresolved. |

## 19. Completion and integrity statement

All 34 rasterized PDF pages were directly visually inspected: 13 pages from Overview Atlas 01, 12 from Overview Atlas 02, five from Dense Sequences 01, and four from Dense Sequences 02. The inspection ledger contains exactly 34 continuous numbered records, 01–34, and every page is marked `COMPLETE`. No page remained unreadable. Character-level or event-level ambiguities are explicitly retained rather than converted into page failures.

All 12 source clips were considered through the overview atlases. All nine dense sequences were inspected chronologically and analyzed. All 36 requested categories were considered, including explicit insufficient-evidence dispositions. The strongest-evidence table contains 59 continuously numbered entries and represents all four PDFs, all nine dense sequences, and all 12 clips.

The source PDFs were not edited, renamed, moved, recompressed, replaced, or deleted. Their pre-inspection and post-report SHA-256 hashes match the four expected values listed in §2. The original MP4 files were not inspected. The only unavoidable evidence limitation is the reduced sampling itself: approximately four-second overview spacing and 0.20-second dense spacing, with selective dense coverage and no visible controller input, world transforms, or hidden engine state.
