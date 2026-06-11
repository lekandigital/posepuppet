# Avatar audit: Shrek

## Verdict

Label: well-developed
Overall score: 86
Recommended runtime profile: humanoid
One-sentence recommendation: Try this after confirming license and checking proportions in Blender.

## Source files

- Selected source: `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx`
- Selected format: `fbx`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 2
- Vertices: 4526
- Triangles: 8502
- Estimated height: 83.51362
- Bounding box size: [103.52449, 35.01503, 83.51362]
- Materials/textures: 6 materials, 9 images

## Rig summary

- Has armature: True
- Primary armature: shrek_forever_face.qc_skeleton
- Bone count: 129 (129 deform, 0 control/non-deform)
- Naming style guess: ValveBiped / Source
- Skinned meshes: 2
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | ValveBiped.Bip01_Pelvis |
| `spine` | ValveBiped.Bip01_Spine |
| `chest` | ValveBiped.Bip01_Spine1 |
| `upperChest` | ValveBiped.Bip01_Spine2 |
| `neck` | - |
| `head` | ValveBiped.Bip01_Head1 |
| `leftShoulder` | ValveBiped.Bip01_L_Clavicle |
| `leftUpperArm` | ValveBiped.Bip01_L_UpperArm |
| `leftLowerArm` | ValveBiped.Bip01_L_Forearm |
| `leftHand` | ValveBiped.Bip01_L_Hand |
| `rightShoulder` | ValveBiped.Bip01_R_Clavicle |
| `rightUpperArm` | ValveBiped.Bip01_R_UpperArm |
| `rightLowerArm` | ValveBiped.Bip01_R_Forearm |
| `rightHand` | ValveBiped.Bip01_R_Hand |
| `leftUpperLeg` | ValveBiped.Bip01_L_Thigh |
| `leftLowerLeg` | ValveBiped.Bip01_L_Calf |
| `leftFoot` | ValveBiped.Bip01_L_Foot |
| `leftToes` | - |
| `rightUpperLeg` | ValveBiped.Bip01_R_Thigh |
| `rightLowerLeg` | ValveBiped.Bip01_R_Calf |
| `rightFoot` | ValveBiped.Bip01_R_Foot |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | Jaw_Bone |

## Hands and fingers

- Left hand: ValveBiped.Bip01_L_Hand
- Right hand: ValveBiped.Bip01_R_Hand
- Finger support: poor
- Left chains: {"index": ["ValveBiped.Bip01_L_Finger1"], "middle": ["ValveBiped.Bip01_L_Finger2"], "pinky": ["ValveBiped.Bip01_L_Finger4"], "ring": ["ValveBiped.Bip01_L_Finger3"], "thumb": ["ValveBiped.Bip01_L_Finger0"]}
- Right chains: {"index": ["ValveBiped.Bip01_R_Finger1"], "middle": ["ValveBiped.Bip01_R_Finger2"], "pinky": ["ValveBiped.Bip01_R_Finger4"], "ring": ["ValveBiped.Bip01_R_Finger3"], "thumb": ["ValveBiped.Bip01_R_Finger0"]}

## Feet and toes

- Left foot: ValveBiped.Bip01_L_Foot
- Right foot: ValveBiped.Bip01_R_Foot
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: ValveBiped.Bip01_Head1
- Jaw: Jaw_Bone
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
- Ignored Blender FBX importer light cast_shadow compatibility error.
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Shrek uses ValveBiped / Source naming with 129 bones, 2 meshes, 2 skinned meshes, and label well-developed. Upper body is good, legs are good, hands are good, fingers are poor, and face-touch is limited. License is unknown; verify before redistribution.
