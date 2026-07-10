# FUTURES.md — the globe as BodyArcade's hub

What the TinySkies fork revealed about where Rowing, Walking, and Dolphin
could live. Proposal only — nothing here is built, and nothing should be
until a mode earns it the way Flight did (feel first, world second).

## The load-bearing discovery: vehicles are already a seam

Upstream ships **three real vehicles** — plane, boat, magic carpet — behind
a declarative capabilities table (`shared/vehicleCapabilities.ts`: camera
tuning, trails, quest systems, per-vehicle flags) with per-vehicle meshes,
matrix builders (`buildPlaneMatrix` / `buildBoatMatrix` /
`buildCarpetMatrixVoidPlane`), NPC fleets, and unlock progression. Adding a
BodyArcade mode is therefore *not* a new game — it's a new input mapping
onto an existing vehicle, exactly like Flight was:

- **Rowing → the boat.** It exists, it floats, it has a wake, ocean audio,
  and a fishing minigame. A rowing profile is a new entry in the profile
  table: cyclic lean/arm signal → stroke impulses → boat speed; leanX →
  rudder. The boat's camera and feel are already tuned. Body-input schema
  v1 axes suffice for a crude stroke (leanY oscillation); a proper stroke
  event (cadence + power) would be a schema v2 addition, measured from
  fixtures first, exactly like the jitter floors were.
- **Dolphin → a fourth vehicle.** The capabilities table + matrix-builder
  pattern is the extension point: `buildDolphinMatrix` = boat matrix +
  dive (the plane's altitude machinery already handles "under the
  surface" as negative clearance if the soft floor is lifted). Crouch/
  stand or lean F/B → dive/breach maps directly onto the existing
  elevate axis. This is the only one needing new art.
- **Walking → the campsite system.** Upstream has a whole disabled-but-
  compiling on-foot layer (`CAMPSITE_HOME_ENABLED = false`:
  CampsiteControls, CampsiteScene, landing flow). Walking mode would
  re-enable it with crouch/lean driving the walk — but it's the least
  mature system in the fork and should go last, if at all.

## Globe-as-hub transition

The lobby already treats vehicles as a roster with unlock celebrations.
The natural hub shape: PosePuppet stays the tracker/instrument; the globe
becomes the *place where body modes live* — you pick a vehicle the way
you pick an avatar today, and each vehicle carries its own body profile
set (Flight's profile/assist architecture is deliberately data-driven so
a boat profile is a table entry, not a fork).

Transport needs nothing new: one producer (PosePuppet), one BodySignal
stream, N consumers — the same-origin `/flight/` layout generalizes to
`/arcade/` serving one built game with all vehicles.

## What NOT to do (learned this pass)

- Don't build a mode before its feel is proven on fixtures + a live gate
  (Flight's Gate 2 caught four transition/feel issues no fixture showed).
- Don't touch multiplayer — it stays dormant; a second body player is a
  BroadcastChannel namespace question, not a server question.
- Don't add schema axes speculatively. Rowing wants a stroke event;
  measure real rowing footage first (new fixtures), then extend v1 → v2
  with the same measured-floor discipline.
- The moon-threat/quest/upgrade systems are the game's charm — body modes
  should inherit them untouched, not re-skin them.

## Obstacle-Avoidance Reminder
Before final acceptance of Rowing, Dolphin, Walking World, Flight-world navigation, or any future navigable mode, explicitly remind the user to evaluate:
- shoreline and land collisions;
- terrain, buildings, rocks, props;
- navigational boundaries and getting trapped;
- repeated collision loops and oscillating left-right corrections;
- predictive lookahead;
- soft Full Assist guidance;
- stillness near hazards and tracking loss near hazards;
- whether Expert mode reduces or disables assistance.
Do not automatically implement obstacle avoidance merely because this reminder exists. Raise it as a deliberate product decision at the final gate unless the active feature requirements already make it mandatory.
