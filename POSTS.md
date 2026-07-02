# Posts — pass 2 ("the instrument pass")

Drafts follow the voice contract: lowercase, understated, specific,
technical. No hashtags, no exclamation marks, no emojis, no banned
phrases. Exactly one honest flaw in each main post. Links and repo in the
self-reply, never the parent. I (Lekan) post manually; nothing is ever
posted by tooling. Every number maps to a row in the verification table.

Media assignments come from DEMO_SCRIPT v2: ghost duet (flagship,
vertical), talking beaky (voiceover, vertical), exaggeration slider,
face-touch, instant replay, hands-free take, x-ray, pose poster (still).

---

## Main post — variant A (data-led)
*media: ghost duet vertical*

> i recorded the motion once. now every character in the roster can
> perform it.
>
> posepuppet pass 2: the browser puppet got a memory. your last 12 seconds
> live in a ring buffer — loop them on a translucent ghost and duet with
> yourself, or fan one ghost into four staggered echoes.
>
> loops are the pipeline's input stream, not baked bones, so a take
> recorded on one character replays on any other exactly. round-trip
> replay error against the live take: <5° mean.
>
> the honest flaw: fast punches still land a beat late. smoothing buys
> stability with latency and i keep paying it.
>
> all local. the ghost never leaves the machine either.

## Main post — variant B (story-led)
*media: talking beaky with voiceover*

> the hard part of a hand puppet is not tracking the hand. it's making a
> triangle with a beak feel alive.
>
> beaky: 21 hand landmarks, palm direction aims the head, thumb–index
> pinch is the jaw. the pinch range auto-fits your hand, the crest rides a
> spring so it overshoots when you whip the head around, and the beak
> correlates with your pinch at r=0.941 on the test clip.
>
> the flaw i know about: the beak never quite slams shut at speed — the
> jaw smoothing rounds off fast consonants.
>
> talk over it with your own voice. nothing you say goes anywhere; the
> whole thing is a browser tab.

## Main post — variant C (kicker-led)
*media: exaggeration slider clip*

> puppets have a dial that people don't: how much of a cartoon to be.
>
> pass 2 gave posepuppet an exaggeration slider — 1.0 mirrors you, 2.0
> doubles your arcs with overshoot and a squash on fast moves, clamped so
> the rig never folds through itself. the same wave reads polite at one
> end and looney tunes at the other.
>
> under it: swing-angle scaling with an 8° dead zone (rest jitter must
> never be amplified) and a soft knee past 55° (big gestures already fill
> the pose space).
>
> honest flaw: the torso only takes half the dial — full-rate chest
> exaggeration read as possession, so i clamped it.
>
> the slider is the entire ui. that's the point.

## Thread version
*(reply chain under whichever main post wins)*

1. *[ghost duet vertical]* the memory system: 12-second ring buffer,
   always on. ghost = replay on a violet copy. echoes = the same loop at
   300 ms offsets. a motion delay line, basically free once ghosts exist.
2. *[face-touch clip]* face-touch was the failure mode i cared about —
   hands through skulls read haunted. proximity magnetizes the arm onto a
   two-bone ik whose target sits just outside a head collider measured
   from the avatar's actual skinned vertices. reach 99.3–100%,
   penetration 0 frames, on the test clip.
3. *[hands-free take]* i'm meters from the keyboard: raise both arms and
   the countdown starts, serif prompts walk the shots, cross wrists to
   stop. the gesture layer has exactly one consumer on purpose — this is
   a puppet stage, not a game console.
4. *[x-ray]* sometimes the skeleton is the show. 21 landmarks, additive
   wireframe, a lagged trail. some people will share this over any
   character and i respect it.
5. *[instant replay]* after a take: last 5 seconds, slow motion, side
   angle, trail echoes. the stage does its own replay booth.
6. *[pose poster still]* freeze, quarter orbit, designed still with the
   mono labels. the privacy line is printed on it because it's true:
   detection 100% across 17 sixty-second runs, pose loop
   28.2–29.9 fps, render 115–123 fps, zero external
   requests since load — the ui counts them live.
7. self-reply with repo + clips.

## Verification table

every number above, mapped to its source. all from eval/results.json
(final pass-2 refresh, headed chromium, apple m5, gpu delegate, 60 s per
run) or the playwright suite output.

| claim | value | source |
|---|---|---|
| round-trip replay error (mean) | <5° | tests/memory.spec.ts tolerance assertion (mean <5°, measured pass) |
| pinch→jaw correlation | r=0.941 | eval/results.json → hand_pinch_point.pinchJaw.r |
| face-touch reach / penetration | 99.3–100% / 0 frames | eval/results.json → facetouch.faceTouch (per avatar) |
| detection rate | 100% | eval/results.json → detectionRate, all rows |
| pose loop fps | 28.2–29.9 | eval/results.json → poseFps (clip-capped at 30) |
| render fps | 115–123 | eval/results.json → renderFps |
| sixty-second runs in the final refresh | 17 | eval/results.json → results.length |
| upper-limb sync error (arms/torso/fast) | 9.5–11.0° / 2.2–2.4° / 17.3–23.4° | eval/results.json → sync.upperLimbsMean |
| legs sync error (fullbody) | 5.6–6.3° | eval/results.json → sync.legsMean |
| fast-motion latency flaw | qualitative | EVAL_NOTES.md P2 (smoothing/latency trade) |
