# CHECKPOINT 11 — Fish and Ambient Life

## Header

**Checkpoint:** 11 — Fish and Ambient Life
**Prerequisite:** Checkpoint 10 approved. Vegetation in place.
**Base state:** Full region with water, terrain, caves, atmosphere, vegetation, remaining placeholders.

---

## Scope

**Build:**
1. **Fish schooling system:**
   - Implement a simple boid-style schooling algorithm for fish groups.
   - Each school: 12–24 fish (Track D §17.8 / Table 12.1).
   - Schools patrol along authored waypoint paths from `placement.json`.
   - Separation, alignment, cohesion forces. No complex AI.
   - Schools flee when the dolphin approaches within ~3 BL (8.67 m; 1 BL = 2.89 m) (Track A §4.3 — "instanced boid fish that flee").

2. **Fish rendering:**
   - **Placeholder fish:** Until the user supplies ~3 fish models, each fish is a small cyan (#00CED1) rectangular block at the correct scale (0.1–0.5 m depending on species).
   - When the user supplies models: load GLB via `GLTFLoader`, create `InstancedMesh`, apply school transforms.
   - Simple tail-wag animation via vertex shader (sine offset on tail vertices).

3. **Ambient marine wildlife placeholders:**
   - Large wildlife (purple #800080 blocks): rare, 0–1 per zone, slow patrol paths.
   - Jellyfish: placeholder blocks in cave zones (rows of 2–4, Track D §17.8).
   - All remain as placeholders until user supplies models.

4. **Wildlife density per zone** (Track D §17.8):

   | Zone | Ambient fish | Schools | Large wildlife |
   |---|---|---|---|
   | Reef (shallow) | 2–4 ambient | 1 school per 60–120 s traversal | 0 |
   | Kelp forest | 1–2 ambient | 1 smaller school | 0 |
   | Open plain | 0–1 ambient | 0–1 distant | 0–1 patrol |
   | Cave | 0–3 ambient | 0 | 0 (jellyfish 2–4) |
   | Deep trench | 0–1 ambient | 0 | 0–1 rare |

5. **Performance budget for wildlife:**
   - Max 200 fish instances in view (instanced rendering).
   - Schools beyond fog distance not updated or rendered.
   - Total wildlife budget: ~20k additional tris.

**Out of scope:**
- User-supplied fish models (user provides later; placeholders until then).
- Complex AI, predator behavior, oxygen mechanics (deferred per master context §11.3).
- Sonar interaction with wildlife (out of slice entirely).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §8.3 (Placeholders) | Fish/wildlife colors |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §12, §17.8 | Wildlife density per zone |
| `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | §4.3 | Boid fish that flee pattern |
| `assets/world/placement.json` | (from CP07) | Fish school waypoints |

---

## Specification

### Boid schooling algorithm

```typescript
interface Boid {
  position: Vector3;
  velocity: Vector3;
}

function updateSchool(boids: Boid[], dolphinPos: Vector3, waypoints: Vector3[], dt: number) {
  for (const boid of boids) {
    const sep = separation(boid, boids, 0.5);   // avoid crowding
    const ali = alignment(boid, boids, 2.0);     // match neighbors
    const coh = cohesion(boid, boids, 3.0);      // move toward center
    const way = waypointFollow(boid, waypoints); // patrol path
    const flee = fleeFromDolphin(boid, dolphinPos, 3 * BL); // scatter (BL = 2.89 m → 8.67 m)

    boid.velocity.add(sep).add(ali).add(coh).add(way).add(flee);
    boid.velocity.clampLength(0, maxFishSpeed);
    boid.position.addScaledVector(boid.velocity, dt);
  }
}
```

### Flee behavior

When dolphin is within 3 BL (8.67 m; 1 BL = 2.89 m): fish accelerate away from dolphin at 2× normal speed for 2–3 s, then gradually return to patrol. Schools reform after the dolphin passes.

### Fish placeholder geometry

Each placeholder fish: `BoxGeometry(0.3, 0.1, 0.08)` in cyan (#00CED1). Oriented along velocity. Simple tail-wag:
```glsl
// Vertex shader for placeholder fish:
float wag = sin(uTime * 8.0 + instanceId * 1.7) * 0.02 * step(0.15, position.x);
transformed.z += wag;
```

### School waypoints in placement.json

```json
{
  "fishSchools": [
    {
      "id": "school_reef_01",
      "count": 18,
      "fishType": "placeholder",
      "waypoints": [[100, -8, 200], [120, -10, 220], [110, -7, 190]],
      "patrolSpeed": 1.5,
      "zone": "reef"
    }
  ]
}
```

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- Schools of small cyan blocks (placeholder fish) swimming in formation on reef shelves.
- Schools move along patrol paths, maintaining cohesion.
- Swim toward a school — fish scatter away from the dolphin!
- Schools reform after the dolphin passes.
- Different zones have different fish densities (reef = denser, deep = sparser).

**What the user should try:**
- Find a fish school and swim through it — watch them scatter.
- Wait nearby — watch the school reform.
- Explore different zones — verify density variation.
- Check caves — sparse ambient fish or jellyfish markers, not busy schools.
- Performance check: is 60 fps maintained with all fish + vegetation?

---

## Verification

### Automated
- Fish school counts match placement data.
- Boid separation: no fish overlap (minimum distance maintained).
- Flee response: fish accelerate away when dolphin is within 3 BL.
- No fish above waterline; no fish inside terrain.
- fps ≥ 60 at 1728×1080.

### Manual review
- Schools look natural — cohesive movement, not robotic.
- Flee behavior is responsive and satisfying.
- Density variation matches the zone budget table.
- The underwater world feels more alive with fish motion.

---

## Stop

**STOP.** Report:
1. Fish school count and distribution across zones.
2. Boid parameters (separation, alignment, cohesion weights).
3. Flee behavior description and trigger distance.
4. Placeholder inventory update (fish schools placed as placeholders; awaiting user models).
5. Wildlife placeholder status (large wildlife, jellyfish — still placeholder blocks).
6. Performance: fps with fish + vegetation + atmosphere.
7. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 11 does not authorize starting checkpoint 12.**

---

## Guardrails

- No invented assets. Fish are placeholder blocks until the user supplies models.
- The user supplies real fish models over time; agents purchase nothing.
- Approved visuals (water, terrain, atmosphere, caves, vegetation) immutable.
- Local-only.
- No predator AI, no combat, no oxygen mechanics (deferred per §11.3).
