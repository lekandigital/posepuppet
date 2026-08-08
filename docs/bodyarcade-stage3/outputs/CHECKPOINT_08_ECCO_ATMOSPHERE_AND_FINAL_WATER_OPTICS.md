# CHECKPOINT 08 — Ecco Atmosphere and Final Water Optics (Pass A)

> **RE-SCOPED (2026-08-08)** by `../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`
> §7. Checkpoint 05C owns the water look wholesale; CP08 becomes **Atmosphere
> Zones and Final Tuning**: per-zone underwater extinction/fog-density/palette
> dials through the ported ocean's uniforms and post volumetrics (zone data from
> `biome.png`/`world.json`), the final substrate palette pass, dark-zone
> groundwork for cp09, particle budgets, and one recorded table of final values.
> Void below: the four-shot re-run, "jeantimex mechanisms only", the FogExp2
> mechanism prescription, "no post stack", R11, and the reflection/transmission
> ownership (05C's). Track D zone tables remain starting-value references
> re-expressed through the new uniforms; the Ecco frames remain a composition
> reference; placeholder law unchanged.

## 1. Header

Checkpoint 08 (amended by the post-CP05 addendum §8): the **finishing and art-direction pass** — underwater atmosphere per the Track D spec applied through jeantimex mechanisms, plus the **final water-optics tuning** (reflection/transmission balance, cross-surface visibility, split-level behavior). It operates **over the CP05A substrate-classification foundation** — it maps existing substrate classes into the final palette; it does not invent terrain categories, and it owns the final optical tuning that CP06 implemented structurally. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- Checkpoint 07 approved; branch `bodyarcade-shared-world` at the 07-approved commit; tree clean.
- Required reading: the addendum (§8, §11.3); this prompt; Track D report **in full** (principles P1–P10, §6–§11, §17 parameter tables, §18 banned modes); master §6; `docs/bodyarcade-stage3/references/ecco-waterline/README.md` **and all 13 images** (inspect before implementing and before final review); the 05A classification documentation; the 06 report's deferred-tuning table.

## 3. In scope

### Kept from the original plan (addendum §8.1)

1. Underwater-only fog and atmosphere: FogExp2 per zone (Track D 17.2 colors/densities as starting values), scene background = fog color, view-direction tint, 3–5 s zone transitions.
2. Zone lighting (Track D 17.3), restrained shallow-floor caustics dialed through jeantimex uniforms (17.5 — caustic-uniform changes require explicit user approval), approved particles (17.6), final approved terrain textures and material tuning (Track C sourcing flow with live license checks and user approval).
3. Preservation of surface, waterline, reflection, and Snell behavior; four-shot re-run.

### New responsibilities (addendum §8.2)

4. Map the **05A substrate classes** into the final Ecco-directed palette; tune underwater substrate colors to stay readable through fog and refraction; add approved textures **without erasing classification** or making surfaces uniformly noisy; preserve sharp 05A silhouettes — never smooth them into featureless masses.
5. Verify direct and raymarched terrain remain consistent after every palette/texture change.
6. Keep the 05B ambient ripples visible from below after atmosphere and fog are applied.
7. Perform the **final reflection/transmission balance** for views from both sides of the surface; tune angle-, depth-, and distance-dependent cross-surface visibility **without hard cutoff thresholds**; tune the underside animated-normal refraction so it ranges from reflection-dominated to clearly transmissive, matching the Ecco acceptance set; finalize split-level tint, haze, waterline thickness, and transition behavior.
8. Preserve the CP06 guarantee that geometry remains continuous across the surface. Commit.

## 4. Out of scope

- **No asset substitution** (addendum §8.3): terrain textures, color, particles, and fog must not pretend missing asset geometry exists; rectangular placeholders remain until later asset checkpoints.
- No terrain-shape changes; no cave geometry (cp09); no new water renderer; no post stack (no bloom/SSR/AO/god-ray/film/CRT/dither); no banned failure modes (Track D §18, master §6.8); no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §8; Track D full report (§17 tables are the starting dials; every [BVM]/[REC] stays labeled provisional until the PCSX2 capture sheet replaces it); master §6 and R11 (vendored sky ships unchanged; Track D sky values remain approval-pending); Ecco README + 13 frames; 05A substrate-class documentation; 05B parameter table; 06 tunables table.

## 6. Deterministic implementation specification

- All atmosphere acts through jeantimex mechanisms and app-owned uniforms (fog/palette/caustic-intensity dials); zone data from `biome.png`/`world.json`; deterministic transitions; one recorded table of every final value (zone × {fog color, density, hemi, directional, caustic, particle budget}) plus the optics table (Fresnel bias, transmission floors/ceilings, waterline band, split-level tints).
- Substrate mapping is a palette-level transform of the 05A classes — the classification function itself is not rewritten; classes in, final colors out.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for zone/fog overlays)
# → http://localhost:5198/shared-world/?view=stock    (pristine reference)
```

Expected: the region finally *feels* like Defender of the Future — chromatic fog that is the water, zone palettes on the depth ramp, value-contrast navigation, matte materials, shallow-band caustics — while the waterline shows the full Ecco optical range: sometimes mirror-dominated, sometimes clearly transmissive, always continuous, with placeholders still plainly placeholders.

## 8. Automated verification

1. Zone fog/caustic uniform checks (master §11.1): per-zone values match the recorded table; background == fog color; transitions smooth.
2. Four-shot fidelity re-run vs stock — final gate on the water look.
3. Ecco-set comparison captures: one scripted capture per relevant README frame class (underside low/high visibility, above→under, under→above, split-level pair, deep-water falloff), judged at review.
4. Substrate-class preservation probes: classification at fixed probe points identical before/after the palette/texture pass; direct vs raymarched terrain color equivalence.
5. 05B ambient-motion captures re-run under final fog (surface never frozen from below).
6. CP06 continuity captures re-run (no hard clipping introduced by optics tuning).
7. Placeholder census unchanged; no placeholder visually converted into an "asset" by texture/fog.
8. Suite green; `simHz > 100`; sustained median `fps ≥ 58` at 1728×1080 with atmosphere + particles + placeholders active; degradation order per master §10 (particles cut first; fog/palette/silhouettes protected).

## 9. Manual review procedure

The user rules per zone on fog color/density and palette against Track D P1–P10; approves or rejects caustic dials and any normal-relief option (master §12 item 16); judges the final cross-surface optical range against the 13 frames; confirms dark zones stay dark and nothing banned crept in. Free exploration as long as desired.

## 10. Performance-report requirements

Full frame-budget table vs 07 (atmosphere, particles, final optics costs itemized); fps median/min; viewport and environment stated.

## 11. Placeholder inventory requirements

Census re-stated; explicit confirmation that no placeholder was removed, hidden, or visually substituted by this pass.

## 12. Deviation-report requirements

Every final value with its source label ([BVM]/[REC]/[DERIVED] provenance carried); any Track D value overridden by a user ruling; any Ecco-frame behavior consciously not matched; any jeantimex uniform touched beyond the sanctioned set (red-flag).

## 13. Guardrails

- jeantimex mechanisms only; the fidelity hierarchy stands — where jeantimex and the Ecco spec disagree, jeantimex wins until the user approves each tweak at this review.
- CP06 geometry continuity and 05B ambient/boundary motion are load-bearing and immutable; optics tuning may not reintroduce hard clipping or a frozen surface.
- Substrate classes classify substrate only; atmosphere never fakes assets; placeholders remain.
- Local-only; tests never weakened; estimates never presented as native Ecco measurements.

## 14. Stop

Produce the end-of-checkpoint report (changes, final value tables, four-shot verdicts, Ecco-set comparisons, performance, placeholder confirmation, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of this checkpoint does not authorize starting the next checkpoint.
