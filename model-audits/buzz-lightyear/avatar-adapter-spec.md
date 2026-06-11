# Buzz Lightyear avatar adapter spec

- Avatar ID: `buzz-lightyear`
- Implementation status: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Priority: 19
- Source to convert: `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend`
- Reference GLB: `adi_2.0_buzz_lightyear_fully_rigged.glb`
- Runtime VRM: `public/avatars/buzz-lightyear.vrm`
- Enabled controls: arms, hands, head, upper_body
- Disabled controls: face_touch, facial_expressions, feet, fingers, toes
- Finger mode: `none`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_upper_body_only`
- Acceptance test: Run PosePuppet with ?avatar=buzz-lightyear after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend
# Target path: public/avatars/buzz-lightyear.vrm
```

## Implementation summary
Buzz Lightyear should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` to `public/avatars/buzz-lightyear.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.
