# Track E Research Prompt — Ecco Movement, Camera, and Play-Feel

**Project:** BodyArcade Shared-World, Stage-2 research, Track E of five (A–E).
**Session type:** Multimodal deep research. The 12 selected PS2 gameplay clips are attached and are your **primary evidence**; the Track A repository-audit report is attached as the record of the existing BodyArcade simulation you must compare against.
**You are a researcher, not an implementer.** You produce a movement-and-camera specification with target values and retuning recommendations — no code.

**Authority note:** the master context V3 body describes four tracks (A–D). Track E is established by `NEW_DECISIONS_TO_MERGE.md`, which governs where they differ. This fifth track exists because gameplay fidelity was elevated to co-equal status with visual fidelity.

---

## 1. Mission

Answer one question with measurements and mechanism, not adjectives: **why is ordinary movement in the PS2 release of *Ecco the Dolphin: Defender of the Future* unusually pleasurable — and what exact behaviors must BodyArcade's Dolphin mode reproduce to match it?**

The binding decision (quote from the governing decision record):

> The goal is not only to reproduce the visual identity of Ecco the Dolphin: Defender of the Future. Dolphin mode should also reproduce, as closely as practical, why ordinary movement in that game is unusually pleasurable. […] The acceptance test is not merely that Dolphin mode functions. Ordinary swimming without missions or objectives should remain enjoyable for an extended period, in the way ordinary movement in Ecco is enjoyable.

You must study, from footage and documented sources: **propulsion, glide, turning, banking, animation, camera, breach, airborne motion, and re-entry** — then compare against BodyArcade's existing simulation (per the Track A report) and recommend, behavior by behavior, keep / retune / replace.

## 2. Governing context (embedded digest — the attached documents govern in full)

- **What must be preserved regardless of your findings:** the existing BodyArcade simulation *architecture* — pure fixed-timestep 120 Hz sim, deterministic byte-identical replays, the single feel-constant table, body-input integration with keyboard priority, the assist ladder, autopilot on tracking loss, soft-repulsion containment, and the working test suite. Your recommendations change **constants and behaviors**, not this architecture.
- **What must not be treated as final:** the current feel constants and camera tuning. Compare them against Ecco and recommend retuning or replacing individual behaviors wherever Ecco is more enjoyable.
- The existing sim's model (from the repo's own records): impulse-and-glide propulsion — each detected body kick banks a surge with ~0.3 s attack; drag proportional to speed so every cadence settles at its own cruise; stillness is a long glide; sprint + hard pitch-up near the surface triggers breach (ballistic leap, camera follows, splash on re-entry).
- Scale context for your numbers: region ≈ 2 km × 2 km, max depth ≈ 80 m, sea level = y 0, units meters; dolphin cruise ≈ 5 m/s, burst ≈ 9 m/s (defaults to validate against footage-derived speeds).
- Body-driven control is primary in production (chest/hip anti-phase wave = kick; lean = dive/surface; shoulder tilt = banked carve; both-hands-forward = burst) with keyboard always working in parallel — your spec must therefore describe *behaviors of the dolphin*, independent of input device.
- **Sonar and the wider Ecco content program are out of scope** — movement, camera, and feel only. Design archaeology (story, levels, powers) is finished work; cite it, do not redo it.
- The first build is pure exploration; ordinary swimming **is** the product. That is why this track exists.

## 3. Required attachments and sources

| Item | Role |
|---|---|
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | Governing decision record (§4.3 documents the existing sim; §11.2 the preserved feel). |
| `01_NEW_DECISIONS_TO_MERGE.md` | **Establishes this track**; the gameplay-fidelity mandate and the behavior list. |
| `02_COMPLETE_ECCO_DESIGN_RECONSTRUCTION.docx` | Long-form design reconstruction (archive; movement/camera claims to verify against footage). |
| `03_ECCO_DESIGN_ARCHAEOLOGY_A.md` … `06_ECCO_DESIGN_ARCHAEOLOGY_D.md` | Prior design-archaeology reports (archive; cite for mechanics claims, verify against footage). |
| `07_ATTACH_VIDEO_FILES.md` | Clip attachment instructions and the movement-analysis focus list. |
| `90_REFERENCE_MEDIA/ps2-ecco/VIDEO_INDEX.md` | Clip index. |
| **All 12 selected MP4 clips** from `90_REFERENCE_MEDIA/ps2-ecco/selected/` | Primary evidence: `01_04m30s-05m02s.mp4` … `12_35m30s-41m56s.mp4` — ~25 min 13 s of PS2 gameplay (PCSX2 v1.7.0 capture, 1920×1080, ~59.94 fps), timecoded into the ~42-minute xTimelessGaming source video. |
| `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | The existing sim's feel-constant table and camera states — your comparison baseline. If Track A has not run yet, use the master context §4.3 digest as the baseline and flag every comparison as pending-Track-A. |
| Supplementary web sources | Manuals, interviews, technical retrospectives, frame-data analyses of DOTF movement — cited and quality-flagged; Dreamcast footage secondary (mechanics reference only where PS2 footage is silent, flagged as such). |

## 4. Measurement methodology (required)

- The clips run at ~59.94 fps: measure durations by frame counting and state them in seconds (±1 frame ≈ ±0.017 s).
- Absolute world units are unknowable from footage: use **dolphin body lengths (BL)** as the distance unit, stating the conversion assumption (adult bottlenose ≈ 2 m ≈ 1 BL) whenever you convert to meters.
- Speeds in BL/s (and converted m/s); turn rates in deg/s estimated from heading change across counted frames; camera distances in BL.
- Every measurement cites clip filename + timestamp. Repeat key measurements across at least two separate clip moments where footage allows; report the spread.
- Distinguish three evidence grades: **measured** (frame-counted from cited footage), **documented** (from a cited source — manual, archive report, interview), **inferred** (your mechanism hypothesis explaining the observations — clearly labeled).

## 5. Questions that must be answered

**Propulsion and speed:**

1. What is the speed model? Ordinary forward swimming without input beyond direction: cruise speed (BL/s), animation cadence. The tap-to-accelerate "gear" system: how many discernible speed tiers, how much each tap adds, how speed decays between taps.
2. Acceleration character: attack time from stationary to cruise, cruise to sprint; is the surge impulse-like (matching BodyArcade's impulse-and-glide) or continuous?
3. Coasting and glide: after input stops, how long does the glide last from each speed tier; what does the deceleration curve look like (linear, exponential); at what residual speed does the dolphin settle or stop?

**Orientation and turning:**

4. Turn radius and turn rate at slow, cruise, and sprint speeds (deg/s, radius in BL); does turning scrub speed, and by how much?
5. Pitch, yaw, roll, and banking: how does the dolphin tilt into turns; is roll player-controlled or automatic; how does pitch behave during ascent/descent; are there orientation limits (can it swim inverted, loop)?
6. Velocity vs facing: does the dolphin always move where it faces, or does momentum carry it along the old vector during direction changes (and for how long)? This "velocity-following" behavior is central to the feel — characterize it precisely.
7. Braking and rapid reversal: what happens on hard brake / instant 180 — duration, animation, residual drift?

**Animation coupling:**

8. How does tail/body animation frequency correlate with velocity? Are idle, cruise, and sprint distinct animation states or one state at varying rate? What are the transition behaviors (blend times, interruption rules)?
9. Which animation moments sell the feel (the kick pulse, the glide stillness, the bank into a turn) — described concretely enough to map onto the GAMICO dolphin's clip set (cross-reference Track C's animation inventory; flag gaps it must cover).

**Camera:**

10. Default follow distance (BL), height offset, and FOV estimate; how do they change with speed?
11. Camera lag and correction: the delay between dolphin movement and camera response; does correction snap, smoothly interpolate, or behave spring-damper-like? Estimate time constants from footage.
12. Camera behavior in confined spaces (caves, narrow passages, near walls): pull-in, collision handling, orientation help — and what the player experiences during tight maneuvering.
13. Camera behavior across the waterline: surface approach, breach crossing, re-entry recovery — framing, cuts vs continuous moves, how disorientation is avoided.

**Surface, breach, air, re-entry:**

14. Surface approach: does the dolphin auto-align near the surface, resist penetration, or transition smoothly? What does swimming along the surface look like (porpoising)?
15. Breach launch mechanics: apparent speed threshold, exit angle range, launch speed (BL/s), animation transition, splash character.
16. Airborne behavior: does the player retain control in the air; what does the gravity arc look like (estimate apparent gravity in BL/s² from frame-counted arcs — compare against 9.8 m/s² using the BL conversion); airborne animation states (and any player-triggered flips)?
17. Re-entry: entry-angle effects, speed retention through the surface, splash, camera recovery; does a clean entry feel/behave differently from a flat one?

**Terrain proximity and confined spaces:**

18. Swimming near terrain and through confined spaces: collision behavior (slide vs stop), speed changes, control changes; how the game avoids wall-grinding frustration.

**Synthesis:**

19. **Why is it pleasurable?** Distill the mechanisms into ranked design principles, each tied to your measurements (e.g., momentum conservation, glide economy, animation-velocity honesty, camera trust, input rhythm). Anti-principles too: what the game avoids (instant stops, facing-locked velocity, camera snaps…).
20. **The comparison:** behavior-by-behavior table — Ecco's measured/documented behavior vs BodyArcade's current behavior (from Track A's feel-constant table and camera states) — verdict per row: **keep** (already matches) / **retune** (same mechanism, new constants — give target values) / **replace** (different mechanism needed — describe it, respecting the preserved architecture).
21. **Acceptance-test definition:** turn "ordinary swimming stays enjoyable for an extended period" into observable criteria a checkpoint review can apply (e.g., glide-per-kick distances in range, turn without speed collapse, breach achievable from ordinary play within N seconds of intent, camera never requires manual correction during a 5-minute free swim).

## 6. Required tables and deliverables

1. **Movement parameter table** — every measured/documented quantity: speeds per tier, accelerations, glide durations and curves, turn rates/radii per speed, speed-scrub factors, braking times, breach threshold/angle/launch speed, apparent gravity, re-entry retention — with units, evidence grade, and clip citations.
2. **Velocity-following / momentum model description** — mechanism hypothesis with supporting frames.
3. **Animation-state map** — states, cadence-to-velocity mapping, transitions; mapping onto the GAMICO clip set with gaps flagged for Track C.
4. **Camera specification** — distances, offsets, FOV, lag time constants, correction behavior, confined-space behavior, waterline crossing — with evidence grades.
5. **Breach/airborne/re-entry sequence spec** — a timeline of one canonical breach (frame-counted phases).
6. **"Why it feels good" principles** — ranked, measurement-backed, with anti-principles.
7. **Ecco vs BodyArcade comparison table** — the keep/retune/replace verdicts with target values for every retune.
8. **Acceptance-test criteria list** for the Stage-3 checkpoints.
9. **Answered / Open / Needs-user** section (e.g., behaviors the 12 clips never show, and whether the user should capture specific extra footage).

## 7. Uncertainty and citation rules

- Every quantitative claim carries its evidence grade (measured / documented / inferred) and citation (clip + timestamp, or source URL/document + section). Never present an inferred mechanism as a measurement.
- The 12 clips are a PCSX2 1080p capture — timing is trustworthy at ~59.94 fps; note any clip moments where emulation artifacts (slowdown, frame pacing) could distort a measurement.
- PS2 footage is primary. Dreamcast movement evidence is secondary and must be flagged (the ports differ in framerate stability, which affects feel).
- Do not re-open settled decisions: the sim architecture, deterministic replay, body-input integration, assist ladder, and keyboard-parallel policy are preserved; sonar and the content program are out of scope; the GAMICO dolphin is the character.
- Do not re-do design archaeology; cite the attached archive reports and verify their movement claims against footage where they matter.
- Where footage cannot answer a question, say so explicitly and propose how the user could capture the missing evidence (which maneuver, where in the game).

## 8. Output

- **Exact output filename:** `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md`
- **Destination:** `80_OUTPUTS/research-reports/` in the bodyarcade-stage2-bundles bundle.
- Markdown with tables; executive summary first (leading with the ranked "why it feels good" principles); Answered / Open / Needs-user last.

## 9. Completion criteria

- [ ] Every question in §5 is answered with evidence-graded values and clip citations, or explicitly marked unanswerable-from-footage with a capture proposal.
- [ ] All nine deliverables in §6 are present.
- [ ] The comparison table covers every behavior in the mandate list (propulsion, glide, turning, banking, pitch/yaw/roll, velocity-following, braking, camera, confined spaces, surface approach, breach, airborne, re-entry, animation-velocity coupling) with a keep/retune/replace verdict and target values for retunes.
- [ ] The acceptance test is expressed as observable criteria usable at checkpoint reviews.
- [ ] The preserved architecture is never contradicted — no recommendation requires abandoning the 120 Hz deterministic sim, replay, body-input, or assists.
- [ ] Animation gaps are cross-referenced for Track C.
- [ ] The report is written to `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md`.
