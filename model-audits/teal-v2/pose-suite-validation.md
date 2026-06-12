# Teal v2 pose-suite validation

- Status: `partial`
- Source: `generated-vrm-reference`
- Visual review: `not_available`

| Pose | Result | Reason |
| --- | --- | --- |
| `neutral` | `partial` | missing mapped bones: chest, hips |
| `arms_out` | `pass` | structural mapping supports this proxy; visual review still required |
| `arms_up` | `pass` | structural mapping supports this proxy; visual review still required |
| `arms_forward` | `pass` | structural mapping supports this proxy; visual review still required |
| `elbow_bend` | `partial` | missing mapped bones: leftLowerArm, rightLowerArm |
| `wrist_rotate` | `partial` | missing mapped bones: leftHand, rightHand |
| `palm_forward` | `partial` | missing mapped bones: leftHand, rightHand |
| `lean_left` | `partial` | missing mapped bones: chest, hips |
| `lean_right` | `partial` | missing mapped bones: chest, hips |
| `torso_turn` | `partial` | missing mapped bones: chest, hips |
| `walking_stride_proxy` | `partial` | missing mapped bones: leftUpperLeg, rightUpperLeg |
| `foot_lift` | `pass` | structural mapping supports this proxy; visual review still required |
| `foot_rotate` | `pass` | structural mapping supports this proxy; visual review still required |
| `rowing_stroke` | `partial` | missing mapped bones: leftLowerArm, rightLowerArm |
| `flying_arms_out` | `pass` | structural mapping supports this proxy; visual review still required |
| `hand_to_mouth_proxy` | `partial` | missing mapped bones: leftHand, rightHand |
| `hand_to_cheek_proxy` | `partial` | missing mapped bones: leftHand, rightHand |

## Visual QA Continuation

- Status: `blocked`
- Pose count: `0`
- Contact sheet: `model-working/teal-v2/visual-review/contact-sheet.png`

Browser visual pose capture could not run because Three-VRM rejected the required humanoid bones before the candidate loaded. Earlier structural pose-suite details above are preserved.
