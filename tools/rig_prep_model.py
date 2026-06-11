#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from rig_prep_pipeline import (
    MODEL_AUDITS_DIR,
    load_json,
    load_records_for_slug,
    run_blender_audit,
    utc_now,
    write_json,
    write_text,
)


def risk_notes(audit: dict) -> list[str]:
    notes = []
    descriptor = audit.get("appearance_descriptor", {})
    notes.extend(descriptor.get("likely_deformation_sensitive_areas", []))
    if audit.get("posepuppet_capabilities", {}).get("face_touch") != "good":
        notes.append("face-touch remains deferred until runtime tests")
    if audit.get("audit_quality", {}).get("runtime_test") != "complete":
        notes.append("runtime browser smoke is not attempted")
    if "upperChest" in (audit.get("missing") or {}):
        notes.append("upperChest mapping may need manual review")
    return sorted(dict.fromkeys(notes))


def write_dry_run_reports(slug: str) -> dict:
    context = load_records_for_slug(slug)
    outdir = MODEL_AUDITS_DIR / slug
    existing_audit = load_json(outdir / "audit.json")
    working_source_path = str((context["working_dir"] / Path(context["primary"]["display"].split("/")[-1])).resolve())
    expected_clean_blend = working_source_path
    payload = {
        "schema_version": "posepuppet-rig-prep-plan-v1",
        "created_at": utc_now(),
        "slug": slug,
        "display_name": context["display_name"],
        "status": "partial",
        "selected_source_path": context["primary"]["display"],
        "selected_source_kind": context["primary"]["kind"],
        "selected_source_format": context["primary"]["ext"],
        "zip_nested_source_chain": context["primary"].get("nested_chain", []),
        "working_directory": str(context["working_dir"]),
        "expected_clean_blend_path": expected_clean_blend,
        "expected_candidate_vrm_path": str(context["candidate_vrm_path"]),
        "manual_bone_map_path": str(context["manual_bone_map"]) if context["manual_bone_map"] else "",
        "runtime_glb_companion": context["runtime"]["display"] if context["runtime"] else "",
        "risk_notes": risk_notes(existing_audit),
        "gates": {
            "dry_run_resolved": True,
            "inspect_required_before_attempt": True,
            "runtime_smoke_test": "not_attempted",
        },
    }
    manifest = {
        "schema_version": "posepuppet-cleaned-source-manifest-v1",
        "created_at": utc_now(),
        "slug": slug,
        "selected_source_path": context["primary"]["display"],
        "source_from_zip": context["primary"]["kind"] != "file",
        "source_zip": context["primary"].get("source_zip", ""),
        "nested_zip": context["primary"].get("nested_zip", ""),
        "nested_chain": context["primary"].get("nested_chain", []),
        "working_directory": str(context["working_dir"]),
        "expected_clean_blend_path": expected_clean_blend,
        "expected_candidate_vrm_path": str(context["candidate_vrm_path"]),
        "manual_bone_map_path": payload["manual_bone_map_path"],
        "status": "partial",
    }
    write_json(outdir / "rig-improvement-plan.json", payload)
    write_text(
        outdir / "rig-improvement-plan.md",
        "\n".join(
            [
                f"# {context['display_name']} rig improvement plan",
                "",
                "- Status: `partial`",
                f"- Selected source path: `{payload['selected_source_path']}`",
                f"- Zip/nested zip source chain: `{json.dumps(payload['zip_nested_source_chain'])}`",
                f"- Working directory: `{payload['working_directory']}`",
                f"- Expected clean blend path: `{payload['expected_clean_blend_path']}`",
                f"- Expected candidate VRM path: `{payload['expected_candidate_vrm_path']}`",
                f"- Manual bone map path: `{payload['manual_bone_map_path'] or 'not_found'}`",
                "",
                "## Risk Notes",
                "",
            ]
            + [f"- {note}" for note in payload["risk_notes"]]
        )
        + "\n",
    )
    write_json(outdir / "cleaned-source-manifest.json", manifest)
    write_text(
        outdir / "cleaned-source-manifest.md",
        "\n".join(
            [
                f"# {context['display_name']} cleaned source manifest",
                "",
                f"- Selected source path: `{manifest['selected_source_path']}`",
                f"- Source from zip: `{str(manifest['source_from_zip']).lower()}`",
                f"- Source zip: `{manifest['source_zip'] or 'none'}`",
                f"- Nested zip: `{manifest['nested_zip'] or 'none'}`",
                f"- Nested chain: `{json.dumps(manifest['nested_chain'])}`",
                f"- Working directory: `{manifest['working_directory']}`",
                f"- Expected clean blend path: `{manifest['expected_clean_blend_path']}`",
                f"- Expected candidate VRM path: `{manifest['expected_candidate_vrm_path']}`",
                f"- Manual bone map path: `{manifest['manual_bone_map_path'] or 'not_found'}`",
                "- Status: `partial`",
            ]
        )
        + "\n",
    )
    return payload


def write_inspect_reports(slug: str) -> dict:
    inspect_outdir = MODEL_AUDITS_DIR / slug / "rig-prep-inspect"
    result = run_blender_audit(slug, inspect_outdir)
    report_dir = MODEL_AUDITS_DIR / slug
    if not result["ok"]:
        payload = {
            "schema_version": "posepuppet-source-rig-cleanup-v1",
            "created_at": utc_now(),
            "slug": slug,
            "status": "failed",
            "blender_log_path": result["log_path"],
            "blocker": f"Blender inspect failed with exit code {result['returncode']}",
        }
        write_json(report_dir / "source-rig-cleanup-report.json", payload)
        write_text(report_dir / "source-rig-cleanup-report.md", f"# {slug} source rig cleanup report\n\n- Status: `failed`\n- Blender log: `{result['log_path']}`\n")
        return payload

    audit = load_json(inspect_outdir / "audit.json")
    humanoid = audit.get("humanoid_mapping", {})
    caps = audit.get("posepuppet_capabilities", {})
    scene = audit.get("scene", {})
    rig = audit.get("rig", {})
    warnings = audit.get("warnings", [])
    status = "pass" if rig.get("has_armature") and scene.get("mesh_count", 0) > 0 else "manual_review_needed"
    cleanup = {
        "schema_version": "posepuppet-source-rig-cleanup-v1",
        "created_at": utc_now(),
        "slug": slug,
        "status": status,
        "selected_source_path": audit["model"]["selected_source_path"],
        "armature_count": scene.get("armature_count", 0),
        "mesh_count": scene.get("mesh_count", 0),
        "material_count": scene.get("material_count", 0),
        "texture_count": len(audit.get("textures", {}).get("texture_names", [])),
        "primary_armature": rig.get("primary_armature", ""),
        "humanoid_bone_count": len([value for value in humanoid.values() if value]),
        "humanoid_mapping": humanoid,
        "finger_support": audit.get("hands", {}).get("finger_support", "unknown"),
        "hand_support": caps.get("hands", "unknown"),
        "foot_support": caps.get("feet", "unknown"),
        "scale_orientation": {
            "estimated_height": audit.get("geometry", {}).get("estimated_height", 0),
            "rest_pose_guess": rig.get("rest_pose_guess", "unknown"),
        },
        "deformation_risks": risk_notes(audit),
        "warnings": warnings,
        "blender_log_path": result["log_path"],
    }
    runtime_profile = {
        "schema_version": "posepuppet-runtime-capability-profile-v1",
        "created_at": utc_now(),
        "slug": slug,
        "status": "partial",
        "upper_body": caps.get("upper_body", "unknown"),
        "legs": caps.get("legs", "unknown"),
        "hands": caps.get("hands", "unknown"),
        "fingers": caps.get("fingers", "unknown"),
        "feet": caps.get("feet", "unknown"),
        "toes": caps.get("toes", "unknown"),
        "face_touch": "deferred",
        "runtime_browser_smoke": "not_attempted",
        "runtime_ready_claim": False,
    }
    checklist_items = [
        "Verify cape/robe deformation during arm and torso motion.",
        "Verify armor and helmet rigid parts do not shear during export.",
        "Confirm wrist, hand, and finger behavior after VRM conversion.",
        "Keep face-touch deferred until runtime IK/pose validation exists.",
        "Do not promote to public UI before browser smoke passes.",
    ]
    checklist = {
        "schema_version": "posepuppet-manual-fix-checklist-v1",
        "created_at": utc_now(),
        "slug": slug,
        "status": "partial",
        "items": checklist_items,
    }
    write_json(report_dir / "source-rig-cleanup-report.json", cleanup)
    write_json(report_dir / "runtime-capability-profile.json", runtime_profile)
    write_json(report_dir / "manual-fix-checklist.json", checklist)
    write_text(
        report_dir / "source-rig-cleanup-report.md",
        "\n".join(
            [
                f"# {audit['model']['name']} source rig cleanup report",
                "",
                f"- Status: `{cleanup['status']}`",
                f"- Armature count: `{cleanup['armature_count']}`",
                f"- Mesh count: `{cleanup['mesh_count']}`",
                f"- Material count: `{cleanup['material_count']}`",
                f"- Texture count: `{cleanup['texture_count']}`",
                f"- Primary armature: `{cleanup['primary_armature']}`",
                f"- Humanoid bone count: `{cleanup['humanoid_bone_count']}`",
                f"- Finger support: `{cleanup['finger_support']}`",
                f"- Hand support: `{cleanup['hand_support']}`",
                f"- Foot support: `{cleanup['foot_support']}`",
                f"- Estimated height: `{cleanup['scale_orientation']['estimated_height']}`",
                f"- Rest pose guess: `{cleanup['scale_orientation']['rest_pose_guess']}`",
                f"- Blender log: `{cleanup['blender_log_path']}`",
                "",
                "## Deformation Risks",
                "",
            ]
            + [f"- {note}" for note in cleanup["deformation_risks"]]
        )
        + "\n",
    )
    write_text(
        report_dir / "runtime-capability-profile.md",
        "\n".join(
            [
                f"# {audit['model']['name']} runtime capability profile",
                "",
                "- Status: `partial`",
                f"- Upper body: `{runtime_profile['upper_body']}`",
                f"- Legs: `{runtime_profile['legs']}`",
                f"- Hands: `{runtime_profile['hands']}`",
                f"- Fingers: `{runtime_profile['fingers']}`",
                f"- Feet: `{runtime_profile['feet']}`",
                f"- Toes: `{runtime_profile['toes']}`",
                "- Face-touch: `deferred`",
                "- Runtime browser smoke: `not_attempted`",
                "- Runtime-ready claim: `false`",
            ]
        )
        + "\n",
    )
    write_text(
        report_dir / "manual-fix-checklist.md",
        "\n".join([f"# {audit['model']['name']} manual fix checklist", "", "- Status: `partial`"] + [f"- {item}" for item in checklist_items]) + "\n",
    )
    return cleanup


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--mode", choices=["inspect"])
    args = parser.parse_args()
    if args.dry_run:
        write_dry_run_reports(args.slug)
        return 0
    if args.mode == "inspect":
        payload = write_inspect_reports(args.slug)
        return 0 if payload.get("status") in {"pass", "partial"} else 1
    raise SystemExit("Use --dry-run or --mode inspect")


if __name__ == "__main__":
    raise SystemExit(main())
