# Mac → Ubuntu Sync Report

**Date:** 2026-06-11
**Goal:** Make Ubuntu the canonical machine for PosePuppet rig-prep and VRM conversion

## Summary

| Check | Status |
|-------|--------|
| Repo code sync (Mac → Ubuntu) | ✅ Pass |
| Generated VRM sync (Mac → Ubuntu working dir) | ✅ Pass |
| Woody candidate on Ubuntu | ✅ Present (5.0M) |
| Darth Vader candidate on Ubuntu | ✅ Present (16M) |
| Node 22 build on Ubuntu | ✅ Pass |
| Audit self-test | ⏭️ Not attempted (no --self-test flag) |
| Rig prep dry-run | ✅ Pass (enumeration) |
| VRM conversion dry-run | ✅ Pass (enumeration) |
| Woody validation | ✅ Pass (exit 0) |
| Darth Vader validation | ✅ Pass (exit 0) |
| Large files staged in git | ❌ None |
| Generated VRMs staged in git | ❌ None |

## Sync Details

- **Backup timestamp:** `20260611-110515`
- **Backup location:** `/home/o/posepuppet-working/sync-backups/20260611-110515/`
- **Repo files transferred:** 406
- **VRM files transferred:** 1 (darth-vader.vrm, 16M)
- **Excludes:** `.git/`, `node_modules/`, `.venv/`, `dist/`, `model-working/`, `ModelsForAnimation/`, `models_for_animation/`, `public/avatars/generated/`, `*.vrm`, `*.blend`, `*.fbx`, `*.glb`, `*.gltf`, `*.zip`, `*.png`, `*.jpg`, `*.jpeg`, `*.webp`

## Safety Checks

- No `--delete` flag used
- `--backup` preserved any overwritten files
- Dry-run reviewed before real sync
- No generated VRMs in git staging
- No model source binaries copied into repo

## Canonical Machine

Ubuntu (`o@192.168.86.152`) is now marked canonical via:
- `/home/o/posepuppet-working/UBUNTU_IS_CANONICAL_FOR_RIGGING.txt`
- `docs/avatar-rig-prep-pipeline.md` (canonical note appended)
- `docs/ubuntu-rigging-server-setup.md` (canonical note appended)
