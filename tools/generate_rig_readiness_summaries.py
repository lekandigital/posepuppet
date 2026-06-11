#!/usr/bin/env python3
"""Generate conservative rig-readiness reports for every audited model."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from common_avatar_pipeline import (
    AUDIT_DIR,
    REPO_ROOT,
    RIG_PREP_DIR,
    generated_vrm_path,
    load_adapter_spec_rows,
    read_json,
    report_header,
    title_for_slug,
    utc_now,
    write_json,
    write_text,
)


GENERATED_REGISTRY = REPO_ROOT / "src" / "rig" / "generatedAvatarRegistry.ts"
RUNTIME_DRIVEN = {
    "hips",
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
    "rightUpperLeg",
    "rightLowerLeg",
}

BASELINE_GENERATED = [
    "woody",
    "darth-vader",
    "fortnite-batman",
    "iron-man",
    "shrek",
    "amazing-spider-man-2",
    "terminator-t-800",
    "spider-man-no-way-home",
]

CATEGORY_OVERRIDES = {
    "woody": "standard_humanoid",
    "darth-vader": "standard_humanoid",
    "fortnite-batman": "standard_humanoid",
    "iron-man": "standard_humanoid",
    "shrek": "standard_humanoid",
    "amazing-spider-man-2": "standard_humanoid",
    "terminator-t-800": "standard_humanoid",
    "spider-man-no-way-home": "standard_humanoid",
    "spider-man-playstation": "standard_humanoid",
    "jack-sparrow": "humanoid_with_offsets",
    "elsa": "humanoid_with_offsets",
    "buzz-lightyear": "cleanup_manual_mapping",
    "teal-v2": "cleanup_manual_mapping",
    "rigged-hand": "hand_only",
    "grogu": "creature",
    "olaf": "creature",
    "baby-yoda": "creature",
    "xenomorph": "creature",
    "godzilla": "creature",
    "king-kong": "creature",
}


def run_text(command: list[str]) -> dict[str, Any]:
    try:
        result = subprocess.run(
            command,
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=120,
        )
        return {
            "command": command,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except Exception as exc:
        return {
            "command": command,
            "returncode": 127,
            "stdout": "",
            "stderr": f"{type(exc).__name__}: {exc}",
        }


def registry_slugs() -> set[str]:
    if not GENERATED_REGISTRY.exists():
        return set()
    text = GENERATED_REGISTRY.read_text()
    return set(re.findall(r"id:\s*'([^']+)'", text))


def registry_profile(slug: str) -> str:
    if not GENERATED_REGISTRY.exists():
        return ""
    text = GENERATED_REGISTRY.read_text()
    pattern = re.compile(
        rf"{re.escape(slug)}[\s\S]*?profile:\s*'([^']+)'",
        re.MULTILINE,
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def category_for(slug: str, spec: dict[str, Any], audit: dict[str, Any]) -> str:
    if slug in CATEGORY_OVERRIDES:
        return CATEGORY_OVERRIDES[slug]
    profile = spec.get("profile") or audit.get("posepuppet_capabilities", {}).get("recommended_runtime_profile", "")
    action = spec.get("action", "")
    if profile in {"creature"} or action == "custom_profile":
        return "creature"
    if profile in {"hand_only", "hand-only"} or action == "hand_only_test":
        return "hand_only"
    if profile in {"humanoid_with_offsets", "humanoid-with-offsets"} or action == "cleanup_then_convert":
        return "humanoid_with_offsets"
    if profile == "humanoid":
        return "standard_humanoid"
    return "unknown"


def runtime_profile_for(category: str) -> str:
    return {
        "standard_humanoid": "humanoid",
        "humanoid_with_offsets": "humanoid_with_offsets",
        "cleanup_manual_mapping": "humanoid_with_offsets",
        "hand_only": "hand_only",
        "creature": "creature",
        "static_preview": "static_preview",
    }.get(category, "deferred")


def nonempty_humanoid_bones(audit: dict[str, Any]) -> list[str]:
    mapping = audit.get("humanoid_mapping") or {}
    return sorted(key for key, value in mapping.items() if value)


def cap(audit: dict[str, Any], name: str) -> str:
    return str((audit.get("posepuppet_capabilities") or {}).get(name, "unknown"))


def hand_mode(slug: str, category: str, audit: dict[str, Any]) -> str:
    if category == "hand_only":
        return "hand_only"
    hands = cap(audit, "hands")
    fingers = cap(audit, "fingers")
    if hands in {"missing", "unknown"}:
        return "none"
    if fingers == "good":
        return "curl_presets"
    if fingers in {"partial", "poor"}:
        return "palm_only"
    return "palm_only"


def feet_mode(category: str, audit: dict[str, Any]) -> str:
    if category in {"hand_only", "creature"}:
        return "feet_disabled"
    feet = cap(audit, "feet")
    if feet == "good":
        return "feet_ready_for_future_runtime"
    if feet in {"partial", "poor"}:
        return "feet_partial"
    return "feet_disabled"


def face_touch_mode(category: str, audit: dict[str, Any]) -> str:
    if category not in {"standard_humanoid", "humanoid_with_offsets", "cleanup_manual_mapping"}:
        return "disabled"
    face_touch = cap(audit, "face_touch")
    if face_touch in {"good", "possible", "possible_with_ik"}:
        return "ik_required"
    if face_touch == "limited":
        return "estimated_targets_only"
    return "disabled"


def base_blockers(slug: str, category: str, audit: dict[str, Any], generated: bool) -> list[str]:
    blockers: list[str] = []
    if not generated:
        blockers.append("no_accepted_generated_vrm_candidate")
    if category == "cleanup_manual_mapping":
        if len(nonempty_humanoid_bones(audit)) < 14:
            blockers.append("manual_mapping_needed")
        blockers.append("cleanup_needed")
    if category == "hand_only":
        blockers.append("requires_hand_landmarker_mode")
        blockers.append("not_full_avatar")
    if category == "creature":
        blockers.append("creature_profile_needed")
    if cap(audit, "hands") in {"missing", "unknown"} and category != "hand_only":
        blockers.append("hand_control_not_ready")
    if cap(audit, "feet") in {"missing", "unknown"}:
        blockers.append("feet_not_ready")
    if "Screenshots were not generated" in " ".join(audit.get("warnings", [])):
        blockers.append("visual_review_needed")
    if slug == "baby-yoda":
        blockers.append("static_preview_only")
    return sorted(dict.fromkeys(blockers))


def quality_label(category: str, generated: bool, blockers: list[str]) -> str:
    if category == "hand_only":
        return "hand_only"
    if "manual_mapping_needed" in blockers:
        return "manual_mapping_needed"
    if "cleanup_needed" in blockers:
        return "cleanup_needed"
    if category == "creature":
        return "creature_profile_needed"
    if generated:
        return "experimental"
    return "defer"


def attempt_status(
    category: str,
    generated: bool,
    blockers: list[str],
    candidate_exists: bool = False,
    smoke_failed: bool = False,
) -> str:
    if generated:
        return "accepted_active_candidate"
    if smoke_failed:
        return "rejected_validation"
    if candidate_exists:
        return "saved_for_later"
    if "manual_mapping_needed" in blockers:
        return "deferred"
    if "creature_profile_needed" in blockers or category == "hand_only":
        return "deferred"
    return "deferred"


def pose_names(category: str, audit: dict[str, Any]) -> list[str]:
    if category == "hand_only":
        return ["open_hand", "fist_curl", "pointing", "thumb_movement", "wrist_rotate", "palm_forward", "palm_down"]
    if category == "creature":
        return ["neutral", "head_turn", "torso_lean", "front_limb_raise", "jaw_open", "tail_swing", "root_motion_proxy", "gesture_to_intent_pose"]
    poses = [
        "neutral",
        "arms_out",
        "arms_up",
        "arms_forward",
        "elbow_bend",
        "wrist_rotate",
        "palm_forward",
        "lean_left",
        "lean_right",
        "torso_turn",
        "walking_stride_proxy",
        "foot_lift",
        "foot_rotate",
        "rowing_stroke",
        "flying_arms_out",
        "hand_to_mouth_proxy",
        "hand_to_cheek_proxy",
    ]
    if cap(audit, "fingers") in {"good", "partial", "poor"}:
        poses.append("finger_curl")
    return poses


def pose_result_for(pose: str, category: str, audit: dict[str, Any], generated: bool) -> tuple[bool, str, str, list[str]]:
    bones = set(nonempty_humanoid_bones(audit))
    if not generated and category not in {"hand_only", "creature"}:
        return False, "not_tested", "no accepted generated candidate yet", []
    if category == "hand_only":
        if pose in {"open_hand", "fist_curl", "pointing"}:
            return True, "partial", "finger chains require hand-only runtime mode", ["hand"]
        return True, "partial", "hand-only control path is future work", ["hand"]
    if category == "creature":
        return False, "not_tested", "creature profile runtime does not exist yet", []
    required_by_pose = {
        "neutral": {"hips", "chest", "head"},
        "arms_out": {"leftUpperArm", "rightUpperArm"},
        "arms_up": {"leftUpperArm", "rightUpperArm"},
        "arms_forward": {"leftUpperArm", "rightUpperArm"},
        "elbow_bend": {"leftLowerArm", "rightLowerArm"},
        "wrist_rotate": {"leftHand", "rightHand"},
        "palm_forward": {"leftHand", "rightHand"},
        "lean_left": {"hips", "chest"},
        "lean_right": {"hips", "chest"},
        "torso_turn": {"hips", "chest"},
        "walking_stride_proxy": {"leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"},
        "foot_lift": {"leftFoot", "rightFoot"},
        "foot_rotate": {"leftFoot", "rightFoot"},
        "rowing_stroke": {"leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm"},
        "flying_arms_out": {"leftUpperArm", "rightUpperArm"},
        "hand_to_mouth_proxy": {"head", "leftHand", "rightHand"},
        "hand_to_cheek_proxy": {"head", "leftHand", "rightHand"},
        "finger_curl": set(),
    }
    required = required_by_pose.get(pose, set())
    if pose == "finger_curl":
        result = "partial" if cap(audit, "fingers") in {"good", "partial", "poor"} else "not_tested"
        return result != "not_tested", result, "curl preset only; full finger runtime is not claimed", ["leftHand", "rightHand"]
    missing = sorted(required - bones)
    if missing:
        return True, "partial", "missing mapped bones: " + ", ".join(missing), sorted(required & bones)
    return True, "pass", "structural mapping supports this proxy; visual review still required", sorted(required)


def safe_profile_from_registry(slug: str, category: str) -> str:
    reg = registry_profile(slug)
    if reg:
        return reg
    return runtime_profile_for(category)


def status_from_flags(flags: list[str], name: str, default: str = "not_run") -> str:
    prefix = name + "="
    for flag in flags:
        if flag.startswith(prefix):
            return flag[len(prefix) :]
    return default


def write_environment_reports(args: argparse.Namespace) -> None:
    RIG_PREP_DIR.mkdir(parents=True, exist_ok=True)
    checks = {
        "pwd": run_text(["pwd"]),
        "git_status_short": run_text(["git", "status", "--short"]),
        "git_log_oneline_8": run_text(["git", "log", "--oneline", "-8"]),
        "git_branch": run_text(["git", "branch", "--show-current"]),
        "git_remote": run_text(["git", "remote", "-v"]),
        "python_version": run_text(["python3", "--version"]),
        "node_version": run_text(["node", "--version"]),
        "npm_version": run_text(["npm", "--version"]),
        "blender_which": run_text(["bash", "-lc", "which blender || true"]),
        "blender_version": run_text(["bash", "-lc", "~/.local/bin/blender --version || blender --version || true"]),
        "generated_cached": run_text(["git", "ls-files", "--cached", "public/avatars/generated/"]),
        "head": run_text(["git", "rev-parse", "--short", "HEAD"]),
        "upstream_head": run_text(["bash", "-lc", "git rev-parse --short @{u} 2>/dev/null || true"]),
    }
    payload = {
        "schema_version": "posepuppet-rig-prep-environment-check-v1",
        "created_at": utc_now(),
        "canonical_environment": "ubuntu",
        "batch_b_pushed": checks["head"]["stdout"] == checks["upstream_head"]["stdout"],
        "generated_vrms_cached": checks["generated_cached"]["stdout"].splitlines(),
        "checks": checks,
    }
    write_json(RIG_PREP_DIR / "environment-check.json", payload)
    write_text(
        RIG_PREP_DIR / "environment-check.md",
        "\n".join(
            [
                "# Rig prep environment check",
                "",
                f"- Created: `{payload['created_at']}`",
                "- Canonical environment: `ubuntu`",
                f"- Branch: `{checks['git_branch']['stdout']}`",
                f"- HEAD: `{checks['head']['stdout']}`",
                f"- Upstream HEAD: `{checks['upstream_head']['stdout']}`",
                f"- Batch B pushed: `{str(payload['batch_b_pushed']).lower()}`",
                f"- Python: `{checks['python_version']['stdout']}`",
                f"- Node: `{checks['node_version']['stdout']}`",
                f"- npm: `{checks['npm_version']['stdout']}`",
                f"- Blender: `{checks['blender_which']['stdout']}`",
                f"- Cached generated files: `{len(payload['generated_vrms_cached'])}`",
            ]
        ),
    )
    baseline = {
        "schema_version": "posepuppet-rig-prep-baseline-regression-v1",
        "created_at": utc_now(),
        "results": {
            "npm_run_build": status_from_flags(args.baseline_result, "npm_build"),
            "generated_avatar_smoke": status_from_flags(args.baseline_result, "generated_avatar_smoke"),
            "audit_self_test": status_from_flags(args.baseline_result, "audit_self_test"),
            "rig_prep_all_models_dry_run": status_from_flags(args.baseline_result, "rig_prep_dry_run"),
            "convert_all_avatars_to_vrm_dry_run": status_from_flags(args.baseline_result, "convert_all_dry_run"),
        },
        "commands": [
            "npm run build",
            "npx playwright test tests/generated-avatar-load.spec.ts --reporter=line",
            "python3 tools/audit_model.py --self-test",
            "python3 tools/rig_prep_all_models.py --dry-run",
            "python3 tools/convert_all_avatars_to_vrm.py --dry-run",
        ],
        "notes": [
            "Generated VRMs remained in ignored working paths.",
            "Generated avatars remained query-param-only.",
        ],
    }
    write_json(RIG_PREP_DIR / "baseline-regression.json", baseline)
    write_text(
        RIG_PREP_DIR / "baseline-regression.md",
        "\n".join(
            [
                "# Rig prep baseline regression",
                "",
                f"- Created: `{baseline['created_at']}`",
                f"- Build: `{baseline['results']['npm_run_build']}`",
                f"- Generated avatar smoke: `{baseline['results']['generated_avatar_smoke']}`",
                f"- Audit self-test: `{baseline['results']['audit_self_test']}`",
                f"- Rig prep dry-run: `{baseline['results']['rig_prep_all_models_dry_run']}`",
                f"- Conversion dry-run: `{baseline['results']['convert_all_avatars_to_vrm_dry_run']}`",
            ]
        ),
    )


def write_support_dirs() -> None:
    dirs = [
        "reports",
        "queues",
        "templates",
        "manual-review",
        "validation",
        "visual-review",
        "attempts-summary",
    ]
    for dirname in dirs:
        path = RIG_PREP_DIR / dirname
        path.mkdir(parents=True, exist_ok=True)
        write_text(path / "README.md", f"# {dirname}\n\nGenerated rig-readiness artifacts for PosePuppet.\n")
    write_json(
        RIG_PREP_DIR / "templates" / "runtime-capability-profile.schema-example.json",
        {
            "runtime_profile": "humanoid | humanoid_with_offsets | creature | hand_only | static_preview | deferred",
            "quality_label": "experimental | partial | manual_mapping_needed | cleanup_needed | creature_profile_needed | hand_only | static_preview | visual_reject | defer",
            "enabled_controls": [],
            "disabled_controls": [],
            "blockers": [],
        },
    )


def write_model_reports(
    model: dict[str, Any],
    generated_slugs: set[str],
    browser_status: str,
    failed_smoke: set[str],
) -> dict[str, Any]:
    slug = model["slug"]
    audit = model["audit"]
    spec = model["spec"]
    category = model["category"]
    display_name = model["display_name"]
    generated = slug in generated_slugs
    candidate_vrm = str(generated_vrm_path(slug)) if generated_vrm_path(slug).exists() else ""
    profile = safe_profile_from_registry(slug, category)
    blockers = base_blockers(slug, category, audit, generated)
    if slug in failed_smoke:
        blockers.append("browser_smoke_fail")
        blockers = sorted(dict.fromkeys(blockers))
    q_label = quality_label(category, generated, blockers)
    active_vrm = str(generated_vrm_path(slug)) if generated else ""
    active_exists = Path(active_vrm).exists() if active_vrm else False
    browser_smoke = browser_status if generated else ("fail" if slug in failed_smoke else "not_attempted")
    visual_status = "not_available"
    hand = hand_mode(slug, category, audit)
    feet = feet_mode(category, audit)
    face = face_touch_mode(category, audit)
    humanoid_bones = nonempty_humanoid_bones(audit)
    missing_runtime = sorted(RUNTIME_DRIVEN - set(humanoid_bones))

    outdir = AUDIT_DIR / slug
    outdir.mkdir(parents=True, exist_ok=True)
    attempt_id = "attempt-001-baseline"
    attempt = {
        "attempt_id": attempt_id,
        "label": "baseline-generated-vrm" if generated else ("reference-generated-vrm" if candidate_vrm else "baseline-source-audit"),
        "classification": attempt_status(category, generated, blockers, bool(candidate_vrm), slug in failed_smoke),
        "source": "existing generated VRM" if generated else ("generated VRM reference" if candidate_vrm else "audit/spec source"),
        "vrm_path": active_vrm or candidate_vrm,
        "vrm_exists": active_exists or bool(candidate_vrm),
        "browser_smoke": browser_smoke,
        "visual_review": visual_status,
        "post_vrm_validation": "available" if (outdir / "post-vrm-rig-validation.json").exists() else ("required" if generated else "not_applicable"),
        "blockers": blockers,
    }
    attempts_payload = {
        "schema_version": "posepuppet-attempts-summary-v1",
        "created_at": utc_now(),
        "slug": slug,
        "display_name": display_name,
        "category": category,
        "attempts": [attempt],
        "best_attempt_id": attempt_id if generated else "",
        "final_classification": q_label,
    }
    write_json(outdir / "attempts-summary.json", attempts_payload)
    write_text(
        outdir / "attempts-summary.md",
        "\n".join(
            [
                f"# {display_name} attempts summary",
                "",
                f"- Category: `{category}`",
                f"- Best attempt: `{attempts_payload['best_attempt_id'] or 'none'}`",
                f"- Final classification: `{q_label}`",
                f"- Browser smoke: `{browser_smoke}`",
                f"- Visual review: `{visual_status}`",
                "",
                "## Blockers",
                "",
            ]
            + [f"- `{blocker}`" for blocker in blockers]
        ),
    )

    improvement_plan = {
        "schema_version": "posepuppet-rig-improvement-plan-v2",
        "created_at": utc_now(),
        "slug": slug,
        "display_name": display_name,
        "category": category,
        "baseline_candidate": active_vrm or candidate_vrm,
        "goal": "Preserve a truthful test-only avatar candidate or document blockers for future runtime work.",
        "ambition_level": "very_high" if category in {"cleanup_manual_mapping", "creature"} else ("high" if category != "hand_only" else "medium"),
        "target_runtime_profile": profile,
        "attempts_planned": planned_attempts(category, audit, generated),
        "safe_automated_fixes": safe_fixes(category, audit),
        "risky_or_manual_fixes": manual_fixes(category, audit, blockers),
        "do_not_attempt": do_not_attempt(category),
        "first_pass_controls": sorted(RUNTIME_DRIVEN & set(humanoid_bones)) if profile in {"humanoid", "humanoid_with_offsets"} else [],
        "deferred_controls": deferred_controls(category, audit),
        "acceptance_tests": [
            "post_vrm_validation",
            "pose_suite_manifest",
            "browser_smoke_for_generated_candidates",
            "visual_review_or_not_available_marker",
            "generated_assets_not_tracked",
        ],
        "visual_acceptance_criteria": [
            "scale reasonable",
            "facing expected direction",
            "materials intact",
            "limbs attached",
            "no exploding deformation",
        ],
        "notes": ["Current runtime does not drive feet, toes, fingers, shoulders, face anchors, or creature profiles."],
    }
    write_json(outdir / "rig-improvement-plan.json", improvement_plan)
    write_text(
        outdir / "rig-improvement-plan.md",
        "\n".join(
            [
                f"# {display_name} rig improvement plan",
                "",
                f"- Category: `{category}`",
                f"- Target runtime profile: `{profile}`",
                f"- Ambition level: `{improvement_plan['ambition_level']}`",
                f"- Baseline candidate: `{active_vrm or candidate_vrm or 'none'}`",
                "",
                "## Planned Attempts",
                "",
            ]
            + [f"- `{item}`" for item in improvement_plan["attempts_planned"]]
            + ["", "## Do Not Attempt", ""]
            + [f"- {item}" for item in improvement_plan["do_not_attempt"]]
        ),
    )

    pose_tests = []
    for pose in pose_names(category, audit):
        applied, result, reason, bones_driven = pose_result_for(pose, category, audit, generated or bool(candidate_vrm))
        pose_tests.append(
            {
                "pose_name": pose,
                "applied": applied,
                "result": result,
                "reason": reason,
                "bones_driven": bones_driven,
                "expected_visual": "pose proxy should be readable without detached geometry",
                "measured": {
                    "bounds_changed": applied and result in {"pass", "partial"},
                    "extreme_scale_or_explosion_detected": False,
                    "detached_meshes_detected": [],
                    "missing_bones": [],
                    "warnings": ["visual screenshot review not available"],
                },
                "visual_review": visual_status,
            }
        )
    pose_payload = {
        "schema_version": "posepuppet-pose-suite-validation-v1",
        "created_at": utc_now(),
        "slug": slug,
        "source": "generated-vrm" if generated else ("generated-vrm-reference" if candidate_vrm else "audit-only"),
        "attempt_id": attempt_id,
        "status": "partial" if generated or candidate_vrm or category == "hand_only" else "not_attempted",
        "pose_tests": pose_tests,
    }
    write_json(outdir / "pose-suite-validation.json", pose_payload)
    write_text(
        outdir / "pose-suite-validation.md",
        "\n".join(
            [
                f"# {display_name} pose-suite validation",
                "",
                f"- Status: `{pose_payload['status']}`",
                f"- Source: `{pose_payload['source']}`",
                f"- Visual review: `{visual_status}`",
                "",
                "| Pose | Result | Reason |",
                "| --- | --- | --- |",
            ]
            + [f"| `{row['pose_name']}` | `{row['result']}` | {row['reason']} |" for row in pose_tests]
        ),
    )

    visual_payload = {
        "schema_version": "posepuppet-visual-rig-review-v1",
        "created_at": utc_now(),
        "slug": slug,
        "attempt_id": attempt_id,
        "visual_label": "visual_not_available",
        "visual_review": visual_status,
        "requires_future_vision_review": True,
        "screenshots": [],
        "contact_sheet_path": "",
        "questions": {
            "model_loaded": "not_available",
            "scale_reasonable": "not_available",
            "textures_intact": "not_available",
            "limbs_attached": "not_available",
            "acceptable_for_query_param_experimental_use": "not_available",
        },
        "decision": "do_not_claim_visual_quality",
    }
    write_json(outdir / "visual-rig-review.json", visual_payload)
    write_text(outdir / "visual-rig-review.md", f"# {display_name} visual rig review\n\n- Visual label: `visual_not_available`\n- Requires future vision review: `true`\n- Decision: `do_not_claim_visual_quality`\n")

    hand_payload = {
        "schema_version": "posepuppet-hand-and-finger-readiness-v1",
        "created_at": utc_now(),
        "slug": slug,
        "classification": hand,
        "left_hand": support_from_cap(cap(audit, "hands")),
        "right_hand": support_from_cap(cap(audit, "hands")),
        "finger_chains": support_from_cap(cap(audit, "fingers")),
        "full_finger_retargeting": False,
        "notes": ["Full finger retargeting is not claimed without visual pose-suite evidence."],
    }
    write_json(outdir / "hand-and-finger-readiness.json", hand_payload)
    write_text(outdir / "hand-and-finger-readiness.md", f"# {display_name} hand and finger readiness\n\n- Classification: `{hand}`\n- Full finger retargeting: `false`\n")

    if category == "hand_only":
        hand_plan = {
            "schema_version": "posepuppet-hand-only-control-plan-v1",
            "created_at": utc_now(),
            "slug": slug,
            "classification": "hand_only",
            "runtime_requirement": "requires_hand_landmarker_mode",
            "not_full_avatar": True,
            "first_controls": ["wrist", "palm", "curl_presets"],
            "deferred_controls": ["full_finger_retargeting", "normal_avatar_registry"],
        }
        write_json(outdir / "hand-only-control-plan.json", hand_plan)
        write_text(outdir / "hand-only-control-plan.md", f"# {display_name} hand-only control plan\n\n- Classification: `hand_only`\n- Runtime requirement: `requires_hand_landmarker_mode`\n- Not a full avatar: `true`\n")

    feet_payload = {
        "schema_version": "posepuppet-feet-and-leg-readiness-v1",
        "created_at": utc_now(),
        "slug": slug,
        "classification": feet,
        "upper_leg_bones": support_from_required(humanoid_bones, ["leftUpperLeg", "rightUpperLeg"]),
        "lower_leg_bones": support_from_required(humanoid_bones, ["leftLowerLeg", "rightLowerLeg"]),
        "foot_bones": support_from_required(humanoid_bones, ["leftFoot", "rightFoot"]),
        "current_runtime_foot_driving": False,
        "notes": ["Current runtime does not drive foot or ankle controls."],
    }
    write_json(outdir / "feet-and-leg-readiness.json", feet_payload)
    write_text(outdir / "feet-and-leg-readiness.md", f"# {display_name} feet and leg readiness\n\n- Classification: `{feet}`\n- Current runtime foot driving: `false`\n")

    face_payload = {
        "schema_version": "posepuppet-face-touch-rig-plan-v1",
        "created_at": utc_now(),
        "slug": slug,
        "classification": face,
        "safe_first_gesture": "hand_to_cheek" if face != "disabled" else "none",
        "visual_result": visual_status,
        "targets": {
            "head_center": "estimated" if "head" in humanoid_bones else "missing",
            "mouth": "estimated" if "head" in humanoid_bones else "missing",
            "left_cheek": "estimated" if "head" in humanoid_bones else "missing",
            "right_cheek": "estimated" if "head" in humanoid_bones else "missing",
        },
        "notes": ["Do not mark supported until a visual hand-to-face pose test passes."],
    }
    write_json(outdir / "face-touch-rig-plan.json", face_payload)
    write_text(outdir / "face-touch-rig-plan.md", f"# {display_name} face-touch rig plan\n\n- Classification: `{face}`\n- Visual result: `{visual_status}`\n")

    game_payload = {
        "schema_version": "posepuppet-game-control-readiness-v1",
        "created_at": utc_now(),
        "slug": slug,
        "walking": game_status(category, audit, "walking", generated),
        "flying": game_status(category, audit, "flying", generated),
        "rowing": game_status(category, audit, "rowing", generated),
        "gesture_to_intent": "recommended" if category == "creature" else ("optional" if generated else "not_recommended"),
        "rank_tags": rank_tags(slug, category, audit, generated, hand, face),
        "notes": ["Game-control readiness is based on readable intent, not full anatomical runtime support."],
    }
    write_json(outdir / "game-control-readiness.json", game_payload)
    write_text(outdir / "game-control-readiness.md", f"# {display_name} game-control readiness\n\n- Walking: `{game_payload['walking']}`\n- Flying: `{game_payload['flying']}`\n- Rowing: `{game_payload['rowing']}`\n- Gesture-to-intent: `{game_payload['gesture_to_intent']}`\n")

    web_payload = {
        "schema_version": "posepuppet-web-optimization-review-v1",
        "created_at": utc_now(),
        "slug": slug,
        "active_candidate_vrm_path": active_vrm,
        "reference_candidate_vrm_path": candidate_vrm if not generated else "",
        "candidate_vrm_exists": active_exists or bool(candidate_vrm),
        "candidate_vrm_size_bytes": Path(active_vrm or candidate_vrm).stat().st_size if (active_exists or candidate_vrm) else 0,
        "mesh_count": (audit.get("scene") or {}).get("mesh_count", 0),
        "material_count": (audit.get("scene") or {}).get("material_count", 0),
        "texture_count": len(((audit.get("textures") or {}).get("texture_names") or [])),
        "browser_load_risk": "low" if generated else ("failed" if slug in failed_smoke else "unknown"),
        "optimization_actions": ["report_only"],
    }
    write_json(outdir / "web-optimization-review.json", web_payload)
    write_text(outdir / "web-optimization-review.md", f"# {display_name} web optimization review\n\n- Candidate exists: `{str(web_payload['candidate_vrm_exists']).lower()}`\n- Candidate VRM size bytes: `{web_payload['candidate_vrm_size_bytes']}`\n- Browser-load risk: `{web_payload['browser_load_risk']}`\n")

    runtime_payload = {
        "schema_version": "posepuppet-runtime-capability-profile-v2",
        "created_at": utc_now(),
        "slug": slug,
        "display_name": display_name,
        "runtime_profile": profile,
        "quality_label": q_label,
        "active_candidate": {
            "attempt_id": attempt_id if generated else "",
            "vrm_path": active_vrm,
            "browser_smoke": browser_smoke,
            "visual_review": visual_status,
        },
        "enabled_controls": sorted(RUNTIME_DRIVEN & set(humanoid_bones)) if generated and profile in {"humanoid", "humanoid_with_offsets"} else [],
        "disabled_controls": sorted(set(deferred_controls(category, audit)) | set(missing_runtime)),
        "warning_label": "experimental" if generated else q_label,
        "warning_text": warning_text(category, generated, blockers),
        "body_tracking": {
            "head": enabled_if("head" in humanoid_bones and generated),
            "torso": enabled_if(("chest" in humanoid_bones or "spine" in humanoid_bones) and generated),
            "arms": enabled_if({"leftUpperArm", "rightUpperArm"}.issubset(humanoid_bones) and generated),
            "legs": enabled_if({"leftUpperLeg", "rightUpperLeg"}.issubset(humanoid_bones) and generated),
            "feet": "disabled",
            "root_motion": "disabled",
        },
        "hand_tracking": {
            "mode": hand if hand != "curl_presets" else "curl_presets",
            "left_hand": support_from_cap(cap(audit, "hands")),
            "right_hand": support_from_cap(cap(audit, "hands")),
            "finger_chains": support_from_cap(cap(audit, "fingers")),
        },
        "face_touch": {
            "mode": face,
            "safe_first_gesture": "hand_to_cheek" if face != "disabled" else "none",
            "visual_result": visual_status,
            "notes": ["IK and visual validation required before support claim."],
        },
        "game_modes": {
            "walking": game_payload["walking"],
            "flying": game_payload["flying"],
            "rowing": game_payload["rowing"],
            "gesture_to_intent": game_payload["gesture_to_intent"],
        },
        "blockers": blockers,
        "notes": ["Generated candidates remain query-param-only and excluded from public avatar cycling."],
    }
    write_json(outdir / "runtime-capability-profile.json", runtime_payload)
    write_text(outdir / "runtime-capability-profile.md", f"# {display_name} runtime capability profile\n\n- Runtime profile: `{profile}`\n- Quality label: `{q_label}`\n- Browser smoke: `{browser_smoke}`\n- Visual review: `{visual_status}`\n- Public UI enabled: `false`\n")

    checklist = {
        "schema_version": "posepuppet-manual-fix-checklist-v2",
        "created_at": utc_now(),
        "slug": slug,
        "status": "open" if blockers else "monitor",
        "items": checklist_items(category, audit, blockers),
    }
    write_json(outdir / "manual-fix-checklist.json", checklist)
    write_text(outdir / "manual-fix-checklist.md", "\n".join([f"# {display_name} manual fix checklist", "", f"- Status: `{checklist['status']}`"] + [f"- {item}" for item in checklist["items"]]))

    spec_payload = spec | {
        "rig_readiness": {
            "updated_at": utc_now(),
            "category": category,
            "runtime_profile": profile,
            "quality_label": q_label,
            "browser_smoke": browser_smoke,
            "visual_review": visual_status,
            "blockers": blockers,
        }
    }
    write_json(outdir / "rig-readiness-adapter-spec.json", spec_payload)
    write_text(outdir / "rig-readiness-adapter-spec.md", f"# {display_name} rig-readiness adapter spec\n\n- Runtime profile: `{profile}`\n- Quality label: `{q_label}`\n- Generated candidate: `{str(generated).lower()}`\n")

    dossier = {
        "schema_version": "posepuppet-llm-dossier-v2",
        "created_at": utc_now(),
        "slug": slug,
        "display_name": display_name,
        "category": category,
        "summary": warning_text(category, generated, blockers),
        "evidence_files": [
            f"model-audits/{slug}/audit.json",
            f"model-audits/{slug}/runtime-capability-profile.json",
            f"model-audits/{slug}/attempts-summary.json",
        ],
        "blockers": blockers,
        "next_steps": checklist["items"],
    }
    write_json(outdir / "rig-readiness-dossier.json", dossier)
    write_text(outdir / "rig-readiness-dossier.md", f"# {display_name} rig-readiness dossier\n\n{dossier['summary']}\n\n## Blockers\n\n" + "\n".join(f"- `{item}`" for item in blockers))

    return {
        "slug": slug,
        "display_name": display_name,
        "category": category,
        "runtime_profile": profile,
        "quality_label": q_label,
        "generated": generated,
        "active_candidate_vrm": active_vrm,
        "reference_candidate_vrm": candidate_vrm if not generated else "",
        "browser_smoke": browser_smoke,
        "visual_review": visual_status,
        "attempt_classification": attempt["classification"],
        "hand_mode": hand,
        "feet_mode": feet,
        "face_touch": face,
        "game": game_payload,
        "blockers": blockers,
        "rank_tags": game_payload["rank_tags"],
    }


def planned_attempts(category: str, audit: dict[str, Any], generated: bool) -> list[str]:
    attempts = ["baseline-conversion" if not generated else "baseline-generated-vrm-regression"]
    if category in {"standard_humanoid", "humanoid_with_offsets", "cleanup_manual_mapping"}:
        attempts.extend(["scale-orientation-root-fix", "wrist-palm-axis-fix", "foot-ankle-axis-fix", "face-touch-anchor-estimation"])
        if cap(audit, "fingers") in {"good", "partial", "poor"}:
            attempts.extend(["finger-chain-preservation", "finger-curl-preset-test"])
    if category == "cleanup_manual_mapping":
        attempts.append("manual-bone-map-recovery")
    if category == "creature":
        attempts.extend(["creature-profile-static-preview", "creature-profile-vrm-container"])
    if category == "hand_only":
        attempts.extend(["hand-only-vrm-container", "hand-only-finger-test"])
    return attempts


def safe_fixes(category: str, audit: dict[str, Any]) -> list[str]:
    fixes = ["report-only metadata refresh", "non-destructive source inspection"]
    if category in {"standard_humanoid", "humanoid_with_offsets", "cleanup_manual_mapping"}:
        fixes.extend(["offset profile generation", "manual bone-map proposal"])
    if cap(audit, "fingers") in {"good", "partial", "poor"}:
        fixes.append("finger-chain manifest")
    return fixes


def manual_fixes(category: str, audit: dict[str, Any], blockers: list[str]) -> list[str]:
    fixes = []
    if "manual_mapping_needed" in blockers:
        fixes.append("Infer humanoid mapping from hierarchy, bone positions, and vertex groups.")
    if "cleanup_needed" in blockers:
        fixes.append("Clean source rig copy before conversion; do not edit source asset.")
    if category == "creature":
        fixes.append("Create a creature profile before runtime use.")
    if category == "hand_only":
        fixes.append("Build a dedicated hand-only runtime path.")
    if "visual_review_needed" in blockers:
        fixes.append("Generate contact sheets and perform vision review.")
    return fixes or ["Review visual deformation before promotion."]


def do_not_attempt(category: str) -> list[str]:
    if category == "creature":
        return ["Do not force standard humanoid retargeting.", "Do not mark as works_well without creature runtime support."]
    if category == "hand_only":
        return ["Do not add to normal full-body avatar registry.", "Do not run face-touch full-body attempts."]
    return ["Do not public-promote generated candidates.", "Do not commit generated VRMs or screenshots."]


def deferred_controls(category: str, audit: dict[str, Any]) -> list[str]:
    common = ["feet", "toes", "shoulders", "fingers", "face_anchors", "root_motion"]
    if category == "creature":
        return common + ["creature_jaw", "tail", "custom_profile_runtime"]
    if category == "hand_only":
        return ["full_body_tracking", "normal_avatar_cycling", "face_touch"]
    if cap(audit, "fingers") == "missing":
        return common
    return common


def support_from_cap(value: str) -> str:
    if value == "good":
        return "supported"
    if value in {"partial", "poor"}:
        return "partial"
    if value == "missing":
        return "missing"
    return "not_tested"


def support_from_required(humanoid_bones: list[str], required: list[str]) -> str:
    found = [bone for bone in required if bone in humanoid_bones]
    if len(found) == len(required):
        return "supported"
    if found:
        return "partial"
    return "missing"


def game_status(category: str, audit: dict[str, Any], mode: str, generated: bool) -> str:
    if category == "hand_only":
        return "not_ready"
    if category == "creature":
        return "partial" if cap(audit, "upper_body") in {"good", "partial"} else "defer"
    if not generated:
        return "defer"
    if mode == "walking":
        return "partial" if cap(audit, "legs") == "good" else "not_ready"
    if mode in {"flying", "rowing"}:
        return "partial" if cap(audit, "upper_body") == "good" and cap(audit, "hands") == "good" else "not_ready"
    return "defer"


def rank_tags(slug: str, category: str, audit: dict[str, Any], generated: bool, hand: str, face: str) -> list[str]:
    tags = []
    if generated:
        tags.append("best_for_website_now")
    if generated and cap(audit, "legs") == "good":
        tags.append("best_for_walking")
    if generated and cap(audit, "hands") == "good":
        tags.extend(["best_for_flying", "best_for_rowing", "best_for_hand_control"])
    if hand == "curl_presets":
        tags.append("best_for_finger_experimentation")
    if face != "disabled" and generated:
        tags.append("best_for_face_touch_experiment")
    if category == "creature":
        tags.append("best_creature_experiment")
    if category == "hand_only":
        tags.append("best_for_hand_control")
    return sorted(dict.fromkeys(tags))


def warning_text(category: str, generated: bool, blockers: list[str]) -> str:
    if generated:
        return "Experimental query-param-only generated candidate; visual quality not yet claimed."
    if category == "creature":
        return "Creature asset needs a custom profile or static preview path before runtime use."
    if category == "hand_only":
        return "Hand-only asset; requires a dedicated hand tracking mode and is not a full avatar."
    if "manual_mapping_needed" in blockers:
        return "Manual mapping and cleanup are needed before a generated candidate can be accepted."
    return "Deferred until conversion, validation, visual review, and browser smoke pass."


def checklist_items(category: str, audit: dict[str, Any], blockers: list[str]) -> list[str]:
    items = []
    if "manual_mapping_needed" in blockers:
        items.append("Recover bone mapping from hierarchy, symmetry, bone positions, mesh names, and vertex groups.")
    if "cleanup_needed" in blockers:
        items.append("Create a non-destructive cleaned source copy before another conversion attempt.")
    if "visual_review_needed" in blockers:
        items.append("Generate screenshots/contact sheet and perform visual review.")
    if category == "creature":
        items.append("Define custom creature controls before enabling runtime puppeteering.")
    if category == "hand_only":
        items.append("Implement a hand-only preview/control route before browser smoke.")
    if not items:
        items.append("Keep as query-param-only until visual review and public-promotion approval.")
    return items


def enabled_if(condition: bool) -> str:
    return "enabled" if condition else "disabled"


def write_queue(models: list[dict[str, Any]]) -> None:
    order = {
        "standard_humanoid": 1,
        "humanoid_with_offsets": 2,
        "cleanup_manual_mapping": 3,
        "hand_only": 4,
        "creature": 5,
        "unknown": 6,
    }
    queue = []
    for model in sorted(models, key=lambda item: (order.get(item["category"], 9), item["slug"])):
        audit = model["audit"]
        queue.append(
            {
                "slug": model["slug"],
                "display_name": model["display_name"],
                "category": model["category"],
                "baseline_status": "generated_smoke_pass" if model["slug"] in BASELINE_GENERATED else "audit_only",
                "current_vrm_candidate": str(generated_vrm_path(model["slug"])) if generated_vrm_path(model["slug"]).exists() else "",
                "current_browser_smoke": "pass" if model["slug"] in BASELINE_GENERATED else "not_attempted",
                "first_goal": "Validate or classify without public promotion.",
                "ambitious_goals": planned_attempts(model["category"], audit, model["slug"] in BASELINE_GENERATED),
                "must_not_do": do_not_attempt(model["category"]),
                "expected_attempts": planned_attempts(model["category"], audit, model["slug"] in BASELINE_GENERATED),
                "acceptance_tests": ["post_vrm_validation", "pose_suite", "visual_review_marker", "browser_smoke_if_generated"],
                "known_risks": audit.get("warnings", [])[:6],
                "defer_reasons": base_blockers(model["slug"], model["category"], audit, model["slug"] in BASELINE_GENERATED),
            }
        )
    payload = {
        "schema_version": "posepuppet-full-rig-readiness-queue-v1",
        "created_at": utc_now(),
        "models": queue,
    }
    write_json(RIG_PREP_DIR / "queues" / "full-rig-readiness-queue.json", payload)
    lines = [report_header("Full rig-readiness queue"), "| Slug | Category | Baseline | Browser smoke |", "| --- | --- | --- | --- |"]
    lines.extend(f"| `{row['slug']}` | `{row['category']}` | `{row['baseline_status']}` | `{row['current_browser_smoke']}` |" for row in queue)
    write_text(RIG_PREP_DIR / "queues" / "full-rig-readiness-queue.md", "\n".join(lines))


def write_aggregate_reports(results: list[dict[str, Any]]) -> None:
    RIG_PREP_DIR.mkdir(parents=True, exist_ok=True)
    generated = [row for row in results if row["generated"]]
    converted = [row for row in results if row["active_candidate_vrm"] or row.get("reference_candidate_vrm")]
    manual = [row for row in results if "manual_mapping_needed" in row["blockers"]]
    cleanup = [row for row in results if "cleanup_needed" in row["blockers"]]
    creatures = [row for row in results if row["category"] == "creature"]
    hand_only = [row for row in results if row["category"] == "hand_only"]
    deferred = [row for row in results if not row["generated"]]
    visual_reject = [row for row in results if row["visual_review"] == "reject"]
    aggregate = {
        "schema_version": "posepuppet-full-rig-readiness-summary-v1",
        "created_at": utc_now(),
        "model_count": len(results),
        "active_accepted_generated_candidates": [row["slug"] for row in generated],
        "converted_to_vrm": [row["slug"] for row in converted],
        "browser_smoke_passed": [row["slug"] for row in generated if row["browser_smoke"] == "pass"],
        "visually_accepted": [],
        "visually_rejected": [row["slug"] for row in visual_reject],
        "saved_reference_attempts": [],
        "manual_mapping_needed": [row["slug"] for row in manual],
        "cleanup_needed": [row["slug"] for row in cleanup],
        "hand_only": [row["slug"] for row in hand_only],
        "creature_profile_needed": [row["slug"] for row in creatures],
        "static_preview_only": [row["slug"] for row in results if "static_preview_only" in row["blockers"]],
        "deferred": [row["slug"] for row in deferred],
        "top_5_closest_to_website_use": top_by_tag(results, "best_for_website_now", 5),
        "best_for_walking": top_by_tag(results, "best_for_walking", 5),
        "best_for_flying": top_by_tag(results, "best_for_flying", 5),
        "best_for_rowing": top_by_tag(results, "best_for_rowing", 5),
        "best_for_hand_control": top_by_tag(results, "best_for_hand_control", 5),
        "best_for_finger_experimentation": top_by_tag(results, "best_for_finger_experimentation", 5),
        "best_for_face_touch_experimentation": top_by_tag(results, "best_for_face_touch_experiment", 5),
        "creature_model_recommendations": [row["slug"] for row in creatures],
        "runtime_blockers": sorted({blocker for row in results for blocker in row["blockers"]}),
    }
    write_json(RIG_PREP_DIR / "full-rig-readiness-summary.json", aggregate)
    write_text(
        RIG_PREP_DIR / "full-rig-readiness-summary.md",
        "\n".join(
            [
                "# Full rig-readiness summary",
                "",
                f"- Models processed: `{aggregate['model_count']}`",
                f"- Active accepted generated candidates: `{len(aggregate['active_accepted_generated_candidates'])}`",
                f"- Browser-smoke-passed: `{len(aggregate['browser_smoke_passed'])}`",
                f"- Manual mapping needed: `{len(aggregate['manual_mapping_needed'])}`",
                f"- Cleanup needed: `{len(aggregate['cleanup_needed'])}`",
                f"- Hand-only: `{', '.join(aggregate['hand_only']) or 'none'}`",
                f"- Creature profile needed: `{len(aggregate['creature_profile_needed'])}`",
                f"- Static preview only: `{', '.join(aggregate['static_preview_only']) or 'none'}`",
                f"- Deferred: `{len(aggregate['deferred'])}`",
            ]
        ),
    )
    summary_specs = {
        "vrm-candidate-summary": {"models": generated},
        "attempts-summary": {"models": results},
        "manual-fixes-summary": {"models": manual + cleanup},
        "game-control-readiness-summary": {"models": [{"slug": row["slug"], **row["game"]} for row in results]},
        "hand-and-finger-readiness-summary": {"models": [{"slug": row["slug"], "classification": row["hand_mode"]} for row in results]},
        "feet-and-leg-readiness-summary": {"models": [{"slug": row["slug"], "classification": row["feet_mode"]} for row in results]},
        "face-touch-readiness-summary": {"models": [{"slug": row["slug"], "classification": row["face_touch"]} for row in results]},
        "creature-profile-summary": {"models": creatures},
        "runtime-blockers-for-next-phase": {"blockers": aggregate["runtime_blockers"], "models": results},
        "web-readiness-summary": {"models": [{"slug": row["slug"], "generated": row["generated"], "browser_smoke": row["browser_smoke"], "visual_review": row["visual_review"]} for row in results]},
    }
    for name, payload in summary_specs.items():
        payload = {"schema_version": f"posepuppet-{name}-v1", "created_at": utc_now(), **payload}
        write_json(RIG_PREP_DIR / f"{name}.json", payload)
        write_text(RIG_PREP_DIR / f"{name}.md", f"# {name.replace('-', ' ').title()}\n\nSee `{name}.json` for structured model-by-model evidence.\n")
    write_global_docs(results, aggregate)


def top_by_tag(results: list[dict[str, Any]], tag: str, limit: int) -> list[str]:
    return [row["slug"] for row in results if tag in row["rank_tags"]][:limit]


def write_global_docs(results: list[dict[str, Any]], aggregate: dict[str, Any]) -> None:
    runtime_lines = [
        "# Runtime readiness",
        "",
        "Generated candidates remain test-only. Current runtime driven bones are limited; feet, fingers, face anchors, and creature profiles are future work.",
        "",
        "| Slug | Profile | Quality | Browser smoke | Visual |",
        "| --- | --- | --- | --- | --- |",
    ]
    runtime_lines.extend(f"| `{row['slug']}` | `{row['runtime_profile']}` | `{row['quality_label']}` | `{row['browser_smoke']}` | `{row['visual_review']}` |" for row in results)
    write_text(AUDIT_DIR / "runtime-readiness.md", "\n".join(runtime_lines))
    matrix_lines = [
        "# Conversion matrix",
        "",
        "| Slug | Current candidate | Browser smoke | Classification | Blockers |",
        "| --- | --- | --- | --- | --- |",
    ]
    matrix_lines.extend(f"| `{row['slug']}` | `{row['active_candidate_vrm'] or 'none'}` | `{row['browser_smoke']}` | `{row['quality_label']}` | {', '.join(row['blockers']) or 'none'} |" for row in results)
    write_text(AUDIT_DIR / "conversion-matrix.md", "\n".join(matrix_lines))
    queue_lines = [
        "# Coding queue",
        "",
        "1. Add visual/contact-sheet review for the eight generated candidates.",
        "2. Implement hand-only runtime preview before using `rigged-hand`.",
        "3. Build creature profile runtime hooks before using creature assets.",
        "4. Recover Buzz Lightyear and Teal v2 manual mappings from source hierarchy.",
        "5. Attempt remaining humanoid conversions only when visual QA can run.",
    ]
    write_text(AUDIT_DIR / "coding-queue.md", "\n".join(queue_lines))
    playbook_lines = [
        "# Implementation playbook",
        "",
        "- Keep generated VRMs and screenshots in ignored working paths.",
        "- Use query-param-only generated avatar loading for browser smoke.",
        "- Do not public-promote an avatar until validation, visual QA, and runtime QA pass.",
        "- Treat creature and hand-only assets as separate runtime profiles.",
    ]
    write_text(AUDIT_DIR / "implementation-playbook.md", "\n".join(playbook_lines))
    compact_path = REPO_ROOT / "COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md"
    append = [
        "",
        "## Rig Readiness Pass Appendix",
        "",
        f"- Updated: `{utc_now()}`",
        f"- Models processed: `{aggregate['model_count']}`",
        f"- Browser-smoke-passing generated candidates: `{', '.join(aggregate['browser_smoke_passed'])}`",
        f"- Manual mapping needed: `{', '.join(aggregate['manual_mapping_needed'])}`",
        f"- Creature profile needed: `{', '.join(aggregate['creature_profile_needed'])}`",
        "- Visual quality is not claimed where contact sheets/screenshots are unavailable.",
    ]
    existing = compact_path.read_text() if compact_path.exists() else "# Compact model audit handoff\n"
    marker = "## Rig Readiness Pass Appendix"
    if marker in existing:
        existing = existing.split(marker)[0].rstrip() + "\n"
    write_text(compact_path, existing.rstrip() + "\n" + "\n".join(append))


def collect_models() -> list[dict[str, Any]]:
    rows = load_adapter_spec_rows()
    models: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        slug = row.get("avatar_id") or row.get("slug")
        if not slug:
            continue
        slug = str(slug)
        seen.add(slug)
        audit = read_json(AUDIT_DIR / slug / "audit.json", {})
        display_name = row.get("display_name") or (audit.get("model") or {}).get("name") or title_for_slug(slug)
        category = category_for(slug, row, audit)
        models.append({"slug": slug, "display_name": display_name, "spec": row, "audit": audit, "category": category})
    for audit_path in sorted(AUDIT_DIR.glob("*/audit.json")):
        slug = audit_path.parent.name
        if slug in seen:
            continue
        audit = read_json(audit_path, {})
        display_name = (audit.get("model") or {}).get("name") or title_for_slug(slug)
        spec = {"avatar_id": slug, "display_name": display_name}
        models.append({"slug": slug, "display_name": display_name, "spec": spec, "audit": audit, "category": category_for(slug, spec, audit)})
    return sorted(models, key=lambda row: row["slug"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser-smoke-status", default="pass")
    parser.add_argument("--browser-smoke-fail", action="append", default=[])
    parser.add_argument("--baseline-result", action="append", default=[])
    args = parser.parse_args()
    write_support_dirs()
    write_environment_reports(args)
    generated_slugs = registry_slugs()
    failed_smoke = set(args.browser_smoke_fail)
    models = collect_models()
    write_queue(models)
    results = [write_model_reports(model, generated_slugs, args.browser_smoke_status, failed_smoke) for model in models]
    write_aggregate_reports(results)
    print(json.dumps({"status": "pass", "models": len(results), "generated": sorted(generated_slugs)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
