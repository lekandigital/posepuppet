# CHECKPOINT 02 — Pool Camera

## 1. Header

Checkpoint 02: replace the baseline chase camera with the Track E camera rig — critically damped spring position with asymmetric damping, smoothed-velocity look-ahead, speed-based distance, state-set blending — and prove the above/below and half-submerged waterline behavior with the dolphin in the pool. Composition acceptance = the Track D bands. This is the pool-scale camera-feel retune Track E identifies for checkpoints 1–2.

## 2. Preconditions and starting state

- Checkpoint 01 approved (including any rulings on its flagged derived values). Branch `shared-world-slice` at the 01-approved commit; tree clean.
- `?view=pool` swims per checkpoint 01; `?view=stock` pristine.

## 3. In scope

1. New `CameraRig` + `CameraCollision` modules (Track E §17 shapes) replacing the ported `camera.ts` in `?view=pool`; the old file is deleted after its three virtues are carried over (spring chase, breach air-lift, ≤10 % bank-coupled roll).
2. Camera state machine: NormalFollow, SlowHover, FastTravel, TerrainCompressed (stub — no terrain yet; pool walls stand in), Obstructed, SurfaceTransition, Airborne, ReEntryRecovery, EmergencyRecenter; parameter-set cross-fades 0.2–0.5 s.
3. Half-submerged and above/below crossing behavior over the vendored demo's existing waterline compositing (read-only: the rig positions the camera; the vendored pipeline renders the crossing — zero shader edits).
4. Recenter input: key `R` eases the camera behind facing over 0.5 s [Track E Table C; binding R = derived integration parameter, flagged].
5. Fidelity shots (c) and (d) of the four-shot procedure, captured in-pool vs `?view=stock`.
6. Playwright coverage-band + state tests. Commit.

## 4. Out of scope

- No region, terrain, or BVH camera collision (pool walls are analytic; BVH arrives at cp05).
- No vendored-shader edits of any kind; no changes to the waterline rendering itself.
- No movement-model changes (cp01's constants stand unless the user ruled otherwise at the 01 review — apply any such rulings first as recorded amendments).
- No HUD.

## 5. Required inputs

- Implementation Master §7.5 (all initial values), §7.8 (enjoyment criteria), §4.4 (shots c/d definitions).
- Track E report §12–§14, §19 Table C and camera state machine.
- Track D report §13 (composition bands: 8–18 % width, 40–60 % height; coverage governs, FOV subordinate).
- Repo: `apps/dolphin/shots.mjs` (screenshot-driver pattern to re-point).

## 6. Deterministic implementation specification

- Initial values (meters/seconds, Master §7.5): follow 8.75 → 13.75 m at burst (distance lerps with speed 0→9 m/s); height 2.0 m; look-ahead 6.25 m along velocity low-passed at t90 0.25 s; position catch-up t90 0.18 s / settle t90 0.45 s (asymmetric by whether target is receding or approaching); aim t90 0.25 s; distance t90 0.6 s; recenter 0.5 s; obstruction dolly-in t90 0.15 s; collision radius 0.75 m; surface blend 0.3 s; breach pullback +3.75 m; re-entry recovery 0.6 s; camera roll = 0.10 × dolphin roll; FOV 55°; near 0.1; far 900 (pool).
- Damping form: SmoothDamp-style critically damped spring (Track E cites the standard form); t90 values convert to the spring's smooth-time internally — document the conversion in code.
- Pool-wall camera collision: analytic — clamp the desired camera position to the pool interior minus the 0.75 m radius; if the dolphin-to-camera ray crosses a wall, dolly in along the ray (t90 0.15 s), state → Obstructed.
- SlowHover below 0.75 m/s: distance eases to 6.0 m [DERIVED: an intimate hover distance below the 8.75 m cruise follow, inside Track E's 2.5–6 E-BL band — pinned 6.0 m, flagged review item]; FastTravel above 5 m/s.
- SurfaceTransition triggers when the camera or dolphin crosses y 0; while the camera is within ±0.75 m of the surface, hold a minimum |y| of 0.35 m for ≥ 150 ms per crossing to avoid plane-skimming shimmer [DERIVED anti-artifact rule, flagged] — the crossing itself stays continuous, never a cut.
- EmergencyRecenter when LOS blocked > 0.3 s or distance error > 3× target: fast recenter (t90 0.15 s), never a teleport during normal play.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=pool
```

Expected: the camera trails behind and slightly above; turns reveal the path ahead (look-ahead); speed reads through distance growth; stopping settles softly with no overshoot jitter; R recenters; swimming at the waterline shows a clean continuous above/below crossing with the demo's own Fresnel split; no wall clipping in corners; no nausea-inducing roll.

## 8. Automated verification

1. Coverage bands: at cruise on a straight line for 3 s, project the dolphin's bounds — width fraction within 8–18 % (target 10–15 %) and center height within 40–60 % of frame; repeat at burst and at hover (bands may relax only in non-NormalFollow states — assert state).
2. Step-turn: command a 90° yaw step at cruise; assert the camera's aim error decays monotonically with t90 within 0.15–0.40 s and the dolphin never leaves the frame.
3. Stop test: burst → brake; assert no positional overshoot > 0.5 m and settle within 1.2 s.
4. Wall test: swim into a corner; assert camera position stays ≥ 0.6 m from every wall plane and LOS to the dolphin is never lost > 0.3 s.
5. Waterline: scripted sinusoidal swim across y 0; assert continuous camera path (no frame-to-frame jump > 1.2 m) and the anti-shimmer hold engages.
6. Shots (c) and (d): capture half-submerged and Snell-window PNGs in `?view=pool` and `?view=stock` at matched transforms; assert both exist and are nonzero; visual A/B is manual (§9).
7. Replay determinism unchanged (camera is presentation; digests identical to cp01's for the same script).
8. `simHz > 100`; sustained median `fps ≥ 58`.

## 9. Manual review procedure

1. Free-swim 10 minutes: "the camera never surprised me" (Master §7.8) — no snaps, no lost subject, comfortable at length; judge look-ahead and speed-distance.
2. A/B shots (c)/(d) against stock: waterline split and Snell's window must read as the same jeantimex system.
3. Hover close-up feel (SlowHover 6.0 m — approve or retune).
4. Rule on flagged values: R binding, SlowHover distance, anti-shimmer hold.

## 10. Performance-report requirements

Median/min fps (10 s scripted swim incl. two waterline crossings), simHz, frame-time delta vs checkpoint 01, camera-update CPU cost (µs/frame if measurable).

## 11. Placeholder inventory requirements

Still none; state it.

## 12. Deviation-report requirements

Deviations from Master §7.5 with cause; every [DERIVED] flag above restated; any Track E [REC] the rig had to adjust to hold the Track D bands (coverage governs — record what moved and by how much).

## 13. Guardrails

- Zero vendored edits; the waterline crossing is rendered by the untouched demo pipeline.
- Approved cp01 visuals immutable (dolphin, pool mount); this checkpoint changes camera behavior only.
- No invented assets; no scope adds; local-only; keyboard-only play intact; suite never weakened.
- Camera roll cap 10 % and pitch clamps are comfort rules — do not exceed for style.

## 14. Stop

Produce the end-of-checkpoint report (changes, band measurements, shot pair, performance, placeholder statement, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
