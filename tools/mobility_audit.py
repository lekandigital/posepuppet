#!/usr/bin/env python3
"""
Write PosePuppet retargeting-simulation reports from an existing audit.json.

This is intentionally conservative. It creates the required mobility report
schema without pretending a visual deformation pass happened. A later Blender
pose-render implementation can replace the not-tested results with measured
pose/contact-sheet observations.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


POSES = [
    "neutral",
    "arms_up",
    "arms_forward",
    "elbow_bend",
    "wrist_rotate",
    "hand_to_cheek",
    "hand_to_mouth",
    "knee_bend",
    "foot_lift",
    "foot_rotate",
    "finger_curl",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def simulation_for(audit: dict) -> dict:
    slug = audit.get("model", {}).get("slug", "")
    caps = audit.get("posepuppet_capabilities", {})
    tests = {}
    for pose in POSES:
        tests[pose] = {
            "applied": False,
            "result": "not_tested",
            "measured_notes": [],
            "visual_review": "not_available",
            "reasoning_notes": [
                "Synthetic pose was not applied in this run; use Blender/contact sheets before upgrading this result."
            ],
        }
    profile = caps.get("recommended_runtime_profile", "unknown")
    if profile == "creature":
        verdict = "custom_profile"
    elif profile == "hand-only":
        verdict = "not_attempted"
    elif audit.get("scores", {}).get("overall", 0) >= 70:
        verdict = "needs_offsets"
    else:
        verdict = "needs_cleanup"
    return {
        "schema_version": "posepuppet-retargeting-simulation-v1",
        "created_at": utc_now(),
        "avatar_id": slug,
        "synthetic_pose_tests": tests,
        "overall_retargeting_simulation_verdict": verdict,
        "notes": [
            "Generated from scripted audit facts only.",
            "No contact-sheet or visual deformation review was completed.",
        ],
    }


def write_reports(audit_json: Path, outdir: Path) -> None:
    audit = json.loads(audit_json.read_text())
    sim = simulation_for(audit)
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "retargeting-simulation.json").write_text(json.dumps(sim, indent=2, sort_keys=True) + "\n")
    lines = [
        f"# {audit.get('model', {}).get('name', audit_json.parent.name)} retargeting simulation",
        "",
        f"Generated: {sim['created_at']}",
        "",
        f"Overall verdict: `{sim['overall_retargeting_simulation_verdict']}`",
        "",
        "| Pose | Applied | Result | Visual review |",
        "|---|---:|---|---|",
    ]
    for pose, result in sim["synthetic_pose_tests"].items():
        lines.append(f"| {pose} | {str(result['applied']).lower()} | {result['result']} | {result['visual_review']} |")
    lines.extend(
        [
            "",
            "No synthetic pose deformation or contact-sheet review was completed in this run.",
        ]
    )
    (outdir / "retargeting-simulation.md").write_text("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create conservative mobility simulation reports from audit.json.")
    parser.add_argument("audit_json")
    parser.add_argument("outdir")
    args = parser.parse_args(argv)
    write_reports(Path(args.audit_json), Path(args.outdir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
