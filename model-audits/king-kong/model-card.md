# Avatar audit: King Kong

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 68
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `king-kong-animated.zip!/source/king kong.glb`
- Selected format: `glb`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 8
- Vertices: 152952
- Triangles: 179501
- Estimated height: 4873.72666
- Bounding box size: [7044.45581, 3402.59265, 4873.72666]
- Materials/textures: 3 materials, 0 images

## Rig summary

- Has armature: True
- Primary armature: king_kong.qc_skeleton
- Bone count: 86 (86 deform, 0 control/non-deform)
- Naming style guess: bip-style
- Skinned meshes: 7
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | bip_hip_l |
| `spine` | bip_spine_0 |
| `chest` | - |
| `upperChest` | - |
| `neck` | bip_neck |
| `head` | bip_head |
| `leftShoulder` | - |
| `leftUpperArm` | bip_upperarm_l |
| `leftLowerArm` | bip_lowerarm_l |
| `leftHand` | bip_hand_l |
| `rightShoulder` | - |
| `rightUpperArm` | bip_upperarm_r |
| `rightLowerArm` | bip_lowerarm_r |
| `rightHand` | bip_hand_r |
| `leftUpperLeg` | - |
| `leftLowerLeg` | bip_knee_l |
| `leftFoot` | bip_foot_l |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | bip_knee_r |
| `rightFoot` | bip_foot_r |
| `rightToes` | - |
| `leftEye` | bip_eye_l |
| `rightEye` | bip_eye_r |
| `jaw` | bip_jaw |

## Hands and fingers

- Left hand: bip_hand_l
- Right hand: bip_hand_r
- Finger support: partial
- Left chains: {"index": ["bip_index_0_l", "bip_index_1_l"], "middle": ["bip_middle_0_l", "bip_middle_1_l"], "pinky": ["bip_pinky_0_l", "bip_pinky_1_l"], "ring": ["bip_ring_0_l", "bip_ring_1_l"], "thumb": ["bip_thumb_0_l", "bip_thumb_1_l"]}
- Right chains: {"index": ["bip_index_0_r", "bip_index_1_r"], "middle": ["bip_middle_0_r", "bip_middle_1_r"], "pinky": ["bip_pinky_0_r", "bip_pinky_1_r"], "ring": ["bip_ring_0_r", "bip_ring_1_r"], "thumb": ["bip_thumb_0_r", "bip_thumb_1_r"]}

## Feet and toes

- Left foot: bip_foot_l
- Right foot: bip_foot_r
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: bip_head
- Jaw: bip_jaw
- Eye bones: bip_eye_l, bip_eye_r
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

King Kong uses bip-style naming with 86 bones, 8 meshes, 7 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is good, legs are partial, hands are good, fingers are partial, and face-touch is limited. License is unknown; verify before redistribution.
