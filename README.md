# PosePuppet

A browser puppet instrument. You move in front of your webcam; a rigged 3D
character performs on a stage, live. Markerless puppeteering — a motion
puppet, not 3D reconstruction and not professional mocap.

PosePuppet started as webcam-to-avatar puppeteering. Pass 2 turned it into
an instrument: a redesigned glass/brutalist interface, better body and
hand control, hand-only creature puppets, Motion Memory ghost
performances, a recording director with hands-free takes, setup guidance,
honest avatar boundaries, and a seeded architecture for future
body-controlled play.

**Privacy: all inference runs in your browser. No frame, landmark, or
recording ever leaves your machine.** No backend, no analytics, no
telemetry. The command bar carries a live receipt — `LOCAL · 0 EXTERNAL
REQUESTS SINCE LOAD` — backed by a real counter that flags any
cross-origin request the moment it happens. Models, WASM, and fonts are
served same-origin.

## Setup

```sh
npm install   # fetches the MediaPipe pose + hand models and WASM into public/
npm run dev   # → http://localhost:5173, allow camera
```

Press `⌘K` for the command palette. First run shows a short onboarding.

## What it does

- **Character mode** — the avatar mirrors your upper body (full body with
  legs and feet when you stand back and enable it). Improved wrists and
  palms; open/fist/point read on rigs with fingers; believable
  face-touch via proximity-magnetized IK that never puts a hand through
  the skull; occlusion recovery that coasts, relaxes, and blends back in
  ~0.5 s without ever snapping.
- **Hand-only mode** — one hand, 21-landmark finger tracking, its own
  violet stage. Roster: an expressive robot-glove hand, **beaky** (a
  talking bird — palm aims the head, thumb–index pinch is the jaw; talk
  over it with your own voice), and an **x-ray self-portrait** (your
  tracked hand as a glowing wireframe with a motion trail).
- **Expressiveness layer** — one visible slider from faithful (1.0) to
  cartoon (2.0): amplitude scaling with speed-coupled overshoot and a
  squash hint, all clamped so it can never break a rig. Idle life
  (breathing, randomized VRM blinks, micro sway) means the puppet never
  reads as frozen. Avatar switches crossfade mid-motion.
- **Motion Memory** — your last 12 s are always in a ring buffer. Loop
  them on a translucent **ghost duet**; slide the ghost into an **echo
  chorus** (2–4 staggered copies — a motion delay line); **instant
  replay** shows the last 5 s in slow motion from a side angle with
  trails; save named loops to IndexedDB and **re-skin** any loop onto any
  roster character. Playback only — nothing is scored, ever.
- **Recording director** — guided takes (Character, Ghost Duet, Talking
  Puppet) as shot-by-shot serif prompts over the stage; hands-free
  control (raise both arms to start, cross wrists to stop) through a
  gesture layer whose only consumer is take control; pre-take framing
  check in coach language; **16:9 and 9:16 vertical** composite presets;
  optional title stinger, privacy end card, corner badge, and grade;
  pose-poster still export; a caption helper that copies an honest
  caption after export.
- **Guidance** — a setup coach that says "Step back so your legs are
  visible" instead of "low hip visibility", capability labels on every
  avatar card, and an engineering view (`d`) with the raw dials.

## Roster

| avatar | status | note |
|---|---|---|
| robot (procedural) | Fingers not supported | mitt hands; face-touch lands at the collar |
| astronaut (CC0, 100Avatars) | Fingers not supported | mitten gloves; face-touch + body fully supported |
| erika (CC0, 100Avatars) | Fully supported | articulated fingers — open, fist, point |
| hand / beaky / x-ray | Hand-only | 21-point finger tracking |

All shipped assets are redistributable (CC0 / Apache-2.0 / OFL — see
ASSETS.md).

## How it works (12 lines)

1. `getUserMedia` → `<video>`; `requestVideoFrameCallback` drives detection once per video frame.
2. MediaPipe PoseLandmarker (GPU delegate, WASM fallback) returns 33 normalized + 33 metric world landmarks; HandLandmarker returns 21 in hand-only mode.
3. Landmarks are mirrored in landmark space, then smoothed by a One Euro bank tuned for metric space.
4. A body frame (hips/shoulders, with a shoulders-only fallback) gives torso orientation; limb directions are expressed in that frame so torso turns don't corrupt arms.
5. Per bone: quaternion from rest direction → target direction, converted to parent-local space, exaggeration applied to the swing, clamped by per-bone limits.
6. Face-touch: wrist-near-head proximity magnetizes the arm onto a two-bone IK whose target sits just outside a per-avatar head collider measured from real geometry.
7. Render tick slerps bones toward targets; on tracking loss a bone coasts on decaying angular velocity, relaxes to rest, and blends back over up to 0.5 s on re-acquisition — never snapping.
8. Motion Memory records the *pipeline input* (quantized landmarks); replaying through a second retargeter re-skins a take onto any rig exactly.
9. Ghosts are violet translucent avatar copies with their own retargeters; echoes are the same loop at staggered offsets.
10. The gesture layer reads wrist positions for take start/stop; it has exactly one consumer by design.
11. The composite recorder draws camera + stage into one canvas per preset and hands it to MediaRecorder; packaging frames are drawn straight onto the composite.
12. Eval mode (`?eval=<fixture>`) replays clips through the whole pipeline and writes metrics to `eval/results.json` — including honesty guards that refuse to let a wrong avatar or a throttled environment pose as a valid measurement.

## Current numbers

From `eval/results.json` (final pass-2 refresh, 2026-06-12: 17 × 60 s
runs — 5 fixtures × 3 avatars + 2 hand fixtures — headed Chromium, Apple
M5, GPU delegate, all effects on, environment verified un-throttled):

| metric | value |
|---|---|
| detection rate | 100% on all 17 runs |
| pose loop | 28.2–29.9 fps (clip-capped at 30) |
| render | 115.4–123.4 fps |
| upper-limb sync, arms clip (robot / astronaut / erika) | 9.51° / 10.96° / 9.49° |
| torso clip | 2.20° / 2.40° / 2.35° |
| fast shadowboxing clip | 19.89° / 23.37° / 17.33° |
| legs sync, fullbody clip | 5.78° / 6.33° / 5.60° |
| face-touch reach (facetouch clip) | 99.8% / 100% / 99.3%, penetration 0 frames on all three |
| pinch→jaw correlation (beaky) | r = 0.941 (pinch clip), r = 0.986 (open/close clip) |
| console errors | 0 across all runs |
| memory | flat over 60 s on every run |

Pass-1 baselines (same machine): arms 9.49–10.92°, torso 2.24–2.29°,
fast 18.87–20.38°, pose ~29.7, render 114–119. Every floor held with the
full pass-2 feature set enabled; the fast clip's astronaut number carries
the face-touch/shadowboxing interaction (velocity-gated after the final
eval caught it at 53 penetration frames; now 5).

## Limitations (honest)

- The fastest motions land slightly under-extended and a beat late —
  smoothing trades latency for stability.
- Single camera = depth ambiguity; toward/away movement is a heuristic
  (shoulder width), not measurement.
- One person, one hand (in hand-only mode) at a time.
- Finger tracking ships in hand-only mode; Character mode approximates
  open/fist/point from pose landmarks alone and only rigs with finger
  geometry (erika) can show it.
- The robot's face-touch reads as reach-to-collar — its head floats too
  far from its shoulders; labeled, not hidden.
- Full-body loops replay wherever the recording had leg tracking;
  desk-framed recordings replay upper-body only.

## Deliberately skipped

Games and scoring of any kind, worlds/maps, two-person duet, audio-reactive
staging, hologram parallax, model-audit systems, per-avatar calibration
profiles. The gesture layer stays a seed with exactly one consumer.

## Verification

`npm test` — Playwright suite (fake webcam via `.y4m` fixtures) + pure-math
unit tests: coordinate conversion, mirroring, body frame, occlusion
recovery (synthetic dropout), Motion Memory round-trip, gesture intents,
design-system contrast (both themes) and reduced-motion checks, hand-mode
boot, aspect-preset recordings. `npm run eval` writes `eval/results.json`;
fixture clips are personal footage and are gitignored, always.
