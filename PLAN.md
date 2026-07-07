# PLAN.md — BodyArcade Flight (TinySkies integration)

Status: **USER GATE 1b APPROVED 2026-07-07** (in-session structured reply):
plan approved; layout = PosePuppet at root + apps/flight; assets committed
with provenance-unverified flags, Lekan verifies with the author before the
repo goes public; P2 goes straight to native axes (no PWM crutch);
keyboard parity = the code's real behavior, not the stale README table.
Branch `bodyarcade-flight-fable`. The previous Pass 2 plan (shipped
2026-07-02) lives in git history at this path.

Permission: private record verified present and sufficient for a faithful
public fork with credit (gitignored, never quoted or committed). Public
attribution everywhere is exactly: "TinySkies / GlobeFly by Danny
Limanseta is used with permission" + repo link.

## 0. What P0 found (details in STUDY_NOTES.md)

- The fork is **already done and building**: `apps/flight/` (client +
  shared + server), analytics stripped, deploy glue excluded, 284 files.
- The integration seam is better than hoped: `FlightControls.getState()`
  returns a `ControlState` whose `turnRate` is already a continuous float,
  and Plane physics smooth all inputs — body axes drop in without touching
  flight math.
- Offline mode is small: exactly one mandatory intercept (world auto-join)
  plus four fire-and-forget endpoints to no-op. Terrain/world generation is
  already fully client-side and seed-deterministic.
- All three vehicles (plane/boat/carpet) are real, behind a declarative
  capabilities table — strong seams for Rowing/Dolphin later (FUTURES.md).
- PosePuppet baseline: suite green (72 passed / 5 skipped; one known
  boundary flake in headless SwiftShader passed on rerun), perf baseline on
  record in eval/results.json (pose ~29.7, render ~119, Apple M5).
- `@bodyarcade/body-input` v1.0.0 is complete with measured dead zones,
  BroadcastChannel transport, tapes, and its own green fixture evals — it
  is consumed as-is; any gap becomes an integration note, not a rebuild.

## 1. Architecture

```
posepuppet repo root  = the PosePuppet app (unchanged layout)
├── packages/body-input   @bodyarcade/body-input v1.0.0 (exists, consumed)
└── apps/flight           TinySkies fork — own npm workspaces + lockfile,
    ├── shared            own three@0.172 — installed/built independently,
    ├── client            never imported by PosePuppet code
    └── server            kept compiling; optional via docker-compose
```

**Deviation from the prompt's sketch, for approval:** PosePuppet stays at
the repo root rather than moving to `apps/posepuppet`. Moving it would
churn every path in the suite/eval rig for zero functional gain and risk
the "suite stays green" non-negotiable. `apps/` exists as of this pass;
a future pass can relocate PosePuppet if we ever want strict symmetry.

Body input crosses pages over BroadcastChannel (landmarks never cross —
enforced by the package's runtime shape guard). PosePuppet is the producer
(tracker + calibration + camera panel); the flight app subscribes with
`createBroadcastSource()`. The flight client aliases
`@bodyarcade/body-input` to `../../packages/body-input/src` (same pattern
PosePuppet uses today).

### Input merge design (P2)

`BodySource` implements the same `getState(): ControlState` contract as
`FlightControls`, from the latest `BodySignal`:

- `ControlState` gains optional continuous fields (`speedAxis?`,
  `elevateAxis?`) that Plane maps onto its existing accel/brake and
  elevateBlend paths; the keyboard producer fills them from its booleans.
  Keyboard behavior stays byte-identical.
- Merge rule: any keyboard activity in the last ~1.5 s → keyboard wins
  (fallback is sacred); otherwise body axes drive. Merge lives beside the
  `controls.getState()` call in `Game.tick` — one call site.
- Events: body `action` → Space semantics; `recenter` handled inside
  body-input (T-pose).

## 2. Phases, deliverables, estimates

Estimates are wall-clock working time, honest ±50%.

**P1 — Offline parity (~0.5–1 day).**
`WorldProvider` interface: `LocalWorldProvider` (default) generates/persists
worlds in localStorage using upstream's own seeded name generator + seed
math; `RemoteWorldProvider` wraps today's fetch+socket path (env-flagged,
`VITE_FLIGHT_SERVER=1`). No-op the lantern/save-feed/events posts in local
mode. Multiplayer keeps compiling. Deliverable: `cd apps/flight && npm run
dev:client` → full game, keyboard, no server, no Postgres, network tab
silent. Flight perf baseline recorded (render fps headed, same machine).

**P2 — Body input in (~1 day).**
Flight page subscribes to body-input; skip the key-emulation crutch (the
ControlState seam is clean enough to go native immediately — noted as the
prompt's permitted deviation). BodySource + merge + profile mapping layer
(data-driven axis→intent tables). Port the tuner overlay pattern from
body-input's PosePuppet integration into the flight page (raw → shaped →
plane response per axis, dead zone/gain/smoothing/expo sliders, profile
switcher, latency readout). Deliverable: lean_lr.y4m through the fake
webcam turns the actual plane.

**P3 — Feel Lab (~1–1.5 days).**
body-input already ships calibration-relative → One Euro → measured dead
zone → expo → slew; the flight side adds what's game-specific: per-profile
gain/expo/clamps, auto-level spring, assist ladder (Full Assist default /
Standard / Expert), tracking-loss autopilot (axes decay to neutral ~0.5 s —
package behavior — plane then flies straight and level, soft altitude
floor, smooth blend back), T-pose recenter already in-package. Profiles as
data: PILOT LEAN, SUPERMAN, HEAD PILOT (seated). Fixture-driven iteration
on all six clips; failure modes logged in DECISIONS.md.
**>> USER GATE 2: live flight session, 5-minute script provided; you pick
the default profile; iterate until feel sign-off.**

**P4 — Faithful experience complete (~0.5–1 day).**
Sweep upstream features for offline regressions (vehicles switchable,
landmarks, quests, races, upgrades, void world, day/night, audio).
In-game credit line in the menu/about. Minimal "Fly" entry card in
PosePuppet (opens flight page, starts producer, suspends the PosePuppet
stage renderer, lite pose model, small camera panel). Perf: 60 fps render
target / 45 floor with pose ≥ 15 fps, measured before/after.

**P5 — Ship (~1 day).**
Flight eval suite (below) + PosePuppet suite green; docs (README,
ARCHITECTURE.md, ASSETS.md final manifest, FUTURES.md globe-as-hub
proposal, EVAL_NOTES.md vision review, DEMO notes); eval/results.json
gains a `flight` section.
**>> USER GATE 3: final live acceptance.**

## 3. Verification plan

Fixtures drive PosePuppet's tracker through the existing y4m fake-webcam
harness; the flight app subscribes over BroadcastChannel in the same
browser context (two pages, one Playwright test).

- **Intent eval** (per clip): axis sign + magnitude windows, event
  detection; noise floors imported from body-input's measured defaults.
- **Closed loop**: lean_lr → sustained signed heading rate; still →
  heading drift + roll rate under thresholds; injected dropout → autopilot
  engages, altitude in band, no terrain contact, re-entry slew-bounded.
- **Replay**: recorded intent stream re-run → path within documented
  tolerance. The loop is variable-dt (clamped 50 ms), so the tape records
  per-frame dt; tolerance measured and stated honestly, not promised.
- **Keyboard parity**: scripted key sequence produces identical
  heading/speed/altitude traces in fork vs. reference build (one-time
  check at P1, then a regression spec on the fork).
- All results → eval/results.json; vision self-review of flight
  recordings in EVAL_NOTES.md.

## 4. Risks

1. **Two Playwright pages, one signal bus** — producer tab must keep
   pumping while backgrounded (rAF throttling). Mitigation: producer uses
   the tracker's existing headless-friendly loop; worst case the eval
   embeds producer+consumer in one page via the in-page channel (the
   package ships both transports for exactly this).
2. **Feel is the real risk** (drift, fatigue, oversensitivity — leanY
   cross-bleed p95 0.55–0.66 is a known body-input limitation). Mitigation:
   Feel Lab is fixture-driven before your live gate; leanY gets extra dead
   zone + gentler gain by default; nothing hard-coded before Gate 2.
3. **Perf budget** — flight render + pose loop on one machine. Baselines
   both sides; lite model + suspended PosePuppet stage during flight;
   floors decide, visuals lose.
4. **Asset provenance** (audio/GLBs) — flagged below; worst case the
   public repo ships without unverifiable audio (game stays fully
   playable, SFX loader already tolerates missing files).
5. **Upstream god-file churn** (`Game.ts` 7k lines) — all edits are
   additive seams (provider interface, input merge, guard rails), no
   restructuring; diffs stay reviewable and ASSETS.md marks the files
   adapted.

## 5. Questions folded into Gate 1b

1. **Monorepo layout** — approve PosePuppet-at-root + `apps/flight`
   (deviation in §1)?
2. **Asset provenance** — upstream bundles ~66 SFX mp3s, music, and 10
   GLBs with no license notes. The grant covers Danny's own work only.
   Proposal: commit them now (repo is local/private until you publish),
   mark `origin: upstream, provenance unverified` in ASSETS.md, and you
   ask Danny one line ("are the audio files + GLB models yours / safe to
   redistribute?") before the repo goes public. Alternative: quarantine
   audio out of git now. Which?
3. **Skip the key-emulation crutch** in P2 and go straight to native
   continuous axes (the seam turned out clean)? PWM emulation would cost
   half a day and teach nothing the tuner won't show better.
4. **Stale upstream README controls** — actual upstream keys are
   A/D turn, W accel, S brake, ArrowUp climb, Space action, F interact
   (no W/S pitch, no Shift/Ctrl). "Identical to upstream" = the code's
   real behavior. Confirm that reading.
