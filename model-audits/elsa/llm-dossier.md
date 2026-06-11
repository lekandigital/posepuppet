# Elsa - LLM Avatar Dossier

## Verdict

- Avatar ID: `elsa`
- Recommended action: `cleanup_then_convert`
- First runtime profile: `humanoid_with_offsets`
- Implementation priority: 11
- One-line reason: Partial structure exists, but cleanup or custom mapping is needed first.

## Source selection

- Best source for audit: `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb`
- Best source for conversion: `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb`
- Runtime/reference GLB: `elsa_free_fall_frozen_with_rig_included (2).glb`
- Target VRM path: `public/avatars/elsa.vrm`
- Do not use: elsa-free-fall-frozen-with-rig-included (1).zip, elsa-free-fall-frozen-with-rig-included (2).zip, elsa-free-fall-frozen-with-rig-included (2).zip!/source/elsa free fall.zip!/Elsa (merge).glb, elsa-free-fall-frozen-with-rig-included.zip, elsa-free-fall-frozen-with-rig-included.zip!/source/elsa free fall.zip!/Elsa (merge).glb, elsa_free_fall_frozen_with_rig_included (1).glb, elsa_free_fall_frozen_with_rig_included (3).glb, elsa_free_fall_frozen_with_rig_included.glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `cleanup_then_convert`
- Enabled controls: arms, hands, head, upper_body
- Disabled controls: face_touch, facial_expressions, feet, fingers, toes
- Body mode: `upper`
- Root motion: `false`
- Finger mode: `curl_presets`
- Face-touch mode: `ik_required`
- Offset profile: `elsa-offsets`

## Technical summary

- Source format: `glb`
- File size: 0.424 MB
- Mesh count: 3
- Skinned mesh count: 2
- Armature: `Armature`
- Bone count: 124
- Naming style: `generic/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 3
- Textures: 1

## Appearance descriptor

Stylized upper-body humanoid with useful head/face/hand bones but missing leg and foot mapping in the selected source.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Tall stylized character with orientation/scale oddities in bounds.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: custom mapping, leg absence, palm/thumb-only hands, mouth/cheek target estimation

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 7634
- Vertices: 5914
- Bounds: {'max': [0.95106, 1.0, 3.53608], 'min': [-0.95106, -13.49413, -1.0], 'size': [1.90212, 14.49413, 4.53608]}
- Estimated height: 4.53608
- Runtime weight: `light`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: Elsa (merge)
- Hands/fingers: `good` / `poor`
- Feet/toes: `missing` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `medium`
- Suggested bone map path: `model-audits/elsa/suggested-bone-map.json`

## Rest pose and orientation

- Rest pose: `unknown`
- Forward axis: `unknown`
- Up axis: `+z`
- Origin: `feet`
- Scale: `meters`

## Conversion status

- Conversion attempted: `false`
- Conversion result: `not_attempted`
- Manual mapping needed: `true`

## Conversion diff

- Status: `not_attempted`
- Skeleton preserved: `unknown`
- Mapping preserved: `unknown`
- Runtime candidate: `true`

## PosePuppet runtime test

- Loads in PosePuppet: `not_attempted`
- Runtime notes: Elsa has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, hands, head, upper_body
- Recommended disabled controls: face_touch, facial_expressions, feet, fingers, toes

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.

## Token-saving instructions

- Read first: `model-audits/elsa/avatar-adapter-spec.json`
- Read second: `model-audits/elsa/llm-dossier.md`
- Read only if mapping fails: `model-audits/elsa/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for elsa; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Elsa should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` to `public/avatars/elsa.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.
