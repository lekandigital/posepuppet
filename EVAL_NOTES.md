# Eval notes

## M1 — detection + eval rig baseline (2026-06-10)
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
