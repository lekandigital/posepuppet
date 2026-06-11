# Avatar audit: Shrek

## Verdict

Label: well-developed
Overall score: 86
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `shrek_rig.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 7
- Vertices: 5470
- Triangles: 8582
- Estimated height: 84.51563
- Bounding box size: [103.52459, 35.00001, 84.51563]
- Materials/textures: 6 materials, 4 images

## Rig summary

- Has armature: True
- Primary armature: Object_15
- Bone count: 130 (130 deform, 0 control/non-deform)
- Naming style guess: ValveBiped / Source
- Skinned meshes: 6
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | ValveBiped.Bip01_Pelvis_02 |
| `spine` | ValveBiped.Bip01_Spine_03 |
| `chest` | ValveBiped.Bip01_Spine1_04 |
| `upperChest` | ValveBiped.Bip01_Spine2_05 |
| `neck` | - |
| `head` | ValveBiped.Bip01_Head1_08 |
| `leftShoulder` | ValveBiped.Bip01_L_Clavicle_064 |
| `leftUpperArm` | ValveBiped.Bip01_L_UpperArm_065 |
| `leftLowerArm` | ValveBiped.Bip01_L_Forearm_066 |
| `leftHand` | ValveBiped.Bip01_L_Hand_067 |
| `rightShoulder` | ValveBiped.Bip01_R_Clavicle_044 |
| `rightUpperArm` | ValveBiped.Bip01_R_UpperArm_045 |
| `rightLowerArm` | ValveBiped.Bip01_R_Forearm_046 |
| `rightHand` | ValveBiped.Bip01_R_Hand_047 |
| `leftUpperLeg` | ValveBiped.Bip01_L_Thigh_088 |
| `leftLowerLeg` | ValveBiped.Bip01_L_Calf_089 |
| `leftFoot` | ValveBiped.Bip01_L_Foot_090 |
| `leftToes` | - |
| `rightUpperLeg` | ValveBiped.Bip01_R_Thigh_084 |
| `rightLowerLeg` | ValveBiped.Bip01_R_Calf_085 |
| `rightFoot` | ValveBiped.Bip01_R_Foot_086 |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | Jaw_Bone_09 |

## Hands and fingers

- Left hand: ValveBiped.Bip01_L_Hand_067
- Right hand: ValveBiped.Bip01_R_Hand_047
- Finger support: poor
- Left chains: {"index": ["ValveBiped.Bip01_L_Finger1_077"], "middle": ["ValveBiped.Bip01_L_Finger2_074"], "pinky": ["ValveBiped.Bip01_L_Finger4_068"], "ring": ["ValveBiped.Bip01_L_Finger3_071"], "thumb": ["ValveBiped.Bip01_L_Finger0_080"]}
- Right chains: {"index": ["ValveBiped.Bip01_R_Finger1_057"], "middle": ["ValveBiped.Bip01_R_Finger2_054"], "pinky": ["ValveBiped.Bip01_R_Finger4_048"], "ring": ["ValveBiped.Bip01_R_Finger3_051"], "thumb": ["ValveBiped.Bip01_R_Finger0_060"]}

## Feet and toes

- Left foot: ValveBiped.Bip01_L_Foot_090
- Right foot: ValveBiped.Bip01_R_Foot_086
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: ValveBiped.Bip01_Head1_08
- Jaw: Jaw_Bone_09
- Eye bones: -
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: limited

## PosePuppet support

- Upper body: good
- Legs: good
- Feet: good
- Toes: missing
- Hands: good
- Fingers: poor
- Facial expressions: possible

## Warnings

- Feet exist but toes are missing; disable toe articulation.
- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Shrek uses ValveBiped / Source naming with 130 bones, 7 meshes, 6 skinned meshes, and label well-developed. Upper body is good, legs are good, hands are good, fingers are poor, and face-touch is limited. License is unknown; verify before redistribution.
