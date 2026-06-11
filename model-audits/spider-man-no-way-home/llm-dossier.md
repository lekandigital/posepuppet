# Spider-Man No Way Home - LLM Avatar Dossier

## Verdict

- Avatar ID: `spider-man-no-way-home`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 6
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Best source for conversion: `OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Runtime/reference GLB: `none`
- Target VRM path: `public/avatars/spider-man-no-way-home.vrm`
- Do not use: OtherSpiderman/spider-man-no-way-home-rigged.zip, OtherSpiderman/spider-man_no_way_home_rigged (1).glb
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

- Source format: `glb`
- File size: 16.163 MB
- Mesh count: 9
- Skinned mesh count: 8
- Armature: `Object_8`
- Bone count: 329
- Naming style: `Mixamo`
- Animation clips: 0
- Shape keys: 0
- Materials: 8
- Textures: 8

## Appearance descriptor

Spider-Man No Way Home source has a humanoid technical profile based on scripted rig and geometry evidence.

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

- Triangles: 90618
- Vertices: 51468
- Bounds: {'max': [0.95106, 1.0, 1.80721], 'min': [-0.95106, -1.0, -1.0], 'size': [1.90212, 2.0, 2.80721]}
- Estimated height: 2.80721
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: _rootJoint
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/spider-man-no-way-home/suggested-bone-map.json`

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
- Runtime notes: Spider-Man No Way Home has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/spider-man-no-way-home/avatar-adapter-spec.json`
- Read second: `model-audits/spider-man-no-way-home/llm-dossier.md`
- Read only if mapping fails: `model-audits/spider-man-no-way-home/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for spider-man-no-way-home; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Spider-Man No Way Home should use profile `humanoid` with action `convert_then_test`. Convert or test `OtherSpiderman/spider-man_no_way_home_rigged.glb` to `public/avatars/spider-man-no-way-home.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
