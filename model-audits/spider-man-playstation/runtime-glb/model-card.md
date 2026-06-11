# Avatar audit: Spider-Man PlayStation

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `spider_man_playstation_rigged.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 21
- Vertices: 105025
- Triangles: 149218
- Estimated height: 3.86736
- Bounding box size: [1.90212, 2.0, 3.86736]
- Materials/textures: 20 materials, 7 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 66 (66 deform, 0 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 20
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips_64 |
| `spine` | mixamorig:Spine_53 |
| `chest` | mixamorig:Spine1_52 |
| `upperChest` | mixamorig:Spine2_51 |
| `neck` | mixamorig:Neck_2 |
| `head` | mixamorig:Head_1 |
| `leftShoulder` | mixamorig:LeftShoulder_26 |
| `leftUpperArm` | mixamorig:LeftArm_25 |
| `leftLowerArm` | mixamorig:LeftForeArm_24 |
| `leftHand` | mixamorig:LeftHand_23 |
| `rightShoulder` | mixamorig:RightShoulder_50 |
| `rightUpperArm` | mixamorig:RightArm_49 |
| `rightLowerArm` | mixamorig:RightForeArm_48 |
| `rightHand` | mixamorig:RightHand_47 |
| `leftUpperLeg` | mixamorig:LeftUpLeg_58 |
| `leftLowerLeg` | mixamorig:LeftLeg_57 |
| `leftFoot` | mixamorig:LeftFoot_56 |
| `leftToes` | mixamorig:LeftToeBase_55 |
| `rightUpperLeg` | mixamorig:RightUpLeg_63 |
| `rightLowerLeg` | mixamorig:RightLeg_62 |
| `rightFoot` | mixamorig:RightFoot_61 |
| `rightToes` | mixamorig:RightToeBase_60 |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand_23
- Right hand: mixamorig:RightHand_47
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot_56
- Right foot: mixamorig:RightFoot_61
- Left toe: mixamorig:LeftToeBase_55
- Right toe: mixamorig:RightToeBase_60
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head_1
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

Spider-Man PlayStation uses Mixamo naming with 66 bones, 21 meshes, 20 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
