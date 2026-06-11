# Jack Sparrow - LLM Avatar Dossier

## Verdict

- Avatar ID: `jack-sparrow`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid_with_offsets`
- Implementation priority: 10
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend`
- Best source for conversion: `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend`
- Runtime/reference GLB: `jack_sparrow_ready_for_animation.glb`
- Target VRM path: `public/avatars/jack-sparrow.vrm`
- Do not use: jack-sparrow-ready-for-animation.zip, jack_sparrow_ready_for_animation (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `convert_then_enable`
- Enabled controls: arms, feet, hands, head, legs, toes, upper_body
- Disabled controls: face_touch, facial_expressions, fingers
- Body mode: `full`
- Root motion: `false`
- Finger mode: `palm_only`
- Face-touch mode: `ik_required`
- Offset profile: `jack-sparrow-offsets`

## Technical summary

- Source format: `blend`
- File size: 98.273 MB
- Mesh count: 92
- Skinned mesh count: 46
- Armature: `JackSparrow Armarture`
- Bone count: 112
- Naming style: `Mixamo`
- Animation clips: 0
- Shape keys: 0
- Materials: 35
- Textures: 20

## Appearance descriptor

Jack Sparrow source has a humanoid_with_offsets technical profile based on scripted rig and geometry evidence.

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

- Triangles: 245830
- Vertices: 157612
- Bounds: {'max': [12.04379, 3.42149, 10.72324], 'min': [-4.05761, -3.24887, -0.0316], 'size': [16.10139, 6.67036, 10.75485]}
- Estimated height: 10.75485
- Runtime weight: `very_heavy`
- Desktop safe: `false`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: Ctrl_ArmPole_IK_Left, Ctrl_ArmPole_IK_Right, Ctrl_Foot_IK_Left, Ctrl_Foot_IK_Right, Ctrl_Hand_IK_Left, Ctrl_Hand_IK_Right, Ctrl_LegPole_IK_Left, Ctrl_LegPole_IK_Right, Ctrl_Master, mixamorig:Hips
- Hands/fingers: `good` / `missing`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/jack-sparrow/suggested-bone-map.json`

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
- Runtime notes: Jack Sparrow has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `medium`
- Recommended enabled controls: arms, feet, hands, head, legs, toes, upper_body
- Recommended disabled controls: face_touch, facial_expressions, fingers

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.

## Token-saving instructions

- Read first: `model-audits/jack-sparrow/avatar-adapter-spec.json`
- Read second: `model-audits/jack-sparrow/llm-dossier.md`
- Read only if mapping fails: `model-audits/jack-sparrow/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for jack-sparrow; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Jack Sparrow should use profile `humanoid_with_offsets` with action `convert_then_test`. Convert or test `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend` to `public/avatars/jack-sparrow.vrm`, enable arms, feet, hands, head, legs, toes, upper_body, and disable face_touch, facial_expressions, fingers until runtime tests pass.
