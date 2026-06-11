# Avatar audit: Rigged Hand

## Verdict

Label: hand-only
Overall score: 32
Recommended runtime profile: hand-only
One-sentence recommendation: Use as a hand/finger retargeting test asset, not as a full avatar.

## Source files

- Selected source: `rigged_hand.glb`
- Selected format: `glb`
- From ZIP: `False`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 2
- Vertices: 16372
- Triangles: 29074
- Estimated height: 3.29727
- Bounding box size: [5.04262, 5.86856, 3.29727]
- Materials/textures: 1 materials, 3 images

## Rig summary

- Has armature: True
- Primary armature: Object_11
- Bone count: 69 (69 deform, 30 control/non-deform)
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
| `rightHand` | hand.R_02 |
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
- Right hand: hand.R_02
- Finger support: poor
- Left chains: {}
- Right chains: {"index": ["index_01.R_017", "index_02.R_018", "index_03.R_019", "index_03.R_end_053", "index_Ctrl.R_013", "index_Ctrl.R_end_00", "index_Ctrl_01.R_014", "index_Ctrl_02.R_015", "index_Ctrl_03.R_016", "index_Ctrl_03.R_end_052", "index_base.R_012", "index_tip.R_044", "index_tip.R_end_063"], "middle": ["middle_01.R_025", "middle_02.R_026", "middle_03.R_027", "middle_03.R_end_056", "middle_Ctrl.R_021", "middle_Ctrl.R_end_054", "middle_Ctrl_01.R_022", "middle_Ctrl_02.R_023", "middle_Ctrl_03.R_024", "middle_Ctrl_03.R_end_055", "middle_base.R_020", "middle_tip.R_045", "middle_tip.R_end_064"], "pinky": ["pinky_01.R_041", "pinky_02.R_042", "pinky_03.R_043", "pinky_03.R_end_062", "pinky_Ctrl.R_037", "pinky_Ctrl.R_end_060", "pinky_Ctrl_01.R_038", "pinky_Ctrl_02.R_039", "pinky_Ctrl_03.R_040", "pinky_Ctrl_03.R_end_061", "pinky_base.R_036", "pinky_tip.R_047", "pinky_tip.R_end_066"], "ring": ["ring_01.R_033", "ring_02.R_034", "ring_03.R_035", "ring_03.R_end_059", "ring_Ctrl.R_029", "ring_Ctrl.R_end_057", "ring_Ctrl_01.R_030", "ring_Ctrl_02.R_031", "ring_Ctrl_03.R_032", "ring_Ctrl_03.R_end_058", "ring_base.R_028", "ring_tip.R_046", "ring_tip.R_end_065"], "thumb": ["thumb_01.R_08", "thumb_02.R_09", "thumb_03.R_010", "thumb_03.R_end_051", "thumb_Ctrl.R_04", "thumb_Ctrl.R_end_049", "thumb_Ctrl_01.R_05", "thumb_Ctrl_02.R_06", "thumb_Ctrl_03.R_07", "thumb_Ctrl_03.R_end_050", "thumb_base.R_03", "thumb_tip.R_048", "thumb_tip.R_end_067"]}

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
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Add a hand-only runtime profile driven by MediaPipe hand landmarks.

## What to tell another LLM

Rigged Hand uses control-rig/custom naming with 69 bones, 2 meshes, 1 skinned meshes, and label hand-only. Upper body is missing, legs are missing, hands are partial, fingers are poor, and face-touch is not_supported. License is unknown; verify before redistribution.
