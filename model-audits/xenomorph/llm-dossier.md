# Xenomorph - LLM Avatar Dossier

## Verdict

- Avatar ID: `xenomorph`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 16
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx`
- Best source for conversion: `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx`
- Runtime/reference GLB: `realistic_xenomorph_rig.glb`
- Target VRM path: `public/avatars/xenomorph.vrm`
- Do not use: realistic-xenomorph-rig.zip, realistic_xenomorph_rig (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `custom_profile`
- Enabled controls: creature_head, creature_jaw, legs
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Body mode: `custom`
- Root motion: `false`
- Finger mode: `curl_presets`
- Face-touch mode: `none`
- Offset profile: `none`

## Technical summary

- Source format: `fbx`
- File size: 7.451 MB
- Mesh count: 1
- Skinned mesh count: 1
- Armature: `alien_xenos_drone_SK_Xenos_Drone_skeleton`
- Bone count: 170
- Naming style: `generic/custom`
- Animation clips: 8
- Shape keys: 0
- Materials: 2
- Textures: 0

## Appearance descriptor

Xenomorph source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 51548
- Vertices: 26781
- Bounds: {'max': [49.44653, 137.77248, 230.70741], 'min': [-51.69225, -104.39352, 81.09348], 'size': [101.13879, 242.166, 149.61394]}
- Estimated height: 149.61394
- Runtime weight: `heavy`
- Desktop safe: `true`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: XenosBiped_TrajectorySHJnt
- Hands/fingers: `missing` / `poor`
- Feet/toes: `good` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `medium`
- Suggested bone map path: `model-audits/xenomorph/suggested-bone-map.json`

## Rest pose and orientation

- Rest pose: `unknown`
- Forward axis: `unknown`
- Up axis: `+z`
- Origin: `arbitrary`
- Scale: `centimeters`

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
- Runtime notes: Xenomorph has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: creature_head, creature_jaw, legs
- Recommended disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Token-saving instructions

- Read first: `model-audits/xenomorph/avatar-adapter-spec.json`
- Read second: `model-audits/xenomorph/llm-dossier.md`
- Read only if mapping fails: `model-audits/xenomorph/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for xenomorph; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Xenomorph should use profile `creature` with action `custom_profile`. Convert or test `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` to `public/avatars/xenomorph.vrm`, enable creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
