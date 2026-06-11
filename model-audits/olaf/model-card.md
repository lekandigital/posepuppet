# Avatar audit: Olaf

## Verdict

Label: custom_profile_needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## What to tell another LLM

Olaf should use profile `creature` with action `custom_profile`. Convert or test `olaf-3d-rigged.zip!/source/OlafRig.blend` to `public/avatars/olaf.vrm`, enable arms, creature_head, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.

## Adapter spec

Read `model-audits/olaf/avatar-adapter-spec.json` first.
