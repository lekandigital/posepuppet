# Future Feature Dependency Delta

## Feature → Model Blockers

| Feature | Blocks | Count | Effort | Priority |
|---------|--------|-------|--------|----------|
| `creature_profile_system` | grogu, olaf, baby-yoda, godzilla, xenomorph, king-kong | 6 | 1-2 days | medium |
| `manual_bone_map_cleanup` | elsa, teal-v2, buzz-lightyear | 3 | 2-4h each | medium |
| `hand_only_mode` | rigged-hand | 1 | 4h | low |
| `finger_retargeting` | — (enhances batman, iron-man, darth-vader) | 0 | 1-2 days | high |
| `face_touch_ik` | — (enhances all humanoids) | 0 | 2-3 days | medium |
| `facial_expressions` | — (enhances all humanoids) | 0 | 2-3 days | low |
| `lod_or_decimation` | — (enhances heavy models) | 0 | 1 day | low |

## Critical Path for Next Mega-Run

```
Batch 1 (batman, iron-man, shrek):
  → NO feature dependencies — convert immediately
  
Batch 2 (asm2, t-800, spider-men):
  → Inspect first, then convert — NO feature dependencies

Batch 3 (jack-sparrow, elsa, teal-v2, buzz):
  → manual_bone_map_cleanup needed BEFORE conversion

Batch 4 (rigged-hand):
  → hand_only_mode + finger_retargeting needed

Batch 5 (all creatures):
  → creature_profile_system needed — largest code investment
```

## Key Insight

**Batches 1-2 (8 models) can be batch-converted with ZERO new feature work.** The existing
pipeline (`rig_prep_model.py` → `convert_avatar_to_vrm.py` → `validate_vrm_candidate.py` →
browser smoke via `?generatedAvatar=` query param) handles them end-to-end.
