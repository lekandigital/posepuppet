# CHECKPOINT 14B — Walking View Over the Region

## 1. Header

Checkpoint 14B: the Walking view explores the exposed land of the same region — beaches, paths, hills — consuming `packages/locomotion` (V3, complete and merged in the base) exactly as its own `INTEGRATION.md` prescribes. Ground truth is the same `terrainHeight` every other mode uses. The walker is a **capsule graybox** (no character asset is approved for this mode; one style, no invented characters).

## 2. Preconditions and starting state

- Checkpoint 14A approved. Branch `shared-world-slice` at the 14A-approved commit; tree clean.
- Donors (read-only): `packages/locomotion/` (`controller.ts`, `model.ts`, `coach.ts`, `defaults.ts`, `INTEGRATION.md`) — consumed via the existing source alias like the other packages, unmodified; `apps/walking` graybox (reference only); `feat/openworld` `src/modes/walk.ts` (read via `git show`).

## 3. In scope

1. `?mode=walking`: spawns at the approved beach/shore site from `placement.json`.
2. `src/modes/walking/`: `createWalkController(window)` + `createLocomotion()` per `INTEGRATION.md`; `loco.step(ts, intent, pathHint)` drives a capsule (0.45 m radius, 1.75 m height [DERIVED human defaults, flagged]) whose ground y = `terrainHeight` (BVH ground-snap where structures/caves overlap terrain); comfort caps enforced at output per the package's law ("may be lowered, never raised").
3. Terrain interaction: max walkable slope 35° [DERIVED, flagged] — steeper reads as a soft wall (slide along, coach line); water edge: wading to 0.8 m depth then soft stop (the sea belongs to the other modes; no swimming here).
4. Camera: cp02 rig walking set — follow 4.5 m, height 1.6 m above the capsule head, look-ahead 3 m [DERIVED, flagged]; terrain-aware (BVH collision as in dolphin mode).
5. Keyboard parallel per the package's map; BodySignal gait input via the standard dual transport (the locomotion package is the gait consumer).
6. Above-water ambient bed plays; vegetation sway (wind mode) visible; the walking view sees the same islands/ruins/placeholders.
7. Commit.

## 4. Out of scope

- No character model/animation (capsule only until an asset is approved); no interiors; no climbing/jumping mechanics beyond the package's model; no path network; no NPCs.
- No locomotion-package modifications; no other modes' changes.

## 5. Required inputs

- Implementation Master §3.3 (donors), §9 (split cause), §2.2 (law).
- Track A report §8 (locomotion donor row; INTEGRATION.md pointer), §6 (V3 completed — do not rebuild).
- `packages/locomotion/INTEGRATION.md` (the integration authority — follow it verbatim; deviations are report items).
- `placement.json` walk spawn; `world.json`.

## 6. Deterministic implementation specification

- The package's own defaults (`defaults.ts`) are the initial gait/speed constants — ported untouched; list them in the report. Comfort caps: consume as shipped; never raise.
- Ground solve: analytic `terrainHeight` primary; BVH snap only where a trimesh (structure/cave/dock) is above/below the heightfield at the capsule position; step-up limit 0.4 m [DERIVED, flagged].
- Slope handling: project intent onto the tangent plane; above 35° the normal component cancels (slide + coach line via the package's coach, e.g. "Too steep — follow the ridge").
- Wade/stop: below 0.8 m depth the intent damps to zero over 0.5 s with a coach line; no water sim coupling (the surface renders as-is around the ankles — the waterline masking from cp05 already handles the visual).
- Determinism: fixed-step like the other sims; walking `runScript` segments added to the eval handle.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region&mode=walking
```

Expected: walk the big island's beach up into its hills — the same terrain the dolphin sees from below and the boat skirts; vegetation sways in the wind; ruins/placeholder sites are walkable destinations; the sea edge wades then gently refuses; the summit view shows the whole region (the walking money shot).

## 8. Automated verification

1. Shared-terrain law: capsule ground y vs `terrainHeight` ≤ 0.02 m over a 500-point scripted walk (heightfield sections).
2. Slope law: scripted approach to a > 35° face — no ascent, slide engages, coach line fires.
3. Wade law: scripted walk into the sea — stops by 0.8 m depth; no submersion.
4. Structure interaction: walk onto the dock/ruin site (if converted at cp12) — BVH snap holds, no fall-through.
5. Keyboard-only walk works; determinism digests stable; mode round-trips (dolphin↔rowing↔walking) clean; all prior suites green.
6. Four-shot re-run unchanged.
7. Sustained median `fps ≥ 58` on the summit ascent script (the heaviest above-water view).

## 9. Manual review procedure

1. Walk beach → hills → summit: gait feel (package defaults verdict), slope/soft-wall behavior, camera comfort, the summit vista.
2. Judge above-water world density from ground level (feeds later asset priorities).
3. Rule on flagged values (capsule dims, slope 35°, step-up, camera set).

## 10. Performance-report requirements

fps walking (worst: summit vista), ground-solve cost, delta vs 14A.

## 11. Placeholder inventory requirements

Census adds the walker capsule (category: character-stand-in, graybox — explicitly not a legend asset category conversion); rest unchanged.

## 12. Deviation-report requirements

Any divergence from `INTEGRATION.md` (each one justified); package default constants listed; all [DERIVED] flags.

## 13. Guardrails

- `packages/locomotion` unmodified; comfort caps never raised; V3 work never rebuilt.
- No character assets invented; capsule graybox only; one style; approved visuals immutable; four-shot clean.
- Local-only; keyboard parallel; deterministic; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, INTEGRATION.md conformance note, law evidence, performance, census, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
