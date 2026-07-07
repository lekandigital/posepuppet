# GATE 2 — Live flight test (~5 minutes)

You fly the actual TinySkies plane with your body. Report feel: latency,
drift, fatigue, nausea, fun — and pick the default profile. Iterate with
me until it feels right; the world gets no polish before that.

> Rev 2 after the NO-SIGNAL failure: PosePuppet and Flight now share ONE
> origin — the PosePuppet dev server serves the built game at `/flight/`,
> so BroadcastChannel signals just work. One command starts everything.

## Setup (1 terminal, ~1 minute)

```bash
cd ~/Dev/posepuppet && npm run arcade
```

(That builds the flight app and starts the dev server — both apps on
**http://localhost:5173**. No second terminal, no ports to guess.)

1. Open **http://localhost:5173**, allow the webcam, stand back until the
   skeleton tracks (full body in frame is best; waist-up also works).
2. Press **⌘K → type "fly" → Enter**. The game opens at
   **http://localhost:5173/flight/** with your body streaming in. Keep
   both windows visible (side-by-side is ideal — PosePuppet is the
   tracker).
3. In the game window press **B** — the BODY → FLIGHT TUNER opens. The
   status line must read **`src OK · bc v1 · ~25–30Hz`**. If it ever says
   `no sender`, the red hint text below it says exactly what to fix.
4. Click GO. The game starts on keyboard as usual. **The body takes over
   whenever you leave the keyboard alone for 1.5 s**; touching any game
   key instantly gives keyboard control back (the fallback, always on).

Profiles and assist cycle from the two buttons in the tuner. Start on
**Pilot Lean / Full Assist**.

## Script

**Minute 1 — Pilot Lean, learn the plane.**
Stand at ease, hands free. Lean right → the plane banks right; lean left
→ left. Lean toward the camera → speed up; ease back → slow down. Crouch
→ descend toward the deck; stretch tall → climb. Push both hands toward
the camera and hold ~1 s → boost (barrel roll; ~3 s cooldown).

**Minute 2 — a full lap.**
Pick a landmark on the horizon (volcano, pyramid, statue). Fly a full lap
of the globe and return to it, using lean-turns only. Note: does the turn
rate feel proportional to your lean? Any drift when you stand still?

**Minute 3 — Superman.**
Tuner → profile ⇄ → Superman. Arms DOWN = the plane stabilizes and flies
straight (that's the arming gate). Arms OUT (T-ish) = you're flying:
lean to bank, raise arms high to climb, thrust both hands forward to
dive + boost. Try dropping your arms mid-turn — it should level off, not
lurch.

**Minute 4 — tracking loss + recenter.**
Back on Pilot Lean. Mid-turn, deliberately step OUT of frame. Within
about half a second the plane should level off and fly straight
(tuner: `src AUTOPILOT`). Step back in — control should blend back
smoothly, never snap (`REACQUIRING` → `OK`). Then hold a clean T-pose
~1 s: the tuner flashes `RECENTERED` and your current stance becomes the
new neutral. Use it any time the plane drifts.

**Minute 5 — seated (Head Pilot).**
Grab a chair, sit facing the camera, profile ⇄ → Head Pilot. Speed is
automatic; lean your shoulder line left/right to turn, lean back to
climb, forward to descend. This is the low-effort mode — is it relaxing
or boring?

## Report back (free-form is fine)

- Default profile pick: Pilot Lean / Superman / Head Pilot
- Latency: does the plane feel attached to you or behind you?
- Drift: does neutral stance = straight flight, or do you fight it?
- Sensitivity: per profile — too twitchy / too numb (tuner gain sliders
  are live; note any values you liked)
- Autopilot + recenter: any snap, lurch, or haunted behavior?
- Fatigue/nausea after 5 minutes; and simply — which minute was fun?
