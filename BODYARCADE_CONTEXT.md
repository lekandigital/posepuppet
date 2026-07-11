# BodyArcade Global Context — v2

## What This Is

BodyArcade is a body-controlled arcade built on PosePuppet. Your body
flies planes, rows boats, swims as a dolphin, and eventually walks a
village — all inside a TinySkies globe-world, offline, single-player,
with body as a first-class input alongside keyboard.

This document is the shared context for all v2 work. Every agent session
reads this file first.

---

## Completed Work (do not rebuild)

### @bodyarcade/body-input (packages/body-input) — COMPLETE
Deterministic body-signal protocol: transports (BroadcastChannel, tape,
direct), measured jitter floors, tuner overlay, fixture evals ALL GREEN.
Schema v1: continuous axes (leanX, leanY, elevate, armSpread, headTilt)
plus additive blocks (tracking, stroke). Tapes replay deterministically.

### BodyArcade Flight (apps/flight) — GATE 3 APPROVED, COMPLETE
Faithful TinySkies fork: offline single-player, keyboard identical to
upstream, body flies the plane via body-input. Three profiles (Pilot Lean,
Superman, Head Pilot), assist ladder (Full/Standard/Expert), autopilot on
tracking loss, T-pose recenter, shaping stack with measured dead zones,
control tuner. 60 fps render + 30 Hz pose (2× target). Fixtures and
closed-loop evals green. Permission quoted in LICENSE_NOTES.md; in-app
credit; ASSETS.md manifest complete.

### Predictive Pose Continuity (src/pose/continuity.ts) — GATE 2 APPROVED, MERGED
Landmark-level continuity through occlusion: ring buffers, regression
velocity, 6-state per-limb machines, chain-length physics gate, rigid
core prediction, converging no-snap re-entry. Merged into main at
940d31c. Flight autopilot contract: +67 ms (bound +100 ms).

### Rowing P0–P2 (on bodyarcade-rowing-fable-rebuilt) — AT GATE 2
StrokeDetector in body-input: fore-aft wrist oscillation, Schmitt
reversals, catch/drive/recovery phases. Additive `stroke` block in
schema v1. Fixture eval ALL GREEN (slow 12/12, fast 24/24, left_bias
16/15, seated 13/13, still 0). RowingControls: impulse-and-glide boat
(surge+drag), two steering profiles (row-lean, row-asym), assist ladder,
cruise after 6 steady strokes, autopilot on loss, keyboard priority.
Waterway seam: procedural open-water course. row.spec.ts 7/7 green.
**Awaiting USER GATE 2 — live rowing session.**

### Dolphin branch (bodyarcade-dolphin-fable) — CREATED, NO IMPLEMENTATION
Branch exists at same commit as Rowing rebuilt. No Dolphin-specific code
yet.

### Infrastructure
- NVIDIA browser performance harness (opt-in)
- Clean-room remote development rebuild
- PosePuppet suite: 92 passed / 5 skipped (stable baseline)

---

## Architecture

```
posepuppet/
├── apps/flight/           # TinySkies fork — Flight, Rowing, (Dolphin)
│   ├── client/            # Three.js renderer, vehicles, controls
│   └── shared/            # Vehicle capabilities, world types
├── packages/body-input/   # Body signal protocol, transports, tapes
├── src/                   # PosePuppet core
│   ├── pose/              # Detection, continuity (PPC)
│   ├── rig/               # Retargeting, avatar control
│   └── ui/                # Panel, overlays
├── fixtures/              # Test recordings (flight/, rowing/)
└── eval/                  # Results JSON, harnesses
```

**Transport**: PosePuppet (producer) → BroadcastChannel → apps/flight
(consumer). Same-origin `/flight/` topology. Renderers never share a
Three.js instance.

**Vehicle system**: `shared/vehicleCapabilities.ts` — declarative table
of camera tuning, trails, per-vehicle flags. Each BodyArcade mode is a
new input mapping onto an existing (or new) vehicle, not a new game.
Matrix builders: `buildPlaneMatrix`, `buildBoatMatrix`,
`buildCarpetMatrixVoidPlane`, (future: `buildDolphinMatrix`).

**Profile architecture**: Data-driven. Each mode owns profile tables
(mapping, shaping, assists) loaded at runtime. The tuner overlay
reflects whichever mode is active.

---

## V2 Forward Plan (what remains)

### V1: Rowing Runtime + HUD (complete Rowing through Gate 3)
- Gate 2 live session → iterate feel
- P3 polish: coach messages, README, obstacle-avoidance product decision
- Gate 3 final acceptance
- Merge path decided by user

### V2: Dolphin + World Data
- Dolphin vehicle: `buildDolphinMatrix` (boat matrix + dive via elevate
  axis), new mesh/trail, underwater camera, surface breach
- Dolphin fixtures: new recordings (dolphin_dive, dolphin_surface,
  dolphin_turn, dolphin_still)
- Dolphin profiles: at least two (Dive Lean, Swim Arms)
- Dolphin assists, autopilot, tuner integration
- World data: waterway/course system, spawn points, mode-aware entry
- Gate 2 + Gate 3 for Dolphin

### Shared across V1 and V2
- `FINAL_USER_TEST_PLAN.md` — unified acceptance checklist
- Obstacle-avoidance product decision (FUTURES.md reminder)
- Suite integrity: PosePuppet ≥ 92/5skip, Flight ≥ 17/2skip

---

## Non-Negotiables (all modes)

1. **Permission first**: USER ACTION to paste permission text; quote in
   LICENSE_NOTES.md; if narrower than "fork/adapt/use publicly with
   credit," pause.
2. **Attribution**: in-app (credits/about) + README + ASSETS.md manifest
   (copied/adapted/original).
3. **Offline**: game plays fully offline; server optional via
   docker-compose.
4. **Keyboard parity**: keyboard controls identical to upstream, always.
5. **Landmarks never cross transports**: BroadcastChannel boundary is
   sacred.
6. **Measured, not guessed**: dead zones from jitter floors, thresholds
   from fixture eval, tolerances documented honestly.
7. **Feel before polish**: do not polish visuals before controls are fun.
   Gate 2 (live feel test) before Gate 3 (final acceptance).
8. **Suite integrity**: PosePuppet suite stays green. Flight suite stays
   green. New mode suites added, never subtracted.
9. **No speculative schema**: extend body-input schema only when
   measured from real fixtures.

---

## Docs Inventory

| Document | Purpose | Update when |
|---|---|---|
| BODYARCADE_CONTEXT.md | This file — global context for all agents | Architecture or plan changes |
| LICENSE_NOTES.md | Permission text, attribution | New assets or permissions |
| ASSETS.md | File manifest: copied/adapted/original | Any file added |
| STUDY_NOTES.md | Architecture analysis of TinySkies fork | Discovery findings |
| PLAN.md | Per-mode implementation plan | Phase starts |
| DECISIONS.md | Design decisions and rationale | Any non-obvious choice |
| ARCHITECTURE.md | Technical architecture | Structural changes |
| FUTURES.md | Forward proposals (globe-as-hub, seams) | New seam discoveries |
| STATUS.md / status.md | Chronological progress log | Every phase completion |
| EVAL_NOTES.md | Fixture and live eval observations | Every eval run |
| FINAL_USER_TEST_PLAN.md | Shared acceptance checklist | Gate preparation |
| README | User-facing project description | Releases |

---

## First Actions for Any New Session

1. Read this file (BODYARCADE_CONTEXT.md).
2. Check status.md for latest state.
3. Identify which work stream you're assigned to (V1 or V2).
4. Verify suite baselines before making changes.
5. Do not start work that belongs to the other stream.