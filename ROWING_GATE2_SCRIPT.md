# Rowing Gate 2 — live row script (~8 minutes)

Setup: `npm run arcade` at the repo root → open PosePuppet at
http://127.0.0.1:5173 → click the **Row** card (or ⌘K → "row"). The game
opens on the water. Press **b** for the tuner (rowing section at the
bottom: profile/assist buttons, stroke readout). Stand ~2.5 m back,
whole torso + arms in frame.

The stroke: both hands reach toward the camera at chest height, pull
back to the ribs. Relaxed — ~30 cm of hand travel reads fine.

1. **Connection (2 min, standing, Full Assist, Lean steering).**
   Row at a lazy ~20 strokes/min. Judge: does the boat lunge on each
   pull? Does the glide between strokes feel like water? Speed up to
   ~35/min — does the boat clearly go faster? Stop rowing — after ~2
   missed strokes cruise should latch (tuner shows CRUISE) and the boat
   keeps way while you rest. Row again — cruise hands back instantly.
2. **Steering A — lean (30 s).** While rowing, lean right → boat turns
   right; lean left → left. Full Assist will gently pull you back
   toward the course — fight it briefly to feel the strength.
3. **Steering B — stroke asymmetry (1 min).** Tuner → profile ⇄ to
   "Stroke steering". Pull harder with your LEFT hand → boat turns
   RIGHT (paddle physics; tell me if the sign feels wrong). Judge which
   profile you'd demo with — that's the Gate-2 pick.
4. **Seated (2 min).** Sit on a chair, same framing. Row the 2-minute
   river-run: relaxed cadence, one sprint burst, one rest (cruise),
   finish with a turn each way. This is the fatigue test — say
   honestly whether 2 minutes felt sustainable.
5. **Autopilot (30 s).** Mid-row, step out of frame for ~3 s: the boat
   should drift straight and slow, never snap. Step back in — steering
   should blend back smoothly.
6. **Recenter + keyboard (30 s).** T-pose ~1 s → recenter toast. Then
   grab WASD briefly — keys must win instantly; body resumes ~1.5 s
   after you let go.

Report: rhythm (does the surge read?), connection (latency between your
pull and the boat), fatigue (could you demo this for 2 minutes
happily?), steering pick (lean vs stroke), anything haunted.

Also confirm: rowing_seated.mp4 measured 13 completed pulls (prescribed
15 — there's a ~2.5 s pause mid-take). OK to keep 13 as the eval label?
