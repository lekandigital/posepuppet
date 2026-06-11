# Avatar audit: Godzilla

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 59
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend`
- Selected format: `blend`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 1
- Vertices: 32011
- Triangles: 46898
- Estimated height: 2.1905
- Bounding box size: [1.77726, 3.27961, 2.1905]
- Materials/textures: 1 materials, 43 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 130 (130 deform, 1 control/non-deform)
- Naming style guess: control-rig/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | spineJA_JNT_125 |
| `chest` | - |
| `upperChest` | - |
| `neck` | neckJA_JNT_6 |
| `head` | headJA_JNT_4 |
| `leftShoulder` | l_clavicleJA_JNT_27 |
| `leftUpperArm` | l_armJA_JNT_26 |
| `leftLowerArm` | - |
| `leftHand` | l_handJA_JNT_22 |
| `rightShoulder` | r_clavicleJA_JNT_48 |
| `rightUpperArm` | r_armJA_JNT_47 |
| `rightLowerArm` | - |
| `rightHand` | r_handJA_JNT_43 |
| `leftUpperLeg` | - |
| `leftLowerLeg` | l_legJA_JNT_107 |
| `leftFoot` | l_footJA_JNT_105 |
| `leftToes` | l_toesJA_JNT_104 |
| `rightUpperLeg` | - |
| `rightLowerLeg` | r_legJA_JNT_123 |
| `rightFoot` | r_footJA_JNT_121 |
| `rightToes` | r_toesJA_JNT_120 |
| `leftEye` | l_eyeJA_JNT_2 |
| `rightEye` | r_eyeJA_JNT_3 |
| `jaw` | jawJA_JNT_1 |

## Hands and fingers

- Left hand: l_handJA_JNT_22
- Right hand: r_handJA_JNT_43
- Finger support: poor
- Left chains: {"thumb": ["l_fngThumbJA_JNT_10", "l_fngThumbJB_JNT_9", "l_fngThumbJC_JNT_8", "l_toeThumbJA_JNT_94", "l_toeThumbJB_JNT_93", "l_toeThumbJC_JNT_92"]}
- Right chains: {"thumb": ["r_fngThumbJA_JNT_31", "r_fngThumbJB_JNT_30", "r_fngThumbJC_JNT_29", "r_toeThumbJA_JNT_110", "r_toeThumbJB_JNT_109", "r_toeThumbJC_JNT_108"]}

## Feet and toes

- Left foot: l_footJA_JNT_105
- Right foot: r_footJA_JNT_121
- Left toe: l_toesJA_JNT_104
- Right toe: r_toesJA_JNT_120
- Foot support: good

## Face / expressions / face-touch

- Head: headJA_JNT_4
- Jaw: jawJA_JNT_1
- Eye bones: l_eyeJA_JNT_2, r_eyeJA_JNT_3
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

Godzilla uses control-rig/custom naming with 130 bones, 1 meshes, 1 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are good, fingers are poor, and face-touch is limited. License is unknown; verify before redistribution.
