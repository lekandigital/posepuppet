# Terminator T-800 avatar adapter spec

- Avatar ID: `terminator-t-800`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 9
- Source to convert: `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend`
- Reference GLB: `terminator-t-800-endo-skeleton-damaged.glb`
- Runtime VRM: `public/avatars/terminator-t-800.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=terminator-t-800 after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.
# Selected source: terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend
# Target path: public/avatars/terminator-t-800.vrm
```

## Implementation summary
Terminator T-800 should use profile `humanoid` with action `convert_then_test`. Convert or test `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend` to `public/avatars/terminator-t-800.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
