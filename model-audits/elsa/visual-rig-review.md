# Elsa visual rig review

- Visual review: `fail`
- Final classification: `deferred_manual_rig_repair`
- Browser capture status: `error`
- Contact sheet: `model-working/elsa/visual-review/contact-sheet.png`

The initial browser failure was fixed from an HTML fallback to serving the VRM, then Three-VRM rejected the file because required humanoid bones are missing.

## Required missing bones

- spine
- leftUpperLeg
- leftLowerLeg
- leftFoot
- rightUpperLeg
- rightLowerLeg
- rightFoot
