# Iron Man - LLM Avatar Dossier

## Verdict

- Avatar ID: `iron-man`
- Recommended action: `convert_then_test`
- First runtime profile: `humanoid`
- Implementation priority: 4
- One-line reason: Good structural candidate, but runtime load and deformation tests are still required.

## Source selection

- Best source for audit: `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend`
- Best source for conversion: `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend`
- Runtime/reference GLB: `iron_man_rig.glb`
- Target VRM path: `public/avatars/iron-man.vrm`
- Do not use: iron-man-rig.zip, iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.fbx
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
- File size: 3.994 MB
- Mesh count: 143
- Skinned mesh count: 1
- Armature: `rig`
- Bone count: 333
- Naming style: `control-rig/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 3
- Textures: 2

## Appearance descriptor

Rigid armored humanoid, likely easier for body tracking than cloth-heavy characters but sensitive to joint axes.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Conventional full-body humanoid proportions.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: shoulders, wrists, mechanical finger bend, ankle/foot orientation

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 12676
- Vertices: 11728
- Bounds: {'max': [5.26034, 5.26034, 6.37571], 'min': [-5.26034, -5.26034, -0.11143], 'size': [10.52068, 10.52067, 6.48714]}
- Estimated height: 6.48714
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: MCH-foot_ik_socket.L, MCH-foot_ik_socket.R, MCH-foot_pole_ik_socket.L, MCH-foot_pole_ik_socket.R, MCH-hand_ik_socket.L, MCH-hand_ik_socket.R, MCH-hand_pole_ik_socket.L, MCH-hand_pole_ik_socket.R, root
- Hands/fingers: `good` / `good`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/iron-man/suggested-bone-map.json`

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
- Runtime notes: Iron Man has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/iron-man/avatar-adapter-spec.json`
- Read second: `model-audits/iron-man/llm-dossier.md`
- Read only if mapping fails: `model-audits/iron-man/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for iron-man; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Iron Man should use profile `humanoid` with action `convert_then_test`. Convert or test `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` to `public/avatars/iron-man.vrm`, enable arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body, and disable face_touch, facial_expressions until runtime tests pass.
