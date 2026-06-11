# Spider-Man PlayStation - LLM Avatar Dossier

## Verdict

- Avatar ID: `spider-man-playstation`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 7
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend`
- Best source for conversion: `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend`
- Runtime/reference GLB: `spider_man_playstation_rigged.glb`
- Target VRM path: `public/avatars/spider-man-playstation.vrm`
- Do not use: spider-man-playstation-rigged.zip, spider_man_playstation_rigged (1).glb
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
- File size: 35.365 MB
- Mesh count: 20
- Skinned mesh count: 20
- Armature: `Armature.002`
- Bone count: 65
- Naming style: `Mixamo`
- Animation clips: 6
- Shape keys: 0
- Materials: 20
- Textures: 21

## Appearance descriptor

Spider-Man PlayStation source has a humanoid technical profile based on scripted rig and geometry evidence.

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

- Triangles: 149328
- Vertices: 103308
- Bounds: {'max': [0.88009, -4.04149, 0.89368], 'min': [-0.13862, -5.27973, -0.06034], 'size': [1.01871, 1.23823, 0.95402]}
- Estimated height: 0.95402
- Runtime weight: `very_heavy`
- Desktop safe: `false`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: mixamorig:Hips
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/spider-man-playstation/suggested-bone-map.json`

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
- Runtime notes: Spider-Man PlayStation has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/spider-man-playstation/avatar-adapter-spec.json`
- Read second: `model-audits/spider-man-playstation/llm-dossier.md`
- Read only if mapping fails: `model-audits/spider-man-playstation/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for spider-man-playstation; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Spider-Man PlayStation should use profile `humanoid` with action `convert_then_test`. Convert or test `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` to `public/avatars/spider-man-playstation.vrm`, enable arms, feet, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
