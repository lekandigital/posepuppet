# Rigged Hand avatar adapter spec

- Avatar ID: `rigged-hand`
- Implementation status: `hand_test_only`
- Profile: `hand_only`
- Priority: 17
- Source to convert: `rigged-hand.zip!/source/handRig_02.fbx`
- Reference GLB: `rigged_hand.glb`
- Runtime VRM: `public/avatars/rigged-hand.vrm`
- Enabled controls: fingers, hands
- Disabled controls: arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body
- Finger mode: `curl_presets`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.
- Do not treat this as a full avatar; use it only for hand/finger tests.

## Minimum viable support
- First pass goal: `hand_test_only`
- Acceptance test: Run PosePuppet with ?avatar=rigged-hand after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: rigged-hand.zip!/source/handRig_02.fbx
# Target path: public/avatars/rigged-hand.vrm
```

## Implementation summary
Rigged Hand should use profile `hand_only` with action `hand_test_only`. Convert or test `rigged-hand.zip!/source/handRig_02.fbx` to `public/avatars/rigged-hand.vrm`, enable fingers, hands, and disable arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body until runtime tests pass.
