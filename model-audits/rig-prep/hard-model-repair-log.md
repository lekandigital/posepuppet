# Hard-model repair log

## Serious attempts

- Generated active browser capture for 10 smoke-passing candidates.
- Added scale-down-only generated-stage normalization for oversized VRM bounds.
- Removed a failed auto-orientation heuristic after it damaged valid models.
- Added tiny-bounds camera fallback to restore small/odd skinned bounds.
- Created ignored serving symlinks for elsa, buzz-lightyear, and teal-v2 before retry.
- Inspected hard-model audit JSON and bone trees for Elsa, Buzz, and Teal.
- Rendered source previews and proxy pose suites for hand-only and creature candidates.
- Downgraded or rejected candidates that did not pass visual review.

## Model blockers

- `amazing-spider-man-2`: Browser smoke reports loaded, but the visual contact sheet shows only the stage/floor; the avatar is not visually readable.
- `terminator-t-800`: Browser smoke reports loaded, but the contact sheet remains visually blank; no usable avatar silhouette is visible.
- `spider-man-no-way-home`: Earlier attempts exposed orientation/transform trouble; the final browser contact sheet is blank, so the candidate is not acceptable.
- `spider-man-playstation`: Browser visual evidence shows only the upper body; lower body is missing, submerged, or outside the readable frame.
- `jack-sparrow`: Scale repair made the model visible, but every browser pose renders two Jack figures side by side.
- `elsa`: The initial browser failure was fixed from an HTML fallback to serving the VRM, then Three-VRM rejected the file because required humanoid bones are missing.
- `buzz-lightyear`: Serving was repaired, but the candidate VRM has no usable Three-VRM humanoid mapping; source audit shows generic Bone.* hierarchy without semantic recovery from names alone.
- `teal-v2`: Serving was repaired and the source hierarchy contains recoverable semantic bones, but the exported VRM still misses required humanoid assignments.
