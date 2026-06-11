# Avatar audit: Jack Sparrow

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend`
- Selected format: `blend`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 92
- Vertices: 157612
- Triangles: 245830
- Estimated height: 10.75485
- Bounding box size: [16.10139, 6.67036, 10.75485]
- Materials/textures: 35 materials, 20 images

## Rig summary

- Has armature: True
- Primary armature: JackSparrow Armarture
- Bone count: 112 (33 deform, 79 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 46
- Constraints: 90 total; IK: True
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips |
| `spine` | mixamorig:Spine |
| `chest` | mixamorig:Spine1 |
| `upperChest` | mixamorig:Spine2 |
| `neck` | mixamorig:Neck |
| `head` | mixamorig:Head |
| `leftShoulder` | mixamorig:LeftShoulder |
| `leftUpperArm` | mixamorig:LeftArm |
| `leftLowerArm` | mixamorig:LeftForeArm |
| `leftHand` | mixamorig:LeftHand |
| `rightShoulder` | mixamorig:RightShoulder |
| `rightUpperArm` | mixamorig:RightArm |
| `rightLowerArm` | mixamorig:RightForeArm |
| `rightHand` | mixamorig:RightHand |
| `leftUpperLeg` | mixamorig:LeftUpLeg |
| `leftLowerLeg` | mixamorig:LeftLeg |
| `leftFoot` | mixamorig:LeftFoot |
| `leftToes` | mixamorig:LeftToeBase |
| `rightUpperLeg` | mixamorig:RightUpLeg |
| `rightLowerLeg` | mixamorig:RightLeg |
| `rightFoot` | mixamorig:RightFoot |
| `rightToes` | mixamorig:RightToeBase |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand
- Right hand: mixamorig:RightHand
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot
- Right foot: mixamorig:RightFoot
- Left toe: mixamorig:LeftToeBase
- Right toe: mixamorig:RightToeBase
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head
- Jaw: -
- Eye bones: -
- Shape keys: 0
- Expression support: missing
- Face-touch feasibility: possible_with_ik

## PosePuppet support

- Upper body: good
- Legs: good
- Feet: good
- Toes: good
- Hands: good
- Fingers: missing
- Facial expressions: missing

## Warnings

- License unknown; do not redistribute this model or generated converted files.
- No finger bones detected; use palm-only hand control.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Jack Sparrow uses Mixamo naming with 112 bones, 92 meshes, 46 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
