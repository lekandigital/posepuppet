#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from rig_prep_pipeline import (
    MODEL_AUDITS_DIR,
    load_json,
    parse_glb_json,
    resolve_work_root,
    run_blender_audit_for_source,
    utc_now,
    write_json,
    write_text,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    args = parser.parse_args()

    vrm_path = resolve_work_root() / "generated-vrms" / f"{args.slug}.vrm"
    report_dir = MODEL_AUDITS_DIR / args.slug
    if not vrm_path.exists():
        payload = {
            "schema_version": "posepuppet-vrm-validation-v1",
            "created_at": utc_now(),
            "slug": args.slug,
            "status": "not_attempted",
            "candidate_vrm_path": str(vrm_path),
            "blocker": "candidate_vrm_missing",
        }
        write_json(report_dir / "post-vrm-rig-validation.json", payload)
        write_text(report_dir / "post-vrm-rig-validation.md", f"# {args.slug} post-VRM rig validation\n\n- Status: `not_attempted`\n- Candidate VRM path: `{vrm_path}`\n- Blocker: `candidate_vrm_missing`\n")
        return 1

    gltf = parse_glb_json(vrm_path)
    vrmc = (gltf.get("extensions") or {}).get("VRMC_vrm") or {}
    human_bones = ((vrmc.get("humanoid") or {}).get("humanBones") or {})

    inspect_outdir = MODEL_AUDITS_DIR / args.slug / "runtime-vrm-candidate"
    result = run_blender_audit_for_source(
        slug=f"{args.slug}-candidate-vrm",
        display_name=f"{args.slug} candidate VRM",
        source_path=vrm_path,
        source_display_path=str(vrm_path),
        source_paths=[str(vrm_path)],
        outdir=inspect_outdir,
        timeout=600,
        selected_from_zip=False,
    )
    audit = load_json(inspect_outdir / "audit.json") if (inspect_outdir / "audit.json").exists() else {}
    caps = audit.get("posepuppet_capabilities", {})
    status = "pass" if result["ok"] else "partial"
    payload = {
        "schema_version": "posepuppet-vrm-validation-v1",
        "created_at": utc_now(),
        "slug": args.slug,
        "status": status,
        "candidate_vrm_path": str(vrm_path),
        "candidate_vrm_size_bytes": vrm_path.stat().st_size,
        "vrmc_vrm_present": bool(vrmc),
        "humanoid_bone_count": len(human_bones),
        "humanoid_bones": sorted(human_bones.keys()),
        "direct_bpy_import_scene_vrm": "not_attempted",
        "fallback_gltf_vrmc_inspection": "pass" if result["ok"] else "failed",
        "mesh_count": audit.get("scene", {}).get("mesh_count", 0),
        "material_count": audit.get("scene", {}).get("material_count", 0),
        "hands_preserved": caps.get("hands", "unknown"),
        "fingers_preserved": caps.get("fingers", "unknown"),
        "feet_preserved": caps.get("feet", "unknown"),
        "scale_orientation": {
            "estimated_height": audit.get("geometry", {}).get("estimated_height", 0),
            "rest_pose_guess": audit.get("rig", {}).get("rest_pose_guess", "unknown"),
        },
        "runtime_suitability": "partial",
        "runtime_browser_smoke": "not_attempted",
        "face_touch": "deferred",
    }
    write_json(report_dir / "post-vrm-rig-validation.json", payload)
    write_text(
        report_dir / "post-vrm-rig-validation.md",
        "\n".join(
            [
                f"# {args.slug} post-VRM rig validation",
                "",
                f"- Status: `{payload['status']}`",
                f"- Candidate VRM path: `{payload['candidate_vrm_path']}`",
                f"- Candidate VRM size bytes: `{payload['candidate_vrm_size_bytes']}`",
                f"- VRMC_vrm present: `{str(payload['vrmc_vrm_present']).lower()}`",
                f"- Humanoid bone count: `{payload['humanoid_bone_count']}`",
                f"- Direct bpy.ops.import_scene.vrm: `{payload['direct_bpy_import_scene_vrm']}`",
                f"- Fallback glTF/VRMC inspection: `{payload['fallback_gltf_vrmc_inspection']}`",
                f"- Mesh count: `{payload['mesh_count']}`",
                f"- Material count: `{payload['material_count']}`",
                f"- Hands preserved: `{payload['hands_preserved']}`",
                f"- Fingers preserved: `{payload['fingers_preserved']}`",
                f"- Feet preserved: `{payload['feet_preserved']}`",
                f"- Estimated height: `{payload['scale_orientation']['estimated_height']}`",
                f"- Rest pose guess: `{payload['scale_orientation']['rest_pose_guess']}`",
                "- Runtime suitability: `partial`",
                "- Runtime browser smoke: `not_attempted`",
                "- Face-touch: `deferred`",
            ]
        )
        + "\n",
    )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
