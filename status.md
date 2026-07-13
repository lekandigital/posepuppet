# STATUS — V1 Runtime + HUD (feat/pose-runtime-hud)

2026-07-12 · V1 COMPLETE — all four outcomes shipped, awaiting the
consolidated human pass (FINAL_USER_TEST_PLAN S1–S3, S11)

- O1 pose-runtime extracted; Full App behavior-identical (root suite at
  baseline parity; eval refresh: arms 9.82° vs 9.51°, torso 2.13° vs
  2.20°, fast 20.14° vs 19.89° at ~29.7 pose fps, 0 errors).
- O2 pose-hud shipped: x-ray preview, tiers, keyboard parity, privacy
  line, safe-area mounts. No settings panel, no redesign.
- O3 TinySkies / Rowing / Dolphin run body-controlled with NO PosePuppet
  tab (worker detection; rowing keeps FULL model @15 Hz; election yields
  to a companion producer). Game suites green on :2 (flight 37 specs,
  dolphin 16).
- O4 boundary/single-pipeline/camera-denied tests green everywhere; perf
  table in eval/runtime-hud-perf.json — flight/dolphin ~60 fps @ ~29 Hz;
  rowing ~41–43 fps @ ~13–14 Hz on the RTX/GL-ANGLE box (root-caused GPU
  contention; Apple Silicon validation = FUTP S3.2). Screenshot board +
  vision review in EVAL_NOTES; two visual defects found and fixed
  (privacy-line truncation, rowing board shot).
- Docs: README system-layer section, CHANGELOG, DECISIONS, package
  READMEs, FUTP front matter + S1–S3/S11 entries with evidence links.

# STATUS — V1 Runtime + HUD (feat/pose-runtime-hud)

2026-07-11 · O1 complete

- packages/pose-runtime extracted (detector, hand detector, PPC, mirror,
  smoothing, camera ownership, body-input emission, producer election,
  HUD preview state); Full App boots on it — pipeline order preserved.
- packages/pose-hud written (2D x-ray preview, tiers, keyboard access);
  game retrofits staged next (O2/O3 verification).
- Baselines recorded pre-change: root 105 pass / 2 SwiftShader
  ENVIRONMENT_BLOCKED (pass on GPU project), flight-on-:2 26 pass /
  1 driver console-error flake (offline.spec), dolphin 12 pass.
- Lane ports: PP 5184, flight 5189, dolphin 5187 (5174 squatted by an
  unrelated server — DECISIONS.md).
- Next: O2/O3 game suite runs on :2, permission flows, perf table, docs.

## 2026-07-07 (GATE 2 APPROVED — Predictive Pose Continuity accepted)
Gate: focused live retest passed all five items — slow hand exit predicted and returned smoothly; head stable through face crossings; behind-torso punch no longer whips or collapses; full dropout settles upright with no bend/spin; re-entries clean. Lekan: "the result now feels acceptable for Predictive Pose Continuity — I approve USER GATE 2"
WebM observation resolved: hands-free take gesture (both wrists overhead ~1 s) started a take; finished takes auto-download locally by design (pass-2 feature, not a PPC bug; nothing leaves the machine)
Final suites: re-run for the acceptance commit (results in the commit message)
Blockers: none — awaiting Lekan's merge decision (not merged/pushed per instruction)
Next: Lekan merges predictive-pose-continuity-fable when ready; then the combined Rowing → Dolphin → world-data → Walking World pass on a fresh branch

## 2026-07-07 (PPC Gate-2 fixes — rigid core + physics gate; GATE 2 RETEST RAISED)
Live failures root-caused on real footage: confident-visibility teleports/collapses behind the torso (state machine never fired), per-landmark core prediction shearing the torso quad into bend/spin
Fixed: rigid torso/head prediction, chain-length physics gate (impossible segment = garbage: held, low conf, never buffered), fresh-run velocity capture, no-snap capped catch-up with converged-only confidence
6 new regression specs cover his exact list; masked matrix + fully-visible refresh re-published (fast legs improved 1.4°, everything else within tolerance); flight contract +67 ms unchanged
Suites: PosePuppet 92 passed / 5 skipped; Flight in the commit message
Blockers: USER GATE 2 focused retest (5 items, docs/PPC_GATE2.md updated)
Next: Lekan's retest

## 2026-07-07 (PPC P4 — body-input flags, flight contract, docs — GATE 2 RAISED)
body-input `tracking` block (additive, optional, closed sub-shape, canonical order; old tapes valid); states flow PosePuppet → signal → games
Flight contract measured then test-enforced: autopilot engagement legacy 300 ms vs PPC 367 ms (+67 ms, bound +100); core horizon retuned 250→150 ms at MY layer, zero Flight changes; Flight suite 17 passed / 2 skipped unmodified
Final matrix re-published post-retune (facetouch −27%, arms −5.9%, reversals parity by design); README/CHANGELOG/docs/PPC.md name it Predictive Pose Continuity and state limits plainly
Suites: PosePuppet 86 passed / 5 skipped; Flight 17 passed / 2 skipped
Blockers: USER GATE 2 — live occlusion test (script: docs/PPC_GATE2.md)
Next: Lekan's live test; fix what he reports

## 2026-07-07 (PPC P3 — masked-fixture eval, legacy vs PPC published)
Mask harness (4 specs over real fixtures, loop-repeating, same-frame truth) + run-ppc.mjs → eval/ppc-results.json
End-to-end masked puppet sync: PPC ≤ legacy on all 4 fixtures; landmark posErr −19%/−6.5% where prediction informs, parity-in-noise on reversal footage (convergence-to-hold is the measured design goal there)
Guarantees: re-entry ≤ 0.06 m/frame, horizon ≤ 400 ms, 0 NaN; fully-visible deltas ≤ 0.09° upper (tol ±1.0°), floors intact; suite 83/5skip
Calibration journey logged in DECISIONS (velocity-trust stack, entry-pull, leg visTrust 0.25); docs/PPC.md written
Blockers: none
Next: P4 — body-input tracking flags (additive), flight autopilot-timing contract measurement, README note

## 2026-07-07 (PPC P2 — wired live, engineering chips)
PPC live at the main.ts fork (all five consumers inherit); ?ppc=0 / panel toggle for legacy A/B; per-limb state chips in engineering view; resets on mirror/file/camera switches
Honesty: overlay draws raw detection only; synthesized frames never count as detections in eval
Suite 82 passed / 5 skipped; same-conditions A/B (arms, 30s headed): upper Δ 0.02°, legs Δ 0.74° (within ±1.0°)
Blockers: none
Next: P3 — mask harness (eval/masks/*.json, ?mask=), legacy-vs-PPC metrics into a dedicated results file

## 2026-07-07 (PPC P1 — continuity core, GATE 1 APPROVED)
Gate 1 approved in-session (architecture, metrics, thresholds, plan — proceed)
src/pose/continuity.ts: ring buffers + regression velocity + 6 per-limb state machines + constraints + confidence decay + converging no-snap re-entry, all Gate-1 constants in one table
9 new node specs green; full suite 82 passed / 5 skipped (73 baseline intact)
Blockers: none
Next: P2 — wire into the main.ts fork behind ?ppc flag, engineering-view state chips, reset paths

## 2026-07-07 (PPC P0 — audit + plan, GATE 1 RAISED)
Predictive Pose Continuity P0 complete on `predictive-pose-continuity-fable`: occlusion path audited (no landmark-level continuity today; bone-space coast/relax in retarget.ts, body-input decays confidence separately, Flight autopilot contract at 0.35/350ms is consumed not touched)
Baselines confirmed as regression gates: PosePuppet 73 passed / 5 skipped; Flight 16+1 flake first run (superman-arms, passed isolated — the documented contention flake), clean full rerun 17 passed / 2 skipped
PLAN.md rewritten for PPC: insertion at the main.ts fork (both consumers inherit), VISIBLE→PREDICTED→RELAXED machine, all six numeric thresholds proposed, legacy-vs-PPC side-by-side, same-frame-truth mask harness design
Blockers: USER GATE 1 — plan + threshold approval before P1
Next: on approval, P1 buffers + state machine + constraints

## 2026-07-07 (GATE 3 APPROVED — BodyArcade Flight ACCEPTED COMPLETE)
Gate: focused retest passed on the restored Gate-2 baseline — banking/arm-drop/neutral/seated/autopilot/recenter all confirmed; head-pilot gentle climb + recenter visibility kept as approved improvements; Superman default standing, Head Pilot seated
All acceptance items closed: private permission retained (gitignored); in-app+README attribution; ASSETS manifest complete; offline single-player w/ byte-identical keyboard; body flight w/ 3 live-switchable profiles + tuner; shaping/autopilot/recenter/assist w/ measured dead zones; closed-loop evals green; replay 2.6e-6 world units documented; perf 111fps + pose 30Hz (2x target); both suites green; docs current (README/ARCHITECTURE/ASSETS/FUTURES/DEMO notes)
Final suites: re-running for the acceptance commit (results in the commit message)
Blockers: none — awaiting Lekan's merge decision (not merged/pushed per instruction)
Next: Lekan merges bodyarcade-flight-fable when ready; provenance one-liner to Danny before the repo goes public

## 2026-07-07 (Rowing P0 — plan raised)
BodyArcade Rowing P0 on `bodyarcade-rowing-fable` (renamed unused water-worlds placeholder at main 940d31c; Flight + PPC preserved, merged in main): boat/water seams studied — TinySkies boat is a complete tuned vehicle, body input already steers it, propulsion is the missing path
Gate-1 recommendations in PLAN.md: adapt the boat (not build), rowing inside apps/flight (no apps/rowing), stroke detection producer-side in body-input as schema-v1-additive `stroke` block; deviations logged (no rivers on globe → Waterway seam + open-water course; keyboard fallback = upstream boat keys)
Rowing fixtures missing — exact recording specs in PLAN.md (rowing_slow 12 strokes, rowing_fast 24, rowing_left_bias 15, rowing_seated 15, still reused)
Baselines: PosePuppet suite 92 passed / 5 skipped; Flight suite result in the Gate-1 commit message
Blockers: USER GATE 1 — build-vs-adapt + plan approval + fixture recording
Next: on approval + fixtures, P1 stroke detection in the package

## 2026-07-09 (Rowing P1 — stroke detection green)
StrokeDetector in @bodyarcade/body-input: fore-aft wrist oscillation, position-Schmitt reversals, catch/drive/recovery; always-emitted additive `stroke` block (v1): active/count/rate/phase/ampL/ampR, user-side arms (mirrored-slot swap caught by the left-bias fixture)
Fixture eval ALL GREEN, all 10 fixtures: slow 12/12, fast 24/24, left_bias 16/15 + bias sign +0.127, seated 13/13 measured, still 0 strokes; rate ordering fast 0.846 Hz > slow 0.404 Hz; latency p50 ~12 ms
Harness fix, not detector: clips start/end mid-motion so the y4m loop seam ate/faked strokes — rowing eval now runs one non-looped ?video= pass
Flag for Gate 2: rowing_seated prescribed 15, measured 13 (real 2.5 s mid-take pause + mid-stroke start, wrist trace + frame review agree) — confirm the label; seated flag itself reads 0% (thighs cropped), stroke detection unaffected
Blockers: none — P2 (boat impulse-glide) next
Next: RowingControls in apps/flight, boat impulse hook, both steering profiles, assists/cruise/autopilot, ?row entry, tuner stroke row

## 2026-07-09 (Rowing P2 — boat feel built, Gate 2 pending)
Impulse-and-glide shipped: strokes bank a surge budget (attack ~0.3 s — the boat visibly lunges per pull), water drag proportional to speed (τ≈5.5 s; each cadence settles at its own speed, stillness = exponential drift), keyboard boat feel byte-identical
RowingControls (standalone; flight controller untouched): stroke→impulse, two steering profiles as data (row-lean, row-asym — pick at Gate 2), assist ladder (Full Assist = soft Waterway course-follow), cruise after 6 steady strokes (rest holds momentum), autopilot on loss (drift straight + slow, slew-bounded re-entry), keyboard priority
Waterway seam: procedural open-water course from spawn (polyline of ocean waypoints steered around coasts); interface ready for real waterway data later
Entry: ?row starts straight on the water; PosePuppet Row card + ⌘K "row"; tuner gained a rowing section (profiles/assist/stroke readout)
row.spec.ts 7/7 green: surge+glide, cruise, both steering signs, autopilot no-snap recovery, keyboard wins, rowing_slow.y4m fixture relay closed loop, 2-min Full-Assist run — on-water 100%, in-band 100%, speed↔rate r=0.798 (settled samples; eval/flight-results.json)
Blockers: USER GATE 2 — live row (both profiles, seated, 2-minute run; judge rhythm/connection/fatigue); also confirm rowing_seated label (13 measured vs 15 prescribed)
Next: Gate-2 feedback → iterate feel; then P3 polish (coach messages, README, FUTURES seam notes)

## 2026-07-11 (Dolphin P0 — plan raised)
BodyArcade Dolphin P0 on `bodyarcade-dolphin-fable` in the dedicated `~/Dev/posepuppet-dolphin` checkout (Rowing continues in parallel in `~/Dev/posepuppet`, untouched): seams studied — StrokeDetector was built for the dolphin kick (its header says so), schema has the proven additive-block mechanism, existing axes cover pitch/roll/depth/burst/recenter, same-origin static-plugin topology generalizes to `/dolphin/`
Gate-1 recommendations in PLAN.md: standalone `apps/dolphin` (deviation from FUTURES.md fourth-vehicle sketch, logged), `packages/world-data` offline boundary module; two OSM-verified candidates — Bay of Kotor rel 10171079 (recommended) vs San Francisco Bay rel 9451753, both ODbL with in-app attribution
Dolphin fixtures missing — exact recording specs in PLAN.md (torso_wave_slow 12 waves, torso_wave_fast 24, dive_surface_leans 6/6, roll_turns 6/6, seated_swim 12+leans, breach_attempts 3; flight fixtures reused for still/T-pose/crouch/leans)
Baseline: ENVIRONMENT_BLOCKED at P0 (fresh checkout, no private fixtures; npm ci + tsc --noEmit green instead); full suites re-baselined at P1 entry after fixture sync
Blockers: USER GATE 1 — water-shape pick + plan approval + fixture recording
Next: on approval + fixtures, P1 boundary module (fetch → simplify → boundary.json + minimap + attribution)

## 2026-07-11 (Dolphin P1 — boundary module green)
Gate 1 resolved: Lekan picked San Francisco Bay (preserve outline, Golden Gate opening, major islands, channels) and approved the plan, P1-only scope
`packages/world-data` shipped: offline fetch → assemble → simplify → project → `data/boundaries/san-francisco-bay.json` (provenance + ODbL attribution inside; `loadBoundary` refuses artifacts without it); runtime surface `pointInWater`/`signedDistanceToShore` for the containment current and SDF depth
Key build finding: OSM's curated bay relation excludes Golden Gate + Raccoon Strait (probes failed on raw) — built `coastline-clip` mode (coastline ways ∩ convex region with two named gates) which restores every channel and island; relation mode kept for enclosed shapes like Kotor
Numbers (eval/worlddata-results.json, 31 checks ALL GREEN): 20,908 → 1,583 verts (outer 1,211, 21 islands), area delta −0.0394 %, channels Golden Gate 489 m / Raccoon 388 m / Oakland estuary 237 m at keep-ratio ≈ 1.0, byte-identical rebuilds; minimap vision check unmistakably SF Bay (raw ≈ simplified at 1024 px)
Blockers: none for P1; fixtures (specs in PLAN.md) still pending for P2
Next: on go-ahead — P2 graybox swim (torso-wave detector, apps/dolphin scaffold, containment current, assists) toward live Gate 2
## 2026-07-11 (Rowing Gate-2 fixes — remote, retest pending)
Live Gate-2 failures fixed on bodyarcade-rowing-fable-rebuilt: lean over-rotation (expo 1.6 profile + speed-coupled yaw — the boat carves, never pivots; at-rest full deflection < 45°/4 s vs ~230° before), idle turning (assist corrections scale with way, vanish at rest), land collisions (ShoreGuard: lookahead escape steering with held side, full helm takeover at hull contact, time-to-land approach drag from a fixed 0.9 wu probe, proportional surge feathering near walls)
THE TWISTER: the live "360° spin in place" was largely the game's water-spout mechanic (forces turnRate 7.0 + brake on collision) — kept for live play, explained in the retest notes; ?calm eval hook disables spouts + diamond speed spikes for measurements
Deterministic eval environment: ?seed/?spawn/?calm/?noguard hooks; specs pin seed=31415&spawn=137 (first scanned start with 1.2 wu all-around clearance); course generator routes through open water (lookahead-scored, channel-width, smoothed)
Sliver trap found by the adversarial spec (2/3 failure) and killed: land capes thinner than probe spacing blocked the hull while probes read clear — contact latch in ShoreGuard (beam-probe side pick, 2.5 s hold, displacement release); adversarial recovery NEVER→1–3 s, endurance corridor 0.80→0.98
row.spec.ts 10/10: carving (yaw<50°/s under way, <45° at rest), idle settles <3°/s, shore attack-release cycles (soft entry <0.35, recovery ≤12 s, never beached), cruise, autopilot, keyboard, both steering signs, fixture relay, 2-min endurance (on-water 100%, along-progress 47–53 wu, stalls 6%) + cadence coupling on constant water: p75 ≈0.162/0.197/0.241 at 0.3/0.5/0.7 Hz, r=0.998–0.999 (eval/flight-results.json)
Root-suite detect specs ENVIRONMENT_BLOCKED on the rebuilt remote (headless software GL ~3 pose fps); both pass on the opt-in NVIDIA gpu-performance tier in 18.7 s; final perf on Apple Silicon
Blockers: none remote — validation chain green (row 10/10 twice, flight 24+offline-flake-passes-isolated, root 98+2 ENVIRONMENT_BLOCKED, GPU tier 2/2); committed; awaiting Mac retest (one test at a time per Lekan's instruction)
Next: lean-steering retest first; then stroke-asym steering, seated 2-min, autopilot, recenter, keyboard timing, Chrome/Safari passes; rowing_seated label 13 stands

## 2026-07-11 (Rowing Gate-2 round 2 — remote, consolidated final test pending)
Live round-2: seated propulsion + lean steering FAIL, rest PASS. Both reproduced remotely and fixed: (1) Row now keeps the FULL pose model — the lite companion-mode model's wrist depth collapses near the frame edge (cycle amp 0.112 < 0.15 bar → 2/13 strokes on the chest-up seated crop; 13/13 under full); knees-visible was a distance proxy, the package never needed legs (new synthetic spec proves it). (2) Deliberate-steering intent (input-axis based) silences course-follow + corner brake so gentle leans carve their own way both directions; autopilot line-holding returns hands-off; shore guard un-scaled. New spec fails pre-fix, passes post-fix.
RowingHUD ships: stroke pulse (sized by pull), cadence spm, steering marker, status + guidance line — tracking vs control failure visible at a glance.
Regression coverage: rowing_seated_upper eval fixture (13±1, both models pass), legs/hips-invisible package spec, coxswain-yield row spec, fixture-eval --model=lite flag.
FINAL_USER_TEST_PLAN.md created (Rowing section: seated upper-body row, 2-min fatigue, lean symmetry, indicators, shore, loss/recenter/keyboard, Chrome+Safari) — one consolidated live session, no more mid-dev retests.
Harness hardening from the validation runs: prepare-fixtures now caps the SHORT side (portrait clips were shrunk to 406×720 and measurably degraded detection), the closed-loop spec prefers the native-resolution cache, always closes its browser (failure leaked it and starved later repeats), and classifies starved-producer runs (<10 pose fps under x-bot bursts) as ENVIRONMENT_BLOCKED skips — thresholds untouched, healthy runs measure p75 0.135+.
Next: final consolidated user test per FINAL_USER_TEST_PLAN.md.

## 2026-07-11 (Dolphin P2+P3 — swim feel + PS2 world, suites in flight)
Rowing c8cdafaf merged non-destructively (backup ref, fetch from sibling checkout, --no-ff; doc conflicts kept both sides; Rowing worktree untouched); PP_PORT test-infra parameterization added after discovering the sibling checkout's persistent 5173 server was being reused as the producer — dolphin-branch runs pin PP_PORT=5273 --strictPort
Swim block shipped in @bodyarcade/body-input: chest–hip extent (image space, slow-EMA self-normalized) through the reused StrokeDetector → additive `swim` block; 32/32 body-input tests green incl. 7 new synthetic swim tests; false-positive rows added to fixture-eval for every existing clip (positive torso-wave fixtures = USER ACTION, FINAL_USER_TEST_PLAN.md)
apps/dolphin shipped: pure 120 Hz RNG-free sim (impulse-and-glide, τ 6 s glide), SDF containment current + slide guard, breach state machine, assists/autopilot/recenter/keyboard, chase cam, procedural low-poly dolphin with kick-driven undulation, PS2 world (depth-tinted fog, vertex-lit seabed from the real SDF, shimmer-curtain boundary, boid fish that flee, vertex-shader kelp, ruins + arch, caustic shafts, motes), minimap = the real bay polygon with the ODbL credit; Swim card + ⌘K entry with lite-model companion mode; /dolphin/ served same-origin
Suites: dolphin Playwright suite on NVIDIA :2 (results in commit message + eval/dolphin-results.json); flight suite measured unable to boot the game under Xvfb/SwiftShader (every spec timed out at the flying wait) — game suites run on :2, root suite stays SwiftShader per the two-tier design
Blockers: none for the automated pass; live swim judgment + torso-wave fixtures are the FINAL_USER_TEST_PLAN.md items
Next: fixture-eval swim negatives, flight+root suites on this tree, P4 docs/perf/ship

## 2026-07-11 (Dolphin P4 — ship: docs, verification matrix, remote pass complete)
All feasible remote checks done; the human-only items are consolidated in FINAL_USER_TEST_PLAN.md § Dolphin (live swim feel/fatigue/breach + torso-wave fixture recordings + Apple Silicon perf)
Verification matrix: body-input 32/32 (7 new swim tests); FULL fixture-eval ALL GREEN (swim negative rows on every clip; three-round measured tuning incl. geometric tilt correction; lean_fb bound = measured variance ceiling ≤2, amps recorded); dolphin suite 12/12 on NVIDIA :2 (cadence coupling 7.7→15.7 m/s, containment battery min shore +18.8 m / zero decel discontinuity, breach + negative, dropout no-snap 0.089 rad, replay byte-identical, topology over pure BroadcastChannel, 60 fps @ 120 Hz sim with floor asserted); flight suite 26 passed + offline.spec green on its SwiftShader tier (NVIDIA console shader-validation quirk documented, thresholds untouched); root suite 106 passed with detect fps floor ENVIRONMENT_BLOCKED on SwiftShader under ambient tenant load — same spec 2/2 green on the NVIDIA tier (preflight recorded: RTX 3090 Ti, permitted)
Perf: Dolphin 60 fps render (vsync) / 120 Hz sim on the remote GPU; Flight’s accepted 111 fps Apple Silicon baseline untouched; final Dolphin feel/perf on Apple Silicon is the live-gate item per the cross-platform policy
Docs shipped: README + CHANGELOG + ARCHITECTURE + FUTURES (pipeline water seam + obstacle-avoidance review note) + ASSETS (all-procedural) + apps/dolphin/README + FINAL_USER_TEST_PLAN § Dolphin
Blockers: only the consolidated live session (not requested now, per instruction)
Next: Lekan’s live swim per FINAL_USER_TEST_PLAN.md; branch not merged, not pushed

## 2026-07-11 (V2 world-data — pipeline shipped, two regions baked, all checks green)
tools/worldbake + bodyarcade-world/1 schema shipped: terrain, water (sea via the absorbed Dolphin boundary builder + lakes), waterways, roads/paths, buildings, landuse, boundaries, aeroways, collision meshes, walk+row nav graphs, minimap, data-derived spawns + mode transitions; offline-first with committed sha256-checksummed caches
Ísafjörður baked as the working default (REGION_CANDIDATES.md: 3 candidates scored on live Overpass counts; terrain variance decided it); Friday Harbor baked second purely from the README as the doc proof; region swap stays a cheap re-bake until V4 realistic art (deadline recorded in FINAL_USER_TEST_PLAN front matter)
Verification: 69 golden-file checks green (byte-identical re-bakes, schema round-trip, attribution refusal, geometry sanity, nav reachability, collision area parity) in eval/worldbake-results.json; boundary suite 31 green; SF Bay artifact byte-identical; standalone dolphin builds; tsc green
Blockers: none
Next: V4 consumes data/worlds/isafjordur/world.json read-only; optional region override open until V4 realistic art pass

## 2026-07-12 (V3 Walking Locomotion — package + graybox complete, remote pass green)
Gait shipped in @bodyarcade/body-input 1.1.0 (additive `gait` block): knee-lift-difference marching + lateral-hip-sway weight-shift substrates through ONE reversal detector with substrate rebase; step events, cadence Hz, weight-shift axis; 9 new gait specs green; existing body-input suite green with the block on the wire; fixture-eval gains gait false-positive rows on every clip (0 steps everywhere, first measured run) + PP_PORT parameterization (5173/5184 squatted).
packages/locomotion shipped: pure deterministic model with comfort enforced at the output (speed 2.4 / accel 2.5–3.5 / yaw 45°/s / yaw-accel 180°/s² caps, slewed eye height, no bob/tilt/FOV code path, envelope() evidence), cadence→speed, lean→turn, crouch duck, seated lean-glide, keyboard-wins, loss autopilot with snap-free re-entry, T-pose recenter pulse, nav-graph PathHint assist (Full default, lean-yield); controller on the proven transport discipline; shared coach/status strings; INTEGRATION.md = the V4 contract.
apps/walking graybox proven: closed-loop synthetic drives through the REAL chain (landmarks→gait→signal→controller→model→camera) — 9/9 specs (path-follow, dropout gentle-stop/recover, sway, glide, T-pose toast, keyboard-wins, vignette bounds, camera-denied keyboard play, live boot on fake webcam); eval/walking-results.json all-pass (march×3 step/cadence/speed tracking, sway, glide, dropout stop≤2.5 s @ ≤1.3 m/s² heading drift <5°, adversarial 30 s comfort maxima under caps); media/walking-v3 board + webm, vision review caught + fixed an invisible (backface-culled) path ribbon.
Blockers: none automated; S8 human items written (comfort/nausea, weight-shift+seated feel, live loss/recenter/keyboard) + optional gait clip specs (S8.4).
Next: V4 integrates packages/locomotion into the Open World low-poly profile per INTEGRATION.md; branch not merged, not pushed.

## V4 Open World — 2026-07-12
- O1 Foundation complete: WorldRuntime + profile system + low-poly v1 render of Ísafjörður on port 5176; Runtime+HUD mounted; ASSET_CONTRACT.md written.
- Bathymetry/coastal DEM gaps found by vision review and fixed in the shared geographic authority (DECISIONS.md V4).
- Suite: openworld 3/3 green headless; tsc clean.
- Next: O2 low-poly flight (reused TinySkies control modules + placeholder plane).

## V4 Open World — 2026-07-12 (later)
- O2–O7 complete: four modes body-controlled in low-poly (reused controls, zero rebuilds), transitions live, dolphin standalone stays green.
- Suite 23/23; perf 60 fps locked on :2 across all modes; S7.1–S7.6 written.
- Next: O8 realistic profile.

## V4 Open World — 2026-07-12 (ship)
- O1–O9 complete in order. 23/23 openworld; dolphin standalone 12P/4S; root suite 134P/2F/5S — the 2 are the recorded SwiftShader-only baseline failures; TinySkies untouched (zero diffs).
- One shared foundation proven: consistency battery byte-identical across low-poly/realistic/fantasy.
- 60 fps locked on :2 in every profile/mode. S7/S9/S10 human passes filed with evidence.
- Tree clean at HEAD; branch feat/openworld unmerged, awaiting Lekan.
