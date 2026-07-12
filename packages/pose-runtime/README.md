# @bodyarcade/pose-runtime

Headless PosePuppet tracking as a system layer: any page initializes body
control directly — no PosePuppet tab required.

```ts
import { createPoseRuntime } from '@bodyarcade/pose-runtime';

const runtime = createPoseRuntime({ model: 'lite', election: 'strict' });
void runtime.start(); // camera → detector → PPC → BodySignal emission
```

## What it owns

- **Camera ownership + lifecycle** — the runtime is the page's only
  `getUserMedia` consumer (enforced by test). States:
  `idle → electing → starting → loading-model → running`, with `file`
  (fixture playback), `denied`, `error`, `external`, `stopped`.
- **Detection** — MediaPipe pose (full/lite hot-swap) and hand landmarkers,
  GPU→CPU fallback, one detection per presented video frame. Asset paths
  default to `/models` + `/mediapipe-wasm` (same-origin; override via
  `assets`).
- **Predictive Pose Continuity** — occlusion carry/synthesis at the fork,
  so every consumer inherits it.
- **body-input emission** — landmarks enter `@bodyarcade/body-input` inside
  the runtime and only there; the in-page channel and BroadcastChannel
  carry `BodySignal` only.
- **Producer election** — one producer per origin: traffic listen + Web
  Locks (`bodyarcade-pose-producer`). Games use `election: 'strict'`
  (yield to an active PosePuppet tab / other game tab); the Full App uses
  `'claim'`. `?pp=companion` (set by the PosePuppet bridge) maps to
  `forceExternal`.
- **HUD preview state** — `PreviewFrame`: mirrored, quantized (1/512),
  2D-only skeleton points + per-limb PPC states + coarse confidence.
  Delivered in-process only; never serialized onto a transport.

## Boundary law

Raw landmarks never leave this package on a transport. What crosses:

| surface | payload | who |
|---|---|---|
| BroadcastChannel / postMessage | `BodySignal` (derived axes/events) | games |
| `runtime.preview` (in-process) | `PreviewFrame` (quantized 2D render state) | pose-hud |
| `runtime.onFrame` (in-process) | full frames — same trust domain | the Full App only |

Enforced by `tests/runtime-boundary.spec.ts` (deep scan) and the per-game
wire assertions in each app's `hud.spec.ts`.

## Consumers

- `apps/posepuppet` (root `src/`) — supplies its own visible `<video>`,
  taps `onFrame` for retargeting/eval, keeps its own smoothing.
- TinySkies Flight / Rowing (`apps/flight`) — lite / **full** model
  respectively (rowing reads wrist depth; lite collapses it — measured).
- Standalone Dolphin (`apps/dolphin`) — lite model.
