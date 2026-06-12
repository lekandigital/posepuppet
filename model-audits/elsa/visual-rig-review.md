# Elsa visual rig review

- Visual label: `blank_floor_only`
- Best contact sheet: `model-working-hard-fix/elsa/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/contact-sheet.png`
- Browser capture: `model-working-hard-fix/elsa/attempts/attempt-008-raw-gltf-normalize-ground/visual-review/capture-results.json`
- Review: VRM loader rejects the candidate because required humanoid lower-body bones are missing; raw GLTF load succeeds but remains visually blank after normalization. Source audit shows only upper-body useful mapping plus duplicate/reflection source content.
