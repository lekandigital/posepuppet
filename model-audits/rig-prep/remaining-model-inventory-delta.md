# Remaining Model Inventory Delta

## Dry-Run Source Resolution

**18/18 pass** — all remaining models resolve their source files on Ubuntu (`/home/o/posepuppet-assets/ModelsForAnimation`).

| Slug | Source Format | Manual Bone Map | Dry-Run |
|------|--------------|----------------|---------|
| fortnite-batman | .blend | ✅ found | ✅ pass |
| iron-man | .blend | ✅ found | ✅ pass |
| shrek | .fbx | ✅ found | ✅ pass |
| spider-man-no-way-home | .glb | ✅ found | ✅ pass |
| spider-man-playstation | .blend | ✅ found | ✅ pass |
| amazing-spider-man-2 | .fbx | ✅ found | ✅ pass |
| terminator-t-800 | .blend | ✅ found | ✅ pass |
| jack-sparrow | .blend | ✅ found | ✅ pass |
| elsa | .glb | ✅ found | ✅ pass |
| grogu | .blend | ✅ found | ✅ pass |
| king-kong | .glb | ✅ found | ✅ pass |
| olaf | .blend | ✅ found | ✅ pass |
| godzilla | .blend | ✅ found | ✅ pass |
| xenomorph | .fbx | ✅ found | ✅ pass |
| rigged-hand | .fbx | ✅ found | ✅ pass |
| teal-v2 | .fbx | ✅ found | ✅ pass |
| buzz-lightyear | .blend | ✅ found | ✅ pass |
| baby-yoda | .blend | ✅ found | ✅ pass |

## Blender Inspect Results (next-batch candidates)

| Slug | Status | Bones | Fingers | Hands | Feet | Height | Notes |
|------|--------|-------|---------|-------|------|--------|-------|
| fortnite-batman | ✅ pass | 24 | good | good | good | 1.69m | Best candidate — correct scale |
| iron-man | ✅ pass | 21 | good | good | good | 6.49m | Scale needs normalize (exporter handles) |
| shrek | ✅ pass | 20 | poor | good | good | 83.5m | FBX cm scale, curl presets only |
| amazing-spider-man-2 | ✅ pass | 22 | missing | good | good | 69.0m | FBX cm scale, palm only |
| terminator-t-800 | ✅ pass | 22 | missing | good | good | 203.7m | Blender cm scale, palm only |

## Classification Changes

No classifications changed versus the existing adapter specs audit. All models resolved to their expected source paths on Ubuntu with the expected bone map files present.
