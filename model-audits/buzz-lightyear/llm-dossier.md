# Buzz Lightyear - LLM Avatar Dossier

## Verdict

- Avatar ID: `buzz-lightyear`
- Recommended action: `cleanup_then_convert`
- First runtime profile: `humanoid_with_offsets`
- Implementation priority: 19
- One-line reason: Automatic mapping is too weak; inspect hierarchy and create a manual map first.

## Source selection

- Best source for audit: `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend`
- Best source for conversion: `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend`
- Runtime/reference GLB: `adi_2.0_buzz_lightyear_fully_rigged.glb`
- Target VRM path: `public/avatars/buzz-lightyear.vrm`
- Do not use: adi-20-buzz-lightyear-fully-rigged.zip
- Reasoning: Selected by source-priority audit discovery: prefer editable .blend, then .fbx, then source/runtime .glb.

## Avatar adapter spec summary

- Implementation status: `cleanup_then_convert`
- Enabled controls: arms, hands, head, upper_body
- Disabled controls: face_touch, facial_expressions, feet, fingers, toes
- Body mode: `upper`
- Root motion: `false`
- Finger mode: `none`
- Face-touch mode: `none`
- Offset profile: `buzz-lightyear-offsets`

## Technical summary

- Source format: `blend`
- File size: 0.758 MB
- Mesh count: 1
- Skinned mesh count: 1
- Armature: `Armature`
- Bone count: 19
- Naming style: `generic/custom`
- Animation clips: 0
- Shape keys: 0
- Materials: 2
- Textures: 4

## Appearance descriptor

Low-poly toy/space-suit humanoid source with generic Bone.* naming that defeats automatic humanoid mapping.

- Measured evidence used: scripted Blender audit, file/mesh/material/texture names, bounds, bone mapping
- Inferred visual/semantic understanding: Broad toy proportions; hierarchy inspection is needed before discarding.
- Optional visual observation: not available
- Confidence: `medium`
- Runtime implication: manual bone mapping, unknown hands/feet, source hierarchy

## Visual reasoning review

- Status: `not_available`
- Summary: No standardized contact-sheet or vision review was completed in this run; appearance notes are inferred from scripted facts and filenames.
- Confidence: `low`
- Uncertainties: No rendered contact sheets were inspected., Use prompt: Review neutral, side, skeleton, hand-to-face, knee, foot, and finger panels; summarize only implementation-relevant deformation risks.

## Geometry and performance

- Triangles: 1644
- Vertices: 978
- Bounds: {'max': [2.87977, 1.1863, 4.18656], 'min': [-2.87956, -0.60865, 0.03778], 'size': [5.75934, 1.79495, 4.14879]}
- Estimated height: 4.14879
- Runtime weight: `light`
- Desktop safe: `true`
- Mobile safe: `true`

## Rig and humanoid mapping

- Root: Bone.002
- Hands/fingers: `missing` / `missing`
- Feet/toes: `missing` / `missing`
- Face/expressions: `missing`
- Bone map confidence: `low`
- Suggested bone map path: `model-audits/buzz-lightyear/suggested-bone-map.json`

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
- Runtime notes: Buzz Lightyear has no PosePuppet runtime load test in this audit., Do not add to public UI until VRM load/orientation/tracking tests pass.

## Retargeting risk

- Overall risk: `high`
- Recommended enabled controls: arms, hands, head, upper_body
- Recommended disabled controls: face_touch, facial_expressions, feet, fingers, toes

## Do not implement

- Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.
- Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.
- Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.
- Do not enable fingers; use palm-only or curl presets.
- Do not enable facial expressions for this model yet.
- Do not enable feet for this model yet.

## Token-saving instructions

- Read first: `model-audits/buzz-lightyear/avatar-adapter-spec.json`
- Read second: `model-audits/buzz-lightyear/llm-dossier.md`
- Read only if mapping fails: `model-audits/buzz-lightyear/bone-tree.txt`
- One-sentence summary: Start with the adapter spec for buzz-lightyear; only open large assets when conversion or mapping breaks.

## One-paragraph implementation summary

Buzz Lightyear should use profile `humanoid_with_offsets` with action `cleanup_then_convert`. Convert or test `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` to `public/avatars/buzz-lightyear.vrm`, enable arms, hands, head, upper_body, and disable face_touch, facial_expressions, feet, fingers, toes until runtime tests pass.
