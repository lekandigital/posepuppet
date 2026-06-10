PROJECT: PosePuppet — realtime webcam-to-3D-character motion in the browser.

WHAT THIS IS AND WHY
I move in front of my webcam (or upload a short video); the app detects my
body pose and a rigged 3D character in Three.js follows me live. Split
screen: my mirrored video + skeleton overlay on the left, the character on
a styled stage on the right. This is markerless browser puppeteering — a
motion puppet, NOT 3D reconstruction of me and NOT professional mocap, and
we never claim otherwise. The output I actually want is a demo good enough
to screen-record and post: upper body that looks ALIVE beats full body that
looks haunted. The viral clip is me shadowboxing and the character
shadowboxing back.

You are running long-horizon and largely unattended. Prefer a working
prototype over planning artifacts. Make the smallest visible thing, verify
it, improve it. The /goal block is the contract; this prompt is context,
hard constraints, distilled domain knowledge, and your verification rig.
Where I prescribe an approach, it's because it is a known-good path or a
known pitfall — you may deviate anywhere except NON-NEGOTIABLES if you log
the rationale in DECISIONS.md.

NON-NEGOTIABLES
- Privacy: all inference in-browser. No frame, landmark, or recording is
  ever uploaded anywhere. Say this in the README and UI footer.
- Licensing: only assets we may redistribute in a public repo + public
  demo. The procedural robot you build from primitives is the zero-risk
  default. For the rigged character, prefer VRM; shortlist 2–3 candidates
  with explicit licenses (CC0 or equivalently permissive), record
  everything in ASSETS.md, and STOP for my approval before committing any
  third-party asset. No Mixamo redistribution, no anime characters of
  unclear origin, nothing scraped.
- Honesty: every number that could end up in a post (FPS, latency, angle
  error, build hours) must come from eval/results.json or the session log,
  reproducibly. No invented metrics. Limitations get listed, not hidden.
- No external deploys, no analytics, no telemetry, without asking me.
- Never commit fixtures/ (it's me on camera) — gitignore it from commit 1.

STACK (recommended, deviate with rationale)
- Vite + React + TypeScript. React renders UI chrome ONLY. The capture →
  detect → retarget → render loop lives outside React: refs and an
  imperative loop. Per-frame data never touches React state or zustand —
  that's the classic way this app dies at 12 FPS. Settings/toggles in
  zustand or lil-gui are fine.
- three (vanilla scene management; no react-three-fiber needed).
- @mediapipe/tasks-vision PoseLandmarker: runningMode VIDEO, GPU delegate
  with WASM fallback, numPoses 1, full model variant by default with a
  lite-model toggle. detectForVideo driven by requestVideoFrameCallback
  (fall back to rAF), never more than once per video frame.
- @pixiv/three-vrm for the VRM avatar phase.
- MediaRecorder for clip export. No backend. No paid APIs. pnpm or npm.

PIPELINE KNOWLEDGE (hard-won; read carefully)
Landmarks: PoseLandmarker returns 33 points in two forms — normalized
image-space `landmarks` and metric `worldLandmarks` centered at the hips,
each with visibility. Use worldLandmarks for all 3D math; use normalized
landmarks for the 2D overlay and for root x/y positioning. Indices you'll
care about: 0 nose, 7/8 ears, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
23/24 hips.

Per frame, in order:
1. Visibility gate: a landmark below ~0.5 visibility contributes nothing
   this frame. A bone whose endpoints go invisible holds its last rotation
   and relaxes toward rest over ~0.5–1.0 s. Never snap to a garbage
   estimate; never freeze rigidly either.
2. Smooth landmarks BEFORE deriving rotations: One Euro filter per
   landmark axis (start near minCutoff 1.0, beta 0.007 — expose both in
   the debug panel; tune on the fast fixture). Adaptive by design: heavy
   smoothing at rest, light when moving fast. Then ALSO slerp the final
   bone quaternions toward their targets each render tick — two-stage
   smoothing is what separates "alive" from "jittery skeleton demo".
3. Body frame: hipCenter = avg(23,24); shoulderCenter = avg(11,12);
   up = norm(shoulderCenter − hipCenter); right = norm(rightShoulder −
   leftShoulder); forward = cross(right, up), re-orthogonalized. This
   frame gives you torso orientation (lean + turn), drift-free centering,
   and scale normalization (shoulder width → avatar units).
4. Bone directions from world landmarks: upperArm = elbow − shoulder;
   forearm = wrist − elbow; spine = shoulderCenter − hipCenter; head =
   nose − shoulderCenter (ears refine yaw/roll). Express each target
   direction IN THE BODY FRAME, not raw camera space, or torso turns will
   corrupt every limb.
5. Retargeting (the part that decides everything): at load, pose the
   avatar in its rest pose and store each mapped bone's rest direction.
   Per frame compute the quaternion rotating rest direction → target
   direction, apply a per-bone correction quaternion (expose as debug
   sliders, persist calibration to JSON), and — the pitfall that produces
   "possessed" limbs — convert the world-space target rotation into the
   bone's PARENT-LOCAL space before assignment. Get the parent's world
   quaternion, invert, premultiply. If limbs twist, suspect this first,
   then the rest-direction capture, then handedness.
6. Mirroring: default ON (the character is my reflection — raise my right
   hand, the character's screen-left hand rises). Implement as a clean
   landmark-space swap+negate, toggleable. The overlay video is mirrored
   too. Get this right early; retrofitting mirrors breaks calibration.
7. Root motion: subtle x (and slight y) from normalized hip center, depth
   scale hint from shoulder width, all clamped and heavily smoothed. The
   character shifts when I sidestep; it does not skate.
8. Coordinate sanity: MediaPipe is y-down, z-toward-camera-ish;
   Three.js is y-up right-handed. Centralize the conversion in ONE
   function with a unit test. Half of all haunted-puppet bugs live here.

Two avatars, in this order:
A. PROCEDURAL ROBOT FIRST — head sphere, torso box/capsule, cylinder
   limbs parented in a real bone hierarchy. You control every joint, so
   retargeting bugs are visible and attributable. Make it charming (matcap
   or toon material, slight head bob) — it may end up in the demo.
B. VRM SECOND — load via @pixiv/three-vrm, drive VRM humanoid bones
   (leftUpperArm, leftLowerArm, head, chest/spine, neck...) through the
   same retargeting layer behind a BoneMap interface, with a name-matching
   layer (J_Bip_*, mixamorig*, generic) so a GLB humanoid also works.
   Live avatar switcher.

YOUR VERIFICATION RIG (build this in Phase 1, you are blind without it)
You cannot see my webcam during the run, so you build eyes:
- Fixtures: fixtures/arms.mp4, fixtures/torso.mp4, fixtures/fast.mp4 are
  clips of me. If any are missing or unreadable, STOP with a USER ACTION
  telling me exactly how to record them. Convert with ffmpeg to .y4m for
  Chrome's fake camera.
- Fake webcam: Playwright Chromium launched with
  --use-fake-ui-for-media-stream
  --use-fake-device-for-media-stream
  --use-file-for-fake-video-capture=fixtures/<clip>.y4m
  so getUserMedia "sees" the fixture. This makes the ENTIRE pipeline —
  permission flow, detection, retargeting, overlay, recording — testable
  headlessly. If headless WebGL is flaky, run headed under xvfb-run;
  SwiftShader correctness-passes do not count as performance numbers —
  measure FPS in a real headed run on this machine and label which is
  which in eval/results.json.
- Eval mode: ?eval=<fixture> runs a fixture through the live pipeline and
  writes eval/results.json: % frames with detection, pose-loop FPS, render
  FPS, dropped frames, memory at 0/30/60 s, and the SYNC METRIC — per
  limb, the angle between the 2D landmark limb vector and the avatar's
  same limb projected to screen space, averaged over the clip. This number
  is your ground truth for "does the character actually copy the person".
  Track it per phase; it must improve or you must know why.
- Vision self-review: every phase, capture paired screenshots (video frame
  beside avatar at identical timestamps, several poses per fixture), look
  at them, and write one honest paragraph in EVAL_NOTES.md: does the
  avatar match? Twisted joints? Dead wrists? Robotic stiffness? You have
  vision — use it on your own output; the angle metric cannot see
  "creepy".
- Playwright suite: app boots clean, permission flow works, landmarks
  stream, overlay canvas aligns with video element, eval mode exits with
  metrics over thresholds, record button yields a nonzero playable .webm.
  Suite green before every commit to main.

MILESTONES (commit + EVAL_NOTES entry + screenshot at each; stop only at
marked USER ACTION gates)
M0 Scaffold: Vite app boots, webcam permission + mirrored video, empty
   Three.js stage, FPS HUD. Playwright fake-cam smoke test passes.
M1 Detection + rig: PoseLandmarker streaming; skeleton overlay sticking to
   the body on all three fixtures; eval mode + Playwright suite + sync
   metric SCAFFOLDING all working (metric will be bad — log it anyway as
   the baseline).
M2 Procedural puppet ALIVE: full pipeline steps 1–8 onto the robot. Exit
   bar: arms.mp4 upper-limb sync ≤20°, no visible jitter at rest in a
   10 s screenshot sequence, off-screen hand decays gracefully.
   >> USER ACTION GATE: I run the live webcam test (you give me a 90-second
   test script: arm raise, cross-body reach, lean, head turn, one hand out
   of frame, fast shadowbox). I report feel + latency. Do not proceed to
   VRM until I say the robot feels right — fix what I report first.
M3 Calibration + robustness: neutral-pose calibration (3-2-1 countdown),
   per-bone offset sliders persisted to JSON, upper-body vs full-body
   toggle (full-body only engages when hips+knees are confidently visible;
   otherwise legs hold a relaxed idle), smoothing toggle for A/B, video-
   file input path through the same pipeline.
M4 VRM avatar: licensed character through the BoneMap layer, live
   switcher. Exit bar: sync ≤15° upper limbs on arms/torso fixtures, ≤25°
   on fast.mp4, no limb twist in vision review.
   >> USER ACTION GATE: second live test, both avatars; I approve motion
   quality before polish.
M5 Stage + ship: dark studio stage, ground grid, rim + key light, soft
   shadows, subtle hand motion trails, confidence meter, LIVE badge,
   style/theme toggle if cheap (neon / toon / wireframe). Record button:
   composite the side-by-side into one canvas, captureStream(30) →
   MediaRecorder → downloadable .webm with a 15 s quick-record preset.
   README (setup, how it works in 10 lines, limitations, privacy line),
   DEMO_SCRIPT.md, POSTS.md. Full eval refresh; final numbers into README.
   >> USER ACTION GATE: filming session + post approval.

OUT OF SCOPE FOR V1 (do not build, list in README as future work)
Fingers/hand tracking, face/expressions, physics or proper IK chains,
multi-person, mobile support beyond "it loads", avatar marketplace,
animation export (FBX/BVH), segmentation-mask compositing, the flight-sim
and body-controlled-flight ideas (parked deliberately), any backend.

OPERATING RULES
- Working > planned. If a sub-approach burns 45 min without progress, log
  it in DECISIONS.md and take the simpler path.
- Conventional commits at every green suite; main always runs.
- If a dependency fights you (e.g. tasks-vision versioning, three-vrm
  breaking changes), check the installed package's own docs/types in
  node_modules before searching the web; trust the version you have.
- Time checkpoints: every ~2 h of work, append a 5-line status to
  STATUS.md: done, current sync metric, FPS, blockers, next.
- When the goal criteria are all green and gated approvals are in, STOP.
  Resist gold-plating; the demo ships imperfect.

DEMO_SCRIPT.md (write it for me to film)
A 15–20 s shot list I can perform: open on split screen → both arms raise
→ lean left/right with trails → cross-body reach → fast shadowbox → avatar
switch robot→VRM mid-motion → end on a held pose. Include framing tips
(waist-up, light from front, plain wall), the in-app record settings, and
one fallback take if full-body is unreliable on my setup.

POSTS.md (draft after final eval; my voice, my rules)
Voice: lowercase, understated, specific, technical. No hashtags, no
exclamation marks, no emojis, no "game-changer/mind-blowing/the future
of/isn't just X — it's Y". Numbers from eval/results.json only; map every
number to its source field in a small verification table I can check.
Structure: first line works alone above the fold; payoff below it; one
honest flaw stated plainly (e.g. legs, depth ambiguity, single-camera
limits); links and repo go in a planned self-reply, never the main post;
end on one quotable kicker where natural.
Draft three main-post variants (data-led / story-led / kicker-led) plus a
short thread version with per-tweet media pulled from media/ and the
recordings, plus the self-reply. Two seed angles to beat, not to copy:
"the hard part is not detection. it's making the avatar move without
looking possessed." and "i gave fable 5 one goal: turn my webcam into a
realtime 3d character rig in the browser. [N] hours, autonomous. webcam →
pose → character, all local, nothing uploaded." I post manually; you never
post anything.

FIRST ACTIONS, IN ORDER
1. Verify environment (node, ffmpeg, Chrome, GPU) and that fixtures/ has
   the three clips — if not, USER ACTION with exact recording specs.
2. Scaffold M0 and get the Playwright fake-cam smoke test green.
3. Propose the VRM shortlist with licenses (USER ACTION approval) so the
   asset is ready by M4 — then continue building while you wait.
Begin.