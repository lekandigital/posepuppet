# Eval notes

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
