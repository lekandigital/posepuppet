# PLAN.md — Predictive Pose Continuity (PPC)

Status: **awaiting USER GATE 1** (plan + thresholds approval).
Branch `predictive-pose-continuity-fable`. The BodyArcade Flight plan
(accepted 2026-07-07) lives in git history at this path.

Scope guard, restated from the brief: this pass lives at the PosePuppet
tracking layer. No per-game prediction, no Flight control-mapping or
feel changes, no ML, no long-horizon prediction, no claim of
occlusion-proof tracking anywhere. PPC is explicitly NOT invisible-limb
tracking and the docs will say so.

## 0. What the P0 audit found

### Baselines (regression gates)

- PosePuppet suite: **73 passed / 5 skipped** — matches the stated
  baseline (3.5 m, this machine, 2026-07-07).
- Flight suite, first run: **16 passed / 1 failed / 2 skipped** — the
  failure was `feel.spec.ts › superman arms: arms down stabilizes, arms
  out flies`, on a tree with zero changes. Rerun in isolation: **passed
  (19.6 s)**. This matches the suite-order/contention flake already
  documented in EVAL_NOTES.md ("passed alone and in the next two full
  runs; watching it"). Full-suite rerun result recorded below. Treated
  as flake, not regression — but it will be watched at every later
  phase, and any repeat gets investigated as a regression, never fixed
  by retuning Flight.
- Flight suite, full rerun: **17 passed / 2 skipped** (11.4 m) — clean
  baseline reproduced.
- Fully-visible sync/perf baseline: eval/results.json (2026-07-02
  refresh, headed, Apple M5): upperLimbsMean per fixture×avatar ranges
  2.2°–23.4° (fast is the honest worst case); detectionRate 1.0
  everywhere; pose ~29–30 fps, render ~116–123 fps. That table is the
  non-regression reference (§3).

### The current occlusion path ("legacy hold/decay"), precisely

There is no landmark-level continuity today. Three layers each cope
separately:

1. **Landmark smoothing** (`src/pose/smoothing.ts`): One Euro per axis
   + visibility EMA (0.7/0.3). During occlusion MediaPipe still emits
   low-visibility garbage positions; the filter keeps filtering them;
   consumers are expected to gate on visibility.
2. **Retargeter** (`src/rig/retarget.ts`): per-bone visibility
   hysteresis (VIS_ON 0.55 / VIS_OFF 0.45) → `confident` flag. On loss:
   angular-velocity coast (τ 0.25 s) → relax-to-rest (τ 0.7 s,
   `config.relaxSec`) → idle micro-sway after 1.5 s; 120° joint limit.
   On re-acquisition: smoothstep blend from the held pose over
   `clamp(0.8 × lostSec, 0.08 s, 0.5 s)`, half-rate slerp while
   settling. Bone/rotation space only — positions are never predicted,
   and body-input never benefits (it runs on raw landmarks).
3. **body-input** (`packages/body-input`): receives the
   **pre-smoothing** mirrored landmarks (`main.ts` `onPoseFrame`), runs
   its own filter bank. Axes go null below `visGate` → shaper decays to
   neutral. Confidence = 0.6·shoulders + 0.2·hips + 0.2·nose
   visibility; EMA τ 150 ms up, exponential decay τ 300 ms on dropout.
4. **Flight** (`apps/flight … bodyControls.ts`, Gate-3-frozen): body
   source counts as lost below confidence 0.35 or signal older than
   350 ms → autopilot decays intent to neutral (τ 0.25 s); re-entry
   slew-bounded at 2.0 intent/s. **This contract is consumed, not
   touched.**

### The insertion point

`main.ts` `onPoseFrame` is a single fork: mirrored landmarks go to (a)
smoother → retargeter, (b) body-input adapter, (c) eval collector. PPC
inserts **at that fork, after mirroring, before everything** — one
continuity stage whose output every consumer inherits (puppeteering AND
body-input, as the brief requires). Timestamps: frame time already
flows through here, and the retargeter already learned the hard way
(Motion Memory round-trip) to use frame-consistent clocks — PPC uses
frame timestamps only, no wall clocks, no randomness → determinism is
testable.

Key structural guarantee: **PPC is an exact pass-through for landmarks
above the visibility gate.** It only writes positions/visibility during
PREDICTED / RELAXED / re-entry. Fully-visible non-regression is then
structural; the eval tolerance in §3 is belt-and-braces.

## 1. Design (P1–P2)

New `src/pose/continuity.ts` (~350 lines + node unit tests), named in
code and docs: **Predictive Pose Continuity**.

- **Ring buffer**: last 16 frames of (t, x, y, z, visibility) per
  landmark, world + norm streams (one shared state machine; world
  drives states, norm gets the same-state 2D treatment so eval and
  root motion stay consistent).
- **Velocity**: least-squares linear regression over the last 5
  visible frames (~165 ms @ 30 fps) — noise-robust, no ML.
- **Per-limb state machine** (groups: leftArm, rightArm, leftLeg,
  rightLeg, head, torso — driven by their landmarks' smoothed
  visibility with the existing 0.55/0.45 hysteresis):
  - `VISIBLE → PREDICTED`: visibility < 0.45 (or full-frame dropout).
  - `PREDICTED`: position advances on the regressed velocity with
    exponential damping (τ 180 ms), under constraints: bone-length
    projection onto the parent landmark (median segment length from
    the buffer, ±10%), per-frame displacement cap (§2), and a
    rest-pose bias whose weight grows with age² (0 at entry → 0.3 at
    horizon). "Gravity" ships only as this rest bias — honest, cheap.
  - `PREDICTED → RELAXED`: age > horizon (§2). Position eases toward
    the rest-posture estimate; confidence continues to 0.
  - `→ VISIBLE` (from either): re-entry blend — measured data ramps in
    over §2's window with a max per-frame correction. Never snaps.
- **Confidence output** (written into the visibility field downstream
  consumers already read): `vis_out = vis_enter × ageDecay ×
  agreement`, where ageDecay is linear 1.0 → 0.35 across the horizon
  and agreement ∈ [0.6, 1.0] penalizes prediction that violates
  bone-length against visible neighbors. Consequence: the retargeter's
  own VIS_OFF gate hands bones from prediction to the existing relax at
  ~⅘ of the horizon — the layers compose instead of double-predicting;
  games see honestly decaying confidence and decide their own
  autopilot.
- **Engineering view**: per-limb state chip (state, age ms, conf) in
  the existing mono engineering surface.
- Deliberately NOT: visibility ever above the input's, prediction past
  the horizon, per-game behavior, any learned model.

## 2. Proposed numeric thresholds (Gate-1 approval items)

| Threshold | Proposed value | Rationale |
|---|---|---|
| Prediction horizon | **400 ms hard cap** (spec range 300–500) | ~12 pose frames; long enough for hand-past-face / step transit, short enough to stay honest. Test-enforced: no PREDICTED sample older than 400 ms, ever. |
| Confidence decay | **linear, vis×1.0 → vis×0.35 over the 400 ms horizon**, then → 0 within 250 ms in RELAXED; agreement multiplier 0.6–1.0 | crosses retarget VIS_OFF 0.45 at ≈ 330 ms (clean handoff to the existing relax); crosses Flight's 0.35 at ≈ the horizon; visible in the HUD; never fakes certainty |
| Re-entry duration | **0.8 × outage, clamped [0.1 s, 0.4 s]** | mirrors the gate-approved bone-level rule; flickers recover fast, real occlusions take the full beat; inside the 0.3–0.5 s spec for real occlusions |
| Max correction per frame | **0.06 m per landmark per pose frame** (~1.8 m/s at 30 fps) during re-entry; existing bone bound (< 10°/render-tick) retained | below fast-gesture speeds on the fixtures, so corrections hide inside motion; a visible snap would need ~0.3 m |
| Acceptable masked-fixture error | **PPC ≤ legacy on every masked fixture (mandatory); target ≥ 20 % lower on moving-limb masks; provisional absolute bound mean ≤ 0.12 m, p95 ≤ 0.25 m** during PREDICTED (masked landmark vs same-frame truth, masks ≤ 400 ms) | the relative bound is the honest core claim; absolutes are provisional until legacy is measured at P3 — both get published in results.json, and if the absolutes move, DECISIONS.md says why |
| Fully-visible non-regression | **\|Δ upperLimbsMean\| and \|Δ legsMean\| ≤ 1.0° per fixture×avatar** vs the 2026-07-02 table; detectionRate unchanged; pinch→jaw r ≥ 0.8 held; **zero NaN**; plus the structural pass-through unit test (byte-equal output when fully visible) | 1.0° covers run-to-run jitter on a metric whose means run 2°–23°; the pass-through test is the real guarantee |

Also fixed by test rather than threshold: determinism (same recorded
stream → identical PPC output twice), joint limits never exceeded, no
exploding values on any fixture.

## 3. Legacy vs PPC, side by side

| Aspect | Legacy (today) | PPC (proposed) |
|---|---|---|
| Landmarks during occlusion | low-vis garbage passes through; gated out downstream | short constrained prediction, decaying confidence |
| Prediction horizon | none (bone coast τ 0.25 s, rotation only) | 400 ms hard cap, positions + everything downstream inherits |
| Confidence during loss | binary per-bone flag; body-input decay τ 300 ms | per-landmark decay (linear → 0.35 over 400 ms) + per-limb state flags |
| Re-entry | bone-space blend clamp(0.8·lost, 0.08–0.5 s) | landmark-space blend clamp(0.8·outage, 0.1–0.4 s) + 0.06 m/frame cap; bone layer unchanged on top |
| body-input during a hand dropout | axis → null instantly; shaper decays to neutral | axis continues ≤ 400 ms on decaying confidence, then the identical decay |
| Measured by | occlusion.spec bone angles only | + masked position error, re-entry no-snap delta, horizon cap, determinism, flight-contract timing |

Legacy numbers published alongside PPC at P3 (same masked fixtures,
both systems): hold-last-visible position error during masks,
masked-run sync means, autopilot engagement time on full dropout.

## 4. Verification plan (P3; flight contract at P4)

**Masked-fixture harness** — reuses the fixture → y4m → fake-webcam
rig; no new recordings needed before Gate 1:

- Mask specs are data (`eval/masks/*.json`): named landmark groups +
  windows keyed on **videoTimeMs** (deterministic across runs). Planned
  specs map to the brief's use cases: hand leaves frame (arms), hand
  crosses face (facetouch), foot disappears (fullbody), brief full
  dropout + motion blur (fast).
- Injection is eval-only (`?mask=<name>`), applied at the fork. The
  **same frame** provides ground truth: record pre-mask landmarks →
  zero the group's visibility → PPC → record output + state. Truth and
  output live in one run — no cross-run frame-alignment problem — and
  the masked-run sync metric samples against the truth stream, so it
  directly measures "did the puppet keep matching the person while
  blind", comparable PPC-on vs legacy (`?ppc=0`).
- New results.json fields: `ppc.maskedPositionError` (mean/p95 m,
  PREDICTED only, per fixture, PPC and legacy), `ppc.reentryMaxDelta`
  (m/frame), `ppc.horizonMaxMs`, `ppc.maskedSync` (vs truth, PPC and
  legacy), `ppc.nanCount`.
- Existing occlusion.spec stays green unchanged (relax < 0.25 rad,
  < 4°/tick relaxing, < 10°/tick re-entry, settle ≤ 1.2 s, joint
  limit) — it then exercises the composed PPC+relax path.

**Flight confidence contract (P4)** — additive only:

- body-input schema gains an optional per-limb `tracking` state block
  (additive field, protocol stays v1-compatible; Flight ignores it
  today). No Flight gain/assist/mapping/timing code is touched.
- Full-frame dropout: PPC's core-landmark (shoulders/hips/nose) decay
  is tuned so Flight's autopilot engagement time shifts **≤ +100 ms**
  vs legacy, measured by the existing injected-dropout closed-loop eval
  (altitude in band, no terrain contact, smooth re-entry — unchanged).
  The shift is documented in results, not silent. If ≤ +100 ms proves
  unreachable without dishonest confidence, the fallback is
  pass-through-on-full-dropout (PPC acts only on partial occlusion) —
  decided by measurement, logged in DECISIONS.md.
- Flight suite (17) runs unmodified at every phase; any failure is
  investigated as a regression of my layer, never fixed by retuning
  Flight.

**Determinism**: unit test drives a synthetic recorded stream through
PPC twice in node → identical outputs. PPC has no wall clocks and no
randomness by construction.

## 5. Phases and effort

- **P1** — ring buffers, velocity regression, state machine,
  constraints (`continuity.ts` + unit tests). ~½ day. Each phase ends:
  suite green, commit, EVAL_NOTES + status entries.
- **P2** — re-entry blending, confidence model, engineering-view
  chips, main.ts wiring behind `?ppc=` flag (default on). ~½ day.
- **P3** — mask harness, metrics, legacy-vs-PPC measurement, publish
  results + threshold check. ~1 day; biggest phase. §2's provisional
  numbers get confirmed or honestly revised here.
- **P4** — body-input additive flags, flight-contract measurement,
  docs (docs/PPC.md: states, constraints, limits, the "not
  invisible-limb tracking" line; README note; DECISIONS; CHANGELOG).
  ~½ day.
- **>> USER GATE 2** — live test: hide a hand mid-gesture, cross the
  face, step a foot out of frame; the puppet should look intentional,
  not haunted. Fix what's reported.

## 6. Risks

1. **Decay-shape ↔ VIS-gate coupling**: how long bones ride prediction
   is set by where the decay crosses 0.45. One constants table, masked
   evals as the feedback loop, live gate as the final judge.
2. **Autopilot timing shift** on full dropout — bounded and measured
   (§4); fallback defined in advance.
3. **Face-touch interplay**: a predicted wrist keeps face-touch
   engaged briefly (that IS the hand-crosses-face use case working);
   the penetration guard runs downstream and the masked facetouch eval
   watches it.
4. **Handoff double-motion** (PPC deceleration, then bone coast):
   velocities at handoff are already damped so coast energy is small;
   the extended occlusion spec asserts no second-phase kick.
5. **Flight feel flake** (superman-arms) recurring in contended runs —
   pre-existing, documented; watched every phase, investigated if it
   repeats in isolation.

## 7. Explicitly out / unchanged

Flight profile gains, assist ladder, autopilot constants, input
mappings (all Gate-3-frozen); TinySkies provenance matters;
LICENSE_NOTES.local.md; fixture videos (gitignored, none committed,
none re-recorded for Gate 1 — synthetic masks over existing footage
cover every listed use case); no merge, no push.
