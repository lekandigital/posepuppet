# STATUS — V5 Character Control (feat/character-control)

2026-07-12 · V5 COMPLETE — all five outcomes shipped, awaiting the
consolidated human pass (FINAL_USER_TEST_PLAN S4)

- O1 capability manifest shipped (`data/avatar-capabilities.json`) with a
  report-only regen/check script; `caps:check` green; deliberate mislabels
  caught by spec. Inspection falsified a pass-2 assumption: the astronaut
  HAS finger bones — but its mitten mesh can't read them (documented
  demotion with screenshots in .local/shots/v5).
- O2 hand fusion: two-hand 12 Hz landmark stream anchored at pose wrists,
  fingers driven ONLY on erika (manifest gate); astronaut/robot provably
  not driven (spec: applyCount 0, gate closed). SwiftShader-exposed
  staleness bug fixed (detection-completion timestamps).
- O3 face-touch v2: seven named sockets on a per-avatar head capsule;
  synthetic sweep passes all seven with ZERO interpenetration on erika
  (full class); astronaut honestly re-labeled Face-touch limited (helmet
  radius exceeds arm reach — geometry, not a bug).
- O4 feet v2: planted-foot root-correction servo (kills skating), sole
  leveling, weight-shift hips roll; plant/lift/replant state machine
  spec-verified; skating metric added to the eval.
- O5 labels/coach wired to the manifest; README/CHANGELOG/ARCHITECTURE/
  DECISIONS updated; S4 entries written with evidence links.

Suite: V5 specs 6/6; full root suite + headed :2 eval refresh recorded in
.local/v5-verify.log and eval/results-v5-*.json (baseline vs after tables
in EVAL_NOTES §V5).
