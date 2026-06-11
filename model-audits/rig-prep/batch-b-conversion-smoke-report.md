# Batch B Conversion Smoke Report

- Batch: `B`
- Created: `2026-06-11T16:52:00+00:00`
- Models attempted: `amazing-spider-man-2`, `terminator-t-800`, `spider-man-no-way-home`
- Models converted: `3/3`
- Models validated: `3/3`
- Models browser-smoke pass: `3/3`
- Models failed: `0`

## Per-Model Summary

| Model | Conversion | VRM Size | Bones | VRMC | Validation | Browser Smoke |
|-------|-----------|----------|-------|------|-----------|---------------|
| amazing-spider-man-2 | pass | 10.7 MB | 22 | ✓ | pass | pass |
| terminator-t-800 | pass | 737 KB | 22 | ✓ | pass | pass |
| spider-man-no-way-home | pass | 15.2 MB | 22 | ✓ | pass | pass |

## Playwright Tests

- Total: `10`
- Passed: `10`
- Failed: `0`
- Duration: `28.5s`

## Safety Invariants

- npm build: `pass`
- Generated VRMs staged: `no`
- Public UI promotion: `no`
- Normal avatar cycling unchanged: `yes`
- Generated VRMs ignored by git: `yes`

## Notes

All three Batch B models converted cleanly. amazing-spider-man-2 used an FBX source, terminator-t-800 used a Blend source, and spider-man-no-way-home used a GLB source. All three produced valid VRMs with VRMC_vrm humanoid extensions and 22 humanoid bones. All three loaded successfully in the browser via the smoke test query parameter path. Fingers are missing on all three models. Scale varies significantly (spider-man-no-way-home estimated height 7.38, amazing-spider-man-2 height 55.74, terminator-t-800 height 213.55) which may affect runtime quality but does not block browser smoke.
