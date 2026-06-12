#!/usr/bin/env python3
"""Build a contact sheet from generated avatar visual-review screenshots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def screenshot_rows(review_dir: Path) -> list[tuple[str, Path]]:
    rows: list[tuple[str, Path]] = []
    for name in ["browser-load", "neutral"]:
        path = review_dir / f"{name}.png"
        if path.exists():
            rows.append((name, path))
    pose_dir = review_dir / "pose-suite"
    if pose_dir.exists():
        for path in sorted(pose_dir.glob("pose-*.png")):
            rows.append((path.stem.replace("pose-", ""), path))
    return rows


def make_sheet(review_dir: Path, output: Path, columns: int = 4, thumb_width: int = 360) -> dict:
    rows = screenshot_rows(review_dir)
    if not rows:
        raise SystemExit(f"No screenshots found in {review_dir}")

    label_h = 24
    gap = 12
    bg = (16, 18, 24)
    border = (58, 64, 76)
    text = (224, 228, 235)
    font = ImageFont.load_default()

    thumbs: list[tuple[str, Image.Image]] = []
    thumb_h = 0
    for label, path in rows:
        image = Image.open(path).convert("RGB")
        ratio = thumb_width / image.width
        resized = image.resize((thumb_width, max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
        thumb_h = max(thumb_h, resized.height)
        thumbs.append((label, resized))

    tile_w = thumb_width
    tile_h = thumb_h + label_h
    sheet_rows = (len(thumbs) + columns - 1) // columns
    sheet_w = columns * tile_w + (columns + 1) * gap
    sheet_h = sheet_rows * tile_h + (sheet_rows + 1) * gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), bg)
    draw = ImageDraw.Draw(sheet)

    for index, (label, image) in enumerate(thumbs):
        col = index % columns
        row = index // columns
        x = gap + col * (tile_w + gap)
        y = gap + row * (tile_h + gap)
        draw.rectangle((x - 1, y - 1, x + tile_w, y + thumb_h), outline=border)
        sheet.paste(image, (x, y))
        draw.text((x + 4, y + thumb_h + 6), label, fill=text, font=font)

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    manifest = {
        "schema_version": "posepuppet-contact-sheet-build-v1",
        "review_dir": str(review_dir),
        "output": str(output),
        "screenshot_count": len(rows),
        "columns": columns,
        "thumb_width": thumb_width,
        "labels": [label for label, _path in rows],
    }
    (output.with_suffix(".json")).write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--review-dir", required=True)
    parser.add_argument("--output", default="")
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--thumb-width", type=int, default=360)
    args = parser.parse_args()

    review_dir = Path(args.review_dir).expanduser().resolve()
    output = Path(args.output).expanduser().resolve() if args.output else review_dir / "contact-sheet.png"
    manifest = make_sheet(review_dir, output, columns=args.columns, thumb_width=args.thumb_width)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
