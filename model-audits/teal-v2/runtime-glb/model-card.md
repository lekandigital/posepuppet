# Avatar audit: Teal v2

## Verdict

Label: experimental
Overall score: 53
Recommended runtime profile: humanoid-with-offsets
One-sentence recommendation: Defer until rig, naming, and skinning issues are cleaned up.

## Source files

- Selected source: `teal_v.2.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 6
- Vertices: 19216
- Triangles: 17742
- Estimated height: 2.41725
- Bounding box size: [1.90212, 2.0, 2.41725]
- Materials/textures: 5 materials, 8 images

## Rig summary

- Has armature: True
- Primary armature: Object_5
- Bone count: 112 (112 deform, 3 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 5
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | Spine.001_03 |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | Head Piston.L.001_041 |
| `leftShoulder` | - |
| `leftUpperArm` | Arm Cannon.L.001_047 |
| `leftLowerArm` | - |
| `leftHand` | - |
| `rightShoulder` | - |
| `rightUpperArm` | Arm Cannon.R.001_073 |
| `rightLowerArm` | - |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | Leg Jet.L.001_0101 |
| `leftFoot` | Foot.L.001_0100 |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | Leg Jet.R.001_0109 |
| `rightFoot` | Foot.R.001_0108 |
| `rightToes` | - |
| `leftEye` | Eye Control.L_010 |
| `rightEye` | Eye Control.R_019 |
| `jaw` | - |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: Foot.L.001_0100
- Right foot: Foot.R.001_0108
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: Head Piston.L.001_041
- Jaw: -
- Eye bones: Eye Control.L_010, Eye Control.R_019
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: poor
- Legs: partial
- Feet: good
- Toes: missing
- Hands: missing
- Fingers: missing
- Facial expressions: possible

## Warnings

- Feet exist but toes are missing; disable toe articulation.
- License unknown; do not redistribute this model or generated converted files.
- No usable hand bones detected; face-touch and hand control are not supported.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Teal v2 uses generic/custom naming with 112 bones, 6 meshes, 5 skinned meshes, and label experimental. Upper body is poor, legs are partial, hands are missing, fingers are missing, and face-touch is not_supported. License is unknown; verify before redistribution.
