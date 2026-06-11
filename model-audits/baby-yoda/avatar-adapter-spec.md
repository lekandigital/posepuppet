# Baby Yoda avatar adapter spec

- Avatar ID: `baby-yoda`
- Implementation status: `custom_profile`
- Profile: `creature`
- Priority: 20
- Source to convert: `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend`
- Reference GLB: `baby_yoda_mandalorian_-_low_poly_-_basic_rig.glb`
- Runtime VRM: `public/avatars/baby-yoda.vrm`
- Enabled controls: creature_head
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Finger mode: `none`
- Face-touch mode: `none`

## Do not implement
- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Minimum viable support
- First pass goal: `custom_creature_preview`
- Acceptance test: Run PosePuppet with ?avatar=baby-yoda after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend
# Target path: public/avatars/baby-yoda.vrm
```

## Implementation summary
Baby Yoda should use profile `creature` with action `custom_profile`. Convert or test `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend` to `public/avatars/baby-yoda.vrm`, enable creature_head, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
