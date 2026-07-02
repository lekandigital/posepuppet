# Changelog

## Pass 2 — "The Instrument Pass" (2026-06-12)

PosePuppet started as webcam-to-avatar puppeteering. This pass turned it
into a browser puppet instrument.

### Added
- **Design system** (Gate-2 approved): tokenized glass/brutalist theme,
  light + dark, four role-bound accents (blue action / cyan signal /
  violet memory / green-white privacy), grain + vignette on chrome only,
  self-hosted variable fonts (Inter, JetBrains Mono, Fraunces — OFL).
  Signature element: the take bar as an instrument strip with a live
  CAM ▸ POSE ▸ SMOOTH ▸ RIG ▸ RENDER ▸ REC signal chain.
- **Shell**: command bar (mode selector, live privacy receipt, record),
  stage hero with viewfinder ticks, camera panel docked as the input
  signal, right rail (avatar cards, expression + memory sliders, coach),
  ⌘K command palette + single-key shortcuts, engineering view.
- **Privacy receipt**: `LOCAL · 0 EXTERNAL REQUESTS SINCE LOAD`, backed by
  a real PerformanceObserver/beacon/WebSocket counter.
- **Motion core**: occlusion recovery (velocity coast → pull-to-rest →
  joint limits → adaptive ≤0.5 s re-acquisition blend, never snapping);
  face-touch via proximity-magnetized two-bone IK with per-avatar head
  colliders measured from skinned geometry; feet driven from ankle→toe
  landmarks; legs added to the eval sync metric.
- **Expressiveness layer**: exaggeration slider (1.0–2.0, dead-zoned,
  soft-kneed, clamped), speed-coupled overshoot + squash hint, robot
  antenna spring, VRM blinks, idle micro-sway, avatar-switch crossfade,
  performance auto-tuner via the coach.
- **Hand-only mode**: MediaPipe HandLandmarker (21 landmarks), violet
  stage treatment, roster: expressive hand, beaky the talking bird
  (pinch = jaw, auto-ranged), x-ray wireframe self-portrait with trail.
- **Motion Memory**: 12 s ring buffers, named loops in IndexedDB, ghost
  duet, echo chorus (2–4 staggered echoes), instant slow-mo replay from a
  side angle, re-skin any loop onto any character.
- **Recording director**: guided takes as data (Character / Ghost Duet /
  Talking Puppet), hands-free start/stop through the gesture seed layer,
  pre-take framing check, 16:9 + 9:16 vertical composite presets, title
  stinger + privacy end card + badge + grade (all toggleable), pose
  poster export, caption helper.
- **Guidance**: first-run onboarding, visibility-driven low-nag coach,
  capability labels + limitation notes on avatar cards.
- **Roster**: erika (100Avatars R1 #053, CC0) — the finger-capable
  character, screened and license-verified at Gate 4.
- **Verification rig**: pinch→jaw correlation metric, face-touch reach
  check, synthetic-dropout occlusion test, Motion Memory round-trip test,
  gesture intent tests, aspect-preset recording checks, automated
  contrast + reduced-motion checks, eval honesty guards (avatar mismatch
  detection, environment-throttle stamping).

### Fixed (found by tests and the live gate)
- Eval could silently measure the fallback avatar under a VRM's name.
- Chromium composited an opaque camera-feed background y-flipped over the
  WebGL stage.
- VRM finger curls used a per-convention axis that bent fingers backwards
  — axes are now computed from each rig's geometry.
- Face-touch hovered at the chest / pierced the astronaut's helmet — head
  colliders now come from real geometry, contact bias from the person's
  face normal.
- Exaggeration amplified rest jitter and folded arms through the body —
  dead zone + soft knee.
- Avatar crossfade showed the old avatar through the new one.
- Onboarding's Enter keypress could click its own Start button.

### Deliberately skipped
Hologram parallax, two-person duet, audio-reactive light (Gate-1
elective selection); games/scoring/worlds (mission non-negotiable);
woody demoted to a local-only experimental file (not redistributable).

### Still limited
Fast motion lands a beat late; depth is a heuristic; one person; finger
tracking is hand-only-mode-first; robot face-touch reads reach-to-collar.

## Pass 1 (2026-06-10)

Initial release: webcam → MediaPipe pose → procedural robot / CC0 VRM
astronaut retargeting, split-screen stage, calibration, recording, eval
rig with fixtures → y4m fake webcam, screen-space limb sync metric.
