# Amazing Spider-Man 2 manual fix checklist

- Current blocker: Browser loads the candidate structurally, but every camera/material/frustum/source-reexport/raw-normalized visual attempt renders only the stage floor. Source re-export still has texture pack warnings and did not produce visible mesh in browser.
- Next action: Do not activate. Preserve as deferred source/material visibility blocker; next repair should inspect exported GLB materials/skin visibility in Blender and browser GLTF inspector before another conversion.
- Keep source binaries, screenshots, textures, converted VRMs, and generated-avatar symlinks out of git.
