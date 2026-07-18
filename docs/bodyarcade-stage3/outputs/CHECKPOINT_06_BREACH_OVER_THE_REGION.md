# CHECKPOINT 06 — Breach Over the Region

## 1. Header

Checkpoint 06: breach, airborne framing, and re-entry over the real region — the mode-continuity proof. Rising through the surface the player sees the horizon, the water around the dolphin, and the same islands the other modes will inhabit, then re-enters cleanly. Implements the Track E breach chain and its camera states at region scale, with splash injection through the demo's own drop mechanism. This completes the region-scale feel work Track E assigns to checkpoints 4–6.

## 2. Preconditions and starting state

- Checkpoint 05 approved. Branch `shared-world-slice` at the 05-approved commit; tree clean.
- Sim breach constants active per Master §7.4: BREACH_MIN_SPEED 3.75, BREACH_MIN_VY 3.2, BREACH_GRAVITY 7.5, BREACH_REENTRY_KEEP 0.85, BREACH_COOLDOWN_S 1.0.

## 3. In scope

1. Breach state chain (Track E §15/§19): Underwater → SurfaceApproach → Crossing → AirborneAscent → AirborneApex → AirborneDescent → ReEntry → UnderwaterRecovery, layered over the sim's existing breach event (the sim's ballistic phase is the physics; the chain adds animation/camera/effects sequencing).
2. Animation: `Jump` (root motion stripped) LoopOnce at Crossing; hold/apex segmentation per Track C Item 6 (use the whole clip as one-shot if segmentation reads poorly — record which); crossfade back to swim in UnderwaterRecovery; airborne pitch/roll authority 60 % of underwater [Track E Table D].
3. Splash injection at both crossings via the demo's drop mechanism: exit drop scaled by |v| at crossing; entry drop larger (×1.5 [DERIVED, flagged]); a brief splash occlusion sprite burst 0.2 s at re-entry [Track E Table D] using the bubble-burst pattern (no new particle tech — reuse the demo's displacement + a simple additive sprite burst; sprite is an authored soft-alpha texture, debug-class asset).
4. Camera: SurfaceTransition → Airborne (pullback +3.75 m, keeps the arc readable and the horizon in frame) → ReEntryRecovery (0.6 s); the old camera's breach air-lift virtue expressed through the new rig's Airborne parameter set.
5. Failed/shallow breach: below thresholds → partial emergence and fall-back (the sim's surface spring already does this — verify and keep; no new mechanic).
6. Breach sightline verification at the ≥ 3 approved spots (islands/terrain visible airborne).
7. Control lockout at re-entry ≤ 0.2 s (settle only) [Track E Table D].
8. Commit.

## 4. Out of scope

- No atmosphere/sky changes (the vendored sky ships unchanged — R11; Track D's sky values stay deferred).
- No audio (cp13 owns the splash/breath sounds).
- No new water-shader edits (the drop-injection API is the sanctioned interaction path from 04B).
- No porpoising/tailwalk extras beyond the specified chain (later-phase candidates).

## 5. Required inputs

- Implementation Master §7.3–§7.5 (breach constants, camera states), §4.3 (drop injection), §9 (definition-of-done sightlines).
- Track E report §15, §19 (chain + camera), Table D (all values).
- Track C report §1 Item 3 (Jump clip mechanics: 2.000 s, ~2 m baked root motion — must stay stripped) and Item 6 (segmentation options).
- `placement.json` breach-sightline entries from 04A.

## 6. Deterministic implementation specification

- SurfaceApproach: within 3 m of surface, ascending, speed ≥ 3.75 → eligible; cancel if speed drops below or heading turns away.
- Crossing: at y crossing 0 upward with vy ≥ 3.2 → sim breach event fires (existing); chain enters Airborne states; exit-drop amplitude = clamp(|v|/9, 0.3, 1.0) × the demo ball's reference drop strength [DERIVED mapping, flagged].
- Airborne: ballistic under gravity 7.5; pitch/roll input authority × 0.6; apex at vy ≈ 0 (fires the apex animation hold if segmented).
- ReEntry at y crossing 0 downward: entry drop ×1.5 of exit reference; occlusion burst 0.2 s; velocity retained × 0.85 (existing); control lockout 0.2 s; camera ReEntryRecovery 0.6 s.
- Airtime expectation (verification anchor, derived from actives): vy 3.2 → ~0.85 s; burst 9 at 45° (vy 6.4) → ~1.7 s; monotonic with approach speed.
- Sightlines: at each approved breach spot, the Airborne camera must hold the horizon and ≥ 1 island in frame through the arc (composition transient rules per Master §7.5 apply — bands may break in Airborne, must recover by NormalFollow).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: build speed (burst), pitch up near the surface → the dolphin clears the water in a readable arc; the camera pulls back and slightly under-lifts so the leap reads against horizon and islands; splash out and splash in disturb the real surface; re-entry keeps momentum and control returns almost immediately; a lazy approach produces a graceful failed half-breach. Repeat at all three approved sightline spots.

## 8. Automated verification

1. Breach positive: scripted wind-up (dive → burst → pitch-up) → `breachCount ≥ 1`, chain transits all states in order, splash injections observed (instrument the injection calls), returns to swim.
2. Breach negative: bleed below 3.75 m/s, hold pitch-up 6 s at surface → no breach; surface spring holds; chain stays out of Airborne.
3. Airtime monotonicity: three scripted breaches at increasing approach speeds → strictly increasing airtime; values within [0.6, 2.4] s [Track E band ± tolerance].
4. Root-motion guard: dolphin world position during `Jump` playback is sim-driven only (no double displacement; assert drift < 0.1 m between animation-root and sim positions).
5. Camera: subject never leaves frame during the arc; no camera-surface clip artifacts; ReEntryRecovery ≤ 0.9 s to NormalFollow bands.
6. Sightlines: captures at apex at the 3 approved spots — assert islands/terrain pixels present in the upper half of frame (mask heuristic) and file the images for review.
7. Four-shot re-run: unchanged (no water-look drift).
8. Replay self-consistency; `simHz > 100`; sustained median `fps ≥ 58` including a breach in the scripted run.

## 9. Manual review procedure

1. Perform ~10 breaches of varying vigor at the three spots: judge arc "dreaminess" (gravity 7.5 verdict), splash reads, camera drama vs comfort, re-entry continuity (the money shot of the slice — be exacting).
2. Judge the failed-breach feel (graceful, not punitive).
3. Rule on flagged values (exit/entry drop scaling, occlusion burst); optional Track E candidates on offer: gravity 9.8 (crisper), Table D angle gate ≥ 25°, apex segmentation vs whole-clip.
4. Enjoyment criteria re-run (Master §7.8) — breach achievable from ordinary play within seconds of intent.

## 10. Performance-report requirements

fps through the breach (worst frame during splash), splash-injection cost, frame-budget table delta vs 05.

## 11. Placeholder inventory requirements

Still none placed; restate as pending cp07. (The splash sprite is a debug-class effect texture, listed as such.)

## 12. Deviation-report requirements

Deviations from Track E Table D / Master §7.4 with cause; all [DERIVED] flags; whether `Jump` was segmented or used whole (and why); any sightline that failed to show terrain (layout issue → routed back to the user, not silently re-terraformed).

## 13. Guardrails

- The waterline crossing is rendered by the untouched pipeline; splashes only through the sanctioned injection API; vendored files unmodified.
- No sky/atmosphere changes; approved visuals immutable.
- Sim architecture preserved (breach stays deterministic; chain is presentation + input gating).
- No invented assets beyond the debug-class splash sprite (listed); purchase nothing; local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, airtime table, sightline captures, four-shot re-run, performance, placeholder statement, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
