#!/usr/bin/env python3
"""
Deep avatar audit for one source file.

This script is intended to run inside Blender:

  /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/audit_model.py -- source outdir

The bone-name normalizer and self-test also run under normal Python:

  python3 tools/audit_model.py --self-test
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


SCHEMA_VERSION = "posepuppet-avatar-audit-v2"

HUMANOID_KEYS = [
    "hips",
    "spine",
    "chest",
    "upperChest",
    "neck",
    "head",
    "leftShoulder",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightShoulder",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
    "leftUpperLeg",
    "leftLowerLeg",
    "leftFoot",
    "leftToes",
    "rightUpperLeg",
    "rightLowerLeg",
    "rightFoot",
    "rightToes",
    "leftEye",
    "rightEye",
    "jaw",
]

CONTROL_WORDS = {
    "ctrl",
    "control",
    "ik",
    "fk",
    "pole",
    "target",
    "helper",
    "track",
    "snap",
    "aim",
    "handle",
    "offset",
    "switch",
}

PREFIX_WORDS = {
    "mixamorig",
    "valvebiped",
    "bip01",
    "bip",
    "j",
    "def",
    "mch",
    "org",
    "jnt",
    "joint",
    "bone",
    "armature",
    "root",
    "rootjoint",
    "character",
    "char",
    "rig",
}

FINGER_WORDS = {
    "thumb": ("thumb", "thump", "finger0", "digit0"),
    "index": ("index", "pointer", "finger1", "digit1"),
    "middle": ("middle", "finger2", "digit2"),
    "ring": ("ring", "finger3", "digit3"),
    "pinky": ("pinky", "pinkie", "little", "finger4", "digit4"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def camel_to_words(value: str) -> str:
    value = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", value)
    value = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", value)
    return value


def strip_generated_suffixes(value: str) -> str:
    out = value
    out = re.sub(r"\.\d{3,}$", "", out)
    out = re.sub(r"(?i)(?:[_\-. ]armature)$", "", out)
    out = re.sub(r"(?i)(?:[_\-. ]rootjoint)$", "", out)
    previous = None
    while previous != out:
        previous = out
        out = re.sub(r"(?:[_\-. ]\d{1,5})$", "", out)
    return out


def compact_tokens(tokens: list[str]) -> set[str]:
    compact = set(tokens)
    joined = "".join(tokens)
    compact.add(joined)
    for idx in range(len(tokens) - 1):
        compact.add(tokens[idx] + tokens[idx + 1])
    for idx in range(len(tokens) - 2):
        compact.add(tokens[idx] + tokens[idx + 1] + tokens[idx + 2])
    return compact


def bone_name_info(raw_name: str) -> dict:
    stripped = strip_generated_suffixes(raw_name)
    spaced = camel_to_words(stripped)
    lowered = spaced.lower()
    lowered = lowered.replace(":", " ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    tokens = [t for t in lowered.split() if t]

    side = None
    if "left" in tokens or "lf" in tokens:
        side = "left"
    elif "right" in tokens or "rt" in tokens:
        side = "right"

    if side is None:
        for token in tokens:
            if token in {"l", "lt"}:
                side = "left"
                break
            if token in {"r", "rt"}:
                side = "right"
                break

    semantic_tokens = []
    for token in tokens:
        if token in {"left", "right", "l", "r", "lt", "rt", "c", "center"}:
            continue
        if token in PREFIX_WORDS:
            continue
        semantic_tokens.append(token)

    return {
        "raw": raw_name,
        "stripped": stripped,
        "tokens": tokens,
        "semantic_tokens": semantic_tokens,
        "compact": compact_tokens(semantic_tokens),
        "side": side,
    }


def is_control_bone_name(name: str) -> bool:
    info = bone_name_info(name)
    compact = info["compact"] | set(info["tokens"])
    return bool(compact & CONTROL_WORDS)


def side_key(side: str | None, suffix: str) -> str | None:
    if side == "left":
        return "left" + suffix
    if side == "right":
        return "right" + suffix
    return None


def classify_humanoid_key(info: dict) -> tuple[str | None, str | None]:
    tokens = info["semantic_tokens"]
    compact = info["compact"]
    side = info["side"]

    if "jaw" in compact or "mandible" in compact:
        return "jaw", None

    if side and ("eye" in compact or "eyeball" in compact):
        return side_key(side, "Eye"), None

    if any(t in compact for t in {"toe", "toes", "ball", "toebase"}):
        return side_key(side, "Toes"), None

    if any(t in compact for t in {"foot", "feet"}):
        return side_key(side, "Foot"), None
    if "ankle" in compact:
        return side_key(side, "Foot"), "ankle mapped as foot candidate"

    if any(t in compact for t in {"upleg", "upperleg", "thigh"}):
        return side_key(side, "UpperLeg"), None
    if "leg" in compact and side and not any(t in compact for t in {"upleg", "upperleg"}):
        return side_key(side, "LowerLeg"), None
    if any(t in compact for t in {"lowerleg", "calf", "shin", "knee"}):
        return side_key(side, "LowerLeg"), None

    if "shoulder" in compact or "clavicle" in compact:
        return side_key(side, "Shoulder"), None

    if any(t in compact for t in {"forearm", "lowerarm", "elbow"}):
        return side_key(side, "LowerArm"), None
    if any(t in compact for t in {"upperarm"}):
        return side_key(side, "UpperArm"), None
    if "arm" in compact and side and not any(t in compact for t in {"forearm", "lowerarm"}):
        return side_key(side, "UpperArm"), None

    if "hand" in compact:
        return side_key(side, "Hand"), None
    if any(t in compact for t in {"wrist", "palm"}):
        return side_key(side, "Hand"), f"{info['raw']} mapped as hand candidate from wrist/palm"

    if any(t in compact for t in {"hips", "hip", "pelvis"}):
        return "hips", None
    if "neck" in compact:
        return "neck", None
    if "head" in compact or "head1" in compact or "skull" in compact:
        return "head", None
    if "upperchest" in compact:
        return "upperChest", None
    if "chest" in compact or "thorax" in compact:
        return "chest", None

    if "spine2" in compact:
        return "upperChest", None
    if "spine1" in compact:
        return "chest", None
    if "spine" in compact or "abdomen" in compact:
        return "spine", None

    if tokens:
        joined = "".join(tokens)
        if joined in {"spine01", "spine0"}:
            return "spine", None
        if joined in {"spine02"}:
            return "chest", None
        if joined in {"spine03"}:
            return "upperChest", None

    return None, None


def candidate_score(bone: dict, key: str, warning: str | None) -> int:
    score = 0
    name = bone["name"]
    info = bone["info"]
    compact = info["compact"]

    if bone.get("use_deform", True):
        score += 30
    if bone.get("has_vertex_group", False):
        score += 20
    if not bone.get("is_control", False):
        score += 20
    else:
        score -= 30

    raw_lower = name.lower()
    if "mixamorig" in raw_lower:
        score += 12
    if "j_bip" in raw_lower or "vroid" in raw_lower:
        score += 12
    if "valvebiped" in raw_lower or "bip01" in raw_lower:
        score += 10
    if warning:
        score -= 6

    expected = key.lower().replace("left", "").replace("right", "")
    if expected in compact:
        score += 8

    if key in {"spine", "chest", "upperChest"}:
        if key == "spine" and ("spine" in compact or "spine0" in compact):
            score += 8
        if key == "chest" and ("chest" in compact or "spine1" in compact):
            score += 8
        if key == "upperChest" and ("upperchest" in compact or "spine2" in compact):
            score += 8

    return score


def map_humanoid_bones(bones: list[dict]) -> tuple[dict, list[str]]:
    candidates: dict[str, list[tuple[int, str, str | None]]] = defaultdict(list)
    warnings: list[str] = []
    for bone in bones:
        key, warning = classify_humanoid_key(bone["info"])
        if not key:
            continue
        score = candidate_score(bone, key, warning)
        candidates[key].append((score, bone["name"], warning))

    mapping = {key: None for key in HUMANOID_KEYS}
    for key, rows in candidates.items():
        rows.sort(key=lambda row: (-row[0], row[1].lower()))
        mapping[key] = rows[0][1]
        if rows[0][2]:
            warnings.append(rows[0][2])
    return mapping, warnings


def detect_finger_chains(bones: list[dict]) -> tuple[dict, dict]:
    chains = {"left": defaultdict(list), "right": defaultdict(list)}
    for bone in bones:
        info = bone["info"]
        side = info["side"]
        if side not in {"left", "right"}:
            continue
        compact = info["compact"]
        for finger, names in FINGER_WORDS.items():
            if any(name in compact for name in names):
                chains[side][finger].append(bone["name"])
                break
    left = {k: sorted(v) for k, v in chains["left"].items()}
    right = {k: sorted(v) for k, v in chains["right"].items()}
    return left, right


def support_from_counts(left: dict, right: dict) -> str:
    left_fingers = sum(1 for values in left.values() if values)
    right_fingers = sum(1 for values in right.values() if values)
    both = min(left_fingers, right_fingers)
    max_depth = 0
    for values in list(left.values()) + list(right.values()):
        max_depth = max(max_depth, len(values))
    if both >= 5 and max_depth >= 3:
        return "good"
    if both >= 3 and max_depth >= 2:
        return "partial"
    if left_fingers or right_fingers:
        return "poor"
    return "missing"


def empty_audit(name: str, slug: str, source_path: str, outdir: Path) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "created_at": utc_now(),
        "model": {
            "name": name,
            "slug": slug,
            "character_guess": name,
            "source_paths": [source_path],
            "selected_source_path": source_path,
            "selected_source_format": Path(source_path).suffix.lower().lstrip("."),
            "selected_from_zip": False,
            "source_zip": "",
            "nested_zip": "",
            "file_size_mb": round(Path(source_path).stat().st_size / (1024 * 1024), 3)
            if Path(source_path).exists()
            else 0,
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
            "cameras_count": 0,
            "lights_count": 0,
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
            "control_bones_sample": [],
            "ik_bones_sample": [],
            "constraint_count": 0,
        },
        "humanoid_mapping": {key: None for key in HUMANOID_KEYS},
        "missing": {
            "required_for_upper_body": [],
            "required_for_full_body": [],
            "required_for_hands": [],
            "required_for_fingers": [],
            "required_for_feet": [],
            "required_for_face_touch": [],
        },
        "hands": {
            "left_hand_bone": None,
            "right_hand_bone": None,
            "left_finger_chains": {},
            "right_finger_chains": {},
            "finger_support": "missing",
            "notes": [],
        },
        "feet": {
            "left_foot_bone": None,
            "right_foot_bone": None,
            "left_toe_bone": None,
            "right_toe_bone": None,
            "foot_support": "missing",
            "notes": [],
        },
        "face": {
            "head_bone": None,
            "jaw_bone": None,
            "eye_bones": [],
            "lip_bones": [],
            "brow_bones": [],
            "shape_keys": [],
            "expression_support": "missing",
            "notes": [],
        },
        "skinning": {
            "meshes_with_armature_modifier": [],
            "meshes_with_vertex_groups": [],
            "possible_weight_paint_issues": [],
            "bones_without_weights_sample": [],
        },
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
        "warnings": [],
        "recommended_blender_edits": [],
        "recommended_posepuppet_changes": [],
        "recommended_user_action": "",
        "summary_for_llm": "",
        "audit_tool": {
            "outdir": str(outdir),
            "screenshots": "not generated by default; rerun with --screenshots for best-effort renders",
        },
    }


def load_blender_source(source: Path) -> tuple[str, list[str]]:
    import bpy

    warnings = []
    suffix = source.suffix.lower()
    if source.is_dir():
        candidates = []
        for ext in (".blend", ".fbx", ".glb", ".gltf", ".vrm", ".obj"):
            candidates.extend(sorted(source.rglob(f"*{ext}")))
        if not candidates:
            raise RuntimeError(f"No supported model file found in folder: {source}")
        source = candidates[0]
        suffix = source.suffix.lower()
        warnings.append(f"Folder source resolved to {source}")

    if suffix == ".blend":
        try:
            bpy.ops.wm.open_mainfile(filepath=str(source))
        except RuntimeError as exc:
            if not bpy.data.objects:
                raise
            warnings.append(f"Blender reported a recoverable .blend load warning: {exc}")
        return str(source), warnings

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if suffix in {".glb", ".gltf", ".vrm"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif suffix == ".fbx":
        before_count = len(bpy.data.objects)
        try:
            patch_fbx_light_import_bug(bpy, warnings)
            bpy.ops.import_scene.fbx(filepath=str(source))
        except RuntimeError as exc:
            if len(bpy.data.objects) <= before_count:
                raise
            warnings.append(f"Blender reported a recoverable FBX import warning after creating scene objects: {exc}")
    elif suffix == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=str(source))
        else:
            bpy.ops.import_scene.obj(filepath=str(source))
        warnings.append("OBJ source usually has static geometry only and no usable rig data.")
    else:
        raise RuntimeError(f"Unsupported source extension: {suffix}")
    return str(source), warnings


def patch_fbx_light_import_bug(bpy, warnings: list[str]) -> None:
    try:
        from io_scene_fbx import import_fbx
    except Exception as exc:
        warnings.append(f"Could not import FBX patch module: {type(exc).__name__}: {exc}")
        return

    original = getattr(import_fbx, "blen_read_light", None)
    if original is None or getattr(original, "_posepuppet_safe_wrapper", False):
        return

    def safe_blen_read_light(fbx_tmpl, fbx_obj, settings):
        before = {light.name for light in bpy.data.lights}
        try:
            return original(fbx_tmpl, fbx_obj, settings)
        except AttributeError as exc:
            if "cast_shadow" not in str(exc):
                raise
            created = [light for light in bpy.data.lights if light.name not in before]
            if created:
                warnings.append("Ignored Blender FBX importer light cast_shadow compatibility error.")
                return created[-1]
            raise

    safe_blen_read_light._posepuppet_safe_wrapper = True
    import_fbx.blen_read_light = safe_blen_read_light


def world_bbox_for_meshes(mesh_objects) -> tuple[list[float], list[float], list[float]]:
    min_v = [math.inf, math.inf, math.inf]
    max_v = [-math.inf, -math.inf, -math.inf]
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ obj.matrix_world.inverted().Identity(4) @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ obj.matrix_world.inverted() @ obj.matrix_world @ corner
            for idx in range(3):
                min_v[idx] = min(min_v[idx], world[idx])
                max_v[idx] = max(max_v[idx], world[idx])
    if math.isinf(min_v[0]):
        return [0, 0, 0], [0, 0, 0], [0, 0, 0]
    size = [max_v[idx] - min_v[idx] for idx in range(3)]
    return [round(v, 5) for v in min_v], [round(v, 5) for v in max_v], [round(v, 5) for v in size]


def world_bbox_for_meshes(mesh_objects) -> tuple[list[float], list[float], list[float]]:
    from mathutils import Vector

    min_v = [math.inf, math.inf, math.inf]
    max_v = [-math.inf, -math.inf, -math.inf]
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            for idx in range(3):
                min_v[idx] = min(min_v[idx], world[idx])
                max_v[idx] = max(max_v[idx], world[idx])
    if math.isinf(min_v[0]):
        return [0, 0, 0], [0, 0, 0], [0, 0, 0]
    size = [max_v[idx] - min_v[idx] for idx in range(3)]
    return [round(v, 5) for v in min_v], [round(v, 5) for v in max_v], [round(v, 5) for v in size]


def choose_primary_armature(armatures, mesh_objects):
    if not armatures:
        return None
    linked_counts = defaultdict(int)
    for mesh in mesh_objects:
        for mod in mesh.modifiers:
            if mod.type == "ARMATURE" and mod.object:
                linked_counts[mod.object.name] += 1
    return sorted(
        armatures,
        key=lambda arm: (-linked_counts.get(arm.name, 0), -len(arm.data.bones), arm.name.lower()),
    )[0]


def vertex_group_names_with_weights(obj) -> set[str]:
    weighted_indices = set()
    for vertex in obj.data.vertices:
        for group in vertex.groups:
            if group.weight > 0.0001:
                weighted_indices.add(group.group)
    return {obj.vertex_groups[idx].name for idx in weighted_indices if idx < len(obj.vertex_groups)}


def build_bone_tree(armature, limit: int = 1800) -> tuple[str, bool]:
    if armature is None:
        return "No armature found.\n", False
    lines = []

    def visit(bone, depth: int):
        if len(lines) >= limit:
            return
        lines.append(f"{'  ' * depth}{bone.name}")
        for child in sorted(bone.children, key=lambda item: item.name.lower()):
            visit(child, depth + 1)

    for root in sorted([bone for bone in armature.data.bones if bone.parent is None], key=lambda item: item.name.lower()):
        visit(root, 0)
    truncated = len(lines) >= limit
    if truncated:
        lines.append(f"... truncated after {limit} bones ...")
    return "\n".join(lines) + "\n", truncated


def naming_style_guess(bone_names: list[str]) -> str:
    joined = "\n".join(bone_names).lower()
    if "mixamorig" in joined:
        return "Mixamo"
    if "j_bip" in joined:
        return "VRoid/VRM J_Bip"
    if "valvebiped" in joined or "bip01" in joined:
        return "ValveBiped / Source"
    if re.search(r"\bbip[_\-.]", joined):
        return "bip-style"
    if "ctrl" in joined or "_ik" in joined or ".ik" in joined:
        return "control-rig/custom"
    return "generic/custom"


def list_face_bones(bones: list[dict]) -> tuple[list[str], list[str], list[str]]:
    eyes = []
    lips = []
    brows = []
    for bone in bones:
        compact = bone["info"]["compact"]
        name = bone["name"]
        if "eye" in compact or "eyeball" in compact:
            eyes.append(name)
        if any(word in compact for word in {"lip", "lips", "mouth", "tongue"}):
            lips.append(name)
        if any(word in compact for word in {"brow", "eyebrow"}):
            brows.append(name)
    return sorted(eyes), sorted(lips), sorted(brows)


def evaluate_capabilities(audit: dict) -> None:
    mapping = audit["humanoid_mapping"]
    warnings = audit["warnings"]
    name = audit["model"]["name"].lower()
    rig = audit["rig"]
    has_rig = rig["has_armature"]
    has_skin = rig["has_skinned_meshes"]

    upper_required = [
        "hips",
        "spine",
        "neck",
        "head",
        "leftUpperArm",
        "leftLowerArm",
        "leftHand",
        "rightUpperArm",
        "rightLowerArm",
        "rightHand",
    ]
    full_required = upper_required + [
        "leftUpperLeg",
        "leftLowerLeg",
        "leftFoot",
        "rightUpperLeg",
        "rightLowerLeg",
        "rightFoot",
    ]
    hand_required = ["leftHand", "rightHand"]
    finger_required = []
    feet_required = ["leftFoot", "rightFoot"]
    face_touch_required = ["head", "neck", "leftUpperArm", "leftLowerArm", "leftHand", "rightUpperArm", "rightLowerArm", "rightHand"]

    audit["missing"]["required_for_upper_body"] = [key for key in upper_required if not mapping.get(key)]
    audit["missing"]["required_for_full_body"] = [key for key in full_required if not mapping.get(key)]
    audit["missing"]["required_for_hands"] = [key for key in hand_required if not mapping.get(key)]
    audit["missing"]["required_for_fingers"] = finger_required
    audit["missing"]["required_for_feet"] = [key for key in feet_required if not mapping.get(key)]
    audit["missing"]["required_for_face_touch"] = [key for key in face_touch_required if not mapping.get(key)]

    upper_hits = sum(1 for key in upper_required if mapping.get(key))
    full_hits = sum(1 for key in full_required if mapping.get(key))
    leg_hits = sum(1 for key in ["leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot"] if mapping.get(key))
    foot_hits = sum(1 for key in ["leftFoot", "rightFoot"] if mapping.get(key))
    toe_hits = sum(1 for key in ["leftToes", "rightToes"] if mapping.get(key))
    hand_hits = sum(1 for key in ["leftHand", "rightHand"] if mapping.get(key))
    finger_support = audit["hands"]["finger_support"]

    upper_score = round((upper_hits / len(upper_required)) * 100)
    leg_score = round((leg_hits / 6) * 100)
    foot_score = round((foot_hits / 2) * 100)
    toe_score = round((toe_hits / 2) * 100)
    hand_score = round((hand_hits / 2) * 100)
    finger_score = {"good": 90, "partial": 65, "poor": 35, "missing": 0}.get(finger_support, 0)
    skin_score = 90 if has_skin else (30 if has_rig else 0)
    mapping_score = round((full_hits / len(full_required)) * 100)

    def band(score: int, good: int = 85, partial: int = 50, poor: int = 25) -> str:
        if score >= good:
            return "good"
        if score >= partial:
            return "partial"
        if score >= poor:
            return "poor"
        return "missing"

    audit["posepuppet_capabilities"]["upper_body"] = band(upper_score)
    audit["posepuppet_capabilities"]["legs"] = band(leg_score)
    audit["posepuppet_capabilities"]["feet"] = band(foot_score)
    audit["posepuppet_capabilities"]["toes"] = "good" if toe_score == 100 else ("partial" if toe_score else "missing")
    audit["posepuppet_capabilities"]["hands"] = band(hand_score)
    audit["posepuppet_capabilities"]["fingers"] = finger_support
    audit["posepuppet_capabilities"]["facial_expressions"] = audit["face"]["expression_support"]

    non_humanoid_hint = any(
        word in name
        for word in [
            "godzilla",
            "kong",
            "xenomorph",
            "olaf",
            "grogu",
            "yoda",
            "hand",
        ]
    )
    hand_only = "hand" in name and not any(mapping.get(key) for key in ["hips", "spine", "head", "leftUpperLeg", "rightUpperLeg"])

    if not has_rig:
        audit["label"] = "static / not rigged"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "static-preview"
        warnings.append("No armature found; this model cannot be puppeteered without rigging.")
    elif hand_only:
        audit["label"] = "hand-only"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "hand-only"
    elif non_humanoid_hint:
        audit["label"] = "non-humanoid / creature-profile-needed"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "creature"
        warnings.append("Model appears to be creature/non-human anatomy; do not force standard humanoid retargeting.")
    elif mapping_score >= 85 and skin_score >= 70 and hand_score >= 100:
        audit["label"] = "well-developed"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "humanoid"
    elif mapping_score >= 65 and skin_score >= 70:
        audit["label"] = "partial"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "humanoid-with-offsets"
    elif has_rig and has_skin:
        audit["label"] = "experimental"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "humanoid-with-offsets"
    else:
        audit["label"] = "not well-developed"
        audit["posepuppet_capabilities"]["recommended_runtime_profile"] = "static-preview"

    if hand_hits == 0:
        warnings.append("No usable hand bones detected; face-touch and hand control are not supported.")
    elif finger_support == "missing":
        warnings.append("No finger bones detected; use palm-only hand control.")
    elif finger_support in {"partial", "poor"}:
        warnings.append("Finger support is incomplete; use conservative MediaPipe hand retargeting.")

    if foot_hits < 2:
        warnings.append("Feet are missing or asymmetric; disable foot orientation control.")
    if toe_hits == 0 and foot_hits:
        warnings.append("Feet exist but toes are missing; disable toe articulation.")
    if not has_skin and has_rig:
        warnings.append("Armature exists but no skinned meshes were detected.")
    if audit["model"]["selected_source_format"] == "obj":
        warnings.append("OBJ source has no usable rig data.")

    face_touch = "not_supported"
    face_touch_score = 0
    if not audit["missing"]["required_for_face_touch"] and not non_humanoid_hint:
        if finger_support in {"good", "partial"}:
            face_touch = "good"
            face_touch_score = 85
        else:
            face_touch = "possible_with_ik"
            face_touch_score = 70
    elif hand_hits and mapping.get("head"):
        face_touch = "limited"
        face_touch_score = 40
    audit["posepuppet_capabilities"]["face_touch"] = face_touch

    expression_score = {"good": 85, "possible": 60, "unknown": 30, "missing": 0}.get(audit["face"]["expression_support"], 0)
    cleanup_cost = 100 - round((mapping_score * 0.35) + (skin_score * 0.3) + (hand_score * 0.15) + (finger_score * 0.1) + (foot_score * 0.1))
    posepuppet_fit = round((mapping_score * 0.3) + (skin_score * 0.25) + (upper_score * 0.2) + (hand_score * 0.1) + (leg_score * 0.1) + (finger_score * 0.05))
    if non_humanoid_hint and not hand_only:
        posepuppet_fit = min(posepuppet_fit, 58)
    overall = round((posepuppet_fit * 0.6) + (expression_score * 0.1) + ((100 - cleanup_cost) * 0.3))

    audit["scores"].update(
        {
            "overall": overall,
            "humanoid_mapping": mapping_score,
            "skinning": skin_score,
            "upper_body": upper_score,
            "legs": leg_score,
            "feet": foot_score,
            "hands": hand_score,
            "fingers": finger_score,
            "face_touch": face_touch_score,
            "facial_expressions": expression_score,
            "posepuppet_fit": posepuppet_fit,
            "cleanup_cost": cleanup_cost,
        }
    )

    if audit["label"] == "well-developed" and audit["scores"]["overall"] < 85:
        audit["label"] = "partial"
    if audit["label"] == "partial" and audit["scores"]["overall"] < 50:
        audit["label"] = "experimental"

    if audit["label"] in {"well-developed", "partial"}:
        audit["recommended_user_action"] = "Try this after confirming license and checking proportions in Blender."
    elif audit["label"] == "hand-only":
        audit["recommended_user_action"] = "Use as a hand/finger retargeting test asset, not as a full avatar."
    elif "creature" in audit["label"]:
        audit["recommended_user_action"] = "Keep for a custom creature profile; do not wire into standard humanoid retargeting yet."
    elif audit["label"] == "static / not rigged":
        audit["recommended_user_action"] = "Use only as static preview unless it is rigged in Blender."
    else:
        audit["recommended_user_action"] = "Defer until rig, naming, and skinning issues are cleaned up."

    if audit["missing"]["required_for_upper_body"]:
        audit["recommended_blender_edits"].append("Add or rename missing upper-body humanoid bones, then verify skin weights.")
    if finger_support != "good" and hand_hits:
        audit["recommended_blender_edits"].append("Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.")
    if foot_hits < 2:
        audit["recommended_blender_edits"].append("Add or verify left/right foot bones and weights before enabling leg support.")
    if non_humanoid_hint and not hand_only:
        audit["recommended_posepuppet_changes"].append("Create a custom creature runtime profile with anatomy-specific offsets and enabled joints.")
    elif hand_only:
        audit["recommended_posepuppet_changes"].append("Add a hand-only runtime profile driven by MediaPipe hand landmarks.")
    else:
        audit["recommended_posepuppet_changes"].append("Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.")

    warnings.append("License unknown; do not redistribute this model or generated converted files.")
    audit["warnings"] = sorted(dict.fromkeys(warnings))


def write_reports(audit: dict, bone_tree: str, outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "screenshots").mkdir(exist_ok=True)
    (outdir / "audit.json").write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n")
    (outdir / "bone-tree.txt").write_text(bone_tree)
    source_lines = [
        f"# Source files for {audit['model']['name']}",
        "",
        f"Selected source: {audit['model']['selected_source_path']}",
        f"Selected format: {audit['model']['selected_source_format']}",
        f"Selected from ZIP: {audit['model']['selected_from_zip']}",
    ]
    if audit["model"].get("source_zip"):
        source_lines.append(f"Source ZIP: {audit['model']['source_zip']}")
    if audit["model"].get("nested_zip"):
        source_lines.append(f"Nested ZIP: {audit['model']['nested_zip']}")
    source_lines.append("")
    source_lines.append("All known source paths:")
    for path in audit["model"]["source_paths"]:
        source_lines.append(f"- {path}")
    (outdir / "source-files.txt").write_text("\n".join(source_lines) + "\n")
    warning_lines = [f"# Warnings for {audit['model']['name']}", ""]
    if audit["warnings"]:
        warning_lines.extend(f"- {warning}" for warning in audit["warnings"])
    else:
        warning_lines.append("- No warnings generated.")
    (outdir / "warnings.md").write_text("\n".join(warning_lines) + "\n")
    (outdir / "model-card.md").write_text(render_model_card(audit))


def render_mapping_table(mapping: dict) -> str:
    lines = ["| Humanoid slot | Bone |", "|---|---|"]
    for key in HUMANOID_KEYS:
        lines.append(f"| `{key}` | {mapping.get(key) or '-'} |")
    return "\n".join(lines)


def render_model_card(audit: dict) -> str:
    model = audit["model"]
    scene = audit["scene"]
    geometry = audit["geometry"]
    rig = audit["rig"]
    caps = audit["posepuppet_capabilities"]
    scores = audit["scores"]
    main_warning = audit["warnings"][0] if audit["warnings"] else "No major warning."
    sentence = audit["summary_for_llm"] or (
        f"{model['name']} is labeled {audit['label']} with {scores['overall']}/100 overall fit; "
        f"primary caution: {main_warning}"
    )
    lines = [
        f"# Avatar audit: {model['name']}",
        "",
        "## Verdict",
        "",
        f"Label: {audit['label']}",
        f"Overall score: {scores['overall']}",
        f"Recommended runtime profile: {caps['recommended_runtime_profile']}",
        f"One-sentence recommendation: {audit['recommended_user_action']}",
        "",
        "## Source files",
        "",
        f"- Selected source: `{model['selected_source_path']}`",
        f"- Selected format: `{model['selected_source_format']}`",
        f"- From ZIP: `{model['selected_from_zip']}`",
        f"- License: {model['license_note']}",
        "",
        "## Geometry",
        "",
        f"- Meshes: {scene['mesh_count']}",
        f"- Vertices: {geometry['vertex_count']}",
        f"- Triangles: {geometry['triangle_count']}",
        f"- Estimated height: {geometry['estimated_height']}",
        f"- Bounding box size: {geometry['bounding_box']['size']}",
        f"- Materials/textures: {scene['material_count']} materials, {scene['texture_count']} images",
        "",
        "## Rig summary",
        "",
        f"- Has armature: {rig['has_armature']}",
        f"- Primary armature: {rig['primary_armature'] or '-'}",
        f"- Bone count: {rig['bone_count']} ({rig['deform_bone_count']} deform, {rig['control_bone_count']} control/non-deform)",
        f"- Naming style guess: {rig['naming_style_guess']}",
        f"- Skinned meshes: {rig['skinned_mesh_count']}",
        f"- Constraints: {rig['constraint_count']} total; IK: {rig['has_ik_constraints']}",
        f"- Rest pose guess: {rig['rest_pose_guess']}",
        "",
        "## Humanoid mapping",
        "",
        render_mapping_table(audit["humanoid_mapping"]),
        "",
        "## Hands and fingers",
        "",
        f"- Left hand: {audit['hands']['left_hand_bone'] or '-'}",
        f"- Right hand: {audit['hands']['right_hand_bone'] or '-'}",
        f"- Finger support: {audit['hands']['finger_support']}",
        f"- Left chains: {json.dumps(audit['hands']['left_finger_chains'], sort_keys=True)}",
        f"- Right chains: {json.dumps(audit['hands']['right_finger_chains'], sort_keys=True)}",
        "",
        "## Feet and toes",
        "",
        f"- Left foot: {audit['feet']['left_foot_bone'] or '-'}",
        f"- Right foot: {audit['feet']['right_foot_bone'] or '-'}",
        f"- Left toe: {audit['feet']['left_toe_bone'] or '-'}",
        f"- Right toe: {audit['feet']['right_toe_bone'] or '-'}",
        f"- Foot support: {audit['feet']['foot_support']}",
        "",
        "## Face / expressions / face-touch",
        "",
        f"- Head: {audit['face']['head_bone'] or '-'}",
        f"- Jaw: {audit['face']['jaw_bone'] or '-'}",
        f"- Eye bones: {', '.join(audit['face']['eye_bones'][:20]) or '-'}",
        f"- Shape keys: {len(audit['face']['shape_keys'])}",
        f"- Expression support: {audit['face']['expression_support']}",
        f"- Face-touch feasibility: {caps['face_touch']}",
        "",
        "## PosePuppet support",
        "",
        f"- Upper body: {caps['upper_body']}",
        f"- Legs: {caps['legs']}",
        f"- Feet: {caps['feet']}",
        f"- Toes: {caps['toes']}",
        f"- Hands: {caps['hands']}",
        f"- Fingers: {caps['fingers']}",
        f"- Facial expressions: {caps['facial_expressions']}",
        "",
        "## Warnings",
        "",
    ]
    lines.extend(f"- {warning}" for warning in audit["warnings"])
    lines.extend(
        [
            "",
            "## Required Blender edits",
            "",
        ]
    )
    lines.extend(f"- {item}" for item in (audit["recommended_blender_edits"] or ["No required edit identified by automated audit."]))
    lines.extend(
        [
            "",
            "## Recommended PosePuppet changes",
            "",
        ]
    )
    lines.extend(f"- {item}" for item in audit["recommended_posepuppet_changes"])
    lines.extend(
        [
            "",
            "## What to tell another LLM",
            "",
            sentence,
            "",
        ]
    )
    return "\n".join(lines)


def audit_loaded_scene(args, source_path: str, outdir: Path, import_warnings: list[str]) -> dict:
    import bpy

    name = args.model_name or Path(args.source_display_path or source_path).stem
    slug = args.slug or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    audit = empty_audit(name, slug, args.source_display_path or source_path, outdir)
    audit["model"]["selected_source_path"] = args.source_display_path or source_path
    audit["model"]["source_paths"] = json.loads(args.source_paths_json) if args.source_paths_json else [args.source_display_path or source_path]
    audit["model"]["selected_from_zip"] = args.selected_from_zip
    audit["model"]["source_zip"] = args.source_zip or ""
    audit["model"]["nested_zip"] = args.nested_zip or ""
    audit["model"]["selected_source_format"] = Path(source_path).suffix.lower().lstrip(".")
    if Path(source_path).exists():
        audit["model"]["file_size_mb"] = round(Path(source_path).stat().st_size / (1024 * 1024), 3)

    objects = list(bpy.data.objects)
    mesh_objects = [obj for obj in objects if obj.type == "MESH"]
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    primary_armature = choose_primary_armature(armatures, mesh_objects)
    materials = sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material})
    images = sorted({image.name for image in bpy.data.images if image.name})
    actions = sorted({action.name for action in bpy.data.actions})
    cameras = [obj for obj in objects if obj.type == "CAMERA"]
    lights = [obj for obj in objects if obj.type == "LIGHT"]

    vertex_count = 0
    triangle_count = 0
    mesh_names = []
    shape_key_names = []
    for obj in mesh_objects:
        mesh_names.append(obj.name)
        vertex_count += len(obj.data.vertices)
        obj.data.calc_loop_triangles()
        triangle_count += len(obj.data.loop_triangles)
        if obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:
                if key.name != "Basis":
                    shape_key_names.append(f"{obj.name}:{key.name}")

    bb_min, bb_max, bb_size = world_bbox_for_meshes(mesh_objects)
    audit["scene"].update(
        {
            "object_count": len(objects),
            "mesh_count": len(mesh_objects),
            "armature_count": len(armatures),
            "material_count": len(materials),
            "texture_count": len(images),
            "animation_count": len(actions),
            "shape_key_count": len(shape_key_names),
            "cameras_count": len(cameras),
            "lights_count": len(lights),
        }
    )
    audit["geometry"].update(
        {
            "vertex_count": vertex_count,
            "triangle_count": triangle_count,
            "bounding_box": {"min": bb_min, "max": bb_max, "size": bb_size},
            "estimated_height": bb_size[2],
            "mesh_names": sorted(mesh_names),
            "has_textures": bool(images),
        }
    )

    mesh_armature_names = []
    mesh_with_groups = []
    all_weighted_group_names = set()
    for obj in mesh_objects:
        if any(mod.type == "ARMATURE" for mod in obj.modifiers):
            mesh_armature_names.append(obj.name)
        if obj.vertex_groups:
            mesh_with_groups.append(obj.name)
            all_weighted_group_names |= vertex_group_names_with_weights(obj)

    bones = []
    constraint_count = 0
    ik_bones = []
    control_bones = []
    if primary_armature:
        for pose_bone in primary_armature.pose.bones:
            constraint_count += len(pose_bone.constraints)
            if any(constraint.type == "IK" for constraint in pose_bone.constraints):
                ik_bones.append(pose_bone.name)
        for bone in primary_armature.data.bones:
            is_control = is_control_bone_name(bone.name) or not bone.use_deform
            if is_control:
                control_bones.append(bone.name)
            bones.append(
                {
                    "name": bone.name,
                    "use_deform": bool(bone.use_deform),
                    "is_control": bool(is_control),
                    "has_vertex_group": bone.name in all_weighted_group_names,
                    "info": bone_name_info(bone.name),
                }
            )

    bone_names = [bone["name"] for bone in bones]
    mapping, mapping_warnings = map_humanoid_bones(bones)
    left_fingers, right_fingers = detect_finger_chains(bones)
    eye_bones, lip_bones, brow_bones = list_face_bones(bones)
    bones_without_weights = [bone["name"] for bone in bones if bone.get("use_deform") and bone["name"] not in all_weighted_group_names]

    audit["rig"].update(
        {
            "has_armature": bool(armatures),
            "primary_armature": primary_armature.name if primary_armature else "",
            "armature_names": sorted(arm.name for arm in armatures),
            "bone_count": len(bones),
            "deform_bone_count": sum(1 for bone in bones if bone.get("use_deform")),
            "control_bone_count": len(control_bones),
            "root_bones": sorted(bone.name for bone in primary_armature.data.bones if bone.parent is None) if primary_armature else [],
            "naming_style_guess": naming_style_guess(bone_names),
            "rest_pose_guess": "hand-only" if "hand" in audit["model"]["name"].lower() and not mapping.get("hips") else "unknown",
            "has_constraints": constraint_count > 0,
            "has_ik_constraints": bool(ik_bones),
            "has_skinned_meshes": bool(mesh_armature_names and mesh_with_groups),
            "skinned_mesh_count": len(mesh_armature_names),
            "unskinned_mesh_count": max(0, len(mesh_objects) - len(mesh_armature_names)),
            "control_bones_sample": sorted(control_bones)[:80],
            "ik_bones_sample": sorted(ik_bones)[:80],
            "constraint_count": constraint_count,
        }
    )
    audit["humanoid_mapping"] = mapping
    audit["hands"].update(
        {
            "left_hand_bone": mapping.get("leftHand"),
            "right_hand_bone": mapping.get("rightHand"),
            "left_finger_chains": left_fingers,
            "right_finger_chains": right_fingers,
            "finger_support": support_from_counts(left_fingers, right_fingers),
        }
    )
    audit["feet"].update(
        {
            "left_foot_bone": mapping.get("leftFoot"),
            "right_foot_bone": mapping.get("rightFoot"),
            "left_toe_bone": mapping.get("leftToes"),
            "right_toe_bone": mapping.get("rightToes"),
            "foot_support": "good"
            if mapping.get("leftFoot") and mapping.get("rightFoot")
            else ("partial" if mapping.get("leftFoot") or mapping.get("rightFoot") else "missing"),
        }
    )
    expression_support = "good" if shape_key_names and (lip_bones or brow_bones or eye_bones) else ("possible" if shape_key_names or lip_bones or brow_bones else "missing")
    audit["face"].update(
        {
            "head_bone": mapping.get("head"),
            "jaw_bone": mapping.get("jaw"),
            "eye_bones": eye_bones[:80],
            "lip_bones": lip_bones[:80],
            "brow_bones": brow_bones[:80],
            "shape_keys": sorted(shape_key_names)[:160],
            "expression_support": expression_support,
        }
    )
    audit["skinning"].update(
        {
            "meshes_with_armature_modifier": sorted(mesh_armature_names),
            "meshes_with_vertex_groups": sorted(mesh_with_groups),
            "possible_weight_paint_issues": [],
            "bones_without_weights_sample": sorted(bones_without_weights)[:100],
        }
    )
    if len(bones_without_weights) > max(10, len(bones) * 0.25):
        audit["skinning"]["possible_weight_paint_issues"].append(
            f"{len(bones_without_weights)} deform bones have no matching weighted vertex group sample."
        )
    audit["animations"].update({"has_animation": bool(actions), "clip_count": len(actions), "clip_names": actions[:120]})
    audit["warnings"].extend(import_warnings)
    audit["warnings"].extend(mapping_warnings)
    if not args.screenshots:
        audit["warnings"].append("Screenshots were not generated; rerun with --screenshots if visual evidence is needed.")
    evaluate_capabilities(audit)

    audit["summary_for_llm"] = (
        f"{audit['model']['name']} uses {audit['rig']['naming_style_guess']} naming with "
        f"{audit['rig']['bone_count']} bones, {audit['scene']['mesh_count']} meshes, "
        f"{audit['rig']['skinned_mesh_count']} skinned meshes, and label {audit['label']}. "
        f"Upper body is {audit['posepuppet_capabilities']['upper_body']}, legs are "
        f"{audit['posepuppet_capabilities']['legs']}, hands are {audit['posepuppet_capabilities']['hands']}, "
        f"fingers are {audit['posepuppet_capabilities']['fingers']}, and face-touch is "
        f"{audit['posepuppet_capabilities']['face_touch']}. License is unknown; verify before redistribution."
    )
    return audit


def parse_blender_args(argv: list[str]) -> argparse.Namespace:
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Audit one model source inside Blender.")
    parser.add_argument("source")
    parser.add_argument("outdir")
    parser.add_argument("--model-name", default="")
    parser.add_argument("--slug", default="")
    parser.add_argument("--source-display-path", default="")
    parser.add_argument("--source-paths-json", default="")
    parser.add_argument("--selected-from-zip", action="store_true")
    parser.add_argument("--source-zip", default="")
    parser.add_argument("--nested-zip", default="")
    parser.add_argument("--screenshots", action="store_true")
    return parser.parse_args(argv)


def run_blender_audit(argv: list[str]) -> int:
    args = parse_blender_args(argv)
    source = Path(args.source)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    try:
        loaded_path, import_warnings = load_blender_source(source)
        audit = audit_loaded_scene(args, loaded_path, outdir, import_warnings)
        import bpy

        primary = choose_primary_armature([obj for obj in bpy.data.objects if obj.type == "ARMATURE"], [obj for obj in bpy.data.objects if obj.type == "MESH"])
        bone_tree, truncated = build_bone_tree(primary)
        if truncated:
            audit["warnings"].append("Bone tree was truncated; inspect source file directly for full hierarchy.")
        write_reports(audit, bone_tree, outdir)
        return 0
    except Exception as exc:
        audit = empty_audit(args.model_name or source.stem, args.slug or source.stem, args.source_display_path or str(source), outdir)
        audit["label"] = "reject"
        audit["warnings"] = [
            f"Audit failed: {type(exc).__name__}: {exc}",
            "License unknown; do not redistribute this model or generated converted files.",
        ]
        audit["recommended_user_action"] = "Open manually in Blender and rerun the audit after resolving import errors."
        audit["summary_for_llm"] = f"Automated audit failed for {audit['model']['name']}: {type(exc).__name__}: {exc}"
        write_reports(audit, "Audit failed before bone tree could be read.\n", outdir)
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


def self_test() -> int:
    examples = {
        "mixamorig:LeftArm_41_015": "leftUpperArm",
        "mixamorig:LeftForeArm_40_016": "leftLowerArm",
        "mixamorig:LeftHand_39_017": "leftHand",
        "mixamorig:RightArm_80_074": "rightUpperArm",
        "mixamorig:RightForeArm_79_075": "rightLowerArm",
        "mixamorig:RightHand_78_076": "rightHand",
        "mixamorig:LeftUpLeg_89_0132": "leftUpperLeg",
        "mixamorig:LeftLeg_88_0133": "leftLowerLeg",
        "mixamorig:LeftFoot_87_00": "leftFoot",
        "mixamorig:RightUpLeg_94_0138": "rightUpperLeg",
        "mixamorig:RightLeg_93_0139": "rightLowerLeg",
        "mixamorig:RightFoot_92_0140": "rightFoot",
        "ValveBiped.Bip01_Pelvis_02": "hips",
        "ValveBiped.Bip01_Spine_03": "spine",
        "ValveBiped.Bip01_Head1_08": "head",
        "character:jnt_L_arm_13": "leftUpperArm",
        "character:jnt_L_forearm_12": "leftLowerArm",
        "character:jnt_L_wrist_11": "leftHand",
        "UpperArm.L_29": "leftUpperArm",
        "LowerArm.L_28": "leftLowerArm",
        "Hand.L_27": "leftHand",
        "bip_upperarm_l_38": "leftUpperArm",
        "bip_lowerarm_l_37": "leftLowerArm",
        "bip_hand_l_36": "leftHand",
        "bip_upperarm_r_78": "rightUpperArm",
        "bip_lowerarm_r_77": "rightLowerArm",
        "bip_hand_r_76": "rightHand",
    }
    failures = []
    all_warnings = []
    for name, expected in examples.items():
        fake_bone = {
            "name": name,
            "use_deform": True,
            "is_control": is_control_bone_name(name),
            "has_vertex_group": True,
            "info": bone_name_info(name),
        }
        mapping, warnings = map_humanoid_bones([fake_bone])
        all_warnings.extend(warnings)
        if mapping.get(expected) != name:
            failures.append(f"{name} expected {expected}, got {mapping.get(expected)}")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print(f"OK: {len(examples)} bone mapping examples passed")
    if all_warnings:
        print("Warnings:")
        for warning in sorted(dict.fromkeys(all_warnings)):
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(self_test())
    raise SystemExit(run_blender_audit(sys.argv))
