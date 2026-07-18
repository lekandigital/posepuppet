# CHECKPOINT 11 — Fish and Ambient Life Motion

## 1. Header

Checkpoint 11: the world starts moving — schooling fish, patrolling large animals, and drifting ambient life, at Track D's sparse-by-default budgets. The **motion system** is the deliverable; it runs on the user's ~3 supplied fish models if they have arrived, otherwise on the placeholder blocks (the ladder's explicit contingency). Life is an event, never wallpaper.

## 2. Preconditions and starting state

- Checkpoint 10 approved. Branch `shared-world-slice` at the 10-approved commit; tree clean.
- **User-supply check:** ask whether the ~3 fish models (and any ray/turtle approval from Track C's candidates) are available. Supplied models must arrive with license/provenance; CC-BY items get per-item live license verification + CREDITS.md entries before commit. If nothing has arrived: proceed on blocks; the checkpoint is *not* blocked.

## 3. In scope

1. `src/life/` motion systems, deterministic (hash-seeded, no runtime RNG):
   a. **Schools**: per school-volume (cp07 boxes) a bounded flocking motion (cohesion/alignment/separation + volume containment + flee-from-dolphin within 6 m [DERIVED radius, flagged]) for 12–24 agents [Track D 17.8]; agents = supplied fish glb or 0.25 m placeholder blocks in the school color.
   b. **Patrollers**: one shark-class patroller per plain pocket [Track D 17.8] on a baked loop path with slow heading noise; agent = supplied model or large-animal block.
   c. **Drifters**: jelly-row class in dark zones (rows of 2–4, slow vertical bob, along-route placement) [Track D 17.8]; blocks unless supplied.
2. Spawn scheduling per Track D: reef ambient 2–4 within 20 m; one school event per 60–120 s of reef traversal (event = a school's volume intersecting the player's view corridor — scheduling by traversal distance, deterministic); plains 0–1; caves 0–3; above water none.
3. Supplied-model integration path (if models arrived): GLTF load, budget check (≤ 2K textures, Track C §8), material locks (matte), swim-loop animation if the model ships one, else gentle procedural undulation (position-along-path only, no invented rigging).
4. Census/creature instrumentation: on-screen creature counts logged for the review (P7 sparse-by-default proof).
5. Commit.

## 4. Out of scope

- No creature AI beyond the three motion classes (no predator behavior/territories — recorded future stance); no octopus setpiece (out of slice per Track D 12.1).
- No inventing fish/ray/turtle/shark models — blocks until supplied/approved (the strict policy's core case).
- No boids-flee tuning beyond the flagged radius; no sonar; no interaction mechanics.
- No density increases beyond Track D budgets (emptiness is a feature of E/G).

## 5. Required inputs

- Implementation Master §6.6 (17.8 budgets), §8.3 (school-volume/large-animal legend), §8.2 (pipeline).
- Track D report §12 (Table 12.1 + composition reads), §2 P7.
- Repo donor (read-only): `apps/dolphin/src/game/decor.ts` boid pattern (technique only — reimplemented deterministically in the new app).
- If supplied: the user's fish models + their license statements; Track C §3 wildlife tables for any approved CC-BY candidates.
- cp07 school volumes / patrol pockets / jelly routes from `placement.json`.

## 6. Deterministic implementation specification

- Fixed-step life update inside the render loop but **decoupled from the 120 Hz sim** (life is presentation; the dolphin sim/replay remains byte-stable — creatures read the dolphin's position, never write sim state).
- Flocking gains [REC-class starting points, flagged]: cohesion 0.4, alignment 0.6, separation 1.0 (2 m radius), volume-containment spring at the box walls, flee impulse 2 m/s decaying τ 1.5 s; agent speed band 0.4–1.2 m/s; all seeded per school id.
- Patrol loops: closed splines from `placement.json` pocket entries; speed 0.8 m/s; heading noise hash-driven.
- Jelly bob: ±0.4 m sinusoid, period 6–9 s per instance hash; row spacing 1.5 m.
- School-event scheduler: per 100 m of reef-zone traversal, probability table hashed from position (expected interval 60–120 s at cruise) — deterministic given the same swim path.
- On-screen budget guard: if a frame would exceed the zone's Table 12.1 band (e.g., > 4 ambient + a school in reef), the farthest non-event agents fade (distance fade into fog, degradation order compliant).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: reefs feel alive but never crowded — occasional schools ripple past and part around you; a lone patroller haunts the plain pocket (an event, with the emptiness doing the work); jelly rows drift in the dark; above water stays empty. If models were supplied, they swim; if not, colored blocks move exactly as the models will.

## 8. Automated verification

1. Budget bands: scripted loop — per-zone on-screen counts sampled every 2 s stay within Table 12.1 bands (reef 0–4 + school events; plain 0–1; caves 0–3; above water 0).
2. School events: expected interval on the scripted loop within 60–120 s (report the measured mean).
3. Determinism: same scripted swim twice → identical creature trajectories (hash of sampled positions).
4. Sim isolation: replay digests identical with life enabled vs disabled (creatures never touch sim state).
5. Flee behavior: scripted dash through a school → agents clear a 2 m radius around the dolphin within 1.5 s, school reforms.
6. Census: school volumes/patrollers/jellies now moving; conversion status per category recorded (blocks vs supplied models, with licenses if supplied).
7. Four-shot re-run unchanged; suites green; `simHz > 100`; sustained median `fps ≥ 58` during a school event.

## 9. Manual review procedure

1. Swim the loop: does life read sparse-by-default, clustered-when-present (P7)? Are schools events, not wallpaper? Is the plain's emptiness working with the lone patroller?
2. If supplied models are in: judge their material/matte read and scale against the dolphin.
3. Rule on flagged values (flee radius, flocking gains, scheduler interval).
4. If models have not arrived: confirm continuing with blocks (and optionally approve specific Track C wildlife candidates for later per-item verification).

## 10. Performance-report requirements

Life-system CPU ms/frame, agent counts, fps during the densest school event, delta vs 10.

## 11. Placeholder inventory requirements

Census diff: which life categories now move as blocks vs converted to supplied models; remaining static placeholders restated.

## 12. Deviation-report requirements

Deviations from Table 12.1 with cause; all [REC]/[DERIVED] gains restated; supplied-model licensing records; anything the budget guard had to fade in practice.

## 13. Guardrails

- No invented creature models — blocks until user-supplied/approved (verify each license live; CREDITS.md before commit); purchase nothing.
- Budgets are ceilings, not targets; emptiness zones stay empty; above water stays lifeless.
- Sim/replay isolation absolute; approved visuals immutable; four-shot clean; local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, budget/event measurements, census diff, performance, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
