# CHECKPOINT 14 — Rowing, Walking, and Flight

## Header

**Checkpoint:** 14 — Rowing, Walking, and Flight
**Prerequisite:** Checkpoint 13 approved. Audio in place. The full Dolphin experience is complete.
**Base state:** Complete Dolphin exploration slice with water, terrain, caves, atmosphere, vegetation, fish, structures, audio.

---

## Scope

**Build three additional movement modes over the same region, proving the shared-world architecture.** Each mode reuses the existing terrain, water, atmosphere, and assets — one world, one style.

### 14.1 Rowing Mode

**Donor:** Rowing branches in the monorepo (seated propulsion, steering authority, oar-water interaction, boat vehicle). (Master context §12.1)

1. **Port the rowing controller** from the rowing branch:
   - Seated propulsion model.
   - Steering via oar differential.
   - Keyboard fallback: arrow keys or similar (distinct from dolphin W/A/S/D).

2. **Boat as a surface vehicle:**
   - Simple placeholder boat: a tan rectangular block (~5 m × 2 m × 1 m) floating at y = 0.
   - When the user supplies a boat model: replace the placeholder.
   - Buoyancy: the boat sits on the water surface, responding to jeantimex wave displacement.
   - The boat follows the jeantimex displacement demo pattern (the demo ball's collision = the boat's interaction).

3. **Oar-water interaction:**
   - Oar strikes should disturb the jeantimex surface using `addDrop` at the oar contact point (master context §12.1).
   - Each stroke produces a visible ripple.

4. **Camera:** Above-water trailing camera, similar parameters to dolphin but pulled back further. No underwater transitions in rowing mode.

### 14.2 Walking Mode

**Donor:** `feat/walking-locomotion` branch. (Master context §12.1, Track A §4.5)

1. **Port the walking controller:**
   - Character walks on terrain above sea level (islands).
   - Ground-following via `terrainHeight(x, z)` + three-mesh-bvh raycasts.
   - Keyboard: WASD movement, mouse/arrows for look.

2. **Walking character:**
   - Placeholder: a gray rectangular block (~0.5 m × 1.8 m × 0.3 m) standing on the island surface.
   - When the user supplies a character model: replace the placeholder.

3. **Camera:** Third-person trailing camera, ground-height aware, collision with terrain via raycast.

4. **Terrain interaction:**
   - Walk on all above-water terrain (islands, beaches, cliffs within slope limits).
   - Slope limit: ~45° (steeper = slide).
   - Rapier character controller or simple ground-follow with gravity.

### 14.3 Flight Mode

**Donor:** Flight branch / TinySkies Track F. (Master context §12.1, Track A §4.4)

1. **Port the flight controller:**
   - Plane/altitude systems from the flight branch.
   - Keyboard: WASD + pitch/roll.

2. **Flight vehicle:**
   - Placeholder: a white rectangular block (~3 m × 1 m × 4 m) at altitude.
   - When the user supplies a plane model: replace the placeholder.

3. **Camera:** Trailing camera at altitude, above the water and terrain. Shows the full island/ocean panorama — proving the shared world from a completely different vantage.

4. **Altitude constraints:**
   - Min altitude: ~5 m above terrain (ground collision via `terrainHeight`).
   - Max altitude: ~300 m (well above tallest peak at 200 m).
   - No underwater flight — the plane stays above the water surface.

### 14.4 Mode Switching

- Keyboard shortcuts to switch modes (e.g., F1 = Dolphin, F2 = Rowing, F3 = Walking, F4 = Flight).
- On switch: teleport the new vehicle/character to the dolphin's current position (adjusted for mode — surface for rowing, nearest land for walking, altitude for flight).
- Camera transitions between modes over 0.5–1.0 s.
- All modes share the same `WorldData`, terrain, water, atmosphere — proving "one shared world."

**Out of scope:**
- Full-featured mode implementations (these are proof-of-concept ports).
- Body-input for rowing/walking/flight (dolphin body-input only in this slice).
- Mode-specific audio (use the same ambient for now).
- Transitions between modes during gameplay (e.g., dolphin→boat at a dock).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §3.3 (Donor systems) | Rowing, walking, flight branches |
| `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | §4.4–4.5, §6 | Branch audit, donor code locations |
| Master context §12.1 | — | Mode rollout strategy |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | §10 | Mode-switch continuity |

---

## Specification

### Shared world proof

Every mode must render and navigate through the **same** world:
- Same `terrainHeight(x, z)` function.
- Same water surface (jeantimex).
- Same atmosphere / fog / lighting.
- Same vegetation, fish, structures, caves.
- Same audio ambients.

The only differences between modes are:
- Vehicle/character model and controller.
- Camera rig parameters.
- Terrain interaction rules (swim underwater, float on surface, walk on land, fly above).

### Boat-water interaction

```typescript
// Per frame, sample jeantimex wave height at boat position
const waveHeight = waterSim.getHeightAt(boat.position.x, boat.position.z);
boat.position.y = waveHeight; // float on the surface

// Oar splash on stroke
if (oarStrikeDetected) {
  waterSim.addDrop(oarContactX, oarContactZ, 0.5, 0.03);
}
```

### Walking ground-follow

```typescript
// Per frame:
const groundY = terrainHeight(character.position.x, character.position.z);
if (groundY >= 0) { // above water only
  character.position.y = groundY;
} else {
  // At water edge — stop or transition to swimming
}
```

### Mode switch

```typescript
function switchMode(newMode: 'dolphin' | 'rowing' | 'walking' | 'flight') {
  // Deactivate current mode
  currentMode.deactivate();
  
  // Position new mode vehicle
  switch (newMode) {
    case 'dolphin': /* place underwater */ break;
    case 'rowing': /* place on surface */ break;
    case 'walking': /* place on nearest land */ break;
    case 'flight': /* place at altitude */ break;
  }
  
  // Activate new mode
  newMode.activate();
  
  // Camera transition (0.5-1.0s blend)
  cameraRig.transitionTo(newMode.cameraConfig, 0.7);
}
```

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- **F1 (Dolphin):** The full dolphin experience built across checkpoints 01–13.
- **F2 (Rowing):** A placeholder boat floating on the jeantimex water surface, propelled by keyboard. Oar splashes visible. The same islands and terrain visible from the water surface.
- **F3 (Walking):** A placeholder character standing on an island, walking on the terrain. The same vegetation, structures, and sky. Looking out: the ocean, other islands, the same world.
- **F4 (Flight):** A placeholder plane flying above the region. The full panorama: ocean, islands, terrain, everything visible from above. The jeantimex water surface stretches to the coastlines.

**What the user should try:**
- Switch between all four modes — the world is the same in each!
- Row across the water — oar splashes interact with jeantimex surface.
- Walk on an island — see the underwater world from above.
- Fly high — see the full region layout, matching the sketch from checkpoint 03.
- Dive back to dolphin mode — everything is exactly as it was.

---

## Verification

### Automated
- All four modes activate without errors.
- Mode switch works in any order.
- Each mode uses the same `WorldData` / `terrainHeight`.
- Walking mode stays above water (doesn't walk underwater).
- Flight mode stays above terrain (doesn't fly through mountains).
- fps ≥ 60 in all modes.

### Manual review
- **The shared-world proof:** "This is one world, seen from four perspectives."
- Rowing: boat floats on the jeantimex surface, oar ripples visible.
- Walking: character walks on island terrain, sees the ocean.
- Flight: full panorama, the world reads as coherent from altitude.
- Camera transitions between modes are smooth.
- The same vegetation, structures, fish, and atmosphere are present in all modes.

---

## Stop

**STOP.** Report:
1. Modes implemented (dolphin, rowing, walking, flight).
2. Donor code ported (branches, files).
3. Placeholder vehicles/characters used.
4. Boat-water interaction method.
5. Walking ground-follow method.
6. Flight altitude constraints.
7. Mode switch implementation.
8. **The shared-world proof:** description + screenshots from each mode showing the same world.
9. Final placeholder inventory (complete status of every category).
10. Final performance: fps in each mode.
11. Deviations from this specification.

**FINAL CHECKPOINT. Wait for user review and approval.**

---

## Guardrails

- No invented assets. All vehicles/characters are placeholder blocks until user supplies models.
- Mode implementations are proof-of-concept — functional but not polished.
- Approved visuals (everything from CP00–CP13) immutable.
- Local-only.
- One world, one style, one terrain dataset — modes share everything.
- The region is the same region in every mode.
