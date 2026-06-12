# Gate 3 — live webcam test script (~3 minutes)

Start: `npm run dev` → http://localhost:5173 (allow camera). Dark theme,
astronaut loads as default. Stand ~1.5 m back, hands visible.

## 1. Character mode — body + wrists (40 s)
- Wave each arm, then both. Slow circles, then a few fast jabs.
- Open hand wide → fist → open, both hands (watch the astronaut's
  fingers curl; on the robot the mitt squeezes).
- Point with your index finger, hold a beat.
- Lean left/right, turn your shoulders ~45° each way.
- **Report:** lag feel, anything possessed/owl-ish, finger curl read.

## 2. Face-touch (30 s)
- Bring a hand SLOWLY to your cheek; hold 2 s; away. Then chin, then
  forehead, then cover your mouth.
- Try both hands. Try one fast touch.
- **Report:** does the avatar's hand land on its face (not hover at the
  chest, not pass through the head)? Does it ease in/out or snap?

## 3. Exaggeration slider (25 s)
- Drag EXPRESSION (right rail) to ~1.6. Repeat a couple of waves and a
  lean. Notice bigger arcs + slight squash on fast moves.
- Push to 2.0, throw a fast punch. Then back to 1.0.
- **Report:** legible difference at 1.6? anything broken at 2.0?

## 4. Occlusion recovery (25 s)
- Drop one hand below the desk/frame for 2 s, bring it back — the limb
  should drift to rest, then BLEND back smoothly (~0.5 s), never snap.
- Cross your hand in front of your face once.
- Step fully out of frame for 3 s; step back in.
- **Report:** any pops/snaps on re-entry; how the avatar holds while
  you're gone (it should breathe/sway subtly, not freeze).

## 5. Hand-only mode (50 s)
- Click HAND-ONLY in the command bar. The stage goes violet.
- **beaky** (default card): hold your hand up like a sock puppet,
  fingers sideways. Talk with your hand — pinch open/close in speech
  rhythm. Aim the head with your palm. Try fast chatter.
- Click the **hand** card: open/close, spread fingers, point, thumbs-up.
- Click **x-ray**: wave fast — the violet trail should chase the cyan
  skeleton.
- **Report:** beak-to-pinch latency feel (target: lip-sync usable),
  head-aim intuitiveness, finger fidelity on the glove hand.

## 6. Switch + chain (10 s)
- Back to CHARACTER. Mid-wave, click the robot card, then astronaut —
  switches should crossfade, no T-pose pop.
- Glance at the take bar: CAM/POSE(HAND)/SMOOTH/RIG/RENDER lit while
  tracking; POSE goes red if you cover the camera.

Report feel, latency, and anything haunted — exact words welcome.
