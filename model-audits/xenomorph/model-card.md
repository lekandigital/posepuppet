# Avatar audit: Xenomorph

## Verdict

Label: custom_profile_needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## What to tell another LLM

Xenomorph should use profile `creature` with action `custom_profile`. Convert or test `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` to `public/avatars/xenomorph.vrm`, enable creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.

## Adapter spec

Read `model-audits/xenomorph/avatar-adapter-spec.json` first.
