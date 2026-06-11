# Teal v2 - LLM Avatar Dossier

## Verdict

- Avatar ID: `teal-v2`
- Recommended action: `cleanup_then_convert`
- First runtime profile: `humanoid_with_offsets`
- Implementation priority: 18
- One-line reason: Automatic mapping is too weak; inspect hierarchy and create a manual map first.

## Source selection

- Best source for audit: `teal-v2.zip!/source/Tealv2.fbx`
- Best source for conversion: `teal-v2.zip!/source/Tealv2.fbx`
- Runtime/reference GLB: `teal_v.2.glb`
- Target VRM path: `public/avatars/teal-v2.vrm`
- Do not use: teal-v2.zip, teal_v.2 (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `cleanup_then_convert`
- Enabled controls: arms, feet, hands, head, legs, upper_body
- Disabled controls: face_touch, facial_expressions, fingers, toes
- Body mode: `full`
- Root motion: `false`
- Finger mode: `none`
- Face-touch mode: `none`
- Offset profile: `teal-v2-offsets`

## Technical summary

- Source format: `fbx`
- File size: 5.479 MB
- Mesh count: 5
- Skinned mesh count: 5
- Armature: `Armature.006`
- Bone count: 111
- Naming style: `generic/custom`
- Animation clips: 8
- Shape keys: 0
- Materials: 6
- Textures: 8

## Appearance descriptor

Teal v2 source has a humanoid_with_offsets technical profile based on scripted rig and geometry evidence.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Proportions were inferred from bounds only; visual contact sheets were not generated.
- Optional visual observation: not available
- Confidence: `low`
- Runtime implication: orientation, scale, shoulders/wrists if humanoid, unsupported controls

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 17666
- Vertices: 10722
- Bounds: {'max': [0.45234, 0.28596, 1.47309], 'min': [-0.45234, -0.36245, -0.00395], 'size': [0.90467, 0.6484, 1.47704]}
- Estimated height: 1.47704
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: Bone
- Hands/fingers: `missing` / `missing`
- Feet/toes: `good` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `low`
- Suggested bone map path: `model-audits/teal-v2/suggested-bone-map.json`

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
- Runtime notes: Teal v2 has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, feet, hands, head, legs, upper_body
- Recommended disabled controls: face_touch, facial_expressions, fingers, toes

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Token-saving instructions

- Read first: `model-audits/teal-v2/avatar-adapter-spec.json`
- Read second: `model-audits/teal-v2/llm-dossier.md`
- Read only if mapping fails: `model-audits/teal-v2/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for teal-v2; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Teal v2 should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `teal-v2.zip!/source/Tealv2.fbx` to `public/avatars/teal-v2.vrm`, enable arms, feet, hands, head, legs, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.
