# Avatar audit: Xenomorph

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx`
- Selected format: `fbx`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 1
- Vertices: 26781
- Triangles: 51548
- Estimated height: 149.61394
- Bounding box size: [101.13879, 242.166, 149.61394]
- Materials/textures: 2 materials, 0 images

## Rig summary

- Has armature: True
- Primary armature: alien_xenos_drone_SK_Xenos_Drone_skeleton
- Bone count: 170 (170 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | XenosBiped_Spine_01SHJnt |
| `chest` | - |
| `upperChest` | - |
| `neck` | XenosBiped_Neck_01SHJnt |
| `head` | XenosBiped_Head_TopSHJnt |
| `leftShoulder` | XenosBiped_l_Arm_ShoulderSHJnt |
| `leftUpperArm` | XenosBiped_l_Arm_Lower_Curve1SHJnt |
| `leftLowerArm` | XenosBiped_l_Arm_Elbow_CurveSHJnt |
| `leftHand` | - |
| `rightShoulder` | XenosBiped_r_Arm_ShoulderSHJnt |
| `rightUpperArm` | XenosBiped_r_Arm_Lower_Curve1SHJnt |
| `rightLowerArm` | XenosBiped_r_Arm_Elbow_CurveSHJnt |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | XenosBiped_l_Leg_HipSHJnt |
| `leftFoot` | XenosBiped_l_Leg_AnkleSHJnt |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | XenosBiped_r_Leg_HipSHJnt |
| `rightFoot` | XenosBiped_r_Leg_AnkleSHJnt |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | XenosBiped_Head_JawSHJnt |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: poor
- Left chains: {"middle": ["XenosBiped_l_Leg_Middle_Curve1SHJnt", "XenosBiped_l_Leg_Middle_Curve1SHJnt_end"], "thumb": ["XenosBiped_l_Thumb_01_01SHJnt", "XenosBiped_l_Thumb_01_02SHJnt", "XenosBiped_l_Thumb_01_03SHJnt", "XenosBiped_l_Thumb_01_03SHJnt_end"]}
- Right chains: {"middle": ["XenosBiped_r_Leg_Middle_Curve1SHJnt", "XenosBiped_r_Leg_Middle_Curve1SHJnt_end"], "thumb": ["XenosBiped_r_Thumb_01_01SHJnt", "XenosBiped_r_Thumb_01_02SHJnt", "XenosBiped_r_Thumb_01_03SHJnt", "XenosBiped_r_Thumb_01_03SHJnt_end"]}

## Feet and toes

- Left foot: XenosBiped_l_Leg_AnkleSHJnt
- Right foot: XenosBiped_r_Leg_AnkleSHJnt
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: XenosBiped_Head_TopSHJnt
- Jaw: XenosBiped_Head_JawSHJnt
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

Xenomorph uses generic/custom naming with 170 bones, 1 meshes, 1 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are missing, fingers are poor, and face-touch is not_supported. License is unknown; verify before redistribution.
