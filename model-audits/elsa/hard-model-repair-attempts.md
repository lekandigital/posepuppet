# Elsa hard-model repair attempts

- Decision: `deferred`
- Attempts: `3`
- Best attempt: `attempt-008-raw-gltf-normalize-ground`
- Best contact sheet: `model-working-hard-fix/elsa/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/contact-sheet.png`
- Candidate VRM path: `/Users/lekan/posepuppet-working-hard-fix/generated-vrms/elsa.vrm`
- Blocker: VRM loader rejects the candidate because required humanoid lower-body bones are missing; raw GLTF load succeeds but remains visually blank after normalization. Source audit shows only upper-body useful mapping plus duplicate/reflection source content.
- Recommendation: Do not activate. Requires manual artist/source repair to add or recover lower-body bones before VRM humanoid conversion can be trusted.

## Attempt Table

- `attempt-002-camera-framing-no-scale`: `failed_browser_load`, smoke `failed`, pose `static_or_not_visible`, sheet `model-working-hard-fix/elsa/attempts/attempt-002-camera-framing-no-scale/visual-review/contact-sheet.png`
- `attempt-007-raw-gltf-loader`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/elsa/attempts/attempt-007-raw-gltf-loader/visual-review/contact-sheet.png`
- `attempt-008-raw-gltf-normalize-ground`: `best_deferred_evidence`, smoke `pass`, pose `not_poseable_missing_required_lower_body_bones`, sheet `model-working-hard-fix/elsa/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/contact-sheet.png`
