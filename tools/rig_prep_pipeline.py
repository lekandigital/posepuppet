#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from audit_models import (
    add_woody_source,
    extract_candidate,
    runtime_glb_candidate,
    scan_sources,
    selected_candidate,
    title_for_slug,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_AUDITS_DIR = REPO_ROOT / "model-audits"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def resolve_work_root() -> Path:
    override = os.environ.get("POSEPUPPET_WORK")
    if override:
        return Path(override).expanduser().resolve()
    if Path("/home/o").exists():
        return Path("/home/o/posepuppet-working")
    return (Path.home() / "posepuppet-working").resolve()


def resolve_source_dir() -> Path:
    override = os.environ.get("POSEPUPPET_MODELS")
    candidates = []
    if override:
        candidates.append(Path(override).expanduser())
    candidates.extend([REPO_ROOT / "ModelsForAnimation", REPO_ROOT / "models_for_animation"])
    for path in candidates:
        if path.exists():
            return path.resolve()
    raise FileNotFoundError("Could not find ModelsForAnimation/models_for_animation source directory")


def resolve_woody_dir() -> Path | None:
    override = os.environ.get("POSEPUPPET_WOODY")
    candidates = []
    if override:
        candidates.append(Path(override).expanduser())
    candidates.extend([
        Path("/home/o/posepuppet-assets/woody"),
        Path("/Users/lekan/Downloads/woody"),
    ])
    for path in candidates:
        if path.exists():
            return path.resolve()
    return None


def resolve_blender() -> Path:
    override = os.environ.get("BLENDER_BIN")
    candidates = []
    if override:
        candidates.append(Path(override).expanduser())
    candidates.extend([
        Path("/home/o/.local/bin/blender"),
        Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    ])
    for path in candidates:
        if path.exists():
            return path.resolve()
    raise FileNotFoundError("Could not find Blender executable")


def ensure_dirs() -> dict[str, Path]:
    work_root = resolve_work_root()
    paths = {
        "work_root": work_root,
        "model_working": work_root / "model-working",
        "generated_vrms": work_root / "generated-vrms",
        "logs": work_root / "logs",
    }
    for path in paths.values():
        path.mkdir(parents=True, exist_ok=True)
    return paths


def load_records_for_slug(slug: str) -> dict:
    source_dir = resolve_source_dir()
    groups, _, _, _ = scan_sources(source_dir)
    woody_dir = resolve_woody_dir()
    if woody_dir:
        add_woody_source(groups, [], woody_dir)
    if slug not in groups:
        raise KeyError(f"No source group found for slug {slug}")
    records = groups[slug]
    primary = selected_candidate(records)
    runtime = runtime_glb_candidate(records, primary)
    if primary is None:
        raise RuntimeError(f"No supported source candidate found for slug {slug}")
    dirs = ensure_dirs()
    manual_bone_map = MODEL_AUDITS_DIR / slug / "suggested-bone-map.json"
    return {
        "slug": slug,
        "display_name": title_for_slug(slug),
        "source_dir": source_dir,
        "records": records,
        "primary": primary,
        "runtime": runtime,
        "manual_bone_map": manual_bone_map if manual_bone_map.exists() else None,
        "candidate_vrm_path": dirs["generated_vrms"] / f"{slug}.vrm",
        "working_dir": dirs["model_working"] / slug,
        **dirs,
    }


def materialize_source(record: dict, temp_root: Path | None = None) -> Path:
    root = temp_root or (ensure_dirs()["model_working"] / "extracted")
    return extract_candidate(record, root)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def file_size_mb(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)


def summarize_git_status(lines: list[str]) -> dict:
    staged = []
    modified = []
    untracked = []
    for line in lines:
        if not line:
            continue
        x = line[0]
        y = line[1] if len(line) > 1 else " "
        path = line[3:] if len(line) > 3 else line
        if x != " " and x != "?":
            staged.append(path)
        elif y != " ":
            modified.append(path)
        elif x == "?":
            untracked.append(path)
    return {
        "total_entries": len([line for line in lines if line]),
        "staged_count": len(staged),
        "modified_count": len(modified),
        "untracked_count": len(untracked),
        "staged_examples": staged[:10],
        "modified_examples": modified[:10],
        "untracked_examples": untracked[:10],
    }


def run_command(cmd: list[str], *, cwd: Path | None = None, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd or REPO_ROOT),
        text=True,
        capture_output=True,
        timeout=timeout,
    )


def run_blender_audit(slug: str, outdir: Path, timeout: int = 600) -> dict:
    context = load_records_for_slug(slug)
    temp_root = Path(tempfile.mkdtemp(prefix=f"posepuppet-rig-prep-{slug}-"))
    try:
        materialized = materialize_source(context["primary"], temp_root)
        return run_blender_audit_for_source(
            slug=slug,
            display_name=context["display_name"],
            source_path=materialized,
            source_display_path=context["primary"]["display"],
            source_paths=sorted({record["display"] for record in context["records"]}),
            outdir=outdir,
            timeout=timeout,
            selected_from_zip=context["primary"]["kind"] != "file",
            source_zip=context["primary"].get("source_zip", ""),
            nested_zip=context["primary"].get("nested_zip", ""),
        ) | {"materialized_source_path": str(materialized)}
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


def run_blender_audit_for_source(
    *,
    slug: str,
    display_name: str,
    source_path: Path,
    source_display_path: str,
    source_paths: list[str],
    outdir: Path,
    timeout: int = 600,
    selected_from_zip: bool = False,
    source_zip: str = "",
    nested_zip: str = "",
) -> dict:
    cmd = [
        str(resolve_blender()),
        "-b",
        "--python",
        str(REPO_ROOT / "tools" / "audit_model.py"),
        "--",
        str(source_path),
        str(outdir),
        "--model-name",
        display_name,
        "--slug",
        slug,
        "--source-display-path",
        source_display_path,
        "--source-paths-json",
        json.dumps(source_paths, sort_keys=True),
    ]
    if selected_from_zip:
        cmd.append("--selected-from-zip")
    if source_zip:
        cmd.extend(["--source-zip", source_zip])
    if nested_zip:
        cmd.extend(["--nested-zip", nested_zip])
    result = run_command(cmd, cwd=REPO_ROOT, timeout=timeout)
    log_path = outdir / "blender.log"
    write_text(
        log_path,
        "\n".join(
            [
                "$ " + " ".join(cmd),
                "",
                "STDOUT:",
                result.stdout,
                "",
                "STDERR:",
                result.stderr,
            ]
        ),
    )
    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "log_path": str(log_path),
        "audit_path": str(outdir / "audit.json"),
    }


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def parse_glb_json(path: Path) -> dict:
    with path.open("rb") as handle:
        data = handle.read()
    magic, version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError(f"{path} is not a GLB/VRM file with GLB v2 header")
    json_len, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("First GLB chunk is not JSON")
    json_bytes = data[20 : 20 + json_len]
    return json.loads(json_bytes.decode("utf-8"))
