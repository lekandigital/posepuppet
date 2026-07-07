# @bodyarcade/body-input changelog

Versioning policy: `BodySignal.v` is the schema major. Additive,
backward-compatible schema fields bump the package minor and keep `v: 1`;
breaking changes bump `v` and the package major. Consumers pin the package
version and check `v` at runtime; the BroadcastChannel source drops
mismatched majors with a one-time console warning.

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
