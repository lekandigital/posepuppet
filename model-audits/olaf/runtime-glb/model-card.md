# Avatar audit: Olaf

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `olaf_3d_rigged.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 22
- Vertices: 13090
- Triangles: 22271
- Estimated height: 5.13896
- Bounding box size: [3.09005, 2.23332, 5.13896]
- Materials/textures: 2 materials, 3 images

## Rig summary

- Has armature: True
- Primary armature: GLTF_created_0
- Bone count: 101 (101 deform, 3 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 10
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | LowerBodyPelvis_107 |
| `spine` | - |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | Head_92 |
| `leftShoulder` | - |
| `leftUpperArm` | UpperArm.L_29 |
| `leftLowerArm` | LowerArm.L_28 |
| `leftHand` | Hand.L_27 |
| `rightShoulder` | - |
| `rightUpperArm` | UpperArm.R_14 |
| `rightLowerArm` | LowerArm.R_13 |
| `rightHand` | Hand.R_12 |
| `leftUpperLeg` | - |
| `leftLowerLeg` | Leg.L_102 |
| `leftFoot` | BodyFoot.L_103 |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | Leg.R_105 |
| `rightFoot` | BodyFoot.R_106 |
| `rightToes` | - |
| `leftEye` | EyeDot.L_70 |
| `rightEye` | eyeLash.R.001_85 |
| `jaw` | - |

## Hands and fingers

- Left hand: Hand.L_27
- Right hand: Hand.R_12
- Finger support: partial
- Left chains: {"middle": ["Middle.L.001_19", "Middle.L.002_18", "Middle.L_20"], "pinky": ["Pinky.L.001_16", "Pinky.L.002_15", "Pinky.L_17"], "thumb": ["Thumb.L.001_25", "Thumb.L.002_24", "Thumb.L_26"]}
- Right chains: {"middle": ["Middle.R.001_4", "Middle.R.002_3", "Middle.R_5"], "pinky": ["Pinky.R.001_1", "Pinky.R.002_0", "Pinky.R_2"], "thumb": ["Thumb.R.001_10", "Thumb.R.002_9", "Thumb.R_11"]}

## Feet and toes

- Left foot: BodyFoot.L_103
- Right foot: BodyFoot.R_106
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: Head_92
- Jaw: -
- Eye bones: EyeDot.L_70, EyeDot.R_72, EyeTarget.L_73, EyeTarget.R_74, MainEyeTarget_75, eyeLash.L.001_77, eyeLash.L.002_78, eyeLash.L.003_79, eyeLash.L.004_80, eyeLash.L.005_81, eyeLash.L.006_82, eyeLash.L.007_83, eyeLash.L_76, eyeLash.R.001_85, eyeLash.R.002_86, eyeLash.R.003_87, eyeLash.R.004_88, eyeLash.R.005_89, eyeLash.R.006_90, eyeLash.R.007_91
- Shape keys: 0
- Expression support: missing
- Face-touch feasibility: limited

## PosePuppet support

- Upper body: partial
- Legs: partial
- Feet: good
- Toes: missing
- Hands: good
- Fingers: partial
- Facial expressions: missing

## Warnings

- Feet exist but toes are missing; disable toe articulation.
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

Olaf uses generic/custom naming with 101 bones, 22 meshes, 10 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are good, fingers are partial, and face-touch is limited. License is unknown; verify before redistribution.
