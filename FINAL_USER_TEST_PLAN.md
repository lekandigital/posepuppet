# Final User Test Plan — BodyArcade

Shared acceptance checklist for all BodyArcade modes. Each section is
completed during its mode's final gate. Modes are independent — a mode
can reach acceptance without waiting for others.

---

## Pre-Flight (before any gate session)

- [ ] PosePuppet suite green (baseline: 92 passed / 5 skipped)
- [ ] Flight suite green (baseline: 17 passed / 2 skipped)
- [ ] Mode-specific suite green (see per-mode section)
- [ ] Clean working tree, correct branch checked out
- [ ] Dev server starts with one command (`npm run dev`)
- [ ] Fixtures directory has all required recordings

---

## Mode: Flight ✅ ACCEPTED (Gate 3 approved)

**Status**: Complete. All items closed. Preserved here as reference.

- [x] Permission quoted in LICENSE_NOTES.md
- [x] In-app + README attribution
- [x] ASSETS.md manifest complete
- [x] Offline single-player, keyboard identical to upstream
- [x] Body flies the plane via body-input
- [x] ≥ 2 standing profiles + seated profile, switchable live
- [x] Tuner overlay works
- [x] Shaping stack, autopilot-on-loss, T-pose recenter, assist ladder
- [x] Dead zones derived from measured jitter
- [x] Closed-loop fixture evals green
- [x] Replay tolerance documented (2.6e-6 world units)
- [x] Live gate: default profile chosen, feel signed off
- [x] 60/45 fps with pose ≥ 15 fps (actual: 111 fps + 30 Hz)
- [x] Docs: README, ARCHITECTURE, LICENSE_NOTES, ASSETS, FUTURES, DEMO

---

## Mode: Rowing (Gate 2 pending → Gate 3)

### Gate 2 — Live Rowing Session
- [ ] Both steering profiles tested (row-lean, row-asym)
- [ ] Seated rowing tested
- [ ] 2-minute continuous run completed
- [ ] Rhythm/connection/fatigue assessed
- [ ] rowing_seated label confirmed (13 measured vs 15 prescribed)
- [ ] Default profile chosen
- [ ] Feel signed off or iteration items listed

### Gate 2 → Gate 3 Iteration
- [ ] All Gate 2 feedback items resolved
- [ ] Coach messages implemented (if approved)
- [ ] Obstacle-avoidance product decision made (FUTURES.md reminder)

### Gate 3 — Final Rowing Acceptance
- [ ] Keyboard boat controls identical to upstream
- [ ] Body rows the boat via body-input stroke detection
- [ ] ≥ 2 steering profiles, switchable live
- [ ] Assist ladder (Full/Standard/Expert) works
- [ ] Cruise engages after steady strokes, disengages cleanly
- [ ] Autopilot on tracking loss: drift straight, slow, slew re-entry
- [ ] Waterway/course system functional
- [ ] row.spec.ts green (baseline: 7/7)
- [ ] Fixture eval: all rowing fixtures green
- [ ] Closed-loop eval: speed↔rate correlation documented
- [ ] Live gate completed: final feel sign-off
- [ ] Perf target met (60/45 fps render, pose ≥ 15 fps)
- [ ] Docs updated: README, EVAL_NOTES, status.md

---

## Mode: Dolphin (not started)

### Gate 1 — Plan Approval
- [ ] Dolphin seams studied (vehicle capabilities, matrix builder)
- [ ] PLAN.md written with dive/breach mechanics
- [ ] Dolphin fixtures specified (recording specs)
- [ ] User approves plan

### Gate 2 — Live Dolphin Session
- [ ] Dolphin vehicle renders and moves
- [ ] Dive/breach mechanics work (elevate axis → depth)
- [ ] Underwater camera + surface transition
- [ ] ≥ 2 dolphin profiles tested
- [ ] Assist ladder works
- [ ] Autopilot on tracking loss
- [ ] Default profile chosen, feel signed off

### Gate 3 — Final Dolphin Acceptance
- [ ] Body controls dolphin via body-input
- [ ] Keyboard controls work
- [ ] Dolphin-specific mesh/trail/effects
- [ ] Dolphin fixture eval green
- [ ] Closed-loop eval documented
- [ ] Live gate completed: final feel sign-off
- [ ] Perf target met
- [ ] Docs updated

---

## Cross-Mode Verification

- [ ] Mode switching works (Flight ↔ Rowing ↔ Dolphin)
- [ ] Each mode's suite passes independently
- [ ] PosePuppet suite unaffected by mode additions
- [ ] Body-input schema remains backward-compatible
- [ ] Tuner overlay reflects active mode
- [ ] Entry cards in PosePuppet for each mode
- [ ] All modes play fully offline

---

## Obstacle-Avoidance Checklist (per FUTURES.md)

_Raised as a product decision at each mode's final gate. Do not
auto-implement._

- [ ] Shoreline and land collisions evaluated
- [ ] Terrain, buildings, rocks, props evaluated
- [ ] Navigational boundaries and getting trapped
- [ ] Repeated collision loops / oscillating corrections
- [ ] Predictive lookahead considered
- [ ] Soft Full Assist guidance considered
- [ ] Stillness near hazards / tracking loss near hazards
- [ ] Expert mode reduces or disables assistance (if applicable)

---

## Sign-Off

| Mode | Gate 2 | Gate 3 | Date | Notes |
|---|---|---|---|---|
| Flight | ✅ Approved | ✅ Approved | 2026-07-07 | Superman default standing, Head Pilot seated |
| Rowing | ⏳ Pending | — | — | |
| Dolphin | — | — | — | |
