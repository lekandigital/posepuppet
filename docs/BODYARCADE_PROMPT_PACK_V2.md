# BODYARCADE PROMPT PACK v2

Rewritten against the current project state. Source of truth: **completed** = Body-Input Protocol, Flight/TinySkies Track F, Predictive Pose Continuity, Rowing, standalone PS2 Dolphin. v1 pack audited (14 prompts); this pack replaces it entirely. No implementation here — prompts only.

## 12→ Major changes from v1 (concise)

1. **Five prompts retired as completed** (old P1, P2, P3, P5, P9). Remaining prompts audit-then-reuse them; nothing gets rebuilt without a concrete found gap.
2. **Android TV removed entirely** (accidental inclusion). **AutoRig removed as a product** — replaced by a small, manually reviewable capability manifest inside Character Control; no rig repair, no universal FBX mapping, no FBX→VRM, no cloud conversion. **Product Surface/Site removed** — your custom design happens separately; all prompts preserve the current visual language and never block function on design.
3. **User gates abolished.** Every prompt runs autonomously end-to-end: automated evidence (tests, screenshots, recordings, vision self-review) replaces live checkpoints; human-only checks accumulate in one shared `FINAL_USER_TEST_PLAN.md` for a single consolidated pass at the end. Agents stop only for: licensing issues, missing required private assets, destructive/irreversible actions, or an irreducible product decision.
4. **PosePuppet splits into three layers** (new prompt V1): a headless **Runtime** (camera, tracking, calibration, PPC, derived signals) any game initializes directly; a compact shared **HUD** overlay (bottom-left, collapsible, lightweight preview) mounted by every game like a console system overlay; and the existing **Full App**, unchanged as the creative instrument. Games no longer need PosePuppet open in another tab.
5. **The real-world direction becomes one Open World on one shared geographic foundation** (new prompt V4): a single compact baked region, three renderer/content **profiles** over identical data — `low-poly` first (flight, walking, rowing, and the adapted PS2 Dolphin), then `realistic` (no dolphin), then `fantasy-game` last under the Whimsical Diorama Fantasy direction. TinySkies stays intact as its own whimsical globe experience — the redundancy with real-world flight is intentional.
6. **Walking is restructured** into a locomotion package proven in a graybox, then integrated into the Open World's low-poly profile — no throwaway storybook town.
7. **Prompts are shorter and outcome-driven**: ownership/dependency/isolation declared per prompt; parallel lanes, worktrees, branches, tmux sessions, ports, Playwright and display `:2` needs specified; shared-resource serialization made explicit.

## 1→ Status table

| Old | Prompt | Status in v2 |
|---|---|---|
| P1 | Flight / TinySkies Track F | ✅ Completed — preserved as-is; gains HUD via V1 |
| P2 | Body-Input Protocol | ✅ Completed — extended (not rewritten) by V1/V3 |
| P3 | Rowing | ✅ Completed — reused by Open World; gains HUD |
| P5 | Dolphin (standalone PS2) | ✅ Completed — adapted into Open World low-poly water mode; standalone preserved |
| P9 | Predictive Pose Continuity | ✅ Completed — lives in Runtime after V1 extraction |
| P13 | Android TV Settings | 🗑 Removed (unrelated) |
| P7 | AutoRig Lab | 🗑 Removed as standalone → minimum folded into **V5 Character Control** (capability manifest) |
| P11 | Product Surface / Site | 🗑 Removed (your own design, separately) |
| P8 | Character Control | 🔄 Remaining → **V5** (revised; manifest-based, no AutoRig dep) |
| P10 | Motion Memory 2 | 🔄 Remaining → **V6** (revised, autonomous) |
| P12 | Recording v2 | 🔄 Remaining → **V7** (revised; MM2 dependency clarified) |
| P6 | Open-Data Pipeline | 🔄 Remaining → **V2** (revised; three profiles, shared foundation) |
| P4 | Walking World | 🔄 Remaining → **V3** (revised; locomotion package + Open World integration) |
| P14 | Public Narrative | 🔄 Remaining → **V8** (revised; runs last, evidence-based) |
| — | Shared PosePuppet Runtime + HUD | ➕ New → **V1** |
| — | BodyArcade Open World (compact region, 3 profiles) | ➕ New → **V4** |

## 2→ Dependency graph and recommended execution order

```
COMPLETED: body-input ── PPC ── Flight ── Rowing ── Dolphin(PS2)
                │
   ┌────────────┴───────────────┐
   V1 Runtime + HUD          V2 Pipeline v2
   (owns tracking/body-      (owns world-data;
    input packages)           independent)
   │        │      │                │ first bake
   │        │      └── HUD retrofit │
   │        │          into TinySkies/Rowing/Dolphin
   │   ┌────┴─────┬─────────────┐   │
   │   V3 Walking V5 Character  V6 Motion
   │   locomotion Control       Memory 2
   │   (body-input (pose-runtime (app modules)
   │    gait axes)  hand fusion)     │
   │        │           │            ▼
   └──►  V4 OPEN WORLD ◄┴─(labels) V7 Recording v2
         (consumes V1, V2 bake,     (replay insertion
          V3 locomotion; internal    after V6 stable;
          order: low-poly F→W→R→    segmentation part
          dolphin→transitions→       parallel)
          verify→realistic→verify→
          FANTASY LAST)
                    │
                    ▼
              V8 Public Narrative (last)
```

**Waves** (≤3 simultaneous agents; genuinely isolated only):
- **Wave 1:** V1 (Runtime+HUD) ∥ V2 (Pipeline). Nothing else touches tracking/body-input while V1 owns them.
- **Wave 2** (after V1 merges): V3 stage A (gait + graybox) ∥ V5 (Character Control) ∥ V6 (Motion Memory 2). V4 may scaffold `apps/openworld` graybox against V2's schema in this wave (read-only consumption; ◐).
- **Wave 3:** V4 (Open World, long-running: low-poly flight → walking integration [needs V3 delivered] → rowing → dolphin adapt → transitions → consolidated low-poly verification) ∥ V7 segmentation sub-track (after V6's schema stabilizes; final recording integration serialized).
- **Wave 4:** V4 realistic profile → consolidated verification → fantasy-game profile (strictly last, internal to V4).
- **Wave 5:** V8 Narrative.

## 3→ Parallel-development matrix

Pairs not listed are safely parallel (disjoint files, no shared runtime).

| Pair | Verdict | Constraint |
|---|---|---|
| V1 ∥ V2 | ✅ parallel | Disjoint packages entirely. |
| V1 ∥ V3/V5 | ⛔ sequential | V3 edits `body-input`, V5 edits `pose-runtime` — both are V1's extraction targets. Start after V1 merges. |
| V1 ∥ V6 | ◐ partial | V6 is app-module work, but V1 refactors the app's boot/camera lifecycle. V6 must not touch shell/boot files; rebase on V1 before merge. |
| V3 ∥ V5 | ◐ partial | Different packages (`body-input` vs `pose-runtime`). Any change to the runtime↔body-input interface is single-owner: V1's merged interface is frozen; proposals go through a shared RFC note, applied by one agent. |
| V5 ∥ V6 | ◐ partial | Both in `apps/posepuppet`, different modules. Each declares a file-ownership list in its PLAN; shell/routing files belong to V5 if touched at all; rebase before merge. |
| V6 → V7 | ⛔ sequential (core) / ◐ (segmentation) | V7's replay/loop-insertion waits for V6's loop schema to stabilize. V7's segmentation pipeline may start parallel if its file list is disjoint from V6's. |
| V2 ∥ V4 | ◐ partial | V4 may scaffold against the emitted schema (read-only). V4's real milestones start after V2's first pilot bake. Only V2 edits `packages/world-data`. |
| V3 → V4 | ⛔ handoff | V3 delivers `packages/locomotion` + integration notes; V4's agent performs the integration inside `apps/openworld` (single owner). |
| V4 internal | ⛔ serialized | Low-poly modes → transitions → verification → realistic → verification → fantasy. One agent owns `apps/openworld`. |
| anything ∥ V8 | ⛔ | Narrative mines finished artifacts. |

**Serialized shared resources (lock or single-owner):**
- `packages/body-input`, `packages/pose-runtime` (post-V1: tracking lives here): one owning prompt at a time; interface changes by RFC.
- `apps/posepuppet` shell/boot/camera lifecycle: V1 during wave 1; V5 thereafter.
- Recording infrastructure (`apps/posepuppet` recorder + compositor): V7 only.
- World runtime (`apps/openworld`): V4 only. World data (`packages/world-data`): V2 only.
- Test configuration (root Playwright config, CI scripts): single-owner per wave; others add specs in their own directories only.
- **Full-suite runs:** serialize via `flock /tmp/bodyarcade-fullsuite.lock`.
- **Display `:2` (headed GPU/browser validation):** one session at a time via `flock /tmp/bodyarcade-display2.lock`; headless/SwiftShader correctness runs are lock-free but never count as performance numbers.

## 10→ Worktree / branch / tmux / port / Playwright / display plan

Base repo stays clean on `main`; each prompt runs in its own worktree.

| Prompt | Worktree | Branch | tmux | Dev port | Playwright | Display `:2` |
|---|---|---|---|---|---|---|
| V1 Runtime+HUD | `../wt-runtime` | `feat/pose-runtime-hud` | `ba-runtime` | 5174 | yes | yes (HUD visuals) |
| V2 Pipeline v2 | `../wt-worlddata` | `feat/world-data-v2` | `ba-worlddata` | 5180 (viewer, optional) | no (golden files) | no |
| V3 Walking | `../wt-walking` | `feat/walking-locomotion` | `ba-walking` | 5175 | yes | yes (graybox recordings) |
| V4 Open World | `../wt-openworld` | `feat/openworld` | `ba-openworld` | 5176 | yes | yes (heavy; primary lock user) |
| V5 Character Control | `../wt-charcontrol` | `feat/character-control` | `ba-char` | 5177 | yes | yes |
| V6 Motion Memory 2 | `../wt-motionmem` | `feat/motion-memory-2` | `ba-mm2` | 5178 | yes | light |
| V7 Recording v2 | `../wt-recording` | `feat/recording-v2` | `ba-rec` | 5179 | yes | yes |
| V8 Narrative | `../wt-narrative` | `docs/narrative` | `ba-story` | — | no | no |

Conventions (also in Context v2): existing PosePuppet dev stays on 5173; agents never reuse another lane's port; headed runs `DISPLAY=:2` under the display lock; merges to `main` only with the full suite green under the full-suite lock; each agent's PLAN declares its file-ownership list up front.

## 13→ Up-front assets & decisions you'll eventually provide (nothing blocks; placeholders proceed)

1. **Plane asset(s)** — GLB per the asset contract V4 emits in its first milestone (scale in meters, +Y up, −Z forward, pivot at center of gravity, named nodes for propeller/control surfaces if animated, poly/texture budgets, license metadata + attribution). Placeholder plane flies until then.
2. **Licenses** for any user-supplied models (planes, future roster characters) — entered into ASSETS.md before anything ships publicly.
3. **Optional private fixtures** — gait clips for Walking (`march_slow`, `march_fast`, `weight_shift`, `walk_lean_turns`); a `fingers_curl_point` clip for Character Control if the existing hand clips prove insufficient. Synthetic streams + existing fixtures carry automated validation meanwhile; real-clip validation lands in FINAL_USER_TEST_PLAN.
4. **Region override (optional)** — see §14; a default gets baked without you; your override window stays open until V4's realistic art pass begins.
5. **Fantasy mood references (optional)** — non-franchise images/clips for Whimsical Diorama calibration; the written direction suffices without them.
6. **Confirmation** that on-screen OSM/ODbL attribution is acceptable in all real-world profiles (required by license; assumed yes).
7. **Verify once** that the TinySkies permission text is recorded in LICENSE_NOTES.md (completed pass should have it; V1's audit re-checks).

## 14→ Compact real-world region selection strategy

One excellent compact location beats a large empty world. Criteria: **(a)** a bay, harbor, lake, or river reach (rowing + the dolphin boundary), **(b)** a walkable settlement with real street/path structure, **(c)** terrain variance (hills/cliffs read beautifully in all three profiles), **(d)** an airstrip, field, or clear flat area (flight transitions), **(e)** strong OSM completeness (buildings, paths, water polygons), **(f)** ~2–4 km² core. Archetypes that fit: a small European harbor town, a New England coastal town, a river town with bridges.

Process: V2's agent shortlists **three** candidates scored against (a)–(f) with OSM-completeness heuristics, documents them in `REGION_CANDIDATES.md`, bakes the top score as the working default, and keeps baking cheap. **This is not an irreversible choice** — swapping regions is a re-bake until V4's realistic art pass begins hand-tuning to the location; that milestone is the decision deadline, recorded in FINAL_USER_TEST_PLAN's front matter. Name a personally meaningful place any time before then and it becomes the region.

## 11→ `FINAL_USER_TEST_PLAN.md` structure (shared; every prompt appends)

```markdown
# FINAL USER TEST PLAN — one consolidated human pass
## Front matter
- Environment prep (branch/merge state, hardware, camera, lighting, ports)
- Region decision deadline status (§14)
- Estimated total time; recommended order (below)
- Evidence index: links to eval/results.json, screenshot boards,
  recordings, per-prompt EVAL_NOTES
## Entry format (every deferred check uses this)
ID | Feature | Why human-only | Setup | Steps | Expected | Automated
evidence already collected | Risk if skipped | Est. minutes
## Sections (recommended order)
S1  PosePuppet full app regression feel (post-runtime-extraction)
S2  Runtime + HUD across TinySkies / Rowing / standalone Dolphin
    (expand/collapse, keyboard access, camera-denied keyboard play)
S3  TinySkies flight feel re-check (nothing regressed)
S4  Character Control live: fingers on capable avatar, all seven
    face-touch targets, feet planting, capability labels truthful
S5  Motion Memory 2 creative session (trim, mirror, chorus, re-skin)
S6  Recording v2 takes: one per presentation mode; cutout-on-stage
S7  Open World low-poly: flight, walking, rowing, dolphin, transitions
S8  Walking comfort test (explicit nausea check — human-only by nature)
S9  Realistic profile: flight/walk/row, lighting/atmosphere judgment
S10 Fantasy profile: the one-second-clip charm test per mode
S11 Privacy: network-zero receipt, local-inference messaging, HUD
    privacy state accuracy
```

---
## Global Context v2 — replace `BODYARCADE_CONTEXT.md` with this

```text
BODYARCADE — GLOBAL CONTEXT v2 (read before any prompt)

STATE: COMPLETED and working — body-input protocol, Predictive Pose
Continuity, TinySkies Flight (Track F, permission recorded), Rowing,
standalone PS2 Dolphin, plus PosePuppet's full creative app and its
fixture/fake-webcam/eval rig. Audit-then-reuse: never rebuild a completed
system; if an audit finds a concrete gap, fix minimally and log it.

PRODUCT SHAPE: TinySkies stays its own whimsical globe-flight experience.
New real-world experiences are ONE Open World: one compact baked region,
three renderer/content profiles (low-poly, realistic, fantasy-game) over
the SAME geographic data. Dolphin exists only in the low-poly/PS2
profile. PosePuppet splits into Runtime (headless tracking), HUD (shared
overlay), and the Full App (creative instrument, unchanged in role).

AUTONOMY POLICY (replaces all user gates): implement end-to-end without
asking me to test. Verify yourself: unit, integration, fixture, replay,
Playwright fake-webcam, performance, screenshot boards, and vision
self-review of your own recordings. Record every human-only check as a
structured entry in the shared FINAL_USER_TEST_PLAN.md (format defined
there) with links to the automated evidence you already collected. Stop
ONLY for: (1) a genuine licensing issue, (2) a missing required private
asset with no placeholder path, (3) a destructive/irreversible action,
(4) an irreducible product decision that cannot safely be assumed.
Otherwise: make the best-effort assumption, one line in DECISIONS.md,
keep moving. Missing fixtures never block: use synthetic streams,
existing fixtures, or placeholders, and defer real-media validation to
the final plan.

ISOLATION: work in your assigned worktree/branch/tmux/port (table in the
pack). Own only your declared files/packages; interface changes to
shared packages go through a one-page RFC applied by a single owner.
Locks: flock /tmp/bodyarcade-display2.lock for headed DISPLAY=:2 GPU
runs; flock /tmp/bodyarcade-fullsuite.lock for full-suite runs and
merges. Headless correctness runs anytime; performance numbers only from
headed runs on :2.

STANDING RULES: local/private — no backend, analytics, telemetry, or
uploads; raw landmarks never cross the tracking boundary (derived
signals only). Keyboard fallback wherever a body control exists, and
keyboard MUST work when camera permission is denied. Licensing: every
asset in ASSETS.md; OSM/ODbL attribution on-screen in real-world
profiles; TinySkies credit preserved. Truthfulness: every claimed number
traces to eval/results.json or logs. VISUAL DESIGN IS FROZEN: preserve
the current PosePuppet visual language; minimal feature-specific UI only
where usability/accessibility/diagnostics require it; a custom design
pass happens separately and later — never block function on visuals.
Performance floors from completed passes hold unless a prompt states new
ones. Conventions: conventional commits, DECISIONS.md, STATUS.md every
~2h, EVAL_NOTES.md per milestone. fixtures/ stays gitignored.
```

---

## V1 — Shared PosePuppet Runtime + HUD (new)

*Wave 1. Exclusive owner of tracking/body-input packages while active.*

```text
TITLE: PosePuppet as a system layer — headless Runtime + shared HUD.

GOAL: Split PosePuppet so games get body control without the full app
open. (1) packages/pose-runtime: camera access + lifecycle, pose/hand
tracking, calibration, Predictive Pose Continuity, derived signals,
body-input emission, privacy/tracking state — initializable directly by
any game page. (2) packages/pose-hud: a compact shared overlay every
BodyArcade game mounts — console-system-overlay style. (3) The Full App
refactored to consume the Runtime with zero behavior change. Retrofit
Runtime+HUD into TinySkies, Rowing, and standalone Dolphin.

CONTEXT: BODYARCADE_CONTEXT.md v2. Autonomy policy applies: no user
gates; defer human checks to FINAL_USER_TEST_PLAN.md (S1–S3, S11) with
evidence. Completed systems are the source — this is extraction and
integration, not reinvention.

OWNERSHIP/ISOLATION: owns packages/pose-runtime (new), packages/pose-hud
(new), packages/body-input (interface frozen after merge), tracking code
currently in apps/posepuppet, app boot/camera lifecycle, and minimal
mount points in the three game apps. Worktree ../wt-runtime, branch
feat/pose-runtime-hud, tmux ba-runtime, port 5174, Playwright yes,
display :2 for HUD visuals. Nothing else edits these packages
concurrently.

NON-NEGOTIABLES: one tracking pipeline per page — explicit camera
ownership/lifecycle, no duplicate webcam/pose pipelines; raw landmarks
never exit the Runtime boundary (HUD receives approved preview/render
state + derived signals only — enforce by test); keyboard controls work
with camera denied (every game); do NOT render the full PosePuppet
Three.js stage in games — the HUD preview is a lightweight mirrored
avatar (cheap VRM or simpler) degrading gracefully to skeleton/
silhouette under load; GPU cost budgeted and measured; current PosePuppet
visual language reused for the HUD — no redesign, no settings panel.

HUD SPEC: bottom-left by default; small square/compact rectangle;
collapsible/minimizable (esp. during gameplay/recording); never overlaps
critical game controls (mount API takes a safe-area hint). Contents:
preview avatar mirroring the user, tracking state, camera/privacy state
("local inference" made explicit), calibration/recenter state where
useful. Interaction: hover/focus/click expands or swaps preview to the
live camera feed; full keyboard access parallels all hover behavior.

OUTCOMES (ordered): O1 Runtime extracted, Full App consumes it, app
suite green (behavior-identical). O2 HUD component + preview renderer +
degradation tiers + keyboard access. O3 Integration: TinySkies, Rowing,
Dolphin each initialize Runtime directly (no PosePuppet tab), mount HUD,
keep their own game UI untouched. O4 Camera-denied and permission-flow
paths verified everywhere; perf measured per game with HUD on/off; docs.

VERIFICATION: full existing suites green post-extraction (the refactor's
contract); boundary test asserting emitted messages contain no landmark
arrays; Playwright per game: HUD mounts, expands/collapses via mouse AND
keyboard, camera-denied still plays on keyboard, only one getUserMedia
consumer per page; screenshot board (HUD states across all three games +
app) with vision self-review against the current visual language; perf
table: each game 60/45 fps with pose ≥15 fps, HUD preview cost itemized,
degradation tier triggers verified.

ACCEPTANCE (/goal): Runtime + HUD packages shipped and documented; Full
App behavior-identical on the Runtime; all three completed games run
body-controlled with HUD and WITHOUT the PosePuppet app open; landmark-
boundary, camera-denied, single-pipeline, and keyboard-access tests
green; perf table within floors; FINAL_USER_TEST_PLAN entries S1–S3,
S11 written with evidence links; DECISIONS/EVAL_NOTES/README updated.

AVOID: visual redesign; a HUD settings panel; full-stage rendering in
games; multiple tracking pipelines; body-input schema breaks (extend
only); touching game logic beyond mount points; blocking on anything a
placeholder can cover.

FIRST ACTIONS: audit the completed apps' tracking/camera code paths and
LICENSE_NOTES.md (permission text present?); write PLAN.md with the
extraction map + file-ownership list; begin O1.
```

---

## V2 — Open-Data World Pipeline v2 (revised)

*Wave 1, parallel with V1. Sole owner of `packages/world-data`.*

```text
TITLE: World-data pipeline — one geographic foundation, three profiles.

GOAL: An offline pipeline baking one compact real-world region into
stable, style-agnostic shared data consumed by ALL Open World profiles:
terrain + elevation, coastline, water polygons, waterways, roads, paths,
building footprints, vegetation/land-use zones, boundaries, collision
data, navigation data (walkable/rowable graphs), minimaps, spawn points,
and mode-transition points. Styling lives in profiles layered later —
the core representation never bakes in an art direction.

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy applies. Absorb the
completed Dolphin boundary module as the water-polygon component
(preserve its outputs; standalone Dolphin keeps working). Not Google
Maps, ever. RESEARCH REQUIRED: verify current sources/endpoints by web
search (Overpass mirrors/extracts, DEM access e.g. Copernicus GLO-30 or
AWS Terrain Tiles, Overture status) — record in DATA_SOURCES.md; do not
trust memory for endpoints.

OWNERSHIP/ISOLATION: owns packages/world-data + tools/worldbake + a
schema-versioned world.json contract. Worktree ../wt-worlddata, branch
feat/world-data-v2, tmux ba-worlddata, optional viewer on 5180, no
Playwright (golden files), no display :2. V4 consumes the schema
read-only; only this prompt edits the package.

NON-NEGOTIABLES: offline-first (prep scripts fetch and bake; games ship
bundled data; zero runtime fetching); deterministic bakes (checksummed
cached inputs -> byte-stable outputs); licensing done right (ODbL
attribution wired for consumers; every source + license in
DATA_SOURCES.md); style separation is architectural — a profile can be
added without touching geographic code.

OUTCOMES: O1 source research + REGION_CANDIDATES.md: three candidates
scored on (a) bay/harbor/river, (b) walkable settlement, (c) terrain
variance, (d) airstrip/flat field, (e) OSM completeness, (f) 2–4 km²
core; bake the top score as the working default (region swap stays a
cheap re-bake — the user may override until V4's realistic art pass; say
so in FINAL_USER_TEST_PLAN front matter). O2 acquire→normalize→simplify
stages for the pilot region. O3 emit the full shared set above,
including collision meshes, nav graphs (walk network from roads/paths;
row network from waterways/water polygons), minimap vectors, spawn +
transition candidate points (airfield/field, docks, dive points). O4 CLI
(`worldbake <place|bbox> --profile-agnostic`), caching, docs; a
second location baked purely from the README to prove the docs.

VERIFICATION: golden-file tests on checksummed snapshots; geometry
sanity (no self-intersections post-simplify, area deltas within stated
tolerance, water/land topology preserved); nav-graph validity
(connected walkable component covering the settlement; rowable network
reaches the bay); schema-version round-trip; standalone Dolphin still
passes on the absorbed module; attribution presence asserted by test.

ACCEPTANCE (/goal): pilot region baked with the complete shared data
set; schema documented + versioned; determinism via golden files;
Dolphin module absorbed without regression; DATA_SOURCES.md complete
with licenses; second-location bake from docs alone succeeds;
REGION_CANDIDATES.md + default choice recorded; offline-first honored.

AVOID: runtime fetching; per-art-direction geographic forks; global
scale (city-sized max); Google/proprietary tiles; blocking on the
user's region choice (default proceeds; choice stays reversible).

FIRST ACTIONS: audit the Dolphin boundary module + Walking's world.json
contract from v1 docs if present; research sources; write
DATA_SOURCES.md + REGION_CANDIDATES.md; begin O2.
```

---
## V3 — Walking Locomotion (revised)

*Wave 2 (after V1 merges — it extends body-input). Delivers a package; V4 performs the world integration.*

```text
TITLE: Walking locomotion — gait detection + comfortable ground movement
as a reusable package for the Open World.

GOAL: packages/locomotion: marching-in-place / weight-shift walking that
the Open World's low-poly profile integrates first and the realistic and
fantasy profiles inherit WITHOUT locomotion rework. Proven in a graybox
test page, handed to V4 with integration notes — no throwaway town.

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy. Rowing's periodic-
motion detection (completed) is the starting point for gait. PPC exists
(feet vanish at desk framing). Real gait fixtures are OPTIONAL: proceed
with synthetic oscillation streams + keyboard-driven ground truth +
existing fixtures; request clips (march_slow/fast, weight_shift,
walk_lean_turns) via the up-front checklist and defer real-clip
validation to FINAL_USER_TEST_PLAN.

OWNERSHIP/ISOLATION: owns packages/locomotion (new) + gait additions to
packages/body-input (v1.x, additive; interface RFC if the runtime
boundary is touched) + a graybox test page. Worktree ../wt-walking,
branch feat/walking-locomotion, tmux ba-walking, port 5175, Playwright
yes, display :2 for graybox recordings. Does NOT touch apps/openworld.

NON-NEGOTIABLES: comfort is a hard requirement — stable horizon, no
forced head-bob, capped smooth yaw rate, stable FOV, optional comfort
vignette, speed cap; seated/accessibility fallback (lean-glide
locomotion); keyboard fallback (WASD); the human nausea check is
inherently human-only -> FINAL_USER_TEST_PLAN S8 with your best
automated proxies attached (yaw-rate/acceleration envelopes).

OUTCOMES: O1 gait detection in body-input: step events from hip/knee
vertical oscillation, cadence Hz, weight-shift axis; hysteresis;
works standing and via weight-shift. O2 locomotion model: cadence ->
speed with inertia; lean -> turn rate; crouch -> slow/duck; assists
(soft path-shoulder steering hook for V4's nav graph, Full Assist
default); autopilot on tracking loss (gentle stop); T-pose recenter.
O3 graybox: flat test world with a path ribbon proving feel + comfort
envelopes; recordings + vision self-review. O4 handoff: integration
notes for V4 (API, nav-graph hooks, comfort parameters, HUD/coach
message strings).

VERIFICATION: synthetic-stream evals (known cadence in -> speed
tracks); step-count accuracy vs labeled real clips WHEN provided
(deferred otherwise, stated honestly); closed-loop graybox runs:
fixture/synthetic-driven walk follows the path, dropout stops gently
and recovers without snap; comfort envelope assertions (max yaw rate,
max acceleration) enforced in code and tested; replay determinism per
the body-input contract.

ACCEPTANCE (/goal): package shipped + documented; gait evals green on
synthetic (and real clips if provided); comfort envelopes enforced by
test; seated glide + keyboard + autopilot + recenter work in the
graybox; handoff notes complete; FINAL_USER_TEST_PLAN S8 entry written
with evidence; body-input additions are additive and its suite stays
green.

AVOID: building a town or touching apps/openworld; free-fly cameras;
head-bob realism; blocking on real gait clips; scoring.

FIRST ACTIONS: audit Rowing's periodic detector + PPC integration
points; PLAN.md with file-ownership list; begin O1.
```

---

## V4 — BodyArcade Open World (new; the big one)

*Waves 2–4. Sole owner of `apps/openworld`. Internal milestones strictly serialized. Effort xhigh defensible.*

```text
TITLE: BodyArcade Open World — one compact real-world region, three
visual profiles, four modes; an EXPANSION beside TinySkies, never a
replacement.

GOAL: apps/openworld: a compact, excellent real-world-derived region
where the body flies a plane, walks, rows, and (low-poly profile only)
swims as the dolphin — with mode transitions, the shared PosePuppet
Runtime+HUD, and three renderer/content profiles over the SAME world
data: `low-poly` first, `realistic` second, `fantasy-game` strictly
last. TinySkies remains its own whimsical globe experience with its own
UI — the flight redundancy is intentional (globe toy vs location-based
open world).

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy. Depends on: V2's
baked region + schema (may scaffold graybox against the schema before
the bake lands), V1's Runtime+HUD, V3's locomotion package (walking
milestone waits for its handoff), and ALL completed control systems —
body-input, PPC, Flight control mappings/assists/autopilot/recenter,
Rowing stroke logic, the PS2 Dolphin implementation. REUSE, never
rebuild: a completed control system may be adapted at its integration
seam only; rebuilding one is a stop-condition-level product question.

OWNERSHIP/ISOLATION: owns apps/openworld exclusively. Consumes
packages/* read-only (needs go through interface RFCs). Worktree
../wt-openworld, branch feat/openworld, tmux ba-openworld, port 5176,
Playwright yes, display :2 heavy (primary lock user; batch headed runs).

NON-NEGOTIABLES: one shared world foundation — coordinates, terrain,
roads, waterways, collisions, containment, nav graphs, minimaps, spawns,
transitions identical across profiles; profiles are renderer + content
packs, never separate geography or separate physics/navigation; dolphin
exists ONLY in low-poly (adapt the completed PS2 renderer/art to the
region's real water polygons — do not write a third dolphin);
user-supplied plane assets enter through a documented ASSET_CONTRACT.md
(scale meters, +Y up, −Z forward, CG pivot, named prop/control-surface
nodes, material/animation expectations, poly+texture budgets, perf
targets, license metadata + attribution) with a placeholder plane
until they arrive; Runtime+HUD integrated (no PosePuppet tab; camera-
denied keyboard play works); current visual language for any shared
chrome — game-specific UI minimal, no redesign; OSM/ODbL attribution
on-screen; perf floors per profile measured on :2.

OUTCOMES (strictly ordered):
O1 Foundation: WorldRuntime loads the baked region (terrain, collision,
nav, minimap, spawns, transition points); profile system architecture;
ASSET_CONTRACT.md emitted; Runtime+HUD mounted; graybox flyover.
O2 Low-poly FLIGHT: completed flight controls in the region with the
placeholder plane; containment at region edges (soft turn-back, not
walls); airfield spawn.
O3 Low-poly WALKING: integrate V3's package onto the nav graph;
settlement walkable; minimap.
O4 Low-poly ROWING: completed rowing logic on the region's rowable
network; docks.
O5 Low-poly DOLPHIN: adapt the PS2 implementation to the region's real
water polygons + SDF depth; its standalone app keeps passing.
O6 TRANSITIONS: document the architecture first (TRANSITIONS.md), then
implement where practical — land at the airfield -> walk; dock -> row;
dive point -> dolphin; keep it honest (a fade + spawn handoff done well
beats a broken seamless dream). Profile selector UI (minimal).
O7 CONSOLIDATED LOW-POLY VERIFICATION: full closed-loop fixture matrix,
perf, screenshot boards, vision review; FINAL_USER_TEST_PLAN S7 entries.
O8 REALISTIC profile (flight/walk/row; no dolphin): same data, same
controls; grounded, achievable browser graphics — convincing lighting,
materials, atmosphere, vegetation, terrain treatment, water, scale;
not photoreal, not sim-grade. Verify as O7 -> S9 entries.
O9 FANTASY-GAME profile LAST (flight/walk/row; no dolphin), only after
O1–O8 are stable and verified. Art direction below. Verify -> S10.

WHIMSICAL DIORAMA FANTASY (art direction for O9): the region as a
living storybook diorama — a handcrafted miniature landscape that stays
geographically recognizable (terrain, coastline, waterways, roads,
settlement pattern all identifiable). Core qualities: instantly
readable silhouettes; compact charming settlements (cozy crooked
houses, windmills, market squares, little stations, canals, bridges,
inns, towers, gardens, orchards, lighthouses, tiny trains, small
airfields, waterfalls, air-visible landmarks); playful but tasteful
exaggeration; believable scale between terrain, buildings, roads,
vehicles, player; painterly materials, simplified elegant forms,
softened handcrafted edges; clear foreground/middle/background
separation. Environmental life: moving clouds, birds, chimney smoke,
swaying trees, flags, lanterns, boats, windmill blades, glowing
windows, fireflies, gentle weather, restrained magical particles, an
occasional larger magical focal point. Palette: soft greens, sky
blues, warm creams, peach, lavender, golden light; restrained cyan/
pink/violet magical accents; atmospheric skies, soft mist, warm
windows. MUST NOT feel childish, cheap, plastic, mascot-platformer,
Mario-like, or generic-mobile-kids; no harsh primaries, excessive
bloom, toy plastic, floating obstacle courses, oversized props, or
clutter. No franchise names/characters/symbols/assets/architecture/
level designs (Harry Potter, Mario, Ghibli, Zelda, or any other) —
references inform broad emotional qualities only; make original
decisions. Tiebreaker: the version that makes it feel like a
beautifully art-directed miniature place someone would explore,
screenshot, record, and share. Optimize for: instant appeal in a short
clip; recognizable geography transformed; cohesion across flight/walk/
row; visible life; originality; performance; navigational readability.
Self-evaluate partly by whether an unexplained short recording of each
mode looks instantly charming and distinctive (vision self-review).

VERIFICATION (throughout): closed-loop fixture drives per mode per
profile (flight lap, walk route on nav graph, row circuit, dolphin
containment) with the completed systems' existing metrics; cross-
profile consistency tests (identical spawn/nav/collision queries return
identical results in all profiles); transition round-trips; standalone
Dolphin + TinySkies + PosePuppet suites stay green; perf per profile on
:2 under the display lock; screenshot boards + vision review per
profile; replay determinism where the completed systems guarantee it.

ACCEPTANCE (/goal): all O-milestones done in order; four modes playable
in low-poly, three in realistic, three in fantasy, all body-controlled
via Runtime+HUD with keyboard fallback and camera-denied play; one
shared foundation proven by cross-profile consistency tests; completed
systems reused not rebuilt (diff evidence); placeholder plane + honored
ASSET_CONTRACT.md; transitions documented + implemented where practical;
attribution + credits correct; perf floors met per profile; all suites
green; FINAL_USER_TEST_PLAN S7/S9/S10 entries with evidence;
DECISIONS/EVAL_NOTES/README/TRANSITIONS docs complete.

AVOID: rebuilding any completed control/vehicle/mode system; separate
geography, physics, or navigation per profile; a realistic or fantasy
dolphin; replacing TinySkies' UI or experience; seamless-world scope
creep (one compact excellent region); starting fantasy before O8 is
verified; blocking on user plane assets or the region override.

FIRST ACTIONS: audit V2's schema + bake, V1's mount API, and every
completed system's integration seams (write REUSE_MAP.md: what is
consumed, where, unchanged); PLAN.md + file-ownership; begin O1.
```

---
## V5 — Character Control Upgrade (revised; absorbs the AutoRig minimum)

*Wave 2, after V1 merges (hand fusion extends pose-runtime). ◐ with V6: declare file ownership; V5 owns any shell edits.*

```text
TITLE: Character expressiveness on a curated roster — capability
manifest, real fingers where supported, face-touch v2, feet v2.

GOAL: Meaningfully better hands/wrists (true finger control ONLY on
rigs that support it), seven named face-touch gestures, feet that plant
without skating — every capability gated by a small, manually
reviewable capability manifest of the EXISTING curated roster. This
absorbs the AutoRig decision: no standalone rigging tool, no automatic
repair, no universal FBX mapping, no FBX->VRM, no cloud conversion, no
audit product. Later user-supplied known-good models enter by adding a
reviewed manifest entry.

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy — defer live checks
to FINAL_USER_TEST_PLAN S4. Hand-only mode already runs hand-landmark
tracking; Character mode approximates hands from pose today. Existing
labels (Fingers supported/not, Face-touch limited, Feet limited,
Full-body limited, Best for demo, Not well developed) stay and become
manifest-driven.

OWNERSHIP/ISOLATION: owns data/avatar-capabilities.json (the manifest),
the retarget/face-touch/feet modules in apps/posepuppet, hand-fusion
additions in packages/pose-runtime (additive; RFC for interface
changes), and avatar-card label wiring. Worktree ../wt-charcontrol,
branch feat/character-control, tmux ba-char, port 5177, Playwright yes,
display :2. Must not touch Motion Memory or recording files (V6/V7
territory) or app shell files without owning them per PLAN.

NON-NEGOTIABLES: capability-gating is absolute — finger data drives
only manifest-approved rigs; everyone else keeps improved wrist/palm +
an honest label; zero head/hand interpenetration in face-touch on
supported rigs (collision capsule); perf floors hold with hand fusion
ON (reduced-rate, hands-visible-only inference; measured both states);
pass-1/pass-2 sync metrics must not regress; manifest stays small and
human-readable (this is data + a report script at most, not an app).

OUTCOMES: O1 Manifest: inspect the curated roster programmatically
through the existing loaders/retarget layer (bones present, finger
chains >=3 segments vs mittens, reach class, feet, notes), write the
manifest, and a tiny report-only script that regenerates it for review
— build a standalone utility ONLY if this inspection proves genuinely
impossible inline, and keep it minimal. O2 Hand boost: hand-landmark
fusion anchored at pose wrists, reduced rate, capability-gated finger
driving, graceful fallback. O3 Face-touch v2: named sockets — cheek L/R,
chin, mouth-cover, forehead, temple, under-chin, thinking-pose — two-
bone IK with contact easing + head capsule; per-avatar reach from the
manifest. O4 Feet v2: planted-foot lock (kill skating), ankle
orientation, weight shift, small steps. O5 Labels/coach wired to the
manifest; docs; FINAL_USER_TEST_PLAN S4 entries.

VERIFICATION: manifest matches ground truth on the known roster (a
deliberately mislabeled test entry is caught by the regen script);
finger-curl correlation vs existing hand fixtures on capable rigs;
incapable rig provably NOT finger-driven + label shown; all seven
sockets reached on facetouch.mp4 within tolerance with zero
interpenetration frames on capable rigs; skating metric (planted-foot
drift px/frame) under threshold on fullbody.mp4; perf ON/OFF table;
no sync-metric regressions; suites green.

ACCEPTANCE (/goal): manifest shipped, reviewed-format, driving all
gating and labels; hand boost + face-touch v2 + feet v2 pass the evals
above; honest fallbacks everywhere; perf floors hold; no regressions;
S4 entries written with evidence; docs updated. No AutoRig-style tool
exists (or, if the minimal utility was truly necessary, it is report-
only and justified in DECISIONS.md).

AVOID: rig repair/conversion of any kind; forcing fingers universally;
per-avatar calibration profiles; a capability *product*; face-landmark
scope creep (sockets come from pose + rig); touching V6/V7 files.

FIRST ACTIONS: audit roster loaders + retarget seams + existing labels;
PLAN.md with file-ownership; begin O1.
```

---

## V6 — Motion Memory 2 (revised)

*Wave 2. ◐ with V5 (different app modules) and V1 (no shell/boot files; rebase before merge).*

```text
TITLE: Motion Memory 2 — the creative loop library.

GOAL: Upgrade Motion Memory v1 (ring buffer, ghost duet, echo chorus,
instant replay, re-skin, IndexedDB loops — all completed) into a small
creative layer: loop library with names/thumbnails/metadata + rename/
delete, trimming with live preview, duet/echo/chorus/MIRROR playback,
ghost opacity + delay presets, "best last motion" grab, and a motion-
tape timeline strip. Playback-creative only.

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy — the live creative
session defers to FINAL_USER_TEST_PLAN S5. Build on v1; don't rewrite;
old loops must keep loading (versioned schema + migration).

OWNERSHIP/ISOLATION: owns the motion-memory modules + library UI in
apps/posepuppet and the loop schema. Worktree ../wt-motionmem, branch
feat/motion-memory-2, tmux ba-mm2, port 5178, Playwright yes, display
:2 light. Must not touch shell/boot (V1), retarget/capability (V5), or
recording (V7) files. V7's replay-insertion work starts only after this
prompt declares the loop schema stable (announce in STATUS.md).

NON-NEGOTIABLES: local-only (IndexedDB), bone streams not video,
bounded storage (size guard + oldest-eviction prompt), playback only —
no scoring, no game; v1 features keep working; current visual language
for the library UI.

OUTCOMES: O1 versioned schema + migration + library (cards: name,
thumbnail from the loop's highest-energy frame, duration, avatar, mode,
date; rename/delete). O2 trim with in/out handles + live preview;
"best last motion" = highest-motion-energy ~5 s window (energy = summed
joint angular speed; document it). O3 playback modes incl. mirror
(sagittal-plane quaternion reflection — verify handedness with an
asymmetric-gesture fixture) + opacity/delay presets. O4 motion-tape
strip (energy over time, scrub-to-trim); docs; S5 entry.

VERIFICATION: save->reload->replay within v1 tolerance; migration test
on real v1 loops; mirror test: a right-hand-wave fixture replays as a
true left-hand wave (sync metric vs a mirrored render); trim boundary
exactness; deterministic thumbnails; storage-bound test; suites green.

ACCEPTANCE (/goal): library CRUD + thumbnails + trim + all playback
modes incl. verified mirror + best-last-motion + tape strip shipped;
v1 loops migrate; storage bounded; local-only; S5 entry with evidence;
schema-stability declared for V7; suites green; docs updated.

AVOID: scoring; cloud sync; video storage; keyframe editing; breaking
v1; touching V1/V5/V7 territory.

FIRST ACTIONS: audit v1 modules + storage; PLAN.md with file ownership
+ schema RFC; begin O1.
```

---

## V7 — Recording / Demo Director v2 (revised)

*Wave 3. Segmentation sub-track may overlap V6's tail (disjoint files); replay insertion and final integration are sequential after V6's schema freeze. Sole owner of recording infra.*

```text
TITLE: Demo Director v2 — the app produces the public clip.

GOAL: Upgrade recording from capture to production: richer guided take
scripts, countdown + fully hands-free start/advance/stop (existing
gestures), instant replay + slow-motion as insertable take steps
(consumes Motion Memory), title/end cards in the current visual
language, and a performer-presentation layer via local person
segmentation: background blur, background cutout, performer silhouette,
picture-in-picture body chip, optional skeleton-ghost overlay on the
cutout. The signature shot: performer cutout ON STAGE beside the avatar.

CONTEXT: BODYARCADE_CONTEXT.md v2; autonomy policy — recorded-take
acceptance defers to FINAL_USER_TEST_PLAN S6. Guided takes, hands-free
gestures, 16:9/9:16 composites, and packaging exist (completed passes)
— extend, don't rebuild. Segmentation is the new capability and the
perf risk.

OWNERSHIP/ISOLATION: owns recording/compositor/take-script modules +
a new packages/segmentation. Worktree ../wt-recording, branch
feat/recording-v2, tmux ba-rec, port 5179, Playwright yes, display :2.
Replay-insertion work begins only after V6 declares schema stability.
Final integration + full-suite runs under the full-suite lock,
serialized.

NON-NEGOTIABLES: all processing local (in-browser segmentation);
graceful degradation to blur-off when the frame budget is threatened
(perf measured ON/OFF at both aspects; floors hold); privacy copy
updated (segmentation is local too); hands-free flow keeps passing its
existing tests; fixtures gitignored; no redesign — cards/UI in the
current language.

OUTCOMES: O1 segmentation pipeline (reduced resolution/rate) + the four
presentation modes + degradation tiers. O2 take-script v2: per-shot
presentation presets; replay/slow-mo steps via Motion Memory. O3
composite polish across both aspects; title/end cards; docs; automated
demo takes recorded per mode as evidence; S6 entries.

VERIFICATION: mask-quality eval on fixtures (IoU vs a few hand-labeled
frames; edge-flicker under threshold); perf ON/OFF x both aspects on
:2; recordings playable with correct per-shot presets and durations;
hands-free tests green through the new flow; privacy receipt stays
truthful; suites green under the lock.

ACCEPTANCE (/goal): four presentation modes with local segmentation +
degradation; take scripts drive per-shot presets + replay/slow-mo;
both aspects; hands-free intact; perf floors hold ON; an automated
cutout-on-stage take exists as evidence; S6 entries written; privacy
copy updated; suites green; docs updated.

AVOID: cloud processing; rebuilding the recorder; silent frame-budget
loss; scoring/gamification; starting replay-insertion before V6's
freeze; touching V5/V6-owned files.

FIRST ACTIONS: audit recorder/compositor + run a segmentation perf
spike; PLAN.md with file ownership + degradation tiers; begin O1.
```

---

## V8 — Public Narrative (revised)

*Wave 5, last. Runs after major functionality is complete and verification evidence exists; honest about anything the final human pass hasn't covered yet.*

```text
TITLE: The BodyArcade story — evidence-based public narrative.

GOAL: A README-level project story, a launch thread, a technical
writeup, and per-mode demo captions. Frame: a long-horizon coding agent
that preserved working code, made real product tradeoffs, turned messy
creative direction into a coherent system, verified its own work
against fixture rigs, declined bad scope (AutoRig, seamless worlds,
per-profile physics), and left architecture ready for what's next. The
project is the hero; the agent's judgment is part of the story — never
"Claude wrote my app."

CONTEXT: BODYARCADE_CONTEXT.md v2. Sources: every DECISIONS.md,
EVAL_NOTES.md, eval/results.json, CHANGELOG, LICENSE_NOTES.md,
FINAL_USER_TEST_PLAN.md (including which human checks have/haven't run
— state remaining limitations honestly if the final pass is
incomplete). The strongest material is specific: dead zones from a
stillness clip, autopilot taking the stick, the fake-webcam rig, the
region that stayed recognizably real in three art styles.

OWNERSHIP/ISOLATION: owns narrative/ only. Worktree ../wt-narrative,
branch docs/narrative, tmux ba-story, no port, no Playwright, no
display.

NON-NEGOTIABLES: my posting voice — lowercase, understated, specific,
technical; no hashtags/exclamations/emojis; banned: game-changer,
mind-blowing, the future of, "isn't just X — it's Y"; numbers only from
logs/eval files, each mapped in a verification table; exactly one
honest flaw per main post; links in self-replies, never the parent;
kickers earned. Truthfulness beats impressiveness. Nothing publishes
itself — I post manually.

OUTCOMES: O1 fact base (claim -> file/line source) mined from
artifacts. O2 README story + launch thread (3 opener variants: data-led
/ story-led / kicker-led; per-post media assignments; self-replies) +
verification table. O3 technical writeup (architecture, body-input
protocol, control-feel engineering, the eval rig, honest limitations)
+ per-mode captions. O4 skeptic pass: for each post, the most likely
hostile reply, and confirmation the draft already answers it.

VERIFICATION: every claim maps to the fact base; voice-rule lint;
skeptic-pass notes; limitation statements match FINAL_USER_TEST_PLAN
status at time of writing.

ACCEPTANCE (/goal): fact base with provenance; README story; thread
with variants + media + self-replies; writeup; captions; verification
table; skeptic notes; honest limitations; nothing published.

AVOID: capability inflation; benchmark-speak; tool-worship framing;
any unsourced number; speculation where evidence exists; publishing.

FIRST ACTIONS: mine artifacts into the fact base; draft the README
story; proceed.
```

---

*End of pack v2. Save Global Context v2 over `BODYARCADE_CONTEXT.md`, create the empty `FINAL_USER_TEST_PLAN.md` from §11's skeleton, then launch Wave 1 (V1 + V2) in their worktrees.*
