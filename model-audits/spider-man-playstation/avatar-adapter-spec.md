# Spider-Man PlayStation avatar adapter spec

- Avatar ID: `spider-man-playstation`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 7
- Source to convert: `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend`
- Reference GLB: `spider_man_playstation_rigged.glb`
- Runtime VRM: `public/avatars/spider-man-playstation.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=spider-man-playstation after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend
# Target path: public/avatars/spider-man-playstation.vrm
```

## Implementation summary
Spider-Man PlayStation should use profile `humanoid` with action `convert_then_test`. Convert or test `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` to `public/avatars/spider-man-playstation.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
