# Xenomorph avatar adapter spec

- Avatar ID: `xenomorph`
- Implementation status: `custom_profile`
- Profile: `creature`
- Priority: 16
- Source to convert: `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx`
- Reference GLB: `realistic_xenomorph_rig.glb`
- Runtime VRM: `public/avatars/xenomorph.vrm`
- Enabled controls: creature_head, creature_jaw, legs
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Finger mode: `curl_presets`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Minimum viable support
- First pass goal: `custom_creature_preview`
- Acceptance test: Run PosePuppet with ?avatar=xenomorph after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx
# Target path: public/avatars/xenomorph.vrm
```

## Implementation summary
Xenomorph should use profile `creature` with action `custom_profile`. Convert or test `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` to `public/avatars/xenomorph.vrm`, enable creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
