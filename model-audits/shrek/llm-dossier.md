# Shrek - LLM Avatar Dossier

## Verdict

- Avatar ID: `shrek`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 5
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx`
- Best source for conversion: `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx`
- Runtime/reference GLB: `shrek_rig.glb`
- Target VRM path: `public/avatars/shrek.vrm`
- Do not use: shrek-rig.zip
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `convert_then_enable`
- Enabled controls: arms, feet, hands, head, legs, root_motion, upper_body
- Disabled controls: face_touch, facial_expressions, fingers, toes
- Body mode: `full`
- Root motion: `true`
- Finger mode: `curl_presets`
- Face-touch mode: `estimated_targets_only`
- Offset profile: `none`

## Technical summary

- Source format: `fbx`
- File size: 6.351 MB
- Mesh count: 2
- Skinned mesh count: 2
- Armature: `shrek_forever_face.qc_skeleton`
- Bone count: 129
- Naming style: `ValveBiped / Source`
- Animation clips: 5
- Shape keys: 0
- Materials: 6
- Textures: 9

## Appearance descriptor

Large stylized humanoid with Source/ValveBiped body rig and facial bones.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Broad body with nonstandard stylized proportions.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: single-bone fingers, facial bones, scale normalization, jaw/mouth targets

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 8502
- Vertices: 4526
- Bounds: {'max': [51.76264, 17.53189, 83.50317], 'min': [-51.76184, -17.48314, -0.01044], 'size': [103.52449, 35.01503, 83.51362]}
- Estimated height: 83.51362
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: ValveBiped.Bip01_Pelvis
- Hands/fingers: `good` / `poor`
- Feet/toes: `good` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/shrek/suggested-bone-map.json`

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
- Runtime notes: Shrek has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `medium`
- Recommended enabled controls: arms, feet, hands, head, legs, root_motion, upper_body
- Recommended disabled controls: face_touch, facial_expressions, fingers, toes

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Token-saving instructions

- Read first: `model-audits/shrek/avatar-adapter-spec.json`
- Read second: `model-audits/shrek/llm-dossier.md`
- Read only if mapping fails: `model-audits/shrek/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for shrek; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Shrek should use profile `humanoid` with action `convert_then_test`. Convert or test `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` to `public/avatars/shrek.vrm`, enable arms, feet, hands, head, legs, root_motion, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.
