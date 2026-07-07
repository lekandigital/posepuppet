# @bodyarcade/body-input changelog

Versioning policy: `BodySignal.v` is the schema major. Additive,
backward-compatible schema fields bump the package minor and keep `v: 1`;
breaking changes bump `v` and the package major. Consumers pin the package
version and check `v` at runtime; the BroadcastChannel source drops
mismatched majors with a one-time console warning.

## 1.0.0 — unreleased (P1 in progress)

- Schema v1: `{ v, ts, confidence, seated, stillness, neutralConfidence,
  axes { leanX, leanY, crouch, tallness, armsOut, armsRaised,
  handsForward, handPoint }, events ['recenter' | 'action'] }`.
- Deterministic core: calibration-relative extraction, per-axis
  One Euro → dead zone → expo → slew shaping, hysteresis+debounce events,
  confidence decay on tracking loss.
- Transports: in-page subscription + BroadcastChannel.
- Recorder/replayer: input tapes (local-only, privacy class of fixtures)
  and signal tapes with canonical byte-stable JSON.
