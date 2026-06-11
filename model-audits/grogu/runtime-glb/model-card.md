# Avatar audit: Grogu

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 68
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `the_mandalorian_grogu_advanced_rig.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 8
- Vertices: 10201
- Triangles: 12310
- Estimated height: 2.83675
- Bounding box size: [1.90212, 2.0, 2.83675]
- Materials/textures: 5 materials, 3 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 141 (141 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | pelvis.L_133 |
| `spine` | spine.001_132 |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | - |
| `leftShoulder` | shoulder.L_112 |
| `leftUpperArm` | upper_arm.L_111 |
| `leftLowerArm` | forearm.L_110 |
| `leftHand` | hand.L_109 |
| `rightShoulder` | shoulder.R_127 |
| `rightUpperArm` | upper_arm.R_126 |
| `rightLowerArm` | forearm.R_125 |
| `rightHand` | hand.R_124 |
| `leftUpperLeg` | thigh.L_139 |
| `leftLowerLeg` | shin.L_138 |
| `leftFoot` | foot.L_137 |
| `leftToes` | toe.L_135 |
| `rightUpperLeg` | thigh.R_144 |
| `rightLowerLeg` | shin.R_143 |
| `rightFoot` | foot.R_142 |
| `rightToes` | toe.R_140 |
| `leftEye` | eye.L_74 |
| `rightEye` | eye.R_76 |
| `jaw` | jaw.L.001_54 |

## Hands and fingers

- Left hand: hand.L_109
- Right hand: hand.R_124
- Finger support: partial
- Left chains: {"index": ["f_index.01.L_100", "f_index.02.L_99", "f_index.03.L_98"], "middle": ["f_middle.01.L_107", "f_middle.02.L_106", "f_middle.03.L_105"], "thumb": ["thumb.01.L_103", "thumb.02.L_102", "thumb.03.L_101"]}
- Right chains: {"index": ["f_index.01.R_115", "f_index.02.R_114", "f_index.03.R_113"], "middle": ["f_middle.01.R_122", "f_middle.02.R_121", "f_middle.03.R_120"], "thumb": ["thumb.01.R_118", "thumb.02.R_117", "thumb.03.R_116"]}

## Feet and toes

- Left foot: foot.L_137
- Right foot: foot.R_142
- Left toe: toe.L_135
- Right toe: toe.R_140
- Foot support: good

## Face / expressions / face-touch

- Head: -
- Jaw: jaw.L.001_54
- Eye bones: eye.L_74, eye.R_76
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: partial
- Legs: good
- Feet: good
- Toes: good
- Hands: good
- Fingers: partial
- Facial expressions: possible

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

Grogu uses generic/custom naming with 141 bones, 8 meshes, 1 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are good, hands are good, fingers are partial, and face-touch is not_supported. License is unknown; verify before redistribution.
