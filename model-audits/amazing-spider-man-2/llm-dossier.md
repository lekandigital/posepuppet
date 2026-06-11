# The Amazing Spider-Man 2 - LLM Avatar Dossier

## Verdict

- Avatar ID: `amazing-spider-man-2`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 8
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx`
- Best source for conversion: `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx`
- Runtime/reference GLB: `OtherSpiderman/the_amazing_spider_man_2_rigged_model.glb`
- Target VRM path: `public/avatars/amazing-spider-man-2.vrm`
- Do not use: OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip, OtherSpiderman/the_amazing_spider_man_2_rigged_model (1).glb
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

- Source format: `fbx`
- File size: 11.185 MB
- Mesh count: 1
- Skinned mesh count: 1
- Armature: `Armature`
- Bone count: 65
- Naming style: `Mixamo`
- Animation clips: 1
- Shape keys: 0
- Materials: 7
- Textures: 7

## Appearance descriptor

The Amazing Spider-Man 2 source has a humanoid technical profile based on scripted rig and geometry evidence.

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

- Triangles: 13400
- Vertices: 7633
- Bounds: {'max': [118.0609, 23.22499, 68.7858], 'min': [-113.08123, -68.11708, -0.17583], 'size': [231.14213, 91.34207, 68.96163]}
- Estimated height: 68.96163
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: mixamorig:Hips
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/amazing-spider-man-2/suggested-bone-map.json`

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
- Runtime notes: The Amazing Spider-Man 2 has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/amazing-spider-man-2/avatar-adapter-spec.json`
- Read second: `model-audits/amazing-spider-man-2/llm-dossier.md`
- Read only if mapping fails: `model-audits/amazing-spider-man-2/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for amazing-spider-man-2; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

The Amazing Spider-Man 2 should use profile `humanoid` with action `convert_then_test`. Convert or test `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` to `public/avatars/amazing-spider-man-2.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
