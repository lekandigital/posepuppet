# Olaf - LLM Avatar Dossier

## Verdict

- Avatar ID: `olaf`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 14
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `olaf-3d-rigged.zip!/source/OlafRig.blend`
- Best source for conversion: `olaf-3d-rigged.zip!/source/OlafRig.blend`
- Runtime/reference GLB: `olaf_3d_rigged.glb`
- Target VRM path: `public/avatars/olaf.vrm`
- Do not use: olaf-3d-rigged.zip, olaf_3d_rigged (1).glb
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `custom_profile`
- Enabled controls: arms, creature_head, legs
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Body mode: `custom`
- Root motion: `false`
- Finger mode: `curl_presets`
- Face-touch mode: `none`
- Offset profile: `none`

## Technical summary

- Source format: `blend`
- File size: 10.887 MB
- Mesh count: 28
- Skinned mesh count: 18
- Armature: `OlafRig`
- Bone count: 100
- Naming style: `generic/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 3
- Textures: 5

## Appearance descriptor

Olaf source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 22191
- Vertices: 11361
- Bounds: {'max': [1.54502, 1.13372, 6.11848], 'min': [-5.15386, -1.23332, -0.01799], 'size': [6.69889, 2.36704, 6.13647]}
- Estimated height: 6.13647
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: RootBone
- Hands/fingers: `good` / `partial`
- Feet/toes: `good` / `missing`
- Face/expressions: `missing`
- Bone map confidence: `medium`
- Suggested bone map path: `model-audits/olaf/suggested-bone-map.json`

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
- Runtime notes: Olaf has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, creature_head, legs
- Recommended disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable facial expressions for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Token-saving instructions

- Read first: `model-audits/olaf/avatar-adapter-spec.json`
- Read second: `model-audits/olaf/llm-dossier.md`
- Read only if mapping fails: `model-audits/olaf/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for olaf; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Olaf should use profile `creature` with action `custom_profile`. Convert or test `olaf-3d-rigged.zip!/source/OlafRig.blend` to `public/avatars/olaf.vrm`, enable arms, creature_head, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
