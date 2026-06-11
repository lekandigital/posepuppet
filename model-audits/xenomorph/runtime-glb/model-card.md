# Avatar audit: Xenomorph

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `realistic_xenomorph_rig.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 3
- Vertices: 30705
- Triangles: 51623
- Estimated height: 11.72837
- Bounding box size: [2.19236, 21.14813, 11.72837]
- Materials/textures: 2 materials, 6 images

## Rig summary

- Has armature: True
- Primary armature: Object_6
- Bone count: 171 (171 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 2
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | XenosBiped_Spine_01SHJnt_04 |
| `chest` | - |
| `upperChest` | - |
| `neck` | XenosBiped_Neck_01SHJnt_08 |
| `head` | XenosBiped_Head_TopSHJnt_017 |
| `leftShoulder` | XenosBiped_l_Arm_ShoulderSHJnt_028 |
| `leftUpperArm` | XenosBiped_l_Arm_Lower_Curve1SHJnt_044 |
| `leftLowerArm` | XenosBiped_l_Arm_Elbow_CurveSHJnt_030 |
| `leftHand` | - |
| `rightShoulder` | XenosBiped_r_Arm_ShoulderSHJnt_046 |
| `rightUpperArm` | XenosBiped_r_Arm_Lower_Curve1SHJnt_062 |
| `rightLowerArm` | XenosBiped_r_Arm_Elbow_CurveSHJnt_048 |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | XenosBiped_l_Leg_HipSHJnt_075 |
| `leftFoot` | XenosBiped_l_Leg_AnkleSHJnt_080 |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | XenosBiped_r_Leg_HipSHJnt_085 |
| `rightFoot` | XenosBiped_r_Leg_AnkleSHJnt_090 |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | XenosBiped_Head_JawSHJnt_010 |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: poor
- Left chains: {"middle": ["XenosBiped_l_Leg_Middle_Curve1SHJnt_078", "XenosBiped_l_Leg_Middle_Curve1SHJnt_end_0154"], "thumb": ["XenosBiped_l_Thumb_01_01SHJnt_041", "XenosBiped_l_Thumb_01_02SHJnt_042", "XenosBiped_l_Thumb_01_03SHJnt_043", "XenosBiped_l_Thumb_01_03SHJnt_end_0141"]}
- Right chains: {"middle": ["XenosBiped_r_Leg_Middle_Curve1SHJnt_088", "XenosBiped_r_Leg_Middle_Curve1SHJnt_end_0162"], "thumb": ["XenosBiped_r_Thumb_01_01SHJnt_059", "XenosBiped_r_Thumb_01_02SHJnt_060", "XenosBiped_r_Thumb_01_03SHJnt_061", "XenosBiped_r_Thumb_01_03SHJnt_end_0147"]}

## Feet and toes

- Left foot: XenosBiped_l_Leg_AnkleSHJnt_080
- Right foot: XenosBiped_r_Leg_AnkleSHJnt_090
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: XenosBiped_Head_TopSHJnt_017
- Jaw: XenosBiped_Head_JawSHJnt_010
- Eye bones: -
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: partial
- Legs: partial
- Feet: good
- Toes: missing
- Hands: missing
- Fingers: poor
- Facial expressions: possible

## Warnings

- Feet exist but toes are missing; disable toe articulation.
- License unknown; do not redistribute this model or generated converted files.
- Model appears to be creature/non-human anatomy; do not force standard humanoid retargeting.
- No usable hand bones detected; face-touch and hand control are not supported.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.
- ankle mapped as foot candidate

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.

## Recommended PosePuppet changes

- Create a custom creature runtime profile with anatomy-specific offsets and enabled joints.

## What to tell another LLM

Xenomorph uses generic/custom naming with 171 bones, 3 meshes, 2 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are missing, fingers are poor, and face-touch is not_supported. License is unknown; verify before redistribution.
