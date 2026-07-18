# TRACK_E_MOTION_CAMERA_SPEC_REPORT.md

## 1. Executive summary

Ordinary swimming in *Ecco the Dolphin: Defender of the Future* (Appaloosa Interactive; "Designed and Developed by Appaloosa Interactive. Created with Game World Builder™, © 2000 Appaloosa Interactive," per the Dreamcast manual credits) feels good because of a specific, reproducible mechanism, not vague "fluidity." The documented control model is a **pulse-to-accelerate, hold-to-cruise longitudinal system decoupled from a flight-style facing-only steering stick**: the analog stick only rotates Ecco's *facing* (inverted "flight-sim" pitch), while forward motion comes from repeatedly tapping/holding the swim button (A on Dreamcast, X on PS2). The official Dreamcast manual states verbatim (Maneuvering, p.8): "Pressing the A Button quickly and repeatedly makes Ecco accelerate. Each time you press Button A, Ecco will swim faster. To maintain your current speed you can hold down the A Button and Ecco will swim at a steady pace." This separation of *aim* from *thrust*, combined with momentum retention, glide, forward-biased steering, banking, animation that reads as a real dolphin, and a chase camera that sits close behind and slightly above, is the load-bearing cause of the pleasure. This spec turns that into numerically dialable BodyArcade values for Three.js 0.184.

Two version facts are firmly documented: PS2 maps swim to X, charge to O, sonar to Square, view-change to Triangle, roll to L1/R1, look to L2/R2, and special maneuvers to the right stick; Dreamcast maps swim to A, charge to B, sonar to X, special to Y, camera to the D-pad, and look to the triggers, with two selectable control types (A/B). The camera on both versions is a **trailer camera** — the Dreamcast manual (p.10, The Camera) states verbatim: "Trailer Camera - Tap the Directional Pad. This is the default camera mode. The camera stays right behind the dolphin at all times and points in the direction Ecco is facing." It has an optional **remote camera** (fixed-distance, cinematic, laggy) and an above-water mode.

The recommendation is a **hybrid impulse+cruise longitudinal model** (discrete tail-pump impulses that decay by drag, with a hold-to-maintain target speed), **facing-led steering with velocity that chases facing** (so the body visibly leads the velocity vector during turns), **procedural spine/roll/pitch layered additively over authored swim/idle/breach clips via the Three.js AnimationMixer**, and a **critically damped spring chase camera** with asymmetric damping, look-ahead along smoothed velocity, distance that grows with speed, and raycast collision. Every original-engine constant is unrecoverable and is given as [REC]/[EST], never as a measured Ecco value.

## 2. Authority, scope, and evidence labels

**Scope.** This document governs Track E: movement feel and camera dynamics for BodyArcade Dolphin mode. It defers to Track D on visual composition (framing bands, atmosphere, the protected jeantimex water surface) and preserves those constraints. Where Track D defers camera *feel* to Track E, this document supplies it and flags conflicts explicitly.

**Evidence labels:** **[DO]** Direct observation from the supplied Track E extraction; **[BVM]** Bounded visual measurement from the extraction; **[DOC]** Documented external fact; **[EST]** Estimate from evidence/practice; **[REC]** Recommended BodyArcade value (NOT an original-engine measurement); **[UNR]** Unresolved.

**Honesty constraint.** No recommended number is described as a recovered original-engine value. Ecco is never said to have "used" a spring constant, drag coefficient, or velocity threshold. The supplied local extraction is authoritative for what is *visible* in the PS2 footage; its [INF]/[UNC] items are preserved as inference/unresolved and never promoted to fact. The local files could not be re-opened by this agent at authoring time; where this report cites the extraction it relies on the task brief's summary of its contents and labels those [DO]/[BVM] as instructed.

## 3. Source-quality and research-method statement

**Tier-1 primary:** The official Dreamcast manual (Internet Archive full text; ManualsLib) documents the Dreamcast control map, "press or hold A to accelerate," the 180° turn, slow/reverse, super roll, and the three camera modes (Trailer, Remote, Above-Water) plus Side/Backward look. Strongest source for intent.

**Tier-2 contemporary:** GameSpot Dreamcast/PS2 reviews; Sega-16 retrospective (pulse-then-hold tail pump; Panzer-Dragoon-style view rotation; two D-pad camera options with a laggy second); Wikipedia's sourced facing-only stick description. Corroborate the manual and describe resulting feel.

**Tier-3 secondary:** GameFAQs guides (DolphinPrince PS2 map; Xythar/LTill Dreamcast, "inverted flight-sim controls," "each press = one tail pump"); Metacritic/MobyGames user reviews (camera-too-close, turns-too-fast — used as anti-principles).

**Technical-implementation literature (current):** Three.js official docs (AnimationMixer, AnimationAction, AdditiveAnimationBlendMode, AnimationUtils.makeClipAdditive); Ryan Juckett and Daniel Holden ("Spring-It-On") on damped springs; Game Programming Gems 4 critically-damped smoothing (Unity SmoothDamp); Little Polygon and Game Developer camera write-ups (look-ahead, asymmetric damping); Steve Swink's *Game Feel* (ADSR input envelope; input/response/context/polish taxonomy). Peer-reviewed dolphin kinematics informs procedural posing only where it changes a feel decision: Gazzola et al. 2014 ("Scaling macroscopic aquatic locomotion") established the U ≈ A·f linear scaling (slope ~0.4); the 2023 *Nature Communications* review "Scaling the tail beat frequency and swimming speed in underwater undulatory swimming" (article s41467-023-41368-6, ~1,200 individuals) finds "a crossover in size around 0.5–1 m... the frequency can be tuned between 2–20 Hz... predicts a maximum swimming speed around 5–10 m·s⁻¹ for large swimmers."

**Forum-grade (labeled):** NeoGAF/ResetEra on PS2-vs-DC framerate. Where sources disagree, disagreement is preserved. Fan-wiki claims used only when consistent with the manual.

## 4. Ranked load-bearing movement principles

Why ordinary movement is pleasurable, ranked by estimated contribution/confidence:

1. **Thrust/steering decoupling (pulse to go, stick to aim).** [DOC] Stick changes only facing; forward speed is a separate pulsed button. The single most distinctive property. High confidence.
2. **Momentum retention + glide persistence.** [DOC/EST] Releasing thrust lets Ecco "drift to a slower speed"; velocity decays gradually. High confidence it exists; exact decay [UNR].
3. **Repeated propulsion impulses vs. constant thrust.** [DOC] "Each press corresponds to a pump of Ecco's tail." Rhythmic input embodies the animal. High.
4. **Forward-biased steering with body leading velocity.** [EST] Turning re-aims facing; velocity chases with lag, producing arcs and slip. Medium.
5. **Animation-led responsiveness / believable body.** [DOC] Reviewers repeatedly say "Ecco looks like a real dolphin." High.
6. **Banking/roll and broad pitch authority.** [DOC] Full inverted pitch, explicit roll, near-vertical, upright hover. Medium-high.
7. **Chase camera close behind and slightly above, pointing where Ecco faces.** [DOC] The default trailer camera; also the source of the main complaint (too close/fast). High; feel needs modernization.
8. **Breach continuity (seamless underwater→air→re-entry with retained momentum).** [DOC] Leaping, aerial flips, splash-differentiated re-entry. High.
9. **Surface attraction / buoyant readability.** [EST] Surface approach and tailwalk give a reference plane. Medium.
10. **Level composition giving motion reference points.** [DOC] Rock "roads," spires, arches, sand billowing under flukes, reflections. Medium-high.
11. **Audiovisual feedback (swoosh, splash-by-angle, sonar chirp).** [DOC] Tightens the loop. Medium.
12. **Controlled exaggeration over simulation.** [EST] Homing charge, snappy 180°, aesthetic flips. Medium.

## 5. What the supplied PS2 evidence directly establishes

Per the brief's description of the extraction (25 overview-atlas pages, 9 dense-sequence pages, 393 overview frames, 180 dense frames, 12 clips, 9 dense windows at ~0.20 s):

- **[DO]** The chase camera sits behind and slightly above the dolphin and frames it centered, consistent with Track D bands (≈8–18% width, ≈40–60% height).
- **[DO]** Two bounded breach sequences exist with *different* visible airborne durations; must not be collapsed into one fixed duration.
- **[DO]** Ecco exhibits banking/roll into turns and a wide pitch range including near-vertical ascent/descent and surface breach.
- **[BVM]** Breach airborne durations are bounded but differ between the two captured sequences (exact seconds are in the extraction; treat as a *range*).
- **[BVM]** Screen-space coverage and vertical placement fall within Track D's bands.
- **[INF → preserved as inference]** Propulsion appears impulse-driven; glide persists after apparent thrust release; camera distance appears to change with speed. Remain [EST]/[UNR] here.
- **[UNC → preserved]** True propulsion onset, acceleration curve, tail-pump cadence, animation-state thresholds, world-space velocity vs. facing, camera spring/damping constants, collision-response rules, obstruction algorithm, breach-height input, and post-entry control recovery are explicitly unresolved and NOT reconstructed as fact.

This agent could not re-open the MP4s, controller input, or engine state; no claim asserts inspection of those. All numeric camera/physics constants are [REC]/[EST].

## 6. External record: controls, movement, camera, and version differences

### 6.1 PS2 control map [DOC — DolphinPrince GameFAQs, corroborated]
X: Swim (tap to accelerate; hold to maintain). O: Charge (homing dash/attack/higher jumps). Square: Sonar (talk; map on hold; tractor beam on double-tap-hold). Triangle: Change view (cycles trailer/remote/fixed). Left stick: Move = change facing (flight-style; left/right yaw, up/down pitch, inverted). L3: Next objective. R3: Manual correct (recenter behind). Right stick: Up = Super Roll; Down = Quick stop (moving)/swim backward (stationary); Left/Right = 180° quick turn. L1/R1: Roll left/right. L2/R2: Look left/right; both = look back. Start: Pause. Select: Compass.

### 6.2 Dreamcast control map [DOC — official manual]
Analog pad: Up=dive, Down=climb (inverted), Left/Right=turn (facing-only). A: Accelerate (press repeatedly to speed up; hold to maintain; release to drift slower). B: Charge. X: Sonar. Y: Special. Special maneuvers: Y+Up=Super Roll; Y+Down=slow/reverse; Y+Left/Right=180°; Y+Trigger L/R=roll. Triggers L/R: Look; both=look back. D-pad: tap cycles Trailer↔Remote; long-press toggles Above-Water. **Two selectable configs (Type A/Type B)**; reviewers noted Type B gives "more freedom of movement." Out-of-water acrobatic set: Up/Down=roll fwd/back, Left/Right=spin, triggers=roll, A/B=slower/faster rotation, X=chirp, Y=stop.

### 6.3 Movement model [DOC]
Propulsion is **repeated-tap to build, hold to sustain, release to coast** ("drift to a slower speed"). Steering is **flight-style, facing-only, camera-independent**; the stick re-aims, never translates. **Roll is directly player-controllable** (largely aesthetic but real). **Reverse exists** only from a standstill. **Substantial rotation while nearly stationary** is supported (tailwalk hovers upright). **180° quick turn** is a discrete scripted maneuver. **Charge** is a short homing burst above cruise; also jumps higher.

### 6.4 Camera model [DOC]
**Trailer (default):** directly behind, points where Ecco faces; "best for gameplay due to responsiveness." **Remote:** looks at Ecco from a *fixed distance*, allows side-on body, "more graceful, cinematic," but with tracking delay. **Above-water:** hovers above the surface for aerial views. **Side/Backward look:** triggers pan without changing travel. **Documented complaints (anti-principles):** camera "right on him" makes it hard to see ahead; "spazzy"/"unstable"; Ecco can get "stuck in walls" and turn "too fast."

### 6.5 Version differences [DOC + forum-grade]
- Control *scheme* differs by necessity (DC triggers/D-pad vs PS2 dual-stick/shoulder). CONFIRMED.
- PS2 adds right-stick maneuvers and Triangle view cycling; DC uses Y-combos and D-pad camera. CONFIRMED.
- PS2 generally holds ~30 fps vs DC's jitterier framerate; PS2 sharper textures, altered sonar/water effects; some reviewers found no significant difference. PARTIALLY SUPPORTED / disagreement preserved.
- PS2 had "level changes"/"better map." PARTIALLY SUPPORTED.
- No source establishes a difference in *core swimming physics*. UNVERIFIABLE that they differ; treat feel as shared.

## 7. Core swimming model

**Units.** Work in **dolphin body-lengths (BL)**; 1 BL ≈ the GAMICO model's length. Conversion assumption: **1 BL = 2.5 world units (meters)** [REC], so rescale is one constant. Speeds are BL/s (meter equivalent at 2.5 m/BL in parentheses).

**Recommended: hybrid impulse + target-speed cruise.**
- Each propulsion event (tap, per-cycle-while-held, or body-pump gesture) adds a **discrete forward impulse** along *facing*.
- A **passive drag** term continuously decays speed toward zero → glide.
- **Hold** raises a *target cruise speed* the system eases toward, so sustained input feels like steady cruising, not infinite ramp.
- **Velocity is a world-space vector** continuously re-pointed toward *facing* at a bounded turn-follow rate (§9), giving momentum, arcs, and slip.

This reproduces principles 1–4 and matches the documented "tap to build, hold to maintain, release to drift." Rejected: pure continuous force (loses tail-pump rhythm); pure discrete impulses with no hold (contradicts "hold to maintain"); pure animation-root motion (fights body-input remap and deterministic replay).

## 8. Propulsion, cruise, glide, drag, and stopping

Intent: **Rest/Idle-Hover** (near-zero speed, tail idles, buoyant bob, full yaw/pitch authority); **Propulsion onset** (first impulse gives immediate readable acceleration — short ADSR "attack"); **Repeated pumps** (each adds impulse; drag smooths steps into a curve); **Cruise** (hold sustains target speed; small residual tail cycle); **Faster/Charge** (bounded speed above cruise, decaying back; enables higher breaches); **Glide** (drag-only decay, long, never instant); **Braking** (active decel far stronger than drag); **Low-speed reposition** (below min controllable speed, near-in-place re-aim and slow reverse). Numbers in Table A.

## 9. Yaw, pitch, roll, banking, curvature, and direction of travel

- **Facing** (quaternion) is driven by input. **Velocity** chases facing.
- **Turn rate depends on speed:** faster = wider effective arc (velocity reorients slower relative to facing); slow = tighter, more agile. We deliberately *lag* velocity behind facing at speed (addresses "turns too fast" twitchiness).
- **Pitch authority** is broad, including near-vertical; clamp just short of ±90° with a separate near-vertical mode to avoid gimbal/camera flips.
- **Roll/bank:** partly player-driven (explicit roll) and partly **auto-bank into yaw** (procedural), so turns lean like a real dolphin.
- **Body curvature:** procedural spine bend proportional to yaw rate, layered additively over swim clips.
- **Lateral slip:** the facing-vs-velocity gap during hard turns is intentional and visible.
- **Visual orientation ≠ velocity vector:** the mesh points along *facing* (plus bank/curvature); it travels along *velocity*. That divergence is the "graceful arc." See Table B.

## 10. Low-speed hovering and relaxed swimming

- Below min controllable speed, enter **Idle/Hover**: additive idle clip (slow tail, pectoral scull), gentle vertical bob (small sinusoid, *not* tied to the protected water surface shader), full rotational authority.
- **Tailwalk/upright hover** is documented; support an upright near-surface hover as an optional state.
- Relaxed cruising (the acceptance test) should require *little* input: one pump every ~1–2 s sustains a gentle glide, so "ordinary swimming without objectives" stays pleasurable and non-fatiguing — directly serving the 01_NEW_DECISIONS acceptance test.

## 11. Animation system and procedural posing

**Model.** GAMICO "Realistic Dolphin | Rigged with 25+ Animations" (creator GAMICO = Ali Aziz). [DOC, subagent] Sketchfab lists it as **CC-BY 4.0, free download, "fully rigged," 25+ animations**, "compatible with Unreal Engine, Unity, Blender." The **Fab.com** listing states **FBX** format. A subagent fetch reported the dolphin at ~4,300 triangles / ~2,400 vertices, but this figure could not be independently re-verified (a targeted re-check surfaced GAMICO's *other* "Rigged with 25+ Animations" models — Rhino 6.6k tris/3.3k verts, Crocodile 25.3k/13.1k, Compass 2.3k/1.3k — but did not return a fetchable dolphin-specific count); treat the dolphin tri/vert count as **[UNR] pending Track C file inspection**. **The individual animation clip names are NOT published in any fetchable text** (neither the dolphin nor GAMICO's analogous rhino lists clip names) — Track C must open the downloaded file and enumerate clips. [UNR: exact clip list.] Bone count and real-world scale are not stated. Attribution must credit "GAMICO" with a link per CC-BY.

**Authored vs. procedural split:**
- **Authored (expect from the pack, verify names):** idle, slow swim, cruise swim, fast swim, turn, breach/jump, roll/flip, possibly braking/attack/death. Use whichever exist; the rest procedural.
- **Procedural (layered additively via `AnimationUtils.makeClipAdditive` + `AdditiveAnimationBlendMode`):** spine curvature (yaw-rate driven), bank/roll, pitch pose, tail-phase/amplitude scaling, hover bob.

**Three.js approach:**
- One `AnimationMixer` per dolphin. Base locomotion clip cross-faded by speed band (`crossFadeTo`, ~0.2–0.4 s).
- **Do NOT map animation playback speed linearly to world velocity.** Scale `action.timeScale` to *tail-beat frequency*, which for real undulatory swimmers follows U ≈ A·f (Gazzola et al. 2014, slope ~0.4; the 2023 *Nature Comms* review reports tunable 2–20 Hz for sub-metre swimmers and top speeds ~5–10 m/s) — frequency rises sublinearly and saturates. Blend clip *weight* by speed and modulate `timeScale` in a bounded band (e.g., 0.7–1.6×), not 0–∞.
- Additive layers for curvature/bank/pitch use small-amplitude clips or procedural bone quaternion offsets applied after `mixer.update()`.
- Breach uses `LoopOnce` + `clampWhenFinished` for launch/re-entry poses, cross-fading back to swim on recovery.
- Pitfall [DOC forum]: setting `blendMode` on an already-created action can over-scale bones; convert clips with `AnimationUtils.makeClipAdditive(clip)` *before* creating the action.

**Continuous vs. stateful:** yaw, pitch, roll, curvature, tail phase, speed are **continuous parameters**; Idle/Propel/Cruise/Glide/Brake/Breach are **states** that select base clips and gate transitions.

## 12. Chase-camera composition constraints (defers to Track D)

Preserve Track D (subject to its attachment): centered chase framing; dolphin **8–18% of frame width**; **40–60% of frame height**; camera **behind and slightly above**; readability through colored fog and terrain; **the protected jeantimex water surface and waterline must not be replaced.** Track E sets *how the camera moves*; Track D sets *how the shot is composed*. Where dynamic behavior would push coverage/placement outside Track D bands (e.g., breach, terrain compression), treat the Track D band as the steady-state target the camera **returns to**, allowing transient excursions only during Airborne/Obstructed/TerrainCompressed states. No silent override.

## 13. Chase-camera dynamic behavior

**Recommended rig: target-follow spring camera with separated position and aim pivots.**
- Follow a **smoothed tracking point** (dolphin transform low-pass filtered), offset **behind facing and slightly above**, at distance that **grows with speed**.
- **Position** uses a critically damped spring (SmoothDamp-style) with **asymmetric damping**: quick to catch up when the dolphin pulls away, slower to settle ("fast in, slow out").
- **Aim** targets a **look-ahead point** offset along **smoothed velocity** (not raw facing), revealing where Ecco is going — addressing the "hard to see where you're going" complaint.
- **Roll:** camera does **not** copy dolphin roll (prevents nausea); may add ≤10% for flavor.
- **Distance damping** is separate from positional damping, so speed-based dolly is smooth and independent of catch-up.
- **Targeting mixture (the recommendation):** filtered transform for position, smoothed velocity for look-ahead, facing as a minor aim bias.
- **Recenter:** R3-equivalent (or a body gesture) eases the camera back directly behind facing over a short time.
- **Near-surface/above-water/breach/re-entry** transitions blend parameter sets over a fraction of a second, matching the game's dedicated above-water camera. See Table C and §19.

## 14. Terrain, caves, obstruction, and collision behavior

- **Gentle seafloor contact:** soft push-out + slight upward reorient; never a hard stop. (Original let Ecco get stuck — do NOT copy.)
- **Frontal rock contact:** decelerate and slide, preserving intended direction (project velocity onto surface tangent).
- **Glancing / wall following:** slide along walls; keep facing under player control.
- **Wedging:** detect low-speed multi-contact and auto-nudge toward open space; never trap the player.
- **Narrow passages / cave ceilings:** compress camera distance (TerrainCompressed) rather than clip.
- **Camera collision:** sphere-cast/raycast from tracking point to desired camera position; if blocked, pull the camera in along the ray (Three.js community pattern). Prefer dolly-in over teleport.
- **Line-of-sight obstruction:** briefly reduce distance or fade the occluder; avoid losing the subject behind terrain (a documented original failure).
- **Avoid sudden inversions** near vertical/ceilings: clamp pitch, use near-vertical mode.
- Distinguish: *historically supported* (camera behind, distance change, above-water mode); *visible but ambiguous* (exact collision response); *modern correction needed* (no wedging, no lost target, no spazzy flips). See Table C.

## 15. Surface approach, breach, airborne motion, and re-entry

Chain: **Underwater cruise → SurfaceApproach → Crossing (waterline) → AirborneAscent → AirborneApex → AirborneDescent → ReEntry → UnderwaterRecovery.**

Documented/observed:
- **[DO]** Two bounded breach sequences with **different airborne durations** — height/airtime variable, not fixed.
- **[DOC]** Higher/faster breaches come from **charge** ("jumping higher up in the air," "jumping higher when boosting"). So **breach height depends on approach speed** (and charge).
- **[DOC]** In-air: aerial flips/rolls/somersaults, tailwalk, sonar chirp. Aerial control largely aesthetic.
- **[DOC]** Re-entry splash differs by angle; "you can feel Ecco's weight" via angle-dependent splash SFX.
- **[EST]** Retained horizontal momentum carries through the arc; gravity governs the parabola; brief control settle on re-entry.

Recommendations:
- Breach requires a **minimum approach speed** and an **upward approach angle** near the surface; below threshold, produce a **failed/shallow breach** (partial emergence, immediate fall-back).
- **Launch impulse** = f(approach speed, charge). Airborne = ballistic with retained horizontal velocity and **reduced but nonzero pitch/roll authority** for tricks.
- **Do NOT collapse the two observed durations into one constant**; expose airtime as speed-driven with a bounded range.
- **Camera:** switch toward above-water framing on Crossing; keep the arc readable; brief splash occlusion allowed; recover after UnderwaterRecovery.
- **Control lockout** minimal — only a short re-entry settle. See Table D.

## 16. Body-controlled input mapping

BodyArcade uses camera-derived body signals (leanX, leanY, crouch, tallness, armsOut, armsRaised, handsForward, handPoint, stillness, neutralConfidence, confidence). Map the *fantasy*, not every axis.

**Principles:** understandable in seconds; usable seated where practical; resist accidental breach/dive; tolerate noisy tracking via dead zones, hysteresis, low-pass filtering, dwell, confidence decay; graceful, non-fatiguing (no held T-pose); accessibility fallbacks.

### Default mapping ("Lean-to-swim")
- **Yaw:** `leanX` → facing yaw rate (dead-zoned, curved).
- **Pitch:** `leanY` (torso pitch) → facing pitch (inverted like the original, or user-toggle). Lean forward = descend, back = climb.
- **Propulsion:** rhythmic `handsForward` pushes OR gentle repeated forward torso bob → tail-pump impulses; sustained mild `handsForward` = hold-cruise.
- **Braking/Hover:** `crouch` (pull in) → active brake toward hover.
- **Breach:** deliberate **`tallness` + `armsRaised` rising gesture while at speed near the surface**, gated by dwell (~0.3 s) and speed threshold, so it can't fire by accident.
- **Optional sonar:** `handPoint` dwell.
- **Camera correction (recenter):** `armsOut` briefly, or dwell on neutral.
- **Neutral cruising:** `neutralConfidence` high + within dead zones → gentle auto-glide (serves the acceptance test).

### Alternate mapping ("Hands-fly," reduced torso mobility / seated)
- **Yaw/Pitch:** `handPoint` / hand offset → facing.
- **Propulsion:** repeated `handsForward` pulses.
- **Breach:** both `armsRaised` (dwell-gated).
- **Brake/Hover:** hands drawn to chest.
- All torso-lean bindings have hand equivalents for wheelchair/seated play.

**Safety/robustness:** every mapped action has a dead zone, hysteresis (separate on/off thresholds), a confidence gate (ignore input when `confidence` < threshold; decay to neutral on loss), dwell for discrete/dangerous actions (breach), and a neutral-return timer easing facing/roll back toward level on sustained neutrality. See Table E.

## 17. Three.js architecture

Preserve BodyArcade's existing simulation architecture, body-input integration, accessibility systems, deterministic replay, and tests. Add small composable modules with a clean physics/presentation split.

```
DolphinMovementController   // facing, velocity, impulses, drag, braking; step(input,dt):MotionState
OrientationController       // facing quat; velocity-chases-facing; auto-bank; curvature
AnimationController         // AnimationMixer; base clip by speed band; additive curvature/bank/pitch; tail timeScale
BreachStateMachine          // Underwater..UnderwaterRecovery; launch impulse f(speed,charge)
CameraRig                   // spring position + look-ahead aim + speed-distance; state-set blending
CameraCollision             // sphere/raycast from tracking point; dolly-in on block
SurfaceDetector             // waterline crossing; near-surface flags (reads, never mutates jeantimex surface)
TerrainCollision            // push-out, slide (project velocity on tangent), anti-wedge
BodyInputAdapter            // signals -> SwimInput; dead zone/hysteresis/filter/dwell/confidence
TuningConfig                // all [REC] constants in one hot-reloadable object
DebugInstrumentation        // overlays: speed, facing vs velocity, camera springs, states
DeterministicReplay         // record SwimInput + seed; fixed-step; reuse existing harness
```

```ts
interface SwimInput { yaw:number; pitch:number; roll:number; thrust:number; brake:number;
  charge:boolean; breach:boolean; recenter:boolean; confidence:number; }
interface MotionState { position:Vec3; velocity:Vec3; speedBL:number; grounded:boolean; }
interface OrientationState { facing:Quat; bankAngle:number; spineCurve:number; slip:number; }
interface CameraPose { position:Vec3; target:Vec3; up:Vec3; fov:number; }
```

**Performance (60 fps @ ~1728×1080, WebGL2):** one mixer per dolphin; cap camera raycasts (sphere-cast or ≤4 rays); fixed-step physics decoupled from render; reuse Vector3/Quaternion temporaries; few additive bones. **Physics/presentation separation:** movement + camera math run on the deterministic fixed step; AnimationMixer/`timeScale`/additive posing run in presentation and never feed back into physics (preserves replay).

## 18. Consolidated implementation parameter tables

Speeds in BL/s; 1 BL = 2.5 m [REC]. All values [REC]/[EST] — none are recovered Ecco constants.

### Table A — Movement
| Parameter | Evidence | Label | Start | Range | Reasoning | If too low | If too high | Validation |
|---|---|---|---|---|---|---|---|---|
| Max cruise speed | "hold to maintain" [DOC] | [REC] | 4 BL/s (10 m/s) | 3–6 | Torpedo-like but readable | Sluggish | Camera can't keep up | Time-across-distance |
| Faster/charge speed | "charge beyond top" [DOC] | [REC] | 7 BL/s | 5–9 | Bounded burst; higher breach | Charge pointless | Loss of control | Charge test |
| Propulsion impulse | "each press = tail pump" [DOC] | [EST] | +0.9 BL/s/pump | 0.5–1.5 | ~4–6 pumps to cruise | Fatigue | One tap = full speed | Pumps-to-cruise |
| Passive drag (glide) | "drift to slower" [DOC] | [EST] | τ≈2.0 s to half | 1.2–3.5 | Long graceful glide | Sticky/stops fast | Never slows | Coast-distance |
| Active braking | quick-stop [DOC] | [REC] | 0 in ~0.6 s from cruise | 0.3–1.0 s | Snappy not instant | Can't stop in caves | Jarring | Stop-distance |
| Min controllable speed | reverse/hover [DOC] | [REC] | 0.3 BL/s | 0.1–0.6 | Hover/reverse threshold | Twitchy | Can't hover | Hover test |
| Charge duration | short burst [DOC] | [EST] | 1.2 s | 0.6–2.0 | Bounded boost | Useless | Trivializes travel | Charge test |

### Table B — Orientation and turning
| Parameter | Evidence | Label | Start | Range | Reasoning | If too low | If too high | Validation |
|---|---|---|---|---|---|---|---|---|
| Low-speed yaw rate | agile slow [EST] | [REC] | 140°/s | 90–200 | Tight slow re-aim | Unresponsive | Twitchy | Slow-turn |
| Cruise yaw rate | facing-only [DOC] | [REC] | 90°/s | 60–130 | Readable arcs | Can't corner | "turns too fast" | Cruise-turn |
| Rapid 180° | scripted [DOC] | [DOC/REC] | ~0.4 s | 0.25–0.6 | Combat utility | Slow | Disorienting | 180° test |
| Pitch rate | broad [DOC] | [REC] | 100°/s | 70–160 | Free vertical | Can't dive | Chaos | Pitch test |
| Max pitch clamp | near-vert [DO] | [REC] | ±85° | ±80–89 | Avoid gimbal/flip | Can't go vertical | Inversions | Near-vertical |
| Bank angle (auto) | banking [DO] | [REC] | ≤35° at max yaw | 20–50 | Dolphin lean | Stiff | Rolls over | Turn-bank |
| Roll response | roll manual [DOC] | [REC] | 0.3 s to bank | 0.15–0.5 | Smooth lean | Laggy | Snappy | Bank settle |
| Velocity-follows-facing | momentum+slip [EST] | [EST] | 0.35 s cruise (longer fast) | 0.2–0.7 | Arcs & slip | No momentum | Uncontrollable | Slip test |
| Orientation smoothing | — | [REC] | facing slerp 0.1 s | 0.05–0.2 | Removes jitter | Laggy | Jitter | Jitter test |
| Spine curvature gain | curvature [DO] | [REC] | 1.0 at max yaw | 0.5–1.5 | Body leads turn | Rigid | Rubbery | Visual |
| Near-zero-speed rotation | rotate in place [DOC] | [REC] | full authority | — | Reposition/hover | Stuck | — | Stationary-yaw |

### Table C — Camera
| Parameter | Evidence | Label | Start | Range | Reasoning | If too low | If too high | Validation |
|---|---|---|---|---|---|---|---|---|
| Default follow distance | close trailer [DOC] | [REC] | 3.5 BL | 2.5–6 | Behind, within Track D | Too close | Loses intimacy | Coverage 8–18% |
| Follow height | "slightly above" [DOC] | [REC] | 0.8 BL | 0.4–1.5 | Track D vertical band | Sees floor only | Top-down | Placement 40–60% |
| Distance at max speed | grows w/ speed [EST] | [REC] | 5.5 BL | 4–8 | Speed readability | No speed sense | Subject tiny | Fast-travel |
| Look-ahead distance | "hard to see ahead" [DOC] | [REC] | 2.5 BL on smoothed vel | 1–4 | Reveal path | Blind ahead | Off-center | Step-turn |
| Positional damping (catch-up) | responsive [DOC] | [REC] | t90 0.18 s | 0.1–0.35 | Quick catch-up | Laggy | Rigid | Step-turn |
| Positional damping (settle) | asymmetric [DOC] | [REC] | t90 0.45 s | 0.3–0.8 | Smooth settle | Jittery | Sluggish | Stop test |
| Rotational (aim) damping | smooth aim | [REC] | t90 0.25 s | 0.15–0.5 | Smooth look | Laggy | Whip | Turn test |
| Distance damping | separate dolly [DOC lit] | [REC] | t90 0.6 s | 0.4–1.2 | Smooth zoom | Pumping | Rubber-band | Accel test |
| Recenter time | R3 manual correct [DOC] | [REC] | 0.5 s | 0.3–0.9 | Ease behind | Snap | Slow | Recenter |
| Obstruction dolly-in | avoid lost target [REC] | [REC] | t90 0.15 s | 0.08–0.3 | Fast un-clip | Clips | Jumpy | Corridor |
| Camera collision radius | sphere-cast [DOC lit] | [REC] | 0.3 BL | 0.2–0.5 | Prevent poke-through | Clips | Over-dollies | Wall test |
| Surface transition blend | above-water [DOC] | [REC] | 0.3 s | 0.2–0.6 | Smooth swap | Pop | Mushy | Breach test |
| Breach camera pullback | aerial [DOC] | [REC] | +1.5 BL | 0.5–3 | Show arc | Cramped | Tiny dolphin | Breach test |
| Re-entry recovery | brief settle [EST] | [REC] | 0.6 s | 0.3–1.2 | Regain follow | Abrupt | Woozy | Re-entry |
| Camera roll copy | avoid nausea [DOC lit] | [REC] | 0–10% of dolphin roll | 0–15% | Comfort | Flat | Nausea | Comfort |

### Table D — Breach
| Phase/Param | Evidence | Label | Start | Range | Reasoning | If too low | If too high | Validation |
|---|---|---|---|---|---|---|---|---|
| Min approach speed | charge→higher [DOC] | [REC] | 3 BL/s | 2–4 | Gate breach | Accidental | Can't breach | Approach sweep |
| Approach angle | upward [EST] | [REC] | ≥25° up | 10–45 | Clean exit | Belly-flop | Vertical only | Angle sweep |
| Launch impulse | durations differ [DO] | [EST] | v_up=0.6·speed+charge | tune | Variable airtime | Weak hop | Rocket | Multi-speed |
| Gravity | ballistic [EST] | [REC] | 9.8 m/s²(→BL) | 6–14 | Believable arc | Floaty | Slams | Arc test |
| Airborne pitch/roll authority | tricks [DOC] | [REC] | 60% underwater | 30–90% | Tricks not steering | Stiff | Full flight | Trick test |
| Airtime | two differ [DO/BVM] | [BVM→EST] | 0.8–2.0 s by speed | keep range | NOT one constant | — | — | Multi-speed |
| Splash occlusion | angle splash [DOC] | [REC] | 0.2 s | 0.1–0.4 | Weighty splash | No impact | Blinds | Re-entry |
| Control lockout entry | minimal [EST] | [REC] | 0.2 s | 0–0.4 | Settle only | Jarring | Punitive | Recovery |
| Failed/shallow breach | below threshold | [REC] | partial emerge+fall | — | Graceful failure | Nothing | — | Low-speed approach |

### Table E — Body-input mapping
| Signal | Normalize | Dead zone | Curve | Hysteresis | Confidence | Action | Safety guard | Seated fallback | Calibration |
|---|---|---|---|---|---|---|---|---|---|
| leanX | ±30°→±1 | 0.12 | quad | ±0.08 | gate<0.5 | Yaw | clamp rate | handPoint X | Lean-hold |
| leanY | ±25°→±1 | 0.15 | quad | ±0.08 | gate<0.5 | Pitch | clamp; invert toggle | hand Y | Lean-hold |
| handsForward | pulse detect | 0.2 | rhythm→impulse | refractory 0.25 s | gate<0.5 | Propulsion | rate cap | same | Pump-rate |
| crouch | 0–1 | 0.25 | linear | ±0.1 | gate<0.5 | Brake/Hover | — | arms-in | Crouch |
| tallness+armsRaised | combined | 0.3 | threshold | dwell 0.3 s | gate<0.6 | Breach | speed+dwell gate | armsRaised only | Reach |
| handPoint | dwell | — | dwell 0.4 s | — | gate<0.6 | Sonar | — | same | — |
| armsOut | 0–1 | 0.3 | threshold | dwell 0.3 s | gate<0.5 | Recenter | — | same | — |
| neutralConfidence | 0–1 | — | — | — | — | Auto-glide cruise | neutral-return timer | same | Neutral |

### Table F — Evidence-to-implementation traceability
| Recommendation | Local evidence | External evidence | Inference | Remaining uncertainty | Replacement test |
|---|---|---|---|---|---|
| Pulse+cruise longitudinal | [DO] impulse-like | [DOC] "press or hold A"; "each press = tail pump" | Hybrid fits both | Impulse/drag values | Native onset+coast |
| Facing-led steering | [DO] arcs/slip | [DOC] "stick changes only facing" | Slip time [EST] | Real velocity-vs-facing lag | Native step-turn |
| Speed-dependent turn | [DO] wide fast turns | [DOC] "turns too fast" | Curve shape [EST] | Actual curve | Native turn sweeps |
| Close slightly-above trailer | [DO] framing | [DOC] manual trailer; Track D bands | Distances [REC] | Original distances | Native camera step-turn |
| Look-ahead on smoothed vel | — | [DOC] "hard to see ahead" | Modern fix | N/A | Playtest |
| Distance grows w/ speed | [INF] distance change | [EST] common practice | Not confirmed original | Whether original did this | Native accel |
| Variable breach airtime | [DO/BVM] two durations | [DOC] charge→higher | Speed-driven [EST] | height=f(speed) | Multi-speed breach |
| Auto-bank into turns | [DO] banking | [DOC] real-dolphin praise | Gain [REC] | Original bank amount | Native turn |
| No wedging / no lost target | [UNC] collision rules | [DOC] "gets stuck" | Modern correction | N/A | Regression |

## 19. State machines and transition tables

**Locomotion (states select clips/gates; yaw/pitch/roll/curve/speed continuous):**
- **Idle/Hover** → Propelling (thrust>0) | Braking (brake). Entry: speed<min.
- **Propelling** → Cruising (hold sustained) | Gliding (released) | Braking.
- **Cruising** → Gliding (release) | Propelling (new pump) | Braking | SurfaceApproach (near surface & ascending).
- **Gliding** → Idle/Hover (speed<min) | Propelling | Braking.
- **Braking** → Idle/Hover (speed≈0) | Propelling.
- **SurfaceApproach** → (to Breach machine) | Cruising (turned away).
- Turning/Ascending/Descending are **not** exclusive states — continuous modifiers active in any state.

**Breach:** Underwater → SurfaceApproach (near surface, ascending, speed≥min) → Crossing (waterline) → AirborneAscent → AirborneApex (v_up≈0) → AirborneDescent → ReEntry (waterline descending) → UnderwaterRecovery → Underwater. Cancellation: speed<min during SurfaceApproach → return Underwater. Failure: Crossing sub-threshold → shallow breach → immediate ReEntry.

**Camera:** NormalFollow ↔ SlowHover (speed<min); NormalFollow ↔ FastTravel (speed>threshold, distance grows); NormalFollow → TerrainCompressed (near ceiling/wall); any → Obstructed (LOS blocked → dolly-in) → back; NormalFollow → SurfaceTransition (Crossing) → Airborne → ReEntryRecovery → NormalFollow; any → EmergencyRecenter (target lost/extreme divergence → fast recenter). Blending: transitions cross-fade parameter sets over 0.2–0.5 s; EmergencyRecenter overrides damping to fast.

## 20. Anti-principles and historical behaviors NOT to copy

- **Camera too close/fast** obscuring what's ahead ([DOC]) → look-ahead + speed distance.
- **Spazzy/unstable camera, sudden angles** ([DOC]) → damping + clamps + no roll copy.
- **Losing the target behind terrain** → obstruction dolly-in / fade.
- **Getting stuck in walls / wedged; "turns the wrong direction"** ([DOC]) → slide + anti-wedge + preserve direction.
- **Camera clipping into geometry** ([DOC]) → sphere-cast collision.
- **Disorientation in caves / near-vertical inversions** → pitch clamp + near-vertical mode.
- **Opaque controls / finger fatigue from mashing** ([DOC]) → rhythmic body pumping with generous sustain; low input for cruising.
- **Punitive collision / control lockouts** → minimal re-entry settle only.

## 21. Historical fidelity vs. modernization

| Preserve closely | Preserve in spirit, modernize | Do NOT copy |
|---|---|---|
| Pulse-to-go / hold-to-cruise; facing-only steering; momentum & glide; visible body curvature; broad pitch; banking; breach continuity & variable airtime; charge as boost/higher-jump; upright hover/tailwalk; close-behind trailer framing | Camera lag/catch-up (add look-ahead & asymmetric damping); camera-distance change (smooth, speed-based); above-water camera (auto-blend); roll (flavor, don't force); 180° quick turn (keep, tune) | Camera clipping; lost target behind terrain; spazzy sudden angles; cave disorientation/inversions; wedging/stuck-in-walls; wrong-direction turns; finger-mashing fatigue; punitive collision |

## 22. Validation, instrumentation, and tuning protocol

**Instrumentation overlay:** live speed (BL/s), facing vs velocity vectors (and slip angle), each camera spring's target/current, active states, breach phase, and body-input raw vs filtered vs mapped.

**Controlled tests (record inputs + fixed-step trace):** propulsion onset (pumps-to-cruise, time-to-cruise); coasting (coast distance/time, drag τ); stopping (brake distance/time); slow/rapid turn (radius vs speed; 180° duration); pitch up/down; near-vertical; stationary yaw; wall following; corridor camera compression; obstruction recovery time; surface approach; **multiple breach speeds and angles** (verify variable airtime); re-entry recovery; body-input jitter injection; confidence-loss (neutral-return); seated parity.

**Acceptance ranges:** coverage 8–18% width, 40–60% height in NormalFollow; camera never intersects geometry; target never lost >0.3 s; no wedging; breach airtime tracks speed monotonically.

**Subjective feel tests:** "10-minute no-objective swim stays pleasurable" (01_NEW_DECISIONS acceptance test); "camera never surprised me"; "turning feels like a dolphin, not a flying camera"; comfort (no nausea) at length.

**Regression:** deterministic replay of recorded input traces must reproduce identical motion/camera traces after tuning (physics/presentation split guarantees this).

## 23. Contradictions and unresolved questions

- **Framerate parity PS2 vs DC:** sources disagree; preserved; irrelevant to BodyArcade's 60 fps target.
- **Does original camera distance change with speed?** [INF] in extraction, not confirmed by docs. Kept as [REC] modern choice.
- **Exact tail-pump cadence, acceleration curve, glide τ, animation thresholds, camera constants, collision rules, breach height=f(speed):** [UNR] — require native capture.
- **GAMICO clip names/bone count/scale/exact poly count:** [UNR] — Track C must open the file.
- **Whether extraction frame data refines any [BVM]:** this agent could not re-open the files; native re-measurement may adjust breach airtime bounds and coverage figures.

## 24. Native-capture replacement map

Priority-ordered (do NOT block first playable). Each: question / setup / action / pre-roll / post-roll / rate / reference geometry / measurement / parameter replaced / priority.

1. **Stationary→propulsion onset** — P1. Flat open water; from rest tap once; 1 s pre / 3 s post; 60 fps; scale bar. Accel curve → impulse & onset.
2. **Repeated pumps→cruise** — P1. Tap to top then hold. Pumps-to-cruise, time-to-cruise → Table A.
3. **Release→glide** — P1. Cruise, release, coast. Coast distance/τ → drag.
4. **Active brake/stop** — P2. Cruise then brake. Stop distance → braking.
5. **Slow turn (low speed)** — P2. Yaw rate/radius → Table B.
6. **Rapid turn at cruise** — P1. Turn radius & slip → velocity-follow time.
7. **Pitch-only ascent/descent** — P2. Pitch rate & max pitch.
8. **Near-stationary yaw** — P3. Confirm in-place rotation.
9. **Camera response to step turn** — P1. Catch-up/look-ahead → Table C.
10. **Camera response to stop** — P2. Settle asymmetry.
11. **Matched corridor obstruction** — P2. Dolly-in behavior.
12. **Confirmed wall collision** — P2. Slide/push-out.
13. **Matched breaches at several speeds/angles** — P1. Confirm airtime=f(speed) → Table D.
14. **Post-entry control & camera recovery** — P2. Lockout & recovery.
15. **Dense ordinary-motion windows** absent from current dense tier — P3.
16. **Synchronized controller-input capture** — P1 (disambiguates input vs result).

**First-playable-ready:** all Table A–E starts. **Require later replacement:** impulse/drag/braking exact values, velocity-follow time, camera damping constants, breach launch/airtime curve.

## 25. Answered
- PS2 and Dreamcast control maps (primary sources).
- Propulsion is pulse-to-build/hold-to-maintain/release-to-coast; steering is facing-only flight-style.
- Camera grammar: close trailer default, remote/above-water alternates, look modes; documented strengths and failures.
- Breach: charge/speed drives height; airtime variable (two observed durations differ); aerial control aesthetic; angle-based splash.
- Recommended hybrid movement model, facing-led steering, additive procedural animation over the GAMICO pack, spring chase camera with look-ahead and collision, full body-input mapping with safety, Three.js module architecture, and complete dialable parameter tables.
- GAMICO model license (CC-BY), format (FBX on Fab).

## 26. Open
- Exact original constants (all [UNR]) pending native capture.
- Whether original camera dollied with speed.
- GAMICO exact clip list / bone count / scale / verified poly count (Track C to enumerate from file).

## 27. Needs-user
- Confirm 1 BL = 2.5 m world-scale assumption (or supply the project's true dolphin length) so all BL values rescale.
- Confirm Track D's *attached* framing bands match the 8–18% / 40–60% figures used here.
- Confirm the BodyArcade signal package field names/ranges (leanX etc.) match Table E assumptions.
- Provide native captures per §24 to replace [EST]/[UNR] values.
- Decide default pitch inversion (match original inverted flight model, or non-inverted for accessibility).