# CHECKPOINT 06 — Breach Over Region

## Header

**Checkpoint:** 06 — Breach Over Region
**Prerequisite:** Checkpoint 05 approved. Terrain and islands visible; shoreline masking verified; Rapier collision working.
**Base state:** Dolphin swimming in region with terrain, islands, camera, water.

---

## Scope

**Build:**
1. **Breach state machine** (Track E §19):
   - **Underwater → SurfaceApproach** (near surface, ascending, speed ≥ min approach speed).
   - **SurfaceApproach → Crossing** (waterline).
   - **Crossing → AirborneAscent → AirborneApex** (v_up ≈ 0) → **AirborneDescent → ReEntry** (waterline descending) → **UnderwaterRecovery → Underwater**.
   - Cancellation: speed < min during SurfaceApproach → return Underwater.
   - Failure: crossing sub-threshold → shallow breach → immediate ReEntry.

2. **Breach parameters** (Track E Table D, converted to canonical 1 BL = 2.89 m; active speeds: cruise **5 m/s**, burst **9 m/s** per master context §7):
   | Parameter | Start (BL) | Start (m) | Range |
   |---|---|---|---|
   | Min approach speed | 2.60 BL/s | 7.5 m/s | 1.73–3.46 BL/s |
   | Approach angle | ≥25° up | — | 10–45° |
   | Launch impulse | v_up = 0.6·speed + charge | — | tune |
   | Gravity | 3.39 BL/s² | 9.8 m/s² | 6–14 m/s² |
   | Airborne pitch/roll authority | 60% of underwater | — | 30–90% |
   | Airtime | 0.8–2.0 s by speed | — | variable (NOT one constant) |
   | Splash occlusion | 0.2 s | — | 0.1–0.4 |
   | Control lockout entry | 0.2 s | — | 0–0.4 |

3. **Splash injection via jeantimex** (Track B Q7):
   - **Launch:** burst `addDrop` at the crossing point.
   - **Re-entry:** larger `addDrop` injection on descent through surface.
   - All through the existing jeantimex displacement mechanism — no second system.

4. **Airborne rendering:**
   - While airborne: dolphin is a normal opaque mesh above the surface.
   - Play `Jump` animation as `LoopOnce` + `clampWhenFinished` for launch pose.
   - Reduced pitch/roll authority for tricks (60% of underwater).
   - Retain horizontal momentum through the parabolic arc.

5. **Camera breach behavior** (Track E Table C):
   - Switch toward above-water framing on Crossing.
   - Breach camera pullback: +1.30 BL (3.75 m) additional distance.
   - Surface transition blend: 0.3 s.
   - Re-entry recovery: 0.6 s to regain normal follow.
   - Keep the arc readable; brief splash occlusion allowed.

6. **The mode-continuity proof** (master context §2.1, §13.3):
   - During airborne phase, the player must see: the horizon, the water around the dolphin, islands/forests/cliffs/ruins (as placeholders at this stage), and the same terrain the underwater mode inhabits.
   - On re-entry: clean camera transition back to underwater.
   - **This is the defining moment of the shared world.**

7. **Feel tuning at region scale:**
   - Reassess all feel constants now that the space is ~2 km.
   - Swim for 10+ minutes. Is ordinary swimming still pleasurable?
   - Breach at 3+ locations. Is the arc readable? Are islands visible?
   - Record the feel-constant table values that produce the best result.

**Out of scope:**
- Placeholder blocks (checkpoint 07).
- Atmosphere/fog zones (checkpoint 08).
- Vegetation, fish, ruins, audio (checkpoints 10–13).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §7.5 (Breach), §7.7 (Acceptance) | Breach parameters, feel criteria |
| `TRACK_E_ECCO_MOVEMENT_CAMERA_FEEL_REPORT.md` | §15 (Breach), §19 (State machines), Table D | Breach chain, parameters |
| `TRACK_B_WATER_TERRAIN_CAVES_REPORT.md` | Q7 | Splash injection via jeantimex |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §15 | Above-water presentation, airborne dolphin reads as silhouette |

---

## Specification

### Breach state machine transitions

```
Underwater
  ├─ speed ≥ minApproach AND ascending AND near surface ──▶ SurfaceApproach
  │
SurfaceApproach
  ├─ waterline crossed ──▶ Crossing (inject launch splash)
  ├─ speed < minApproach ──▶ Underwater (cancel)
  │
Crossing
  ├─ speed ≥ threshold ──▶ AirborneAscent (launch impulse applied)
  ├─ speed < threshold ──▶ ShallowBreach → ReEntry (graceful failure)
  │
AirborneAscent
  ├─ v_up ≈ 0 ──▶ AirborneApex
  │
AirborneApex
  ├─ v_up < 0 ──▶ AirborneDescent
  │
AirborneDescent
  ├─ waterline crossed descending ──▶ ReEntry (inject re-entry splash)
  │
ReEntry
  ├─ 0.2 s lockout ──▶ UnderwaterRecovery
  │
UnderwaterRecovery
  ├─ 0.6 s recovery ──▶ Underwater (camera regains normal follow)
```

### Variable airtime

**Critical requirement (Track E):** DO NOT collapse airtime into one constant. The two observed PS2 breach sequences had different airborne durations. Airtime = f(approach speed, charge). Higher speed / charge → higher launch impulse → longer airtime.

### Splash injection

```typescript
// On Crossing (upward):
waterSim.addDrop(crossingPoint.x, crossingPoint.z, 0.8, 0.05); // radius, strength
// On ReEntry (downward):
waterSim.addDrop(reentryPoint.x, reentryPoint.z, 1.2, 0.08); // larger
```
Exact radius/strength tuned to visual result — the drop mechanism is jeantimex's, parameters are tuned.

### Camera during breach

| Phase | Camera behavior |
|---|---|
| SurfaceApproach | Normal follow (begin rising) |
| Crossing | Blend toward above-water framing (0.3 s) |
| Airborne | Pull back +1.30 BL (3.75 m); track the arc; slight upward angle to show horizon |
| ReEntry | Brief splash occlusion (0.2 s) |
| UnderwaterRecovery | Blend back to underwater follow (0.6 s) |

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- Swimming fast toward the surface → the dolphin breaches! Airborne arc.
- While airborne: sky, water below, islands and terrain visible on the horizon.
- Splash on re-entry. Camera smoothly transitions back to underwater.
- Different approach speeds produce different breach heights and airtimes.
- Failed breach (slow approach): dolphin barely breaks the surface, falls back immediately.

**What the user should try:**
- Breach from different speeds — verify variable airtime.
- Breach at 3+ sightline spots — see different island/terrain views each time.
- Breach near an island — see the coastline up close from above.
- Charge (Space) → higher breach.
- Swim for 10+ minutes — still enjoyable? (Acceptance test.)

---

## Verification

### Automated
- Breach positive: with sufficient speed + upward angle → airborne phase triggered.
- Breach negative: slow approach → shallow breach or no breach.
- Airtime monotonically tracks speed (faster → longer air, within the 0.8–2.0 s range).
- Camera never intersects terrain during breach.
- Camera transitions cleanly (no snapping, no lost target).
- fps ≥ 60 during breach sequence.
- `simHz > 100`.

### Manual review
- **Mode-continuity proof:** while airborne, islands and terrain are visible — this is one world.
- Breach feels satisfying — "you can feel the weight" (Track E §15).
- Variable airtime is perceptible — low breaches differ from high breaches.
- Camera arc is readable — never disorienting.
- Splash on re-entry is visible (water displacement, not VFX).
- **10-minute swim test:** ordinary exploration stays enjoyable.

---

## Stop

**STOP.** Report:
1. Breach state machine implementation details.
2. Feel-constant table (final tuned values for this checkpoint).
3. Variable airtime measurements (low-speed vs. high-speed vs. charge breach).
4. Splash injection parameters.
5. Camera transition timing.
6. Mode-continuity proof: description + screenshot of breach view showing terrain.
7. 10-minute swim assessment.
8. Performance: fps during breach (typically most expensive moment).
9. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 06 does not authorize starting checkpoint 07.**

---

## Guardrails

- No invented assets.
- jeantimex: splash injection uses the existing `addDrop` mechanism only.
- Approved visuals (water look from CP04, terrain from CP05) immutable.
- Local-only.
- Breach airtime is variable, NEVER a fixed constant.
- Preserve `sim.ts` architecture — breach is an event within the existing sim.
