# CHECKPOINT 02 — Pool Camera

## Header

**Checkpoint:** 02 — Pool Camera
**Prerequisite:** Checkpoint 01 approved. The GAMICO dolphin swims in the jeantimex pool with keyboard controls and animation.
**Base state:** `apps/shared-world/` with dolphin in pool, ported sim, 8 animation clips playing.

---

## Scope

**Build:**
1. **Implement the Track E chase camera rig** (`CameraRig` module) with:
   - **Target-follow spring camera** with separated position and aim pivots.
   - **Smoothed tracking point** (dolphin transform low-pass filtered), offset behind facing and slightly above.
   - **Critically damped spring positioning** (SmoothDamp-style) with **asymmetric damping**: fast catch-up (t90 0.18 s), slower settle (t90 0.45 s).
   - **Look-ahead** along smoothed velocity (not raw facing), addressing "hard to see where you're going."
   - **Speed-dependent distance**: default 3.03 BL (8.75 m), growing to 4.76 BL (13.75 m) at max speed.
   - **Distance damping** separate from positional damping (t90 0.6 s).
   - **Camera roll**: does NOT copy dolphin roll (prevents nausea); may add ≤10% for flavor.
   - **Recenter**: keyboard shortcut (e.g., R key) eases camera behind facing in 0.5 s.

2. **Above/below water transitions:**
   - Detect the waterline (y = 0 in pool-local coordinates, or jeantimex's surface height).
   - Below water: camera below surface, underwater fog/color, the jeantimex below-water shader path.
   - Above water: camera above surface, sky/air rendering.
   - Transition blend: 0.3 s parameter-set crossfade at the waterline.

3. **Half-submerged camera behavior:**
   - When camera is at y ≈ 0, the jeantimex waterline compositor handles the split.
   - Verify: clean Fresnel split, no z-fight, no double-horizon.

4. **Camera collision** (basic, pool-scale):
   - Raycast from tracking point to desired camera position.
   - If blocked by pool walls/floor, pull camera in along the ray (dolly-in).
   - Sphere-cast radius: 0.26 BL (0.75 m).
   - Dolly-in response: t90 0.15 s.

5. **Camera state machine:**
   - `NormalFollow` ↔ `SlowHover` (speed < min controllable).
   - `NormalFollow` → `SurfaceTransition` (at waterline).
   - `NormalFollow` ↔ `Obstructed` (LOS blocked → dolly-in).

**Out of scope:**
- Breach camera (checkpoint 06).
- FastTravel state (needs region scale — checkpoint 04+).
- TerrainCompressed state (needs terrain — checkpoint 05+).
- Body-input camera correction (body-input wiring checkpoint later).
- Any modification to jeantimex shaders.

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §7.4 | Camera parameter table |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | §13–14, Table C | Chase camera spec, collision, transitions |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §17.7 | Composition bands (8–18% width, 40–60% height) |

---

## Specification

### Camera parameters (Track E Table C, converted to canonical 1 BL = 2.89 m)

Meter values are authoritative; BL values are informational. Speeds: cruise = **5 m/s**, burst = **9 m/s** (master context §7, canonical).

| Parameter | Start (BL) | Start (m) | Range (BL) |
|---|---|---|---|
| Follow distance | 3.03 BL | 8.75 m | 2.16–5.19 BL |
| Follow height | 0.69 BL | 2.0 m | 0.35–1.30 BL |
| Distance at max speed | 4.76 BL | 13.75 m | 3.46–6.92 BL |
| Look-ahead distance | 2.16 BL on smoothed vel | 6.25 m | 0.87–3.46 BL |
| Positional damping (catch-up) | t90 0.18 s | — | 0.1–0.35 |
| Positional damping (settle) | t90 0.45 s | — | 0.3–0.8 |
| Rotational (aim) damping | t90 0.25 s | — | 0.15–0.5 |
| Distance damping | t90 0.6 s | — | 0.4–1.2 |
| Recenter time | 0.5 s | — | 0.3–0.9 |
| Obstruction dolly-in | t90 0.15 s | — | 0.08–0.3 |
| Collision radius | 0.26 BL | 0.75 m | 0.17–0.43 BL |
| Surface transition blend | 0.3 s | — | 0.2–0.6 |
| Camera roll copy | 0–10% of dolphin roll | — | 0–15% |

### Composition targets (Track D §17.7)

- Dolphin: 8–18% frame width (target 10–15%)
- Dolphin: 40–60% frame height
- Vertical FOV: 50–60°

### Above/below transition

The jeantimex demo already handles above/below rendering via its `getSurfaceRayColor` compositor. The camera rig must:
1. Track the water surface height at the camera position.
2. Below: activate underwater fog (using jeantimex's below-water path).
3. Above: deactivate underwater fog.
4. At the boundary: the jeantimex waterline compositor handles the visual split.

### Critically damped spring implementation

```typescript
// SmoothDamp-style with asymmetric damping
function smoothDamp(
  current: number, target: number, velocity: { v: number },
  smoothTime: number, dt: number
): number {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.v + omega * change) * dt;
  velocity.v = (velocity.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}
// Use shorter smoothTime for catch-up, longer for settle
// Detect direction: if dolphin pulling away → fast; if settling → slow
```

---

## Demo

```bash
npm --prefix apps/shared-world run dev
# Open http://localhost:5198/shared-world/
```

**What the user should see:**
- The dolphin swimming with a smooth chase camera behind and slightly above.
- Camera follows turns with look-ahead — the path ahead is visible.
- Speeding up pulls the camera back slightly; slowing settles it smoothly.
- Swimming to the surface: camera transitions cleanly from underwater to above-water view.
- At the waterline: half-submerged view shows a clean split (the jeantimex compositor).
- Swimming back down: camera transitions cleanly back to underwater.

**What the user should try:**
- Swim at different speeds — camera distance should grow/shrink smoothly.
- Make sharp turns — camera should lag naturally, then catch up (not whip).
- Swim to the surface and hover there — half-submerged view should be clean.
- Swim into pool walls — camera should dolly in, never clip through.
- Press R — camera should smoothly recenter behind the dolphin.

---

## Verification

### Automated
- Camera never intersects pool geometry (raycast check).
- Dolphin stays within Track D composition bands (8–18% width, 40–60% height) in NormalFollow for >90% of a scripted swim path.
- Surface transition produces no visual artifacts (no z-fight, no double-horizon).
- fps ≥ 60 at 1728×1080.

### Manual review
- "Camera never surprised me" (Track E §22 acceptance criterion).
- Above/below transition feels smooth and natural.
- Half-submerged view: clean Fresnel split, correct refraction band.
- Camera never clips through pool walls or floor.
- No nausea from camera movement.

---

## Stop

**STOP.** Report:
1. Camera parameter values in use.
2. Composition band compliance (measured dolphin size in typical frames).
3. Above/below transition behavior description.
4. Half-submerged view screenshot/description.
5. Any pool-wall camera collision cases found.
6. Performance: fps.
7. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 02 does not authorize starting checkpoint 03.**

---

## Guardrails

- No invented assets.
- jeantimex: zero modifications.
- Approved visuals immutable.
- Local-only.
- Physics/presentation separation: camera math runs deterministic; never feeds back into sim.
