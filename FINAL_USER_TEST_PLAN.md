# FINAL USER TEST PLAN — one consolidated human pass
## Front matter
- Environment prep (branch/merge state, hardware, camera, lighting, ports)
- Region decision deadline status (§14): open — no region baked yet (V2
  in flight); the override window stays open until V4\x27s realistic art
  pass begins.
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

**V5 environment** — branch `feat/character-control` in `~/Dev/wt-charcontrol`
(unmerged), lane port **5177**. Tunnel: `ssh -N -L 5177:127.0.0.1:5177 -i
~/.ssh/pinn_rtx3090 o@192.168.86.152`, then http://localhost:5177. V5
evidence: eval/results-v5-baseline-headed.json vs
results-v5-final-headed.json (canonical, = eval/results.json;
sync/perf/feet/socket tables), results-v5-final-fusion-on.json /
-off.json (fusion perf + finger-curl correlation),
results-v5-final-feet-off.json (skating comparator),
.local/v5-*.log (suite + eval runs), .local/shots/v5
(astronaut/erika open-vs-fist screenshots behind the manifest decision),
EVAL_NOTES §V5, DECISIONS §V5. Estimated S4 human time: ~18 min.

S4.1 | True finger tracking on erika | Finger read/latency is a feel judgment; webcam lighting differs from fixtures | Mac + Chrome, tunnel, open http://localhost:5177/?avatar=erika, hands ~1 m from camera | Open/close each hand slowly, then fast; make a fist; point with the index; wiggle single fingers; drop hands out of frame and back | Individual fingers visibly follow within a beat (12 Hz fusion + smoothing); fist and point read cleanly; hands leaving frame fall back to open/fist approximation without a pop; no fps drop that changes the puppet feel | charcontrol.spec fusion test (applyCount grows, gate open); eval fingerCurl r + inputRange on hand fixtures (results-v5-fusion-on.json); perf ON/OFF rows | The V5 headline feature never validated by the person it mirrors | 4
S4.2 | Capability gate honesty on astronaut/robot | A human must see that NOTHING pretends to be finger tracking | Same tunnel, ?avatar=astronaut then ?avatar=robot | Repeat S4.1's finger motions on each | Mitt/glove opens and closes as one unit (pass-2 behavior); no partial-finger artifacts; the card chip + coach line state the limitation before you try | spec: fusionGated=true + fingerApplyCount=0 on astronaut; manifest mislabel checks; card wiring assertion | A silent capability lie on stage | 2
S4.3 | Seven face-touch gestures on erika | Contact placement/easing quality on a live body is judgment | ?avatar=erika, calibrate, face fully visible | Touch: left cheek, right cheek, chin, cover mouth, forehead, temple, under-chin; hold a thinking pose (fist under chin ≥ 1 s); then shadowbox fast past your face | Hand lands on the matching spot of erika's head, glides between spots (no teleport), NEVER enters the head; thinking pose reads after the hold; punches never trigger face magnetism | synthetic seven-socket sweep: all classified, zero interpenetration frames on erika (charcontrol.spec); facetouch.mp4 eval per-socket table + capsule penetration counter | The showcase gesture set unverified against a real face | 4
S4.4 | Astronaut face-touch limitation reads as labeled | Whether "presses into the helmet" is acceptable on camera is a product-feel call | ?avatar=astronaut | Touch cheek/forehead/chin | Contact visibly presses into the giant helmet (documented geometry: helmet r 0.385 m > arm reach 0.35 m); the card says Face-touch limited; nothing snaps or explodes | manifest faceTouchNote; limited-class sweep (classification+engagement pass, depth reported); baseline comparison | An honest label that still LOOKS broken ships unseen | 2
S4.5 | Feet planting kills skating (full-body) | Skating is a visual artifact judged live | Tunnel, ?body=full (or ⌘K → full body), stand ~3 m back, feet visible | Stand still and sway hips; shift weight side to side; take two small steps left, two right; lift one foot and hold | Planted feet stay pinned while hips sway (no ice-skating); weight shifts read as a subtle hip pop; small steps relocate the avatar; a lifted foot releases cleanly and replants without a pop | feet plant/lift/replant spec; skating metric (net planted-ankle slide px/window, 7-27x reduction) on fullbody.mp4 on/off in EVAL_NOTES §V5 | The stated "feet that plant" outcome never watched on real legs | 3
S4.6 | Manifest labels vs reality, end to end | Truthfulness of every chip against live behavior is the human's call | Cycle all avatar cards | For each card: read chip + note, then try exactly what it promises/denies | Every chip and note matches what the stage does — nothing more, nothing less | caps:check green (manifest ⇄ live rig); mislabel injections caught by capability-manifest.spec | Trust in every future capability label | 3

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
