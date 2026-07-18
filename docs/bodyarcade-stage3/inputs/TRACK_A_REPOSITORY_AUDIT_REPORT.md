# Track A — Repository and Systems Audit Report

**Project:** BodyArcade Shared-World, Stage-2 research, Track A of five (A–E).
**Date:** 2026-07-16.
**Method:** Read-only inspection of the local clone at `/Users/lekan/Dev/posepuppet` (checked out clean on `bodyarcade-v2-base @ 99df0bc`; remote `origin = github.com/lekandigital/posepuppet`). All branch content was read with `git show <sha>:<path>` / `git ls-tree` / `git log` — **no branch was checked out, no file modified, no prompt-pack instruction executed.** The design archive `bodyarcade-current-design-source` was verified present at `/Users/lekan/Downloads/bodyarcade-current-design-source` and treated as archive only.

Evidence labels used throughout: **verified** (directly observed in the repo), **inference** (judgment call from verified facts), **unverifiable** (could not be checked, with what was tried).

---

## 1. Executive summary

**The branch/SHA table resolves exactly as pinned — zero drift** (§2). All nine named branches and all seven `feat/*` lanes exist on `origin` at the recorded SHAs. `bodyarcade-v4-base` exists **only as a remote-tracking ref** (`origin/bodyarcade-v4-base @ 493dd24`); there is no local branch for it.

**The single most important finding of this audit: `local/v2-base-mac-prep @ 60b034c` is the wrong base for `apps/shared-world`, and `bodyarcade-v4-base @ 493dd24` is the right one.** Verified by ancestry checks: mac-prep does **not** descend from `bodyarcade-v2-base` — it is a parallel lineage forked from the rowing lane at `a39d644` (Rowing P2, 2026-07-09) that **contains neither `apps/dolphin` nor the completed Rowing Gate-2 work**. Its tree has only `apps/flight`. Its unique content is remote-development infrastructure, an NVIDIA test harness, a *second, parallel* "v2 baseline" prep commit (`949ab7a` — near-duplicate of `99df0bc` on the other line), and two docs commits (the v2 prompt pack + the final verification summary). Meanwhile `bodyarcade-v4-base` is `bodyarcade-v2-base` (which itself contains completed Flight + Rowing-rebuilt + Dolphin) **plus the merged, completed V1 (pose-runtime/pose-hud), V2 (worldbake pipeline), and V3 (locomotion + walking graybox)**. It is the only baseline that contains everything. This is a *location* proposal only, per the prompt's rule — no strategy change (§5).

**The V1–V8 pack is essentially fully executed except V8.** V1, V2, V3 are complete and merged into `bodyarcade-v4-base`. V4 (Open World) completed all ten milestones O0–O9 on `feat/openworld @ ed1bb7a` (unmerged), including the three style profiles — which are now **presentation-superseded** by the one-style decision, though its data/runtime machinery (`bodyarcade-world/1` schema, `WorldRuntime`, mode controllers, transitions) is reusable. V5, V6, V7 are complete on their own unmerged lanes forked from V1-complete. **V8 (Public Narrative) is absent**: no `docs/narrative` branch, no `narrative/` directory on any tip; the existing `POSTS.md` predates the pack (§6).

**The preserve set ports for free.** `sim.ts` and `swimControls.ts` contain **zero Three.js imports** (verified line-by-line) and are byte-identical between `bodyarcade-dolphin-fable` and `bodyarcade-v4-base`. The monorepo root is already on `three ^0.184.0`; only `apps/dolphin` (and the TinySkies fork) pin `^0.172.0`. The 0.172→0.184 port surface is confined to the *replace-wholesale* presentation files plus the small `camera.ts`/`game.ts` render shell, which use only stable core APIs (§4.7).

**One licensing discrepancy:** `LICENSE_NOTES.md` does not exist on any audited branch. The TinySkies permission is recorded in `ASSETS.md` ("used with permission… The permission record is retained privately (gitignored)"), while `FINAL_USER_TEST_PLAN.md` claims "[x] Permission quoted in LICENSE_NOTES.md" (§12, F2).

Everything Stage 3 needs to scaffold `apps/shared-world` without further repo inspection is in §11: base `origin/bodyarcade-v4-base`, package `@bodyarcade/shared-world`, Vite `base: '/shared-world/'`, a root-vite static middleware clone of `dolphinStatic()`, BroadcastChannel + postMessage envelope `bodyarcade.body-input.v1`, optional direct `createPoseRuntime` boot copied from v4-base's `apps/dolphin/src/main.ts`, and a Playwright suite on its own port with the `__DOLPHIN`-style eval handle.

---

## 2. Ground truth: branch/SHA verification and true topology

### 2.1 Pin verification (all **verified** via `git for-each-ref`)

| Branch | Pinned SHA | Resolves? | Notes |
|---|---|---|---|
| `local/v2-base-mac-prep` | `60b034c` | ✅ local + origin | Tree contains **only `apps/flight`** — no dolphin, no walking |
| `bodyarcade-dolphin-fable` | `05b4801` | ✅ local + origin | Primary audit target |
| `bodyarcade-rowing-fable-rebuilt` | `c8cdafa` | ✅ local + origin | An ancestor of the dolphin branch (merged in) |
| `bodyarcade-rowing-fable` | `5ce96fa` | ✅ local + origin | Earlier rowing lane |
| `bodyarcade-flight-fable` | `07ec2f5` | ✅ local + origin | Ancestor of everything later |
| `bodyarcade-v2-base` | `99df0bc` | ✅ local + origin | Current local checkout; clean tree |
| `bodyarcade-v4-base` | `493dd24` | ✅ **origin only** | No local branch — Stage 3 must `git switch -c` from `origin/bodyarcade-v4-base` |
| `main` | `940d31c` | ✅ local + origin | |
| `ppc-complete` | `922077b` | ✅ local + origin | Same SHA as `predictive-pose-continuity-fable` |
| `feat/pose-runtime-hud` | `ffd555f` | ✅ origin only | V1 |
| `feat/world-data-v2` | `5cfe69d` | ✅ origin only | V2 |
| `feat/walking-locomotion` | `9e2c3e2` | ✅ origin only | V3 |
| `feat/openworld` | `ed1bb7a` | ✅ origin only | V4 |
| `feat/character-control` | `e2aac2d` | ✅ origin only | V5 |
| `feat/motion-memory-2` | `ab62780` | ✅ origin only | V6 |
| `feat/recording-v2` | `eac6c4d` | ✅ origin only | V7 |

Additional refs observed (not in the pin table): `origin/backup/bodyarcade-rowing-fable-*` (6 backups), `origin/pass-2-instrument`, `origin/hard-model-fix`, `infra/remote-development-rebuild @ 68ac9a3`, archive/cleanup branches, and two `aero-glass-*` branches unrelated to BodyArcade. **Verified.**

### 2.2 True topology (all ancestry **verified** with `git merge-base --is-ancestor`)

```
940d31c main (Merge PPC, 07-07)
   └─ 07ec2f5 flight-fable (GATE 3, 07-07)
        └─ ...rowing lane...
             ├─ a39d644 Rowing P2 (07-09)  ←────────── FORK POINT of mac-prep
             │    ├─ 5ce96fa rowing-fable (07-09)
             │    │    └─ ...c8cdafa rowing-rebuilt (Gate-2 round 2, 07-11)
             │    │         └─ merged into dolphin lane
             │    │              └─ 05b4801 dolphin-fable (Dolphin P4 ship, 07-11 17:01)
             │    │                   └─ 99df0bc bodyarcade-v2-base (prep, 07-11 18:04)
             │    │                        └─ +10 commits: V1 (dab722f…ffd555f),
             │    │                           V2 (4c77e96, ccb9f4c, 5cfe69d),
             │    │                           V3 (9e2c3e2), merge 67377b9
             │    │                             └─ 493dd24 bodyarcade-v4-base (07-12 19:38)
             │    │                                  └─ feat/openworld → ed1bb7a (V4, unmerged)
             │    └─ 68ac9a3 infra: remote rebuild (07-09)
             │         └─ 5fc3fbf NVIDIA perf harness (07-10)
             │              └─ 949ab7a prep: v2 baseline (07-11 17:29)  ← parallel twin of 99df0bc
             │                   └─ 60b034c local/v2-base-mac-prep (07-12 22:20, docs only)
             └─ (V5/V6/V7 fork from ffd555f = V1-complete, not from v4-base)
```

Key verified facts:

- `05b4801` (Dolphin complete) **is an ancestor of** `99df0bc` (v2-base) — the dolphin work is *inside* v2-base and v4-base.
- `99df0bc` **is not an ancestor of** `60b034c` (mac-prep). `c8cdafa` (rowing-rebuilt) and `05b4801` (dolphin) are **not** in mac-prep either. `07ec2f5` (flight) and `940d31c` (main) are.
- There are **two near-duplicate "v2 baseline" prep commits** on divergent lines: `99df0bc` ("Global Context v2, test plan, prompt pack") and `949ab7a` ("Global Context v2 + FINAL_USER_TEST_PLAN skeleton"). This is the trap that made mac-prep look like the newest baseline: it is newest *by commit date* (07-12 22:20) but on the poorer lineage.
- `feat/openworld` forks from `493dd24` (v4-base). `feat/character-control`, `feat/motion-memory-2`, `feat/recording-v2` fork from `ffd555f` (V1-complete) — they contain V1 but **not** V2/V3/V4. `feat/recording-v2` contains V6's commit (`ab62780` is in its history). None of the four lanes is merged into any other branch (**verified** with `git branch -r --contains`).

---

## 3. Architecture map (Deliverable 1)

### 3.1 Monorepo layout (on `bodyarcade-v4-base @ 493dd24`, the most complete tree — **verified**)

```
posepuppet/                      npm root = PosePuppet full app (three ^0.184.0, Vite :5173 strictPort)
├── src/                         PosePuppet app: tracker, avatars, stage, recording, eval rig
│   ├── bodyinput/adapter.ts     the ONLY file handing landmarks to the protocol core (per ARCHITECTURE.md)
│   └── pose/continuity.ts       Predictive Pose Continuity (pre-V1 location; post-V1 also in pose-runtime)
├── packages/
│   ├── body-input/              @bodyarcade/body-input v1.0.0 — BodySignal protocol (§9)
│   ├── world-data/              @bodyarcade/world-data — boundary artifact + (V2) world.json pipeline
│   ├── pose-runtime/            (V1) headless tracking runtime: camera→detector→PPC→BodySignal
│   ├── pose-hud/                (V1) shared HUD overlay (mountPoseHud)
│   └── locomotion/              (V3) gait walking controller + INTEGRATION.md
├── apps/
│   ├── flight/                  TinySkies/GlobeFly faithful fork (its own three 0.172, own workspaces)
│   │   └── client/src/{game,input,ui}/…   Boat/Rowing live HERE, not in an apps/rowing
│   ├── dolphin/                 standalone Dolphin (three ^0.172.0, Vite base '/dolphin/', port 5197)
│   └── walking/                 (V3) locomotion graybox test app
├── tools/worldbake/             (V2) offline bake CLI → packages/world-data/data/worlds/<region>/world.json
├── vite.config.ts               root dev server :5173 + flightStatic() + dolphinStatic() middleware
├── playwright.config.ts         root suite; SwiftShader/GPU tiers (§10)
└── eval/                        committed results artifacts incl. eval/dolphin-results.json
```

On `feat/openworld` additionally: `apps/openworld/` (V4) with `src/world/runtime.ts`, `src/modes/{flight,walk,row,dolphin,flycam}.ts`, `src/profiles/{lowpoly,realistic,fantasy}/`, `src/transitions.ts`, and `packages/world-data/data/worlds/{isafjordur,friday-harbor}/world.json`.

### 3.2 Body-input data flow (webcam → game) — **verified** from code and `ARCHITECTURE.md`

```
webcam ─→ MediaPipe pose (lite/full) ─→ PPC (occlusion carry) ─→ landmarks
   [pre-V1: PosePuppet app src/; post-V1: @bodyarcade/pose-runtime, worker-capable]
        │  landmarks NEVER cross this boundary (shape-guarded at runtime + tested)
        ▼
@bodyarcade/body-input pipeline: calibration-relative extraction → One Euro →
   dead zone → expo → slew; hysteresis events; confidence decay
        │  emits BodySignal v1 (8 axes + events + optional stroke/swim/tracking blocks)
        ▼
Transports: (a) BroadcastChannel 'bodyarcade.body-input.v1' — ORIGIN-SCOPED;
            (b) postMessage envelope { t: 'bodyarcade.body-input.v1', signal } — relay path
        ▼
Game consumer (e.g. apps/dolphin/src/input/swimControls.ts): dedupe by signal.ts,
   staleness gate 350 ms, confidence gate 0.35, keyboard priority 1500 ms,
   autopilot decay on loss, slew-bounded re-entry
        ▼
Pure sim (sim.ts, 120 Hz fixed timestep, deterministic) ─→ render shell (game.ts)
```

Because BroadcastChannel is origin-scoped, every game must be served **same-origin** with the producer. The root Vite server does this by middleware: `/flight/` → `apps/flight/client/dist`, `/dolphin/` → `apps/dolphin/dist` (root `vite.config.ts`, both branches — **verified**). `apps/shared-world` attaches identically: build with `base: '/shared-world/'`, add a `sharedWorldStatic()` middleware clone, and/or (post-V1 pattern) initialize `createPoseRuntime` directly in-page so no PosePuppet tab is needed at all (§11).

---

## 4. The Dolphin app (`apps/dolphin/` @ `05b4801`) — exhaustive audit

Tree (**verified**, 20 files): `README.md`, `index.html`, `package.json`, `package-lock.json`, `playwright.config.ts`, `shots.mjs`, `tsconfig.json`, `vite.config.ts`, `src/main.ts`, `src/game/{camera,decor,dolphinMesh,game,sim,world}.ts`, `src/input/swimControls.ts`, `src/ui/{hud,minimap}.ts`, `tests/{dolphin,topology}.spec.ts`. Total ≈ 2,286 lines. On `bodyarcade-v4-base` the same app additionally has `tests/hud.spec.ts` and a Runtime+HUD boot in `main.ts`/`vite.config.ts`; **`sim.ts`, `swimControls.ts`, and all `game/`+`ui/` modules are byte-identical between the two branches** (**verified** by `git diff 05b4801 493dd24 -- apps/dolphin`, which touches only `main.ts`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `tests/`).

### 4.1 Per-file preserve / replace / re-point manifest (Deliverable 2)

| File | Verdict | Reason | Dependencies | Port notes (0.172→0.184) |
|---|---|---|---|---|
| `src/game/sim.ts` (346 ln) | **Preserve** (with re-pointed data inputs, see below) | The feel: 120 Hz pure deterministic swim model, impulse-and-glide, breach, containment, assists. No RNG, byte-identical replays asserted. | `@bodyarcade/world-data` (`loadBoundary`, `pointInWater`, `signedDistanceToShore`) + static import of `san-francisco-bay.json` | **Zero Three.js imports (verified).** Port = copy. The boundary import/SDF calls are the re-point seam (§4.3). |
| `src/input/swimControls.ts` (251 ln) | **Preserve** | BodySignal consumer: dual transport, ts-dedupe, staleness/confidence gates, keyboard-priority, autopilot decay + slew re-entry, burst hysteresis machine, T-pose recenter. | `@bodyarcade/body-input` (`assertSignalShape`, `createBroadcastSource`), `sim.ts` types | **Zero Three.js imports (verified).** Port = copy. |
| `src/game/camera.ts` (45 ln) | **Preserve** | Spring-damped chase camera; breach air-lift; bank-coupled frame roll. Small, proven, worth keeping as the starting camera. | `three` (PerspectiveCamera, Vector3), `sim.ts` types | Uses only stable core API (`PerspectiveCamera`, `Vector3.lerp`, `lookAt`, `rotateZ`). Expected compile-clean on 0.184 — **inference**, confirm at port time. |
| `src/game/game.ts` (227 ln) | **Preserve pattern / rewrite shell** | The fixed-timestep accumulator, kick-on-first-substep rule, the `__DOLPHIN` eval handle (incl. `runScript` synchronous replay digest), fps/simHz counters are preserve-worthy patterns. The renderer wiring and splash pool are presentation. | three (WebGLRenderer, Points, BufferGeometry…), all other modules | Recreate in the new app around jeantimex's render loop; carry over the accumulator + eval-handle structure nearly verbatim. |
| `src/game/world.ts` (156 ln) | **Replace wholesale** | The banned presentation pass: flat-shaded vertex-lit seabed heightfield, translucent sine-wave surface sheet, shimmer curtain, FogExp2 palette. jeantimex owns surface + water; Ecco spec owns atmosphere. | three, `sim.ts` (`depthAt`, `inWater`, boundary bbox) | Note the *pattern* worth keeping: the render seabed is displaced by the SAME `sim.depthAt()` the sim collides with ("what you see is what you collide with") — carry that single-source-of-truth law into the new terrain. |
| `src/game/decor.ts` (298 ln) | **Replace wholesale** | Procedural PS2-fake dressing: instanced rocks/kelp/fish boids/light-shaft cones/motes/ruins. All superseded by the asset-driven plan. | three, `sim.ts` (`valueNoise2`, `depthAt`, `inWater`) | Deterministic placement idea (golden-angle spiral + value-noise gating, hashed per-instance phases, no RNG) is a keepable *technique* for placeholder scattering. Decor is placed in a ~900 m disc around spawn only; re-centering was an acknowledged future note (FUTURES.md). |
| `src/game/dolphinMesh.ts` (133 ln) | **Replace wholesale** | Procedural octagonal-ring dolphin. Replaced by the GAMICO rigged asset. | three | The CPU spine-parameter undulation (kick rate → traveling wave, idle breathing wave at 0.35 Hz floor, amp coupled to speed) is the *behavioral contract* the GLTF animation layer must reproduce. |
| `src/ui/hud.ts` (63 ln) | **Replace** (carry patterns) | Mono HUD + low-nag coach lines + ODbL attribution line. Slice has no full HUD; ODbL obligation disappears with OSM data. | DOM only | Keep the coach-line low-nag pattern (`COACH_HOLD_MS` 4000, 8 s repeat suppression) and tracking-state messaging for later phases. |
| `src/ui/minimap.ts` (71 ln) | **Re-point / defer** | Canvas polygon minimap over `BoundaryData` + attribution. Mechanism fine; data source (OSM polygon) retired. | `@bodyarcade/world-data` types | If the slice wants a minimap, feed it the authored shoreline mask outline instead. |
| `src/main.ts` (8 ln @ 05b4801; 34 ln @ 493dd24) | **Re-point** | Boot. The v4-base version is the one to copy: direct `createPoseRuntime({model:'lite', worker:true, election:'strict'})` + `mountPoseHud` + `?pp=companion` + `?hud=0`. | v4-base: `@bodyarcade/pose-runtime`, `@bodyarcade/pose-hud` | Copy from `493dd24:apps/dolphin/src/main.ts`. |
| `index.html` (40 ln) | **Replace** | HUD panel scaffolding + dark PS2 styling. | — | Keep the `#app` + fixed-inset HUD-layer structure. |
| `vite.config.ts` | **Re-point** | `base: '/dolphin/'`, aliases to package **source** (`packages/*/src/index.ts`), port 5197. v4-base adds `poseAssets()` middleware serving `/models` + `/mediapipe-wasm` from PosePuppet `public/` in standalone dev. | — | Clone for `/shared-world/` with its own port (§11). |
| `playwright.config.ts` (37 ln) | **Re-point** | Headed suite; own port 5197 + producer webServer on `PP_PORT` (default 5173; remote used 5185 to dodge a stale foreign dev server — comment records the 2026-07-11 measurement). | — | Local macOS: defaults work; drop the remote PP_PORT workaround (§10). |
| `tests/dolphin.spec.ts` (346 ln) | **Preserve** (assertions) | The behavioral contract of the sim — carry nearly all assertions forward (§4.6, §10). | `__DOLPHIN` handle | Update URL/port; re-point containment coordinates to the authored region. |
| `tests/topology.spec.ts` (85 ln) | **Preserve** (pattern) | Proves live producer → same-origin BroadcastChannel → game. Needs local fixture `fixtures/fullbody.y4m` (gitignored; test self-skips if missing — **verified**). | built app + root server | Re-point URL to `/shared-world/`. |
| `tests/hud.spec.ts` (v4-base only, 129 ln) | **Preserve** (pattern) | HUD mount/collapse/keyboard/camera-denied assertions for the Runtime+HUD boot. | `__PP_HUD`, `__POSE_RT` | Copy alongside the v4-base boot. |
| `shots.mjs` (52 ln) | **Re-point** | Vision-review screenshot driver (spawn/cruise/deep/surface) using the same postMessage pump. Comment says "Run with DISPLAY=:2" — the only remote bit is the env convention. | dev server | Runs unchanged on macOS headed Chrome; drop the DISPLAY comment. |
| `package.json`, `package-lock.json`, `tsconfig.json` | **Ignore** (new app gets its own) | Pins `three ^0.172.0` — the new app pins `^0.184.x` to match jeantimex and the repo root. | — | — |
| `eval/dolphin-results.json` (repo root `eval/`) | **Preserve as evidence** | GPU-run record: fps 60.01, simHz 120.02, containment minShoreDist 18.84 m / maxDecel 0, breach 1/1, dropout maxPitchStep 0.0893 rad, replay digest. | — | Baseline numbers for the new suite's expectations. |

### 4.2 Feel-constant table dump (Deliverable 3; Q1)

All from the single exported `SIM` table, `apps/dolphin/src/game/sim.ts:44-86` @ `05b4801` (**verified**, quoted values exact). Scale-sensitivity flag: 🔴 = certainly re-tune at 2 km fictional region; 🟡 = review; ⚪ = scale-independent feel. Per the prompt, **no new values are proposed** (Track E owns feel targets).

| Constant | Value | Unit | Role | Scale flag |
|---|---|---|---|---|
| `DT` | `1/120` | s | Fixed sim timestep (120 Hz) | ⚪ |
| `WORLD_SCALE` | `1/15` | boundary m → game m | "shape sacred, size gamified" — shrinks the real bay ~15× | 🔴 concept disappears with authored region (native metres; master context fixes units = metres, sea level = y 0) |
| `KICK_IMPULSE` | `4.2` | m/s per kick (amp 1) | Surge banked per detected kick | 🟡 feel vs. 2 km traversal budget |
| `KICK_AMP_FLOOR` | `0.55` | — | Impulse floor so weak kicks still move | ⚪ |
| `SURGE_ATTACK_TAU` | `0.30` | s | Per-kick lunge attack | ⚪ |
| `GLIDE_TAU` | `6.0` | s | Proportional drag constant — the long glide | 🟡 (with speed, sets glide distance ≈ speed·τ) |
| `MAX_SPEED` | `16` | m/s | Cruise cap | 🔴 master context §7 adopts cruise ≈ 5 m/s for the 2 km region — flag only |
| `BURST_ACCEL` | `9` | m/s² | While burst held | 🟡 |
| `BURST_MAX_SPEED` | `22` | m/s | Burst cap | 🔴 master context §7 adopts burst ≈ 9 m/s — flag only |
| `PITCH_RATE` | `1.5` | rad/s | Pitch authority | ⚪ |
| `PITCH_MAX` | `1.0` | rad (~57°) | Pitch clamp | ⚪ |
| `ROLL_RATE` | `2.2` | rad/s | Roll authority | ⚪ |
| `ROLL_MAX` | `0.9` | rad | Roll clamp | ⚪ |
| `TURN_COUPLE` | `1.1` | — | Bank-to-yaw coupling (× speedFactor 0.35–1.0, saturating at 8 m/s) | 🟡 turn radius scales with speed; if speeds retune, radii change |
| `AUTOLEVEL` | full `2.2` / standard `1.1` / expert `0` | 1/s | Assist-ladder auto-level gains | ⚪ |
| `TRIM_SPEED` | `3.5` | m/s | Crouch/stretch vertical trim | 🟡 vs 80 m max depth |
| `SURFACE_Y` | `-0.4` | m | Resting ceiling below surface plane | ⚪ |
| `SEABED_CLEAR` | `1.2` | m | Soft floor clearance above seabed | ⚪ |
| `DEPTH_MIN` | `3.5` | m | Shallowest seabed near shore | 🔴 authored heightfield replaces the whole depth model |
| `DEPTH_MAX` | `34` | m | Depth cap | 🔴 region spec is 80 m max depth |
| `DEPTH_SDF_GAIN` | `0.5` | — | Depth ∝ √(shore distance) gain (×4 in formula) | 🔴 replaced by heightfield sampling |
| `ASSIST_DEPTH_FRAC` | `0.75` | — | Full Assist keeps y above −frac·localDepth | 🟡 revisit at 80 m depths |
| `SHORE_BAND` | `55` | game m | Soft containment current band | 🔴 tuned to the scaled bay; must relate to authored coastline scale |
| `SHORE_PUSH` | `10.5` | m/s² peak | Inward push (×t², frame-rate-neutralized `dt·60`) | 🟡 couples to speeds |
| `SHORE_YAW_ASSIST` | `0.9` | — | Full-Assist heading bias off the shore | ⚪ |
| `DRIFT_SPEED` | `1.6` | m/s | Full-Assist "stillness never strands" floor | 🟡 |
| `DRIFT_TAU` | `3.0` | s | Drift approach constant | ⚪ |
| `AUTOPILOT_LEVEL_TAU` | `0.8` | s | Level-out on tracking loss | ⚪ |
| `BREACH_MIN_SPEED` | `10` | m/s | Breach eligibility speed | 🔴 if cruise/burst retune, breach must remain reachable-but-earned |
| `BREACH_MIN_VY` | `3.2` | m/s | Required upward velocity | 🟡 |
| `BREACH_GRAVITY` | `7.5` | m/s² | "dreamy, slightly sub-earth" ballistic gravity | ⚪ |
| `BREACH_REENTRY_KEEP` | `0.85` | — | Momentum kept on splash | ⚪ |
| `BREACH_COOLDOWN_S` | `1.0` | s | Re-breach cooldown | ⚪ |

Non-table scale-sensitive values inside `sim.ts` (**verified**): spawn seed `toGame(-10100, 16700)` "Central Bay, Alcatraz–Berkeley reach" with 60 m clearance search (`sim.ts:139-141`) — meaningless in the fictional region, replace with an authored spawn; `depthAt()` noise frequencies `0.011`/`0.047` per game-metre and amplitudes `6`/`2`/`−4` (`sim.ts:174-175`) — replaced by the baked heightfield; SDF gradient probe `e = 2` m (`sim.ts:237`); surface/floor soft-spring rates `dt*8`, assist `dt*6` (`sim.ts:285-290`); slide energy scrub `min(0.5, dt*4)` (`sim.ts:303`). In `swimControls.ts` (all ⚪ feel constants, **verified** lines 20-33): `SIGNAL_STALE_MS 350`, `MIN_CONFIDENCE 0.35`, `KEYBOARD_PRIORITY_MS 1500`, `LOSS_DECAY_TAU_S 0.25`, `REACQUIRE_SLEW_PER_S 2.0`, `BOOST_ENGAGE 0.75`/`BOOST_RELEASE 0.55`/`BOOST_HOLD_FRAMES 6`/`BOOST_REFRACTORY_MS 3000`/`BURST_DURATION_MS 1600`, `CROUCH_ON 0.35`, `TALL_ON 0.4`, `KB_KICK_HZ 1.6`. Camera (`camera.ts:8-11`): `BACK 7.5`, `UP 2.6`, `POS_TAU 0.35`, `LOOK_TAU 0.18`, FOV 68, far plane 900 🟡 (far plane and follow distances interact with fog/visibility spec from Track D).

**Note for Track E (flag, not proposal):** the sim's speed family (16/22 m/s) is ~3× the master context §7 defaults (5/9 m/s). Either the constants retune or the region reads smaller than intended; `01_NEW_DECISIONS_TO_MERGE.md` makes Ecco-fidelity the arbiter.

### 4.3 Containment/seabed sampling API surface — the re-point seam (Q2)

**Everything the sim knows about the world flows through five members of `SwimSim` plus one static import** (**verified**, `sim.ts`):

```ts
import { loadBoundary, pointInWater, signedDistanceToShore, type BoundaryData } from '@bodyarcade/world-data';
import boundaryJson from '../../../../packages/world-data/data/boundaries/san-francisco-bay.json';

class SwimSim {
  readonly boundary: BoundaryData;                    // loadBoundary(boundaryJson) in ctor
  toGame(bx, by): [number, number]                    // bx·WORLD_SCALE, −by·WORLD_SCALE (z = −north)
  toBoundary(x, z): [number, number]                  // inverse
  shoreDistance(x, z): number                         // signedDistanceToShore(...)·WORLD_SCALE, + = water
  inWater(x, z): boolean                              // pointInWater(boundary, ...)
  depthAt(x, z): number                               // DEPTH_MIN + 0.5·√(shoreDist)·4 + valueNoise2 − 4, capped DEPTH_MAX
}
```

Consumers of these primitives (**verified**): the containment current + slide guard (`step()`), the vertical clamps (`depthAt`), spawn search, `world.ts` seabed displacement + surface sizing + shimmer rings (`boundary.bbox`, `boundary.polygons`), `decor.ts` placement gates, `minimap.ts` (polygons + attribution), `game.ts` eval handle (`inWater`, `shoreDist`, `depthHere`), and `hud.ts` (attribution string via `boundary.source.attribution`).

**Re-point contract for the authored region:** implement the same five members over (a) an authored **shoreline mask** (replaces `pointInWater` + `signedDistanceToShore`; the mask can be a polygon set in exactly the existing `bodyarcade-boundary/1` polygon convention, or a signed-distance texture) and (b) a **baked heightfield** replacing `depthAt` (note sign: `depthAt` returns positive-down water depth; a shared-terrain heightfield gives `terrainHeight`, so `depth = seaLevel − terrainHeight` where negative means exposed land). Delete `WORLD_SCALE`/`toGame`/`toBoundary` (authored data is already in game metres) or keep them as identity for replay compatibility. The `world-data` upgrade path already exists: V2's `bodyarcade-world/1` schema carries a u16 heightfield + `heightAt()` + `worldPointInWater()` and *embeds the same polygon convention* ("the sibling water-only artifact `bodyarcade-boundary/1` … remains supported" — `WORLD_SCHEMA.md` @ `feat/openworld`, **verified**). One caveat: `loadWorld()` "refuses artifacts missing OpenStreetMap attribution" (**verified**, `WORLD_SCHEMA.md`) — an authored fictional region needs either a schema-conform authored artifact with its own attribution lines or a relaxed loader variant (Finding F6).

### 4.4 BodySignal shapes and transport topology (Q3)

**Message shape** (**verified**, `packages/body-input/src/types.ts:100-122` @ `05b4801`):

```ts
interface BodySignal {
  v: 1;                       // schema major — receivers drop mismatches
  ts: number;                 // ms, monotonic, input-frame derived — dedupe key across dual transports
  confidence: number;         // 0..1, decays on loss
  seated: boolean;
  stillness: number;          // 0..1
  neutralConfidence: number;  // 0..1
  axes: { leanX, leanY, crouch, tallness, armsOut, armsRaised, handsForward, handPoint };  // all normalized
  events: ('recenter' | 'action')[];   // closed set in v1, transition-fired
  tracking?: { torso|head|leftArm|rightArm|leftLeg|rightLeg: 'visible'|'predicted'|'relaxed' };  // PPC, additive
  stroke?: { active, count, rate, phase, ampL, ampR };   // rowing block, additive
  swim?:   { active, count, rate, phase, amp };          // dolphin kick block, additive
}
```

**Topology** (**verified**, `transport.ts` + `swimControls.ts` + root `vite.config.ts`):

1. **BroadcastChannel** `'bodyarcade.body-input.v1'` (`DEFAULT_CHANNEL`) — primary transport, **origin-scoped**; the receiving source drops any message with `v !== 1` with a one-time console warning. This is why games are served from the producer's origin via root-Vite middleware ("two dev-server ports are two origins — the Gate-2 failure", root `vite.config.ts:10-14`).
2. **postMessage envelope** `{ t: 'bodyarcade.body-input.v1', signal }` — relay path when the producer window opens the game; the receiver runs `assertSignalShape(signal)` and silently drops non-conforming payloads (the runtime privacy boundary).
3. **Dedupe:** consumers ignore a signal whose `ts` equals the last seen — the same signal arriving on both transports counts once (`swimControls.ts:78`).
4. Kicks are consumed as **count deltas** (`swim.count` increments), never rates — the consumer accumulates `pendingKicks` and clears on keyboard priority.

**What `apps/shared-world` must do to receive body input:** (a) be served same-origin (its own `base:`-prefixed static middleware on the root server, §11) **or** boot its own producer via `createPoseRuntime` (v4-base pattern — election `'strict'` yields to an existing producer, `?pp=companion` forces external); (b) `createBroadcastSource().subscribe(...)` + a `message` listener for the envelope with `assertSignalShape`; (c) dedupe by `ts`; (d) gate on staleness (350 ms) and confidence (0.35); (e) keep keyboard-priority merge. Porting `swimControls.ts` verbatim delivers all of this.

### 4.5 Camera states/behaviors (Q4)

`camera.ts` (**verified**, 45 lines) implements a single always-on state — there is no state machine:

- Spring-damped chase: position target = dolphin − heading·7.5 m + 2.6 m up, exponential catch-up `1 − exp(−dt/0.35)`; look target = dolphin + heading·4 m + 0.6 m up at faster `τ = 0.18` s. Never cuts or snaps (comment: "Restraint is the feature").
- **Breach lift:** in `air` phase, +2.2 m target lift, capped so "camera may poke above water on a breach" (`min(…, 6)`).
- **Banked-roll coupling:** `camera.rotateZ(−s.roll·0.22)` — "the PS2 arcade read".
- FOV 68°, near 0.1, far 900.

**Worth preserving (inference):** all three behaviors — this is exactly the restrained follow the master context's preserved-feel list wants, and the breach lift is the mode-continuity money shot. What it lacks for the new slice (half-submerged handling, above/below transition, collision with terrain/caves) is Track B/D territory; the master context already assigns waterline camera behavior to jeantimex's above/below mechanisms. No competing camera exists in the app (no free-cam, no orbit).

### 4.6 The Playwright harness, test by test (Q5)

`tests/dolphin.spec.ts` (**verified**, 11 tests, one suite, headed Chromium, workers 1). Signals are injected via a rAF **postMessage pump** (`startSwimPump()`) writing synthetic `BodySignal`s with a `swim` block; a `__DOLPHIN.test` hook allows intent override, teleport, yaw set, assist set, and the synchronous `runScript` replay digest.

| # | Test | Asserts |
|---|---|---|
| 1 | boots in the bay | `inWater`, `shoreDist>0`, `depthHere>2`, `#hud-attrib` contains "OpenStreetMap", minimap painted >500 px |
| 2 | keyboard fallback | Shift kicks: speed +1 and ≥3 kicks in 3 s; W dives ≥0.5 m; D yaw +0.15 rad |
| 3 | impulse-and-glide | settled speed at 0.9 Hz > 1.25× settled at 0.4 Hz (cadence coupling); after stopping, 3 s later speed > 0.35× settled (glide, never dead stop) |
| 4 | lean pitch signed | leanY 0.7 → y < −8; leanY −0.7 → rises ≥2 m |
| 5 | lean roll signed | leanX ±0.6 → yaw ±0.2 rad in the lean's direction |
| 6 | burst | handsForward 0.9 → speed >17 within 6 s |
| 7 | **containment battery** | self-locates near shore (<130 m), then 8 yaw directions × 11 s full burst: `inWater` **every 200 ms sample**, `minShore > −0.5` (slide tolerance), `minSpeed > 1.2` (redirected, not pinned), `maxDecel < 6` per 200 ms (no wall hit) |
| 8 | breach positive + negative | wind-up dive + sprint + pitch-up → `breachCount ≥ 1`, splash, returns to `swim`; then bleed speed <6 and hold pitch-up 6 s → **no** new breach, phase stays `swim` (surface spring holds) |
| 9 | tracking loss | kill pump → pitch decays with `maxStep < 0.12 rad`/100 ms (measured 0.089 recorded), tracking ∈ {none, stale, autopilot, low-confidence}, speed >0.4 (glides); recovery to `live` ≤5 s with ≤2 stacked kicks |
| 10 | **replay determinism** | identical 4-segment script → identical trajectory digest twice in-page **and** after a full page reload |
| 11 | performance | `simHz > 100` always; `fps > 45` **only when `DOLPHIN_GPU=1`**; otherwise fps recorded + logged ("under software GL") |

Results are written to `eval/dolphin-results.json` (committed artifact, **verified**: fps 60.01 / simHz 120.02 / gpuRun true on 2026-07-11).

`tests/topology.spec.ts` (**verified**): builds the dolphin app if `dist/` missing, launches headed Chromium with a **fake webcam** (`--use-file-for-fake-video-capture=fixtures/fullbody.y4m`), boots PosePuppet as producer on `PP_PORT`, opens `/dolphin/` on the SAME origin, and asserts `gotBroadcast === true`, signal age <500 ms, at least one axis moving across 2 s (live tracker, not a stuck frame), and `tracking === 'live'`. **Self-skips when the gitignored fixture is missing.**

**What assumes `DISPLAY=:2` / the remote box (Q5b, verified):** nothing in the spec code itself — the specs only require *headed* Chromium ("headless WebGL is compositor-throttled", both spec headers). The remote coupling is entirely conventions around them: the README's GPU invocation `DOLPHIN_GPU=1 DISPLAY=:2 npm test`; `shots.mjs`'s "Run with DISPLAY=:2" comment; `playwright.config.ts`'s PP_PORT-pinning workaround for the remote box's stale foreign dev server; and the root-level remote harness (§10). On macOS, headed Chromium needs no DISPLAY variable — the suite as written should run with `DOLPHIN_GPU=1 npm test` alone (**inference**; §10 gives the migration plan).

### 4.7 Three.js 0.172 → 0.184 port surface + port plan (Q6; Deliverable 4)

Verified by reading every import in the preserve set:

| File | Three.js usage | Port action |
|---|---|---|
| `sim.ts` | **none** | copy unchanged (only the §4.3 data re-point) |
| `swimControls.ts` | **none** | copy unchanged |
| `camera.ts` | `PerspectiveCamera`, `Vector3` (+ `.lerp`, `.copy`), `Object3D.lookAt/rotateZ` | stable core API across 0.172→0.184; recompile and run — no known breaking change in these symbols (**inference**: verify against the 0.173–0.184 migration notes at port time) |
| `game.ts` (shell, being rewritten anyway) | `WebGLRenderer`, `Scene`, `Group` transforms, `BufferGeometry`+`BufferAttribute`, `PointsMaterial`, `Points`, `AdditiveBlending` | all stable; but the shell is recreated around jeantimex's pipeline regardless |
| `world.ts`, `decor.ts`, `dolphinMesh.ts` | heavy (Lambert/Basic materials, InstancedMesh, onBeforeCompile shader patch, FogExp2) | **replace wholesale** — port surface is moot |

Port plan steps:

1. Scaffold `apps/shared-world` with `three@^0.184` (matches jeantimex and the repo root — **verified**: root `package.json` already pins `three ^0.184.0` on v2-base, v4-base, and mac-prep; only `apps/dolphin` and the TinySkies fork pin 0.172).
2. Copy `sim.ts` minus the two `@bodyarcade/world-data` imports and the `boundaryJson` static import; introduce a `WorldSampler` interface (`inWater`, `shoreDistance`, `depthAt`) injected into the constructor; first implementation may literally wrap the old boundary functions against an authored polygon set to keep replays byte-stable.
3. Copy `swimControls.ts` unchanged (alias `@bodyarcade/body-input` in the new app's Vite config exactly as `apps/dolphin/vite.config.ts` does).
4. Copy `camera.ts`; recompile under 0.184 typings.
5. Recreate `game.ts`'s accumulator loop + `__SHARED_WORLD` eval handle (rename of `__DOLPHIN`, same shape incl. `runScript`) inside the jeantimex render loop.
6. Line categories touched, exhaustively: import specifiers (package aliases + boundary JSON), the `WorldSampler` seam, the eval-handle global name, and nothing else in the preserve set. **No Three.js API rewrites are required in the preserve set.**

### 4.8 Bay-scale constants needing 2 km re-tune (Q7)

Covered by the 🔴/🟡 flags in §4.2. The 🔴 set: `WORLD_SCALE` (concept retired), `MAX_SPEED`, `BURST_MAX_SPEED`, `DEPTH_MIN/MAX/SDF_GAIN` (replaced by heightfield), `SHORE_BAND` (55 m band was tuned against a ~4 km scaled bay; the 2 km region's coastline density differs), `BREACH_MIN_SPEED` (must stay reachable if the speed family retunes), and the hardcoded spawn. The 🟡 set: `KICK_IMPULSE`, `GLIDE_TAU`, `TURN_COUPLE`, `TRIM_SPEED`, `ASSIST_DEPTH_FRAC`, `SHORE_PUSH`, `DRIFT_SPEED`, `BREACH_MIN_VY`, camera `BACK/UP`/far-plane 900 (interacts with Track D fog/visibility). No values proposed — Track E owns feel targets; `01_NEW_DECISIONS_TO_MERGE.md` directs comparison against Ecco itself.

---

## 5. The base-branch question (Q8, Q9)

### 5.1 What `bodyarcade-v4-base @ 493dd24` is (Q8) — **explained, verified**

`bodyarcade-v4-base` = `bodyarcade-v2-base` + exactly 10 commits (**verified** `git log 99df0bc..493dd24`):

| Commit | What it is |
|---|---|
| `dab722f` | V1 P0: audit + extraction plan |
| `7c8350e` | V1 O1: extract `packages/pose-runtime`; Full App boots on it |
| `7da3e44` | V1 O2+O3: `packages/pose-hud`; TinySkies/Rowing/Dolphin run body-controlled with **no PosePuppet tab** |
| `ffd555f` | V1 O4: worker detection, perf table, boundary evidence — **V1 complete** |
| `4c77e96` | V2: verified source endpoints + region shortlist — **Ísafjörður default** |
| `ccb9f4c` | V2: offline worldbake pipeline — pilot region baked, 35 checks green |
| `5cfe69d` | V2: CLI docs proven — **Friday Harbor baked from the README alone**; hardening |
| `9e2c3e2` | V3: gait detection + `packages/locomotion` + `apps/walking` graybox — handed to V4 |
| `67377b9` | merge: integrate world data into V4 baseline |
| `493dd24` | docs: restore EVAL_NOTES sections dropped by the V3 commit |

Net content vs v2-base (**verified** `git diff --stat`): 170 files, +53,367/−1,285 — new `packages/pose-runtime`, `packages/pose-hud`, `packages/locomotion`, `tools/worldbake`, `apps/walking`, world.json artifacts, plus the Runtime+HUD retrofits into the three game apps. Relative to `local/v2-base-mac-prep` it differs by an entire lineage (§2.2): v4-base has dolphin + rowing-rebuilt + V1–V3; mac-prep has none of these, and mac-prep's own unique commits are remote-dev infra (`68ac9a3`), the NVIDIA opt-in harness (`5fc3fbf`), and two docs commits.

### 5.2 Is mac-prep the right base? **No.** (Q9)

**Verified evidence:** `git ls-tree 60b034c apps/` → `apps/flight` only. `git merge-base --is-ancestor` shows neither `05b4801` (Dolphin) nor `c8cdafa` (Rowing Gate-2) nor `99df0bc` (v2-base) is in its history. Building `apps/shared-world` on it would mean cherry-picking the entire Dolphin app, both shared packages' dolphin-era changes, and the V1–V3 work across a divergent line.

**Proposed location (location only, not strategy):** branch `apps/shared-world` work from **`origin/bodyarcade-v4-base @ 493dd24`** (create a local branch; none exists). Rationale: it is the only ref containing, simultaneously, the preserve set (`apps/dolphin` identical to `05b4801` in the preserve files), the Runtime+HUD packages the boot pattern needs, the V2 world-artifact loader the authored region can re-point through, and the V3 locomotion package the future Walking mode consumes. `apps/dolphin` stays untouched on it as the reference implementation, exactly as §4.5 of the master context prescribes.

Worth carrying over from mac-prep afterwards (docs only, optional): `60b034c`'s final verification summary in `EVAL_NOTES.md` and `docs/BODYARCADE_PROMPT_PACK_V2.md` are *records*; note that the summary describes V1–V3 suite runs (including "the 24 new V3 specs" and `apps/walking` 9/9) that were executed on the *other* lineage's worktrees — the summary is on mac-prep but the code it verifies is in v4-base (Finding F1). The Mac-relevant fixture fallback in mac-prep's `playwright.config.ts` (cached-Y4M-else-local-fixtures) also exists on the other line — nothing uniquely "mac-prep" is actually macOS-specific (**verified**: its infra commits are for the remote Ubuntu box; the branch name oversells it).

---

## 6. V1–V8 outcome table (Q10; Deliverable 7)

Verdicts from repository evidence only; the pack's own status table was not trusted. "Wanted?" applies the master context's current decisions (one style, fictional region, local-only, checkpoint gates).

| Prompt | Branch/commit evidence | Verdict | What remains | Remainder still wanted? |
|---|---|---|---|---|
| **V1** Runtime + HUD | `feat/pose-runtime-hud @ ffd555f`; merged into `493dd24`. Packages `pose-runtime` + `pose-hud` exist; dolphin/flight retrofits verified (`493dd24:apps/dolphin/src/main.ts`); boundary law + consumers documented in package README. mac-prep's committed summary records suites green. | **Completed** (verified code + committed eval summary) | Nothing found in-repo. Human checks S1–S3/S11 live in FINAL_USER_TEST_PLAN (the pack's autonomy policy is retired, so the "one final pass" concept is superseded by checkpoint gates). | Yes — `apps/shared-world` should boot via `createPoseRuntime` (v4-base dolphin pattern). |
| **V2** World pipeline | `feat/world-data-v2 @ 5cfe69d`; merged into `493dd24`. `tools/worldbake`, `WORLD_SCHEMA.md` (`bodyarcade-world/1`), baked `isafjordur` + `friday-harbor` world.json artifacts, golden-file tests (35 checks noted in commit). | **Completed** (verified artifacts + schema) | Nothing per its own scope. | **Partially superseded:** OSM/real-world *sourcing* is retired with the fictional region (master context §1.1), but the artifact schema, loader (`heightAt`, `decodeHeights`, `worldPointInWater`, nav graphs, spawns/transitions) is exactly the baked-region contract Stage 3 needs. Caveat: `loadWorld()` hard-requires OSM attribution (F6). |
| **V3** Walking locomotion | `feat/walking-locomotion @ 9e2c3e2`; merged into `493dd24`. `packages/locomotion` (controller, model, coach, INTEGRATION.md written for V4), `apps/walking` graybox + its own Playwright config; mac-prep summary records gait 9 / locomotion 10 / walking-eval 5 specs green + graybox 9/9. | **Completed** (verified code; eval summary committed on the other lineage — F1) | Real gait-clip validation was deferred by design (synthetic streams carried it). | Yes — donor for the future Walking mode over the shared region (checkpoint 14). |
| **V4** Open World | `feat/openworld @ ed1bb7a` (unmerged; forked from v4-base). Full O0–O9 commit ladder verified (§2.2 list); `REUSE_MAP.md` documents read-only consumption of V1/V2/V3 + Dolphin boundary surface; Ísafjörður world.json with nav/spawns/transitions; O5 adapted the PS2 dolphin onto real sea polygons + bathymetry; O7 records "23/23, 60 fps on :2". | **Completed on its own terms — presentation-superseded.** Per the governing instruction: the "three style profiles" deliverable (low-poly O2–O7, realistic O8, fantasy O9) is superseded by the one-style decision even though fully built. The real-world-region premise is likewise superseded (fictional region). | Nothing to finish; the branch is a donor, not a base. | **Machinery yes, presentation no:** `WorldRuntime` loader pattern, mode controllers (`src/modes/*`), `transitions.ts` + baked transition points, cross-profile consistency test pattern, `bodyDrive.ts`. Its profiles/ art passes are dead under one-style. |
| **V5** Character Control | `feat/character-control @ e2aac2d` (unmerged; forked from `ffd555f`). Single squashed commit: `data/avatar-capabilities.json`, `pose-runtime/src/handFusion.ts`, face-touch/feet modules, 7 committed eval artifacts (`eval/results-v5-*.json`). | **Completed** (verified code + eval artifacts; single-commit squash so milestone history is internal) | Nothing found. | Orthogonal to the shared-world slice (PosePuppet-app expressiveness). Keep; no action for Stage 3. |
| **V6** Motion Memory 2 | `feat/motion-memory-2 @ ab62780` (unmerged; forked from `ffd555f`). Library/trim/mirror/thumbnail/store modules + `docs/MOTION_MEMORY.md`. | **Completed** (verified code; commit declares verified mirror) | Nothing found. | Orthogonal to the slice. Keep. |
| **V7** Recording v2 | `feat/recording-v2 @ eac6c4d` (3 commits over V6's; unmerged). `packages/…` segmentation work, `docs/RECORDING.md`, seg-quality evals + labels committed. | **Completed** (verified code + eval artifacts) | Nothing found. | Orthogonal to the slice. Keep. |
| **V8** Public Narrative | No `docs/narrative` branch (`git ls-remote 'refs/heads/docs/*'` empty); no `narrative/` directory on any lane tip; `POSTS.md` on all branches is the older "pass 2 — instrument pass" file predating the pack. | **Absent** (not started, per all evidence searched) | The entire prompt. | **Open decision** — V8 is orthogonal to Stage-2/3 and was scoped to run last; whether it is still wanted under the new direction is a user call (Needs-user #3). |

Integration status caveat (**verified**): V4–V7 live on four mutually unmerged branches. V5/V6/V7 fork from V1-complete and therefore do **not** contain V2/V3/V4 or even v4-base's merge. Nothing verified working is recommended for rebuild; no defects were found in any lane during this audit. The unmerged state is a *repo-hygiene fact*, not a gap in the prompts' own scopes.

---

## 7. Branch disposition table (Deliverable 8)

| Branch | What it is (verified) | Disposition for the new work |
|---|---|---|
| `origin/bodyarcade-v4-base @ 493dd24` | v2-base + merged V1+V2+V3; fullest integrated tree | **Base branch — build `apps/shared-world` from here** (proposal, §5.2) |
| `bodyarcade-dolphin-fable @ 05b4801` | Dolphin P4 ship | **Read from** (reference implementation; preserve set identical on v4-base) |
| `bodyarcade-v2-base @ 99df0bc` | Extraction commit; dolphin+rowing+flight, pre-V1 | Read for provenance; superseded as base by v4-base |
| `local/v2-base-mac-prep @ 60b034c` | Parallel lineage: remote-dev infra + NVIDIA harness + prompt-pack docs + verification summary; **no dolphin** | **Do not base on it.** Read its two docs commits as records only |
| `bodyarcade-rowing-fable-rebuilt @ c8cdafa` | Rowing Gate-2 round 2 (in v4-base's history) | Donor — rowing systems (§8); no checkout needed, content present in v4-base |
| `bodyarcade-rowing-fable @ 5ce96fa` | Earlier rowing lane + a Linux/blender chore | Ignore (superseded by rebuilt) |
| `bodyarcade-flight-fable @ 07ec2f5` | Flight GATE 3 (in v4-base's history) | Donor — flight systems + permission record (§8) |
| `main @ 940d31c` | Merge PPC (2026-07-07) | Ignore for the slice; stale relative to all bodyarcade lines |
| `ppc-complete @ 922077b` (= `predictive-pose-continuity-fable`) | PPC acceptance | Ignore (PPC content flows through v4-base / pose-runtime) |
| `feat/pose-runtime-hud`, `feat/world-data-v2`, `feat/walking-locomotion` | V1/V2/V3 lanes | Ignore as branches — fully merged into v4-base |
| `feat/openworld @ ed1bb7a` | V4 complete (unmerged) | **Read from** as donor (WorldRuntime/modes/transitions patterns); do not merge; profiles superseded |
| `feat/character-control`, `feat/motion-memory-2`, `feat/recording-v2` | V5/V6/V7 complete (unmerged, fork from V1) | Ignore for the slice (PosePuppet-app features); leave as-is |
| `origin/backup/*`, `archive/*`, `cleanup/*`, `aero-glass-*`, `hard-model-fix`, `pass-2-instrument`, `infra/remote-development-rebuild` | Backups / unrelated experiments / infra | Ignore |

---

## 8. Donor-systems inventory (Q11; Deliverable 9)

**Rowing is not an `apps/rowing`** — it lives inside the TinySkies fork (**verified** on `c8cdafa`):

| System | Path (@ `c8cdafa`, all present in v4-base) | Reuse notes |
|---|---|---|
| Body rowing controller | `apps/flight/client/src/input/rowControls.ts` (455 ln) | Consumes the `stroke` block; stroke→impulse queue, two steering profiles (asymmetry vs lean), assist ladder, cruise-on-momentum, autopilot, keyboard priority. Deliberately separate from flight's controller (header cites DECISIONS 2026-07-09). The **impulse-and-glide model the dolphin sim inherited** — its constants (`FULL_STROKE_AMP 0.45` measured from fixtures) show the fixture-measured tuning method. |
| Boat vehicle | `apps/flight/client/src/game/Boat.ts` (339 ln) | Sphere-surface boat: cruise/brake/accel constants, freeboard, coast decay; uses `SphericalMath` (`moveOnSphere`, `tangentFrame`, `buildBoatMatrix`) — globe-specific, so the *pattern* (impulse boat + surface clamp) transfers, the math mostly does not. Oar-water interaction for the new slice is jeantimex's displacement-object pattern per master context §12.1, not this. |
| Boat mesh / wake / NPCs | `apps/flight/client/src/game/{BoatMesh,NpcBoats}.ts`, `WakeTrail` (in fork) | Presentation-superseded (one style), reference only. |
| Rowing HUD | `apps/flight/client/src/ui/RowingHUD.ts` | Pattern donor for stroke-rate HUD. |
| Flight body controller | `apps/flight/client/src/input/bodyControls.ts` (531 ln, @ `07ec2f5`) | The original consumer discipline: profiles, assists, autopilot, T-pose recenter, keyboard merge — the lineage of `swimControls`. |
| Flight tuner overlay | `apps/flight/client/src/input/flightTuner.ts` | Live raw→intent→vehicle tuning overlay — useful pattern for Track E feel-tuning sessions. |
| Camera rig | `apps/flight/client/src/game/CameraRig.ts` (279 ln) | Vehicle-follow rig with altitude behaviors (globe-based). Reference for mode-camera blending; the dolphin `ChaseCamera` remains the slice's starting point. |
| Altitude/terrain sampling | `apps/flight/client/src/game/{TerrainSurface,SimplexNoise,SphericalMath}.ts` | Globe-specific; concept donor only. |
| TinySkies permission record | `07ec2f5:ASSETS.md:136-140` | Quoted in full: *"TinySkies / GlobeFly by Danny Limanseta is used with permission — https://github.com/dannylimanseta/tinyskies. The permission record is retained privately (gitignored); public attribution is the line above, in-app credits, and the README section."* **`LICENSE_NOTES.md` does not exist** on `07ec2f5`, `05b4801`, `493dd24`, or `60b034c` (**verified** `git ls-tree | grep -i license` — empty) → Finding F2. |
| Walking locomotion | `packages/locomotion/` (v4-base): `controller.ts`, `model.ts`, `coach.ts`, `defaults.ts` + `INTEGRATION.md`; graybox `apps/walking/` | Written for V4 integration: `createWalkController(window)`, `createLocomotion()`, `loco.step(ts, intent, pathHint)`; comfort caps enforced at output ("may be lowered, never raised" — REUSE_MAP). Direct donor for checkpoint-14 Walking. |
| Open-world machinery | `apps/openworld/src/{world/runtime.ts, modes/*, transitions.ts, drive/bodyDrive.ts}` (@ `ed1bb7a`) | Mode-manager + fade/spawn transitions + per-mode controller seams over one world artifact — the closest existing sketch of "one region, four modes". Its dolphin mode (`modes/dolphin.ts`, O5) adapted the PS2 sim onto `world.json` sea polygons + real bathymetry — read it before writing the shared-world re-point (it has already solved the same seam once). |
| World artifact + bake | `packages/world-data/src/world.ts`, `WORLD_SCHEMA.md`, `tools/worldbake/` (v4-base / openworld) | The `bodyarcade-world/1` heightfield/nav/spawn/transition contract (§4.3 caveat F6). |
| PPC | pre-V1 `src/pose/continuity.ts`; post-V1 inside `packages/pose-runtime/src/continuity.ts` (**verified** both paths) | Consumed automatically via the runtime; nothing to do. |

---

## 9. `@bodyarcade/body-input`: versioning, consumption, capability negotiation (Q13)

**Versioning (verified**, `CHANGELOG.md` policy header + `transport.ts`): `BodySignal.v` is the schema major. Additive fields bump the package **minor** and keep `v: 1`; breaking changes bump `v` and the package major. Consumers pin the package and check `v` at runtime; `createBroadcastSource` **drops** mismatched majors with a one-time warning (never throws). Current: package `1.0.0`, schema `v: 1`.

**Consumption:** monorepo-internal via Vite alias to source (`packages/body-input/src/index.ts`) — no npm publishing, no build step (**verified** in root + dolphin Vite configs). `sideEffects: false`, `"exports": { ".": "./src/index.ts" }`.

**Capability negotiation: none exists in the protocol** (**verified** — no negotiation/handshake surface in `types.ts`, `transport.ts`, `schema.ts`, `index.ts`). What exists instead is **additive optional blocks**: `tracking?`, `stroke?`, `swim?` — "consumers that ignore this field lose nothing" (types.ts comments). Producers emit blocks per their pipeline config; consumers feature-detect by presence (e.g. `hipsQuiet: latest.swim === undefined` drives the dolphin coach line — `swimControls.ts:222`). The master context's phrase "capability negotiation" most plausibly maps to this additive-block pattern plus V1's **producer election** (Web Locks `bodyarcade-pose-producer`, `election: 'strict' | 'claim'`, `?pp=companion` → `forceExternal` — pose-runtime README, **verified**). Note the *other* "capability manifest" in the repo (V5's `data/avatar-capabilities.json`) concerns avatar rigs, not body-input — don't conflate (Finding F5).

**What `apps/shared-world` must declare:** nothing formal. It must (a) consume schema `v: 1` and tolerate unknown additive fields; (b) feature-detect `swim` and degrade with a coach hint when absent; (c) if it boots its own runtime: `createPoseRuntime({ model: 'lite', worker: true, election: 'strict', forceExternal: params pp===companion })` — lite is measured-safe for the kick signal (chest–hip extent, no wrist depth; dolphin README + main.ts comments, **verified**); (d) request nothing about landmarks — they are unavailable by design.

---

## 10. Local-macOS verification migration (Q12; Deliverable 6)

### 10.1 Complete inventory of remote-GPU/`DISPLAY=:2` assumptions (**verified** by grep across `60b034c`, `05b4801`, `493dd24`)

| Artifact | Remote assumption | Local macOS replacement |
|---|---|---|
| Root `playwright.config.ts` (all lines) | `USE_SWIFTSHADER=1` injects SwiftShader args (remote headless functional tier); `POSEPUPPET_GPU_TESTS=1` + `POSEPUPPET_GPU_DISPLAY=:N` defines the headed NVIDIA tier with `env: { DISPLAY }`; fixture fallback prefers remote cache path `.local/cache/fake-camera/` | Run the default project headed on native macOS Chrome — no SwiftShader, no DISPLAY. The gpu tier's *assertions* fold into the default run since the Mac GPU is real. Keep the env-gating harmless (unset = native). Fixture fallback already handles the Mac path (`fixtures/arms.y4m`). |
| `apps/dolphin/README.md` | "fps floor asserted on GPU runs: `DOLPHIN_GPU=1 DISPLAY=:2 npm test`" | `DOLPHIN_GPU=1 npm test` — the spec only checks `process.env.DOLPHIN_GPU`; `DISPLAY` is meaningless on macOS. Update the README line in the new app. |
| `apps/dolphin/playwright.config.ts` | PP_PORT pinning comment: remote box's port 5173 could belong to a different checkout's persistent server | Keep `strictPort` pinning (harmless, good hygiene); the remote rationale disappears. |
| `apps/dolphin/shots.mjs` | "Run with DISPLAY=:2" comment | Runs as-is on macOS headed Chrome. |
| `scripts/remote/*` (`test-all.sh`, `gpu-preflight.mjs`, `install.sh`, `doctor.sh`, `start/stop-arcade.sh`, `status.sh`, `prepare-fixtures.sh`, `print-handoff.sh`) — mac-prep lineage only | The whole remote Ubuntu harness: NVIDIA preflight (exit 1 on SwiftShader), state dirs under `~/.local/state/posepuppet`, tmux lanes | **Retire entirely** (policy already retired by master context §12.2). Not present on v4-base — nothing to delete on the chosen base; simply don't cherry-pick them. |
| `scripts/local/*` (tunnel/sync/fetch scripts) — mac-prep only | Mac-as-thin-client of the remote box | Retire. |
| `.claude/rules/remote-development.md` — mac-prep only | "Primary feature implementation occurs on the remote Ubuntu checkout… local Mac checkout is read-only" | Retire; local-only is the standing policy. Not on v4-base. |
| Prompt-pack conventions (`flock /tmp/bodyarcade-display2.lock`, `flock /tmp/bodyarcade-fullsuite.lock`, per-lane tmux/ports table) | Multi-agent remote serialization | Display lock: retire (no shared X display). Full-suite lock: unnecessary single-user, harmless if kept. Per-app dev ports (5173 root / 5197 dolphin / 5199 flight / new one for shared-world) remain good practice. |
| `EVAL_NOTES.md` final summary (`60b034c`) | Records runs on `:2` with `PP_PORT=5185`, logs under gitignored `.local/` | Historical record — keep as evidence, don't reproduce paths. |

### 10.2 Test-migration plan — what carries forward

Every assertion in §4.6 carries forward with these adaptations:

1. **Boot test:** drop the "attribution contains OpenStreetMap" assertion when the OSM source is retired; replace with the authored region's credit line (or asset credits). Keep minimap-painted only if the slice ships a minimap.
2. **Keyboard fallback, impulse-glide coupling, signed pitch/roll, burst, dropout, replay determinism:** carry verbatim (they exercise `sim.ts` + `swimControls.ts`, which are ported unchanged). Replay digests will change value the moment the world sampler changes — assert *self-consistency* (same script → same digest across reloads), not the old digest.
3. **Containment battery:** carry the structure (8 directions × sustained burst; never-exit + never-hard-wall + min-speed) but self-locate against the authored shoreline; the three thresholds (−0.5 m slide tolerance, 1.2 m/s min speed, <6 decel) restate as region-appropriate once Track E sets speeds.
4. **Breach positive/negative:** carry verbatim; this is the mode-continuity proof the checkpoints ladder centers on.
5. **Performance test:** keep `simHz > 100` unconditional; assert the fps floor **unconditionally on macOS** (native GPU always present) — the master context's target is 60 fps at ≈1728×1080, so the new floor/viewport come from §12.2 of the master context rather than the old 45 fps remote floor. Headed mode remains required (headless WebGL compositor-throttling is documented in three separate spec headers — **verified**).
6. **Topology test:** carry the producer→BroadcastChannel→game closed loop; it self-skips without `fixtures/fullbody.y4m` (gitignored, present locally only if the user has it — **unverifiable** here whether the fixture file exists on this machine; the test's skip guard makes that safe).
7. **HUD suite (v4-base `hud.spec.ts`):** carry for the Runtime+HUD boot (mount/collapse/keyboard/camera-denied paths).
8. **New four-shot fidelity test** (stock-demo comparison, master context §5.3) is Track B's to specify — the harness pattern (screenshot script à la `shots.mjs` + committed reference frames) already exists to host it.

---

## 11. `apps/shared-world` integration contract (Deliverable 5)

Concrete enough to scaffold with no further repo inspection; every element mirrors a verified existing pattern.

| Item | Contract |
|---|---|
| **Base branch** | Create local branch from `origin/bodyarcade-v4-base @ 493dd24` (no local branch exists — `git switch -c <work-branch> origin/bodyarcade-v4-base`). `apps/dolphin` remains untouched as reference. |
| **Location / name** | `apps/shared-world/`; package `{ "name": "@bodyarcade/shared-world", "private": true, "type": "module" }` (naming convention verified from `@bodyarcade/dolphin`). |
| **Three.js** | `three@^0.184` + `@types/three@^0.184` in the app's own `package.json` (apps own their renderer versions — verified pattern: root 0.184, dolphin 0.172, flight 0.172 all coexist). jeantimex vendored pristine inside the app (it is also 0.184/Vite/TS). |
| **Vite config** | Clone `493dd24:apps/dolphin/vite.config.ts`: `base: '/shared-world/'`; aliases → `../../packages/{body-input,pose-runtime,pose-hud}/src/index.ts` (+ `world-data` if the boundary-polygon sampler is reused); `server.fs.allow: ['..', '../..']`; dev port **5198** (unclaimed: 5173 root, 5174–5180 prompt-pack lanes, 5185 remote PP, 5197 dolphin, 5199 flight); `build: { outDir: 'dist', target: 'es2022' }`; include the `poseAssets()` middleware clone so standalone dev serves `/models` + `/mediapipe-wasm` from PosePuppet `public/`. |
| **Same-origin serving** | Add `sharedWorldStatic()` to root `vite.config.ts` — copy `dolphinStatic()` verbatim with `SHARED_WORLD_DIST = ./apps/shared-world/dist` and prefix `/shared-world/`; extend the MIME map with `.glb: 'model/gltf-binary'` (the dolphin asset). Add root scripts `"shared-world:build": "npm --prefix apps/shared-world run build"` and extend `"arcade"`. This is what makes BroadcastChannel reach the game (origin-scoped — the Gate-2 lesson, quoted in the middleware comment). |
| **Body input** | Port `swimControls.ts` unchanged (BroadcastChannel + postMessage envelope `bodyarcade.body-input.v1`, ts-dedupe, 350 ms staleness, 0.35 confidence, 1500 ms keyboard priority). Boot per `493dd24:apps/dolphin/src/main.ts`: `createPoseRuntime({ model: 'lite', worker: true, captureSize: { width: 640, height: 360 }, election: 'strict', forceExternal: ?pp==='companion' })`, `mountPoseHud(runtime, { safeArea, title: 'SWIM' })` unless `?hud=0`, expose `__PP_HUD` + `__POSE_RT`. Keyboard-only play must survive camera-denied (verified standing law). |
| **Sim port** | §4.7 steps: `sim.ts` + `swimControls.ts` + `camera.ts` copied; `WorldSampler` seam replaces the SF-Bay boundary import (§4.3); `game.ts` accumulator + eval handle recreated as `__SHARED_WORLD` around jeantimex's pipeline. |
| **Test wiring** | Clone `apps/dolphin/playwright.config.ts`: headed, workers 1, own webServer on 5198 + producer webServer on `PP_PORT` (default 5173); specs per §10.2; results to `eval/shared-world-results.json` (repo-root `eval/` is the committed-artifact convention — verified). fps floor asserted unconditionally on macOS. |
| **Assets** | Dolphin GLB at `apps/shared-world/public/models/dolphin/` with license file alongside (master context §10.3 drop-path); everything stays under the Vite `base` (dolphin convention: "all assets stay under the base — no root-absolute prefixes" except the pose-runtime `/models`+`/mediapipe-wasm` convention). |
| **Local dev commands** | Standalone: `npm --prefix apps/shared-world run dev` (port 5198, keyboard play + own runtime). Full topology: `npm run arcade` (builds apps, serves root :5173, game at `http://localhost:5173/shared-world/`). |

---

## 12. Findings list — undocumented or surprising (Q14; Deliverable 10)

- **F1 — The pinned "newest baseline" is a divergent lineage missing the Dolphin.** `local/v2-base-mac-prep` contains no `apps/dolphin`, no Rowing Gate-2, and does not descend from `bodyarcade-v2-base`; two near-duplicate "v2 baseline" prep commits exist (`99df0bc` vs `949ab7a`). Its committed "final verification summary" describes suites (V3 walking 24 specs, `apps/walking` 9/9) whose code is *not on that branch*. Master context §4.2's "Likely working base going forward" is contradicted by the tree. **Verified**, §2.2/§5.
- **F2 — `LICENSE_NOTES.md` does not exist anywhere audited**, while `FINAL_USER_TEST_PLAN.md` (both lineages) has "[x] Permission quoted in LICENSE_NOTES.md" and master context §4.2 says "Track A verifies LICENSE_NOTES.md". The actual permission record: `ASSETS.md` public attribution + a **privately retained, gitignored** permission file. Doc/code drift; the private file's existence is **unverifiable** from the repo. §8.
- **F3 — The V4–V7 lanes are complete but mutually unmerged**, and V5/V6/V7 fork from V1-complete (`ffd555f`), not v4-base — combining them later requires rebases the pack's wave plan anticipated but nobody executed. No action needed for the slice; recorded for repo hygiene. **Verified**, §2.2/§6.
- **F4 — V8 was never run** despite the pack's "already executed" framing covering V1–V8. **Verified** (no branch, no artifacts), §6.
- **F5 — "Capability negotiation" does not exist in `@bodyarcade/body-input`.** The protocol's versioning is v-major drop + additive optional blocks; the phrase in the master context most nearly matches V1's producer election plus block feature-detection. The only literal "capability manifest" in the repo is V5's avatar-rig manifest — a different system. **Verified**, §9.
- **F6 — `loadWorld()` hard-fails without OSM attribution** ("refuses artifacts missing OpenStreetMap attribution", `WORLD_SCHEMA.md`), and `loadBoundary()` likewise requires a non-empty attribution string (`world-data/src/index.ts:84-86`). Re-pointing to an authored fictional region must either supply authored attribution lines or use a loader variant — a small but load-bearing Stage-3 detail. **Verified**, §4.3.
- **F7 — Dolphin has no decor collision by design.** "containment currents + heading assist + the slide guard are the shipped answer for shorelines and pockets; there is no other collision geometry by design (no rocks/ruins collision…)" — `FUTURES.md` @ `05b4801`. The new slice's Rapier plan (master context §6.5) is therefore *new* capability, not a port. **Verified.**
- **F8 — Decor covers only a ~900 m disc around spawn**; "the whole scaled bay is ~4 km and fog hides everything past ~120 m… The decor field re-centers are a future polish note" (`decor.ts` header). The scaled world is ~4 km across at `WORLD_SCALE 1/15` — larger than the new 2 km region, useful scale intuition. **Verified.**
- **F9 — The sim's speed family (16 cruise / 22 burst m/s) is ~3× the master context's adopted defaults (5/9 m/s)** — a live tension routed to Track E (flag only, §4.8). **Verified.**
- **F10 — Root repo is already on `three ^0.184.0`** on every audited branch; only the game apps pin 0.172. The "0.172 → 0.184 port" is smaller than the master context implies: the preserve set has zero Three usage. **Verified**, §4.7.
- **F11 — Rowing has no dedicated app**; it lives inside `apps/flight` (TinySkies fork) as Boat + rowControls + RowingHUD. Master context §12.1's donor framing is accurate, but Stage 3 should not look for `apps/rowing`. **Verified**, §8.
- **F12 — Committed eval artifacts are a load-bearing convention**: repo-root `eval/*.json` (dolphin, flight, ppc, bodyinput, worlddata, v5 baselines…) are checked in as evidence and referenced by docs. The new app should follow it (`eval/shared-world-results.json`). **Verified.**
- **F13 — Secrets/CI:** no CI workflows found on audited branches (`.github` absent from tree listings); `.vercelignore` exists at root and TinySkies carries `.env.example`/`.env.production` files in-tree (env-file templates from upstream; contents not audited line-by-line beyond names — flag for the standard pre-public sweep). ASSETS.md notes the upstream AI-generated audio/3D assets ride on the author's grant, with a "verify commercial-output tiers with Danny before the repo goes public" note — an open licensing action beyond ODbL/TinySkies-permission. **Verified** (file presence), **inference** (risk weighting).
- **F14 — The design-source archive** at `/Users/lekan/Downloads/bodyarcade-current-design-source` matches its documented layout plus an undocumented `output/` directory (`combined_deduped.txt`, `combined_numbered.txt`) — post-extraction exports, harmless, noted for provenance cleanliness. Its extraction commit (`99df0bc`) predates V1–V8 outputs and the dolphin-on-v4 retrofit, consistent with its archive-only status. **Verified.**
- **F15 — Local repo state:** working tree clean on `bodyarcade-v2-base`; `bodyarcade-v4-base` and all seven `feat/*` lanes exist **only** as remote-tracking refs — Stage 3's first command materializes the base branch locally. **Verified**, §2.1.

---

## 13. Answered / Open / Needs-user

### Answered (with §)

1. Feel-constant table, complete with values/units/roles/scale flags — §4.2 (Q1).
2. Containment/seabed API surface + re-point contract — §4.3 (Q2).
3. BodySignal shapes, transport topology, same-origin constraint, shared-world requirements — §4.4, §9, §11 (Q3, Q13).
4. Camera behaviors and preservation verdict — §4.5 (Q4).
5. Playwright harness test-by-test + remote assumptions — §4.6, §10 (Q5, Q12).
6. Three.js port surface: **nil for sim/swimControls (zero imports)**; small stable-API surface in camera/game shell — §4.7 (Q6).
7. Bay-scale constants needing 2 km re-tune (flagged, no values proposed) — §4.8 (Q7).
8. `bodyarcade-v4-base` fully explained: v2-base + merged V1+V2+V3 — §5.1 (Q8).
9. Base-branch verdict: mac-prep **no** (missing Dolphin entirely), v4-base **yes** (location proposal only) — §5.2 (Q9).
10. V1–V8 outcomes, all eight, with SHAs and superseded-status of V4's profiles — §6 (Q10).
11. Donor inventory with file paths — §8 (Q11).
12. Local-macOS migration inventory + replacements — §10 (Q12).
13. body-input versioning + the true state of "capability negotiation" — §9 (Q13).
14. Undocumented/surprising findings F1–F15 — §12 (Q14).

### Open (not user-blocking; owned by later tracks or Stage 3)

1. **Exact Three.js 0.173→0.184 changelog cross-check** for `camera.ts`/`game.ts` symbols — expected clean (stable core API), to be confirmed mechanically at port time (§4.7). *Track/Stage 3.*
2. **Authored-region artifact format choice**: reuse `bodyarcade-boundary/1` polygons + a new heightfield, or a `bodyarcade-world/1`-conform authored artifact, plus the attribution-requirement handling (F6). *Track B decides the data schema; Stage 3 implements.*
3. **Whether `fixtures/fullbody.y4m` (and the other gitignored fixtures) exist on the user's Mac** — the topology and fixture-eval suites need them; the specs self-skip if absent. **Unverifiable** from the repo (gitignored by design). *Surfaces at first local suite run.*
4. **The privately retained TinySkies permission file** — existence asserted by ASSETS.md, unverifiable in-repo (F2). *Needs a one-time local confirmation; also the "confirm commercial-output tiers with Danny before going public" note (F13).*
5. **Speed-family tension** (sim 16/22 vs adopted 5/9 m/s) — recorded for **Track E** (feel targets); no values proposed here (F9).

### Needs-user

1. **Confirm the base-branch change**: master context §4.2 designates `local/v2-base-mac-prep` as the likely base; this audit shows it lacks the Dolphin app entirely and proposes `origin/bodyarcade-v4-base @ 493dd24` instead (§5.2). This is a location decision the user should ratify since it amends a pinned assumption in the governing document.
2. **Decide what, if anything, to salvage from mac-prep's two docs commits** (the v2 prompt pack copy + the final verification summary + FINAL_USER_TEST_PLAN skeleton) — cherry-pick the docs onto the working line, or leave them as historical records on mac-prep (§5.2). Low stakes either way.
3. **V8 (Public Narrative) disposition**: never run (F4). Still wanted later, re-scoped under the new direction, or dropped? Orthogonal to Stage 3; needs an owner decision eventually.
4. **Pre-public licensing sweep** (from F13): the TinySkies AI-asset verification note and the in-tree upstream `.env.production` template files should be reviewed before any public visibility change — user-owned since it involves contacting the TinySkies author.

---

*Report complete. No repository was modified: work was performed with read-only `git show`/`ls-tree`/`log`/`merge-base` against `/Users/lekan/Dev/posepuppet` (which remains checked out clean on `bodyarcade-v2-base @ 99df0bc`) and read-only filesystem listings of the design archive. No prompt-pack instruction was executed.*
