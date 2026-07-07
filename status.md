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
