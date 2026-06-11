"""Blender worker for exporting one avatar source to a candidate VRM."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export one avatar source to candidate VRM.")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mapping-json", default="")
    parser.add_argument("--texture-dir", default="")
    parser.add_argument("--summary-json", default="")
    return parser.parse_args(argv)


def import_source(bpy, source: Path) -> list[str]:
    warnings: list[str] = []
    ext = source.suffix.lower()
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source))
        return warnings

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source), use_image_search=True)
    elif ext in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif ext == ".vrm":
        try:
            bpy.ops.import_scene.vrm(filepath=str(source))
        except Exception as exc:
            warnings.append(f"VRM importer failed; attempting glTF import fallback: {type(exc).__name__}: {exc}")
            bpy.ops.import_scene.gltf(filepath=str(source))
    elif ext == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=str(source))
        else:
            bpy.ops.import_scene.obj(filepath=str(source))
    else:
        raise RuntimeError(f"Unsupported source extension: {ext}")
    return warnings


def load_mapping(path: str) -> dict[str, str]:
    if not path:
        return {}
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "bone_map" in data and isinstance(data["bone_map"], dict):
        data = data["bone_map"]
    return {str(key): str(value) for key, value in data.items() if value and not str(key).startswith("_")}


def pack_images(bpy, texture_dir: str) -> tuple[int, list[str]]:
    warnings: list[str] = []
    if texture_dir and Path(texture_dir).is_dir():
        for image in bpy.data.images:
            if image.source != "FILE":
                continue
            if image.has_data and image.size[0] > 0:
                continue
            basename = os.path.basename(image.filepath) or image.name
            candidate = Path(texture_dir) / basename
            if candidate.exists():
                try:
                    image.filepath = str(candidate)
                    image.reload()
                except Exception as exc:
                    warnings.append(f"Could not reload texture {basename}: {type(exc).__name__}: {exc}")
    packed = 0
    for image in bpy.data.images:
        if image.source == "FILE" and not image.packed_file:
            try:
                image.pack()
                packed += 1
            except Exception as exc:
                warnings.append(f"Could not pack texture {image.name}: {type(exc).__name__}: {exc}")
    return packed, warnings


def main() -> int:
    args = parse_args()
    source = Path(args.source)
    output = Path(args.output)
    summary_path = Path(args.summary_json) if args.summary_json else output.with_suffix(".summary.json")
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "slug": args.slug,
        "source": str(source),
        "output": str(output),
        "status": "failed",
        "errors": [],
        "warnings": [],
        "mapped_bones": {},
        "missing_required_bones": [],
        "armature": "",
        "packed_textures": 0,
    }
    try:
        import bpy  # type: ignore
        from export_fbx_to_vrm import REQUIRED_BONES, auto_map_bones, inject_vrm_extensions

        result["warnings"].extend(import_source(bpy, source))
        armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
        if not armatures:
            raise RuntimeError("No armature found; cannot build VRM humanoid mapping.")
        armature = armatures[0]
        result["armature"] = armature.name
        bone_names = [bone.name for bone in armature.data.bones]
        mapping = auto_map_bones(bone_names)
        manual_mapping = load_mapping(args.mapping_json)
        mapping.update(manual_mapping)
        final_mapping = {vrm_bone: src_bone for vrm_bone, src_bone in mapping.items() if src_bone in bone_names}
        missing = [bone for bone in REQUIRED_BONES if bone not in final_mapping]
        result["mapped_bones"] = final_mapping
        result["missing_required_bones"] = missing
        if missing:
            result["warnings"].append("Missing required VRM bones: " + ", ".join(missing))

        packed, pack_warnings = pack_images(bpy, args.texture_dir)
        result["packed_textures"] = packed
        result["warnings"].extend(pack_warnings)

        tmp_glb = output.with_suffix(output.suffix + ".tmp.glb")
        bpy.ops.export_scene.gltf(
            filepath=str(tmp_glb),
            export_format="GLB",
            export_image_format="AUTO",
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
            export_animations=False,
            export_skins=True,
        )
        if not tmp_glb.exists():
            raise RuntimeError("GLB export did not create a file.")
        vrm_data = inject_vrm_extensions(str(tmp_glb), final_mapping, armature.name)
        output.write_bytes(vrm_data)
        tmp_glb.unlink(missing_ok=True)
        result["status"] = "pass" if not missing else "partial"
        result["output_size_bytes"] = output.stat().st_size
    except Exception as exc:
        result["status"] = "failed"
        result["errors"].append(f"{type(exc).__name__}: {exc}")

    summary_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"summary_path": str(summary_path), "status": result["status"]}, sort_keys=True))
    return 0 if result["status"] in {"pass", "partial"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
