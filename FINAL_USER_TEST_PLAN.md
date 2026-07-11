# Final user test plan

Human-only checks deferred to one consolidated session, per the Gate-2
round-2 testing policy: automated evidence is gathered remotely during
development; live time is spent once, on the things only a person at the
Mac webcam can judge. Each item lists what to do and what "good" means.
Automated evidence for everything below already exists (see EVAL_NOTES.md
2026-07-11 entries) — the live pass is confirmation, not discovery.

## Rowing

Setup: Mac, Chrome, tunnel to the remote server (`ssh -N -L
5173:127.0.0.1:5173 …`), open http://localhost:5173, press Row. The
rowing feedback strip appears at the bottom of the game: stroke pulse,
cadence (spm), steering marker, status word, and a guidance line when
something needs attention.

1. **Seated rowing, upper body only.** Sit at the desk with only your
   torso in frame (knees out of view). Row with full arm extension.
   Good: every pull flashes the stroke pulse and surges the boat; the
   status reads ROWING with a live cadence. (Fixed: Row now keeps the
   full pose model — the lite model's wrist depth collapsed near the
   frame edge; measured 2/13 strokes → 13/13 on the chest-up fixture.
   If pulls read weak, the strip says "pull with a fuller arm motion".)

2. **Two-minute seated fatigue row.** Steady seated rowing for two
   minutes at whatever cadence is comfortable, including rest breaks.
   Good: cruise holds momentum during rests, speed follows cadence, no
   drift into shore (guard handles it), nothing physically exhausting
   beyond the rowing itself.

3. **Left/right lean symmetry and feel.** While rowing under Full
   Assist: gentle right lean, gentle left lean, hold each ~4 s, then
   upright. Good: both directions carve visibly and comparably; a held
   lean is never reversed by the course assist (fixed: deliberate
   steering silences the coxswain; hands-off restores line-holding).
   The steering marker on the strip shows exactly what the game applies
   — if left/right feel differs while the marker is symmetric, the
   asymmetry is in the lean *reading*: hold a T-pose to recalibrate
   neutral and retry (the strip suggests this when seated).

4. **Stroke feedback and indicators.** Watch the strip while rowing:
   pulse per stroke (sized by pull strength), cadence in spm, steering
   marker following your lean, CRUISE appearing on rests, and the
   guidance line appearing only when something is wrong. Good: you can
   always tell tracking failure from physics feel.

5. **Shoreline avoidance during normal body control.** Row deliberately
   toward an island under Full Assist; stop fighting near the coast.
   Good: approach softens, the bow steers around, letting go always
   frees the boat within a few seconds — never beached, never trapped.
   (A sudden spin at a white water-spout column is the twister game
   feature, not steering.)

6. **Tracking loss, recenter, keyboard fallback.** Mid-row: step out of
   frame (status → SIGNAL LOST, boat drifts straight and slows), step
   back in (REACQUIRING → ROWING, no snap). Hold a T-pose ~1 s to
   recenter (toast confirms). Tap the arrow keys at any point — the
   keyboard takes the boat instantly (status KEYBOARD) and body input
   resumes a moment after the keys go quiet.

7. **Chrome and Safari passes.** Repeat items 1 and 3 briefly in Safari.
   Good: same behavior; report any Safari-specific jank rather than
   debugging live.
