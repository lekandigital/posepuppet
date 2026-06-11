# Iron Man avatar adapter spec

- Avatar ID: `iron-man`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 4
- Source to convert: `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend`
- Reference GLB: `iron_man_rig.glb`
- Runtime VRM: `public/avatars/iron-man.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=iron-man after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend
# Target path: public/avatars/iron-man.vrm
```

## Implementation summary
Iron Man should use profile `humanoid` with action `convert_then_test`. Convert or test `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` to `public/avatars/iron-man.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
