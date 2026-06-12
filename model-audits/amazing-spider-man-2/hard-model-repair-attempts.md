# Amazing Spider-Man 2 hard-model repair attempts

- Decision: `deferred`
- Attempts: `7`
- Best attempt: `attempt-008-raw-gltf-normalize-ground`
- Best contact sheet: `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/contact-sheet.png`
- Candidate VRM path: `/Users/lekan/posepuppet-working-hard-fix/generated-vrms/amazing-spider-man-2.vrm`
- Blocker: Browser loads the candidate structurally, but every camera/material/frustum/source-reexport/raw-normalized visual attempt renders only the stage floor. Source re-export still has texture pack warnings and did not produce visible mesh in browser.
- Recommendation: Do not activate. Preserve as deferred source/material visibility blocker; next repair should inspect exported GLB materials/skin visibility in Blender and browser GLTF inspector before another conversion.

## Attempt Table

- `attempt-002-camera-framing-no-scale`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-002-camera-framing-no-scale/visual-review/contact-sheet.png`
- `attempt-003-skinned-bounds-camera`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-003-skinned-bounds-camera/visual-review/contact-sheet.png`
- `attempt-004-material-debug-lit`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-004-material-debug-lit/visual-review/contact-sheet.png`
- `attempt-005-disable-frustum-culling`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-005-disable-frustum-culling/visual-review/contact-sheet.png`
- `attempt-006-source-reexport`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-006-source-reexport/visual-review/contact-sheet.png`
- `attempt-007-raw-gltf-loader`: `superseded_attempt`, smoke `pass`, pose `static_or_not_visible`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-007-raw-gltf-loader/visual-review/contact-sheet.png`
- `attempt-008-raw-gltf-normalize-ground`: `best_deferred_evidence`, smoke `pass`, pose `not_poseable_no_visible_mesh`, sheet `model-working-hard-fix/amazing-spider-man-2/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/contact-sheet.png`
