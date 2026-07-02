# Eval notes

### P2/P3 FPS floor verdict (2026-06-12, display awake)
Deferred floor check completed (results-p3-motion.json, envThrottled=false,
6×60 s headed, all P2+P3 features on): pose 29.35–29.73 fps on every run
(baseline 28.46–29.78 — unchanged), sync within noise on all six rows
(e.g. arms/robot 9.49→9.48), detection 100%, zero console errors. Render
readings now track ProMotion's adaptive refresh (59.5–119.5 across runs);
torso/robot at 119.51 fps with everything enabled demonstrates the render
loop kept its full headroom — the 59.x rows are the display at 60 Hz, not
load. FLOORS HOLD; nothing becomes opt-in.

## P5 — recording director (2026-06-12)
The app now helps create the clip. GUIDED TAKES are data
(src/director/scripts.ts): Character (7 shots incl. face-touch, shadowbox,
mid-take avatar switch), Ghost Duet (perform → duet with your ghost →
final pose), Talking Puppet (hand mode). The director runs framing check →
3-2-1 countdown → serif shot prompts over the stage (the type system's
identity moment) with progress in the take bar; shots auto-advance on
timers, space skips, esc stops. HANDS-FREE: the gesture/intent SEED layer
(src/gesture/intent.ts) has exactly one consumer, as chartered — raise
both arms ~1 s to start the mode's default take, cross wrists at the
chest to stop; a stillness signal is exposed for future shot-advance;
found+fixed an init bug where intents were suppressed near t=0
(lastFired=0 vs -Infinity — caught by the unit test). FRAMING CHECK:
camera-coach language ("Step back so your legs are visible — this take
uses your whole body"). ASPECT PRESETS: the composite recorder now takes
16:9 (1920×1080 side-by-side) and 9:16 (1080×1920 stacked, camera above /
stage below — how clips actually travel); palette toggles it; vertical
files carry a -vertical name tag. PACKAGING (all toggleable): 0.55 s
serif title stinger in, 1.5 s end card out ("ALL INFERENCE LOCAL —
NOTHING UPLOADED"), corner badge, grain+vignette grade matching the
interface atmosphere; chrome auto-dims during recording. POSE POSTER
('p'): slow quarter-orbit then a designed 4:5 still — mono labels, 1px
frame, serif mark, privacy line — local PNG. CAPTION HELPER: after a clip
saves, the coach offers one-click copy of an honest caption (local string
assembly). Verification (tests/director.spec.ts): intent unit tests
(start/stop/stillness), BOTH aspect presets produce nonzero playable
files, and the character take runs shot-by-shot to a nonzero recording.
Suite 55 passed / 5 skipped. Screenshots media/board-p5/. Honest gap: the
hands-free gestures are unit-tested on synthetic landmarks; no fixture
clip contains the real gestures — the P8 filming session is the live
proof.

## P4 — Motion Memory (2026-06-12)
One system, four features. Architecture decision (DECISIONS.md): loops
record the retargeting pipeline's INPUT — mirrored, smoothed landmarks,
int16-quantized (~400 B/frame) — not per-bone quaternions. Replaying
through a second Retargeter reproduces the take on ANY rig, so re-skin is
exact by construction and the current exaggeration/settings apply at
playback. Always-on 12 s ring buffers (pose + hand); named loops persist
to IndexedDB via structured clone (typed arrays as-is, fully local).

GHOST DUET: ⬡ ghost in the take bar (or 'g') loops your last 8 s on a
translucent violet copy of the current avatar — the Memory hue doing its
job — beside the live one. ECHO CHORUS: the Memory rail slider turns the
single ghost into up to 4 staggered echoes (300 ms apart) — a motion
delay line; nearly free once ghosts exist, spectacular on waves. INSTANT
REPLAY: ↺ replay (or 'i') hides the live avatar, moves the stage camera
to a side angle, and plays the last 5 s at 0.4× with 3 tight echoes
(120 ms) as motion trails, center stage; the stage restores itself after.
Found in test: the camera/hide must flip BEFORE awaiting the ghost VRM
builds or the replay looks dead for the first seconds. RE-SKIN: saved
loops list in the Memory rail — ▸ plays any loop on the CURRENT avatar;
record on the astronaut, switch to the robot, the robot performs it.

Round-trip check (tests/memory.spec.ts): a synthetic waving fixture is
recorded through the real ring buffer and replayed through a second
avatar's retargeter — enacted bone trajectories match the live recording
with mean < 5° / max < 12° (measured: passes), and int16 quantization
error stays sub-millimeter. Suite 49 passed / 5 skipped, zero console
errors through ghost/echo/replay exercises. Screenshots media/board-p4/.
Upper-body loops are the honest scope: legs replay too when the loop was
recorded in full-body mode, otherwise they idle (same rule as live).

### Gate-3 live-test fixes (2026-06-12)
Lekan's live report → six root causes, all fixed and re-verified:
1. VRM finger curls bent backwards → curl axes now COMPUTED per segment
   from the rig's own geometry (palm plane × bone direction, sign toward
   the palm). Verified on Seed-san (real fingers: fist closes correctly);
   the astronaut turns out to have MITTEN hands — no finger geometry to
   move at all — which becomes an honest capability chip ("Fingers not
   supported", both default avatars) and a roster gap to fill at P6/Gate 4.
2. Face-touch hovering at the chest (robot), through the helmet
   (astronaut), wrong-side gap when turned → head collider now comes from
   real geometry (robot: authored skull sphere; VRM: skinned-vertex
   sampling — a bbox of the head bone sees nothing on skinned meshes, so
   the astronaut had been using the 0.12 m default inside its big helmet),
   contact targets are placed from the head CENTER not the pivot, and the
   front-hemisphere bias uses the person's own face normal (ears→nose)
   instead of camera-z. Re-verified: reach 99.8%/100%, penetration 0/0.
3. Exaggeration fidgety at 2.0, arms folding through the body, phantom
   lean-back → dead zone (no scaling under ~8°, so rest noise is never
   amplified), soft knee (full scaling to ~55°, none past ~110°), gentler
   overshoot, and chest pitch is no longer scaled at all.
4. Beaky's mouth never fully closed → pinch auto-ranging (session min/max
   with slow re-adaptation). pinch→jaw r improved 0.886→0.899.
5. Avatar crossfade showed the old avatar through the new one → fade-out
   only: the new avatar is opaque from frame one; the old one fades with
   depthWrite off + depthTest on + late renderOrder, so hidden parts stay
   hidden.
6. Re-entry fidget after occlusion → bones slerp at half rate during the
   re-acquisition window (the detector's own re-convergence wobble was
   driving the rig). Arms sync 9.77° on a 45 s window — within noise.
Suite 47 passed / 5 skipped. All six verified by eval or screenshot.

## P3 — hand-only mode and creatures (2026-06-12)
A first-class second mode. HandLandmarker (21 landmarks, Apache-2.0, same
postinstall family as the pose models — ASSETS.md) drives one hand; the
pose detector never starts in hand mode (it hallucinated a torso from a
hand and polluted eval sync rows — caught and gated). The mode has its own
stage treatment (violet rim, closer camera, deeper background), its own
roster cards with capability notes, the chain's detection cell relabels
POSE→HAND, and the camera overlay draws the 21-point hand skeleton.
Decision (DECISIONS.md): true finger tracking ships HERE only — character
mode keeps the P2 pose-landmark approximations; dual-model cost isn't
worth it this pass.

ROSTER: (1) expressive hand — stylized robot glove following all 21
landmarks, segments re-posed between smoothed joints, lit fingertips;
(2) beaky — the talking bird: palm aims the head, thumb–index pinch is
the jaw, glowing crest blades ride a follow-through spring, idle
look-around + breathing when the hand leaves; center-weighted position
(half travel, clamped) after footage showed full mapping walking it off
frame; (3) x-ray self-portrait — additive cyan wireframe skeleton with
bright joints and a violet lagged trail (a one-line motion delay line),
opacity pulse when lost.

METRIC: pinch→jaw Pearson correlation, sampled per hand-frame from the
retargeting layer's own signals. hand_pinch_point.mp4: r=0.886 (n=849);
hand_open_close.mp4: r=0.937 (n=863) — both clear the r≥0.8 bar; 100%
hand detection on both clips, ~29.5 hand-fps (clip-capped), 0 errors.
tests/handmode.spec.ts: each puppet boots on the hand fixture and tracks
without errors; mode switch back to character restarts pose tracking
(found a real race: clicking the mode buttons before boot finishes hits
unbound handlers — test now waits for the mode system, a UX TODO noted
for P6 onboarding).

Screenshots media/board-p3/ (beaky/hand/xray on the violet stage). Suite
47 passed / 5 skipped, tsc clean. Display woke mid-phase: render readings
recovered (59–85 fps), so the deferred P2 FPS floor check is running as
a full 6×60 s re-measure (results-p3-motion.json) — numbers in the next
entry/commit.

## P2 — motion core + expressiveness (2026-06-12)
The puppet got better hands, a body, and a pulse. All sync numbers below
are honest per-frame geometry (valid regardless of machine state); the
FPS floor re-check is deferred — see the throttle note at the end.

OCCLUSION RECOVERY: the decay path became pose continuity — angular
velocity coast (τ=0.25 s) into pull-to-rest, joint limits (120° from rest,
clamped on both target and enacted bone — the slerp path between two
in-limit orientations can bulge past the limit, found by test), and
re-acquisition that BLENDS from the held pose to live over up to 0.5 s,
scaled by how long tracking was lost (a 50 ms flicker recovers almost
instantly — without that, arms sync regressed 9.49→11.09°; with it,
9.57° = within noise). tests/occlusion.spec.ts runs the synthetic dropout:
settle → 2.5 s loss → relax under 4°/tick → re-acquire under 10°/tick,
back on pose within 1.2 s.

FACE-TOUCH: proximity magnetism (engage 1.15→0.6 shoulder-widths,
smoothstep easing) into a two-bone IK blend with per-avatar arm lengths
and a head-collider radius from the head subtree bbox; the contact target
sits 1.18 R outside the skull, so the hand cannot pass through. The
forearm converts against the PREDICTED upper-arm frame (with big IK
corrections the stale frame landed the hand short — robot went 48%→100%
reach after the fix + criterion alignment). facetouch.mp4, 60 s, both
avatars: reach 100%/100%, penetration 0/0 (engaged frames 478/467).
Astronaut visually lands hand-on-chin; robot reads as reach-to-collar
(its head floats above the body — geometry, not a bug; live gate judges).

FULL BODY/FEET: legs gained foot bones driven by ankle→toe landmarks
(synthesized standing rest dir, 50° swing clamp; robot got real foot
pivots), eval gained leg limbs in the sync metric + ?body=full wiring.
fullbody.mp4 30 s: legsMean robot 5.60° / astronaut 6.21°, upper 6.4/7.9°
— legs track about as well as arms.

EXPRESSIVENESS: exaggeration slider (1.0–2.0, rail 'Expression' section,
persisted) scales swing amplitude with a speed-coupled overshoot boost,
chest at half rate, clamps everywhere; squash-and-stretch hint (≤5%
compress on fast moves, restores exactly); motion-energy EMA exposed for
velocity VFX later. Robot antenna is a real 2-DOF damped spring driven by
head velocity. Idle life: robot breathing bob; VRM periodic randomized
blinks (expressionManager, where the model has blendshapes); micro chest/
head sway fades in 1.5 s after tracking loss — the avatar never freezes.
Avatar switch crossfades materials over 0.45 s while the re-acquisition
ramp blends the pose — no pop. Perf auto-tuner: pose FPS <22 for 5 s →
coach offers one-click lite model + reduced effects (body.perf-lite drops
blur/halos/grain).

HAND STATE: open/fist/point estimated from pose landmarks alone
(fingertip reach / forearm length, EMA-smoothed); VRM avatars curl real
finger chains through the humanoid map (index stays out when pointing),
the robot's mitt flattens/balls. No second ML model yet — that's P3.

Suite: 48 tests, 43 passed / 5 skipped, tsc clean. Honest caveat: every
headed FPS reading this session collapsed to ~30 regardless of content —
blank-page rAF probes confirm environment throttling (display asleep or
locked), so the P2 before/after FPS table is DEFERRED; eval/run.mjs now
probes for this and stamps results.meta.envThrottled so a throttled run
can never silently pose as floor evidence. Floors get verified the next
time the display is verifiably awake (next session start or P3 close).

## P1 — design system rolled out (2026-06-12)
Gate 2 approved; the glass-cockpit shell is live on the real app. Token
system both themes; self-hosted variable fonts (Inter/JetBrains Mono/
Fraunces, OFL, in ASSETS.md); command bar (serif wordmark, mode selector,
privacy receipt, controls); stage hero with viewfinder ticks + mono label;
camera panel docked inside the stage as the input signal (LIVE chip,
TRACKING/CAM footer); right rail with avatar cards (capability chips:
robot/astronaut "Fully supported", woody "Experimental · local"), coach
card, privacy line; take bar carrying the live signal chain
CAM▸POSE▸SMOOTH▸RIG▸RENDER▸REC (signature element — REC lights red while
recording, POSE goes red on signal loss); engineering view (#panel) in
the mono language, toggleable ⚙/d, eval untouched; ⌘K command palette +
single-key shortcuts (r/c/a/t/d/m/f/v); theme persisted in config.
Two real bugs found by looking: (1) Chromium composites an opaque
background on the accelerated-video layer y-flipped over the WebGL canvas
(feed-sized hole at the mirrored position) — fixed by keeping that layer
backgroundless, comment pinned in styles.css; (2) lazy font-subset loads
arrive after fonts.ready and falsely dirtied the receipt — receipt now
counts EXTERNAL (cross-origin) requests, which is the actual trust claim
(DECISIONS.md). Verification: automated contrast checks pass both themes
(tests/design.spec.ts), reduced-motion smoke passes, keyboard focus
visible, suite 41 passed/5 skipped. Screenshot board media/board-p1/
(dark/light/narrow/recording/palette/engineering — local, gitignored).
Vision critique: cockpit reads, accents stay role-bound, narrow width
holds; nits noted (REC button wraps at 1024px, engineering panel overlaps
rail) for later polish. Perf with the new UI on (eval/results-p1-ui.json
vs eval/results.json baseline): pose 29.5-29.7 fps (unchanged), render
118-119 (slightly up), sync within noise, detection 100%, 0 console
errors — floors hold, nothing becomes opt-in.

### P1 design gate — plan + mockups (2026-06-12)
DESIGN_PLAN.md translates the reference grammar (1px rules, shared-border
grids, three type roles, glass chrome, grain/vignette, light+dark) into the
mandated vibrant palette: graphite base, glass panes, electric blue / cyan /
violet / pale-green accents bound to roles (action / signal / memory /
privacy) — no warm hues anywhere. Signature element: the take bar as an
instrument strip carrying a live CAM▸POSE▸SMOOTH▸RIG▸RENDER signal chain.
Mockups (design/mockups/shell-{dark,light,take}.png, synthetic content
only): dark and take-state passed vision review on first pass — the
take-state serif shot prompt is the type system's identity moment working
as intended; the light theme failed it (pale stage washed out the avatar)
and was revised once to the NLE-viewer pattern (deep stage inside light
chrome). Gate-2 artifacts committed; full rollout blocked on approval.

### P0 addendum — new inputs verified, Gate 1 closed (2026-06-12)
design/reference.css arrived (1,013 lines; grammar as described — token
theme, 1px rules, Fraunces/Inter/JetBrains Mono roles, grain/vignette,
light+dark via data-theme; its warm paper palette is explicitly NOT carried
over per the palette law). The four new clips arrived as 1620×1080@30 H.264
.mov, were remuxed to .mp4 and converted to y4m via prepare-fixtures.
Frame inspection confirms each matches its spec (open/close fist cycles,
pinch-talk + pointing, hips-up face touches at a desk, head-to-feet full
body — fullbody's background is heavily blown out but detection doesn't
care). 30 s sanity eval, robot, headed (eval/results-newfixtures-sanity.json):
facetouch 100% detection / 4.98° upperLimbs, fullbody 100% / 6.71° —
better sync than the arms fixture itself; hand clips stream at full rate,
and their pose rows (71–81% detection, 49–66° sync) are BlazePose
hallucinating a torso from a hand — expected, harmless, and exactly why
P3 uses HandLandmarker on them. No blockers → USER GATE 1 approved with
electives B1+B2 and the woody local-only demotion.

## P0 (pass 2) — inspect, baseline, honesty guards (2026-06-12)
Repo inspected end to end (~3k lines; reading + attachment points recorded
in PLAN.md §1). Suite was red at P0: the five generated-avatar load smokes
required gitignored local-only candidate VRMs that are no longer on disk —
they now skip when the file is absent; suite green 37 passed / 5 skipped,
tsc clean. First 9-run baseline attempt caught a real honesty bug: woody's
VRM load failed intermittently, setAvatar's catch only console.warn'd and
quietly measured the robot under woody's name (sync values robot-identical,
the tell). Fixed before trusting any number: per-file VRM names
('vrm:woody'), failed avatar loads are console.error (eval counts them),
run.mjs records avatarRequested and exits non-zero on mismatch. Guarded
re-run (60 s × 3 fixtures × robot/astronaut/woody, headed, Apple M5, GPU):
detection 100% on all 9, pose 28.5–29.8 fps (clip-capped), render
114–118 fps, memory flat, zero console errors, zero mismatches. Sync
upperLimbsMean — robot 9.49/2.24/18.87°, astronaut 10.92/2.29/20.38°,
woody 9.02/2.14/17.88° (arms/torso/fast) — all under the pass-1 bars on
all three avatars; full table in PLAN.md §2 and eval/results.json
(pass-1 finals archived at eval/results-pass1-final.json). Screenshot
media/p0-before-redesign.png (local, media/ gitignored) records the
pre-redesign shell as the design-gate "before". Missing inputs found and
specced for USER ACTION: design/reference.css and the four new fixture
clips (hand_open_close, hand_pinch_point, facetouch, fullbody) — exact
re-record specs in PLAN.md §3. Woody redistributability flagged as R1
for the Gate-1 decision.

## M5 — Hand/wrist expressiveness (2026-06-10)
Added `leftHand`/`rightHand` bone driving across all avatars (robot, astronaut,
Woody). The retargeter now builds a palm orientation from BlazePose landmarks
17–22 (pinky, index, thumb tips) and applies it as a wrist twist relative to
the forearm. Configurable `wristGain` (default 1.25) amplifies the rotation;
angular clamping at ±80° prevents unnatural spinning. Hand bones use slightly
slower slerp (70% of arm rate) for a natural lag feel. Visibility gating with
hysteresis ensures smooth relaxation to rest when hand landmarks go out of
frame. Debug panel updated with hand bone offset sliders and wrist gain tuner.
VRM loader now logs bone capabilities at load time — console shows which bones
were found/missing for each avatar.

**Important limitation**: This is wrist/palm orientation derived from BlazePose
pose landmarks, NOT full hand or finger tracking. The six landmarks used
(indices 17–22) are fingertip positions from the body pose model, sufficient to
infer palm facing direction and wrist twist, but not individual finger
articulation. Real finger animation would require MediaPipe Hands or a
dedicated hand-tracking pass. If a VRM's hand bone exists in the skeleton but
does not visibly affect the mesh, the issue is likely skinning/vertex weighting
in the source VRM/FBX model rather than retargeting.

## M4 — VRM avatar (2026-06-10)
Avatar: "Astronaut" 048 from 100Avatars R1 (CC0 — the license is embedded in
the file's own VRM meta; full provenance in ASSETS.md), driven through the
same Retargeter behind the Avatar interface via RAW humanoid bones. The one
real bug: three-vrm's humanoid.autoUpdateHumanBones defaults true and copies
the static normalized rig over the raw bones every vrm.update(), freezing
the model in T-pose — disabling it brought the astronaut to life with zero
other changes. Combined 60s×6 eval (robot/vrm per fixture, headed, M5 GPU):
all M4 bars met on BOTH avatars — arms 9.51°/10.86°, torso 2.17°/2.28°,
fast 19.18°/20.26° (bars ≤15/≤15/≤25), detection 100%, pose ~29.5 fps,
render ~117 fps, zero console errors. Vision review (12 VRM frames across
all fixtures): hands-up, single-arm raise, guard and punch poses all mirror
correctly with real elbow articulation; the side turn reads beautifully
(helmet in profile) and the deep lean lands with a head dip; no candy-wrapper
twist, no possession. Honest notes: the astronaut's stylized short limbs
read ~1° worse than the robot on the metric and make extreme reaches look
compressed; springbone antenna adds charm for free. Switcher robot↔astronaut
is instant and Playwright-tested (skips gracefully when the gitignored VRM
isn't downloaded).

## M3 — calibration + robustness (2026-06-10)
Driven by the M2 live-test gate report (lean-right and side turns dying live,
legs requested). Root cause for the torso failures was not the rotation math
(sign-symmetric, now pinned by unit tests) but the visibility gates: desk
occlusion of hips or a dimmed far shoulder killed the whole body frame and
decayed chest and limbs to rest. Fixes: shoulders-only body-frame fallback,
shoulder gate 0.5→0.4, per-axis chest clamp (yaw 65°, lean 45°, pitch 30°).
Dense 10-frame torso review: deep lean fully enacted with head tilt, and the
~90° side turn now visibly reads on the robot where the old 55° total clamp
ate it. Eval after the changes is unchanged within noise — arms 9.37°, torso
2.22°, fast 18.96°, detection 100%, pose ~29.5 fps, render ~118 fps — so the
robustness came free. New: legs (raw-mirrored-space targets, gated on the
full-body toggle + per-bone visibility; knee-raise unit test), neutral-pose
calibration (3-2-1 countdown; held pose maps to rest — verified by unit
test), per-bone offset sliders persisted to JSON, video-file input button.
media/m3-calibration.png shows the panel with the new controls live. Honest
caveat: the lean-right fix addresses the diagnosed gate-kill mechanism, but
the fixtures contain no clean right-lean segment — Lekan's next live test is
the real confirmation; legs are similarly fixture-unverifiable at a desk.

## M2 — procedural robot alive (2026-06-10)
Headed 60 s eval per fixture (Apple M5, GPU delegate), all numbers from
eval/results.json: detection 100% on all three, pose ~29.9 fps, render
~119 fps, memory flat over 60 s, zero console errors. Sync upperLimbsMean:
arms 9.42°, torso 2.22°, fast 18.89° — vs the M1 static baseline of
68.9°/9.8°/77.9°, and already under the M4 bars (≤15° arms/torso, ≤25° fast),
with the M2 bar (arms ≤20°) cleared by 2x. Vision review of 15 fresh paired
frames (media/review/, post-smoothing-fix): mirroring is correct everywhere —
single-arm raises come up on the matching screen side, both-hands-up and
guard poses read instantly; elbow articulation is real, torso lean and the
clamped turn both land, head tilts with the lean. No twisted joints, no
possession, in any frame. Jitter check (12 stage-only frames over 10 s,
media/review/jitter/): consecutive frames 0.9 s apart during the held
single-arm raise are pixel-identical — the rest-state jitter that beta=0.007
produced is gone. Honest flaws: on fast.mp4 the fastest punches land slightly
under-extended and a beat late (forearms are the worst limbs at 19–23.5°,
matching the smoothing lag you'd expect at this beta), and the robot's elbows
read a touch more bent than the person's at full extension. Off-screen decay
is now covered by a unit test (gradual relax to rest over ~2 s, no snap);
live-webcam feel, latency, and a true hand-out-of-frame pass are what the M2
user gate is for.
Headed 60 s eval on this machine (Apple M5), GPU delegate, all metrics from
eval/results.json: detection 100% on all three fixtures, pose loop ~29.5 fps
(capped by the 30 fps y4m), render ~117 fps, memory stable (28→21 MB over
60 s). BASELINE sync (robot still static, so this is the floor to beat):
arms 68.9°, torso 9.8°, fast 77.9° upper-limb mean. Torso reads low only
because a static upright robot accidentally matches an upright person.
Vision review of media/m1-detect.png: the skeleton overlay genuinely sticks —
raised arm, torso box, and face points all track in the mirrored view; no
lag visible in stills. Robot stands on stage with eyes/core glowing; static
as designed at this milestone. Headless suite numbers (pose ~5 fps) are
SwiftShader artifacts and not representative; labeled as such in tests.

## M0 — scaffold (2026-06-10)
Smoke test green in 1.2 s: fake webcam (arms.y4m) streams into the mirrored
video element, overlay canvas aligns with the video content rect to <2 px,
Three.js stage renders at ~91 fps headless, zero console errors. Screenshot
media/m0-smoke.png shows the split screen working — person clearly visible
left, empty dark stage right, LIVE badge and privacy footer present. No pose
detection yet, so nothing to judge on motion. Stage reads dark but the
ground disc and grid are visible; lighting will matter once the robot is in.
