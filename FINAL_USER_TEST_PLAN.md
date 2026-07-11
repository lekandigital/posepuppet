# FINAL USER TEST PLAN — one consolidated human pass
## Front matter
- Environment prep (branch/merge state, hardware, camera, lighting, ports)
- Region decision deadline status (§14)
- Estimated total time; recommended order (below)
- Evidence index: links to eval/results.json, screenshot boards,
  recordings, per-prompt EVAL_NOTES
## Entry format (every deferred check uses this)
ID | Feature | Why human-only | Setup | Steps | Expected | Automated
evidence already collected | Risk if skipped | Est. minutes
## Sections (recommended order)
### S1  PosePuppet full app regression feel (post-runtime-extraction)
_Entries deferred to V1 Runtime+HUD completion._

### S2  Runtime + HUD across TinySkies / Rowing / standalone Dolphin (expand/collapse, keyboard access, camera-denied keyboard play)
_Entries deferred to V1 Runtime+HUD completion._

### S3  TinySkies flight feel re-check (nothing regressed)
_Entries deferred to V1 Runtime+HUD completion._

### S4  Character Control live: fingers on capable avatar, all seven face-touch targets, feet planting, capability labels truthful
_Entries deferred to V5 Character Control completion._

### S5  Motion Memory 2 creative session (trim, mirror, chorus, re-skin)
_Entries deferred to V6 Motion Memory 2 completion._

### S6  Recording v2 takes: one per presentation mode; cutout-on-stage
_Entries deferred to V7 Recording v2 completion._

### S7  Open World low-poly: flight, walking, rowing, dolphin, transitions
_Entries deferred to V4 Open World completion._

### S8  Walking comfort test (explicit nausea check — human-only by nature)
_Entries deferred to V3 Walking Locomotion / V4 Open World completion._

### S9  Realistic profile: flight/walk/row, lighting/atmosphere judgment
_Entries deferred to V4 Open World realistic profile completion._

### S10 Fantasy profile: the one-second-clip charm test per mode
_Entries deferred to V4 Open World fantasy-game profile completion._

### S11 Privacy: network-zero receipt, local-inference messaging, HUD privacy state accuracy
_Entries deferred to V1 Runtime+HUD completion._

---
## Completed-mode human-only checks (preserved from completed branches)

### Rowing (completed — from bodyarcade-rowing-fable-rebuilt at c8cdafaf)

Setup: Mac, Chrome, tunnel to the remote server (`ssh -N -L
5173:127.0.0.1:5173 ...`), open http://localhost:5173, press Row. The
rowing feedback strip appears at the bottom of the game: stroke pulse,
cadence (spm), steering marker, status word, and a guidance line when
something needs attention.

1. **Seated rowing, upper body only.** Sit at the desk with only your
   torso in frame (knees out of view). Row with full arm extension.
   Good: every pull flashes the stroke pulse and surges the boat; the
   status reads ROWING with a live cadence. (Fixed: Row now keeps the
   full pose model -- the lite model's wrist depth collapsed near the
   frame edge; measured 2/13 strokes to 13/13 on the chest-up fixture.
   If pulls read weak, the strip says "pull with a fuller arm motion".)

2. **Two-minute seated fatigue row.** Steady seated rowing for two
   minutes at whatever cadence is comfortable, including rest breaks.
   Good: cruise holds momentum during rests, speed follows cadence, no
   drift into shore (guard handles it), nothing physically exhausting
   beyond the rowing itself.

3. **Left/right lean symmetry and feel.** While rowing under Full
   Assist: gentle right lean, gentle left lean, hold each ~4 s, then
   upright. Good: both directions carve visibly and comparably; a held
   lean is never reversed by the course assist (fixed: deliberate
   steering silences the coxswain; hands-off restores line-holding).
   The steering marker on the strip shows exactly what the game applies
   -- if left/right feel differs while the marker is symmetric, the
   asymmetry is in the lean *reading*: hold a T-pose to recalibrate
   neutral and retry (the strip suggests this when seated).

4. **Stroke feedback and indicators.** Watch the strip while rowing:
   pulse per stroke (sized by pull strength), cadence in spm, steering
   marker following your lean, CRUISE appearing on rests, and the
   guidance line appearing only when something is wrong. Good: you can
   always tell tracking failure from physics feel.

5. **Shoreline avoidance during normal body control.** Row deliberately
   toward an island under Full Assist; stop fighting near the coast.
   Good: approach softens, the bow steers around, letting go always
   frees the boat within a few seconds -- never beached, never trapped.
   (A sudden spin at a white water-spout column is the twister game
   feature, not steering.)

6. **Tracking loss, recenter, keyboard fallback.** Mid-row: step out of
   frame (status -> SIGNAL LOST, boat drifts straight and slows), step
   back in (REACQUIRING -> ROWING, no snap). Hold a T-pose ~1 s to
   recenter (toast confirms). Tap the arrow keys at any point -- the
   keyboard takes the boat instantly (status KEYBOARD) and body input
   resumes a moment after the keys go quiet.

7. **Chrome and Safari passes.** Repeat items 1 and 3 briefly in Safari.
   Good: same behavior; report any Safari-specific jank rather than
   debugging live.

### Dolphin (completed — from bodyarcade-dolphin-fable at 05b48014)

Setup: Mac, Chrome, tunnel to the remote server (`ssh -N -L
5173:127.0.0.1:5173 ...`), open http://localhost:5173, press Swim (or Cmd+K
-> "swim"). The dolphin HUD shows depth/speed, the kick rhythm, assist and
tracking state, the coach line, and the minimap -- which is the actual
San Francisco Bay polygon with your position (copyright OpenStreetMap
contributors, ODbL -- the credit renders under it).

Stand ~2.5-3 m back, hips visible (the kick reads the vertical chest-hip
wave; the coach reminds you if it cannot see hips).

1. **Kick rhythm and glide (the core feel).** Bob your chest and hips in
   a smooth standing wave -- anti-phase, like a slow-motion dolphin kick,
   not a squat. Good: each wave visibly surges the dolphin (~0.3 s
   lunge); a steady rhythm settles into a cruise; stopping glides for
   seconds rather than braking. Judge: does the rhythm feel connected,
   and is the effort sustainable for two minutes?

2. **Dive, surface, banked turns.** While kicking: lean forward to dive,
   back to surface, tilt your shoulder line to carve left and right.
   Good: signs are never wrong, turns bank the camera pleasantly, Full
   Assist keeps you off the seabed and auto-levels when you stand
   straight.

3. **Breach attempt (the money shot).** Sprint (kick fast, or push both
   hands forward for burst), then lean back hard near the surface.
   Good: the dolphin leaps clear of the water, the camera follows up,
   and re-entry splashes. If it will not fire, more speed first -- the
   trigger needs sprint speed + a decisive pitch-up.

4. **Deliberate tracking loss.** Mid-swim, step out of frame for ~2 s,
   then back in. Good: the dolphin levels out and glides (no snap, no
   spin), the coach says tracking is lost, and control blends back
   smoothly when you return -- kicks never "bank up" and burst on
   re-entry.

5. **Seated + low-energy play.** Sit down; use crouch/stand (or seated
   chest bobs if your hips stay visible) and leans only. Good: depth
   trim descends/ascends, leans still steer, and Full Assist drift
   means stillness never strands you. Note honestly if seated kick
   detection is weak -- the fixture for it was never recorded (below).

6. **Boundary feel.** Swim hard at a shore (e.g. toward the Golden Gate
   gate -- the straight shimmer edge). Good: the water pushes you back
   and turns you along the coast; no hard stop, no jitter, never
   beached, and Expert assist reduces the heading help without ever
   letting you exit. Also confirm: the FUTURES.md obstacle-avoidance
   review items (shorelines, trapped pockets, oscillating corrections,
   stillness near hazards) feel acceptable or file what does not.

7. **Keyboard parity.** Put the camera away: W/S dive-surface, A/D
   turns, Q/E depth, Shift kicks, Space burst, 1/2/3 assist. Good: a
   full lap of Central Bay is playable keyboard-only.

8. **Perf on Apple Silicon.** With PosePuppet in companion mode (lite
   tracker, stage paused): the game should hold 60 fps (floor 45) with
   pose >= 15 Hz. The HUD prints fps; report the number.

**USER ACTION -- dolphin fixtures (still wanted).** The swim detector
ships with synthetic-stream tests plus false-positive checks on all
existing fixtures; its POSITIVE fixture evals await these recordings
(specs identical to the rowing protocol -- portrait 1080x1920@30, ~3 s
still lead-in/tail, counts spoken or noted): `torso_wave_slow.mp4` (12
waves, ~24-30/min), `torso_wave_fast.mp4` (24 waves, ~50-60/min),
`dive_surface_leans.mp4` (6 fwd + 6 back holds), `roll_turns.mp4` (6 L +
6 R holds), `seated_swim.mp4` (12 seated waves + 2 fwd/2 back leans),
`breach_attempts.mp4` (3 attempts: ~5 fast waves then a hard 2 s
back-lean). Drop in `fixtures/dolphin/` and run
`node packages/body-input/tools/fixture-eval.mjs` + the dolphin suite.
