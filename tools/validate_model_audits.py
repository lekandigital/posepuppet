#!/usr/bin/env python3
"""Validate generated PosePuppet model audit V2 artifacts."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REQUIRED_MODEL_FILES = [
    "audit.json",
    "llm-dossier.md",
    "llm-dossier.json",
    "avatar-adapter-spec.md",
    "avatar-adapter-spec.json",
    "conversion-report.md",
    "conversion-diff.md",
    "conversion-diff.json",
    "posepuppet-runtime-test.md",
    "retargeting-simulation.md",
    "retargeting-simulation.json",
    "source-files.txt",
    "warnings.md",
]

REQUIRED_JSON_SECTIONS = [
    "posepuppet_runtime_test",
    "rest_pose_and_orientation",
    "conversion_status",
    "source_selection",
    "retargeting_risk",
    "deformation_risks",
    "performance_budget",
    "finger_drive_plan",
    "face_touch_targets",
    "appearance_descriptor",
    "visual_evidence_manifest",
    "visual_reasoning_review",
    "mobility_visual_review",
    "bone_map_confidence",
    "deformation_sanity",
    "creature_profile",
    "coding_agent_decision",
    "implementation_contract",
    "avatar_adapter_spec",
    "token_saving_summary",
    "token_saving_index",
    "evidence_ledger",
    "understanding_provenance",
    "final_model_action",
    "source_lock",
]

REQUIRED_AGGREGATES = [
    "avatar-adapter-specs.json",
    "avatar-adapter-specs.md",
    "model-family-strategies.md",
    "model-family-strategies.json",
    "llm-handoff.md",
    "runtime-readiness.md",
    "conversion-matrix.md",
    "performance-budget.md",
    "source-selection.md",
    "implementation-playbook.md",
    "source-lock.json",
    "audit-staleness-report.md",
    "avatar-registry-plan.md",
    "avatar-registry-plan.json",
    "generated-avatar-config-preview.ts",
    "coding-queue.md",
    "coding-queue.json",
    "README.md",
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def model_dirs(audit_dir: Path) -> list[Path]:
    return sorted(path for path in audit_dir.iterdir() if path.is_dir() and (path / "audit.json").exists())


def validate(audit_dir: Path) -> list[str]:
    errors: list[str] = []
    root = audit_dir.parent
    models = model_dirs(audit_dir)
    slugs = [path.name for path in models]

    for name in REQUIRED_AGGREGATES:
        if not (audit_dir / name).exists():
            errors.append(f"missing aggregate file: model-audits/{name}")
    for name in [
        "COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md",
        "COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md",
    ]:
        if not (root / name).exists():
            errors.append(f"missing combined file: {name}")

    adapter_specs_path = audit_dir / "avatar-adapter-specs.json"
    aggregate_models = []
    if adapter_specs_path.exists():
        aggregate = load_json(adapter_specs_path)
        aggregate_models = [row.get("avatar_id") for row in aggregate.get("models", [])]
        if "woody" not in aggregate_models:
            errors.append("avatar-adapter-specs.json does not include Woody")
        missing = sorted(set(slugs) - set(aggregate_models))
        if missing:
            errors.append(f"avatar-adapter-specs.json missing models: {', '.join(missing)}")

    source_lock = {}
    if (audit_dir / "source-lock.json").exists():
        lock = load_json(audit_dir / "source-lock.json")
        source_lock = {row.get("slug"): row for row in lock.get("models", [])}

    for path in models:
        slug = path.name
        for name in REQUIRED_MODEL_FILES:
            if not (path / name).exists():
                errors.append(f"{slug}: missing {name}")
        audit_path = path / "audit.json"
        dossier_path = path / "llm-dossier.json"
        if not audit_path.exists():
            continue
        audit = load_json(audit_path)
        dossier = load_json(dossier_path) if dossier_path.exists() else {}
        for section in REQUIRED_JSON_SECTIONS:
            if section not in audit:
                errors.append(f"{slug}: audit.json missing {section}")
            if section not in dossier:
                errors.append(f"{slug}: llm-dossier.json missing {section}")
        if "source_lock" not in audit or slug not in source_lock:
            errors.append(f"{slug}: missing source lock entry")
        final_action = audit.get("final_model_action", {}).get("action")
        if not final_action:
            errors.append(f"{slug}: missing final action")
        token_summary = audit.get("token_saving_summary", {})
        token_index = audit.get("token_saving_index", {})
        if not token_summary or not token_index:
            errors.append(f"{slug}: missing token-saving instructions")

        adapter = load_json(path / "avatar-adapter-spec.json") if (path / "avatar-adapter-spec.json").exists() else {}
        status = adapter.get("implementation_status")
        runtime_vrm = adapter.get("runtime_vrm_path")
        if status == "use_now" and not runtime_vrm:
            errors.append(f"{slug}: use_now has no runtime VRM path")
        if status == "use_now":
            runtime = audit.get("posepuppet_runtime_test", {})
            if runtime.get("source_converts_to_vrm") != "pass" or runtime.get("loads_in_posepuppet") != "pass":
                errors.append(f"{slug}: use_now without conversion/runtime pass")

        enabled = set(adapter.get("enabled_controls", []))
        creature = audit.get("creature_profile", {})
        if creature.get("is_creature") and "standard_humanoid_full_body" in enabled:
            errors.append(f"{slug}: creature enables standard_humanoid_full_body")
        caps = audit.get("posepuppet_capabilities", {})
        if caps.get("fingers") == "missing" and "fingers" in enabled:
            errors.append(f"{slug}: missing fingers but enables fingers")
        if caps.get("feet") == "missing" and "feet" in enabled:
            errors.append(f"{slug}: missing feet but enables feet")
        if caps.get("facial_expressions") == "missing" and "facial_expressions" in enabled:
            errors.append(f"{slug}: missing face data but enables facial_expressions")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate PosePuppet model-audits V2 outputs.")
    parser.add_argument("audit_dir")
    args = parser.parse_args(argv)
    errors = validate(Path(args.audit_dir).expanduser().resolve())
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("OK: model audit V2 validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
