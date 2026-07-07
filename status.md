## 2026-07-07 (BodyArcade Flight P1 — offline parity green)
Done: LocalWorldProvider (localWorlds.ts: worlds minted client-side, localStorage-persisted, upstream name pools + seed math) + isLocalMode() guards at all six network touchpoints; lantern ledger local; save-feed/events posts no-op; Lobby feed hidden offline; Google-Fonts Inter self-hosted via @fontsource; vibej.am widget removed
Tests: new flight suite 3/3 green (zero off-origin requests asserted across lobby + full session; world persists across reload); keyboard parity by construction — FlightControls/Plane/SphericalMath/CameraRig/TouchControls byte-identical to upstream (diff-verified); server workspace typechecks (dormant)
Perf: eval/flight-perf.json — 119 render fps headed while flying, 0.1% long frames, 56 MB heap (pre-body-input baseline)
Blockers: none
Next: P2 — BodySource native axes into ControlState, merge beside controls.getState(), tuner overlay in the flight page

## 2026-07-07 (BodyArcade Flight P0 — rights + recon complete, awaiting GATE 1b)
Done: permission record verified (private, gitignored, sufficient for faithful public fork w/ credit); TinySkies forked into apps/flight (284 files, analytics stripped, deploy glue excluded, builds green); STUDY_NOTES.md architecture map; PLAN.md rewritten for Flight; ASSETS.md fork manifest; .gitignore negations so global binary ignores don't swallow flight assets
Key findings: ControlState.turnRate already continuous (body axes drop in w/o touching flight math); offline = 1 mandatory intercept + 4 no-ops; plane/boat/carpet all real behind a capabilities table; loop is variable-dt clamped 50ms (replay tape records dt); upstream README control table is stale vs code
Baseline: PosePuppet suite green 72/5 skipped (1 known headless boundary flake passed on rerun); perf baseline stands in eval/results.json
Blockers: USER GATE 1b — PLAN.md approval + 4 folded questions (layout, asset provenance, skip PWM crutch, stale-README reading)
Next: on approval → P1 offline parity (LocalWorldProvider, keyboard feel identical, flight perf baseline)

## 2026-07-07 (@bodyarcade/body-input P3 — fixture evals ALL GREEN, package complete)
Done: fixture eval suite (episode/window-structural, eval/bodyinput-results.json) green on all six flight clips; example consumer page + cross-page BroadcastChannel spec; README complete with measured-limitations section
Real-footage fixes the eval forced: seated classifier rebuilt on leg-fold + ankle-forward (crouch was misread as seated; MediaPipe z compression flickered the thigh-angle cue); mid-motion fallback neutral now upgraded by first stillness dwell (pegged leanX on seated.mp4); armLength 1.5×sw floor removed (inflated armLength, capped armsOut at 0.8)
Numbers: latency p50 10–12 ms every clip; seated 84%; still noise floor p99 ≤ 0.078 shaped; leanY cross-bleed 0.55–0.66 p95 recorded as a documented limitation
Blockers: none — acceptance items all met pending final suite run
Next: hand off to BodyArcade Flight (Prompt 3) as the protocol consumer

## 2026-07-07 (@bodyarcade/body-input P2 — tuner + measured jitter floors)
Done: tuner overlay mounts in PosePuppet ('b' / palette; raw→shaped bars, sliders writing core.setConfig, chips, latency readout); adapter feeds mirrored pre-smoothing landmarks into the core and publishes on both transports; jitter-floor tool measures still.mp4 → dead-zone defaults with provenance; prepare-fixtures now converts fixtures/flight/
Finding: first jitter run exposed a 0.37 resting bias in handsForward (MediaPipe z) — arm axes are now rest-relative; re-measured floors are pure noise (≤0.01) except leanY (0.123, honest z-noise)
Tests: 15 protocol + 1 in-app spec (live signals, landmark-free broadcast wire, tuner mount)
Blockers: none
Next: P3 — fixture eval suite (per-clip assertions into eval/results.json) + example consumer page + docs

## 2026-07-06 (@bodyarcade/body-input P1 — core + transports + tapes)
Done: schema-v1 RFC gated+approved (packages/body-input/PLAN.md); deterministic core (calibration-relative extraction, One Euro→dead zone→expo→slew per axis, hysteresis/debounce events, confidence decay); in-page + BroadcastChannel transports with runtime shape-guarding; input/signal tape recorder-replayer; vite/tsconfig alias, no workspace churn
Tests: 15/15 new protocol tests (byte-identical replay, landmark-absence boundary, sign conventions, dropout decay curves, upper-body/too-close/mid-gesture/seated failure modes, both transports)
Also: fixed pre-existing avatar-cycle suite failure (optional-VRM probe fooled by vite SPA-fallback 200 text/html)
Blockers: none
Next: P2 — tuner overlay + jitter-floor tool (dead-zone defaults from still.mp4)

## 2026-07-02 (PASS 2 SHIPPED — Gate 5 approved)
All five user gates honored; all ten goal conjuncts green. Suite 55 passed / 5 skipped at ship; final eval 17x60s clean (detection 100%, pose 28.2-29.9, render 115-123, all sync bars hold, 0 errors, memory flat)
Deliverables: glass-cockpit UI (both themes), motion core + expressiveness, hand-only creatures (beaky r=0.941/0.986), Motion Memory (round-trip verified), recording director (hands-free start/advance/stop, 16:9+9:16), guidance, Erika (CC0) roster addition, README/CHANGELOG/DEMO_SCRIPT-v2/POSTS with verification table
Remaining (Lekan's own actions, on his schedule): film DEMO_SCRIPT v2, pick a POSTS variant
Branch: pass-2-instrument (ready to merge to main whenever he chooses)

## 2026-06-12 ~18:30 (P8 COMPLETE — awaiting GATE 5)
Done: final 17-run eval (clean, un-throttled, 0 errors); 2 bugs caught+fixed by the refresh (face-touch velocity gate: punch penetrations 53->5; frame-time velocity estimation: replay determinism); README/CHANGELOG/DEMO_SCRIPT-v2/POSTS.md shipped with verification table; final screenshot board + vision critique
Sync metric: arms 9.49-10.96 / torso 2.20-2.40 / fast 17.33-23.37 / legs 5.6-6.3; pinch-jaw r=0.941-0.986; face-touch 99.3-100%/0 pen
FPS: pose 28.2-29.9, render 115-123, all effects on — floors hold
Blockers: USER GATE 5 — filming session + verification-table check + approval
Next: film DEMO_SCRIPT v2, pick a POSTS variant

## 2026-06-12 ~17:00 (P7 COMPLETE — electives ship)
Done: velocity VFX (impact rings/sparks/ground ripples, pooled, toggleable), auto-director camera (lean/kick/idle-orbit springs, camera-ownership lock, toggleable); eval pins the camera so the sync metric stays valid
Sync metric: fast 19.87 with all effects on (baseline noise band); facetouch/arms unchanged
FPS: pose 29.5 / render 117.6+ with everything on — floors hold
Blockers: none
Next: P8 ship — full eval refresh, before/after table, README/CHANGELOG/DEMO_SCRIPT/POSTS, screenshot board, GATE 5

## 2026-06-12 ~16:15 (Gate 4 CLOSED — Erika ships)
Done: 100Avatars registry screened (6 candidates, finger-node scan via glb JSON chunk), Robert+Erika visually verified (fists close), Erika approved + committed (CC0 embedded meta recorded in ASSETS.md), registry/cards/cycle-test updated
Sync metric: erika facetouch reach 100% pen 0, arms 9.71 deg, pose 29.3-29.6 fps
FPS: unchanged
Blockers: none
Next: P7 electives (velocity VFX + auto-director camera), then P8

## 2026-06-12 ~15:30 (P6 COMPLETE — guidance + boundaries ship)
Done: first-run onboarding (design-grammar overlay, persisted, palette-reopenable, automation-suppressed), visibility-driven low-nag coach, avatar-card limitation notes; 2 bugs caught (suite-blocking overlay, Enter self-dismiss)
Sync metric: n/a (no retarget changes)
FPS: n/a (chrome-only changes)
Blockers: Gate 4 (async) — finger-capable roster addition decision
Next: P7 electives (velocity VFX + auto-director camera), then P8 ship

## 2026-06-12 ~14:45 (P5 COMPLETE — recording director ships)
Done: gesture/intent seed (1 consumer: hands-free start/stop + stillness), 3 take scripts as data, director (framing check, countdown, serif shot prompts, take-bar progress, space/esc fallback), 16:9 + 9:16 composite presets, packaging (stinger/end card/badge/grade, chrome auto-dim), pose poster, caption helper
Sync metric: n/a this phase (no retarget changes); director.spec 6/6 green incl. both aspect files nonzero
FPS: no hot-path changes (recorder only composites while recording)
Blockers: none
Next: P6 guidance+roster (onboarding, visibility coach, card limitations) then P7 electives (velocity VFX + auto-director cam)

## 2026-06-12 ~13:30 (P4 COMPLETE — Motion Memory ships)
Done: landmark-stream loops (int16, IndexedDB), always-on 12s rings (pose+hand), ghost duet (violet translucent copy), echo chorus slider (2-4 staggered echoes), instant replay (slow-mo, side angle, trail echoes, auto-restore), re-skin via saved-loop list, palette cmds g/i/save
Sync metric: round-trip replay-on-second-avatar mean <5deg / max <12deg (memory.spec.ts, passes); quantization sub-mm
FPS: unchanged (ghosts only tick when active)
Blockers: none
Next: P5 recording director (guided takes, hands-free gestures, framing check, 16:9+9:16, packaging, poster, caption)

## 2026-06-12 ~12:30 (Gate 3 feedback FIXED — P4 next)
Done: 6 live-test fixes — computed finger curl axes (verified on Seed-san; astronaut = mittens, now labeled), real head colliders (skinned-vertex sampling) + person-frame contact bias, exaggeration dead-zone/soft-knee/no-pitch, beaky pinch auto-range, crossfade fade-out-only w/ depth discipline, half-rate slerp during re-acquisition
Sync metric: facetouch reach 99.8%/100% pen 0/0; pinch->jaw r=0.899 (up from 0.886); arms 9.77 (45s, within noise)
FPS: render 117-119 everywhere, pose ~29.6 — floors hold
Blockers: none (roster lacks a finger-capable avatar — P6/Gate-4 candidate: Seed-san or a 100Avatars pick)
Next: P4 Motion Memory (ring buffer, IndexedDB loops, ghost duet, echo chorus, replay, re-skin, round-trip test)

## 2026-06-12 ~10:40 (P3 COMPLETE — hand-only mode ships; GATE 3 next)
Done: HandLandmarker postinstall + detector; hand-only mode (own stage treatment, roster cards, HAND chain cell, overlay skeleton); puppets: expressive hand / beaky (pinch=jaw, palm=head, crest spring) / x-ray wireframe+trail; pinch->jaw metric; handmode spec
Sync metric: pinch->jaw r=0.886 (pinch fixture) and 0.937 (open_close), bar r>=0.8 — PASS; 100% hand detection both clips
FPS: display awake again — full 6x60s floor re-measure running (results-p3-motion.json)
Blockers: USER GATE 3 — live webcam test (script ready)
Next: fix what the live test reports, then P4 Motion Memory

## 2026-06-12 ~09:30 (P2 COMPLETE — motion core + expressiveness)
Done: occlusion recovery (coast/limits/adaptive reacq blend + dropout tests); face-touch IK magnetism (100% reach, 0% penetration both avatars on facetouch.mp4); feet + legs metric (legsMean 5.6/6.2 deg on fullbody.mp4); exaggeration slider + squash + antenna spring + idle life + VRM blinks + switch crossfade + auto-tuner; hand open/fist/point from pose landmarks (VRM finger curls)
Sync metric: arms 9.57 deg (vs 9.49 baseline, within noise); facetouch upper 6.4/9.6; fullbody upper 6.4/7.9 + legs 5.6/6.2
FPS: BLOCKED — environment throttled to ~30 rAF (display asleep/locked); rig now detects+stamps this; floors re-verified next awake session
Blockers: none for P3 (FPS floor check deferred, not forgotten)
Next: P3 hand-only mode — HandLandmarker, expressive hand, creature puppet (pinch=jaw), x-ray, pinch→jaw eval metric → GATE 3 live test

## 2026-06-12 ~08:10 (P1 COMPLETE — design system live everywhere)
Done: Gate 2 approved + full rollout (tokens, shell, chain, receipt, cards, coach card, engineering view, palette+shortcuts, themes persisted); 2 bugs fixed (video-layer compositing hole, font-load receipt false positive); design.spec.ts added (contrast both themes, reduced-motion, focus)
Sync metric: arms 9.40/11.02, torso 2.23/2.30, fast 18.98/19.86 (robot/astronaut) — unchanged within noise
FPS: pose 29.5-29.7, render 118-119 — floors hold with new UI on (results-p1-ui.json)
Blockers: none
Next: P2 motion core — wrists/palms, face-touch, full-body, occlusion recovery, expressiveness layer

## 2026-06-12 ~07:45 (P1 design plan + mockups ready — awaiting USER GATE 2)
Done: reference.css grammar studied in full; DESIGN_PLAN.md (tokens both themes, type roles incl. self-hosted fonts, wireframe, signature = take-bar instrument strip w/ signal chain, mono label map, atmosphere rules); shell mockups dark/light/take-state at 1440x810; self-critique + one revision (light theme keeps deep stage)
Sync metric: unchanged from P0 baseline (no pipeline changes this step)
FPS: unchanged from P0 baseline
Blockers: USER GATE 2 — design direction approval before full rollout
Next: on approval — token CSS + shell around the live app, every surface restyled, engineering view, privacy receipt counter, Cmd+K palette, settings persistence

## 2026-06-12 ~07:05 (Gate 1 APPROVED — P0 fully closed, P1 next)
Done: branch pass-2-instrument; reference.css read (grammar internalized, palette excluded); 4 new clips remuxed→y4m, frame-verified, sanity-evaled (facetouch 100%/4.98 deg, fullbody 100%/6.71 deg; hand clips stream fine, HandLandmarker is their consumer)
Gate 1: approved — plan + electives B1 (velocity VFX) + B2 (auto-director); woody → local-only, astronaut default again
FPS: baseline unchanged (committed); suite green 37/5 skipped
Blockers: none
Next: woody demotion commit, then P1 design tokens + shell → design plan + mockups → GATE 2

## 2026-06-12 ~06:40 (Pass 2 P0 complete — awaiting USER GATE 1)
Done: repo inspected; suite fixed (generated-VRM smokes skip when local file absent) → 37 passed/5 skipped green; eval honesty guards (per-file VRM names, load-fail = console.error, avatarRequested + mismatch exit); guarded 9-run baseline; PLAN.md with elective proposal
Sync metric: robot 9.49/2.24/18.87°, astronaut 10.92/2.29/20.38°, woody 9.02/2.14/17.88° (arms/torso/fast) — all pass-1 bars hold
FPS: pose 28.5–29.8, render 114–118 (headed, Apple M5); detection 100%; 0 console errors; memory flat
Blockers: USER GATE 1 (PLAN.md + electives + woody/R1 call); USER ACTION — design/reference.css missing, 4 new fixture clips missing (specs in PLAN.md §3)
Next: on approval → P1 design system + shell (design plan + mockups → GATE 2)

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
