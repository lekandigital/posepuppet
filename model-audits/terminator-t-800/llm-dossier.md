# Terminator T-800 - LLM Avatar Dossier

## Verdict

- Avatar ID: `terminator-t-800`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 9
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend`
- Best source for conversion: `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend`
- Runtime/reference GLB: `terminator-t-800-endo-skeleton-damaged.glb`
- Target VRM path: `public/avatars/terminator-t-800.vrm`
- Do not use: terminator-t-800-endo-skeleton-damaged (1).glb, terminator-t-800-endo-skeleton-damaged.zip
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `convert_then_enable`
- Enabled controls: arms, feet, hands, head, legs, root_motion, toes, upper_body
- Disabled controls: face_touch, facial_expressions, fingers
- Body mode: `full`
- Root motion: `true`
- Finger mode: `palm_only`
- Face-touch mode: `ik_required`
- Offset profile: `none`

## Technical summary

- Source format: `blend`
- File size: 3.401 MB
- Mesh count: 15
- Skinned mesh count: 15
- Armature: `Armature`
- Bone count: 65
- Naming style: `Mixamo`
- Animation clips: 2
- Shape keys: 0
- Materials: 10
- Textures: 21

## Appearance descriptor

Terminator T-800 source has a humanoid technical profile based on scripted rig and geometry evidence.

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

- Triangles: 8244
- Vertices: 4765
- Bounds: {'max': [58.0757, 18.51177, 201.32642], 'min': [-58.12984, -66.04408, -2.41557], 'size': [116.20554, 84.55584, 203.74198]}
- Estimated height: 203.74198
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: mixamorig:Hips
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/terminator-t-800/suggested-bone-map.json`

## Rest pose and orientation

- Rest pose: `unknown`
- Forward axis: `unknown`
- Up axis: `+z`
- Origin: `feet`
- Scale: `centimeters`

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
- Runtime notes: Terminator T-800 has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `medium`
- Recommended enabled controls: arms, feet, hands, head, legs, root_motion, toes, upper_body
- Recommended disabled controls: face_touch, facial_expressions, fingers

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Token-saving instructions

- Read first: `model-audits/terminator-t-800/avatar-adapter-spec.json`
- Read second: `model-audits/terminator-t-800/llm-dossier.md`
- Read only if mapping fails: `model-audits/terminator-t-800/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for terminator-t-800; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Terminator T-800 should use profile `humanoid` with action `convert_then_test`. Convert or test `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend` to `public/avatars/terminator-t-800.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
