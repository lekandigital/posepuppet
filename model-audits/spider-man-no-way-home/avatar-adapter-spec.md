# Spider-Man No Way Home avatar adapter spec

- Avatar ID: `spider-man-no-way-home`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 6
- Source to convert: `OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Reference GLB: `none`
- Runtime VRM: `public/avatars/spider-man-no-way-home.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=spider-man-no-way-home after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: OtherSpiderman/spider-man_no_way_home_rigged.glb
# Target path: public/avatars/spider-man-no-way-home.vrm
```

## Implementation summary
Spider-Man No Way Home should use profile `humanoid` with action `convert_then_test`. Convert or test `OtherSpiderman/spider-man_no_way_home_rigged.glb` to `public/avatars/spider-man-no-way-home.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
