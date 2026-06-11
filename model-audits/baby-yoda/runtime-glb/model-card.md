# Avatar audit: Baby Yoda

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 27
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `baby_yoda_mandalorian_-_low_poly_-_basic_rig.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 22
- Vertices: 35287
- Triangles: 69194
- Estimated height: 42.92535
- Bounding box size: [56.93352, 79.87222, 42.92535]
- Materials/textures: 11 materials, 0 images

## Rig summary

- Has armature: True
- Primary armature: Armature
- Bone count: 12 (12 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 9
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | - |
| `spine` | - |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | - |
| `leftShoulder` | - |
| `leftUpperArm` | - |
| `leftLowerArm` | - |
| `leftHand` | - |
| `rightShoulder` | - |
| `rightUpperArm` | - |
| `rightLowerArm` | - |
| `rightHand` | - |
| `leftUpperLeg` | - |
| `leftLowerLeg` | - |
| `leftFoot` | - |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | - |
| `rightFoot` | - |
| `rightToes` | - |
| `leftEye` | - |
| `rightEye` | - |
| `jaw` | - |

## Hands and fingers

- Left hand: -
- Right hand: -
- Finger support: missing
- Left chains: {}
- Right chains: {}

## Feet and toes

- Left foot: -
- Right foot: -
- Left toe: -
- Right toe: -
- Foot support: missing

## Face / expressions / face-touch

- Head: -
- Jaw: -
- Eye bones: -
- Shape keys: 4
- Expression support: possible
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: missing
- Legs: missing
- Feet: missing
- Toes: missing
- Hands: missing
- Fingers: missing
- Facial expressions: possible

## Warnings

- Feet are missing or asymmetric; disable foot orientation control.
- License unknown; do not redistribute this model or generated converted files.
- Model appears to be creature/non-human anatomy; do not force standard humanoid retargeting.
- No usable hand bones detected; face-touch and hand control are not supported.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Create a custom creature runtime profile with anatomy-specific offsets and enabled joints.

## What to tell another LLM

Baby Yoda uses generic/custom naming with 12 bones, 22 meshes, 9 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is missing, legs are missing, hands are missing, fingers are missing, and face-touch is not_supported. License is unknown; verify before redistribution.
