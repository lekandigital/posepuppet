# Woody - LLM Avatar Dossier

## Verdict

- Avatar ID: `woody`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 1
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- Best source for conversion: `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- Runtime/reference GLB: `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb`
- Target VRM path: `public/avatars/woody.vrm`
- Do not use: /Users/lekan/Downloads/woody/woody-toy-story-rig-free-download.zip
- Reasoning: Use the explicit Woody FBX source requested for conversion; keep the GLB as reference only.

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
- File size: 3.952 MB
- Mesh count: 6
- Skinned mesh count: 6
- Armature: `Armature`
- Bone count: 65
- Naming style: `Mixamo`
- Animation clips: 1
- Shape keys: 0
- Materials: 6
- Textures: 7

## Appearance descriptor

Humanoid toy/cowboy silhouette inferred from the Woody source path, Mixamo humanoid skeleton, and mesh/texture names.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Tall toy-proportioned body with broad T-pose arm span; expect shoulder and wrist offset testing before confident face-touch.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: hat/head attachment, shoulders, elbows, wrists, boot/foot orientation

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 23874
- Vertices: 71622
- Bounds: {'max': [1.01569, 0.38532, 2.08887], 'min': [-1.01768, -0.32727, -0.00129], 'size': [2.03337, 0.71259, 2.09016]}
- Estimated height: 2.09016
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: mixamorig:Hips
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/woody/suggested-bone-map.json`

## Rest pose and orientation

- Rest pose: `t_pose`
- Forward axis: `unknown`
- Up axis: `+z`
- Origin: `feet`
- Scale: `meters`

## Conversion status

- Conversion attempted: `true`
- Conversion result: `pass`
- Manual mapping needed: `false`

## Conversion diff

- Status: `completed`
- Skeleton preserved: `yes`
- Mapping preserved: `yes`
- Runtime candidate: `true`

## PosePuppet runtime test

- Loads in PosePuppet: `not_attempted`
- Runtime notes: Woody has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/woody/avatar-adapter-spec.json`
- Read second: `model-audits/woody/llm-dossier.md`
- Read only if mapping fails: `model-audits/woody/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for woody; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Woody should use profile `humanoid` with action `convert_then_test`. Convert or test `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` to `public/avatars/woody.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
