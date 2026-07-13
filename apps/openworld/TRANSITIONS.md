# Open World mode transitions

## Principle: an honest handoff

A transition is a **fade + spawn handoff done well**, not a fake
seamless morph. Each mode is a complete, separately-verified sim
(flight/walk/row/dolphin) consuming the shared WorldRuntime; a
transition disposes the active mode and constructs the next one at a
geographically continuous entry point, under a ~350 ms fade that names
the incoming mode. Nothing pretends: the plane does not morph into
shoes; the camera does not thread a fake continuous shot. What IS
continuous is the place — you land at the airfield and stand on the
same apron; you leave the dock in a boat from the same dock; you dive
where the boat was.

Rejected alternative: seamless in-sim vehicle mounting (walk to the
plane, climb in). It needs character-to-vehicle animation, a walkable
interior collision story, and a camera language none of the completed
systems have — scope creep against V4's "one compact excellent region"
law. Documented here so the door stays visibly open, deliberately shut.

## The data

Transition points are BAKED (V2 artifact `transitions`; consumed via
`WorldRuntime.transitions()`), not hand-placed:

| kind | at | handoff |
|---|---|---|
| `land-to-walk` | the airfield | flight → walk (and walk → flight, same point) |
| `dock-to-row` ×3 | docks | walk → row (and row → walk) |
| `row-to-dive` ×2 | open water | row → dolphin (and dolphin → row) — **low-poly only**: other profiles do not list the dolphin, so the row coach never offers the dive there |

## Triggers (uniform, low-ceremony)

One rule everywhere: **be at the point, press F** (the completed
flight-controller's `interact` convention). Eligibility per source mode:

- **flight → walk**: within the `land-to-walk` radius (+ a 80 m
  grace), below 18 m AGL, under 30 m/s. The coach line offers the
  landing when eligible; F lands (short flare, fade, walk spawn on the
  apron walk node).
- **walk → row**: within a `dock-to-row` radius. F boards; the boat
  spawns on the row lattice off that dock, bow off-shore.
- **walk → flight**: within the `land-to-walk` radius. F boards; the
  standard airfield takeoff roll follows.
- **row → dolphin** (low-poly): within a `row-to-dive` radius. F dives;
  the dolphin spawns at that point, −6 m.
- **dolphin → row**: within a `row-to-dive` radius near the surface
  (y > −4). F surfaces into the boat.

Keyboard-only players get the full loop (F is a key); body players park
near the point and the coach tells them F finishes it — an intentional
concession: a dedicated body gesture for mode-switch belongs to the
gesture/intent seed's SINGLE consumer (hands-free recording), which V4
must not multiply.

## Mechanics

`ModeManager` (src/transitions.ts): owns the active mode, a fullscreen
fade veil, the global F listener, and per-frame eligibility polling
(chrome coach + `__OW.transition()` for specs). Switch sequence: veil in
(180 ms) → dispose old mode → construct new mode at the entry point →
veil out (180 ms). Modes gained an optional `enterAt(x, z, yawDeg)`.
Runtime/HUD, profile scene, chrome and minimap all persist across the
switch — only the mode object cycles. The pose model choice follows the
mode (rowing wants the FULL pose model for wrist depth — V1's measured
lesson) via `runtime.setModel` where available; degradation is graceful
if the hot-swap is unavailable.

## Verification

`tests/transitions.spec.ts`: walk→row at a dock (F), row→dolphin at a
dive point (F, low-poly), dolphin→row back at the surface, and
flight→walk landing (slow, low, F) — each asserting the destination
mode is live at the geographically matching position, plus a
denied-profile check that row→dolphin is NOT offered outside low-poly.
