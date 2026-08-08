# CHECKPOINT 05B — Ambient Ocean Surface Motion and Terrain-Boundary Interaction

> **SUPERSEDED (2026-08-08).** Implemented at `fab3098`; its visual review was
> mooted when the user rejected the region water's direction and authorized the
> Checkpoint 05C ocean replacement
> (`../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`). The jeantimex
> ambient/boundary system this prompt specifies is retired; its core requirement
> — the surface never reads frozen from below — carries forward as a 05C
> acceptance item, satisfied by the ported Gerstner ocean.

## 1. Header

Checkpoint 05B (inserted by the post-CP05 addendum §3, §5): keep the one approved jeantimex-derived water system and its overall appearance, while ensuring the ocean surface **never appears perfectly motionless from underwater** — slight continuous swell/ripple distortion even with the dolphin stationary — and that ambient wave motion **interacts visibly with static shorelines, cliffs, islands, rocks, and protruding terrain** as persistent low-level boundary ripples. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- Checkpoint 05A implemented, reviewed, and **explicitly approved**; branch `bodyarcade-shared-world` at the 05A-approved commit; tree clean.
- Required reading: the addendum (§2.1, §5, §11.3); this prompt; `docs/bodyarcade-stage3/references/ecco-waterline/README.md` **and the actual 13 image files** (the README's Surface-motion requirements and Checkpoint-05B ownership sections are binding); master §4 (water plan; the ambient "breathing sheet" of Track B Q4); `VENDOR.md`; the CP04B and CP05A reports.

## 3. In scope

1. **Continuous restrained low-frequency ambient swell** across the region surface, always present, visible from below through surface shape, normals, refraction, and Snell-window distortion — never dependent on a recent interaction to be visible.
2. **Continuous animated normal/refraction movement** of the surface underside while idle (the layered moving-distortion character of the Ecco underside frames, at calm amplitude).
3. **Persistent low-level terrain-boundary ripple response** where ambient moving water meets shorelines, cliffs, islands, rocks, and protruding terrain — driven from the existing `terrainHeight` and/or shoreline SDF (`shore_sdf.r16`), like the pool demo's obstacle interaction with the roles reversed: the water field moves, the terrain never does. No second shoreline renderer.
4. **Stronger local dolphin wake**: ordinary swimming produces clearly stronger local wake/displacement than the ambient baseline (the existing compound-sphere injection retuned as needed).
5. The motion hierarchy, instrumented and demonstrable: `ambient < terrain/shoreline boundary response < swimming wake < breach/re-entry impulse` — with the strongest breach/re-entry impulses **remaining owned by CP06**.
6. Region-only tuning isolated cleanly (stock and pool untouched); parameter table recorded; commit.

## 4. Out of scope

- **No replacement water renderer, storm ocean, high-frequency visual noise, or unrelated normal/caustic overlay system.** The ocean stays calm.
- No change to the pristine stock demo; pool reference behavior unchanged (a test-only parameter comparison is permitted).
- No breach/re-entry work (cp06); no atmosphere/optics tuning (cp08); no terrain changes; no vendored-file edits; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §5 (objective, motion hierarchy, constraints, required review) and §2.1 (the water system is not defective; do not escalate the fallback ladder).
- `ecco-waterline/README.md` + all 13 frames (especially the underside-distortion frames `ATLAS_03/D10_R0122…` and `…R0131…`).
- Master §4.2–§4.3 (sanctioned edit family; windowed 512² sim under one global calm plane; the ambient contribution currently reuses the demo's resting sim state — this checkpoint may replace/augment that ambient source **through the existing jeantimex-derived mechanisms only**).
- `apps/shared-world/src/water/` (RegionWater, RegionWaterSurfacePass, RegionRenderer, shaders) and `VENDOR.md` name mappings.

## 6. Deterministic implementation specification

- Implement ambient swell and underside animation through the existing simulation/surface mechanisms (sim injection, ambient normal path, existing uniforms) — additive uniforms are sanctioned; wave-sim math, normal pass, caustics fragment math, Fresnel/Schlick compositing, Snell behavior, and sky sampling stay byte-identical.
- Boundary forcing is a deterministic function of the static terrain data (shore SDF / terrain height) and the moving ambient field; no per-frame randomness that breaks replay self-consistency (same script → same digest across reloads; new digests vs 05A are expected and recorded).
- Amplitudes, frequencies, falloffs, and the hierarchy ratios live in one recorded parameter table (old → new where a value changed).
- Strong interaction and re-entry ripples must remain clearly stronger than ambient motion; ambient must remain clearly weaker than the swim wake.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for overlays)
# → http://localhost:5198/shared-world/?view=stock    (must remain pristine)
# → http://localhost:5198/shared-world/?view=pool     (unchanged reference)
```

Expected: floating idle underwater and looking up, the surface underside visibly, continuously moves; at shorelines and cliff bases the water shows persistent gentle activity against the static rock; swimming raises a clearly stronger wake; above water the ocean still reads as the same calm approved jeantimex sea.

## 8. Automated verification

Scripted captures per addendum §5.4 (viewport and environment stated):

1. Stationary underwater camera looking upward, ≥ 20 s.
2. Stationary underwater oblique view showing surface distortion over terrain.
3. Dolphin swimming beneath the surface.
4. Dolphin crossing downward after a breach/re-entry event (the sim's existing crossing; the full breach chain and strongest impulses remain cp06).
5. Above-water stock-like comparison.
6. Half-submerged waterline comparison.
7. Idle shoreline/cliff contact showing persistent low-level ambient boundary disturbance.
8. The same boundary during swimming and after re-entry, showing the intensity hierarchy.

Plus: frozen-surface detector (temporal variance of underside normals/refraction at idle strictly > 0 across the 20 s capture); hierarchy measurement (measured disturbance amplitudes ordered ambient < boundary < wake); CP04B four-shot re-run acceptable; stock pixel-identical; shoreline clipping, Fresnel, Snell-window, waterline checks green; containment + replay self-consistency green; `simHz > 100`, sustained median `fps ≥ 58`; suite green, never weakened.

## 9. Manual review procedure (addendum §5.4 pass conditions)

The user judges: the underwater surface never reads frozen or geometrically flat; ambient motion is calm and restrained; movement-driven ripples are stronger; shoreline/protruding-terrain contact stays subtly active during idle; Fresnel, refraction, waterline, Snell behavior, shoreline clipping, and performance remain acceptable; the above-water look is preserved. Free exploration for as long as the user chooses.

## 10. Performance-report requirements

Frame-budget table vs 05A: sim, normal, surface, boundary-forcing cost; fps median/min; any stage over estimate flagged with the documented mitigation order.

## 11. Placeholder inventory requirements

Still none placed (cp07); restate as pending.

## 12. Deviation-report requirements

Every parameter with old → new values; any touched file outside `apps/shared-world/src/water/` justified; any Ecco-frame behavior deliberately not matched, stated honestly.

## 13. Guardrails

- One coherent water system — never a second renderer or a bolted-on effect stack (addendum §5.3; README "Intended implementation hierarchy").
- Approved above-water character, stock demo, pool demo, and 05A terrain are immutable.
- The fallback ladder is not escalated by this checkpoint (addendum §2.1).
- Local-only; keyboard/replay/fixtures only (no camera prompts); tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, parameter table, all eight captures with verdicts, hierarchy measurements, four-shot re-run, performance, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of 05B does not authorize Checkpoint 06.
