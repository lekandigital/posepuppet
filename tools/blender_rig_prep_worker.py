"""Blender worker for inspecting and safely saving avatar rig-prep copies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Inspect one avatar source inside Blender.")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--mode", choices=["inspect", "cleanup", "all"], default="inspect")
    parser.add_argument("--texture-dir", default="")
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


def object_bounds(obj):
    try:
        corners = [obj.matrix_world @ corner for corner in obj.bound_box]
    except Exception:
        return None
    return {
        "min": [min(corner[index] for corner in corners) for index in range(3)],
        "max": [max(corner[index] for corner in corners) for index in range(3)],
    }


def inspect_scene(bpy) -> dict:
    meshes = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        data = obj.data
        shape_keys = []
        if getattr(data, "shape_keys", None) and data.shape_keys.key_blocks:
            shape_keys = [key.name for key in data.shape_keys.key_blocks]
        meshes.append(
            {
                "name": obj.name,
                "vertices": len(data.vertices),
                "polygons": len(data.polygons),
                "materials": [slot.material.name for slot in obj.material_slots if slot.material],
                "shape_keys": shape_keys,
                "bounds": object_bounds(obj),
                "modifiers": [modifier.type for modifier in obj.modifiers],
            }
        )

    armatures = []
    for obj in bpy.data.objects:
        if obj.type != "ARMATURE":
            continue
        pose_constraints = 0
        if obj.pose:
            for pose_bone in obj.pose.bones:
                pose_constraints += len(pose_bone.constraints)
        armatures.append(
            {
                "name": obj.name,
                "bone_count": len(obj.data.bones),
                "bones": [
                    {
                        "name": bone.name,
                        "parent": bone.parent.name if bone.parent else "",
                        "children": [child.name for child in bone.children],
                    }
                    for bone in obj.data.bones
                ],
                "object_constraints": [constraint.type for constraint in obj.constraints],
                "pose_constraint_count": pose_constraints,
            }
        )

    materials = []
    for material in bpy.data.materials:
        material_images = []
        if material.node_tree:
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and getattr(node, "image", None):
                    material_images.append(node.image.name)
        materials.append({"name": material.name, "images": material_images, "use_nodes": material.use_nodes})

    images = []
    for image in bpy.data.images:
        images.append(
            {
                "name": image.name,
                "filepath": image.filepath,
                "packed": bool(image.packed_file),
                "size": list(image.size),
                "source": image.source,
            }
        )

    scene_bounds = None
    mesh_bounds = [mesh["bounds"] for mesh in meshes if mesh.get("bounds")]
    if mesh_bounds:
        scene_bounds = {
            "min": [min(bounds["min"][index] for bounds in mesh_bounds) for index in range(3)],
            "max": [max(bounds["max"][index] for bounds in mesh_bounds) for index in range(3)],
        }

    return {
        "object_count": len(bpy.data.objects),
        "mesh_count": len(meshes),
        "armature_count": len(armatures),
        "material_count": len(materials),
        "image_count": len(images),
        "meshes": meshes,
        "armatures": armatures,
        "materials": materials,
        "images": images,
        "scene_bounds": scene_bounds,
    }


def save_clean_blend(bpy, slug: str, outdir: Path) -> dict:
    clean_dir = outdir / "clean"
    clean_dir.mkdir(parents=True, exist_ok=True)
    clean_path = clean_dir / f"{slug}.clean.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(clean_path))
    return {
        "path": str(clean_path),
        "exists": clean_path.exists(),
        "size_bytes": clean_path.stat().st_size if clean_path.exists() else 0,
        "actions": [
            "Loaded source into Blender.",
            "Saved a repo-external working .blend copy.",
            "No source asset was overwritten.",
            "No geometry, bone, material, or texture deletion was performed.",
        ],
    }


def main() -> int:
    args = parse_args()
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    source = Path(args.source)
    result = {
        "slug": args.slug,
        "source": str(source),
        "mode": args.mode,
        "status": "failed",
        "errors": [],
        "warnings": [],
        "cleanup": {"attempted": False},
    }
    try:
        import bpy  # type: ignore

        result["warnings"].extend(import_source(bpy, source))
        result["scene"] = inspect_scene(bpy)
        if args.mode in {"cleanup", "all"}:
            result["cleanup"] = {"attempted": True, **save_clean_blend(bpy, args.slug, outdir)}
        scene = result["scene"]
        if scene["armature_count"] and scene["mesh_count"]:
            result["status"] = "pass"
        elif scene["mesh_count"]:
            result["status"] = "partial"
            result["warnings"].append("Meshes were found, but no armature was found.")
        else:
            result["status"] = "failed"
            result["errors"].append("No mesh objects were found after import.")
    except Exception as exc:
        result["status"] = "failed"
        result["errors"].append(f"{type(exc).__name__}: {exc}")

    result_path = outdir / "blender-rig-prep-result.json"
    result_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"result_path": str(result_path), "status": result["status"]}, sort_keys=True))
    return 0 if result["status"] in {"pass", "partial"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
