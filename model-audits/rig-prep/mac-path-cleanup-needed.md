# Mac Path Cleanup Needed

## Summary

347 total `/Users/lekan` references across model-audits, tools, src, and package.json.

## Classification

### historical_ok (do not rewrite)
Historical audit artifacts generated on Mac that are now read-only reference data.
These paths will never be used for operations on Ubuntu.

| File(s) | Count | Reason |
|---------|-------|--------|
| `model-audits/woody/source-files.txt` | 5 | Historical Mac audit paths, read-only reference |
| `model-audits/woody/avatar-adapter-spec.json` | 4 | Historical audit, Mac source path for woody FBX |
| `model-audits/woody/avatar-adapter-spec.md` | 4 | Historical audit doc |
| `model-audits/woody/conversion-diff.md` | 1 | Historical conversion record |
| `model-audits/woody/llm-dossier.json` | 8 | Historical LLM handoff, not used operationally |
| `model-audits/woody/reference-glb/` | 3 | Historical GLB inspection, read-only |
| `model-audits/rigged-hand/blender.log` | 4 | Historical Blender run log from Mac |
| `model-audits/rigged-hand/audit.json` | 2 | Historical Mac audit output |
| `model-audits/rigged-hand/runtime-glb/` | 2 | Historical runtime GLB audit |
| `model-audits/dedupe-report.md` | 1 | Historical dedup note |
| `model-audits/source-selection.md` | 4 | Historical source selection doc |

**Total historical_ok: ~338 references**

### should_update_to_ubuntu_path (operational paths that affect Ubuntu work)

| File | Line | Mac path | Correct Ubuntu path | Action |
|------|------|----------|---------------------|--------|
| `package.json:15` | `audit:models` | `/Users/lekan/Downloads/woody` | `/home/o/posepuppet-assets/woody` | Update if running `npm run audit:models` on Ubuntu |
| `tools/audit_models.py:784` | default | `/Users/lekan/Downloads/woody` | `/home/o/posepuppet-assets/woody` | Low priority — CLI arg overrides this |
| `tools/generate_model_audit_v2.py:330` | hardcoded | `/Users/lekan/Downloads/woody/...T-Pose (9).fbx` | Ubuntu path | Medium — only matters if regenerating V2 audit |
| `tools/generate_model_audit_v2.py:1499` | hardcoded | `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb` | Ubuntu path | Medium |

**Immediate risk: None** — `resolve_woody_dir()` in `rig_prep_pipeline.py` already checks
`/home/o/posepuppet-assets/woody` first, so pipeline operations work correctly on Ubuntu
without any changes.

### needs_manual_review

| File | Issue |
|------|-------|
| `tools/common_avatar_pipeline.py:262-264` | Mac-to-Ubuntu path remapping dict — keep as-is, it's a compatibility shim |
| `model-audits/avatar-adapter-specs.json:63` | `source_to_convert` for woody still shows Mac path — should be updated if this file drives future automation |

## Recommendation

**Do not blindly rewrite all 347 occurrences.** The pipeline already handles Ubuntu correctly
via environment variable overrides and priority-ordered path resolution. The only operational
risk is `package.json`'s `audit:models` script and the two hardcoded paths in
`generate_model_audit_v2.py`, both of which are low-risk (never run for VRM conversion).
