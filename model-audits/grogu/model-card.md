# Avatar audit: Grogu

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 68
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend`
- Selected format: `blend`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 7
- Vertices: 9022
- Triangles: 12230
- Estimated height: 2.1161
- Bounding box size: [1.7056, 1.96311, 2.1161]
- Materials/textures: 4 materials, 4 images

## Rig summary

- Has armature: True
- Primary armature: metarig
- Bone count: 140 (140 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 2
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | pelvis.L |
| `spine` | spine |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | - |
| `leftShoulder` | shoulder.L |
| `leftUpperArm` | upper_arm.L |
| `leftLowerArm` | forearm.L |
| `leftHand` | hand.L |
| `rightShoulder` | shoulder.R |
| `rightUpperArm` | upper_arm.R |
| `rightLowerArm` | forearm.R |
| `rightHand` | hand.R |
| `leftUpperLeg` | thigh.L |
| `leftLowerLeg` | shin.L |
| `leftFoot` | foot.L |
| `leftToes` | toe.L |
| `rightUpperLeg` | thigh.R |
| `rightLowerLeg` | shin.R |
| `rightFoot` | foot.R |
| `rightToes` | toe.R |
| `leftEye` | eye.L |
| `rightEye` | eye.R |
| `jaw` | jaw.L |

## Hands and fingers

- Left hand: hand.L
- Right hand: hand.R
- Finger support: partial
- Left chains: {"index": ["f_index.01.L", "f_index.02.L", "f_index.03.L"], "middle": ["f_middle.01.L", "f_middle.02.L", "f_middle.03.L"], "thumb": ["thumb.01.L", "thumb.02.L", "thumb.03.L"]}
- Right chains: {"index": ["f_index.01.R", "f_index.02.R", "f_index.03.R"], "middle": ["f_middle.01.R", "f_middle.02.R", "f_middle.03.R"], "thumb": ["thumb.01.R", "thumb.02.R", "thumb.03.R"]}

## Feet and toes

- Left foot: foot.L
- Right foot: foot.R
- Left toe: toe.L
- Right toe: toe.R
- Foot support: good

## Face / expressions / face-touch

- Head: -
- Jaw: jaw.L
- Eye bones: eye.L, eye.R
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

Grogu uses generic/custom naming with 140 bones, 7 meshes, 2 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are good, hands are good, fingers are partial, and face-touch is not_supported. License is unknown; verify before redistribution.
