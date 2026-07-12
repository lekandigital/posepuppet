# V5 — Character Control Upgrade: plan + file ownership

Branch `feat/character-control`, worktree `~/Dev/wt-charcontrol`, tmux
`ba-char`, port **5177**, display `:2` under the display lock. Prompt:
docs/BODYARCADE_PROMPT_PACK_V2.md §V5. Autonomy policy per
BODYARCADE_CONTEXT.md v2 — no user gates; human checks land in
FINAL_USER_TEST_PLAN.md §S4.

## Reading of the code (audit result)

- The curated roster is `src/rig/avatarRegistry.ts`: robot (procedural),
  astronaut + erika (VRM, shipped), woody (VRM, local-only optional).
  `generatedAvatarRegistry.ts` entries are test-only and stay out of the
  manifest.
- Retargeting lives in `src/rig/retarget.ts` (direction-swing FK + a
  face-touch v1 proximity magnetism with two-bone IK and a spherical head
  collider). Feet are plain direction swings; skating is unaddressed.
- Hand capability today: pose-only openness/point approximation
  (`updateHands` → `avatar.applyHandState`), finger chains only exist in
  `src/rig/vrm.ts` (per-segment curl axes computed from rig geometry).
- Hand landmarks: `packages/pose-runtime/src/handDetector.ts` (21-point,
  currently `numHands: 1`, used only by hand-only mode).
- Eval rig: `?eval=` in-page collector (`src/eval/runner.ts`, sync metric
  `src/eval/sync.ts`), node runner `eval/run.mjs` → `eval/results.json`.
  Face-touch reach/penetration and pinch→jaw metrics already exist.
- Labels: hardcoded card defs in `src/ui/cards.ts` — become manifest-driven.

## File ownership (exact)

**Created (owned):**
- `data/avatar-capabilities.json` — the manifest
- `scripts/capability-report.mjs` — report-only regen/check script (Playwright)
- `src/rig/capabilities.ts` — manifest load + gating API (typed)
- `src/rig/faceSockets.ts` — face-touch v2 socket classification + anchors
- `src/rig/feetPlanting.ts` — planted-foot state machine + root correction
- `packages/pose-runtime/src/handFusion.ts` — reduced-rate hand-landmark
  fusion anchored at pose wrists (additive package module)
- `tests/charcontrol.spec.ts` — O2/O3/O4 specs (fixture-driven)
- `tests/capability-manifest.spec.ts` — manifest ⇄ ground-truth check incl.
  deliberate-mislabel detection

**Modified (owned for this prompt):**
- `src/rig/retarget.ts` — face-touch v2 (sockets, capsule), feet v2 seams,
  fusion-driven hand state routing
- `src/rig/vrm.ts` — capability report, per-finger curl driving, head capsule
- `src/rig/robot.ts` — capability report, head capsule fields
- `src/rig/types.ts` — additive `Avatar` interface extensions
- `src/ui/cards.ts` — labels read from the manifest
- `src/main.ts` — wiring only: fusion lifecycle, capability hook for the
  report script, coach capability lines, eval deps (no boot/camera-lifecycle
  changes; V5 owns shell edits per the pack when touched at all)
- `src/eval/runner.ts` + `eval/run.mjs` — additive metrics: finger-curl
  correlation, per-socket face-touch, skating; fusion on/off perf rows
- `packages/pose-runtime/src/handDetector.ts` — additive options
  (numHands, maxHz); no interface breaks (RFC not required)
- `packages/pose-runtime/src/index.ts` — export the new module/types
- Docs: `PLAN.md` `DECISIONS.md` `EVAL_NOTES.md` `STATUS.md`/`status.md`
  `README.md` `CHANGELOG.md` `ARCHITECTURE.md` `FINAL_USER_TEST_PLAN.md`
  (S4 section only)

**Not touched (V6/V7/V1 territory):** `src/memory/*`, `src/record/*`,
`src/director/*`, `src/gesture/*`, `packages/body-input/*`,
`packages/pose-hud/*`, runtime boot/camera lifecycle
(`packages/pose-runtime/src/runtime.ts` stays as-is), `apps/*`,
`playwright.config.ts`, all other test specs.

## Approach per outcome

**O1 Manifest.** Additive `Avatar.describeCapabilities()` implemented by the
existing loaders (robot inline; vrm.ts from its real bone/finger-chain/head
geometry data). `scripts/capability-report.mjs` boots the real app per
roster avatar (load-only; no camera needed), reads the report via a window
hook, and either writes a fresh manifest draft (`--write`) or diffs live
inspection against `data/avatar-capabilities.json` (`--check`, exits
non-zero on drift). No standalone tool, no repair, no conversion — the
script is report-only. Woody is local-only: entry carries
`"localOnly": true` and the check skips it when the file is absent (stated
in the report output).

**O2 Hand boost.** `createHandFusion` (pose-runtime, additive): wraps the
hand detector with `numHands: 2`, detection capped ~12 Hz, run ONLY while
(a) character mode, (b) manifest says the current avatar is finger-capable,
(c) pose wrists visible — hands-visible-only inference. Hands are
associated to pose wrists by proximity in raw image space (handedness
labels are unreliable mirrored); the app maps raw side → enacted side under
mirroring. Per-finger curls from joint bend angles (EMA-smoothed) drive a
new additive `Avatar.applyFingerCurls()` (vrm.ts, reusing the existing
per-segment curl axes); a clamped palm-twist refinement rides the hand bone
on capable rigs. Staleness > 400 ms falls back to the pose-approximation
path (which keeps running for incapable rigs — they are never handed finger
data; gate asserted by test).

**O3 Face-touch v2.** Seven named sockets — cheekL, cheekR, chin,
mouthCover, forehead, temple, underChin, thinkingPose — classified from the
person's wrist offset expressed in their own head frame (ears+nose basis;
pose-only, no face-landmark scope). Avatar-side anchors sit on a head
CAPSULE (fit from the real skinned head vertices in vrm.ts; authored for
the robot), targeted by the existing two-bone IK with contact easing and
socket-change easing; per-avatar reach uses bind-time arm lengths, class
recorded in the manifest. thinkingPose = chin/under-chin dwell (low wrist
speed ≥ ~0.8 s). Zero-interpenetration is enforced by construction (IK
target outside the capsule) and measured (capsule-distance penetration
counter). facetouch.mp4 reports per-socket reach; sockets the fixture
doesn't visit are covered by a deterministic synthetic landmark sweep in
`tests/charcontrol.spec.ts` (documented honestly in eval notes).

**O4 Feet v2.** Per-foot plant detection from landmarks (ankle near ground
baseline + low velocity + visibility, full-body mode only). While planted,
the avatar's planted ankle is anchored: measured world drift is subtracted
from the root (smoothed, capped), killing skating while letting lifted-foot
steps read as steps. Planted feet level their soles (ankle orientation);
weight shift adds a small clamped hips roll toward the stance foot. Skating
metric (mean planted-ankle screen drift px/frame) added to the eval; the
threshold is set from the measured before/after on fullbody.mp4 and
asserted in a spec.

**O5 Labels/coach/docs.** `src/ui/cards.ts` chips/notes come from the
manifest; coach gets manifest-driven capability lines (e.g. finger-capable
avatar vs not, face-touch class) surfaced once per avatar switch — low-nag.
README/CHANGELOG/ARCHITECTURE updated; S4 entries written with evidence
links.

## Verification map (prompt → artifact)

| Check | Artifact |
|---|---|
| manifest matches ground truth; mislabel caught | `tests/capability-manifest.spec.ts` + `capability-report.mjs --check` |
| finger-curl correlation on capable rigs | eval `fingerCurl.r` on hand_open_close/hand_pinch_point × erika |
| incapable rig provably not finger-driven | spec asserting gate closed + zero `applyFingerCurls` on astronaut/robot |
| seven sockets, zero interpenetration | facetouch.mp4 eval per-socket + synthetic socket sweep spec |
| skating under threshold | eval `feet` block on fullbody.mp4, asserted in spec |
| perf ON/OFF | eval rows fusion on/off (headed :2 under display lock), table in EVAL_NOTES |
| no sync regression | before/after eval on arms/torso/fast/fullbody × robot,astronaut,erika vs the baseline recorded at P0 |
| suites green | root Playwright suite (baseline: 110 pass + 2 SwiftShader-only ENVIRONMENT_BLOCKED detect specs) |

## Risks

- Second MediaPipe graph (hand) beside the pose graph: GPU contention on
  weak machines — mitigated by 12 Hz cap + visibility + capability gating,
  and measured; if the ON state misses floors the fusion rate drops first.
- facetouch.mp4 socket coverage unknown → synthetic sweep is the
  deterministic backstop; honest split recorded.
- Hips roll for weight shift interacts with chest/legs frame math —
  clamped ≤ ~4°, eased, and sync metrics guard it.
- SwiftShader vs :2: correctness headless anytime; perf only headed on :2
  under `flock /tmp/bodyarcade-display2.lock`.
