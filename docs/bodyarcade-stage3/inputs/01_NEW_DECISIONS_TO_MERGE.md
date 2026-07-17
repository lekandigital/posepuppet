# New decisions to merge into BODYARCADE_MASTER_CONTEXT_V3

## Exact dolphin source

Model:

Realistic Dolphin | Rigged with 25+ Animations

Creator:

GAMICO

Sketchfab listing:

https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8

Track C must verify the current listing license, attribution wording, downloadable
file contents, complete animation list, and whether the downloaded GLB or FBX
contains all advertised animations.

## Ecco gameplay-fidelity priority

The goal is not only to reproduce the visual identity of Ecco the Dolphin:
Defender of the Future. Dolphin mode should also reproduce, as closely as
practical, why ordinary movement in that game is unusually pleasurable.

The research and later implementation must closely study and reproduce:

- acceleration and pulse propulsion;
- coasting and glide duration;
- slow-speed and high-speed turning;
- pitch, yaw, roll, and banking;
- velocity-following behavior;
- braking and rapid direction changes;
- camera distance, framing, lag, and correction;
- swimming near terrain and through confined spaces;
- surface approach;
- breaching;
- airborne movement;
- water re-entry;
- the relationship between velocity and dolphin animation.

Preserve the existing BodyArcade simulation architecture, body-input integration,
accessibility systems, deterministic replay, and working tests. Do not treat its
current feel constants or camera tuning as final. Compare them against Ecco and
retune or replace individual behaviors whenever Ecco is more enjoyable.

The acceptance test is not merely that Dolphin mode functions. Ordinary swimming
without missions or objectives should remain enjoyable for an extended period,
in the way ordinary movement in Ecco is enjoyable.
