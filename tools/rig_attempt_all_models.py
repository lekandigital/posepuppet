#!/usr/bin/env python3
"""Create baseline rig-attempt manifests for all audited models."""

from __future__ import annotations

import argparse
import json

from common_avatar_pipeline import AUDIT_DIR
from rig_attempt_model import write_attempt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attempt", default="baseline")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    if args.dry_run == args.run:
        raise SystemExit("Choose exactly one of --dry-run or --run")
    slugs = sorted(path.parent.name for path in AUDIT_DIR.glob("*/audit.json"))
    manifests = [write_attempt(slug, args.attempt, args.run) for slug in slugs]
    print(json.dumps({"status": "pass", "attempts": len(manifests)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
