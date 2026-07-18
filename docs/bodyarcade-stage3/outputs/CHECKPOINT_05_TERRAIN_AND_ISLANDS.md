# CHECKPOINT 05 — Terrain and Islands

## Header

**Checkpoint:** 05 — Terrain and Islands
**Prerequisite:** Checkpoint 04 approved. The dolphin swims in the region-scale water with the container swap passing fidelity tests.
**Base state:** Region water + heightfield seabed + shoreline mask + flat-color seabed.

---

## Scope

**Build:**
1. **Render the baked heightfield as a terrain mesh** using chunked static LOD:
   - 8×8 or 16×16 tile grid over the 2049² heightmap.
   - 3–4 discrete LOD levels per chunk.
   - Skirt rings at chunk boundaries to hide cracks.
   - **Silhouette-preserving LOD bias:** coastline and peak chunks keep highest LOD regardless of distance.

2. **Terrain material** (simple initial pass — refined at checkpoint 08):
   - `MeshLambertMaterial` or `MeshStandardMaterial` with roughness 0.95–1.0, metalness 0.
   - Height/slope-based blending: sand (shallow flat) → rock (steep/deep) → cliff (vertical).
   - Triplanar projection on steep surfaces (coastline walls).
   - Use placeholder low-frequency textures (e.g., Poly Haven CC0 rock/sand) or vertex colors.
   - One directional light + hemisphere light matching the implementation master §6.3 (lit-zone defaults).

3. **Continuous terrain crossing the waterline:**
   - Islands emerge where `terrainHeight(x,z) ≥ 0`.
   - Terrain mesh is continuous — same geometry above and below water.
   - Above water: terrain rendered normally with land material.
   - Below water: terrain rendered as seabed with underwater material (receives caustics).

4. **Shoreline masking verified:**
   - From above: water surface ends cleanly at the shoreline; no water rendered over land.
   - From below: looking up past the shoreline, no visual artifacts at the waterline-terrain intersection.
   - Swimming near the shore: clean transition, no z-fighting.

5. **Rapier heightfield collision:**
   - `ColliderDesc.heightfield(heights, scale)` from the downsampled heightmap (~513² = ~4 m cells).
   - The dolphin's soft-repulsion containment detects the terrain gradient and pushes away from land/seabed.
   - Seabed contact: gentle push-out + slight upward reorient (Track E §14 — never a hard stop).

6. **Above-water sky:**
   - Simple sky gradient (zenith #3F93DA → horizon #82C8F2, Track D §15).
   - Discrete white cumulus clouds (#F2F8FB) as a skybox or procedural background (Track D §15).
   - No sun disc, no flare, no god rays.

**Out of scope:**
- Breach through the surface (checkpoint 06).
- Vegetation, rocks, coral, fish, ruins (checkpoints 07–12).
- Cave meshes (checkpoint 09).
- Ecco atmosphere pass / fog zones (checkpoint 08).
- Detailed terrain texturing (checkpoint 08).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §2, §5 | World contract, terrain plan |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Q14–Q17 | LOD, material, data flow, transferable techniques |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §15 | Sky, above-water presentation |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | §14 | Terrain collision behavior |
| `assets/world/height.r16`, `shore.png`, `world.json` | (from CP04) | Baked data |

---

## Specification

### Terrain mesh construction

```typescript
// For each chunk (i, j) in the tile grid:
const chunkSize = regionSize / gridDivisions; // e.g., 2000/16 = 125 m
const geometry = new PlaneGeometry(chunkSize, chunkSize, lodRes, lodRes);
// Sample heightmap at each vertex
// Apply height + terrain material
// Add skirt ring at boundaries (extra row of vertices dropped to min height)
```

### LOD levels

| Level | Vertex resolution per chunk | Distance threshold |
|---|---|---|
| 0 (highest) | 64×64 | < 200 m |
| 1 | 32×32 | 200–500 m |
| 2 | 16×16 | 500–1000 m |
| 3 (lowest) | 8×8 | > 1000 m |

Coastline/peak chunks: always level 0 (silhouette protection).

### Rapier collision setup

```typescript
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
// Downsample 2049² → 513² for physics
const collider = RAPIER.ColliderDesc.heightfield(
  512, 512, heights, // column-major
  { x: regionSize, y: heightRange, z: regionSize }
);
world.createCollider(collider);
```

### Above-water sky (Track D §15)

| Element | Specification |
|---|---|
| Sky gradient | Zenith #3F93DA → horizon #82C8F2 |
| Clouds | Discrete white cumulus #F2F8FB, well-separated, mid-sky |
| Sun | No sun disc, no flare, no god rays |
| Fog above water | Effectively off (density 0.000–0.002) |

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- Islands rising above the water surface. Coastlines visible.
- Swimming underwater: seabed terrain with height variation, reef shelves, slopes.
- Swimming to the surface: looking across, islands and sky visible, water ending at coastlines.
- Terrain has basic material — rock/sand differentiated by height/slope.
- Above-water sky is a clean tropical blue with white clouds.

**What the user should try:**
- Swim along the seabed — terrain collision gently pushes the dolphin up, never stops hard.
- Swim to the coast — containment pushes back before reaching land.
- Surface near an island — see the island's coastline from above and below.
- Swim to different depths — terrain changes character (shallow sandy, deep rocky).
- Verify: water still looks like the jeantimex demo (four-shot re-check if concerned).

---

## Verification

### Automated
- `terrainHeight(x, z)` matches rendered mesh height at sampled points (render/collision consistency).
- Rapier collision: dolphin never penetrates terrain by more than the slide tolerance (−0.5 m).
- Shoreline mask: no water fragments rendered over land.
- fps ≥ 60 at 1728×1080.
- `simHz > 100`.

### Manual review
- Islands emerge correctly from the water.
- Shoreline looks clean from above and below.
- LOD transitions not visible (no popping).
- Terrain collision feels soft and natural.
- Sky looks correct (clean tropical blue, no modern effects).

---

## Stop

**STOP.** Report:
1. Terrain mesh stats (chunk count, total triangles per LOD, peak tri count in view).
2. Rapier collision setup (grid resolution, step cost).
3. Shoreline verification (above/below screenshots).
4. LOD level distribution.
5. Performance: fps, frame-budget breakdown including terrain.
6. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 05 does not authorize starting checkpoint 06.**

---

## Guardrails

- No invented assets. Terrain textures are placeholder or CC0.
- jeantimex: only the sanctioned edits from checkpoint 04. No new shader changes.
- Approved visuals (water from CP04) immutable.
- Local-only.
- One terrain dataset drives everything — visible/collision mismatch is a defect.
