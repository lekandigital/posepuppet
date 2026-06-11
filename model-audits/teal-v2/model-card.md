# Avatar audit: Teal v2

## Verdict

Label: experimental
Overall score: 53
Recommended runtime profile: humanoid-with-offsets
One-sentence recommendation: Defer until rig, naming, and skinning issues are cleaned up.

## Source files

- Selected source: `teal-v2.zip!/source/Tealv2.fbx`
- Selected format: `fbx`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 5
- Vertices: 10722
- Triangles: 17666
- Estimated height: 1.47704
- Bounding box size: [0.90467, 0.6484, 1.47704]
- Materials/textures: 6 materials, 8 images

## Rig summary

- Has armature: True
- Primary armature: Armature.006
- Bone count: 111 (111 deform, 3 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 5
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | Spine |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | Head |
| `leftShoulder` | - |
| `leftUpperArm` | Arm Cannon.L |
| `leftLowerArm` | - |
| `leftHand` | - |
| `rightShoulder` | - |
| `rightUpperArm` | Arm Cannon.R |
| `rightLowerArm` | - |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | Leg Jet.L |
| `leftFoot` | Foot.L |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | Leg Jet.R |
| `rightFoot` | Foot.R |
| `rightToes` | - |
| `leftEye` | Eye Control.L |
| `rightEye` | Eye Control.R |
| `jaw` | - |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: Foot.L
- Right foot: Foot.R
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: Head
- Jaw: -
- Eye bones: Eye Control.L, Eye Control.R
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

Teal v2 uses generic/custom naming with 111 bones, 5 meshes, 5 skinned meshes, and label experimental. Upper body is poor, legs are partial, hands are missing, fingers are missing, and face-touch is not_supported. License is unknown; verify before redistribution.
