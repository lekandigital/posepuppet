## 2026-06-10 ~18:55 (SHIPPED — goal contract green)
Done: M4 gate APPROVED live by Lekan (lean-right, turns, legs, calibrate, mid-motion switch all good); DEMO_SCRIPT finalized; POSTS.md drafted (3 variants + thread + self-reply + verification table); trails/confidence/theme skipped per contract (DECISIONS.md)
Sync metric: robot/vrm — arms 9.51/10.86°, torso 2.17/2.28°, fast 19.18/20.26° (all bars ✓)
FPS: pose ~29.5, render ~117; suite 18/18 headless; both user gates passed
Blockers: none — remaining mission step is Lekan's own filming session + post approval (his action, deliverables ready)
Next: film with DEMO_SCRIPT.md, pick a POSTS.md variant; future work listed in README

## 2026-06-10 ~18:35 (M4 complete, awaiting second live gate)
Done: VRM astronaut (100Avatars 048, CC0-in-meta) via raw-bone driving (autoUpdateHumanBones=false was THE fix), live switcher, name-match BoneMap layer, eval --avatar support
Sync metric: robot/vrm — arms 9.51/10.86°, torso 2.17/2.28°, fast 19.18/20.26° (M4 bars ≤15/≤15/≤25 all ✓ both avatars)
FPS: pose ~29.5, render ~117 both avatars; suite 18/18 headless; README numbers refreshed
Blockers: M4 USER ACTION gate — second live test, both avatars (incl. lean-right + legs re-check)
Next: gate report → fixes if any → M5 polish (trails, confidence meter) + final eval + DEMO_SCRIPT/POSTS finalization

## 2026-06-10 ~17:50 (M3 complete, awaiting re-test)
Done: gate feedback fixes (body-frame fallback, per-axis clamp), legs/full-body toggle, calibration 3-2-1 + per-bone offsets persisted, video-file input, record button; ASSETS.md 100Avatars approved
Sync metric: arms 9.37° / torso 2.22° / fast 18.96° (unchanged within noise after robustness fixes)
FPS: pose 29.5, render ~118 (headed, Apple M5); suite 16/16 headless
Blockers: lean-right + legs need Lekan's live re-test (fixtures can't show them); then M4 VRM
Next: quick live re-test of lean/turn/legs → M4 VRM via 100Avatars + BoneMap + switcher

## 2026-06-10 ~17:15 (M2 verification complete)
Done: full 60s eval all 3 fixtures; vision review (15 frames) + jitter burst (12 frames) reviewed; decay unit test added; EVAL_NOTES M2 entry written
Sync metric: arms 9.42° / torso 2.22° / fast 18.89° upperLimbsMean (M2 bar ≤20° ✓; already under M4 bars)
FPS: pose 29.9, render ~119 (headed, Apple M5, GPU delegate); memory flat 60s; 0 console errors
Blockers: none — awaiting M2 USER ACTION gate (live webcam test)
Next: user runs 90s live test script; fix reported issues; then M3 calibration + robustness
Also done while gated: VRM shortlist researched + proposed in ASSETS.md (2 CC0 families + Seed-san VPL1.0, approval pending); README.md written with privacy line, eval numbers, limitations; DEMO_SCRIPT draft + POSTS scaffold; record button → .webm built + Playwright-tested (suite 12/12 headless)

## 2026-06-10 ~12:47 (post-smoothing-fix eval)
Done: M0, M1, M2 robot pipeline; One Euro beta corrected to 8 (metric space); eval re-run
Sync metric: arms upperLimbsMean=16.02° (bar ≤20° ✓); torso+fast not yet run
FPS: poseFps=29.5, renderFps=119.5 (M5, headed, GPU delegate) ✓
Blockers: eval only captured arms fixture; torso and fast results missing
Next: re-run eval for all 3 fixtures, vision review paragraph, then USER ACTION gate M2
