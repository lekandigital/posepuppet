# Godzilla - LLM Avatar Dossier

## Verdict

- Avatar ID: `godzilla`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 15
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend`
- Best source for conversion: `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend`
- Runtime/reference GLB: `godzilla_rigged_animated.glb`
- Target VRM path: `public/avatars/godzilla.vrm`
- Do not use: godzilla-rigged-animated.zip, godzilla_rigged_animated (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `custom_profile`
- Enabled controls: arms, creature_head, creature_jaw, legs
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Body mode: `custom`
- Root motion: `false`
- Finger mode: `curl_presets`
- Face-touch mode: `none`
- Offset profile: `none`

## Technical summary

- Source format: `blend`
- File size: 44.657 MB
- Mesh count: 1
- Skinned mesh count: 1
- Armature: `GLTF_created_0`
- Bone count: 130
- Naming style: `control-rig/custom`
- Animation clips: 1
- Shape keys: 0
- Materials: 1
- Textures: 43

## Appearance descriptor

Godzilla source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 46898
- Vertices: 32011
- Bounds: {'max': [0.97403, 2.02116, 2.1568], 'min': [-0.80323, -1.25845, -0.03371], 'size': [1.77726, 3.27961, 2.1905]}
- Estimated height: 2.1905
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: GLTF_created_0_rootJoint
- Hands/fingers: `good` / `poor`
- Feet/toes: `good` / `good`
- Face/expressions: `missing`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/godzilla/suggested-bone-map.json`

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
- Runtime candidate: `false`

## PosePuppet runtime test

- Loads in PosePuppet: `not_attempted`
- Runtime notes: Godzilla has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, creature_head, creature_jaw, legs
- Recommended disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Token-saving instructions

- Read first: `model-audits/godzilla/avatar-adapter-spec.json`
- Read second: `model-audits/godzilla/llm-dossier.md`
- Read only if mapping fails: `model-audits/godzilla/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for godzilla; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Godzilla should use profile `creature` with action `custom_profile`. Convert or test `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend` to `public/avatars/godzilla.vrm`, enable arms, creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
