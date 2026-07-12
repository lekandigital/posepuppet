# ARCHITECTURE.md — BodyArcade

How PosePuppet, the body-input protocol, and Flight fit together.

```
posepuppet repo root ──────────────────────────────────────────────
│   PosePuppet app (tracker, avatars, recording director, eval rig)
│   three.js 0.184 · MediaPipe pose/hand · Vite dev server :5173
│
│   src/bodyinput/adapter.ts   ← the ONLY file that hands landmarks
│         │                      to the protocol core
│         ▼
├── packages/body-input        @bodyarcade/body-input v1.0.0
│     deterministic core: calibration-relative extraction →
│     One Euro → measured dead zones → expo → slew, hysteresis
│     events, confidence decay. Emits BodySignal (8 axes + events).
│     Transports: in-page channel + BroadcastChannel. The sink
│     shape-guards every message — LANDMARKS NEVER CROSS.
│         │
│         │  BodySignal only (BroadcastChannel, same origin;
│         │  plus an origin-pinned postMessage relay as a
│         │  redundant path — receiver dedupes by signal ts)
│         ▼
└── apps/flight                TinySkies/GlobeFly faithful fork
      npm workspaces: shared / client / server
      three.js 0.172 (its own renderer — never shared)
      client/src/input/bodyControls.ts   profiles·assist·autopilot
      client/src/input/flightTuner.ts    raw→intent→plane overlay
      client/src/runtime/localWorlds.ts  LocalWorldProvider
      server/                            dormant; docker-compose opt-in
```

## The one-origin rule

BroadcastChannel is origin-scoped. PosePuppet's Vite config therefore
serves the **built** flight app at `/flight/` (flight builds with
`base: '/flight/'`; its root-absolute asset prefixes `/audio /3D /2D
/npc /fonts` are middleware-mapped; the two publics are disjoint).

- `npm run arcade` — build flight + start the one server (:5173).
- `npm run dev` — PosePuppet only (serves the last flight build, 503s
  with instructions if none exists).
- `apps/flight`: `npm run dev:client` — standalone flight dev (:5173 in
  its own checkout context, `--port` via vite args); body signals are
  only expected in the `/flight/` layout.

## Input path (game side)

`FlightControls.getState()` (keyboard, byte-identical to upstream) and
`BodyFlightControls.merge()` meet at ONE call site in `Game.tick`.
Merge law: any keyboard/touch activity owns the plane for 1.5 s.
Body intent = profile map (data: Superman default / Pilot Lean /
Head Pilot) → assist clamps (Full/Standard/Expert) → analog
`speedAxis`/`elevateAxis` fields on ControlState that Plane consumes
through its existing smoothing (undefined = upstream behavior).
Tracking loss: intent decays to neutral (τ 0.3 s) → straight and level;
re-entry is slew-bounded (1.2 intent/s). T-pose recenter is package-side;
the game surfaces it (tuner banner + toast).

## Flight-companion mode

The Fly card / palette `fly` opens `/flight/` and, while the game window
is open, switches PosePuppet to the lite pose model and suspends its
stage renderer (`stage.setSuspended`) — restored when the window closes.
Measured (eval/flight-perf.json): 111 fps game render with the pose loop
at 30 Hz (targets: 60 render / floor 45, pose ≥ 15).

## Verification

- PosePuppet suite (headless, :5173): unchanged pass-2 rig + body-input
  protocol specs.
- Flight suite (apps/flight, :5199 + :5173): offline parity (zero
  off-origin requests, worlds persist, boat/carpet fly), body closed
  loops on real fixtures (lean_lr, crouch_stand), Feel Lab laws
  (drift/dropout/boost/arming/assist), same-origin topology guard,
  PERF=1 measurements. WebGL specs run headed — headless throttles a
  mediastream-less page to ~1 rAF/s (measured; see DECISIONS).


## BodyArcade Dolphin (apps/dolphin + packages/world-data)

```
PosePuppet (producer, lite model, stage suspended)
    │ BodySignal only — axes + events + additive swim block
    │ (BroadcastChannel same-origin; postMessage relay as the
    │  cross-origin dev fallback; both shape-guarded)
    ▼
/dolphin/  (built standalone app, own three.js, served by the same
            vite middleware pattern as /flight/)
    ├─ input/swimControls: keyboard priority, autopilot on loss,
    │    burst machine, assist ladder
    ├─ game/sim: PURE 120 Hz fixed-timestep swim model (no RNG,
    │    byte-identical replays): impulse-and-glide kicks,
    │    pitch/banked-turn attitude, breach ballistics,
    │    SDF containment current + in-polygon slide guard
    ├─ game/world + decor: PS2 pass — vertex-lit seabed displaced by
    │    the SAME depth function the sim uses, shimmer-curtain
    │    boundary, boid fish, shader kelp, ruins, shafts, motes
    └─ ui: mono HUD + coach + minimap (the REAL bay polygon with the
         ODbL credit rendered under it)

packages/world-data (the future open-data pipeline's water component)
    offline: fetch → assemble (relation | coastline-clip modes) →
    simplify → project → boundary.json (provenance + attribution
    embedded; loadBoundary refuses artifacts without attribution)
    runtime: pointInWater / signedDistanceToShore — containment,
    depth field, and minimap all run on these two calls
```

The swim-kick signal is the vertical chest–hip extent in image space
(self-normalized, slow EMA) through the same StrokeDetector Rowing
uses — no wrist depth anywhere, which is why Dolphin's companion mode
keeps the lite tracker where Rowing must not. Landmarks never cross
any transport (schema-enforced, both directions measured in tests).

Test topology note: all suite configs and spec constants take PP_PORT
(default 5173). On shared boxes another checkout may own 5173 with a
persistent dev server, and reuseExistingServer would silently test the
wrong tree — dolphin-branch runs pin PP_PORT=5273 --strictPort.

## V5 Character Control (apps/posepuppet retarget layer + pose-runtime fusion)

- `data/avatar-capabilities.json` — the reviewed capability manifest. All
  gating (finger fusion, face-touch class, feet, card labels, coach lines)
  reads it through `src/rig/capabilities.ts`; nothing re-derives capability
  at runtime. `scripts/capability-report.mjs` (+ shared rules in
  `capability-lib.mjs`) regenerates/checks the machine half through the real
  loaders — report-only by design (no AutoRig).
- Hand fusion: `packages/pose-runtime/src/handFusion.ts` wraps a two-hand
  `createMultiHandDetector` (rate-capped, `shouldDetect` budget gate).
  Landmarks stay in the in-page trust domain; nothing new crosses the
  body-input boundary. The app (`src/main.ts`) anchors detected hands to
  RAW pose wrists, maps raw→enacted under mirroring, and drives
  `Avatar.applyFingerCurls()` on manifest-approved rigs only; staleness
  falls back per side to the pose approximation inside `retarget.ts`.
- Face-touch v2: `src/rig/faceSockets.ts` classifies the wrist offset in
  the person's head frame into seven named sockets and builds IK targets ON
  the avatar's head capsule (fit from skinned vertices in `vrm.ts`).
- Feet v2: `src/rig/feetPlanting.ts` — plant detection on normalized
  landmarks; planted-ankle drift feeds a root-correction servo
  (translation-only; limb chains and sync metrics untouched).
