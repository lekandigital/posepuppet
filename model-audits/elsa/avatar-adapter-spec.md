# Elsa avatar adapter spec

- Avatar ID: `elsa`
- Implementation status: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Priority: 11
- Source to convert: `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb`
- Reference GLB: `elsa_free_fall_frozen_with_rig_included (2).glb`
- Runtime VRM: `public/avatars/elsa.vrm`
- Enabled controls: arms, hands, head, upper_body
- Disabled controls: face_touch, facial_expressions, feet, fingers, toes
- Finger mode: `curl_presets`
- Face-touch mode: `ik_required`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.

## Minimum viable support
- First pass goal: `load_vrm_upper_body_only`
- Acceptance test: Run PosePuppet with ?avatar=elsa after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb
# Target path: public/avatars/elsa.vrm
```

## Implementation summary
Elsa should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` to `public/avatars/elsa.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.
