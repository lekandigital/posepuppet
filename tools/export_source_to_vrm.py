"""
Headless Blender script to convert .blend/.fbx/.glb/.gltf sources into a VRM-like
GLB with injected VRMC_vrm metadata.
"""

import argparse
import json
import os
import re
import struct
import sys

import bpy


REQUIRED_BONES = [
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


BONE_PATTERNS = {
    "hips": re.compile(r"^(mixamorig:?Hips|.*\bhips?\b.*|.*\bpelvis\b.*)$", re.I),
    "spine": re.compile(r"^(mixamorig:?Spine|.*\bspine\b(?!.*[12]).*|.*\babdomen\b.*)$", re.I),
    "chest": re.compile(r"^(mixamorig:?Spine2|.*\b(chest|spine2|thorax)\b.*)$", re.I),
    "upperChest": re.compile(r"^(.*\b(upper.?chest|spine3)\b.*)$", re.I),
    "neck": re.compile(r"^(mixamorig:?Neck|.*\bneck\b.*)$", re.I),
    "head": re.compile(r"^(mixamorig:?Head|.*\b(head|skull)\b(?!.*top).*)$", re.I),
    "leftShoulder": re.compile(r"^(mixamorig:?LeftShoulder|.*\b(left|l)[._ ]?(shoulder|clavicle)\b.*)$", re.I),
    "leftUpperArm": re.compile(r"^(mixamorig:?LeftArm|.*\b(left|l)[._ ]?(upper.?arm|arm)\b(?!.*fore).*)$", re.I),
    "leftLowerArm": re.compile(r"^(mixamorig:?LeftForeArm|.*\b(left|l)[._ ]?(lower.?arm|fore.?arm|elbow)\b.*)$", re.I),
    "leftHand": re.compile(r"^(mixamorig:?LeftHand|.*\b(left|l)[._ ]?(hand|wrist|palm)\b(?!.*(thumb|index|middle|ring|pinky)).*)$", re.I),
    "rightShoulder": re.compile(r"^(mixamorig:?RightShoulder|.*\b(right|r)[._ ]?(shoulder|clavicle)\b.*)$", re.I),
    "rightUpperArm": re.compile(r"^(mixamorig:?RightArm|.*\b(right|r)[._ ]?(upper.?arm|arm)\b(?!.*fore).*)$", re.I),
    "rightLowerArm": re.compile(r"^(mixamorig:?RightForeArm|.*\b(right|r)[._ ]?(lower.?arm|fore.?arm|elbow)\b.*)$", re.I),
    "rightHand": re.compile(r"^(mixamorig:?RightHand|.*\b(right|r)[._ ]?(hand|wrist|palm)\b(?!.*(thumb|index|middle|ring|pinky)).*)$", re.I),
    "leftUpperLeg": re.compile(r"^(mixamorig:?LeftUpLeg|.*\b(left|l)[._ ]?(upper.?leg|up.?leg|thigh)\b.*)$", re.I),
    "leftLowerLeg": re.compile(r"^(mixamorig:?LeftLeg|.*\b(left|l)[._ ]?(lower.?leg|leg|shin|calf|knee)\b(?!.*up).*)$", re.I),
    "leftFoot": re.compile(r"^(mixamorig:?LeftFoot|.*\b(left|l)[._ ]?(foot|ankle)\b.*)$", re.I),
    "leftToes": re.compile(r"^(mixamorig:?LeftToeBase|.*\b(left|l)[._ ]?toe\b.*)$", re.I),
    "rightUpperLeg": re.compile(r"^(mixamorig:?RightUpLeg|.*\b(right|r)[._ ]?(upper.?leg|up.?leg|thigh)\b.*)$", re.I),
    "rightLowerLeg": re.compile(r"^(mixamorig:?RightLeg|.*\b(right|r)[._ ]?(lower.?leg|leg|shin|calf|knee)\b(?!.*up).*)$", re.I),
    "rightFoot": re.compile(r"^(mixamorig:?RightFoot|.*\b(right|r)[._ ]?(foot|ankle)\b.*)$", re.I),
    "rightToes": re.compile(r"^(mixamorig:?RightToeBase|.*\b(right|r)[._ ]?toe\b.*)$", re.I),
}


def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("Usage: blender -b --python tools/export_source_to_vrm.py -- <input> <output.vrm> [--mapping map.json]")
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--mapping", default=None)
    return parser.parse_args(argv[argv.index("--") + 1 :])


def patch_fbx_light_import_bug(warnings):
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


def load_source(source):
    warnings = []
    suffix = os.path.splitext(source)[1].lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=source)
        return warnings
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if suffix in {".glb", ".gltf", ".vrm"}:
        bpy.ops.import_scene.gltf(filepath=source)
    elif suffix == ".fbx":
        patch_fbx_light_import_bug(warnings)
        bpy.ops.import_scene.fbx(filepath=source, use_image_search=True)
    elif suffix == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=source)
        else:
            bpy.ops.import_scene.obj(filepath=source)
    else:
        raise RuntimeError(f"Unsupported source extension: {suffix}")
    return warnings


def choose_primary_armature():
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if not armatures:
        return None
    return sorted(armatures, key=lambda obj: len(obj.data.bones), reverse=True)[0]


def auto_map_bones(bone_names):
    mapping = {}
    for vrm_bone, pattern in BONE_PATTERNS.items():
        for src_name in bone_names:
            if pattern.match(src_name):
                mapping[vrm_bone] = src_name
                break
    return mapping


def load_manual_mapping(path):
    with open(path, "r") as handle:
        raw = json.load(handle)
    return {key: value for key, value in raw.items() if value and not key.startswith("_")}


def find_bone_node_index(gltf_json, bone_name):
    for index, node in enumerate(gltf_json.get("nodes", [])):
        if node.get("name") == bone_name:
            return index
    return None


def inject_vrm_extensions(glb_path, bone_mapping):
    with open(glb_path, "rb") as handle:
        data = handle.read()
    magic, version, _length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    assert version == 2
    json_chunk_length, json_chunk_type = struct.unpack_from("<II", data, 12)
    assert json_chunk_type == 0x4E4F534A
    json_bytes = data[20 : 20 + json_chunk_length]
    gltf = json.loads(json_bytes.decode("utf-8"))
    bin_offset = 20 + json_chunk_length
    bin_chunk = data[bin_offset:]

    human_bones = {}
    for vrm_bone, src_bone in bone_mapping.items():
        node_index = find_bone_node_index(gltf, src_bone)
        if node_index is not None:
            human_bones[vrm_bone] = {"node": node_index}

    vrm_ext = {
        "specVersion": "1.0",
        "meta": {
            "name": "User-Provided Licensed Avatar",
            "version": "1.0",
            "authors": ["User-provided licensed asset"],
            "licenseUrl": "https://vrm.dev/licenses/1.0/",
            "avatarPermission": "onlyAuthor",
            "allowRedistribution": False,
            "modification": "prohibited",
        },
        "humanoid": {"humanBones": human_bones},
    }

    gltf.setdefault("extensions", {})["VRMC_vrm"] = vrm_ext
    gltf.setdefault("extensionsUsed", [])
    if "VRMC_vrm" not in gltf["extensionsUsed"]:
        gltf["extensionsUsed"].append("VRMC_vrm")

    encoded = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    total_length = 12 + 8 + len(encoded) + len(bin_chunk)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total_length)
    out += struct.pack("<II", len(encoded), 0x4E4F534A)
    out += encoded
    out += bin_chunk
    return bytes(out)


def main():
    args = parse_args()
    source = os.path.abspath(args.input)
    output = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output), exist_ok=True)

    warnings = load_source(source)
    if warnings:
        for warning in warnings:
            print("WARNING:", warning)

    armature = choose_primary_armature()
    if armature is None:
        raise SystemExit("No armature found in source scene")
    bone_names = [bone.name for bone in armature.data.bones]
    mapping = auto_map_bones(bone_names)
    if args.mapping:
        mapping.update(load_manual_mapping(args.mapping))
    final_mapping = {vrm_bone: src_bone for vrm_bone, src_bone in mapping.items() if src_bone in bone_names}

    missing = [bone for bone in REQUIRED_BONES if bone not in final_mapping]
    print(f"Armature: {armature.name}")
    print(f"Final mapped bones: {len(final_mapping)}")
    if missing:
        print("Missing required bones:", ", ".join(missing))

    for image in bpy.data.images:
        if image.source == "FILE" and not image.packed_file:
            try:
                image.pack()
            except Exception as exc:
                print(f"WARNING: could not pack {image.name}: {exc}")

    temp_glb = output + ".tmp.glb"
    bpy.ops.export_scene.gltf(
        filepath=temp_glb,
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
    payload = inject_vrm_extensions(temp_glb, final_mapping)
    with open(output, "wb") as handle:
        handle.write(payload)
    os.remove(temp_glb)
    print(f"VRM written: {output}")


if __name__ == "__main__":
    main()
