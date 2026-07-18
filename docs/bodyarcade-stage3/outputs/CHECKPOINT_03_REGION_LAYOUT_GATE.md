# CHECKPOINT 03 — Region Layout Gate

## Header

**Checkpoint:** 03 — Region Layout Gate
**Prerequisite:** Checkpoint 02 approved. The dolphin swims with camera in the pool.
**Base state:** Dolphin + camera working in the jeantimex pool.

---

## Scope

**Produce:**
1. **2–3 top-down sketch maps** of the fictional ~2 km × 2 km region. Each sketch shows:
   - Island arrangement (larger islands, smaller islands, islets, exposed rocks).
   - Reef shelf locations and extents.
   - Trench/canyon positions and depths.
   - Cave site markers (at least one cave, one arch per the definition-of-done).
   - Landmark placement (spires, arches, columns, ruins).
   - Boundary geography (cliffs, reef walls, currents marking the region edge).
   - Depth zones (shallow shelf, mid-depth, deep trench, cave depths).
   - Suggested spawn/start location.
   - Scale bar and compass rose.

2. Each sketch should embody the **compositional seed** from master context §7: "a calm lagoon linked to a reef shelf, then a trench pocket, with one arch, one short cave, one current, and one optional discovery."

3. Annotate each sketch with:
   - Approximate depth at key points.
   - Terrain character per zone (sandy, rocky, reef, cliff, cave).
   - Vegetation zones (kelp forest, seagrass meadow, coral reef area).
   - Wildlife density guidance (reef = denser, open plain = sparser).
   - Landmark type at each marked position.

4. Brief written comparison of the 2–3 options (trade-offs: exploration variety, visual distinctiveness, pacing, boundary naturalness).

**This is a decision gate, not a build checkpoint. No code is written.**

**Out of scope:**
- Any code changes, terrain baking, or implementation.
- Detailed 3D modeling or heightmap generation.
- Finalizing the layout — the user picks or redlines.

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §2 (World Contract), §5 (Terrain Plan) | Region scale, depth range, coordinate system |
| `00_BODYARCADE_MASTER_CONTEXT_V3.md` | §7 | Region character, density, composition |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §14 (Composition), §6–7 | Zone families, depth stratification, landmark grammar |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | §Terrain | Heightmap resolution, terrain tools, cave method |

---

## Specification

### Region parameters

- 2 km × 2 km, origin at center (0,0).
- Max depth: −80 m below sea level (y = 0).
- Tallest peak: +200 m.
- At least 3 distinct terrain zones visible from the starting point.
- Gradual transitions between zones (no visible biome borders).

### Required features (master context §7, §13.3 definition-of-done)

- At least one cave and one arch.
- At least 3 breach sightline spots where islands/terrain are visible.
- A full loop traversal path of 5–10 minutes at cruise speed (**5 m/s**, canonical per master context §7).
- Boundary enclosed by natural geography (cliffs, reef walls, depths), not invisible walls.

### Depth stratification (Track D §6–7)

Sketches should show how depth zones map onto the terrain:
- Bright shallow band (0–5 m): lagoon, reef top
- Mid-depth reef/kelp (5–25 m): reef shelves, kelp forests
- Open mid-water (25–50 m): sandy plains, canyons
- Deep zones (50–80 m): trenches, dark caves, chambers

### Landmark grammar (Track D §14, converted to canonical 1 BL = 2.89 m from Track D's 1 BL = 2.0 m)

- Free-standing stone arches: 4–8 m wide (1.38–2.77 BL).
- Isolated spires/pinnacles: 6–16 m tall (2.08–5.54 BL).
- Framed cave mouths with bright exits.
- One or two strong navigational silhouettes always in view.
- Sparse-versus-dense cadence: corridors with 2–4 landmarks alternate with open plains.

---

## Demo

**No runnable demo** — this checkpoint produces design artifacts only.

**What the user sees:** 2–3 annotated top-down sketch maps (generated images or clear diagrams) plus a written comparison.

---

## Verification

### User review
The user selects one layout, modifies it (redlines), or requests a new option. No implementation proceeds until a layout is approved.

### Acceptance criteria for the selected layout
- Contains all required features (cave, arch, 3 breach spots, loop path).
- Depth zones are distributed to support Track D's fog/palette stratification.
- Boundary feels natural.
- The user says "approved" or provides specific modifications.

---

## Stop

**STOP.** Present the 2–3 sketches and comparison to the user.

**Wait for user selection or redlines. The selected layout becomes the authoritative region plan for all subsequent checkpoints. Approval of checkpoint 03 does not authorize starting checkpoint 04 — the user must explicitly approve a specific layout.**

---

## Guardrails

- No code changes. This is a design gate only.
- No invented assets. Sketches show placeholder locations, not generated 3D models.
- The region is fictional — no real-world geography.
- Settled decisions stay settled: 2 km × 2 km, −80 m to +200 m, y = 0 sea level.
