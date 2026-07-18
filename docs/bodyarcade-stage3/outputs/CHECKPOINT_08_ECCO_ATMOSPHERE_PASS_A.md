# CHECKPOINT 08 — Ecco Atmosphere Pass A

## 1. Header

Checkpoint 08: the first approved tweak layer — the PS2 *Defender of the Future* underwater atmosphere per Track D, applied **underwater only, through jeantimex's mechanisms** (fog, palette, caustic-intensity uniforms, lights, materials, particles). The surface, waterline, reflections, Snell's window, and sky stay pure jeantimex. Every value applied here is a Track D [BVM]/[REC] estimate — decision-ready but provisional until the user's PCSX2 captures replace it.

## 2. Preconditions and starting state

- Checkpoint 07 approved. Branch `shared-world-slice` at the 07-approved commit; tree clean.
- The approved layout's zone-family assignment (03) is baked in `biome.png`/`world.json`.
- **Asset approval (async gate):** the user has approved the two CC0 terrain-texture downloads (Poly Haven Coral Ground 02; one ambientCG Ground sand set) **before** any file enters the repo — CC0 class still requires the live license-page verification recorded in CREDITS.md. If not yet approved, obtain approval first; that request may be raised before this session.

## 3. In scope

1. Zone-driven fog: THREE.FogExp2 color+density per zone from the Master §6.3 table (only the families present in the approved layout, plus the master depth ramp inside each); `scene.background` = fog color always; zone transitions lerp color+density over 3–5 s of traversal; view-direction tint on the fog-color uniform (+10–15 % luminance toward pale cyan above +20° pitch, −15 % below −25°). Above water: fog off (L row).
2. Lighting rig per Master §6.4: per-zone HemisphereLight + DirectionalLight #FFF4E0 (castShadow false) + dark-zone ambient-floor rules; renderer `SRGBColorSpace`, `NoToneMapping`, no post stack.
3. Materials pass: terrain textures selected and applied — Poly Haven **Coral Ground 02** (seabed) + ambientCG low-contrast sand (beaches/shallows) [Track C §6 ★ picks; CC0 verified at source — re-verify the license pages live and record in CREDITS.md], downsampled to 1–2K, treated per Track D §10 (low-frequency, 3–5 value groups, roughness 0.95–1.0, metalness 0, no normal micro-maps); height/slope blend + triplanar on steep faces (the cp05 shader structure); vertex-hue variety sanctioned; placeholder blocks keep their flat legend colors (they must stay obvious).
4. Caustic dials **through existing jeantimex uniforms only**: intensity → +15–30 % floor luminance; depth-limit full strength top 10 m of water over floor → zero by 20–24 m; drift 0.02–0.05 UV/s. **These dials touch jeantimex-rendered output and require your explicit approval at this review** (Track D needs-user 3) — the checkpoint ships them behind a toggle (`&atmo=1` default on, `&atmo=0` = pre-08 look) so approval is a live A/B.
5. Particles per Master §6.6: marine snow (camera bubble), dolphin bubble trail, action bubble bursts; cave sparks deferred to cp09's dark zones.
6. Four-shot fidelity re-run (surface protection proof) + a new zone-shot board: one capture per zone family present, at mid-band depth, filed for review.
7. Commit.

## 4. Out of scope

- **Nothing above the waterline changes**: sky, surface, reflections, waterline crossing = untouched (R11 keeps the vendored sky; Track D's sky values stay deferred).
- No caves atmosphere (cp09 applies the dark-zone rows when caves exist); no vegetation (cp10); no audio (cp13).
- No shader rewrites; no second caustic system; no post-processing of any kind (§6.8 bans).
- No normal-relief option unless the user pre-approved it (off by default).

## 5. Required inputs

- Implementation Master §6 (entire visual spec incl. banned list), §8.2 (asset pipeline), R5/R11/R14.
- Track D report §6–§11, §17 (parameter tables; reproduce the rows for the zones present), §18 (banned modes), §20 (replacement map — cite per value).
- Track C report §6 (texture sources ★), §8 (budgets/naming).
- Downloads (upon the §2 approval; CC0 class): Poly Haven Coral Ground 02; one ambientCG Ground sand set — record exact asset IDs, resolutions, license-page URLs in CREDITS.md.

## 6. Deterministic implementation specification

- Zone resolution: dolphin position → biome channel → zone family; depth band by water-column position (shallow 0–10 m below surface / mid 10–36 m / deep 36 m+) [Master §6.2]; the active fog = lerp(current, target) with the 3–5 s traversal constant (pin 4 s [DERIVED midpoint, flagged]).
- Fog values: exactly the Master §6.3 rows for the zones present (e.g., Bright shallow #55BFB4 @ 0.058; B #3E9C90 @ 0.075; F #349A90 @ 0.068; E #8AA0A8 @ 0.095 or G #A8CFC8 @ 0.115 per the approved layout; deep-band trend toward the layout's dark family row). Tuning stays inside each row's stated range; out-of-range = deviation.
- Lights: lit zones hemi sky = zone light color @ 0.95, ground = floor tint @ 30 % of sky, directional 0.55 @ 68° elevation [DERIVED midpoints of the Master §6.4 bands, flagged]; desaturated/hazy 0.78 / 0.42; dark-zone rows arrive with cp09.
- Textures: 1K working resolution; value-grouped (posterize toward 4 value groups in authoring, keep hue); tile period ≥ 8 m so mottle reads broad [Track D §10 feature-scale 0.5–1.0 m at texel scale — record the actual tiling]; blend weights by height/slope per cp05 structure.
- Particles: exact Master §6.6 numbers; snow brightness-gated per zone (opacity 0.05–0.15 lit); no additive glow beyond the spec.
- The `&atmo=0` toggle preserves the exact pre-08 rendering path (for A/B and rollback).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region          (atmosphere on)
# → http://localhost:5198/shared-world/?view=region&atmo=0   (pre-08 A/B)
```

Expected: the water *is* the fog — chromatic everywhere, never grey; each zone reads as its family (vivid reef vs desaturated/hazy pocket); distance terminates in colored water with pop-in inside the color field; caustics live only on sunlit shallow floors, modest and slow; the dolphin silhouettes dark against bright water and pale against dark rock; the surface and sky are pixel-for-pixel the pre-08 jeantimex look.

## 8. Automated verification

1. Four-shot re-run: shots (a), (c), (d) must be **pixel-identical** to their 04B-approved references (surface protection — assert luminance delta ≈ 0 in the above-water/waterline/Snell regions); shot (b) changes only by the approved caustic dials (assert the change is confined to caustic-region luminance within the +15–30 % band).
2. Fog law: sampled `scene.fog.color` equals `scene.background` in every zone; no zone's density outside its stated range; E/G far-field lighter-than-near verified on captures (mean luminance far > near).
3. Never-grey: per zone capture, the far-water pixels' saturation > 0.08 [DERIVED floor, flagged] (catches accidental neutral fog).
4. Transition smoothness: scripted swim across two zone borders — fog color/density derivative bounded (no step > 5 % per frame); no visible border in a capture strip.
5. Banned-mode audit (static): no bloom/SSR/AO/tone-mapping/post imports; renderer flags asserted; materials' metalness 0 / roughness ≥ 0.95 (except the dolphin's audited material — R5).
6. Particle budgets: counts within spec at 3 stations; particle stage cost ≤ 0.5 ms.
7. Zone-shot board generated (one per family present) + placeholder census unchanged.
8. `simHz > 100`; sustained median `fps ≥ 58`; frame-budget table updated.

## 9. Manual review procedure

1. A/B `&atmo=1` vs `&atmo=0` per zone; judge against the ten principles (Master §6.1) — the review rubric.
2. **Explicitly approve or reject the caustic dials** (the one jeantimex-output tweak in this pass) using shot (b)'s A/B.
3. Terrain texture read: vivid-but-low-detail, broad value groups, no shimmer, no gloss; placeholders still obviously placeholders.
4. Every value here is provisional ([BVM]/[REC]): confirm you're comfortable shipping the slice on estimates, or schedule the PCSX2 capture sheet (Track D §19 — priority 1 = palettes+fog) to replace them; the toggle + ranges make later re-dials cheap.

## 10. Performance-report requirements

Frame-budget table (every stage), fps median/min per zone (script visits each family), texture memory added, particle costs, delta vs 07.

## 11. Placeholder inventory requirements

Census re-run — must be unchanged (this checkpoint converts no placeholders); state it.

## 12. Deviation-report requirements

Any value outside its Track D range (with cause); all [DERIVED] midpoints restated; texture asset IDs + license verifications recorded; anything the ten principles forced you to adjust away from a table value.

## 13. Guardrails

- Underwater only; surface/waterline/sky/reflections byte-identical (four-shot proves it); vendored files untouched; caustic dials behind the toggle pending explicit approval.
- Banned failure modes (§6.8) are hard fails; the fog is never neutral grey.
- CC0 still gets live license verification + CREDITS.md entries; no other assets enter.
- Approved visuals immutable; `&atmo=0` preserves the approved pre-08 state exactly.
- Local-only; deterministic; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, zone-shot board, four-shot protection proof, caustic-dial A/B, performance, placeholder census, deviations incl. provisional-value list), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
