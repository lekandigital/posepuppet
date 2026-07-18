# CHECKPOINT 12 — Ruins and Architecture

## Header

**Checkpoint:** 12 — Ruins and Architecture
**Prerequisite:** Checkpoint 11 approved. Fish and wildlife motion in place.
**Base state:** Full region with water, terrain, caves, atmosphere, vegetation, fish, remaining placeholders.

---

## Scope

**Build:**
1. **Replace ruin/architecture placeholder blocks** (tan #D2B48C) with user-supplied structure assets as they become available:
   - Load each structure GLB via `GLTFLoader`.
   - Place at the position, rotation, and scale from `placement.json`.
   - Sit on terrain via `terrainHeight(x, z)`.

2. **Rapier trimesh collision** per structure:
   - `ColliderDesc.trimesh(vertices, indices)` — static/fixed body.
   - Or `ColliderDesc.convexHull(points)` for simpler shapes (cheaper).
   - Camera collision: three-mesh-bvh accelerated raycasts against structures.

3. **Structure material treatment** (Track D §17.4):
   - `MeshLambertMaterial` or `MeshStandardMaterial`.
   - Roughness 0.95–1.0, metalness 0.
   - No specular highlights, no PBR gloss.
   - Structures should look weathered, matte, integrated into the environment.
   - Vertex AO or baked AO if the asset provides it.

4. **Placement grammar** (Track D §14, master context §7):
   - Structures integrated into landscape: at a slight natural tilt, with sand/rocks/plants/coral around them.
   - No floating structures — all grounded on terrain or seabed.
   - Ruins read as submerged or abandoned without procedural destruction.
   - 2–4 landmarks per corridor view, 0–2 per open plain.

5. **Wreck/dock placeholders** (brown #8B4513):
   - Replace with user assets when supplied.
   - Until then, keep as placeholder blocks at intended positions.

6. **Any remaining placeholder categories** that haven't been addressed:
   - Sponge (yellow #FFD700) — keep as placeholder until assets.
   - Large marine wildlife (purple #800080) — keep as placeholder.
   - Any other unresolved categories — document in the placeholder inventory.

**Out of scope:**
- Generating or purchasing structure models. Only user-supplied assets are loaded.
- Interior exploration of ruins (future phase).
- Interactive structures (doors, switches, mechanisms — future).
- Audio (checkpoint 13).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §8.3 (Placeholders) | Category list, colors |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §14 | Composition grammar |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §4 | Asset pipeline standards |
| `assets/world/placement.json` | (from CP07) | Structure positions |
| User-supplied GLB files | — | Structure models (when available) |

---

## Specification

### Structure loading pipeline

```typescript
async function loadStructure(entry: PlacementEntry): Promise<Group> {
  const gltf = await loader.loadAsync(`/shared-world/models/structures/${entry.glb}`);
  const model = gltf.scene;
  
  // Position on terrain
  const y = terrainHeight(entry.x, entry.z);
  model.position.set(entry.x, y, entry.z);
  model.rotation.set(0, entry.yaw, 0);
  model.scale.setScalar(entry.scale);
  
  // Apply material constraints
  model.traverse((child) => {
    if (child instanceof Mesh) {
      const mat = child.material as MeshStandardMaterial;
      mat.roughness = Math.max(mat.roughness, 0.95);
      mat.metalness = 0;
    }
  });
  
  // Create collision
  const collider = createTrimeshCollider(model);
  
  return model;
}
```

### Asset drop path

```
apps/shared-world/public/models/structures/
├── ruin_01.glb
├── tower_01.glb
├── dock_01.glb
└── ... (user adds over time)
```

Each new asset requires:
1. A placement entry in `placement.json`.
2. A `CREDITS.md` entry with license attribution.
3. Material adjustment to meet Track D constraints.

### Collision approach per structure

| Structure type | Collider | Reasoning |
|---|---|---|
| Large ruin (complex) | Trimesh | Accurate swim-around |
| Simple tower/pillar | Convex hull | Cheaper |
| Dock/bridge | Trimesh | Needs accurate underside |
| Small prop | Bounding box | Cheapest |

### Placeholder replacement workflow

When the user provides a model:
1. Copy GLB to `apps/shared-world/public/models/structures/`.
2. Add placement entry to `placement.json` (or update existing placeholder entry with the GLB reference).
3. Add credits to `CREDITS.md`.
4. Remove the placeholder block at that position.
5. Verify collision and material.

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- If the user has supplied structure models: real ruins, towers, docks visible at their placement positions.
- If no models supplied yet: tan placeholder blocks remain at structure sites.
- Structures sit naturally in the terrain — grounded, possibly tilted, with vegetation/coral around them.
- The composition feels like an inhabited (now abandoned) underwater landscape.

**What the user should try:**
- Swim around/through/over structures — collision should prevent clipping.
- Verify structures look weathered and matte (no specular shine).
- Check that the camera handles structures (dolly-in when obstructed).
- Swim a full loop — do the landmark/ruin positions create good navigation reference points?

---

## Verification

### Automated
- All loaded structures have Rapier collision (trimesh or convex hull).
- No structures floating (y position matches terrain height).
- Material constraints: roughness ≥ 0.95, metalness = 0.
- fps ≥ 60 at 1728×1080.

### Manual review
- Structures are grounded naturally in terrain.
- Material looks weathered, integrated, not shiny.
- Camera handles structure proximity (dolly-in, no clip-through).
- Composition: landmarks serve as navigation aids (Track D §14 grammar).

---

## Stop

**STOP.** Report:
1. Structures loaded (count, names, sources, licenses).
2. Collision approach per structure.
3. Complete placeholder inventory:
   - Replaced: dolphin ✓, vegetation ✓, structures (list which), fish (placeholder).
   - Remaining as placeholder: fish (awaiting models), large wildlife, sponge, wreck (unless supplied).
4. Material check results.
5. Performance: fps with structures + vegetation + fish.
6. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 12 does not authorize starting checkpoint 13.**

---

## Guardrails

- No invented assets. Only user-supplied models are loaded; everything else stays as placeholder.
- Agents purchase nothing.
- Approved visuals immutable.
- Local-only.
- Every new asset needs a CREDITS.md entry with verified license.
