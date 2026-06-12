# Hard-model repair summary

- Branch: `hard-model-fix`
- Worktree: `/Users/lekan/Dev/posepuppet-hard-model-fix`
- Main checkout untouched: `/Users/lekan/Dev/posepuppet`
- Public UI: generated avatars remain query-param-only with `enabledInUi: false`.

## Active candidates

- `spider-man-playstation`: best `attempt-005-visual-pose-suite-fixed`, sheet `model-working-hard-fix/spider-man-playstation/attempts/attempt-005-visual-pose-suite-fixed/visual-review/contact-sheet.png`, VRM `/Users/lekan/posepuppet-working-hard-fix/generated-vrms/spider-man-playstation.vrm`
- `buzz-lightyear`: best `attempt-008-manual-bone-map-vrm`, sheet `model-working-hard-fix/buzz-lightyear/attempts/attempt-008-manual-bone-map-vrm/visual-review/contact-sheet.png`, VRM `/Users/lekan/posepuppet-working-hard-fix/generated-vrms/buzz-lightyear.vrm`
- `teal-v2`: best `attempt-009-visual-pose-suite-fixed-manual-map`, sheet `model-working-hard-fix/teal-v2/attempts/attempt-009-visual-pose-suite-fixed-manual-map/visual-review/contact-sheet.png`, VRM `/Users/lekan/posepuppet-working-hard-fix/generated-vrms/teal-v2.vrm`

## Reference only

- `jack-sparrow`: best `attempt-011-visual-pose-suite-fixed-duplicate-cull`, blocker Duplicate copy can be hidden in the raw visual harness, but the visible copy does not deform when matched bones are posed. Source contains duplicated mesh/armature content that still needs proper cleanup or rebinding.

## Deferred

- `amazing-spider-man-2`: best `attempt-008-raw-gltf-normalize-ground`, blocker Browser loads the candidate structurally, but every camera/material/frustum/source-reexport/raw-normalized visual attempt renders only the stage floor. Source re-export still has texture pack warnings and did not produce visible mesh in browser.
- `terminator-t-800`: best `attempt-008-raw-gltf-normalize-ground`, blocker Raw-normalized browser attempt shows at most a tiny speck. Diagnostics show extreme source bounds/scale and source re-export has missing texture warnings; current candidate is not visually usable.
- `spider-man-no-way-home`: best `attempt-008-raw-gltf-normalize-ground`, blocker Conversion and raw loader can complete, but camera/material/frustum/source-reexport/raw-normalized visual attempts still render only the stage floor.
- `elsa`: best `attempt-008-raw-gltf-normalize-ground`, blocker VRM loader rejects the candidate because required humanoid lower-body bones are missing; raw GLTF load succeeds but remains visually blank after normalization. Source audit shows only upper-body useful mapping plus duplicate/reflection source content.
