#!/usr/bin/env python3
"""Shared utilities for the PosePuppet avatar rig-prep and VRM pipeline."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODELS_DIR = Path("/home/o/posepuppet-assets/ModelsForAnimation")
DEFAULT_WOODY_DIR = Path("/home/o/posepuppet-assets/woody")
DEFAULT_WORK_DIR = Path("/home/o/posepuppet-working")
DEFAULT_GENERATED_VRM_DIR = Path("/home/o/posepuppet-working/generated-vrms")

AUDIT_DIR = REPO_ROOT / "model-audits"
RIG_PREP_DIR = AUDIT_DIR / "rig-prep"
WOODY_SOURCE_FBX = DEFAULT_WOODY_DIR / "woody-toy-story-rig-free-download/source/T-Pose (9).fbx"
WOODY_TEXTURE_DIR = DEFAULT_WOODY_DIR / "woody-toy-story-rig-free-download/textures"
WOODY_REFERENCE_GLB = DEFAULT_WOODY_DIR / "woody_toy_story_rig_free_download.glb"

DEFAULT_FIRST_PASS_SLUGS = ["woody", "darth-vader", "fortnite-batman", "iron-man", "shrek"]
SUPPORTED_SOURCE_EXTS = {".blend", ".fbx", ".glb", ".gltf", ".vrm", ".obj"}
ARCHIVE_EXTS = {".zip"}
REQUIRED_VRM_BONES = [
    "hips",
    "spine",
    "chest",
    "neck",
    "head",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    value = value.lower()
    value = value.replace("v.2", "v2").replace("2.0", "20")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def title_for_slug(slug: str) -> str:
    special = {
        "amazing-spider-man-2": "The Amazing Spider-Man 2",
        "spider-man-no-way-home": "Spider-Man No Way Home",
        "spider-man-playstation": "Spider-Man PlayStation",
        "terminator-t-800": "Terminator T-800",
        "teal-v2": "Teal v2",
    }
    return special.get(slug, " ".join(part.capitalize() for part in slug.split("-")))


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as exc:
        return {"_json_error": f"{type(exc).__name__}: {exc}", "_path": str(path)}


def write_json(path: Path, data: Any) -> Path:
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
    return path


def write_text(path: Path, text: str) -> Path:
    ensure_dir(path.parent)
    path.write_text(text.rstrip() + "\n")
    return path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def path_is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def run_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    log_dir: Path | None = None,
    log_prefix: str = "command",
    timeout: int | None = None,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    started_at = utc_now()
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    result: dict[str, Any] = {
        "command": command,
        "cwd": str(cwd or REPO_ROOT),
        "started_at": started_at,
        "returncode": None,
        "stdout": "",
        "stderr": "",
        "stdout_log": "",
        "stderr_log": "",
        "error": "",
    }
    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd or REPO_ROOT),
            env=merged_env,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        result["returncode"] = completed.returncode
        result["stdout"] = completed.stdout
        result["stderr"] = completed.stderr
    except Exception as exc:
        result["returncode"] = 127
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["stderr"] = result["error"]
    result["finished_at"] = utc_now()

    if log_dir:
        ensure_dir(log_dir)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        stdout_path = log_dir / f"{stamp}-{log_prefix}.stdout.log"
        stderr_path = log_dir / f"{stamp}-{log_prefix}.stderr.log"
        stdout_path.write_text(result["stdout"])
        stderr_path.write_text(result["stderr"])
        result["stdout_log"] = str(stdout_path)
        result["stderr_log"] = str(stderr_path)
    return result


def discover_blender(explicit: str | None = None) -> dict[str, Any]:
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit)
    if os.environ.get("BLENDER"):
        candidates.append(os.environ["BLENDER"])
    if os.environ.get("BLENDER_BIN"):
        candidates.append(os.environ["BLENDER_BIN"])
    which = shutil.which("blender")
    if which:
        candidates.append(which)
    candidates.extend(
        [
            str(Path.home() / ".local/bin/blender"),
            "/home/o/posepuppet-tools/blender/blender",
            "/usr/bin/blender",
            "/snap/bin/blender",
        ]
    )
    seen: set[str] = set()
    checked = []
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        path = Path(candidate).expanduser()
        checked.append(str(path))
        if path.exists() and os.access(path, os.X_OK):
            return {"path": str(path), "checked": checked, "status": "found", "errors": []}
    return {"path": "", "checked": checked, "status": "missing", "errors": ["Blender binary not found"]}


def model_audit_dir(slug: str) -> Path:
    return AUDIT_DIR / slug


def model_work_dir(slug: str) -> Path:
    return DEFAULT_WORK_DIR / "model-working" / slug


def generated_vrm_path(slug: str) -> Path:
    return DEFAULT_GENERATED_VRM_DIR / f"{slug}.vrm"


def cleaned_source_path(slug: str) -> Path:
    return model_work_dir(slug) / "clean" / f"{slug}.clean.blend"


def load_adapter_spec(slug: str) -> dict[str, Any]:
    per_model = read_json(model_audit_dir(slug) / "avatar-adapter-spec.json", {})
    if isinstance(per_model, dict) and per_model and "_json_error" not in per_model:
        return per_model
    aggregate = read_json(AUDIT_DIR / "avatar-adapter-specs.json", {})
    for row in aggregate.get("models", []) if isinstance(aggregate, dict) else []:
        if row.get("avatar_id") == slug:
            return row
    return {"avatar_id": slug, "display_name": title_for_slug(slug)}


def load_adapter_spec_rows() -> list[dict[str, Any]]:
    aggregate = read_json(AUDIT_DIR / "avatar-adapter-specs.json", {})
    rows = aggregate.get("models", []) if isinstance(aggregate, dict) else []
    if rows:
        return rows
    rows = []
    for path in sorted(AUDIT_DIR.glob("*/avatar-adapter-spec.json")):
        data = read_json(path, {})
        if isinstance(data, dict):
            rows.append(data)
    return rows


def group_for_spec(spec: dict[str, Any]) -> str:
    profile = spec.get("profile") or spec.get("runtime_profile") or ""
    if profile == "hand_only" or spec.get("action") == "hand_test_only":
        return "hand_only"
    if profile == "creature" or spec.get("action") == "custom_profile":
        return "creature"
    if str(profile).startswith("humanoid") or spec.get("action") in {"convert_to_vrm", "cleanup_then_convert"}:
        return "humanoid"
    return "other"


def linuxize_source_spec(slug: str, source_spec: str) -> str:
    if slug == "woody":
        return str(WOODY_SOURCE_FBX)
    if not source_spec:
        return ""
    replacements = {
        "/Users/lekan/Downloads/woody": str(DEFAULT_WOODY_DIR),
        "/Users/lekan/Dev/posepuppet/models_for_animation": str(DEFAULT_MODELS_DIR),
        "/Users/lekan/Dev/posepuppet/ModelsForAnimation": str(DEFAULT_MODELS_DIR),
        "models_for_animation": str(DEFAULT_MODELS_DIR),
        "ModelsForAnimation": str(DEFAULT_MODELS_DIR),
    }
    out = source_spec
    for old, new in replacements.items():
        if out.startswith(old):
            out = new + out[len(old) :]
            break
    return out


def selected_source_spec(slug: str, spec: dict[str, Any] | None = None) -> str:
    spec = spec or load_adapter_spec(slug)
    if slug == "woody":
        return str(WOODY_SOURCE_FBX)
    for key in ("source_to_convert", "selected_source", "best_conversion_source"):
        value = spec.get(key)
        if value:
            return linuxize_source_spec(slug, str(value))
    conversion = spec.get("conversion") if isinstance(spec.get("conversion"), dict) else {}
    if conversion.get("source"):
        return linuxize_source_spec(slug, str(conversion["source"]))
    return ""


def _find_zip_entry(archive: zipfile.ZipFile, requested: str) -> str | None:
    names = [info.filename for info in archive.infolist() if not info.is_dir()]
    if requested in names:
        return requested
    requested_norm = requested.lower().lstrip("/")
    for name in names:
        if name.lower().lstrip("/") == requested_norm:
            return name
    requested_base = Path(requested).name.lower()
    matches = [name for name in names if Path(name).name.lower() == requested_base]
    if len(matches) == 1:
        return matches[0]
    return None


def resolve_archive_source(source_spec: str, slug: str, *, allow_extract: bool) -> dict[str, Any]:
    parts = source_spec.split("!/")
    base_spec = linuxize_source_spec(slug, parts[0])
    base_path = Path(base_spec)
    if not base_path.is_absolute():
        base_path = DEFAULT_MODELS_DIR / base_path
    result = {
        "source_spec": source_spec,
        "source_path": "",
        "source_exists": base_path.exists(),
        "source_kind": "archive-entry",
        "resolved": False,
        "extracted": False,
        "archive_path": str(base_path),
        "archive_entries": parts[1:],
        "errors": [],
        "warnings": [],
    }
    if not base_path.exists():
        result["errors"].append(f"Archive does not exist: {base_path}")
        return result
    if not allow_extract:
        result["resolved"] = True
        result["source_path"] = source_spec
        result["warnings"].append("Archive source was resolved for planning only; extraction was not requested.")
        return result

    extract_dir = ensure_dir(model_work_dir(slug) / "extracted-source")
    current_zip = base_path
    try:
        for index, entry in enumerate(parts[1:], start=1):
            with zipfile.ZipFile(current_zip) as archive:
                actual_entry = _find_zip_entry(archive, entry)
                if actual_entry is None:
                    result["errors"].append(f"Archive entry not found: {entry} in {current_zip}")
                    return result
                out_name = f"{index:02d}-{slug}-{Path(actual_entry).name}"
                out_path = extract_dir / out_name
                with archive.open(actual_entry) as src, out_path.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
            if index < len(parts[1:]):
                current_zip = out_path
            else:
                result.update(
                    {
                        "source_path": str(out_path),
                        "source_exists": out_path.exists(),
                        "resolved": out_path.exists(),
                        "extracted": True,
                    }
                )
    except Exception as exc:
        result["errors"].append(f"{type(exc).__name__}: {exc}")
    return result


def resolve_model_source(slug: str, *, allow_extract: bool = False, prefer_clean: bool = False) -> dict[str, Any]:
    spec = load_adapter_spec(slug)
    source_spec = selected_source_spec(slug, spec)
    if prefer_clean and cleaned_source_path(slug).exists():
        path = cleaned_source_path(slug)
        return {
            "source_spec": str(path),
            "source_path": str(path),
            "source_exists": True,
            "source_kind": "cleaned-blend",
            "resolved": True,
            "extracted": False,
            "errors": [],
            "warnings": [],
        }
    if not source_spec:
        return {
            "source_spec": "",
            "source_path": "",
            "source_exists": False,
            "source_kind": "missing",
            "resolved": False,
            "extracted": False,
            "errors": ["No source_to_convert found in adapter spec"],
            "warnings": [],
        }
    source_spec = linuxize_source_spec(slug, source_spec)
    if "!/" in source_spec:
        return resolve_archive_source(source_spec, slug, allow_extract=allow_extract)
    path = Path(source_spec).expanduser()
    if not path.is_absolute():
        candidates = [DEFAULT_MODELS_DIR / path, REPO_ROOT / path]
        path = next((candidate for candidate in candidates if candidate.exists()), candidates[0])
    ext = path.suffix.lower()
    return {
        "source_spec": source_spec,
        "source_path": str(path),
        "source_exists": path.exists(),
        "source_kind": "file" if ext in SUPPORTED_SOURCE_EXTS else "unknown",
        "resolved": path.exists() and ext in SUPPORTED_SOURCE_EXTS,
        "extracted": False,
        "errors": [] if path.exists() else [f"Source file does not exist: {path}"],
        "warnings": [] if ext in SUPPORTED_SOURCE_EXTS else [f"Source extension may not be supported: {ext}"],
    }


def safe_vrm_output_path(slug: str, output: str | None) -> dict[str, Any]:
    path = Path(output).expanduser() if output else generated_vrm_path(slug)
    if not path.is_absolute():
        path = REPO_ROOT / path
    public_avatars = REPO_ROOT / "public" / "avatars"
    generated_repo_dir = public_avatars / "generated"
    forbidden = path_is_relative_to(path, public_avatars) and not path_is_relative_to(path, generated_repo_dir)
    return {
        "path": str(path),
        "allowed": not forbidden,
        "errors": [] if not forbidden else [f"Refusing to write runtime avatar path: {path}"],
    }


def extract_vrm_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        return {"errors": ["File is too small to be a GLB/VRM"]}
    magic = int.from_bytes(data[0:4], "little")
    if magic != 0x46546C67:
        return {"errors": ["File does not have a GLB header"]}
    json_length = int.from_bytes(data[12:16], "little")
    json_type = int.from_bytes(data[16:20], "little")
    if json_type != 0x4E4F534A:
        return {"errors": ["First GLB chunk is not JSON"]}
    raw = data[20 : 20 + json_length].decode("utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        return {"errors": [f"Could not parse VRM JSON chunk: {exc}"]}


def vrm_human_bones(path: Path) -> dict[str, Any]:
    gltf = extract_vrm_json(path)
    if "errors" in gltf:
        return {"human_bones": {}, "errors": gltf["errors"], "extensions_used": []}
    ext = gltf.get("extensions", {}).get("VRMC_vrm", {})
    human_bones = ext.get("humanoid", {}).get("humanBones", {})
    return {
        "human_bones": human_bones if isinstance(human_bones, dict) else {},
        "extensions_used": gltf.get("extensionsUsed", []),
        "errors": [] if ext else ["VRMC_vrm extension not found"],
    }


def markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(cell).replace("\n", " ") for cell in row) + " |")
    return "\n".join(lines)


def report_header(title: str, status: str | None = None) -> str:
    lines = [f"# {title}", "", f"- Updated: {utc_now()}"]
    if status:
        lines.append(f"- Status: {status}")
    return "\n".join(lines) + "\n"


def short_log_tail(value: str, limit: int = 4000) -> str:
    if len(value) <= limit:
        return value
    return value[-limit:]
