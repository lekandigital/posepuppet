# Avatar audit: Godzilla

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 59
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `godzilla_rigged_animated.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 2
- Vertices: 32053
- Triangles: 46978
- Estimated height: 37.55186
- Bounding box size: [23.50712, 61.11614, 37.55186]
- Materials/textures: 1 materials, 3 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 131 (131 deform, 1 control/non-deform)
- Naming style guess: control-rig/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | spineJA_JNT_125_126 |
| `chest` | - |
| `upperChest` | - |
| `neck` | neckJA_JNT_6_7 |
| `head` | headJA_JNT_4_5 |
| `leftShoulder` | l_clavicleJA_JNT_27_28 |
| `leftUpperArm` | l_armJA_JNT_26_27 |
| `leftLowerArm` | - |
| `leftHand` | l_handJA_JNT_22_23 |
| `rightShoulder` | r_clavicleJA_JNT_48_49 |
| `rightUpperArm` | r_armJA_JNT_47_48 |
| `rightLowerArm` | - |
| `rightHand` | r_handJA_JNT_43_44 |
| `leftUpperLeg` | - |
| `leftLowerLeg` | l_legJA_JNT_107_108 |
| `leftFoot` | l_footJA_JNT_105_106 |
| `leftToes` | l_toesJA_JNT_104_105 |
| `rightUpperLeg` | - |
| `rightLowerLeg` | r_legJA_JNT_123_124 |
| `rightFoot` | r_footJA_JNT_121_122 |
| `rightToes` | r_toesJA_JNT_120_121 |
| `leftEye` | l_eyeJA_JNT_2_3 |
| `rightEye` | r_eyeJA_JNT_3_4 |
| `jaw` | jawJA_JNT_1_2 |

## Hands and fingers

- Left hand: l_handJA_JNT_22_23
- Right hand: r_handJA_JNT_43_44
- Finger support: poor
- Left chains: {"thumb": ["l_fngThumbJA_JNT_10_11", "l_fngThumbJB_JNT_9_10", "l_fngThumbJC_JNT_8_9", "l_toeThumbJA_JNT_94_95", "l_toeThumbJB_JNT_93_94", "l_toeThumbJC_JNT_92_93"]}
- Right chains: {"thumb": ["r_fngThumbJA_JNT_31_32", "r_fngThumbJB_JNT_30_31", "r_fngThumbJC_JNT_29_30", "r_toeThumbJA_JNT_110_111", "r_toeThumbJB_JNT_109_110", "r_toeThumbJC_JNT_108_109"]}

## Feet and toes

- Left foot: l_footJA_JNT_105_106
- Right foot: r_footJA_JNT_121_122
- Left toe: l_toesJA_JNT_104_105
- Right toe: r_toesJA_JNT_120_121
- Foot support: good

## Face / expressions / face-touch

- Head: headJA_JNT_4_5
- Jaw: jawJA_JNT_1_2
- Eye bones: l_eyeJA_JNT_2_3, r_eyeJA_JNT_3_4
- Shape keys: 0
- Expression support: missing
- Face-touch feasibility: limited

## PosePuppet support

- Upper body: partial
- Legs: partial
- Feet: good
- Toes: good
- Hands: good
- Fingers: poor
- Facial expressions: missing

## Warnings

- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- License unknown; do not redistribute this model or generated converted files.
- Model appears to be creature/non-human anatomy; do not force standard humanoid retargeting.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.

## Recommended PosePuppet changes

- Create a custom creature runtime profile with anatomy-specific offsets and enabled joints.

## What to tell another LLM

Godzilla uses control-rig/custom naming with 131 bones, 2 meshes, 1 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are good, fingers are poor, and face-touch is limited. License is unknown; verify before redistribution.
