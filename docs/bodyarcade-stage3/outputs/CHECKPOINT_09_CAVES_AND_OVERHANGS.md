# CHECKPOINT 09 — Caves and Overhangs

## Header

**Checkpoint:** 09 — Caves and Overhangs
**Prerequisite:** Checkpoint 08 approved. Ecco atmosphere verified underwater.
**Base state:** Full region with atmosphere, terrain, water, breach, placeholders.

---

## Scope

**Build:**
1. **Author cave and arch meshes** using the CC0 Kenney Modular Cave Kit (40 assets, CC0 licensed) + Blender finishing:
   - At least 1 cave (short passage with entry and exit).
   - At least 1 arch (swim-through sea arch).
   - Optional: 1 overhang / grotto.
   - Modules assembled in Blender, exported as GLB.

2. **Create the cave manifest** (`assets/world/caves.json`):
   ```json
   {
     "caves": [
       {
         "id": "cave_01",
         "glb": "models/caves/cave_01.glb",
         "position": [x, y, z],
         "rotation": [0, yaw, 0],
         "scale": 1.0,
         "zones": ["D_olive_cave"]
       }
     ]
   }
   ```

3. **Seam blending with terrain** (Track B Q19):
   - Cave module mouth footprint overlaps terrain.
   - Heightmap locally lowered at authoring time to meet module lip.
   - Shared triplanar rock material across terrain and cave near the seam.
   - Vertex-color or mask blend band at the lip.

4. **Rapier trimesh collision** per cave module:
   ```typescript
   const caveCollider = RAPIER.ColliderDesc.trimesh(vertices, indices);
   world.createCollider(caveCollider);
   ```
   Static/fixed bodies — no dynamic trimeshes.

5. **Cave-zone fog/lighting** (Track D §17.2–17.3):
   - Dark zones: fog color from D/J/K/H/I/E2 table rows.
   - Near-zero ambient light.
   - Shaft lights (#DDF2F0) at apertures (entry/exit).
   - PointLights (warm) radius < 4 m (1.38 BL) inside caves (Track D §17.3; Track D original: < 2 BL × 2.0 m = 4 m).
   - Zone transition at cave mouth (3–5 s lerp from exterior to cave zone).

6. **Camera in caves** (Track E §14):
   - Dolly-in response: t90 0.15 s.
   - Never clip through cave walls.
   - Reduced follow distance in tight spaces.
   - Maintain dolphin visibility — if obstructed, pull camera closer.

7. **Collision seam continuity** (Track B Q19):
   - The seam is covered by both heightfield collider (terrain) and cave trimesh (overlap).
   - Where a cave undercuts (the heightfield can't represent an overhang), the heightfield is locally omitted and the trimesh is authoritative.
   - No clip-through at seams.

**Out of scope:**
- Cave-specific wildlife (checkpoint 11).
- Cave-specific vegetation (checkpoint 10).
- Additional caves beyond the minimum (user adds more later).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §5.4 (Cave Method), §5.5 (Collision) | Cave plan, seam blending |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Table 8, Q19, Q20 | Cave method decision, seam spec, collision |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §8, §17.2–3 | Cave zone fog/lighting |
| Kenney Modular Cave Kit | CC0 | Cave module source |
| Approved region layout (from CP03) | — | Cave placement positions |

---

## Specification

### Cave module construction

1. Download the Kenney Modular Cave Kit (CC0, free, kenney.nl/assets/modular-cave-kit).
2. In Blender: assemble 3–5 modules into a short cave passage (entry, interior section, exit).
3. Scale to match the terrain: entry should be ~4–8 m wide, ~3–6 m tall (1.38–2.77 BL wide, 1.04–2.08 BL tall).
4. Export as GLB with applied transforms.
5. Drop into `apps/shared-world/public/models/caves/`.

### Seam geometry

```
         Terrain heightfield
        /                    \
  ──────                      ──────
        \___Cave mouth lip___/
            │              │
            │  Cave mesh   │
            │              │
```

The heightmap is stamped down at the cave mouth position. The cave mesh lip overlaps the lowered terrain by 1–2 m.

### Cave fog zones

| Zone | fog.color | fog.density | Ambient light |
|---|---|---|---|
| D olive cave | #1E1B0C | 0.190 | 0.05–0.15 |
| J deep cavern | #0C1A28 | 0.240 | 0.05–0.10 |
| K olive tunnel | #14120A | 0.200 | 0.05–0.10 |

Shafts at apertures: `PointLight` #DDF2F0, intensity 0.3–0.6, distance 10–15 m. Place at entry/exit looking inward.

### three-mesh-bvh for cave queries

```typescript
import { computeBoundsTree } from 'three-mesh-bvh';
caveMesh.geometry.computeBoundsTree();
// Camera collision raycasts use BVH-accelerated intersection
```

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- A cave entrance visible in the terrain — framed mouth with a shaft of light.
- Swimming into the cave: fog thickens dramatically, colors shift to dark zone palette.
- Inside: nearly dark, with warm point lights and a shaft at the far exit.
- Swimming through: can see the exit as a bright opening.
- A sea arch: swim through, see terrain framed on both sides.
- Cave terrain and surrounding terrain share the same rock material at the seam.

**What the user should try:**
- Swim into the cave — fog transition should be gradual (3–5 s).
- Inside the cave — genuinely dark, not just dimmed. Navigation relies on the exit light.
- Swim through the arch — terrain framing is dramatic.
- Check for collision: dolphin doesn't clip through cave walls.
- Check the camera: does it handle tight spaces without clipping or disorienting?

---

## Verification

### Automated
- Rapier trimesh collision: dolphin doesn't penetrate cave walls.
- Collision seam: no clip-through at terrain↔cave junction.
- Camera never intersects cave geometry.
- fps ≥ 60 at 1728×1080.
- Zone transition: fog parameters at cave entry match Track D table values.

### Manual review
- Cave mouth framing looks natural (not a floating box).
- Terrain↔cave seam is continuous (same material, no gap).
- Cave is genuinely dark — "caves stay genuinely dark" (Track D anti-principle #5).
- Light shafts at entries/exits are visible and atmospheric.
- Camera handles the tight space without becoming disorienting.
- Exit is visible from inside — navigation is readable.

---

## Stop

**STOP.** Report:
1. Cave modules created (count, dimensions, module sources).
2. Seam blending method and result.
3. Collision setup (trimesh counts, performance impact).
4. Cave zone fog/lighting parameters in use.
5. Camera behavior in caves.
6. Screenshots: cave entry, interior, exit, arch swim-through.
7. Performance: fps in caves (additional overhead from trimeshes).
8. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 09 does not authorize starting checkpoint 10.**

---

## Guardrails

- Cave modules from CC0 Kenney kit only (or authored in Blender from scratch). No invented models.
- jeantimex: no additional shader modifications beyond CP04's sanctioned edits.
- Approved visuals (water, terrain, atmosphere from previous CPs) immutable.
- Local-only.
- Caves stay genuinely dark — do not lighten them for visibility.
- Credits: Kenney Modular Cave Kit is CC0, no attribution required but record in CREDITS.md for courtesy.
