# CHECKPOINT 08 — Ecco Atmosphere Pass A

## Header

**Checkpoint:** 08 — Ecco Atmosphere Pass A
**Prerequisite:** Checkpoint 07 approved. All placeholders placed; composition reviewed.
**Base state:** Full region with water, terrain, islands, breach, camera, placeholders.

---

## Scope

**Build the first approved tweak layer: the PS2 Ecco underwater atmosphere — implemented through jeantimex's mechanisms, not by bolting on a second system.**

1. **Per-zone `FogExp2`** (Track D §17.2):
   - Set `scene.fog = new THREE.FogExp2(zoneColor, zoneDensity)`.
   - Set `scene.background = new THREE.Color(zoneColor)` — always equal to fog color.
   - Zone transitions: lerp fog color and density over 3–5 s of traversal.
   - Determine which zone the dolphin occupies by depth + XZ position using the biome mask.

2. **Per-zone lighting** (Track D §17.3):
   - `HemisphereLight`: sky color = zone light color, ground = 25–35% of sky.
   - `DirectionalLight`: #FFF4E0, intensity varies by zone family, elevation 60–75°, castShadow false.
   - In dark zones: near-zero ambient; shafts (#DDF2F0) at apertures; PointLights radius < 4 m (1.38 BL).

3. **View-direction fog tint** (Track D §17.2 note):
   - +10–15% luminance toward pale cyan above +20° pitch.
   - −15% luminance below −25° pitch.
   - Implemented as a fog color uniform modification based on camera pitch.

4. **Terrain material upgrade** (Track D §17.4, Track B Q15):
   - Height/slope-blended textures (sand/rock/cliff).
   - Low-frequency, soft diffuse — no pin-point speculars.
   - Roughness 0.95–1.0, metalness 0.
   - Use CC0 textures from Poly Haven or ambientCG (Track C confirms CC0).
   - Triplanar on steep surfaces.

5. **Caustics intensity tuning** (Track D §17.5):
   - Intensity tuned to +15–30% floor luminance.
   - Cell scale 0.6–1.6 m.
   - Depth-limited: full strength in top ~10 m (3.46 BL); zero by ~20–24 m (6.92–8.30 BL). (Track D original: 5 BL × 2.0 m = 10 m; 10–12 BL × 2.0 m = 20–24 m.)
   - Drift 0.02–0.05 UV/s, 8–14 s apparent cycle.
   - **Implemented by adjusting jeantimex caustics uniforms only — not by modifying caustics shader code.**

6. **Particles** (Track D §17.6):
   - **Marine snow:** 30–80 motes in a 12 m radius sphere around the dolphin; 1–3 cm; drift 1–3 cm/s; opacity 0.05–0.15 in lit zones, 0.2–0.35 in dark zones.
   - **Dolphin trail bubbles:** 2–5 bubbles/s behind the dolphin; rise 0.5–1.0 m/s.
   - **Burst bubbles:** 20–60 on kick/burst; 0.8–1.5 s; rise 1–2 m/s.
   - Implemented as `Points` or `InstancedMesh` with additive/alpha-blended material.

7. **The surface stays pure jeantimex.** No atmosphere changes affect the water surface shader, above-water rendering, or waterline behavior. This pass is **underwater only**.

**Out of scope:**
- Any jeantimex surface/waterline shader modification.
- Cave fog (checkpoint 09 — caves don't exist yet).
- Vegetation, fish, ruins, audio (later checkpoints).
- Day/night, weather (banned).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §6 (Visual Spec) | All Track D parameter tables |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §6–8, §11, §17 | Zone palettes, fog, lighting, caustics, particles |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Q15 | Terrain material approach |

---

## Specification

### Zone detection

Determine the active zone from dolphin depth (y) and XZ position:
- y > −5: Bright shallow band
- −5 ≥ y > −25: Read biome mask → A (green midwater), B (shallow reef), C (kelp reef), F (vivid canyon)
- −25 ≥ y > −50: E (desaturated plain), G (hazy open sand)
- y ≤ −50: Deep zones (D, J, K, H, I, E2) determined by XZ + biome mask

Transition: smooth lerp between zones over 3–5 seconds.

### Fog implementation

```typescript
const fog = new THREE.FogExp2(currentZoneColor, currentZoneDensity);
scene.fog = fog;
scene.background.copy(fog.color);

// View-direction tint (per-frame):
const pitch = camera.rotation.x; // radians
if (pitch > 0.35) { // > ~20°
  fog.color.lerp(paleCyan, 0.12); // +10-15% luminance
} else if (pitch < -0.44) { // < ~-25°
  fog.color.multiplyScalar(0.85); // -15% luminance
}
```

### Caustics depth limiting

If jeantimex exposes caustics intensity/scale uniforms, set them per-frame based on dolphin depth:
```
causticIntensity = smoothstep(24, 10, -dolphinY) // full at 10m, zero at 24m (Track D: 5 BL × 2.0 m, 12 BL × 2.0 m)
```
If uniforms are not directly exposed, add the depth-limit as a minimal uniform addition to the caustics shader (sanctioned edit per Track B Table 1 item 5 note).

### Particle system

Marine snow: `InstancedMesh` with small quad geometry, `MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false })`. Randomly distributed in a sphere around the dolphin, recycled on exit.

Dolphin trail: `Points` geometry with `PointsMaterial({ size: 0.03, transparent: true })`, spawned at tail bone position, rising with velocity.

### All fog/palette values are PROVISIONAL

Every hex value and density number from Track D §17.2 is labeled [REC] — estimated from a reduced-resolution atlas, not native PS2 measurements. At review, the user may:
- Accept the values as-is.
- Request adjustment based on their knowledge of the game.
- Later replace with PCSX2 native captures per Track D §19.

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- **Heavy colored fog** underwater — the water IS the fog, always colored, never gray.
- Different zones have visibly different colors and visibility distances.
- Shallow areas: bright teal/cyan, good visibility, caustics on the seabed.
- Deep areas: darker, more limited visibility, fog closes in.
- Marine snow particles drifting slowly.
- Bubble trail behind the dolphin.
- Terrain has proper textured materials (sand, rock, cliff differentiation).
- **The surface water still looks exactly like jeantimex** — no changes above the waterline.

**What the user should try:**
- Swim from shallow to deep — watch the fog color and density change gradually.
- Look up (toward surface) — should be slightly brighter/cyan. Look down — darker.
- Find caustics on the seabed in shallow areas — they should be broad, bright, slow.
- Swim deeper than ~30 m — caustics should fade out.
- Assess: does this look like PS2 Ecco's underwater atmosphere?

---

## Verification

### Automated
- Fog color and density match Track D §17.2 table values at sampled positions.
- Zone transitions are smooth (no sudden color/density jumps).
- Caustics intensity approaches zero below 30 m depth.
- Marine snow particle count within budget (30–80 visible).
- fps ≥ 60 at 1728×1080.
- Four-shot fidelity re-check: shot (a) above-water still matches stock demo.

### Manual review
- **Visual review:** Does the underwater atmosphere evoke PS2 Ecco? Heavy colored fog, never gray.
- Zone transitions feel gradual — no biome borders visible.
- Caustics: broad, bright, slightly slow — not sharp modern caustics.
- Particles: subtle marine snow, dolphin bubbles visible.
- The surface from underwater: jeantimex's Snell's window, reflections, refraction unchanged.
- All Track D anti-principles respected: no neutral fog, no modern lighting tells, no bloom.

---

## Stop

**STOP.** Report:
1. Zone map: which zones exist, their fog/lighting parameters.
2. Zone detection method and transition implementation.
3. Caustics depth-limiting parameters.
4. Particle system stats (marine snow count, bubble rate, perf cost).
5. Terrain material textures used (source, license).
6. Screenshots of each zone type (shallow, mid, deep).
7. Four-shot fidelity re-check result (above-water unchanged).
8. Note: all fog/palette values are provisional [REC], replaceable by PCSX2 captures.
9. Performance: fps, frame-budget breakdown with atmosphere.
10. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 08 does not authorize starting checkpoint 09.**

---

## Guardrails

- No invented assets. Terrain textures are CC0 from approved sources.
- jeantimex surface/waterline: **ZERO modifications**. Atmosphere changes are underwater only.
- Caustics tuning via uniforms only — no caustics shader code changes unless the depth-limit requires a minimal uniform (sanctioned).
- All Track D values are provisional — present them as estimates, not native measurements.
- Approved visuals (water surface from CP04) immutable above the waterline.
- Local-only.
- No bloom, no SSR, no AO, no god rays, no film/CRT filters (Track D §18 anti-principles).
