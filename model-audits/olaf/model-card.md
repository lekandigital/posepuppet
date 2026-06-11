# Avatar audit: Olaf

## Verdict

Label: non-humanoid / creature-profile-needed
Overall score: 60
Recommended runtime profile: creature
One-sentence recommendation: Keep for a custom creature profile; do not wire into standard humanoid retargeting yet.

## Source files

- Selected source: `olaf-3d-rigged.zip!/source/OlafRig.blend`
- Selected format: `blend`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 28
- Vertices: 11361
- Triangles: 22191
- Estimated height: 6.13647
- Bounding box size: [6.69889, 2.36704, 6.13647]
- Materials/textures: 3 materials, 5 images

## Rig summary

- Has armature: True
- Primary armature: OlafRig
- Bone count: 100 (100 deform, 3 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 18
- Constraints: 2 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | LowerBodyPelvis |
| `spine` | - |
| `chest` | - |
| `upperChest` | - |
| `neck` | - |
| `head` | Head |
| `leftShoulder` | - |
| `leftUpperArm` | UpperArm.L |
| `leftLowerArm` | LowerArm.L |
| `leftHand` | Hand.L |
| `rightShoulder` | - |
| `rightUpperArm` | UpperArm.R |
| `rightLowerArm` | LowerArm.R |
| `rightHand` | Hand.R |
| `leftUpperLeg` | - |
| `leftLowerLeg` | Leg.L |
| `leftFoot` | BodyFoot.L |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | Leg.R |
| `rightFoot` | BodyFoot.R |
| `rightToes` | - |
| `leftEye` | EyeDot.L |
| `rightEye` | eyeLash.R |
| `jaw` | - |

## Hands and fingers

- Left hand: Hand.L
- Right hand: Hand.R
- Finger support: partial
- Left chains: {"index": ["\u0130ndex.L", "\u0130ndex.L.001", "\u0130ndex.L.002"], "middle": ["Middle.L", "Middle.L.001", "Middle.L.002"], "pinky": ["Pinky.L", "Pinky.L.001", "Pinky.L.002"], "thumb": ["Thumb.L", "Thumb.L.001", "Thumb.L.002"]}
- Right chains: {"index": ["\u0130ndex.R", "\u0130ndex.R.001", "\u0130ndex.R.002"], "middle": ["Middle.R", "Middle.R.001", "Middle.R.002"], "pinky": ["Pinky.R", "Pinky.R.001", "Pinky.R.002"], "thumb": ["Thumb.R", "Thumb.R.001", "Thumb.R.002"]}

## Feet and toes

- Left foot: BodyFoot.L
- Right foot: BodyFoot.R
- Left toe: -
- Right toe: -
- Foot support: good

## Face / expressions / face-touch

- Head: Head
- Jaw: -
- Eye bones: EyeDot.L, EyeDot.R, EyeTarget.L, EyeTarget.R, MainEyeTarget, eyeLash.L, eyeLash.L.001, eyeLash.L.002, eyeLash.L.003, eyeLash.L.004, eyeLash.L.005, eyeLash.L.006, eyeLash.L.007, eyeLash.R, eyeLash.R.001, eyeLash.R.002, eyeLash.R.003, eyeLash.R.004, eyeLash.R.005, eyeLash.R.006
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

Olaf uses generic/custom naming with 100 bones, 28 meshes, 18 skinned meshes, and label non-humanoid / creature-profile-needed. Upper body is partial, legs are partial, hands are good, fingers are partial, and face-touch is limited. License is unknown; verify before redistribution.
