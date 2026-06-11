# Avatar audit: Terminator T-800

## Verdict

Label: partial
Overall score: 81
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `terminator-t-800-endo-skeleton-damaged.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 16
- Vertices: 12600
- Triangles: 8320
- Estimated height: 4.06605
- Bounding box size: [1.90212, 2.01762, 4.06605]
- Materials/textures: 11 materials, 23 images

## Rig summary

- Has armature: True
- Primary armature: Armature
- Bone count: 66 (66 deform, 0 control/non-deform)
- Naming style guess: Mixamo
- Skinned meshes: 15
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | mixamorig:Hips_Armature |
| `spine` | mixamorig:Spine_Armature |
| `chest` | mixamorig:Spine1_Armature |
| `upperChest` | mixamorig:Spine2_Armature |
| `neck` | mixamorig:Neck_Armature |
| `head` | mixamorig:Head_Armature |
| `leftShoulder` | mixamorig:LeftShoulder_Armature |
| `leftUpperArm` | mixamorig:LeftArm_Armature |
| `leftLowerArm` | mixamorig:LeftForeArm_Armature |
| `leftHand` | mixamorig:LeftHand_Armature |
| `rightShoulder` | mixamorig:RightShoulder_Armature |
| `rightUpperArm` | mixamorig:RightArm_Armature |
| `rightLowerArm` | mixamorig:RightForeArm_Armature |
| `rightHand` | mixamorig:RightHand_Armature |
| `leftUpperLeg` | mixamorig:LeftUpLeg_Armature |
| `leftLowerLeg` | mixamorig:LeftLeg_Armature |
| `leftFoot` | mixamorig:LeftFoot_Armature |
| `leftToes` | mixamorig:LeftToeBase_Armature |
| `rightUpperLeg` | mixamorig:RightUpLeg_Armature |
| `rightLowerLeg` | mixamorig:RightLeg_Armature |
| `rightFoot` | mixamorig:RightFoot_Armature |
| `rightToes` | mixamorig:RightToeBase_Armature |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: mixamorig:LeftHand_Armature
- Right hand: mixamorig:RightHand_Armature
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: mixamorig:LeftFoot_Armature
- Right foot: mixamorig:RightFoot_Armature
- Left toe: mixamorig:LeftToeBase_Armature
- Right toe: mixamorig:RightToeBase_Armature
- Foot support: good

## Face / expressions / face-touch

- Head: mixamorig:Head_Armature
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

Terminator T-800 uses Mixamo naming with 66 bones, 16 meshes, 15 skinned meshes, and label partial. Upper body is good, legs are good, hands are good, fingers are missing, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
