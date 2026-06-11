# Avatar audit: Elsa

## Verdict

Label: experimental
Overall score: 67
Recommended runtime profile: humanoid-with-offsets
One-sentence recommendation: Defer until rig, naming, and skinning issues are cleaned up.

## Source files

- Selected source: `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb`
- Selected format: `glb`
- From ZIP: `True`
- License: unknown; verify before redistribution

## Geometry

- Meshes: 3
- Vertices: 5914
- Triangles: 7634
- Estimated height: 4.53608
- Bounding box size: [1.90212, 14.49413, 4.53608]
- Materials/textures: 3 materials, 1 images

## Rig summary

- Has armature: True
- Primary armature: Armature
- Bone count: 124 (124 deform, 0 control/non-deform)
- Naming style guess: generic/custom
- Skinned meshes: 2
- Constraints: 0 total; IK: False
- Rest pose guess: unknown

## Humanoid mapping

| Humanoid slot | Bone |
|---|---|
| `hips` | character:jnt_hip |
| `spine` | - |
| `chest` | character:jnt_chest |
| `upperChest` | - |
| `neck` | character:jnt_neck |
| `head` | character:jnt_head |
| `leftShoulder` | character:jnt_L_shoulder |
| `leftUpperArm` | character:jnt_L_arm |
| `leftLowerArm` | character:jnt_L_forearm |
| `leftHand` | character:jnt_L_palm |
| `rightShoulder` | character:jnt_R_shoulder |
| `rightUpperArm` | character:jnt_R_arm |
| `rightLowerArm` | character:jnt_R_forearm |
| `rightHand` | character:jnt_R_palm |
| `leftUpperLeg` | - |
| `leftLowerLeg` | - |
| `leftFoot` | - |
| `leftToes` | - |
| `rightUpperLeg` | - |
| `rightLowerLeg` | - |
| `rightFoot` | - |
| `rightToes` | - |
| `leftEye` | character:jnt_L_eye |
| `rightEye` | character:jnt_R_eye |
| `jaw` | character:jnt_jaw |

## Hands and fingers

- Left hand: character:jnt_L_palm
- Right hand: character:jnt_R_palm
- Finger support: poor
- Left chains: {"thumb": ["character:jnt_L_thumb", "character:jnt_L_thumb.001", "character:jnt_L_thumb.001_end", "character:jnt_L_thumb_end"]}
- Right chains: {"thumb": ["character:jnt_R_thumb", "character:jnt_R_thumb.001", "character:jnt_R_thumb.001_end", "character:jnt_R_thumb_end"]}

## Feet and toes

- Left foot: -
- Right foot: -
- Left toe: -
- Right toe: -
- Foot support: missing

## Face / expressions / face-touch

- Head: character:jnt_head
- Jaw: character:jnt_jaw
- Eye bones: character:jnt_L_eye, character:jnt_L_eye.001, character:jnt_L_eye.001_end, character:jnt_L_eyeLid, character:jnt_L_eyeLid.001, character:jnt_L_eyeLid.001_end, character:jnt_L_eyeLid_end, character:jnt_L_eye_end, character:jnt_R_eye, character:jnt_R_eye.001, character:jnt_R_eye.001_end, character:jnt_R_eyeLid, character:jnt_R_eyeLid.001, character:jnt_R_eyeLid.001_end, character:jnt_R_eyeLid_end, character:jnt_R_eye_end
- Shape keys: 0
- Expression support: possible
- Face-touch feasibility: possible_with_ik

## PosePuppet support

- Upper body: good
- Legs: missing
- Feet: missing
- Toes: missing
- Hands: good
- Fingers: poor
- Facial expressions: possible

## Warnings

- Feet are missing or asymmetric; disable foot orientation control.
- Finger support is incomplete; use conservative MediaPipe hand retargeting.
- License unknown; do not redistribute this model or generated converted files.
- Screenshots were not generated; rerun with --screenshots if visual evidence is needed.
- character:jnt_L_palm mapped as hand candidate from wrist/palm
- character:jnt_R_palm mapped as hand candidate from wrist/palm

## Required Blender edits

- Add or rename missing upper-body humanoid bones, then verify skin weights.
- Add or verify thumb/index/middle/ring/pinky deform chains if finger puppeteering is needed.
- Add or verify left/right foot bones and weights before enabling leg support.

## Recommended PosePuppet changes

- Use normalized humanoid bone mapping and add model-specific offsets only after visual testing.

## What to tell another LLM

Elsa uses generic/custom naming with 124 bones, 3 meshes, 2 skinned meshes, and label experimental. Upper body is good, legs are missing, hands are good, fingers are poor, and face-touch is possible_with_ik. License is unknown; verify before redistribution.
