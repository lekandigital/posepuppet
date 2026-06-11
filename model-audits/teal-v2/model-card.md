# Avatar audit: Teal v2

## Verdict

Label: cleanup_needed
Overall score: 53
Recommended runtime profile: humanoid_with_offsets
One-sentence recommendation: Automatic mapping is too weak; inspect hierarchy and create a manual map first.

## What to tell another LLM

Teal v2 should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `teal-v2.zip!/source/Tealv2.fbx` to `public/avatars/teal-v2.vrm`, enable arms, feet, hands, head, legs, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.

## Adapter spec

Read `model-audits/teal-v2/avatar-adapter-spec.json` first.
