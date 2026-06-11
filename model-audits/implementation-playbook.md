# Implementation playbook

## Token-saving hierarchy

Level 1 - Machine-readable implementation map:
`model-audits/avatar-adapter-specs.json`

Level 2 - Normal coding-agent handoff:
`COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`

Level 3 - Exhaustive generated understanding:
`COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`

Start with Level 1. Open Level 2 only if implementation needs reasoning context. Open Level 3 only if compact handoff is insufficient. Open per-model files only if Level 3 points you there. Open `bone-tree.txt` only if mapping fails. Open screenshots/contact sheets only if visual review is missing or inconclusive. Open source binaries only if conversion/debugging fails.

## Known app constraints

- Current avatar registry is minimal and hardcoded.
- Current runtime loads VRM avatars through the existing VRM loader.
- Do not add arbitrary FBX, BLEND, or ZIP runtime loading.
- Do not add unfinished avatars to UI cycling by default.
- Use warning labels and feature flags when adding experimental avatars.
- If a target VRM is missing locally, the app should fail gracefully or fall back.
- Current audit phase should generate implementation plans, not modify runtime registry unless explicitly asked.

## Runtime format and VRM policy

- Runtime format: VRM.
- Path convention: `public/avatars/<slug>.vrm`.
- Policy A - local/private avatars: keep `*.vrm` ignored, user manually places VRMs under `public/avatars/`, app gracefully falls back if missing.
- Policy B - committed approved demo avatars: keep sources ignored, explicitly unignore only approved runtime VRMs such as `!public/avatars/woody.vrm`, and commit only after user approval.
- This audit uses Policy A.

## Warning-label taxonomy

| Label | Meaning | UI policy | Default disabled controls |
|---|---|---|---|
| none | Fully verified runtime avatar | Can appear normally | unsupported controls only |
| partial | Usable with known limitations | Feature flag or warning | fingers/face as needed |
| experimental | Conversion/runtime not fully proven | Feature flag | risky controls |
| not-well-developed | Weak or incomplete model support | Hide by default | most controls |
| creature-profile-needed | Needs non-humanoid profile | Hide until profile exists | standard_humanoid_full_body |
| hand-only | Hand/finger test asset | Tools/tests only | body/face/feet |
| static-preview-only | Non-retargeted preview | Preview only | all tracking controls |
| conversion-needed | Source selected but VRM missing | Hide until converted | all runtime controls |
| cleanup-needed | Blender/manual mapping needed | Hide until cleaned | controls with bad mapping |

## Acceptance tests

- VRM loads in @pixiv/three-vrm.
- Avatar appears upright and facing the camera.
- Head and arms track without runtime errors.
- Unsupported controls are disabled.
- Missing VRM files show warnings/fallback rather than breaking the app.

