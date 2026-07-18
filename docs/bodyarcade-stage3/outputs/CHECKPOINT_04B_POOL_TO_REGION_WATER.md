# CHECKPOINT 04B — Pool to Region Water (the Canonical Minimal Edit)

## 1. Header

Checkpoint 04B (second half of master-ladder checkpoint 4): the jeantimex water leaves the pool and owns the authored region — rectangular walls/floor become the coastline walls + seabed heightfield via the sanctioned container swap; the interactive sim becomes a 512² player-following window under one global calm surface; the four-shot fidelity comparison against the stock demo is run and reported. This is the single most protected step of the project: **everything not in the sanctioned edit family stays byte-identical.**

## 2. Preconditions and starting state

- Checkpoints 03 and 04A approved (baked artifacts committed; containment battery green against `RegionSampler`).
- Branch `shared-world-slice` at the 04A-approved commit; tree clean.
- `VENDOR.md` §6.4 findings from checkpoint 00 in hand (exact shader/function/uniform names in this port — use those names wherever this prompt names the Wallace originals).

## 3. In scope

1. App-owned copies of the vendored shader set + `Renderer.ts`/`Water.ts` wrappers under `apps/shared-world/src/water/` implementing the **"region" pool type** (vendored files remain untouched; the stock path keeps using them).
2. The container swap (Master §4.2, exhaustive edit list): heightfield raymarch replacing `intersectCube`/`poolHeight` in water-above, water-below, and caustics-vertex stages; coastline-wall/terrain material pass replacing the tiled box walls; shoreline alpha-clip on the surface; new uniforms `uSeaLevel`, `uHeightTex`, `uRegionSize`, `uWindowOrigin`, `uShoreMask`.
3. The windowed sim (Master §4.3): 512² covering 256 m (0.5 m/texel), origin snapped to 0.5 m, scroll-copy on window movement, cosine edge falloff (outer 10 %) into the global calm plane's ambient swell.
4. `?view=region` becomes the game view: dolphin + sim on `RegionSampler`, spawn at the approved spawn, camera rig from cp02 (far plane 2500), dolphin displacement + drops injected into the windowed sim.
5. Feel at region scale, first pass: SHORE_BAND/SHORE_PUSH review data collected (instrumented overlay); TRIM_SPEED and ASSIST_DEPTH_FRAC observed at 80 m depths.
6. The four-shot fidelity procedure vs `?view=stock`, plus the performance model's first real numbers.
7. Commit.

## 4. Out of scope

- No proper terrain rendering pass (the 04A graybox mesh serves as the rendered terrain/refraction target this checkpoint; cp05 owns LOD/material/silhouettes).
- No breach work beyond what the sim already does (cp06 owns the breach chain and its camera states over the region).
- No atmosphere pass (fog stays the demo's own underwater look; Track D values arrive at cp08).
- No caves, no placeholders, no vendored-file edits, no fallback-ladder escalation without the evidence rule.

## 5. Required inputs

- Implementation Master §4 (entire water plan), §2 (contract), §7.4 (region-scale flags), §10 (budget).
- Track B report: WATER section complete (Tables 1–5, Q4–Q11).
- `VENDOR.md` (actual names/resolutions in this port).
- Baked artifacts from 04A (`height.r16` → a `DataTexture` uploaded once; `shore.png` → `uShoreMask`).

## 6. Deterministic implementation specification

### 6.1 Raymarch

`raymarchSeabed(origin, ray)`: fixed-step march (initial step 4 m, 48 steps max [DERIVED: covers 192 m — beyond underwater visual range; flagged]) sampling `uHeightTex`; on sign change, 6 binary-refine iterations; returns hit point + normal (central differences, 1-texel offset). Above-water rays that exit the region bounds fall through to the vendored sky sampling (unchanged). The same function serves items 1, 2, 4 of the edit table.

### 6.2 Surface and window

- Global surface: one plane 2000×2000 m at y 0, vendored surface shader, driven by the ambient-swell normal (low-amplitude — reuse the demo's resting sim state as the ambient contribution; no new wave model) + the windowed sim's displacement/normal composited inside the window with the cosine falloff.
- Window scroll: on dolphin movement ≥ 0.5 m, shift ping-pong contents by the texel delta (copy pass), zero-fill exposed edges; `uWindowOrigin` updated.
- Shoreline alpha-clip: surface fragment `discard` where `terrainHeight(x,z) ≥ 0` (sampled from `uHeightTex`); no geometry cuts, no stencil.
- Sim step count, damping, injection API: byte-identical to the vendored values (recorded in VENDOR.md).

### 6.3 Caustics

Caustics vertex stage projects refracted light onto the seabed via the same raymarch; fragment differential-area math untouched; caustic RT stays at the vendored resolution. Cost gate: if the caustics stage exceeds ~1.5 ms, reduce caustic-projection march steps first (report), before any thought of the martinRenou fallback (which additionally requires a source license re-verification and user approval).

### 6.4 Sim/feel instrumentation

Dev overlay (`?debug=1`): speed, shore distance, depth under dolphin, containment force, window origin, per-stage GPU timings (EXT_disjoint_timer_query where available, else CPU-side stage timing). SHORE_BAND=55/SHORE_PUSH=10.5 kept; the overlay + battery data feed the review's retune ruling.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region      (the game)
# → http://localhost:5198/shared-world/?view=stock       (reference)
# → append &debug=1 for the instrument overlay
```

Expected: swim the real region under real jeantimex water — wake and ripples travel with you (windowed sim invisible as a mechanism), caustics dance on the actual seabed, the surface clips cleanly at island shores, containment redirects softly at coastlines, depths reach −80 m. The stock view remains pixel-identical.

## 8. Automated verification

1. **Four-shot fidelity** (Master §4.4): scripted captures (a)–(d) in `?view=region` at recorded transforms + the same four in `?view=stock`; assert files exist, nonzero, 1728×1080; compute per-pixel luminance delta in the water region for (a) — assert within the stated tolerance (report the number; the visual A/B is manual).
2. Snell geometry: in shot (d), the bright cone's angular diameter ≈ 97° ± 6° (measure via the captured image's known FOV).
3. Containment battery (from 04A) re-run in the live view: green.
4. Window continuity: scripted 200 m sprint; assert no visible seam artifact flag from a shader-side NaN/discontinuity check (window-edge displacement at the falloff boundary ≤ 1 mm) and no frame with fps < 45.
5. Shore clip: sample 500 shoreline-adjacent pixels above beaches — no water-surface pixels over land (mask test on a capture).
6. Depth law: `depthAt` vs water-shader depth tint agreement at 10 probe points (single-source-of-truth check).
7. Replay determinism self-consistency (new digests expected vs pool — assert same-script-same-digest across reloads).
8. `simHz > 100`; sustained median `fps ≥ 58` on the scripted region swim; per-stage timings recorded.

## 9. Manual review procedure

1. A/B the four shot pairs full-screen: "every visible part of the ocean appears to belong to the same jeantimex system" — the pass criterion, your call per shot.
2. Free-swim the loop (~5–10 min): containment feel at coastlines (SHORE_BAND 55 verdict: keep / widen / narrow — this is the flagged region-scale retune), trim/assist behavior at depth, wake readability at cruise and burst.
3. Confirm the surface reads calm and Ecco-appropriate at distance (no storm character).
4. If any shot fails: the fallback ladder's evidence rule engages — the failing shots + profile numbers are the escalation evidence; **escalation itself requires your approval** (nothing auto-escalates).

## 10. Performance-report requirements

The first full frame-budget table vs Master §10: wave sim / normal / caustics / terrain / surface-raymarch / objects / post, plus totals, fps median/min, resolution, and the pose-reserve statement. Flag any stage over its estimate (surface raymarch > 4 ms triggers the documented mitigation order: fewer march steps → smaller window coverage → then, only with approval, ladder rung 2).

## 11. Placeholder inventory requirements

Still none placed (cp07); restate the 04A census as pending.

## 12. Deviation-report requirements

Every divergence from the Master §4.2 edit list (anything additional you had to touch is a **red-flag deviation** — name it, justify it, await ruling); all [DERIVED] values (march steps/refine counts, tolerances); VENDOR.md name mappings actually used; any Track B assumption that didn't survive contact with this port.

## 13. Guardrails

- **Byte-identical rule**: wave-sim math, normal pass, caustic fragment math, Fresnel/Schlick compositing, Snell behavior, sky sampling, displacement pattern — untouched. Only the §4.2 family changes, in app-owned copies; `vendor/` files unmodified (manifest check).
- jeantimex wins over the Ecco spec everywhere at this checkpoint (no atmosphere tuning).
- Approved visuals (stock demo, pool view, region preview, dolphin) immutable.
- No invented assets; graybox terrain is debug geometry; purchase nothing.
- Fallback ladder: documented, evidence-gated, user-approved only.
- Local-only; sim architecture preserved; keyboard-only play works; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, four-shot pairs + verdict per shot, frame-budget table, containment data, placeholder statement, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
