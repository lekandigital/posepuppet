# Eval notes

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
