# V4 Open World — PLAN

One compact real-world region (Ísafjörður — V2 default, re-bake stays
cheap until O8 hand-tuning begins), three renderer/content profiles
over the SAME baked data, four modes. Expansion beside TinySkies.

## Architecture

```
apps/openworld/
  src/
    world/            WorldRuntime — the ONLY geographic authority
      runtime.ts        loadWorld + queries: height, water, SDF-to-shore,
                        walk PathHint (nav.walk), row network, spawns,
                        transitions, collision. Profile-independent.
      navwalk.ts        nav.walk → PathHint (locomotion contract)
      rownav.ts         nav.row adjacency + shore clearance
      sdf.ts            shore distance field (from water polygons)
    modes/            sims — consume WorldRuntime + completed controls
      flight.ts         region plane dynamics ← ControlState from
                        REUSED bodyControls/FlightControls; edge
                        containment (soft turn-back); airfield ops
      walk.ts           REUSED locomotion pkg on nav.walk + terrain clamp
      row.ts            REUSED rowControls; hull on region water; docks
      dolphin.ts        REUSED SwimSim on region water + real bathymetry
                        (low-poly only)
      transitions.ts    mode handoff at baked transition points
    profiles/         style ONLY — forbidden from geography by interface
      types.ts          WorldProfile contract (build/update/dispose;
                        receives read-only WorldRuntime + scene)
      lowpoly/          O1–O7: PS2-adjacent flat-shaded region
      realistic/        O8
      fantasy/          O9
    vehicles/         placeholder plane (procedural), boat, reused
                      dolphin mesh
    ui/               minimal: mode selector, profile selector, minimap,
                      attribution line, coach/status strip (existing
                      visual language; no redesign)
    main.ts           boot: runtime+HUD mount, mode/profile wiring,
                      synthetic-drive query params, __OW eval surface
  tests/              Playwright: per-mode closed-loop fixture drives,
                      cross-profile consistency, transitions, denied,
                      perf probes, shots
  ASSET_CONTRACT.md   user plane asset contract (O1)
  TRANSITIONS.md      handoff architecture (O6, written before impl)
  REUSE_MAP.md        this audit's sibling
```

**Profile law (enforced, not hoped):** `WorldProfile` receives a
read-only `WorldRuntime` view and a `THREE.Scene`; it may build meshes
and update atmosphere. All spawn/nav/collision/containment queries live
in WorldRuntime and the mode sims; the cross-profile consistency spec
runs the same query battery under each profile and asserts identical
results.

**Mode/profile matrix:** low-poly {flight, walk, row, dolphin};
realistic {flight, walk, row}; fantasy {flight, walk, row}. Dolphin
registration is a low-poly content-pack entry, not a conditional in
shared code.

## File ownership

- Exclusive: `apps/openworld/**`.
- Append-only shared docs: DECISIONS.md, EVAL_NOTES.md, STATUS.md,
  FINAL_USER_TEST_PLAN.md (S7/S9/S10 + front matter env block),
  ASSETS.md (placeholder plane, procedural assets), README.md (one
  section).
- `apps/dolphin/src/game/sim.ts`: the single default-compatible
  constructor-seam parameterization from REUSE_MAP §7; dolphin suite
  re-run green; logged.
- Everything else — packages/*, apps/flight, apps/walking, root
  configs, src/ — untouched.

## Lane

Worktree `~/Dev/wt-openworld`, branch `feat/openworld`, tmux
`ba-openworld`, port **5176** (standalone vite app, walking pattern:
base `/openworld/`, poseAssets middleware mirrors PosePuppet public/
for /models + /mediapipe-wasm). Headed/perf runs on DISPLAY=:2 under
`flock /tmp/bodyarcade-display2.lock` (batched). Conventional commits
per milestone; suite green at each.

## Milestones (strict order) & effort

- **O1 Foundation** (M): WorldRuntime + queries + unit-ish page tests;
  profile contract; graybox terrain/water/roads render; free-camera
  flyover; Runtime+HUD mounted; ASSET_CONTRACT.md; attribution
  on-screen. Exit: page boots on 5176, flyover screenshots, consistency
  harness scaffolded, spec run green.
- **O2 Flight** (M): placeholder plane (procedural, contract-shaped),
  planar flight dynamics consuming reused ControlState sources,
  airfield spawn/heading, soft edge turn-back, closed-loop fixture lap
  spec. Exit: body+keyboard flight lap, containment spec, perf probe.
- **O3 Walking** (S): nav.walk PathHint + terrain clamp + settlement
  spawn + minimap marker; closed-loop march route spec (drive.ts
  pattern reused); comfort envelope re-asserted in-world.
- **O4 Rowing** (M): rowControls import, hull-on-water sim (completed
  feel constants), dock spawns, shoreline containment via SDF,
  row-circuit fixture spec.
- **O5 Dolphin** (M): sim.ts seam parameterization, region boundary
  from water polygons, real bathymetry depthFn, PS2 render pack in
  low-poly profile, containment spec on region water; `apps/dolphin`
  suite green (standalone unchanged).
- **O6 Transitions** (S): TRANSITIONS.md first; fade+spawn handoff at
  baked transition points (land→walk at airfield, dock→row, row→dive→
  dolphin in low-poly); minimal profile selector; round-trip spec.
- **O7 Consolidated verification** (M): full fixture matrix (4 modes),
  cross-profile battery (low-poly baseline), perf table on :2,
  screenshot board + vision self-review, S7 entries, EVAL_NOTES.
- **O8 Realistic** (L): lighting/atmosphere/materials/vegetation/water
  over the same data; fjord-grounded look; verification as O7 → S9.
- **O9 Fantasy** (L): whimsical-diorama art direction per prompt;
  verification → S10.
- **Ship docs** (S): README section, DECISIONS/EVAL_NOTES complete,
  clean tree.

## Risks & mitigations

- *No node_modules in this worktree*: install root + per-app fresh;
  never copy across machines.
- *GPU contention on :2* (V1's measured gotcha): batch headed runs
  under the display lock; perf numbers only from headed runs.
- *74 walk components*: PathHint restricted to the largest component
  (2262 nodes); spawns carry node ids — verify settlement spawn is in
  it.
- *Rowing needs the full pose model* (V1 measured): row mode requests
  `full`, mode switch may hot-swap model — runtime supports it.
- *Dolphin scale*: SF used WORLD_SCALE 1/15 over a huge bay; the fjord
  is 4.5×4 km real metres — pick scale so the fjord swim feels like the
  gate-approved bay feel; log the chosen value.
- *Plane assets absent*: placeholder flies the whole pass; contract
  documented; never blocks.

## Deliberately out

Seamless multi-region streaming, realistic/fantasy dolphin, TinySkies
changes, shared-UI redesign, scoring/games beyond the four modes,
region re-bake (config change stays cheap; not exercised here).
