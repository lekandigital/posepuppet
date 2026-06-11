# Avatar audit: Buzz Lightyear

## Verdict

Label: cleanup_needed
Overall score: 21
Recommended runtime profile: humanoid_with_offsets
One-sentence recommendation: Automatic mapping is too weak; inspect hierarchy and create a manual map first.

## What to tell another LLM

Buzz Lightyear should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` to `public/avatars/buzz-lightyear.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.

## Adapter spec

Read `model-audits/buzz-lightyear/avatar-adapter-spec.json` first.
