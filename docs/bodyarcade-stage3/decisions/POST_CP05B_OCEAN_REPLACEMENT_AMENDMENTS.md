# BodyArcade Stage 3 — Post-Checkpoint-05B Ocean Replacement Change Record

**Status:** Canonical planning addendum — the newest governing user decision for every checkpoint after 05B
**Date:** 2026-08-08
**Applies to:** `bodyarcade-shared-world`
**Recorded base commit:** `fab3098` ("feat: implement CP05B ambient ocean motion")
**Implementation authorization:** The user has verbally authorized the ocean-replacement checkpoint (05C, §4) in the same session that produced this document. This document still does not authorize pushing, merging, rebasing, or opening a pull request, and does not authorize any checkpoint after 05C.

Where this document conflicts with the post-CP05 addendum
(`POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md`), the Implementation
Master, or any older checkpoint prompt, **this document is the newer user
decision and wins.**

---

## 1. Purpose

After beginning preparation for Checkpoint 08, the user reviewed the region
water and rejected its current visual direction. The main changes:

1. **Replace the entire region water implementation** — surface, sim, caustics,
   underwater optics, sky — with a faithful port of the WaterThreeJS procedural
   ocean at the pinned reference snapshot (§9). The jeantimex-derived region
   water (CP04B/05B) is retired from the region view.
2. **Keep everything that is not water**: the baked Twin Bay world artifacts and
   terrain geometry/LOD/BVH/collision, the dolphin + 120 Hz SwimSim + swim
   controls, the CameraRig, the world bake pipeline, and the untouched vendored
   jeantimex `pool`/`stock` views.
3. **Fix the underwater color law.** The current look — one monochrome blue —
   is rejected. Cause on record: the dark "Earth underwater" substrate palette
   with its navy depth ramp (`Z_COL_DEEP`) is multiplied by a blue Beer-Lambert
   tint (`waterPathTint`), collapsing the red channel. The replacement law:
   **terrain and objects keep their own albedo, tinted only by physical water
   optics** (surface Beer-Lambert transmission + underwater volumetric
   extinction), exactly like the reference demo's dropped ball seen from
   underwater.
4. **New sandy ocean floor**, blended with the CP05A substrate classification
   for variety and shoreline color continuity (§2.4).
5. **Add an automatic time-of-day cycle** (dawn → noon → sunset → brief night)
   driving the procedural sun/sky/lighting (§4.6).
6. **Amend every subsequent checkpoint prompt** so it is written against the
   new ocean (§§5–8).

## 2. Decisions that are now locked

### 2.1 The post-CP05 water verdict (§2.1 there) is REOPENED and superseded

The post-CP05 addendum's ruling that "the current region water is accepted…
not a reason to replace the system… or introduce another renderer" is
**withdrawn by the user for the region view**. The jeantimex-derived region
water architecture is no longer authoritative for `?view=region`.

Superseded with it, for the region view only:

- Master §4.1 fidelity hierarchy ("jeantimex wins") and the four-shot
  stock-fidelity test (§4.4) — there is no longer a jeantimex look to match.
- Master §4.2 sanctioned minimal-edit family and the byte-identical rule for
  the region's water shaders (the app-owned region copies are deleted, not
  edited).
- Master §4.3 windowed 512² sim design.
- Master §4.5 fallback ladder. The replacement is a user decision, not a ladder
  escalation; the ladder is retired with the system it governed.

**Not superseded:** the vendored pristine tree
`apps/shared-world/vendor/threejs-water/` stays byte-identical, and the
`?view=stock` and `?view=pool` views keep running it unchanged (post-CP05 §13
vendor guardrail — this document is the "later user decision" that authorizes
the region to *stop using* the vendored system, not to edit it).

### 2.2 The replacement ocean

The region ocean becomes a faithful port of **WaterThreeJS** (§9 snapshot):
Gerstner-spectrum surface with CPU height mirrors, analytic `atmosphere()` sky
dome, sandy procedural seabed with counter-scrolling caustics, Snell's-window
underside, depth-buffer refraction with Beer-Lambert absorption, screen-space
reflections, foam (crest/shore/contact), underwater volumetrics with god rays,
marine-snow particles, volumetric clouds, floating droppable bodies, and a
linear-HDR post chain (bloom + single ACES/sRGB composite).

Porting law: **as exact as practical.** GLSL is copied byte-identical;
`OCEAN_CONFIG` and all demo defaults are kept; symbol names are preserved;
TypeScript annotations are mechanical only. The single sanctioned non-verbatim
addition to the demo's sun logic is a night dimmer in `applySun` (§4.6). Every
other intentional deviation is a report-level deviation.

### 2.3 Bans lifted for the region view (master §6.8 / Track D §18)

The user explicitly lifts, **for the region view only**, the bans on: a modern
ocean look; a sun disc; bloom; god rays / light shafts in open water;
tone-mapped HDR post processing (single ACES composite); screen-space
reflections on the water; exposure/vignette/grain in the composite; and the
one-time-of-day / no-day-night rule (master §2.1). The Track D PS2-Ecco water
and sky direction is **retired as the region's water art direction**; the
13-frame Ecco set remains a composition/behavior reference only (§8).
Conflict-log R11 and master open item 9 (Track D sky values, approval-pending)
are **resolved**: the region sky is the WaterThreeJS procedural atmosphere.
Track D's non-water content (zone palettes, dark-zone atmosphere for caves,
particle budgets, placeholder legend traces) remains available to later
checkpoints as reference, re-expressed through the new pipeline.

### 2.4 Seafloor color (user decision)

Underwater terrain albedo = **WaterThreeJS sandy-dune base blended with the
CP05A substrate classification** (rock/soil/wetland keep more of their class
color; sand-family converges to dune sand), so the floor keeps variety and the
shoreline keeps color continuity with the overland palette. The blend engages
with water depth and is zero above the waterline. `Z_COL_DEEP` and the navy
depth ramp are deleted. The CP05A classification function itself (families,
masks, CPU twin) **survives** — only its underwater palette law changes.

### 2.5 Base and branch (user decision)

The detour builds on **`fab3098` (CP05B) on `bodyarcade-shared-world`**.
CP06 and CP07 exist only on the parked side branch
`bodyarcade-shared-world-cp06-cp07` and are **not restored**; they are
superseded and will be re-scoped and re-run against the new ocean (§§5–6).
The abandoned experiment on `origin/bodyarcade-waterthreejs-ocean` and the
stash "wip water renderer…" remain untouched historical artifacts.

### 2.6 Time-of-day cycle (user decision)

Continuous slow cycle — dawn → noon → sunset → brief night → dawn — full
period ≈ 11 minutes, speed adjustable (and freezable) via the debug GUI and
test hooks. Deterministic: the cycle phase advances from frame time, never
wall clock, and is settable for captures.

### 2.7 What is immutable in 05C

- Baked world artifacts (`height.r16`, `shore.png`, `shore_sdf.r16`,
  `biome.png`, `world.json`, `placement.json`, `caves.json`) — byte-identical.
- Terrain geometry, LOD/skirt system, BVH camera collision, containment,
  dolphin contact/slide/anti-wedge behavior.
- SwimSim physics (waterline stays flat y = 0 in the sim; the visual Gerstner
  surface has mean y = 0 — the ±0.72 m visual/physical mismatch is accepted
  and recorded; re-scoped CP06 may key visual splash timing off the ocean's
  CPU height mirror).
- Swim controls, assists, keyboard fallback, pose-input contract.
- CameraRig behavior in the pool view (bit-identical); the region view adds a
  surface-relative waterline via a new optional `waterlineAt` callback.
- The vendored tree, `?view=stock`, `?view=pool`, `?view=region-preview`.

## 3. New checkpoint sequence

| Order | Checkpoint | Status |
|---|---|---|
| Completed | 00–05A | Approved |
| Completed | **05B — Ambient Ocean Surface Motion** | Implemented at `fab3098`; its visual gate is mooted by this decision (the jeantimex ambient system it tuned is retired), but its committed state is the 05C base and its "never a frozen surface from below" requirement carries forward as a 05C acceptance item |
| Superseded | (side branch) CP06 breach + CP07 placeholders | Parked on `bodyarcade-shared-world-cp06-cp07`; not in this line's history; re-scoped below |
| **Next** | **05C — Ocean Replacement (WaterThreeJS Port)** | Authorized by this document (§4) |
| Then | 06 — Breach, Re-entry, and Cross-Waterline Continuity (re-scoped, §5) | Not authorized |
| Then | 07 — Placeholder World (re-run on this line, §6) | Not authorized |
| Then | 08 — Atmosphere Zones and Final Tuning (re-scoped, §7) | Not authorized |
| Then | 09, 10, 11+ (line edits only, §8) | Not authorized |

## 4. New Checkpoint 05C — Ocean Replacement (WaterThreeJS Port)

### 4.1 Objective

Replace the region view's entire water presentation with the ported
WaterThreeJS ocean while preserving everything listed in §2.7, and add the
time-of-day cycle. The region should look and behave like the reference demo —
same sky, same surface, same underwater optics, same post chain — with the
baked Twin Bay terrain standing in for the demo's procedural island, and the
dolphin (not a mouse-dragged ball) as the primary water-coupled body.

### 4.2 Commit structure

Three local commits on `bodyarcade-shared-world`:

- **Commit A (docs)** — this document and the §10 documentation edits +
  the §9 reference snapshot. Its own clean commit, presented in the final
  checkpoint report. The user's in-session authorization (header) covers
  proceeding directly to Commits B–C; the formal review STOP is after C.
- **Commit B (port)** — `apps/shared-world/src/ocean/` added: the demo modules
  ported verbatim to TypeScript, compiled (`tsc --noEmit` green) but unwired;
  every existing test still green.
- **Commit C (integration)** — region view rewired to the demo's pass
  pipeline; terrain relit for linear HDR with the §2.4 sandy blend; jeantimex
  region-water modules deleted; time-of-day + debug GUI; test suite replaced
  per §4.8. Suite green. Then STOP for user review of the checkpoint.

### 4.3 Port inventory (Commit B)

`src/ocean/`: `Ocean.ts`, `Sky.ts`, `Floor.ts`, `Particles.ts`, `Clouds.ts`,
`Post.ts`, `FloatingBodies.ts`, `shaders/common.ts`, `presets.ts` (the demo
PRESETS + apply logic), `timeOfDay.ts` (new, §4.6), `oceanDebugGui.ts` (new),
`WATERTHREEJS_LICENSE.txt` (upstream MIT text). Demo `main.js` is not a file —
its renderer setup, sun propagation (`updateSunDir`/`applySun`), render-target
construction, pass wiring, and body-foam feeding transplant into
`regionGame.ts`. `Island.js` is not ported (the region terrain plays its
role); it is the template for the terrain caustics/lighting edits.

### 4.4 Integration law (Commit C)

- Render pipeline per the demo: refraction pass (everything except the ocean
  surface and particles, skipped while submerged) → main HDR pass → volumetric
  clouds → post composite (underwater volumetrics + bloom + ACES + sRGB).
  Half-float render targets with depth textures. Renderer stays
  `NoToneMapping`; the composite is the single encode. Two recorded perf
  adaptations (master §10 allows resolution scaling; march math verbatim):
  the underwater god-ray march runs at half resolution and is upsampled into
  the full-res absorption pass (measured: the full-res march alone cost
  ~half the frame over the region terrain), and the live pixel ratio clamps
  at 1.5 instead of the demo's 2.
- The region terrain renders in both passes; shore foam falls out of the
  demo's depth-buffer water-column term with no terrain-side work.
- The demo's endless sandy `Floor` sits below the region's minimum baked
  height (depth-occluded inside the region) and provides the seabed beyond
  the 2000 m region edge.
- Terrain shaders: remove the display-gamma encode (`zDisplayEncode`) and
  output linear albedo (mirrored in the CPU twin `substrateCpu.ts`); remove
  `waterPathTint` and the navy ramp; apply the §2.4 sandy blend; relight from
  the dynamic sun (`uSunDir`) with the demo's HDR scale; splice the demo
  `CAUSTICS` chunk on submerged fragments (replaces the caustics RT).
- Dolphin: lit by the demo's sun-tracking lights; underwater appearance via
  the post extinction (own albedo, water-tinted). The dolphin feeds the
  ocean's contact-foam body slots (wake rings while surface-swimming; splash
  impulse on air↔water transitions — this replaces the jeantimex breach-drop
  injections).
- CameraRig: new optional `waterlineAt(x,z)` callback; anti-shimmer and
  swim/air clamps become surface-relative in the region; pool behavior
  bit-identical without the callback.
- Camera far plane rises to the demo's 8000 m (sky dome radius 6000 m).
- Deleted: `RegionWater`, `RegionWaterSurfacePass`, `RegionCausticsPass`,
  `RegionRenderer`, `ambientCpu`, and the region water shaders
  (`RegionWaterAbove/Below.frag`, `RegionWaterSurface.vert`,
  `RegionAmbient.glsl`, `RegionWallColor.glsl`, `RegionCaustics.*`,
  `WindowScroll.frag`). Surviving terrain-side code moves to `src/terrain/`.

### 4.5 Floating bodies

The demo's droppable spheres/cubes are ported and available in the region
(debug GUI / test hook) — they are the user's reference case for the
underwater albedo law and stay as a standing visual probe.

### 4.6 Time-of-day specification

Phase ∈ [0,1) advanced by frame dt × speed multiplier; period 660 s; day
occupies ~82 % of the cycle (night ≈ 2 min); elevation dawn 0° → noon ≈ 62° →
sunset 0° → night dip ≈ −12°; azimuth rotates continuously 360° per cycle.
Per frame the cycle writes the demo's `sunParams` and calls `applySun`.
**Sanctioned non-verbatim addition:** `applySun` gains a night dimmer driven
by `smoothstep(−8°, +8°, elevation)` that scales the two scene lights AND the
post composite's exposure (floor 0.15× — the scotopic knob of the
single-tone-map pipeline). The analytic atmosphere clamps at elevation 0 and
has no night model, so without the exposure arm the sky would stay
dusk-bright all night (measured during 05C implementation). Debug GUI
(`?debug=1` only): cycle speed/pause/phase scrub, the demo's six sun presets
and parameter folders, body drop buttons; the GUI's exposure slider edits the
pre-dimmer base value.

### 4.7 Determinism

Ocean time and cycle phase are app clocks (frame-dt accumulated, freezable and
settable via test hooks) — never wall clock. The Gerstner field and sun
curves are pure functions of (position, time/phase). The `runScript` sim
digest is unaffected (sim untouched). All jeantimex-era water capture
baselines and eval entries are **invalidated by design** and replaced.

### 4.8 Test-suite replacement (authorized — not a silent weakening)

- **Deleted:** `region-water.spec.ts`, `region-ambient.spec.ts` (they test the
  retired system).
- **Edited:** `camera.spec.ts` region test drives captures with the ocean
  frozen at a fixed time; stock-comparison halves retired. `region-terrain.spec.ts`
  pixel tests re-pointed at the new stage/post hooks. `region-substrate.spec.ts`
  updated for linear albedo + sandy blend (GPU/CPU-twin equivalence and the
  "never one uniform deep tint" assertion are kept).
- **Kept green unmodified:** `pool.spec.ts`, `scaffold.spec.ts`,
  `region.spec.ts` (bake determinism + sim replay digest), camera pool tests.
- **New `region-ocean.spec.ts`:** boot/config fidelity vs `OCEAN_CONFIG`;
  frozen-time capture identity + unfrozen motion (the frozen-surface detector's
  heir); cross-reload determinism of heights and sun; underwater absorption
  character on a dropped white sphere (tinted albedo, never flat navy);
  Snell-window cone ≈ 97° ± 6° (physics test, ported); sandy-blend engagement
  with depth + above-water classification unchanged vs the CPU twin;
  time-of-day curve law + sky luma ordering (noon > sunset > night); god-ray
  and cloud toggles change pixels; floating-body buoyancy tracks the CPU
  height mirror; performance — `simHz > 100`, sustained median `fps ≥ 58` at
  1728×1080 with per-stage medians recorded (budget law and degradation
  discipline of master §10 carry forward; the stage names become
  refraction/main/clouds/post).

### 4.9 Manual review gate

The user freely explores: above-water sun/sky/foam; diving through the
waterline; underwater absorption on dolphin, dropped bodies, and terrain;
sandy floor with caustics; the full day cycle (at raised speed); `pool` and
`stock` views still pristine. STOP after Commit C for this review.
Approval of 05C does not authorize CP06.

## 5. Amendment to Checkpoint 06 — Breach, Re-entry, and Cross-Waterline Continuity

The side-branch CP06 implementation is superseded. When CP06 is re-run on this
line:

- The **cross-waterline rendering law and split-level behavior arrive largely
  free** with the ported ocean (refraction pass + Snell underside + post
  extinction). CP06's remaining scope: the breach interaction chain, camera
  states through the transition, splash/foam tuning, and validation.
- Splash and re-entry disturbance act through the ocean's **contact-foam and
  splash-impulse mechanism** (§4.4), not `addDrop` sim injections. The
  hierarchy law (ambient < wake < breach) still binds, re-expressed in foam
  and displacement terms.
- References to the jeantimex compositing, sanctioned edit family, four-shot,
  and "no new water renderer" are void. The 13-frame Ecco set remains the
  composition/behavior reference for breach framing and cross-surface
  visibility variation.

## 6. Amendment to Checkpoint 07 — Placeholder World

The side-branch CP07 implementation is superseded but its prompt is **largely
reusable**; its placement plan/census code may be cherry-picked or re-derived.
Placement law unchanged (X/Z preserved, Y resampled, category completeness).
New at re-run: placeholders render into the linear-HDR pipeline (material
`toneMapped` interaction verified) and are visible through the water per the
new optics; the census/determinism tests return with it.

## 7. Amendment to Checkpoint 08 — Atmosphere Zones and Final Tuning

CP08 loses water-optics ownership (05C owns the water look wholesale). Its
re-scoped mandate: **zone atmosphere and final tuning through the new ocean's
mechanisms** — per-zone underwater extinction/fog-density/palette dials on the
post volumetrics and ocean uniforms driven by `biome.png`/`world.json`; final
substrate palette pass; dark-zone groundwork for cp09; particles budget; one
recorded table of final values. The four-shot stock-fidelity re-run, the
"jeantimex mechanisms only" guardrail, the FogExp2-per-zone mechanism
prescription, and the "no post stack" ban are void. Track D zone tables remain
starting-value references, re-expressed through the new uniforms.

## 8. Amendments to Checkpoints 09, 10, and later

- CP09: "no water changes" now means the **ported ocean** is untouched;
  suite references to four-shot/06-continuity captures become the
  `region-ocean` suite + the re-run CP06 captures. Dark-zone atmosphere acts
  through the §7 zone system.
- CP10: "no terrain/water/atmosphere retuning" refers to the new systems;
  suite references updated identically. Vegetation renders into the
  linear-HDR pipeline.
- CP11+: unchanged in identity; the asset gate (§10.3 of the post-CP05
  addendum) is untouched by this document.
- `references/ecco-waterline/README.md`: its "one coherent water system /
  do not introduce a separate replacement renderer" clauses and its
  per-checkpoint implementation prescriptions are superseded by this
  document; its 13 frames and acceptance *behaviors* (continuity, smooth
  visibility variation, moving surface) remain valid references. A banner
  note records this.

## 9. Pinned reference snapshot and attribution

- **New pinned reference:** `docs/bodyarcade-stage3/references/waterthreejs/`
  — read-only copy of the WaterThreeJS project (src, index.html, package
  manifests, README, LICENSE; no node_modules). Upstream is not a git
  checkout; provenance is recorded in its `BODYARCADE_SOURCE_RECORD.md` by
  acquisition date (2026-08-08, from `/Users/lekan/Dev/WaterThreeJS-main`) and
  per-file SHA-256. Same governance as the ZyFou snapshot: reference and
  porting source, never runtime; do not edit it.
- **License:** MIT. The upstream LICENSE ships in the snapshot and again next
  to the ported runtime code (`apps/shared-world/src/ocean/WATERTHREEJS_LICENSE.txt`,
  Commit B). `CREDITS.md` and the in-app credits view gain a WaterThreeJS
  entry (Commit A / Commit C respectively).
- The port is app-owned code; byte-identical GLSL is intentional and
  attributed.

## 10. Documentation edits carried by Commit A

1. This document, installed under `decisions/`.
2. `outputs/BODYARCADE_SHARED_WORLD_IMPLEMENTATION_MASTER.md` — second
   amendment banner; supersession notes at §4, §6.8, §9 ladder (05C row
   inserted; 06/07/08 rows annotated; provenance updated).
3. `outputs/CHECKPOINT_INDEX.md` — status refresh (05A approved; 05B
   implemented at `fab3098` with its gate mooted; side-branch 06/07 noted as
   superseded), 05C row, governing-documents list gains this addendum, pinned
   references gain the waterthreejs snapshot.
4. Supersession banners on `CHECKPOINT_04B…`, `CHECKPOINT_05A…`,
   `CHECKPOINT_05B…`, `CHECKPOINT_06…`, `CHECKPOINT_07…`, `CHECKPOINT_08…`;
   targeted line amendments in `CHECKPOINT_09…` and `CHECKPOINT_10…`.
5. Banner note on `references/ecco-waterline/README.md` (§8).
6. The §9 snapshot + `BODYARCADE_SOURCE_RECORD.md`; `CREDITS.md` entry.

No application code changes in Commit A. `.DS_Store` and machine-local
metadata excluded.

## 11. Global guardrails carried forward

All §13 guardrails of the post-CP05 addendum remain in force except as
explicitly amended here — in particular: authorized worktree/branch only;
verify starting HEAD and clean tree; stop for user review at every gate; never
push/merge/rebase/PR without authorization; webcam off for automated work;
tests never weakened *silently* (this document is the explicit authorization
for the §4.8 suite replacement); report every derived value and deviation;
baked world stays deterministic; `terrainHeight` remains the single terrain
authority; placeholders law untouched.

## 12. Required completion report (per commit)

Commit A: files added/modified; confirmation no application code changed;
nothing pushed; commit SHA; any conflict found with existing planning docs.
Commit B: port inventory with any non-mechanical TS adaptation listed;
`tsc`/test state. Commit C: full 05C checkpoint report per §4.8–§4.9 —
changes, deleted-module inventory, terrain relight values (old → new), the
time-of-day table, suite results, performance table with stage medians,
deviations (every non-verbatim divergence from the reference demo), then STOP.
