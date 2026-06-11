# Avatar audit: Buzz Lightyear

## Verdict

Label: experimental
Overall score: 21
Recommended runtime profile: humanoid-with-offsets
One-sentence recommendation: Defer until rig, naming, and skinning issues are cleaned up.

## Source files

- Selected source: `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend`
- Selected format: `blend`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 1
- Vertices: 978
- Triangles: 1644
- Estimated height: 4.14879
- Bounding box size: [5.75934, 1.79495, 4.14879]
- Materials/textures: 2 materials, 4 images

## Rig summary

- Has armature: True
- Primary armature: Armature
- Bone count: 19 (19 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | - |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | - |
| `leftShoulder` | - |
| `leftUpperArm` | - |
| `leftLowerArm` | - |
| `leftHand` | - |
| `rightShoulder` | - |
| `rightUpperArm` | - |
| `rightLowerArm` | - |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | - |
| `leftFoot` | - |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | - |
| `rightFoot` | - |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: -
- Right foot: -
- Left toe: -
- Right toe: -
- Foot support: missing

## Face / expressions / face-touch

- Head: -
- Jaw: -
- Eye bones: -
- Shape keys: 0
- Expression support: missing
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: missing
- Legs: missing
- Feet: missing
- Toes: missing
- Hands: missing
- Fingers: missing
- Facial expressions: missing

## Warnings

- Feet are missing or asymmetric; disable foot orientation control.
- License unknown; do not redistribute this model or generated converted files.
- No usable hand bones detected; face-touch and hand control are not supported.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Buzz Lightyear uses generic/custom naming with 19 bones, 1 meshes, 1 skinned meshes, and label experimental. Upper body is missing, legs are missing, hands are missing, fingers are missing, and face-touch is not_supported. License is unknown; verify before redistribution.
