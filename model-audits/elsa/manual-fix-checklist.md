# Elsa manual fix checklist

- Current blocker: VRM loader rejects the candidate because required humanoid lower-body bones are missing; raw GLTF load succeeds but remains visually blank after normalization. Source audit shows only upper-body useful mapping plus duplicate/reflection source content.
- Next action: Do not activate. Requires manual artist/source repair to add or recover lower-body bones before VRM humanoid conversion can be trusted.
- Keep source binaries, screenshots, textures, converted VRMs, and generated-avatar symlinks out of git.
