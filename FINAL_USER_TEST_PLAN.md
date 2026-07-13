# FINAL USER TEST PLAN — one consolidated human pass
## Front matter
- Environment prep (branch/merge state, hardware, camera, lighting, ports)
- Region decision deadline status (§14): the Open World region defaults
  to **Ísafjörður, Iceland** (V2 world-data, 2026-07-11 — scoring in
  REGION_CANDIDATES.md; Friday Harbor, WA is the baked runner-up).
  Swapping regions is a cheap re-bake (`tools/worldbake` README) UNTIL
  V4's realistic art pass begins hand-tuning to the location — that
  milestone is the deadline. Name a personally meaningful place before
  then and it becomes the region; no action needed to accept the default.
- Estimated total time; recommended order (below)
- Evidence index: links to eval/results.json, screenshot boards,
  recordings, per-prompt EVAL_NOTES

### V1 (Runtime + HUD) environment — S1–S3, S11
- Branch `feat/pose-runtime-hud` in `~/Dev/wt-runtime` (unmerged; remote
  dev server runs from this tree). Lane ports: PosePuppet **5184**
  (5174 is squatted by an unrelated server — DECISIONS.md), flight suite
  5189, dolphin suite 5187.
- Tunnel from the Mac: `ssh -N -L 5184:127.0.0.1:5184 -i
  ~/.ssh/pinn_rtx3090 o@192.168.86.152` then open http://localhost:5184
  (app), /flight/, /flight/?row, /dolphin/.
- Camera + lighting: normal webcam session, front-lit, ~2–3 m back for
  full-body modes; games ask for the camera on load (that is the V1
  behavior under test).
- V1 evidence: eval/runtime-hud-perf.json (perf table),
  eval/results.json (post-extraction eval refresh), .local/shots/v1
  (screenshot board, gitignored — fixture footage), .local/*.log (suite
  runs incl. baselines), EVAL_NOTES.md §V1, DECISIONS.md §V1.
- Estimated V1 human time: ~35 min (S1 8 + S2 21 + S3 8 + S11 8, minus
  overlap).

### V3 (Walking Locomotion) environment — S8
- Branch `feat/walking-locomotion` in `~/Dev/wt-walking` (unmerged). Lane
  port **5175** (walking graybox dev server; tmux session `ba-walking`).
- Tunnel from the Mac: `ssh -N -L 5175:127.0.0.1:5175 -i
  ~/.ssh/pinn_rtx3090 o@192.168.86.152` then open
  http://localhost:5175/walking/ (live camera mode; `?drive=march&hz=0.9`
  replays the synthetic closed-loop drive if you want to see the rig
  without a camera).
- Camera + lighting: front-lit, ~2.5–3 m back so knees are visible for
  marching; the weight-shift/seated checks are done close-up on purpose.
- V3 evidence: eval/walking-results.json (synthetic chain eval + comfort
  envelope maxima), eval/bodyinput-results.json (gait false-positive rows
  on every existing fixture), media/walking-v3/ (screenshot board + webm,
  gitignored), tests/gait.spec.ts + tests/locomotion.spec.ts +
  apps/walking/tests (all green), EVAL_NOTES.md §V3, DECISIONS.md §V3,
  packages/locomotion/INTEGRATION.md.
- Estimated V3 human time: ~13 min (S8.1 6 + S8.2 4 + S8.3 3); S8.4 is an
  optional recording action (~10 min) whenever convenient.

### V4 (Open World) environment — S7, S9, S10
- Branch `feat/openworld` in `~/Dev/wt-openworld` (unmerged). Lane port
  **5176** (tmux `ba-openworld`; `cd ~/Dev/wt-openworld/apps/openworld
  && npm run dev -- --port 5176 --strictPort`).
- Tunnel from the Mac: `ssh -N -L 5176:127.0.0.1:5176 -i
  ~/.ssh/pinn_rtx3090 o@192.168.86.152` then open
  http://localhost:5176/openworld/ — profile + mode selectable in-page
  (top-left chips) or via `?profile=low-poly&mode=flight|walk|row|dolphin`.
  `?drive=flylap|walkroute|rowcircuit|swim` replays the synthetic
  closed-loop drives without a camera.
- Camera + lighting: same as the per-mode conventions — flight standing
  ~2 m back arms visible; walking ~2.5–3 m back knees visible; rowing
  seated is fine (the row page loads the FULL pose model); dolphin
  ~2.5–3 m back hips visible.
- V4 evidence: eval/openworld-results.json (headed :2 perf per
  profile/mode), apps/openworld/.shots/board/ (screenshot boards),
  apps/openworld tests (23 green), apps/openworld/TRANSITIONS.md +
  REUSE_MAP.md + PLAN.md, EVAL_NOTES.md §V4, DECISIONS.md §V4.
- Estimated V4 low-poly human time: ~25 min (S7.1–S7.6).

## Entry format (every deferred check uses this)
ID | Feature | Why human-only | Setup | Steps | Expected | Automated
evidence already collected | Risk if skipped | Est. minutes
## Sections (recommended order)
### S1  PosePuppet full app regression feel (post-runtime-extraction)

S1.1 | Full App puppeteering feel after the runtime extraction | Feel/latency judgment is human-only | Mac + Chrome, tunnel `ssh -N -L 5184:127.0.0.1:5184 …`, open http://localhost:5184 | Puppeteer normally for ~3 min: arms, leans, wrist rotations, a face-touch, hand-only mode swap, avatar switch, ghost duet, one recorded take | Identical to pass-2 feel: same latency, same smoothing, no new stutter or drift; camera panel, overlay, engineering view all behave as before | Root suite 110P post-extraction with the SAME two SwiftShader-only failures as the pre-extraction baseline (.local/o1-root.log vs .local/baseline.log); gpu-performance detect specs 2/2; pipeline order preserved by construction (EVAL_NOTES V1 O1) | A subtle retarget/smoothing regression ships in the flagship app | 5

S1.2 | Camera/file toggling + model swap through the runtime | Device-level camera re-acquisition timing is machine-specific | Same as S1.1 | "load video" a clip, back to camera; toggle full/lite model via ⌘K; toggle mirror | Every switch recovers tracking within ~2 s, no stuck black video, no double camera light | runtime start()/startVideoFile() paths covered by suite (avatar/detect/record specs green); single-gUM test | Camera lifecycle bug annoys every session | 3

### S2  Runtime + HUD across TinySkies / Rowing / standalone Dolphin (expand/collapse, keyboard access, camera-denied keyboard play)

S2.1 | Body control with NO PosePuppet tab | The V1 headline; trust needs a human witness | Tunnel, open http://localhost:5184/flight/ directly (fresh tab, nothing else open); allow camera | Fly with the body per the flight profiles; then http://localhost:5184/flight/?row and row seated; then http://localhost:5184/dolphin/ and swim | All three games fully body-controlled with only the game tab open; HUD bottom-left shows LIVE + pose Hz | Per-game hud.spec: page pipeline drives signals (dolphin kick counter advances from fixture cam); topology specs green | The core promise of V1 unverified live | 8

S2.2 | HUD interaction feel: expand/collapse, camera swap, keyboard parity | Overlay ergonomics are judgment | Any game running | Hover the HUD (expands), click stage (camera feed), Tab to it, Enter/Space collapse+open, `c` swap, Esc collapse | Interactions feel instant, never steal game keys, camera feed is mirrored and smooth; collapsed pill is unobtrusive during play | hud.spec mouse+keyboard assertions green in flight and dolphin | Fiddly overlay annoys every session | 4

S2.3 | Safe-area: HUD never overlaps game controls | Layout collisions are visual | Rowing (?row) — the busiest bottom edge | Row; watch the rowing feedback strip and the HUD together; collapse and expand | HUD sits clear of the rowing strip; nothing critical is ever occluded in any game | Screenshot board .local/shots/v1 (rowing-hud-live.png etc.) + vision self-review in EVAL_NOTES | HUD covers the stroke pulse exactly when needed | 2

S2.4 | Camera denied → keyboard play | Permission UX + real denial flow is browser-chrome-level | Fresh Chrome profile or site-settings camera=Block for localhost:5184 | Open each game with camera blocked; play on keys (flight WASD, rowing arrows, dolphin W/A/S/D/Shift) | Game plays normally; HUD reads CAMERA DENIED · KEYBOARD CONTROLS ACTIVE; no prompts loop, no console spam | Per-game denied specs green (--deny-permission-prompts); runtime-app denied spec | Camera-shy users bounce off the games | 4

S2.5 | Companion mode still clean (opened FROM PosePuppet) | Double-camera light is only visible physically | Open http://localhost:5184, ⌘K → fly/row/swim | Check the game works AND the camera light pattern: only the PosePuppet tab owns the camera; game HUD shows REMOTE FEED | One camera light, one pipeline; closing PosePuppet lets the game offer START CAMERA | Election unit path + ?pp=companion forceExternal; existing topology specs (producer tab + game) green | Two pipelines burn CPU and trust | 3

### S3  TinySkies flight feel re-check (nothing regressed)

S3.1 | Flight feel identical to the Gate-3-approved baseline | Feel is frozen (gate-approved values untouched — verify no interaction regression from the in-page runtime) | Tunnel, http://localhost:5184/flight/, camera allowed | Fly the Superman profile ~3 min: banks, climbs, dives, boost, dropout (step out of frame), re-entry, T-pose recenter | Exactly the approved feel; autopilot decay/re-entry unchanged; recenter toast unchanged; ~60 fps with the HUD up | Flight suite on :2 green post-retrofit (body/feel/replay/row specs); perf table eval/runtime-hud-perf.json: flight ~58-60 fps @ ~29 Hz pose in-page | Silent feel regression in the accepted game | 5

S3.2 | Rowing fps floor on Apple Silicon (the one open perf number) | The remote GL-ANGLE box near-misses the 45/15 floors for rowing's FULL model (41-43 fps @ 13-14 Hz, GPU-process contention — root-caused in EVAL_NOTES); the repo's cross-platform policy says final perf validation is Apple Silicon | Tunnel, http://localhost:5184/flight/?row, camera allowed, Activity Monitor or the fps readout | Row seated ~2 min; note the fps feel and any stutter during pulls | Smooth ≥45 fps rowing with strokes registering (Metal-ANGLE MediaPipe is materially faster than the Linux GL path); if it stutters, report it — the fallback lever is the in-page detection rate | Perf table + probe chain in EVAL_NOTES (main-thread 30 fps → worker 43 fps → residual is GPU contention, zero long tasks); strokes verified through the in-page chain (14 on rowing_slow.y4m) | Shipping a rowing floor miss nobody measured on the target hardware | 3

### S4  Character Control live: fingers on capable avatar, all seven face-touch targets, feet planting, capability labels truthful
_Entries deferred to V5 Character Control completion._

### S5  Motion Memory 2 creative session (trim, mirror, chorus, re-skin)
_Entries deferred to V6 Motion Memory 2 completion._

### S6  Recording v2 takes: one per presentation mode; cutout-on-stage
_Entries deferred to V7 Recording v2 completion._

### S7  Open World low-poly: flight, walking, rowing, dolphin, transitions

S7.1 | Region flight feel (reused TinySkies controls over Ísafjörður) | Feel is the frozen Gate-2/3 contract; only a human can certify no interaction regression from the new plane dynamics | V4 tunnel, http://localhost:5176/openworld/?mode=flight, camera allowed, stand ~2 m back | Fly ~3 min with the Superman profile (arms out): takeoff happens on its own; bank both ways along the fjord walls, climb over the plateau rim, dive to the water, hands-forward boost, cross a region edge on purpose (soft turn-back should carry you home), step out of frame mid-turn and back in | The approved flight FEEL: same lean response and autopilot decay as TinySkies; the region reads as Ísafjörður from the air (fjord, spit, runway); turn-back is gentle, never a wall; re-entry never snaps | flight.spec 4/4 (closed-loop lean lap, loss/reacquire, containment never exits); perf 60 fps headed :2; board low-poly-flight.png | A feel regression in the most-approved control system ships into the new flagship surface | 5

S7.2 | Walking the settlement (V3 locomotion in-world) | Nausea/comfort is human-only (S8.1 is the graybox twin; this is the in-context check) | Same, ?mode=walk, ~2.5–3 m back, knees visible | March through the settlement ~2 min; lean-steer through a street corner; stop dead; weight-shift with legs out of frame; step out of frame mid-walk and back | Horizon NEVER tilts or bobs; eye height only moves on a deliberate crouch; streets/buildings read as a place; assist keeps you near the walkable line without fighting deliberate leans; dropout eases to a stop and resumes without a lurch | walk.spec 3/3 (network spawn, closed-loop march + lean turns + envelope caps in-world, dropout with zero tilt every sample); locomotion package suite (V3) green | A comfort failure in the flagship walking surface poisons every profile | 4

S7.3 | Rowing the fjord (completed Rowing logic + SDF shore guard) | Stroke registration strength and coxswain-yield are feel judgments (the Gate-2 lessons) | Same, ?mode=row (page loads the FULL pose model), seated is fine | Row ~2 min seated: steady strokes, one-sided lean holds, rest mid-water (cruise should hold), then row deliberately at the shore and stop fighting | Every pull surges the boat; cruise holds momentum on rest; a held lean carves and is never reversed; near the shore the water pushes back and steers you out — never beached, never trapped; keyboard arrows take over instantly anytime | row.spec 3/3 (closed-loop stroke circuit through the real StrokeDetector, cruise, shore-guard never-beach); RowingControls reused byte-identical | The rowing Gate-2 round-2 fixes silently regress in the new water | 4

S7.4 | Dolphin in the fjord (PS2 dolphin, real bathymetry) | Kick-rhythm connectedness and containment feel are the Dolphin gate's human checks, re-run in the new sea | Same, ?mode=dolphin, ~2.5–3 m back, hips visible | Swim ~3 min: kick waves to cruise, dive/surface leans, banked turns, one breach attempt (sprint + hard back-lean near the surface), one run at the shore, step out of frame ~2 s mid-swim | The SF-gate feel in the fjord: kicks surge with your rhythm, glide is long, containment is water that pushes back (no wall), the breach fires with commitment, dropout levels out and never banks up kicks | dolphin.spec 4/4 (real-bathymetry agreement, closed-loop torso-wave, containment burst); STANDALONE dolphin suite 12P/4S green post-seam | The adapted seam subtly changes the accepted dolphin feel | 4

S7.5 | Transitions: fly → land → walk → dock → row → dive → dolphin → surface | The full loop's continuity-of-place is a lived judgment; the fade rhythm can only be felt | Same, start in ?mode=flight | Fly to the airfield, land (low + slow, press F when offered); walk to a dock (minimap shows docks), F to row; row to a dive point, F to dive; surface near the point, F back to the boat | Each handoff: the coach offers it only when genuinely there; the veil names the incoming mode; you arrive WHERE you were (apron/dock/dive point); the whole loop needs no keyboard except F; nothing snaps or teleports visibly | transitions.spec 4/4 (all legs incl. a flown landing approach; dolphin leg gated to low-poly); TRANSITIONS.md documents the honest-handoff law | A broken handoff strands the four modes as four separate demos | 5

S7.6 | Camera denied + HUD truthfulness in the Open World | Permission UX is browser-chrome-level; HUD-vs-reality needs eyes | Fresh profile or site-settings camera=Block for localhost:5176 | Open each mode with the camera blocked; play each on keys (flight WASD+arrows, walk WASD, row arrows, dolphin WASD/Shift); then allow the camera and cover it mid-play | Every mode fully playable on keys with camera blocked; HUD reads CAMERA DENIED · keyboard states match reality within ~1 s; the privacy line (LOCAL INFERENCE · NO UPLOADS) is visible whenever the HUD is open | Runtime+HUD mount spec green; per-mode keyboard-parity specs green; V1 denied-path specs cover the shared runtime | Camera-shy users bounce off the entire Open World | 3

### S8  Walking comfort test (explicit nausea check — human-only by nature)
_V3 graybox entries below; V4 will append Open World in-context entries._

S8.1 | Marching walk comfort — the explicit nausea check | Vection/nausea judgment is human-only; the automated yaw-rate/acceleration envelopes are proxies, not the answer | V3 tunnel (front matter), http://localhost:5175/walking/, camera allowed, ~2.5–3 m back, knees visible | March in place ~2 min at a comfortable pace along the path; lean to steer through both S-curves; stop/start several times; one fast-march burst; watch the horizon the whole time | Speed follows the march without rubber-banding; turns are smooth and obviously capped (never a snap); the horizon NEVER tilts or bobs; eye height only moves on a deliberate crouch; the corner vignette during turns is subtle, not annoying; no queasiness after 2 min | Comfort caps enforced in-model and property-tested under adversarial input (tests/locomotion.spec.ts); full-chain envelope maxima vs caps in eval/walking-results.json (comfort_adversarial_30s all-pass); closed-loop path-follow spec; media/walking-v3 board + webm with vision self-review (EVAL_NOTES §V3) | A comfort failure inherited by every Open World profile | 6

S8.2 | Weight-shift walking + seated lean-glide (accessibility fallback) | Whether kneeless locomotion feels controllable (not twitchy) is feel judgment | Same, then sit at the desk / step close enough that your legs leave frame | Standing close: shift weight rhythmically side to side → you should walk (HUD SRC reads SWAY); then sit: lean forward to glide, sideways to steer, upright to stop | Weight-shift walking engages within ~2 shifts and stops when you stop; seated glide engages ~1 s after a deliberate forward lean, steers with lateral lean, and never creeps while upright | Sway-substrate synthetic eval row (walking-results); graybox sway + glide specs green; fixture-eval gait negatives hold leans/crouches/sitting at ≤1 step | Desk and seated users cannot walk the Open World | 4

S8.3 | Tracking loss, T-pose recenter, keyboard fallback — live | Physical step-out timing and re-entry feel are room/machine specific | Same setup, mid-walk | Step fully out of frame ~2 s (status → SIGNAL LOST, coach explains, walk eases to a stop); step back in and resume marching (no lurch); hold a T-pose ~1 s (toast: "Neutral recaptured"); tap W/A/S/D anytime — KEYBOARD takes over instantly, body resumes ~1.5 s after keys go quiet; also try it with the camera covered from the start | No snap anywhere: the stop is gentle on a held heading, re-entry blends in ≤ ~0.5 s, recenter toast fires once, keyboard drives immediately including with the camera blocked | Dropout row in eval/walking-results.json (stop ≤ 2.5 s at decel ≤ 1.3 m/s², heading drift < 5°, snap-free recovery under the yaw-accel cap); graybox dropout + camera-denied specs green | Loss-of-control moments poison trust in body walking | 3

S8.4 | USER ACTION — optional gait clips (positive real-clip validation) | Only you can record you; synthetic streams + negative rows carry the automated case meanwhile | Phone, portrait 1080×1920@30, ~3 s still lead-in and tail, FULL body incl. feet, front-lit; drop files in fixtures/walking/ | Record: `march_slow.mp4` (20 steps at ~60 steps/min), `march_fast.mp4` (30 steps at ~120/min), `weight_shift.mp4` (16 deliberate weight shifts, feet planted), `walk_lean_turns.mp4` (steady march with alternating ~4 s lean holds) — counts spoken aloud or noted | After dropping the clips, positive gait rows get added to `node packages/body-input/tools/fixture-eval.mjs` and detected step counts land within ±1 of your labels (the rowing protocol's bar) | Detector thresholds stay tuned only against synthetic + negative footage | 10 (recording) — eval wiring is the agent's follow-up

### S9  Realistic profile: flight/walk/row, lighting/atmosphere judgment
_Entries deferred to V4 Open World realistic profile completion._

### S10 Fantasy profile: the one-second-clip charm test per mode
_Entries deferred to V4 Open World fantasy-game profile completion._

### S11 Privacy: network-zero receipt, local-inference messaging, HUD privacy state accuracy

S11.1 | Privacy receipt still truthful post-extraction | Reading the receipt against DevTools is a human check | App open with DevTools Network tab | Confirm "LOCAL · 0 EXTERNAL REQUESTS SINCE LOAD" stays 0 through a full session (takes, ghosts, model swap) | Zero external requests; receipt never lies | Receipt is unchanged code; suite green; models/wasm load same-origin (design) | Trust feature silently broken | 2

S11.2 | HUD "LOCAL INFERENCE · NO UPLOADS" accuracy on game pages | The claim spans the whole page, not just the runtime | Game page + DevTools Network | Play each game 2 min with the Network tab filtered to non-localhost | No off-origin requests at all (flight offline.spec asserts this for flight); HUD line always visible when open | flight offline.spec (zero off-origin) green on :2; boundary tests: wire carries derived signals only, landmark-free deep scan | A "local" claim that is false anywhere kills the story | 3

S11.3 | HUD tracking/privacy states match reality | State-vs-reality can only be eyeballed | Any game live | Cover the camera (SIGNAL LOST), step out (REACQUIRING→LOST), deny camera (CAMERA DENIED), open via PosePuppet (REMOTE FEED) | Every displayed state matches what is physically true, within ~1 s | hud.spec state assertions; screenshot board denied/live/remote states | HUD that lies about tracking is worse than no HUD | 3

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
