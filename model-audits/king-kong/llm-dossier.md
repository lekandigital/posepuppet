# King Kong - LLM Avatar Dossier

## Verdict

- Avatar ID: `king-kong`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 13
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `king-kong-animated.zip!/source/king kong.glb`
- Best source for conversion: `king-kong-animated.zip!/source/king kong.glb`
- Runtime/reference GLB: `king_kong_animated.glb`
- Target VRM path: `public/avatars/king-kong.vrm`
- Do not use: king-kong-animated.zip, king_kong_animated (1).glb
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

- Source format: `glb`
- File size: 13.638 MB
- Mesh count: 8
- Skinned mesh count: 7
- Armature: `king_kong.qc_skeleton`
- Bone count: 86
- Naming style: `bip-style`
- Animation clips: 23
- Shape keys: 0
- Materials: 3
- Textures: 0

## Appearance descriptor

King Kong source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 179501
- Vertices: 152952
- Bounds: {'max': [3945.02417, 1581.39038, 4857.04541], 'min': [-3099.43164, -1821.20227, -16.68125], 'size': [7044.45581, 3402.59265, 4873.72666]}
- Estimated height: 4873.72666
- Runtime weight: `very_heavy`
- Desktop safe: `false`
- Mobile safe: `false`

## Rig and humanoid mapping

- Root: bip_pelvis
- Hands/fingers: `good` / `partial`
- Feet/toes: `good` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `high`
- Suggested bone map path: `model-audits/king-kong/suggested-bone-map.json`

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
- Runtime candidate: `false`

## PosePuppet runtime test

- Loads in PosePuppet: `not_attempted`
- Runtime notes: King Kong has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, creature_head, creature_jaw, legs
- Recommended disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Token-saving instructions

- Read first: `model-audits/king-kong/avatar-adapter-spec.json`
- Read second: `model-audits/king-kong/llm-dossier.md`
- Read only if mapping fails: `model-audits/king-kong/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for king-kong; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

King Kong should use profile `creature` with action `custom_profile`. Convert or test `king-kong-animated.zip!/source/king kong.glb` to `public/avatars/king-kong.vrm`, enable arms, creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
