# Eval notes

## M0 — scaffold (2026-06-10)
Smoke test green in 1.2 s: fake webcam (arms.y4m) streams into the mirrored
video element, overlay canvas aligns with the video content rect to <2 px,
Three.js stage renders at ~91 fps headless, zero console errors. Screenshot
media/m0-smoke.png shows the split screen working — person clearly visible
left, empty dark stage right, LIVE badge and privacy footer present. No pose
detection yet, so nothing to judge on motion. Stage reads dark but the
ground disc and grid are visible; lighting will matter once the robot is in.
