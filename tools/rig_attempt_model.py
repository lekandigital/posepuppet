#!/usr/bin/env python3
"""Create a non-destructive rig-attempt manifest for one model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common_avatar_pipeline import AUDIT_DIR, REPO_ROOT, model_work_dir, read_json, title_for_slug, utc_now, write_json, write_text


ATTEMPT_IDS = {
    "baseline": "attempt-001-baseline",
    "scale-orientation-root-fix": "attempt-002-scale-orientation-fix",
    "manual-bone-map-recovery": "attempt-003-manual-bone-map",
    "wrist-palm-axis-fix": "attempt-004-hand-palm-fix",
    "foot-ankle-axis-fix": "attempt-005-foot-ankle-fix",
    "face-touch-anchor-estimation": "attempt-006-face-touch-anchor",
    "creature-profile-static-preview": "attempt-007-creature-or-static-profile",
}


def write_attempt(slug: str, attempt: str, run: bool) -> dict:
    attempt_id = ATTEMPT_IDS.get(attempt, f"attempt-custom-{attempt}")
    work = REPO_ROOT / "model-working" / slug / "attempts" / attempt_id
    for child in ["logs", "exports", "snapshots"]:
        (work / child).mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema_version": "posepuppet-rig-attempt-manifest-v1",
        "created_at": utc_now(),
        "slug": slug,
        "attempt": attempt,
        "attempt_id": attempt_id,
        "mode": "run" if run else "dry-run",
        "classification": "saved_for_later" if run else "deferred",
        "working_directory": str(work),
        "repo_external_working_directory": str(model_work_dir(slug)),
        "source_assets_overwritten": False,
        "binaries_committed": False,
        "notes": ["Manifest only; heavy outputs belong in ignored working paths."],
    }
    write_json(work / "manifest.json", manifest)
    write_text(work / "notes.md", f"# {title_for_slug(slug)} {attempt_id}\n\n- Mode: `{manifest['mode']}`\n- Classification: `{manifest['classification']}`\n")
    summary_path = AUDIT_DIR / slug / "attempts-summary.json"
    summary = read_json(summary_path, {"slug": slug, "attempts": []})
    if isinstance(summary, dict):
        attempts = [row for row in summary.get("attempts", []) if row.get("attempt_id") != attempt_id]
        attempts.append(
            {
                "attempt_id": attempt_id,
                "label": attempt,
                "classification": manifest["classification"],
                "working_directory": str(work),
                "browser_smoke": "not_attempted",
                "visual_review": "not_available",
                "blockers": ["attempt_manifest_only"],
            }
        )
        summary["attempts"] = attempts
        summary["updated_at"] = utc_now()
        write_json(summary_path, summary)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--attempt", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    if args.dry_run == args.run:
        raise SystemExit("Choose exactly one of --dry-run or --run")
    manifest = write_attempt(args.slug, args.attempt, args.run)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
