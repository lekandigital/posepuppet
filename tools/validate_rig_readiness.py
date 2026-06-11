#!/usr/bin/env python3
"""Fail-closed validation for PosePuppet rig-readiness report artifacts."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_PROFILES = {"humanoid", "humanoid_with_offsets", "creature", "hand_only", "static_preview", "deferred"}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def git_lines(args: list[str]) -> list[str]:
    result = subprocess.run(["git", *args], cwd=REPO_ROOT, text=True, capture_output=True, check=False)
    return [line for line in result.stdout.splitlines() if line]


def add(errors: list[str], condition: bool, message: str) -> None:
    if condition:
        errors.append(message)


def validate_model(audit_root: Path, slug: str) -> list[str]:
    errors: list[str] = []
    model_dir = audit_root / slug
    required = [
        "rig-improvement-plan.json",
        "attempts-summary.json",
        "runtime-capability-profile.json",
        "manual-fix-checklist.json",
        "pose-suite-validation.json",
        "visual-rig-review.json",
        "hand-and-finger-readiness.json",
        "feet-and-leg-readiness.json",
        "face-touch-rig-plan.json",
        "game-control-readiness.json",
        "web-optimization-review.json",
    ]
    for filename in required:
        add(errors, not (model_dir / filename).exists(), f"{slug}: missing {filename}")
    if errors:
        return errors

    runtime = read_json(model_dir / "runtime-capability-profile.json")
    attempts = read_json(model_dir / "attempts-summary.json")
    hand = read_json(model_dir / "hand-and-finger-readiness.json")
    feet = read_json(model_dir / "feet-and-leg-readiness.json")
    visual = read_json(model_dir / "visual-rig-review.json")
    web = read_json(model_dir / "web-optimization-review.json")

    profile = runtime.get("runtime_profile")
    add(errors, profile not in RUNTIME_PROFILES, f"{slug}: invalid runtime_profile {profile!r}")
    if profile == "creature":
        add(errors, runtime.get("quality_label") == "works_well", f"{slug}: creature cannot be works_well without creature runtime")
        add(errors, "standard_humanoid" in str(runtime).lower(), f"{slug}: creature marked standard humanoid")
    if slug == "rigged-hand":
        add(errors, profile != "hand_only", f"{slug}: rigged-hand must be hand_only")
        add(errors, runtime.get("body_tracking", {}).get("arms") == "enabled", f"{slug}: hand-only profile enables full-body arms")
    if hand.get("finger_chains") in {"missing", "not_tested"}:
        add(errors, hand.get("classification") == "full_finger_retargeting", f"{slug}: missing fingers but full_finger_retargeting enabled")
    add(errors, feet.get("current_runtime_foot_driving") is True, f"{slug}: current runtime foot driving is claimed")
    if visual.get("visual_review") == "not_available":
        add(errors, runtime.get("quality_label") == "works_well", f"{slug}: works_well without visual review")
    if runtime.get("active_candidate", {}).get("browser_smoke") != "pass":
        add(errors, web.get("browser_load_risk") == "low" and web.get("candidate_vrm_exists") is False, f"{slug}: website-ready implied without browser smoke")

    for attempt in attempts.get("attempts", []):
        if attempt.get("classification") == "accepted_active_candidate":
            add(errors, attempt.get("browser_smoke") not in {"pass", "partial"}, f"{slug}: accepted candidate missing browser smoke")
            add(errors, attempt.get("post_vrm_validation") == "required", f"{slug}: accepted candidate missing post-VRM validation")
            add(errors, attempt.get("visual_review") not in {"pass", "acceptable", "partial", "not_available"}, f"{slug}: accepted candidate missing visual marker")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audit_root", nargs="?", default="model-audits")
    args = parser.parse_args()
    audit_root = (REPO_ROOT / args.audit_root).resolve()
    errors: list[str] = []
    model_dirs = sorted(path for path in audit_root.iterdir() if path.is_dir() and (path / "audit.json").exists())
    add(errors, not model_dirs, "no model audit directories found")

    for model_dir in model_dirs:
        errors.extend(validate_model(audit_root, model_dir.name))

    generated_tracked = git_lines(["ls-files", "public/avatars/generated/"])
    add(errors, bool(generated_tracked), "generated VRMs or symlinks are tracked: " + ", ".join(generated_tracked))
    model_working_tracked = git_lines(["ls-files", "model-working"])
    add(errors, bool(model_working_tracked), "model-working paths are tracked: " + ", ".join(model_working_tracked))
    image_tracked = [
        line
        for line in git_lines(["ls-files"])
        if line.startswith("model-working/")
        or line.startswith("public/avatars/generated/")
        or line.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".tga", ".bmp", ".tif", ".tiff", ".exr"))
    ]
    add(errors, bool(image_tracked), "forbidden generated/image paths are tracked: " + ", ".join(image_tracked[:20]))

    summary = {
        "status": "fail" if errors else "pass",
        "model_count": len(model_dirs),
        "errors": errors,
    }
    outdir = audit_root / "rig-prep" / "validation"
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "rig-readiness-validation.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    (outdir / "rig-readiness-validation.md").write_text(
        "# Rig-readiness validation\n\n"
        + f"- Status: `{summary['status']}`\n"
        + f"- Model count: `{summary['model_count']}`\n"
        + ("\n## Errors\n\n" + "\n".join(f"- {error}" for error in errors) + "\n" if errors else "\nNo validation errors found.\n")
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
