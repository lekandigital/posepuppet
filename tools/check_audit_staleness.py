#!/usr/bin/env python3
"""Check whether model-audits/source-lock.json still matches local sources."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_root(root: Path) -> Path:
    root = root.expanduser().resolve()
    if root.exists():
        return root
    if root.name == "ModelsForAnimation":
        fallback = root.parent / "models_for_animation"
        if fallback.exists():
            return fallback.resolve()
    return root


def read_zip_chain(zip_path: Path, entries: list[str]) -> bytes:
    data = zip_path.read_bytes()
    for entry in entries:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            data = archive.read(entry)
    return data


def hash_display_path(display: str, source_root: Path, source_zip: str = "") -> tuple[str, str]:
    if not display:
        return "missing", ""
    if "!/" in display:
        zip_part, *entries = display.split("!/")
        zip_path = Path(source_zip) if source_zip else Path(zip_part)
        if not zip_path.is_absolute():
            zip_path = source_root / zip_path
        if not zip_path.exists():
            return "missing", ""
        try:
            return "ok", sha256_bytes(read_zip_chain(zip_path, entries))
        except Exception:
            return "missing", ""
    path = Path(display)
    if not path.is_absolute():
        path = source_root / path
    if not path.exists():
        return "missing", ""
    return "ok", sha256_file(path)


def write_report(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "# Audit staleness report",
        "",
        f"Generated: {utc_now()}",
        "",
        "| Model | Status | Selected source | Runtime reference | Notes |",
        "|---|---|---|---|---|",
    ]
    for row in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    row["display_name"],
                    row["status"],
                    f"`{row['selected_source']}`",
                    f"`{row.get('runtime_glb_reference') or 'none'}`",
                    "; ".join(row["notes"]) or "ok",
                ]
            )
            + " |"
        )
    (audit_dir / "audit-staleness-report.md").write_text("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check PosePuppet model audit source-lock freshness.")
    parser.add_argument("source_dir")
    parser.add_argument("audit_dir")
    parser.add_argument("--warn-only", action="store_true")
    args = parser.parse_args(argv)

    source_root = resolve_root(Path(args.source_dir))
    audit_dir = Path(args.audit_dir).expanduser().resolve()
    lock_path = audit_dir / "source-lock.json"
    lock = json.loads(lock_path.read_text())
    stale = False
    rows = []
    for model in lock.get("models", []):
        notes = []
        status = "fresh"
        selected_status, selected_hash = hash_display_path(
            model.get("selected_source", ""),
            source_root,
            model.get("source_zip", ""),
        )
        if selected_status == "missing":
            status = "source_missing"
            stale = True
            notes.append("selected source missing")
        elif selected_hash != model.get("selected_source_sha256"):
            status = "stale"
            stale = True
            notes.append("selected source hash changed")

        runtime_ref = model.get("runtime_glb_reference") or ""
        expected_runtime_hash = model.get("runtime_glb_sha256") or ""
        if runtime_ref and expected_runtime_hash:
            runtime_status, runtime_hash = hash_display_path(runtime_ref, source_root, "")
            if runtime_status == "missing":
                status = "source_missing"
                stale = True
                notes.append("runtime reference missing")
            elif runtime_hash != expected_runtime_hash:
                status = "stale"
                stale = True
                notes.append("runtime reference hash changed")

        model["audit_status"] = status
        rows.append(
            {
                "display_name": model.get("display_name", model.get("slug", "")),
                "status": status,
                "selected_source": model.get("selected_source", ""),
                "runtime_glb_reference": runtime_ref,
                "notes": notes,
            }
        )

    lock["checked_at"] = utc_now()
    lock["source_root_used"] = str(source_root)
    lock_path.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n")
    write_report(audit_dir, rows)

    if stale and not args.warn_only:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
