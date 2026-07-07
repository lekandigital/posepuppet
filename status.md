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
