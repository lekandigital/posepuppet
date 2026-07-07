# PPC Gate 2 — live occlusion test (~3 minutes)

Setup: character mode, robot (then repeat anything that felt off on
erika), engineering view open (`d`) so the per-limb chips are visible.
`?ppc=0` in the URL gives the legacy path if you want an A/B.

1. **Hand exit mid-gesture (30 s).** Raise an arm and sweep it out of
   frame mid-motion, at slow and at medium speed. The arm should carry
   the motion briefly (chip: `PRED age·conf`), ease toward rest, and
   blend back when your hand returns — no snap, no fling, no rubber
   band. Try a quick flick out-and-back: it should feel near-seamless.
2. **Hand crosses the face (30 s).** Cover your mouth, brush your
   cheek, pass a hand slowly across your face. Face-touch should stay
   engaged (that's PPC carrying the wrist through the occlusion), the
   head should not flinch when your hand blanks the face landmarks.
3. **Foot out of frame (30 s, full-body framing).** Step one foot out
   of frame and back while shifting weight. Expectation: legs behave
   like they did BEFORE this pass (hold → relax) — leg prediction is
   deliberately conservative; what you're checking is nothing got
   worse.
4. **Full dropout (30 s).** Step entirely out of frame for ~2 s, step
   back in. The puppet should keep a beat of your exit motion, settle
   to idle, and re-acquire with a smooth blend, not a pop.
5. **Shadowbox (30 s).** Fast punches toward and across the camera.
   The trust stack should keep the puppet from flying on a lost punch —
   watch for any "haunted" overshoot; there should be none.

Report feel, latency, and anything haunted. Chips reading PRED during
1–2 and OK the rest of the time is correct; legs flipping to RELAX
almost immediately in 3 is by design.
