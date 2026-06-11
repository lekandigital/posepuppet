# Jack Sparrow avatar adapter spec

- Avatar ID: `jack-sparrow`
- Implementation status: `convert_then_enable`
- Profile: `humanoid_with_offsets`
- Priority: 10
- Source to convert: `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend`
- Reference GLB: `jack_sparrow_ready_for_animation.glb`
- Runtime VRM: `public/avatars/jack-sparrow.vrm`
- Enabled controls: arms, feet, hands, head, legs, toes, upper_body
- Disabled controls: face_touch, facial_expressions, fingers
- Finger mode: `palm_only`
- Face-touch mode: `ik_required`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_full_body`
- Acceptance test: Run PosePuppet with ?avatar=jack-sparrow after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend
# Target path: public/avatars/jack-sparrow.vrm
```

## Implementation summary
Jack Sparrow should use profile `humanoid_with_offsets` with action `convert_then_test`. Convert or test `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend` to `public/avatars/jack-sparrow.vrm`, enable arms, feet, hands, head, legs, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
