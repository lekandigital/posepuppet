# Shrek avatar adapter spec

- Avatar ID: `shrek`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 5
- Source to convert: `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx`
- Reference GLB: `shrek_rig.glb`
- Runtime VRM: `public/avatars/shrek.vrm`
- Enabled controls: arms, feet, hands, head, legs, root_motion, upper_body
- Disabled controls: face_touch, facial_expressions, fingers, toes
- Finger mode: `curl_presets`
- Face-touch mode: `estimated_targets_only`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_full_body`
- Acceptance test: Run PosePuppet with ?avatar=shrek after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx
# Target path: public/avatars/shrek.vrm
```

## Implementation summary
Shrek should use profile `humanoid` with action `convert_then_test`. Convert or test `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` to `public/avatars/shrek.vrm`, enable arms, feet, hands, head, legs, root_motion, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.
