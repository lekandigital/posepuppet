# CHECKPOINT 10 — Vegetation

## Header

**Checkpoint:** 10 — Vegetation
**Prerequisite:** Checkpoint 09 approved. Caves and overhangs in place.
**Base state:** Full region with water, terrain, caves, atmosphere, placeholders.

---

## Scope

**Build:**
1. **Replace vegetation placeholder blocks** (green #228B22 and dark green #006400) with baked vegetation meshes.

2. **Vegetation source** — SeedThree (MIT, WebGPU-first) used as an **offline authoring tool** (master context §8.1):
   - Generate vegetation models (trees, kelp, seagrass, coral branching) in SeedThree.
   - Bake to glTF (export from SeedThree → GLB).
   - Instance at runtime with a small vertex-sway shader.
   - If SeedThree proves too costly: use Quaternius nature packs (CC0, verified) or other CC0 alternatives.

3. **Vegetation types and placement:**

   | Type | Environment | Placement rule | Sway shader |
   |---|---|---|---|
   | Trees | Islands (above waterline) | On land, from biome mask | Wind sway (sine + noise, ~0.3 Hz) |
   | Shrubs / flowers | Islands | Land, mixed with trees | Light wind sway |
   | Kelp | Mid-depth (5–25 m) | Kelp forest zones in biome mask | Current sway (slower, ~0.1 Hz) |
   | Seagrass | Shallow sandy (0–10 m) | Sandy shallow areas | Gentle current |
   | Coral (branching) | Reef shelves (2–15 m) | Reef zones | No sway (rigid) |
   | Grass | Islands | Land ground cover | Wind sway |

4. **Instanced rendering** (Track B Q17):
   - `InstancedMesh` per vegetation type per chunk.
   - Alpha-test cards for foliage (no alpha blending — alpha test is cheaper and avoids sort).
   - Per-chunk frustum culling.
   - Distance fade into fog (Track B Q17: fade + fog to hide cull distance).

5. **Vertex-shader sway** (Track B Q17):
   - Above water (wind): `position.x += sin(time * 0.3 + position.y * 2.0) * sway * vertexHeight`.
   - Below water (current): `position.x += sin(time * 0.1 + worldPos.z * 0.5) * sway * vertexHeight`.
   - Sway amplitude scales with height (top moves more, base is anchored).

6. **Material constraints** (Track D §17.4):
   - `MeshLambertMaterial` or `MeshStandardMaterial`, double-sided for cards.
   - Roughness 0.95–1.0, metalness 0.
   - No specular highlights on vegetation.

7. **If SeedThree is not available or too costly:** use CC0 low-poly vegetation from Quaternius nature packs as interim bakes. Record the substitution in the deviation report. The placeholder blocks for any category where no vegetation model is ready remain as placeholders — never invent a model.

**Out of scope:**
- Fish / wildlife (checkpoint 11).
- Ruins / architecture (checkpoint 12).
- Audio (checkpoint 13).
- Detailed ground textures / ground vegetation density refinement (future polish).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §8.1 (SeedThree), §8.3 (Placeholders) | Vegetation plan |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §4–5 | Vegetation categories, CC0 sources |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Q17 | Instancing, wind shader, distance fade |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §17.4 | Material constraints |
| `assets/world/biome.png`, `placement.json` | (from CP04/07) | Where to place vegetation |

---

## Specification

### SeedThree offline bake workflow

1. Run SeedThree locally (MIT, offline).
2. Configure: tree type, branching, leaf density, scale.
3. Export to glTF/GLB.
4. Place exported GLBs in `apps/shared-world/public/models/vegetation/`.
5. At runtime: `GLTFLoader` → extract geometry → create `InstancedMesh`.

### Instance budget

| Type | Max instances in view | Budget |
|---|---|---|
| Trees | 200–400 | ~50k tris |
| Kelp | 300–600 | ~30k tris |
| Seagrass | 500–1000 | ~10k tris |
| Coral | 100–300 | ~30k tris |
| Shrubs | 200–400 | ~20k tris |

Total vegetation budget: ~140k tris max in view. Fade at distance.

### Vertex sway shader (GLSL snippet)

```glsl
// In vertex shader:
uniform float uTime;
uniform float uSwayAmplitude; // 0.0 for rigid, ~0.1 for gentle, ~0.3 for strong
uniform float uSwayFrequency; // 0.3 Hz above water, 0.1 Hz below

float sway = sin(uTime * uSwayFrequency * 6.2832 + position.y * 2.0 + instancePosition.x) 
           * uSwayAmplitude * (position.y / maxHeight); // scales with height
transformed.x += sway;
transformed.z += sway * 0.3; // secondary axis
```

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- Islands covered with trees, shrubs, and grass (swaying gently in wind).
- Underwater: kelp forests swaying in current, seagrass on sandy shallows, branching coral on reef shelves.
- Vegetation replaces the corresponding colored placeholder blocks.
- The fog fades vegetation into the haze at distance (no hard pop-in).

**What the user should try:**
- Surface near an island — see trees and vegetation on land.
- Swim through a kelp forest — kelp sways around the dolphin.
- Approach coral on a reef shelf — dense, colorful (or placeholder-colored until assets arrive).
- Swim away from vegetation — it fades into fog smoothly.
- Performance: is it still 60 fps with all the instanced vegetation?

---

## Verification

### Automated
- Green/dark-green placeholder blocks replaced by vegetation meshes.
- Instance counts within budget.
- No vegetation placed above waterline in underwater zones or vice versa.
- fps ≥ 60 at 1728×1080.

### Manual review
- Vegetation looks natural at its placement positions.
- Sway animation is subtle and organic, not mechanical.
- Kelp forests are atmospheric — density creates corridors.
- Distance fade is smooth — no hard pop-in.
- Material: matte, no specular glints (Track D §17.4 compliance).

---

## Stop

**STOP.** Report:
1. Vegetation source used (SeedThree bakes, Quaternius CC0, or other — with license).
2. Types placed (tree, kelp, seagrass, coral, shrub) with instance counts.
3. Sway shader parameters.
4. Instance budget vs. actual.
5. Placeholder inventory update (vegetation categories now replaced; remaining placeholders).
6. Performance: fps, vegetation draw cost.
7. Screenshots of vegetation in each environment (island, kelp forest, reef, shallows).
8. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 10 does not authorize starting checkpoint 11.**

---

## Guardrails

- No invented assets. Use SeedThree bakes, CC0 packs, or keep placeholders.
- Credits: record all vegetation sources in CREDITS.md.
- Approved visuals (water, terrain, atmosphere, caves) immutable.
- Local-only.
- Vegetation that hasn't been baked yet stays as placeholder blocks.
