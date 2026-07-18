# CHECKPOINT 09 — Caves and Overhangs

## 1. Header

Checkpoint 09: true enclosed caves, arches, and overhangs via the Track B-selected method — **authored/kitbashed modular meshes** (Kenney Modular Cave Kit, CC0, finished in Blender) — placed at the approved sites, seamed into the heightfield, with Rapier collision (heightfield + trimesh), BVH queries, dark-zone atmosphere, and aperture-bound light shafts. The SDF/marching-cubes route stays rejected per the decision matrix.

## 2. Preconditions and starting state

- Checkpoint 08 approved (atmosphere mechanism live; caustic-dial ruling recorded).
- Branch `shared-world-slice` at the 08-approved commit; tree clean.
- `caves.json` (04A) carries the approved cave/arch transforms; the layout's dark-zone family (D or J) is assigned.
- **Asset approval (async gate):** the user has approved the Kenney Modular Cave Kit download (CC0 — verify the live license line "40 assets… CC0 licensed" at kenney.nl/assets/modular-cave-kit and record it in CREDITS.md) **before** any file enters the repo. If not yet approved, obtain approval first — that request may be raised before this session.

## 3. In scope

1. Cave/arch module assembly: kit pieces kitbashed in Blender into the approved formations (≥ 1 short cave + ≥ 1 arch per the layout; optional second cave if approved at 03), exported as `.glb` to `apps/shared-world/public/models/caves/`; triplanar rock material shared with terrain at the seams (cp05/08 shader structure).
2. Seam integration per Track B Q19: the 04A bake's lip-stamps verified against the placed modules (re-bake with adjusted stamps if lips gap — determinism proof required); where a module undercuts, the heightfield render/collision is locally masked and the module is authoritative.
3. **Rapier introduction** (`@dimforge/rapier3d`, exact version recorded): one static heightfield collider (513² downsample, ~4 m cells) + one fixed trimesh collider per module; `await RAPIER.init()` boot; one `world.step()` per render frame (no dynamics yet — the world exists for queries/later modes).
4. BVH additions: module meshes join the camera-collision BVH; dolphin cave contact via `closestPointToPoint` push-out feeding the sim's existing soft-contact path (presentation-side query → sim-side analytic force, determinism preserved as at cp05).
5. Dark-zone atmosphere: the layout's cave family row (D: #1E1B0C @ 0.190 or J: #0C1A28 @ 0.240) + dark-zone lighting rows (hemi 0.05–0.15, ambient floor 0.02–0.05, directional ≤ 0.1) engaged inside cave volumes (zone volume = module bounds + margin baked into `caves.json`); cave sparks (family D only: 10–25 motes #FFB347).
6. Light shafts: authored volumetric cones/billboard fans **only at real ceiling apertures** of the placed modules, #DDF2F0, width 2–6 m, brightest element in the zone; exit grammar: the route reads by the bright aperture.
7. Commit.

## 4. Out of scope

- No SDF/marching-cubes/dual-contouring pipeline (rejected — do not build "just in case").
- No vegetation, no new placeholder categories, no audio, no additional caves beyond the approved sites.
- No open-water god rays (aperture-bound only); no lifting cave darkness with ambient.
- No Rapier dynamics on the dolphin (the sim stays kinematic; Rapier is collision infrastructure).

## 5. Required inputs

- Implementation Master §5.2–§5.3 (method + collision), §6.3–§6.5 (dark-zone rows, shafts), §8.2 (pipeline).
- Track B report: CAVES section (Table 8, Q19), COLLISION (Table 9).
- Track D report §8 (shafts), §7 rows D/J/E2, §14 (exit grammar).
- `caves.json` + approved layout; Kenney Modular Cave Kit (user-approved download; CC0 recorded).
- npm: `@dimforge/rapier3d` (record version), existing `three-mesh-bvh`.

## 6. Deterministic implementation specification

- Module poly budget: ≤ 40 k triangles per formation [DERIVED from the trimesh-cost guidance "keep modules modest poly"; flagged]. Blender work limited to kitbash/merge/cleanup/UV — no sculpted new geometry beyond kit pieces and boolean trims (the kit is the asset; Blender is assembly).
- Seam rule: module lip vertices within 0.15 m of the stamped heightfield at the mouth ring; shared material band ±1.5 m across the seam.
- Collision: heightfield matrix column-major per the Rapier JS API; trimeshes as fixed bodies at module transforms; a collision-mask note documents that only queries are consumed this checkpoint.
- Interior navigation feel per Track E §14: TerrainCompressed camera state engages in passages; anti-wedge active; ceilings push down softly (same tangential-slide rule as cp05).
- Zone volumes: entering a cave volume crossfades fog/lighting per the cp08 mechanism (4 s constant feels wrong in a short cave — use 1.5 s inside cave volumes [DERIVED, flagged]).
- Shaft placement: only where a module genuinely opens to sky/water-surface light (list each aperture in the report with its module); intensity tuned so the shaft is the brightest zone element (Track D P3/P8).

## 7. Demo

```bash
npm --prefix apps/shared-world run dev
# → http://localhost:5198/shared-world/?view=region
```

Expected: swim through the cave — the mouth is framed; inside goes genuinely dark with the family palette (sparks if family D); the exit reads as the brightest aperture ahead; the arch frames a corridor shot; overhangs shade correctly; the camera compresses and never clips; contact slides, never wedges; caustics do not reach the cave interior (depth-limit + no aperture = none).

## 8. Automated verification

1. Definition-of-done motion: scripted pass **through** the cave and **under** the arch — completes without wedge, camera LOS held (≤ 0.3 s occlusion), TerrainCompressed engaged/released.
2. Seam integrity: no visible gap at the mouth ring (capture scan ≤ 1 px holes); collision continuity — probe grid across the seam finds no fall-through (query both colliders).
3. Dark-zone law: interior captures — mean luminance below a stated bound, fog color = background = the family row hex; no ambient lift (assert light intensities).
4. Shaft audit: every shaft cone corresponds to a listed real aperture (transform check); no shaft in open water; shaft region is the brightest area of its interior capture.
5. Rapier boots; `world.step()` cost ≤ 0.5 ms; BVH query budget ≤ 4 casts/frame for the camera.
6. Four-shot re-run unchanged; zone-shot board extended with the cave family; placeholder census: cave-mouth marker blocks now replaced (census reflects the conversion — first placeholder conversion of the project).
7. Replay self-consistency; containment battery; breach suite — all green.
8. `simHz > 100`; sustained median `fps ≥ 58` including a cave transit in the script.

## 9. Manual review procedure

1. Swim the cave slowly and fast; judge Ecco-ness: framed mouth, genuine darkness, aperture wayfinding, spatial drama of the arch; sparks read (if D).
2. Judge the seam (mouth transition) from outside and inside, above and below.
3. Camera comfort in the tightest passage (this is where the original game failed — be exacting; no spazz, no clip, no lost dolphin).
4. Rule on flagged values (cave transition 1.5 s, poly budget, spark counts).

## 10. Performance-report requirements

Frame-budget with Rapier + trimesh lines; cave-interior fps worst case; BVH memory; module triangle counts; delta vs 08.

## 11. Placeholder inventory requirements

Census diff: cave-mouth markers → real modules (converted); every other category unchanged. The census file records its first conversion entry (category, count converted, asset source, license).

## 12. Deviation-report requirements

Deviations from Track B Q19/Table 9 with cause; all [DERIVED] flags; Blender operations performed per module (assembly log); any lip re-bake (determinism proof); aperture list.

## 13. Guardrails

- Kit + Blender assembly only — no invented cave geometry beyond kit pieces; CC0 verified live and credited; purchase nothing.
- Approved visuals immutable (atmosphere rows as approved at 08; surface untouched; four-shot proves).
- Dolphin sim stays deterministic/kinematic; Rapier is infrastructure; BVH is presentation-side.
- Dark zones stay dark (banned-mode list); shafts aperture-bound only.
- Local-only; tests never weakened.

## 14. Stop

Produce the end-of-checkpoint report (changes, cave/arch captures, seam + shaft audits, census diff, performance, deviations), commit, then:

STOP — wait for user review and approval before any further visual change. Approval of this checkpoint does not authorize starting the next checkpoint.
