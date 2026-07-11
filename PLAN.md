# PLAN.md — BodyArcade Dolphin

Status: **P0 complete — awaiting USER GATE 1** (water-shape pick + plan
approval + dolphin fixtures). Branch `bodyarcade-dolphin-fable` in the
dedicated checkout `~/Dev/posepuppet-dolphin`, forked from the
remote-development rebuild (`68ac9a3`) with Rowing P1+P2 (`a39d644`) as
ancestors — the stroke detector this mode reuses is already on the
branch. Rowing continues in parallel in `~/Dev/posepuppet` on its own
branch; this plan touches nothing Rowing owns. Previous passes' plans
(Rowing, PPC, Flight, Instrument Pass) live in git history at this path.

## P0 — what the code actually says

**The periodic detector was built for this.** The header comment of
`packages/body-input/src/stroke.ts` says it plainly: "the Rowing
primitive, designed for reuse (Dolphin's dive cycle is the same detector
on a different axis)." `StrokeDetector` is a pure position-Schmitt
oscillation detector over any scalar signal, frame-timestamp-driven
(replay-deterministic), with per-side amplitudes and an EMA rate. The
torso-wave kick is that detector fed a torso signal instead of wrist
fore-aft. Zero new detection theory needed; the open question is which
measured torso signal oscillates cleanly (fixtures decide — see Risks).

**The schema has a proven additive mechanism.** `BodySignal` is a
closed-key schema (`schema.ts`); landmarks provably never cross the
transport, so torso-wave detection must run producer-side in
`@bodyarcade/body-input`, exactly like Rowing's stroke. Optional
top-level blocks (`tracking` from PPC, `stroke` from Rowing) keep
`v: 1`, old tapes valid, canonical serialization stable. Dolphin adds a
`swim` block the same way rather than overloading `stroke` (rowing's
block stays arm-semantic; the boat consumes it today).

**Existing axes already cover the rest of the swim model.** From
`AXIS_KEYS`: `leanY` = pitch dive/surface, `leanX` (shoulder-line lean —
Flight banks with it today) = banked roll turns, `crouch` = alternate
depth control, `handsForward` = burst (Flight's boost substrate),
`recenter` event = T-pose, `stillness` + `confidence` + PPC `tracking`
block = glide/autopilot. Only the kick is new signal work.

**The same-origin topology is settled and generalizes.** BroadcastChannel
is origin-scoped; PosePuppet's `vite.config.ts` serves the *built*
flight app at `/flight/` via a static middleware plugin (base:
`'/flight/'`, disjoint asset prefixes). Dolphin follows the identical
pattern at `/dolphin/` — a second instance of a solved problem, not new
infrastructure.

**The globe is not the dolphin's world.** FUTURES.md sketched "Dolphin →
a fourth vehicle" on the TinySkies globe, but that was written before
this prompt existed. What the prompt actually specifies — a bounded
real-water polygon, SDF depth field, PS2 underwater atmosphere (fog,
vertex lighting, boids, kelp shaders, caustic gobos), an underwater
camera — is a different scene, renderer, and art direction from the
globe. See Gate-1 decision material.

**Fixture/eval rig conventions carry over.** mp4 → y4m via
`scripts/prepare-fixtures.mjs` (720p/30 for Chrome's fake webcam);
episode-structural per-clip assertions in
`packages/body-input/tools/fixture-eval.mjs` → `eval/`; Rowing's lesson
is pre-applied: clips that start/end mid-motion get a single non-looped
`?video=` eval pass, and still lead-in/tail is in the recording spec.

**This checkout is fresh.** No `node_modules`, no `fixtures/` (private,
untracked — they live on the Mac and in the Rowing checkout). P0 here is
docs-only; coherence checked with `npm ci` + `tsc --noEmit`. Full suite
baselines are re-established at P1 entry after fixture sync
(ENVIRONMENT_BLOCKED at P0: private fixtures not yet synced to this
clone; last recorded green — PosePuppet 92 passed / 5 skipped, Flight
17 passed / 2 skipped at Rowing P2 `a39d644`). Per instruction, no
Playwright/remote-infra/GPU work happens in P0.

## Gate-1 decision material

### Where Dolphin lives: `apps/dolphin` (deviation from FUTURES.md's fourth-vehicle sketch)

Rowing went inside `apps/flight` because everything it needed — the
boat, the globe, the camera, the wake — already existed there. Dolphin
is the opposite case: the world (bounded bay, underwater volume, PS2
fog/palette), the camera (third-person underwater follow + breach
chase), the physics (3D swim with depth), and every asset are new. What
Dolphin shares — body-input consumption, shaping stack, One Euro,
tuner, stroke detection — lives in `packages/body-input`, not in the
flight client. Building inside the 30k-line TinySkies fork would risk
the Gate-2-frozen flight/rowing feel for zero reuse gain; a standalone
`apps/dolphin` (own three.js, own vite build, base `'/dolphin/'`,
served same-origin by the established static-plugin pattern) risks
nothing and keeps the PS2 look unconstrained. FUTURES.md gets a note:
the fourth-vehicle idea remains valid for a *globe cameo* someday; the
bounded-bay mode is its own app. **Recommendation: apps/dolphin.**

### Boundary module: `packages/world-data`, offline-only, designed as the future pipeline's water-polygon component

`fetch → assemble multipolygon → simplify → project → boundary.json`,
run as a prep script (`packages/world-data/tools/`), never at runtime;
the game bundles the emitted JSON. Sources: **OSM via Overpass**
(primary — bays/lakes/rivers; ODbL, attribution in-app + README +
provenance inside boundary.json) and **Natural Earth** (public domain;
coarse-coastline fallback only — at bay scale NE 10m is a blob, so both
candidates below use OSM). Simplification: Visvalingam–Whyatt to a
stated vertex budget (~400–800 outer vertices; islands kept above an
area threshold), **area delta vs source stated** in the module README
and asserted in a unit test. Projection: local tangent plane at the
polygon centroid → meters → game units with a tunable world scale
(shape is sacred; size is gameplay). The module's public surface
(`loadBoundary`, point-in-polygon, signed-distance query) is written as
the pipeline's water component from day one — Rowing's Waterway seam
becomes a future consumer.

### The two candidate water shapes (both verified in OSM today)

**Candidate A — Bay of Kotor (Boka Kotorska), Montenegro.**
OSM relation **10171079**, `natural=bay` multipolygon, 59 outer + 8
inner ways, bbox ≈ 22 × 14 km. License: ODbL (attribution wired
in-app). Why it fits: a winding, fully-enclosed chain of basins linked
by narrow straits (the Verige strait is a natural gate/arch moment),
two tiny islands (Our Lady of the Rocks, Sveti Đorđe) begging to be
ruin anchors, and an unmistakable minimap silhouette. It is the
prompt's "one great bay" — every stretch is near a shore, so the
containment current and the shimmer edge are constantly part of play,
and the SDF depth field (deep basins, shallow straits) writes itself.
**My recommendation.**

**Candidate B — San Francisco Bay, USA.**
OSM relation **9451753**, `natural=bay` multipolygon, 11 outer + 3
inner ways (Alcatraz-class islands), bbox ≈ 42 × 59 km. License: ODbL.
Why it fits: the most recognizable bay outline on earth — the minimap
*is* the "this is a real bay" proof with zero explanation — plus the
Golden Gate strait as a dramatic entrance and real islands as
landmarks. Risk: the central bay is a large open expanse; at any world
scale a chunk of the play space is featureless open water (the exact
"boring sea" the prompt warns about), mitigated by scaling down and
seeding ruins/kelp forests, but Kotor gets the same charm for free.

Both were verified via Overpass on 2026-07-11 (relation IDs, member
counts, closed multipolygon geometry, bboxes above). Gate 1 picks one;
the module is shape-agnostic so the other remains a config away.

## Swim model — mapping sketch (fixtures decide the details)

| control | signal | mechanism |
|---|---|---|
| kick → thrust | **new**: torso-wave (chest/hip vertical anti-phase) | `StrokeDetector` on a torso scalar → `swim` block (rate/phase/amp) → impulse-and-glide thrust. Rowing's P2 lesson pre-applied: water drag proportional to speed (τ tuned for a dolphin's longer glide), so each kick cadence settles at its own speed and stillness = glide, never a hard stop |
| dive / surface | `leanY` | pitch rate, auto-level spring, Full-Assist depth clamps |
| banked turns | `leanX` | roll → yaw coupling (bank-to-turn, the Flight idiom) |
| alternate depth | `crouch` | low-energy seated/standing depth control |
| burst | `handsForward` | Flight's boost substrate, hysteresis + debounce |
| breach | derived | sustained `leanY` pitch-up + speed + near-surface ⇒ leap, camera follow, splash |
| glide | `stillness` | no input decay to rest — momentum carries |
| loss → autopilot | `confidence` + `tracking` | glide straight, gentle assist re-entry (PPC contract pattern) |
| recenter | `recenter` event | T-pose |
| keyboard | — | WASD + Q/E depth + Shift kick, always available (non-negotiable) |

The torso-wave *measurement* is the one open signal question: the torso
basis is defined by shoulders/hips, so the oscillation must be read
from raw normalized image-space chest-vs-hip vertical travel (or
stature oscillation), not from a basis that subtracts itself.
Candidates get measured on the fixtures before the detector is wired —
same measured-floor discipline as Flight's dead zones.

## Depth strategy

SDF-from-boundary on a precomputed grid (part of boundary.json or a
sibling artifact): depth = maxDepth · smoothstep over distance-to-shore
+ low-octave fbm noise, so edges are shallow, basins deep, and nothing
is flat. Optional carved tunnels/arches only if cheap at P3. No real
bathymetry (prompt: not needed, avoid).

## Fixtures — USER ACTION (exact recording specs)

Same setup as flight/rowing fixtures: **portrait 1080×1920 @ 30 fps**,
camera at chest height ~2.5–3 m back, front lighting, plain background
if possible. Head through knees in frame (hips must stay visible —
the kick signal is chest-vs-hip). **Start each clip with ~3 s still,
end with ~2 s still** — Rowing taught us that mid-motion starts/ends
cost eval fidelity. Drop files in `fixtures/dolphin/` on the Mac.

The torso wave (the kick): a standing body-wave — soften the knees,
push the hips forward as the chest eases back, then hips back as the
chest comes forward. A smooth vertical undulation, chest and hips
bobbing in anti-phase, ~10–15 cm of visible chest travel. It should
feel like a groove, not a workout.

| clip | posture | content | truth |
|---|---|---|---|
| `torso_wave_slow.mp4` (~60 s) | standing | exactly **12 waves** at a relaxed ~24–30 waves/min, steady | 12 |
| `torso_wave_fast.mp4` (~45 s) | standing | exactly **24 waves** at ~50–60 waves/min | 24 |
| `dive_surface_leans.mp4` (~60 s) | standing | **6 forward-lean holds** (~2 s each) alternating with **6 backward-lean holds** (~2 s), returning to neutral ~2 s between | 6 fwd / 6 back |
| `roll_turns.mp4` (~60 s) | standing | **6 left** and **6 right shoulder-line tilt holds** (~2 s each), alternating, neutral between | 6 L / 6 R |
| `seated_swim.mp4` (~60 s) | seated on a chair | exactly **12 seated torso waves** (chest bob, hips anchored) at a relaxed pace, then 2 forward + 2 backward lean holds | 12 waves, 2 fwd / 2 back |
| `breach_attempts.mp4` (~60 s) | standing | exactly **3 breach attempts**: ~5 fast waves immediately followed by a strong backward-lean hold ~2 s, relax; ~5 s neutral between attempts | 3 |
| still / T-pose / crouch / leans | — | **reuse** `fixtures/flight/` (still, arms_tpose, crouch_stand, lean_lr, lean_fb, seated) | existing labels |

`breach_attempts` is added beyond the prompt's fixture list because the
verification plan requires "breach triggers on the breach fixture and
not on others" — the negatives are the other clips (`torso_wave_fast`
has speed without pitch-up; `dive_surface_leans` has pitch-up without
speed). Count-while-recording is the hand-labeled truth for the ±1 kick
eval; if a take comes out different, tell me the actual number rather
than re-recording.

**Fixture sync for this checkout:** existing flight+rowing fixtures and
the new dolphin clips need to reach `~/Dev/posepuppet-dolphin/fixtures/`
(untracked). From the Mac:

```
rsync -av -e "ssh -i ~/.ssh/pinn_rtx3090" \
  ~/Dev/posepuppet/fixtures/ o@192.168.86.152:~/Dev/posepuppet-dolphin/fixtures/
```

(I can copy the existing flight/rowing fixtures across remote checkouts
read-only at P1 entry myself; only the six new dolphin clips strictly
need you.)

## Phases and effort estimates

- **P1 — boundary module** (~1 day): `packages/world-data` prep script
  (Overpass fetch with cached raw response committed alongside for
  reproducibility, multipolygon assembly, Visvalingam simplification to
  budget, tangent-plane projection, SDF grid, provenance + license
  metadata) → `boundary.json`; unit tests: area delta within stated
  tolerance, point-in-polygon determinism, islands preserved; debug
  minimap render + vision self-check against the source map;
  attribution text wired where the game will mount it; module README
  (sources, licenses, simplification math) written as pipeline docs.
- **P2 — swim feel in a graybox sea** (~2–2.5 days to Gate 2):
  torso-wave measurement study on fixtures → `SwimDetector` config
  (reusing `StrokeDetector`) → additive `swim` block + fixture eval
  (kick count ±1, rate ordering, seated); `apps/dolphin` scaffold
  (graybox: fog-colored void, boundary walls as shimmer, SDF depth,
  debug minimap); impulse-and-glide thrust, pitch/roll, containment
  current (soft repulsion, never a wall), assist ladder (Full Assist:
  depth clamps, auto-level, gentle forward drift so stillness never
  strands), autopilot on loss, T-pose recenter, keyboard fallback,
  tuner swim section; closed-loop evals (thrust↔kick-rate correlation,
  8-direction escape attempts, dropout → glide).
  **>> USER GATE 2: live swim.**
- **P3 — the world** (~2–3 days): PS2 art pass (low-poly vertex-lit
  meshes, restricted palette, exponential/dithered fog, additive glow
  particles, instanced boid fish with flee, kelp vertex-shader sway,
  caustic gobos, rocks/arches/ruins seeded by the SDF), breach polish
  (camera follow, splash), minimap final with attribution, optional
  4:3 toggle, optional local-file ambient audio.
- **P4 — ship** (~1 day): full eval refresh, perf floors (60 fps render
  / floor 45 with pose ≥ 15 Hz — Flight's floors), replay determinism,
  docs (module README, DECISIONS, FUTURES pipeline-seam notes, ASSETS,
  EVAL_NOTES, README), and the FUTURES.md obstacle-avoidance reminder
  raised explicitly at the final gate.

## Verification plan (maps 1:1 to the prompt)

- Kick count vs labeled fixtures ±1; rate ordering fast > slow; seated
  detection works with hips anchored.
- Thrust correlates with kick rate over settled samples (Rowing's
  closed-loop method: exclude transitions, state the r).
- `dive_surface_leans` / `roll_turns` → signed pitch/roll axis evals.
- Containment: scripted escape attempts from 8 directions never exit
  the polygon, never hard-wall (velocity into the boundary decays
  smoothly; position stays inside point-in-polygon at every frame).
- Breach fires on `breach_attempts` (3/3) and never on the other clips.
- `boundary.json` vs source polygon: area delta within stated
  simplification tolerance, asserted in a test.
- Minimap vision self-check against the source map (EVAL_NOTES).
- Dropout ⇒ glide + smooth recovery (PPC tracking states consumed).
- 60/45 fps with pose ≥ 15 Hz; replay determinism (detector is
  timestamp-pure by construction).

## Risks

- **Torso-wave SNR is the load-bearing unknown.** Vertical chest/hip
  oscillation may be small in image space (especially seated) and the
  torso basis can't measure itself. Mitigation: fixture-first — measure
  three candidate scalars (raw chest-y vs hip-y anti-phase, stature
  oscillation, shoulder-center world-y) on the six clips before wiring
  anything; the Schmitt detector needs amplitude, not smoothness. If
  standing SNR is fine but seated is not, seated falls back to
  crouch-depth + lean control (documented, coach explains).
- **Breach false positives** on enthusiastic dive leans — speed + near-
  surface preconditions + hysteresis; the fixture set has the exact
  negatives.
- **ODbL share-alike**: boundary.json is a derived work — attribution
  in-app/README plus provenance metadata (source, relation ID, fetch
  date, license) inside the file; prep script committed so derivation
  is reproducible. This is the documented, compliant path.
- **World scale vs swim speed** is a feel parameter, not a data one —
  tunable at Gate 2 (shape preserved, size gamified).
- **Flight/rowing feel is gate-frozen** — the standalone-app decision
  exists precisely so Dolphin cannot regress it; the flight suite runs
  untouched at each phase commit.

## Deviations from the prompt (logged, one line each in DECISIONS.md)

1. `breach_attempts.mp4` added to the fixture list (verification
   requires a breach positive).
2. P0 suite baseline classified ENVIRONMENT_BLOCKED in this fresh
   checkout (no private fixtures yet); re-established at P1 entry.
3. FUTURES.md fourth-vehicle sketch deliberately not followed for the
   bounded-bay world (globe cameo remains future-possible).
