"""
export_fbx_to_vrm.py — Headless Blender script to convert FBX → VRM.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender \
    -b \
    --python tools/export_fbx_to_vrm.py \
    -- <input.fbx> <output.vrm> [--mapping <bone-map.json>]

The script:
  1. Imports the FBX with textures
  2. Detects armatures and prints bone names
  3. Auto-maps Mixamo/generic bone names to VRM humanoid bones
  4. Optionally loads a manual mapping JSON override
  5. Packs all textures into the GLB (fully self-contained)
  6. Exports GLB, then post-processes it to inject VRM extension data
  7. Saves the result with .vrm extension

No VRM Add-on required — VRM metadata is injected into the GLB JSON directly.
"""

import bpy
import sys
import os
import json
import struct
import re
import argparse

# ──────────────────────── CLI parsing ────────────────────────

def parse_args():
    """Parse arguments after '--' in the Blender command line."""
    argv = sys.argv
    if "--" not in argv:
        print("ERROR: No arguments after '--'. Usage:")
        print("  blender -b --python export_fbx_to_vrm.py -- <input.fbx> <output.vrm>")
        sys.exit(1)
    args = argv[argv.index("--") + 1:]
    parser = argparse.ArgumentParser(description="Convert FBX to VRM")
    parser.add_argument("input", help="Path to input FBX file")
    parser.add_argument("output", help="Path to output VRM file")
    parser.add_argument("--mapping", help="Path to bone mapping JSON file", default=None)
    return parser.parse_args(args)

# ──────────────────────── VRM humanoid bone definitions ────────────────────────

# Required VRM humanoid bones (minimum set for a valid humanoid)
REQUIRED_BONES = [
    "hips", "spine", "chest", "neck", "head",
    "leftUpperArm", "leftLowerArm", "leftHand",
    "rightUpperArm", "rightLowerArm", "rightHand",
    "leftUpperLeg", "leftLowerLeg", "leftFoot",
    "rightUpperLeg", "rightLowerLeg", "rightFoot",
]

# Optional VRM humanoid bones
OPTIONAL_BONES = [
    "upperChest", "leftShoulder", "rightShoulder",
    "leftToes", "rightToes",
    "leftEye", "rightEye", "jaw",
    # fingers omitted for brevity — add if needed
]

# ──────────────────────── Auto bone-name mapping ────────────────────────

# Patterns: VRM bone name → regex matching common rig conventions
BONE_PATTERNS = {
    "hips":          re.compile(r"^(mixamorig:?Hips|.*\bhips?\b.*)$", re.I),
    "spine":         re.compile(r"^(mixamorig:?Spine|.*\bspine\b(?!.*[12]).*)$", re.I),
    "chest":         re.compile(r"^(mixamorig:?Spine2|.*\b(chest|spine2)\b.*)$", re.I),
    "upperChest":    re.compile(r"^(.*\b(upper.?chest|spine3)\b.*)$", re.I),
    "neck":          re.compile(r"^(mixamorig:?Neck|.*\bneck\b.*)$", re.I),
    "head":          re.compile(r"^(mixamorig:?Head|.*\bhead\b(?!.*top).*)$", re.I),
    "leftShoulder":  re.compile(r"^(mixamorig:?LeftShoulder|.*\b(left|l)[._ ]?shoulder\b.*)$", re.I),
    "leftUpperArm":  re.compile(r"^(mixamorig:?LeftArm|.*\b(left|l)[._ ]?(upper.?arm|arm)\b(?!.*fore).*)$", re.I),
    "leftLowerArm":  re.compile(r"^(mixamorig:?LeftForeArm|.*\b(left|l)[._ ]?(lower.?arm|fore.?arm)\b.*)$", re.I),
    "leftHand":      re.compile(r"^(mixamorig:?LeftHand|.*\b(left|l)[._ ]?hand\b(?!.*(thumb|index|middle|ring|pinky)).*)$", re.I),
    "rightShoulder": re.compile(r"^(mixamorig:?RightShoulder|.*\b(right|r)[._ ]?shoulder\b.*)$", re.I),
    "rightUpperArm": re.compile(r"^(mixamorig:?RightArm|.*\b(right|r)[._ ]?(upper.?arm|arm)\b(?!.*fore).*)$", re.I),
    "rightLowerArm": re.compile(r"^(mixamorig:?RightForeArm|.*\b(right|r)[._ ]?(lower.?arm|fore.?arm)\b.*)$", re.I),
    "rightHand":     re.compile(r"^(mixamorig:?RightHand|.*\b(right|r)[._ ]?hand\b(?!.*(thumb|index|middle|ring|pinky)).*)$", re.I),
    "leftUpperLeg":  re.compile(r"^(mixamorig:?LeftUpLeg|.*\b(left|l)[._ ]?(upper.?leg|up.?leg|thigh)\b.*)$", re.I),
    "leftLowerLeg":  re.compile(r"^(mixamorig:?LeftLeg|.*\b(left|l)[._ ]?(lower.?leg|leg|shin|calf)\b(?!.*up).*)$", re.I),
    "leftFoot":      re.compile(r"^(mixamorig:?LeftFoot|.*\b(left|l)[._ ]?foot\b.*)$", re.I),
    "leftToes":      re.compile(r"^(mixamorig:?LeftToeBase|.*\b(left|l)[._ ]?toe\b.*)$", re.I),
    "rightUpperLeg": re.compile(r"^(mixamorig:?RightUpLeg|.*\b(right|r)[._ ]?(upper.?leg|up.?leg|thigh)\b.*)$", re.I),
    "rightLowerLeg": re.compile(r"^(mixamorig:?RightLeg|.*\b(right|r)[._ ]?(lower.?leg|leg|shin|calf)\b(?!.*up).*)$", re.I),
    "rightFoot":     re.compile(r"^(mixamorig:?RightFoot|.*\b(right|r)[._ ]?foot\b.*)$", re.I),
    "rightToes":     re.compile(r"^(mixamorig:?RightToeBase|.*\b(right|r)[._ ]?toe\b.*)$", re.I),
}


def auto_map_bones(bone_names):
    """Try to auto-map source bone names to VRM humanoid bone names."""
    mapping = {}
    for vrm_bone, pattern in BONE_PATTERNS.items():
        for src_name in bone_names:
            if pattern.match(src_name):
                mapping[vrm_bone] = src_name
                break
    return mapping


def load_manual_mapping(path):
    """Load a JSON bone mapping file. Ignores keys starting with '_'."""
    with open(path, "r") as f:
        raw = json.load(f)
    return {k: v for k, v in raw.items() if not k.startswith("_") and v}


# ──────────────────────── GLB VRM injection ────────────────────────

def find_bone_node_index(gltf_json, bone_name):
    """Find the glTF node index for a bone by name."""
    for i, node in enumerate(gltf_json.get("nodes", [])):
        if node.get("name") == bone_name:
            return i
    return None


def inject_vrm_extensions(glb_path, bone_mapping, armature_name):
    """Post-process a GLB file to inject VRM humanoid extension data.

    This makes @pixiv/three-vrm recognize the file as a VRM avatar.
    Uses VRMC_vrm 1.0 format.
    """
    with open(glb_path, "rb") as f:
        data = f.read()

    # Parse GLB header
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "Not a valid GLB file"
    assert version == 2, f"Unexpected GLB version: {version}"

    # Parse JSON chunk
    json_chunk_length, json_chunk_type = struct.unpack_from("<II", data, 12)
    assert json_chunk_type == 0x4E4F534A, "First chunk is not JSON"
    json_bytes = data[20:20 + json_chunk_length]
    gltf = json.loads(json_bytes.decode("utf-8"))

    # Binary chunk (everything after JSON chunk)
    bin_offset = 20 + json_chunk_length
    bin_chunk = data[bin_offset:]

    # Build VRM humanoid bone list
    human_bones = {}
    for vrm_bone, src_bone in bone_mapping.items():
        node_idx = find_bone_node_index(gltf, src_bone)
        if node_idx is not None:
            human_bones[vrm_bone] = {"node": node_idx}

    # VRMC_vrm extension
    vrm_ext = {
        "specVersion": "1.0",
        "meta": {
            "name": "User-Provided Licensed Avatar",
            "version": "1.0",
            "authors": ["User-provided licensed asset"],
            "contactInformation": "",
            "references": [],
            "thirdPartyLicenses": "",
            "thumbnailImage": None,
            "licenseUrl": "https://vrm.dev/licenses/1.0/",
            "avatarPermission": "onlyAuthor",
            "allowExcessivelyViolentUsage": False,
            "allowExcessivelySexualUsage": False,
            "commercialUsage": "personalNonProfit",
            "allowPoliticalOrReligiousUsage": False,
            "allowAntisocialOrHateUsage": False,
            "creditNotation": "required",
            "allowRedistribution": False,
            "modification": "prohibited",
        },
        "humanoid": {
            "humanBones": human_bones,
        },
    }

    # Add extension to glTF
    if "extensions" not in gltf:
        gltf["extensions"] = {}
    gltf["extensions"]["VRMC_vrm"] = vrm_ext

    if "extensionsUsed" not in gltf:
        gltf["extensionsUsed"] = []
    if "VRMC_vrm" not in gltf["extensionsUsed"]:
        gltf["extensionsUsed"].append("VRMC_vrm")

    # Rebuild GLB
    new_json = json.dumps(gltf, ensure_ascii=False, separators=(",", ":"))
    json_encoded = new_json.encode("utf-8")
    # GLB spec: JSON chunk must be padded to 4-byte alignment with spaces
    padding = (4 - len(json_encoded) % 4) % 4
    json_encoded += b" " * padding

    # Assemble new GLB
    new_json_chunk_length = len(json_encoded)
    total_length = 12 + 8 + new_json_chunk_length + len(bin_chunk)

    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total_length)  # header
    out += struct.pack("<II", new_json_chunk_length, 0x4E4F534A)  # JSON chunk header
    out += json_encoded
    out += bin_chunk

    return bytes(out)


# ──────────────────────── Main ────────────────────────

def main():
    args = parse_args()

    fbx_path = os.path.abspath(args.input)
    out_path = os.path.abspath(args.output)

    if not os.path.isfile(fbx_path):
        print(f"ERROR: Input FBX not found: {fbx_path}")
        sys.exit(1)

    # Create output directory if needed
    out_dir = os.path.dirname(out_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
        print(f"Created output directory: {out_dir}")

    # ── Step 1: Import FBX ──
    print(f"\n{'='*60}")
    print(f"Importing FBX: {fbx_path}")
    print(f"{'='*60}\n")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path, use_image_search=True)

    # ── Step 2: Discover armatures and bones ──
    armatures = [ob for ob in bpy.data.objects if ob.type == "ARMATURE"]

    if not armatures:
        print("ERROR: No armature found in FBX. Cannot create VRM.")
        print("Available objects:")
        for ob in bpy.data.objects:
            print(f"  {ob.type}: {ob.name}")
        sys.exit(1)

    armature = armatures[0]
    bone_names = [b.name for b in armature.data.bones]

    print(f"Armature: {armature.name}")
    print(f"Bones ({len(bone_names)}):")
    for name in bone_names:
        print(f"  {name}")

    # ── Step 3: Build bone mapping ──
    auto_mapping = auto_map_bones(bone_names)
    print(f"\nAuto-mapped {len(auto_mapping)} bones:")
    for vrm_bone, src_bone in sorted(auto_mapping.items()):
        print(f"  {vrm_bone} → {src_bone}")

    # Load manual mapping override if provided
    if args.mapping:
        if not os.path.isfile(args.mapping):
            print(f"ERROR: Mapping file not found: {args.mapping}")
            sys.exit(1)
        manual = load_manual_mapping(args.mapping)
        print(f"\nManual mapping overrides ({len(manual)}):")
        for vrm_bone, src_bone in sorted(manual.items()):
            print(f"  {vrm_bone} → {src_bone}")
        auto_mapping.update(manual)

    # Check required bones
    missing = [b for b in REQUIRED_BONES if b not in auto_mapping]
    if missing:
        print(f"\n⚠ WARNING: Missing {len(missing)} required VRM humanoid bones:")
        for b in missing:
            print(f"  - {b}")
        print("\nAvailable source bone names (for manual mapping):")
        for name in bone_names:
            print(f"  {name}")
        print("\nCreate a mapping JSON file and pass it with --mapping")
        print("The VRM will be created but may not drive correctly.")

    # Validate that mapped bone names exist in the armature
    final_mapping = {}
    for vrm_bone, src_bone in auto_mapping.items():
        if src_bone in bone_names:
            final_mapping[vrm_bone] = src_bone
        else:
            print(f"⚠ Mapped bone '{vrm_bone}' → '{src_bone}' not found in armature, skipping")

    print(f"\nFinal mapping ({len(final_mapping)} bones):")
    for vrm_bone, src_bone in sorted(final_mapping.items()):
        tag = "✓" if vrm_bone in REQUIRED_BONES else "○"
        print(f"  {tag} {vrm_bone} → {src_bone}")

    # ── Step 4: Pack textures ──
    print("\nPacking textures into blend file...")
    packed = 0
    for img in bpy.data.images:
        if img.source == "FILE" and not img.packed_file:
            try:
                img.pack()
                packed += 1
                print(f"  Packed: {img.name} ({img.size[0]}×{img.size[1]})")
            except Exception as e:
                print(f"  ⚠ Failed to pack {img.name}: {e}")

    # Also try to find and load textures from the texture directory
    fbx_dir = os.path.dirname(fbx_path)
    tex_dir = os.path.join(os.path.dirname(fbx_dir), "textures")
    if os.path.isdir(tex_dir):
        print(f"\nFound texture directory: {tex_dir}")
        for mat in bpy.data.materials:
            if not mat.node_tree:
                continue
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    img = node.image
                    if not img.has_data or img.size[0] == 0:
                        # Try to find texture in the tex_dir
                        basename = os.path.basename(img.filepath)
                        if not basename:
                            basename = img.name
                        tex_path = os.path.join(tex_dir, basename)
                        if os.path.isfile(tex_path):
                            print(f"  Loading missing texture: {basename}")
                            img.filepath = tex_path
                            img.reload()
                            if not img.packed_file:
                                img.pack()
                                packed += 1

    print(f"Total textures packed: {packed}")

    # ── Step 5: Export GLB ──
    # Temporary GLB path (will be post-processed)
    tmp_glb = out_path + ".tmp.glb"

    print(f"\nExporting GLB: {tmp_glb}")
    bpy.ops.export_scene.gltf(
        filepath=tmp_glb,
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

    if not os.path.isfile(tmp_glb):
        print("ERROR: GLB export failed — file not created")
        sys.exit(1)

    glb_size = os.path.getsize(tmp_glb)
    print(f"GLB exported: {glb_size:,} bytes")

    # ── Step 6: Inject VRM extensions ──
    print("\nInjecting VRM humanoid extension data...")
    vrm_data = inject_vrm_extensions(tmp_glb, final_mapping, armature.name)

    # Write final VRM
    with open(out_path, "wb") as f:
        f.write(vrm_data)

    # Clean up temp file
    os.remove(tmp_glb)

    vrm_size = os.path.getsize(out_path)
    print(f"\n{'='*60}")
    print(f"VRM written: {out_path}")
    print(f"Size: {vrm_size:,} bytes")
    print(f"Mapped bones: {len(final_mapping)}/{len(REQUIRED_BONES)} required")
    if missing:
        print(f"Missing required: {', '.join(missing)}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
