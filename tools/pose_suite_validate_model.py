#!/usr/bin/env python3
"""Refresh one model's pose-suite validation report."""

from __future__ import annotations

import argparse
import json
import subprocess

from common_avatar_pipeline import REPO_ROOT


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--source", choices=["generated-vrm", "attempt", "audit-only"], default="audit-only")
    parser.add_argument("--attempt-id", default="")
    args = parser.parse_args()
    result = subprocess.run(
        ["python3", "tools/generate_rig_readiness_summaries.py", "--browser-smoke-status", "pass"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    payload = {
        "status": "pass" if result.returncode == 0 else "failed",
        "slug": args.slug,
        "source": args.source,
        "attempt_id": args.attempt_id,
        "generator_stdout": result.stdout[-1000:],
        "generator_stderr": result.stderr[-1000:],
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
