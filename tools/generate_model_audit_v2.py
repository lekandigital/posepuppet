#!/usr/bin/env python3
"""Generate PosePuppet model audit V2 implementation handoff artifacts."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path


AUDIT_SCHEMA = "posepuppet-avatar-audit-v2.implementation-bridge"
ADAPTER_SCHEMA = "posepuppet-avatar-adapter-spec-v1"
SOURCE_LOCK_SCHEMA = "posepuppet-source-lock-v1"

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

POSES = [
    "neutral",
    "arms_up",
    "arms_forward",
    "elbow_bend",
    "wrist_rotate",
    "hand_to_cheek",
    "hand_to_mouth",
    "knee_bend",
    "foot_lift",
    "foot_rotate",
    "finger_curl",
]

CREATURE_SLUGS = {"godzilla", "king-kong", "xenomorph", "grogu", "olaf", "baby-yoda"}
HAND_ONLY_SLUGS = {"rigged-hand"}
OFFSET_SLUGS = {"elsa", "buzz-lightyear", "teal-v2", "jack-sparrow"}

PRIORITY = {
    "woody": 1,
    "darth-vader": 2,
    "fortnite-batman": 3,
    "iron-man": 4,
    "shrek": 5,
    "spider-man-no-way-home": 6,
    "spider-man-playstation": 7,
    "amazing-spider-man-2": 8,
    "terminator-t-800": 9,
    "jack-sparrow": 10,
    "elsa": 11,
    "grogu": 12,
    "king-kong": 13,
    "olaf": 14,
    "godzilla": 15,
    "xenomorph": 16,
    "rigged-hand": 17,
    "teal-v2": 18,
    "buzz-lightyear": 19,
    "baby-yoda": 20,
}

DISPLAY_OVERRIDES = {
    "woody": "Woody",
    "darth-vader": "Darth Vader",
    "fortnite-batman": "Fortnite Batman",
    "iron-man": "Iron Man",
    "shrek": "Shrek",
    "spider-man-no-way-home": "Spider-Man No Way Home",
    "spider-man-playstation": "Spider-Man PlayStation",
    "amazing-spider-man-2": "The Amazing Spider-Man 2",
    "terminator-t-800": "Terminator T-800",
    "jack-sparrow": "Jack Sparrow",
    "elsa": "Elsa",
    "buzz-lightyear": "Buzz Lightyear",
    "teal-v2": "Teal v2",
    "rigged-hand": "Rigged Hand",
    "baby-yoda": "Baby Yoda",
    "grogu": "Grogu",
    "godzilla": "Godzilla",
    "king-kong": "King Kong",
    "olaf": "Olaf",
    "xenomorph": "Xenomorph",
}

APPEARANCE_NOTES = {
    "woody": {
        "silhouette": "Humanoid toy/cowboy silhouette inferred from the Woody source path, Mixamo humanoid skeleton, and mesh/texture names.",
        "proportions": "Tall toy-proportioned body with broad T-pose arm span; expect shoulder and wrist offset testing before confident face-touch.",
        "geometry": ["separate hat piping mesh", "body mesh", "handkerchief mesh", "plastic/boot/accessory material mesh", "skin mesh", "eye texture mesh"],
        "surface": ["hat", "cowboy body/clothes", "handkerchief", "boots/plastic parts", "skin", "eyes"],
        "textures": [
            "_hat_piping_d.png",
            "_woodybody_high_d.png",
            "_woodyhankerchief_high_d.png",
            "_woodyplastic_high_d.png",
            "eye_uv_new.png",
            "woodyskin_d_high.png",
        ],
        "sensitive": ["hat/head attachment", "shoulders", "elbows", "wrists", "boot/foot orientation"],
    },
    "darth-vader": {
        "silhouette": "Armored humanoid with robe/cape-like and rigid accessory risks from many meshes and a Rigify-style control rig.",
        "proportions": "Conventional full-body humanoid proportions.",
        "geometry": ["many separate meshes/control widgets", "helmet/armor", "cape or robe-like surfaces"],
        "surface": ["dark armor", "helmet", "cape/robe surfaces"],
        "textures": ["texture-heavy but browser-manageable after VRM validation"],
        "sensitive": ["cape/robe deformation", "shoulders", "wrist orientation", "finger mapping"],
    },
    "fortnite-batman": {
        "silhouette": "Armored caped humanoid with full Rigify-style body and finger structure.",
        "proportions": "Conventional heroic humanoid proportions.",
        "geometry": ["cape", "armor", "helmet/cowl", "many control widgets"],
        "surface": ["armor", "cape", "cowl"],
        "textures": ["moderate texture/material set"],
        "sensitive": ["cape clipping", "shoulders", "wrist orientation", "finger mapping"],
    },
    "iron-man": {
        "silhouette": "Rigid armored humanoid, likely easier for body tracking than cloth-heavy characters but sensitive to joint axes.",
        "proportions": "Conventional full-body humanoid proportions.",
        "geometry": ["armor plates", "helmet", "rigid limb parts"],
        "surface": ["metal/armor materials"],
        "textures": ["moderate texture/material set"],
        "sensitive": ["shoulders", "wrists", "mechanical finger bend", "ankle/foot orientation"],
    },
    "shrek": {
        "silhouette": "Large stylized humanoid with Source/ValveBiped body rig and facial bones.",
        "proportions": "Broad body with nonstandard stylized proportions.",
        "geometry": ["body mesh", "head mesh", "facial bone rig"],
        "surface": ["simple clothing/body materials"],
        "textures": ["moderate texture set"],
        "sensitive": ["single-bone fingers", "facial bones", "scale normalization", "jaw/mouth targets"],
    },
    "elsa": {
        "silhouette": "Stylized upper-body humanoid with useful head/face/hand bones but missing leg and foot mapping in the selected source.",
        "proportions": "Tall stylized character with orientation/scale oddities in bounds.",
        "geometry": ["upper body", "face bones", "hand/palm bones", "unskinned extra mesh"],
        "surface": ["dress/body mesh", "face/hair region"],
        "textures": ["small texture set"],
        "sensitive": ["custom mapping", "leg absence", "palm/thumb-only hands", "mouth/cheek target estimation"],
    },
    "buzz-lightyear": {
        "silhouette": "Low-poly toy/space-suit humanoid source with generic Bone.* naming that defeats automatic humanoid mapping.",
        "proportions": "Broad toy proportions; hierarchy inspection is needed before discarding.",
        "geometry": ["single mesh", "low poly body", "generic bone hierarchy"],
        "surface": ["toy suit surfaces"],
        "textures": ["small texture set"],
        "sensitive": ["manual bone mapping", "unknown hands/feet", "source hierarchy"],
    },
    "rigged-hand": {
        "silhouette": "Single right-hand/finger test asset, not a full avatar.",
        "proportions": "Hand-only proportions.",
        "geometry": ["one skinned hand mesh", "right finger control/deform chains"],
        "surface": ["hand material"],
        "textures": ["small hand texture set"],
        "sensitive": ["finger curl axes", "right-hand-only assumptions"],
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def title_for_slug(slug: str) -> str:
    return DISPLAY_OVERRIDES.get(slug, " ".join(part.capitalize() for part in slug.split("-")))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_zip_chain(zip_path: Path, entries: list[str]) -> bytes:
    data = zip_path.read_bytes()
    for entry in entries:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            data = archive.read(entry)
    return data


def source_root_for(repo_root: Path) -> Path:
    for name in ["ModelsForAnimation", "models_for_animation"]:
        candidate = repo_root / name
        if candidate.exists():
            return candidate
    return repo_root / "ModelsForAnimation"


def resolve_display_path(display: str, repo_root: Path) -> Path:
    path = Path(display)
    if path.is_absolute():
        return path
    return source_root_for(repo_root) / display


def hash_display_source(display: str, repo_root: Path, source_zip: str = "") -> dict:
    if not display:
        return {"sha256": "", "size": 0, "mtime": "", "status": "missing", "path": ""}
    if "!/" in display:
        zip_part, *entries = display.split("!/")
        zip_path = Path(source_zip) if source_zip else resolve_display_path(zip_part, repo_root)
        if not zip_path.exists():
            return {"sha256": "", "size": 0, "mtime": "", "status": "missing", "path": str(zip_path)}
        data = read_zip_chain(zip_path, entries)
        return {
            "sha256": sha256_bytes(data),
            "size": len(data),
            "mtime": datetime.fromtimestamp(zip_path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat(),
            "status": "fresh",
            "path": str(zip_path),
        }
    path = resolve_display_path(display, repo_root)
    if not path.exists():
        return {"sha256": "", "size": 0, "mtime": "", "status": "missing", "path": str(path)}
    stat = path.stat()
    return {
        "sha256": sha256_file(path),
        "size": stat.st_size,
        "mtime": datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat(),
        "status": "fresh",
        "path": str(path),
    }


def parse_source_files(path: Path) -> dict:
    data = {"runtime_glb": "", "variants": []}
    if not path.exists():
        return data
    for line in path.read_text(errors="ignore").splitlines():
        if line.startswith("Runtime GLB companion:"):
            value = line.split(":", 1)[1].strip()
            data["runtime_glb"] = "" if value == "none" else value
        if line.startswith("- `"):
            match = re.match(r"- `(.+?)`", line)
            if match:
                data["variants"].append(match.group(1))
    return data


def normalized_profile(audit: dict) -> str:
    slug = audit["model"]["slug"]
    raw = audit.get("posepuppet_capabilities", {}).get("recommended_runtime_profile", "")
    if slug in CREATURE_SLUGS or raw == "creature":
        return "creature"
    if slug in HAND_ONLY_SLUGS or raw == "hand-only":
        return "hand_only"
    if slug in OFFSET_SLUGS or raw in {"humanoid-with-offsets", "humanoid_with_offsets"}:
        return "humanoid_with_offsets"
    if raw == "reject":
        return "static_preview"
    return "humanoid"


def model_action(audit: dict) -> tuple[str, str, str]:
    slug = audit["model"]["slug"]
    score = audit.get("scores", {}).get("overall", 0)
    profile = normalized_profile(audit)
    if slug in HAND_ONLY_SLUGS:
        return "hand_test_only", "hand_test_only", "Use only for hand/finger experiments; it is not a full avatar."
    if profile == "creature":
        return "custom_profile", "custom_profile", "Nonstandard anatomy should not be forced into standard humanoid full-body mode."
    if slug in {"buzz-lightyear", "teal-v2"}:
        return "cleanup_then_convert", "cleanup_then_convert", "Automatic mapping is too weak; inspect hierarchy and create a manual map first."
    if score >= 70:
        return "convert_then_test", "convert_then_enable", "Good structural candidate, but runtime load and deformation tests are still required."
    if score >= 45:
        return "cleanup_then_convert", "cleanup_then_convert", "Partial structure exists, but cleanup or custom mapping is needed first."
    return "ignore_for_now", "ignore_for_now", "Current automated evidence is too weak for near-term runtime work."


def runtime_weight(audit: dict) -> str:
    geom = audit.get("geometry", {})
    scene = audit.get("scene", {})
    tri = int(geom.get("triangle_count") or 0)
    meshes = int(scene.get("mesh_count") or 0)
    textures = int(scene.get("texture_count") or 0)
    if tri > 100000 or meshes > 250 or textures > 50:
        return "very_heavy"
    if tri > 45000 or meshes > 100 or textures > 25:
        return "heavy"
    if tri > 12000 or meshes > 20 or textures > 8:
        return "medium"
    return "light"


def conversion_command(audit: dict) -> str:
    slug = audit["model"]["slug"]
    source = audit["model"].get("selected_source_path", "")
    target = f"public/avatars/{slug}.vrm"
    if slug == "woody":
        return (
            "/Applications/Blender.app/Contents/MacOS/Blender \\\n"
            "  -b \\\n"
            "  --python tools/export_fbx_to_vrm.py \\\n"
            '  -- "/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx" \\\n'
            "  public/avatars/woody.vrm"
        )
    if audit["model"].get("selected_source_format") == "fbx" and "!/" not in source:
        return (
            "/Applications/Blender.app/Contents/MacOS/Blender \\\n"
            "  -b \\\n"
            "  --python tools/export_fbx_to_vrm.py \\\n"
            f'  -- "{source}" \\\n'
            f"  {target}"
        )
    return (
        "# Extract/open the selected source in Blender, verify humanoid mapping, then export VRM.\n"
        f"# Selected source: {source}\n"
        f"# Target path: {target}"
    )


def control_sets(audit: dict) -> tuple[list[str], list[str]]:
    caps = audit.get("posepuppet_capabilities", {})
    profile = normalized_profile(audit)
    enabled: list[str] = []
    disabled: list[str] = []
    if profile == "creature":
        enabled = ["creature_head"]
        if caps.get("hands") in {"good", "partial"}:
            enabled.append("arms")
        if caps.get("legs") in {"good", "partial"}:
            enabled.append("legs")
        if audit.get("face", {}).get("jaw_bone"):
            enabled.append("creature_jaw")
        disabled = ["standard_humanoid_full_body", "fingers", "facial_expressions", "face_touch"]
    elif profile == "hand_only":
        enabled = ["hands"]
        if caps.get("fingers") != "missing":
            enabled.append("fingers")
        disabled = ["upper_body", "torso", "head", "arms", "legs", "root_motion", "feet", "toes", "face_touch", "facial_expressions"]
    elif profile == "static_preview":
        enabled = ["static_preview"]
        disabled = ["upper_body", "torso", "head", "arms", "legs", "root_motion", "hands", "fingers", "feet", "toes", "face_touch", "facial_expressions"]
    else:
        enabled = ["upper_body", "head", "arms"]
        if caps.get("legs") in {"good", "partial"}:
            enabled.append("legs")
        enabled.append("hands")
        if caps.get("feet") in {"good", "partial"}:
            enabled.append("feet")
        if caps.get("fingers") == "good":
            enabled.append("fingers")
        if caps.get("toes") == "good":
            enabled.append("toes")
        if profile == "humanoid" and caps.get("legs") in {"good", "partial"}:
            enabled.append("root_motion")
        for control, cap in [
            ("fingers", caps.get("fingers")),
            ("feet", caps.get("feet")),
            ("toes", caps.get("toes")),
            ("facial_expressions", caps.get("facial_expressions")),
        ]:
            if cap in {"missing", "poor"} and control not in disabled:
                disabled.append(control)
        disabled.append("face_touch")
        if caps.get("facial_expressions") != "good":
            disabled.append("facial_expressions")
    return sorted(dict.fromkeys(enabled)), sorted(dict.fromkeys(disabled))


def finger_mode(audit: dict) -> str:
    support = audit.get("hands", {}).get("finger_support") or audit.get("posepuppet_capabilities", {}).get("fingers")
    if normalized_profile(audit) == "hand_only":
        return "curl_presets"
    if support == "good":
        return "full_finger_retargeting"
    if support in {"partial", "poor"}:
        return "curl_presets"
    if audit.get("posepuppet_capabilities", {}).get("hands") in {"good", "partial"}:
        return "palm_only"
    return "none"


def face_touch_mode(audit: dict) -> str:
    caps = audit.get("posepuppet_capabilities", {})
    if normalized_profile(audit) in {"creature", "hand_only", "static_preview"}:
        return "none"
    if caps.get("face_touch") in {"good", "possible_with_ik"}:
        return "ik_required"
    if caps.get("face_touch") == "limited":
        return "estimated_targets_only"
    return "none"


def risk_level(audit: dict) -> str:
    action, _status, _why = model_action(audit)
    score = audit.get("scores", {}).get("overall", 0)
    if action in {"custom_profile", "cleanup_then_convert", "ignore_for_now"}:
        return "high"
    if score >= 85:
        return "medium"
    if score >= 70:
        return "medium"
    return "high"


def appearance_descriptor(audit: dict) -> dict:
    slug = audit["model"]["slug"]
    geom = audit.get("geometry", {})
    scene = audit.get("scene", {})
    default = {
        "silhouette": f"{title_for_slug(slug)} source has a {normalized_profile(audit)} technical profile based on scripted rig and geometry evidence.",
        "proportions": "Proportions were inferred from bounds only; visual contact sheets were not generated.",
        "geometry": (geom.get("mesh_names") or [])[:8],
        "surface": [f"{scene.get('material_count', 0)} materials", f"{scene.get('texture_count', 0)} textures"],
        "textures": ["Texture presence is measured, but image content was not visually reviewed."],
        "sensitive": ["orientation", "scale", "shoulders/wrists if humanoid", "unsupported controls"],
    }
    note = APPEARANCE_NOTES.get(slug, default)
    return {
        "character_silhouette": note["silhouette"],
        "body_proportions": note["proportions"],
        "notable_geometry": note["geometry"],
        "clothing_or_surface_parts": note["surface"],
        "materials_summary": [f"{scene.get('material_count', 0)} materials", f"{scene.get('texture_count', 0)} textures"],
        "texture_notes": note["textures"],
        "likely_deformation_sensitive_areas": note["sensitive"],
        "caption_confidence": "medium" if slug in APPEARANCE_NOTES else "low",
        "evidence_used": ["scripted Blender audit", "file/mesh/material/texture names", "bounds", "bone mapping"],
        "understanding_method": {
            "scripted_facts_used": True,
            "llm_reasoning_used": True,
            "screenshots_required": False,
            "optional_visual_observation_used": False,
            "notes": "This descriptor is text-only so future coding agents do not need to inspect screenshots or large model binaries.",
        },
    }


def bone_map_confidence(audit: dict) -> dict:
    mapping = audit.get("humanoid_mapping", {})
    required_groups = {
        "hips": ["hips"],
        "spine": ["spine"],
        "chest": ["chest"],
        "neck": ["neck"],
        "head": ["head"],
        "arms": ["leftUpperArm", "leftLowerArm", "rightUpperArm", "rightLowerArm"],
        "legs": ["leftUpperLeg", "leftLowerLeg", "rightUpperLeg", "rightLowerLeg"],
        "hands": ["leftHand", "rightHand"],
        "fingers": [],
        "feet": ["leftFoot", "rightFoot"],
        "toes": ["leftToes", "rightToes"],
        "face": ["jaw", "leftEye", "rightEye"],
    }
    hands = audit.get("hands", {})
    if hands.get("finger_support") in {"good", "partial", "poor"}:
        required_groups["fingers"] = ["leftHand", "rightHand"]
    out = {}
    missing_count = 0
    for group, keys in required_groups.items():
        if not keys:
            value = "missing"
        elif all(mapping.get(key) for key in keys):
            value = "exact"
        elif any(mapping.get(key) for key in keys):
            value = "guessed"
        else:
            value = "missing"
        missing_count += value == "missing"
        out[group] = value
    out["overall"] = "high" if missing_count <= 2 else "medium" if missing_count <= 5 else "low"
    out["confidence_notes"] = [
        "Confidence is based on scripted bone-name and hierarchy mapping, not a visual retargeting run."
    ]
    return out


def finger_drive_plan(audit: dict) -> dict:
    hands = audit.get("hands", {})
    mode = finger_mode(audit)
    def side(which: str) -> dict:
        chains = hands.get(f"{which}_finger_chains", {}) or {}
        values = {}
        for finger in ["thumb", "index", "middle", "ring", "pinky"]:
            depth = len(chains.get(finger, []))
            if depth >= 3 and mode == "full_finger_retargeting":
                values[finger] = "direct"
            elif depth > 0:
                values[finger] = "curl_only"
            else:
                values[finger] = "missing"
        return values
    left_chains = hands.get("left_finger_chains", {}) or {}
    right_chains = hands.get("right_finger_chains", {}) or {}
    return {
        "left": side("left"),
        "right": side("right"),
        "left_chain_depths": {key: len(value) for key, value in left_chains.items()},
        "right_chain_depths": {key: len(value) for key, value in right_chains.items()},
        "left_right_symmetry": "good" if bool(left_chains) == bool(right_chains) else "partial",
        "deform_vs_control_notes": ["Prefer deform bones over control/helper bones when both are present."],
        "recommended_mode": mode,
    }


def source_selection(audit: dict, source_meta: dict) -> dict:
    model = audit["model"]
    selected = model.get("selected_source_path", "")
    runtime = source_meta.get("runtime_glb", "")
    variants = source_meta.get("variants") or model.get("source_paths", [])
    do_not = [item for item in variants if item not in {selected, runtime}]
    ext = model.get("selected_source_format", "")
    reason = "Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb."
    if model["slug"] == "woody":
        reason = "Use the explicit Woody FBX source requested for conversion; keep the GLB as reference only."
    return {
        "best_source_for_audit": selected,
        "best_source_for_conversion": selected,
        "runtime_glb_companion": runtime,
        "source_format_priority_reasoning": f"{ext} selected. {reason}",
        "do_not_use_variants": do_not,
        "duplicate_variants": [item for item in variants if re.search(r"\\(\\d+\\)", item)],
        "reasoning": reason,
    }


def source_lock_for(audit: dict, repo_root: Path, source_meta: dict, created_at: str) -> dict:
    model = audit["model"]
    selected = model.get("selected_source_path", "")
    selected_hash = hash_display_source(selected, repo_root, model.get("source_zip", ""))
    runtime_ref = source_meta.get("runtime_glb", "")
    runtime_hash = hash_display_source(runtime_ref, repo_root, "") if runtime_ref else {"sha256": "", "size": 0, "status": "fresh"}
    return {
        "slug": model["slug"],
        "display_name": model["name"],
        "selected_source": selected,
        "selected_source_sha256": selected_hash["sha256"],
        "selected_source_size_bytes": selected_hash["size"],
        "selected_source_mtime": selected_hash["mtime"],
        "source_zip": model.get("source_zip", ""),
        "runtime_glb_reference": runtime_ref,
        "runtime_glb_sha256": runtime_hash["sha256"],
        "runtime_glb_size_bytes": runtime_hash["size"],
        "target_vrm_path": f"public/avatars/{model['slug']}.vrm",
        "audit_generated_at": created_at,
        "audit_schema_version": AUDIT_SCHEMA,
        "adapter_spec_schema_version": ADAPTER_SCHEMA,
        "tool_versions": {},
        "audit_status": "source_missing" if selected_hash["status"] == "missing" else "fresh",
    }


def retargeting_simulation(audit: dict) -> dict:
    profile = normalized_profile(audit)
    if profile == "creature":
        verdict = "custom_profile"
    elif profile == "hand_only":
        verdict = "not_attempted"
    elif model_action(audit)[0] == "cleanup_then_convert":
        verdict = "needs_cleanup"
    else:
        verdict = "needs_offsets"
    return {
        "schema_version": "posepuppet-retargeting-simulation-v1",
        "created_at": utc_now(),
        "avatar_id": audit["model"]["slug"],
        "synthetic_pose_tests": {
            pose: {
                "applied": False,
                "result": "not_tested",
                "measured_notes": [],
                "visual_review": "not_available",
                "reasoning_notes": [
                    "No synthetic pose or visual deformation pass was completed; treat runtime deformation as unverified."
                ],
            }
            for pose in POSES
        },
        "overall_retargeting_simulation_verdict": verdict,
        "notes": ["Scripted structure was audited; mobility/contact-sheet review remains a follow-up task."],
    }


def conversion_diff(audit: dict, model_dir: Path) -> dict:
    slug = audit["model"]["slug"]
    source = audit["model"].get("selected_source_path", "")
    target = f"public/avatars/{slug}.vrm"
    base = {
        "status": "not_attempted",
        "source_path": source,
        "converted_vrm_path": target,
        "skeleton_preserved": "unknown",
        "humanoid_mapping_preserved": "unknown",
        "mesh_count_before": audit.get("scene", {}).get("mesh_count", 0),
        "mesh_count_after": 0,
        "material_count_before": audit.get("scene", {}).get("material_count", 0),
        "material_count_after": 0,
        "texture_result": "not_attempted",
        "scale_changed": "unknown",
        "orientation_changed": "unknown",
        "fingers_preserved": "unknown",
        "feet_preserved": "unknown",
        "shape_keys_preserved": "unknown",
        "posepuppet_runtime_candidate": model_action(audit)[0] in {"convert_then_test", "cleanup_then_convert"},
        "blockers": ["VRM conversion and re-audit were not completed for this model."],
        "notes": [conversion_command(audit)],
    }
    if slug == "woody":
        runtime_audit_path = model_dir / "runtime-vrm" / "audit.json"
        if runtime_audit_path.exists():
            runtime = json.loads(runtime_audit_path.read_text())
            base.update(
                {
                    "status": "completed",
                    "skeleton_preserved": "yes" if runtime.get("rig", {}).get("bone_count") == audit.get("rig", {}).get("bone_count") else "partial",
                    "humanoid_mapping_preserved": "yes",
                    "mesh_count_after": runtime.get("scene", {}).get("mesh_count", 0),
                    "material_count_after": runtime.get("scene", {}).get("material_count", 0),
                    "texture_result": "embedded",
                    "scale_changed": "yes",
                    "orientation_changed": "unknown",
                    "fingers_preserved": "not_applicable",
                    "feet_preserved": "yes",
                    "shape_keys_preserved": "not_applicable",
                    "posepuppet_runtime_candidate": True,
                    "blockers": ["three-vrm and PosePuppet runtime load tests are still not attempted."],
                    "notes": [
                        "Local ignored public/avatars/woody.vrm was re-opened with Blender and compared to the FBX audit.",
                        "Mesh count changed because the converted VRM contains one extra unskinned mesh; humanoid skeleton and feet remained usable.",
                    ],
                }
            )
    return {"conversion_diff": base}


def runtime_test(audit: dict, conv: dict) -> dict:
    slug = audit["model"]["slug"]
    source_converts = "pass" if conv["conversion_diff"]["status"] == "completed" else "not_attempted"
    caps = audit.get("posepuppet_capabilities", {})
    return {
        "source_converts_to_vrm": source_converts,
        "vrm_loads_in_three_vrm": "not_attempted",
        "loads_in_posepuppet": "not_attempted",
        "upper_body_tracks": "not_tested",
        "head_tracks": "not_tested",
        "arms_track": "not_tested",
        "legs_track": "disabled" if caps.get("legs") == "missing" else "not_tested",
        "hands_track": "disabled" if caps.get("hands") == "missing" else "not_tested",
        "fingers_track": "missing" if caps.get("fingers") == "missing" else "not_tested",
        "feet_track": "missing" if caps.get("feet") == "missing" else "not_tested",
        "toes_track": "missing" if caps.get("toes") == "missing" else "not_tested",
        "face_touch_test": "not_tested" if face_touch_mode(audit) != "none" else "not_supported",
        "face_tracks": "missing" if caps.get("facial_expressions") == "missing" else "not_tested",
        "expressions_track": "missing" if caps.get("facial_expressions") == "missing" else "not_tested",
        "runtime_notes": [
            f"{title_for_slug(slug)} has no PosePuppet runtime load test in this audit.",
            "Do not add to public UI until VRM load/orientation/tracking tests pass.",
        ],
    }


def performance_budget(audit: dict) -> dict:
    geom = audit.get("geometry", {})
    scene = audit.get("scene", {})
    model = audit.get("model", {})
    weight = runtime_weight(audit)
    return {
        "triangles": int(geom.get("triangle_count") or 0),
        "vertices": int(geom.get("vertex_count") or 0),
        "mesh_count": int(scene.get("mesh_count") or 0),
        "skinned_mesh_count": int(audit.get("rig", {}).get("skinned_mesh_count") or 0),
        "material_count": int(scene.get("material_count") or 0),
        "texture_count": int(scene.get("texture_count") or 0),
        "max_texture_resolution": "unknown",
        "source_file_size_mb": float(model.get("file_size_mb") or 0),
        "estimated_runtime_weight": weight,
        "desktop_safe": weight != "very_heavy",
        "mobile_safe": weight in {"light", "medium"},
        "needs_decimation": weight in {"heavy", "very_heavy"},
        "needs_texture_downscale": weight in {"heavy", "very_heavy"},
        "optimization_recommendations": [
            "Downscale textures and merge/static-batch accessory meshes if runtime profiling shows frame drops."
        ]
        if weight in {"heavy", "very_heavy"}
        else [],
    }


def build_adapter(audit: dict, sections: dict, lock_entry: dict) -> dict:
    slug = audit["model"]["slug"]
    action, status, why = model_action(audit)
    enabled, disabled = control_sets(audit)
    profile = normalized_profile(audit)
    finger = finger_mode(audit)
    face_mode = face_touch_mode(audit)
    do_not = do_not_implement(audit)
    adapter = {
        "schema_version": ADAPTER_SCHEMA,
        "avatar_id": slug,
        "display_name": audit["model"]["name"],
        "runtime_vrm_path": f"public/avatars/{slug}.vrm",
        "implementation_status": status,
        "profile": profile,
        "source_to_convert": sections["source_selection"]["best_source_for_conversion"],
        "reference_glb": sections["source_selection"]["runtime_glb_companion"],
        "selected_source_reasoning": sections["source_selection"]["reasoning"],
        "priority": PRIORITY.get(slug, 100),
        "bone_map": {key: audit.get("humanoid_mapping", {}).get(key) or "" for key in HUMANOID_KEYS},
        "bone_map_confidence": sections["bone_map_confidence"],
        "enabled_controls": enabled,
        "disabled_controls": disabled,
        "retargeting_config": {
            "body_mode": "custom" if profile == "creature" else "disabled" if profile == "hand_only" else "full" if "legs" in enabled else "upper",
            "root_motion": "root_motion" in enabled,
            "requires_model_offsets": profile in {"humanoid_with_offsets", "creature"},
            "offset_profile": f"{slug}-offsets" if profile == "humanoid_with_offsets" else "",
            "arm_correction": "test_required" if "arms" in enabled else "none",
            "wrist_correction": "test_required" if "hands" in enabled else "none",
            "leg_correction": "test_required" if "legs" in enabled else "none",
            "foot_orientation": "enabled_after_test" if "feet" in enabled else "disabled",
            "finger_mode": finger,
        },
        "face_touch_config": {
            "supported": face_mode != "none",
            "mode": face_mode,
            "targets": ["head_center", "mouth", "left_cheek", "right_cheek"] if face_mode != "none" else [],
            "notes": sections["face_touch_targets"]["notes"],
        },
        "conversion": {
            "target_format": "vrm",
            "target_path": f"public/avatars/{slug}.vrm",
            "command": sections["conversion_status"]["conversion_command"],
            "manual_mapping_needed": sections["conversion_status"]["manual_bone_map_needed"],
            "expected_blockers": sections["conversion_status"]["conversion_blockers"],
        },
        "runtime": {
            "expected_loader": "@pixiv/three-vrm",
            "registry_entry_needed": True,
            "fallback_if_missing": "current_default",
            "runtime_test_status": sections["posepuppet_runtime_test"]["loads_in_posepuppet"],
        },
        "performance": {
            "runtime_weight": sections["performance_budget"]["estimated_runtime_weight"],
            "desktop_safe": sections["performance_budget"]["desktop_safe"],
            "mobile_safe": sections["performance_budget"]["mobile_safe"],
            "optimization_required": sections["performance_budget"]["needs_decimation"]
            or sections["performance_budget"]["needs_texture_downscale"],
        },
        "acceptance_tests": sections["implementation_contract"]["acceptance_tests"],
        "do_not_inspect": sections["token_saving_summary"]["safe_to_skip"],
        "inspect_only_if": sections["coding_agent_decision"]["inspect_next_only_if"],
        "one_paragraph_implementation_summary": sections["token_saving_summary"]["one_paragraph_model_summary"],
        "source_lock": {
            "selected_source_sha256": lock_entry["selected_source_sha256"],
            "runtime_reference_sha256": lock_entry["runtime_glb_sha256"],
            "audit_status": lock_entry["audit_status"],
            "source_lock_path": "model-audits/source-lock.json",
        },
        "do_not_implement": do_not,
        "minimum_viable_avatar_support": sections["minimum_viable_avatar_support"],
        "runtime_fallback_policy": sections["runtime_fallback_policy"],
    }
    return adapter


def do_not_implement(audit: dict) -> list[str]:
    caps = audit.get("posepuppet_capabilities", {})
    profile = normalized_profile(audit)
    notes = [
        "Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.",
        "Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.",
        "Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.",
    ]
    if caps.get("fingers") in {"missing", "poor"}:
        notes.append("Do not enable fingers; use palm-only or curl presets.")
    if caps.get("facial_expressions") != "good":
        notes.append("Do not enable facial expressions for this model yet.")
    if caps.get("feet") == "missing":
        notes.append("Do not enable feet for this model yet.")
    if profile == "creature":
        notes.append("Do not force standard full-body humanoid mode; use a creature profile.")
    if profile == "hand_only":
        notes.append("Do not treat this as a full avatar; use it only for hand/finger tests.")
    return notes


def all_sections(audit: dict, repo_root: Path, model_dir: Path, source_meta: dict, lock_entry: dict) -> dict:
    slug = audit["model"]["slug"]
    action, status, why = model_action(audit)
    enabled, disabled = control_sets(audit)
    profile = normalized_profile(audit)
    risk = risk_level(audit)
    conv_diff = conversion_diff(audit, model_dir)
    conversion_result = "pass" if conv_diff["conversion_diff"]["status"] == "completed" else "not_attempted"
    command = conversion_command(audit)
    mapping = audit.get("humanoid_mapping", {})
    caps = audit.get("posepuppet_capabilities", {})
    perf = performance_budget(audit)
    face_mode = face_touch_mode(audit)
    min_goal = "custom_creature_preview" if profile == "creature" else "hand_test_only" if profile == "hand_only" else "load_vrm_full_body" if "legs" in enabled else "load_vrm_upper_body_only"
    sections = {
        "source_selection": source_selection(audit, source_meta),
        "conversion_status": {
            "preferred_source_for_conversion": audit["model"].get("selected_source_path", ""),
            "runtime_glb_reference": source_meta.get("runtime_glb", ""),
            "target_format": "vrm",
            "target_vrm_path": f"public/avatars/{slug}.vrm",
            "conversion_attempted": conversion_result == "pass",
            "conversion_tool": "Blender headless + VRM Add-on or GLB VRM injection script",
            "conversion_result": conversion_result,
            "missing_vrm_humanoid_bones": [key for key in ["hips", "spine", "chest", "neck", "head"] if not mapping.get(key)],
            "manual_bone_map_needed": normalized_profile(audit) in {"humanoid_with_offsets", "creature"} or conversion_result != "pass",
            "manual_bone_map_reason": "Required unless automatic VRM humanoid mapping is verified by conversion diff and runtime load test.",
            "texture_export_result": "embedded" if conversion_result == "pass" else "not_attempted",
            "vrm_version": "1.0" if conversion_result == "pass" else "not_exported",
            "conversion_command": command,
            "conversion_blockers": [] if conversion_result == "pass" else ["conversion not attempted in this V2 run", "manual mapping and runtime load test still required"],
            "conversion_notes": ["VRM is the target runtime format; do not add FBX browser loading."],
        },
        "rest_pose_and_orientation": {
            "rest_pose": "t_pose" if slug == "woody" else audit.get("rig", {}).get("rest_pose_guess") or "unknown",
            "rest_pose_confidence": "medium" if slug == "woody" else "low",
            "forward_axis_guess": "unknown",
            "up_axis_guess": "+z",
            "unit_scale_guess": "meters" if audit.get("geometry", {}).get("estimated_height", 0) < 5 else "centimeters",
            "origin_guess": "feet" if audit.get("geometry", {}).get("bounding_box", {}).get("min", [0, 0, 0])[2] <= 0.05 else "arbitrary",
            "height_estimate_raw": audit.get("geometry", {}).get("bounding_box", {}).get("size", [0, 0, 0])[2],
            "width_estimate_raw": audit.get("geometry", {}).get("bounding_box", {}).get("size", [0, 0, 0])[0],
            "depth_estimate_raw": audit.get("geometry", {}).get("bounding_box", {}).get("size", [0, 0, 0])[1],
            "arm_rest_direction": "unknown until visual/pose test",
            "leg_rest_direction": "unknown until visual/pose test",
            "foot_forward_direction": "unknown until orientation test",
            "finger_curl_axis_guess": "unknown" if finger_mode(audit) in {"none", "palm_only"} else "test_required",
            "bone_roll_warnings": ["Bone roll/orientation not validated by mobility visual review."],
            "needs_scale_normalization": True,
            "needs_rotation_normalization": True,
            "needs_origin_normalization": True,
            "recommended_root_transform": {"scale": 1, "rotation_degrees": [0, 0, 0], "position": [0, 0, 0]},
            "orientation_notes": ["Run a VRM orientation test before adding to runtime UI."],
        },
        "retargeting_risk": {
            "overall": risk,
            "shoulder_twist_risk": "medium" if "arms" in enabled else "high",
            "elbow_direction_risk": "medium" if "arms" in enabled else "high",
            "wrist_orientation_risk": "medium" if "hands" in enabled else "high",
            "head_neck_risk": "medium" if "head" in enabled or "creature_head" in enabled else "high",
            "torso_risk": "medium",
            "leg_risk": "medium" if "legs" in enabled else "high",
            "foot_ankle_risk": "medium" if "feet" in enabled else "high",
            "hand_finger_risk": "high" if caps.get("fingers") in {"missing", "poor"} else "medium",
            "face_expression_risk": "high" if caps.get("facial_expressions") != "good" else "medium",
            "proportion_risk": "high" if profile in {"creature", "humanoid_with_offsets"} else "medium",
            "root_motion_risk": "medium" if "root_motion" in enabled else "high",
            "recommended_posepuppet_offsets": [f"{slug}-offset-profile"] if profile == "humanoid_with_offsets" else [],
            "recommended_disabled_controls": disabled,
            "recommended_enabled_controls": enabled,
            "notes_for_coding_agent": [why, "Do not mark runtime-ready until VRM load and pose tests pass."],
        },
        "deformation_risks": {
            "shoulders": "medium" if "arms" in enabled else "high",
            "elbows": "medium" if "arms" in enabled else "high",
            "wrists": "medium" if "hands" in enabled else "high",
            "hips": "medium" if "legs" in enabled else "unknown",
            "knees": "medium" if "legs" in enabled else "unknown",
            "ankles": "medium" if "feet" in enabled else "unknown",
            "clothing_or_skirt": "medium" if slug in {"elsa", "jack-sparrow", "shrek"} else "unknown",
            "cape_or_coat": "high" if slug in {"darth-vader", "fortnite-batman", "jack-sparrow"} else "unknown",
            "hair_or_accessories": "medium" if slug in {"woody", "elsa", "jack-sparrow"} else "unknown",
            "armor_or_rigid_parts": "medium" if slug in {"iron-man", "darth-vader", "fortnite-batman", "terminator-t-800"} else "unknown",
            "notes": ["No mobility contact sheet was reviewed; keep deformation risk conservative."],
        },
        "performance_budget": perf,
        "finger_drive_plan": finger_drive_plan(audit),
        "face_touch_targets": {
            "head_center": "bone" if mapping.get("head") or audit.get("face", {}).get("head_bone") else "missing",
            "mouth": "bone" if audit.get("face", {}).get("jaw_bone") else "estimated" if face_mode != "none" else "missing",
            "left_cheek": "estimated" if face_mode != "none" else "missing",
            "right_cheek": "estimated" if face_mode != "none" else "missing",
            "forehead": "estimated" if mapping.get("head") else "missing",
            "chin": "estimated" if face_mode != "none" else "missing",
            "nose": "estimated" if face_mode != "none" else "missing",
            "needs_estimated_targets": face_mode != "none",
            "needs_ik": face_mode in {"ik_required", "estimated_targets_only"},
            "target_confidence": "medium" if face_mode != "none" else "low",
            "notes": ["Face-touch is not runtime-proven; implement only after IK/target tests."],
        },
        "appearance_descriptor": appearance_descriptor(audit),
        "visual_evidence_manifest": {
            "generated": False,
            "images": [],
            "included_in_handoff": False,
            "summarized_into": [
                "visual_reasoning_review",
                "appearance_descriptor",
                "mobility_visual_review",
                "retargeting_risk",
                "deformation_risks",
            ],
        },
        "visual_reasoning_review": {
            "status": "not_available",
            "reviewer": "none",
            "evidence_images": [],
            "screenshots_required_for_future_agents": False,
            "summary": "No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.",
            "silhouette_observations": [],
            "proportion_observations": [],
            "surface_and_clothing_observations": [],
            "accessory_attachment_risks": [],
            "deformation_observations": [],
            "face_touch_observations": [],
            "hand_finger_observations": [],
            "feet_leg_observations": [],
            "runtime_implications": ["Run a contact-sheet/vision pass before claiming low deformation risk."],
            "confidence": "low",
            "uncertainties": [
                "No rendered contact sheets were inspected.",
                "Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.",
            ],
        },
        "mobility_visual_review": {
            "status": "not_available",
            **{
                key: {"result": "not_tested", "visual_notes": "No mobility contact sheet was generated or inspected."}
                for key in [
                    "arm_raise",
                    "elbow_bend",
                    "wrist_rotate",
                    "hand_to_cheek",
                    "hand_to_mouth",
                    "finger_curl",
                    "knee_bend",
                    "foot_lift",
                    "foot_rotate",
                ]
            },
            "overall_mobility_verdict": "not_available",
            "confidence": "low",
        },
        "bone_map_confidence": bone_map_confidence(audit),
        "deformation_sanity": {
            "has_skinned_meshes": bool(audit.get("rig", {}).get("has_skinned_meshes")),
            "skinned_mesh_count": audit.get("rig", {}).get("skinned_mesh_count", 0),
            "unskinned_meshes_that_matter": [],
            "bones_without_weights_that_matter": audit.get("skinning", {}).get("bones_without_weights_sample", [])[:20],
            "weight_paint_risk": "medium" if audit.get("skinning", {}).get("possible_weight_paint_issues") else "low",
            "separate_mesh_attachment_risk": "medium" if audit.get("scene", {}).get("mesh_count", 0) > 5 else "low",
            "constraint_or_control_rig_complexity": "high" if audit.get("rig", {}).get("constraint_count", 0) > 100 else "medium" if audit.get("rig", {}).get("constraint_count", 0) else "none",
            "deformation_notes": ["Weight paint was not stress-tested by synthetic mobility poses."],
        },
        "creature_profile": {
            "is_creature": profile == "creature",
            "body_type": "hand_only" if profile == "hand_only" else "biped_creature" if profile == "creature" else "humanoid",
            "has_tail": slug in {"godzilla", "xenomorph"},
            "has_jaw": bool(audit.get("face", {}).get("jaw_bone")),
            "has_claws": slug in {"godzilla", "xenomorph", "king-kong"},
            "has_wings": False,
            "usable_controls": enabled,
            "do_not_drive_as_standard_humanoid": profile == "creature",
            "custom_profile_notes": ["Use creature controls and bespoke retargeting targets."] if profile == "creature" else [],
        },
        "coding_agent_decision": {
            "recommended_action": {
                "convert_then_test": "convert_to_vrm",
                "cleanup_then_convert": "cleanup_then_convert",
                "custom_profile": "custom_profile",
                "hand_test_only": "hand_only_test",
                "ignore_for_now": "ignore_for_now",
            }.get(action, action),
            "first_runtime_profile": profile,
            "implementation_priority": PRIORITY.get(slug, 100),
            "why": why,
            "do_not_spend_tokens_on": [
                "source binaries",
                "duplicate downloads",
                "textures",
                "screenshots/contact sheets unless visual review is missing or inconclusive",
            ],
            "inspect_next_only_if": [
                "open bone-tree.txt if automatic mapping fails",
                "open source binary only if VRM conversion fails",
            ],
            "minimum_files_for_next_agent": [
                f"model-audits/{slug}/avatar-adapter-spec.json",
                f"model-audits/{slug}/llm-dossier.md",
            ],
        },
        "implementation_contract": {
            "avatar_id": slug,
            "display_name": audit["model"]["name"],
            "runtime_vrm_path": f"public/avatars/{slug}.vrm",
            "registry_entry_needed": True,
            "profile": profile,
            "default_enabled_controls": enabled,
            "default_disabled_controls": disabled,
            "required_posepuppet_changes": [
                "Add registry entry only after conversion/load/orientation tests.",
                "Use existing VRM loader; do not add source-format browser loading.",
            ],
            "optional_posepuppet_changes": ["Add warning labels and feature flags for experimental avatars."],
            "conversion_prerequisites": [
                "selected source still matches source-lock hash",
                "VRM exists locally at target path",
                "manual bone map reviewed if confidence is not high",
            ],
            "acceptance_tests": [
                "VRM loads in @pixiv/three-vrm",
                "avatar appears upright and facing camera",
                "head follows webcam rotation",
                "arms follow shoulders/elbows/wrists",
                "hands do not detach",
                "full body mode does not explode when legs are visible",
            ],
        },
        "token_saving_summary": {
            "one_paragraph_model_summary": f"{audit['model']['name']} should use profile `{profile}` with action `{action}`. Convert or test `{audit['model'].get('selected_source_path', '')}` to `public/avatars/{slug}.vrm`, enable {', '.join(enabled) or 'no controls'}, and disable {', '.join(disabled) or 'nothing extra'} until runtime tests pass.",
            "critical_facts": [
                f"selected source: {audit['model'].get('selected_source_path', '')}",
                f"target VRM: public/avatars/{slug}.vrm",
                f"profile: {profile}",
                f"risk: {risk}",
            ],
            "safe_to_skip": [
                "duplicate GLBs",
                "source ZIP internals",
                "textures",
                "full source binaries",
                "screenshots/contact sheets unless visual review is needed",
            ],
            "only_open_large_files_if": [
                "source-lock says stale",
                "VRM conversion fails",
                "bone map cannot be fixed from the dossier/bone-tree summary",
            ],
        },
        "token_saving_index": {
            "read_first": f"model-audits/{slug}/avatar-adapter-spec.json",
            "read_second": f"model-audits/{slug}/llm-dossier.md",
            "read_third": f"model-audits/{slug}/llm-dossier.json",
            "read_only_if_mapping_fails": f"model-audits/{slug}/bone-tree.txt",
            "never_read_unless_conversion_fails": [
                "source blend/fbx/glb",
                "textures",
                "duplicate GLBs",
                "screenshots/contact sheets",
            ],
            "one_sentence": f"Start with the adapter spec for {slug}; only open large assets when conversion or mapping breaks.",
        },
        "evidence_ledger": {
            "measured_facts": [
                f"bones: {audit.get('rig', {}).get('bone_count', 0)}",
                f"triangles: {audit.get('geometry', {}).get('triangle_count', 0)}",
                f"meshes: {audit.get('scene', {}).get('mesh_count', 0)}",
                f"materials: {audit.get('scene', {}).get('material_count', 0)}",
                f"textures: {audit.get('scene', {}).get('texture_count', 0)}",
            ],
            "inferred_conclusions": [why, f"runtime profile: {profile}"],
            "reasoning_derived_visual_understanding": [appearance_descriptor(audit)["character_silhouette"]],
            "implementation_recommendations": [f"target VRM path public/avatars/{slug}.vrm", f"default disabled controls: {', '.join(disabled)}"],
            "uncertainties": ["No contact-sheet vision review", "No PosePuppet runtime load test"],
        },
        "understanding_provenance": {
            "scripted_audit_completed": True,
            "vision_review_completed": False,
            "conversion_test_completed": conversion_result == "pass",
            "runtime_test_completed": False,
            "human_review_completed": False,
            "notes": ["Generated from local Blender audit outputs and source-lock hashes."],
        },
        "final_model_action": {
            "action": action,
            "reason": why,
            "minimum_next_step": "Convert to VRM and run load/orientation tests." if action == "convert_then_test" else why,
            "owner": "coding_agent" if action in {"convert_then_test", "hand_test_only"} else "blender_cleanup" if action == "cleanup_then_convert" else "coding_agent",
        },
        "minimum_viable_avatar_support": {
            "first_pass_goal": min_goal,
            "must_work": ["VRM loads", "avatar upright/facing camera"] + (["head tracks", "arms track"] if profile not in {"creature", "hand_only"} else []),
            "may_defer": ["fingers", "face-touch", "facial expressions", "toes"],
            "acceptance_test": f"Run PosePuppet with ?avatar={slug} after adding a gated registry entry and verify basic tracking without runtime errors.",
            "notes": ["Do not attempt every control in the first pass."],
        },
        "runtime_fallback_policy": {
            "if_vrm_missing": "show_warning",
            "if_vrm_load_fails": "show_warning_and_fallback",
            "if_tracking_profile_unsupported": "disable_unsupported_controls",
            "recommended_warning_text": "This avatar is experimental. Some controls are disabled because the model does not yet have a verified full PosePuppet rig.",
        },
        "do_not_implement": do_not_implement(audit),
        "audit_quality": {
            "score": 65 if conversion_result == "pass" else 55,
            "scripted_audit": "complete",
            "vision_review": "unavailable",
            "conversion_test": "complete" if conversion_result == "pass" else "not_attempted",
            "runtime_test": "not_attempted",
            "staleness_check": lock_entry["audit_status"],
            "confidence": "medium" if conversion_result == "pass" else "low",
            "missing_evidence": ["contact-sheet vision review", "PosePuppet runtime load test"],
        },
        "implementation_readiness": {
            "score": 75 if action == "convert_then_test" else 55 if action == "cleanup_then_convert" else 45 if action == "custom_profile" else 30,
            "level": {
                "convert_then_test": "conversion_ready",
                "cleanup_then_convert": "cleanup_needed",
                "custom_profile": "custom_profile_needed",
                "hand_test_only": "conversion_ready",
                "ignore_for_now": "ignore_for_now",
            }.get(action, "blocked"),
            "blocking_reasons": ["runtime load test not attempted"] + ([] if conversion_result == "pass" else ["VRM conversion not attempted"]),
            "next_step": "Convert/load-test VRM, then add gated registry entry." if action == "convert_then_test" else why,
        },
    }
    sections["posepuppet_runtime_test"] = runtime_test(audit, conv_diff)
    sections["conversion_diff"] = conv_diff["conversion_diff"]
    sections["retargeting_simulation"] = retargeting_simulation(audit)
    sections["source_lock"] = {
        "selected_source_sha256": lock_entry["selected_source_sha256"],
        "runtime_reference_sha256": lock_entry["runtime_glb_sha256"],
        "audit_status": lock_entry["audit_status"],
        "source_lock_path": "model-audits/source-lock.json",
    }
    return sections


def markdown_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- None."


def write_json(path: Path, data: dict | list) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def write_per_model(model_dir: Path, audit: dict, sections: dict, adapter: dict) -> None:
    slug = audit["model"]["slug"]
    display = audit["model"]["name"]
    model_dir.mkdir(parents=True, exist_ok=True)
    for key, value in sections.items():
        if key not in {"conversion_diff", "retargeting_simulation"}:
            audit[key] = value
    audit["avatar_adapter_spec"] = adapter
    audit["schema_version"] = AUDIT_SCHEMA
    audit["model"].pop("license_note", None)
    audit["warnings"] = [w for w in audit.get("warnings", []) if "license" not in w.lower()]
    if not audit["warnings"]:
        audit["warnings"] = ["Runtime conversion/load/deformation tests are not fully complete."]
    audit["recommended_user_action"] = sections["final_model_action"]["minimum_next_step"]
    write_json(model_dir / "audit.json", audit)

    dossier = {**audit, "avatar_adapter_spec": adapter}
    write_json(model_dir / "llm-dossier.json", dossier)
    write_json(model_dir / "avatar-adapter-spec.json", adapter)
    write_json(model_dir / "conversion-diff.json", {"schema_version": "posepuppet-conversion-diff-v1", "conversion_diff": sections["conversion_diff"]})
    write_json(model_dir / "retargeting-simulation.json", sections["retargeting_simulation"])
    write_json(model_dir / "suggested-bone-map.json", {key: audit.get("humanoid_mapping", {}).get(key) or "" for key in HUMANOID_KEYS})

    visual_dir = model_dir / "visual-evidence"
    visual_dir.mkdir(exist_ok=True)
    write_json(visual_dir / "visual-evidence-manifest.json", sections["visual_evidence_manifest"])

    warnings = ["# Warnings", ""]
    warnings.extend(f"- {w}" for w in audit["warnings"])
    warnings.extend(f"- {w}" for w in adapter["do_not_implement"])
    (model_dir / "warnings.md").write_text("\n".join(warnings) + "\n")

    src_lines = [
        f"# Source files for {display}",
        "",
        f"Selected source: {sections['source_selection']['best_source_for_audit']}",
        f"Best conversion source: {sections['source_selection']['best_source_for_conversion']}",
        f"Runtime GLB companion: {sections['source_selection']['runtime_glb_companion'] or 'none'}",
        f"Target VRM path: public/avatars/{slug}.vrm",
        "",
        "## All known variants",
        "",
    ]
    for variant in audit["model"].get("source_paths", []):
        src_lines.append(f"- `{variant}`")
    src_lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Original binaries, textures, ZIPs, screenshots, contact sheets, and converted VRMs are not included in handoff files.",
            "- Use source-lock hashes before trusting this audit after model files change.",
        ]
    )
    (model_dir / "source-files.txt").write_text("\n".join(src_lines) + "\n")

    conv = sections["conversion_diff"]
    conv_md = [
        f"# {display} conversion diff",
        "",
        f"- Status: `{conv['status']}`",
        f"- Source: `{conv['source_path']}`",
        f"- Converted VRM: `{conv['converted_vrm_path']}`",
        f"- Skeleton preserved: `{conv['skeleton_preserved']}`",
        f"- Humanoid mapping preserved: `{conv['humanoid_mapping_preserved']}`",
        f"- Mesh count: {conv['mesh_count_before']} -> {conv['mesh_count_after']}",
        f"- Material count: {conv['material_count_before']} -> {conv['material_count_after']}",
        f"- Texture result: `{conv['texture_result']}`",
        f"- Fingers preserved: `{conv['fingers_preserved']}`",
        f"- Feet preserved: `{conv['feet_preserved']}`",
        "",
        "## Notes",
        markdown_list(conv["notes"]),
        "",
        "## Blockers",
        markdown_list(conv["blockers"]),
    ]
    (model_dir / "conversion-diff.md").write_text("\n".join(conv_md) + "\n")

    conversion = sections["conversion_status"]
    (model_dir / "conversion-report.md").write_text(
        "\n".join(
            [
                f"# {display} conversion report",
                "",
                f"- Preferred source: `{conversion['preferred_source_for_conversion']}`",
                f"- Target VRM: `{conversion['target_vrm_path']}`",
                f"- Conversion attempted: `{str(conversion['conversion_attempted']).lower()}`",
                f"- Conversion result: `{conversion['conversion_result']}`",
                f"- Manual mapping needed: `{str(conversion['manual_bone_map_needed']).lower()}`",
                "",
                "## Command",
                "",
                "```sh",
                conversion["conversion_command"],
                "```",
                "",
                "## Blockers",
                markdown_list(conversion["conversion_blockers"]),
            ]
        )
        + "\n"
    )

    runtime = sections["posepuppet_runtime_test"]
    runtime_lines = [
        f"# {display} PosePuppet runtime test",
        "",
        f"- Source converts to VRM: `{runtime['source_converts_to_vrm']}`",
        f"- Loads in three-vrm: `{runtime['vrm_loads_in_three_vrm']}`",
        f"- Loads in PosePuppet: `{runtime['loads_in_posepuppet']}`",
        f"- Upper body: `{runtime['upper_body_tracks']}`",
        f"- Head: `{runtime['head_tracks']}`",
        f"- Arms: `{runtime['arms_track']}`",
        f"- Legs: `{runtime['legs_track']}`",
        f"- Hands: `{runtime['hands_track']}`",
        f"- Fingers: `{runtime['fingers_track']}`",
        f"- Feet: `{runtime['feet_track']}`",
        f"- Face touch: `{runtime['face_touch_test']}`",
        "",
        "## Notes",
        markdown_list(runtime["runtime_notes"]),
    ]
    (model_dir / "posepuppet-runtime-test.md").write_text("\n".join(runtime_lines) + "\n")

    sim = sections["retargeting_simulation"]
    sim_lines = [
        f"# {display} retargeting simulation",
        "",
        f"- Overall simulation verdict: `{sim['overall_retargeting_simulation_verdict']}`",
        "",
        "| Pose | Applied | Result | Visual review |",
        "|---|---:|---|---|",
    ]
    for pose, result in sim["synthetic_pose_tests"].items():
        sim_lines.append(f"| {pose} | {str(result['applied']).lower()} | {result['result']} | {result['visual_review']} |")
    sim_lines.extend(["", "## Notes", markdown_list(sim["notes"])])
    (model_dir / "retargeting-simulation.md").write_text("\n".join(sim_lines) + "\n")

    adapter_md = [
        f"# {display} avatar adapter spec",
        "",
        f"- Avatar ID: `{slug}`",
        f"- Implementation status: `{adapter['implementation_status']}`",
        f"- Profile: `{adapter['profile']}`",
        f"- Priority: {adapter['priority']}",
        f"- Source to convert: `{adapter['source_to_convert']}`",
        f"- Reference GLB: `{adapter['reference_glb'] or 'none'}`",
        f"- Runtime VRM: `{adapter['runtime_vrm_path']}`",
        f"- Enabled controls: {', '.join(adapter['enabled_controls']) or 'none'}",
        f"- Disabled controls: {', '.join(adapter['disabled_controls']) or 'none'}",
        f"- Finger mode: `{adapter['retargeting_config']['finger_mode']}`",
        f"- Face-touch mode: `{adapter['face_touch_config']['mode']}`",
        "",
        "## Do not implement",
        markdown_list(adapter["do_not_implement"]),
        "",
        "## Minimum viable support",
        f"- First pass goal: `{adapter['minimum_viable_avatar_support']['first_pass_goal']}`",
        f"- Acceptance test: {adapter['minimum_viable_avatar_support']['acceptance_test']}",
        "",
        "## Conversion command",
        "",
        "```sh",
        adapter["conversion"]["command"],
        "```",
        "",
        "## Implementation summary",
        adapter["one_paragraph_implementation_summary"],
    ]
    (model_dir / "avatar-adapter-spec.md").write_text("\n".join(adapter_md) + "\n")

    model_card = [
        f"# Avatar audit: {display}",
        "",
        "## Verdict",
        "",
        f"Label: {sections['implementation_readiness']['level']}",
        f"Overall score: {audit.get('scores', {}).get('overall', 0)}",
        f"Recommended runtime profile: {adapter['profile']}",
        f"One-sentence recommendation: {sections['final_model_action']['minimum_next_step']}",
        "",
        "## What to tell another LLM",
        "",
        sections["token_saving_summary"]["one_paragraph_model_summary"],
        "",
        "## Adapter spec",
        "",
        f"Read `model-audits/{slug}/avatar-adapter-spec.json` first.",
    ]
    (model_dir / "model-card.md").write_text("\n".join(model_card) + "\n")

    dossier_md = [
        f"# {display} - LLM Avatar Dossier",
        "",
        "## Verdict",
        "",
        f"- Avatar ID: `{slug}`",
        f"- Recommended action: `{sections['final_model_action']['action']}`",
        f"- First runtime profile: `{adapter['profile']}`",
        f"- Implementation priority: {adapter['priority']}",
        f"- One-line reason: {sections['final_model_action']['reason']}",
        "",
        "## Source selection",
        "",
        f"- Best source for audit: `{sections['source_selection']['best_source_for_audit']}`",
        f"- Best source for conversion: `{sections['source_selection']['best_source_for_conversion']}`",
        f"- Runtime/reference GLB: `{sections['source_selection']['runtime_glb_companion'] or 'none'}`",
        f"- Target VRM path: `public/avatars/{slug}.vrm`",
        f"- Do not use: {', '.join(sections['source_selection']['do_not_use_variants']) or 'none'}",
        f"- Reasoning: {sections['source_selection']['reasoning']}",
        "",
        "## Avatar adapter spec summary",
        "",
        f"- Implementation status: `{adapter['implementation_status']}`",
        f"- Enabled controls: {', '.join(adapter['enabled_controls']) or 'none'}",
        f"- Disabled controls: {', '.join(adapter['disabled_controls']) or 'none'}",
        f"- Body mode: `{adapter['retargeting_config']['body_mode']}`",
        f"- Root motion: `{str(adapter['retargeting_config']['root_motion']).lower()}`",
        f"- Finger mode: `{adapter['retargeting_config']['finger_mode']}`",
        f"- Face-touch mode: `{adapter['face_touch_config']['mode']}`",
        f"- Offset profile: `{adapter['retargeting_config']['offset_profile'] or 'none'}`",
        "",
        "## Technical summary",
        "",
        f"- Source format: `{audit['model'].get('selected_source_format')}`",
        f"- File size: {audit['model'].get('file_size_mb')} MB",
        f"- Mesh count: {audit.get('scene', {}).get('mesh_count')}",
        f"- Skinned mesh count: {audit.get('rig', {}).get('skinned_mesh_count')}",
        f"- Armature: `{audit.get('rig', {}).get('primary_armature')}`",
        f"- Bone count: {audit.get('rig', {}).get('bone_count')}",
        f"- Naming style: `{audit.get('rig', {}).get('naming_style_guess')}`",
        f"- Animation clips: {audit.get('scene', {}).get('animation_count')}",
        f"- Shape keys: {audit.get('scene', {}).get('shape_key_count')}",
        f"- Materials: {audit.get('scene', {}).get('material_count')}",
        f"- Textures: {audit.get('scene', {}).get('texture_count')}",
        "",
        "## Appearance descriptor",
        "",
        sections["appearance_descriptor"]["character_silhouette"],
        "",
        f"- Measured evidence used: {', '.join(sections['appearance_descriptor']['evidence_used'])}",
        f"- Inferred visual/semantic understanding: {sections['appearance_descriptor']['body_proportions']}",
        f"- Optional visual observation: not available",
        f"- Confidence: `{sections['appearance_descriptor']['caption_confidence']}`",
        f"- Runtime implication: {', '.join(sections['appearance_descriptor']['likely_deformation_sensitive_areas'])}",
        "",
        "## Visual reasoning review",
        "",
        f"- Status: `{sections['visual_reasoning_review']['status']}`",
        f"- Summary: {sections['visual_reasoning_review']['summary']}",
        f"- Confidence: `{sections['visual_reasoning_review']['confidence']}`",
        f"- Uncertainties: {', '.join(sections['visual_reasoning_review']['uncertainties'])}",
        "",
        "## Geometry and performance",
        "",
        f"- Triangles: {sections['performance_budget']['triangles']}",
        f"- Vertices: {sections['performance_budget']['vertices']}",
        f"- Bounds: {audit.get('geometry', {}).get('bounding_box', {})}",
        f"- Estimated height: {audit.get('geometry', {}).get('estimated_height')}",
        f"- Runtime weight: `{sections['performance_budget']['estimated_runtime_weight']}`",
        f"- Desktop safe: `{str(sections['performance_budget']['desktop_safe']).lower()}`",
        f"- Mobile safe: `{str(sections['performance_budget']['mobile_safe']).lower()}`",
        "",
        "## Rig and humanoid mapping",
        "",
        f"- Root: {', '.join(audit.get('rig', {}).get('root_bones', [])) or 'unknown'}",
        f"- Hands/fingers: `{caps_summary(audit, 'hands')}` / `{caps_summary(audit, 'fingers')}`",
        f"- Feet/toes: `{caps_summary(audit, 'feet')}` / `{caps_summary(audit, 'toes')}`",
        f"- Face/expressions: `{caps_summary(audit, 'facial_expressions')}`",
        f"- Bone map confidence: `{sections['bone_map_confidence']['overall']}`",
        f"- Suggested bone map path: `model-audits/{slug}/suggested-bone-map.json`",
        "",
        "## Rest pose and orientation",
        "",
        f"- Rest pose: `{sections['rest_pose_and_orientation']['rest_pose']}`",
        f"- Forward axis: `{sections['rest_pose_and_orientation']['forward_axis_guess']}`",
        f"- Up axis: `{sections['rest_pose_and_orientation']['up_axis_guess']}`",
        f"- Origin: `{sections['rest_pose_and_orientation']['origin_guess']}`",
        f"- Scale: `{sections['rest_pose_and_orientation']['unit_scale_guess']}`",
        "",
        "## Conversion status",
        "",
        f"- Conversion attempted: `{str(sections['conversion_status']['conversion_attempted']).lower()}`",
        f"- Conversion result: `{sections['conversion_status']['conversion_result']}`",
        f"- Manual mapping needed: `{str(sections['conversion_status']['manual_bone_map_needed']).lower()}`",
        "",
        "## Conversion diff",
        "",
        f"- Status: `{sections['conversion_diff']['status']}`",
        f"- Skeleton preserved: `{sections['conversion_diff']['skeleton_preserved']}`",
        f"- Mapping preserved: `{sections['conversion_diff']['humanoid_mapping_preserved']}`",
        f"- Runtime candidate: `{str(sections['conversion_diff']['posepuppet_runtime_candidate']).lower()}`",
        "",
        "## PosePuppet runtime test",
        "",
        f"- Loads in PosePuppet: `{sections['posepuppet_runtime_test']['loads_in_posepuppet']}`",
        f"- Runtime notes: {', '.join(sections['posepuppet_runtime_test']['runtime_notes'])}",
        "",
        "## Retargeting risk",
        "",
        f"- Overall risk: `{sections['retargeting_risk']['overall']}`",
        f"- Recommended enabled controls: {', '.join(sections['retargeting_risk']['recommended_enabled_controls'])}",
        f"- Recommended disabled controls: {', '.join(sections['retargeting_risk']['recommended_disabled_controls'])}",
        "",
        "## Do not implement",
        "",
        markdown_list(adapter["do_not_implement"]),
        "",
        "## Token-saving instructions",
        "",
        f"- Read first: `{sections['token_saving_index']['read_first']}`",
        f"- Read second: `{sections['token_saving_index']['read_second']}`",
        f"- Read only if mapping fails: `{sections['token_saving_index']['read_only_if_mapping_fails']}`",
        f"- One-sentence summary: {sections['token_saving_index']['one_sentence']}",
        "",
        "## One-paragraph implementation summary",
        "",
        sections["token_saving_summary"]["one_paragraph_model_summary"],
    ]
    (model_dir / "llm-dossier.md").write_text("\n".join(dossier_md) + "\n")


def caps_summary(audit: dict, key: str) -> str:
    return audit.get("posepuppet_capabilities", {}).get(key, "unknown")


def model_dirs(audit_dir: Path) -> list[Path]:
    return sorted(path for path in audit_dir.iterdir() if path.is_dir() and (path / "audit.json").exists())


def load_models(audit_dir: Path) -> list[tuple[Path, dict, dict]]:
    items = []
    for model_dir in model_dirs(audit_dir):
        audit = json.loads((model_dir / "audit.json").read_text())
        audit["model"]["slug"] = model_dir.name
        audit["model"]["name"] = DISPLAY_OVERRIDES.get(model_dir.name, audit["model"].get("name", title_for_slug(model_dir.name)))
        source_meta = parse_source_files(model_dir / "source-files.txt")
        if model_dir.name == "woody":
            source_meta["runtime_glb"] = "/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb"
        items.append((model_dir, audit, source_meta))
    return items


def aggregate_row(adapter: dict, audit: dict, sections: dict) -> dict:
    return {
        "avatar_id": adapter["avatar_id"],
        "display_name": adapter["display_name"],
        "priority": adapter["priority"],
        "action": sections["coding_agent_decision"]["recommended_action"],
        "profile": adapter["profile"],
        "source_to_convert": adapter["source_to_convert"],
        "target_vrm": adapter["runtime_vrm_path"],
        "enabled_controls": adapter["enabled_controls"],
        "disabled_controls": adapter["disabled_controls"],
        "finger_mode": adapter["retargeting_config"]["finger_mode"],
        "face_touch_mode": adapter["face_touch_config"]["mode"],
        "risk": sections["retargeting_risk"]["overall"],
        "performance": adapter["performance"]["runtime_weight"],
        "read_first": f"model-audits/{adapter['avatar_id']}/avatar-adapter-spec.json",
        "reason": sections["final_model_action"]["reason"],
        "do_not_implement": adapter["do_not_implement"],
        "minimum_viable_avatar_support": adapter["minimum_viable_avatar_support"],
        "source_lock": adapter["source_lock"],
    }


def write_aggregates(audit_dir: Path, repo_root: Path, models: list[dict], created_at: str) -> None:
    rows = sorted(models, key=lambda row: row["adapter"]["priority"])
    adapters = [aggregate_row(row["adapter"], row["audit"], row["sections"]) for row in rows]
    write_json(
        audit_dir / "avatar-adapter-specs.json",
        {
            "schema_version": "posepuppet-avatar-adapter-specs-v1",
            "created_at": created_at,
            "purpose": "Coding-ready model implementation configs so future agents do not need to inspect large 3D binaries.",
            "models": adapters,
        },
    )

    write_json(
        audit_dir / "summary.json",
        {
            "schema_version": "posepuppet-avatar-audit-summary-v2",
            "created_at": created_at,
            "model_count": len(rows),
            "groups": [row["adapter"]["avatar_id"] for row in rows],
            "audits": [
                {
                    "name": row["adapter"]["display_name"],
                    "slug": row["adapter"]["avatar_id"],
                    "profile": row["adapter"]["profile"],
                    "action": row["sections"]["final_model_action"]["action"],
                    "overall": row["audit"].get("scores", {}).get("overall", 0),
                    "selected_source": row["adapter"]["source_to_convert"],
                    "target_vrm": row["adapter"]["runtime_vrm_path"],
                }
                for row in rows
            ],
        },
    )

    lines = [
        "# Avatar Adapter Specs",
        "",
        "This is the Level 1 machine-readable implementation map in markdown form.",
        "",
        "| Priority | Model | Profile | Action | Source | Target VRM | Enabled | Disabled | Risk | Read first |",
        "|---:|---|---|---|---|---|---|---|---|---|",
    ]
    for row in adapters:
        lines.append(
            "| "
            + " | ".join(
                [
                    str(row["priority"]),
                    row["display_name"],
                    row["profile"],
                    row["action"],
                    f"`{row['source_to_convert']}`",
                    f"`{row['target_vrm']}`",
                    ", ".join(row["enabled_controls"]) or "none",
                    ", ".join(row["disabled_controls"]) or "none",
                    row["risk"],
                    f"`{row['read_first']}`",
                ]
            )
            + " |"
        )
    (audit_dir / "avatar-adapter-specs.md").write_text("\n".join(lines) + "\n")

    write_index(audit_dir, rows, created_at)
    write_recommendations(audit_dir, rows)
    write_runtime_readiness(audit_dir, rows)
    write_conversion_matrix(audit_dir, rows)
    write_performance_budget_md(audit_dir, rows)
    write_source_selection_md(audit_dir, rows)
    write_family_strategies(audit_dir, rows)
    write_playbook(audit_dir, rows)
    write_registry_plan(audit_dir, rows, created_at)
    write_generated_config_preview(audit_dir, rows)
    write_coding_queue(audit_dir, rows, created_at)
    write_readme(audit_dir)
    write_dedupe_and_source_reports(audit_dir, rows)
    write_handoff(audit_dir, rows)
    write_combined(repo_root, audit_dir, rows)


def write_index(audit_dir: Path, rows: list[dict], created_at: str) -> None:
    lines = [
        "# PosePuppet model audit index",
        "",
        f"Generated: {created_at}",
        "",
        "| Character/model | Selected source | Format | Final action | Runtime profile | Overall | Hands | Fingers | Feet | Face-touch | Adapter spec |",
        "|---|---|---|---|---|---:|---|---|---|---|---|",
    ]
    for row in sorted(rows, key=lambda item: item["adapter"]["avatar_id"]):
        audit = row["audit"]
        caps = audit.get("posepuppet_capabilities", {})
        lines.append(
            "| "
            + " | ".join(
                [
                    row["adapter"]["display_name"],
                    f"`{row['adapter']['source_to_convert']}`",
                    audit["model"].get("selected_source_format", ""),
                    row["sections"]["final_model_action"]["action"],
                    row["adapter"]["profile"],
                    str(audit.get("scores", {}).get("overall", 0)),
                    caps.get("hands", "unknown"),
                    caps.get("fingers", "unknown"),
                    caps.get("feet", "unknown"),
                    caps.get("face_touch", "unknown"),
                    f"[spec]({row['adapter']['avatar_id']}/avatar-adapter-spec.md)",
                ]
            )
            + " |"
        )
    (audit_dir / "INDEX.md").write_text("\n".join(lines) + "\n")


def write_recommendations(audit_dir: Path, rows: list[dict]) -> None:
    buckets = {
        "Top immediate conversion/runtime candidates": [],
        "Cleanup-before-conversion candidates": [],
        "Creature/custom profile candidates": [],
        "Hand-only candidates": [],
        "Ignore/static for now": [],
    }
    for row in rows:
        action = row["sections"]["final_model_action"]["action"]
        line = f"- **{row['adapter']['display_name']}** (`{row['adapter']['avatar_id']}`): {row['sections']['final_model_action']['reason']}"
        if action == "convert_then_test":
            buckets["Top immediate conversion/runtime candidates"].append(line)
        elif action == "cleanup_then_convert":
            buckets["Cleanup-before-conversion candidates"].append(line)
        elif action == "custom_profile":
            buckets["Creature/custom profile candidates"].append(line)
        elif action == "hand_test_only":
            buckets["Hand-only candidates"].append(line)
        else:
            buckets["Ignore/static for now"].append(line)
    lines = ["# Recommendations", "", "Technical readiness only; rights and redistribution review are out of scope.", ""]
    for heading, items in buckets.items():
        lines.extend([f"## {heading}", ""])
        lines.extend(items or ["- None."])
        lines.append("")
    (audit_dir / "recommendations.md").write_text("\n".join(lines))


def write_runtime_readiness(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "# Runtime readiness",
        "",
        "| Model | Slug | Recommended action | Runtime profile | Best conversion source | Target VRM path | Conversion status | PosePuppet load status | Upper body | Hand/finger | Leg | Face/expression | Risk | Disabled controls | Performance | Adapter spec | Priority | Reason |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|",
    ]
    for row in rows:
        a = row["adapter"]
        s = row["sections"]
        lines.append(
            "| "
            + " | ".join(
                [
                    a["display_name"],
                    a["avatar_id"],
                    s["final_model_action"]["action"],
                    a["profile"],
                    f"`{a['source_to_convert']}`",
                    f"`{a['runtime_vrm_path']}`",
                    s["conversion_status"]["conversion_result"],
                    s["posepuppet_runtime_test"]["loads_in_posepuppet"],
                    s["posepuppet_runtime_test"]["upper_body_tracks"],
                    f"{s['posepuppet_runtime_test']['hands_track']} / {s['posepuppet_runtime_test']['fingers_track']}",
                    s["posepuppet_runtime_test"]["legs_track"],
                    f"{s['posepuppet_runtime_test']['face_tracks']} / {s['posepuppet_runtime_test']['expressions_track']}",
                    s["retargeting_risk"]["overall"],
                    ", ".join(a["disabled_controls"]) or "none",
                    a["performance"]["runtime_weight"],
                    f"`model-audits/{a['avatar_id']}/avatar-adapter-spec.json`",
                    str(a["priority"]),
                    s["final_model_action"]["reason"],
                ]
            )
            + " |"
        )
    (audit_dir / "runtime-readiness.md").write_text("\n".join(lines) + "\n")


def write_conversion_matrix(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "# Conversion matrix",
        "",
        "| Model | Slug | Selected source | Source format | Reference/runtime GLB | Target VRM | Armature found | Humanoid mapping | Missing required VRM bones | Manual mapping | Texture expectation | VRM status | Conversion diff | Command/notes |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        audit = row["audit"]
        a = row["adapter"]
        s = row["sections"]
        lines.append(
            "| "
            + " | ".join(
                [
                    a["display_name"],
                    a["avatar_id"],
                    f"`{a['source_to_convert']}`",
                    audit["model"].get("selected_source_format", ""),
                    f"`{a['reference_glb'] or 'none'}`",
                    f"`{a['runtime_vrm_path']}`",
                    str(bool(audit.get("rig", {}).get("has_armature"))).lower(),
                    s["bone_map_confidence"]["overall"],
                    ", ".join(s["conversion_status"]["missing_vrm_humanoid_bones"]) or "none",
                    str(s["conversion_status"]["manual_bone_map_needed"]).lower(),
                    s["conversion_status"]["texture_export_result"],
                    s["conversion_status"]["conversion_result"],
                    s["conversion_diff"]["status"],
                    "see per-model conversion-report.md",
                ]
            )
            + " |"
        )
    (audit_dir / "conversion-matrix.md").write_text("\n".join(lines) + "\n")


def write_performance_budget_md(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "# Performance budget",
        "",
        "| Model | Slug | Triangles | Vertices | Meshes | Skinned meshes | Materials | Textures | Max texture | Source size MB | Weight | Desktop | Mobile | Recommendations |",
        "|---|---|---:|---:|---:|---:|---:|---:|---|---:|---|---|---|---|",
    ]
    for row in rows:
        perf = row["sections"]["performance_budget"]
        a = row["adapter"]
        lines.append(
            "| "
            + " | ".join(
                [
                    a["display_name"],
                    a["avatar_id"],
                    str(perf["triangles"]),
                    str(perf["vertices"]),
                    str(perf["mesh_count"]),
                    str(perf["skinned_mesh_count"]),
                    str(perf["material_count"]),
                    str(perf["texture_count"]),
                    perf["max_texture_resolution"],
                    str(perf["source_file_size_mb"]),
                    perf["estimated_runtime_weight"],
                    str(perf["desktop_safe"]).lower(),
                    str(perf["mobile_safe"]).lower(),
                    "; ".join(perf["optimization_recommendations"]) or "none",
                ]
            )
            + " |"
        )
    (audit_dir / "performance-budget.md").write_text("\n".join(lines) + "\n")


def write_source_selection_md(audit_dir: Path, rows: list[dict]) -> None:
    lines = ["# Source selection", ""]
    for row in rows:
        a = row["adapter"]
        s = row["sections"]["source_selection"]
        lines.extend(
            [
                f"## {a['display_name']} (`{a['avatar_id']}`)",
                "",
                f"- Best source for audit: `{s['best_source_for_audit']}`",
                f"- Best source for conversion: `{s['best_source_for_conversion']}`",
                f"- Runtime/reference GLB: `{s['runtime_glb_companion'] or 'none'}`",
                f"- Duplicate/inferior variants: {', '.join(s['do_not_use_variants']) or 'none'}",
                f"- Why: {s['reasoning']}",
                "",
            ]
        )
    (audit_dir / "source-selection.md").write_text("\n".join(lines) + "\n")


def write_family_strategies(audit_dir: Path, rows: list[dict]) -> None:
    groups = {
        "Humanoid full-body VRM candidates": [],
        "Humanoid palm-only / no-finger candidates": [],
        "Humanoid-with-offsets / custom mapping candidates": [],
        "Creature-profile candidates": [],
        "Hand-only candidates": [],
        "Static-preview / ignore-for-now candidates": [],
    }
    for row in rows:
        a = row["adapter"]
        finger = a["retargeting_config"]["finger_mode"]
        if a["profile"] == "creature":
            key = "Creature-profile candidates"
        elif a["profile"] == "hand_only":
            key = "Hand-only candidates"
        elif a["implementation_status"] == "ignore_for_now":
            key = "Static-preview / ignore-for-now candidates"
        elif a["profile"] == "humanoid_with_offsets":
            key = "Humanoid-with-offsets / custom mapping candidates"
        elif finger in {"none", "palm_only", "curl_presets"}:
            key = "Humanoid palm-only / no-finger candidates"
        else:
            key = "Humanoid full-body VRM candidates"
        groups[key].append(a["avatar_id"])
    write_json(
        audit_dir / "model-family-strategies.json",
        {
            "schema_version": "posepuppet-model-family-strategies-v1",
            "created_at": utc_now(),
            "families": [
                {
                    "name": name,
                    "models": models,
                    "shared_runtime_profile": "mixed" if "Humanoid" in name else "creature" if "Creature" in name else "hand_only" if "Hand" in name else "static_preview",
                    "shared_conversion_strategy": "Use VRM for humanoids; use custom profiles for creatures; do not inspect large binaries unless conversion fails.",
                }
                for name, models in groups.items()
            ],
        },
    )
    lines = ["# Model family strategies", ""]
    for name, models in groups.items():
        lines.extend([f"## {name}", ""])
        lines.extend([f"- `{model}`" for model in models] or ["- None."])
        lines.extend(
            [
                "",
                "- Shared controls: enable only structurally supported controls from each adapter spec.",
                "- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.",
                "- Inspect per-model dossier only when the aggregate adapter spec is insufficient.",
                "- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.",
                "",
            ]
        )
    (audit_dir / "model-family-strategies.md").write_text("\n".join(lines) + "\n")


def write_playbook(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "# Implementation playbook",
        "",
        "## Token-saving hierarchy",
        "",
        "Level 1 - Machine-readable implementation map:",
        "`model-audits/avatar-adapter-specs.json`",
        "",
        "Level 2 - Normal coding-agent handoff:",
        "`COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`",
        "",
        "Level 3 - Exhaustive generated understanding:",
        "`COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`",
        "",
        "Start with Level 1. Open Level 2 only if implementation needs reasoning context. Open Level 3 only if compact handoff is insufficient. Open per-model files only if Level 3 points you there. Open `bone-tree.txt` only if mapping fails. Open screenshots/contact sheets only if visual review is missing or inconclusive. Open source binaries only if conversion/debugging fails.",
        "",
        "## Known app constraints",
        "",
        "- Current avatar registry is minimal and hardcoded.",
        "- Current runtime loads VRM avatars through the existing VRM loader.",
        "- Do not add arbitrary FBX, BLEND, or ZIP runtime loading.",
        "- Do not add unfinished avatars to UI cycling by default.",
        "- Use warning labels and feature flags when adding experimental avatars.",
        "- If a target VRM is missing locally, the app should fail gracefully or fall back.",
        "- Current audit phase should generate implementation plans, not modify runtime registry unless explicitly asked.",
        "",
        "## Runtime format and VRM policy",
        "",
        "- Runtime format: VRM.",
        "- Path convention: `public/avatars/<slug>.vrm`.",
        "- Policy A - local/private avatars: keep `*.vrm` ignored, user manually places VRMs under `public/avatars/`, app gracefully falls back if missing.",
        "- Policy B - committed approved demo avatars: keep sources ignored, explicitly unignore only approved runtime VRMs such as `!public/avatars/woody.vrm`, and commit only after user approval.",
        "- This audit uses Policy A.",
        "",
        "## Warning-label taxonomy",
        "",
        "| Label | Meaning | UI policy | Default disabled controls |",
        "|---|---|---|---|",
        "| none | Fully verified runtime avatar | Can appear normally | unsupported controls only |",
        "| partial | Usable with known limitations | Feature flag or warning | fingers/face as needed |",
        "| experimental | Conversion/runtime not fully proven | Feature flag | risky controls |",
        "| not-well-developed | Weak or incomplete model support | Hide by default | most controls |",
        "| creature-profile-needed | Needs non-humanoid profile | Hide until profile exists | standard_humanoid_full_body |",
        "| hand-only | Hand/finger test asset | Tools/tests only | body/face/feet |",
        "| static-preview-only | Non-retargeted preview | Preview only | all tracking controls |",
        "| conversion-needed | Source selected but VRM missing | Hide until converted | all runtime controls |",
        "| cleanup-needed | Blender/manual mapping needed | Hide until cleaned | controls with bad mapping |",
        "",
        "## Acceptance tests",
        "",
        "- VRM loads in @pixiv/three-vrm.",
        "- Avatar appears upright and facing the camera.",
        "- Head and arms track without runtime errors.",
        "- Unsupported controls are disabled.",
        "- Missing VRM files show warnings/fallback rather than breaking the app.",
        "",
    ]
    (audit_dir / "implementation-playbook.md").write_text("\n".join(lines) + "\n")


def warning_label(row: dict) -> str:
    action = row["sections"]["final_model_action"]["action"]
    profile = row["adapter"]["profile"]
    if profile == "hand_only":
        return "hand-only"
    if profile == "creature":
        return "creature-profile-needed"
    if action == "cleanup_then_convert":
        return "cleanup-needed"
    if action == "ignore_for_now":
        return "not-well-developed"
    if row["sections"]["conversion_status"]["conversion_result"] != "pass":
        return "conversion-needed"
    return "experimental"


def write_registry_plan(audit_dir: Path, rows: list[dict], created_at: str) -> None:
    entries = []
    for row in rows:
        a = row["adapter"]
        entry = {
            "avatar_id": a["avatar_id"],
            "display_name": a["display_name"],
            "runtime_vrm_path": f"/avatars/{a['avatar_id']}.vrm",
            "adapter_spec_path": f"model-audits/{a['avatar_id']}/avatar-adapter-spec.json",
            "should_add_to_registry_now": False,
            "required_before_enable": ["convert_to_vrm", "load_test", "orientation_test"],
            "warning_label": warning_label(row),
            "profile": a["profile"],
            "default_enabled_controls": a["enabled_controls"],
            "default_disabled_controls": a["disabled_controls"],
            "fallback_if_missing": "current_default",
            "notes": a["do_not_implement"],
        }
        entries.append(entry)
    write_json(audit_dir / "avatar-registry-plan.json", {"schema_version": "posepuppet-avatar-registry-plan-v1", "created_at": created_at, "avatars": entries})
    lines = [
        "# Avatar registry plan",
        "",
        "Documentation only. Do not modify `src/rig/avatarRegistry.ts` until explicitly asked.",
        "",
        "| Avatar | Profile | Warning | Add now | Required before enable | Spec |",
        "|---|---|---|---:|---|---|",
    ]
    for entry in entries:
        lines.append(
            f"| {entry['display_name']} | {entry['profile']} | {entry['warning_label']} | {str(entry['should_add_to_registry_now']).lower()} | {', '.join(entry['required_before_enable'])} | `{entry['adapter_spec_path']}` |"
        )
    lines.extend(
        [
            "",
            "## Buckets",
            "",
            "- Safe to add to registry now: none.",
            "- Safe behind feature flag after conversion/load/orientation tests: Woody, Darth Vader, Fortnite Batman, Iron Man, Shrek, Spider-Man variants, Terminator.",
            "- Convert first: all humanoid candidates without completed conversion diff.",
            "- Cleanup first: Elsa, Buzz Lightyear, Teal v2, Jack Sparrow if offsets/clothing fail.",
            "- Custom profile first: Godzilla, King Kong, Xenomorph, Grogu, Olaf, Baby Yoda.",
            "- Ignore for now: none hard-blocked, but low-scoring models should stay out of UI until improved.",
        ]
    )
    (audit_dir / "avatar-registry-plan.md").write_text("\n".join(lines) + "\n")


def write_generated_config_preview(audit_dir: Path, rows: list[dict]) -> None:
    lines = [
        "// This file is generated audit guidance.",
        "// Do not import it into runtime code until avatar support is intentionally implemented.",
        "// Do not assume referenced VRMs exist unless conversion/runtime tests pass.",
        "",
        "export const GENERATED_AVATAR_CONFIG_PREVIEW = [",
    ]
    for row in rows:
        a = row["adapter"]
        lines.extend(
            [
                "  {",
                f"    id: '{a['avatar_id']}',",
                f"    label: '{a['display_name']}',",
                "    type: 'vrm',",
                f"    url: '/avatars/{a['avatar_id']}.vrm',",
                f"    profile: '{a['profile']}',",
                f"    warningLevel: '{warning_label(row)}',",
                f"    enabledControls: {json.dumps(a['enabled_controls'])},",
                f"    disabledControls: {json.dumps(a['disabled_controls'])},",
                f"    adapterSpec: 'model-audits/{a['avatar_id']}/avatar-adapter-spec.json',",
                "  },",
            ]
        )
    lines.append("] as const;\n")
    (audit_dir / "generated-avatar-config-preview.ts").write_text("\n".join(lines))


def write_coding_queue(audit_dir: Path, rows: list[dict], created_at: str) -> None:
    tasks = [
        {
            "rank": 1,
            "task": "Convert Woody FBX to VRM and verify runtime load",
            "models": ["woody"],
            "depends_on": [],
            "reads": ["model-audits/woody/avatar-adapter-spec.json", "model-audits/woody/llm-dossier.md"],
            "do_not_read": ["source textures unless conversion fails", "duplicate GLBs"],
            "acceptance_tests": ["public/avatars/woody.vrm loads in @pixiv/three-vrm", "PosePuppet fallback is graceful if missing"],
        },
        {
            "rank": 2,
            "task": "Add a gated avatar registry path for converted humanoid VRMs",
            "models": ["woody", "darth-vader", "fortnite-batman", "iron-man", "shrek"],
            "depends_on": ["VRM conversion/load tests"],
            "reads": ["model-audits/avatar-registry-plan.json", "model-audits/avatar-adapter-specs.json"],
            "do_not_read": ["source binaries"],
            "acceptance_tests": ["avatars are hidden or warning-labeled until target VRMs exist"],
        },
        {
            "rank": 3,
            "task": "Implement humanoid offset profiles and palm-only fallback",
            "models": ["spider-man-no-way-home", "spider-man-playstation", "amazing-spider-man-2", "terminator-t-800", "jack-sparrow", "elsa"],
            "depends_on": ["basic registry support"],
            "reads": ["model-audits/model-family-strategies.md"],
            "do_not_read": ["duplicate downloads"],
            "acceptance_tests": ["missing fingers disable finger controls", "face-touch remains disabled until IK tests pass"],
        },
        {
            "rank": 4,
            "task": "Create creature profile prototypes",
            "models": ["godzilla", "king-kong", "xenomorph", "grogu", "olaf", "baby-yoda"],
            "depends_on": [],
            "reads": ["model-audits/model-family-strategies.md"],
            "do_not_read": ["source binaries until profile targets are chosen"],
            "acceptance_tests": ["standard_humanoid_full_body is disabled for creature models"],
        },
        {
            "rank": 5,
            "task": "Create hand/finger test harness",
            "models": ["rigged-hand"],
            "depends_on": [],
            "reads": ["model-audits/rigged-hand/avatar-adapter-spec.json"],
            "do_not_read": ["full avatar folders"],
            "acceptance_tests": ["hand asset is not exposed as a full avatar"],
        },
    ]
    write_json(audit_dir / "coding-queue.json", {"schema_version": "posepuppet-coding-queue-v1", "created_at": created_at, "tasks": tasks})
    lines = ["# Coding queue", ""]
    for task in tasks:
        lines.extend(
            [
                f"## {task['rank']}. {task['task']}",
                "",
                f"- Models: {', '.join(task['models'])}",
                f"- Depends on: {', '.join(task['depends_on']) or 'none'}",
                f"- Reads: {', '.join(task['reads'])}",
                f"- Do not read: {', '.join(task['do_not_read'])}",
                f"- Acceptance tests: {', '.join(task['acceptance_tests'])}",
                "",
            ]
        )
    (audit_dir / "coding-queue.md").write_text("\n".join(lines) + "\n")


def write_readme(audit_dir: Path) -> None:
    lines = [
        "# PosePuppet model audits",
        "",
        "This folder contains text/JSON implementation guidance for local avatar source assets. It is designed so future coding agents can avoid reopening large model binaries during normal implementation.",
        "",
        "## Read order",
        "",
        "1. `model-audits/avatar-adapter-specs.json`",
        "2. `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`",
        "3. `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`",
        "",
        "## Safe to commit",
        "",
        "- Markdown and JSON audit outputs.",
        "- `bone-tree.txt`, `source-files.txt`, `warnings.md`.",
        "- Generated TypeScript preview because it is documentation only.",
        "",
        "## Not included",
        "",
        "- Source model binaries.",
        "- ZIPs and nested ZIPs.",
        "- Textures.",
        "- Converted VRMs unless the user explicitly approves a specific runtime VRM.",
        "- Screenshots/contact sheets by default.",
        "",
        "## Commands",
        "",
        "```sh",
        "python3 tools/audit_model.py --self-test",
        "python3 tools/generate_model_audit_v2.py model-audits",
        "python3 tools/validate_model_audits.py model-audits",
        "python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only",
        "```",
    ]
    (audit_dir / "README.md").write_text("\n".join(lines) + "\n")


def write_dedupe_and_source_reports(audit_dir: Path, rows: list[dict]) -> None:
    dedupe = ["# Dedupe report", "", "Duplicate and repeated download handling is encoded in each model's `source_selection.do_not_use_variants`.", ""]
    source = ["# Source archive report", "", "Archives were inspected by the earlier Blender audit system; V2 keeps source binaries out of generated handoffs.", ""]
    failures = ["# Audit failures", "", "- No V2 generation failures."]
    for row in rows:
        s = row["sections"]["source_selection"]
        if s["duplicate_variants"] or s["do_not_use_variants"]:
            dedupe.append(f"- **{row['adapter']['display_name']}**: skip {', '.join(s['do_not_use_variants']) or 'none'}")
        source.append(f"- **{row['adapter']['display_name']}**: selected `{s['best_source_for_audit']}`; runtime/reference `{s['runtime_glb_companion'] or 'none'}`.")
    (audit_dir / "dedupe-report.md").write_text("\n".join(dedupe) + "\n")
    (audit_dir / "source-archive-report.md").write_text("\n".join(source) + "\n")
    (audit_dir / "audit-failures.md").write_text("\n".join(failures) + "\n")


def write_handoff(audit_dir: Path, rows: list[dict]) -> None:
    top = [row for row in rows if row["sections"]["final_model_action"]["action"] == "convert_then_test"][:8]
    creatures = [row for row in rows if row["adapter"]["profile"] == "creature"]
    lines = [
        "# PosePuppet model audit LLM handoff",
        "",
        "## Token-saving hierarchy",
        "",
        "Level 1 - Machine-readable implementation map: `model-audits/avatar-adapter-specs.json`",
        "Level 2 - Normal coding-agent handoff: `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`",
        "Level 3 - Exhaustive generated understanding: `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`",
        "",
        "Do not inspect source binaries, textures, duplicate downloads, screenshots, or full bone trees unless a conversion/mapping/runtime failure requires it.",
        "",
        "## Known current app constraints",
        "",
        "- Current avatar registry is minimal and hardcoded.",
        "- Current runtime loads VRM avatars through the existing VRM loader.",
        "- Do not add arbitrary FBX, BLEND, or ZIP runtime loading.",
        "- Do not add unfinished avatars to UI cycling by default.",
        "- Use warning labels and feature flags when adding experimental avatars.",
        "- If a target VRM is missing locally, the app should fail gracefully or fall back.",
        "- Current audit phase should generate implementation plans, not modify runtime registry unless explicitly asked.",
        "",
        "## Top recommended models",
        "",
    ]
    for row in top:
        a = row["adapter"]
        lines.append(f"- **{a['display_name']}** (`{a['avatar_id']}`): `{a['source_to_convert']}` -> `{a['runtime_vrm_path']}`; profile `{a['profile']}`; disabled {', '.join(a['disabled_controls']) or 'none'}.")
    lines.extend(["", "## Creature/custom profile candidates", ""])
    for row in creatures:
        lines.append(f"- **{row['adapter']['display_name']}**: use creature profile; disable standard humanoid full body.")
    lines.extend(
        [
            "",
            "## Files to read next",
            "",
            "- `model-audits/avatar-adapter-specs.json`",
            "- `model-audits/model-family-strategies.md`",
            "- `model-audits/coding-queue.md`",
            "- Per-model `avatar-adapter-spec.json` only for the avatar being implemented.",
        ]
    )
    (audit_dir / "llm-handoff.md").write_text("\n".join(lines) + "\n")


def read_file_for_combined(path: Path) -> str:
    try:
        return path.read_text(errors="ignore")
    except Exception as exc:
        return f"[Could not read {path}: {type(exc).__name__}: {exc}]\n"


def write_combined(repo_root: Path, audit_dir: Path, rows: list[dict]) -> None:
    compact_files = [
        audit_dir / "llm-handoff.md",
        audit_dir / "avatar-adapter-specs.md",
        audit_dir / "runtime-readiness.md",
        audit_dir / "conversion-matrix.md",
        audit_dir / "model-family-strategies.md",
        audit_dir / "avatar-registry-plan.md",
        audit_dir / "coding-queue.md",
        audit_dir / "implementation-playbook.md",
    ]
    compact = [
        "# Combined PosePuppet Model Audit - LLM Handoff Compact V2",
        "",
        "Normal file to give coding agents. Start here after `model-audits/avatar-adapter-specs.json`.",
        "",
        "## Token-saving hierarchy",
        "",
        "Level 1 - Machine-readable implementation map: `model-audits/avatar-adapter-specs.json`",
        "Level 2 - Normal coding-agent handoff: `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`",
        "Level 3 - Exhaustive generated understanding: `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`",
        "",
        "## Included summaries",
        "",
    ]
    for path in compact_files:
        rel = path.relative_to(repo_root)
        compact.extend([f"## File: `{rel}`", "", "```markdown", read_file_for_combined(path), "```", ""])
    for row in rows:
        a = row["adapter"]
        compact.extend(
            [
                f"## Per-model summary: {a['display_name']} (`{a['avatar_id']}`)",
                "",
                f"- Action: `{row['sections']['final_model_action']['action']}`",
                f"- Profile: `{a['profile']}`",
                f"- Source: `{a['source_to_convert']}`",
                f"- Target: `{a['runtime_vrm_path']}`",
                f"- Read first: `model-audits/{a['avatar_id']}/avatar-adapter-spec.json`",
                f"- Do not implement: {'; '.join(a['do_not_implement'])}",
                "",
            ]
        )
    (repo_root / "COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md").write_text("\n".join(compact) + "\n")

    exhaustive_files = [
        audit_dir / "README.md",
        audit_dir / "llm-handoff.md",
        audit_dir / "runtime-readiness.md",
        audit_dir / "conversion-matrix.md",
        audit_dir / "performance-budget.md",
        audit_dir / "source-selection.md",
        audit_dir / "implementation-playbook.md",
        audit_dir / "avatar-adapter-specs.json",
        audit_dir / "avatar-adapter-specs.md",
        audit_dir / "model-family-strategies.md",
        audit_dir / "model-family-strategies.json",
        audit_dir / "summary.json",
        audit_dir / "recommendations.md",
        audit_dir / "dedupe-report.md",
        audit_dir / "source-archive-report.md",
        audit_dir / "audit-failures.md",
        audit_dir / "source-lock.json",
        audit_dir / "audit-staleness-report.md",
        audit_dir / "avatar-registry-plan.md",
        audit_dir / "avatar-registry-plan.json",
        audit_dir / "generated-avatar-config-preview.ts",
        audit_dir / "coding-queue.md",
        audit_dir / "coding-queue.json",
    ]
    all_lines = [
        "# Combined PosePuppet Model Audit - All Generated Understanding V2",
        "",
        f"Generated: {utc_now()}",
        "",
        "Purpose: collect generated understanding artifacts so future LLMs can avoid inspecting large 3D assets.",
        "",
        "Important exclusions: no source binaries, converted VRMs, ZIPs, textures, screenshots/contact sheets, or raw Blender logs.",
        "",
        "## Included Generated Files",
        "",
    ]
    for path in exhaustive_files:
        rel = path.relative_to(repo_root)
        all_lines.extend([f"## File: `{rel}`", "", fenced_for(path), read_file_for_combined(path), "```", ""])
    per_model_files = [
        "llm-dossier.md",
        "llm-dossier.json",
        "avatar-adapter-spec.md",
        "avatar-adapter-spec.json",
        "conversion-report.md",
        "conversion-diff.md",
        "conversion-diff.json",
        "posepuppet-runtime-test.md",
        "retargeting-simulation.md",
        "retargeting-simulation.json",
        "model-card.md",
        "warnings.md",
        "source-files.txt",
        "suggested-bone-map.json",
    ]
    for row in rows:
        slug = row["adapter"]["avatar_id"]
        for name in per_model_files:
            path = audit_dir / slug / name
            if not path.exists():
                continue
            rel = path.relative_to(repo_root)
            all_lines.extend([f"## File: `{rel}`", "", fenced_for(path), read_file_for_combined(path), "```", ""])
        bone_path = audit_dir / slug / "bone-tree.txt"
        if bone_path.exists():
            lines = read_file_for_combined(bone_path).splitlines()
            summary = "\n".join(lines[:120])
            if len(lines) > 120:
                summary += f"\n\n[Bone tree truncated: {len(lines)} total lines. Open `{bone_path.relative_to(repo_root)}` only if mapping fails.]\n"
            all_lines.extend([f"## Compact bone summary: `model-audits/{slug}/bone-tree.txt`", "", "```text", summary, "```", ""])
    (repo_root / "COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md").write_text("\n".join(all_lines) + "\n")


def fenced_for(path: Path) -> str:
    if path.suffix == ".json":
        return "```json"
    if path.suffix == ".ts":
        return "```ts"
    if path.suffix == ".txt":
        return "```text"
    return "```markdown"


def tool_hashes(repo_root: Path) -> dict:
    tools = ["audit_model.py", "audit_models.py", "mobility_audit.py", "export_fbx_to_vrm.py"]
    out = {}
    for name in tools:
        path = repo_root / "tools" / name
        out[f"{name.replace('.', '_')}_sha256"] = sha256_file(path) if path.exists() else ""
    return out


def generate(audit_dir: Path) -> None:
    repo_root = audit_dir.resolve().parent
    audit_dir = audit_dir.resolve()
    created_at = utc_now()
    loaded = load_models(audit_dir)
    locks = []
    generated_rows = []
    hashes = tool_hashes(repo_root)
    for model_dir, audit, source_meta in loaded:
        lock_entry = source_lock_for(audit, repo_root, source_meta, created_at)
        lock_entry["tool_versions"] = hashes
        sections = all_sections(audit, repo_root, model_dir, source_meta, lock_entry)
        adapter = build_adapter(audit, sections, lock_entry)
        write_per_model(model_dir, audit, sections, adapter)
        locks.append(lock_entry)
        generated_rows.append({"model_dir": model_dir, "audit": audit, "sections": sections, "adapter": adapter})

    source_lock = {
        "schema_version": SOURCE_LOCK_SCHEMA,
        "created_at": created_at,
        "source_root_used": str(source_root_for(repo_root)),
        "models": sorted(locks, key=lambda row: PRIORITY.get(row["slug"], 100)),
    }
    write_json(audit_dir / "source-lock.json", source_lock)
    staleness_lines = [
        "# Audit staleness report",
        "",
        f"Generated: {created_at}",
        "",
        "| Model | Status | Selected source | Runtime reference |",
        "|---|---|---|---|",
    ]
    for entry in source_lock["models"]:
        staleness_lines.append(
            f"| {entry['display_name']} | {entry['audit_status']} | `{entry['selected_source']}` | `{entry['runtime_glb_reference'] or 'none'}` |"
        )
    (audit_dir / "audit-staleness-report.md").write_text("\n".join(staleness_lines) + "\n")
    write_aggregates(audit_dir, repo_root, generated_rows, created_at)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate PosePuppet model audit V2 handoff artifacts.")
    parser.add_argument("audit_dir")
    args = parser.parse_args(argv)
    generate(Path(args.audit_dir).expanduser())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
