#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from rig_prep_model import write_dry_run_reports
from rig_prep_pipeline import load_records_for_slug, resolve_source_dir


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.dry_run:
        raise SystemExit("Only --dry-run is supported by this orchestrator")
    if args.only:
        write_dry_run_reports(args.only)
        print(json.dumps({"status": "partial", "slug": args.only}, indent=2))
        return 0
    source_dir = resolve_source_dir()
    print(
        json.dumps(
            {
                "status": "partial",
                "scope": "enumeration_only",
                "source_dir": str(source_dir),
                "note": "Dry-run without --only intentionally avoids deep per-model processing.",
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
