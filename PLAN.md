# PLAN.md — Pass 2: The Instrument Pass

Status: **USER GATE 1 APPROVED 2026-06-12** (in-session structured reply),
after both USER ACTION items resolved and re-verified. Approved: this plan;
electives = Tier B1 (velocity VFX) + B2 (auto-director camera), all else
skipped; R1 = woody demoted to local-only, astronaut returns as default.
Work proceeds on branch `pass-2-instrument`.

---

## 1. My reading of the codebase

~3,000 lines of vanilla TypeScript + three.js + MediaPipe, no framework in
the hot path. The architecture is in good shape for this pass — nothing
needs a rewrite, and every pass-2 feature has a natural attachment point:

- **Pipeline** (`main.ts`): camera/video → PoseLandmarker (33 landmarks,
  30/s) → mirror → One Euro smoothing → `Retargeter` → render tick. UI is
  plain DOM. This boot function is the one file that has grown organically
  (684 lines, visual-QA hooks inlined) and wants decomposition during P1 —
  decompose, not rewrite.
- **Retargeting** (`rig/retarget.ts`): two-stage smoothing (pose frames
  write local-space target quaternions; render ticks slerp toward them),
  body-frame-relative limb directions, visibility hysteresis with
  decay-to-rest, calibration persisted to localStorage. The expressiveness
  layer (exaggeration, secondary motion, occlusion polish) slots in here
  cleanly: exaggeration scales the rest→target swing before composition;
  occlusion recovery upgrades the existing decay path (add velocity decay +
  re-acquisition blend); springs hang off `Avatar.update(dt, time)`.
- **Avatar abstraction** (`rig/types.ts`): `bones` + `joints` + `update()`
  behind one interface; robot (procedural) and VRMs load through the same
  registry. Hand-only creatures fit this interface (different bone set,
  same contract). Motion Memory can serialize/replay at exactly this
  boundary — record the per-bone target quaternions the Retargeter writes.
- **Eval rig** (`eval/`, `tests/`): fixtures → y4m → Chrome fake webcam;
  in-page collector publishes `window.__EVAL_RESULT`; screen-space limb
  sync metric. Extending it with pinch→jaw correlation, face-touch reach,
  occlusion recovery, and Motion Memory round-trip checks is mechanical.
- **Tests**: 42 Playwright tests in 7 files. Found red at P0: the five
  generated-avatar load smokes hard-required local-only gitignored VRMs
  that are no longer on disk. Fixed (skip when the candidate file is
  absent); suite is now 37 passed / 5 skipped, green.
- **Post-pass-1 drift**: a generated-avatar audit workstream added a
  test-only `?generatedAvatar=` path, visual-QA hooks, and committed
  `woody.vrm` + `Seed-san.vrm`, with woody now the **default avatar**. See
  risk R1.

## 2. P0 baseline (this machine, Apple M5, headed, GPU delegate)

Archived pass-1 final numbers to `eval/results-pass1-final.json`.
Fresh baseline (60 s × 3 fixtures × robot/astronaut/woody) — the floor every
later phase diffs against:

Run: 2026-06-12T06:34:56Z — Apple M5, headed, 60 s per fixture, GPU delegate.

| fixture | avatar | detection | pose fps | render fps | upper-limb sync (°) | torso (°) | mem t0→t60 (MB) | console errors |
|---|---|---|---|---|---|---|---|---|
| arms | robot | 100% | 29.60 | 117.79 | 9.49 | 0.69 | 29→30 | 0 |
| torso | robot | 100% | 29.71 | 117.06 | 2.24 | 1.44 | 29→29 | 0 |
| fast | robot | 100% | 29.78 | 117.93 | 18.87 | 2.35 | 29→26 | 0 |
| arms | vrm:astronaut | 100% | 29.73 | 118.11 | 10.92 | 0.49 | 33→27 | 0 |
| torso | vrm:astronaut | 100% | 29.71 | 117.70 | 2.29 | 1.73 | 33→25 | 0 |
| fast | vrm:astronaut | 100% | 28.46 | 114.17 | 20.38 | 2.37 | 33→26 | 0 |
| arms | vrm:woody | 100% | 29.65 | 117.18 | 9.02 | 0.54 | 34→30 | 0 |
| torso | vrm:woody | 100% | 29.64 | 117.92 | 2.14 | 2.66 | 34→32 | 0 |
| fast | vrm:woody | 100% | 29.76 | 118.15 | 17.88 | 3.26 | 34→34 | 0 |

**Floors this pass defends:** pose ≥ ~29.5 fps (clip-capped at 30), render
≥ ~115 fps on this machine, detection 100%, zero console errors, memory
flat over 60 s. Sync bars from pass 1 (arms/torso ≤15°, fast ≤25°) all
hold, now on three avatars.


Suite: green (37 passed, 5 skipped — skips are local-only generated-VRM
candidates, intentionally absent). Zero console errors in eval runs.

**P0 honesty fix found by the first baseline attempt:** the first 9-run
baseline produced three rows whose avatar label contradicted the requested
avatar — two "woody" runs carried robot-identical sync numbers, i.e. the
VRM load had silently failed and `setAvatar`'s catch quietly reverted to
the robot with only a `console.warn`, which eval doesn't count. All VRMs
also shared the indistinct name `vrm`. Fixed before re-baselining: VRM
avatars are now named per file (`vrm:woody`), a failed avatar load is a
`console.error` (so eval rows can never again pass while measuring the
fallback), and `eval/run.mjs` records `avatarRequested` and exits non-zero
on any requested/measured mismatch. The table above is from the guarded
re-run.

## 3. USER ACTION — missing inputs (blocking parts of P2–P3)

**a) ~~`design/reference.css` is missing.~~ RESOLVED during P0** — the file
appeared in the repo (1,013 lines, the grammar exactly as CLAUDE.md
describes) and is read and committed. One P1 note from it: the reference
imports Google Fonts; PosePuppet self-hosts or system-stacks its fonts so
the "0 network requests" receipt stays literally true.

**b) ~~The four new fixture clips are missing.~~ RESOLVED 2026-06-12** —
all four arrived as 1620×1080@30 H.264 (.mov, remuxed to .mp4), converted
to y4m through `npm run prepare-fixtures`. Content verified against spec by
frame inspection. 30 s detection-sanity eval (robot, headed, archived at
`eval/results-newfixtures-sanity.json`): facetouch detection 100% /
upperLimbs 4.98°, fullbody 100% / 6.71° — both fully usable. The hand
clips stream at full rate; their pose-detection numbers (71–81%, sync
49–66°) are BlazePose hallucinating a body from a hand and are expected —
P3 consumes these clips via HandLandmarker, not PoseLandmarker.

Original recording specs kept below for reference: `fixtures/` has only the
pass-1 clips (arms, torso, fast, fast2). Please record and drop these as
`.mp4` into `fixtures/` (any orientation, ≥720p, ~10–20 s each — same as
pass 1; `npm run prepare-fixtures` handles conversion; nothing is ever
committed):

| file | content spec |
|---|---|
| `hand_open_close.mp4` | One hand, palm facing camera, filling ~1/3–1/2 of frame, well lit. Slowly open the hand wide → close to a fist, ×4–5, varying speed. Keep the hand fully in frame. |
| `hand_pinch_point.mp4` | Same framing. Repeatedly pinch thumb–index together and apart (×6–8, like a talking mouth, varied rhythm and amplitude) — this drives the jaw-correlation metric — then a few seconds of index-finger pointing in different directions. |
| `facetouch.mp4` | Frame from hips up. Bring a hand slowly to your cheek, hold 1 s, away; then chin, forehead, mouth-cover. Both hands across the takes. Slow and deliberate beats fast. |
| `fullbody.mp4` | Whole body in frame, head to feet, ~2–3 m back. March in place, shift weight side to side, one small squat, lift each foot, a small step left/right. ~20 s. |

(Nothing is blocked anymore; the table above stays as the record of what
was asked for.)

## 4. Risks

- **R1 — woody licensing (needs your call at this gate).** `woody.vrm` is
  converted from a "Toy Story rig free download" fan model of a Disney/Pixar
  character, is committed to the repo, ships on Vercel, and is the default
  avatar. That conflicts with the non-negotiable "every asset
  redistributable in a public repo" and with goal #10. The generated
  candidates (Vader, Iron Man, Shrek…) are gitignored/test-only — fine —
  but woody is in git history and in the public build. My proposal: demote
  woody to local-only (gitignore again, registry entry marked Experimental
  and auto-hidden when the file is absent), make the CC0 astronaut the
  default, and note it in ASSETS.md. Your repo, your call — but I won't
  build pass-2 marketing surfaces (cards, posters, POSTS.md) around an
  asset we can't redistribute.
- **R2 — hand tracking needs a second model.** Pose landmarks include only
  wrist/index/pinky/thumb points — not enough for pinch distance or finger
  state. P3 needs MediaPipe **HandLandmarker** (21 landmarks/hand). Same
  family as the pose model we already ship (Google, Apache-2.0, fetched
  postinstall, served same-origin, recorded in ASSETS.md). I treat
  Gate-1 approval of this plan as approval for it. Honest scope call:
  **true per-finger skeletal tracking on full-body avatars does not ship
  this pass** — hand-only mode gets real finger data (it's the whole point
  there); Character mode gets open/fist/point approximations driven by the
  hand model when a hand is near-camera, falling back to pose-only wrist
  quality. Running two models costs pose-loop budget; the auto-tuner and
  a "hands boost when hand fills frame" gate manage it (measured at P3).
- **R3 — backdrop blur over live video.** Real `backdrop-filter` over the
  camera/stage panes can eat the render-FPS floor. Mitigation is in the
  brief: true blur only on static chrome; gradient/opacity fakes over live
  regions. Contrast-checked both ways.
- **R4 — face-touch believability.** Pure retargeting won't read. Plan:
  proximity-triggered magnetism — when the wrist lands within a threshold
  of the head, blend in a light 2-bone IK toward a per-avatar contact
  anchor (cheek/chin/forehead), ease in/out, hard "never penetrate the head
  collider" clamp. Per-avatar reach normalization from bind-pose arm
  length. Avatars whose proportions can't reach become a capability label.
- **R5 — Motion Memory tolerance.** Replay-on-second-avatar can't be
  bit-exact (different rigs). Tolerance is defined on the recorded bone
  stream (quaternion angle error vs source stream on the same avatar,
  plus joint-name coverage on the re-skin target), not on pixels.
- **R6 — main.ts decomposition risk.** Pulling the boot function apart
  while keeping eval + tests green is the riskiest refactor; it happens
  early in P1 in small commits, suite at every step.

## 5. Phases, attachment points, and effort

(Estimates are wall-clock working time on this machine, suite-green commits
included. Total ≈ 31–44 h.)

| phase | what lands | est |
|---|---|---|
| P0 | done: inspection, suite fix, baseline, this plan | 1.5 h |
| P1 | token system + both themes, shell layout (command bar / stage hero / camera signal / control rail / take bar), design plan + 2–3 mockups → **GATE 2**, then full rollout incl. engineering view, settings persistence, privacy receipt (real fetch/XHR counter), Cmd+K palette + shortcuts | 8–11 h |
| P2 | wrist/palm quality, face-touch (R4), full-body/feet, occlusion recovery (velocity decay + 0.5 s re-acquisition blend), expressiveness layer (springs, exaggeration slider, idle life, switch crossfade, perf auto-tuner) | 7–9 h |
| P3 | HandLandmarker integration (R2), hand-only mode + stage treatment, expressive hand, ≥1 creature (jaw=pinch), x-ray self-portrait, pinch→jaw eval metric → **GATE 3** (live test) | 5–7 h |
| P4 | Motion Memory: bone-stream ring buffer, IndexedDB loops, ghost duet, echo chorus, instant replay (slow-mo second angle), re-skin, round-trip test | 4–5 h |
| P5 | recording director: take scripts as data, gesture/intent seed + hands-free start/advance/stop, framing check, 16:9 + 9:16 composites, stinger/end-card packaging, pose poster, caption helper | 5–7 h |
| P6 | avatar cards + capability labels, setup coach, onboarding, mode selector polish | 2–3 h |
| P7 | approved electives (below) | 3–5 h |
| P8 | full eval refresh, before/after table, README/CHANGELOG/DEMO_SCRIPT/POSTS, screenshot board → **GATE 5** | 2–3 h |

## 6. Electives proposal (Gate 1 decision)

**Take — Tier B1, Velocity VFX (~1.5 h):** the smoothing layer already
computes velocities; impact rings + sparks are cheap and land in every
clip. Subtle by default, toggleable, perf-gated.

**Take — Tier B2, Auto-director camera (~2 h):** spring-damped lean,
idle slow-orbit, replay angle switch. The replay angle is already needed
by P4's instant replay, so most of this is shared work.

**Skip — Tier B3, Hologram parallax:** off-by-default head-coupled
parallax is the lowest payoff per hour here and competes with B2 for the
same camera code. Types/comments seed only.

**Skip — Tier C both:** two-person duet risks single-person quality for an
Experimental label; audio-reactive light adds a mic permission to a
privacy-receipt app for marginal demo value. Both noted as future work.

## 7. Cut / reorder proposals

- **Reorder: P4 (Motion Memory) before P3's Gate-3 live test if the hand
  fixtures arrive late.** P4 has zero dependency on the new fixtures; the
  live-test gate is better spent when hand-only mode is testable. I'll
  sequence opportunistically around the USER ACTION and keep phases
  otherwise as written.
- **Cut nothing else.** The phase list is coherent; everything maps to a
  goal conjunct.
- Seed-san.vrm sits committed but unregistered. It's VRM-spec sample
  (VirtualCast); I'll verify its license terms before using it as the 2–3
  roster addition candidate at P6, else it stays out (Gate 4 covers any
  replacement).

## 8. What I treat as approved by approving this plan

- Elective selection in §6.
- MediaPipe HandLandmarker as a dependency-class asset (R2).
- The woody demotion in R1 **unless you say otherwise at this gate**.
- The phase sequencing in §5/§7.
