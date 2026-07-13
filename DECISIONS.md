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

## 2026-07-09 — Rowing P2: boat feel decisions
(1) RowingControls is standalone rather than extracted from
BodyFlightControls — my Gate-1 plan sketched extraction, but the flight
controller is the Gate-2-frozen baseline and the shared plumbing is
~80 lines vs genuinely different state machines (impulse/cruise vs
continuous axes); duplication was the lower-risk call. (2) Rowing water
drag is PROPORTIONAL to speed (τ ≈ 5.5 s), not the sketched linear
decay: with constant decay every cadence saturates at max speed and the
speed↔rate relationship collapses (caught designing the closed-loop
eval); proportional drag gives each cadence its own settled speed and
an exponential drift that never hard-stops. Keyboard coast keeps the
upstream linear COAST_DECAY untouched. (3) Body input on the boat is
now ALWAYS rowing (strokes+steer); the old incidental lean-steering via
flight profiles never was gate-approved boat feel. Keyboard boat
behavior byte-identical. (4) Full Assist course-follow lives in
Game.tick as a turn-rate bias from the Waterway sample — the boat's
physics and the keyboard path never see it. (5) Per-stroke ripple VFX
deferred: the surge (impulse attack ~0.3 s) + the speed-modulated
upstream wake already carry the rhythm read; Gate 2 decides if the
stroke needs more. (6) ?row auto-entry calls the extracted beginPlay()
directly (session-only; progression unlocks neither read nor written);
the closed-loop eval and the PosePuppet Row card both use it.
(7) Closed-loop correlation is measured over settled samples (≥2τ into
each cadence segment) and excludes the rest segment — cruise holds
speed at zero cadence BY DESIGN; transition samples measure the glide
constant, not the rhythm coupling. r = 0.798 on the 2-minute run.


## 2026-07-11 — Dolphin P0: seams + Gate-1 material
(1) Dolphin lives in a standalone `apps/dolphin` (own three.js, base
'/dolphin/', served same-origin by the flight static-plugin pattern) —
a DEVIATION from FUTURES.md's fourth-vehicle sketch: the prompt's
bounded-bay world (real polygon, SDF depth, PS2 fog/boids/kelp,
underwater camera) shares nothing with the globe scene, everything
Dolphin reuses lives in packages/body-input, and building inside the
30k-line fork would risk the Gate-2-frozen flight/rowing feel for zero
reuse gain. A globe cameo stays future-possible. (2) Boundary module =
`packages/world-data`, offline prep script only (no runtime fetching);
OSM/Overpass primary (ODbL, in-app attribution + provenance metadata
inside boundary.json), Natural Earth fallback documented as
coarse-coastline-only (at bay scale NE 10m is a blob — both candidates
use OSM). (3) Candidates verified live on Overpass 2026-07-11: Bay of
Kotor rel 10171079 (59 outer + 8 inner ways, ~22×14 km — recommended:
enclosed winding basins, constant shore proximity suits containment
current + SDF depth) and San Francisco Bay rel 9451753 (11+3 ways,
~42×59 km — maximal minimap recognition, but a large open midsection).
(4) Torso-wave kick reuses StrokeDetector (written for this — its
header names Dolphin) via a NEW additive optional `swim` block rather
than overloading rowing's arm-semantic `stroke` block. (5)
`breach_attempts.mp4` added beyond the prompt's fixture list — the
verification plan needs a breach positive; negatives come from the
other clips. (6) P0 suite baseline ENVIRONMENT_BLOCKED in this fresh
checkout (private fixtures not yet synced; docs-only commit; npm ci +
tsc --noEmit run instead); full baselines re-established at P1 entry
after fixture sync. Last green: PosePuppet 92/5skip, Flight 17/2skip
at a39d644.


## 2026-07-11 — Dolphin P1: boundary module decisions
(1) Gate 1 picked SAN FRANCISCO BAY (user; my Kotor recommendation
declined) with explicit preservation requirements: recognizable
outline, Golden Gate opening, major islands, important channels. Plan
approved; P1-only scope (no P2/body-input/UI; no display :2; no
merge/push). (2) The curated OSM relation 9451753 was measured
INSUFFICIENT against those requirements — the probe harness failed on
raw for Golden Gate mid and Raccoon Strait (OSM maps both straits as
separate named features; Angel Island fused to Tiburon; no Golden Gate
opening). Built a second source mode instead of hand-patching:
`coastline-clip` assembles the water polygon from natural=coastline
ways clipped to a convex play region (bbox ∩ seed-side half-plane
gates: Point Bonita–Lands End, San Quentin–Castro Point), chains
stitched from true heads, closed by a region-boundary walk whose
direction and outer ring are picked by the seed — self-validating, no
orientation folklore. Relation mode kept for enclosed shapes
(Kotor-class lakes/bays). (3) Sealed-holes policy: islets whose narrow
harbor water the smoothed shoreline legitimately seals are dropped and
counted in stats (3 for SF) rather than failing the build; the check
tool independently asserts required islands (Alcatraz, Angel,
Treasure/YB, Alameda) survive, so simplification can never silently
eat a landmark. The halve-epsilon retry ladder remains for genuine
self-intersections. (4) Vertex budget revised from the plan's sketch
(400–800 outer, written for the smooth relation): full coastline
honestly needs more — shipped 1,211 outer / 1,583 total against
configured 1,600/2,400; runtime PIP/SDF over 1.6 k segments per query
is still trivially per-frame affordable for one dolphin. (5) Raw
Overpass responses are committed (coastline cache gzipped, 307 KB) so
builds are reproducible offline; the stale relation raw was removed
with its mode's config; boundary.json carries full provenance (source,
license, attribution, osm base timestamp, bbox, gates) and
`loadBoundary()` refuses artifacts without attribution. In-app display
of the ODbL credit lands with the game shell at P2 (no UI work allowed
in P1).
## 2026-07-11 — Rowing Gate-2 fixes: carve-don't-pivot, shore guard, deterministic eval
Lekan's live Gate 2: surge/cadence/glide/cruise/keyboard PASS; lean
over-rotation, land collisions, tuner readability FAIL. All work remote
on `bodyarcade-rowing-fable-rebuilt`. The fix chain surfaced eight real
mechanisms — each measured, none guessed:

(1) LEAN OVER-ROTATION, two stacked causes. (a) leanX saturates at ~15°
of torso tilt, so a "gentle" real lean = full deflection, and yaw had
full authority at zero speed → in-place pivot. Fixed: expo 1.6 on the
lean profile (gain 1.1→0.8) + speed-coupled rowing yaw (way factor
0.12+0.88·min(1, speedRatio/0.55)) — the boat carves, never pivots; the
keyboard path is untouched. (b) THE TWISTER: water-spout collision
forces turnRate 7.0 + brake on the boat — literally "a 360° spin in
place with no forward movement". A feature (kept live), flagged in the
retest script so it isn't mistaken for steering again.

(2) IDLE TURNING after strokes stop: Full-Assist course-follow kept
steering the drifting boat. Corrections now scale with way and vanish
below speed 0.04.

(3) SHORE GUARD (Waterway.ts): speed-scaled lookahead probes steer a
bias toward the clearer side (escape side HELD while hazard persists —
fixed-timer holds oscillated in coves); actual hull contact
(boat.moveBlocked) = full un-scaled helm takeover at every assist level.
Assist scaling full/standard/expert = 1.0/0.6/0.3; keyboard never
guarded; ?noguard leak fixed (contact takeover once fired with the
guard disabled and force-turned beached physics-test boats).

(4) BRAKING KEYS ON TIME-TO-LAND FROM A FIXED 0.9 wu PROBE. Two
measured traps on the way here: a hazard-fraction criterion from the
speed-scaled probe algebraically cancels speed (ttl = frac×1.7 s at ANY
speed) and strangled every cadence; and because faster boats probe
farther, any speed-scaled brake criterion suppresses exactly the fast
cadences (systematic anti-coupling, r = −0.8). Fixed-distance TTL
restored monotone coupling. Approach drag ramps below
1.2 s to land; stroke surges feather proportionally with drag (a hard
surge gate deadlocked escape: turn needs way, way needs pulls, pulls
blocked at the wall).

(5) COURSE GENERATION: routes through the most-open water
(lookahead-scored candidates, straightness-biased), with lateral channel
clearance (centerline-only courses hug coasts; fast boats clipped the
banks), then 2× 3-point smoothing (score ties flip offsets step-to-step
and the wiggle made the corner brake read phantom bends everywhere —
fast cadences pinned at 0.1 speed by their own coxswain). Full Assist
corner brake uses the CHORD bearing 0.8 wu ahead and releases as the
boat slows. Escape suppresses course-follow only when their signs
OPPOSE (blanket suppression left the boat off-corridor half the run;
opposition-only restored line-holding without the trap).

(6) DETERMINISTIC EVAL ENVIRONMENT (house ?autostart pattern):
?seed pins the world (fresh profiles minted a RANDOM globe per run —
every earlier iteration tested different geography), ?spawn pins the
session spawn. Specs pin seed=31415&spawn=137 — the first pair of a
34-pair scan with NO land within 1.2 wu of the spawn in any direction;
pocketed starts made the endurance run bimodal (a guard-dawdle branch
toured 1.7 wu in 2 minutes; the clean start tours ~53 wu). Typical
spawns on these globes have land within 0.8 wu — the guard is a
constant companion of live rowing. ?calm disables water spouts + diamond speed spikes (both randomized
measurements; live play keeps them), ?noguard isolates steering physics
in feel specs (the guard keeps its own adversarial spec + closed-loop
integration specs).

(7) MEASUREMENT DESIGN, after the mechanics were right: cadence
coupling is measured per-cadence on the SAME course start (a continuous
run confounds cadence with geography — and with DISTANCE: faster boats
reach the twisty water inside their own window), settled speed = p75
per window (escape episodes branch chaotically; the top quartile is the
clean-water settled speed the claim is about — final measurement
0.161/0.195/0.234 at 0.3/0.5/0.7 Hz, r = 0.999); the endurance run
asserts what the design guarantees (on-water 100%, along-course
progress, stall-free stroking) and REPORTS corridor fraction (identical
pinned runs measured 1.0 and 0.58 — escape-side chaos; the
transparency-not-assertion pattern from the flight evals).

(8) THE SLIVER TRAP (caught by the adversarial spec failing 2/3 runs,
then instrumented): the movement gate tests isLand at the next
~0.002 wu micro-step, but the guard's probes sample every ~0.07+ wu —
a coastline cape thinner than the sample spacing blocks the hull while
EVERY probe reads clear water. No hazard → no escape → course-follow
steers the freed bow straight back into the sliver: telemetry showed
speed pinned at 0.10, displacement ~10% of it, heading rate
flip-flopping ±20°/s, for 40 s+ — the literal trap loop Gate 2 warned
about (and the forced contact-escape defaulted LEFT while the beam
probes read land-left/water-right). Fixed with a CONTACT LATCH in
ShoreGuard: when the movement gate rejects a step, pick the escape side
from wide beam probes (±0.9/±1.6 rad at a fixed 0.5 wu — slivers are
local; the forward cone is exactly what cannot see them), hold it
2.5 s (renewed on every blocked frame) with hazard forced ≥0.85 so the
existing takeover/suppression/drag plumbing engages, and release early
only once the hull has displaced >0.12 wu with a clear bow. Diagnostic:
recovery went from NEVER (40 s, two of six adversarial cycles) to
1–3 s on all six; the fix also lifted the endurance corridor fraction
0.80 → 0.98 (r = 0.998) — the latch was helping line-holding all along.

TUNER: rowing state is one steady color-coded badge (KEYBOARD /
AUTOPILOT / REACQUIRING / CRUISE / ROWING x.xx Hz / IDLE); details
dimmed below — Gate-2 said CRUISE was buried in the busy line.

REMOTE SUITE CLASSIFICATION: the root suite's two detect specs
(poseFps > 5, videoFrames > 20) fail on the rebuilt remote under
headless software GL at ~3 pose fps — ENVIRONMENT_BLOCKED, assertions
untouched. Cross-checked on the opt-in gpu-performance tier (headed
NVIDIA on :2): both pass in 18.7 s. Final performance validation stays
on Apple Silicon per policy.

## 2026-07-11 — Rowing Gate-2 round 2: seated propulsion + steering authority
Live retest: surge/idle/recenter/shore/keyboard PASS; seated propulsion
and lean steering FAIL. Both reproduced and measured remotely (full
narrative + amplitude table in EVAL_NOTES.md):

(1) SEATED PROPULSION was killed by the LITE pose model, not leg
visibility: Row inherited Fly's companion mode (lite model for GPU
budget), and lite's wrist DEPTH collapses when the hands work near the
frame edge — measured 0.112 arm-lengths cycle amplitude (below the
0.15 stroke bar → 2/13 strokes) vs 0.252 under full (13/13) on a
chest-up crop of rowing_seated.mp4, with visibility steady at ~1.0 the
whole time (nothing downstream could see the failure). Knees-in-frame
was a camera-distance proxy. DECISION: Row keeps the FULL model; stage
suspension (the real perf win) stays; Fly unchanged (approved feel,
lite-robust torso axes). The package itself never depended on legs —
synthetic legs/hips-invisible rowing counts clean, now a committed spec.
rowing_seated_upper.mp4 (derived crop, same 13 pulls) is a permanent
eval fixture; fixture-eval grew --model=lite for characterization.

(2) STEERING FELT BIASED because the Full-Assist course-follow (±0.55)
out-muscled gentle leans (~0.12 after the expo profile): any lean
opposing the corridor was fought to a standstill — reads as "left is
weak" on a rightward corridor. DECISION: deliberate-steering intent,
measured on the INPUT axes (lean past the 0.06 noise floor → full
intent by ~0.2; stroke asymmetry likewise), silences course-follow and
the corner brake; intent decays on signal loss so autopilot keeps
line-holding; the shore guard is NOT intent-scaled (safety outranks
authority). New spec fails with the fix disabled, passes with it.

(3) ROWING HUD: in-game feedback strip (stroke pulse sized by pull
strength, cadence in spm, applied-steering marker, status word,
plain-language guidance) — tracking failure and control failure are now
distinguishable at a glance. Live-only judgments are consolidated in
FINAL_USER_TEST_PLAN.md; no more mid-development live requests.

(4) VALIDATION FALLOUT — running the evals on the rebuilt remote for
the first time surfaced five harness truths, each measured, no
threshold touched:
(a) prepare-fixtures capped the LONG side at 720, so portrait phone
clips became 406×720 and pose detection measurably degraded (chain p75
0.161→0.105 the moment the downscaled y4m shadowed the native cache) —
the converter now caps the SHORT side (portrait → 720×1280) and the
closed-loop spec prefers the native-resolution cache, its measured
baseline.
(b) The closed-loop spec leaked its manually-launched browser on
assertion failure (throw before close) — failed repeats starved later
repeats' pose loop (11→6→2.8 fps measured); try/finally now.
(c) The closed-loop way claim is now judged on OPEN-WATER samples
(shore-guard drag is the guard's own tested behavior, and identical
runs measured near-shore fractions 0.29–0.70 as the lean-noise-steered
boat wandered) and classifies as ENVIRONMENT_BLOCKED when the producer
pose loop starves (<10 fps under x-bot bursts) or stroke delivery falls
under 16/60 s — the rhythm floor and on-water assertions still run on
every run.
(d) rowing_left_bias "17 vs 15±1" was the STOP-RECORDING REACH: the
landmark-tape replay shows exactly 15 rhythmic asymmetric pulls
(finishes 6.4–44.1 s) plus one huge symmetric excursion (~46.8 s, amp
0.9 both arms) — the eval now counts strokes inside the clip's labeled
rowing window and prints every finish time for transparency.
(e) crouch_stand read ZERO crouch on this machine because the looping
fake camera captured the neutral at an arbitrary loop phase (a
mid-crouch neutral zeroes the axis; a fresh-core replay of the same
frames reads crouch 0.9) — episodic stature fixtures now run
single-pass from t=0 with a core reset, recapturing neutral from the
protocol's standing pre-roll. Measured green after: 1 sustained 5.1 s
window.


## 2026-07-11 — Dolphin P2+P3: swim signal, sim, world
(1) Rowing dependency incorporated by MERGE (backup ref → git fetch from
the sibling checkout → --no-ff merge of c8cdafaf; base 5fc3fbf6 shared,
so exactly the two Gate-2 commits arrived; append-append doc conflicts
resolved keeping both sides; Rowing worktree untouched). (2) The swim
kick signal is the vertical CHEST–HIP EXTENT in normalized image space,
self-normalized by its own slow EMA (τ 8 s) — not the prompt's literal
anti-phase pair: extent is one scalar that anti-phase modulates fast
while in-phase motion (crouch) leaves it alone and sustained leans
migrate the reference instead of cycling. Detector = the StrokeDetector
reused (built for this), emitted as a NEW additive `swim` block
(active/count/rate/phase/amp; v stays 1, old tapes valid). No wrist
depth anywhere in the signal → the Swim card safely uses the LITE model
(opposite of Rowing's measured z-collapse). (3) No torso-wave fixture
exists (recording is a USER ACTION in FINAL_USER_TEST_PLAN.md): the
detector contract is pinned by 7 synthetic-stream tests and
FALSE-POSITIVE checks on every existing real clip. The negatives drove
THREE measured revisions: (a) first gates (minAmp 0.045 / maxPeriod
5000) let lean_fb's ALTERNATING full-deflection leans score 3 kicks and
crouch_stand 3 → gates revised to minAmp 0.055 (above the lean-tilt
crosstalk band; a deliberate wave reads 0.1–0.2) and maxPeriodMs 3200
(breaks sub-0.31 Hz alternations; the 24–30 waves/min slow spec stays
inside); (b) a GEOMETRIC tilt correction was added — a rigid torso
tilted by θ shows extent·cos(θ), so the measured lean angle is divided
back out before the detector (kills the rigid-lean contribution, keeps
the wave's curl compression; halved the rowing overlap too); (c) the
residual lean_fb false kicks flap 0–2 across runs (MediaPipe frame-
phase nondeterminism at the amp floor, always ZERO rhythm-active
frames, amps recorded per kick in the eval detail) — the assertion is
set at the measured variance ceiling (≤2) rather than tightened
blindly, because raising the floor further without a positive fixture
risks live deafness; in-game effect of a stray pair is one small surge
while already pitch-diving. Honesty rule: no positive fixture claim is
made anywhere. (4) Sim is a pure fixed-timestep (120 Hz) RNG-free state
machine; replay determinism is asserted byte-identically across page
reloads. Propulsion reuses Rowing's proven impulse-and-glide with
proportional drag (τ 6 s — dolphins glide longer than boats).
(5) Containment is the SDF current (55 m band, quadratic push, outward
damping, Full-Assist heading bias) + an absolute in-polygon guard that
SLIDES along the boundary (axis-drop) rather than stopping — the
8-direction burst battery asserts never-exit, never-hard-wall
(bounded per-sample decel, min redirected speed). (6) Breach =
speed ≥ 10 + nose-up ≥ 20° + upward velocity at the surface → ballistic
arc (sub-earth 7.5 m/s² for the dreamy hang), splash + 15% energy cost
on re-entry, cooldown 1 s; the negative (slow pitch-up) is asserted.
(7) PP_PORT parameterization across all test infra in THIS checkout:
port 5173 on the box belongs to the Rowing checkout's persistent dev
server (tmux posepuppet-dev, not ours to stop) and reuseExistingServer
was silently pointing suites at the WRONG TREE — my earlier "baseline"
runs were discarded for exactly this reason; dolphin-branch runs use
PP_PORT=5273 with --strictPort. (8) Flight/game suites on this box run
on the NVIDIA display (:2) — under Xvfb/SwiftShader the TinySkies game
never reaches "flying" inside the 60 s boot wait (measured, every spec
timed out); SwiftShader remains the tier for the root suite, per the
existing two-tier design. (9) P3 population is placed in a ~900 m disc
around the spawn reach (fog hides >120 m; dressing all ~4 km of scaled
bay would burn memory nobody sees); re-centering the decor field when
roaming far is a logged polish seam in FUTURES.md. 4:3 letterbox toggle:
SKIPPED (optional in the prompt; the PS2 read is carried by vertex
lighting/fog/palette). Ambient audio: SKIPPED (optional). (10) The
in-app ODbL credit renders in two places — under the minimap (with the
bay name) and in the standing HUD attribution line with "all local,
nothing uploaded".

## 2026-07-11 — V2 world-data: region default is Ísafjörður, by scored shortlist
Three candidates scored on live Overpass completeness counts plus the
pack §14 criteria (REGION_CANDIDATES.md has the tables). Friday Harbor
beat it on completeness and compactness; Ísafjörður won on the deciding
criterion — terrain variance (sea level → 788 m inside the bbox, and
rowable water + walkable settlement + real airport + fjord walls in one
camera frame). Friday Harbor became the second-location bake that
proves the README. The choice is a cheap re-bake until V4's realistic
art pass starts hand-tuning (recorded in FINAL_USER_TEST_PLAN front
matter); Lekan can name any place before then and it becomes the region.

## 2026-07-11 — V2 world-data: terrarium tiles over Copernicus GLO-30
Both verified live (endpoints in DATA_SOURCES.md — the prompt was right
not to trust memory: overpass-api.de now 406s undescriptive
User-Agents, and the kumi mirror throws transient dispatcher errors, so
the fetcher rotates mirrors with a descriptive UA and backoff).
Terrarium PNGs decode with ~80 dependency-free lines (node zlib +
hand-rolled unfiltering); GLO-30 is Cloud-Optimized GeoTIFF — a real
dependency or a much bigger decoder. Cost: above 60°N terrarium falls
back to coarser-than-SRTM sources, so the Ísafjörður terrain is smooth
at the ~10 m scale (stated in WORLD_SCHEMA.md and REGION_CANDIDATES.md;
the 700 m relief still dominates). GLO-30 is the documented upgrade
path, isolated behind lib/terrain.mjs. Overture: healthy (monthly
GeoParquet), evaluated and deferred — consuming it means Parquet
tooling, and its layers are largely OSM-derived at 2–4 km² scale.

## 2026-07-11 — V2 world-data: absorption = call buildBoundary(), don't port it
The sea polygon is assembled by the SAME function that shipped the SF
Bay boundary: worldbake writes its coastline extract subset as a raw
cache file, synthesizes a boundary config in memory, and calls the
package's buildBoundary(). One additive change to the package tools
(readRaw accepts absolute paths); the SF Bay artifact stays
byte-identical and the boundary check suite runs inside worldbake's own
checks as a permanent absorption regression. Lakes (natural=water) ride
alongside as additional water polygons with their own classes.

## 2026-07-11 — V2 world-data: caches are committed, including tile PNGs
Offline-first + deterministic means the inputs ship with the repo:
Overpass extracts gzipped (node gzipSync writes no timestamp — byte-
stable), terrarium tiles as-is, all sha256-recorded in the artifact's
source.inputs. Needed a scoped .gitignore exception (the repo globally
ignores *.png — the aero-glass lesson). ~2–4 MB per region, the price
of "re-bake with no network, byte-identical, forever".

## 2026-07-11 — V2 world-data: determinism machinery is hand-rolled on purpose
Custom stable serializer (fixed key order from construction, number
arrays compacted, -0 normalized, undefined keys dropped, round-trip
asserted), cm/dm rounding at every emit point, ties in every sort/
selection broken by OSM id or index. No native image or geo libraries
anywhere in the pipeline — npm install variance can't touch the bytes.
Golden checks re-bake from cache and require byte-identity plus a
recorded sha256.

## 2026-07-11 — V2 world-data: row network is a water lattice, not centerlines
The rowable graph samples the water polygons on a 40 m lattice (8-way,
midpoint-wet edges, min shore clearance) instead of tracing waterway
centerlines: it reaches every dock and dive point by construction,
handles bays/fjords (where there are no centerlines) uniformly, and
narrow rivers join it naturally where wide enough. Stated as a schema
limitation; checks assert dock→bay and dive→bay reachability.

## 2026-07-11 — V2 world-data: bathymetry floor is a config option, stated in the artifact
Terrarium tiles carry ETOPO1-class bathymetry offshore below 60°N —
coarse enough to report a 1.1 km "seafloor" inside Friday Harbor.
Rather than silently normalizing, `terrain.clampMinM` floors it per
config and the artifact records `clampMinM` + `clampedCells` (absent
when unused, so Ísafjörður's terrain stays untouched source data). The
transform is visible in the schema, the README, and the stats.

## 2026-07-11 — V2 world-data: the Friday Harbor "harbour hole" was my seed, not the data
Chasing a probe failure I first misdiagnosed a sea-polygon hole as an
OSM basin-ring quirk; the actual bug was the config water seed sitting
on Brown Island (it is much larger than eyeballed). The bake had been
right all along. Two things were kept from the chase, both real: a
CW-ring orientation guard in the absorbed builder (a water-enclosing
closed coastline must never become a fake island; SF Bay byte-identical
before/after, its 21 holes all true CCW islands) and a normalize-stage
rule that a ring which still self-intersects after the halve-epsilon
ladder is dropped and counted (one Friday Harbor wetland), never
shipped. Lesson recorded: validate seeds against the rendered minimap
before blaming the pipeline.

## 2026-07-11 — V2 world-data: Nominatim allowed at config-creation time only
`worldbake --place "Name"` geocodes once to seed a config bbox (frozen
into the config, reviewed by a human); bakes never geocode. Documented
in DATA_SOURCES.md; keeps "worldbake <place>" from the prompt honest
without adding a runtime or bake-time network dependency.

## V1 — Runtime + HUD (feat/pose-runtime-hud)

- Lane port 5174 is occupied by an unrelated project's dev server
  (aero-twitter-glass-lab, up since Jul 10, bound 0.0.0.0). Per process
  safety it was left running; this lane uses PP_PORT=5184,
  FLIGHT_PORT=5189, DOLPHIN_PORT=5187. Game suite ports were hardcoded and
  are now env-parameterized — the first dolphin "baseline" was silently
  hitting ANOTHER checkout's 5197 server (same commit, so results held,
  but the hazard is fixed).
- LICENSE_NOTES.md does not exist as a file; the TinySkies permission text
  lives in ASSETS.md § "BodyArcade Flight — TinySkies/GlobeFly fork
  manifest" (private record gitignored). The V1 audit item is satisfied
  there — no new file invented.
- HUD preview: 2D-canvas x-ray wireframe, NOT a VRM. Games ship their own
  three versions (0.172 vs the app's 0.184); a VRM preview would bundle a
  second three + GL context into every game page — the exact GPU cost the
  budget forbids. "Cheap VRM or simpler" → simpler, in the frozen visual
  language, with degradation tiers built in.
- Producer election: traffic listen (BroadcastChannel + relay envelope) +
  Web Locks (`bodyarcade-pose-producer`). Games elect 'strict' (yield to
  an active producer); the Full App 'claim' (two app tabs each running a
  camera is pre-extraction behavior and stays). The bridge appends
  `?pp=companion` so a game opened FROM PosePuppet never opens a second
  camera even cross-origin.
- Full App consumes the composed runtime with an in-process onFrame tap
  (same trust domain — retargeting needs landmarks). Smoothing stays
  app-side because body-input takes PRE-smoothing landmarks; pipeline
  order preserved exactly (mirror → masker → PPC → {smooth→retarget,
  body-input}).
- Rowing keeps the FULL pose model in the game-owned runtime (lite
  wrist-depth collapse: 2/13 → 13/13 strokes, pass-2 measurement); flight
  and dolphin run lite.
- Game suites baseline on DISPLAY=:2 headed (xvfb software-GL fails their
  timing/feel specs); the root suite's two detect.spec failures under
  SwiftShader are pre-existing ENVIRONMENT_BLOCKED (they pass in the
  gpu-performance project — 2026-07-10 baseline log).
- pose-runtime is three-free; `bodyFrame.ts` (three-dependent, retarget
  support) moved to src/rig/ instead of the package.

## V3 — Walking Locomotion (2026-07-12)

- Gait = ONE detector over two substrate parameter banks (march =
  knee-lift difference in thigh lengths; sway = lateral hip-center
  excursion in shoulder widths, slow-EMA DC-removed like swim's extent
  reference), selected per frame by knee availability, with an extremum
  REBASE on substrate switch. Running both banks in parallel was
  rejected: real marching sways the hips at step frequency and a
  two-detector sum double-counts structurally; one signal cannot.
- Steps count at EVERY hysteresis-qualified reversal (each direction
  change of the L/R alternation = one footfall), unlike stroke's
  one-per-cycle finish. Cadence = 1000/stepIntervalEMA, so the slow-lean
  false-rhythm band (0.1–0.35 Hz) is excluded by maxStepMs = 1600 alone —
  the swim detector's lesson applied at design time instead of after a
  fixture surprise. Gait floors (march minAmp 0.22 thigh, sway 0.08 sw)
  passed every fixture negative on the first measured run (0 steps on
  lean_lr/lean_fb/crouch_stand/seated/still).
- Comfort is enforced at the MODEL OUTPUT, not by consumer discipline:
  hard caps on speed/accel/yaw-rate/yaw-accel, slew-limited eye height,
  and no pitch/roll/FOV/oscillation code path at all. `envelope()`
  self-reports observed maxima; an adversarial property test asserts no
  input sequence can exceed the caps. V4 inherits comfort by
  construction, not by review.
- Path assist yields to deliberate lean (|leanX| ≥ 0.22 silences it) —
  the Rowing coxswain lesson carried over; budget 14°/s, scaled to zero
  below 0.5 m/s so it can never rotate a standing user.
- Camera-unavailable = runtime state 'denied' OR 'error' for coach/HUD
  purposes (headless auto-deny surfaces as 'error' — the Dolphin suite's
  documented /denied|error/ tolerance).
- Graybox runs the LITE pose model (gait reads hips/knees in image/world
  space; no wrist-depth dependence — rowing's full-model lesson does not
  apply to walking).
- Shared-file edits kept to the established additive patterns: root
  tsconfig.json gains the locomotion paths/include entries (the same
  per-package pattern V1/V2 used; no existing keys touched); root
  playwright config untouched (new specs land in tests/ which it already
  globs); fixture-eval.mjs now respects PP_PORT (5173/5184 are squatted
  by other checkouts' persistent servers on this box — measured again
  this run; V3 evals pin PP_PORT=5185).
- Vision review round 1 caught the path ribbon rendered invisible (strip
  winding faced down → backface-culled). Fixed with DoubleSide + a
  bright center line; recaptured. The capture pass exists precisely to
  catch this class of defect.
- fixtures/ for eval runs copied from the wt-runtime worktree (private,
  gitignored, never committed) rather than re-recorded.

## V4 Open World

- 2026-07-12 — V4 lane: `apps/openworld` standalone vite app, base `/openworld/`, port 5176 (walking-app pattern: poseAssets middleware mirrors PosePuppet public/ for same-origin model/wasm). No root vite.config changes needed for O1–O9.
- 2026-07-12 — openworld tsconfig sets `noUnusedLocals/noUnusedParameters: false` (only): the reused TinySkies control modules compile under flight's own config and carry one unused const; every other strict flag stays on. The alternative (editing apps/flight) violates reuse law.
- 2026-07-12 — Fjord bathymetry is synthesized: the DEM carries no water depths at 66°N (open-water dive point read +44.5 m; 914/125584 cells below −0.5 m). WorldRuntime carves water cells to `seaLevel − (1.5 + 0.16·shoreSDF)` (capped 45 m, floored by real DEM depths where present) — the completed Dolphin's SDF-depth precedent, deterministic, computed once in the shared geographic authority so every profile/mode sees one seabed. Documented as a limitation, not hidden.
- 2026-07-12 — Coastal conditioning: same coarse DEM renders the ~3 m town spit as 20–40 m cliff-walled plateaus; land heights are clamped to `seaLevel + 3 + 0.45·shoreDist` and the shoreline lip gets a 3×3 mean within 3 cells of the shore. Mountains ≥1 km inland untouched.
- 2026-07-12 — Walk PathHint uses ONLY the largest nav.walk component (2262/2782 nodes; 74 components would strand the assist on spurs) and orients edge direction by the traveler's heading (modes feed `setHintHeading`) since graph edges have no canonical travel direction. Half-widths mapped per edge class.
- 2026-07-12 — Profile law: profiles receive WorldRuntime read-only + a scene; all geographic queries live in WorldRuntime/modes. Cross-profile consistency = `battery()` (49-point grid of ground/water/SDF/hint/nav queries + spawns/transitions) asserted identical under every profile.
