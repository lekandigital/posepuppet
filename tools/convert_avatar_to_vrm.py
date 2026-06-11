#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from rig_prep_pipeline import (
    MODEL_AUDITS_DIR,
    load_records_for_slug,
    materialize_source,
    resolve_blender,
    run_command,
    utc_now,
    write_json,
    write_text,
)


def dry_run(slug: str) -> dict:
    context = load_records_for_slug(slug)
    payload = {
        "schema_version": "posepuppet-vrm-conversion-dry-run-v1",
        "created_at": utc_now(),
        "slug": slug,
        "status": "partial",
        "selected_source_path": context["primary"]["display"],
        "selected_source_format": context["primary"]["ext"],
        "expected_candidate_vrm_path": str(context["candidate_vrm_path"]),
        "manual_bone_map_path": str(context["manual_bone_map"]) if context["manual_bone_map"] else "",
        "runtime_browser_smoke": "not_attempted",
        "public_avatar_target": "not_allowed_without_explicit_instruction",
    }
    print(payload)
    return payload


def attempt(slug: str) -> int:
    context = load_records_for_slug(slug)
    working_root = context["working_dir"] / "conversion-input"
    source_path = materialize_source(context["primary"], working_root)
    output_path = context["candidate_vrm_path"]
    cmd = [
        str(resolve_blender()),
        "-b",
        "--python",
        str((Path(__file__).resolve().parent / "export_source_to_vrm.py")),
        "--",
        str(source_path),
        str(output_path),
    ]
    if context["manual_bone_map"]:
        cmd.extend(["--mapping", str(context["manual_bone_map"])])
    result = run_command(cmd, timeout=1200)
    payload = {
        "schema_version": "posepuppet-vrm-conversion-run-v1",
        "created_at": utc_now(),
        "slug": slug,
        "status": "pass" if result.returncode == 0 and output_path.exists() else "failed",
        "selected_source_path": context["primary"]["display"],
        "materialized_source_path": str(source_path),
        "candidate_vrm_path": str(output_path),
        "candidate_vrm_exists": output_path.exists(),
        "candidate_vrm_size_bytes": output_path.stat().st_size if output_path.exists() else 0,
        "manual_bone_map_path": str(context["manual_bone_map"]) if context["manual_bone_map"] else "",
        "command": cmd,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "runtime_browser_smoke": "not_attempted",
        "public_avatar_written": False,
    }
    outdir = MODEL_AUDITS_DIR / slug
    write_json(outdir / "vrm-conversion-run.json", payload)
    write_text(
        outdir / "vrm-conversion-run.md",
        "\n".join(
            [
                f"# {context['display_name']} VRM conversion run",
                "",
                f"- Status: `{payload['status']}`",
                f"- Selected source path: `{payload['selected_source_path']}`",
                f"- Materialized source path: `{payload['materialized_source_path']}`",
                f"- Candidate VRM path: `{payload['candidate_vrm_path']}`",
                f"- Candidate VRM exists: `{str(payload['candidate_vrm_exists']).lower()}`",
                f"- Candidate VRM size bytes: `{payload['candidate_vrm_size_bytes']}`",
                f"- Manual bone map path: `{payload['manual_bone_map_path'] or 'not_found'}`",
                "- Runtime browser smoke: `not_attempted`",
                "- Public avatar written: `false`",
                "",
                "## Command",
                "",
                "```sh",
                " ".join(cmd),
                "```",
            ]
        )
        + "\n",
    )
    return 0 if payload["status"] == "pass" else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--attempt", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        dry_run(args.slug)
        return 0
    if args.attempt:
        return attempt(args.slug)
    raise SystemExit("Use --dry-run or --attempt")


if __name__ == "__main__":
    raise SystemExit(main())
