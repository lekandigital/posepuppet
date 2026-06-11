# Olaf avatar adapter spec

- Avatar ID: `olaf`
- Implementation status: `custom_profile`
- Profile: `creature`
- Priority: 14
- Source to convert: `olaf-3d-rigged.zip!/source/OlafRig.blend`
- Reference GLB: `olaf_3d_rigged.glb`
- Runtime VRM: `public/avatars/olaf.vrm`
- Enabled controls: arms, creature_head, legs
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Finger mode: `curl_presets`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Minimum viable support
- First pass goal: `custom_creature_preview`
- Acceptance test: Run PosePuppet with ?avatar=olaf after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: olaf-3d-rigged.zip!/source/OlafRig.blend
# Target path: public/avatars/olaf.vrm
```

## Implementation summary
Olaf should use profile `creature` with action `custom_profile`. Convert or test `olaf-3d-rigged.zip!/source/OlafRig.blend` to `public/avatars/olaf.vrm`, enable arms, creature_head, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
