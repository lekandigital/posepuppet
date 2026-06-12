PROJECT: PosePuppet Pass 2 — "The Instrument Pass."

WHAT THIS PASS IS
PosePuppet works: webcam/video in, pose detected, robot/VRM character
mirrors me, recording and the eval/Playwright rig all function. This pass
turns that working demo into a polished creative instrument — a puppet
tool people screen-record before they understand the code. Three fronts at
once: (1) a full interface rebuild in a specific design language, (2)
meaningfully better motion (hands, face-touch, full body, occlusion,
expressiveness), (3) new showcase systems (hand-only creatures, Motion
Memory, a recording director). Inspect the repo before touching anything.
Keep everything that works. Do not rewrite the project from scratch. The
suite stays green at every commit.

JUDGMENT CHARTER (read this as permission)
I trust this model. This prompt fixes OUTCOMES, NON-NEGOTIABLES, and five
USER GATES. Everything else — final palette values within the stated
constraints, layout, component structure, file organization, the
face-touch technique, whether true finger tracking ships this pass, which
smoothing/physics approach wins, creature design, onboarding form, coach
wording and trigger logic, VFX technique, what the command palette
includes, how vertical composites are laid out — is yours. Where I sketch
an approach, it is an example, not an instruction. When you deviate or
choose, log one line in DECISIONS.md and keep moving; do not stop to ask
unless a NON-NEGOTIABLE or gate is involved. If a sub-approach burns 45
minutes without progress, take the simpler path and note it. Prefer
impressive visible progress over hidden frameworks.

NON-NEGOTIABLES
- Local and private: no backend, no analytics, no telemetry, no uploads of
  any kind. All inference, storage (IndexedDB/localStorage), and export
  stay in the browser. The privacy line appears in the UI and README.
- Licensing: every asset redistributable in a public repo and demo; CC0 or
  equivalent preferred; everything in ASSETS.md; STOP for my approval
  before committing any new third-party model. Procedural/original assets
  need no approval.
- No games: no scoring, win/lose, levels, worlds, or map integrations. The
  gesture/intent layer is a seed, consumed only by hands-free recording.
- No model-audit system, no conversion pipeline, no per-avatar calibration
  profiles, no per-body-part quality meters, no giant roster of weak
  models, no flight sim, no Google Maps, no rowing.
- Honesty: every number that could appear in a post comes from
  eval/results.json or logs, reproducibly. Limitations are documented, not
  hidden. fixtures/ stays gitignored (it is footage of me).
- Performance floors from pass 1 hold with the new UI and effects on.
  Measure before/after; if a visual costs the floor, the visual loses or
  becomes opt-in.

DESIGN DIRECTION (the language is fixed; the design is yours)
Read design/reference.css in the repo root first. It is a design grammar,
not a component library: a tokenized variable theme, brutalist 1px rule
structure, editorial typography with three roles (sans for UI text, mono
for labels/status/controls/metrics, serif reserved for identity moments),
translucent sticky control surfaces with hard borders, shared-border card
grids, unmistakable active states, grain + vignette atmosphere, restrained
motion, light/dark themes, hierarchy without heavy shadows. Translate that
grammar into PosePuppet. Do not paste its selectors; do not keep its
palette.

Palette law: vibrant, luminous, glassy, slightly y2k but tasteful —
graphite/near-black base, white/pale glass surfaces, electric blue
accents, cyan highlights, violet secondary glow, pale green-white
atmospheric glow, crisp black/white contrast, frosted translucent panels.
Absolutely no beige, brown, tan, or warm paper. Light and dark themes both
ship; dark is the demo default.

Avoid the generic look: "near-black with one acid accent" is the stock
AI-design cliché adjacent to this brief. The constraints above still leave
room for a signature — one memorable element this interface is remembered
by (the way the stage frame meets the chrome, a distinctive tracking
readout, the take bar as an instrument strip — your call). Spend your
boldness there and keep everything else disciplined.

Design process, enforced: before restyling the app, produce a short design
plan — named token values, type roles, layout wireframe (ASCII is fine),
the signature element, and where each mono status label lives — plus 2–3
static screenshot mockups of the real app shell at desktop width, light
and dark. Self-critique the plan against this brief (would this read as a
template? does anything fight the live video?) and revise once. Then STOP:
USER GATE — I approve the direction before full rollout. After approval,
roll the system through every surface; no half-migrated screens at the
end.

Layout: my suggestion — top command bar (identity, privacy receipt, mode
selector, record, settings); the character stage as the hero; the camera
panel as a smaller always-visible input signal; a right control rail
(avatar cards, mode cards, setup coach); a bottom take bar (recording
controls, shot prompts, FPS/tracking status). Treat it as a suggestion.
The app should feel like a glass cockpit around a live stage — a creative
instrument, not a dashboard.

Quality floor, non-negotiable within design: readable text on every
frosted surface (run contrast checks), visible keyboard focus, sensible
behavior down to laptop-small widths (desktop webcam use is the priority;
smaller screens must not break), prefers-reduced-motion respected, grain/
vignette never reduce legibility of video, overlay, or stage. Interface
copy follows instrument language: plain verbs, sentence case, user-side
naming, consistent action names end to end, coach messages that direct
("Step back so your legs are visible") rather than diagnose ("low hip
visibility"). Watch the cost of backdrop blur over live video/canvas
regions — if it eats frames, fake it with gradients/opacity there and keep
true blur for static chrome.

PHASES
Work in the following phases. Each phase ends with: suite green, a commit,
an EVAL_NOTES.md entry with screenshots, and a 5-line STATUS.md update.
Gates are marked; nothing else stops for me.

P0 — INSPECT AND PLAN
Read the repo. Run the full suite and eval on all fixtures; record the
performance baseline (pose FPS, render FPS, memory) — every later claim of
"still fast" diffs against this. Verify the new fixture clips exist and
are usable (hand_open_close, hand_pinch_point, facetouch, fullbody); if
any are missing/bad, USER ACTION with exact re-record specs. Then write
PLAN.md: your reading of the codebase, risks, the Tier B/C electives you
propose to take on (list below) with rough effort estimates, anything in
this prompt you think should be cut or reordered and why.
>> USER GATE 1: I approve PLAN.md (and the elective selection).

P1 — DESIGN SYSTEM AND SHELL
Token system, typography roles, atmosphere layers, themed component
primitives (buttons, cards, status chips, bars), and the new layout shell
around the existing working app. Produce the design plan + mockups
described above.
>> USER GATE 2: design direction approval, then full rollout. Restyle
every existing surface, including the debug HUD — which becomes a proper
"engineering view" in the new mono language (toggleable; eval keeps
working). Add settings persistence (theme, toggles, onboarding-seen) in
localStorage. Add the privacy receipt: a live mono status in the command
bar — "LOCAL · 0 NETWORK REQUESTS SINCE LOAD" — backed by a real counter
(instrument fetch/XHR after model+font load; if anything fires, show it;
this is a trust feature and it must be true). Add keyboard shortcuts and a
command palette (Cmd/Ctrl+K) in the brutalist mono style for mode/avatar/
record/calibrate/toggles — instrument feel, model's call on scope.

P2 — MOTION CORE (the puppet gets better hands and a body)
- Wrists/palms: more responsive wrist rotation, readable palm direction,
  open-hand / fist / point approximations where feasible. Models without
  finger bones must still benefit via wrist+palm quality.
- Face-touch: believable hand-to-cheek/mouth/forehead/chin/near-face on
  supported avatars. Pure retargeting probably won't read — consider
  proximity-triggered target magnetism, a light IK blend near the face
  region, per-avatar reach normalization, contact easing; your choice.
  Hand passing through the head is the failure mode to kill. Where an
  avatar can't support it, that's a capability label, not a bug.
- Full body/feet: when fullbody.mp4-style framing is available — livelier
  legs, plausible foot orientation, less stiff lower body, graceful
  degradation when feet vanish. Full-body mode must not overpromise when
  the user is too close (coach handles the explanation).
- Occlusion recovery: pose continuity, not fake tracking — last position +
  velocity decay + pull-to-rest + joint limits; re-acquisition blends in
  smoothly (~0.5 s), never snaps. Hands leaving frame, hands crossing the
  face, feet hidden, momentary dropouts: all covered.
- EXPRESSIVENESS LAYER (new):
  * Secondary motion: lightweight spring/follow-through on selected
    appendages (robot antenna, hair/accessory bones where rigs have them)
    — overlap and follow-through are what make puppets feel alive.
  * Exaggeration control: one visible slider (1.0 = faithful, up to ~2.0 =
    cartoon) scaling rotation amplitude with overshoot and a hint of
    squash-and-stretch on fast moves. Instantly legible on camera; clamp
    so it never breaks the rig.
  * Idle life: subtle breathing, periodic blinks (VRM blendshapes where
    available), micro weight shifts when still or tracking-lost — the
    avatar never reads as frozen.
  * Avatar-switch crossfade: switching characters mid-motion blends pose
    over a beat instead of popping — the switch is a money shot in takes.
  * Performance auto-tuner: sustained low FPS → coach suggests (or one
    click applies) the lite model / reduced effects; demos stay smooth on
    weak machines.

P3 — HAND-ONLY MODE AND CREATURES
A first-class mode, visually distinct from Character mode (its own stage
treatment), tracking one hand. Decide honestly whether true finger
tracking ships this pass; if yes it lands here first and only spreads to
full-body avatars if it doesn't degrade them. Roster within the mode:
- An expressive 3D hand (rigged or stylized) following palm/finger motion.
- At least one creature puppet: bird/dragon head, jaw mapped to pinch
  distance, head orientation from palm — a lip-sync puppet people record
  talking with their own voiceover. Primitives are fine if charming. A
  second creature optional.
- X-ray self-portrait (new, cheap): render the tracked skeleton itself as
  a glowing wireframe figure in the design language — some people will
  share that over any character.
Creatures and the x-ray mode appear as hand-only entries on avatar cards
with their own capability labels. Add the pinch→jaw sync metric to eval
(correlation on hand_pinch_point.mp4).
>> USER GATE 3 (after P3): live webcam test. Give me a 3-minute script
covering character mode (face-touch included), hand-only hand, the
creature, exaggeration slider, and occlusion recovery. I report feel,
latency, and anything haunted. Fix what I report before P4.

P4 — MOTION MEMORY (record the skeleton, not just the video)
One system: capture the retargeted bone-quaternion stream (plus root and
relevant blendshape channels) into a ring buffer and small named loops
saved to IndexedDB — tiny JSON, fully local, playback through the existing
retargeting/avatar layer. Four features fall out:
- Ghost duet: loop my last take on a translucent second avatar on the same
  stage while I keep performing live.
- Echo chorus (new): one slider turns the single ghost into N staggered
  echoes (e.g. 2–4 copies offset by ~300 ms) — a motion delay line;
  visually spectacular, nearly free once ghosts exist.
- Instant replay: after a take, the last ~5 s in slow motion from a second
  camera angle with trails emphasized; easy to include in the recording.
- Re-skin: play any saved loop on any roster character ("recorded the
  dance once; now the robot performs it"). Hand-only loops re-skin across
  hand-mode puppets the same way.
Constraints: playback only — no scoring, nothing game-like. If full-body
loops are unstable, ship upper-body loops and document it. Automated
check: a recorded fixture loop replayed on a second avatar matches its
source stream within tolerance.

P5 — RECORDING DIRECTOR (the app helps create the clip)
- Guided takes v2: shot-by-shot overlay scripts for a 15–20 s clip. Ship
  at least: a Character take (neutral → arms up → lean → face-touch →
  shadowbox → avatar switch → final pose), a Ghost Duet take, and a
  Talking Puppet take (hand-only). Scripts are data, not code — easy to
  add more.
- Hands-free control: I'm meters from the keyboard. An unambiguous arm
  gesture starts the countdown; holding each shot's pose advances; a
  distinct gesture stops. Built as the first consumer of the
  gesture/intent seed layer. Keyboard/mouse always remain as fallback.
- Pre-take framing check: landmark coverage confirms I'm framed for the
  current mode before the countdown; coach language if not ("Step back —
  I can't see your hands").
- Aspect presets (new): 16:9 side-by-side AND 9:16 vertical (stacked:
  camera above, avatar below, or your better idea) — vertical is how
  clips actually travel. 1:1 optional. The composite recorder handles all
  shipped presets.
- Produced-take packaging: ~0.5 s title stinger in, end card out (product
  mark + "all inference local — nothing uploaded"), chrome auto-hides
  during recording, optional small corner badge, optional subtle grade
  (grain/vignette) on the composite so clips match the interface
  atmosphere. All toggleable.
- Pose poster (new): freeze pose → slow orbit → export a designed still
  in the interface frame with mono labels; optional 4-pose photo strip.
- Caption helper (new, tiny): after export, one click copies an honest
  suggested caption to the clipboard (mode, avatar, "all local in the
  browser") — local string assembly, nothing clever, nothing sent.

P6 — GUIDANCE, ROSTER, AND BOUNDARIES
- Avatar cards: name, preview, status label, supported modes, one-line
  limitations. Labels from: Fully supported / Hands limited / Fingers not
  supported / Face-touch limited / Experimental / Hand-only. Simple
  metadata per avatar — no audit system.
- Roster: small and curated. Add up to 2–3 new characters ONLY if they
  rig cleanly (humanoid, good arms/wrists, usable legs, sane proportions,
  stable perf, face-touch potential). A famous character with a bad rig
  is skipped or Experimental — never forced into the main roster.
  >> USER GATE 4 (async, raise as early as ready): license/approval per
  new third-party model before it's committed.
- Mode selector: Character / Hand-only / a setup-calibration state;
  future game modes may exist as comments/types only.
- Setup coach: plain-language, low-nag guidance driven by visibility +
  mode state ("Move back so your legs are visible", "Keep both hands in
  frame", "Face-touch may fail if your hand covers your face", "This
  avatar doesn't support finger movement", "Try front lighting"). Your
  call on surface (status line, toast, rail card) — least annoying wins.
- Onboarding: skippable first-run overlay — how to stand per mode, when
  to calibrate, hands visible, record button, the privacy line. Never
  shows twice unless asked.

P7 — ELECTIVES (only what was approved at Gate 1)
Tier B, in priority order: (1) Velocity VFX — impact ring past a hand
velocity threshold, subtle speed sparks, grid ripple underfoot in
full-body; driven by velocities the smoothing layer already computes;
subtle by default. (2) Auto-director camera — spring-damped lean-with-me,
small impact kicks, idle slow-orbit, replay angle switch; restraint is the
feature; toggleable. (3) Hologram parallax "window mode" — head position
maps to a small stage-camera offset; off by default; disabled during takes
unless enabled. Tier C, freely skippable: two-person duet (numPoses=2, two
avatars, Experimental label; skip if it harms single-person quality);
audio-reactive stage light (mic permission — off by default, clearly
labeled, fully local, privacy copy updated).

P8 — SHIP
Full eval refresh on all fixtures; before/after performance table; suite
green. README + CHANGELOG implementation summary in this spirit:
"PosePuppet started as webcam-to-avatar puppeteering. This pass turned it
into a browser puppet instrument: redesigned glass/brutalist interface,
better body and hand control, hand-only creature puppets, Motion Memory
ghost performances, a recording director with hands-free takes, setup
guidance, honest avatar boundaries, and a seeded architecture for future
body-controlled play." — listing what was added, what was deliberately
skipped, and what is still limited. Update DEMO_SCRIPT.md around the new
money shots (ghost duet, talking puppet, exaggeration slider, vertical
take). Draft POSTS.md per the voice rules below.
>> USER GATE 5: filming session, verification-table check, my approval.

VERIFICATION RIG (extends pass 1; you are still blind without it)
- All pass-1 machinery stays: fixtures → y4m → Playwright fake webcam,
  eval mode writing eval/results.json, the screen-space limb sync metric,
  vision self-review in EVAL_NOTES.md.
- New automated coverage this pass: hand-only mode (landmarks → hand/
  creature rig on the hand fixtures), pinch→jaw correlation metric
  (r >= 0.8 on hand_pinch_point.mp4), face-touch reach check on
  facetouch.mp4 (hand reaches face region, no interpenetration frames
  beyond tolerance, on supported avatars), occlusion recovery check
  (synthetic dropout: re-acquisition blends within ~0.5 s, max rotation
  step bounded), Motion Memory round-trip (record fixture loop → replay on
  second avatar → matches source within tolerance), hands-free take flow
  (gesture start/advance/stop driven by a fixture), both aspect-preset
  recordings produce playable nonzero files.
- Design verification: screenshot board at the design gate and at P8 —
  desktop light + dark, narrow width, recording state, onboarding, both
  modes; your own vision critique against the brief in EVAL_NOTES.md
  (template-feel? legibility over live video? signature present?).
  Automated contrast check on text/surface token pairs; reduced-motion
  smoke test.
- Performance: baseline at P0, re-measure each phase, final before/after
  table. The floors hold or the responsible feature becomes opt-in.

DO NOT BUILD (parked on purpose)
Games or scoring of any kind; world/map environments; Google Maps walking;
flight sim; rowing; vehicle demos; LLM-driven generation; cloud asset
conversion; model-audit systems; conversion pipelines; per-avatar
calibration profiles; per-body-part quality meters; big rosters of weak
characters; backend anything; analytics; telemetry. The gesture/intent
layer stays a seed with exactly one consumer (hands-free takes).

POSTS.md (draft at P8; my voice, my rules)
lowercase, understated, specific, technical. No hashtags, exclamation
marks, or emojis; no "game-changer / mind-blowing / the future of / isn't
just X — it's Y". Numbers only from eval/results.json or logs, each mapped
to its source in a small verification table. First line works alone above
the fold; payoff below; exactly one honest flaw in the main post; links in
a planned self-reply, never the parent; end on a quotable kicker where
natural. Draft three main-post variants (data-led / story-led /
kicker-led) and a thread version with media assignments from the new
money shots: ghost duet, talking hand-puppet, exaggeration slider,
face-touch, vertical take, the interface itself. Seed angles to beat, not
copy: "i recorded the motion once. now every character in the roster can
perform it." / "the hard part of a hand puppet is not tracking the hand.
it's making a triangle with a beak feel alive." I post manually; you never
post anything.

FINAL ACCEPTANCE CHECKLIST (verify each before declaring done)
[ ] Existing flows all still work; suite green; no rewrite happened
[ ] New design fully rolled out, both themes, no brown/beige, contrast +
    reduced-motion + focus states pass, design gate was approved
[ ] Character and Hand-only modes distinct and labeled; setup state exists
[ ] Creature puppet ships; pinch→jaw metric passes; x-ray mode ships
[ ] Wrists/palms improved; open/fist/point approximations where feasible
[ ] Face-touch reads on supported avatars; others labeled, not broken
[ ] Full-body/feet improved when framed; coach explains when not
[ ] Occlusion recovery never snaps; synthetic dropout test passes
[ ] Expressiveness layer ships: secondary motion, exaggeration control,
    idle life, avatar-switch crossfade, perf auto-tuner
[ ] Motion Memory: ghost duet, echo chorus, instant replay, re-skin,
    local persistence, round-trip test passes
[ ] Recording: guided takes (incl. ghost-duet + talking-puppet scripts),
    hands-free start/advance/stop, framing check, 16:9 + 9:16, packaging,
    pose poster, caption helper — a full take possible with no keyboard
[ ] Avatar cards + capability labels; curated roster; licenses approved
    and in ASSETS.md
[ ] Setup coach + skippable onboarding + command palette + shortcuts +
    settings persistence + truthful network-zero privacy receipt
[ ] Gesture/intent seed exists with exactly one consumer; nothing
    game-like anywhere
[ ] Performance floors hold (before/after table); no console errors;
    memory stable
[ ] README/CHANGELOG summary, DEMO_SCRIPT.md v2, POSTS.md with
    verification table; ASSETS.md current
[ ] All five user gates were honored

FIRST ACTIONS, IN ORDER
1. Inspect the repo; run the suite and eval; record the performance
   baseline.
2. Check fixtures (old + the four new clips) and design/reference.css are
   present and readable — USER ACTION with exact specs if not.
3. Write PLAN.md with your Tier B/C elective proposal and effort
   estimates; raise USER GATE 1.
Begin.