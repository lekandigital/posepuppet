TITLE: BodyArcade Flight — faithful TinySkies integration with body control.

GOAL: Fork/adapt TinySkies/GlobeFly as fully and faithfully as possible
into the BodyArcade monorepo. Preserve the real globe-flight experience —
plane movement, quaternion spherical flight, whimsical globe, camera
behavior, world flow, vehicles, landmarks, effects, keyboard controls
(W/S pitch, A/D turn, Shift/Ctrl speed, ArrowUp altitude, Space action) —
and add the body as a first-class parallel input source. My body flies
the actual TinySkies plane.

CONTEXT: Read BODYARCADE_CONTEXT.md and any existing LICENSE_NOTES.md.
PosePuppet provides tracking, calibration, fixtures, and the eval rig.
Written permission from the TinySkies author exists — Track F (faithful
fork) is unlocked. Flight fixtures exist in fixtures/flight/ (lean_lr,
lean_fb, crouch_stand, arms_tpose, seated, still). If
@bodyarcade/body-input exists (Prompt 2 ran), consume it; if not, build
protocol v1 per Prompt 2's schema as part of this pass and note that
Prompt 2 becomes a hardening pass later.

NON-NEGOTIABLES: The global permission instruction — USER ACTION first:
ask me to paste the permission text; quote it in LICENSE_NOTES.md; if
narrower than "fork/adapt/use publicly with credit," pause, explain,
propose the safest path. Attribution ships in-app (credits/about) and in
README. ASSETS.md manifests every file as copied / adapted / original.
PosePuppet's suite stays green. Landmarks never cross transports. Game
plays fully offline; server/multiplayer become optional, never required.
Keyboard controls keep working exactly as upstream. No recording/UI-
redesign/privacy work here beyond a minimal "Fly" entry card and the
flight HUD/tuner.

ARCHITECTURE (refine at P0): monorepo — apps/posepuppet (minimally
touched), apps/flight (the TinySkies fork: client + shared; server kept
but optional), packages/body-input (protocol). Adopt TinySkies' three.js
version inside apps/flight; PosePuppet keeps its own — the BroadcastChannel
transport means they never share a renderer. Body input registers in
TinySkies' input layer as a source alongside keyboard, feeding the same
flight intents (pitch/turn/speed/altitude/action). A LocalWorldProvider
replaces the server dependency for single-player: default globes bundled,
world customization stored client-side; the real server remains runnable
via docker-compose for parity/multiplayer experiments.

PHASES:
P0 RIGHTS + RECON: collect permission text (USER GATE 1a), write
LICENSE_NOTES.md. Fork the repo into apps/flight. Map the architecture in
STUDY_NOTES.md: client render loop, flight math, camera follow, input
flow, world creation (what touches server/Prisma), which vehicles
actually exist (plane confirmed; verify carpet/boat — they matter for
Rowing/Dolphin seams), effects, landmarks, three version. Write PLAN.md
(integration plan, offline-mode plan, risks, estimates).
>> USER GATE 1b: plan approval.
P1 OFFLINE PARITY: the game runs locally, single-player, no server, no
Postgres — same feel as upstream with keyboard. Bundle/generate default
worlds via LocalWorldProvider. Keep the multiplayer codepath compiling
but dormant. Baseline perf recorded.
P2 BODY INPUT IN: wire @bodyarcade/body-input as an input source. First
pass may be crude (key-emulation with pulse-width modulation) purely to
de-risk feel — a temporary step, not the target. Then native: continuous
axes into the flight-intent layer. Ship the control tuner overlay (raw ->
shaped -> plane response per axis, sliders for dead zone/gain/smoothing/
expo, profile switcher, latency readout).
P3 FEEL LAB: full shaping stack per axis (calibration-relative -> One
Euro -> dead zone from still.mp4's measured jitter floor -> expo ->
output slew-rate cap -> assist clamps). Rate control with auto-level
spring; always-flying arcade throttle; discrete events with hysteresis +
debounce; tracking-loss autopilot (decay to neutral ~0.5 s, fly straight
and level, blend back on recovery); T-pose recenter; assist ladder (Full
Assist default: auto-level, bank/pitch clamps, soft floor, throttle
floor / Standard / Expert). Build at least two profiles as data:
PILOT LEAN (lean L/R = bank/turn rate; lean F/B = pitch; crouch/stand =
altitude; hands-forward = boost; action event = Space) and SUPERMAN
(arms-out = flight posture + stabilize; shoulder roll = bank; both hands
forward = dive/boost), plus HEAD PILOT for seated (shoulder-line lean =
turn; lean F/B = pitch; speed automated). Candidate mappings are
suggestions — test, find failure modes (upper-body-only framing, arms out
of frame, sitting, too close, oversensitivity, latency, accidental
drift), choose or invent better, and log why.
>> USER GATE 2 (LIVE FLIGHT): give me a 5-minute script — both profiles,
seated, deliberate frame-exit for autopilot, T-pose recenter, a full lap.
I pick the default profile and report feel (latency, drift, fatigue,
nausea, fun). Iterate until I sign off. Do not polish the world before
controls are fun.
P4 FAITHFUL EXPERIENCE COMPLETE: everything upstream offers works
locally — vehicles present, landmarks, effects, world flow, camera feel.
"Fly" entry card in PosePuppet (minimal). In-game credit to TinySkies.
Perf target: 60 fps render (floor 45) with pose loop >= 15 fps — lite
pose model during flight, suspend the PosePuppet stage renderer, small
camera panel.
P5 SHIP: suites green (PosePuppet + new flight suite), docs, FUTURES.md
(globe-as-hub transition proposal for Rowing/Walking/Dolphin, informed by
what the fork revealed — especially if boat/carpet exist).
>> USER GATE 3: final live acceptance.

VERIFICATION: fixtures drive the tracker via the existing fake-webcam
harness while the flight app subscribes. Intent eval: axis sign/magnitude
windows + event detection per clip; noise floors recorded and used.
Closed-loop eval: lean_lr => sustained signed heading rate; still =>
heading drift and roll rate under measured thresholds; injected dropout
=> autopilot, altitude in band, no terrain contact, smooth re-entry.
Replay: recorded intent stream re-run reproduces the flight path within a
documented tolerance (TinySkies' loop may not be fixed-timestep — measure
and state the tolerance honestly). Vision self-review of flight
recordings in EVAL_NOTES.md. Everything into eval/results.json.

ACCEPTANCE (paste into /goal):
1. Permission quoted in LICENSE_NOTES.md; attribution in-app; ASSETS.md
   manifest complete (copied/adapted/original).
2. TinySkies experience runs locally offline, single-player, keyboard
   controls identical to upstream; server optional via docker-compose.
3. Body flies the plane through @bodyarcade/body-input; landmarks never
   cross the transport; >= 2 standing profiles + seated profile,
   switchable live; tuner overlay works.
4. Shaping stack, autopilot-on-loss, T-pose recenter, assist ladder all
   ship; dead zones derived from measured jitter; closed-loop fixture
   evals green; replay tolerance documented.
5. I completed the live gate, picked the default profile, and signed off
   on feel; final acceptance flight done.
6. 60/45 fps with pose >= 15 fps, measured; PosePuppet suite untouched
   and green; DECISIONS.md, STATUS.md, EVAL_NOTES.md maintained.
7. Docs updated: README, ARCHITECTURE.md, LICENSE_NOTES.md, ASSETS.md,
   FUTURES.md, DEMO notes for the flight money shot.

AVOID: rowing/walking/dolphin builds; OSM/open-data; Google Maps;
multiplayer work beyond keeping the codepath alive; deployment; UI
redesign; breaking PosePuppet; hard-coding one control mapping before the
live gate; polishing visuals before feel; copying anything whose
permission status is unclear.

DOCS: LICENSE_NOTES.md, ASSETS.md, STUDY_NOTES.md, PLAN.md, DECISIONS.md,
ARCHITECTURE.md, FUTURES.md, README, EVAL_NOTES.md, STATUS.md.

FIRST ACTIONS: (1) read BODYARCADE_CONTEXT.md; (2) USER ACTION — request
the permission text, write LICENSE_NOTES.md; (3) verify flight fixtures
+ PosePuppet suite baseline; (4) fork, study, PLAN.md; raise Gate 1b.
Begin.