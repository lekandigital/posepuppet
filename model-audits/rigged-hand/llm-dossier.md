# Rigged Hand - LLM Avatar Dossier

## Verdict

- Avatar ID: `rigged-hand`
- Recommended action: `hand_test_only`
- First runtime profile: `hand_only`
- Implementation priority: 17
- One-line reason: Use only for hand/finger experiments; it is not a full avatar.

## Source selection

- Best source for audit: `rigged-hand.zip!/source/handRig_02.fbx`
- Best source for conversion: `rigged-hand.zip!/source/handRig_02.fbx`
- Runtime/reference GLB: `rigged_hand.glb`
- Target VRM path: `public/avatars/rigged-hand.vrm`
- Do not use: rigged-hand.zip, rigged_hand (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `hand_test_only`
- Enabled controls: fingers, hands
- Disabled controls: arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body
- Body mode: `disabled`
- Root motion: `false`
- Finger mode: `curl_presets`
- Face-touch mode: `none`
- Offset profile: `none`

## Technical summary

- Source format: `fbx`
- File size: 1.488 MB
- Mesh count: 1
- Skinned mesh count: 1
- Armature: `Armature`
- Bone count: 68
- Naming style: `control-rig/custom`
- Animation clips: 2
- Shape keys: 0
- Materials: 1
- Textures: 4

## Appearance descriptor

Single right-hand/finger test asset, not a full avatar.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Hand-only proportions.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: finger curl axes, right-hand-only assumptions

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 28994
- Vertices: 14499
- Bounds: {'max': [0.97407, 0.61336, 1.65711], 'min': [-0.87878, -0.85437, -0.11754], 'size': [1.85285, 1.46773, 1.77464]}
- Estimated height: 1.77464
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: index_tip.R, middle_tip.R, pinky_tip.R, pulse.R, ring_tip.R, thumb_tip.R
- Hands/fingers: `partial` / `poor`
- Feet/toes: `missing` / `missing`
- Face/expressions: `missing`
- Bone map confidence: `low`
- Suggested bone map path: `model-audits/rigged-hand/suggested-bone-map.json`

## Rest pose and orientation

- Rest pose: `hand-only`
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
- Runtime candidate: `false`

## PosePuppet runtime test

- Loads in PosePuppet: `not_attempted`
- Runtime notes: Rigged Hand has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: fingers, hands
- Recommended disabled controls: arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.
- Do not treat this as a full avatar; use it only for hand/finger tests.

## Token-saving instructions

- Read first: `model-audits/rigged-hand/avatar-adapter-spec.json`
- Read second: `model-audits/rigged-hand/llm-dossier.md`
- Read only if mapping fails: `model-audits/rigged-hand/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for rigged-hand; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Rigged Hand should use profile `hand_only` with action `hand_test_only`. Convert or test `rigged-hand.zip!/source/handRig_02.fbx` to `public/avatars/rigged-hand.vrm`, enable fingers, hands, and disable arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body until runtime tests pass.
