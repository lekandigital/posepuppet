# Avatar audit: spider-man-no-way-home candidate VRM

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `/home/o/posepuppet-working/generated-vrms/spider-man-no-way-home.vrm`
- Selected format: `vrm`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 9
- Vertices: 51472
- Triangles: 90618
- Estimated height: 7.38022
- Bounding box size: [1.90212, 101.88876, 7.38022]
- Materials/textures: 8 materials, 8 images

## Rig summary

- Has armature: True
- Primary armature: Object_8
- Bone count: 329 (329 deform, 199 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 8
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips_95_05 |
| `spine` | mixamorig:Spine_84_06 |
| `chest` | mixamorig:Spine1_83_07 |
| `upperChest` | mixamorig:Spine2_82_08 |
| `neck` | mixamorig:Neck_3_09 |
| `head` | mixamorig:Head_2_010 |
| `leftShoulder` | mixamorig:LeftShoulder_42_014 |
| `leftUpperArm` | mixamorig:LeftArm_41_015 |
| `leftLowerArm` | mixamorig:LeftForeArm_40_016 |
| `leftHand` | mixamorig:LeftHand_39_017 |
| `rightShoulder` | mixamorig:RightShoulder_81_073 |
| `rightUpperArm` | mixamorig:RightArm_80_074 |
| `rightLowerArm` | mixamorig:RightForeArm_79_075 |
| `rightHand` | mixamorig:RightHand_78_076 |
| `leftUpperLeg` | mixamorig:LeftUpLeg_89_0132 |
| `leftLowerLeg` | mixamorig:LeftLeg_88_0133 |
| `leftFoot` | mixamorig:LeftFoot_87_00 |
| `leftToes` | mixamorig:LeftToeBase_86_0134 |
| `rightUpperLeg` | mixamorig:RightUpLeg_94_0138 |
| `rightLowerLeg` | mixamorig:RightLeg_93_0139 |
| `rightFoot` | mixamorig:RightFoot_92_0140 |
| `rightToes` | mixamorig:RightToeBase_91_0141 |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand_39_017
- Right hand: mixamorig:RightHand_78_076
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot_87_00
- Right foot: mixamorig:RightFoot_92_0140
- Left toe: mixamorig:LeftToeBase_86_0134
- Right toe: mixamorig:RightToeBase_91_0141
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head_2_010
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

spider-man-no-way-home candidate VRM uses Mixamo naming with 329 bones, 9 meshes, 8 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
