# Woody avatar adapter spec

- Avatar ID: `woody`
- Implementation status: `convert_then_enable`
- Profile: `humanoid`
- Priority: 1
- Source to convert: `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- Reference GLB: `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb`
- Runtime VRM: `public/avatars/woody.vrm`
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
- Acceptance test: Run PosePuppet with ?avatar=woody after adding a gated registry entry and verify basic tracking without runtime errors.

## Conversion command

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  -b \
  --python tools/export_fbx_to_vrm.py \
  -- "/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx" \
  public/avatars/woody.vrm
```

## Implementation summary
Woody should use profile `humanoid` with action `convert_then_test`. Convert or test `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` to `public/avatars/woody.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
