# CHECKPOINT 01 — Dolphin in the Pool

## 1. Header

Checkpoint 01: the GAMICO dolphin swims in the **unmodified** vendored demo pool, driven by the ported 120 Hz `sim.ts` + keyboard `swimControls`, animations playing, demo water interaction intact. This is the user-specified starting point of the whole effort. It also applies the governed feel-constant retune (cruise 5 / burst 9 m/s) and the Track E movement additions, and it **measures the loaded model's length at runtime** (BL policy).

## 2. Preconditions and starting state

- Checkpoint 00 approved. Branch `shared-world-slice` at the checkpoint-00 approved commit; working tree clean.
- `apps/shared-world` scaffold + pristine vendored demo present; `VENDOR.md` assumption-site findings acknowledged at the 00 review.
- Dolphin source files present at `/Users/lekan/Downloads/dolphin-models/` (verified 2026-07-17): `dolphin-fbx.glb` **is the GLB** (filenames are swapped relative to contents — Track C warning); `dolphin-glb.zip` holds `source/Dolphin.fbx` + 4 Unity PNGs.

## 3. In scope

1. Copy the GLB to `apps/shared-world/public/models/dolphin/dolphin.glb`; write `LICENSE-dolphin.txt` beside it (CC-BY 4.0 text + the exact attribution string, Master §8.1); create repo-root `CREDITS.md` (Track C §8 skeleton) with the dolphin entry; add a minimal in-app credits panel (a `?view=credits` text view is sufficient at this checkpoint).
2. Port the preserve set into `apps/shared-world/src/`: `sim.ts` (with the `WorldSampler` seam), `swimControls.ts` (unchanged), `camera.ts` (baseline, superseded at cp02), and a new `game.ts` shell (fixed-timestep accumulator, kick-on-first-substep, `__SHARED_WORLD` eval handle incl. `runScript`, fps/simHz counters) running inside the vendored demo's render loop.
3. Mount the demo at scene scale **K = 7.5 m/demo-unit** (Master §7.7) as `?view=pool` (new default view; `?view=stock` remains untouched at scale 1 for fidelity reference).
4. Implement `PoolSampler` (analytic `WorldSampler`: inWater = pool rectangle; shoreDistance = distance to nearest wall; depthAt = 7.5).
5. Apply the feel-constant table (Master §7.4) — including the three Track E additions: velocity-chases-facing (`VEL_FOLLOW_TAU`), speed-shaped turn authority (`TURN_AUTHORITY_LOW/CRUISE` replacing the old speed-factor coupling), idle/hover below `MIN_CONTROL_SPEED 0.75`, and keyboard brake (X, cruise→0 in 0.6 s).
6. Animation controller per Master §7.6 over the 8 measured clips; dolphin-as-displacement-object: compound-sphere emitter (3 spheres of radius 0.45 m at nose/mid/tail along the spine [DERIVED from the 0.99 m body height], positions fed to the demo's object-displacement inputs in demo units via ÷K).
7. Runtime model measurement: with `SwimForward` at frame 0, compute the skinned mesh's world-space nose-to-fluke extent along +Z; log to console and into the eval artifact. Expect **2.89 m ± 2 %**; larger deviation = material asset drift, reported, never rescaled around.
8. Playwright suite port (§8 below). Commit.

## 4. Out of scope

- No camera replacement (cp02 — the ported baseline `camera.ts` is used as-is).
- No body-input testing requirement (the ported `swimControls` keeps its BodySignal paths by construction; the demo requirement is keyboard).
- No terrain, region, container swap, or any vendored-shader edit (the pool stays the demo's pool; the only water-facing integration is the sanctioned object-displacement input path and the K mount transform).
- No breach work beyond what the ported sim already does at the pool scale; no Blender authoring of missing clips (post-checkpoint work).
- No changes to `apps/dolphin` or packages.

## 5. Required inputs

- Implementation Master §3.2–§3.4 (port contract), §7 (all), §8.1 (dolphin).
- Track C report §1 Items 3–7 + §2 (clip table, gotchas, material facts) — the animation layer implements exactly these.
- Track E report §7–§11, Tables A–B (movement model; the master's §7.4 is the resolved form).
- Repo sources: `apps/dolphin/src/game/sim.ts`, `src/input/swimControls.ts`, `src/game/camera.ts`, `src/game/game.ts`, `493dd24:apps/dolphin/src/main.ts` (runtime boot), `apps/dolphin/tests/dolphin.spec.ts` (assertion source).
- Asset: `/Users/lekan/Downloads/dolphin-models/dolphin-fbx.glb`.

## 6. Deterministic implementation specification

### 6.1 Sim port

- Copy `sim.ts`; delete the `@bodyarcade/world-data` imports, `boundaryJson`, `WORLD_SCALE`, `toGame`/`toBoundary`, and the SF-Bay spawn search; constructor takes `WorldSampler { inWater(x,z); shoreDistance(x,z); depthAt(x,z) }`. Spawn: pool center (0, −2.5, 0), heading +X [DERIVED: pool-center XZ at 2.5 m cruising depth; pool floor is −7.5 m].
- Replace the SIM table values per Master §7.4 exactly (old → new listed there; delete the DEPTH_* trio in favor of `sampler.depthAt`).
- Velocity model: keep `s.speed` + heading, add a world-velocity vector that slerps its direction toward heading with time constant `VEL_FOLLOW_TAU(v)`; position integrates the velocity vector. Turn authority: full-bank yaw rate = lerp(2.71, 1.74, clamp(v/5,0,1)) × bank(rad). Auto-bank toward `BANK_AUTO_MAX × (yawInput)` merged with manual roll under `ROLL_MAX`.
- Brake: while brake input held, exponential decel sized to reach ~0 from 5 m/s in 0.6 s; exits to hover below `MIN_CONTROL_SPEED`.
- Everything else in `step()` (surge attack, glide drag, burst machine, surface/floor soft springs, containment current vs the sampler, breach eligibility, autopilot) ports unchanged.
- `swimControls.ts` copied byte-identical except the import specifiers; add key `X` → brake in the keyboard map (the single sanctioned addition, flagged in the report).

### 6.2 Pool mount and water interaction

- `?view=pool`: vendored demo scene mounted under a `Group` with `scale.setScalar(7.5)`; sim runs in meters; water-system inputs (displacement-object positions, drop injections) convert world→demo by ÷7.5. Sea level y 0 in both.
- The dolphin GLTF is a sibling of the scaled demo (not inside the scaled group), positioned by the sim, `frustumCulled = false`.
- Displacement: drive the demo's existing object-displacement mechanism (names as recorded in VENDOR.md §6.4 item 5) with the 3-sphere compound at the dolphin's spine positions each frame; ripple amplitude scales with |velocity| (demo-ball pattern; no shader edits).

### 6.3 Animation controller

Per Master §7.6, with these bindings: base loop `SwimForward`; crossfade to `SwimForwardFast` above 7.8 m/s = 70 % of the 5→9 span [DERIVED, review item]; `SwimLeft`/`SwimRight` weight ∝ |bank| (sign-selected); `SwimUp`/`SwimDown` weight ∝ |pitch rate|; `BreatheSurface` when |y| < 0.6 m sustained > 2 s at speed < 1.5 m/s [DERIVED thresholds, review items]; `Jump` (root translation stripped at load) LoopOnce on breach events; idle = `SwimForward` timeScale 0.7 below 0.75 m/s. timeScale = clamp(0.7 + 0.9 × kickCadence/1.6 Hz, 0.7, 1.6) [DERIVED within Track E's band]. Convert additive layers with `AnimationUtils.makeClipAdditive` **before** creating actions. **Start `SwimForward` before the first rendered frame** (rest pose is nose-down).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/          (defaults to ?view=pool)
# → http://localhost:5198/shared-world/?view=stock   (untouched reference)
```

Expected: the real dolphin swimming in the exact demo pool (15 m × 15 m mount). Try: Shift-cadence kicks (surge-and-glide; ~5 pumps to cruise), A/D banked turns (tight when slow, wide arcs with visible slip at speed), W/S pitch to near-vertical, Q/E trim, Space burst, X brake to hover, stillness → idle with slow tail. Water responds to the dolphin (wake, ripples); caustics/reflections unchanged; the console shows the measured model length.

## 8. Automated verification

Port these dolphin-suite assertions against `__SHARED_WORLD` (headed, workers 1, viewport 1728×1080, results → `eval/shared-world-results.json`):

1. Boot: in-pool, `depthHere ≈ 7.5`, credits string reachable, no console errors; measured model length asserted `2.89 ± 0.06 m`.
2. Keyboard fallback (Shift kicks add speed; W dives; D yaws; **X brakes to < 0.5 m/s within 1.2 s from cruise**).
3. Impulse-and-glide: settled speed at 0.9 Hz > 1.25 × settled at 0.4 Hz; after stopping, 3 s later speed > 0.35 × settled.
4. Signed pitch/roll via the synthetic BodySignal pump (postMessage pump ported as-is).
5. Burst: reaches > 8 m/s within 6 s; never exceeds 9.05.
6. Speed caps: sustained max ≤ 5.05 without burst.
7. Turn shaping: full-deflection yaw rate at 1 m/s > yaw rate at 5 m/s (ratio ≥ 1.3).
8. Dropout → autopilot: pitch decay max step < 0.12 rad/100 ms; recovery to live ≤ 5 s.
9. Replay determinism: identical 4-segment script → identical digest twice in-page and after reload.
10. Animation guard: an `AnimationAction` is running on frame 1 (no rest-pose frame ever renders).
11. Performance: `simHz > 100` always; sustained median `fps ≥ 58`.

Containment battery is NOT ported at pool scale (walls are the demo's; the battery returns re-pointed at cp04B) — record the omission.

## 9. Manual review procedure

1. Swim 10 minutes, no objective (enjoyment criteria, Master §7.8): pumps-to-cruise feel, glide length (candidate GLIDE_TAU 2.9 s on offer if 6.0 feels floaty), slow-turn agility vs wide fast arcs, hover life, brake feel.
2. Watch the flank under caustics: soft broad wet-skin sheen = metallic-roughness repack correct; chrome hotspot or chalky flatness = report (repair path: Track C Item 4; fix is a material-load override `metalness=0`, not a texture rewrite, pending approval).
3. Confirm the model-length console line and any asset-drift finding.
4. Confirm `?view=stock` is pixel-identical to checkpoint 00 (no accidental vendored drift — the manifest check also guards this).
5. Rule on the flagged derived values: X-brake binding, fast-swim band edge, BreatheSurface thresholds, timeScale mapping.

## 10. Performance-report requirements

Median/min fps (10 s scripted swim), simHz, render resolution, frame-time delta vs the checkpoint-00 stock baseline (the dolphin+sim cost), GPU memory if available, and the model's decoded-texture footprint (~64 MB expected).

## 11. Placeholder inventory requirements

Still none (no world exists). State that the only non-placeholder asset is the licensed dolphin, and that `CREDITS.md` + in-app credits carry its attribution.

## 12. Deviation-report requirements

List deviations from Master §7.4/§7.6/§7.7 with cause; restate every [DERIVED] value used (K = 7.5, spawn, band edges, sphere radii, timeScale map, X binding) and every [REC]/[EST] inherited from Track E so the user knows what is estimate-backed. Report the 8-clip reality vs the listing's "25+" as a standing note (Track C Item 2, non-blocking).

## 13. Guardrails

- No vendored-file edits; the only water integration is the existing object-displacement input path + the K mount transform. Four-shot look must remain untouched (`?view=stock` byte-identical).
- No invented assets (the dolphin is the approved asset; its attribution obligations are mandatory); purchase nothing.
- Preserve the sim architecture: 120 Hz fixed step, no RNG, byte-identical replays, constants in one table, keyboard priority, assists, autopilot.
- `apps/dolphin` and packages untouched. Local-only, native macOS Chrome. Never weaken a test.
- Speed policy: 5/9 m/s active; Track E's 10/17.5 only as labeled candidates in the report. BL policy: measure, never rescale.

## 14. Stop

Produce the end-of-checkpoint report (changes, measured model length, suite results, performance, placeholder statement, deviations incl. flagged derived values), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
