# PosePuppet model audits

This folder contains text/JSON implementation guidance for local avatar source assets. It is designed so future coding agents can avoid reopening large model binaries during normal implementation.

## Read order

1. `model-audits/avatar-adapter-specs.json`
2. `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`
3. `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`

## Safe to commit

- Markdown and JSON audit outputs.
- `bone-tree.txt`, `source-files.txt`, `warnings.md`.
- Generated TypeScript preview because it is documentation only.

## Not included

- Source model binaries.
- ZIPs and nested ZIPs.
- Textures.
- Converted VRMs unless the user explicitly approves a specific runtime VRM.
- Screenshots/contact sheets by default.

## Commands

```sh
python3 tools/audit_model.py --self-test
python3 tools/generate_model_audit_v2.py model-audits
python3 tools/validate_model_audits.py model-audits
python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only
```
