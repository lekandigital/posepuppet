## 2026-06-10 ~17:15 (M2 verification complete)
Done: full 60s eval all 3 fixtures; vision review (15 frames) + jitter burst (12 frames) reviewed; decay unit test added; EVAL_NOTES M2 entry written
Sync metric: arms 9.42° / torso 2.22° / fast 18.89° upperLimbsMean (M2 bar ≤20° ✓; already under M4 bars)
FPS: pose 29.9, render ~119 (headed, Apple M5, GPU delegate); memory flat 60s; 0 console errors
Blockers: none — awaiting M2 USER ACTION gate (live webcam test)
Next: user runs 90s live test script; fix reported issues; then M3 calibration + robustness
Also done while gated: VRM shortlist researched + proposed in ASSETS.md (2 CC0 families + Seed-san VPL1.0, approval pending); README.md written with privacy line, eval numbers, limitations

## 2026-06-10 ~12:47 (post-smoothing-fix eval)
Done: M0, M1, M2 robot pipeline; One Euro beta corrected to 8 (metric space); eval re-run
Sync metric: arms upperLimbsMean=16.02° (bar ≤20° ✓); torso+fast not yet run
FPS: poseFps=29.5, renderFps=119.5 (M5, headed, GPU delegate) ✓
Blockers: eval only captured arms fixture; torso and fast results missing
Next: re-run eval for all 3 fixtures, vision review paragraph, then USER ACTION gate M2
