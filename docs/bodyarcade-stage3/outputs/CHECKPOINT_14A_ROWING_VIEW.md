# CHECKPOINT 14A — Rowing View Over the Region

## 1. Header

Checkpoint 14A (first of the three mode views; master-ladder checkpoint 14 split per Implementation Master §9 — three distinct donor seams cannot land in one session): the Rowing view travels the same water surface over the same region, consuming the rowing donors from `apps/flight` (the rowing systems live there — Track A F11), with oar strikes disturbing the jeantimex surface exactly the way the demo's objects do. The boat is a **placeholder block vehicle** (the old BoatMesh is presentation-superseded by one-style; no boat asset is approved yet).

## 2. Preconditions and starting state

- Checkpoint 13 approved. Branch `shared-world-slice` at the 13-approved commit; tree clean.
- Donors (read-only, present in the base): `apps/flight/client/src/input/rowControls.ts` (455 ln stroke consumer), `apps/flight/client/src/game/Boat.ts` (impulse-boat pattern; its `SphericalMath` is globe-specific and does **not** transfer), `apps/flight/client/src/ui/RowingHUD.ts` (pattern only); `feat/openworld @ ed1bb7a` `src/modes/row.ts` + `transitions.ts` (read via `git show` — do not merge the branch).

## 3. In scope

1. Mode plumbing: `?mode=rowing` (default remains `dolphin`); a minimal mode manager modeled on openworld's `transitions.ts` pattern (fade + spawn-point switch; mode spawns from `placement.json` — rowing spawns at the approved dock/shore site, else the dolphin spawn).
2. `src/modes/rowing/`: planar boat vehicle — port `Boat.ts`'s impulse/cruise/brake/coast constants and freeboard behavior onto the planar region surface (position on y = surface, XZ motion; the spherical math replaced by planar heading math); soft containment reuses `shoreDistance` (boats stop in the shallows: min depth 0.8 m [DERIVED, flagged]).
3. `rowControls.ts` ported unchanged in its consumer discipline (stroke-block BodySignal consumption, keyboard parallel: W/S or arrow strokes, A/D steering per its two steering profiles, assist ladder, autopilot) — same dual-transport topology as swimControls.
4. Oar-water interaction: each stroke injects displacement via the sanctioned object-displacement/drop API at the oar positions (port/starboard alternating per stroke phase) — the master-context-specified behavior ("oar strikes disturb the jeantimex surface exactly the way the demo's objects do").
5. Placeholder boat: block vehicle per the legend (building-tan #A9784A hull block 3.2 × 1.2 × 0.5 m + two oar blocks [DERIVED sizes, flagged]); rower presence implied, no character model.
6. Camera: the cp02 rig with a rowing parameter set (follow 9 m, height 2.5 m, FOV 55 [DERIVED from the dolphin set, flagged]); surface-skimming comfort (no underwater excursions except intentional capsize-free design — the boat cannot dive).
7. Above-water ambient bed (cp13) plays in this mode; no new audio.
8. Commit.

## 4. Out of scope

- No boat asset, no rower character, no wake meshes (the displacement wake **is** the demo's response); no new water edits beyond the existing injection API.
- No rowing-specific world edits; no docks gameplay; no other modes (14B/14C).
- No merging of `feat/openworld` or any donor branch.

## 5. Required inputs

- Implementation Master §3.3 (donors), §9 (split cause), §7.5 (camera), §8.3 (legend).
- Track A report §8 (donor inventory rows: rowing controller/boat/HUD; the SphericalMath caveat).
- Master context §12.1 (mode rollout; the oar-strike requirement).
- Donor sources listed in §2; `placement.json` spawn sites.

## 6. Deterministic implementation specification

- Boat sim: fixed-step 120 Hz like the dolphin sim (deterministic, no RNG); stroke impulse constants ported from `Boat.ts`/`rowControls.ts` verbatim as initial values (list them old→new in the report; the fixture-measured `FULL_STROKE_AMP 0.45` stays); planar heading; coast decay per donor; capsize impossible (roll cosmetic ≤ 8° into turns [DERIVED, flagged]).
- Containment: `shoreDistance` soft current + the min-depth stop; never beach the boat hard.
- Oar injection: stroke phase from the controller's stroke machine; two injection points at ±0.9 m abeam [DERIVED, flagged]; amplitude scaled by stroke amp.
- Mode switch: fade 0.5 s, swap controller/camera/vehicle, dolphin state parked; `?mode=` deep-links both.
- Eval handle extends: `__SHARED_WORLD.mode`, boat state snapshot, `runScript` gains rowing segments.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region&mode=rowing
```

Expected: row the same bays and coastlines the dolphin swims — every stroke bites the real surface with a visible jeantimex disturbance; the boat coasts between strokes; steering asymmetry or lean turns it; shallows gently refuse the hull; the same islands, vegetation, ruins, and atmosphere surround you from the surface. Switch back to `mode=dolphin` and the world is unchanged.

## 8. Automated verification

1. Shared-terrain law: the boat's min-depth refusal line matches `terrainHeight` (probe 50 shoreline points — no boat position where depth < 0.8 m).
2. Stroke→displacement: instrumented injections fire per stroke at the correct alternating positions; surface visibly perturbs (capture diff at the oar point).
3. Keyboard parity: stroke/steer/assist keys drive the boat with no BodySignal producer.
4. Determinism: rowing `runScript` → identical digests across reloads.
5. Mode switch: dolphin↔rowing round-trip preserves world state; no console errors; dolphin suites still green after the round-trip.
6. Four-shot re-run unchanged (mode work must not touch the water look).
7. `simHz > 100` (boat sim); sustained median `fps ≥ 58` while rowing through the densest shoreline.

## 9. Manual review procedure

1. Row the coast for 5 minutes: stroke feel (impulse-and-glide kinship), steering profiles, shallows behavior, oar-splash read.
2. Judge the placeholder boat's scale/sit in the water; confirm it reads as an obvious placeholder.
3. Rule on flagged values (min depth, oar abeam, camera set, roll).

## 10. Performance-report requirements

fps rowing vs swimming, boat-sim cost, injection cost, delta vs 13.

## 11. Placeholder inventory requirements

Census adds the boat vehicle as a new placeholder entry (category: vehicle, color #A9784A); everything else unchanged.

## 12. Deviation-report requirements

Donor constants table (ported values old→new), all [DERIVED] flags, any donor logic that could not port planar-cleanly (what was rewritten and why).

## 13. Guardrails

- One style: no TinySkies visuals, no donor boat mesh; the vehicle is a legend block until a boat asset is approved.
- Water interaction only through the sanctioned injection API; vendored files untouched; four-shot clean.
- Keyboard always works; donor branches read-only (no merges); approved visuals immutable; local-only; deterministic; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, donor-constant table, stroke evidence, performance, census, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
