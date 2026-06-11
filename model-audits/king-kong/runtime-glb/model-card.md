# Avatar audit: King Kong

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 68
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `king_kong_animated.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 10
- Vertices: 152952
- Triangles: 179501
- Estimated height: 2.54812
- Bounding box size: [2.24533, 2.0, 2.54812]
- Materials/textures: 3 materials, 2 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 87 (87 deform, 0 control/non-deform)
- Naming style guess: bip-style
- Skinned meshes: 9
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | bip_hip_l_12 |
| `spine` | bip_spine_0_84 |
| `chest` | - |
| `upperChest` | - |
| `neck` | bip_neck_65 |
| `head` | bip_head_64 |
| `leftShoulder` | - |
| `leftUpperArm` | bip_upperarm_l_38 |
| `leftLowerArm` | bip_lowerarm_l_37 |
| `leftHand` | bip_hand_l_36 |
| `rightShoulder` | - |
| `rightUpperArm` | bip_upperarm_r_78 |
| `rightLowerArm` | bip_lowerarm_r_77 |
| `rightHand` | bip_hand_r_76 |
| `leftUpperLeg` | - |
| `leftLowerLeg` | bip_knee_l_11 |
| `leftFoot` | bip_foot_l_10 |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | bip_knee_r_24 |
| `rightFoot` | bip_foot_r_23 |
| `rightToes` | - |
| `leftEye` | bip_eye_l_49 |
| `rightEye` | bip_eye_r_63 |
| `jaw` | bip_jaw_48 |

## Hands and fingers

- Left hand: bip_hand_l_36
- Right hand: bip_hand_r_76
- Finger support: partial
- Left chains: {"index": ["bip_index_0_l_27", "bip_index_1_l_26"], "middle": ["bip_middle_0_l_29", "bip_middle_1_l_28"], "pinky": ["bip_pinky_0_l_33", "bip_pinky_1_l_32"], "ring": ["bip_ring_0_l_31", "bip_ring_1_l_30"], "thumb": ["bip_thumb_0_l_35", "bip_thumb_1_l_34"]}
- Right chains: {"index": ["bip_index_0_r_67", "bip_index_1_r_66"], "middle": ["bip_middle_0_r_69", "bip_middle_1_r_68"], "pinky": ["bip_pinky_0_r_73", "bip_pinky_1_r_72"], "ring": ["bip_ring_0_r_71", "bip_ring_1_r_70"], "thumb": ["bip_thumb_0_r_75", "bip_thumb_1_r_74"]}

## Feet and toes

- Left foot: bip_foot_l_10
- Right foot: bip_foot_r_23
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: bip_head_64
- Jaw: bip_jaw_48
- Eye bones: bip_eye_l_49, bip_eye_r_63
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: limited

## PosePuppet support

- Upper body: good
- Legs: partial
- Feet: good
- Toes: missing
- Hands: good
- Fingers: partial
- Facial expressions: possible

## Warnings

- Feet exist but toes are missing; disable toe articulation.
- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- License unknown; do not redistribute this model or generated converted files.
- Model appears to be creature/non-human anatomy; do not force standard humanoid retargeting.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.

## Recommended PosePuppet changes

- Create a custom creature runtime profile with anatomy-specific offsets and enabled joints.

## What to tell another LLM

King Kong uses bip-style naming with 87 bones, 10 meshes, 9 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is good, legs are partial, hands are good, fingers are partial, and face-touch is limited. License is unknown; verify before redistribution.
