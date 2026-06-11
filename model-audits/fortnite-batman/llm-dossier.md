# Fortnite Batman - LLM Avatar Dossier

## Verdict

- Avatar ID: `fortnite-batman`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 3
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend`
- Best source for conversion: `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend`
- Runtime/reference GLB: `fortnite_batman_advanced_rig.glb`
- Target VRM path: `public/avatars/fortnite-batman.vrm`
- Do not use: fortnite-batman-advanced-rig.zip, fortnite_batman_advanced_rig (1).glb
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
- File size: 46.03 MB
- Mesh count: 226
- Skinned mesh count: 5
- Armature: `rig`
- Bone count: 706
- Naming style: `control-rig/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 8
- Textures: 9

## Appearance descriptor

Armored caped humanoid with full Rigify-style body and finger structure.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Conventional heroic humanoid proportions.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: cape clipping, shoulders, wrist orientation, finger mapping

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 31641
- Vertices: 21376
- Bounds: {'max': [1.16747, 1.16747, 1.69234], 'min': [-1.16747, -1.16747, 0.0], 'size': [2.33495, 2.33494, 1.69234]}
- Estimated height: 1.69234
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: MCH-foot_ik.parent.L, MCH-foot_ik.parent.R, MCH-hand_ik.parent.L, MCH-hand_ik.parent.R, MCH-thigh_ik_target.parent.L, MCH-thigh_ik_target.parent.R, MCH-torso.parent, MCH-upper_arm_ik_target.parent.L, MCH-upper_arm_ik_target.parent.R, root
- Hands/fingers: `good` / `good`
- Feet/toes: `good` / `good`
- Face/expressions: `possible`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/fortnite-batman/suggested-bone-map.json`

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
- Runtime notes: Fortnite Batman has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/fortnite-batman/avatar-adapter-spec.json`
- Read second: `model-audits/fortnite-batman/llm-dossier.md`
- Read only if mapping fails: `model-audits/fortnite-batman/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for fortnite-batman; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Fortnite Batman should use profile `humanoid` with action `convert_then_test`. Convert or test `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` to `public/avatars/fortnite-batman.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
