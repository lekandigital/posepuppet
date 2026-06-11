#!/usr/bin/env python3
"""Write a contact-sheet manifest without committing image artifacts."""

from __future__ import annotations

import argparse
import json

from common_avatar_pipeline import AUDIT_DIR, REPO_ROOT, title_for_slug, utc_now, write_json, write_text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--source", choices=["generated-vrm", "attempt", "audit-only"], default="generated-vrm")
    parser.add_argument("--attempt-id", default="attempt-001-baseline")
    args = parser.parse_args()
    snapshot_dir = REPO_ROOT / "model-working" / args.slug / "attempts" / args.attempt_id / "snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": "posepuppet-contact-sheet-manifest-v1",
        "created_at": utc_now(),
        "slug": args.slug,
        "source": args.source,
        "attempt_id": args.attempt_id,
        "contact_sheet_path": str(snapshot_dir / "contact-sheet.png"),
        "contact_sheet_exists": False,
        "committed": False,
        "visual_review": "not_available",
        "requires_future_vision_review": True,
    }
    outdir = AUDIT_DIR / args.slug
    write_json(outdir / "visual-rig-review.json", payload | {"visual_label": "visual_not_available"})
    write_text(outdir / "visual-rig-review.md", f"# {title_for_slug(args.slug)} visual rig review\n\n- Visual label: `visual_not_available`\n- Contact sheet path: `{payload['contact_sheet_path']}`\n- Contact sheet committed: `false`\n")
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
