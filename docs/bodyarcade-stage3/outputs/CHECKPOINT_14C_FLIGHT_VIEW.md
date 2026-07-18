# CHECKPOINT 14C — Flight View Over the Region

## 1. Header

Checkpoint 14C (final checkpoint of the slice): the Flight view flies above the same terrain and water. The flight donors (`bodyarcade-flight-fable` vehicle/camera/altitude systems) are globe-coupled, so their **patterns** port while the math re-points to the planar region. The aircraft is a **placeholder block vehicle** (TinySkies visuals are out of scope under one-style; no aircraft asset is approved). Completing this checkpoint completes the mode-continuity story: one world, four movement modes.

## 2. Preconditions and starting state

- Checkpoint 14B approved. Branch `shared-world-slice` at the 14B-approved commit; tree clean.
- Donors (read-only): `apps/flight/client/src/input/bodyControls.ts` (531 ln — the original consumer discipline), `apps/flight/client/src/game/CameraRig.ts` (279 ln vehicle-follow patterns), `TerrainSurface.ts` (altitude-sampling concept only — globe-specific); `feat/openworld` `src/modes/flight.ts` (read via `git show`).

## 3. In scope

1. `?mode=flight`: spawns airborne at 120 m over the approved spawn [DERIVED, flagged].
2. `src/modes/flight/`: planar flight vehicle — fixed-wing-style model with bank-to-turn (the flight donors' control feel), pitch/climb, throttle bands; altitude floor = `terrainHeight` + 8 m hard-avoid with soft pull-up assist [DERIVED, flagged]; ceiling 400 m [DERIVED: 2× peak, flagged]; region containment = the same soft-current idea re-pointed for air (turn-back assist inside a 100 m boundary band [DERIVED, flagged]).
3. `bodyControls.ts` consumer discipline ported (profiles, assists, autopilot, T-pose recenter, keyboard parallel: pitch/roll/throttle keys per the donor's map).
4. Placeholder aircraft: block vehicle (wreck-grey #8C9296 fuselage 3 × 0.8 × 0.8 m + wing block 4 × 0.1 × 0.8 m [DERIVED, flagged]).
5. Camera: cp02 rig flight set — follow 12 m, height 3 m, look-ahead 8 m, FOV 60 [DERIVED, flagged]; far plane 2500 (already region-wide).
6. The flight view proves the shared world from above: islands, reefs through the water surface, the whole composed region; above-water ambient bed plays.
7. Slice definition-of-done sweep (Master §9): the full checklist run and reported (loop time, 3+ breach sightlines, cave+arch transit, placeholder census, four-shot, 60 fps) — the slice's closing evidence.
8. Commit.

## 4. Out of scope

- No aircraft asset, no TinySkies restyle or reuse of its meshes; no aerobatics systems beyond bank/pitch/throttle; no landing gameplay (water/ground contact = soft pull-up assist, never a crash).
- No new world content; no other modes' changes; no merges of donor branches.

## 5. Required inputs

- Implementation Master §3.3 (donors + TinySkies permission note), §9 (split cause + DoD), §7.5 (camera).
- Track A report §8 (flight donor rows; globe-coupling caveats), §6 (Flight complete — do not rebuild).
- Master context §12.1 (one style; TinySkies-as-standalone out of scope), §2.1 (the world model this view completes).
- Donor sources listed in §2; `world.json`.

## 6. Deterministic implementation specification

- Flight model: fixed-step 120 Hz deterministic; speed band 15–40 m/s [DERIVED: crosses the region in 50–130 s, matching the "sky level" read; flagged]; bank-to-turn coupling ported from the donor's constants (list old→new); no stall simulation (min speed floor with auto-throttle assist).
- Terrain avoid: sample `terrainHeight` ahead 2 s along velocity; if projected clearance < 8 m, blend a pull-up assist (full assist profile) — never a collision event.
- Containment: inside 100 m of the region edge, soft turn-back yaw assist (mirrors the swim containment philosophy; never a wall).
- Water read from above: the untouched surface + the shallows' depth tint do the work; no new rendering.
- Eval handle gains flight segments; the DoD sweep script drives all four modes in one run.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region&mode=flight
```

Expected: bank over the whole region — the lagoon, reef shelf, trench shadow, islands with their vegetation, the summit at eye level; dive toward the water and the assist eases you up; cross the coast and watch the same terrain the walker climbed; switch modes anywhere and the world never changes. The slice's closing shot: all four modes over one place.

## 8. Automated verification

1. Shared-terrain law: flight altitude-floor probes vs `terrainHeight` (500 samples — clearance never < 8 m in scripted low passes).
2. Containment: scripted edge run — turn-back engages inside the band; never exits the region.
3. Keyboard-only flight works; determinism digests stable; four-mode round-trip clean; every prior suite green.
4. Four-shot re-run unchanged (final surface-protection proof).
5. **Definition-of-done sweep** (Master §9): scripted full run asserting — region loop 5–10 min at cruise; ≥ 3 breach sightlines show terrain; cave + arch transit clean; placeholder census complete for every remaining category; sustained median `fps ≥ 58` in all four modes' scripts; results written to `eval/shared-world-results.json` as the slice-closing artifact.
6. `simHz > 100` (flight sim).

## 9. Manual review procedure

1. Fly the region for 5 minutes: control feel vs the donor's flight, altitude assists, the from-above composition read.
2. Run all four modes back-to-back over the same coastline — the mode-continuity judgment (the point of the whole slice).
3. Rule on flagged values (speed band, floors/ceiling, camera set).
4. Review the DoD sweep table — this review closes the slice ladder (remaining placeholder conversions continue as asset supplies arrive, via re-runs of cp10–12 class work with your approvals).

## 10. Performance-report requirements

fps in flight (worst: full-region vista), flight-sim cost, the final before/after frame-budget table across all checkpoints (00 baseline → now), delta vs 14B.

## 11. Placeholder inventory requirements

Final census: every category's state (converted / moving-block / static-block), the standing conversion to-do list, and the vehicle/character stand-ins (boat, capsule, aircraft) listed explicitly.

## 12. Deviation-report requirements

Donor-constant table; every [DERIVED] flag; any donor pattern that couldn't port planar-cleanly; the complete DoD result with any misses called out plainly.

## 13. Guardrails

- One style; no TinySkies meshes/visuals; the aircraft is a legend block; no invented assets; purchase nothing.
- Flight donors read-only; V-lane work never rebuilt; vendored files untouched; four-shot clean; approved visuals immutable.
- Local-only; keyboard parallel; deterministic; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, DoD sweep, final census, final performance table, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
