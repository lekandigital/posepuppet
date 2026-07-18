# CHECKPOINT 05 — Terrain Across the Waterline

## 1. Header

Checkpoint 05: one continuous terrain crossing the waterline — the proper chunked-LOD terrain renderer replaces the 04A graybox, islands emerge with protected silhouettes, shoreline masking is verified from above and below the surface, and the region-scale camera/terrain interaction lands (BVH camera collision; slide/anti-wedge dolphin contact). This is part of the region-scale movement/camera work Track E assigns to checkpoints 4–6.

## 2. Preconditions and starting state

- Checkpoint 04B approved (four-shot verdicts recorded; any SHORE_BAND ruling applied as a recorded amendment).
- Branch `shared-world-slice` at the 04B-approved commit; tree clean.

## 3. In scope

1. Chunked terrain renderer: **16×16 tiles (128 m), 4 static LOD levels (grid steps 1/2/4/8), skirt rings**, per-tile frustum culling; **silhouette protection** — tiles crossing the coastline (shore-mask intersection) or flagged ridge lines (baked into `world.json` at 04A; add the flag in a 04A-compatible re-bake if absent) keep LOD 0.
2. Terrain material mechanism (selection still deferred to cp08): height/slope-blended **vertex tints** per R14 + slope-based rock/sand split, triplanar-ready shader structure, single DirectionalLight + hemisphere, distance fade consistent with the demo's existing underwater look. No textures yet.
3. The water pipeline consumes the same chunked mesh as its refraction/reflection/wall render target (replacing the graybox), keeping `terrainHeight` as the single source (§2.2 law).
4. three-mesh-bvh over the LOD-0 terrain (and later cave) geometry: camera collision sphere-casts replace the pool-era analytic clamp; TerrainCompressed camera state goes live (distance compression in narrow passes).
5. Dolphin/terrain contact per Track E §14: soft push-out from the seabed/walls (project velocity onto the surface tangent — decelerate-and-slide, never a hard stop), anti-wedge nudge on low-speed multi-contact, facing stays under player control.
6. Shoreline masking verification above + below (scripted captures at 3 island beaches).
7. Commit.

## 4. Out of scope

- No textures (cp08), no caves/overhangs (cp09), no vegetation/placeholders (cp07/10), no breach chain work (cp06), no Rapier (cp09 — BVH handles this checkpoint's queries).
- No atmosphere values (fog remains the demo's own until cp08).
- No vendored edits beyond what 04B already sanctioned (this checkpoint touches app-owned terrain/camera/sim code only).

## 5. Required inputs

- Implementation Master §5.3–§5.4 (collision/LOD), §2.2 (law), §7.5 (camera states), R14.
- Track B report: Q15–Q17 (material mechanism, LOD, transferable techniques), Table 9 (BVH row).
- Track E report §14 (terrain/collision behaviors; anti-principles: no wedging, no lost target).
- npm: `three-mesh-bvh@0.9.x` (MIT; record exact version).
- Baked artifacts from 04A.

## 6. Deterministic implementation specification

- LOD selection by camera distance: level thresholds 0–256 m / 256–512 / 512–1024 / >1024 [DERIVED: two/four/eight tile radii; flagged], silhouette-protected tiles pinned to level 0. Skirts: 2 m drop [DERIVED].
- Vertex tint bands: sand #D2C7A9 where slope < 20° and height ∈ [−12, +2] m; rock #A98F6C elsewhere; blend over 4 m/8° [DERIVED thresholds, provisional-until-cp08; flagged].
- Camera collision: sphere-cast (radius 0.75 m) dolphin→desired-camera against the BVH; on hit, dolly-in along the ray (t90 0.15 s); TerrainCompressed when sustained compressed distance < 60 % of target for > 0.5 s (blends distance/height parameter set down 40 % [DERIVED, flagged]).
- Dolphin contact: sample `terrainHeight` + BVH closest-point within a 1.2 m probe; contact → remove the into-surface velocity component (keep tangential 85 % [DERIVED from the slide-energy scrub pattern in `sim.ts`; flagged]), pitch-nudge away from the surface at ≤ 0.5 rad/s; anti-wedge: if speed < 0.75 m/s with ≥ 2 contact normals > 60° apart for > 1 s, apply a 0.5 m/s nudge along the mean open direction.
- Determinism: all contact logic lives in the 120 Hz sim step using `WorldData` sampling (BVH queries for the *camera* only are presentation-side; the sim's terrain contact uses the analytic heightfield + shore SDF so replays stay platform-stable).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region   (&debug=1 for overlays)
```

Expected: islands rise from the sea with clean shorelines from every side; silhouettes never pop or simplify visibly; surfacing near a beach shows terrain continuing above the waterline; grazing the seabed slides smoothly and never sticks; the camera compresses gracefully in narrow passes and never clips through rock.

## 8. Automated verification

1. Shoreline masking: at 3 approved beaches, captures from above water looking at the shore and from below looking up-slope — assert no water surface over land (mask test) and no gap between water edge and terrain > 1 texel.
2. Silhouette LOD: scripted 1.5 km flyby capture series; assert protected tiles stayed LOD 0 (instrument the selector) and no crack pixels along skirts (seam scan on captures).
3. Camera collision: scripted pass through the narrowest approved corridor; camera never intersects terrain (BVH distance ≥ 0.6 m every frame), subject never occluded > 0.3 s, TerrainCompressed engages and releases.
4. Slide/anti-wedge: scripted head-on swim into a cliff at cruise — speed after contact ≥ 40 % of entry within 1 s (slide, not stop), no position jitter > 0.3 m/frame; wedge scenario (concave pocket) escapes within 3 s.
5. Single-source law: render-mesh vertex heights vs `terrainHeight` at 100 probes ≤ 0.01 m (LOD 0).
6. Suite: 04B four-shot captures re-run — shots must still pass (terrain change must not have disturbed the water look); containment battery green; replay self-consistency green.
7. `simHz > 100`; sustained median `fps ≥ 58`; terrain stage ≤ 3 ms (budget line).

## 9. Manual review procedure

1. Swim the full approved loop; surface at each island; judge coastline reads above/below; watch for LOD pops on the summit silhouette.
2. Deliberately graze and ram terrain: slide feel, wedge-free, camera behavior in tight spots (enjoyment criteria re-run, Master §7.8).
3. Rule on flagged [DERIVED] values (LOD thresholds, tint thresholds, compression factors, tangential keep).

## 10. Performance-report requirements

Frame-budget table update (terrain line now real): tile counts drawn per LOD, triangle totals, BVH build time + query µs, fps median/min vs 04B, memory delta.

## 11. Placeholder inventory requirements

Still none placed; restate the census as pending cp07.

## 12. Deviation-report requirements

Deviations from Master §5.4/Track B Q16–Q17 with cause; all [DERIVED] thresholds restated; any re-bake performed (ridge flags) noted with its determinism proof.

## 13. Guardrails

- Water look untouched beyond consuming the new mesh (four-shot re-run proves it); vendored files unmodified.
- Approved visuals immutable; provisional tints remain explicitly provisional (no texture shopping — cp08).
- Sim determinism: contact logic heightfield-analytic inside the 120 Hz step; BVH is camera/presentation only.
- No invented assets; no Rapier yet; local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, masking/silhouette evidence, contact-feel data, four-shot re-run, performance, placeholder statement, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
