#!/usr/bin/env python3
"""Compose generated-avatar visual evidence into a real contact sheet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from common_avatar_pipeline import AUDIT_DIR, REPO_ROOT, title_for_slug, utc_now, write_json, write_text


def image_paths(visual_dir: Path) -> list[Path]:
    preferred = [visual_dir / "browser-load.png", visual_dir / "neutral.png"]
    poses = sorted(visual_dir.glob("pose-*.png"))
    return [path for path in [*preferred, *poses] if path.exists()]


def label_for(path: Path) -> str:
    if path.name == "browser-load.png":
        return "browser_load"
    if path.name == "neutral.png":
        return "neutral"
    return path.stem.removeprefix("pose-")


def compose_contact_sheet(paths: list[Path], output_path: Path, *, columns: int = 4) -> dict[str, Any]:
    if not paths:
        return {"status": "no_images", "image_count": 0, "output_path": str(output_path)}

    thumb_w = 360
    thumb_h = 300
    label_h = 34
    pad = 14
    rows = (len(paths) + columns - 1) // columns
    sheet_w = columns * thumb_w + (columns + 1) * pad
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (18, 20, 26))
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(paths):
        col = index % columns
        row = index // columns
        x = pad + col * (thumb_w + pad)
        y = pad + row * (thumb_h + label_h + pad)
        with Image.open(path) as image:
            image = image.convert("RGB")
            image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            bx = x + (thumb_w - image.width) // 2
            by = y + (thumb_h - image.height) // 2
            sheet.paste(image, (bx, by))
        draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(72, 80, 96), width=1)
        draw.text((x + 8, y + thumb_h + 8), label_for(path)[:44], fill=(235, 238, 245))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return {
        "status": "pass",
        "image_count": len(paths),
        "output_path": str(output_path),
        "source_images": [str(path) for path in paths],
        "columns": columns,
        "rows": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--source", choices=["generated-vrm", "attempt", "audit-only"], default="generated-vrm")
    parser.add_argument("--attempt-id", default="attempt-001-baseline")
    parser.add_argument("--visual-dir", default="")
    args = parser.parse_args()

    visual_dir = Path(args.visual_dir) if args.visual_dir else REPO_ROOT / "model-working" / args.slug / "visual-review"
    contact_sheet_path = visual_dir / "contact-sheet.png"
    capture_manifest = visual_dir / "capture-results.json"
    capture = json.loads(capture_manifest.read_text()) if capture_manifest.exists() else {}
    result = compose_contact_sheet(image_paths(visual_dir), contact_sheet_path)
    payload = {
        "schema_version": "posepuppet-contact-sheet-manifest-v2",
        "created_at": utc_now(),
        "slug": args.slug,
        "source": args.source,
        "attempt_id": args.attempt_id,
        "visual_dir": str(visual_dir),
        "capture_manifest": str(capture_manifest),
        "capture_status": capture.get("status", "missing"),
        "contact_sheet_path": str(contact_sheet_path),
        "contact_sheet_exists": contact_sheet_path.exists(),
        "committed": False,
        "composer_result": result,
    }
    outdir = AUDIT_DIR / args.slug
    write_json(outdir / "visual-rig-review.json", payload | {"visual_review": "pending_visual_reasoning"})
    write_text(
        outdir / "visual-rig-review.md",
        "\n".join(
            [
                f"# {title_for_slug(args.slug)} visual rig review",
                "",
                "- Visual review: `pending_visual_reasoning`",
                f"- Browser capture status: `{payload['capture_status']}`",
                f"- Contact sheet path: `{payload['contact_sheet_path']}`",
                f"- Contact sheet exists: `{str(payload['contact_sheet_exists']).lower()}`",
                "- Contact sheet committed: `false`",
            ]
        ),
    )
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["contact_sheet_exists"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
