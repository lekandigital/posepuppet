# Darth Vader avatar adapter spec

- Avatar ID: `darth-vader`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 2
- Source to convert: `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend`
- Reference GLB: `fortnite_darth_vader_advanced_rig (2).glb`
- Runtime VRM: `public/avatars/darth-vader.vrm`
- Enabled controls: arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body
- Disabled controls: face_touch, facial_expressions
- Finger mode: `full_finger_retargeting`
- Face-touch mode: `ik_required`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable facial expressions for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_full_body`
- Acceptance test: Run PosePuppet with ?avatar=darth-vader after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend
# Target path: public/avatars/darth-vader.vrm
```

## Implementation summary
Darth Vader should use profile `humanoid` with action `convert_then_test`. Convert or test `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` to `public/avatars/darth-vader.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
