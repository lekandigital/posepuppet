#!/usr/bin/env python3
"""Generate visual QA continuation reports from ignored evidence folders."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
AUDIT_ROOT = REPO_ROOT / "model-audits"
WORK_ROOT = REPO_ROOT / "model-working"


ACTIVE_ACCEPTED = {
    "woody": {
        "display": "Woody",
        "visual_review": "pass",
        "registry_decision": "kept_active",
        "summary": "Full-body browser render is upright, textured, and pose-reactive across arms, torso, leg proxies, and face-touch proxies.",
        "limitations": ["Finger curls are not visibly reliable.", "Face-touch remains a proxy, not IK contact.", "Runtime feet remain disabled outside QA pose hooks."],
    },
    "darth-vader": {
        "display": "Darth Vader",
        "visual_review": "pass",
        "registry_decision": "kept_active",
        "summary": "Full-body browser render is upright and stable; cape remains attached while arms, torso, and leg proxy poses are readable.",
        "limitations": ["Dark materials reduce fine detail visibility.", "Finger and face-touch evidence is approximate.", "Cape clipping risk remains for future runtime poses."],
    },
    "fortnite-batman": {
        "display": "Fortnite Batman",
        "visual_review": "pass",
        "registry_decision": "kept_active",
        "summary": "Full-body browser render is upright, textured, and stable with readable arm, torso, and leg proxy motion.",
        "limitations": ["Finger detail is weak.", "Cape should remain conservative in future motion.", "Face-touch is only a proxy pose."],
    },
    "iron-man": {
        "display": "Iron Man",
        "visual_review": "pass",
        "registry_decision": "kept_active",
        "summary": "Full-body browser render is visible after scale-down normalization; pose proxies remain readable without detached geometry.",
        "limitations": ["Hands and fingers are visually coarse.", "Bright floor contrast makes foot proxies easier than hand detail.", "Face-touch remains a proxy."],
    },
    "shrek": {
        "display": "Shrek",
        "visual_review": "pass",
        "registry_decision": "kept_active",
        "summary": "Full-body browser render is upright and textured with readable arm, torso, walking, and foot proxy poses.",
        "limitations": ["Wide body proportions make some arm poses crop at frame edges.", "Finger evidence is weak.", "Face-touch remains a proxy."],
    },
}


DOWNGRADED = {
    "amazing-spider-man-2": {
        "display": "The Amazing Spider-Man 2",
        "visual_review": "fail",
        "registry_decision": "removed_from_active_registry",
        "final_classification": "rejected_visual_candidate",
        "summary": "Browser smoke reports loaded, but the visual contact sheet shows only the stage/floor; the avatar is not visually readable.",
        "blockers": ["browser_visual_blank", "needs_skinned_mesh_or_transform_repair"],
        "next_steps": ["Inspect exported VRM mesh/material visibility in Blender.", "Repair source or export transform before another browser candidate attempt."],
    },
    "terminator-t-800": {
        "display": "Terminator T-800",
        "visual_review": "fail",
        "registry_decision": "removed_from_active_registry",
        "final_classification": "rejected_visual_candidate",
        "summary": "Browser smoke reports loaded, but the contact sheet remains visually blank; no usable avatar silhouette is visible.",
        "blockers": ["browser_visual_blank", "needs_material_or_transform_repair"],
        "next_steps": ["Open converted VRM in Blender and inspect mesh visibility/material alpha.", "Do not reactivate until browser contact sheet is readable."],
    },
    "spider-man-no-way-home": {
        "display": "Spider-Man No Way Home",
        "visual_review": "fail",
        "registry_decision": "removed_from_active_registry",
        "final_classification": "rejected_visual_candidate",
        "summary": "Earlier attempts exposed orientation/transform trouble; the final browser contact sheet is blank, so the candidate is not acceptable.",
        "blockers": ["browser_visual_blank", "orientation_or_skin_transform_repair_needed"],
        "next_steps": ["Repair source orientation and skinned mesh transform manually.", "Avoid automatic orientation heuristics that damage other valid models."],
    },
    "spider-man-playstation": {
        "display": "Spider-Man PlayStation",
        "visual_review": "partial",
        "registry_decision": "removed_from_active_registry",
        "final_classification": "downgraded_reference_candidate",
        "summary": "Browser visual evidence shows only the upper body; lower body is missing, submerged, or outside the readable frame.",
        "blockers": ["lower_body_not_readable_in_browser", "not_full_humanoid_candidate"],
        "next_steps": ["Inspect hierarchy, bounds, and skin weights around hips/legs.", "Keep as reference only until full-body contact sheet passes."],
    },
    "jack-sparrow": {
        "display": "Jack Sparrow",
        "visual_review": "partial",
        "registry_decision": "removed_from_active_registry",
        "final_classification": "downgraded_reference_candidate",
        "summary": "Scale repair made the model visible, but every browser pose renders two Jack figures side by side.",
        "blockers": ["duplicate_character_mesh_or_hierarchy", "not_single_avatar_candidate"],
        "next_steps": ["Clean duplicate mesh/armature hierarchy in source.", "Re-export and rerun browser visual QA before active use."],
    },
}


DEFERRED_HARD = {
    "elsa": {
        "display": "Elsa",
        "summary": "The initial browser failure was fixed from an HTML fallback to serving the VRM, then Three-VRM rejected the file because required humanoid bones are missing.",
        "blockers": ["missing_spine", "missing_left_leg_chain", "missing_right_leg_chain", "missing_feet"],
        "required_bones": ["spine", "leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot"],
        "next_steps": ["Manual source re-rig or bone-map repair is required before another VRM export.", "Do not defer as a serving bug; serving was fixed, rig structure remains the blocker."],
    },
    "buzz-lightyear": {
        "display": "Buzz Lightyear",
        "summary": "Serving was repaired, but the candidate VRM has no usable Three-VRM humanoid mapping; source audit shows generic Bone.* hierarchy without semantic recovery from names alone.",
        "blockers": ["missing_humanoid_required_bones", "generic_bone_tree", "manual_mapping_needed"],
        "required_bones": ["hips", "spine", "head", "leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot", "leftUpperArm", "leftLowerArm", "leftHand", "rightUpperArm", "rightLowerArm", "rightHand"],
        "next_steps": ["Inspect bone positions, vertex groups, and mesh names in Blender to build a manual map.", "Do not rely on bone names for this source."],
    },
    "teal-v2": {
        "display": "Teal v2",
        "summary": "Serving was repaired and the source hierarchy contains recoverable semantic bones, but the exported VRM still misses required humanoid assignments.",
        "blockers": ["missing_humanoid_assignments", "manual_bone_map_recovery_needed"],
        "required_bones": ["hips", "leftUpperLeg", "rightUpperLeg", "leftLowerArm", "leftHand", "rightLowerArm", "rightHand"],
        "next_steps": ["Use the source hierarchy to recover Leg.*, Foot.*, Arm Cannon.*, and Arm Hand.* assignments.", "Re-export only after verifying vertex groups and bone positions."],
    },
}


SPECIAL_PREVIEWS = {
    "rigged-hand": {
        "display": "Rigged Hand",
        "profile": "hand_only",
        "visual_review": "partial",
        "summary": "Source renders show a hand-only asset with a long sleeve/arm mesh. Hand/finger proxy pose renders were attempted; framing is imperfect but the asset must remain hand-only.",
        "blockers": ["not_full_body", "browser_hand_runtime_not_implemented"],
        "next_steps": ["Build a dedicated hand-only runtime before website use.", "Do not add hips, legs, or full-body humanoid assumptions."],
    },
    "baby-yoda": {
        "display": "Baby Yoda",
        "profile": "creature",
        "visual_review": "fail",
        "summary": "Source renders are dominated by the ground plane and tiny model scale; a creature preview was attempted but the candidate needs framing/scale repair.",
        "blockers": ["source_preview_scale_or_framing_bad"],
        "next_steps": ["Repair preview framing and scale before runtime experiments.", "Keep out of humanoid mode."],
    },
    "godzilla": {
        "display": "Godzilla",
        "profile": "creature",
        "visual_review": "pass",
        "summary": "Source preview is readable, creature anatomy is obvious, and proxy head/arm/tail/jaw pose renders completed.",
        "blockers": ["custom_creature_runtime_needed"],
        "next_steps": ["Use a creature-specific runtime profile.", "Do not assign this to standard humanoid retargeting."],
    },
    "grogu": {
        "display": "Grogu",
        "profile": "creature",
        "visual_review": "pass",
        "summary": "Source preview is readable and proxy creature poses are visible; this is a strong creature/static-preview candidate.",
        "blockers": ["custom_creature_runtime_needed"],
        "next_steps": ["Use creature-specific offsets and controls.", "Keep out of standard humanoid mode."],
    },
    "king-kong": {
        "display": "King Kong",
        "profile": "creature",
        "visual_review": "pass",
        "summary": "Source preview is readable with bipedal creature proportions; proxy creature poses render, but custom creature logic is required.",
        "blockers": ["custom_creature_runtime_needed"],
        "next_steps": ["Use creature-specific runtime rules.", "Do not treat as a standard full-body human despite bipedal structure."],
    },
    "olaf": {
        "display": "Olaf",
        "profile": "creature",
        "visual_review": "pass",
        "summary": "Source preview is readable and static/creature pose proxies render; anatomy is non-human and should stay creature/static-preview only.",
        "blockers": ["custom_creature_runtime_needed"],
        "next_steps": ["Use static or creature profile only.", "Do not force humanoid leg/torso assumptions."],
    },
    "xenomorph": {
        "display": "Xenomorph",
        "profile": "creature",
        "visual_review": "partial",
        "summary": "Source rig is visible, but the long tail dominates bounds and proxy renders are poorly framed; this needs custom creature framing before preview acceptance.",
        "blockers": ["tail_dominant_bounds", "custom_framing_needed"],
        "next_steps": ["Create creature framing rules that ignore extreme tail bounds when needed.", "Keep out of humanoid mode."],
    },
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def git_show_text(path: Path) -> str | None:
    relpath = rel(path)
    result = subprocess.run(["git", "show", f"HEAD:{relpath}"], cwd=REPO_ROOT, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        return None
    return result.stdout


def git_show_json(path: Path) -> Any:
    text = git_show_text(path)
    if text is None:
        return None
    return json.loads(text)


def write_augmented_md(path: Path, fallback_title: str, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    marker = "\n## Visual QA Continuation\n"
    section = marker + "\n" + "\n".join(lines).rstrip() + "\n"
    base = git_show_text(path)
    if base is None:
        path.write_text("# " + fallback_title + "\n" + section)
        return
    if marker in base:
        base = base[: base.index(marker)]
    path.write_text(base.rstrip() + "\n" + section)


def write_md(path: Path, title: str, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# " + title + "\n\n" + "\n".join(lines).rstrip() + "\n")


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def capture_for(slug: str) -> dict[str, Any]:
    manifest = WORK_ROOT / slug / "visual-review" / "capture-results.json"
    data = read_json(manifest) or {}
    return {
        "manifest": manifest,
        "data": data,
        "status": data.get("status", "missing"),
        "pose_count": len(data.get("pose_results", [])),
        "contact_sheet": WORK_ROOT / slug / "visual-review" / "contact-sheet.png",
    }


def source_preview_for(slug: str) -> dict[str, Any]:
    preview = WORK_ROOT / slug / "source-preview"
    manifest = preview / "screenshots" / "preview-manifest.json"
    data = read_json(manifest) or {}
    return {
        "manifest": manifest,
        "data": data,
        "pose_count": len(data.get("pose_renders", [])),
        "contact_sheet": preview / "contact-sheet.png",
        "audit": preview / "audit.json",
    }


def write_attempt_manifest(slug: str, attempt_id: str, payload: dict[str, Any]) -> str:
    path = WORK_ROOT / slug / "attempts" / attempt_id / "attempt-manifest.json"
    write_json(path, payload)
    return rel(path)


def pose_tests_from_capture(slug: str, capture: dict[str, Any], visual_review: str) -> list[dict[str, Any]]:
    tests = []
    for pose in capture["data"].get("pose_results", []):
        tests.append(
            {
                "pose_name": pose.get("pose"),
                "result": "pass" if visual_review == "pass" else ("partial" if visual_review == "partial" else "fail"),
                "applied": pose.get("applied", True),
                "screenshot_path": pose.get("screenshot_path"),
                "visual_review": visual_review,
                "reason": "Reviewed from browser contact sheet generated by avatar-visual-review mode.",
            }
        )
    return tests


def write_active_model(slug: str, info: dict[str, Any], accepted: bool) -> dict[str, Any]:
    model_dir = AUDIT_ROOT / slug
    capture = capture_for(slug)
    classification = "active_visual_accepted" if accepted else info["final_classification"]
    blockers = [] if accepted else info["blockers"]
    if accepted:
        blockers = ["future_runtime_limits_only"]
    visual = {
        "schema_version": "posepuppet-visual-rig-review-v3",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "source": "generated-vrm-browser-capture",
        "attempt_id": "attempt-visual-qa-final",
        "browser_capture_status": capture["status"],
        "visual_review": info["visual_review"],
        "final_classification": classification,
        "registry_decision": info["registry_decision"],
        "accepted_for_active_registry": accepted,
        "summary": info["summary"],
        "limitations": info.get("limitations", []),
        "blockers": blockers,
        "next_steps": info.get("next_steps", []),
        "evidence": {
            "capture_manifest": rel(capture["manifest"]),
            "contact_sheet": rel(capture["contact_sheet"]),
            "contact_sheet_committed": False,
            "pose_frame_count": capture["pose_count"],
            "browser_smoke": "pass" if capture["status"] == "loaded" else "fail",
        },
        "safety": {
            "query_param_only": True,
            "enabled_in_ui": False,
            "generated_assets_committed": False,
        },
    }
    write_json(model_dir / "visual-rig-review.json", visual)
    write_md(
        model_dir / "visual-rig-review.md",
        f"{info['display']} visual rig review",
        [
            f"- Visual review: `{visual['visual_review']}`",
            f"- Final classification: `{classification}`",
            f"- Registry decision: `{info['registry_decision']}`",
            f"- Browser capture status: `{capture['status']}`",
            f"- Contact sheet: `{rel(capture['contact_sheet'])}`",
            f"- Pose frames reviewed: `{capture['pose_count']}`",
            "",
            "## Image reasoning",
            "",
            info["summary"],
            "",
            "## Blockers / limitations",
            "",
            *(f"- {item}" for item in (info.get("limitations") or blockers)),
        ],
    )

    pose_tests = pose_tests_from_capture(slug, capture, info["visual_review"])
    pose_status = "pass_with_limitations" if accepted else ("partial" if info["visual_review"] == "partial" else "fail")
    pose = git_show_json(model_dir / "pose-suite-validation.json") or read_json(model_dir / "pose-suite-validation.json") or {}
    pose.update(
        {
            "status": pose_status,
            "visual_review": info["visual_review"],
            "visual_qa": {
                "created_at": now(),
                "source": "generated-vrm-browser-visual-qa",
                "contact_sheet": rel(capture["contact_sheet"]),
                "pose_frame_count": len(pose_tests),
                "browser_capture_status": capture["status"],
                "classification": classification,
                "notes": ["QA pose hooks are for visual validation only; normal runtime retargeting still avoids foot/finger overclaims."],
            },
        }
    )
    write_json(model_dir / "pose-suite-validation.json", pose)
    write_augmented_md(
        model_dir / "pose-suite-validation.md",
        f"{info['display']} pose-suite validation",
        [
            f"- Status: `{pose_status}`",
            f"- Pose images reviewed: `{len(pose_tests)}`",
            f"- Contact sheet: `{rel(capture['contact_sheet'])}`",
            f"- Visual review: `{info['visual_review']}`",
            "",
            "Browser visual QA drove neutral, arm, elbow, wrist, torso, walking, foot, rowing, flying, and face-touch proxy poses. The earlier structural pose-suite details above are preserved.",
        ],
    )

    attempt_id = "attempt-visual-qa-final"
    attempt_path = write_attempt_manifest(
        slug,
        attempt_id,
        {
            "schema_version": "posepuppet-visual-qa-attempt-v1",
            "created_at": now(),
            "slug": slug,
            "attempt_id": attempt_id,
            "targeted_change": "browser visual QA capture with final scale/framing normalization",
            "capture_manifest": rel(capture["manifest"]),
            "contact_sheet": rel(capture["contact_sheet"]),
            "visual_review": info["visual_review"],
            "classification": classification,
            "next_steps": info.get("next_steps", []),
        },
    )
    attempts = {
        "schema_version": "posepuppet-attempts-summary-v2",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "category": "standard_humanoid",
        "final_classification": classification,
        "best_attempt_id": attempt_id if accepted else "",
        "attempts": [
            {
                "attempt_id": "attempt-001-baseline",
                "label": "prior generated VRM browser smoke",
                "classification": "smoke_pass_visual_unproven",
                "browser_smoke": "pass",
                "visual_review": "not_available",
                "post_vrm_validation": "available",
            },
            {
                "attempt_id": attempt_id,
                "label": "final browser visual QA",
                "classification": "accepted_active_candidate" if accepted else classification,
                "browser_smoke": "pass" if capture["status"] == "loaded" else "fail",
                "visual_review": info["visual_review"],
                "pose_suite": pose_status,
                "attempt_manifest": attempt_path,
                "contact_sheet": rel(capture["contact_sheet"]),
                "blockers": blockers,
            },
        ],
    }
    write_json(model_dir / "attempts-summary.json", attempts)
    write_md(
        model_dir / "attempts-summary.md",
        f"{info['display']} attempts summary",
        [
            f"- Final classification: `{classification}`",
            f"- Best attempt: `{attempts['best_attempt_id'] or 'none'}`",
            f"- Final contact sheet: `{rel(capture['contact_sheet'])}`",
            "",
            *(f"- `{item['attempt_id']}`: {item['classification']}" for item in attempts["attempts"]),
        ],
    )

    runtime = read_json(model_dir / "runtime-capability-profile.json") or {}
    runtime.update(
        {
            "schema_version": "posepuppet-runtime-capability-profile-v3",
            "created_at": now(),
            "slug": slug,
            "display_name": info["display"],
            "runtime_profile": "humanoid",
            "quality_label": "experimental_visual_accepted" if accepted else classification,
            "active_candidate": {
                "attempt_id": attempt_id,
                "browser_smoke": "pass" if accepted else "downgraded",
                "visual_review": info["visual_review"],
                "pose_suite": pose_status,
                "registry_decision": info["registry_decision"],
                "contact_sheet": rel(capture["contact_sheet"]),
            },
            "blockers": blockers,
            "warning_label": "experimental",
            "warning_text": "Experimental query-param-only generated candidate; not public UI promoted.",
        }
    )
    write_json(model_dir / "runtime-capability-profile.json", runtime)
    write_md(
        model_dir / "runtime-capability-profile.md",
        f"{info['display']} runtime capability profile",
        [
            f"- Runtime profile: `{runtime['runtime_profile']}`",
            f"- Quality label: `{runtime['quality_label']}`",
            f"- Registry decision: `{info['registry_decision']}`",
            f"- Browser smoke: `{runtime['active_candidate']['browser_smoke']}`",
            f"- Visual review: `{info['visual_review']}`",
            "",
            "Generated candidates remain query-param-only, experimental, and excluded from public UI cycling.",
        ],
    )
    return visual


def write_deferred_model(slug: str, info: dict[str, Any]) -> dict[str, Any]:
    model_dir = AUDIT_ROOT / slug
    capture = capture_for(slug)
    attempt_id = "attempt-visual-qa-serving-fixed-vrm-required-bones"
    attempt_path = write_attempt_manifest(
        slug,
        attempt_id,
        {
            "schema_version": "posepuppet-visual-qa-attempt-v1",
            "created_at": now(),
            "slug": slug,
            "attempt_id": attempt_id,
            "targeted_change": "serve generated VRM from ignored public symlink and retry browser smoke",
            "capture_manifest": rel(capture["manifest"]),
            "contact_sheet": rel(capture["contact_sheet"]),
            "classification": "deferred_manual_rig_repair",
            "blockers": info["blockers"],
            "required_bones": info["required_bones"],
        },
    )
    visual = {
        "schema_version": "posepuppet-visual-rig-review-v3",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "source": "generated-vrm-browser-capture",
        "attempt_id": attempt_id,
        "browser_capture_status": capture["status"],
        "visual_review": "fail",
        "final_classification": "deferred_manual_rig_repair",
        "registry_decision": "not_registered",
        "accepted_for_active_registry": False,
        "summary": info["summary"],
        "blockers": info["blockers"],
        "required_bones": info["required_bones"],
        "next_steps": info["next_steps"],
        "evidence": {
            "capture_manifest": rel(capture["manifest"]),
            "contact_sheet": rel(capture["contact_sheet"]),
            "attempt_manifest": attempt_path,
            "contact_sheet_committed": False,
        },
    }
    write_json(model_dir / "visual-rig-review.json", visual)
    write_md(
        model_dir / "visual-rig-review.md",
        f"{info['display']} visual rig review",
        [
            "- Visual review: `fail`",
            "- Final classification: `deferred_manual_rig_repair`",
            f"- Browser capture status: `{capture['status']}`",
            f"- Contact sheet: `{rel(capture['contact_sheet'])}`",
            "",
            info["summary"],
            "",
            "## Required missing bones",
            "",
            *(f"- {bone}" for bone in info["required_bones"]),
        ],
    )
    pose = git_show_json(model_dir / "pose-suite-validation.json") or read_json(model_dir / "pose-suite-validation.json") or {}
    pose.update(
        {
            "status": "blocked",
            "visual_review": "fail",
            "visual_qa": {
                "created_at": now(),
                "source": "generated-vrm-browser-visual-qa",
                "contact_sheet": rel(capture["contact_sheet"]),
                "pose_frame_count": 0,
                "browser_capture_status": capture["status"],
                "classification": "deferred_manual_rig_repair",
                "blockers": info["blockers"],
                "required_bones": info["required_bones"],
            },
        }
    )
    write_json(model_dir / "pose-suite-validation.json", pose)
    write_augmented_md(
        model_dir / "pose-suite-validation.md",
        f"{info['display']} pose-suite validation",
        [
            "- Status: `blocked`",
            "- Pose count: `0`",
            f"- Contact sheet: `{rel(capture['contact_sheet'])}`",
            "",
            "Browser visual pose capture could not run because Three-VRM rejected the required humanoid bones before the candidate loaded. Earlier structural pose-suite details above are preserved.",
        ],
    )
    attempts = {
        "schema_version": "posepuppet-attempts-summary-v2",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "category": "deferred_humanoid",
        "final_classification": "deferred_manual_rig_repair",
        "best_attempt_id": "",
        "attempts": [
            {
                "attempt_id": "attempt-serving-repair",
                "classification": "serving_fixed",
                "targeted_change": "Created ignored public symlink to generated VRM for browser retry.",
                "result": "VRM served instead of Vite HTML fallback.",
            },
            {
                "attempt_id": attempt_id,
                "classification": "blocked_required_bones",
                "browser_smoke": "fail",
                "visual_review": "fail",
                "attempt_manifest": attempt_path,
                "blockers": info["blockers"],
            },
        ],
    }
    write_json(model_dir / "attempts-summary.json", attempts)
    write_md(
        model_dir / "attempts-summary.md",
        f"{info['display']} attempts summary",
        [
            "- Final classification: `deferred_manual_rig_repair`",
            "- Serving blocker was fixed before deferral.",
            f"- Final attempt manifest: `{attempt_path}`",
            "",
            *(f"- `{item['attempt_id']}`: {item['classification']}" for item in attempts["attempts"]),
        ],
    )
    runtime = read_json(model_dir / "runtime-capability-profile.json") or {}
    runtime.update(
        {
            "schema_version": "posepuppet-runtime-capability-profile-v3",
            "created_at": now(),
            "slug": slug,
            "display_name": info["display"],
            "runtime_profile": "deferred",
            "quality_label": "deferred_manual_rig_repair",
            "active_candidate": {
                "browser_smoke": "fail",
                "visual_review": "fail",
                "registry_decision": "not_registered",
                "contact_sheet": rel(capture["contact_sheet"]),
            },
            "blockers": info["blockers"],
        }
    )
    write_json(model_dir / "runtime-capability-profile.json", runtime)
    return visual


def write_special_model(slug: str, info: dict[str, Any]) -> dict[str, Any]:
    model_dir = AUDIT_ROOT / slug
    preview = source_preview_for(slug)
    pose_renders = preview["data"].get("pose_renders", [])
    attempt_id = "attempt-source-preview-pose-suite"
    attempt_path = write_attempt_manifest(
        slug,
        attempt_id,
        {
            "schema_version": "posepuppet-visual-qa-attempt-v1",
            "created_at": now(),
            "slug": slug,
            "attempt_id": attempt_id,
            "targeted_change": f"render {info['profile']} source preview and proxy pose suite without humanoid promotion",
            "source_audit": rel(preview["audit"]),
            "preview_manifest": rel(preview["manifest"]),
            "contact_sheet": rel(preview["contact_sheet"]),
            "visual_review": info["visual_review"],
            "blockers": info["blockers"],
        },
    )
    visual = {
        "schema_version": "posepuppet-visual-rig-review-v3",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "source": "source-glb-blender-preview",
        "attempt_id": attempt_id,
        "visual_review": info["visual_review"],
        "runtime_profile": info["profile"],
        "final_classification": f"{info['profile']}_preview_{info['visual_review']}",
        "registry_decision": "not_registered",
        "accepted_for_active_registry": False,
        "summary": info["summary"],
        "blockers": info["blockers"],
        "next_steps": info["next_steps"],
        "evidence": {
            "source_audit": rel(preview["audit"]),
            "preview_manifest": rel(preview["manifest"]),
            "contact_sheet": rel(preview["contact_sheet"]),
            "pose_render_count": len(pose_renders),
            "attempt_manifest": attempt_path,
            "contact_sheet_committed": False,
        },
        "safety": {
            "forced_to_humanoid": False,
            "generated_assets_committed": False,
        },
    }
    write_json(model_dir / "visual-rig-review.json", visual)
    write_md(
        model_dir / "visual-rig-review.md",
        f"{info['display']} visual rig review",
        [
            f"- Visual review: `{info['visual_review']}`",
            f"- Runtime profile: `{info['profile']}`",
            "- Forced to humanoid: `false`",
            f"- Contact sheet: `{rel(preview['contact_sheet'])}`",
            "",
            info["summary"],
        ],
    )
    pose_tests = [
        {
            "pose_name": render.get("pose"),
            "result": "pass" if info["visual_review"] == "pass" else "partial",
            "matched_bone_count": render.get("matched_bone_count", 0),
            "matched_bones_sample": render.get("matched_bones", [])[:12],
            "screenshot_path": render.get("path"),
        }
        for render in pose_renders
    ]
    pose = git_show_json(model_dir / "pose-suite-validation.json") or read_json(model_dir / "pose-suite-validation.json") or {}
    pose.update(
        {
            "status": "pass" if info["visual_review"] == "pass" else "partial",
            "runtime_profile": info["profile"],
            "visual_review": info["visual_review"],
            "source_preview_pose_suite": {
                "created_at": now(),
                "source": "source-glb-blender-preview",
                "contact_sheet": rel(preview["contact_sheet"]),
                "pose_render_count": len(pose_tests),
                "pose_tests": pose_tests,
                "notes": ["Source pose suite is a feasibility probe, not a browser runtime implementation."],
            },
        }
    )
    write_json(model_dir / "pose-suite-validation.json", pose)
    write_augmented_md(
        model_dir / "pose-suite-validation.md",
        f"{info['display']} pose-suite validation",
        [
            f"- Status: `{pose['status']}`",
            f"- Runtime profile: `{info['profile']}`",
            f"- Pose renders: `{len(pose_tests)}`",
            f"- Contact sheet: `{rel(preview['contact_sheet'])}`",
            "",
            "Proxy poses were rendered from the source rig only; no humanoid runtime support is implied. Earlier structural pose-suite details above are preserved.",
        ],
    )
    attempts = {
        "schema_version": "posepuppet-attempts-summary-v2",
        "created_at": now(),
        "slug": slug,
        "display_name": info["display"],
        "category": info["profile"],
        "final_classification": visual["final_classification"],
        "best_attempt_id": attempt_id if info["visual_review"] == "pass" else "",
        "attempts": [
            {
                "attempt_id": attempt_id,
                "classification": visual["final_classification"],
                "visual_review": info["visual_review"],
                "pose_suite": pose["status"],
                "attempt_manifest": attempt_path,
                "contact_sheet": rel(preview["contact_sheet"]),
                "blockers": info["blockers"],
            }
        ],
    }
    write_json(model_dir / "attempts-summary.json", attempts)
    write_md(
        model_dir / "attempts-summary.md",
        f"{info['display']} attempts summary",
        [
            f"- Final classification: `{visual['final_classification']}`",
            f"- Attempt manifest: `{attempt_path}`",
            f"- Contact sheet: `{rel(preview['contact_sheet'])}`",
        ],
    )
    runtime = read_json(model_dir / "runtime-capability-profile.json") or {}
    runtime.update(
        {
            "schema_version": "posepuppet-runtime-capability-profile-v3",
            "created_at": now(),
            "slug": slug,
            "display_name": info["display"],
            "runtime_profile": info["profile"],
            "quality_label": visual["final_classification"],
            "active_candidate": {
                "browser_smoke": "not_registered",
                "visual_review": info["visual_review"],
                "registry_decision": "not_registered",
                "contact_sheet": rel(preview["contact_sheet"]),
            },
            "blockers": info["blockers"],
        }
    )
    if slug == "rigged-hand":
        runtime.setdefault("body_tracking", {})
        runtime["body_tracking"].update({"arms": "disabled", "legs": "disabled", "torso": "disabled"})
    write_json(model_dir / "runtime-capability-profile.json", runtime)
    return visual


def write_aggregate_reports(visuals: list[dict[str, Any]]) -> None:
    rig_prep = AUDIT_ROOT / "rig-prep"
    accepted = sorted(ACTIVE_ACCEPTED)
    downgraded = sorted(DOWNGRADED)
    deferred = sorted(DEFERRED_HARD)
    special = sorted(SPECIAL_PREVIEWS)
    summary = {
        "schema_version": "posepuppet-visual-qa-continuation-v1",
        "created_at": now(),
        "accepted_active": accepted,
        "downgraded_or_rejected": downgraded,
        "deferred_hard_models": deferred,
        "special_previews": special,
        "visual_reports": visuals,
        "safety": {
            "generated_assets_committed": False,
            "contact_sheets_committed": False,
            "public_ui_promotion": False,
        },
        "evidence_roots": {
            "active_visual_review": "model-working/<slug>/visual-review/",
            "special_source_preview": "model-working/<slug>/source-preview/",
            "attempt_manifests": "model-working/<slug>/attempts/<attempt-id>/attempt-manifest.json",
        },
    }
    write_json(rig_prep / "visual-qa-continuation-summary.json", summary)
    write_md(
        rig_prep / "visual-qa-continuation-summary.md",
        "Visual QA continuation summary",
        [
            f"- Accepted active candidates: `{', '.join(accepted)}`",
            f"- Downgraded or rejected candidates: `{', '.join(downgraded)}`",
            f"- Deferred hard models: `{', '.join(deferred)}`",
            f"- Hand/creature/static previews attempted: `{', '.join(special)}`",
            "- Generated candidates remain query-param-only and `enabledInUi: false`.",
            "- VRMs, source assets, screenshots, contact sheets, and `model-working/` outputs are intentionally untracked.",
            "",
            "## Evidence roots",
            "",
            "- Active visual sheets: `model-working/<slug>/visual-review/contact-sheet.png`",
            "- Source preview sheets: `model-working/<slug>/source-preview/contact-sheet.png`",
            "- Attempt manifests: `model-working/<slug>/attempts/<attempt-id>/attempt-manifest.json`",
        ],
    )

    work_queue = {
        "schema_version": "posepuppet-visual-qa-work-queue-v1",
        "created_at": now(),
        "groups": [
            {"group": "A", "name": "active_visual_accepted", "slugs": accepted},
            {"group": "B", "name": "active_downgraded_or_rejected", "slugs": downgraded},
            {"group": "C", "name": "deferred_manual_rig_repair", "slugs": deferred},
            {"group": "D", "name": "hand_only_preview", "slugs": ["rigged-hand"]},
            {"group": "E", "name": "creature_static_preview_pass", "slugs": ["godzilla", "grogu", "king-kong", "olaf"]},
            {"group": "F", "name": "creature_static_preview_needs_repair", "slugs": ["baby-yoda", "xenomorph"]},
        ],
    }
    write_json(rig_prep / "visual-qa-work-queue.json", work_queue)
    write_md(
        rig_prep / "visual-qa-work-queue.md",
        "Visual QA work queue",
        [f"- Group {item['group']} `{item['name']}`: {', '.join(item['slugs'])}" for item in work_queue["groups"]],
    )

    hard = {
        "schema_version": "posepuppet-hard-model-repair-log-v1",
        "created_at": now(),
        "models": {
            **{slug: DOWNGRADED[slug] for slug in DOWNGRADED},
            **{slug: DEFERRED_HARD[slug] for slug in DEFERRED_HARD},
        },
        "global_attempts": [
            "Generated active browser capture for 10 smoke-passing candidates.",
            "Added scale-down-only generated-stage normalization for oversized VRM bounds.",
            "Removed a failed auto-orientation heuristic after it damaged valid models.",
            "Added tiny-bounds camera fallback to restore small/odd skinned bounds.",
            "Created ignored serving symlinks for elsa, buzz-lightyear, and teal-v2 before retry.",
            "Inspected hard-model audit JSON and bone trees for Elsa, Buzz, and Teal.",
            "Rendered source previews and proxy pose suites for hand-only and creature candidates.",
            "Downgraded or rejected candidates that did not pass visual review.",
        ],
    }
    write_json(rig_prep / "hard-model-repair-log.json", hard)
    write_md(
        rig_prep / "hard-model-repair-log.md",
        "Hard-model repair log",
        [
            "## Serious attempts",
            "",
            *(f"- {item}" for item in hard["global_attempts"]),
            "",
            "## Model blockers",
            "",
            *(f"- `{slug}`: {data['summary']}" for slug, data in hard["models"].items()),
        ],
    )

    special = {
        "schema_version": "posepuppet-special-preview-summary-v1",
        "created_at": now(),
        "models": SPECIAL_PREVIEWS,
    }
    write_json(rig_prep / "special-preview-summary.json", special)
    write_md(
        rig_prep / "special-preview-summary.md",
        "Special preview summary",
        [
            *(f"- `{slug}` ({data['profile']}): {data['summary']}" for slug, data in SPECIAL_PREVIEWS.items()),
        ],
    )

    baseline = {
        "schema_version": "posepuppet-visual-continuation-baseline-v1",
        "created_at": now(),
        "base_commit": "5f3286c0d00e5be189b94e2149c1fb640916810c",
        "baseline_checks": {
            "npm_run_build": "pass",
            "generated_avatar_smoke": "pass",
            "audit_model_self_test": "pass",
            "validate_rig_readiness": "pass_without_visual_required",
            "generated_avatar_registry_validate_only": "pass",
        },
    }
    write_json(rig_prep / "visual-continuation-baseline.json", baseline)
    write_md(
        rig_prep / "visual-continuation-baseline.md",
        "Visual continuation baseline",
        [
            f"- Base commit: `{baseline['base_commit']}`",
            *(f"- `{name}`: `{status}`" for name, status in baseline["baseline_checks"].items()),
        ],
    )

    handoff = REPO_ROOT / "COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md"
    if handoff.exists():
        text = handoff.read_text()
        marker = "\n## Visual QA Continuation Result\n"
        addition = (
            marker
            + "\n"
            + f"- Accepted active generated candidates after visual review: `{', '.join(accepted)}`.\n"
            + f"- Downgraded or rejected generated candidates: `{', '.join(downgraded)}`.\n"
            + f"- Deferred manual rig repair: `{', '.join(deferred)}`.\n"
            + "- Hand-only and creature/static source previews have ignored contact sheets under `model-working/<slug>/source-preview/`.\n"
            + "- Generated screenshots/contact sheets and VRMs remain untracked; see `model-audits/rig-prep/visual-qa-continuation-summary.md` for evidence refs.\n"
        )
        if marker in text:
            text = text[: text.index(marker)] + addition
        else:
            text = text.rstrip() + "\n" + addition
        handoff.write_text(text)


def main() -> int:
    visuals: list[dict[str, Any]] = []
    for slug, info in ACTIVE_ACCEPTED.items():
        visuals.append(write_active_model(slug, info, accepted=True))
    for slug, info in DOWNGRADED.items():
        visuals.append(write_active_model(slug, info, accepted=False))
    for slug, info in DEFERRED_HARD.items():
        visuals.append(write_deferred_model(slug, info))
    for slug, info in SPECIAL_PREVIEWS.items():
        visuals.append(write_special_model(slug, info))
    write_aggregate_reports(visuals)
    print(json.dumps({"status": "pass", "visual_report_count": len(visuals)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
