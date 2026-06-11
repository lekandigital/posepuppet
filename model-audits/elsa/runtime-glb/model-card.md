# Avatar audit: Elsa

## Verdict

Label: experimental
Overall score: 67
Recommended runtime profile: humanoid-with-offsets
One-sentence recommendation: Defer until rig, naming, and skinning issues are cleaned up.

## Source files

- Selected source: `elsa_free_fall_frozen_with_rig_included (2).glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 7
- Vertices: 5866
- Triangles: 7634
- Estimated height: 4.53608
- Bounding box size: [1.90212, 14.49414, 4.53608]
- Materials/textures: 3 materials, 4 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 125 (125 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 6
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | character:jnt_hip.001_118 |
| `spine` | - |
| `chest` | character:jnt_chest.001_117 |
| `upperChest` | - |
| `neck` | character:jnt_neck.001_106 |
| `head` | character:jnt_head.001_105 |
| `leftShoulder` | character:jnt_L_shoulder.001_77 |
| `leftUpperArm` | character:jnt_L_arm.001_74 |
| `leftLowerArm` | character:jnt_L_forearm.001_73 |
| `leftHand` | character:jnt_L_palm.001_69 |
| `rightShoulder` | character:jnt_R_shoulder.001_116 |
| `rightUpperArm` | character:jnt_R_arm.001_113 |
| `rightLowerArm` | character:jnt_R_forearm.001_112 |
| `rightHand` | character:jnt_R_palm.001_108 |
| `leftUpperLeg` | - |
| `leftLowerLeg` | - |
| `leftFoot` | - |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | - |
| `rightFoot` | - |
| `rightToes` | - |
| `leftEye` | character:jnt_L_eye.001_88 |
| `rightEye` | character:jnt_R_eye.001_100 |
| `jaw` | character:jnt_jaw.001_82 |

## Hands and fingers

- Left hand: character:jnt_L_palm.001_69
- Right hand: character:jnt_R_palm.001_108
- Finger support: poor
- Left chains: {"thumb": ["character:jnt_L_thumb.001_71", "character:jnt_L_thumb.001_end_70", "character:jnt_L_thumb_10", "character:jnt_L_thumb_end_9"]}
- Right chains: {"thumb": ["character:jnt_R_thumb.001_110", "character:jnt_R_thumb.001_end_109", "character:jnt_R_thumb_49", "character:jnt_R_thumb_end_48"]}

## Feet and toes

- Left foot: -
- Right foot: -
- Left toe: -
- Right toe: -
- Foot support: missing

## Face / expressions / face-touch

- Head: character:jnt_head.001_105
- Jaw: character:jnt_jaw.001_82
- Eye bones: character:jnt_L_eye.001_88, character:jnt_L_eye.001_end_87, character:jnt_L_eyeLid.001_90, character:jnt_L_eyeLid.001_end_89, character:jnt_L_eyeLid_29, character:jnt_L_eyeLid_end_28, character:jnt_L_eye_27, character:jnt_L_eye_end_26, character:jnt_R_eye.001_100, character:jnt_R_eye.001_end_99, character:jnt_R_eyeLid.001_102, character:jnt_R_eyeLid.001_end_101, character:jnt_R_eyeLid_41, character:jnt_R_eyeLid_end_40, character:jnt_R_eye_39, character:jnt_R_eye_end_38
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: possible_with_ik

## PosePuppet support

- Upper body: good
- Legs: missing
- Feet: missing
- Toes: missing
- Hands: good
- Fingers: poor
- Facial expressions: possible

## Warnings

- Feet are missing or asymmetric; disable foot orientation control.
- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.
- character:jnt_L_palm.001_69 mapped as hand candidate from wrist/palm
- character:jnt_R_palm.001_108 mapped as hand candidate from wrist/palm

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Elsa uses generic/custom naming with 125 bones, 7 meshes, 6 skinned meshes, and label experimental. Upper body is good, legs are missing, hands are good, fingers are poor, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
