## 2026-07-07 (Gate-2 blocker fixed — same-origin topology, awaiting live re-test)
Done: root cause confirmed (script's nested-npm --port dropped => flight on wrong port; BroadcastChannel origin-scoped => can't cross ports); posepuppet vite now serves built flight at /flight/ (base '/flight/', asset prefixes mapped, publics disjoint); `npm run arcade` single-command start; palette "fly" opens same-origin /flight/ + keeps postMessage relay (receiver dedupes by ts); tuner reports transport/schema/sender + actionable NO-SIGNAL hint
Tests: new topology.spec.ts (headed) — real tracker -> /flight/ over pure BroadcastChannel: >5Hz, v1, age<500ms, axes moving — green 7.4s; measured why headless can't host this spec (SwiftShader-bound page throttles BC delivery to ~0.7 msg/s)
Blockers: USER GATE 2 — live flight re-test (GATE2_LIVE_SCRIPT.md rev 2: `npm run arcade`, ⌘K -> fly, tuner must read `src OK · bc v1`)
Next: gate feedback -> iterate feel -> P4

