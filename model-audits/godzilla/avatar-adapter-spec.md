# Godzilla avatar adapter spec

- Avatar ID: `godzilla`
- Implementation status: `custom_profile`
- Profile: `creature`
- Priority: 15
- Source to convert: `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend`
- Reference GLB: `godzilla_rigged_animated.glb`
- Runtime VRM: `public/avatars/godzilla.vrm`
- Enabled controls: arms, creature_head, creature_jaw, legs
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
- Acceptance test: Run PosePuppet with ?avatar=godzilla after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend
# Target path: public/avatars/godzilla.vrm
```

## Implementation summary
Godzilla should use profile `creature` with action `custom_profile`. Convert or test `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend` to `public/avatars/godzilla.vrm`, enable arms, creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
