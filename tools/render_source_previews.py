#!/usr/bin/env python3
"""Best-effort source preview renderer for non-humanoid QA attempts.

Run inside Blender:

  blender -b --python tools/render_source_previews.py -- source.glb outdir --slug rigged-hand
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


def parse_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("outdir")
    parser.add_argument("--slug", default="")
    parser.add_argument("--model-name", default="")
    parser.add_argument("--pose-suite", choices=["none", "hand", "creature"], default="none")
    return parser.parse_args(argv)


def clear_scene(bpy) -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_source(bpy, source: Path) -> None:
    suffix = source.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
        return
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
        return
    if suffix == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=str(source))
        else:
            bpy.ops.import_scene.obj(filepath=str(source))
        return
    raise RuntimeError(f"Unsupported preview source extension: {suffix}")


def mesh_bbox(bpy):
    from mathutils import Vector

    depsgraph = bpy.context.evaluated_depsgraph_get()
    min_v = Vector((math.inf, math.inf, math.inf))
    max_v = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        for corner in evaluated.bound_box:
            world = evaluated.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world.x)
            min_v.y = min(min_v.y, world.y)
            min_v.z = min(min_v.z, world.z)
            max_v.x = max(max_v.x, world.x)
            max_v.y = max(max_v.y, world.y)
            max_v.z = max(max_v.z, world.z)
            found = True
    if not found:
        return Vector((0, 0, 0)), Vector((1, 1, 1)), Vector((1, 1, 1))
    size = max_v - min_v
    return min_v, max_v, size


def look_at(obj, target) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_scene(bpy, min_v, max_v, size):
    from mathutils import Vector

    center = (min_v + max_v) * 0.5
    max_dim = max(size.x, size.y, size.z, 0.1)
    bpy.context.scene.render.resolution_x = 1200
    bpy.context.scene.render.resolution_y = 1200
    bpy.context.scene.render.film_transparent = False
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            bpy.context.scene.render.engine = engine
            break
        except Exception:
            continue
    try:
        bpy.context.scene.eevee.taa_render_samples = 16
    except Exception:
        pass
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = 0
    bpy.context.scene.view_settings.gamma = 1
    bpy.context.scene.world.color = (0.78, 0.8, 0.82)

    light_data = bpy.data.lights.new("preview-key-light", type="AREA")
    light_data.energy = 450
    light_data.size = max_dim * 3
    light = bpy.data.objects.new("preview-key-light", light_data)
    light.location = center + Vector((max_dim * 0.4, -max_dim * 1.0, max_dim * 1.6))
    bpy.context.collection.objects.link(light)

    camera_data = bpy.data.cameras.new("preview-camera")
    camera = bpy.data.objects.new("preview-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.lens = 55
    camera_data.clip_end = max(1000, max_dim * 20)
    return center, max_dim, camera


def render_views(bpy, outdir: Path, center, max_dim, camera) -> list[dict]:
    from mathutils import Vector

    distance = max_dim * 2.8
    views = [
        ("front", Vector((0, -distance, max_dim * 0.25))),
        ("three-quarter", Vector((distance * 0.65, -distance * 0.75, max_dim * 0.35))),
        ("side", Vector((distance, 0, max_dim * 0.25))),
    ]
    outputs = []
    for name, offset in views:
        camera.location = center + offset
        look_at(camera, center)
        path = outdir / f"{name}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append({"view": name, "path": str(path)})
    return outputs


def reset_pose(bpy) -> None:
    for obj in bpy.context.scene.objects:
        if obj.type != "ARMATURE":
            continue
        for pose_bone in obj.pose.bones:
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = (0, 0, 0)
            pose_bone.location = (0, 0, 0)
            pose_bone.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def rotate_bones(bpy, terms: tuple[str, ...], rotation: tuple[float, float, float]) -> list[str]:
    hits: list[str] = []
    lowered_terms = tuple(term.lower() for term in terms)
    for obj in bpy.context.scene.objects:
        if obj.type != "ARMATURE":
            continue
        for pose_bone in obj.pose.bones:
            name = pose_bone.name.lower()
            if any(term in name for term in lowered_terms):
                pose_bone.rotation_mode = "XYZ"
                pose_bone.rotation_euler.rotate_axis("X", rotation[0])
                pose_bone.rotation_euler.rotate_axis("Y", rotation[1])
                pose_bone.rotation_euler.rotate_axis("Z", rotation[2])
                hits.append(pose_bone.name)
    bpy.context.view_layer.update()
    return hits


def render_pose_suite(bpy, outdir: Path, suite: str, center, max_dim, camera) -> list[dict]:
    from mathutils import Vector

    camera.location = center + Vector((max_dim * 1.9, -max_dim * 2.1, max_dim * 0.35))
    look_at(camera, center)
    if suite == "hand":
        poses = [
            ("hand_wrist_pitch", (("hand.r", "pulse.r"), (0.55, 0.0, 0.0))),
            ("hand_finger_curl", (("index_01", "index_02", "middle_01", "middle_02", "ring_01", "ring_02", "pinky_01", "pinky_02"), (0.85, 0.0, 0.0))),
            ("hand_thumb_curl", (("thumb_01", "thumb_02", "thumb_03"), (0.0, 0.0, -0.75))),
            ("hand_finger_spread", (("index_base", "middle_base", "ring_base", "pinky_base"), (0.0, 0.0, 0.25))),
        ]
    elif suite == "creature":
        poses = [
            ("creature_head_turn", (("head", "neck"), (0.0, 0.0, 0.35))),
            ("creature_arm_raise", (("upperarm", "upper_arm", "armja", "bip_upperarm", "upperarm."), (-0.45, 0.0, 0.0))),
            ("creature_tail_sway", (("tail",), (0.0, 0.0, 0.22))),
            ("creature_jaw_open", (("jaw",), (0.4, 0.0, 0.0))),
        ]
    else:
        return []

    outputs = []
    for name, (terms, rotation) in poses:
        reset_pose(bpy)
        hits = rotate_bones(bpy, terms, rotation)
        path = outdir / f"pose-{name}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append({"pose": name, "path": str(path), "matched_bones": hits[:40], "matched_bone_count": len(hits)})
    reset_pose(bpy)
    return outputs


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    source = Path(args.source)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    import bpy

    clear_scene(bpy)
    import_source(bpy, source)
    min_v, max_v, size = mesh_bbox(bpy)
    center, max_dim, camera = setup_scene(bpy, min_v, max_v, size)
    outputs = render_views(bpy, outdir, center, max_dim, camera)
    pose_outputs = render_pose_suite(bpy, outdir, args.pose_suite, center, max_dim, camera)
    manifest = {
        "slug": args.slug or source.stem,
        "model_name": args.model_name or source.stem,
        "source": str(source),
        "bbox": {
            "min": [round(v, 5) for v in min_v],
            "max": [round(v, 5) for v in max_v],
            "size": [round(v, 5) for v in size],
        },
        "renders": outputs,
        "pose_suite": args.pose_suite,
        "pose_renders": pose_outputs,
    }
    (outdir / "preview-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
