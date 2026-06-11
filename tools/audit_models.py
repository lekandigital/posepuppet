#!/usr/bin/env python3
"""
Batch avatar audit orchestrator.

Scans a model source directory, inspects ZIP and nested ZIP contents without
extracting into the repo, runs tools/audit_model.py through Blender, and writes
LLM-readable audit dossiers under model-audits/.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


SUPPORTED_MODEL_EXTS = {".blend", ".fbx", ".glb", ".gltf", ".vrm", ".obj"}
RUNTIME_EXTS = {".glb", ".gltf", ".vrm"}
ARCHIVE_EXTS = {".zip"}
TEXTURE_EXTS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".tga",
    ".bmp",
    ".tif",
    ".tiff",
    ".exr",
}
SKIP_DIR_PREFIXES = ("model-glb-probe-",)
DEFAULT_BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\s*\(\d+\)\s*$", "", value)
    value = value.replace("v.2", "v2")
    value = value.replace("2.0", "20")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def character_slug_for(pathish: str) -> str:
    text = slugify(Path(pathish).stem)
    raw = text.replace("-", " ")

    checks = [
        ("woody", "woody"),
        ("amazing spider man 2", "amazing-spider-man-2"),
        ("spider man no way home", "spider-man-no-way-home"),
        ("spider man playstation", "spider-man-playstation"),
        ("buzz lightyear", "buzz-lightyear"),
        ("baby yoda", "baby-yoda"),
        ("grogu", "grogu"),
        ("elsa", "elsa"),
        ("fortnite batman", "fortnite-batman"),
        ("batman", "fortnite-batman"),
        ("darth vader", "darth-vader"),
        ("godzilla", "godzilla"),
        ("iron man", "iron-man"),
        ("jack sparrow", "jack-sparrow"),
        ("king kong", "king-kong"),
        ("olaf", "olaf"),
        ("xenomorph", "xenomorph"),
        ("rigged hand", "rigged-hand"),
        ("shrek", "shrek"),
        ("teal", "teal-v2"),
        ("terminator", "terminator-t-800"),
    ]
    for needle, slug in checks:
        if needle in raw:
            return slug

    stop_words = {
        "rig",
        "rigged",
        "advanced",
        "fully",
        "ready",
        "for",
        "animation",
        "animated",
        "low",
        "poly",
        "basic",
        "included",
        "free",
        "fall",
        "model",
        "share",
        "source",
    }
    tokens = [token for token in text.split("-") if token and token not in stop_words]
    return "-".join(tokens) or text


def title_for_slug(slug: str) -> str:
    special = {
        "terminator-t-800": "Terminator T-800",
        "teal-v2": "Teal v2",
        "spider-man-playstation": "Spider-Man PlayStation",
        "spider-man-no-way-home": "Spider-Man No Way Home",
        "amazing-spider-man-2": "The Amazing Spider-Man 2",
    }
    if slug in special:
        return special[slug]
    return " ".join(part.capitalize() for part in slug.split("-"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_skipped_source(path: Path) -> bool:
    return any(part.startswith(SKIP_DIR_PREFIXES) for part in path.parts)


def relative_display(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def base_file_record(path: Path, root: Path) -> dict:
    rel = relative_display(path, root)
    group = character_slug_for(rel)
    stat = path.stat()
    ext = path.suffix.lower()
    record = {
        "kind": "file",
        "path": str(path),
        "rel": rel,
        "display": rel,
        "group": group,
        "ext": ext,
        "size": stat.st_size,
        "sha256": sha256_file(path) if ext in SUPPORTED_MODEL_EXTS | ARCHIVE_EXTS else "",
        "source_zip": "",
        "nested_zip": "",
        "archive_entry": "",
        "nested_chain": [],
    }
    return record


def inspect_zip_bytes(data: bytes, display_prefix: str, source_zip: str, group: str, depth: int, max_depth: int) -> tuple[list[dict], dict]:
    records: list[dict] = []
    report = {
        "zip": display_prefix,
        "source_zip": source_zip,
        "depth": depth,
        "entries": [],
        "model_sources": [],
        "nested_zips": [],
        "texture_count": 0,
        "errors": [],
    }
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = sorted((info for info in archive.infolist() if not info.is_dir()), key=lambda item: item.filename.lower())
            for info in infos:
                name = info.filename
                ext = Path(name).suffix.lower()
                display = f"{display_prefix}!/{name}"
                report["entries"].append({"name": name, "size": info.file_size})
                if ext in TEXTURE_EXTS:
                    report["texture_count"] += 1
                if ext in SUPPORTED_MODEL_EXTS:
                    record = {
                        "kind": "zip-entry" if depth == 0 else "nested-zip-entry",
                        "path": source_zip,
                        "rel": display,
                        "display": display,
                        "group": group,
                        "ext": ext,
                        "size": info.file_size,
                        "sha256": "",
                        "source_zip": source_zip,
                        "nested_zip": display_prefix if depth else "",
                        "archive_entry": name,
                        "nested_chain": [name],
                    }
                    report["model_sources"].append({"display": display, "ext": ext, "size": info.file_size})
                    records.append(record)
                elif ext in ARCHIVE_EXTS:
                    report["nested_zips"].append(display)
                    if depth + 1 <= max_depth:
                        try:
                            nested_data = archive.read(name)
                            nested_records, nested_report = inspect_zip_bytes(
                                nested_data,
                                display,
                                source_zip,
                                group,
                                depth + 1,
                                max_depth,
                            )
                            for nested_record in nested_records:
                                nested_record["nested_chain"] = [name] + nested_record["nested_chain"]
                                nested_record["nested_zip"] = display
                            records.extend(nested_records)
                            report.setdefault("nested_reports", []).append(nested_report)
                        except Exception as exc:
                            report["errors"].append(f"Could not inspect nested ZIP {display}: {type(exc).__name__}: {exc}")
    except Exception as exc:
        report["errors"].append(f"Could not inspect ZIP {display_prefix}: {type(exc).__name__}: {exc}")
    return records, report


def inspect_zip_file(path: Path, root: Path, max_depth: int = 2) -> tuple[list[dict], dict]:
    rel = relative_display(path, root)
    group = character_slug_for(rel)
    data = path.read_bytes()
    records, report = inspect_zip_bytes(data, rel, str(path), group, 0, max_depth)
    report["path"] = str(path)
    report["sha256"] = sha256_file(path)
    return records, report


def scan_sources(source_dir: Path) -> tuple[dict[str, list[dict]], list[dict], list[dict], dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    all_file_records: list[dict] = []
    archive_reports: list[dict] = []
    prior_evidence = {}

    for path in sorted(source_dir.rglob("*"), key=lambda item: str(item).lower()):
        if path.is_dir():
            continue
        if is_skipped_source(path.relative_to(source_dir)):
            if path.name in {"model_glb_probe.json", "model_glb_probe.md", "bone_trees.md"}:
                prior_evidence[path.name] = str(path)
            continue
        ext = path.suffix.lower()
        if ext in SUPPORTED_MODEL_EXTS:
            record = base_file_record(path, source_dir)
            groups[record["group"]].append(record)
            all_file_records.append(record)
        elif ext in ARCHIVE_EXTS:
            record = base_file_record(path, source_dir)
            all_file_records.append(record)
            zip_records, report = inspect_zip_file(path, source_dir)
            archive_reports.append(report)
            groups[record["group"]].append(record)
            for zip_record in zip_records:
                groups[zip_record["group"]].append(zip_record)

    return dict(groups), all_file_records, archive_reports, prior_evidence


def add_woody_source(groups: dict[str, list[dict]], file_records: list[dict], woody_dir: Path) -> None:
    """Add Woody's external folder as a first-class audit source when present."""
    source = woody_dir / "woody-toy-story-rig-free-download" / "source" / "T-Pose (9).fbx"
    reference = woody_dir / "woody_toy_story_rig_free_download.glb"
    archive = woody_dir / "woody-toy-story-rig-free-download.zip"
    records = []
    for path in [source, reference, archive]:
        if not path.exists():
            continue
        stat = path.stat()
        ext = path.suffix.lower()
        record = {
            "kind": "file",
            "path": str(path),
            "rel": str(path),
            "display": str(path),
            "group": "woody",
            "ext": ext,
            "size": stat.st_size,
            "sha256": sha256_file(path) if ext in SUPPORTED_MODEL_EXTS | ARCHIVE_EXTS else "",
            "source_zip": "",
            "nested_zip": "",
            "archive_entry": "",
            "nested_chain": [],
        }
        records.append(record)
        file_records.append(record)
    if records:
        groups.setdefault("woody", [])
        groups["woody"].extend(records)


def candidate_rank(record: dict) -> tuple[int, int, str]:
    ext = record["ext"]
    if ext == ".blend":
        base_rank = 0
    elif ext == ".fbx":
        base_rank = 1
    elif ext in RUNTIME_EXTS and record["kind"] != "file":
        base_rank = 2
    elif ext in RUNTIME_EXTS:
        base_rank = 3
    elif ext == ".obj":
        base_rank = 5
    elif ext == ".zip":
        base_rank = 9
    else:
        base_rank = 8
    return (base_rank, -int(record.get("size", 0)), record["display"].lower())


def selected_candidate(records: list[dict]) -> dict | None:
    model_records = [record for record in records if record["ext"] in SUPPORTED_MODEL_EXTS]
    if not model_records:
        return None
    return sorted(model_records, key=candidate_rank)[0]


def runtime_glb_candidate(records: list[dict], primary: dict | None) -> dict | None:
    runtime_records = [record for record in records if record["ext"] in RUNTIME_EXTS and record["kind"] == "file"]
    if not runtime_records:
        runtime_records = [record for record in records if record["ext"] in RUNTIME_EXTS]
    if not runtime_records:
        return None
    chosen = sorted(runtime_records, key=lambda record: (-int(record.get("size", 0)), record["display"].lower()))[0]
    if primary and chosen["display"] == primary["display"]:
        return None
    return chosen


def extract_candidate(record: dict, temp_root: Path) -> Path:
    if record["kind"] == "file":
        return Path(record["path"])
    temp_root.mkdir(parents=True, exist_ok=True)
    data = Path(record["source_zip"]).read_bytes()
    chain = record.get("nested_chain", [])
    if not chain:
        raise RuntimeError(f"No archive chain for {record['display']}")
    current_data = data
    for index, entry in enumerate(chain):
        with zipfile.ZipFile(io.BytesIO(current_data)) as archive:
            payload = archive.read(entry)
        if index == len(chain) - 1:
            safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(entry).name)
            target = temp_root / record["group"] / safe_name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            return target
        current_data = payload
    raise RuntimeError(f"Could not extract {record['display']}")


def audit_failure_json(name: str, slug: str, display: str, message: str) -> dict:
    return {
        "schema_version": "posepuppet-avatar-audit-v2",
        "created_at": utc_now(),
        "model": {
            "name": name,
            "slug": slug,
            "character_guess": name,
            "source_paths": [display],
            "selected_source_path": display,
            "selected_source_format": Path(display).suffix.lower().lstrip("."),
            "selected_from_zip": "!/" in display,
            "source_zip": "",
            "nested_zip": "",
            "file_size_mb": 0,
            "license_note": "unknown; verify before redistribution",
        },
        "scene": {
            "object_count": 0,
            "mesh_count": 0,
            "armature_count": 0,
            "material_count": 0,
            "texture_count": 0,
            "animation_count": 0,
            "shape_key_count": 0,
        },
        "geometry": {
            "vertex_count": 0,
            "triangle_count": 0,
            "bounding_box": {"min": [0, 0, 0], "max": [0, 0, 0], "size": [0, 0, 0]},
            "estimated_height": 0,
            "mesh_names": [],
            "has_textures": False,
        },
        "rig": {
            "has_armature": False,
            "primary_armature": "",
            "armature_names": [],
            "bone_count": 0,
            "deform_bone_count": 0,
            "control_bone_count": 0,
            "root_bones": [],
            "naming_style_guess": "",
            "rest_pose_guess": "unknown",
            "has_constraints": False,
            "has_ik_constraints": False,
            "has_skinned_meshes": False,
            "skinned_mesh_count": 0,
            "unskinned_mesh_count": 0,
        },
        "humanoid_mapping": {},
        "missing": {},
        "hands": {"finger_support": "missing"},
        "feet": {"foot_support": "missing"},
        "face": {"expression_support": "missing"},
        "skinning": {},
        "animations": {"has_animation": False, "clip_count": 0, "clip_names": []},
        "posepuppet_capabilities": {
            "upper_body": "missing",
            "legs": "missing",
            "feet": "missing",
            "toes": "missing",
            "hands": "missing",
            "fingers": "missing",
            "face_touch": "not_supported",
            "facial_expressions": "missing",
            "recommended_runtime_profile": "reject",
        },
        "scores": {
            "overall": 0,
            "humanoid_mapping": 0,
            "skinning": 0,
            "upper_body": 0,
            "legs": 0,
            "feet": 0,
            "hands": 0,
            "fingers": 0,
            "face_touch": 0,
            "facial_expressions": 0,
            "posepuppet_fit": 0,
            "cleanup_cost": 100,
        },
        "label": "reject",
        "warnings": [message, "License unknown; do not redistribute this model or generated converted files."],
        "recommended_blender_edits": [],
        "recommended_posepuppet_changes": [],
        "recommended_user_action": "Open manually in Blender and rerun the audit.",
        "summary_for_llm": f"Automated audit failed for {name}: {message}",
    }


def write_failure_dossier(outdir: Path, name: str, slug: str, display: str, message: str) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "screenshots").mkdir(exist_ok=True)
    audit = audit_failure_json(name, slug, display, message)
    (outdir / "audit.json").write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n")
    (outdir / "bone-tree.txt").write_text("Audit failed before bone tree could be read.\n")
    (outdir / "warnings.md").write_text("# Warnings\n\n" + "\n".join(f"- {warning}" for warning in audit["warnings"]) + "\n")
    (outdir / "source-files.txt").write_text(f"# Source files for {name}\n\nSelected source: {display}\n")
    (outdir / "model-card.md").write_text(
        f"# Avatar audit: {name}\n\n## Verdict\n\nLabel: reject\nOverall score: 0\n"
        f"Recommended runtime profile: reject\nOne-sentence recommendation: {message}\n\n"
        f"## What to tell another LLM\n\nAutomated audit failed for {name}: {message}\n"
    )


def run_blender_audit(
    blender: Path,
    audit_script: Path,
    record: dict,
    outdir: Path,
    temp_root: Path,
    all_displays: list[str],
    screenshots: bool,
    timeout: int,
) -> tuple[bool, str]:
    name = title_for_slug(record["group"])
    slug = record["group"]
    try:
        source_path = extract_candidate(record, temp_root)
    except Exception as exc:
        message = f"Could not extract source: {type(exc).__name__}: {exc}"
        write_failure_dossier(outdir, name, slug, record["display"], message)
        return False, message

    cmd = [
        str(blender),
        "-b",
        "--python",
        str(audit_script),
        "--",
        str(source_path),
        str(outdir),
        "--model-name",
        name,
        "--slug",
        slug,
        "--source-display-path",
        record["display"],
        "--source-paths-json",
        json.dumps(all_displays, sort_keys=True),
    ]
    if record["kind"] != "file":
        cmd.append("--selected-from-zip")
    if record.get("source_zip"):
        cmd.extend(["--source-zip", record["source_zip"]])
    if record.get("nested_zip"):
        cmd.extend(["--nested-zip", record["nested_zip"]])
    if screenshots:
        cmd.append("--screenshots")

    try:
        result = subprocess.run(cmd, cwd=str(audit_script.parent.parent), text=True, capture_output=True, timeout=timeout)
        log = ["$ " + " ".join(cmd), "", "STDOUT:", result.stdout, "", "STDERR:", result.stderr]
        outdir.mkdir(parents=True, exist_ok=True)
        (outdir / "blender.log").write_text("\n".join(log))
        if result.returncode != 0:
            return False, f"Blender exited {result.returncode}; see {outdir / 'blender.log'}"
        return True, "ok"
    except subprocess.TimeoutExpired as exc:
        message = f"Blender audit timed out after {timeout}s"
        write_failure_dossier(outdir, name, slug, record["display"], message)
        (outdir / "blender.log").write_text((exc.stdout or "") + "\n" + (exc.stderr or ""))
        return False, message
    except Exception as exc:
        message = f"Could not run Blender: {type(exc).__name__}: {exc}"
        write_failure_dossier(outdir, name, slug, record["display"], message)
        return False, message


def load_audit(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def rewrite_source_files(outdir: Path, group: str, records: list[dict], selected: dict | None, runtime: dict | None) -> None:
    lines = [
        f"# Source files for {title_for_slug(group)}",
        "",
        f"Selected source: {selected['display'] if selected else 'none'}",
        f"Runtime GLB companion: {runtime['display'] if runtime else 'none'}",
        "",
        "## All known variants",
        "",
    ]
    for record in sorted(records, key=lambda row: (row["ext"], row["display"].lower())):
        mb = record.get("size", 0) / (1024 * 1024)
        digest = record.get("sha256") or ""
        digest_text = f", sha256={digest[:12]}" if digest else ""
        lines.append(f"- `{record['display']}` ({record['kind']}, {record['ext']}, {mb:.2f} MB{digest_text})")
    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Original binaries, textures, ZIPs, and extracted sources are not copied into this audit folder.",
            "- License remains unknown until manually verified from the original download source.",
        ]
    )
    (outdir / "source-files.txt").write_text("\n".join(lines) + "\n")


def exact_duplicate_groups(file_records: list[dict]) -> list[list[dict]]:
    by_hash: dict[str, list[dict]] = defaultdict(list)
    for record in file_records:
        digest = record.get("sha256")
        if digest:
            by_hash[digest].append(record)
    return [records for records in by_hash.values() if len(records) > 1]


def first_warning(audit: dict) -> str:
    warnings = audit.get("warnings") or []
    return re.sub(r"\s+", " ", warnings[0]).strip() if warnings else ""


def write_index(output_dir: Path, audits: list[dict]) -> None:
    lines = [
        "# PosePuppet model audit index",
        "",
        f"Generated: {utc_now()}",
        "",
        "| Character/model | Selected source | Format | Label | Overall | Humanoid | Upper body | Legs | Hands | Fingers | Feet | Face-touch | Expressions | Runtime profile | Main warning | Model card |",
        "|---|---|---|---:|---:|---:|---|---|---|---|---|---|---|---|---|---|",
    ]
    for audit in sorted(audits, key=lambda item: item["model"]["slug"]):
        model = audit["model"]
        caps = audit["posepuppet_capabilities"]
        scores = audit["scores"]
        card = f"[card]({model['slug']}/model-card.md)"
        lines.append(
            "| "
            + " | ".join(
                [
                    model["name"],
                    f"`{model['selected_source_path']}`",
                    model["selected_source_format"],
                    audit["label"],
                    str(scores["overall"]),
                    str(scores["humanoid_mapping"]),
                    caps["upper_body"],
                    caps["legs"],
                    caps["hands"],
                    caps["fingers"],
                    caps["feet"],
                    caps["face_touch"],
                    caps["facial_expressions"],
                    caps["recommended_runtime_profile"],
                    first_warning(audit).replace("|", "/"),
                    card,
                ]
            )
            + " |"
        )
    (output_dir / "INDEX.md").write_text("\n".join(lines) + "\n")


def recommendation_reason(audit: dict) -> str:
    caps = audit["posepuppet_capabilities"]
    return (
        f"score {audit['scores']['overall']}, upper body {caps['upper_body']}, "
        f"hands {caps['hands']}, fingers {caps['fingers']}, legs {caps['legs']}"
    )


def write_recommendations(output_dir: Path, audits: list[dict], duplicate_sets: list[list[dict]]) -> None:
    categories = {
        "A. Best first candidates for PosePuppet humanoid support": [],
        "B. Good candidates after Blender cleanup": [],
        "C. Hand/finger testing candidates": [],
        "D. Creature/non-humanoid custom-profile candidates": [],
        "E. Bad or static candidates": [],
        "F. Duplicates / ignore for now": [],
    }
    for audit in sorted(audits, key=lambda item: item["scores"]["overall"], reverse=True):
        label = audit["label"]
        caps = audit["posepuppet_capabilities"]
        line = f"- **{audit['model']['name']}**: {recommendation_reason(audit)}. Label: {label}."
        if label == "well-developed" or (caps["recommended_runtime_profile"].startswith("humanoid") and audit["scores"]["overall"] >= 70):
            categories["A. Best first candidates for PosePuppet humanoid support"].append(line)
        elif label in {"partial", "experimental"} and audit["scores"]["overall"] >= 45:
            categories["B. Good candidates after Blender cleanup"].append(line)
        if label == "hand-only" or caps["fingers"] in {"good", "partial"}:
            categories["C. Hand/finger testing candidates"].append(line)
        if "creature" in label or caps["recommended_runtime_profile"] == "creature":
            categories["D. Creature/non-humanoid custom-profile candidates"].append(line)
        if label in {"not well-developed", "static / not rigged", "reject"} or audit["scores"]["overall"] < 45:
            categories["E. Bad or static candidates"].append(line)

    for records in duplicate_sets:
        names = ", ".join(f"`{record['display']}`" for record in records)
        categories["F. Duplicates / ignore for now"].append(f"- Exact duplicate binary set: {names}")

    lines = ["# Recommendations", ""]
    for heading, items in categories.items():
        lines.extend([f"## {heading}", ""])
        if items:
            lines.extend(items)
        else:
            lines.append("- None identified.")
        lines.append("")
    (output_dir / "recommendations.md").write_text("\n".join(lines))


def write_dedupe_report(output_dir: Path, groups: dict[str, list[dict]], duplicate_sets: list[list[dict]]) -> None:
    lines = ["# Dedupe report", ""]
    lines.append("## Exact duplicate binaries")
    lines.append("")
    if duplicate_sets:
        for records in duplicate_sets:
            digest = records[0].get("sha256", "")
            lines.append(f"- `{digest}`")
            for record in records:
                lines.append(f"  - `{record['display']}` ({record['size']} bytes)")
    else:
        lines.append("- No exact duplicate hashes found among top-level model/archive files.")
    lines.extend(["", "## Likely repeated downloads by character group", ""])
    for group, records in sorted(groups.items()):
        repeated = [record for record in records if re.search(r"\(\d+\)", record["display"]) or len(records) > 1]
        if repeated:
            lines.append(f"### {title_for_slug(group)}")
            for record in sorted(records, key=lambda row: row["display"].lower()):
                mb = record.get("size", 0) / (1024 * 1024)
                lines.append(f"- `{record['display']}` ({record['kind']}, {record['ext']}, {mb:.2f} MB)")
            lines.append("")
    (output_dir / "dedupe-report.md").write_text("\n".join(lines))


def flatten_archive_reports(report: dict) -> list[dict]:
    reports = [report]
    for nested in report.get("nested_reports", []):
        reports.extend(flatten_archive_reports(nested))
    return reports


def write_source_archive_report(output_dir: Path, archive_reports: list[dict]) -> None:
    lines = ["# Source archive report", ""]
    if not archive_reports:
        lines.append("- No ZIP archives found.")
    for report in sorted(archive_reports, key=lambda item: item["zip"].lower()):
        for item in flatten_archive_reports(report):
            lines.append(f"## `{item['zip']}`")
            lines.append("")
            lines.append(f"- Entries: {len(item.get('entries', []))}")
            lines.append(f"- Texture files: {item.get('texture_count', 0)}")
            if item.get("model_sources"):
                lines.append("- Model/source files:")
                for source in item["model_sources"]:
                    lines.append(f"  - `{source['display']}` ({source['ext']}, {source['size']} bytes)")
            else:
                lines.append("- Model/source files: none detected")
            if item.get("nested_zips"):
                lines.append("- Nested ZIPs:")
                for nested in item["nested_zips"]:
                    lines.append(f"  - `{nested}`")
            if item.get("errors"):
                lines.append("- Errors:")
                for error in item["errors"]:
                    lines.append(f"  - {error}")
            lines.append("")
    (output_dir / "source-archive-report.md").write_text("\n".join(lines))


def write_summary(output_dir: Path, audits: list[dict], failures: list[dict], groups: dict[str, list[dict]], archive_reports: list[dict], prior_evidence: dict) -> None:
    summary = {
        "schema_version": "posepuppet-avatar-audit-summary-v1",
        "created_at": utc_now(),
        "model_count": len(audits),
        "failure_count": len(failures),
        "groups": sorted(groups.keys()),
        "failures": failures,
        "prior_evidence": prior_evidence,
        "archives": [
            {
                "zip": report["zip"],
                "model_source_count": len(report.get("model_sources", [])),
                "nested_zip_count": len(report.get("nested_zips", [])),
                "texture_count": report.get("texture_count", 0),
                "errors": report.get("errors", []),
            }
            for report in archive_reports
        ],
        "audits": [
            {
                "name": audit["model"]["name"],
                "slug": audit["model"]["slug"],
                "label": audit["label"],
                "overall": audit["scores"]["overall"],
                "profile": audit["posepuppet_capabilities"]["recommended_runtime_profile"],
                "selected_source": audit["model"]["selected_source_path"],
            }
            for audit in sorted(audits, key=lambda item: item["model"]["slug"])
        ],
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")


def write_failure_report(output_dir: Path, failures: list[dict]) -> None:
    lines = ["# Audit failures", ""]
    if not failures:
        lines.append("- No audit failures.")
    else:
        for failure in failures:
            lines.append(f"- **{failure['group']}**: {failure['message']}")
    (output_dir / "audit-failures.md").write_text("\n".join(lines) + "\n")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run PosePuppet model audits for a source directory.")
    parser.add_argument("source_dir", help="Directory containing downloaded model files.")
    parser.add_argument("output_dir", help="Directory where audit dossiers should be written.")
    parser.add_argument("--blender", default=DEFAULT_BLENDER, help="Path to Blender executable.")
    parser.add_argument("--keep-temp", action="store_true", help="Keep temporary extracted ZIP sources.")
    parser.add_argument("--screenshots", action="store_true", help="Ask the single-model audit to render best-effort screenshots.")
    parser.add_argument("--timeout", type=int, default=240, help="Per-model Blender timeout in seconds.")
    parser.add_argument("--limit", type=int, default=0, help="Audit only the first N groups after scanning.")
    parser.add_argument(
        "--woody-dir",
        default="/Users/lekan/Downloads/woody",
        help="Optional external Woody source folder to include as a first-class model.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    source_dir = Path(args.source_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    blender = Path(args.blender)
    audit_script = Path(__file__).resolve().parent / "audit_model.py"

    if not source_dir.exists() and source_dir.name == "ModelsForAnimation":
        fallback = source_dir.parent / "models_for_animation"
        if fallback.exists():
            source_dir = fallback.resolve()
    if not source_dir.exists():
        print(f"Source directory does not exist: {source_dir}", file=sys.stderr)
        return 2
    if not blender.exists():
        print(f"Blender does not exist: {blender}", file=sys.stderr)
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    groups, file_records, archive_reports, prior_evidence = scan_sources(source_dir)
    woody_dir = Path(args.woody_dir).expanduser()
    if woody_dir.exists():
        add_woody_source(groups, file_records, woody_dir)
    duplicate_sets = exact_duplicate_groups(file_records)
    temp_root_path = Path(tempfile.mkdtemp(prefix="posepuppet-model-audit-"))
    failures: list[dict] = []
    audits: list[dict] = []

    try:
        group_items = sorted(groups.items())
        if args.limit:
            group_items = group_items[: args.limit]
        for index, (group, records) in enumerate(group_items, start=1):
            primary = selected_candidate(records)
            runtime = runtime_glb_candidate(records, primary)
            group_outdir = output_dir / group
            all_displays = sorted({record["display"] for record in records})
            print(f"[{index}/{len(group_items)}] auditing {group} -> {primary['display'] if primary else 'no supported source'}")
            if not primary:
                message = "No supported model source was found for this group."
                write_failure_dossier(group_outdir, title_for_slug(group), group, "none", message)
                failures.append({"group": group, "message": message})
                rewrite_source_files(group_outdir, group, records, primary, runtime)
                continue

            ok, message = run_blender_audit(
                blender,
                audit_script,
                primary,
                group_outdir,
                temp_root_path,
                all_displays,
                args.screenshots,
                args.timeout,
            )
            if not ok:
                failures.append({"group": group, "message": message})

            if runtime:
                runtime_outdir = group_outdir / "runtime-glb"
                ok_runtime, runtime_message = run_blender_audit(
                    blender,
                    audit_script,
                    runtime,
                    runtime_outdir,
                    temp_root_path,
                    all_displays,
                    False,
                    args.timeout,
                )
                if not ok_runtime:
                    failures.append({"group": group, "message": f"Runtime GLB companion failed: {runtime_message}"})

            rewrite_source_files(group_outdir, group, records, primary, runtime)
            audit = load_audit(group_outdir / "audit.json")
            if audit:
                audits.append(audit)

        write_index(output_dir, audits)
        write_recommendations(output_dir, audits, duplicate_sets)
        write_dedupe_report(output_dir, groups, duplicate_sets)
        write_source_archive_report(output_dir, archive_reports)
        write_summary(output_dir, audits, failures, groups, archive_reports, prior_evidence)
        write_failure_report(output_dir, failures)
    finally:
        if args.keep_temp:
            print(f"Kept temp extraction directory: {temp_root_path}")
        else:
            shutil.rmtree(temp_root_path, ignore_errors=True)

    print(f"Wrote audits to {output_dir}")
    if failures:
        print(f"Completed with {len(failures)} failure(s). See {output_dir / 'audit-failures.md'}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
