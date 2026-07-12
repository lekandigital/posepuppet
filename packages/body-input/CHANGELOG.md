# @bodyarcade/body-input changelog

Versioning policy: `BodySignal.v` is the schema major. Additive,
backward-compatible schema fields bump the package minor and keep `v: 1`;
breaking changes bump `v` and the package major. Consumers pin the package
version and check `v` at runtime; the BroadcastChannel source drops
mismatched majors with a one-time console warning.

## 1.1.0 — 2026-07-12 (V3 Walking)

- **Additive `gait` block** on BodySignal (schema v1 stays):
  `{ active, count, cadence, phase, amp, shift, source }` — step events
  from left/right alternation, cadence in steps/second, and the
  weight-shift axis (−1..1, + = weight over the user's own right foot).
  Two measured substrates behind ONE detector (`src/gait.ts`): knee-lift
  difference in thigh-length units when legs are framed (`legs`), lateral
  hip-center excursion in shoulder widths — DC-removed by a slow EMA —
  when they aren't (`sway`, the desk-framing / weight-shift substrate).
  A substrate switch REBASES the extremum tracking so the level jump
  can never read as a reversal; count/cadence/rhythm survive the switch.
  Steps count at every hysteresis-qualified reversal (each footfall),
  unlike stroke's one-per-cycle finish.
- Extraction additions (additive `Measure` fields): `kneeDiff`,
  `hipNormX`.
- Schema/serializer: `GAIT_KEYS`, `GAIT_SOURCES`, gait validation in
  `assertSignalShape`, canonical JSON order `…swim, gait`. Old tapes and
  consumers stay valid; determinism contract unchanged (asserted with
  gait present).
- `tools/fixture-eval.mjs`: gait false-positive rows on lean_lr (the
  load-bearing negative — alternating lateral leans), lean_fb,
  crouch_stand, seated, still (strict 0/0 + |shift| p99 floor); shape
  guard extended; `PP_PORT` env respected (shared-box port-squat lesson).
- Tests: `tests/gait.spec.ts` — 9 node specs (3 march rates, sway
  substrate, sign convention, negatives incl. sub-hysteresis jitter and
  slow alternating leans on both substrates, dropout decay/monotonic
  count, source-switch no-phantom-burst, schema/canonical order, replay
  determinism).
- Consumer: `@bodyarcade/locomotion` (V3) — see its README/INTEGRATION.

## 1.0.0 — 2026-07-07

- Fixture eval suite (`tools/fixture-eval.mjs`): per-clip structural
  assertions on all six flight fixtures, ALL GREEN; results in
  `eval/bodyinput-results.json`. Latency p50 10–12 ms.
- Example cross-page consumer (`examples/consumer.html`) + spec.
- Extraction fixes forced by real footage: seated detection rebuilt on
  leg-fold + ankle-forward cues (deep crouch no longer misreads as
  seated); mid-motion fallback neutrals are replaced by the first
  stillness dwell; armLength floor lowered 1.5→1.1 shoulder-widths
  (was inflating armLength and capping armsOut at ~0.8).
- Measured limitations documented in README (leanY cross-bleed, arm-rest
  capture, action-on-forward-reach, seated framing requirements).

## 1.0.0 — unreleased (P2)

- Tuner overlay (`mountTuner`): per-axis raw→shaped bars, live shaping
  sliders, status chips, event blips, latency readout; mounted in
  PosePuppet behind the `b` shortcut / command palette.
- Jitter-floor tool (`tools/jitter-floor.mjs`): measures still.mp4 raw
  noise and rewrites dead-zone defaults with provenance.
- Arm axes are rest-relative: hanging-arm rest captured at neutral
  (T-pose-safe gate), axes report the excess renormalized to ≈1 at full
  extension. Fixes a ~0.37 resting bias in handsForward the jitter tool
  exposed.

## 1.0.0 — unreleased (P1)

- Schema v1: `{ v, ts, confidence, seated, stillness, neutralConfidence,
  axes { leanX, leanY, crouch, tallness, armsOut, armsRaised,
  handsForward, handPoint }, events ['recenter' | 'action'] }`.
- Deterministic core: calibration-relative extraction, per-axis
  One Euro → dead zone → expo → slew shaping, hysteresis+debounce events,
  confidence decay on tracking loss.
- Transports: in-page subscription + BroadcastChannel.
- Recorder/replayer: input tapes (local-only, privacy class of fixtures)
  and signal tapes with canonical byte-stable JSON.
