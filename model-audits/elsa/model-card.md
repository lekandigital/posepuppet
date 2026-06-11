# Avatar audit: Elsa

## Verdict

Label: cleanup_needed
Overall score: 67
Recommended runtime profile: humanoid_with_offsets
One-sentence recommendation: Partial structure exists, but cleanup or custom mapping is needed first.

## What to tell another LLM

Elsa should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` to `public/avatars/elsa.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.

## Adapter spec

Read `model-audits/elsa/avatar-adapter-spec.json` first.
