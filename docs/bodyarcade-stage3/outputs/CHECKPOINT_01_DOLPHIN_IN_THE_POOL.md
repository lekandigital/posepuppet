# CHECKPOINT 01 — Dolphin in the Pool

## Header

**Checkpoint:** 01 — Dolphin in the Pool
**Prerequisite:** Checkpoint 00 approved. The stock jeantimex demo runs unchanged at `localhost:5198/shared-world/`.
**Base state:** The `apps/shared-world/` scaffold with vendored jeantimex and dolphin GLB present.

---

## Scope

**Build:**
1. **Load the GAMICO dolphin GLB** using `GLTFLoader` (zero-plugin; Track C confirms valid glTF 2.0, no extensions). Place it in the jeantimex demo pool.
2. **Wire all 8 animation clips** to an `AnimationMixer`:
   - `SwimForward` as the default base locomotion clip (loop).
   - `SwimForwardFast` cross-faded by speed band (~0.2–0.4 s transition per Track E §11).
   - `SwimLeft`, `SwimRight` blended or cross-faded during turns.
   - `SwimUp`, `SwimDown` for pitch.
   - `Jump` as `LoopOnce` + `clampWhenFinished` for breach.
   - `BreatheSurface` at the surface.
   - Scale `action.timeScale` by tail-beat frequency (bounded 0.7–1.6×), not linearly to world velocity (Track E §11).
3. **Port `sim.ts`** from `apps/dolphin/src/game/sim.ts` (@ `bodyarcade-v4-base`). The sim has zero Three.js imports — no API port needed. Set the feel-constant table to the **canonical implementation values** from the implementation master §7.2: cruise **5 m/s**, burst **9 m/s** (master context §7 — these are not optional starting points, they are the governed defaults). Re-point the `WorldSampler` seam:
   - Replace the SF-Bay boundary SDF with a simple rectangular boundary matching the jeantimex pool dimensions.
   - Seabed depth = pool floor depth (the `poolHeight` constant).
4. **Port `swimControls.ts`** from `apps/dolphin/src/input/swimControls.ts`. Keep keyboard priority (W/S/A/D/Q/E/Shift/Space/1/2/3). Body-input signals are wired but not required — keyboard-only play must work.
5. **Wire dolphin↔water interaction** using the jeantimex compound-sphere displacement pattern: approximate the dolphin body with 2–3 overlapping spheres; each frame, write displacement into the water sim. The dolphin should produce a visible wake and ripples when moving through the pool.
6. **Dolphin material check:** Load the model under jeantimex's lighting; visually inspect the metallic-roughness channels. If the flank shows unnatural metallic sheen, set `material.metalness = 0` and adjust roughness (Track C §8.4 caveat; Track D §17.4 locks: roughness 0.95–1.0, metalness 0 for creatures).
7. **Scale/position:** The dolphin is 2.89 m in real-world meters at 1.0 scale (Track C). Adjust scale to fit the pool while maintaining readable water interaction. The pool is at jeantimex's native scale — verify the ratio and document it.
8. **Runtime BL measurement (mandatory):** After loading the dolphin GLB, compute the axis-aligned bounding box at scene scale 1.0 and measure the nose-to-tail length along the longest axis. Compare against the canonical value of **2.89 m** (1 BL, per implementation master §2.2). If the measured value differs by more than 5% (i.e., outside the range 2.75–3.03 m), report this as **repository or asset drift** in the stop report. Do NOT treat a different measurement as permission to adopt a different BL — report the discrepancy and wait for user guidance.

**Out of scope:**
- Camera work (checkpoint 02 — use a simple follow camera or the demo's existing camera).
- Any modification to jeantimex water/caustics/surface shaders.
- Region layout, terrain, or world data.
- Breach through the water surface (checkpoint 06).
- Procedural additive animation layers (curvature, bank) — optional stretch; the base clips suffice.

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §3.3, §7.1–7.2, §8.1–8.2 | Preserve/replace manifest, feel constants, dolphin specs |
| `TRACK_A_REPOSITORY_AUDIT_REPORT.md` | §4.2–4.7 | sim.ts/swimControls.ts architecture, feel-constant table, port surface |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §3–5 | Animation clips, scale, material, GLB structure |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | §7–8, §11 | Movement model, animation system, timeScale rules |
| `apps/dolphin/src/game/sim.ts` | (repository) | Source to port |
| `apps/dolphin/src/input/swimControls.ts` | (repository) | Source to port |

---

## Specification

### Dolphin loading

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/shared-world/models/dolphin/dolphin-fbx.glb');
const dolphin = gltf.scene;
// Always play a clip — rest pose renders nose-down (Track C caveat)
```

### Animation mixer architecture (Track E §11)

```typescript
const mixer = new AnimationMixer(dolphin);
// Base locomotion: cross-fade between speed bands
// SwimForward (idle/slow) → SwimForwardFast (fast) via crossFadeTo
// Turn clips blended by yaw input
// timeScale = f(tailBeatFrequency), bounded [0.7, 1.6]
```

### Feel-constant values — canonical (master context §7, implementation master §2.3, §7.2)

These are the **governed implementation values**, not optional starting points.

| Constant | Value (m/s) | Value (BL/s) | Source | Retuning candidate |
|---|---|---|---|---|
| Cruise speed | **5 m/s** | 1.73 BL/s | Master context §7 (canonical) | Track E: 10 m/s (3.46 BL/s) [REC] |
| Burst speed | **9 m/s** | 3.11 BL/s | Master context §7 (canonical) | Track E: 17.5 m/s (6.06 BL/s) [REC] |
| Impulse per pump | 2.25 m/s | 0.78 BL/s | Track E [EST]; meters = 0.9 × 2.5 | Tune at review |
| Glide τ | ~2.0 s to half | — | Track E [EST] | — |
| Containment band | Pool-edge (rectangular SDF) | — | — | Re-point to region at CP04 |

**1 BL = 2.89 m** (canonical; implementation master §2.2). Retuning candidates may replace canonical values only with explicit user approval at feel review.

### Water interaction

Approximate the dolphin with 2–3 overlapping spheres positioned along the spine (Track B Q7):
- Nose sphere: ~0.3 m radius
- Mid-body sphere: ~0.5 m radius
- Tail sphere: ~0.3 m radius

Each frame, pass sphere positions to the jeantimex displacement system using the same pattern as the demo ball.

---

## Demo

```bash
npm --prefix apps/shared-world run dev
# Open http://localhost:5198/shared-world/
```

**What the user should see:**
- The GAMICO dolphin swimming in the jeantimex demo pool.
- Keyboard controls: W/S = dive/surface, A/D = turn, Shift = kick (impulse), Space = burst.
- The dolphin's tail animation plays and its speed matches input.
- Moving through the water produces visible ripples and wake.
- The pool water, caustics, and surface look identical to checkpoint 00 (the stock demo).

**What the user should try:**
- Swim around the pool at different speeds — feel the impulse-and-glide.
- Approach the pool walls — containment pushes back gently, never a hard wall.
- Stop input — the dolphin glides to a halt with decaying speed.
- Assess: does ordinary swimming feel good? Does the dolphin "look like a real dolphin"?

---

## Verification

### Automated
- Port the following tests from `apps/dolphin/tests/dolphin.spec.ts` (adapted for the pool):
  - Keyboard fallback (keyboard controls work without body-input)
  - Impulse-glide coupling (kick → speed increase → glide decay)
  - Signed pitch/roll (W/S produce opposite depth changes)
  - Replay determinism (same input → same output across reloads; **assert self-consistency**, not the old digest)
  - `simHz > 100` unconditional
- fps ≥ 60 at 1728×1080

### Manual review
- **Feel review:** Is ordinary swimming pleasurable? (Track E §22 acceptance criterion)
- The dolphin animation looks natural — tail beats match speed, no foot-skating
- Water interaction (ripples, wake) is visible and responds to dolphin movement
- Pool water looks identical to checkpoint 00 (no jeantimex modifications)
- Metallic-roughness check: dolphin skin looks matte, not metallic, under water

---

## Stop

**STOP.** Report:
1. Summary of changes (files ported, files created).
2. **Runtime BL measurement:** the loaded dolphin model's axis-aligned bounding-box length at scale 1.0 vs. the canonical 2.89 m. Report any drift >5%.
3. Feel-constant values in use (the actual table with m/s and BL/s columns — confirm cruise = 5 m/s, burst = 9 m/s).
4. Dolphin scale factor relative to jeantimex pool.
5. Animation clip mapping (which clip plays in which state).
6. Water interaction method (sphere count, radii, positions).
7. Metallic-roughness check result.
8. Placeholder inventory: dolphin GLB loaded ✓; all other categories not yet needed.
9. Performance: fps, simHz.
10. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 01 does not authorize starting checkpoint 02.**

---

## Guardrails

- No invented assets.
- jeantimex source files: **zero modifications**. The water, caustics, surface, and shaders are untouched.
- Approved visuals (the pool water look from CP00) are immutable.
- Local-only.
- `sim.ts` architecture is preserved — retune constants only, do not restructure.
- Keyboard-only play must work without a webcam.
