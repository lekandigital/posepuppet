# Woody conversion diff

- Status: `completed`
- Source: `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- Converted VRM: `public/avatars/woody.vrm`
- Skeleton preserved: `yes`
- Humanoid mapping preserved: `yes`
- Mesh count: 6 -> 7
- Material count: 6 -> 6
- Texture result: `embedded`
- Fingers preserved: `not_applicable`
- Feet preserved: `yes`

## Notes
- Local ignored public/avatars/woody.vrm was re-opened with Blender and compared to the FBX audit.
- Mesh count changed because the converted VRM contains one extra unskinned mesh; humanoid skeleton and feet remained usable.

## Blockers
- three-vrm and PosePuppet runtime load tests are still not attempted.
