# PosePuppet

Realtime webcam-to-3D-character motion in the browser. You move in front of
your webcam; a rigged 3D character follows you live — split screen with your
mirrored video + skeleton overlay on the left, the character on a stage on
the right. Markerless browser puppeteering: a motion puppet, not 3D
reconstruction and not professional mocap.

**Privacy: all inference runs in your browser. No frame, landmark, or
recording ever leaves your machine.** There is no backend, no analytics, no
telemetry, and the app makes zero runtime network requests (model and WASM
are served same-origin).

## Setup

```sh
npm install   # also fetches the MediaPipe pose model + WASM into public/
npm run dev   # → http://localhost:5173, allow camera
```

## How it works (10 lines)

1. `getUserMedia` → `<video>`, mirrored; `requestVideoFrameCallback` drives detection once per video frame.
2. MediaPipe PoseLandmarker (VIDEO mode, GPU delegate, WASM fallback) returns 33 normalized + 33 metric world landmarks.
3. Landmarks are mirrored in landmark space (swap left/right, negate x), then smoothed by a One Euro filter bank tuned for metric space.
4. A body frame (hips/shoulders) gives torso orientation; limb directions are expressed in that frame so torso turns don't corrupt arms.
5. Per bone: quaternion from rest direction → target direction, converted to parent-local space before assignment.
6. Render tick slerps each bone toward its target (second smoothing stage); invisible landmarks make a bone relax to rest over ~0.7 s.
7. Root motion (subtle x/y + depth hint from shoulder width) is clamped and heavily smoothed.
8. The 2D skeleton overlay draws the raw normalized landmarks on a canvas aligned with the video.
9. Two avatars behind one interface: a procedural robot built from primitives, and a CC0 VRM astronaut (100Avatars, see ASSETS.md) driven through the same retargeting layer — live-switchable mid-motion.
10. An eval mode (`?eval=<fixture>`) replays clips through the whole pipeline and writes metrics to `eval/results.json`.

The **● rec** button composites the side-by-side view into one canvas and
records 15 s to a downloadable `.webm` via MediaRecorder — the recording is
written by your browser to your disk and never leaves your machine.

## Current numbers

From `eval/results.json` (2026-06-10, 60 s per fixture per avatar, headed
Chromium on Apple M5, GPU delegate): detection 100% on all three test clips
for both avatars; pose loop ~29.5 fps (capped by 30 fps clips); render
~117 fps; upper-limb sync error robot/astronaut: 9.5°/10.9° (arms clip),
2.2°/2.3° (torso clip), 19.2°/20.3° (fast shadowboxing clip); memory flat
over 60 s.

## Limitations (honest)

- Upper body only for now; legs hold an idle pose.
- Fastest motions (shadowboxing) land slightly under-extended and a beat late — smoothing trades latency for stability.
- Single camera = depth ambiguity; movement toward/away from the camera is a heuristic (shoulder width), not measurement.
- One person at a time.

## Future work (deliberately out of scope for v1)

Fingers/hand tracking, face/expressions, physics/IK chains, multi-person,
mobile beyond "it loads", animation export, segmentation compositing.

## Verification

`npm test` runs the Playwright suite against Chrome's fake webcam (fixtures
piped in as `.y4m`), plus pure-math unit tests for the coordinate conversion,
mirroring, body frame, and visibility-decay behavior. `npm run eval` writes
`eval/results.json`. Fixture clips are personal footage and are gitignored.
