# Avatar audit: Woody reference GLB

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 7
- Vertices: 71664
- Triangles: 23954
- Estimated height: 3.68981
- Bounding box size: [2.61835, 2.0, 3.68981]
- Materials/textures: 6 materials, 6 images

## Rig summary

- Has armature: True
- Primary armature: Object_4
- Bone count: 66 (66 deform, 0 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 6
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips_01 |
| `spine` | mixamorig:Spine_02 |
| `chest` | mixamorig:Spine1_03 |
| `upperChest` | mixamorig:Spine2_04 |
| `neck` | mixamorig:Neck_05 |
| `head` | mixamorig:Head_06 |
| `leftShoulder` | mixamorig:LeftShoulder_08 |
| `leftUpperArm` | mixamorig:LeftArm_09 |
| `leftLowerArm` | mixamorig:LeftForeArm_010 |
| `leftHand` | mixamorig:LeftHand_011 |
| `rightShoulder` | mixamorig:RightShoulder_032 |
| `rightUpperArm` | mixamorig:RightArm_033 |
| `rightLowerArm` | mixamorig:RightForeArm_034 |
| `rightHand` | mixamorig:RightHand_035 |
| `leftUpperLeg` | mixamorig:LeftUpLeg_00 |
| `leftLowerLeg` | mixamorig:LeftLeg_056 |
| `leftFoot` | mixamorig:LeftFoot_057 |
| `leftToes` | mixamorig:LeftToeBase_058 |
| `rightUpperLeg` | mixamorig:RightUpLeg_060 |
| `rightLowerLeg` | mixamorig:RightLeg_061 |
| `rightFoot` | mixamorig:RightFoot_062 |
| `rightToes` | mixamorig:RightToeBase_063 |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand_011
- Right hand: mixamorig:RightHand_035
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot_057
- Right foot: mixamorig:RightFoot_062
- Left toe: mixamorig:LeftToeBase_058
- Right toe: mixamorig:RightToeBase_063
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head_06
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

Woody reference GLB uses Mixamo naming with 66 bones, 7 meshes, 6 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
