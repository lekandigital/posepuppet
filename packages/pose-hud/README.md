# @bodyarcade/pose-hud

The shared BodyArcade tracking overlay — a compact console-system HUD every
game mounts next to its own UI.

```ts
import { mountPoseHud } from '@bodyarcade/pose-hud';

const hud = mountPoseHud(runtime, {
  position: 'bottom-left', // default
  safeArea: { x: 12, y: 118 }, // px from the corner — clear game controls
  title: 'ROW',
});
```

## Contents

- Preview figure: a 2D-canvas glowing wireframe (x-ray language) mirroring
  the user — deliberately not a VRM (games ship their own three versions;
  a second GL context per page is the exact GPU cost the budget forbids).
  Limbs tint by PPC state (cyan live, violet predicted, dim relaxed).
- Mono tracking state: `LIVE · 24 HZ`, `REACQUIRING`, `SIGNAL LOST`,
  `CAMERA DENIED`, `REMOTE FEED`, `LOADING MODEL…`.
- Privacy line, always visible when open: `LOCAL INFERENCE · NO UPLOADS`.
- Recenter flash on the body-input `recenter` event.
- `START CAMERA` action only when actionable (idle / denied retry / remote
  feed ended). No settings panel.

## Interaction (keyboard parallels every hover behavior)

| action | mouse | keyboard |
|---|---|---|
| peek/expand | hover | Tab focus |
| open/collapse | header button | Enter / Space (Esc collapses) |
| preview ↔ camera feed | click stage / CAM button | `c` or arrow keys |

## Degradation tiers

`0` glow skeleton @30 Hz → `1` flat lines @15 Hz → `2` dots @10 Hz →
`3` off (text only). Auto-degrades after ~2.5 s under 45 page-fps, recovers
slowly; `handle.setPreviewTier(t)` pins a tier (tests, budget), `stats()`
reports `{ tier, drawMsAvg, pageFps }`. Tier is mirrored on the canvas as
`data-tier`.
