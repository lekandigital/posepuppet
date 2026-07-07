# PPC Gate 2 — focused retest (~2 minutes)

Character mode, robot, engineering view open (`d`). `?ppc=0` gives the
legacy A/B at any point. What changed since your report: torso/head now
predict as one rigid body (no more bend/spin after dropout), and a
physics gate catches the detector's behind-torso garbage — impossible
segment lengths are held at low confidence instead of enacted.

1. **One slow hand exit.** Sweep an arm out of frame and back — brief
   intentional carry, eased settle, blended return. No snap.
2. **Hand crossing the face.** Cover your mouth, brush a cheek — head
   stays stable, face-touch stays engaged through the occlusion.
3. **One punch with the hand passing behind your torso.** This was the
   glitch case: the hand should now hold its last believable position
   for a beat (chip may show the arm PRED or simply low conf) and pick
   up smoothly when it re-emerges — no whip, no collapse into the body.
4. **Full-body dropout ~2 s.** Step out of frame entirely, then back.
   During the blackout the puppet keeps a beat of your exit motion,
   settles upright to idle — no bending forward, no rotation about any
   axis. Re-entry blends in, never pops.
5. **Re-entry scrutiny.** After each of the above, watch the first
   half-second of recovery: no popping, spinning, or haunted movement
   anywhere.

Note on legs/feet: leg prediction is deliberately conservative (measured
to carry no value on stride reversals) — with full body enabled (`f`),
a foot leaving frame should behave exactly as it did before this pass.
Report feel and anything haunted; the per-limb chips (OK / PRED / RELAX
/ REACQ) tell you what the system thinks it's doing at any moment.
