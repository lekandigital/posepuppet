#!/usr/bin/env python3
"""Refresh pose-suite validation reports for all audited models."""

from __future__ import annotations

import argparse
import subprocess

from common_avatar_pipeline import REPO_ROOT


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser-smoke-status", default="pass")
    args = parser.parse_args()
    result = subprocess.run(
        ["python3", "tools/generate_rig_readiness_summaries.py", "--browser-smoke-status", args.browser_smoke_status],
        cwd=REPO_ROOT,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
