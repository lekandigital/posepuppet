# Avatar audit: Rigged Hand

## Verdict

Label: hand-only
Overall score: 32
Recommended runtime profile: hand-only
One-sentence recommendation: Use as a hand/finger retargeting test asset, not as a full avatar.

## Source files

- Selected source: `rigged-hand.zip!/source/handRig_02.fbx`
- Selected format: `fbx`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 1
- Vertices: 14499
- Triangles: 28994
- Estimated height: 1.77464
- Bounding box size: [1.85285, 1.46773, 1.77464]
- Materials/textures: 1 materials, 4 images

## Rig summary

- Has armature: True
- Primary armature: Armature
- Bone count: 68 (68 deform, 30 control/non-deform)
- Naming style guess: control-rig/custom
- Skinned meshes: 1
- Constraints: 0 total; IK: False
- Rest pose guess: hand-only

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
| `rightHand` | hand.R |
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
- Right hand: hand.R
- Finger support: poor
- Left chains: {}
- Right chains: {"index": ["index_01.R", "index_02.R", "index_03.R", "index_03.R_end", "index_Ctrl.R", "index_Ctrl.R_end", "index_Ctrl_01.R", "index_Ctrl_02.R", "index_Ctrl_03.R", "index_Ctrl_03.R_end", "index_base.R", "index_tip.R", "index_tip.R_end"], "middle": ["middle_01.R", "middle_02.R", "middle_03.R", "middle_03.R_end", "middle_Ctrl.R", "middle_Ctrl.R_end", "middle_Ctrl_01.R", "middle_Ctrl_02.R", "middle_Ctrl_03.R", "middle_Ctrl_03.R_end", "middle_base.R", "middle_tip.R", "middle_tip.R_end"], "pinky": ["pinky_01.R", "pinky_02.R", "pinky_03.R", "pinky_03.R_end", "pinky_Ctrl.R", "pinky_Ctrl.R_end", "pinky_Ctrl_01.R", "pinky_Ctrl_02.R", "pinky_Ctrl_03.R", "pinky_Ctrl_03.R_end", "pinky_base.R", "pinky_tip.R", "pinky_tip.R_end"], "ring": ["ring_01.R", "ring_02.R", "ring_03.R", "ring_03.R_end", "ring_Ctrl.R", "ring_Ctrl.R_end", "ring_Ctrl_01.R", "ring_Ctrl_02.R", "ring_Ctrl_03.R", "ring_Ctrl_03.R_end", "ring_base.R", "ring_tip.R", "ring_tip.R_end"], "thumb": ["thumb_01.R", "thumb_02.R", "thumb_03.R", "thumb_03.R_end", "thumb_Ctrl.R", "thumb_Ctrl.R_end", "thumb_Ctrl_01.R", "thumb_Ctrl_02.R", "thumb_Ctrl_03.R", "thumb_Ctrl_03.R_end", "thumb_base.R", "thumb_tip.R", "thumb_tip.R_end"]}

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
- Shape keys: 0
- Expression support: missing
- Face-touch feasibility: not_supported

## PosePuppet support

- Upper body: missing
- Legs: missing
- Feet: missing
- Toes: missing
- Hands: partial
- Fingers: poor
- Facial expressions: missing

## Warnings

- Feet are missing or asymmetric; disable foot orientation control.
- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- Ignored Blender FBX importer light cast_shadow compatibility error.
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Add a hand-only runtime profile driven by MediaPipe hand landmarks.

## What to tell another LLM

Rigged Hand uses control-rig/custom naming with 68 bones, 1 meshes, 1 skinned meshes, and label hand-only. Upper body is missing, legs are missing, hands are partial, fingers are poor, and face-touch is not_supported. License is unknown; verify before redistribution.
