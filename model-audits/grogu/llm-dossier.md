# Grogu - LLM Avatar Dossier

## Verdict

- Avatar ID: `grogu`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 12
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend`
- Best source for conversion: `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend`
- Runtime/reference GLB: `the_mandalorian_grogu_advanced_rig.glb`
- Target VRM path: `public/avatars/grogu.vrm`
- Do not use: the-mandalorian-grogu-advanced-rig.zip, the_mandalorian_grogu_advanced_rig (1).glb
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
- File size: 10.252 MB
- Mesh count: 7
- Skinned mesh count: 2
- Armature: `metarig`
- Bone count: 140
- Naming style: `generic/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 4
- Textures: 4

## Appearance descriptor

Grogu source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 12230
- Vertices: 9022
- Bounds: {'max': [0.8528, 0.98642, 1.97], 'min': [-0.8528, -0.97669, -0.1461], 'size': [1.7056, 1.96311, 2.1161]}
- Estimated height: 2.1161
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: spine
- Hands/fingers: `good` / `partial`
- Feet/toes: `good` / `good`
- Face/expressions: `possible`
- Bone map confidence: `medium`
- Suggested bone map path: `model-audits/grogu/suggested-bone-map.json`

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
- Runtime notes: Grogu has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

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

- Read first: `model-audits/grogu/avatar-adapter-spec.json`
- Read second: `model-audits/grogu/llm-dossier.md`
- Read only if mapping fails: `model-audits/grogu/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for grogu; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Grogu should use profile `creature` with action `custom_profile`. Convert or test `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend` to `public/avatars/grogu.vrm`, enable arms, creature_head, creature_jaw, legs, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
