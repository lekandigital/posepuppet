#!/usr/bin/env python3
"""Compose source-preview screenshots into compact contact sheets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def load_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def compose(slug: str, preview_dir: Path) -> Path:
    screenshot_dir = preview_dir / "screenshots"
    frames = [screenshot_dir / f"{name}.png" for name in ("front", "three-quarter", "side")]
    frames.extend(sorted(screenshot_dir.glob("pose-*.png")))
    missing = [path for path in frames if not path.exists()]
    if missing:
        raise FileNotFoundError(f"{slug}: missing screenshots: {', '.join(str(path) for path in missing)}")

    font = load_font(24)
    label_font = load_font(18)
    thumb_w = 360
    thumb_h = 360
    label_h = 34
    margin = 20
    header_h = 44
    columns = 3
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (margin * 2 + thumb_w * columns, margin * 2 + header_h + rows * (thumb_h + label_h)),
        (245, 247, 250),
    )
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, margin), f"{slug} source-preview", fill=(20, 24, 32), font=font)

    for idx, path in enumerate(frames):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col = idx % columns
        row = idx // columns
        cell_y = margin + header_h + row * (thumb_h + label_h)
        x = margin + col * thumb_w + (thumb_w - image.width) // 2
        y = cell_y + (thumb_h - image.height) // 2
        sheet.paste(image, (x, y))
        draw.text((margin + col * thumb_w + 10, cell_y + thumb_h + 6), path.stem, fill=(50, 56, 66), font=label_font)

    out = preview_dir / "contact-sheet.png"
    sheet.save(out)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("slugs", nargs="+")
    parser.add_argument("--root", default="model-working")
    args = parser.parse_args()

    root = Path(args.root)
    for slug in args.slugs:
        out = compose(slug, root / slug / "source-preview")
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
