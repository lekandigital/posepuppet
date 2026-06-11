#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from convert_avatar_to_vrm import dry_run
from rig_prep_pipeline import resolve_source_dir


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.dry_run:
        raise SystemExit("Only --dry-run is supported by this orchestrator")
    if args.only:
        dry_run(args.only)
        print(json.dumps({"status": "partial", "slug": args.only}, indent=2))
        return 0
    print(
        json.dumps(
            {
                "status": "partial",
                "scope": "enumeration_only",
                "source_dir": str(resolve_source_dir()),
                "note": "Dry-run without --only intentionally avoids deep per-model processing or candidate generation.",
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
