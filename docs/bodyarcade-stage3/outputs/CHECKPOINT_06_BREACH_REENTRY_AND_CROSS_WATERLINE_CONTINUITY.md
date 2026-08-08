# CHECKPOINT 06 — Breach, Re-entry, and Cross-Waterline Continuity

> **RE-SCOPED (2026-08-08)** by `../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`
> §5. The side-branch implementation (`bodyarcade-shared-world-cp06-cp07`) is
> superseded and not in this line's history. When CP06 runs after 05C: the
> cross-waterline rendering law, split-level behavior, and Snell-window optics
> (§§3.4–3.5 below) arrive largely free with the ported WaterThreeJS ocean;
> remaining scope is the breach interaction chain, camera states, and splash —
> which acts through the ocean's **contact-foam/splash-impulse mechanism**, not
> `addDrop` sim injections. Every reference below to jeantimex compositing, the
> sanctioned edit family, four-shot regressions, and "no new water renderer" is
> void. The 13-frame Ecco set remains the composition/behavior reference; the
> preconditions become "05C approved" instead of "05A + 05B approved".

## 1. Header

Checkpoint 06 (renamed from "Breach over the region" by the post-CP05 addendum §6): breach and re-entry remain the central interaction, and this checkpoint now also owns the **first complete implementation of continuous geometry and camera-side-dependent visibility across the waterline** — the water is never modeled as simply opaque from above and transparent from below. Governing decision: `docs/bodyarcade-stage3/decisions/POST_CP05_TERRAIN_WATERLINE_CHECKPOINT_AMENDMENTS.md` (read in full).

## 2. Preconditions and starting state

- **Both** CP05A (revised terrain + substrate coloring) and CP05B (ambient motion + boundary interaction) implemented, reviewed, and **explicitly approved** (addendum §6.1).
- Branch `bodyarcade-shared-world` at the 05B-approved commit; tree clean.
- Required reading: the addendum (§6, §11.3); this prompt; `docs/bodyarcade-stage3/references/ecco-waterline/README.md` **and all 13 image files — inspect the images before implementing and again before final review** (addendum §6.5); master §4, §7.4 (breach constants), §7.5 (camera states); Track E §15/§19; Track D §15 (above-water presentation; the vendored sky stays per R11).

## 3. In scope

1. **Breach chain** (Track E §15; master §7.4 initial values BREACH_MIN_SPEED 3.75, BREACH_MIN_VY 3.2, BREACH_GRAVITY 7.5, REENTRY_KEEP 0.85, COOLDOWN 1.0 — flagged for retune at review): initiation, ascent, airborne arc, peak height, descent; variable airtime monotonic with speed; failed/shallow breach below threshold.
2. **Camera through the transition** (master §7.5 SurfaceTransition/Airborne/ReEntryRecovery states): ordinary trailing-camera behavior preserved through the crossing; above-water framing exposes the revised islands, ridges, mini-islands, and shoreline without terrain seams; no disconnected cinematic camera unless the approved Track E chain explicitly requires a transient authored adjustment; no abrupt snaps.
3. **Re-entry impulse and splash**: the strongest transient surface disturbance, layered over the continuous 05B baseline (hierarchy: ambient < boundary < wake < breach/re-entry) with gradual, natural decay. `addDrop`-style burst injections at both crossings (Track B Q7); no separate breach-only renderer or disconnected splash surface.
4. **Cross-waterline rendering law** (addendum §6.3): render above-water and underwater geometry continuously through the surface, visibility controlled by camera side, view angle/Fresnel balance, local surface slope + animated normal distortion, water depth, horizontal distance, underwater attenuation/fog, and local disturbance. Required results: **no hard clipping** of dolphin, terrain, islands, or other geometry at the water plane; from underwater, above-water terrain may be clear, faint, distorted, reflection-dominated, or effectively hidden by conditions; from above, the submerged dolphin, terrain, and seabed remain visible where transmission conditions permit; partially submerged objects stay spatially continuous; visibility changes smoothly, never popping. Coherent variation is the requirement, not guaranteed full visibility.
5. **Split-level rendering** (addendum §6.4): frames showing both sides simultaneously — above-water pixels use above-water lighting/sky/color/reflection, underwater pixels use underwater tint/attenuation/haze/distortion, the waterline is a narrow animated refractive boundary (not a hard scene cut), and one object can occupy both optical regions without splitting into disconnected renderings.
6. Continuity of the dolphin body as portions cross the surface. Commit.

## 4. Out of scope

- No placeholders (cp07); no final atmosphere/optics tuning (cp08 — fog, palette, and the final reflection/transmission balance stay provisional); no caves (cp09).
- No claim of pixel-identical Ecco reproduction — the 13 frames define behavior and composition only.
- No new water renderer; no vendored edits beyond the sanctioned family; no push/merge/rebase/PR.

## 5. Required inputs

- Addendum §6 complete (preconditions, behavior, rendering law, split-level, Ecco acceptance set, ripple relationship, regressions).
- The Ecco acceptance set: `docs/bodyarcade-stage3/references/ecco-waterline/README.md` + all 13 PNGs (breach peak `ATLAS_02/D08_R0006…`; underwater→above terrain `ATLAS_01/D05_R0011…`; submerged dolphin from above `ATLAS_02/D09_S0007…`; above→underwater view `ATLAS_02/D10_R0022…`; low/high-visibility underside pair `ATLAS_03/D10_R0122…`/`…R0131…`; strong near-surface visibility `ATLAS_04/D12_R0037…`, `…R0039…`, `…R0040…`; floor-level nearby-terrain visibility `…R0043…`; deep-water composition `…R0102…`; split-level pair `…S0028…`/`…S0029…`).
- Master §4 (water plan), §7.4–§7.5; Track E §15/§19; the 05A/05B reports.

## 6. Deterministic implementation specification

- Breach physics stays in the 120 Hz deterministic sim (existing BREACH_* mechanism retuned over the revised region); camera states blend parameter sets 0.2–0.5 s; splash occlusion brief (Track E Table D starting values), minimal control lockout.
- Cross-surface visibility is implemented through the existing jeantimex-derived compositing (Fresnel/Schlick, refraction, Snell window) extended per the sanctioned edit family — reflection/transmission terms consume the real scene on both sides; no binary opacity rule, no hard cutoff thresholds.
- All tunables (visibility falloffs, waterline band width, splash strength/decay) recorded in one table with source labels; final tuning is cp08's.

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for overlays)
```

Expected: build speed, breach at the approved sightline spots — the arc reveals the sharpened islands and ridges; the dolphin stays one continuous body through both crossings; re-entry throws the strongest splash which decays into the living 05B ocean; hovering at the waterline shows a true split-level frame; slipping just under the surface still shows the peaks above, filtered through the moving underside.

## 8. Automated verification (addendum §6.7)

Re-run all relevant 05A terrain and 05B water checks, plus:

1. Shoreline gaps / water-over-land checks at approved sites.
2. Camera collision around sharper peaks and cliffs (BVH clearance, no occlusion > 0.3 s).
3. Breach and re-entry near rough shoreline geometry (scripted, multiple speeds/angles; airtime monotonic with speed; positive + negative breach tests).
4. Continuous body rendering while crossing (capture series; no frame with a clipped/vanishing half).
5. Underwater upward views immediately after re-entry; above-water views of the submerged dolphin immediately after entry.
6. Split-level captures with both optical regions present in one frame.
7. Distance- and angle-dependent opposite-side terrain visibility probes (smooth variation, no hard cutoff).
8. Stock, pool, and four-shot water regressions.
9. Performance with revised terrain, refraction, split-level rendering, splash, and ripple injection all active: `simHz > 100`, sustained median `fps ≥ 58` at 1728×1080, per-stage timings.

## 9. Manual review procedure

Judge against the 13-frame acceptance set using the README's frame-by-frame interpretation — breach peak/framing, cross-surface visibility range (low to high), split-level behavior, continuity, decay hierarchy — and free-swim as long as desired (enjoyment criteria, master §7.8). Rule on flagged tunables.

## 10. Performance-report requirements

Frame-budget table vs 05B with the split-level/refraction and splash costs itemized; viewport and environment stated.

## 11. Placeholder inventory requirements

Still none placed (cp07); restate as pending.

## 12. Deviation-report requirements

Any deviation from the addendum §6 law (a binary-opacity shortcut anywhere is a red-flag deviation); all derived tunables; any Ecco frame whose behavior was deliberately deferred to cp08 tuning.

## 13. Guardrails

- The 05B motion hierarchy is built on, never replaced (addendum §6.6).
- Approved 05A terrain, 05B ambient character, stock, and pool are immutable.
- One water system; vendored files unmodified; jeantimex wins over the Ecco spec until cp08's approved tuning.
- Local-only; tests never weakened; keyboard/replay input only.

## 14. Stop

Produce the end-of-checkpoint report (changes, breach/airtime data, capture sets mapped to the 13 frames, regressions, performance, deviations), commit locally, then:

STOP — wait for user review and approval. Approval of Checkpoint 06 does not authorize Checkpoint 07.
