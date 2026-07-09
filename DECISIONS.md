# Decisions

## 2026-07-07 — PPC Gate-2 fixes: rigid core + physics gate, not more smoothing
Lekan's live test failed on (a) full-dropout torso bend/spin and (b)
behind-torso punch glitch. Tracing fast.mp4 showed the detector emits
teleporting positions at CONFIDENT visibility during behind-torso
passages (up to 12.8 m/s single-frame jumps at vis 0.49–0.99, wrist
collapsing onto the elbow at 0.2–0.6× the forearm length) — visibility
alone is an insufficient gate, and a speed gate can't work because real
swings measured up to 10.8 m/s on the same clip. Two principled fixes
instead of blanket smoothing: (1) segment lengths are physically
constant, so breaking one is proof of garbage — the chain gate holds
such samples, caps their emitted confidence at 0.4, and keeps them out
of the ring buffer (zero false positives by construction); (2) torso and
head predict as ONE rigid translating shape — per-landmark prediction
sheared the quad and the retargeter enacted the shear as bend/spin;
rotation extrapolation for the core is now explicitly nobody's job at
the landmark level (the bone layer's clamped coast owns it). Also: the
in-group pass-through for still-measured members of a lost group now
steps under the same 0.06 m/frame no-snap cap — the old raw copy was an
invisible first-frame snap that the re-entry test couldn't see; and
velocity capture requires a fresh continuous 3-sample run (flapping
gates leave sparse buffers whose "velocity" is fiction).

## 2026-07-07 — PPC: in-PREDICTED bias targets last-seen, not hanging rest
The brief sketched an "optional gravity/rest bias that grows with age".
Measured on the masked fixtures, pulling a predicted limb toward a
hanging rest mid-prediction fought the useful ballistic phase and helped
nothing; what actually bounds error on reversing motion is retracting
toward the LAST-SEEN position, anchored to the (usually still-measured)
parent so it rides torso translation. Hanging-rest easing still happens —
in RELAXED, where it always did. Also from measurement: velocity trust is
a stack of three deterministic factors (fit residual, deceleration
projection, 2 m/s speed knee) because the fast_dropout eval proved
constant-velocity extrapolation of strikes loses to holding — fast motion
now converges to hold-quality instead of flying away, and a hard 0.3 m
drift cap makes "never flies away" an enforceable bound rather than a
hope. Prediction entry re-anchors on the ring buffer's last well-measured
sample (dead-reckoned across the 2–3 hysteresis frames) — the low-vis
positions MediaPipe emits during occlusion are hallucinations and
anchoring to them poisoned whole outages (caught by the drift-cap unit
test before it shipped).

## 2026-07-07 — PPC: confidence encodes measured predictive value per group
Two masked-eval findings shaped the confidence channel beyond the plan's
sketch. (1) Velocity trust scales the decay horizon: a prediction the
trust stack rates as "basically hold" hands bones back to the
gate-approved bone-hold quickly instead of driving them with
informationless positions — fast_dropout's masked puppet sync went from
15 % worse than legacy to better once low-trust confidence decayed fast.
(2) Legs ship at visTrust 0.25 (a direct confidence multiplier): stride
swings reverse inside any honest horizon; leg posErr measured ≈ hold at
every age while leg-bone drive made masked sync 40 % worse than legacy
(8.1° vs 6.06°). Scaling the confidence itself (not the decay rate)
matters because the downstream visibility EMA lingers above the bone
gate when the decay floor sits at 0.35 — legs now emit ≤ 0.23 and gate
off in ~2 frames, closing the gap (6.21° vs 6.06°). Positions keep
flowing either way; only the claimed confidence drops. The speed knee
landed at 1.3 m/s (from 2.0) for the same reason, re-measured on both
the fast and arms fixtures so the arm-exit win survived.

## 2026-07-07 — PPC: masks live in src/eval/masks.ts, results in ppc-results.json
Mask specs are bundled data, not fetched JSON — a fetch would ping the
privacy receipt's network counter, and that counter staying at zero is a
trust feature. The PPC eval writes eval/ppc-results.json via its own
runner (eval/run-ppc.mjs): running `eval/run.mjs <one fixture>`
overwrites eval/results.json wholesale, which nearly clobbered the
fully-visible baseline twice this pass (restored from git both times).
Masked runs also sample the sync metric against the pre-mask TRUTH
stream, and synthesized dropout frames are never counted as detections —
both numbers must mean what they claim.

## 2026-06-10 — M5 polish extras skipped (contract-first)
Hand motion trails, the confidence meter, and the style/theme toggle from
the mission's M5 list are not in the /goal contract, and the mission says
the /goal block is the contract and to resist gold-plating. The stage
already has the dark studio look, grid, key+rim lights, soft shadows, and
LIVE badge from M0; record button, README, ASSETS, DEMO_SCRIPT, and POSTS
are done. Shipping without the three extras; they're listed as future work
in the README if anyone wants them.

## 2026-06-10 — Vision-review screenshot sets stay out of git
media/review/ (15+ paired frames per phase, plus jitter bursts) is a working
artifact regenerated by scripts/capture-review.mjs and scripts/jitter-check.mjs;
it contains many frames of Lekan from the fixtures, so committing the full set
multiplies the privacy surface for no benefit. Following the M0/M1 precedent,
exactly one representative screenshot per milestone is committed (media/m2-robot.png
for M2) and media/review/ is gitignored. EVAL_NOTES.md records what the full
set showed.

## 2026-06-10 — No React; vanilla TypeScript + DOM
The mission recommends Vite + React with React for UI chrome only. The
dependency set staged before M0 had no React, and the entire hot path
(capture → detect → retarget → render) must be imperative regardless. The UI
chrome here is a handful of buttons, sliders, and badges — cheaper as direct
DOM than as a React tree that must be firewalled from per-frame data. Going
vanilla removes the single most common failure mode the mission warns about
(per-frame data leaking into React state) by construction. Vite + TypeScript
+ three + @mediapipe/tasks-vision + @pixiv/three-vrm otherwise as prescribed.

## 2026-06-10 — Mirroring strategy
Video element and 2D overlay canvas are mirrored together with CSS
`scaleX(-1)`; the overlay draws in raw (unmirrored) landmark coordinates so
it always aligns with the video pixel-for-pixel. The 3D rig gets its mirror
from a landmark-space swap(left/right indices)+negate(x) transform applied
before the body-frame/retarget math, exactly as the mission prescribes, so
calibration is done once in mirrored space (mirror defaults ON).

## 2026-06-10 — Fixture y4m at 720p/30fps
Raw 1080×1920\@60 y4m would be ~2 GB per clip. Chrome's fake capture is fed
406×720\@30 instead (~160 MB/clip, gitignored). Pose quality at 720p is
indistinguishable for this use; 30 fps matches typical webcam delivery.

## 2026-06-10 — Pose model + wasm vendored locally, fetched at install
`public/mediapipe-wasm/` is copied from node_modules postinstall;
`public/models/pose_landmarker_full.task` (Apache-2.0, Google) is downloaded
postinstall if missing. Neither binary lives in git; the app itself serves
everything same-origin and makes zero runtime network requests.

## 2026-06-12 — P0: generated-avatar load smokes skip when the local VRM is absent
The five generated-avatar load tests hard-failed because the candidate VRMs
(public/avatars/generated/, deliberately gitignored, local working binaries
from the post-pass-1 audit workstream) are no longer on disk. Asserting
'loaded' on files the repo promises never to ship makes the suite red on any
fresh checkout, so the load smokes now skip when the .vrm is missing; the
fallback and UI-isolation tests still always run. Coverage returns
automatically on machines that have the candidates.

## 2026-06-12 — P0: pass-1 eval results archived before re-baselining
eval/results.json is overwritten by every run; the pass-1 final numbers are
copied to eval/results-pass1-final.json so the pass-2 before/after table can
cite both files directly rather than digging through git history.

## 2026-06-12 — P0: eval can no longer silently measure the fallback avatar
First baseline attempt mislabeled 3 of 9 rows: woody's VRM load failed
intermittently, setAvatar's catch only console.warn'd and reverted to the
robot, and eval recorded robot numbers under a woody run (all VRMs also
shared the name 'vrm'). Three changes: per-file VRM names ('vrm:woody'),
failed avatar load is now console.error (eval counts it), and eval/run.mjs
records avatarRequested + exits non-zero on requested/measured mismatch.
Baseline re-run under these guards before anything diffs against it.

## 2026-06-12 — Gate 1: woody demoted to local-only; astronaut default again
Gate-1 decision (structured reply): woody.vrm is a fan rig of a licensed
character and cannot ship publicly. Untracked + gitignored (remains in git
history — flagged; a history rewrite was offered and not chosen), registry
entry marked optional with a boot-time HEAD probe that removes it from the
avatar cycle when the file is absent, default avatar back to the CC0
astronaut. Electives locked at the same gate: Tier B1 velocity VFX + B2
auto-director camera; B3 parallax and both Tier C items skipped.

## 2026-06-12 — Privacy receipt counts EXTERNAL requests in the headline
The spec sketch says "0 NETWORK REQUESTS"; shipped as "0 EXTERNAL REQUESTS".
Reason: variable fonts load per-unicode-range subsets lazily, so a same-
origin font file can arrive after document.fonts.ready and falsely dirty
the counter — and same-origin static assets are the app serving itself,
not a privacy event. The enforced claim is "nothing talks to anyone
else's server": every cross-origin resource/beacon/socket counts from the
moment boot assets settle. README privacy wording already matches this
("zero runtime network requests; model and WASM served same-origin").

## 2026-06-12 — No opaque background on the camera-feed layer
Chromium (headless GL at least) mis-composites an opaque background on
the promoted layer that contains the accelerated <video>: the bg quad
paints y-flipped over the WebGL stage as a feed-sized hole. The dark fill
lives on .camera-pane instead; comment pinned in styles.css.

## 2026-06-12 — P3: true finger tracking ships in hand-only mode ONLY
HandLandmarker (21 landmarks) drives hand-only mode — that mode IS finger
tracking. It does not spread to full-body avatars this pass: running both
models per frame costs pose-loop budget, and the P2 pose-landmark
open/fist/point approximation already covers character mode's needs.
Revisit only if a P8 perf margin makes dual-model free.

## 2026-06-12 — Beaky stays center-weighted
The talking-head puppet follows hand position at half gain, clamped to
the stage box: full positional mapping walked the puppet off frame on
real footage. The expressive hand and x-ray keep full positional range —
their point is literal following.

## 2026-06-12 — Gate-3 fixes: capability labels over forced features
The astronaut's hands are mittens (no finger geometry); rather than fake
finger motion, both default avatars now carry "Fingers not supported"
chips and the roster gap is queued for P6/Gate 4 (Seed-san — VRM1
reference model, already in public/avatars — or a 100Avatars CC0 pick
with real fingers). Spec rule applied: "a capability label, not a bug."

## 2026-06-12 — P4: Motion Memory records landmarks, not bone quaternions
The spec sketches "capture the retargeted bone-quaternion stream"; shipped
as the pipeline INPUT stream (mirrored+smoothed landmarks, int16). Bone
quats are rig-specific — re-skin would need per-rig remapping and would
bake in the recording avatar's rest pose. Replaying landmarks through a
second Retargeter IS the retargeting layer doing the re-skin, exactly, on
any roster character, and playback obeys the current expressiveness
settings. Round-trip tolerance verified in tests/memory.spec.ts.

## 2026-06-12 — Gate 4: Erika (100Avatars R1 #053, CC0) joins the roster
Chosen over Robert (both verified: 40 finger bones, articulated geometry,
embedded CC0 meta) for silhouette and contrast beside the astronaut.
Screening method: registry fetch → glb JSON-chunk finger-node count →
in-app fist/open visual verification via the applyHandState dev hook →
eval (face-touch 100% reach / 0 penetration, arms 9.71°). The roster gap
this fills came from the Gate-3 finding that both default avatars have
mitten hands.

## 2026-06-12 — P8 final-eval fixes: velocity gate + frame-time velocities
The final refresh caught shadowboxing engaging face-touch mid-punch;
engagement is now velocity-gated (fades out above ~3.5 rad/s forearm
speed). That fix surfaced wall-clock velocity estimation breaking replay
determinism — commitTarget now uses frame time (wall for live, loop time
for ghosts, synthetic in tests), which also corrected ghost coast
behavior. Both changes verified by the suite and re-run evals.

## 2026-07-06 — @bodyarcade/body-input P0: RFC location + integration shape
Schema RFC lives at packages/body-input/PLAN.md (root PLAN.md remains the
pass-2 artifact). Package integrates via a vite/tsconfig path alias, not
an npm-workspace conversion — zero install-layout churn, suite stays
green, extraction to a real workspace later is mechanical. Core is
three.js-free (ported vector math for the torso basis) so consumers'
three versions never matter. One Euro is ported, not imported: the
package carries no dependency on PosePuppet source. Recorded input tapes
(landmark traces) are gitignored — same privacy class as fixtures.

## 2026-07-06 — body-input P1: runner convention + extraction choices
Package unit tests live in tests/bodyinput.spec.ts under the existing
Playwright runner (node-side, no browser) rather than a separate node:test
harness — one suite, one green. Extraction deviations from the RFC sketch,
all logged: arm length is measured from shoulder→wrist distance at neutral
capture (works for hanging or T-pose arms; floored/capped at 1.5–2.6
shoulder-widths) instead of the 2.2× estimate, which remains the
pre-neutral fallback; handPoint measures each wrist's distance from a
synthesized hanging rest and reports the between-arm asymmetry; crouch's
upper-body fallback uses image-space shoulder drop because MediaPipe world
coordinates are hip-origin and cannot see whole-body height changes.
defaults live in src/defaults.ts (not defaults/shaping.json) so the
jitter tool rewrites a typed module instead of a JSON import.

## 2026-07-06 — avatar probe hardened against SPA-fallback 200s
Pre-existing suite failure (not body-input): probeOptionalAvatars trusted
res.ok, but the vite dev server now answers missing optional VRMs
(woody.vrm) with the SPA fallback page — 200 text/html — so the cycle
included woody, its load failed on HTML-as-glTF, and the error path
reverted config back to erika forever. The probe now treats text/html as
absent. Diagnosed with a scripted click-through (avatar-debug) after the
failure reproduced on a clean checkout.

## 2026-07-07 — body-input P2: the jitter tool caught an extraction bias
First jitter-floor run on still.mp4 reported handsForward "noise" of 0.37
mean / 0.39 p95 — hanging wrists sit ~0.4 arm-lengths forward of the
shoulder plane in MediaPipe z (armsOut showed 0.13 the same way). That is
bias, not jitter, so instead of shipping a 0.2 dead zone to mask it, arm
axes are now rest-relative: neutral capture records the hanging-arm rest
(gated so a T-pose recenter can't poison it) and axes report the excess,
renormalized so full extension still reads ≈1. Re-measured floors:
armsOut/handsForward ≈ 0.003 p95 (pure noise), leanY 0.10 p95 (the honest
MediaPipe z-noise story), rest ≤ 0.07. Dead zones in defaults.ts now
carry provenance and a do-not-hand-tune marker; the tool re-runs headed
(headless pose runs ~8 Hz and was rejected by its own sample-count gate).

## 2026-07-07 — body-input P3: real-footage findings drove three extraction fixes
The fixture eval (episode-structural assertions, no hardcoded timestamps)
caught what synthetic tests could not: (1) a deep crouch classified as
seated — seated now requires leg-fold 0.55–0.85 AND ankles forward of
hips, both y-dominated cues measured on the clips (crouch folds to
0.45–0.51 with heels behind; seated 0.63–0.70 with feet forward; MediaPipe
z compression made the original thigh-angle test flicker); (2) the 4s
fallback neutral captured mid-sit-down and pegged leanX — fallback
captures are now flagged and replaced by the first completed stillness
dwell; (3) a 1.5×shoulder-width arm-length floor silently inflated
armLength ~15% (real straight arm ≈ 1.3 sw in MediaPipe world) and capped
armsOut at ~0.8 — floor lowered to a sanity-only 1.1×. Two quantities are
recorded metrics rather than pass/fail: leanY cross-bleed during hard
lateral leans (0.5–0.66 p95, systematic depth error) and action events in
arms_tpose (the clip contains genuine forward reaches; still.mp4's zero
events is the false-positive bar). Both documented in the package README.

## 2026-07-07 — Flight P0: fork mechanics and layout
(1) Monorepo layout: PosePuppet stays at repo root; the TinySkies fork
lands in apps/flight as a self-contained npm-workspaces project (own
lockfile, own three@0.172). Moving PosePuppet to apps/posepuppet would
churn every suite/eval path for zero functional gain — flagged for
approval in PLAN.md §1 (Gate 1b). (2) Fork exclusions: .git, node_modules,
dist, deploy glue (vercel.json, railway.toml, .github, api/ serverless
shim), one-off codemod scripts patch*.js. (3) @vercel/analytics removed
from client/package.json + main.ts at fork time — no-telemetry
non-negotiable outranks fork fidelity; only tracking dependency upstream
had. (4) Root .gitignore's global binary-extension ignores (*.png, *.glb…)
would have silently swallowed 47 MB of flight assets — added
!apps/flight/** negations and verified all 284 fork files track. (5)
Upstream README's control table (W/S pitch, Shift/Ctrl speed) does not
match its code (A/D turn, W accel, S brake, ArrowUp climb, Space action,
F interact) — "keyboard identical to upstream" means the code's behavior;
noted in STUDY_NOTES.md, confirm at Gate 1b.

## 2026-07-07 — Flight P1: offline mode as a guard, not an abstraction
LocalWorldProvider is a small runtime module (localWorlds.ts) plus
isLocalMode() guards at the six network touchpoints, not a full
WorldProvider interface threaded through Game — the god-file's fetches are
one-liners and an interface would churn more upstream code than it
protects (revisit if a third provider ever appears). Local mode is the
default; upstream server mode stays one env var away (VITE_FLIGHT_SERVER=1).
handleWorldFull needs no local branch: it can only fire from a socket
event. Upstream root build script was already broken (shared has no build
script; server "build" boots the server) — dormant-compile check is
prisma generate + tsc --noEmit, which passes. Two more external calls
found and removed beyond analytics: Google-Fonts Inter (now @fontsource
self-hosted) and a vibej.am jam widget.

## 2026-07-07 — Flight P2: transport reality and merge design
(1) BroadcastChannel is same-origin only — two dev servers (5173/5199)
can't share it. Rather than touching the completed body-input package, the
flight app accepts a postMessage envelope ({t:'bodyarcade.body-input.v1',
signal}) validated with the package's own assertSignalShape on receipt;
PosePuppet relays in-page signals to the window it opens. Same-origin
deployments still get BroadcastChannel for free (both listeners active).
(2) Keyboard priority is time-based (any key activity owns the plane for
1.5 s) rather than a mode switch — no UI, no state to forget, fallback is
sacred. (3) Analog inputs ride the existing smoothing: speedAxis targets a
point between MIN and cruise speed approached at the keys' accel/brake
rates; elevateAxis feeds elevateBlend directly. Upstream behavior is
bit-identical when the fields are undefined. (4) Body analog applies to
Plane only for now; turnRate (already continuous) reaches all vehicles.
(5) Headless finding: pages without a media stream get compositor-
throttled to ~1 rAF/s in new headless Chrome — the game loop froze, not
the signals. Body/closed-loop specs run headed; PosePuppet's headless
suite was never affected because its live video keeps frames flowing.

## 2026-07-07 — Flight P3 Feel Lab: what lives where, and what the clips taught
Shaping split: the package already owns calibration-relative → One Euro →
measured dead zone → expo → slew per axis; duplicating any of it flight-
side would double-filter and add lag. Flight owns the game-specific rest:
profile mapping (3 profiles as data + one map function each), assist
ladder (Full 0.95 turn cap / 0.75 elevate cap / -0.5 speed floor;
Standard keyboard-equivalent; Expert 1.6 turn), loss-autopilot (decay
τ=0.25 s → straight and level; re-entry slew 2.0 intent/s — no snap),
boost as hold-to-fire (engage 0.75 / release 0.55 / 6-frame hold / 3 s
refractory). Auto-level needs no spring of its own: bank is derived from
smoothed turn input upstream, so intent→0 IS auto-level. SUPERMAN's
"shoulder roll = bank" was dropped — no shoulder-roll axis exists in
schema v1; leanX is the bank proxy and armsOut is an arming gate
(arms down = stabilize), which reads better on camera anyway. Fixture
finding: crouch_stand.mp4's "stand" is a return to neutral, not a
stretch — tallness stays ~0, so the closed-loop law is descend+recover;
climb-by-stretch is asserted synthetically. Closed-loop specs sample ≥2
clip loops and measure dips against the observed baseline because the
fake webcam loops the file and the neutral can be captured at an awkward
phase (it self-corrects at the next stillness dwell). Gate-2 bridge
shipped early (palette "fly" + flightBridge.ts postMessage relay, origin-
pinned): the live gate needs a real way to launch the game, and it is the
seed of P4's Fly card.

## 2026-07-07 — Gate-2 NO-SIGNAL incident: root cause and topology fix
Lekan's live test failed with src NO-SIGNAL · 0Hz. Confirmed root cause,
in order: (1) the Gate-2 script I wrote used `npm run dev:client --
--port 5199` — the nested npm layer swallows `--port` (verified: vite
reported 5173), so flight never ran on the port the bridge targeted;
(2) with two vite servers, BroadcastChannel can never help — it is
origin-scoped and a port is part of the origin. Channel name, envelope,
and schema matched on both sides throughout; the failure was topology,
not protocol. Fix: same-origin architecture — PosePuppet's vite dev
server now serves the BUILT flight app at /flight/ via a static plugin
(flight builds with base '/flight/'; root-absolute asset prefixes
/audio /3D /2D /npc /fonts are mapped to the same dist — verified
disjoint from PosePuppet's public/). One command starts everything:
`npm run arcade`. The palette "fly" now opens same-origin /flight/ and
still relays via postMessage as a redundant path; the receiver dedupes
by signal ts. Tuner now reports transport + schema + sender-connected
and prints an actionable hint on NO-SIGNAL. Regression guard:
apps/flight/tests/topology.spec.ts (headed — measured: a SwiftShader-
bound game page throttles even BroadcastChannel delivery to ~0.7 msg/s
in headless, so a headless version of this spec would lie). Flight-only
standalone dev on 5199 remains supported for flight app work (its suite
runs that way); body signals are only expected in the /flight/ layout.

## 2026-07-07 — GATE 2 APPROVED: Superman default, five feel refinements
Lekan's live report: no fatigue/nausea, no drift fights, latency felt
attached, autopilot + recenter worked. Default standing profile =
SUPERMAN (his pick), seated = HEAD PILOT; profile array reordered so
Superman is the fresh-session default. Tuning from the report, all
landed: (1) Head Pilot climb needed an uncomfortably deep backward lean
— seated leans are small, climbGain 1.6 → 3.0 (descend 2.0); (2)
Superman arm-drop was choppy — disarm now decays through the same
τ=0.3 s path as tracking loss and re-arms through the reacquire slew,
plus arm/release hysteresis (engage armsOut>0.4, hold >0.25) so the gate
can't flap mid-turn; (3) autopilot/re-entry slightly abrupt — decay τ
0.25 → 0.3 s, re-entry slew 2.0 → 1.2 intent/s; (4) RECENTERED was easy
to miss — now a dedicated high-contrast tuner banner (4 s) plus an
in-game toast that works without the tuner; (5) Superman responsiveness
— turnGain 1.2 → 1.35, climb 1.5 → 1.7 (modest on purpose; "not
twitchy"). Gains store bumped to v2 so live-test slider values don't
mask the new defaults. His Pilot Lean observation (extreme lean ≈
moderate lean) is the Full Assist turn cap working as designed at 0.95
— left alone per his own "don't add behavior beyond the design" note.
Specs pinned to pilot-lean where they test that mapping (the default
changed under them).

## 2026-07-07 — Flight P4: credit placement, companion mode, provenance find
(1) In-game credit: upstream's jam-webring corner pill (vibejam.cc +
player-name query params) is repurposed as the TinySkies credit link —
same visual chrome, now pointing at the original repo with the approved
line as aria-label; the lobby attribution paragraph now leads with
"TinySkies / GlobeFly by Danny Limanseta is used with permission". The
jam portal was upstream-event chrome, not game content — replacing it
also removes the last external URL with query-param outflow. (2) Asset
provenance largely resolved by upstream's own attribution line: music by
Suno, SFX by ElevenLabs, 3D by Tripo3D — AI-generated works commissioned
by the author, i.e. rights he controls under the grant; ASSETS.md updated
(Lekan still confirms commercial-output tiers before going public). (3)
Fly entry: rail card + palette command share one startFlight() path —
opens same-origin /flight/, relays signals, and drops PosePuppet into
companion mode (lite pose model + stage.setSuspended(true)), restored by
a 1 s window-closed poll. (4) Measured (eval/flight-perf.json): combined
two-window session 111.1 fps flight render (floor 45, target 60), pose
30 Hz (target ≥15), signal rate 30 Hz, producer confirmed on lite —
headroom is ~2× the target. (5) Faithful-experience sweep: boat + carpet
unlock and fly offline (spec seeds progression past both gates); the
rest of the upstream feature set is exercised passively by the offline
suite's zero-console-error assertions.

## 2026-07-07 — Flight P5: replay design and where flight numbers live
(1) Replay check reuses the REAL Plane class: a ?record-intents=1 tape
captures per-frame dt + the final merged inputs (post keyboard/body
merge, post twister/level-up overrides) + a full kinematic snapshot
(including private smoothing state, exposed via getReplayState — the
whole point is that a fresh Plane + snapshot + tape must reproduce the
live path, and it does: max divergence 2.6e-6 world units over 1,681
frames at dt 5.2–50 ms, heading/altitude/speed exactly 0; documented
ceiling 0.02 units / 0.5°). Known honest limit: events that mutate the
plane outside update() (ring-collect boosts, gremlin hits) are not in
the tape — the eval flight avoids them and the spec says so. (2) Flight
eval numbers live in eval/flight-perf.json and eval/flight-results.json
rather than eval/results.json: the PosePuppet eval runner owns and
OVERWRITES results.json wholesale, so merging flight keys there would
silently lose them on the next posepuppet eval refresh. The prompt's
"everything into eval/results.json" is honored in spirit — one eval/
directory, every quotable number file-backed — and this note is the
paper trail. (3) apps/flight/README.md keeps the upstream README intact
below a BodyArcade header that states the credit, the offline default,
and the real keyboard controls (upstream's own table was stale).

## 2026-07-07 — Gate-3 retest: post-Gate-2 tuning REVERTED to the approved baseline
Lekan's Gate-3 flight: current controls worse than what he approved at
Gate 2; live tuner gain 0.6 helped (diagnostic that defaults got too
aggressive, not a solution). Lesson recorded: his Gate-2 "optionally
investigate slightly greater responsiveness / smoother transitions" asks
were treated as change orders and stacked five feel changes onto an
approved baseline — approved feel is a baseline to protect, not a
starting point for drift. Restored to EXACT Gate-2 values: autopilot
τ 0.25 s, re-entry slew 2.0 intent/s, Superman turnGain 1.2 /
climbGain 1.5, arming = single 0.35/0.5 threshold, disarm = instant
neutral + instant re-arm (no decay, no slewed pickup — the smoothed
variant plus slower slew was the likely "mushy" culprit: it added lag
after every confidence dip and arming cycle). KEPT per his instruction:
Head Pilot climbGain 3.0 / descendGain 2.0 (his explicit Gate-2 request,
rated "very good" at the retest), Superman as default profile, recenter
banner + toast, all transport/topology/diagnostic/test/doc work. Gains
store bumped v2 → v3 so his diagnostic 0.6 slider value can't mask the
restored defaults. All 9 synthetic control specs pass on the restored
baseline.

## 2026-07-07 — Rowing P0: branch, build-vs-adapt, placement, schema route
Branch: renamed the unused placeholder `bodyarcade-water-worlds-fable`
(zero unique commits, exactly at main 940d31c = Flight + PPC accepted)
to `bodyarcade-rowing-fable`; no preservation branch touched. Gate-1
recommendations (PLAN.md has the full reasoning): (1) ADAPT the
TinySkies boat — it is a complete tuned vehicle (physics, wake, camera,
ocean audio, land collision); building fresh would duplicate all of it
and need its own feel pass. (2) Rowing lives in apps/flight as a boat
body-mode, not apps/rowing — every needed system is there, and body
input already steers the boat via the existing merge point; rowing adds
the missing propulsion path. (3) Stroke detection goes in
@bodyarcade/body-input producer-side (landmarks never cross the
transport, so the game cannot compute it) as a schema-v1-ADDITIVE
optional `stroke` block, the pattern PPC's `tracking` block established
— not the v2 bump FUTURES.md sketched; no version churn, old tapes stay
valid. (4) Prompt deviations logged: the globe has no rivers (land/
ocean field only), so the "river run" becomes an open-water course
behind a `Waterway` seam interface the future open-data pipeline fills;
keyboard fallback keeps upstream boat semantics (W hold = accelerate)
instead of the sketched "W = stroke" — accepted Flight rule is keyboard
identical to upstream, and it already serves the fallback purpose.

## 2026-07-09 — Rowing P1: stroke detection decisions and measured revisions
(1) Reversal detection is a position Schmitt trigger (reversalHys 0.06
arm-lengths from the running extremum), not velocity zero-crossings as
the prompt sketched — MediaPipe z velocity flickers near the turn even
after One Euro; position hysteresis is immune. (2) ampL/ampR are
USER-side (like leanX): the package receives MIRRORED landmarks, so the
"left" landmark slot is the user's anatomical right arm — the pipeline
swaps when feeding the detector; caught by the left-bias fixture
reading the dominant arm on the wrong side. (3) Rowing fixture eval
runs single-pass video-file mode (?video= + seek-to-0 + park 4.6 s >
maxPeriodMs so the drive-duration gate discards stale pre-seek
catches), not the looping fake webcam: the delivered takes start/end
mid-motion, so a loop seam swallowed or fabricated 1–3 strokes per run
(measured); counts went 11/12, 24/24, 16/15 once seam-free. (4) minAmp
0.12 was tried for the seated undercount and REVERTED — it changed no
count; the real cause is the take itself: raw wrist trace + frame
review show 13 completed pulls, a ~2.5 s mid-take pause, and a
mid-stroke start. Eval asserts the measured label 13 (provenance in
STROKE_TRUTH + EVAL_NOTES), pending Lekan's confirmation at Gate 2.
(5) Stroke state ships as an ALWAYS-EMITTED optional schema block (v
stays 1); count is a monotonic field rather than a new event name, so
the closed event set is untouched and old consumers/tapes stay valid.
