# Avatar audit: Jack Sparrow

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `jack_sparrow_ready_for_animation.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 93
- Vertices: 173731
- Triangles: 245910
- Estimated height: 11.72325
- Bounding box size: [16.10139, 6.67037, 11.72325]
- Materials/textures: 36 materials, 18 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 113 (113 deform, 67 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 46
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips_39 |
| `spine` | mixamorig:Spine_28 |
| `chest` | mixamorig:Spine1_27 |
| `upperChest` | mixamorig:Spine2_26 |
| `neck` | mixamorig:Neck_3 |
| `head` | mixamorig:Head_2 |
| `leftShoulder` | mixamorig:LeftShoulder_14 |
| `leftUpperArm` | mixamorig:LeftArm_13 |
| `leftLowerArm` | mixamorig:LeftForeArm_12 |
| `leftHand` | mixamorig:LeftHand_11 |
| `rightShoulder` | mixamorig:RightShoulder_25 |
| `rightUpperArm` | mixamorig:RightArm_24 |
| `rightLowerArm` | mixamorig:RightForeArm_23 |
| `rightHand` | mixamorig:RightHand_22 |
| `leftUpperLeg` | mixamorig:LeftUpLeg_33 |
| `leftLowerLeg` | mixamorig:LeftLeg_32 |
| `leftFoot` | mixamorig:LeftFoot_31 |
| `leftToes` | mixamorig:LeftToeBase_30 |
| `rightUpperLeg` | mixamorig:RightUpLeg_38 |
| `rightLowerLeg` | mixamorig:RightLeg_37 |
| `rightFoot` | mixamorig:RightFoot_36 |
| `rightToes` | mixamorig:RightToeBase_35 |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand_11
- Right hand: mixamorig:RightHand_22
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot_31
- Right foot: mixamorig:RightFoot_36
- Left toe: mixamorig:LeftToeBase_30
- Right toe: mixamorig:RightToeBase_35
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head_2
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

Jack Sparrow uses Mixamo naming with 113 bones, 93 meshes, 46 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
