# Fortnite Batman avatar adapter spec

- Avatar ID: `fortnite-batman`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 3
- Source to convert: `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend`
- Reference GLB: `fortnite_batman_advanced_rig.glb`
- Runtime VRM: `public/avatars/fortnite-batman.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=fortnite-batman after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend
# Target path: public/avatars/fortnite-batman.vrm
```

## Implementation summary
Fortnite Batman should use profile `humanoid` with action `convert_then_test`. Convert or test `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` to `public/avatars/fortnite-batman.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
