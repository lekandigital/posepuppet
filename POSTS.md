# Posts

Drafts below follow the voice contract: lowercase, understated, specific,
technical. No hashtags, no exclamation marks, no emojis, no banned phrases.
Links and repo go in the self-reply, never the main post. I (Lekan) post
manually; nothing is ever posted by tooling. Every number maps to a field in
the verification table at the bottom.

---

## Main post — variant A (data-led)

> webcam → 33 body landmarks → quaternions → a 3d character copying me live
> in the browser tab. no backend, nothing uploaded.
>
> tracking error against my own limbs on screen: 9.5° on slow arm work,
> 19.2° mid-shadowbox. detection held 100% across six 60-second runs, pose
> loop pinned at the camera's 30 fps.
>
> the honest flaw: one camera means depth is a guess. it reads my shoulder
> width and commits.
>
> a motion puppet, not mocap. it just has to look alive — and the gap
> between alive and haunted turns out to be about ten degrees.

## Main post — variant B (story-led)

> i gave fable 5 one goal: turn my webcam into a realtime 3d character rig
> in the browser. ~6 hours of commits, autonomous, all local.
>
> first thing it built was its own eyes — a fake-webcam rig that pipes clips
> of me into chrome so it could screenshot the avatar next to my body and
> grade itself. baseline limb error: 68.9°. it shipped at 9.5°.
>
> one camera, no depth — leaning works, walking at the lens is a heuristic.
> it logged that as a limitation instead of hiding it, which is more than i
> expected.
>
> the robot moved by lunch. the astronaut moved by mid-afternoon.

## Main post — variant C (kicker-led)

> the difference between a puppet and a haunting is about ten degrees.
>
> posepuppet: webcam in, rigged 3d character out, live in a browser tab.
> two avatars — a primitive robot and a cc0 vrm astronaut — driven by the
> same retargeting math: one euro filter on metric landmarks, body-frame
> limb targeting, parent-local quaternions, slerp on top.
>
> 9.5° limb error slow, 19.2° shadowboxing, 30 fps pose loop, zero frames
> dropped from detection. single-camera depth remains a polite fiction.
>
> all inference in-page. no frame, landmark, or recording leaves the machine.

## Thread version

1. webcam → 3d character, live, in the browser. split screen: me + skeleton
   overlay left, puppet right. nothing uploaded anywhere.
   [media: recordings/<demo-take>.webm]
2. the pipeline: mediapipe pose → mirror → one euro filter (tuned for metric
   space — beta 8, not the textbook 0.007) → body-frame limb directions →
   parent-local quaternions → slerp. two-stage smoothing is what separates
   alive from jittery.
   [media: media/m2-robot.png]
3. the agent building this couldn't see my webcam, so it built a fake one:
   chrome's fake-video-capture fed with clips of me, screenshots of the
   avatar beside my body, and an angle metric grading every limb per frame.
   baseline 68.9° → shipped 9.5°.
   [media: media/m1-detect.png]
4. same retargeting layer drives a primitives robot and a cc0 vrm astronaut,
   switchable mid-motion. the one real vrm bug: a default flag that quietly
   overwrites your bone rotations every frame. the astronaut stood in a
   perfect t-pose, ignoring me, until one line turned it off.
   [media: media/m4-vrm.png]
5. honest limits: one camera so depth is inferred from shoulder width, legs
   only engage when hips and knees are confidently visible, and the fastest
   punches land a beat late. it's a puppet, not mocap. it just has to look
   alive.

## Self-reply (links)

> repo + setup: <REPO_URL_WHEN_PUBLIC>
> everything runs in-page — no backend, no analytics, no uploads. clips of
> me used for testing never leave the machine and never enter the repo.

---

## Verification table

| claim | source |
|---|---|
| 9.5° slow arm work | eval/results.json → results[fixture=arms, avatar=robot].sync.upperLimbsMean = 9.51 |
| 19.2° shadowbox | eval/results.json → results[fixture=fast, avatar=robot].sync.upperLimbsMean = 19.18 |
| astronaut 10.9° / 20.3° | results[arms, vrm].sync.upperLimbsMean = 10.86; results[fast, vrm] = 20.26 |
| detection 100%, six 60s runs | all six results[].detectionRate = 1, durationSec = 60 |
| 30 fps pose loop | results[].poseFps = 29.06–29.79 (30 fps fixtures; headed run, Apple M5, GPU delegate) |
| zero dropped detection frames | results[].detectedFrames = videoFrames on all six |
| baseline 68.9° → 9.5° | EVAL_NOTES.md M1 entry (static-robot baseline) → current arms result |
| ~6 hours of commits | git log: M0 scaffold 08:26 → M4 14:24, 2026-06-10 (same-day session) |
| "about ten degrees" | rhetorical rounding of the 9.42–10.86° range above |
| two avatars, cc0 | ASSETS.md (astronaut: CC0 in embedded VRM meta) |

Note: no millisecond latency figure is claimed anywhere — we never measured
one. If asked: pose cadence is ~33 ms (30 fps) plus smoothing lag; the live
feel was approved at both user gates, and that's the only claim made.
