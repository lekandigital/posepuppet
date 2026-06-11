# Baby Yoda - LLM Avatar Dossier

## Verdict

- Avatar ID: `baby-yoda`
- Recommended action: `custom_profile`
- First runtime profile: `creature`
- Implementation priority: 20
- One-line reason: Nonstandard anatomy should not be forced into standard humanoid full-body mode.

## Source selection

- Best source for audit: `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend`
- Best source for conversion: `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend`
- Runtime/reference GLB: `baby_yoda_mandalorian_-_low_poly_-_basic_rig.glb`
- Target VRM path: `public/avatars/baby-yoda.vrm`
- Do not use: baby-yoda-mandalorian-low-poly-basic-rig.zip
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `custom_profile`
- Enabled controls: creature_head
- Disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body
- Body mode: `custom`
- Root motion: `false`
- Finger mode: `none`
- Face-touch mode: `none`
- Offset profile: `none`

## Technical summary

- Source format: `blend`
- File size: 4.146 MB
- Mesh count: 13
- Skinned mesh count: 3
- Armature: `Armature`
- Bone count: 11
- Naming style: `generic/custom`
- Animation clips: 6
- Shape keys: 4
- Materials: 12
- Textures: 3

## Appearance descriptor

Baby Yoda source has a creature technical profile based on scripted rig and geometry evidence.

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

- Triangles: 37375
- Vertices: 19329
- Bounds: {'max': [40.15987, 26.40466, 32.29753], 'min': [-16.77366, -53.46748, -10.62773], 'size': [56.93352, 79.87214, 42.92526]}
- Estimated height: 42.92526
- Runtime weight: `medium`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: Bone
- Hands/fingers: `missing` / `missing`
- Feet/toes: `missing` / `missing`
- Face/expressions: `possible`
- Bone map confidence: `low`
- Suggested bone map path: `model-audits/baby-yoda/suggested-bone-map.json`

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
- Runtime notes: Baby Yoda has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: creature_head
- Recommended disabled controls: face_touch, facial_expressions, fingers, standard_humanoid_full_body

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.
- Do not force standard full-body humanoid mode; use a creature profile.

## Token-saving instructions

- Read first: `model-audits/baby-yoda/avatar-adapter-spec.json`
- Read second: `model-audits/baby-yoda/llm-dossier.md`
- Read only if mapping fails: `model-audits/baby-yoda/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for baby-yoda; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Baby Yoda should use profile `creature` with action `custom_profile`. Convert or test `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend` to `public/avatars/baby-yoda.vrm`, enable creature_head, and disable face_touch, facial_expressions, fingers, standard_humanoid_full_body until runtime tests pass.
