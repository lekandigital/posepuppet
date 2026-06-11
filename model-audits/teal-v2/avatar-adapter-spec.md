# Teal v2 avatar adapter spec

- Avatar ID: `teal-v2`
- Implementation status: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Priority: 18
- Source to convert: `teal-v2.zip!/source/Tealv2.fbx`
- Reference GLB: `teal_v.2.glb`
- Runtime VRM: `public/avatars/teal-v2.vrm`
- Enabled controls: arms, feet, hands, head, legs, upper_body
- Disabled controls: face_touch, facial_expressions, fingers, toes
- Finger mode: `none`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_full_body`
- Acceptance test: Run PosePuppet with ?avatar=teal-v2 after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: teal-v2.zip!/source/Tealv2.fbx
# Target path: public/avatars/teal-v2.vrm
```

## Implementation summary
Teal v2 should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `teal-v2.zip!/source/Tealv2.fbx` to `public/avatars/teal-v2.vrm`, enable arms, feet, hands, head, legs, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.
