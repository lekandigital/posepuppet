# CHECKPOINT 04 — Pool to Region

## Header

**Checkpoint:** 04 — Pool to Region
**Prerequisite:** Checkpoint 03 approved — user has selected a region layout.
**Base state:** Dolphin + camera in pool; approved region layout sketch.

---

## Scope

**Build:**
1. **Bake the approved region heightmap** using ProceduralTerrains (MIT) and/or THREE.Terrain (MIT) as authoring tools. Output the baked-data schema per implementation master §2.4:
   - `assets/world/height.r16` — 2049² 16-bit heightmap
   - `assets/world/shore.png` — 2049² 8-bit shoreline mask (terrain ≥ 0 = land)
   - `assets/world/world.json` — region origin, size, seaLevel, height range

2. **Implement `WorldData` runtime loader:**
   - Decode heightmap → Float32 array.
   - Build `terrainHeight(x, z)` bilinear sampler.
   - Derive shoreline mask.
   - This is the single-source-of-truth function all subsystems call.

3. **Container swap — the canonical minimal edit** (Track B Tables 1–2):
   - Replace `intersectCube` / `poolHeight` in the water-above and water-below fragment shaders with a **seabed heightfield raymarch** that samples the baked height texture.
   - Replace the caustics vertex shader's floor-plane intersection with a terrain heightfield intersection.
   - Replace pool wall shaders with coastline geometry (terrain above sea level) + terrain material.
   - Add new uniforms: `uSeaLevel` (0.0), `uHeightTex`, `uRegionSize`, `uWindowOrigin`, `uShoreMask`.
   - **Every other shader/pass stays byte-identical.**

4. **Implement windowed 512² player-following sim** (Track B Q4):
   - 512² GPU sim domain covering a 256 m square centered on the dolphin.
   - Snap window origin to 0.5 m texel increments.
   - Scroll-copy overlapping texels; zero at new edges.
   - Cosine falloff over outer ~10% blends into ambient global surface.

5. **Global surface plane** at y = 0 spanning the region, clipped by shoreline mask (alpha-discard where terrain ≥ 0).

6. **Simple flat-color seabed** placeholder (single color per depth band from Track D §6) — detailed terrain material deferred to checkpoint 08.

7. **Re-point `WorldSampler`** in `sim.ts` from rectangular pool boundary to the authored region's shoreline mask + heightfield.

8. **Re-tune containment band** from 55 m (bay-scale) to a region-appropriate value (Track A §4.8). Start at ~200 m for a 2 km region and tune.

9. **Run the four-shot fidelity test** (Track B Table 4) comparing the region build against the stock demo.

**Out of scope:**
- Terrain mesh rendering with LOD (checkpoint 05).
- Islands above water (checkpoint 05).
- Detailed terrain materials / texturing (checkpoint 08).
- Breach (checkpoint 06).
- Caves (checkpoint 09).
- Placement data, biome masks (checkpoint 07+).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §2 (World Contract), §4 (Water Plan), §5 (Terrain Plan) | All specs |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Tables 1–4, Q4, Q5, Q6 | Container swap, windowed sim, shoreline clip, fidelity test |
| Approved region layout (from checkpoint 03) | — | The map to bake |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §6 | Simple depth-band colors for placeholder seabed |

---

## Specification

### Container swap — changed shaders

**Water-above fragment (`RoundedBoxWaterAbove.frag` or equivalent):**
```glsl
// BEFORE: intersectCube(origin, ray, cubeMin, cubeMax)
// AFTER:  raymarchSeabed(origin, ray, uHeightTex, uSeaLevel, uRegionSize)
// Returns: hit point + normal on the seabed heightfield
// Everything else in getSurfaceRayColor stays byte-identical
```

**Water-below fragment (`RoundedBoxWaterBelow.frag`):**
Same replacement: box→heightfield raymarch for `getWallColor`/`getSurfaceRayColor`.

**Caustics vertex shader:**
```glsl
// BEFORE: intersect floor plane at fixed y = -poolHeight
// AFTER:  sampleTerrainHeight(worldXZ) from uHeightTex
// Differential-area math stays byte-identical
```

**Wall pass:**
Pool box walls → authored coastline geometry (terrain mesh where height ≥ 0).

### Heightfield raymarch

Fixed-step + binary refinement along the ray against the height texture. ~16 steps + 4 refinement typically sufficient for the terrain scale.

### Windowed sim scroll

```typescript
// Each frame:
const snapX = Math.round(dolphin.position.x / texelSize) * texelSize;
const snapZ = Math.round(dolphin.position.z / texelSize) * texelSize;
// If window moved: scroll-copy overlapping texels, zero new edges
// Update uWindowOrigin uniform
```

### Four-shot fidelity test procedure

Capture PNGs at 1728×1080 at four fixed camera transforms:
1. **(a)** Above-water angle: ~30° down, over open water away from shore.
2. **(b)** Underwater caustics: 5 m below surface, pitched down at seabed.
3. **(c)** Half-submerged: camera at y = 0, horizontal.
4. **(d)** Snell's window: 3 m below, pitched up.

Compare visually against checkpoint 00 stock demo captures. Pass = "every visible part of the water appears to belong to the same jeantimex system."

---

## Demo

```bash
npm --prefix apps/shared-world run dev
# Open http://localhost:5198/shared-world/
```

**What the user should see:**
- The dolphin swimming in a much larger water body bounded by the region's coastline.
- Water still looks like the jeantimex demo — same caustics, same surface, same Fresnel.
- The seabed is visible below (flat-colored by depth band).
- Coastline walls are visible at the edges.
- Water surface is clipped where terrain is above sea level (no water over land).

**What the user should try:**
- Swim across a large area — water interaction (ripples) follows the dolphin.
- Swim to the coastline edge — containment pushes back gently.
- Look at caustics on the seabed — they should match the demo character.
- Surface and look at the waterline — clean split.
- Compare mentally with the stock demo: does the water look the same?

---

## Verification

### Automated
- Four-shot fidelity test: capture and compare (manual visual inspection; record screenshots).
- No jeantimex shader file modified except the sanctioned items (diff check).
- `terrainHeight(x, z)` returns correct values at sampled points.
- Containment battery: dolphin never exits region; never hard-walls.
- fps ≥ 60 at 1728×1080.
- `simHz > 100`.

### Manual review
- Four-shot A/B comparison against stock demo.
- Caustics on the seabed heightfield look correct (broad, bright, slightly slow).
- Shoreline alpha-clip is clean (no z-fighting, no water over land).
- Windowed sim: ripples follow the dolphin; no visible window boundary.
- Feel: swimming in the larger space is still pleasurable (re-tune containment/speeds if needed).

---

## Stop

**STOP.** Report:
1. Summary of shader changes (enumerate every file modified, what changed, what stayed).
2. Four-shot fidelity test results (screenshots + pass/fail per shot).
3. Windowed sim parameters (resolution, coverage, texel size, scroll method).
4. Containment band value and behavior.
5. `terrainHeight` sampling accuracy.
6. Performance: fps, frame-budget breakdown.
7. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 04 does not authorize starting checkpoint 05.**

---

## Guardrails

- jeantimex modifications are **only** the sanctioned container-swap edits (items 1–6, 9, 13 from Track B Table 1). Everything else stays byte-identical.
- No invented assets. The seabed is flat-colored placeholder.
- Approved visuals (water look) are compared via the four-shot test — any regression is a defect.
- Local-only.
- `sim.ts` architecture preserved.
