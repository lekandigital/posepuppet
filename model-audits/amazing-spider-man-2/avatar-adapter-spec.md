# The Amazing Spider-Man 2 avatar adapter spec

- Avatar ID: `amazing-spider-man-2`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 8
- Source to convert: `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx`
- Reference GLB: `OtherSpiderman/the_amazing_spider_man_2_rigged_model.glb`
- Runtime VRM: `public/avatars/amazing-spider-man-2.vrm`
- Enabled controls: arms, feet, hands, head, legs, root_motion, toes, upper_body
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
- Acceptance test: Run PosePuppet with ?avatar=amazing-spider-man-2 after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx
# Target path: public/avatars/amazing-spider-man-2.vrm
```

## Implementation summary
The Amazing Spider-Man 2 should use profile `humanoid` with action `convert_then_test`. Convert or test `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` to `public/avatars/amazing-spider-man-2.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
