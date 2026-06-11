# Darth Vader - LLM Avatar Dossier

## Verdict

- Avatar ID: `darth-vader`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 2
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend`
- Best source for conversion: `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend`
- Runtime/reference GLB: `fortnite_darth_vader_advanced_rig (2).glb`
- Target VRM path: `public/avatars/darth-vader.vrm`
- Do not use: fortnite-darth-vader-advanced-rig.zip, fortnite_darth_vader_advanced_rig (1).glb, fortnite_darth_vader_advanced_rig (3).glb, fortnite_darth_vader_advanced_rig.glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `convert_then_enable`
- Enabled controls: arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body
- Disabled controls: face_touch, facial_expressions
- Body mode: `full`
- Root motion: `true`
- Finger mode: `full_finger_retargeting`
- Face-touch mode: `ik_required`
- Offset profile: `none`

## Technical summary

- Source format: `blend`
- File size: 32.614 MB
- Mesh count: 230
- Skinned mesh count: 10
- Armature: `rig`
- Bone count: 706
- Naming style: `control-rig/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 2
- Textures: 9

## Appearance descriptor

Armored humanoid with robe/cape-like and rigid accessory risks from many meshes and a Rigify-style control rig.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Conventional full-body humanoid proportions.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: cape/robe deformation, shoulders, wrist orientation, finger mapping

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 29737
- Vertices: 20586
- Bounds: {'max': [1.22115, 1.22115, 1.77039], 'min': [-1.22115, -1.22115, -0.00351], 'size': [2.4423, 2.4423, 1.7739]}
- Estimated height: 1.7739
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: MCH-foot_ik.parent.L, MCH-foot_ik.parent.R, MCH-hand_ik.parent.L, MCH-hand_ik.parent.R, MCH-thigh_ik_target.parent.L, MCH-thigh_ik_target.parent.R, MCH-torso.parent, MCH-upper_arm_ik_target.parent.L, MCH-upper_arm_ik_target.parent.R, root
- Hands/fingers: `good` / `good`
- Feet/toes: `good` / `good`
- Face/expressions: `possible`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/darth-vader/suggested-bone-map.json`

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
- Runtime notes: Darth Vader has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `medium`
- Recommended enabled controls: arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body
- Recommended disabled controls: face_touch, facial_expressions

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable facial expressions for this model yet.

## Token-saving instructions

- Read first: `model-audits/darth-vader/avatar-adapter-spec.json`
- Read second: `model-audits/darth-vader/llm-dossier.md`
- Read only if mapping fails: `model-audits/darth-vader/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for darth-vader; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Darth Vader should use profile `humanoid` with action `convert_then_test`. Convert or test `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` to `public/avatars/darth-vader.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
