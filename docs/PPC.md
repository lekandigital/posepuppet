# Predictive Pose Continuity (PPC)

Graceful short-term prediction when landmarks disappear: visible landmark
stream → per-landmark history buffer → brief plausible prediction →
visible confidence decay → smooth re-entry.

**What it is not.** PPC is NOT invisible-limb tracking. It cannot know
where your hand went once the camera stops seeing it — it makes the
first ~⅓ second of an occlusion look intentional instead of haunted,
says so in its confidence output, and then honestly gives up (the limb
relaxes, exactly as it did before PPC). Nothing in PosePuppet claims
occlusion-proof tracking, and downstream consumers always see the
decayed confidence — games decide their own autopilot; this layer never
fakes certainty.

## Where it sits

`src/pose/continuity.ts`, applied at the single fork in `main.ts` after
mirroring and before everything else — the retargeter (through One
Euro), Motion Memory, the gesture/intent layer, `@bodyarcade/body-input`,
and the eval collector all inherit the same continuity-processed stream.
Landmarks above the visibility gate pass through **exactly** (same
values); PPC only writes during occlusion and re-entry. `?ppc=0` (or the
engineering-panel toggle) restores the legacy path.

## States (per limb group)

Six groups: torso, head, leftArm, rightArm, leftLeg, rightLeg — gated on
their key landmarks' smoothed visibility with the same 0.55/0.45
hysteresis the retargeter uses.

```
VISIBLE ──vis < 0.45──▶ PREDICTED ──age > horizon──▶ RELAXED
   ▲                        │                           │
   └──────vis > 0.55 — re-entry blend, never snaps──────┘
```

- **VISIBLE** — exact pass-through; well-measured samples (vis ≥ 0.5)
  feed a 16-frame ring buffer per landmark.
- **PREDICTED** — position advances on a least-squares velocity from the
  last 5 buffered samples, under constraints (below). Entry re-anchors
  on the last well-measured sample (MediaPipe hallucinates positions
  during occlusion; the 2–3 hysteresis frames of low-vis data are never
  trusted), dead-reckoned across the gap on the trusted velocity.
- **RELAXED** — past the horizon the position eases toward a hanging
  rest chain and confidence completes its fall to 0. Downstream, the
  retargeter's existing relax-to-rest owns the look (unchanged from the
  gate-approved behavior).
- **Re-entry** — measured data blends back over `0.8 × outage`, clamped
  0.1–0.4 s, with a hard per-frame correction cap of 0.06 m. The blend
  refuses to end until it has converged onto the measured stream, so a
  long outage with a big displacement still cannot pop.

## Constraints on prediction

- **Horizon cap**: 400 ms for limbs, 250 ms for torso/head (if the core
  is gone, the person is gone — and Flight's autopilot timing must not
  drift). Enforced by tests; a PREDICTED sample older than the cap is a
  bug.
- **Velocity trust** (all deterministic, measured on the masked-fixture
  eval): the regression's own residual (bad line fit ⇒ oscillating or
  noisy ⇒ less trust), a deceleration factor (recent 3-sample velocity
  projected onto the window velocity — a limb already slowing at loss
  is not extrapolated at full speed), and a speed knee at 1.3 m/s
  (gestures much faster than this are strikes/swings that reverse inside
  the horizon; extrapolating them measurably loses to holding still).
  Low trust also shortens the confidence decay, so an uninformative
  prediction hands bones back to the gate-approved hold quickly.
- **Damping**: coasted velocity decays with τ = 140 ms.
- **Entry-pull**: with age, the prediction retracts toward the last-seen
  position anchored to its (usually still-measured) parent — it rides
  torso translation but never flies away. Hard drift cap 0.3 m.
- **Bone-length shell**: predicted children project onto ±10 % of the
  learned segment length around their parent; the correction magnitude
  feeds the confidence's agreement factor.

## Confidence output

Written into the `visibility` field every consumer already reads:
`vis_out = vis_at_loss × ageDecay × agreement`, ageDecay linear
1.0 → 0.35 across the horizon, then → 0 within 250 ms (150 ms core) in
RELAXED; agreement ∈ [0.6, 1.0] from the bone-length corrections. The
decay crosses the retargeter's 0.45 gate at ~⅘ of the horizon (bones
hand over to the existing relax — the two layers compose, they never
double-predict) and body-input's confidence keeps falling on the same
schedule the Flight autopilot contract expects.

## Measured limits (honest)

From the masked-fixture eval (`eval/ppc-results.json`, synthetic
occlusion windows over real footage, ground truth = the same frame
before masking; legacy comparator = hold-last-visible):

- On deliberate motion (arm raises, reaches, face-crossings), prediction
  beats holding by ~16–28 % mean position error during the occlusion,
  and the puppet's masked screen-space sync improves with it.
- On violent oscillating motion (shadowboxing), nothing beats holding:
  a punch reverses before any horizon this short ends. PPC's trust
  stack detects the regime and converges to hold-quality — it stops
  claiming to know. That is the design goal there, not a win.
- Leg prediction is shipped conservative (`visTrust 0.25`): stride
  swings reverse inside the horizon, and driving leg bones with
  hold-quality predictions measured WORSE than the existing bone-level
  hold — so predicted legs immediately hand the puppet back to hold,
  while the positional stream keeps flowing for body-input continuity.
  Measured, not assumed; revisit only with new footage.
- Prediction is per-landmark geometry, not physics: it knows bone
  lengths and recent velocity, nothing about intent. 400 ms is the
  entire promise.

Per-limb state (VISIBLE / PRED age·conf / RELAX / REACQ) is live in the
engineering view (`d`).
