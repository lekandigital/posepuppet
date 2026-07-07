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
