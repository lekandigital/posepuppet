# Eval notes

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
