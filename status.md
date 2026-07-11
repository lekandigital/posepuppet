## 2026-07-07 (GATE 2 APPROVED — Predictive Pose Continuity accepted)
Gate: focused live retest passed all five items — slow hand exit predicted and returned smoothly; head stable through face crossings; behind-torso punch no longer whips or collapses; full dropout settles upright with no bend/spin; re-entries clean. Lekan: "the result now feels acceptable for Predictive Pose Continuity — I approve USER GATE 2"
WebM observation resolved: hands-free take gesture (both wrists overhead ~1 s) started a take; finished takes auto-download locally by design (pass-2 feature, not a PPC bug; nothing leaves the machine)
Final suites: re-run for the acceptance commit (results in the commit message)
Blockers: none — awaiting Lekan's merge decision (not merged/pushed per instruction)
Next: Lekan merges predictive-pose-continuity-fable when ready; then the combined Rowing → Dolphin → world-data → Walking World pass on a fresh branch

## 2026-07-07 (PPC Gate-2 fixes — rigid core + physics gate; GATE 2 RETEST RAISED)
Live failures root-caused on real footage: confident-visibility teleports/collapses behind the torso (state machine never fired), per-landmark core prediction shearing the torso quad into bend/spin
Fixed: rigid torso/head prediction, chain-length physics gate (impossible segment = garbage: held, low conf, never buffered), fresh-run velocity capture, no-snap capped catch-up with converged-only confidence
6 new regression specs cover his exact list; masked matrix + fully-visible refresh re-published (fast legs improved 1.4°, everything else within tolerance); flight contract +67 ms unchanged
Suites: PosePuppet 92 passed / 5 skipped; Flight in the commit message
Blockers: USER GATE 2 focused retest (5 items, docs/PPC_GATE2.md updated)
Next: Lekan's retest

## 2026-07-07 (PPC P4 — body-input flags, flight contract, docs — GATE 2 RAISED)
body-input `tracking` block (additive, optional, closed sub-shape, canonical order; old tapes valid); states flow PosePuppet → signal → games
Flight contract measured then test-enforced: autopilot engagement legacy 300 ms vs PPC 367 ms (+67 ms, bound +100); core horizon retuned 250→150 ms at MY layer, zero Flight changes; Flight suite 17 passed / 2 skipped unmodified
Final matrix re-published post-retune (facetouch −27%, arms −5.9%, reversals parity by design); README/CHANGELOG/docs/PPC.md name it Predictive Pose Continuity and state limits plainly
Suites: PosePuppet 86 passed / 5 skipped; Flight 17 passed / 2 skipped
Blockers: USER GATE 2 — live occlusion test (script: docs/PPC_GATE2.md)
Next: Lekan's live test; fix what he reports

## 2026-07-07 (PPC P3 — masked-fixture eval, legacy vs PPC published)
Mask harness (4 specs over real fixtures, loop-repeating, same-frame truth) + run-ppc.mjs → eval/ppc-results.json
End-to-end masked puppet sync: PPC ≤ legacy on all 4 fixtures; landmark posErr −19%/−6.5% where prediction informs, parity-in-noise on reversal footage (convergence-to-hold is the measured design goal there)
Guarantees: re-entry ≤ 0.06 m/frame, horizon ≤ 400 ms, 0 NaN; fully-visible deltas ≤ 0.09° upper (tol ±1.0°), floors intact; suite 83/5skip
Calibration journey logged in DECISIONS (velocity-trust stack, entry-pull, leg visTrust 0.25); docs/PPC.md written
Blockers: none
Next: P4 — body-input tracking flags (additive), flight autopilot-timing contract measurement, README note

## 2026-07-07 (PPC P2 — wired live, engineering chips)
PPC live at the main.ts fork (all five consumers inherit); ?ppc=0 / panel toggle for legacy A/B; per-limb state chips in engineering view; resets on mirror/file/camera switches
Honesty: overlay draws raw detection only; synthesized frames never count as detections in eval
Suite 82 passed / 5 skipped; same-conditions A/B (arms, 30s headed): upper Δ 0.02°, legs Δ 0.74° (within ±1.0°)
Blockers: none
Next: P3 — mask harness (eval/masks/*.json, ?mask=), legacy-vs-PPC metrics into a dedicated results file

## 2026-07-07 (PPC P1 — continuity core, GATE 1 APPROVED)
Gate 1 approved in-session (architecture, metrics, thresholds, plan — proceed)
src/pose/continuity.ts: ring buffers + regression velocity + 6 per-limb state machines + constraints + confidence decay + converging no-snap re-entry, all Gate-1 constants in one table
9 new node specs green; full suite 82 passed / 5 skipped (73 baseline intact)
Blockers: none
Next: P2 — wire into the main.ts fork behind ?ppc flag, engineering-view state chips, reset paths

## 2026-07-07 (PPC P0 — audit + plan, GATE 1 RAISED)
Predictive Pose Continuity P0 complete on `predictive-pose-continuity-fable`: occlusion path audited (no landmark-level continuity today; bone-space coast/relax in retarget.ts, body-input decays confidence separately, Flight autopilot contract at 0.35/350ms is consumed not touched)
Baselines confirmed as regression gates: PosePuppet 73 passed / 5 skipped; Flight 16+1 flake first run (superman-arms, passed isolated — the documented contention flake), clean full rerun 17 passed / 2 skipped
PLAN.md rewritten for PPC: insertion at the main.ts fork (both consumers inherit), VISIBLE→PREDICTED→RELAXED machine, all six numeric thresholds proposed, legacy-vs-PPC side-by-side, same-frame-truth mask harness design
Blockers: USER GATE 1 — plan + threshold approval before P1
Next: on approval, P1 buffers + state machine + constraints

## 2026-07-07 (GATE 3 APPROVED — BodyArcade Flight ACCEPTED COMPLETE)
Gate: focused retest passed on the restored Gate-2 baseline — banking/arm-drop/neutral/seated/autopilot/recenter all confirmed; head-pilot gentle climb + recenter visibility kept as approved improvements; Superman default standing, Head Pilot seated
All acceptance items closed: private permission retained (gitignored); in-app+README attribution; ASSETS manifest complete; offline single-player w/ byte-identical keyboard; body flight w/ 3 live-switchable profiles + tuner; shaping/autopilot/recenter/assist w/ measured dead zones; closed-loop evals green; replay 2.6e-6 world units documented; perf 111fps + pose 30Hz (2x target); both suites green; docs current (README/ARCHITECTURE/ASSETS/FUTURES/DEMO notes)
Final suites: re-running for the acceptance commit (results in the commit message)
Blockers: none — awaiting Lekan's merge decision (not merged/pushed per instruction)
Next: Lekan merges bodyarcade-flight-fable when ready; provenance one-liner to Danny before the repo goes public

## 2026-07-07 (Rowing P0 — plan raised)
BodyArcade Rowing P0 on `bodyarcade-rowing-fable` (renamed unused water-worlds placeholder at main 940d31c; Flight + PPC preserved, merged in main): boat/water seams studied — TinySkies boat is a complete tuned vehicle, body input already steers it, propulsion is the missing path
Gate-1 recommendations in PLAN.md: adapt the boat (not build), rowing inside apps/flight (no apps/rowing), stroke detection producer-side in body-input as schema-v1-additive `stroke` block; deviations logged (no rivers on globe → Waterway seam + open-water course; keyboard fallback = upstream boat keys)
Rowing fixtures missing — exact recording specs in PLAN.md (rowing_slow 12 strokes, rowing_fast 24, rowing_left_bias 15, rowing_seated 15, still reused)
Baselines: PosePuppet suite 92 passed / 5 skipped; Flight suite result in the Gate-1 commit message
Blockers: USER GATE 1 — build-vs-adapt + plan approval + fixture recording
Next: on approval + fixtures, P1 stroke detection in the package

## 2026-07-09 (Rowing P1 — stroke detection green)
StrokeDetector in @bodyarcade/body-input: fore-aft wrist oscillation, position-Schmitt reversals, catch/drive/recovery; always-emitted additive `stroke` block (v1): active/count/rate/phase/ampL/ampR, user-side arms (mirrored-slot swap caught by the left-bias fixture)
Fixture eval ALL GREEN, all 10 fixtures: slow 12/12, fast 24/24, left_bias 16/15 + bias sign +0.127, seated 13/13 measured, still 0 strokes; rate ordering fast 0.846 Hz > slow 0.404 Hz; latency p50 ~12 ms
Harness fix, not detector: clips start/end mid-motion so the y4m loop seam ate/faked strokes — rowing eval now runs one non-looped ?video= pass
Flag for Gate 2: rowing_seated prescribed 15, measured 13 (real 2.5 s mid-take pause + mid-stroke start, wrist trace + frame review agree) — confirm the label; seated flag itself reads 0% (thighs cropped), stroke detection unaffected
Blockers: none — P2 (boat impulse-glide) next
Next: RowingControls in apps/flight, boat impulse hook, both steering profiles, assists/cruise/autopilot, ?row entry, tuner stroke row

## 2026-07-09 (Rowing P2 — boat feel built, Gate 2 pending)
Impulse-and-glide shipped: strokes bank a surge budget (attack ~0.3 s — the boat visibly lunges per pull), water drag proportional to speed (τ≈5.5 s; each cadence settles at its own speed, stillness = exponential drift), keyboard boat feel byte-identical
RowingControls (standalone; flight controller untouched): stroke→impulse, two steering profiles as data (row-lean, row-asym — pick at Gate 2), assist ladder (Full Assist = soft Waterway course-follow), cruise after 6 steady strokes (rest holds momentum), autopilot on loss (drift straight + slow, slew-bounded re-entry), keyboard priority
Waterway seam: procedural open-water course from spawn (polyline of ocean waypoints steered around coasts); interface ready for real waterway data later
Entry: ?row starts straight on the water; PosePuppet Row card + ⌘K "row"; tuner gained a rowing section (profiles/assist/stroke readout)
row.spec.ts 7/7 green: surge+glide, cruise, both steering signs, autopilot no-snap recovery, keyboard wins, rowing_slow.y4m fixture relay closed loop, 2-min Full-Assist run — on-water 100%, in-band 100%, speed↔rate r=0.798 (settled samples; eval/flight-results.json)
Blockers: USER GATE 2 — live row (both profiles, seated, 2-minute run; judge rhythm/connection/fatigue); also confirm rowing_seated label (13 measured vs 15 prescribed)
Next: Gate-2 feedback → iterate feel; then P3 polish (coach messages, README, FUTURES seam notes)

## 2026-07-11 (Dolphin P0 — plan raised)
BodyArcade Dolphin P0 on `bodyarcade-dolphin-fable` in the dedicated `~/Dev/posepuppet-dolphin` checkout (Rowing continues in parallel in `~/Dev/posepuppet`, untouched): seams studied — StrokeDetector was built for the dolphin kick (its header says so), schema has the proven additive-block mechanism, existing axes cover pitch/roll/depth/burst/recenter, same-origin static-plugin topology generalizes to `/dolphin/`
Gate-1 recommendations in PLAN.md: standalone `apps/dolphin` (deviation from FUTURES.md fourth-vehicle sketch, logged), `packages/world-data` offline boundary module; two OSM-verified candidates — Bay of Kotor rel 10171079 (recommended) vs San Francisco Bay rel 9451753, both ODbL with in-app attribution
Dolphin fixtures missing — exact recording specs in PLAN.md (torso_wave_slow 12 waves, torso_wave_fast 24, dive_surface_leans 6/6, roll_turns 6/6, seated_swim 12+leans, breach_attempts 3; flight fixtures reused for still/T-pose/crouch/leans)
Baseline: ENVIRONMENT_BLOCKED at P0 (fresh checkout, no private fixtures; npm ci + tsc --noEmit green instead); full suites re-baselined at P1 entry after fixture sync
Blockers: USER GATE 1 — water-shape pick + plan approval + fixture recording
Next: on approval + fixtures, P1 boundary module (fetch → simplify → boundary.json + minimap + attribution)

## 2026-07-11 (Dolphin P1 — boundary module green)
Gate 1 resolved: Lekan picked San Francisco Bay (preserve outline, Golden Gate opening, major islands, channels) and approved the plan, P1-only scope
`packages/world-data` shipped: offline fetch → assemble → simplify → project → `data/boundaries/san-francisco-bay.json` (provenance + ODbL attribution inside; `loadBoundary` refuses artifacts without it); runtime surface `pointInWater`/`signedDistanceToShore` for the containment current and SDF depth
Key build finding: OSM's curated bay relation excludes Golden Gate + Raccoon Strait (probes failed on raw) — built `coastline-clip` mode (coastline ways ∩ convex region with two named gates) which restores every channel and island; relation mode kept for enclosed shapes like Kotor
Numbers (eval/worlddata-results.json, 31 checks ALL GREEN): 20,908 → 1,583 verts (outer 1,211, 21 islands), area delta −0.0394 %, channels Golden Gate 489 m / Raccoon 388 m / Oakland estuary 237 m at keep-ratio ≈ 1.0, byte-identical rebuilds; minimap vision check unmistakably SF Bay (raw ≈ simplified at 1024 px)
Blockers: none for P1; fixtures (specs in PLAN.md) still pending for P2
Next: on go-ahead — P2 graybox swim (torso-wave detector, apps/dolphin scaffold, containment current, assists) toward live Gate 2
