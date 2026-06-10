# Decisions

## 2026-06-10 — No React; vanilla TypeScript + DOM
The mission recommends Vite + React with React for UI chrome only. The
dependency set staged before M0 had no React, and the entire hot path
(capture → detect → retarget → render) must be imperative regardless. The UI
chrome here is a handful of buttons, sliders, and badges — cheaper as direct
DOM than as a React tree that must be firewalled from per-frame data. Going
vanilla removes the single most common failure mode the mission warns about
(per-frame data leaking into React state) by construction. Vite + TypeScript
+ three + @mediapipe/tasks-vision + @pixiv/three-vrm otherwise as prescribed.

## 2026-06-10 — Mirroring strategy
Video element and 2D overlay canvas are mirrored together with CSS
`scaleX(-1)`; the overlay draws in raw (unmirrored) landmark coordinates so
it always aligns with the video pixel-for-pixel. The 3D rig gets its mirror
from a landmark-space swap(left/right indices)+negate(x) transform applied
before the body-frame/retarget math, exactly as the mission prescribes, so
calibration is done once in mirrored space (mirror defaults ON).

## 2026-06-10 — Fixture y4m at 720p/30fps
Raw 1080×1920\@60 y4m would be ~2 GB per clip. Chrome's fake capture is fed
406×720\@30 instead (~160 MB/clip, gitignored). Pose quality at 720p is
indistinguishable for this use; 30 fps matches typical webcam delivery.

## 2026-06-10 — Pose model + wasm vendored locally, fetched at install
`public/mediapipe-wasm/` is copied from node_modules postinstall;
`public/models/pose_landmarker_full.task` (Apache-2.0, Google) is downloaded
postinstall if missing. Neither binary lives in git; the app itself serves
everything same-origin and makes zero runtime network requests.
